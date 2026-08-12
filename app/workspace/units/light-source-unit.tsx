import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { ParameterSliderY, ParameterSliderXPlusMinus } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import {
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  updateLightSource,
} from "../workspace.server";
import {
  getDynamicUnitSizes,
  MIN_LIMIT_FACTOR,
  CAPTURE_DARKNESS_MAX,
  CAPTURE_FALLOFF_MAX,
  CAPTURE_INTENSITY_MAX,
  CAPTURE_SIZE_MAX,
} from "../workspace.config";
import {
  MAX_MASK_PEAK_ELEVATION,
  MAX_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_RADIUS_PX,
} from "../mask-gl";
import { nearestNavigableIndex, useCarouselIndex } from "../hooks/useCarouselIndex";
import { carouselEntryMathKey, maskCaptureInputId, maskPeakInputId } from "../effects-utils";
import LightSourceUnitbar from "./bars/light-source-unitbar";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";
import { dmSans } from "../../fonts";

// Which flavor of light_source equation this unit is currently editing. Not state and not
// persisted -- it's read off whichever carousel entry the display is showing, and "switching" it
// (double-clicking the unitbar's own target button, the same gesture Lightsourcebar's icon uses
// for the identical split) means moving the display to an entry of the other flavor.
//
// "capture": the original four dials, ramping a mask capture's own epicenter/glow from that
// capture's own starting appearance -- Capture_V1_0's persisted size/intensity/falloff/darkness,
// the same fields Lightsourcebar's "capture" dials edit (see newEquationSeed below). "peak":
// elevation/radius/falloff, ramping one topology peak's own relief from the starting shape
// Lightsourcebar's peak dials edit. The two are separate equations under separate input_ids (see
// maskCaptureInputId/maskPeakInputId), not two views of one -- which is exactly why the flavor
// can be read off the entry: an entry is a capture or a peak, and that settles which equation
// there is to edit.
export type LightSourceUnitTarget = "capture" | "peak";

export interface LightSourceUnitControls {
  capture_size: number;
  capture_intensity: number;
  capture_falloff: number;
  capture_darkness: number;
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  time: number;
  loop: LaurusLoopType;
  limit_factor: number;
}

export const defaultLightSourceEquation: LaurusLightSourceEquation = {
  input_id: "",
  time: 0.000001,
  loop: LaurusLoopType.none,
  solution: [],
  capture_size: 0,
  capture_intensity: 0,
  capture_falloff: 0,
  capture_darkness: 0,
  peak_elevation: 0,
  peak_radius: 0,
  // The authoring floor, not PEAK_FALLOFF_DEFAULT -- that's the *schema's* default (what a peak
  // persisted before falloff existed gets backfilled with), and its slider position doesn't mean
  // anything here: this struct is only ever a fallback for whichever of these three fields
  // newEquationSeed doesn't overwrite with the peak's own current shape (see its own comment).
  // With no active peak to fall back to (capture mode, or the carousel on an entry with none),
  // this is what makes an equation-less falloff slider land at the very bottom of its track rather
  // than the schema default's own position partway up it -- the same "untouched" bottom the 0s
  // above give radius and elevation.
  peak_falloff: MIN_MASK_PEAK_FALLOFF,
  limit_factor: MIN_LIMIT_FACTOR,
};

// A light source is exclusively a capture's or a peak's own effect (see carouselEntryKey below) --
// passed to useCarouselIndex and UnitDisplay so every index either derives stays on entries this
// effect can wire at all, rather than landing on an "img"/"svg"/whole-"mask" entry and only getting
// corrected once the user next navigates.
//
// Deliberately *both* flavors rather than one at a time. The unit's target isn't a mode the
// carousel is filtered by -- it's read back off whichever entry the carousel is showing (see
// `target` below), so activating a peak on the canvas can pull this unit's display straight onto
// that peak, exactly the way activating a capture pulls it onto that capture, with the sliders
// following. Filtering by the current target instead would have the carousel refuse to travel to
// the very thing that was just activated.
const isLightSourceCarouselEntry = (entry: CarouselEntry) => entry.type === "capture" || entry.type === "peak";
const isCaptureCarouselEntry = (entry: CarouselEntry) => entry.type === "capture";
const isPeakCarouselEntry = (entry: CarouselEntry) => entry.type === "peak";

