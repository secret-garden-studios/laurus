import { CSSProperties, MouseEvent, RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LaurusResolution } from "../landing.boot";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { PointerStyle, Trackpad } from "./trackpad";
import {
  HUE_CEILING,
  LaurusColor,
  LaurusHsv,
  hsvToRgb,
  rgbToCss,
  rgbaToCss,
  resolveHsv,
  toLaurusColor,
} from "./color-utils";

const HUE_TRACK =
  "linear-gradient(to right, rgb(255,0,0) 0%, rgb(255,255,0) 16.66%, rgb(0,255,0) 33.33%," +
  " rgb(0,255,255) 50%, rgb(0,0,255) 66.66%, rgb(255,0,255) 83.33%, rgb(255,0,0) 100%)";

const CHECKERBOARD = {
  backgroundColor: "rgb(150, 150, 150)",
  backgroundImage:
    "linear-gradient(45deg, rgb(90,90,90) 25%, transparent 25%)," +
    " linear-gradient(-45deg, rgb(90,90,90) 25%, transparent 25%)," +
    " linear-gradient(45deg, transparent 75%, rgb(90,90,90) 75%)," +
    " linear-gradient(-45deg, transparent 75%, rgb(90,90,90) 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
};

const planeBackground = (hue: number): string => {
  const pure = hsvToRgb(hue, 1, 1);
  return (
    "linear-gradient(to top, rgb(0,0,0), rgba(0,0,0,0))," +
    ` linear-gradient(to right, rgb(255,255,255), ${rgbToCss(pure.r, pure.g, pure.b)})`
  );
};

const alphaBackground = (rgb: { r: number; g: number; b: number }): string =>
  `linear-gradient(to right, ${rgbaToCss({ ...rgb, a: 0 })}, ${rgbaToCss({ ...rgb, a: 1 })})`;

export interface ColorPickerSize {
  planeHeight: number;
  stripHeight: number;
  capSize: number;
  gap: number;
}

interface ColorPickerProps {
  resolution: LaurusResolution;
  hash: string;
  size: ColorPickerSize;
  color: LaurusColor;
  /** committed on release, the way a slider's onNewCursor saves */
  onNewColor: (color: LaurusColor) => void;
  /** live during a drag, for callers that mirror the value into their own display */
  onColorMove?: (color: LaurusColor) => void;
  disabled?: boolean;
}

