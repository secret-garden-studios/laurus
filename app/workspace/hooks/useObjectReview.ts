import { useCallback, useContext, useRef, useState } from "react";
import { CoreContext, MaskContext, SocketContext, UIContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { UIActionType, advanceObjectReview, isObjectReviewLocked } from "../states/ui-state";
import { postObjectReviewDecision, toObjectBlackPoint, toObjectBlackPointFields } from "../workspace.server";
import { applyObjectDelta } from "../canvas-media/mask-delta";

function polygonIndicesForObject(polygons: { object_id: number }[] | undefined, objectId: number): Set<number> {
  const indices = new Set<number>();
  polygons?.forEach((p, i) => {
    if (p.object_id === objectId) indices.add(i);
  });
  return indices;
}

function reviewPreviewFor(
  candidate: { object: { id: number }; polygon_indices: number[] },
  decided: boolean,
  polygons: { object_id: number }[] | undefined,
): { current: Set<number>; diffBase: Set<number> | undefined } {
  const proposed = new Set(candidate.polygon_indices);
  if (!decided) return { current: proposed, diffBase: undefined };
  return { current: polygonIndicesForObject(polygons, candidate.object.id), diffBase: proposed };
}

export function useObjectReview() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyMaskObjectsUpdated, notifyMaskObjectReviewPreview, notifyReviewZoomChanged } = useContext(MaskContext);
  const { sendMaskObjectUpdate } = useContext(SocketContext);

  const review = uiState.objectReview;
  const decidingRef = useRef(false);
  const [isDeciding, setIsDeciding] = useState(false);

  const currentCandidate = review?.candidates[review.currentIndex];
  const currentDecision = currentCandidate ? review?.decisions.get(currentCandidate.object.id) : undefined;
  const isLocked = review ? isObjectReviewLocked(review) : false;
  const currentDescription =
    currentDecision === "accepted" && currentCandidate
      ? (coreState.canvasMasks.get(review?.maskKey ?? "")?.objects.find((o) => o.id === currentCandidate.object.id)
          ?.description ?? currentCandidate.object.description)
      : undefined;

  const decideCurrentObject = useCallback(
    async (decision: "accepted" | "rejected", description?: string) => {
      if (!review || review.mode !== "review" || decidingRef.current) return;
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

      dispatch({ type: CoreActionType.SetObjectReview, maskMediaId: review.maskMediaId, value: response.review });

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
      const decided = new Map(review.decisions);
      decided.set(candidate.object.id, decision);
      const next = advanceObjectReview(review, decided);

      const preview = next.done
        ? undefined
        : reviewPreviewFor(
            review.candidates[next.currentIndex],
            decided.has(review.candidates[next.currentIndex].object.id),
            coreState.canvasMasks.get(review.maskKey)?.polygons,
          );

      uiDispatch({ type: UIActionType.RecordObjectReviewDecision, decision, nextCurrentIndices: preview?.current });
      notifyMaskObjectReviewPreview(review.maskKey, preview?.current, undefined, preview?.diffBase);
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

  const goToIndex = useCallback(
    (index: number) => {
      if (!review) return;
      const clamped = Math.min(review.candidates.length - 1, Math.max(0, index));
      if (clamped === review.currentIndex) return;
      const candidate = review.candidates[clamped];
      const preview = reviewPreviewFor(
        candidate,
        review.decisions.has(candidate.object.id),
        coreState.canvasMasks.get(review.maskKey)?.polygons,
      );
      uiDispatch({ type: UIActionType.SetObjectReviewIndex, index: clamped, currentIndices: preview.current });
      notifyMaskObjectReviewPreview(review.maskKey, preview.current, undefined, preview.diffBase);
    },
    [review, uiDispatch, notifyMaskObjectReviewPreview, coreState.canvasMasks],
  );

  const requestRedo = useCallback(() => {
    if (!review || !isObjectReviewLocked(review)) return;
    uiDispatch({ type: UIActionType.RequestObjectReviewRedo });
    notifyMaskObjectReviewPreview(review.maskKey, review.currentIndices, undefined, undefined);
  }, [review, uiDispatch, notifyMaskObjectReviewPreview]);

  const goToPreviousCandidate = useCallback(() => {
    if (review) goToIndex(review.currentIndex - 1);
  }, [review, goToIndex]);

  const goToNextCandidate = useCallback(() => {
    if (review) goToIndex(review.currentIndex + 1);
  }, [review, goToIndex]);

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

  const saveEditedObject = useCallback(
    async (description: string) => {
      if (!review || review.mode !== "edit" || decidingRef.current) return;
      const object = review.candidates[0]?.object;
      const maskData = coreState.canvasMasks.get(review.maskKey);
      if (!object || !maskData) return;
      decidingRef.current = true;
      setIsDeciding(true);

      let updated;
      try {
        updated = await sendMaskObjectUpdate(maskData.mask_media_id, {
          object_id: object.id,
          name: object.name,
          cx: object.cx,
          cy: object.cy,
          radius: object.radius,
          elevation: object.elevation,
          falloff: object.falloff,
          shape: object.shape,
          ...toObjectBlackPointFields(toObjectBlackPoint(object)),
          description,
          reviewed: true,
          remove: false,
          polygon_indices: [...review.currentIndices].sort((a, b) => a - b),
        });
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
      if (!updated) return;

      const patched = applyObjectDelta(maskData, updated);
      dispatch({ type: CoreActionType.SetCanvasMask, key: review.maskKey, value: patched });
      notifyMaskObjectsUpdated(review.maskKey, patched);
      endReview();
    },
    [review, coreState.canvasMasks, sendMaskObjectUpdate, dispatch, notifyMaskObjectsUpdated, endReview],
  );

  return {
    review,
    isDeciding,
    currentDecision,
    currentDescription,
    isLocked,
    requestRedo,
    decideCurrentObject,
    saveEditedObject,
    togglePolygon,
    goToPreviousCandidate,
    goToNextCandidate,
    setZoom,
    previewZoom,
    endReview,
  };
}
