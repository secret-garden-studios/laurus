import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, MaskContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { ParameterSliderY, ParameterSliderXPlusMinus } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import {
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  OBJECT_BLACK_POINT_DEFAULT,
  toEquationObjectBlackPoint,
  toObjectBlackPoint,
  toObjectBlackPointEquationFields,
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
  MAX_MASK_OBJECT_ELEVATION,
  MAX_MASK_OBJECT_FALLOFF,
  MIN_MASK_OBJECT_FALLOFF,
  MIN_MASK_OBJECT_RADIUS_PX,
} from "../mask-gl";
import { nearestNavigableIndex, useCarouselIndex } from "../hooks/useCarouselIndex";
import { carouselEntryMathKey, maskCaptureInputId, maskObjectInputId } from "../effects-utils";
import LightSourceUnitbar from "./bars/light-source-unitbar";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

export type LightSourceUnitTarget = "capture" | "object";

export interface LightSourceUnitControls {
  capture_size: number;
  capture_intensity: number;
  capture_falloff: number;
  capture_darkness: number;
  object_elevation: number;
  object_radius: number;
  object_falloff: number;
  object_black_point_r: number;
  object_black_point_g: number;
  object_black_point_b: number;
  object_black_point_a: number;
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
  object_elevation: 0,
  object_radius: 0,
  object_falloff: MIN_MASK_OBJECT_FALLOFF,
  ...toObjectBlackPointEquationFields(OBJECT_BLACK_POINT_DEFAULT),
  limit_factor: MIN_LIMIT_FACTOR,
};

const MAX_VISIBLE_PARAM_SLIDERS = 4;

const isLightSourceCarouselEntry = (entry: CarouselEntry) => entry.type === "capture" || entry.type === "object";
const isCaptureCarouselEntry = (entry: CarouselEntry) => entry.type === "capture";
const isObjectCarouselEntry = (entry: CarouselEntry) => entry.type === "object";

