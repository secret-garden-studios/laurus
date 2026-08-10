"use client";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CoreContext, getNewContextMenuConfig, LaurusTransform, UIContext } from "../workspace.client";
import { RefObject, useCallback, useContext, useMemo } from "react";
import {
  DEFAULT_CONTEXT_MENU_CONFIG,
  updateProject,
  LaurusProjectMask,
  LaurusProjectResult,
} from "../../projects/projects.server";
import { LaurusFrame, LaurusMaskResult } from "../workspace.server";
import { LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";
import { calculateTransformedBounds } from "./geometry";
import { MaskImperativeHandle, ProjectMaskItem, ProjectMaskItemSource } from "./project-mask-item";
import { beginBodyDragCursor, endBodyDragCursor } from "../hooks/useToolCursor";

interface DraggableProjectMask {
  mediaKey: string;
  meta: LaurusProjectMask;
  maskData: LaurusMaskResult;
  zIndex: number;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  maskHandlesRef?: RefObject<Map<string, Set<MaskImperativeHandle>> | null>;
  maskElementsRef?: RefObject<Map<string, HTMLCanvasElement> | null>;
  forceAbsolutePosition?: boolean;
}
/**
 * Move-tool dragging, alt-click multi-select (via `selectedMaskKeys`, ProjectMaskItem), and now
 * metaKey/"contextmenu"-tool context-menu opening -- full parity with DraggableProjectImg/Svg,
 * mirroring the same click/transform/context-menu wiring for a mask instead of an img/svg.
 */
export function DraggableProjectMask({
  mediaKey,
  meta,
  maskData,
  zIndex,
  framesCacheRef,
  maskHandlesRef,
  maskElementsRef,
  forceAbsolutePosition,
}: DraggableProjectMask) {
  const { coreState, dispatch, notifyMaskActiveElementChanged } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);

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

  const transformedBounds = useMemo(() => {
    return calculateTransformedBounds(meta);
  }, [meta]);
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

  // Memoized rather than passed as inline object literals -- ProjectMaskItem's GL-context
  // setup effect keys off `source` (and ends up re-running whenever it sees a "new" one), so a
  // fresh object every render here would tear down and rebuild the WebGL context (including a
  // fresh async texture reload) on every unrelated re-render of this component, not just when the
  // mask's actual data changes.
  const frame = useMemo(
    () => ({ width: meta.width, height: meta.height, scale_x: meta.scale_x, scale_y: meta.scale_y }),
    [meta.width, meta.height, meta.scale_x, meta.scale_y],
  );
  const source = useMemo<ProjectMaskItemSource>(() => ({ kind: "static", maskData }), [maskData]);

  // Mirrors DraggableProjectImg/Svg's own highestOrder exactly -- see ProjectMaskItem's maxZIndex
  // comment for why this mask's context menu needs it.
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

  const onNewMaskPosition = useCallback(
    async (deltaX: number, deltaY: number) => {
      const rollback: LaurusProjectResult = { ...coreState.project };
      const newMasks = new Map(coreState.project.masks);
      const itemMeta = newMasks.get(mediaKey);
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

      const itemContextMenu = uiState.projectContextMenus.get(mediaKey);
      const newContextMenuConfig = getNewContextMenuConfig(
        { left: newLeft, top: newTop },
        {
          width: coreState.project.canvas_width,
          height: coreState.project.canvas_height,
        },
        { ...itemMeta },
        { x: itemMeta.scale_x, y: itemMeta.scale_y },
        itemContextMenu?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG,
      );
      newMasks.set(mediaKey, { ...itemMeta, left: newLeft, top: newTop });
      uiDispatch({
        type: UIActionType.SetProjectContextMenu,
        key: mediaKey,
        showContextMenu: itemContextMenu?.showContextMenu ?? false,
        contextMenuConfig: newContextMenuConfig,
      });

      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
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
      uiState.projectContextMenus,
      uiDispatch,
    ],
  );

  // Mirrors DraggableProjectImg's onImgClick -- metaKey (cmd/ctrl-click) or the dedicated
  // "contextmenu" tool both toggle the context menu; alt-click multi-select is handled inside
  // ProjectMaskItem itself (it owns selectedMaskKeys) and stays untouched here.
  const onMaskClick = useCallback(
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
      if (metaKey && !uiState.filledForwards) {
        uiDispatch({
          type: UIActionType.SetProjectContextMenu,
          key: mediaKey,
          showContextMenu: !showContextMenu,
          contextMenuConfig: newContextMenuConfig,
        });
        return;
      }
      switch (uiState.tool.type) {
        case "contextmenu": {
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: mediaKey,
            showContextMenu: !showContextMenu,
            contextMenuConfig: newContextMenuConfig,
          });
          break;
        }
        case "rotate": {
          const newActiveElement: LaurusActiveElement = {
            key: mediaKey,
            type: "mask",
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(mediaKey);
          break;
        }
      }
    },
    [
      uiState.projectContextMenus,
      uiState.filledForwards,
      uiState.tool.type,
      mediaKey,
      meta,
      coreState.project.canvas_width,
      coreState.project.canvas_height,
      uiDispatch,
      notifyMaskActiveElementChanged,
    ],
  );

  return (
    <DndContext
      id={`dnd-context-${mediaKey}`}
      sensors={sensors}
      onDragStart={beginBodyDragCursor}
      onDragEnd={(e) => {
        endBodyDragCursor();
        onNewMaskPosition(e.delta.x, e.delta.y);
      }}
    >
      <ProjectMaskItem
        dndId={`dnd-node-${mediaKey}`}
        dndPosition={dndPosition}
        zIndex={zIndex}
        mediaKey={mediaKey}
        frame={frame}
        source={source}
        maskHandlesRef={maskHandlesRef}
        maskElementsRef={maskElementsRef}
        transform={laurusTransform}
        framesCacheRef={framesCacheRef}
        onClick={onMaskClick}
        maxZIndex={highestOrder}
      />
    </DndContext>
  );
}
