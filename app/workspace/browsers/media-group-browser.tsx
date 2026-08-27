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
  checkCircle,
  circle,
  closeIcon,
  SvgRepo,
} from "../../svg-repo";
import {
  deleteMediaGroup,
  LaurusImgResult,
  LaurusMaskResult,
  LaurusMediaGroupResult,
  LaurusObject,
  LaurusSvgResult,
  updateMediaGroup,
} from "../workspace.server";
import { isBehindMask, MASK_PLANE_ROW, restackFromDrop, stackRows, type StackRow } from "../canvas-media/object-order";
import { frontToBackMedia, restackGroupWithinProject, type StackedMedia } from "./media-stack";
import { updateProject, LaurusProjectResult } from "../../projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
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
    notifyMaskSelectedObjectChanged,
    deleteObject,
    restackMaskObjects,
  } = useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
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
  /**
   * Which masks are showing their object stack.
   *
   * Local and unpersisted on purpose: it is a way of looking at the group, not
   * a property of it, and a mask whose objects were being reordered last session
   * has nothing to say to this one.
   */
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
    // Front of the canvas first. Order feeds z-index, so the largest is what
    // everything else is drawn under -- and a stack of layers is read topmost
    // first, which is also how a mask's expanded objects read (see
    // frontToBackObjects). Storage stays ascending; this is a reading of it.
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
      uiDispatch({ type: UIActionType.SetProjectContextMenu, key, showContextMenu: true });
    },
    [uiDispatch],
  );

  /**
   * Selecting an object from its row.
   *
   * The same pair of dispatches the carousel and the canvas make, so an object
   * picked here is the object every other panel is talking about -- which is
   * what makes the row a way into the object and not just a handle for dragging
   * it.
   */
  const onObjectSelectClick = useCallback(
    (maskKey: string, objectId: number) => {
      uiDispatch({ type: UIActionType.SetSelectedElement, value: { key: maskKey, type: "object", objectId } });
      notifyMaskSelectionChanged(maskKey);
      notifyMaskSelectedObjectChanged(maskKey, objectId);
    },
    [uiDispatch, notifyMaskSelectionChanged, notifyMaskSelectedObjectChanged],
  );

  const onObjectDeleteClick = useCallback(
    async (maskKey: string, objectId: number) => {
      const confirmed = confirm("are you sure you want to delete this object?");
      if (!confirmed) return;
      await deleteObject(maskKey, objectId);
    },
    [deleteObject],
  );

  /**
   * The rows every expanded mask contributes, keyed by mask.
   *
   * Computed here rather than in the row so that the drag handler and the
   * rendering read the same list -- they have to agree on both the sequence and
   * where the plane sits in it, and deriving it twice is how they would stop
   * agreeing.
   */
  const expandedStacks = useMemo(() => {
    const stacks = new Map<string, StackRow[]>();
    groupItems.forEach((item) => {
      if (item.type !== "mask" || !expandedMaskKeys.has(item.key)) return;
      // A mask with nothing on it contributes no rows at all rather than a lone
      // plane -- reachable by deleting the last object while the stack is open,
      // since the expand button is already stood down at zero.
      if (item.mask.objects.length === 0) return;
      stacks.set(item.key, stackRows(item.mask.objects));
    });
    return stacks;
  }, [groupItems, expandedMaskKeys]);

  /**
   * The row ids one drag is allowed to land on: the ids of whichever list the
   * dragged row itself belongs to.
   */
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

  /**
   * closestCenter, narrowed to the dragged row's own list.
   *
   * An expanded mask's rows are rendered *inside* that mask's own sortable
   * node, so the mask stays droppable over a rect that wraps its whole stack --
   * and the centre of that rect sits in the middle of the block, competing with
   * the rows themselves. Dragging a row toward the middle therefore resolved
   * `over` to the mask rather than to the row under the cursor, and the drop was
   * refused for belonging to no list. It failed in one direction only, which is
   * what made it look arbitrary: dragging the mask row down moves away from that
   * centre and keeps winning, dragging it up moves straight onto it.
   *
   * Filtering the candidates is the fix rather than standing the mask's
   * droppable down, because that droppable is what lets other media be dropped
   * onto an open mask in the group's own list. A row can only ever land on a row
   * it could actually be ordered against, and nothing else needs to know.
   */
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

  /**
   * A drop that landed on an expanded mask's rows, or nothing.
   *
   * Object rows and media rows share the group's one DndContext, so the first
   * thing a drop has to answer is which of the two lists it belongs to. A row
   * dragged out of its own stack and onto another list is refused rather than
   * reinterpreted: the two lists order different things, and there is no
   * sensible reading of an object dropped among the group's media.
   */
  const onObjectDrop = useCallback(
    (activeId: string, overId: string): boolean => {
      for (const [maskKey, rows] of expandedStacks) {
        const ids = stackRowIds(maskKey, rows);
        const fromIndex = ids.indexOf(activeId);
        if (fromIndex === -1) continue;
        const toIndex = ids.indexOf(overId);
        // Belongs to this stack but was dropped outside it -- handled, in the
        // sense that it is certainly not a media reorder, and refused.
        if (toIndex === -1) return true;
        const mask = coreState.canvasMasks.get(maskKey);
        if (mask) restackMaskObjects(maskKey, restackFromDrop(mask.objects, rows, fromIndex, toIndex));
        return true;
      }
      return false;
    },
    [expandedStacks, coreState.canvasMasks, restackMaskObjects],
  );

  const onGroupDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !coreState.project.project_id) return;
      if (onObjectDrop(String(active.id), String(over.id))) return;
      const oldIndex = groupItems.findIndex((item) => item.key === active.id);
      const newIndex = groupItems.findIndex((item) => item.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      // groupItems reads front to back, and restackGroupWithinProject takes it
      // in exactly that reading -- so the drop is handed over as it landed,
      // with no turning it over here for anyone to get backwards.
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
    [groupItems, coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch, onObjectDrop],
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
                    if (item.type === "img") onImgContextMenuClick(item.key);
                    else if (item.type === "svg") onSvgContextMenuClick(item.key);
                    else onMaskContextMenuClick(item.key);
                  }}
                  expanded={expandedMaskKeys.has(item.key)}
                  onExpandClick={() => toggleMaskExpanded(item.key)}
                  onObjectContextMenuClick={(objectId) => onObjectSelectClick(item.key, objectId)}
                  onObjectRemoveClick={(objectId) => onObjectDeleteClick(item.key, objectId)}
                  objectRows={expandedStacks.get(item.key)}
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

