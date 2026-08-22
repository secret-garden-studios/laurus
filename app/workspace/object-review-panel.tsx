import { useObjectReview } from "./hooks/useObjectReview";
import { Z_INDEX } from "./workspace.config";

/** Sequential accept/reject review of one mask's edge-detected candidates:
 *  one object on screen at a time, highlighted on the canvas by
 *  project-mask-item.tsx's own objectReviewPreviewRef wiring. Clicking a
 *  triangle on the canvas toggles it into/out of the candidate being
 *  reviewed (see project-mask-item.tsx's onClick short-circuit) -- this
 *  panel only surfaces progress, the description prompt, and the two
 *  decisions themselves. */
export default function ObjectReviewPanel() {
  const { review, isDeciding, decideCurrentObject, setDraftDescription, endReview } = useObjectReview();

  if (!review) return null;

  const positionInBatch = review.currentIndex - review.batchStart + 1;
  const canAccept = review.draftDescription.trim().length > 0 && !isDeciding;

  return (
    <div
      style={{
        zIndex: Z_INDEX.OBJECT_REVIEW_PANEL,
        position: "fixed",
        // Anchored to the bottom rather than the top so it never sits over
        // the maskbar, which is what the titlebar renders while the mask
        // tool -- the tool a review always starts under -- is active.
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
        <span>
          object {positionInBatch} of {review.batchSize}
        </span>
        <span>cycle {review.cycle} of 3</span>
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
      </div>
      <div style={{ color: "rgb(160, 160, 160)" }}>click a triangle to add or remove it from this object</div>
      <input
        type="text"
        placeholder="describe this object..."
        value={review.draftDescription}
        onChange={(e) => setDraftDescription(e.currentTarget.value)}
        autoComplete="off"
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
          disabled={isDeciding}
          onClick={() => void decideCurrentObject("rejected")}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgb(24, 24, 24)",
            color: isDeciding ? "rgb(120, 120, 120)" : "inherit",
            cursor: isDeciding ? "progress" : "pointer",
          }}
        >
          reject
        </button>
        <button
          type="button"
          disabled={!canAccept}
          onClick={() => void decideCurrentObject("accepted")}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "none",
            background: canAccept ? "rgb(67, 67, 67)" : "rgba(67, 67, 67, 0.4)",
            color: canAccept ? "rgb(255, 255, 255)" : "rgb(120, 120, 120)",
            cursor: canAccept ? "pointer" : isDeciding ? "progress" : "not-allowed",
          }}
        >
          accept
        </button>
      </div>
    </div>
  );
}
