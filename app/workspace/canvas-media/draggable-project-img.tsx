"use client";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CoreContext, HoverContext, getNewContextMenuConfig, LaurusTransform, UIContext } from "../workspace.client";
import { RefObject, useCallback, useContext, useMemo } from "react";
import {
  updateProject,
  DEFAULT_CONTEXT_MENU_CONFIG,
  LaurusProjectImg,
  LaurusProjectResult,
  LaurusProjectSvg,
} from "../../projects/projects.server";
import { v4 } from "uuid";
import { LaurusFrame, LaurusImgResult } from "../workspace.server";
import { LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";
import { calculateTransformedBounds } from "./geometry";
import { ProjectImg } from "./project-img";
import { beginBodyDragCursor, endBodyDragCursor } from "../hooks/useToolCursor";

interface DraggableProjectImg {
  mediaKey: string;
  data: LaurusImgResult;
  meta: LaurusProjectImg;
  zIndex: number;
  imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  refKey?: string;
  forceAbsolutePosition?: boolean;
}
export function DraggableProjectImg({
  mediaKey,
  data,
  meta,
  zIndex,
  imgElementsRef,
  framesCacheRef,
  refKey,
  forceAbsolutePosition,
}: DraggableProjectImg) {
  const { coreState, dispatch, notifyMaskActiveElementChanged } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { selectedImgKeys, selectedSvgKeys, setSelectedImgKeys, isAltKeyPressed } = useContext(HoverContext);
  const transformedBounds = useMemo(() => {
    return calculateTransformedBounds(meta);
  }, [meta]);
  const dndPosition = useMemo(() => {
    if (forceAbsolutePosition) {
      return {
        x: Math.max(0, meta.left),
        y: Math.max(0, meta.top),
      };
    }
    switch (uiState.tool.type) {
      case "viewport": {
        return {
          x: meta.left - coreState.project.frame_left,
          y: meta.top - coreState.project.frame_top,
        };
      }
      default: {
        return {
          x: Math.max(0, meta.left),
          y: Math.max(0, meta.top),
        };
      }
    }
  }, [
    forceAbsolutePosition,
    uiState.tool.type,
    meta.left,
    meta.top,
    coreState.project.frame_left,
    coreState.project.frame_top,
  ]);
  const laurusTransform = useMemo<LaurusTransform>(() => {
    return {
      cssProps: {
        perspective: 750,
        width: meta.width * meta.scale_x,
        height: meta.height * meta.scale_y,
        transform: `rotate3d(${meta.rotate_x},${meta.rotate_y},${meta.rotate_z},${meta.rotate_angle}deg)`,
        transition: "transform 0.25s ease-out",
        transformOrigin: "top left",
      },
      bounds: { ...transformedBounds },
    };
  }, [
    meta.height,
    meta.rotate_angle,
    meta.rotate_x,
    meta.rotate_y,
    meta.rotate_z,
    meta.scale_x,
    meta.scale_y,
    meta.width,
    transformedBounds,
  ]);
  const highestOrder = useMemo(() => {
    let max = 0;
    for (const img of coreState.project.imgs.values()) {
      if (img.order > max) max = img.order;
    }
    for (const svg of coreState.project.svgs.values()) {
      if (svg.order > max) max = svg.order;
    }
    for (const mask of coreState.project.masks.values()) {
      if (mask.order > max) max = mask.order;
    }
    return max;
  }, [coreState.project.imgs, coreState.project.svgs, coreState.project.masks]);

  const sensors = useSensors(useSensor(PointerSensor));

  const lazyLoadImgElementsRef = () => {
    if (!imgElementsRef.current) {
      imgElementsRef.current = new Map();
    }
    return imgElementsRef.current;
  };

  const onImgRef = (element: HTMLImageElement | null, refKey: string) => {
    const m = lazyLoadImgElementsRef();
    if (element) {
      m.set(refKey, element);
    } else {
      m.delete(refKey);
    }
  };

  const onNewImgPosition = useCallback(
    async (deltaX: number, deltaY: number) => {
      const rollback: LaurusProjectResult = { ...coreState.project };
      const newImgs = new Map(coreState.project.imgs);
      const newSvgs = new Map(coreState.project.svgs);
      const updateItem = (itemKey: string, itemType: "img" | "svg") => {
        const itemMeta = itemType === "img" ? newImgs.get(itemKey) : newSvgs.get(itemKey);
        if (!itemMeta) return;
        const bounds = calculateTransformedBounds(itemMeta);
        let newLeft = Math.min(
          coreState.project.canvas_width - itemMeta.width,
          Math.max(0, Math.round(itemMeta.left + deltaX)),
        );
        let newTop = Math.min(
          coreState.project.canvas_height - itemMeta.height,
          Math.max(0, Math.round(itemMeta.top + deltaY)),
        );
        const yMaxActual = newTop + itemMeta.height + bounds.deltas.bottom;
        const xMaxActual = newLeft + itemMeta.width + bounds.deltas.right;
        const yMinActual = newTop + bounds.deltas.top;
        const xMinActual = newLeft + bounds.deltas.left;
        if (yMaxActual > coreState.project.canvas_height) newTop -= yMaxActual - coreState.project.canvas_height;
        if (xMaxActual > coreState.project.canvas_width) newLeft -= xMaxActual - coreState.project.canvas_width;
        if (yMinActual < 0) newTop += Math.abs(yMinActual);
        if (xMinActual < 0) newLeft += Math.abs(xMinActual);
        const itemContextMenu = uiState.projectContextMenus.get(itemKey);
        const nContextMenuConfig = getNewContextMenuConfig(
          { left: newLeft, top: newTop },
          {
            width: coreState.project.canvas_width,
            height: coreState.project.canvas_height,
          },
          { ...itemMeta },
          { x: itemMeta.scale_x, y: itemMeta.scale_y },
          itemContextMenu?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG,
        );
        if (itemType === "img") {
          newImgs.set(itemKey, {
            ...(itemMeta as LaurusProjectImg),
            left: newLeft,
            top: newTop,
          });
        } else {
          newSvgs.set(itemKey, {
            ...(itemMeta as LaurusProjectSvg),
            left: newLeft,
            top: newTop,
          });
        }
        uiDispatch({
          type: UIActionType.SetProjectContextMenu,
          key: itemKey,
          showContextMenu: itemContextMenu?.showContextMenu ?? false,
          contextMenuConfig: nContextMenuConfig,
        });
      };

      updateItem(mediaKey, "img");
      selectedImgKeys.forEach((key) => {
        if (key !== mediaKey) updateItem(key, "img");
      });
      selectedSvgKeys.forEach((key) => {
        updateItem(key, "svg");
      });

      const newProject: LaurusProjectResult = {
        ...coreState.project,
        imgs: newImgs,
        svgs: newSvgs,
      };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      if (newProject.project_id) {
        const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (!updated) {
          dispatch({ type: CoreActionType.SetProject, value: rollback });
        }
      }
    },
    [
      coreState.accessToken,
      coreState.apiOrigin,
      coreState.project,
      dispatch,
      mediaKey,
      selectedImgKeys,
      selectedSvgKeys,
      uiState.projectContextMenus,
      uiDispatch,
    ],
  );

  const onImgStackDrop = useCallback(async () => {
    if (!uiState.browserElement) return;
    const browserElement = { ...uiState.browserElement };
    const snapshot = { ...coreState.project };
    const newKey = v4();
    const maxOrder = Math.max(
      ...Array.from(snapshot.imgs.values()).map((i) => i.order),
      ...Array.from(snapshot.svgs.values()).map((s) => s.order),
      ...Array.from(snapshot.masks.values()).map((v) => v.order),
      -1,
    );

    if (browserElement.type === "img") {
      const newProjectImg: LaurusProjectImg = {
        ...meta,
        media_key: browserElement.value.media_key,
        img_media_id: browserElement.value.img_media_id,
        order: maxOrder + 1,
      } as LaurusProjectImg;
      const newImgs = new Map(snapshot.imgs);
      newImgs.set(newKey, newProjectImg);
      const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        const encodedImg = uiState.browserImgs.find((i) => i.media_key === browserElement.value.media_key);
        if (encodedImg) {
          dispatch({
            type: CoreActionType.SetCanvasImg,
            key: newKey,
            value: { ...encodedImg },
          });
          uiDispatch({
            type: UIActionType.AddCarouselEntry,
            value: { type: "img", key: newKey },
          });
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: newKey,
            showContextMenu: false,
            contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
          });
        }
      }
    } else if (browserElement.type === "svg") {
      const newProjectSvg: LaurusProjectSvg = {
        ...meta,
        media_key: browserElement.value.media_key,
        svg_media_id: browserElement.value.svg_media_id,
        viewbox: browserElement.value.viewbox,
        fill: browserElement.value.fill,
        stroke: browserElement.value.stroke,
        stroke_width: browserElement.value.stroke_width,
        order: maxOrder + 1,
      } as LaurusProjectSvg;
      const newSvgs = new Map(snapshot.svgs);
      newSvgs.set(newKey, newProjectSvg);
      const newProject: LaurusProjectResult = { ...snapshot, svgs: newSvgs };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        const encodedSvg = uiState.browserSvgs.find((i) => i.media_key === browserElement.value.media_key);
        if (encodedSvg) {
          dispatch({
            type: CoreActionType.SetCanvasSvg,
            key: newKey,
            value: { ...encodedSvg },
          });
          uiDispatch({
            type: UIActionType.AddCarouselEntry,
            value: { type: "svg", key: newKey },
          });
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: newKey,
            showContextMenu: false,
            contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
          });
        }
      }
    }
  }, [
    uiState.browserElement,
    uiState.browserImgs,
    uiState.browserSvgs,
    coreState.project,
    coreState.apiOrigin,
    coreState.accessToken,
    meta,
    dispatch,
    uiDispatch,
  ]);

  const onImgClick = useCallback(
    (metaKey: boolean) => {
      const itemContextMenu = uiState.projectContextMenus.get(mediaKey);
      const showContextMenu = itemContextMenu?.showContextMenu ?? false;
      const contextMenuConfig = itemContextMenu?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG;

      const newContextMenuConfig = getNewContextMenuConfig(
        { ...meta },
        {
          width: coreState.project.canvas_width,
          height: coreState.project.canvas_height,
        },
        { ...meta },
        { x: meta.scale_x, y: meta.scale_y },
        contextMenuConfig,
      );
      if (isAltKeyPressed && uiState.tool.type !== "marquee") {
        setSelectedImgKeys((prev) => {
          const next = new Set(prev);
          if (next.has(mediaKey)) {
            next.delete(mediaKey);
          } else {
            next.add(mediaKey);
          }
          return next;
        });
        uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
      } else if (metaKey && !uiState.filledForwards) {
        uiDispatch({
          type: UIActionType.SetProjectContextMenu,
          key: mediaKey,
          showContextMenu: !showContextMenu,
          contextMenuConfig: newContextMenuConfig,
        });
      } else {
        switch (uiState.tool.type) {
          case "marquee": {
            if (uiState.tool.stack) {
              onImgStackDrop();
            }
            break;
          }
          case "none": {
            break;
          }
          case "contextmenu": {
            uiDispatch({
              type: UIActionType.SetProjectContextMenu,
              key: mediaKey,
              showContextMenu: !showContextMenu,
              contextMenuConfig: newContextMenuConfig,
            });
            break;
          }
          case "viewport": {
            break;
          }
          case "move": {
            break;
          }
          case "scale": {
            setSelectedImgKeys((prev) => {
              const next = new Set(prev);
              if (next.has(mediaKey)) {
                next.delete(mediaKey);
              } else {
                next.add(mediaKey);
              }
              return next;
            });
            uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
            break;
          }
          case "rotate": {
            // Toggles selectedImgKeys the same way the "scale" case above does, so Rotatebar's
            // blue-outline highlighting stays consistent no matter which tool made the selection
            // (see Scalebar). SetActiveElement below is untouched -- other consumers (rotate-unit's
            // carousel, etc.) still key off it independently of this selection set.
            setSelectedImgKeys((prev) => {
              const next = new Set(prev);
              if (next.has(mediaKey)) {
                next.delete(mediaKey);
              } else {
                next.add(mediaKey);
              }
              return next;
            });
            const newActiveElement: LaurusActiveElement = {
              key: mediaKey,
              type: "img",
            };
            uiDispatch({
              type: UIActionType.SetActiveElement,
              value: newActiveElement,
            });
            notifyMaskActiveElementChanged(newActiveElement.key);
            break;
          }
          case "mask": {
            const newActiveElement: LaurusActiveElement = {
              key: mediaKey,
              type: "img",
            };
            uiDispatch({
              type: UIActionType.SetActiveElement,
              value: newActiveElement,
            });
            notifyMaskActiveElementChanged(newActiveElement.key);
            break;
          }
        }
      }
    },
    [
      uiState.projectContextMenus,
      uiState.filledForwards,
      uiState.tool,
      mediaKey,
      meta,
      coreState.project.canvas_width,
      coreState.project.canvas_height,
      isAltKeyPressed,
      setSelectedImgKeys,
      uiDispatch,
      onImgStackDrop,
      notifyMaskActiveElementChanged,
    ],
  );

  return (
    <>
      <DndContext
        id={`dnd-context-${mediaKey}`}
        sensors={sensors}
        onDragStart={beginBodyDragCursor}
        onDragEnd={(e) => {
          endBodyDragCursor();
          const delta = e.delta;
          onNewImgPosition(delta.x, delta.y);
        }}
      >
        <ProjectImg
          dndId={`dnd-node-${mediaKey}`}
          dndPosition={dndPosition}
          zIndex={zIndex}
          maxZIndex={highestOrder}
          mediaKey={mediaKey}
          meta={meta}
          data={data}
          framesCacheRef={framesCacheRef}
          onClick={onImgClick}
          onImgRef={onImgRef}
          refKey={refKey}
          title={meta.media_key}
          transform={laurusTransform}
        />
      </DndContext>
    </>
  );
}
