import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { UIContext } from "../workspace.client";
import { useCanvasZoom } from "../hooks/useCanvasZoom";
import { CANVAS_ZOOM_DEFAULT, CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from "../workspace.config";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { ParameterSliderXPlusMinus } from "../../components/parameter-slider";

/* The track is linear in log2 space rather than in the zoom itself, so that
   halving and doubling take up the same amount of travel and 1x lands on the
   middle of the track -- where the tick is drawn. */
const TRACK_SPAN = Math.log2(CANVAS_ZOOM_MAX / CANVAS_ZOOM_MIN);
const TRACK_SNAP = TRACK_SPAN * 0.03;

function zoomFromTrack(value: number): number {
  const centered = value - TRACK_SPAN / 2;
  if (Math.abs(centered) <= TRACK_SNAP) return CANVAS_ZOOM_DEFAULT;
  return CANVAS_ZOOM_MIN * 2 ** value;
}

function trackFromZoom(zoom: number): number {
  return Math.log2(zoom / CANVAS_ZOOM_MIN);
}

function formatZoom(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "") + "x";
}

export default function Zoombar() {
  const { uiState } = useContext(UIContext);
  const { zoom, setZoom, previewZoom } = useCanvasZoom();

  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: { paddingRight: 10 },
          slider: {
            capWidth: 14,
            capHeight: 14,
            capBorderOffset: 0,
            containerWidth: 120,
            containerHeight: 22,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 1,
            svgSize: { width: 24, height: 24 },
          },
        };
      case "midhigh":
        return {
          container: { paddingRight: 5 },
          slider: {
            capWidth: 12,
            capHeight: 12,
            capBorderOffset: 0,
            containerWidth: 100,
            containerHeight: 18,
            trackHeight: 1,
            tickHeight: 16,
            tickLeft: 0,
            svgSize: { width: 12, height: 12 },
          },
        };
      case "low":
      case "midlow":
        return {
          container: { paddingRight: 5 },
          slider: {
            capWidth: 12,
            capHeight: 12,
            capBorderOffset: 0,
            containerWidth: 80,
            containerHeight: 18,
            trackHeight: 1,
            tickHeight: 16,
            tickLeft: 0,
            svgSize: { width: 12, height: 12 },
          },
        };
    }
  });

  const trackRef = useRef<HTMLDivElement | null>(null);
  const liveTitleRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue, getTrackCursor } = useTrackpadState(
    dynamicSizes.slider.capWidth - dynamicSizes.slider.capBorderOffset,
    TRACK_SPAN,
  );
  const getZoomValue = useCallback(
    (cursorX: number, trackWidth: number) => zoomFromTrack(getTrackValue(cursorX, trackWidth, 0)),
    [getTrackValue],
  );
  const getZoomCursor = useCallback(
    (value: number, trackWidth: number) => getTrackCursor(trackFromZoom(value), trackWidth),
    [getTrackCursor],
  );

  useLayoutEffect(() => {
    if (!trackRef.current) return;
    setCursor({ x: getZoomCursor(zoom, trackRef.current.clientWidth), y: 0 });
  }, [zoom, getZoomCursor]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        color: "rgb(160, 160, 160)",
        ...dynamicSizes.container,
      }}
    >
      <ParameterSliderXPlusMinus
        resolution={{ ...uiState.resolution }}
        hash={"titlebar|zoom"}
        size={dynamicSizes.slider}
        containerRef={trackRef}
        cursor={cursor}
        onCursorMove={(newCursor) => {
          if (!trackRef.current) return;
          const value = getZoomValue(newCursor.x, trackRef.current.clientWidth);
          previewZoom(value);
          if (liveTitleRef.current) liveTitleRef.current.innerHTML = formatZoom(value);
        }}
        onNewCursor={(newCursor) => {
          setCursor({ ...newCursor, y: 0 });
          if (!trackRef.current) return;
          const value = getZoomValue(newCursor.x, trackRef.current.clientWidth);
          previewZoom(value);
          setZoom(value);
        }}
        title={formatZoom(zoom)}
        liveTitleRef={liveTitleRef}
      />
    </div>
  );
}