export function ColorPicker({ resolution, hash, size, color, onNewColor, onColorMove, disabled }: ColorPickerProps) {
  // the hue a black or grey fill cannot report for itself rides along on the colour, so the picker
  // holds no memory of its own - what it emits is what it will be handed back.
  const hsv: LaurusHsv = resolveHsv(color);
  const alpha = color.a;

  const planeRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const alphaRef = useRef<HTMLDivElement | null>(null);
  const planeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const alphaSurfaceRef = useRef<HTMLDivElement | null>(null);

  const [planeCursor, setPlaneCursor] = useState({ x: 0, y: 0 });
  const [hueCursor, setHueCursor] = useState({ x: 0, y: 0 });
  const [alphaCursor, setAlphaCursor] = useState({ x: 0, y: 0 });

  const { getTrackValue, getTrackCursor, getInverseTrackValue, getInverseTrackCursor } = useTrackpadState(
    size.capSize,
    1,
  );
  const { getTrackValue: getHueValue, getTrackCursor: getHueCursor } = useTrackpadState(size.capSize, 360);

  // cursors follow committed state only. dnd-kit moves a cap by adding the drag's accumulated delta
  // to the position it was handed, so re-deriving that position mid-drag would count the same travel
  // twice and send the cap off the plane. during a drag the cap moves by transform and the handlers
  // below repaint the gradients directly; a caller previewing its own live colour back to us is
  // therefore safe, because this effect declines to act on it until the drag ends.
  const draggingRef = useRef(false);
  useLayoutEffect(() => {
    if (draggingRef.current) return;
    if (planeRef.current) {
      setPlaneCursor({
        x: getTrackCursor(hsv.s, planeRef.current.clientWidth),
        y: getInverseTrackCursor(hsv.v, planeRef.current.clientHeight),
      });
    }
    if (hueRef.current) {
      setHueCursor({ x: getHueCursor(hsv.h, hueRef.current.clientWidth), y: 0 });
    }
    if (alphaRef.current) {
      setAlphaCursor({ x: getTrackCursor(alpha, alphaRef.current.clientWidth), y: 0 });
    }
  }, [hsv.h, hsv.s, hsv.v, alpha, getTrackCursor, getInverseTrackCursor, getHueCursor]);

  const paint = (next: LaurusHsv) => {
    const rgb = hsvToRgb(next.h, next.s, next.v);
    if (planeSurfaceRef.current) {
      planeSurfaceRef.current.style.background = planeBackground(next.h);
    }
    if (alphaSurfaceRef.current) {
      alphaSurfaceRef.current.style.background = alphaBackground(rgb);
    }
  };

  const planeAt = (cursor: { x: number; y: number }): LaurusHsv => {
    if (!planeRef.current) return hsv;
    return {
      h: hsv.h,
      s: getTrackValue(cursor.x, planeRef.current.clientWidth, 0),
      v: getInverseTrackValue(cursor.y, planeRef.current.clientHeight, 0),
    };
  };
  const hueAt = (cursor: { x: number; y: number }): LaurusHsv => {
    if (!hueRef.current) return hsv;
    return { ...hsv, h: Math.min(getHueValue(cursor.x, hueRef.current.clientWidth, 0), HUE_CEILING) };
  };
  const alphaAt = (cursor: { x: number; y: number }): number => {
    if (!alphaRef.current) return alpha;
    return getTrackValue(cursor.x, alphaRef.current.clientWidth, 0);
  };

  const commit = (next: LaurusHsv, nextAlpha: number) => {
    draggingRef.current = false;
    paint(next);
    onNewColor(toLaurusColor(next, nextAlpha));
  };
  const preview = (next: LaurusHsv, nextAlpha: number) => {
    draggingRef.current = true;
    paint(next);
    if (onColorMove) onColorMove(toLaurusColor(next, nextAlpha));
  };

  const jumpTo = (
    e: MouseEvent<HTMLDivElement>,
    ref: RefObject<HTMLDivElement | null>,
    resolve: (cursor: { x: number; y: number }) => void,
  ) => {
    if (disabled || !ref.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    resolve({ x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) });
  };

  const surface = (background: string, extra?: CSSProperties): CSSProperties => ({
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
    borderRadius: 3,
    cursor: disabled ? "" : "crosshair",
    background,
    ...extra,
  });

  const trackpadLayer: CSSProperties = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" };
  const cap = {
    width: size.capSize,
    height: size.capSize,
    pointerStyle: PointerStyle.Blurry,
    zIndex: 2,
    borderColor: "rgba(255, 255, 255, 0.85)",
  };

  return (
    <div style={{ display: "grid", gap: size.gap, width: "100%" }}>
      <div style={{ position: "relative", width: "100%", height: size.planeHeight }}>
        <div style={trackpadLayer}>
          <Trackpad
            resolution={resolution}
            ids={{ contextId: `${hash}|plane|c1`, draggableId: `${hash}|plane|d1` }}
            width={"100%"}
            height={"100%"}
            coarsePointer={cap}
            value={planeCursor}
            onNewValue={(c) => commit(planeAt(c), alpha)}
            onMove={(c) => preview(planeAt(c), alpha)}
            disabled={disabled}
          />
        </div>
        <div
          ref={(node) => {
            planeRef.current = node;
            planeSurfaceRef.current = node;
          }}
          onMouseDown={(e) => jumpTo(e, planeRef, (c) => commit(planeAt(c), alpha))}
          style={surface(planeBackground(hsv.h))}
        />
      </div>

      <div style={{ position: "relative", width: "100%", height: size.stripHeight }}>
        <div style={trackpadLayer}>
          <Trackpad
            resolution={resolution}
            ids={{ contextId: `${hash}|hue|c1`, draggableId: `${hash}|hue|d1` }}
            width={"100%"}
            height={"100%"}
            coarsePointer={cap}
            value={hueCursor}
            onNewValue={(c) => commit(hueAt(c), alpha)}
            onMove={(c) => preview(hueAt(c), alpha)}
            disabled={disabled}
          />
        </div>
        <div
          ref={hueRef}
          onMouseDown={(e) => jumpTo(e, hueRef, (c) => commit(hueAt(c), alpha))}
          style={surface(HUE_TRACK)}
        />
      </div>

      <div style={{ position: "relative", width: "100%", height: size.stripHeight }}>
        <div style={trackpadLayer}>
          <Trackpad
            resolution={resolution}
            ids={{ contextId: `${hash}|alpha|c1`, draggableId: `${hash}|alpha|d1` }}
            width={"100%"}
            height={"100%"}
            coarsePointer={cap}
            value={alphaCursor}
            onNewValue={(c) => commit(hsv, alphaAt(c))}
            onMove={(c) => preview(hsv, alphaAt(c))}
            disabled={disabled}
          />
        </div>
        <div style={{ ...surface("none"), ...CHECKERBOARD, zIndex: 0 }} />
        <div
          ref={(node) => {
            alphaRef.current = node;
            alphaSurfaceRef.current = node;
          }}
          onMouseDown={(e) => jumpTo(e, alphaRef, (c) => commit(hsv, alphaAt(c)))}
          style={surface(alphaBackground(hsvToRgb(hsv.h, hsv.s, hsv.v)))}
        />
      </div>
    </div>
  );
}

