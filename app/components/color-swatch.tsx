import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LaurusResolution } from "../landing.boot";
import { ParameterSliderX } from "./parameter-slider";
import { useTrackpadState } from "../hooks/useTrackpadState";

/** One colour with an alpha, every channel in 0-1 -- the space a shader uniform wants rather than the
 * 0-255 one a CSS string is written in, so nothing on the path from this control to the GPU has to
 * scale or parse anything. The 0-255 conversion happens in exactly one place: the CSS the preview
 * chip below is painted with.
 *
 * Structural rather than imported from any one caller's own colour type (LaurusPeakBlackPoint, say),
 * which is what keeps this component a generic control instead of a peak-specific one. */
export interface SwatchColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The one place a SwatchColor becomes something CSS can paint. */
export function toCssRgba(color: SwatchColor): string {
  const channel = (value: number) => Math.round(Math.min(Math.max(value, 0), 1) * 255);
  return `rgba(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)}, ${Math.min(Math.max(color.a, 0), 1)})`;
}

/** The size shape ParameterSliderX takes, narrowed to the numeric members this component does its own
 * arithmetic on (a track's value mapping needs a real number for the cap's width -- see
 * useTrackpadState). Callers already pass numbers here; this only says so. */
interface SwatchSliderSize {
  capWidth: number;
  capHeight: number;
  capBorderOffset: number;
  containerWidth: number | string;
  containerHeight: number | string;
  trackHeight: number | string;
  tickHeight: number | string;
  tickLeft: number | string;
  svgSize: { width: number; height: number };
}

interface ColorSwatchProps {
  resolution: LaurusResolution;
  /** Namespaces the four sliders' own Trackpad ids, exactly as it does for a bare ParameterSliderX --
   * so two swatches on screen at once (or one swatch pointed at a different peak) don't share
   * drag state. */
  hash: string;
  size: SwatchSliderSize;
  /** Side length of the clickable chip, in px. */
  chipSize: number;
  value: SwatchColor;
  /** A settled edit, on pointer release -- the one to persist. */
  onChange: (value: SwatchColor) => void;
  /** Every tick of a drag, for callers that can show it live without committing. Optional: with it
   * absent a drag is simply invisible until release. */
  onPreview?: (value: SwatchColor) => void;
  disabled?: boolean;
  title?: string;
}

const CHANNELS = [
  { key: "r", label: "red" },
  { key: "g", label: "green" },
  { key: "b", label: "blue" },
  { key: "a", label: "alpha" },
] as const;

/** A colour chip that opens a small panel of red/green/blue/alpha sliders.
 *
 * The panel is positioned `fixed`, from the chip's own measured rect, rather than absolutely inside
 * whatever mounted it. That is not a style preference: the bars this lives on are short, horizontally
 * scrolling strips (`overflow-x: auto`), and an absolutely positioned child of a scroll container is
 * clipped by it -- the panel would open inside a 38px-tall box and be cut to a sliver. Fixed
 * positioning takes it out of that flow entirely, at the cost of having to re-measure on scroll and
 * resize, which is what the layout effect below does.
 *
 * Built out of ParameterSliderX rather than a native <input type="color"> so the four channels read
 * and behave as the same control every other dial on these bars is, and so alpha is a channel here
 * rather than a separate dial sitting outside the swatch -- for a black point the alpha is the
 * meaningful "how much of this colour at all" axis, not an afterthought.
 */
