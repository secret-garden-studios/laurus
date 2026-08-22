import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { useObjectReview } from "./hooks/useObjectReview";
import { OBJECT_REVIEW_ZOOM_MAX, OBJECT_REVIEW_ZOOM_MIN, Z_INDEX } from "./workspace.config";
import { UIContext } from "./workspace.client";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { ParameterSliderX } from "../components/parameter-slider";

const ZOOM_SLIDER_SIZE = {
  capWidth: 13,
  capHeight: 13,
  capBorderOffset: 0,
  containerWidth: 140,
  containerHeight: 20,
  trackHeight: 1,
  tickHeight: 0,
  tickLeft: 0,
  svgSize: { width: 14, height: 14 },
};

function formatZoom(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "") + "x";
}

export default function ObjectReviewPanel() {
  const descriptionRef = useRef<HTMLInputElement>(null);

  const { uiState } = useContext(UIContext);
  const { review, isDeciding, decideCurrentObject, setZoom, previewZoom, endReview } = useObjectReview();

  const zoomTrackRef = useRef<HTMLDivElement | null>(null);
  const zoomTitleRef = useRef<HTMLDivElement | null>(null);
  const zoomValueRef = useRef<HTMLSpanElement>(null);
  const [zoomCursor, setZoomCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getZoomTrackValue, getTrackCursor: getZoomTrackCursor } = useTrackpadState(
    ZOOM_SLIDER_SIZE.capWidth - ZOOM_SLIDER_SIZE.capBorderOffset,
    OBJECT_REVIEW_ZOOM_MAX - OBJECT_REVIEW_ZOOM_MIN,
  );
  const getZoomValue = useCallback(
    (cursorX: number, trackWidth: number) => getZoomTrackValue(cursorX, trackWidth, 0) + OBJECT_REVIEW_ZOOM_MIN,
    [getZoomTrackValue],
  );
  const getZoomCursor = useCallback(
    (value: number, trackWidth: number) => getZoomTrackCursor(value - OBJECT_REVIEW_ZOOM_MIN, trackWidth),
    [getZoomTrackCursor],
  );

  useLayoutEffect(() => {
    if (!review || !zoomTrackRef.current) return;
    setZoomCursor({ x: getZoomCursor(review.zoom, zoomTrackRef.current.clientWidth), y: 0 });
    if (zoomValueRef.current) zoomValueRef.current.textContent = formatZoom(review.zoom);
  }, [review, getZoomCursor]);

  if (!review) return null;

  const positionInBatch = review.currentIndex - review.batchStart + 1;

  const accept = () => {
    const description = descriptionRef.current?.value.trim() ?? "";
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
        <ParameterSliderX
          resolution={{ ...uiState.resolution }}
          hash={`object-review|${review.maskKey}|zoom`}
          size={ZOOM_SLIDER_SIZE}
          containerRef={zoomTrackRef}
          cursor={zoomCursor}
          onCursorMove={(newCursor) => {
            if (!zoomTrackRef.current) return;
            const value = getZoomValue(newCursor.x, zoomTrackRef.current.clientWidth);
            previewZoom(value);
            if (zoomTitleRef.current) zoomTitleRef.current.innerHTML = formatZoom(value);
            if (zoomValueRef.current) zoomValueRef.current.textContent = formatZoom(value);
          }}
          onNewCursor={(newCursor) => {
            setZoomCursor({ ...newCursor, y: 0 });
            if (!zoomTrackRef.current) return;
            const value = getZoomValue(newCursor.x, zoomTrackRef.current.clientWidth);
            previewZoom(value);
            setZoom(value);
          }}
          title={formatZoom(review.zoom)}
          liveTitleRef={zoomTitleRef}
        />
      </div>
      <input
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
