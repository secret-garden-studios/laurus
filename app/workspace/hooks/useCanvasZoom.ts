import { useCallback, useContext } from "react";
import { Transform } from "@dnd-kit/utilities";
import { MaskContext, UIContext } from "../workspace.client";
import { UIActionType } from "../states/ui-state";

export function useCanvasZoom() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyCanvasZoomChanged } = useContext(MaskContext);

  const setZoom = useCallback((value: number) => uiDispatch({ type: UIActionType.SetCanvasZoom, value }), [uiDispatch]);

  const previewZoom = useCallback((value: number) => notifyCanvasZoomChanged(value), [notifyCanvasZoomChanged]);

  return { zoom: uiState.canvasZoom, setZoom, previewZoom };
}

/* Reads the zoom on its own so a media item re-renders when the canvas is
   scaled and not every time a mask preview changes. */
export function useCanvasZoomValue(): number {
  const { uiState } = useContext(UIContext);
  return uiState.canvasZoom;
}

/* Pointer deltas come out of dnd-kit in screen pixels, but positions are stored
   in unzoomed canvas units -- and a translate applied inside the scaled canvas
   is itself multiplied by the zoom on the way to the screen. Dividing by the
   zoom in both places keeps a drag tracking the cursor 1:1 at any zoom. */
export function toCanvasDelta(delta: { x: number; y: number }, zoom: number): { x: number; y: number } {
  if (zoom === 1) return delta;
  return { x: delta.x / zoom, y: delta.y / zoom };
}

export function toCanvasTranslate(transform: Transform | null, zoom: number): Transform | null {
  if (!transform || zoom === 1) return transform;
  return { ...transform, x: transform.x / zoom, y: transform.y / zoom };
}
