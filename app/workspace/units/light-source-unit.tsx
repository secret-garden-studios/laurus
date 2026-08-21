import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, MaskContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { ParameterSliderY, ParameterSliderXPlusMinus } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import {
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  PEAK_BLACK_POINT_DEFAULT,
  toEquationPeakBlackPoint,
  toPeakBlackPoint,
  toPeakBlackPointEquationFields,
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

export type LightSourceUnitTarget = "capture" | "peak";

export interface LightSourceUnitControls {
  capture_size: number;
  capture_intensity: number;
  capture_falloff: number;
  capture_darkness: number;
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  peak_black_point_r: number;
  peak_black_point_g: number;
  peak_black_point_b: number;
  peak_black_point_a: number;
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
  peak_falloff: MIN_MASK_PEAK_FALLOFF,
  ...toPeakBlackPointEquationFields(PEAK_BLACK_POINT_DEFAULT),
  limit_factor: MIN_LIMIT_FACTOR,
};

const MAX_VISIBLE_PARAM_SLIDERS = 4;

const isLightSourceCarouselEntry = (entry: CarouselEntry) => entry.type === "capture" || entry.type === "peak";
const isCaptureCarouselEntry = (entry: CarouselEntry) => entry.type === "capture";
const isPeakCarouselEntry = (entry: CarouselEntry) => entry.type === "peak";

interface LightSourceUnit {
  lightSource: LaurusLightSourceResult;
  carouselIndexInit: number;
}
export default function LightSourceUnit({ lightSource, carouselIndexInit }: LightSourceUnit) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { notifyMaskSelectionChanged, notifyMaskSelectedCaptureChanged, notifyMaskSelectedPeakChanged } =
    useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    lightSource.light_source_id,
    isLightSourceCarouselEntry,
  );
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
    peak_black_point_r: defaultLightSourceEquation.peak_black_point_r,
    peak_black_point_g: defaultLightSourceEquation.peak_black_point_g,
    peak_black_point_b: defaultLightSourceEquation.peak_black_point_b,
    peak_black_point_a: defaultLightSourceEquation.peak_black_point_a,
    time: 0.000001,
    loop: defaultLightSourceEquation.loop,
    limit_factor: defaultLightSourceEquation.limit_factor,
  });
  const [dynamicSizes] = useState(() => {
    const ds = getDynamicUnitSizes(uiState.resolution);
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
  const carouselEntryKey = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return "";
    const carouselEntry = uiState.carouselEntries[carouselIndex];
    const maskKey = coreState.project.masks.entries().find((m) => m[0] == carouselEntry.key)?.[0];
    if (!maskKey) return "";
    switch (carouselEntry.type) {
      case "capture":
        return maskCaptureInputId(maskKey, carouselEntry.captureId);
      case "peak":
        return maskPeakInputId(maskKey, carouselEntry.peakId);
      default:
        return "";
    }
  }, [uiState.carouselEntries, coreState.project.masks, carouselIndex]);

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

  const { getInverseTrackValue: getBlackPointValue, getInverseTrackCursor: getBlackPointCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    1,
  );
  const blackPointRTrackRef = useRef<HTMLDivElement | null>(null);
  const [blackPointRCursor, setBlackPointRCursor] = useState({ x: 0, y: 0 });
  const blackPointRRef = useRef<HTMLDivElement | null>(null);
  const blackPointGTrackRef = useRef<HTMLDivElement | null>(null);
  const [blackPointGCursor, setBlackPointGCursor] = useState({ x: 0, y: 0 });
  const blackPointGRef = useRef<HTMLDivElement | null>(null);
  const blackPointBTrackRef = useRef<HTMLDivElement | null>(null);
  const [blackPointBCursor, setBlackPointBCursor] = useState({ x: 0, y: 0 });
  const blackPointBRef = useRef<HTMLDivElement | null>(null);
  const blackPointATrackRef = useRef<HTMLDivElement | null>(null);
  const [blackPointACursor, setBlackPointACursor] = useState({ x: 0, y: 0 });
  const blackPointARef = useRef<HTMLDivElement | null>(null);
  const blackPointTitles = useMemo(() => {
    const equation = lightSource.math.get(carouselEntryKey);
    if (!equation) return undefined;
    const blackPoint = toEquationPeakBlackPoint(equation);
    return {
      r: blackPoint.r.toFixed(2),
      g: blackPoint.g.toFixed(2),
      b: blackPoint.b.toFixed(2),
      a: blackPoint.a.toFixed(2),
    };
  }, [carouselEntryKey, lightSource.math]);

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
          break;
        }
        case "capture": {
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
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: carouselEntry.key, type: "capture", captureId: carouselEntry.captureId },
          });
          notifyMaskSelectionChanged(newActiveElement.key);
          notifyMaskSelectedCaptureChanged(newActiveElement.key, carouselEntry.captureId);
          notifyMaskSelectedPeakChanged(newActiveElement.key, undefined);
          break;
        }
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
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: carouselEntry.key, type: "peak", peakId: carouselEntry.peakId },
          });
          notifyMaskSelectionChanged(newActiveElement.key);
          notifyMaskSelectedPeakChanged(newActiveElement.key, carouselEntry.peakId);
          notifyMaskSelectedCaptureChanged(newActiveElement.key, undefined);
          break;
        }
      }
    },
    [
      lightSource.light_source_id,
      notifyMaskSelectedCaptureChanged,
      notifyMaskSelectedPeakChanged,
      uiDispatch,
      notifyMaskSelectionChanged,
    ],
  );

  const setActiveElementIfNull = useCallback(() => {
    if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
      activateEntry(uiState.carouselEntries[carouselIndex]);
    }
  }, [carouselIndex, uiState.carouselEntries, uiState.activeElement, activateEntry]);

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
    if (!nextEntry || !isNextNavigable(nextEntry)) return;

    setLocalIndex(nextIndex);
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
      if (blackPointRTrackRef.current) {
        setBlackPointRCursor({
          y: getBlackPointCursor(newControls.peak_black_point_r, blackPointRTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (blackPointGTrackRef.current) {
        setBlackPointGCursor({
          y: getBlackPointCursor(newControls.peak_black_point_g, blackPointGTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (blackPointBTrackRef.current) {
        setBlackPointBCursor({
          y: getBlackPointCursor(newControls.peak_black_point_b, blackPointBTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (blackPointATrackRef.current) {
        setBlackPointACursor({
          y: getBlackPointCursor(newControls.peak_black_point_a, blackPointATrackRef.current.clientHeight),
          x: 0,
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
      getBlackPointCursor,
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
        initControls.peak_black_point_r = activeEquation.peak_black_point_r;
        initControls.peak_black_point_g = activeEquation.peak_black_point_g;
        initControls.peak_black_point_b = activeEquation.peak_black_point_b;
        initControls.peak_black_point_a = activeEquation.peak_black_point_a;
        initControls.time = activeEquation.time / 1000;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.capture_size = defaultLightSourceEquation.capture_size;
        initControls.capture_intensity = defaultLightSourceEquation.capture_intensity;
        initControls.capture_falloff = defaultLightSourceEquation.capture_falloff;
        initControls.capture_darkness = defaultLightSourceEquation.capture_darkness;
        initControls.peak_elevation = defaultLightSourceEquation.peak_elevation;
        initControls.peak_radius = defaultLightSourceEquation.peak_radius;
        initControls.peak_falloff = defaultLightSourceEquation.peak_falloff;
        initControls.peak_black_point_r = defaultLightSourceEquation.peak_black_point_r;
        initControls.peak_black_point_g = defaultLightSourceEquation.peak_black_point_g;
        initControls.peak_black_point_b = defaultLightSourceEquation.peak_black_point_b;
        initControls.peak_black_point_a = defaultLightSourceEquation.peak_black_point_a;
        initControls.time = defaultLightSourceEquation.time;
        initControls.loop = defaultLightSourceEquation.loop;
        initControls.limit_factor = defaultLightSourceEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [currentControls, carouselEntryKey, lightSource.math, updateTrackpads, coreState.timelineUnit, target]);

  const newEquationSeed = useMemo((): LaurusLightSourceEquation => {
    if (activePeak) {
      return {
        ...defaultLightSourceEquation,
        peak_elevation: activePeak.elevation,
        peak_radius: activePeak.radius,
        peak_falloff: activePeak.falloff,
        ...toPeakBlackPointEquationFields(toPeakBlackPoint(activePeak)),
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
        | "peak_falloff"
        | "peak_black_point_r"
        | "peak_black_point_g"
        | "peak_black_point_b"
        | "peak_black_point_a",
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
                    maxWidth:
                      dynamicSizes.paramSlider.containerWidth * MAX_VISIBLE_PARAM_SLIDERS +
                      dynamicSizes.paramFlex.gap * (MAX_VISIBLE_PARAM_SLIDERS - 1) +
                      dynamicSizes.paramFlex.paddingInline * 2,
                    overflowX: "auto",
                    overflowY: "hidden",
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
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"r"}
                        hash={`${lightSource.light_source_id}|peak|black-point-r`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointRTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointRCursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointRCursor({ ...newCursor, x: 0 });
                          if (!blackPointRTrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointRTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, peak_black_point_r: newVal }));
                          saveLightSourceField("peak_black_point_r", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!blackPointRTrackRef.current || !blackPointRRef.current) return;
                          const val = getBlackPointValue(c.y, blackPointRTrackRef.current.clientHeight, 0);
                          blackPointRRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={blackPointTitles?.r}
                        liveTitleRef={blackPointRRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"g"}
                        hash={`${lightSource.light_source_id}|peak|black-point-g`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointGTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointGCursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointGCursor({ ...newCursor, x: 0 });
                          if (!blackPointGTrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointGTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, peak_black_point_g: newVal }));
                          saveLightSourceField("peak_black_point_g", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!blackPointGTrackRef.current || !blackPointGRef.current) return;
                          const val = getBlackPointValue(c.y, blackPointGTrackRef.current.clientHeight, 0);
                          blackPointGRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={blackPointTitles?.g}
                        liveTitleRef={blackPointGRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"b"}
                        hash={`${lightSource.light_source_id}|peak|black-point-b`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointBTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointBCursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointBCursor({ ...newCursor, x: 0 });
                          if (!blackPointBTrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointBTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, peak_black_point_b: newVal }));
                          saveLightSourceField("peak_black_point_b", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!blackPointBTrackRef.current || !blackPointBRef.current) return;
                          const val = getBlackPointValue(c.y, blackPointBTrackRef.current.clientHeight, 0);
                          blackPointBRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={blackPointTitles?.b}
                        liveTitleRef={blackPointBRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"a"}
                        hash={`${lightSource.light_source_id}|peak|black-point-a`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointATrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointACursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointACursor({ ...newCursor, x: 0 });
                          if (!blackPointATrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointATrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, peak_black_point_a: newVal }));
                          saveLightSourceField("peak_black_point_a", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!blackPointATrackRef.current || !blackPointARef.current) return;
                          const val = getBlackPointValue(c.y, blackPointATrackRef.current.clientHeight, 0);
                          blackPointARef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={blackPointTitles?.a}
                        liveTitleRef={blackPointARef}
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
                  <ParameterSliderXPlusMinus
                    resolution={{ ...uiState.resolution }}
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
