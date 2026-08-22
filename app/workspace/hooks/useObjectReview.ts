import { useCallback, useContext, useRef, useState } from "react";
import { CoreContext, MaskContext, UIContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { UIActionType, advanceObjectReview } from "../states/ui-state";
import { postObjectReviewDecision } from "../workspace.server";
import { applyObjectDelta } from "../canvas-media/mask-delta";

export function useObjectReview() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyMaskObjectsUpdated, notifyMaskObjectReviewPreview, notifyReviewZoomChanged } = useContext(MaskContext);

  const review = uiState.objectReview;
  const decidingRef = useRef(false);
  const [isDeciding, setIsDeciding] = useState(false);

  const decideCurrentObject = useCallback(
    async (decision: "accepted" | "rejected", description?: string) => {
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
          decision === "accepted" ? description : undefined,
          added,
          removed,
        );
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
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
      const decided = new Map(review.decisions);
      decided.set(candidate.object.id, decision);
      const next = advanceObjectReview(review, decided);
      notifyMaskObjectReviewPreview(
        review.maskKey,
        next.done ? undefined : new Set(review.candidates[next.currentIndex].polygon_indices),
      );
    },
    [
      review,
      coreState.apiOrigin,
      coreState.accessToken,
      coreState.canvasMasks,
      dispatch,
      uiDispatch,
      notifyMaskObjectsUpdated,
      notifyMaskObjectReviewPreview,
    ],
  );

  const togglePolygon = useCallback(
    (index: number) => uiDispatch({ type: UIActionType.ToggleObjectReviewPolygon, index }),
    [uiDispatch],
  );

  const setZoom = useCallback(
    (value: number) => uiDispatch({ type: UIActionType.SetObjectReviewZoom, value }),
    [uiDispatch],
  );

  const previewZoom = useCallback(
    (value: number) => {
      if (!review) return;
      notifyReviewZoomChanged(value);
    },
    [review, notifyReviewZoomChanged],
  );

  const endReview = useCallback(() => {
    if (review) notifyMaskObjectReviewPreview(review.maskKey, undefined);
    uiDispatch({ type: UIActionType.EndObjectReview });
  }, [review, uiDispatch, notifyMaskObjectReviewPreview]);

  return { review, isDeciding, decideCurrentObject, togglePolygon, setZoom, previewZoom, endReview };
}
