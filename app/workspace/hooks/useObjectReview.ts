import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext, MaskContext, SocketContext, UIContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { UIActionType, advanceObjectReview, isObjectReviewLocked, type ObjectShapeEdit } from "../states/ui-state";
import {
  postObjectReviewDecision,
  toObjectBlackPoint,
  toObjectBlackPointFields,
  type LaurusMaskResult,
} from "../workspace.server";
import { applyObjectDelta } from "../canvas-media/mask-delta";
import { retouchDelta } from "../canvas-media/object-retouch";

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
  const { notifyMaskObjectsUpdated, notifyMaskObjectReviewPreview, notifyMaskPendingTopologyCleared } =
    useContext(MaskContext);
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

  /**
   * Drop the live relief a reshape was previewing through the pending-topology
   * channel. A candidate is not on the mask yet, so that preview is the only
   * thing showing an edited outline -- and it has to end when the candidate
   * does, or it goes on overriding whatever takes its place.
   */
  const clearShapePreview = useCallback(() => {
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
    notifyMaskPendingTopologyCleared(review?.maskKey);
  }, [dispatch, notifyMaskPendingTopologyCleared, review?.maskKey]);

  /**
   * Put the mask's mesh back the way it was before a retouch recut it.
   *
   * A retouch is drawn as soon as it is made -- there would be no point
   * otherwise -- so the mask the canvas holds really has been recut, and
   * everything that walks away from the candidate has to undo it: shutting the
   * pen, stepping to another candidate, rejecting, ending the review. Only
   * accepting keeps it, and only because the accept has just sent it.
   *
   * The restore is the array that was there before, not a copy, so putting it
   * back also puts back every mesh cache keyed on it.
   *
   * Returns the mask as it now stands, because the callers that carry on to
   * read membership out of it must not read the copy they just replaced.
   */
  const restoreRetouchedMesh = useCallback((): LaurusMaskResult | undefined => {
    if (!review) return undefined;
    const maskData = coreState.canvasMasks.get(review.maskKey);
    if (!review.retouch || !maskData) return maskData;
    const restored = { ...maskData, polygons: review.retouch.restore };
    dispatch({ type: CoreActionType.SetCanvasMask, key: review.maskKey, value: restored });
    uiDispatch({ type: UIActionType.SetObjectReviewRetouch, retouch: undefined });
    notifyMaskObjectsUpdated(review.maskKey, restored);
    return restored;
  }, [review, coreState.canvasMasks, dispatch, uiDispatch, notifyMaskObjectsUpdated]);

  /**
   * Put the current candidate back the way it was before the pen touched it:
   * the outline it was detected with, the triangles that went with it, and no
   * pending relief.
   *
   * All three, because a shape edit is three changes wearing one name -- the
   * stored outline, the object's own geometry, and which triangles it covers
   * -- and undoing any subset of them leaves the object in a state nothing
   * produced. Reverting used to drop only the outline, so the triangles stayed
   * cut to a curve that no longer existed.
   *
   * "The way it was" means the recorded decision where there is one, and the
   * candidate as detected where there is not, which is the same rule that
   * decides what to show when stepping between candidates.
   */
  const revertShape = useCallback(() => {
    if (!review) return;
    const candidate = review.candidates[review.currentIndex];
    if (!candidate) return;

    const restored = reviewPreviewFor(
      candidate,
      review.decisions.has(candidate.object.id),
      restoreRetouchedMesh()?.polygons,
    );
    uiDispatch({ type: UIActionType.SetObjectReviewShape, shape: undefined });
    uiDispatch({ type: UIActionType.SetObjectReviewIndices, indices: restored.current });
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
    notifyMaskPendingTopologyCleared(review.maskKey);
    notifyMaskObjectReviewPreview(review.maskKey, restored.current, undefined, restored.diffBase);
  }, [
    review,
    restoreRetouchedMesh,
    uiDispatch,
    dispatch,
    notifyMaskPendingTopologyCleared,
    notifyMaskObjectReviewPreview,
  ]);

  /**
   * Shut the pen when the toolbar moves out from under it.
   *
   * The pen is a tool as much as a panel button -- while it is open the
   * subtitle bar is its own -- so picking another tool has to be a way out of
   * it, or the overlay would sit there over a bar describing something else.
   *
   * Reconciled here rather than in the reducer, and rather than in the toolbar
   * itself, because leaving the pen is three things and only one of them is
   * state: the reshape has to be dropped, the relief it was previewing torn
   * down, and the triangles put back where the outline had not yet moved them.
   * revertShape already knows how to do all three, and this is the one place
   * that can call it.
   */
  useEffect(() => {
    if (!review?.editingShape || uiState.tool.type === "pen") return;
    revertShape();
    uiDispatch({ type: UIActionType.SetObjectReviewShapeEditing, editing: false });
  }, [review?.editingShape, uiState.tool.type, revertShape, uiDispatch]);

  const decideCurrentObject = useCallback(
    async (decision: "accepted" | "rejected", description?: string) => {
      if (!review || review.mode !== "review" || decidingRef.current) return;
      const candidate = review.candidates[review.currentIndex];
      if (!candidate) return;
      decidingRef.current = true;
      setIsDeciding(true);

      // A rejected candidate keeps nothing, its recut included -- so the mesh
      // goes back first, and the indices this decision records are trimmed to
      // the mesh that is actually left. Recording indices off the recut would
      // name triangles that stopped existing a line later.
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
      clearShapePreview,
      restoreRetouchedMesh,
    ],
  );

  const togglePolygon = useCallback(
    (index: number) => uiDispatch({ type: UIActionType.ToggleObjectReviewPolygon, index }),
    [uiDispatch],
  );

  const setEditedShape = useCallback(
    (shape: ObjectShapeEdit | undefined) => uiDispatch({ type: UIActionType.SetObjectReviewShape, shape }),
    [uiDispatch],
  );

  const setEditingShape = useCallback(
    (editing: boolean) => uiDispatch({ type: UIActionType.SetObjectReviewShapeEditing, editing }),
    [uiDispatch],
  );

  const goToIndex = useCallback(
    (index: number) => {
      if (!review) return;
      const clamped = Math.min(review.candidates.length - 1, Math.max(0, index));
      if (clamped === review.currentIndex) return;
      const candidate = review.candidates[clamped];
      // before the preview is read, not after: the recut mesh is what the mask
      // is holding right now, and membership taken off it would name triangles
      // that are about to stop existing
      const preview = reviewPreviewFor(
        candidate,
        review.decisions.has(candidate.object.id),
        restoreRetouchedMesh()?.polygons,
      );
      clearShapePreview();
      uiDispatch({ type: UIActionType.SetObjectReviewIndex, index: clamped, currentIndices: preview.current });
      notifyMaskObjectReviewPreview(review.maskKey, preview.current, undefined, preview.diffBase);
    },
    [review, uiDispatch, notifyMaskObjectReviewPreview, restoreRetouchedMesh, clearShapePreview],
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

  /**
   * Shut the session down, leaving the mask exactly as it stands.
   *
   * The half of ending a review that is only bookkeeping -- the panel goes
   * away, the highlight comes off, the relief preview is torn down. What
   * becomes of any uncommitted work is the caller's business, because the two
   * callers want opposite things: someone clicking `done` is walking away from
   * it, while a save has just written it and must not have it rolled back
   * underneath.
   */
  const closeReview = useCallback(() => {
    if (review) notifyMaskObjectReviewPreview(review.maskKey, undefined);
    clearShapePreview();
    uiDispatch({ type: UIActionType.EndObjectReview });
  }, [review, uiDispatch, notifyMaskObjectReviewPreview, clearShapePreview]);

  const endReview = useCallback(() => {
    // an uncommitted reshape dies with the session rather than lingering as
    // relief over an object that was never accepted, and so does an
    // uncommitted recut -- which can be there without a reshape, so it is
    // asked for separately rather than riding on editedShape
    if (review?.editedShape) revertShape();
    else restoreRetouchedMesh();
    closeReview();
  }, [review, revertShape, restoreRetouchedMesh, closeReview]);

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
          cx: review.editedShape?.cx ?? object.cx,
          cy: review.editedShape?.cy ?? object.cy,
          radius: review.editedShape?.radius ?? object.radius,
          elevation: object.elevation,
          falloff: object.falloff,
          shape: review.editedShape?.path ?? object.shape,
          ...toObjectBlackPointFields(toObjectBlackPoint(object)),
          description,
          reviewed: true,
          remove: false,
          polygon_indices: [...review.currentIndices].sort((a, b) => a - b),
          ...(review.retouch ? { retouch: retouchDelta(review.retouch) } : {}),
        });
      } finally {
        decidingRef.current = false;
        setIsDeciding(false);
      }
      if (!updated) return;

      const patched = applyObjectDelta(maskData, updated);
      dispatch({ type: CoreActionType.SetCanvasMask, key: review.maskKey, value: patched });
      notifyMaskObjectsUpdated(review.maskKey, patched);
      // closeReview, not endReview: the recut has just been saved with the
      // object, and rolling it back now would leave the mask drawing a mesh
      // the server no longer has
      closeReview();
    },
    [review, coreState.canvasMasks, sendMaskObjectUpdate, dispatch, notifyMaskObjectsUpdated, closeReview],
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
    clearShapePreview,
    revertShape,
    setEditedShape,
    setEditingShape,
    goToPreviousCandidate,
    goToNextCandidate,
    endReview,
  };
}