/**
 * The dnd id one object's row answers to.
 *
 * Scoped by mask key because two masks in one group can both be expanded, and
 * their object ids are only unique within a mask.
 *
 * The mask's own plane rides in the same list under MASK_PLANE_ROW, as a row
 * rather than a line drawn between two groups -- a row is something a drag can
 * cross, and crossing it is the only gesture that changes which side of the
 * mask an object is on. See restackFromDrop.
 */
function objectRowId(maskKey: string, objectId: number): string {
  return `${maskKey}::object::${objectId}`;
}

/**
 * The dnd id a mask's plane row answers to.
 *
 * Scoped by mask key for the same reason an object row is, and it has to be:
 * every expanded mask contributes its rows to the one group-wide DndContext, so
 * two masks open at once would otherwise register the same plane id twice and
 * drags would land on whichever won.
 */
function planeRowId(maskKey: string): string {
  return `${maskKey}::plane`;
}

/** One expanded mask's rows as the dnd ids they register under, in row order. */
function stackRowIds(maskKey: string, rows: readonly StackRow[]): string[] {
  return rows.map((row) => (row === MASK_PLANE_ROW ? planeRowId(maskKey) : objectRowId(maskKey, row)));
}

/**
 * The thumbnail an object shows in a group row.
 *
 * Built the way unit-display builds one: the mask's own source image, dimmed
 * and blurred so it reads as ground rather than as content, with the same
 * antigravity glyph over it that marks an object everywhere else in the app. An
 * object has no picture of its own -- it is a region of the mask's -- so the
 * glyph is what identifies it and the blur is what keeps four object rows on
 * one mask from looking like four copies of the same photograph.
 */
function ObjectGroupThumbnail({
  mask,
  object,
  size,
  behind,
  onClick,
}: {
  mask: LaurusMaskResult;
  object: LaurusObject;
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
      title={behind ? `${object.name} -- behind the mask` : object.name}
      onClick={onClick}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeContent: "center",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <LaurusImage draggable={false} alt={object.name} src={sourceImgSrc ?? ""} fill style={{ objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(6px)",
        }}
      />
      <SvgRepo
        svg={antigravity200(behind ? "rgba(255, 255, 255, 0.45)" : "rgb(255, 255, 255)")}
        scale={1}
        scaleToContaier
        containerStyle={{
          position: "relative",
          width: Math.round(size * 0.5),
          height: Math.round(size * 0.5),
          // Dropped for an object behind the mask, which is exactly how it
          // renders on the canvas: still there, not lit.
          filter: behind ? "none" : "drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.9))",
        }}
      />
    </div>
  );
}