export function ColorSwatch({
  resolution,
  hash,
  size,
  chipSize,
  value,
  onChange,
  onPreview,
  disabled,
  title,
}: ColorSwatchProps) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | undefined>(undefined);

  // Re-measured on scroll and resize as well as on open, because `fixed` coordinates are viewport
  // coordinates: they are correct only for as long as the chip hasn't moved within the viewport, and
  // the bar this sits on scrolls horizontally. `capture: true` on the scroll listener is what catches
  // that bar's own scrolling -- a scroll event on an inner element doesn't bubble.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = chipRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Closes on a click anywhere outside the panel or the chip. Bound on pointerdown rather than click
  // so releasing a slider drag that happened to travel outside the panel doesn't dismiss it
  // mid-gesture, and skipping the chip itself so its own toggle isn't fought by this closing first.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || chipRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // A disabled swatch can't be left hanging open: the peak it was editing may be the very thing that
  // just got deselected, at which point the panel would sit there driving nothing.
  //
  // Adjusted during render off a remembered previous value rather than in an effect. This is the
  // documented shape for "reset some state when a prop changes" -- React restarts the render
  // immediately with the new state and never commits the stale one, so there is no flash of an open
  // panel over a disabled swatch, and no cascading second render pass the way an effect would cost.
  // Keyed on the *transition* rather than on `disabled` itself so re-enabling doesn't fight the user
  // reopening it.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled) setOpen(false);
  }

  return (
    <>
      <div
        ref={chipRef}
        title={title}
        onClick={() => {
          if (disabled) return;
          setOpen((wasOpen) => !wasOpen);
        }}
        style={{
          width: chipSize,
          height: chipSize,
          borderRadius: 3,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.3 : 1,
          border: `1px solid rgba(255, 255, 255, ${open ? 0.6 : 0.25})`,
          // Painted over a checkerboard so a low alpha reads as transparency rather than as a dark
          // colour -- for a black point at alpha 0 those two look identical otherwise, and they mean
          // very different things (see SwatchColor's own callers).
          backgroundImage: `linear-gradient(${toCssRgba(value)}, ${toCssRgba(value)}),
            linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.25) 75%),
            linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.25) 75%)`,
          backgroundSize: `100% 100%, ${chipSize / 2}px ${chipSize / 2}px, ${chipSize / 2}px ${chipSize / 2}px`,
          backgroundPosition: `0 0, 0 0, ${chipSize / 4}px ${chipSize / 4}px`,
          flexShrink: 0,
        }}
      />
      {open && anchor ? (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: anchor.left,
            // Opens upward: these bars sit at the bottom of the workspace, so anchoring the panel's
            // bottom to the chip's top is the only direction with room.
            //bottom: anchor.bottom + 6,
            top: 6,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            padding: "6px 10px",
            borderRadius: 8,
            backgroundColor: "rgb(40, 40, 40)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.45)",
          }}
        >
          {CHANNELS.map((channel) => (
            <ChannelSlider
              key={channel.key}
              resolution={resolution}
              hash={`${hash}|${channel.key}`}
              size={size}
              label={channel.label}
              channelValue={value[channel.key]}
              onChannelChange={(next) => onChange({ ...value, [channel.key]: next })}
              onChannelPreview={onPreview ? (next) => onPreview({ ...value, [channel.key]: next }) : undefined}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

/** One 0-1 channel row. Its own component purely so each of the four gets its own track ref, cursor
 * state and useTrackpadState instance -- hooks can't be called in a loop, and four hand-rolled copies
 * in the parent is exactly the boilerplate this control exists to keep out of the bars. */
function ChannelSlider({
  resolution,
  hash,
  size,
  label,
  channelValue,
  onChannelChange,
  onChannelPreview,
}: {
  resolution: LaurusResolution;
  hash: string;
  size: SwatchSliderSize;
  label: string;
  channelValue: number;
  onChannelChange: (value: number) => void;
  onChannelPreview?: (value: number) => void;
}) {
  const trackRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  // Every channel is 0-1, so all four share one track mapping.
  const { getTrackValue, getTrackCursor } = useTrackpadState(size.capWidth - size.capBorderOffset, 1);

  // Seeds (and re-seeds) the thumb from the value, the same way every slider on these bars does. No
  // `target`-style extra dep is needed here the way it is in Lightsourcebar: this row only exists
  // while the panel is open, so its ref is populated for its whole life.
  useEffect(() => {
    if (!trackRef.current) return;
    setCursor({ x: getTrackCursor(channelValue, trackRef.current.clientWidth), y: 0 });
  }, [channelValue, getTrackCursor]);

  const readValue = useCallback(
    (cursorX: number) => {
      if (!trackRef.current) return undefined;
      return getTrackValue(cursorX, trackRef.current.clientWidth, 0);
    },
    [getTrackValue],
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, width: 36, opacity: 0.75 }}>{label}</span>
      <ParameterSliderX
        resolution={resolution}
        hash={hash}
        size={size}
        containerRef={trackRef}
        cursor={cursor}
        onCursorMove={
          onChannelPreview
            ? (newCursor) => {
                const next = readValue(newCursor.x);
                if (next !== undefined) onChannelPreview(next);
              }
            : undefined
        }
        onNewCursor={(newCursor) => {
          setCursor({ ...newCursor, y: 0 });
          const next = readValue(newCursor.x);
          if (next !== undefined) onChannelChange(next);
        }}
      />
    </div>
  );
}
