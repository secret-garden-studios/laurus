import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext, MaskContext, SocketContext, UIContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { UIActionType, advanceObjectReview, isMaskEditLocked, type ObjectShapeEdit } from "../states/ui-state";
import {
  postObjectReviewDecision,
  toLightUpdate,
  toObjectUpdate,
  type LaurusMaskResult,
  type LaurusPolygonPath,
} from "../workspace.server";
import { polygonIndicesForLight, polygonIndicesForObject } from "../canvas-media/mask-geometry";
import { applyLightDelta, applyObjectDelta } from "../canvas-media/mask-delta";
import { retouchDelta } from "../canvas-media/object-retouch";
import { UNAUTHORIZED_EDIT } from "@/app/landing.server";

function reviewPreviewFor(
  candidate: { object: { id: number }; polygon_indices: number[] },
  decided: boolean,
  polygons: LaurusPolygonPath[] | undefined,
): { current: Set<number>; diffBase: Set<number> | undefined } {
  const proposed = new Set(candidate.polygon_indices);
  if (!decided) return { current: proposed, diffBase: undefined };
  return { current: new Set(polygonIndicesForObject(polygons, candidate.object.id)), diffBase: proposed };
}

export function useObjectReview() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const {
    notifyMaskObjectsUpdated,
    notifyMaskObjectReviewPreview,
    notifyMaskPendingTopologyCleared,
    notifyMaskLightUpdated,
  } = useContext(MaskContext);
  const { sendMaskObjectUpdate, sendMaskLightUpdate } = useContext(SocketContext);
  const isGuest = !coreState.accessToken;

  const session = uiState.maskEdit;
  const review = session?.subject === "object" ? session : undefined;
  const decidingRef = useRef(false);
  const [isDeciding, setIsDeciding] = useState(false);

  const currentCandidate = review?.candidates[review.currentIndex];
  const currentDecision = currentCandidate ? review?.decisions.get(currentCandidate.object.id) : undefined;
  const isLocked = session ? isMaskEditLocked(session) : false;
  const currentDescription =
    currentDecision === "accepted" && currentCandidate
      ? (coreState.canvasMasks.get(review?.maskKey ?? "")?.objects.find((o) => o.id === currentCandidate.object.id)
          ?.description ?? currentCandidate.object.description)
      : undefined;

  const clearShapePreview = useCallback(() => {
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
    notifyMaskPendingTopologyCleared(session?.maskKey);
  }, [dispatch, notifyMaskPendingTopologyCleared, session?.maskKey]);

  const restoreRetouchedMesh = useCallback((): LaurusMaskResult | undefined => {
    if (!session) return undefined;
    const maskData = coreState.canvasMasks.get(session.maskKey);
    if (!session.retouch || !maskData) return maskData;
    const restored = { ...maskData, polygons: session.retouch.restore };
    dispatch({ type: CoreActionType.SetCanvasMask, key: session.maskKey, value: restored });
    uiDispatch({ type: UIActionType.SetMaskEditRetouch, retouch: undefined });
    notifyMaskObjectsUpdated(session.maskKey, restored);
    return restored;
  }, [session, coreState.canvasMasks, dispatch, uiDispatch, notifyMaskObjectsUpdated]);

  const revertShape = useCallback(() => {
    if (!session) return;

    const restored = ((): { current: Set<number>; diffBase: Set<number> | undefined } | undefined => {
      if (session.subject === "light") {
        return {
          current: new Set(polygonIndicesForLight(restoreRetouchedMesh()?.polygons, session.light.id)),
          diffBase: undefined,
        };
      }
      const candidate = session.candidates[session.currentIndex];
      if (!candidate) return undefined;
      return reviewPreviewFor(candidate, session.decisions.has(candidate.object.id), restoreRetouchedMesh()?.polygons);
    })();
    if (!restored) return;

    uiDispatch({ type: UIActionType.SetMaskEditShape, shape: undefined });
    uiDispatch({ type: UIActionType.SetMaskEditIndices, indices: restored.current });
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
    notifyMaskPendingTopologyCleared(session.maskKey);
    notifyMaskObjectReviewPreview(session.maskKey, restored.current, restored.diffBase);
  }, [
    session,
    restoreRetouchedMesh,
    uiDispatch,
    dispatch,
    notifyMaskPendingTopologyCleared,
    notifyMaskObjectReviewPreview,
  ]);

  const decideCurrentObject = useCallback(
    async (decision: "accepted" | "rejected", description?: string) => {
      if (!review || review.mode !== "review" || decidingRef.current) return;
      const candidate = review.candidates[review.currentIndex];
      if (!candidate) return;
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      decidingRef.current = true;
      setIsDeciding(true);

      const restored = decision === "rejected" ? restoreRetouchedMesh() : undefined;
      const limit = restored ? restored.polygons.length : Infinity;
      const current = new Set([...review.currentIndices].filter((i) => i < limit));

      const original = new Set(candidate.polygon_indices);
      const added = [...current].filter((i) => !original.has(i));
      const removed = candidate.polygon_indices.filter((i) => !current.has(i));

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
          decision === "accepted" ? review.editedShape : undefined,
          decision === "accepted" && review.retouch ? retouchDelta(review.retouch) : undefined,
        );
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
      if (!response) return;
      clearShapePreview();

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
      notifyMaskObjectReviewPreview(review.maskKey, preview?.current, preview?.diffBase);
    },
    [
      isGuest,
      review,
      coreState.apiOrigin,
      coreState.accessToken,
      coreState.canvasMasks,
      dispatch,
      uiDispatch,
      notifyMaskObjectsUpdated,
      notifyMaskObjectReviewPreview,
      clearShapePreview,
      restoreRetouchedMesh,
    ],
  );

  const togglePolygon = useCallback(
    (index: number) => uiDispatch({ type: UIActionType.ToggleMaskEditPolygon, index }),
    [uiDispatch],
  );

  const setEditedShape = useCallback(
    (shape: ObjectShapeEdit | undefined) => uiDispatch({ type: UIActionType.SetMaskEditShape, shape }),
    [uiDispatch],
  );

  const setEditingShape = useCallback(
    (editing: boolean) => uiDispatch({ type: UIActionType.SetMaskEditShapeEditing, editing }),
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
        restoreRetouchedMesh()?.polygons,
      );
      clearShapePreview();
      uiDispatch({ type: UIActionType.SetObjectReviewIndex, index: clamped, currentIndices: preview.current });
      notifyMaskObjectReviewPreview(review.maskKey, preview.current, preview.diffBase);
    },
    [review, uiDispatch, notifyMaskObjectReviewPreview, restoreRetouchedMesh, clearShapePreview],
  );

  const requestRedo = useCallback(() => {
    if (!review || !isMaskEditLocked(review)) return;
    if (isGuest) {
      alert(UNAUTHORIZED_EDIT);
      return;
    }

    const candidate = review.candidates[review.currentIndex];
    uiDispatch({ type: UIActionType.RequestObjectReviewRedo });
    notifyMaskObjectReviewPreview(
      review.maskKey,
      review.currentIndices,
      candidate ? new Set(candidate.polygon_indices) : undefined,
    );
  }, [isGuest, review, uiDispatch, notifyMaskObjectReviewPreview]);

  const goToPreviousCandidate = useCallback(() => {
    if (review) goToIndex(review.currentIndex - 1);
  }, [review, goToIndex]);

  const goToNextCandidate = useCallback(() => {
    if (review) goToIndex(review.currentIndex + 1);
  }, [review, goToIndex]);

  const closeReview = useCallback(() => {
    if (session) notifyMaskObjectReviewPreview(session.maskKey, undefined);
    clearShapePreview();
    uiDispatch({ type: UIActionType.EndMaskEdit });
  }, [session, uiDispatch, notifyMaskObjectReviewPreview, clearShapePreview]);

  const endReview = useCallback(() => {
    if (session?.editedShape) revertShape();
    else restoreRetouchedMesh();
    closeReview();
  }, [session, revertShape, restoreRetouchedMesh, closeReview]);

  useEffect(() => {
    if (!session) return;
    if (uiState.tool.type === "pen" && uiState.playbackMode.type === "stopped" && !session.endRequested) return;
    endReview();
  }, [session, uiState.tool.type, uiState.playbackMode.type, endReview]);

  const saveEditedObject = useCallback(
    async (description: string) => {
      if (!review || review.mode !== "edit" || decidingRef.current) return;
      const object = review.candidates[0]?.object;
      const maskData = coreState.canvasMasks.get(review.maskKey);
      if (!object || !maskData) return;

      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      decidingRef.current = true;
      setIsDeciding(true);

      let updated;
      try {
        updated = await sendMaskObjectUpdate(
          maskData.mask_media_id,
          toObjectUpdate(object, {
            cx: review.editedShape?.cx ?? object.cx,
            cy: review.editedShape?.cy ?? object.cy,
            radius: review.editedShape?.radius ?? object.radius,
            shape: review.editedShape?.path ?? object.shape,
            description,
            reviewed: true,
            polygon_indices: [...review.currentIndices].sort((a, b) => a - b),
            ...(review.retouch ? { retouch: retouchDelta(review.retouch) } : {}),
          }),
        );
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
      if (!updated) return;

      const patched = applyObjectDelta(maskData, updated);
      dispatch({ type: CoreActionType.SetCanvasMask, key: review.maskKey, value: patched });
      notifyMaskObjectsUpdated(review.maskKey, patched);

      closeReview();
    },
    [isGuest, review, coreState.canvasMasks, sendMaskObjectUpdate, dispatch, notifyMaskObjectsUpdated, closeReview],
  );

  const saveEditedLight = useCallback(
    async (description: string) => {
      if (session?.subject !== "light" || decidingRef.current) return;
      const maskData = coreState.canvasMasks.get(session.maskKey);
      if (!maskData) return;

      const light = maskData.lights.find((l) => l.id === session.light.id) ?? session.light;
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      decidingRef.current = true;
      setIsDeciding(true);

      let updated;
      try {
        updated = await sendMaskLightUpdate(
          maskData.mask_media_id,
          toLightUpdate(light, {
            cx: session.editedShape?.cx ?? light.cx,
            cy: session.editedShape?.cy ?? light.cy,
            radius: session.editedShape?.radius ?? light.radius,
            shape: session.editedShape?.path ?? light.shape,
            description,
            polygon_indices: [...session.currentIndices].sort((a, b) => a - b),
            ...(session.retouch ? { retouch: retouchDelta(session.retouch) } : {}),
          }),
        );
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
      if (!updated) return;

      const patched = applyLightDelta(maskData, updated);
      dispatch({ type: CoreActionType.SetCanvasMask, key: session.maskKey, value: patched });
      notifyMaskLightUpdated(session.maskKey, patched);

      closeReview();
    },
    [isGuest, session, coreState.canvasMasks, sendMaskLightUpdate, dispatch, notifyMaskLightUpdated, closeReview],
  );

  return {
    session,
    review,
    isDeciding,
    currentDecision,
    currentDescription,
    isLocked,
    requestRedo,
    decideCurrentObject,
    saveEditedObject,
    saveEditedLight,
    togglePolygon,
    clearShapePreview,
    revertShape,
    setEditedShape,
    setEditingShape,
    goToPreviousCandidate,
    goToNextCandidate,
    endReview,
  };
}
