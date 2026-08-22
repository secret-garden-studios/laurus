import { useRef } from "react";
import { useObjectReview } from "./hooks/useObjectReview";
import { OBJECT_REVIEW_ZOOM_MAX, OBJECT_REVIEW_ZOOM_MIN, OBJECT_REVIEW_ZOOM_STEP, Z_INDEX } from "./workspace.config";

/** Sequential accept/reject review of one mask's edge-detected candidates:
 *  one object on screen at a time, highlighted on the canvas by
 *  project-mask-item.tsx's own objectReviewPreviewRef wiring. Clicking a
 *  triangle on the canvas toggles it into/out of the candidate being
 *  reviewed (see project-mask-item.tsx's onClick short-circuit) -- this
 *  panel only surfaces progress, the description prompt, and the two
 *  decisions themselves. */
export default function ObjectReviewPanel() {
  // The description is read off the input only when a decision is made.
  // Nothing downstream cares about it before then, so it is deliberately
  // uncontrolled: routing it through state meant a dispatch per keystroke,
  // which re-rendered every consumer of the ui context -- every mask on the
  // canvas included -- to show a character in a text box.
  const descriptionRef = useRef<HTMLInputElement>(null);

  const { review, isDeciding, decideCurrentObject, setZoom, endReview } = useObjectReview();

  if (!review) return null;

  const positionInBatch = review.currentIndex - review.batchStart + 1;

  const accept = () => {
    const description = descriptionRef.current?.value.trim() ?? "";
    // Enforced here rather than by disabling the button, which would need the
    // text in state to know whether it is empty.
    if (!description) {
      descriptionRef.current?.focus();
      return;
    }
    void decideCurrentObject("accepted", description);
  };

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgb(160, 160, 160)" }}>
        <span>zoom</span>
        <input
          type="range"
          min={OBJECT_REVIEW_ZOOM_MIN}
          max={OBJECT_REVIEW_ZOOM_MAX}
          step={OBJECT_REVIEW_ZOOM_STEP}
          value={review.zoom}
          onChange={(e) => setZoom(Number(e.currentTarget.value))}
          style={{ flex: 1, accentColor: "rgb(160, 160, 160)" }}
        />
        <span style={{ width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {review.zoom.toFixed(2).replace(/\.?0+$/, "")}x
        </span>
      </div>
      <input
        // Keyed on the candidate so advancing remounts it empty -- the reset
        // an effect would otherwise have to do.
        key={review.currentIndex}
        ref={descriptionRef}
        type="text"
        placeholder="describe this object..."
        defaultValue=""
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Enter") accept();
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
          disabled={isDeciding}
          onClick={accept}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "none",
            background: isDeciding ? "rgba(67, 67, 67, 0.4)" : "rgb(67, 67, 67)",
            color: isDeciding ? "rgb(120, 120, 120)" : "rgb(255, 255, 255)",
            cursor: isDeciding ? "progress" : "pointer",
          }}
        >
          accept
        </button>
      </div>
    </div>
  );
}