interface LightSourceUnit {
  lightSource: LaurusLightSourceResult;
  carouselIndexInit: number;
}
export default function LightSourceUnit({ lightSource, carouselIndexInit }: LightSourceUnit) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { notifyMaskSelectionChanged, notifyMaskSelectedCaptureChanged, notifyMaskSelectedObjectChanged } =
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
  const target: LightSourceUnitTarget =
    uiState.carouselEntries[carouselIndex]?.type === "object" ? "object" : "capture";
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<LightSourceUnitControls>({
    capture_size: 0,
    capture_intensity: 0,
    capture_falloff: 0,
    capture_darkness: 0,
    object_elevation: defaultLightSourceEquation.object_elevation,
    object_radius: defaultLightSourceEquation.object_radius,
    object_falloff: defaultLightSourceEquation.object_falloff,
    object_black_point_r: defaultLightSourceEquation.object_black_point_r,
    object_black_point_g: defaultLightSourceEquation.object_black_point_g,
    object_black_point_b: defaultLightSourceEquation.object_black_point_b,
    object_black_point_a: defaultLightSourceEquation.object_black_point_a,
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
          objectParam: {
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
          objectParamDisplay: { padding: 15, fontSize: 14, letterSpacing: 2, gap: 6 },
        };
      case "midhigh":
        return {
          ...ds,
          objectParam: {
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
          objectParamDisplay: { padding: 11, fontSize: 11, letterSpacing: 2, gap: 4 },
        };
      case "midlow":
      case "low":
        return {
          ...ds,
          objectParam: {
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
          objectParamDisplay: { padding: 8, fontSize: 9, letterSpacing: 1, gap: 4 },
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
      case "object":
        return maskObjectInputId(maskKey, carouselEntry.objectId);
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

  const activeObjectEntry = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return undefined;
    const entry = uiState.carouselEntries[carouselIndex];
    return entry.type === "object" ? entry : undefined;
  }, [carouselIndex, uiState.carouselEntries]);
  const activeObjectMaskData = activeObjectEntry ? coreState.canvasMasks.get(activeObjectEntry.key) : undefined;
  const activeObject = useMemo(() => {
    if (!activeObjectEntry) return undefined;
    return activeObjectMaskData?.objects.find((p) => p.id === activeObjectEntry.objectId);
  }, [activeObjectEntry, activeObjectMaskData]);

  const objectRadiusMax = activeObjectMaskData
    ? Math.max(MIN_MASK_OBJECT_RADIUS_PX + 1, Math.min(activeObjectMaskData.width, activeObjectMaskData.height))
    : MIN_MASK_OBJECT_RADIUS_PX + 1;
  const objectRadiusTrackRef = useRef<HTMLDivElement | null>(null);
  const [objectRadiusCursor, setObjectRadiusCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getObjectRadiusValue, getInverseTrackCursor: getObjectRadiusCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    objectRadiusMax - MIN_MASK_OBJECT_RADIUS_PX,
  );
  const objectRadiusTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.object_radius.toFixed(0) + "px"
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const objectRadiusRef = useRef<HTMLDivElement | null>(null);

  const objectFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [objectFalloffCursor, setObjectFalloffCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getObjectFalloffValue, getInverseTrackCursor: getObjectFalloffCursor } =
    useTrackpadState(
      dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
      MAX_MASK_OBJECT_FALLOFF - MIN_MASK_OBJECT_FALLOFF,
    );
  const objectFalloffTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.object_falloff.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const objectFalloffRef = useRef<HTMLDivElement | null>(null);

  const elevationTrackRef = useRef<HTMLDivElement | null>(null);
  const [elevationCursor, setElevationCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getElevationTrackValue, getTrackCursor: getElevationTrackCursor } = useTrackpadState(
    dynamicSizes.objectParam.capWidth - dynamicSizes.objectParam.capBorderOffset,
    MAX_MASK_OBJECT_ELEVATION * 2,
  );
  const getElevationValue = useCallback(
    (cursorX: number, trackWidth: number) => getElevationTrackValue(cursorX, trackWidth, 0) - MAX_MASK_OBJECT_ELEVATION,
    [getElevationTrackValue],
  );
  const getElevationCursor = useCallback(
    (value: number, trackWidth: number) => getElevationTrackCursor(value + MAX_MASK_OBJECT_ELEVATION, trackWidth),
    [getElevationTrackCursor],
  );
  const elevationTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.object_elevation.toFixed(0)
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
    const blackPoint = toEquationObjectBlackPoint(equation);
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
          notifyMaskSelectedObjectChanged(newActiveElement.key, undefined);
          break;
        }
        case "object": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "object",
            locallyActivatedEffectKey: lightSource.light_source_id,
            objectId: carouselEntry.objectId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: carouselEntry.key, type: "object", objectId: carouselEntry.objectId },
          });
          notifyMaskSelectionChanged(newActiveElement.key);
          notifyMaskSelectedObjectChanged(newActiveElement.key, carouselEntry.objectId);
          notifyMaskSelectedCaptureChanged(newActiveElement.key, undefined);
          break;
        }
      }
    },
    [
      lightSource.light_source_id,
      notifyMaskSelectedCaptureChanged,
      notifyMaskSelectedObjectChanged,
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
    const isNextNavigable = target === "object" ? isCaptureCarouselEntry : isObjectCarouselEntry;
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
      if (objectRadiusTrackRef.current) {
        setObjectRadiusCursor({
          y: getObjectRadiusCursor(
            newControls.object_radius - MIN_MASK_OBJECT_RADIUS_PX,
            objectRadiusTrackRef.current.clientHeight,
          ),
          x: 0,
        });
      }
      if (objectFalloffTrackRef.current) {
        setObjectFalloffCursor({
          y: getObjectFalloffCursor(
            newControls.object_falloff - MIN_MASK_OBJECT_FALLOFF,
            objectFalloffTrackRef.current.clientHeight,
          ),
          x: 0,
        });
      }
      if (elevationTrackRef.current) {
        setElevationCursor({
          x: getElevationCursor(newControls.object_elevation, elevationTrackRef.current.clientWidth),
          y: 0,
        });
      }
      if (blackPointRTrackRef.current) {
        setBlackPointRCursor({
          y: getBlackPointCursor(newControls.object_black_point_r, blackPointRTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (blackPointGTrackRef.current) {
        setBlackPointGCursor({
          y: getBlackPointCursor(newControls.object_black_point_g, blackPointGTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (blackPointBTrackRef.current) {
        setBlackPointBCursor({
          y: getBlackPointCursor(newControls.object_black_point_b, blackPointBTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (blackPointATrackRef.current) {
        setBlackPointACursor({
          y: getBlackPointCursor(newControls.object_black_point_a, blackPointATrackRef.current.clientHeight),
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
      getObjectRadiusCursor,
      getObjectFalloffCursor,
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
        initControls.object_elevation = activeEquation.object_elevation;
        initControls.object_radius = activeEquation.object_radius;
        initControls.object_falloff = activeEquation.object_falloff;
        initControls.object_black_point_r = activeEquation.object_black_point_r;
        initControls.object_black_point_g = activeEquation.object_black_point_g;
        initControls.object_black_point_b = activeEquation.object_black_point_b;
        initControls.object_black_point_a = activeEquation.object_black_point_a;
        initControls.time = activeEquation.time / 1000;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.capture_size = defaultLightSourceEquation.capture_size;
        initControls.capture_intensity = defaultLightSourceEquation.capture_intensity;
        initControls.capture_falloff = defaultLightSourceEquation.capture_falloff;
        initControls.capture_darkness = defaultLightSourceEquation.capture_darkness;
        initControls.object_elevation = defaultLightSourceEquation.object_elevation;
        initControls.object_radius = defaultLightSourceEquation.object_radius;
        initControls.object_falloff = defaultLightSourceEquation.object_falloff;
        initControls.object_black_point_r = defaultLightSourceEquation.object_black_point_r;
        initControls.object_black_point_g = defaultLightSourceEquation.object_black_point_g;
        initControls.object_black_point_b = defaultLightSourceEquation.object_black_point_b;
        initControls.object_black_point_a = defaultLightSourceEquation.object_black_point_a;
        initControls.time = defaultLightSourceEquation.time;
        initControls.loop = defaultLightSourceEquation.loop;
        initControls.limit_factor = defaultLightSourceEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [currentControls, carouselEntryKey, lightSource.math, updateTrackpads, coreState.timelineUnit, target]);

  const newEquationSeed = useMemo((): LaurusLightSourceEquation => {
    if (activeObject) {
      return {
        ...defaultLightSourceEquation,
        object_elevation: activeObject.elevation,
        object_radius: activeObject.radius,
        object_falloff: activeObject.falloff,
        ...toObjectBlackPointEquationFields(toObjectBlackPoint(activeObject)),
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
  }, [activeObject, activeCapture]);

  const saveLightSourceField = useCallback(
    (
      field:
        | "capture_size"
        | "capture_intensity"
        | "capture_falloff"
        | "capture_darkness"
        | "object_elevation"
        | "object_radius"
        | "object_falloff"
        | "object_black_point_r"
        | "object_black_point_g"
        | "object_black_point_b"
        | "object_black_point_a",
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
                  {target === "object" ? (
                    <>
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"radius"}
                        hash={`${lightSource.light_source_id}|object|p1`}
                        size={dynamicSizes.paramSlider}
                        trackRef={objectRadiusTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={objectRadiusCursor}
                        onNewCursor={(newCursor) => {
                          setObjectRadiusCursor({ ...newCursor, x: 0 });
                          if (!objectRadiusTrackRef.current) return;
                          const newVal =
                            MIN_MASK_OBJECT_RADIUS_PX +
                            getObjectRadiusValue(newCursor.y, objectRadiusTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, object_radius: newVal }));
                          saveLightSourceField("object_radius", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!objectRadiusTrackRef.current || !objectRadiusRef.current) return;
                          const val =
                            MIN_MASK_OBJECT_RADIUS_PX +
                            getObjectRadiusValue(c.y, objectRadiusTrackRef.current.clientHeight, 0);
                          objectRadiusRef.current.innerHTML = val.toFixed(0) + "px";
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={objectRadiusTitle}
                        liveTitleRef={objectRadiusRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"falloff"}
                        hash={`${lightSource.light_source_id}|object|p2`}
                        size={dynamicSizes.paramSlider}
                        trackRef={objectFalloffTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={objectFalloffCursor}
                        onNewCursor={(newCursor) => {
                          setObjectFalloffCursor({ ...newCursor, x: 0 });
                          if (!objectFalloffTrackRef.current) return;
                          const newVal =
                            MIN_MASK_OBJECT_FALLOFF +
                            getObjectFalloffValue(newCursor.y, objectFalloffTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, object_falloff: newVal }));
                          saveLightSourceField("object_falloff", newVal);
                        }}
                        onCursorMove={(c) => {
                          if (!objectFalloffTrackRef.current || !objectFalloffRef.current) return;
                          const val =
                            MIN_MASK_OBJECT_FALLOFF +
                            getObjectFalloffValue(c.y, objectFalloffTrackRef.current.clientHeight, 0);
                          objectFalloffRef.current.innerHTML = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={objectFalloffTitle}
                        liveTitleRef={objectFalloffRef}
                      />
                      <ParameterSliderY
                        resolution={{ ...uiState.resolution }}
                        label={"r"}
                        hash={`${lightSource.light_source_id}|object|black-point-r`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointRTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointRCursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointRCursor({ ...newCursor, x: 0 });
                          if (!blackPointRTrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointRTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, object_black_point_r: newVal }));
                          saveLightSourceField("object_black_point_r", newVal);
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
                        hash={`${lightSource.light_source_id}|object|black-point-g`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointGTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointGCursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointGCursor({ ...newCursor, x: 0 });
                          if (!blackPointGTrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointGTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, object_black_point_g: newVal }));
                          saveLightSourceField("object_black_point_g", newVal);
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
                        hash={`${lightSource.light_source_id}|object|black-point-b`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointBTrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointBCursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointBCursor({ ...newCursor, x: 0 });
                          if (!blackPointBTrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointBTrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, object_black_point_b: newVal }));
                          saveLightSourceField("object_black_point_b", newVal);
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
                        hash={`${lightSource.light_source_id}|object|black-point-a`}
                        size={dynamicSizes.paramSlider}
                        trackRef={blackPointATrackRef}
                        trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                        cursor={blackPointACursor}
                        onNewCursor={(newCursor) => {
                          setBlackPointACursor({ ...newCursor, x: 0 });
                          if (!blackPointATrackRef.current) return;
                          const newVal = getBlackPointValue(newCursor.y, blackPointATrackRef.current.clientHeight, 0);
                          setCurrentControls((v) => ({ ...v, object_black_point_a: newVal }));
                          saveLightSourceField("object_black_point_a", newVal);
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
            {target === "object" && (
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
                    gap: dynamicSizes.objectParamDisplay.gap,
                    padding: dynamicSizes.objectParamDisplay.padding,
                  }}
                >
                  <ParameterSliderXPlusMinus
                    resolution={{ ...uiState.resolution }}
                    hash={`${lightSource.light_source_id}|object|main`}
                    size={dynamicSizes.objectParam}
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
                      setCurrentControls((v) => ({ ...v, object_elevation: newVal }));
                      saveLightSourceField("object_elevation", newVal);
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
