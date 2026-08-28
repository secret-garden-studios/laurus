import { useCallback, useContext } from "react";
import { MaskContext, UIContext } from "../workspace.client";
import { CarouselEntry, isMaskEditSubject, LaurusTool, MaskEditSession, UIActionType } from "../states/ui-state";

/**
 * Ask before something closes an open session, and say whether to go on.
 *
 * A session is the one thing in the workspace that holds unsaved work no
 * dialog has offered to keep: a redrawn outline, a recut mesh, a handful of
 * triangles picked by hand. Everything that would end one therefore asks
 * first, and asks in the same words, which is the whole reason this lives in
 * one place rather than at each of the two dozen gestures that can raise it.
 *
 * `lead` names what is about to do the closing, and is the subject of the
 * sentence -- "leaving the pen", "starting playback", "selecting something
 * else". No session means nothing to ask about, which is the ordinary case and
 * why every caller can put this in front of itself unconditionally.
 *
 * A plain function as well as the hooks below, because the keyboard shortcuts
 * and the playback handlers live in the component that *provides* UIContext
 * and so cannot read it back out through one.
 */
export function confirmEndingMaskEdit(session: MaskEditSession | undefined, lead: string): boolean {
  if (!session) return true;
  const subject = session.subject === "light" ? "light" : "object";
  return confirm(
    `${lead} closes the ${subject} the pen has open. anything you have not saved -- a redrawn ` +
      `outline, a recut mesh, the triangles you have picked -- is discarded. continue?`,
  );
}

/**
 * The same question, asked of a tool switch.
 *
 * The pen is exempt because its own bar's toggles are the session's controls
 * rather than a way out of one -- see defaultPenTool for why the pen stays
 * selected for the whole of a session, handles up or down.
 */
export function confirmLeavingPen(session: MaskEditSession | undefined, next: LaurusTool): boolean {
  if (next.type === "pen") return true;
  return confirmEndingMaskEdit(session, "leaving the pen");
}

/**
 * Move the toolbar, asking first where that would close something.
 *
 * Returns whether the switch happened, because a caller that also closes
 * context menus must not do that on a switch just called off.
 */
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

/**
 * Ask before selecting something else abandons an open session, and raise the
 * request to end it where the answer is yes.
 *
 * Selecting is not switching tools -- the pen stays exactly where it is, armed
 * for whatever is clicked next -- so this cannot go through useToolSwitch, and
 * the teardown it needs is not a reducer's to do. RequestMaskEditEnd is how it
 * asks the one place that can; see the field it sets.
 *
 * The subject itself is never a move away from the session, so re-selecting
 * the light or object the pen already has open passes straight through. That
 * is what makes it safe to put in front of every thumbnail and chevron rather
 * than only the ones that lead somewhere else.
 */
export function useSelectionGuard(): (entry: CarouselEntry) => boolean {
  const { uiState, uiDispatch } = useContext(UIContext);
  const session = uiState.maskEdit;

  return useCallback(
    (entry: CarouselEntry): boolean => {
      if (!session || isMaskEditSubject(session, entry)) return true;
      if (!confirmEndingMaskEdit(session, "selecting something else")) return false;
      uiDispatch({ type: UIActionType.RequestMaskEditEnd });
      return true;
    },
    [session, uiDispatch],
  );
}
