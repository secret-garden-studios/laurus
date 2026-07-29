import { useContext, useRef, useState, useCallback, useMemo, useEffect } from "react";
import { dellaRespira } from "../../fonts";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import styles from "../../app.module.css";
import { addCircle, cancelCircle, circle, SvgRepo } from "../../svg-repo";
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
  const [hoveredItemKey, setHoveredItemKey] = useState<string | null>(null);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [isTitleBarHovered, setIsTitleBarHovered] = useState(false);
  const hasSelection = useMemo(
    () => selectedImgKeys.size > 0 || selectedSvgKeys.size > 0,
    [selectedImgKeys, selectedSvgKeys],
  );
  const groupImgs = useMemo(() => {
    return Array.from(coreState.project.imgs.entries())
      .filter(([, meta]) => meta.media_group_id === mediaGroupId)
      .map(([key]) => {
        const img = coreState.canvasImgs.get(key);
        return img ? { key, img } : undefined;
      })
      .filter((entry): entry is { key: string; img: LaurusImgResult } => Boolean(entry));
  }, [coreState.project.imgs, coreState.canvasImgs, mediaGroupId]);
  const groupSvgs = useMemo(() => {
    return Array.from(coreState.project.svgs.entries())
      .filter(([, meta]) => meta.media_group_id === mediaGroupId)
      .map(([key]) => {
        const svg = coreState.canvasSvgs.get(key);
        return svg ? { key, svg } : undefined;
      })
      .filter((entry): entry is { key: string; svg: LaurusSvgResult } => Boolean(entry));
  }, [coreState.project.svgs, coreState.canvasSvgs, mediaGroupId]);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          flex: {
            height: 32,
            paddingLeft: 0,
          },
          input: {
            fontSize: 10,
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
          groupItem: {
            height: 70,
            gap: 0,
            padding: 0,
          },
          indexColumn: {
            width: "4ch",
            fontSize: 9,
          },
          removeOverlay: {
            size: 16,
            inset: 0,
          },
        };
      case "midhigh":
        return {
          flex: {
            height: 24,
            paddingLeft: 0,
          },
          input: {
            fontSize: 8,
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
          groupItem: {
            height: 56,
            gap: 0,
            padding: 0,
          },
          indexColumn: {
            width: "4ch",
            fontSize: 7,
          },
          removeOverlay: {
            size: 18,
            inset: 3,
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
            fontSize: 8,
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
          groupItem: {
            height: 48,
            gap: 0,
            padding: 0,
          },
          indexColumn: {
            width: "4ch",
            fontSize: 7,
          },
          removeOverlay: {
            size: 16,
            inset: 3,
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
      if (!isAltKeyPressed || !coreState.project.project_id) return;
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
    [isAltKeyPressed, coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
  );

  const onRemoveSvgFromGroupClick = useCallback(
    async (key: string) => {
      if (!isAltKeyPressed || !coreState.project.project_id) return;
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
    [isAltKeyPressed, coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
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
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(10deg, rgb(25, 25, 25), rgb(23, 23, 23))",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.025)",
          borderRadius: 0,
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
            letterSpacing: "3px",
            background: "none",
            color: "rgb(227, 227, 227)",
            border: "none",
            outline: "none",
            width: "100%",
            ...dynamicSizes.input,
          }}
          type="text"
          autoComplete="off"
          onChange={(e) => onMediaGroupDescriptionChange(e.target.value)}
        />
      </div>
      {(groupImgs.length > 0 || groupSvgs.length > 0) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            gap: dynamicSizes.groupItem.gap,
          }}
        >
          {groupImgs.map(({ key, img }, index) => (
            <div
              key={key}
              style={{
                width: "100%",
                display: "flex",
                padding: dynamicSizes.groupItem.padding,
                background: `rgba(255, 255, 255, ${(index % 2 === 0 ? 0 : 0.025) + (hoveredRowKey === key ? 0.02 : 0)})`,
                border: `1px solid ${hoveredRowKey === key ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0)"}`,
              }}
              onMouseEnter={() => setHoveredRowKey(key)}
              onMouseLeave={() => setHoveredRowKey(null)}
            >
              <div
                style={{
                  height: "100%",
                  background: "rgba(22, 22, 22, 0.9)",
                  display: "grid",
                  placeContent: "center",
                  ...dynamicSizes.indexColumn,
                }}
              >
                {(index + 1).toFixed()}
              </div>
              <div
                className={styles["transparent-checkerboard-background"]}
                style={{
                  width: dynamicSizes.groupItem.height,
                  height: dynamicSizes.groupItem.height,
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={() => setHoveredItemKey(key)}
                onMouseLeave={() => setHoveredItemKey(null)}
              >
                <LaurusImage
                  title={img.media_key}
                  draggable={false}
                  alt={img.media_key}
                  src={img.src}
                  fill
                  onClick={() => onImgContextMenuClick(key)}
                  style={{
                    objectFit: "cover",
                    cursor: "pointer",
                  }}
                />
                {isAltKeyPressed && hoveredItemKey === key && (
                  <SvgRepo
                    title={"remove from group"}
                    svg={cancelCircle()}
                    scale={1}
                    scaleToContaier={true}
                    onContainerClick={() => onRemoveImgFromGroupClick(key)}
                    style={{
                      cursor: "pointer",
                    }}
                    containerStyle={{
                      position: "absolute",
                      top: dynamicSizes.removeOverlay.inset,
                      right: dynamicSizes.removeOverlay.inset,
                      width: dynamicSizes.removeOverlay.size,
                      height: dynamicSizes.removeOverlay.size,
                      cursor: "pointer",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {groupSvgs.map(({ key, svg }, index) => (
            <div
              key={key}
              style={{
                width: "100%",
                display: "flex",
                padding: dynamicSizes.groupItem.padding,
                background: `rgba(255, 255, 255, ${((groupImgs.length + index) % 2 === 0 ? 0 : 0.025) + (hoveredRowKey === key ? 0.02 : 0)})`,
                border: `1px solid ${hoveredRowKey === key ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0)"}`,
              }}
              onMouseEnter={() => setHoveredRowKey(key)}
              onMouseLeave={() => setHoveredRowKey(null)}
            >
              <div
                style={{
                  height: "100%",
                  background: "rgba(22, 22, 22, 0.9)",
                  display: "grid",
                  placeContent: "center",
                  ...dynamicSizes.indexColumn,
                }}
              >
                {(groupImgs.length + index + 1).toFixed()}
              </div>
              <div
                className={styles["transparent-checkerboard-background"]}
                style={{
                  width: dynamicSizes.groupItem.height,
                  height: dynamicSizes.groupItem.height,
                  position: "relative",
                  display: "grid",
                  placeContent: "center",
                }}
                onMouseEnter={() => setHoveredItemKey(key)}
                onMouseLeave={() => setHoveredItemKey(null)}
              >
                <SvgRepo
                  title={svg.media_key}
                  svg={svg}
                  onContainerClick={() => onSvgContextMenuClick(key)}
                  containerStyle={{
                    width: dynamicSizes.groupItem.height * 0.7,
                    height: dynamicSizes.groupItem.height * 0.7,
                    cursor: "pointer",
                  }}
                  scale={1}
                  scaleToContaier={true}
                />
                {isAltKeyPressed && hoveredItemKey === key && (
                  <SvgRepo
                    title={"remove from group"}
                    svg={cancelCircle()}
                    scale={1}
                    scaleToContaier={true}
                    onContainerClick={() => onRemoveSvgFromGroupClick(key)}
                    style={{
                      cursor: "pointer",
                    }}
                    containerStyle={{
                      position: "absolute",
                      top: dynamicSizes.removeOverlay.inset,
                      right: dynamicSizes.removeOverlay.inset,
                      width: dynamicSizes.removeOverlay.size,
                      height: dynamicSizes.removeOverlay.size,
                      cursor: "pointer",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
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