interface LightSourceUnit {
  lightSource: LaurusLightSourceResult;
  carouselIndexInit: number;
}
export default function LightSourceUnit({ lightSource, carouselIndexInit }: LightSourceUnit) {
  const {
    coreState,
    dispatch,
    notifyMaskActiveElementChanged,
    notifyMaskActiveCaptureChanged,
    notifyMaskActivePeakChanged,
  } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    lightSource.light_source_id,
    isLightSourceCarouselEntry,
  );
  // Whatever the display is showing is what this unit is editing -- the target is read off that
  // entry, never held separately. That's what keeps the sliders honest in every case they can get
  // out of step otherwise: a peak the carousel was pointed at by EffectUnit's own "first entry this
  // effect has math for" pick opens showing that math (its flavor comes along for free), and a peak
  // activated on the canvas pulls the display -- and so these sliders -- onto itself. Neither has to
  // be the active element for its math to show; activating is only how the display gets *moved*.
  const target: LightSourceUnitTarget = uiState.carouselEntries[carouselIndex]?.type === "peak" ? "peak" : "capture";
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<LightSourceUnitControls>({
    capture_size: 0,
    capture_intensity: 0,
    capture_falloff: 0,
    capture_darkness: 0,
    peak_elevation: defaultLightSourceEquation.peak_elevation,
    peak_radius: defaultLightSourceEquation.peak_radius,
    peak_falloff: defaultLightSourceEquation.peak_falloff,
    time: 0.000001,
    loop: defaultLightSourceEquation.loop,
    limit_factor: defaultLightSourceEquation.limit_factor,
  });
  const [dynamicSizes] = useState(() => {
    const ds = getDynamicUnitSizes(uiState.resolution);
    // The elevation slider's own sizing -- "peak" mode's main control sits below the parameter box
    // the way move/rotate's dial does, but it's a signed ± track (see the elevation param below),
    // so it takes ParameterSliderXPlusMinus's own size shape rather than a dial's. Modeled on
    // scale-unit.tsx's scaleParam/scaleParamDisplay, which is the same control in the same slot.
    switch (uiState.resolution.type) {
      case "high":
        return {
          ...ds,
          peakParam: {
            capWidth: 21,
            capHeight: 21,
            capBorderOffset: 0,
            containerWidth: 280,
            containerHeight: 38,
            trackHeight: 1,
            tickHeight: 28,
            tickLeft: 1,
            svgSize: { width: 24, height: 24 },
          },
          peakParamDisplay: { padding: 15, fontSize: 14, letterSpacing: 2, gap: 6 },
        };
      case "midhigh":
        return {
          ...ds,
          peakParam: {
            capWidth: 15,
            capHeight: 15,
            capBorderOffset: 0,
            containerWidth: 170,
            containerHeight: 36,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
          },
          peakParamDisplay: { padding: 11, fontSize: 11, letterSpacing: 2, gap: 4 },
        };
      case "midlow":
      case "low":
        return {
          ...ds,
          peakParam: {
            capWidth: 13,
            capHeight: 13,
            capBorderOffset: 0,
            containerWidth: 160,
            containerHeight: 20,
            trackHeight: 1,
            tickHeight: 16,
            tickLeft: 1,
            svgSize: { width: 16, height: 16 },
          },
          peakParamDisplay: { padding: 8, fontSize: 9, letterSpacing: 1, gap: 4 },
        };
    }
  });
  // The equation the display is currently pointed at -- whichever entry that is, whether or not
  // it's the active element. A light source is exclusively a capture's or a peak's own effect, so
  // an "img"/"svg" entry, or a whole mask (CarouselEntry's "mask" variant, wireable to
  // move/scale/rotate instead), has neither an epicenter/glow nor a relief of its own for one to
  // drive and resolves to no key at all -- which is also the "" every editing path guards on.
  const carouselEntryKey = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return "";
    const carouselEntry = uiState.carouselEntries[carouselIndex];
    const maskKey = coreState.project.masks.entries().find((m) => m[0] == carouselEntry.key)?.[0];
    if (!maskKey) return "";
    switch (carouselEntry.type) {
      // Each capture on a mask is its own carousel entry (see CarouselEntry) and needs its own math
      // -- keying purely off the mask's element key would collapse every capture on the same mask
      // onto the same equation. See maskCaptureInputId.
      case "capture":
        return maskCaptureInputId(maskKey, carouselEntry.captureId);
      // Likewise one equation per peak, ramping that peak's own relief. See maskPeakInputId.
      case "peak":
        return maskPeakInputId(maskKey, carouselEntry.peakId);
      default:
        return "";
    }
  }, [uiState.carouselEntries, coreState.project.masks, carouselIndex]);

  // The capture this unit's "capture" target is currently pointed at -- mirrors activePeakEntry
  // below exactly, including reading off the carousel entry rather than uiState.activeElement.
  // Its own persisted size/intensity/falloff/darkness (see Capture_V1_0) is this equation's seed
  // whenever nothing has been dialed in for it yet -- see newEquationSeed below -- and the mesh it
  // lives on is what bounds the size/falloff tracks just below.
  const activeCaptureEntry = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return undefined;
    const entry = uiState.carouselEntries[carouselIndex];
    return entry.type === "capture" ? entry : undefined;
  }, [carouselIndex, uiState.carouselEntries]);
  const activeCaptureMaskData = activeCaptureEntry ? coreState.canvasMasks.get(activeCaptureEntry.key) : undefined;
  const activeCapture = useMemo(() => {
    if (!activeCaptureEntry) return undefined;
    return activeCaptureMaskData?.captures.find((c) => c.id === activeCaptureEntry.captureId);
  }, [activeCaptureEntry, activeCaptureMaskData]);

  // param 1: capture_size
  //
  // A capture's size is a diameter in the mesh's own coordinate space (it's the capture's own
  // geometry, not just a look -- see Capture_V1_0), so this ramp target's ceiling scales with the
  // mask exactly the way peakRadiusMax below does, and the way Lightsourcebar's own capture size
  // slider does. Ramping past the mesh's narrow axis just means owning every triangle.
  const captureSizeMax = activeCaptureMaskData
    ? Math.min(activeCaptureMaskData.width, activeCaptureMaskData.height)
    : CAPTURE_SIZE_MAX;
  const sizeTrackRef = useRef<HTMLDivElement | null>(null);
  const [sizeCursor, setSizeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getSizeValue, getInverseTrackCursor: getSizeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    captureSizeMax,
  );
  const sizeTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.capture_size.toFixed(1)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const sizeRef = useRef<HTMLDivElement | null>(null);

  // param 2: capture_intensity
  const intensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [intensityCursor, setIntensityCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getIntensityValue, getInverseTrackCursor: getIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    CAPTURE_INTENSITY_MAX,
  );
  const intensityTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.capture_intensity.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const intensityRef = useRef<HTMLDivElement | null>(null);

  // param 3: capture_falloff -- mesh-space like the size above, and bounded the same way.
  const captureFalloffMax = activeCaptureMaskData
    ? Math.min(activeCaptureMaskData.width, activeCaptureMaskData.height)
    : CAPTURE_FALLOFF_MAX;
  const falloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [falloffCursor, setFalloffCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getFalloffValue, getInverseTrackCursor: getFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    captureFalloffMax,
  );
  const falloffTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.capture_falloff.toFixed(1)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const falloffRef = useRef<HTMLDivElement | null>(null);

  // param 4: capture_darkness
  const darknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [darknessCursor, setDarknessCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getDarknessValue, getInverseTrackCursor: getDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    CAPTURE_DARKNESS_MAX,
  );
  const darknessTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.capture_darkness.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const darknessRef = useRef<HTMLDivElement | null>(null);

  // The peak this unit's "peak" target is currently pointed at, and the mesh it lives on -- both
  // recovered from the carousel entry rather than uiState.activeElement (which is what
  // Lightsourcebar's own peak dials read): this unit browses peaks with its chevrons, so the entry
  // it's showing is the authority on which peak it edits. Undefined in "capture" mode, and
  // whenever the carousel is on an entry with no peak behind it.
  const activePeakEntry = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return undefined;
    const entry = uiState.carouselEntries[carouselIndex];
    return entry.type === "peak" ? entry : undefined;
  }, [carouselIndex, uiState.carouselEntries]);
  const activePeakMaskData = activePeakEntry ? coreState.canvasMasks.get(activePeakEntry.key) : undefined;
  const activePeak = useMemo(() => {
    if (!activePeakEntry) return undefined;
    return activePeakMaskData?.peaks.find((p) => p.id === activePeakEntry.peakId);
  }, [activePeakEntry, activePeakMaskData]);

  // peak param 1: peak_radius
  //
  // A radius is a length in the mesh's own coordinate space, so its ceiling scales with the mask
  // -- the smaller of the two dimensions, so the largest authorable peak spans the mesh's narrow
  // axis. Floored at MIN_MASK_PEAK_RADIUS_PX (the height field divides by the radius), which is why
  // the track spans the difference and every value read off it adds the floor back. Same
  // arrangement Lightsourcebar's own radius slider uses.
  const peakRadiusMax = activePeakMaskData
    ? Math.max(MIN_MASK_PEAK_RADIUS_PX + 1, Math.min(activePeakMaskData.width, activePeakMaskData.height))
    : MIN_MASK_PEAK_RADIUS_PX + 1;
  const peakRadiusTrackRef = useRef<HTMLDivElement | null>(null);
  const [peakRadiusCursor, setPeakRadiusCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getPeakRadiusValue, getInverseTrackCursor: getPeakRadiusCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    peakRadiusMax - MIN_MASK_PEAK_RADIUS_PX,
  );
  const peakRadiusTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.peak_radius.toFixed(0) + "px"
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const peakRadiusRef = useRef<HTMLDivElement | null>(null);

  // peak param 2: peak_falloff -- the profile exponent, over its own MIN..MAX authoring range (at
  // the low end a peak meets flat mesh with a visible crease ring, at the high end it's a needle).
  // Same floor-plus-span arrangement as the radius above.
  const peakFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [peakFalloffCursor, setPeakFalloffCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getPeakFalloffValue, getInverseTrackCursor: getPeakFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    MAX_MASK_PEAK_FALLOFF - MIN_MASK_PEAK_FALLOFF,
  );
  const peakFalloffTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.peak_falloff.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const peakFalloffRef = useRef<HTMLDivElement | null>(null);

  // peak main param: peak_elevation
  //
  // Signed -- a negative target ramps the peak into a dent -- but useTrackpadState only ever
  // produces 0..maxValue, so the signed range rides on a track twice as long, offset by half: the
  // midpoint is elevation 0, the left half craters and the right half domes. Paired with
  // ParameterSliderXPlusMinus so the -/+ ends of the track read correctly, exactly as
  // Lightsourcebar's own elevation slider does.
  const elevationTrackRef = useRef<HTMLDivElement | null>(null);
  const [elevationCursor, setElevationCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getElevationTrackValue, getTrackCursor: getElevationTrackCursor } = useTrackpadState(
    dynamicSizes.peakParam.capWidth - dynamicSizes.peakParam.capBorderOffset,
    MAX_MASK_PEAK_ELEVATION * 2,
  );
  const getElevationValue = useCallback(
    (cursorX: number, trackWidth: number) => getElevationTrackValue(cursorX, trackWidth, 0) - MAX_MASK_PEAK_ELEVATION,
    [getElevationTrackValue],
  );
  const getElevationCursor = useCallback(
    (value: number, trackWidth: number) => getElevationTrackCursor(value + MAX_MASK_PEAK_ELEVATION, trackWidth),
    [getElevationTrackCursor],
  );
  const elevationTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.peak_elevation.toFixed(0)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const elevationRef = useRef<HTMLDivElement | null>(null);

  // param 5: time
  const timeUpperLimit = useMemo(() => {
    return convertTime(coreState.timelineMaxValue, coreState.timelineUnit, "sec");
  }, [coreState.timelineMaxValue, coreState.timelineUnit]);
  const timeTrackRef = useRef<HTMLDivElement | null>(null);
  const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    timeUpperLimit * (lightSource.math.get(carouselEntryKey)?.limit_factor ?? defaultLightSourceEquation.limit_factor),
  );
  const timeTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? (lightSource.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + "s"
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const timeRef = useRef<HTMLDivElement | null>(null);

  // Makes `carouselEntry` the app's active element, tagged as activated by this unit. Extracted
  // from setActiveElementIfNull below so the target toggle can reuse it -- see toggleTarget.
  const activateEntry = useCallback(
    (carouselEntry: CarouselEntry) => {
      switch (carouselEntry.type) {
        case "svg": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "svg",
            locallyActivatedEffectKey: lightSource.light_source_id,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(newActiveElement.key);
          break;
        }
        case "img": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "img",
            locallyActivatedEffectKey: lightSource.light_source_id,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(newActiveElement.key);
          break;
        }
        case "mask": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "mask",
            locallyActivatedEffectKey: lightSource.light_source_id,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(newActiveElement.key);
          break;
        }
        case "capture": {
          // Must be type "capture" (not "mask") here -- omitting that (as this used to, back when
          // captureId just qualified a "mask"-typed element) leaves useCarouselIndex's own
          // activeIndex lookup falling back to "any entry with this mask key" whenever the active
          // element isn't itself a "capture", i.e. whichever of this mask's captures happens to
          // sit first in the carousel. Since this callback's whole point is to re-anchor the
          // active element on the capture the carousel is *already* showing (carouselIndex),
          // getting this wrong would make this component's own next render silently snap back to
          // a different capture than the one just edited -- see notifyMaskActiveCaptureChanged's
          // sibling call in unit-display.tsx's own setActiveElement, which this mirrors.
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "capture",
            locallyActivatedEffectKey: lightSource.light_source_id,
            captureId: carouselEntry.captureId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(newActiveElement.key);
          notifyMaskActiveCaptureChanged(newActiveElement.key, carouselEntry.captureId);
          break;
        }
        // Mirrors "capture" above, for this unit's "peak" target -- editing a peak's own equation
        // with nothing active should light up the peak being edited, exactly the way editing a
        // capture's does.
        case "peak": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "peak",
            locallyActivatedEffectKey: lightSource.light_source_id,
            peakId: carouselEntry.peakId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(newActiveElement.key);
          notifyMaskActivePeakChanged(newActiveElement.key, carouselEntry.peakId);
          break;
        }
      }
    },
    [
      lightSource.light_source_id,
      notifyMaskActiveCaptureChanged,
      notifyMaskActivePeakChanged,
      uiDispatch,
      notifyMaskActiveElementChanged,
    ],
  );

  const setActiveElementIfNull = useCallback(() => {
    if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
      activateEntry(uiState.carouselEntries[carouselIndex]);
    }
  }, [carouselIndex, uiState.carouselEntries, uiState.activeElement, activateEntry]);

  // Switching target *is* moving the carousel -- the two flavors live on different carousel entries
  // and the target is read back off whichever one is showing, so there's no separate mode to flip.
  // The chevrons already walk both flavors; this is the shortcut past however many entries of the
  // current one sit in between.
  //
  // Prefers an entry of the other flavor this effect already has math for, mirroring EffectUnit's
  // own carouselIndexInit rule ("show me the equation that exists"), and otherwise lands on the
  // nearest one. With no entry of that flavor at all (no peaks drawn yet), nothing moves -- there's
  // genuinely nothing on the other side to show.
  const toggleTarget = useCallback(() => {
    const isNextNavigable = target === "peak" ? isCaptureCarouselEntry : isPeakCarouselEntry;
    const withMathIndex = uiState.carouselEntries.findIndex(
      (entry) => isNextNavigable(entry) && lightSource.math.has(carouselEntryMathKey(entry)),
    );
    const nextIndex =
      withMathIndex > -1
        ? withMathIndex
        : nearestNavigableIndex(uiState.carouselEntries, carouselIndex, isNextNavigable);
    const nextEntry = uiState.carouselEntries[nextIndex];
    // nearestNavigableIndex falls back to the index it was handed when nothing qualifies.
    if (!nextEntry || !isNextNavigable(nextEntry)) return;

    setLocalIndex(nextIndex);
    // While this unit is the one holding the active element, the carousel follows that element
    // rather than the local index (see useCarouselIndex) -- so the jump above would be silently
    // ignored unless the active element moves with it.
    if (uiState.activeElement?.locallyActivatedEffectKey === lightSource.light_source_id) {
      activateEntry(nextEntry);
    }
  }, [
    target,
    carouselIndex,
    uiState.carouselEntries,
    uiState.activeElement,
    lightSource.math,
    lightSource.light_source_id,
    setLocalIndex,
    activateEntry,
  ]);

  const saveNewEquation = useCallback(
    async (rollback: LaurusLightSourceResult, newEquation: LaurusLightSourceEquation) => {
      const newMath: Map<string, LaurusLightSourceEquation> = new Map(rollback.math);
      newMath.set(newEquation.input_id, newEquation);
      const newLightSource: LaurusLightSourceResult = { ...rollback, math: newMath };
      setActiveElementIfNull();
      dispatch({
        type: CoreActionType.SetEffect,
        value: {
          type: "light_source",
          value: { ...newLightSource },
          key: newLightSource.light_source_id,
        },
      });
      const updated = await updateLightSource(coreState.apiOrigin, coreState.accessToken, rollback.light_source_id, {
        ...newLightSource,
      });
      if (!updated) {
        dispatch({
          type: CoreActionType.SetEffect,
          value: {
            type: "light_source",
            value: { ...rollback },
            key: rollback.light_source_id,
          },
        });
      }
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, setActiveElementIfNull],
  );

  const updateTrackpads = useCallback(
    (newControls: LightSourceUnitControls) => {
      if (sizeTrackRef.current) {
        setSizeCursor({ y: getSizeCursor(newControls.capture_size, sizeTrackRef.current.clientHeight), x: 0 });
      }
      if (intensityTrackRef.current) {
        setIntensityCursor({
          y: getIntensityCursor(newControls.capture_intensity, intensityTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (falloffTrackRef.current) {
        setFalloffCursor({
          y: getFalloffCursor(newControls.capture_falloff, falloffTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (darknessTrackRef.current) {
        setDarknessCursor({
          y: getDarknessCursor(newControls.capture_darkness, darknessTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (timeTrackRef.current) {
        setTimeCursor({ y: getTimeCursor(newControls.time, timeTrackRef.current.clientHeight), x: 0 });
      }
      // Only whichever target is currently showing has its tracks mounted (the other set's refs are
      // null), so each of these is a no-op in the other mode -- the layout effect below re-runs on
      // a target switch, once the newly-mounted refs exist, to catch the set that was skipped.
      if (peakRadiusTrackRef.current) {
        setPeakRadiusCursor({
          y: getPeakRadiusCursor(
            newControls.peak_radius - MIN_MASK_PEAK_RADIUS_PX,
            peakRadiusTrackRef.current.clientHeight,
          ),
          x: 0,
        });
      }
      if (peakFalloffTrackRef.current) {
        setPeakFalloffCursor({
          y: getPeakFalloffCursor(
            newControls.peak_falloff - MIN_MASK_PEAK_FALLOFF,
            peakFalloffTrackRef.current.clientHeight,
          ),
          x: 0,
        });
      }
      if (elevationTrackRef.current) {
        setElevationCursor({
          x: getElevationCursor(newControls.peak_elevation, elevationTrackRef.current.clientWidth),
          y: 0,
        });
      }
    },
    [
      getSizeCursor,
      getIntensityCursor,
      getFalloffCursor,
      getDarknessCursor,
      getTimeCursor,
      getPeakRadiusCursor,
      getPeakFalloffCursor,
      getElevationCursor,
    ],
  );

  useLayoutEffect(() => {
    (async () => {
      const activeKey = carouselEntryKey;
      const activeEquation = lightSource.math.get(activeKey);
      const initControls: LightSourceUnitControls = { ...currentControls };
      if (activeEquation) {
        initControls.capture_size = activeEquation.capture_size;
        initControls.capture_intensity = activeEquation.capture_intensity;
        initControls.capture_falloff = activeEquation.capture_falloff;
        initControls.capture_darkness = activeEquation.capture_darkness;
        initControls.peak_elevation = activeEquation.peak_elevation;
        initControls.peak_radius = activeEquation.peak_radius;
        initControls.peak_falloff = activeEquation.peak_falloff;
        initControls.time = activeEquation.time / 1000;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        // Seeded from the capture's own current appearance (mirroring the peak seeding just
        // below) rather than the equation defaults, so an unwired capture's sliders start where
        // its own dials in Lightsourcebar already are (which is also where the server's own ramp
        // would start from -- see resolve_light_source_seed) instead of collapsed at zero/off.
        initControls.capture_size = activeCapture?.size ?? defaultLightSourceEquation.capture_size;
        initControls.capture_intensity = activeCapture?.intensity ?? defaultLightSourceEquation.capture_intensity;
        initControls.capture_falloff = activeCapture?.falloff ?? defaultLightSourceEquation.capture_falloff;
        initControls.capture_darkness = activeCapture?.darkness ?? defaultLightSourceEquation.capture_darkness;
        // Seeded from the peak's own current shape rather than the equation defaults, so an
        // unwired peak's sliders start where the peak actually is (which is also where the
        // server's own ramp would start from -- see resolve_light_source_seed) instead of
        // collapsed at zero/a degenerate falloff.
        initControls.peak_elevation = activePeak?.elevation ?? defaultLightSourceEquation.peak_elevation;
        initControls.peak_radius = activePeak?.radius ?? defaultLightSourceEquation.peak_radius;
        initControls.peak_falloff = activePeak?.falloff ?? defaultLightSourceEquation.peak_falloff;
        initControls.time = defaultLightSourceEquation.time;
        initControls.loop = defaultLightSourceEquation.loop;
        initControls.limit_factor = defaultLightSourceEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
    // `target` is a dependency even though nothing above reads it: moving between flavors swaps
    // which set of slider tracks is mounted, and updateTrackpads can only position a track that
    // exists (see its own comment). carouselEntryKey covers that move on its own in every case a
    // key resolves, but not between two entries that resolve to none -- so this is belt and braces
    // against the newly-revealed set sitting at whatever cursor it last had.
  }, [
    currentControls,
    carouselEntryKey,
    lightSource.math,
    updateTrackpads,
    coreState.timelineUnit,
    target,
    activePeak,
    activeCapture,
  ]);

  // What a *fresh* equation for whatever the carousel is currently on starts as, before the one
  // field being edited is written over it. Every field of a light_source equation is an absolute
  // target the server ramps *to* (see _ramp_to_target), so leaving the untouched fields at the
  // defaults would make a first drag of, say, the falloff slider also silently target "reset
  // everything else to zero/off" -- the capture or peak would jump on every field, not just the
  // one actually touched. Seeding them from where the capture/peak already is makes an untouched
  // field a no-op ramp, which is what "I only edited one dial" should mean.
  //
  // For a capture that's Capture_V1_0's own persisted size/intensity/falloff/darkness (the same
  // starting appearance Lightsourcebar's "capture" dials edit). For a peak it's the peak's own
  // current shape (elevation/radius/falloff). Neither active -- an "img"/"svg"/whole-"mask" entry,
  // or a carousel with nothing on it yet -- falls back to the plain defaults.
  const newEquationSeed = useMemo((): LaurusLightSourceEquation => {
    if (activePeak) {
      return {
        ...defaultLightSourceEquation,
        peak_elevation: activePeak.elevation,
        peak_radius: activePeak.radius,
        peak_falloff: activePeak.falloff,
      };
    }
    if (activeCapture) {
      return {
        ...defaultLightSourceEquation,
        capture_size: activeCapture.size,
        capture_intensity: activeCapture.intensity,
        capture_falloff: activeCapture.falloff,
        capture_darkness: activeCapture.darkness,
      };
    }
    return defaultLightSourceEquation;
  }, [activePeak, activeCapture]);

  const saveLightSourceField = useCallback(
    (
      field:
        | "capture_size"
        | "capture_intensity"
        | "capture_falloff"
        | "capture_darkness"
        | "peak_elevation"
        | "peak_radius"
        | "peak_falloff",
      newValue: number,
    ) => {
      const activeKey = carouselEntryKey;
      if (!activeKey) return;
      const snapshot: LaurusLightSourceResult = { ...lightSource };
      const activeEquation = snapshot.math.get(activeKey);
      const newEquation: LaurusLightSourceEquation = activeEquation
        ? { ...activeEquation, [field]: newValue }
        : {
            ...newEquationSeed,
            input_id: activeKey,
            [field]: newValue,
          };
      saveNewEquation(snapshot, newEquation);
    },
    [carouselEntryKey, lightSource, saveNewEquation, newEquationSeed],
  );

  return (
    <div
      style={{
        gridTemplateRows: "auto",
        gridTemplateColumns: "min-content auto",
        display: "grid",
        alignItems: "center",
      }}
    >
      {mainControls ? (
        <>
          <UnitDisplay
            carouselIndex={carouselIndex}
            effectKey={lightSource.light_source_id}
            onNewLocalIndex={setLocalIndex}
            isEntryWireable={isLightSourceCarouselEntry}
          />
          <div style={{ display: "grid" }}>
            <div style={{ ...dynamicSizes.param }}>
              <div
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.025)",
                  backgroundColor: "rgba(20, 20, 20, 0.25)",
                  boxShadow: "4px 4px 12px rgba(11, 11, 11, 0.5)",
                  borderRadius: 6,
                  display: "grid",
                  gridTemplateColumns: "auto min-content auto min-content",
                  gridTemplateRows: "auto",
                  height: dynamicSizes.paramButtonContainer.height * 7,
                }}
              >
                <div />
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    ...dynamicSizes.paramFlex,
                  }}
                >
                  {target === "peak" ? (
                    <>
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"radius"}
                        hash={`${lightSource.light_source_id}|peak|p1`}
                        size={dynamicSizes.paramSlider}
                        trackRef={peakRadiusTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={peakRadiusCursor}
                        onNewCursor={(newCursor) => {
                          setPeakRadiusCursor({ ...newCursor, x: 0 });
                          if (!peakRadiusTrackRef.current) return;
                          const newVal =
                            MIN_MASK_PEAK_RADIUS_PX +
                            getPeakRadiusValue(newCursor.y, peakRadiusTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, peak_radius: newVal }));
                          saveLightSourceField("peak_radius", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!peakRadiusTrackRef.current || !peakRadiusRef.current) return;
                          const val =
                            MIN_MASK_PEAK_RADIUS_PX +
                            getPeakRadiusValue(c.y, peakRadiusTrackRef.current.clientHeight, 0);
                          peakRadiusRef.current.innerHTML = val.toFixed(0) + "px";
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={peakRadiusTitle}
                        liveTitleRef={peakRadiusRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"falloff"}
                        hash={`${lightSource.light_source_id}|peak|p2`}
                        size={dynamicSizes.paramSlider}
                        trackRef={peakFalloffTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={peakFalloffCursor}
                        onNewCursor={(newCursor) => {
                          setPeakFalloffCursor({ ...newCursor, x: 0 });
                          if (!peakFalloffTrackRef.current) return;
                          const newVal =
                            MIN_MASK_PEAK_FALLOFF +
                            getPeakFalloffValue(newCursor.y, peakFalloffTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, peak_falloff: newVal }));
                          saveLightSourceField("peak_falloff", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!peakFalloffTrackRef.current || !peakFalloffRef.current) return;
                          const val =
                            MIN_MASK_PEAK_FALLOFF +
                            getPeakFalloffValue(c.y, peakFalloffTrackRef.current.clientHeight, 0);
                          peakFalloffRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={peakFalloffTitle}
                        liveTitleRef={peakFalloffRef}
                      />
                    </>
                  ) : (
                    <>
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"size"}
                        hash={`${lightSource.light_source_id}|p1`}
                        size={dynamicSizes.paramSlider}
                        trackRef={sizeTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={sizeCursor}
                        onNewCursor={(newCursor) => {
                          setSizeCursor({ ...newCursor, x: 0 });
                          if (!sizeTrackRef.current) return;
                          const newVal = getSizeValue(newCursor.y, sizeTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, capture_size: newVal }));
                          saveLightSourceField("capture_size", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!sizeTrackRef.current || !sizeRef.current) return;
                          const val = getSizeValue(c.y, sizeTrackRef.current.clientHeight, 0);
                          sizeRef.current.innerHTML = val.toFixed(1);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={sizeTitle}
                        liveTitleRef={sizeRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"intensity"}
                        hash={`${lightSource.light_source_id}|p2`}
                        size={dynamicSizes.paramSlider}
                        trackRef={intensityTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={intensityCursor}
                        onNewCursor={(newCursor) => {
                          setIntensityCursor({ ...newCursor, x: 0 });
                          if (!intensityTrackRef.current) return;
                          const newVal = getIntensityValue(newCursor.y, intensityTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, capture_intensity: newVal }));
                          saveLightSourceField("capture_intensity", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!intensityTrackRef.current || !intensityRef.current) return;
                          const val = getIntensityValue(c.y, intensityTrackRef.current.clientHeight, 0);
                          intensityRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={intensityTitle}
                        liveTitleRef={intensityRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"falloff"}
                        hash={`${lightSource.light_source_id}|p3`}
                        size={dynamicSizes.paramSlider}
                        trackRef={falloffTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={falloffCursor}
                        onNewCursor={(newCursor) => {
                          setFalloffCursor({ ...newCursor, x: 0 });
                          if (!falloffTrackRef.current) return;
                          const newVal = getFalloffValue(newCursor.y, falloffTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, capture_falloff: newVal }));
                          saveLightSourceField("capture_falloff", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!falloffTrackRef.current || !falloffRef.current) return;
                          const val = getFalloffValue(c.y, falloffTrackRef.current.clientHeight, 0);
                          falloffRef.current.innerHTML = val.toFixed(1);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={falloffTitle}
                        liveTitleRef={falloffRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"darkness"}
                        hash={`${lightSource.light_source_id}|p4`}
                        size={dynamicSizes.paramSlider}
                        trackRef={darknessTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={darknessCursor}
                        onNewCursor={(newCursor) => {
                          setDarknessCursor({ ...newCursor, x: 0 });
                          if (!darknessTrackRef.current) return;
                          const newVal = getDarknessValue(newCursor.y, darknessTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, capture_darkness: newVal }));
                          saveLightSourceField("capture_darkness", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!darknessTrackRef.current || !darknessRef.current) return;
                          const val = getDarknessValue(c.y, darknessTrackRef.current.clientHeight, 0);
                          darknessRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={darknessTitle}
                        liveTitleRef={darknessRef}
                      />
                    </>
                  )}
                  {/* Shared by both targets -- "time" means the same thing either way (how long
                      the ramp to these targets takes), and it's the same field on the same
                      equation, just a different one of the two equations. */}
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"time"}
                    hash={`${lightSource.light_source_id}|p5`}
                    size={dynamicSizes.paramSlider}
                    trackRef={timeTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={timeCursor}
                    onNewCursor={(newCursor) => {
                      setTimeCursor({ ...newCursor, x: 0 });
                      if (!timeTrackRef.current) return;
                      const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight);
                      setCurrentControls((v) => ({ ...v, time: newTime }));
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusLightSourceResult = { ...lightSource };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newServerTime = newTime * 1000;
                        const newEquation: LaurusLightSourceEquation = activeEquation
                          ? { ...activeEquation, time: newServerTime }
                          : {
                              ...newEquationSeed,
                              input_id: activeKey,
                              time: newServerTime,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    onCursorMove={(c) => {
                      if (!timeTrackRef.current || !timeRef.current) return;
                      const val = getTimeValue(c.y, timeTrackRef.current.clientHeight);
                      timeRef.current.innerHTML = val.toFixed(2) + "s";
                    }}
                    disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                    title={timeTitle}
                    liveTitleRef={timeRef}
                  />
                </div>
                <div />
                <LightSourceUnitbar
                  lightSource={lightSource}
                  carouselEntryKey={carouselEntryKey}
                  updateTrackpads={updateTrackpads}
                  saveNewEquation={saveNewEquation}
                  currentControls={currentControls}
                  setCurrentControls={setCurrentControls}
                  target={target}
                  onToggleTarget={toggleTarget}
                  newEquationSeed={newEquationSeed}
                />
              </div>
            </div>
            {/* main control -- "peak" only, in the same slot move/rotate put their dial in. The
                capture target has no single dominant parameter to promote out of the box above;
                elevation is that parameter for a peak (it's what makes a peak a peak, and the one
                that reads as a direction rather than a magnitude). */}
            {target === "peak" && (
              <div style={{ ...dynamicSizes.param }}>
                <div
                  style={{
                    width: "100%",
                    border: "1px solid rgba(255, 255, 255, 0.025)",
                    backgroundColor: "rgba(20, 20, 20, 0.25)",
                    boxShadow: "4px 4px 12px rgba(11, 11, 11, 0.5)",
                    borderRadius: 6,
                    display: "grid",
                    justifyItems: "center",
                    gap: dynamicSizes.peakParamDisplay.gap,
                    padding: dynamicSizes.peakParamDisplay.padding,
                  }}
                >
                  <div
                    className={dmSans.className}
                    ref={elevationRef}
                    style={{
                      color: "rgb(220,220,220)",
                      fontWeight: "bold",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      userSelect: "none",
                      fontSize: dynamicSizes.peakParamDisplay.fontSize,
                      letterSpacing: dynamicSizes.peakParamDisplay.letterSpacing,
                    }}
                  >
                    {elevationTitle ?? "elevation"}
                  </div>
                  <ParameterSliderXPlusMinus
                    resolution={{ ...uiState.resolution }}
                    label={"elevation"}
                    hash={`${lightSource.light_source_id}|peak|main`}
                    size={dynamicSizes.peakParam}
                    containerRef={elevationTrackRef}
                    cursor={elevationCursor}
                    onCursorMove={(c) => {
                      if (!elevationTrackRef.current || !elevationRef.current) return;
                      const val = getElevationValue(c.x, elevationTrackRef.current.clientWidth);
                      elevationRef.current.innerHTML = val.toFixed(0);
                    }}
                    onNewCursor={(newCursor) => {
                      setElevationCursor({ ...newCursor, y: 0 });
                      if (!elevationTrackRef.current) return;
                      const newVal = getElevationValue(newCursor.x, elevationTrackRef.current.clientWidth);
                      setCurrentControls((v) => ({ ...v, peak_elevation: newVal }));
                      saveLightSourceField("peak_elevation", newVal);
                    }}
                    disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                    title={elevationTitle}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <DeepControls />
        </>
      )}
    </div>
  );
}
