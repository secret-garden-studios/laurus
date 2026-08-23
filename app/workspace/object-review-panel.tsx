import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { useObjectReview } from "./hooks/useObjectReview";
import { OBJECT_REVIEW_ZOOM_MAX, OBJECT_REVIEW_ZOOM_MIN, Z_INDEX } from "./workspace.config";
import { UIContext } from "./workspace.client";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { ParameterSliderX } from "../components/parameter-slider";
import { SvgRepo, checkCircle, chevronLeft, chevronRight } from "../svg-repo";

const DECISION_COLOR = {
  none: "rgb(67, 67, 67)",
  accepted: "rgb(76, 175, 80)",
  rejected: "rgb(211, 71, 71)",
} as const;

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
  const {
    review,
    isDeciding,
    currentDecision,
    currentDescription,
    isLocked,
    requestRedo,
    decideCurrentObject,
    saveEditedObject,
    goToPreviousCandidate,
    goToNextCandidate,
    setZoom,
    previewZoom,
    endReview,
  } = useObjectReview();

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

  const candidate = review.candidates[review.currentIndex];
  const isEdit = review.mode === "edit";
  const positionInBatch = review.currentIndex - review.batchStart + 1;
  const hasDecision = !isEdit && currentDecision !== undefined;
  const redoRequested = hasDecision && !isLocked;

  const commit = () => {
    const description = descriptionRef.current?.value.trim() ?? "";
    if (!description) {
      descriptionRef.current?.focus();
      return;
    }
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
                svg={positionInBatch <= 1 ? chevronLeft("rgb(67,67,67)") : chevronLeft()}
                containerStyle={{
                  width: 18,
                  height: 18,
                  cursor: positionInBatch <= 1 ? "default" : "pointer",
                }}
                scale={0.75}
                onContainerClick={positionInBatch <= 1 ? undefined : goToPreviousCandidate}
              />
              object {positionInBatch} of {review.batchSize}
              <SvgRepo
                title="next candidate"
                svg={positionInBatch >= review.batchSize ? chevronRight("rgb(67,67,67)") : chevronRight()}
                containerStyle={{
                  width: 18,
                  height: 18,
                  cursor: positionInBatch >= review.batchSize ? "default" : "pointer",
                }}
                scale={0.75}
                onContainerClick={positionInBatch >= review.batchSize ? undefined : goToNextCandidate}
              />
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
          </>
        )}
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgb(160, 160, 160)" }}
      >
        <span>
          {isLocked
            ? "already decided -- highlighted triangles differ from the original"
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
          disabled={isDeciding || isLocked}
          onClick={commit}
          title={!isEdit && isLocked ? "double-click the check mark to make a new decision" : undefined}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 4,
            border: "none",
            background: isDeciding || isLocked ? "rgba(67, 67, 67, 0.4)" : "rgb(67, 67, 67)",
            color: isDeciding || isLocked ? "rgb(120, 120, 120)" : "rgb(255, 255, 255)",
            cursor: isDeciding ? "progress" : isLocked ? "not-allowed" : "pointer",
          }}
        >
          {isEdit ? "save" : "accept"}
        </button>
      </div>
    </div>
  );
}
