import { useContext, useRef, useState, useCallback, useMemo, useEffect } from "react";
import { dellaRespira } from "../../fonts";
import { CoreContext, HoverContext, MaskContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import styles from "../../app.module.css";
import {
  addCircle,
  antigravity200,
  arrowDropDown,
  arrowDropUp,
  asterisk200,
  checkCircle,
  circle,
  closeIcon,
  SvgRepo,
  type LaurusClientSvg,
} from "../../svg-repo";
import {
  deleteMediaGroup,
  LaurusImgResult,
  LaurusLight,
  LaurusMaskResult,
  LaurusMediaGroupResult,
  LaurusObject,
  LaurusSvgResult,
  maskLabel,
  updateMediaGroup,
} from "../workspace.server";
import {
  isBehindMask,
  MASK_PLANE_ROW,
  maskStack,
  restackFromDrop,
  stackRows,
  type StackRef,
  type StackRow,
} from "../canvas-media/mask-order";
import { frontToBackMedia, restackGroupWithinProject, type StackedMedia } from "./media-stack";
import { updateProject, LaurusProjectResult } from "../../projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { useSelectionGuard } from "../hooks/useMaskEditExit";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { beginBodyDragCursor, endBodyDragCursor } from "../hooks/useToolCursor";

type MediaGroupItem =
  | { type: "img"; key: string; img: LaurusImgResult }
  | { type: "svg"; key: string; svg: LaurusSvgResult }
  | { type: "mask"; key: string; mask: LaurusMaskResult };

export interface MediaGroupBrowser {
  mediaGroupId: string;
  mediaGroupResult: LaurusMediaGroupResult;
  maxWidth: number;
}
export default function MediaGroupBrowser({ mediaGroupId, mediaGroupResult, maxWidth }: MediaGroupBrowser) {
  const { coreState, dispatch } = useContext(CoreContext);
  const {
    notifyMaskToolChanged,
    notifyMaskSelectionChanged,
    notifyMaskSelectedLightChanged,
    notifyMaskSelectedObjectChanged,
    restackMaskStack,
  } = useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const guardSelection = useSelectionGuard();
  const {
    isAltKeyPressed,
    selectedImgKeys,
    selectedSvgKeys,
    selectedMaskKeys,
    setSelectedImgKeys,
    setSelectedSvgKeys,
    setSelectedMaskKeys,
  } = useContext(HoverContext);
  const [adding, setAdding] = useState(false);
  const [isTitleBarHovered, setIsTitleBarHovered] = useState(false);

  const [expandedMaskKeys, setExpandedMaskKeys] = useState<Set<string>>(new Set());
  const toggleMaskExpanded = useCallback((key: string) => {
    setExpandedMaskKeys((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);
  const hasSelection = useMemo(
    () => selectedImgKeys.size > 0 || selectedSvgKeys.size > 0 || selectedMaskKeys.size > 0,
    [selectedImgKeys, selectedSvgKeys, selectedMaskKeys],
  );
  const groupItems = useMemo<MediaGroupItem[]>(() => {
    const imgItems = Array.from(coreState.project.imgs.entries())
      .filter(([, meta]) => meta.media_group_id === mediaGroupId)
      .map(([key, meta]) => {
        const img = coreState.canvasImgs.get(key);
        return img ? { type: "img" as const, key, img, order: meta.order } : undefined;
      })
      .filter((entry): entry is { type: "img"; key: string; img: LaurusImgResult; order: number } => Boolean(entry));
    const svgItems = Array.from(coreState.project.svgs.entries())
      .filter(([, meta]) => meta.media_group_id === mediaGroupId)
      .map(([key, meta]) => {
        const svg = coreState.canvasSvgs.get(key);
        return svg ? { type: "svg" as const, key, svg, order: meta.order } : undefined;
      })
      .filter((entry): entry is { type: "svg"; key: string; svg: LaurusSvgResult; order: number } => Boolean(entry));
    const maskItems = Array.from(coreState.project.masks.entries())
      .filter(([, meta]) => meta.media_group_id === mediaGroupId)
      .map(([key, meta]) => {
        const mask = coreState.canvasMasks.get(key);
        return mask ? { type: "mask" as const, key, mask, order: meta.order } : undefined;
      })
      .filter((entry): entry is { type: "mask"; key: string; mask: LaurusMaskResult; order: number } => Boolean(entry));

    return frontToBackMedia([...imgItems, ...svgItems, ...maskItems]).map((entry) =>
      entry.type === "img"
        ? { type: "img" as const, key: entry.key, img: entry.img }
        : entry.type === "svg"
          ? { type: "svg" as const, key: entry.key, svg: entry.svg }
          : { type: "mask" as const, key: entry.key, mask: entry.mask },
    );
  }, [
    coreState.project.imgs,
    coreState.project.svgs,
    coreState.project.masks,
    coreState.canvasImgs,
    coreState.canvasSvgs,
    coreState.canvasMasks,
    mediaGroupId,
  ]);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          flex: {
            height: 32,
            paddingLeft: 0,
          },
          input: {
            fontSize: 11,
            letterSpacing: 3,
          },
          toggle: {
            div: {
              paddingLeft: 6,
              paddingRight: 10,
              gap: 0,
              fontSize: 10,
            },
            track: {
              width: 22,
              height: 10,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 6,
              height: 6,
            },
            translateX: 12,
          },
          delete: {
            container: {
              width: 40,
              height: 32,
            },
          },
          timelineAreaContent: {
            height: 40,
            padding: "0px 8px",
            svg: { width: 20, height: 40 },
          },
          indexColumn: {
            width: "4ch",
            fontSize: 9,
          },
          removeOverlay: {
            size: 16,
          },
        };
      case "midhigh":
        return {
          flex: {
            height: 24,
            paddingLeft: 0,
          },
          input: {
            fontSize: 10,
            letterSpacing: 3,
          },
          toggle: {
            div: {
              paddingLeft: 6,
              paddingRight: 6,
              gap: 0,
              fontSize: 10,
            },
            track: {
              width: 18,
              height: 8,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 5,
              height: 5,
            },
            translateX: 9,
          },
          delete: {
            container: {
              width: 36,
              height: 24,
            },
          },
          timelineAreaContent: {
            height: 32,
            padding: "0px 6px",
            svg: { width: 16, height: 32 },
          },
          indexColumn: {
            width: "4ch",
            fontSize: 7,
          },
          removeOverlay: {
            size: 18,
          },
        };
      case "midlow":
      case "low":
        return {
          flex: {
            height: 24,
            paddingLeft: 0,
          },
          input: {
            fontSize: 9,
            letterSpacing: 3,
          },
          toggle: {
            div: {
              paddingLeft: 6,
              paddingRight: 6,
              gap: 0,
              fontSize: 10,
            },
            track: {
              width: 18,
              height: 8,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 5,
              height: 5,
            },
            translateX: 9,
          },
          delete: {
            container: {
              width: 30,
              height: 24,
            },
          },
          timelineAreaContent: {
            height: 32,
            padding: "0px 6px",
            svg: { width: 16, height: 32 },
          },
          indexColumn: {
            width: "4ch",
            fontSize: 7,
          },
          removeOverlay: {
            size: 16,
          },
        };
    }
  });

  const mediaGroupDescriptionRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onMediaGroupDescriptionChange = useCallback(
    (newValue: string) => {
      const snapshot = { ...mediaGroupResult };
      const newMediaGroup: LaurusMediaGroupResult = {
        ...snapshot,
        description: newValue,
      };
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        updateMediaGroup(coreState.apiOrigin, coreState.accessToken, mediaGroupId, newMediaGroup).then((updated) => {
          if (!updated) {
            dispatch({ type: CoreActionType.SetMediaGroup, value: snapshot, preserveCache: true });
            const inputEl = mediaGroupDescriptionRef.current;
            if (inputEl) {
              inputEl.value = snapshot.description;
            }
          } else {
            dispatch({
              type: CoreActionType.SetMediaGroup,
              value: newMediaGroup,
              preserveCache: true,
            });
          }
        });
      }, 1000);
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, mediaGroupId, mediaGroupResult],
  );

  const onAddSelectedMediaClick = useCallback(async () => {
    if (!hasSelection || adding || !coreState.project.project_id) return;
    setAdding(true);
    try {
      const newImgs = new Map(coreState.project.imgs);
      selectedImgKeys.forEach((key) => {
        const img = newImgs.get(key);
        if (img) newImgs.set(key, { ...img, media_group_id: mediaGroupId });
      });
      const newSvgs = new Map(coreState.project.svgs);
      selectedSvgKeys.forEach((key) => {
        const svg = newSvgs.get(key);
        if (svg) newSvgs.set(key, { ...svg, media_group_id: mediaGroupId });
      });
      const newMasks = new Map(coreState.project.masks);
      selectedMaskKeys.forEach((key) => {
        const mask = newMasks.get(key);
        if (mask) newMasks.set(key, { ...mask, media_group_id: mediaGroupId });
      });
      const newProject: LaurusProjectResult = { ...coreState.project, imgs: newImgs, svgs: newSvgs, masks: newMasks };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        setSelectedImgKeys(new Set());
        setSelectedSvgKeys(new Set());
        setSelectedMaskKeys(new Set());
        if (uiState.tool.type === "marquee" && uiState.tool.duplicate) {
          const newTool = { ...uiState.tool, duplicate: false };
          uiDispatch({ type: UIActionType.SetTool, value: newTool });
          notifyMaskToolChanged(newTool.type);
        }
      }
    } finally {
      setAdding(false);
    }
  }, [
    hasSelection,
    adding,
    coreState.project,
    coreState.apiOrigin,
    coreState.accessToken,
    selectedImgKeys,
    selectedSvgKeys,
    selectedMaskKeys,
    mediaGroupId,
    dispatch,
    setSelectedImgKeys,
    setSelectedSvgKeys,
    setSelectedMaskKeys,
    uiState.tool,
    uiDispatch,
    notifyMaskToolChanged,
  ]);

  const onSelectAllInGroupClick = useCallback(() => {
    if (groupItems.length === 0) return;
    setSelectedImgKeys(new Set(groupItems.filter((item) => item.type === "img").map((item) => item.key)));
    setSelectedSvgKeys(new Set(groupItems.filter((item) => item.type === "svg").map((item) => item.key)));
    setSelectedMaskKeys(new Set(groupItems.filter((item) => item.type === "mask").map((item) => item.key)));
    uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
  }, [groupItems, setSelectedImgKeys, setSelectedSvgKeys, setSelectedMaskKeys, uiDispatch]);

  const deleteMediaGroupClick = useCallback(async () => {
    setIsTitleBarHovered(false);
    if (!isAltKeyPressed) return;
    const confirmed = confirm("are you sure you want to delete this media group?");
    if (!confirmed) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const deleted = await deleteMediaGroup(coreState.apiOrigin, coreState.accessToken, mediaGroupId);
    if (deleted) {
      dispatch({ type: CoreActionType.DeleteMediaGroup, key: mediaGroupId });
    }
  }, [coreState.accessToken, coreState.apiOrigin, dispatch, isAltKeyPressed, mediaGroupId]);

  const onRemoveImgFromGroupClick = useCallback(
    async (key: string) => {
      if (!coreState.project.project_id) return;
      const entry = coreState.project.imgs.get(key);
      if (!entry) return;
      const newImgs = new Map(coreState.project.imgs);
      newImgs.set(key, { ...entry, media_group_id: "" });
      const newProject: LaurusProjectResult = { ...coreState.project, imgs: newImgs };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
      }
    },
    [coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
  );

  const onRemoveSvgFromGroupClick = useCallback(
    async (key: string) => {
      if (!coreState.project.project_id) return;
      const entry = coreState.project.svgs.get(key);
      if (!entry) return;
      const newSvgs = new Map(coreState.project.svgs);
      newSvgs.set(key, { ...entry, media_group_id: "" });
      const newProject: LaurusProjectResult = { ...coreState.project, svgs: newSvgs };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
      }
    },
    [coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
  );

  const onRemoveMaskFromGroupClick = useCallback(
    async (key: string) => {
      if (!coreState.project.project_id) return;
      const entry = coreState.project.masks.get(key);
      if (!entry) return;
      const newMasks = new Map(coreState.project.masks);
      newMasks.set(key, { ...entry, media_group_id: "" });
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
      }
    },
    [coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
  );

  const onImgContextMenuClick = useCallback(
    (key: string) => {
      uiDispatch({ type: UIActionType.SetProjectContextMenu, key, showContextMenu: true });
    },
    [uiDispatch],
  );

  const onSvgContextMenuClick = useCallback(
    (key: string) => {
      uiDispatch({ type: UIActionType.SetProjectContextMenu, key, showContextMenu: true });
    },
    [uiDispatch],
  );

  const onMaskContextMenuClick = useCallback(
    (key: string) => {
      uiDispatch({ type: UIActionType.SetSelectedElement, value: { key, type: "mask" } });
      notifyMaskSelectionChanged(key);
      notifyMaskSelectedLightChanged(key, undefined);
      notifyMaskSelectedObjectChanged(key, undefined);
      uiDispatch({ type: UIActionType.SetProjectContextMenu, key, showContextMenu: true });
    },
    [uiDispatch, notifyMaskSelectionChanged, notifyMaskSelectedLightChanged, notifyMaskSelectedObjectChanged],
  );

  const onObjectContextMenuClick = useCallback(
    (maskKey: string, objectId: number) => {
      uiDispatch({ type: UIActionType.SetSelectedElement, value: { key: maskKey, type: "object", objectId } });
      notifyMaskSelectionChanged(maskKey);
      notifyMaskSelectedObjectChanged(maskKey, objectId);
      notifyMaskSelectedLightChanged(maskKey, undefined);
      uiDispatch({ type: UIActionType.SetProjectContextMenu, key: maskKey, showContextMenu: true });
    },
    [uiDispatch, notifyMaskSelectionChanged, notifyMaskSelectedObjectChanged, notifyMaskSelectedLightChanged],
  );

  const onLightContextMenuClick = useCallback(
    (maskKey: string, lightId: number) => {
      uiDispatch({ type: UIActionType.SetSelectedElement, value: { key: maskKey, type: "light", lightId } });
      notifyMaskSelectionChanged(maskKey);
      notifyMaskSelectedLightChanged(maskKey, lightId);
      notifyMaskSelectedObjectChanged(maskKey, undefined);
      uiDispatch({ type: UIActionType.SetProjectContextMenu, key: maskKey, showContextMenu: true });
    },
    [uiDispatch, notifyMaskSelectionChanged, notifyMaskSelectedLightChanged, notifyMaskSelectedObjectChanged],
  );

  const expandedStacks = useMemo(() => {
    const stacks = new Map<string, StackRow[]>();
    groupItems.forEach((item) => {
      if (item.type !== "mask" || !expandedMaskKeys.has(item.key)) return;
      const stack = maskStack(item.mask);
      if (stack.length === 0) return;
      stacks.set(item.key, stackRows(stack));
    });
    return stacks;
  }, [groupItems, expandedMaskKeys]);

  const siblingRowIds = useCallback(
    (activeId: string): Set<string> => {
      for (const [maskKey, rows] of expandedStacks) {
        const ids = stackRowIds(maskKey, rows);
        if (ids.includes(activeId)) return new Set(ids);
      }
      return new Set(groupItems.map((item) => item.key));
    },
    [expandedStacks, groupItems],
  );

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const allowed = siblingRowIds(String(args.active.id));
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => allowed.has(String(container.id))),
      });
    },
    [siblingRowIds],
  );

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onStackDrop = useCallback(
    (activeId: string, overId: string): boolean => {
      for (const [maskKey, rows] of expandedStacks) {
        const ids = stackRowIds(maskKey, rows);
        const fromIndex = ids.indexOf(activeId);
        if (fromIndex === -1) continue;
        const toIndex = ids.indexOf(overId);
        if (toIndex === -1) return true;
        const mask = coreState.canvasMasks.get(maskKey);
        if (mask) restackMaskStack(maskKey, restackFromDrop(maskStack(mask), rows, fromIndex, toIndex));
        return true;
      }
      return false;
    },
    [expandedStacks, coreState.canvasMasks, restackMaskStack],
  );

  const onGroupDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !coreState.project.project_id) return;
      if (onStackDrop(String(active.id), String(over.id))) return;
      const oldIndex = groupItems.findIndex((item) => item.key === active.id);
      const newIndex = groupItems.findIndex((item) => item.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const groupFrontToBack = arrayMove(groupItems, oldIndex, newIndex).map((item) => item.key);
      const allItems: StackedMedia[] = [
        ...Array.from(coreState.project.imgs, ([key, meta]) => ({ type: "img" as const, key, order: meta.order })),
        ...Array.from(coreState.project.svgs, ([key, meta]) => ({ type: "svg" as const, key, order: meta.order })),
        ...Array.from(coreState.project.masks, ([key, meta]) => ({ type: "mask" as const, key, order: meta.order })),
      ];
      const moved = restackGroupWithinProject(allItems, groupFrontToBack);
      if (moved.size === 0) return;

      const snapshot = coreState.project;
      const newImgs = new Map(coreState.project.imgs);
      const newSvgs = new Map(coreState.project.svgs);
      const newMasks = new Map(coreState.project.masks);
      moved.forEach((order, key) => {
        const img = newImgs.get(key);
        if (img) {
          newImgs.set(key, { ...img, order });
          return;
        }
        const svg = newSvgs.get(key);
        if (svg) {
          newSvgs.set(key, { ...svg, order });
          return;
        }
        const mask = newMasks.get(key);
        if (mask) newMasks.set(key, { ...mask, order });
      });

      const newProject: LaurusProjectResult = { ...coreState.project, imgs: newImgs, svgs: newSvgs, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, { ...newProject }).then(
        (updated) => {
          if (!updated) {
            dispatch({ type: CoreActionType.SetProject, value: snapshot });
          }
        },
      );
    },
    [groupItems, coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch, onStackDrop],
  );

  useEffect(() => {
    const inputEl = mediaGroupDescriptionRef.current;
    if (inputEl) {
      inputEl.value = mediaGroupResult.description;
    }
  }, [mediaGroupResult.description]);

  return (
    <div
      style={{
        maxWidth,
        display: "grid",
        width: "100%",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "5px 5px 12px rgba(11, 11, 11, 0.6)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(10deg, rgb(25, 25, 25), rgb(23, 23, 23))",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          borderTopRightRadius: 10,
          borderTopLeftRadius: 10,
          ...dynamicSizes.flex,
        }}
        onMouseEnter={() => setIsTitleBarHovered(true)}
        onMouseLeave={() => setIsTitleBarHovered(false)}
      >
        <SvgRepo
          title={"delete media group"}
          svg={
            isAltKeyPressed && isTitleBarHovered ? circle("rgb(220, 112, 112)") : circle("rgba(255, 255, 255, 0.05)")
          }
          scale={0.4}
          scaleToContaier={true}
          onContainerClick={deleteMediaGroupClick}
          style={{
            cursor: isAltKeyPressed && isTitleBarHovered ? "pointer" : "",
          }}
          containerStyle={{
            cursor: "",
            ...dynamicSizes.delete.container,
          }}
        />
        <input
          id={`media-group-description-input-${mediaGroupId}`}
          ref={mediaGroupDescriptionRef}
          className={dellaRespira.className}
          placeholder="name me..."
          style={{
            textAlign: "center",
            background: "none",
            color: "rgb(227, 227, 227)",
            border: "none",
            outline: "none",
            width: "100%",
            fontWeight: "bold",
            ...dynamicSizes.input,
          }}
          type="text"
          autoComplete="off"
          onChange={(e) => onMediaGroupDescriptionChange(e.target.value)}
        />
        <SvgRepo
          title={groupItems.length > 0 ? "select all media in group" : "no media in group"}
          svg={checkCircle(groupItems.length > 0 ? "rgba(204, 204, 204, 0.8)" : "rgba(204, 204, 204, 0.2)")}
          scale={0.4}
          scaleToContaier={true}
          onContainerClick={onSelectAllInGroupClick}
          style={{
            cursor: groupItems.length > 0 ? "pointer" : "",
          }}
          containerStyle={{
            cursor: "",
            ...dynamicSizes.delete.container,
          }}
        />
      </div>
      {groupItems.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <DndContext
            sensors={dragSensors}
            collisionDetection={collisionDetection}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragStart={beginBodyDragCursor}
            onDragEnd={(e) => {
              endBodyDragCursor();
              onGroupDragEnd(e);
            }}
          >
            <SortableContext items={groupItems.map((item) => item.key)} strategy={verticalListSortingStrategy}>
              {groupItems.map((item, index) => (
                <MediaGroupRow
                  key={item.key}
                  item={item}
                  index={index}
                  isEven={index % 2 === 0}
                  indexColumnStyle={dynamicSizes.indexColumn}
                  removeOverlaySize={dynamicSizes.removeOverlay.size}
                  onRemoveFromGroupClick={() => {
                    if (item.type === "img") onRemoveImgFromGroupClick(item.key);
                    else if (item.type === "svg") onRemoveSvgFromGroupClick(item.key);
                    else onRemoveMaskFromGroupClick(item.key);
                  }}
                  onContextMenuClick={() => {
                    if (!guardSelection({ type: item.type, key: item.key })) return;
                    if (item.type === "img") onImgContextMenuClick(item.key);
                    else if (item.type === "svg") onSvgContextMenuClick(item.key);
                    else onMaskContextMenuClick(item.key);
                  }}
                  expanded={expandedMaskKeys.has(item.key)}
                  onExpandClick={() => toggleMaskExpanded(item.key)}
                  onElementContextMenuClick={(ref) => {
                    if (ref.kind === "object") {
                      if (!guardSelection({ type: "object", key: item.key, objectId: ref.id })) return;
                      onObjectContextMenuClick(item.key, ref.id);
                      return;
                    }
                    if (!guardSelection({ type: "light", key: item.key, lightId: ref.id })) return;
                    onLightContextMenuClick(item.key, ref.id);
                  }}
                  stack={expandedStacks.get(item.key)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      <div
        style={{
          width: "100%",
          padding: dynamicSizes.timelineAreaContent.padding,
          display: "flex",
          justifyContent: "start",
          cursor: adding ? "wait" : "",
        }}
      >
        <SvgRepo
          title={hasSelection ? "add selected media to group" : "select media on the canvas to add"}
          svg={hasSelection ? addCircle("rgba(204, 204, 204, 0.8)") : addCircle("rgba(204, 204, 204, 0.2)")}
          containerStyle={{
            width: dynamicSizes.timelineAreaContent.svg.width,
            height: dynamicSizes.timelineAreaContent.svg.height,
            cursor: hasSelection && !adding ? "pointer" : "",
          }}
          scale={1}
          scaleToContaier={true}
          onContainerClick={onAddSelectedMediaClick}
        />
      </div>
    </div>
  );
}

function MaskGroupThumbnail({
  mask,
  onContextMenuClick,
  width,
  height,
  isSquareish,
}: {
  mask: LaurusMaskResult;
  onContextMenuClick: () => void;
  width: number;
  height: number;
  isSquareish: boolean;
}) {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);

  let sourceImgSrc: string | undefined;
  for (const [key, img] of coreState.project.imgs) {
    if (img.img_media_id === mask.source_img_media_id) {
      sourceImgSrc = coreState.canvasImgs.get(key)?.src;
      break;
    }
  }
  if (!sourceImgSrc) {
    sourceImgSrc = uiState.browserImgs.find((img) => img.img_media_id === mask.source_img_media_id)?.src;
  }

  return (
    <LaurusImage
      title={mask.mask_media_id}
      draggable={false}
      alt={mask.mask_media_id}
      src={sourceImgSrc ?? ""}
      onClick={onContextMenuClick}
      width={width}
      height={height}
      style={{
        display: "block",
        objectFit: isSquareish ? "cover" : "unset",
        cursor: "pointer",
      }}
    />
  );
}

interface StackedRowElement {
  ref: StackRef;
  name: string;
  description: string;
  order: number;
}

function refKey(ref: StackRef): string {
  return `${ref.kind}:${ref.id}`;
}

function rowElements(mask: LaurusMaskResult): Map<string, StackedRowElement> {
  const rows = new Map<string, StackedRowElement>();
  const add = (ref: StackRef, element: LaurusObject | LaurusLight) => {
    rows.set(refKey(ref), {
      ref,
      name: element.name ? element.name : `${ref.kind} ${ref.id}`,
      description: element.description,
      order: element.order,
    });
  };
  mask.objects.forEach((object) => add({ kind: "object", id: object.id }, object));
  mask.lights.forEach((light) => add({ kind: "light", id: light.id }, light));
  return rows;
}

function elementRowId(maskKey: string, ref: StackRef): string {
  return `${maskKey}::${refKey(ref)}`;
}

function planeRowId(maskKey: string): string {
  return `${maskKey}::plane`;
}

function stackRowIds(maskKey: string, rows: readonly StackRow[]): string[] {
  return rows.map((row) => (row === MASK_PLANE_ROW ? planeRowId(maskKey) : elementRowId(maskKey, row)));
}

function StackElementThumbnail({
  mask,
  label,
  glyph,
  size,
  behind,
  onClick,
}: {
  mask: LaurusMaskResult;
  label: string;
  glyph: (fill: string) => LaurusClientSvg;
  size: number;
  behind: boolean;
  onClick: () => void;
}) {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);

  let sourceImgSrc: string | undefined;
  for (const [key, img] of coreState.project.imgs) {
    if (img.img_media_id === mask.source_img_media_id) {
      sourceImgSrc = coreState.canvasImgs.get(key)?.src;
      break;
    }
  }
  if (!sourceImgSrc) {
    sourceImgSrc = uiState.browserImgs.find((img) => img.img_media_id === mask.source_img_media_id)?.src;
  }

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeContent: "center",
        cursor: "pointer",
        overflow: "hidden",
        backgroundColor: "rgb(60, 60, 60)",
      }}
    >
      <LaurusImage draggable={false} alt={label} src={sourceImgSrc ?? ""} fill style={{ objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(2px)",
        }}
      />
      <SvgRepo
        svg={glyph(behind ? "rgba(255, 255, 255, 0.45)" : "rgb(255, 255, 255)")}
        scale={1}
        scaleToContaier
        containerStyle={{
          position: "relative",
          width: Math.round(size * 0.5),
          height: Math.round(size * 0.5),
          filter: behind ? "none" : "drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.9))",
        }}
      />
    </div>
  );
}