interface MaskObjectRow {
  maskKey: string;
  mask: LaurusMaskResult;
  object: LaurusObject;
  /** What the drag handle reads, e.g. "1.1" -- the mask's row, then this row. */
  label: string;
  isEven: boolean;
  indexColumnStyle: { width: string; fontSize: number };
  rowHeight: number;
  filenameStyle: { fontSize: number; letterSpacing: number };
  filenameMargin: number;
  removeOverlaySize: number;
  onContextMenuClick: () => void;
  onRemoveClick: () => void;
}
function MaskObjectRow({
  maskKey,
  mask,
  object,
  label,
  isEven,
  indexColumnStyle,
  rowHeight,
  filenameStyle,
  filenameMargin,
  removeOverlaySize,
  onContextMenuClick,
  onRemoveClick,
}: MaskObjectRow) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: objectRowId(maskKey, object.id),
  });
  const [isItemHovered, setIsItemHovered] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
  const behind = isBehindMask(object);
  const coveredPolygonCount = useMemo(
    () => mask.polygons.filter((p) => p.object_id === object.id).length,
    [mask.polygons, object.id],
  );

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
          // alignSelf rather than height: 100%. This row's height comes from the
          // content beside this cell, so a percentage resolves against a height
          // that is not settled yet and the cell collapses to its own text --
          // which is why the handle sat in the corner. Stretch is the flex way
          // of saying "as tall as the row turns out to be".
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
        onMouseEnter={() => setIsItemHovered(true)}
        onMouseLeave={() => setIsItemHovered(false)}
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
          <ObjectGroupThumbnail
            mask={mask}
            object={object}
            size={rowHeight - 10}
            behind={behind}
            onClick={onContextMenuClick}
          />
        </div>
        <div />
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              whiteSpace: "normal",
              textAlign: "center",
              color: behind ? "rgba(220, 220, 220, 0.5)" : "rgb(220, 220, 220)",
              ...filenameStyle,
            }}
          >
            {object.name}
          </div>
          <div
            style={{
              whiteSpace: "nowrap",
              textAlign: "center",
              color: "rgba(220, 220, 220, 0.35)",
              fontSize: Math.max(filenameStyle.fontSize - 2, 7),
              letterSpacing: 1,
            }}
          >
            {`${coveredPolygonCount} ${coveredPolygonCount === 1 ? "polygon" : "polygons"}`}
          </div>
        </div>
        <div />
        <div style={{ padding: 4, height: "100%", width: "min-content" }}>
          <SvgRepo
            title={"delete object"}
            svg={closeIcon(isItemHovered ? "rgba(227,227,227,1)" : "rgb(67, 67, 67)")}
            scale={0.9}
            scaleToContaier={true}
            onContainerClick={onRemoveClick}
            style={{ cursor: "pointer" }}
            containerStyle={{ cursor: "pointer", width: removeOverlaySize, height: removeOverlaySize }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The mask's own row, sitting at its own plane inside its stack.
 *
 * There is no separate divider: the sheet the objects are stacked around is the
 * mask itself, so the mask's row is what marks it. Everything above this row
 * renders in front of the mask and everything below renders behind it, and the
 * row carries the mask's real content -- thumbnail, name, its own buttons --
 * rather than a line labelled "the mask".
 *
 * Dragging it is the practical way to send objects behind the sheet. With every
 * object in front, this is the last row in the stack, so there is nothing below
 * an object to drop it onto and reaching behind the mask means aiming at this
 * row exactly. Moving the mask up through the stack says the same thing far
 * more easily: every object it passes ends up behind it.
 *
 * The two gestures produce the same orders -- restackFromDrop reads the plane's
 * index out of the dropped sequence and does not care which row moved to put it
 * there.
 */
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
        // Marked off from the objects around it: this row is the boundary they
        // are ordered against, not another member of the list.
        background: `rgba(255, 255, 255, ${(isEven ? 0.05 : 0.075) + (isRowHovered ? 0.02 : 0)})`,
        borderTop: "1px solid rgba(255, 255, 255, 0.25)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.25)",
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
        title="drag the mask through its own stack -- objects it passes end up behind it"
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
  onObjectContextMenuClick: (objectId: number) => void;
  onObjectRemoveClick: (objectId: number) => void;
  /**
   * The rows this mask's stack contributes, or undefined when it is not a mask
   * or is collapsed. Handed down rather than derived here so that this and the
   * group's drag handler cannot disagree about the sequence.
   */
  objectRows: StackRow[] | undefined;
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
  onObjectContextMenuClick,
  onObjectRemoveClick,
  objectRows,
}: MediaGroupRow) {
  const { uiState } = useContext(UIContext);
  /**
   * Whether this mask is showing its stack, and so whether its own row has
   * moved down into it.
   *
   * An open mask has no row of its own above the stack -- the plane's row *is*
   * its row, which is what makes the sheet's place in the stack something you
   * can see and drag rather than a line labelled "the mask". The handle on that
   * row therefore drives the plane, not the group, so this also stands the
   * group drag down: there is nothing left to start one with.
   */
  const stackOpen = item.type === "mask" && objectRows !== undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    // Draggable only while the stack is shut, for the reason stackOpen gives.
    // Droppable throughout, so other media can still be dropped past an open
    // mask -- a bare boolean here would disable both.
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

  const objectsById = useMemo(
    () => new Map(item.type === "mask" ? item.mask.objects.map((object) => [object.id, object]) : []),
    [item],
  );
  const objectRowIds = useMemo(
    () => (objectRows === undefined ? [] : stackRowIds(item.key, objectRows)),
    [objectRows, item.key],
  );
  // Every object the mask holds, whether or not the stack is open -- the expand
  // button reads it to decide if there is anything to show.
  const objectCount = item.type === "mask" ? item.mask.objects.length : 0;
  // The plane sits in the row list but is not one of the objects, so a row's
  // position among the objects is its index less the plane once it is past it.
  const planeRowIndex = objectRows === undefined ? -1 : objectRows.indexOf(MASK_PLANE_ROW);

  // Everything to the right of the drag handle. Hoisted out of the return
  // because a mask draws it in one of two places: its own row when the stack is
  // shut, and the plane's row inside the stack when it is open.
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
                  whiteSpace: "normal",
                  textAlign: "center",
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
                  whiteSpace: "normal",
                  textAlign: "center",
                  color: "rgb(220, 220, 220)",
                  ...dynamicSizes.filename.filename,
                }}
              >
                {item.mask.mask_media_id}
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
                title={
                  objectCount === 0
                    ? "no objects on this mask"
                    : expanded
                      ? "hide this mask's objects"
                      : `show this mask's ${objectCount} ${objectCount === 1 ? "object" : "objects"}`
                }
                svg={
                  objectCount === 0
                    ? arrowDropDown("rgb(45, 45, 45)")
                    : expanded
                      ? arrowDropUp(isItemHovered ? "rgba(227,227,227,1)" : "rgb(110, 110, 110)")
                      : arrowDropDown(isItemHovered ? "rgba(227,227,227,1)" : "rgb(67, 67, 67)")
                }
                scale={1.1}
                scaleToContaier={true}
                onContainerClick={objectCount === 0 ? undefined : onExpandClick}
                style={{ cursor: objectCount === 0 ? "default" : "pointer" }}
                containerStyle={{
                  cursor: objectCount === 0 ? "default" : "pointer",
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
    // The expanded object rows live inside the sortable node, not beside it, so
    // that a mask dragged within its group carries its own stack with it and the
    // list measures one block instead of a row with orphans under it.
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
      {stackOpen && item.type === "mask" && objectRows !== undefined && (
        // No DndContext of its own: these rows belong to the group's, so that a
        // drag anywhere in the group is one gesture with one set of sensors.
        // Only the SortableContext is local, which is what keeps an object row
        // sorting against its own stack instead of against the group's media.
        <SortableContext items={objectRowIds} strategy={verticalListSortingStrategy}>
          {objectRows.map((row, i) => {
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
            const object = objectsById.get(row);
            if (!object) return null;
            return (
              <MaskObjectRow
                key={objectRowId(item.key, row)}
                maskKey={item.key}
                mask={item.mask}
                object={object}
                // "1.1", "1.2" -- this mask's own row number, then the object's
                // place in its stack, so a row says which mask it belongs to
                // now that nothing indents it.
                label={`${index + 1}.${(i < planeRowIndex ? i : i - 1) + 1}`}
                isEven={i % 2 === 0}
                indexColumnStyle={indexColumnStyle}
                rowHeight={dynamicSizes.groupItem.height}
                filenameStyle={dynamicSizes.filename.filename}
                filenameMargin={dynamicSizes.filename.margin}
                removeOverlaySize={removeOverlaySize}
                onContextMenuClick={() => onObjectContextMenuClick(object.id)}
                onRemoveClick={() => onObjectRemoveClick(object.id)}
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
