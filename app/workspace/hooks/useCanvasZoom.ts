import { useCallback, useContext } from "react";
import { MaskContext, UIContext } from "../workspace.client";
import { UIActionType } from "../states/ui-state";

export function useCanvasZoom() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyCanvasZoomChanged } = useContext(MaskContext);

  const setZoom = useCallback((value: number) => uiDispatch({ type: UIActionType.SetCanvasZoom, value }), [uiDispatch]);

  const previewZoom = useCallback((value: number) => notifyCanvasZoomChanged(value), [notifyCanvasZoomChanged]);

  return { zoom: uiState.canvasZoom, setZoom, previewZoom };
}
