import { useCallback, useContext, useRef, useState } from "react";
import { CoreContext, MaskContext, UIContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { postObjectReviewDecision } from "../workspace.server";
import { applyObjectDelta } from "../canvas-media/mask-delta";

/** Orchestrates one accept/reject decision on the candidate the review
 *  panel currently has on screen: computes the manual clean-up diff against
 *  the candidate's own (untouched) polygon_indices, posts the decision, and
 *  on acceptance applies the returned mask the same way a hand-drawn object
 *  would be (see createObject in workspace.client.tsx). The pure
 *  batch/cycle advance itself lives in the RecordObjectReviewDecision
 *  reducer case (states/ui-state.ts) -- this hook is only the async/network
 *  side of making a decision. */
export function useObjectReview() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyMaskObjectsUpdated } = useContext(MaskContext);

  const review = uiState.objectReview;
  // A decision is only allowed once the previous one has been acknowledged.
  // Deciding is a two-click-per-second interaction on a panel that advances
  // under the cursor, so without this a second click lands on a candidate the
  // panel has already moved past and records a decision against the wrong
  // object. The ref is what actually gates -- state only drives the disabled
  // styling, and would not have updated yet by the time a fast second click
  // arrives.
  const decidingRef = useRef(false);
  const [isDeciding, setIsDeciding] = useState(false);

  const decideCurrentObject = useCallback(
    async (decision: "accepted" | "rejected") => {
      if (!review || decidingRef.current) return;
      const candidate = review.candidates[review.currentIndex];
      if (!candidate) return;
      decidingRef.current = true;
      setIsDeciding(true);

      const original = new Set(candidate.polygon_indices);
      const added = [...review.currentIndices].filter((i) => !original.has(i));
      const removed = candidate.polygon_indices.filter((i) => !review.currentIndices.has(i));

      let response;
      try {
        response = await postObjectReviewDecision(
          coreState.apiOrigin,
          coreState.accessToken,
          review.maskMediaId,
          candidate.object.id,
          decision,
          decision === "accepted" ? review.draftDescription.trim() : undefined,
          added,
          removed,
        );
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
      // Left on the same candidate deliberately: the decision never reached
      // Redis, so advancing would silently drop it.
      if (!response) return;

      const maskData = coreState.canvasMasks.get(review.maskKey);
      if (decision === "accepted" && response.delta && maskData) {
        const patched = applyObjectDelta(maskData, response.delta);
        dispatch({ type: CoreActionType.SetCanvasMask, key: review.maskKey, value: patched });
        notifyMaskObjectsUpdated(review.maskKey, patched);
        uiDispatch({
          type: UIActionType.AddCarouselEntry,
          value: { type: "object", key: review.maskKey, objectId: candidate.object.id },
        });
      }
      uiDispatch({ type: UIActionType.RecordObjectReviewDecision, decision });
    },
    [
      review,
      coreState.apiOrigin,
      coreState.accessToken,
      coreState.canvasMasks,
      dispatch,
      uiDispatch,
      notifyMaskObjectsUpdated,
    ],
  );

  const setDraftDescription = useCallback(
    (value: string) => uiDispatch({ type: UIActionType.SetObjectReviewDraftDescription, value }),
    [uiDispatch],
  );

  const togglePolygon = useCallback(
    (index: number) => uiDispatch({ type: UIActionType.ToggleObjectReviewPolygon, index }),
    [uiDispatch],
  );

  // While a review is up it takes over the canvas (see the interaction
  // canvas's pointerEvents in workspace.client.tsx), so there has to be a way
  // out of it that does not require deciding every remaining candidate.
  // Undecided candidates simply keep no decision recorded in Redis.
  const endReview = useCallback(() => uiDispatch({ type: UIActionType.EndObjectReview }), [uiDispatch]);

  return { review, isDeciding, decideCurrentObject, setDraftDescription, togglePolygon, endReview };
}
