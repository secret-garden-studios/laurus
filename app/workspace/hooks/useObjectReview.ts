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

  const session = uiState.maskEdit;
  // The object review specifically, for everything that is genuinely about
  // reviewing -- stepping candidates, decisions, the lock. A light edit has
  // none of that and reads as undefined here, which is what the callers below
  // already do the right thing with.
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

  /**
   * Drop the live relief a reshape was previewing through the pending-topology
   * channel. A candidate is not on the mask yet, so that preview is the only
   * thing showing an edited outline -- and it has to end when the candidate
   * does, or it goes on overriding whatever takes its place.
   */
  const clearShapePreview = useCallback(() => {
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
    notifyMaskPendingTopologyCleared(session?.maskKey);
  }, [dispatch, notifyMaskPendingTopologyCleared, session?.maskKey]);

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
    if (!session) return undefined;
    const maskData = coreState.canvasMasks.get(session.maskKey);
    if (!session.retouch || !maskData) return maskData;
    const restored = { ...maskData, polygons: session.retouch.restore };
    dispatch({ type: CoreActionType.SetCanvasMask, key: session.maskKey, value: restored });
    uiDispatch({ type: UIActionType.SetMaskEditRetouch, retouch: undefined });
    notifyMaskObjectsUpdated(session.maskKey, restored);
    return restored;
  }, [session, coreState.canvasMasks, dispatch, uiDispatch, notifyMaskObjectsUpdated]);

  /**
   * Put whatever the pen is open on back the way it was before it touched it:
   * the outline it started from, the triangles that went with it, and no
   * pending relief.
   *
   * All three, because a shape edit is three changes wearing one name -- the
   * stored outline, the region's own geometry, and which triangles it covers
   * -- and undoing any subset of them leaves the thing in a state nothing
   * produced. Reverting used to drop only the outline, so the triangles stayed
   * cut to a curve that no longer existed.
   *
   * "The way it was" is settled by the mask, not by the session: for an object
   * that means the recorded decision where there is one and the candidate as
   * detected where there is not, and for a light it means the triangles that
   * still carry its id. Both are read *after* the recut is rolled back, so
   * neither can name a fragment that is about to stop existing.
   */
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
    if (!session?.editingShape || uiState.tool.type === "pen") return;
    revertShape();
    uiDispatch({ type: UIActionType.SetMaskEditShapeEditing, editing: false });
  }, [session?.editingShape, uiState.tool.type, revertShape, uiDispatch]);

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
      notifyMaskObjectReviewPreview(review.maskKey, preview?.current, preview?.diffBase);
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
      notifyMaskObjectReviewPreview(review.maskKey, preview.current, preview.diffBase);
    },
    [review, uiDispatch, notifyMaskObjectReviewPreview, restoreRetouchedMesh, clearShapePreview],
  );

  const requestRedo = useCallback(() => {
    if (!review || !isMaskEditLocked(review)) return;
    // The original candidate's proposal, not undefined: unlocking is not
    // itself an edit, so nothing should show as changed yet, but a reshape
    // right after unlocking still needs a base to diff its new triangles
    // against -- the same one revertShape hands back on the way out.
    const candidate = review.candidates[review.currentIndex];
    uiDispatch({ type: UIActionType.RequestObjectReviewRedo });
    notifyMaskObjectReviewPreview(
      review.maskKey,
      review.currentIndices,
      candidate ? new Set(candidate.polygon_indices) : undefined,
    );
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
    if (session) notifyMaskObjectReviewPreview(session.maskKey, undefined);
    clearShapePreview();
    uiDispatch({ type: UIActionType.EndMaskEdit });
  }, [session, uiDispatch, notifyMaskObjectReviewPreview, clearShapePreview]);

  const endReview = useCallback(() => {
    // an uncommitted reshape dies with the session rather than lingering as
    // relief over an object that was never accepted, and so does an
    // uncommitted recut -- which can be there without a reshape, so it is
    // asked for separately rather than riding on editedShape
    if (session?.editedShape) revertShape();
    else restoreRetouchedMesh();
    closeReview();
  }, [session, revertShape, restoreRetouchedMesh, closeReview]);

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
      // closeReview, not endReview: the recut has just been saved with the
      // object, and rolling it back now would leave the mask drawing a mesh
      // the server no longer has
      closeReview();
    },
    [review, coreState.canvasMasks, sendMaskObjectUpdate, dispatch, notifyMaskObjectsUpdated, closeReview],
  );

  /**
   * Write the light's edited outline and description back to the mask.
   *
   * The mirror of saveEditedObject, and different from it in exactly two
   * places. There is no `reviewed` flag, because a light is never proposed by
   * detection and so is never pending anyone's judgement. And the geometry
   * falls back to the light's own rather than to a candidate's -- which for a
   * light that has never been shaped is all zeros, so the pen is expected to
   * have seeded it (see lightRegion) before anything can be saved here.
   *
   * The recut goes with the save for the same reason the object's does: it is
   * already on screen, and leaving it unsent would have the canvas drawing a
   * mesh the server does not have.
   */
  const saveEditedLight = useCallback(
    async (description: string) => {
      if (session?.subject !== "light" || decidingRef.current) return;
      const maskData = coreState.canvasMasks.get(session.maskKey);
      if (!maskData) return;
      // The light as the mask holds it now, not the copy the session opened
      // on. This payload replaces every field of the light, and the light
      // source bar is right there editing intensity and falloff on the very
      // light this panel has open -- saving from the snapshot would quietly
      // roll back whatever was changed while the panel sat there. Only the
      // outline and the description come from the edit; everything else is
      // carried through from wherever it now stands.
      const light = maskData.lights.find((l) => l.id === session.light.id) ?? session.light;
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
      // the recut has just been saved with the light, so this closes rather
      // than ends -- see saveEditedObject
      closeReview();
    },
    [session, coreState.canvasMasks, sendMaskLightUpdate, dispatch, notifyMaskLightUpdated, closeReview],
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