interface ColorSwatchProps {
  color: LaurusColor;
  size: number;
  label: string;
}
function ColorSwatch({ color, size, label }: ColorSwatchProps) {
  return (
    <div
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.45)",
        ...CHECKERBOARD,
        backgroundSize: "6px 6px",
        backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
      }}
    >
      <div style={{ width: "100%", height: "100%", background: rgbaToCss(color) }} />
    </div>
  );
}

interface ColorPickerButtonProps {
  resolution: LaurusResolution;
  hash: string;
  size: ColorPickerSize;
  panel: { width: number; padding: number };
  swatchSize: number;
  readoutFontSize: number;
  color: LaurusColor;
  onNewColor: (color: LaurusColor) => void;
  /** live during a drag, for callers that preview the colour somewhere else while it is chosen */
  onColorMove?: (color: LaurusColor) => void;
  /** raised while the panel is up, for callers that need to quieten something behind it */
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}
export function ColorPickerButton({
  resolution,
  hash,
  size,
  panel,
  swatchSize,
  readoutFontSize,
  color,
  onNewColor,
  onColorMove,
  onOpenChange,
  disabled,
}: ColorPickerButtonProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ top: 0, left: 0 });
  // the swatch follows the drag before the parent has committed anything. it must never be handed
  // back to the picker as its colour: the picker derives its cap positions from the colour it is
  // given, and dnd-kit moves a cap by adding the drag's accumulated delta to that position. a
  // colour that moved mid-drag would shift the position the delta is measured from, so every
  // pointermove would count the same travel twice and the cap would race off the plane.
  const [live, setLive] = useState<LaurusColor | null>(null);
  const shown = live ?? color;

  // raised as a subscription rather than alongside each setOpen: this way it also lowers when the
  // control is disabled out from under an open panel, and when the button unmounts entirely -- a
  // caller that quietens something while the panel is up must always get its turn to restore it.
  const visible = open && !disabled;
  useEffect(() => {
    if (!visible || !onOpenChange) return;
    onOpenChange(true);
    return () => onOpenChange(false);
  }, [visible, onOpenChange]);

  const panelHeight = panel.padding * 2 + size.planeHeight + size.stripHeight * 2 + size.gap * 3 + readoutFontSize + 6;

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - panel.width, window.innerWidth - panel.width - 8));
    const below = rect.bottom + 6;
    const top = below + panelHeight > window.innerHeight ? Math.max(8, rect.top - panelHeight - 6) : below;
    setPlacement({ top, left });
  }, [panel.width, panelHeight]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setLive(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return (
    <>
      <div
        ref={anchorRef}
        onClick={() => {
          if (disabled) return;
          place();
          setOpen((v) => !v);
        }}
        style={{ display: "flex", alignItems: "center", cursor: disabled ? "" : "pointer" }}
      >
        <ColorSwatch color={shown} size={swatchSize} label="fill" />
      </div>
      {visible &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: placement.top,
              left: placement.left,
              width: panel.width,
              padding: panel.padding,
              zIndex: 3000,
              display: "grid",
              gap: size.gap,
              borderRadius: 6,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgb(24, 24, 24)",
              boxShadow: "6px 6px 18px rgba(0, 0, 0, 0.6)",
            }}
          >
            <ColorPicker
              resolution={resolution}
              hash={hash}
              size={size}
              color={color}
              onColorMove={(next) => {
                setLive(next);
                if (onColorMove) onColorMove(next);
              }}
              onNewColor={(next) => {
                setLive(next);
                onNewColor(next);
              }}
            />
            <div
              style={{
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: readoutFontSize,
                letterSpacing: 1,
              }}
            >
              {rgbaToCss(shown)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
