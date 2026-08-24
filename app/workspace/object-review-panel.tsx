import { useMemo, useRef } from "react";
import { useObjectReview } from "./hooks/useObjectReview";
import { Z_INDEX } from "./workspace.config";
import { SvgRepo, checkCircle, chevronLeft, chevronRight } from "../svg-repo";
import { MAX_MASK_OBJECTS } from "./mask-gl";
import { acceptedObjectCount } from "./states/ui-state";
import { buildObjectShapeFromRings, cachedObjectShape, flattenPathData } from "./canvas-media/object-shape";
import { ringPieces } from "./canvas-media/object-path";

const DECISION_COLOR = {
  none: "rgb(67, 67, 67)",
  accepted: "rgb(76, 175, 80)",
  rejected: "rgb(211, 71, 71)",
} as const;

export default function ObjectReviewPanel() {
  const descriptionRef = useRef<HTMLInputElement>(null);

  const {
    review,
    isDeciding,
    currentDecision,
    currentDescription,
    isLocked,
    requestRedo,
    decideCurrentObject,
    saveEditedObject,
    setEditingShape,
    revertShape,
    goToPreviousCandidate,
    goToNextCandidate,
    endReview,
  } = useObjectReview();

  // The two ways a reshaped outline can fail to be a saveable object.
  //
  // It may have been left in several pieces, which stitching does deliberately
  // -- so this is not really an error, it is the second half of the gesture
  // still outstanding. Nothing here can settle it, because which piece was
  // meant is exactly what only the reviewer knows; the pen takes the pick.
  //
  // Or it may have been folded through itself until it stops being renderable,
  // and would otherwise be saved to render as a plain circle with nothing
  // anywhere saying why. cachedObjectShape is the same lookup the renderer
  // makes, so that check costs nothing the editor has not already paid; the
  // reason is only built in the failing case.
  //
  // Only ever an edited outline. A detected shape that happens to arrive in
  // two pieces is detection's business and was accepted that way long before
  // the pen existed -- the reviewer is only ever held to what they drew.
  const edited = review?.editedShape?.path;
  const { shapeRefusal, multiplePieces } = useMemo((): {
    shapeRefusal: string | undefined;
    multiplePieces: boolean;
  } => {
    if (!edited) return { shapeRefusal: undefined, multiplePieces: false };
    const rings = flattenPathData(edited);
    const pieces = ringPieces(rings).pieces.length;
    if (pieces > 1) {
      return {
        shapeRefusal: `the outline is in ${pieces} pieces -- click the one to keep, and the rest are discarded`,
        multiplePieces: true,
      };
    }
    if (cachedObjectShape(edited)) return { shapeRefusal: undefined, multiplePieces: false };
    const built = buildObjectShapeFromRings(rings);
    return { shapeRefusal: built.ok ? undefined : built.reason, multiplePieces: false };
  }, [edited]);

  if (!review) return null;

  const candidate = review.candidates[review.currentIndex];
  const isEdit = review.mode === "edit";
  const position = review.currentIndex + 1;
  const total = review.candidates.length;
  const accepted = acceptedObjectCount(review.decisions);
  const hasDecision = !isEdit && currentDecision !== undefined;
  const redoRequested = hasDecision && !isLocked;

  const commit = () => {
    const description = descriptionRef.current?.value.trim() ?? "";
    if (!description) {
      descriptionRef.current?.focus();
      return;
    }
    if (shapeRefusal) return;
    if (isEdit) void saveEditedObject(description);
    else void decideCurrentObject("accepted", description);
  };

  return (
    <div
      style={{
        zIndex: Z_INDEX.OBJECT_REVIEW_PANEL,
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 320,
        padding: 14,
        borderRadius: 8,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgb(32, 32, 32)",
        boxShadow: "rgba(0, 0, 0, 0.4) 2px 2px 4px 0px",
        color: "rgb(224, 224, 224)",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", color: "rgb(160, 160, 160)" }}>
        {isEdit ? (
          <span>editing {candidate.object.name}</span>
        ) : (
          <>
            <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <SvgRepo
                title="previous candidate"
                svg={position <= 1 ? chevronLeft("rgb(67,67,67)") : chevronLeft()}
                containerStyle={{
                  width: 18,
                  height: 18,
                  cursor: position <= 1 ? "default" : "pointer",
                }}
                scale={0.75}
                onContainerClick={position <= 1 ? undefined : goToPreviousCandidate}
              />
              object {position} of {total}
              <SvgRepo
                title="next candidate"
                svg={position >= total ? chevronRight("rgb(67,67,67)") : chevronRight()}
                containerStyle={{
                  width: 18,
                  height: 18,
                  cursor: position >= total ? "default" : "pointer",
                }}
                scale={0.75}
                onContainerClick={position >= total ? undefined : goToNextCandidate}
              />
            </span>
            <span title={`a mask holds at most ${MAX_MASK_OBJECTS} objects -- the review ends once it is full`}>
              {accepted} of {MAX_MASK_OBJECTS} accepted
            </span>
            <button
              type="button"
              onClick={endReview}
              title="stop reviewing -- undecided objects are left undecided"
              style={{
                border: "none",
                background: "none",
                color: "rgb(160, 160, 160)",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
              }}
            >
              done
            </button>
          </>
        )}
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgb(160, 160, 160)" }}
      >
        <span>
          {isLocked
            ? "already decided -- highlighted triangles differ from the original"
            : // while the outline is in pieces the pen has the canvas, and a
              // click lands on a piece rather than on a triangle
              multiplePieces
              ? "click the piece to keep -- the triangles follow the outline"
              : "click a triangle to add or remove it from this object"}
        </span>
        {!isEdit && (
          <div onDoubleClick={requestRedo} style={{ display: "flex", flexShrink: 0 }}>
            <SvgRepo
              title={
                !hasDecision
                  ? "no decision made yet"
                  : redoRequested
                    ? `${currentDecision} -- edit the triangles, then accept or reject to record a new decision`
                    : `already ${currentDecision} -- double-click to unlock and decide again`
              }
              svg={checkCircle(DECISION_COLOR[currentDecision ?? "none"])}
              containerStyle={{
                width: 18,
                height: 18,
                cursor: hasDecision ? "pointer" : "default",
                opacity: redoRequested ? 0.55 : 1,
              }}
              scale={0.7}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => {
            // closing the pen abandons an uncommitted reshape: an edit is kept
            // by accepting the object, not by looking away from it
            if (review.editingShape) revertShape();
            setEditingShape(!review.editingShape);
          }}
          title={
            isLocked
              ? "double-click the check mark to make a new decision"
              : review.editingShape
                ? "hide the outline's handles"
                : "show the outline's handles -- drag an anchor to move it, a handle to curve it, alt-drag to corner it"
          }
          style={{
            flex: 1,
            padding: "5px 0",
            borderRadius: 4,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: review.editingShape ? "rgb(67, 67, 67)" : "rgb(24, 24, 24)",
            color: isLocked ? "rgb(120, 120, 120)" : "inherit",
            cursor: isLocked ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          {review.editingShape ? "editing shape" : "edit shape"}
        </button>
        {review.editedShape !== undefined && (
          <button
            type="button"
            onClick={revertShape}
            title="put the outline back the way detection drew it"
            style={{
              padding: "5px 10px",
              borderRadius: 4,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgb(24, 24, 24)",
              color: "inherit",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            revert
          </button>
        )}
      </div>
      {shapeRefusal && (
        <span style={{ color: "rgb(211, 71, 71)", fontSize: 12, lineHeight: 1.35 }}>{shapeRefusal}</span>
      )}
      <input
        key={`${review.mode}|${candidate.object.id}`}
        ref={descriptionRef}
        type="text"
        placeholder="describe this object..."
        defaultValue={
          isEdit ? candidate.object.description : currentDecision === "accepted" ? (currentDescription ?? "") : ""
        }
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgb(24, 24, 24)",
          color: "inherit",
          fontSize: 13,
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={isDeciding || isLocked}
          onClick={isEdit ? endReview : () => void decideCurrentObject("rejected")}
          title={
            isEdit
              ? "close without saving -- the object is left as it was"
              : isLocked
                ? "double-click the check mark to make a new decision"
                : undefined
          }
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgb(24, 24, 24)",
            color: isDeciding || isLocked ? "rgb(120, 120, 120)" : "inherit",
            cursor: isDeciding ? "progress" : isLocked ? "not-allowed" : "pointer",
          }}
        >
          {isEdit ? "cancel" : "reject"}
        </button>
        <button
          type="button"
          disabled={isDeciding || isLocked || shapeRefusal !== undefined}
          onClick={commit}
          title={
            shapeRefusal
              ? shapeRefusal
              : !isEdit && isLocked
                ? "double-click the check mark to make a new decision"
                : undefined
          }
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "none",
            background: isDeciding || isLocked || shapeRefusal ? "rgba(67, 67, 67, 0.4)" : "rgb(67, 67, 67)",
            color: isDeciding || isLocked || shapeRefusal ? "rgb(120, 120, 120)" : "rgb(255, 255, 255)",
            cursor: isDeciding ? "progress" : isLocked || shapeRefusal ? "not-allowed" : "pointer",
          }}
        >
          {isEdit ? "save" : "accept"}
        </button>
      </div>
    </div>
  );
}
