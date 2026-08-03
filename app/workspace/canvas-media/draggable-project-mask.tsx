"use client";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CoreContext, UIContext } from "../workspace.client";
import { useCallback, useContext, useMemo } from "react";
import { updateProject, LaurusProjectMask, LaurusProjectResult } from "../../projects/projects.server";
import { LaurusVectorResult } from "../workspace.server";
import { CoreActionType } from "../states/core-state";
import { calculateTransformedBounds } from "./geometry";
import { ProjectMaskItem, ProjectMaskItemSource } from "./project-mask-item";

interface DraggableProjectMask {
  mediaKey: string;
  meta: LaurusProjectMask;
  vectorData: LaurusVectorResult;
  zIndex: number;
}
/**
 * Move-tool dragging plus alt-click selection (via `selectedMaskKeys`, ProjectMaskItem) --
 * still no marquee-select, duplicate-drop, or group-paste support. Full parity with
 * DraggableProjectImg/Svg is future work.
 */
export function DraggableProjectMask({ mediaKey, meta, vectorData, zIndex }: DraggableProjectMask) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);

  const dndPosition = useMemo(() => {
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
  }, [uiState.tool.type, meta.left, meta.top, coreState.project.frame_left, coreState.project.frame_top]);

  // Memoized rather than passed as inline object literals -- ProjectMaskItem's GL-context
  // setup effect keys off `source` (and ends up re-running whenever it sees a "new" one), so a
  // fresh object every render here would tear down and rebuild the WebGL context (including a
  // fresh async texture reload) on every unrelated re-render of this component, not just when the
  // mask's actual data changes.
  const frame = useMemo(
    () => ({ width: meta.width, height: meta.height, scale_x: meta.scale_x, scale_y: meta.scale_y }),
    [meta.width, meta.height, meta.scale_x, meta.scale_y],
  );
  const source = useMemo<ProjectMaskItemSource>(() => ({ kind: "static", vectorData }), [vectorData]);

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
      newMasks.set(mediaKey, { ...itemMeta, left: newLeft, top: newTop });

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
    [coreState.accessToken, coreState.apiOrigin, coreState.project, dispatch, mediaKey],
  );

  return (
    <DndContext
      id={`dnd-context-${mediaKey}`}
      sensors={sensors}
      onDragStart={() => {
        document.body.style.cursor = "grabbing";
      }}
      onDragEnd={(e) => {
        document.body.style.cursor = "";
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
      />
    </DndContext>
  );
}
