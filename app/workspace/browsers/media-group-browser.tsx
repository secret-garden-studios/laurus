import { useContext, useRef, useState, useCallback, useMemo, useEffect } from "react";
import { dellaRespira } from "../../fonts";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import styles from "../../app.module.css";
import { addCircle, circle, closeIcon, SvgRepo } from "../../svg-repo";
import {
  deleteMediaGroup,
  LaurusImgResult,
  LaurusMediaGroupResult,
  LaurusSvgResult,
  updateMediaGroup,
} from "../workspace.server";
import { updateProject, LaurusProjectResult } from "../../projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type MediaGroupItem =
  { type: "img"; key: string; img: LaurusImgResult } | { type: "svg"; key: string; svg: LaurusSvgResult };

export interface MediaGroupBrowser {
  mediaGroupId: string;
  mediaGroupResult: LaurusMediaGroupResult;
  maxWidth: number;
}
export default function MediaGroupBrowser({ mediaGroupId, mediaGroupResult, maxWidth }: MediaGroupBrowser) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed, selectedImgKeys, selectedSvgKeys, setSelectedImgKeys, setSelectedSvgKeys } =
    useContext(HoverContext);
  const [adding, setAdding] = useState(false);
  const [isTitleBarHovered, setIsTitleBarHovered] = useState(false);
  const hasSelection = useMemo(
    () => selectedImgKeys.size > 0 || selectedSvgKeys.size > 0,
    [selectedImgKeys, selectedSvgKeys],
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
    return [...imgItems, ...svgItems]
      .sort((a, b) => a.order - b.order)
      .map((entry) =>
        entry.type === "img"
          ? { type: "img" as const, key: entry.key, img: entry.img }
          : { type: "svg" as const, key: entry.key, svg: entry.svg },
      );
  }, [coreState.project.imgs, coreState.project.svgs, coreState.canvasImgs, coreState.canvasSvgs, mediaGroupId]);
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
      const newProject: LaurusProjectResult = { ...coreState.project, imgs: newImgs, svgs: newSvgs };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        setSelectedImgKeys(new Set());
        setSelectedSvgKeys(new Set());
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
    mediaGroupId,
    dispatch,
    setSelectedImgKeys,
    setSelectedSvgKeys,
  ]);

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

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onGroupDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !coreState.project.project_id) return;
      const oldIndex = groupItems.findIndex((item) => item.key === active.id);
      const newIndex = groupItems.findIndex((item) => item.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedGroup = arrayMove(groupItems, oldIndex, newIndex);

      type AllItem = { type: "img" | "svg"; key: string; order: number };
      const allItems: AllItem[] = [
        ...Array.from(coreState.project.imgs, ([key, meta]) => ({ type: "img" as const, key, order: meta.order })),
        ...Array.from(coreState.project.svgs, ([key, meta]) => ({ type: "svg" as const, key, order: meta.order })),
      ].sort((a, b) => a.order - b.order);

      const groupKeySet = new Set(groupItems.map((item) => item.key));
      let groupCursor = 0;
      const reorderedAllItems = allItems.map((item) => {
        if (!groupKeySet.has(item.key)) return item;
        const replacement = reorderedGroup[groupCursor];
        groupCursor += 1;
        return { type: replacement.type, key: replacement.key, order: item.order };
      });

      const snapshot = coreState.project;
      const newImgs = new Map(coreState.project.imgs);
      const newSvgs = new Map(coreState.project.svgs);
      reorderedAllItems.forEach((item, index) => {
        if (item.type === "img") {
          const existing = newImgs.get(item.key);
          if (existing) newImgs.set(item.key, { ...existing, order: index });
        } else {
          const existing = newSvgs.get(item.key);
          if (existing) newSvgs.set(item.key, { ...existing, order: index });
        }
      });

      const newProject: LaurusProjectResult = { ...coreState.project, imgs: newImgs, svgs: newSvgs };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, { ...newProject }).then(
        (updated) => {
          if (!updated) {
            dispatch({ type: CoreActionType.SetProject, value: snapshot });
          }
        },
      );
    },
    [groupItems, coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
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
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onGroupDragEnd}
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
                  onRemoveFromGroupClick={() =>
                    item.type === "img" ? onRemoveImgFromGroupClick(item.key) : onRemoveSvgFromGroupClick(item.key)
                  }
                  onContextMenuClick={() =>
                    item.type === "img" ? onImgContextMenuClick(item.key) : onSvgContextMenuClick(item.key)
                  }
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

interface MediaGroupRow {
  item: MediaGroupItem;
  index: number;
  isEven: boolean;
  indexColumnStyle: { width: string; fontSize: number };
  removeOverlaySize: number;
  onRemoveFromGroupClick: () => void;
  onContextMenuClick: () => void;
}
function MediaGroupRow({
  item,
  index,
  isEven,
  indexColumnStyle,
  removeOverlaySize,
  onRemoveFromGroupClick,
  onContextMenuClick,
}: MediaGroupRow) {
  const { uiState } = useContext(UIContext);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
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
    if (item.type !== "img") return undefined;
    const containerSize = dynamicSizes.groupItem.height;
    const aspectRatio = item.img.width / item.img.height;
    const isSquareish = aspectRatio >= 0.9 && aspectRatio <= 1.1;
    let displayWidth, displayHeight;
    if (isSquareish) {
      displayWidth = containerSize;
      displayHeight = containerSize;
    } else {
      const targetSize = containerSize * 1.33;
      const scale = Math.max(targetSize / item.img.width, targetSize / item.img.height);
      displayWidth = Math.round(item.img.width * scale);
      displayHeight = Math.round(item.img.height * scale);
    }
    return { isSquareish, displayWidth, displayHeight };
  }, [dynamicSizes.groupItem.height, item]);

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
      {(() => {
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
        }
      })()}
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
