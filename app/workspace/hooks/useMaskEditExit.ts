import { useCallback, useContext } from "react";
import { MaskContext, UIContext } from "../workspace.client";
import { CarouselEntry, isMaskEditSubject, LaurusTool, MaskEditSession, UIActionType } from "../states/ui-state";

export function confirmEndingMaskEdit(session: MaskEditSession | undefined): boolean {
  if (!session) return true;
  return confirm(`you are about to stop editing a mask. anything you have not saved ` + `will be discarded. continue?`);
}

export function confirmLeavingPen(session: MaskEditSession | undefined, next: LaurusTool): boolean {
  if (next.type === "pen") return true;
  return confirmEndingMaskEdit(session);
}

export function useToolSwitch(): (next: LaurusTool) => boolean {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyMaskToolChanged } = useContext(MaskContext);
  const session = uiState.maskEdit;

  return useCallback(
    (next: LaurusTool): boolean => {
      if (!confirmLeavingPen(session, next)) return false;
      uiDispatch({ type: UIActionType.SetTool, value: next });
      notifyMaskToolChanged(next.type);
      return true;
    },
    [session, uiDispatch, notifyMaskToolChanged],
  );
}

export function useSelectionGuard(): (entry: CarouselEntry) => boolean {
  const { uiState, uiDispatch } = useContext(UIContext);
  const session = uiState.maskEdit;

  return useCallback(
    (entry: CarouselEntry): boolean => {
      if (!session || isMaskEditSubject(session, entry)) return true;
      if (!confirmEndingMaskEdit(session)) return false;
      uiDispatch({ type: UIActionType.RequestMaskEditEnd });
      return true;
    },
    [session, uiDispatch],
  );
}