interface MaskElementRow {
  maskKey: string;
  mask: LaurusMaskResult;
  element: StackedRowElement;
  label: string;
  isEven: boolean;
  indexColumnStyle: { width: string; fontSize: number };
  rowHeight: number;
  filenameStyle: { fontSize: number; letterSpacing: number };
  filenameMargin: number;
  removeOverlaySize: number;
  onContextMenuClick: () => void;
}
function MaskElementRow({
  maskKey,
  mask,
  element,
  label,
  isEven,
  indexColumnStyle,
  rowHeight,
  filenameStyle,
  filenameMargin,
  removeOverlaySize,
  onContextMenuClick,
}: MaskElementRow) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: elementRowId(maskKey, element.ref),
  });
  const [isRowHovered, setIsRowHovered] = useState(false);
  const behind = isBehindMask(element);

  return (
    <div
      ref={setNodeRef}
      style={{
        width: "100%",
        display: "flex",
        background: `rgba(255, 255, 255, ${(isEven ? 0 : 0.025) + (isRowHovered ? 0.02 : 0)})`,
        border: `1px solid ${isRowHovered ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0)"}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          alignSelf: "stretch",
          background: "rgba(22, 22, 22, 0.9)",
          display: "grid",
          placeContent: "center",
          cursor: "grab",
          touchAction: "none",
          width: indexColumnStyle.width,
          fontSize: indexColumnStyle.fontSize,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `min-content ${filenameMargin}px auto ${filenameMargin}px min-content`,
          gridTemplateRows: "1fr",
          alignItems: "center",
          height: rowHeight,
          paddingLeft: 5,
          width: "100%",
        }}
      >
        <div
          className={styles["transparent-checkerboard-background"]}
          style={{ width: rowHeight - 10, height: rowHeight - 10 }}
        >
          <StackElementThumbnail
            mask={mask}
            label={element.name}
            glyph={element.ref.kind === "object" ? antigravity200 : asterisk200}
            size={rowHeight - 10}
            behind={behind}
            onClick={onContextMenuClick}
          />
        </div>
        <div />
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              textAlign: "center",
              whiteSpace: "nowrap",
              color: behind ? "rgba(220, 220, 220, 0.5)" : "rgb(220, 220, 220)",
              ...filenameStyle,
            }}
          >
            {element.description ? element.description : element.name}
          </div>
        </div>
        <div />
        <div style={{ padding: 4, height: "100%", width: "min-content" }}>
          <SvgRepo
            svg={circle("rgba(0,0,0,0)")}
            scale={0.9}
            scaleToContaier={true}
            containerStyle={{ width: removeOverlaySize, height: removeOverlaySize }}
          />
        </div>
      </div>
    </div>
  );
}

function MaskPlaneRow({
  maskKey,
  indexColumnStyle,
  label,
  isEven,
  children,
}: {
  maskKey: string;
  indexColumnStyle: { width: string; fontSize: number };
  label: string;
  isEven: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: planeRowId(maskKey),
  });
  const [isRowHovered, setIsRowHovered] = useState(false);
  return (
    <div
      ref={setNodeRef}
      style={{
        width: "100%",
        display: "flex",
        background: `rgba(255, 255, 255, ${(isEven ? 0 : 0.025) + (isRowHovered ? 0.02 : 0)})`,
        border: `1px solid ${isRowHovered ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0)"}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          alignSelf: "stretch",
          background: "rgba(22, 22, 22, 0.9)",
          display: "grid",
          placeContent: "center",
          cursor: "grab",
          touchAction: "none",
          width: indexColumnStyle.width,
          fontSize: indexColumnStyle.fontSize,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

interface MediaGroupRow {
  item: MediaGroupItem;
  index: number;
  isEven: boolean;
  indexColumnStyle: { width: string; fontSize: number };
  removeOverlaySize: number;
  expanded: boolean;
  onExpandClick: () => void;
  onRemoveFromGroupClick: () => void;
  onContextMenuClick: () => void;
  onElementContextMenuClick: (ref: StackRef) => void;
  stack: StackRow[] | undefined;
}
function MediaGroupRow({
  item,
  index,
  isEven,
  indexColumnStyle,
  removeOverlaySize,
  expanded,
  onExpandClick,
  onRemoveFromGroupClick,
  onContextMenuClick,
  onElementContextMenuClick,
  stack,
}: MediaGroupRow) {
  const { uiState } = useContext(UIContext);
  const { coreState } = useContext(CoreContext);
  const stackOpen = item.type === "mask" && stack !== undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled: { draggable: stackOpen, droppable: false },
  });
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          filename: {
            margin: 24,
            filename: {
              fontSize: 11,
              letterSpacing: 1,
            },
          },

          groupItem: {
            height: 70,
          },
        };
      case "midhigh":
        return {
          filename: {
            margin: 24,
            filename: {
              fontSize: 10,
              letterSpacing: 2,
            },
          },
          groupItem: {
            height: 56,
          },
        };
      case "midlow":
      case "low":
        return {
          filename: {
            margin: 24,
            filename: {
              fontSize: 10,
              letterSpacing: 2,
            },
          },
          groupItem: {
            height: 48,
          },
        };
    }
  });
  const [isItemHovered, setIsItemHovered] = useState<boolean>(false);
  const [isRowHovered, setIsRowHovered] = useState<boolean>(false);
  const maskName = useCallback(
    (mask: LaurusMaskResult) => maskLabel(mask, coreState.canvasImgs, mask.source_img_media_id),
    [coreState.canvasImgs],
  );

  const display = useMemo(() => {
    if (item.type !== "img" && item.type !== "mask") return undefined;
    const media = item.type === "img" ? item.img : item.mask;
    const containerSize = dynamicSizes.groupItem.height;
    const aspectRatio = media.width / media.height;
    const isSquareish = aspectRatio >= 0.9 && aspectRatio <= 1.1;
    let displayWidth, displayHeight;
    if (isSquareish) {
      displayWidth = containerSize;
      displayHeight = containerSize;
    } else {
      const targetSize = containerSize * 1.33;
      const scale = Math.max(targetSize / media.width, targetSize / media.height);
      displayWidth = Math.round(media.width * scale);
      displayHeight = Math.round(media.height * scale);
    }
    return { isSquareish, displayWidth, displayHeight };
  }, [dynamicSizes.groupItem.height, item]);

  const elementsByRow = useMemo(
    () => (item.type === "mask" ? rowElements(item.mask) : new Map<string, StackedRowElement>()),
    [item],
  );
  const stackRowIdList = useMemo(() => (stack === undefined ? [] : stackRowIds(item.key, stack)), [stack, item.key]);

  const stackCount = item.type === "mask" ? item.mask.objects.length + item.mask.lights.length : 0;
  const planeRowIndex = stack === undefined ? -1 : stack.indexOf(MASK_PLANE_ROW);

  const rowContent = (() => {
    switch (item.type) {
      case "img": {
        if (!display) return <></>;
        return (
          <div
            onMouseEnter={() => setIsItemHovered(true)}
            onMouseLeave={() => setIsItemHovered(false)}
            style={{
              display: "grid",
              alignItems: "center",
              height: dynamicSizes.groupItem.height,
              paddingLeft: 5,
              width: "100%",
              gridTemplateColumns: `min-content ${dynamicSizes.filename.margin}px auto ${dynamicSizes.filename.margin}px min-content`,
              gridTemplateRows: "1fr",
            }}
          >
            <div
              className={styles["transparent-checkerboard-background"]}
              style={{
                width: dynamicSizes.groupItem.height - 10,
                height: dynamicSizes.groupItem.height - 10,
                overflow: display.isSquareish ? "none" : "auto",
              }}
            >
              <LaurusImage
                title={item.img.media_key}
                draggable={false}
                alt={item.img.media_key}
                src={item.img.src}
                onClick={onContextMenuClick}
                width={display.displayWidth - 10}
                height={display.displayHeight - 10}
                style={{
                  display: "block",
                  objectFit: display.isSquareish ? "cover" : "unset",
                  cursor: "pointer",
                }}
              />
            </div>
            <div />
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  color: "rgb(220, 220, 220)",
                  ...dynamicSizes.filename.filename,
                }}
              >
                {item.img.media_key}
              </div>
            </div>
            <div />
            <div style={{ padding: "5px 5px 0px 0px", height: "100%", width: "min-content" }}>
              <SvgRepo
                title={"remove from group"}
                svg={closeIcon(isItemHovered ? "rgba(227,227,227,1)" : "rgb(67, 67, 67)")}
                scale={0.9}
                scaleToContaier={true}
                onContainerClick={onRemoveFromGroupClick}
                style={{
                  cursor: "pointer",
                }}
                containerStyle={{
                  cursor: "pointer",
                  width: removeOverlaySize,
                  height: removeOverlaySize,
                }}
              />
            </div>
          </div>
        );
      }
      case "svg":
        return (
          <div
            onMouseEnter={() => setIsItemHovered(true)}
            onMouseLeave={() => setIsItemHovered(false)}
            style={{
              display: "grid",
              gridTemplateColumns: `min-content ${dynamicSizes.filename.margin}px auto ${dynamicSizes.filename.margin}px min-content`,
              gridTemplateRows: "1fr",
              alignItems: "center",
              height: dynamicSizes.groupItem.height,
              paddingLeft: 5,
              width: "100%",
            }}
          >
            <div
              className={styles["transparent-checkerboard-background"]}
              style={{
                width: dynamicSizes.groupItem.height - 10,
                height: dynamicSizes.groupItem.height - 10,
                display: "grid",
                placeContent: "center",
              }}
            >
              <SvgRepo
                title={item.svg.media_key}
                svg={item.svg}
                onContainerClick={onContextMenuClick}
                containerStyle={{
                  width: (dynamicSizes.groupItem.height - 10) * 0.7,
                  height: (dynamicSizes.groupItem.height - 10) * 0.7,
                  cursor: "pointer",
                }}
                scale={0.7}
                scaleToContaier={true}
              />
            </div>
            <div />
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  color: "rgb(220, 220, 220)",
                  ...dynamicSizes.filename.filename,
                }}
              >
                {item.svg.media_key}
              </div>
            </div>
            <div />
            <div style={{ padding: 4, height: "100%", width: "min-content" }}>
              <SvgRepo
                title={"remove from group"}
                svg={closeIcon(isItemHovered ? "rgba(227,227,227,1)" : "rgb(67, 67, 67)")}
                scale={0.9}
                scaleToContaier={true}
                onContainerClick={onRemoveFromGroupClick}
                style={{
                  cursor: "pointer",
                }}
                containerStyle={{
                  cursor: "pointer",
                  width: removeOverlaySize,
                  height: removeOverlaySize,
                }}
              />
            </div>
          </div>
        );
      case "mask": {
        if (!display) return <></>;
        return (
          <div
            onMouseEnter={() => setIsItemHovered(true)}
            onMouseLeave={() => setIsItemHovered(false)}
            style={{
              display: "grid",
              gridTemplateColumns: `min-content ${dynamicSizes.filename.margin}px auto ${dynamicSizes.filename.margin}px min-content`,
              gridTemplateRows: "1fr",
              alignItems: "center",
              height: dynamicSizes.groupItem.height,
              paddingLeft: 5,
              width: "100%",
            }}
          >
            <div
              className={styles["transparent-checkerboard-background"]}
              style={{
                width: dynamicSizes.groupItem.height - 10,
                height: dynamicSizes.groupItem.height - 10,
                overflow: display.isSquareish ? "none" : "auto",
              }}
            >
              <MaskGroupThumbnail
                mask={item.mask}
                onContextMenuClick={onContextMenuClick}
                width={display.displayWidth - 10}
                height={display.displayHeight - 10}
                isSquareish={display.isSquareish}
              />
            </div>
            <div />
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  color: "rgb(220, 220, 220)",
                  ...dynamicSizes.filename.filename,
                }}
              >
                {maskName(item.mask)}
              </div>
            </div>
            <div />
            <div
              style={{
                padding: 4,
                height: "100%",
                width: "min-content",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <SvgRepo
                title={"remove from group"}
                svg={closeIcon(isItemHovered ? "rgba(227,227,227,1)" : "rgb(67, 67, 67)")}
                scale={0.9}
                scaleToContaier={true}
                onContainerClick={onRemoveFromGroupClick}
                style={{
                  cursor: "pointer",
                }}
                containerStyle={{
                  cursor: "pointer",
                  width: removeOverlaySize,
                  height: removeOverlaySize,
                }}
              />
              <SvgRepo
                svg={
                  stackCount === 0
                    ? arrowDropDown("rgb(45, 45, 45)")
                    : expanded
                      ? arrowDropUp(isItemHovered ? "rgba(227,227,227,1)" : "rgb(110, 110, 110)")
                      : arrowDropDown(isItemHovered ? "rgba(227,227,227,1)" : "rgb(67, 67, 67)")
                }
                scale={1.1}
                scaleToContaier={true}
                onContainerClick={stackCount === 0 ? undefined : onExpandClick}
                style={{ cursor: stackCount === 0 ? "default" : "pointer" }}
                containerStyle={{
                  cursor: stackCount === 0 ? "default" : "pointer",
                  width: removeOverlaySize,
                  height: removeOverlaySize,
                }}
              />
            </div>
          </div>
        );
      }
    }
  })();

  return (
    <div
      ref={setNodeRef}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      {!stackOpen && (
        <div
          style={{
            width: "100%",
            display: "flex",
            background: `rgba(255, 255, 255, ${(isEven ? 0 : 0.025) + (isRowHovered ? 0.02 : 0)})`,
            border: `1px solid ${isRowHovered ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0)"}`,
          }}
          onMouseEnter={() => setIsRowHovered(true)}
          onMouseLeave={() => setIsRowHovered(false)}
        >
          <div
            {...attributes}
            {...listeners}
            style={{
              height: "100%",
              background: "rgba(22, 22, 22, 0.9)",
              display: "grid",
              placeContent: "center",
              cursor: "grab",
              touchAction: "none",
              width: indexColumnStyle.width,
              fontSize: indexColumnStyle.fontSize,
            }}
          >
            {(index + 1).toFixed()}
          </div>
          {rowContent}
        </div>
      )}
      {stackOpen && item.type === "mask" && stack !== undefined && (
        <SortableContext items={stackRowIdList} strategy={verticalListSortingStrategy}>
          {stack.map((row, i) => {
            if (row === MASK_PLANE_ROW) {
              return (
                <MaskPlaneRow
                  key={planeRowId(item.key)}
                  maskKey={item.key}
                  indexColumnStyle={indexColumnStyle}
                  label={(index + 1).toFixed()}
                  isEven={i % 2 === 0}
                >
                  {rowContent}
                </MaskPlaneRow>
              );
            }
            const element = elementsByRow.get(refKey(row));
            if (!element) return null;
            return (
              <MaskElementRow
                key={elementRowId(item.key, row)}
                maskKey={item.key}
                mask={item.mask}
                element={element}
                label={`${index + 1}.${(i < planeRowIndex ? i : i - 1) + 1}`}
                isEven={i % 2 === 0}
                indexColumnStyle={indexColumnStyle}
                rowHeight={dynamicSizes.groupItem.height}
                filenameStyle={dynamicSizes.filename.filename}
                filenameMargin={dynamicSizes.filename.margin}
                removeOverlaySize={removeOverlaySize}
                onContextMenuClick={() => onElementContextMenuClick(element.ref)}
              />
            );
          })}
        </SortableContext>
      )}
    </div>
  );
}

export interface MediaGroupSkeleton {
  maxWidth: number;
}
export function MediaGroupSkeleton({ maxWidth }: MediaGroupSkeleton) {
  const { uiState } = useContext(UIContext);
  return (
    <div
      style={{
        maxWidth,
        display: "grid",
        width: "100%",
        placeContent: "center",
        minHeight: 60,
        color: "rgba(255, 255, 255, 0.4)",
        fontSize: uiState.resolution.type == "high" ? 14 : 12,
        letterSpacing: "2px",
      }}
    >
      <i>{"no media groups"}</i>
    </div>
  );
}
