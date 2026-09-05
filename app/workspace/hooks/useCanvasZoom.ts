import { useCallback, useContext } from "react";
import { Transform } from "@dnd-kit/utilities";
import { MaskContext, UIContext } from "../workspace.client";
import { UIActionType } from "../states/ui-state";
import { useUICanvasZoom } from "../states/ui-store";

export function useCanvasZoom() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyCanvasZoomChanged } = useContext(MaskContext);

  const setZoom = useCallback((value: number) => uiDispatch({ type: UIActionType.SetCanvasZoom, value }), [uiDispatch]);

  const previewZoom = useCallback((value: number) => notifyCanvasZoomChanged(value), [notifyCanvasZoomChanged]);

  return { zoom: uiState.canvasZoom, setZoom, previewZoom };
}

export function useCanvasZoomValue(): number {
  return useUICanvasZoom();
}

export function toCanvasDelta(delta: { x: number; y: number }, zoom: number): { x: number; y: number } {
  if (zoom === 1) return delta;
  return { x: delta.x / zoom, y: delta.y / zoom };
}

export function toCanvasTranslate(transform: Transform | null, zoom: number): Transform | null {
  if (!transform || zoom === 1) return transform;
  return { ...transform, x: transform.x / zoom, y: transform.y / zoom };
}
