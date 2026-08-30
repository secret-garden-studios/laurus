import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, MaskContext, UIContext } from "../workspace.client";
import { dellaRespira, dmSans } from "../../fonts";
import { LaurusResolution } from "../../landing.boot";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { usePivotTrackpadState } from "../../hooks/usePivotTrackpadState";
import { ParameterSliderX, ParameterSliderXPlusMinus, ParameterSliderY } from "../../components/parameter-slider";
import { ColorPickerButton } from "../../components/color-picker";
import { LaurusColor } from "../../components/color-utils";
import UnitDisplay, { DeepControls } from "./unit-display";
import {
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  OBJECT_FILL_DEFAULT,
  toEquationObjectFill,
  toObjectFill,
  toObjectFillEquationFields,
  updateLightSource,
} from "../workspace.server";
import { MIN_LIMIT_FACTOR, LIGHT_DARKNESS_MAX, LIGHT_FALLOFF_MAX, LIGHT_INTENSITY_MAX } from "../workspace.config";
import {
  MAX_MASK_OBJECT_ELEVATION,
  MAX_MASK_OBJECT_FALLOFF,
  MIN_MASK_OBJECT_FALLOFF,
  NEUTRAL_MASK_OBJECT_FALLOFF,
  OBJECT_ELEVATION_DEFAULT,
} from "../mask-gl";
import { nearestNavigableIndex, useCarouselIndex } from "../hooks/useCarouselIndex";
import { carouselEntryMathKey, maskLightInputId, maskObjectInputId } from "../effects-utils";
import LightSourceUnitbar from "./bars/light-source-unitbar";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

export type LightSourceUnitTarget = "light" | "object";

export interface LightSourceUnitControls {
  light_intensity: number;
  light_falloff: number;
  light_darkness: number;
  object_elevation: number;
  object_falloff: number;
  object_fill_r: number;
  object_fill_g: number;
  object_fill_b: number;
  object_fill_a: number;
  object_fill_h: number;
  object_fill_s: number;
  time: number;
  loop: LaurusLoopType;
  limit_factor: number;
}

export const defaultLightSourceEquation: LaurusLightSourceEquation = {
  input_id: "",
  time: 0.000001,
  loop: LaurusLoopType.none,
  solution: [],
  light_intensity: 0,
  light_falloff: 0,
  light_darkness: 0,
  object_elevation: 0,
  object_falloff: NEUTRAL_MASK_OBJECT_FALLOFF,
  ...toObjectFillEquationFields(OBJECT_FILL_DEFAULT),
  limit_factor: MIN_LIMIT_FACTOR,
};

type LightParamSize = {
  capWidth: number;
  capHeight: number;
  capBorderOffset: number;
  containerWidth: number;
  containerHeight: number;
  trackHeight: number;
  tickHeight: number;
  tickLeft: number;
  svgSize: { width: number; height: number };
};

type LightParamDisplay = {
  fontSize: number;
  labelFontSize: number;
  letterSpacing: number;
  marginTop: number;
};

interface LightSourceParam {
  resolution: LaurusResolution;
  label: string;
  hash: string;
  size: LightParamSize;
  display: LightParamDisplay;
  containerRef: RefObject<HTMLDivElement | null>;
  valueRef: RefObject<HTMLInputElement | null>;
  cursor: { x: number; y: number };
  onNewCursor: (newCursor: { x: number; y: number }) => void;
  onCursorMove: (newCursor: { x: number; y: number }) => void;
  disabled?: boolean;
  title?: string;
  first?: boolean;
  signed?: boolean;
}
function LightSourceParam({
  resolution,
  label,
  hash,
  size,
  display,
  containerRef,
  valueRef,
  cursor,
  onNewCursor,
  onCursorMove,
  disabled,
  title,
  first,
  signed,
}: LightSourceParam) {
  const Slider = signed ? ParameterSliderXPlusMinus : ParameterSliderX;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginTop: first ? 0 : display.marginTop,
        }}
      >
        <div
          className={dmSans.className}
          style={{
            display: "grid",
            alignContent: "center",
            color: "rgb(220, 220, 220)",
            fontWeight: "bold",
            fontSize: display.labelFontSize,
          }}
        >
          {label}
        </div>
        <input
          className={dellaRespira.className}
          disabled
          ref={valueRef}
          type="text"
          placeholder="0.00"
          style={{
            textAlign: "right",
            background: "none",
            color: "rgba(255, 255, 255, 0.7)",
            border: "none",
            outline: "none",
            display: "inline-block",
            letterSpacing: `${display.letterSpacing}px`,
            fontSize: display.fontSize,
            width: "6ch",
            textShadow: "2px 2px 3px rgba(10,10,10,1)",
          }}
        />
      </div>
      <Slider
        resolution={resolution}
        hash={hash}
        size={size}
        containerRef={containerRef}
        cursor={cursor}
        onNewCursor={onNewCursor}
        onCursorMove={onCursorMove}
        disabled={disabled}
        title={title}
      />
    </>
  );
}

const isLightSourceCarouselEntry = (entry: CarouselEntry) => entry.type === "light" || entry.type === "object";
const isLightCarouselEntry = (entry: CarouselEntry) => entry.type === "light";
const isObjectCarouselEntry = (entry: CarouselEntry) => entry.type === "object";

interface LightSourceUnit {
  lightSource: LaurusLightSourceResult;
  carouselIndexInit: number;
}
export default function LightSourceUnit({ lightSource, carouselIndexInit }: LightSourceUnit) {
  const { coreState, dispatch } = useContext(CoreContext);
  const {
    notifyMaskSelectionChanged,
    notifyMaskSelectedLightChanged,
    notifyMaskSelectedObjectChanged,
    notifyMaskHighlightSuppressed,
  } = useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    lightSource.light_source_id,
    isLightSourceCarouselEntry,
  );
  const target: LightSourceUnitTarget = uiState.carouselEntries[carouselIndex]?.type === "object" ? "object" : "light";
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<LightSourceUnitControls>({
    light_intensity: 0,
    light_falloff: 0,
    light_darkness: 0,
    object_elevation: defaultLightSourceEquation.object_elevation,
    object_falloff: defaultLightSourceEquation.object_falloff,
    object_fill_r: defaultLightSourceEquation.object_fill_r,
    object_fill_g: defaultLightSourceEquation.object_fill_g,
    object_fill_b: defaultLightSourceEquation.object_fill_b,
    object_fill_a: defaultLightSourceEquation.object_fill_a,
    object_fill_h: defaultLightSourceEquation.object_fill_h,
    object_fill_s: defaultLightSourceEquation.object_fill_s,
    time: 0.000001,
    loop: defaultLightSourceEquation.loop,
    limit_factor: defaultLightSourceEquation.limit_factor,
  });
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          param: {
            padding: "0 20px 20px 20px",
          },
          paramFlex: {
            gap: 30,
            padding: "20px 0px 20px 20px",
          },
          paramSlider: {
            containerHeight: "100%",
            containerWidth: 45,
            trackWidth: 1,
            capWidth: 16,
            capHeight: 16,
            capBorderOffset: 0,
          },
          paramButtonContainer: {
            width: 36,
            height: 36,
          },
          lightParam: {
            capWidth: 15,
            capHeight: 15,
            capBorderOffset: 0,
            containerWidth: 280,
            containerHeight: 24,
            trackHeight: 1,
            tickHeight: 22,
            tickLeft: 1,
            svgSize: { width: 18, height: 18 },
          },
          lightParamDisplay: { fontSize: 15, labelFontSize: 12, letterSpacing: 1, marginTop: 6, swatch: 18, gap: 10 },
          colorPicker: { planeHeight: 150, stripHeight: 14, capSize: 14, gap: 8 },
          colorPickerPanel: { width: 250, padding: 10 },
        };
      case "midhigh":
        return {
          param: {
            padding: "0 30px 14px 14px",
          },
          paramFlex: {
            gap: 26,
            padding: "16px 0px 16px 16px",
          },
          paramSlider: {
            containerHeight: "100%",
            containerWidth: 40,
            trackWidth: 1,
            capWidth: 12,
            capHeight: 12,
            capBorderOffset: 0,
          },
          paramButtonContainer: {
            width: 24,
            height: 24,
          },
          lightParam: {
            capWidth: 11,
            capHeight: 11,
            capBorderOffset: 0,
            containerWidth: 150,
            containerHeight: 18,
            trackHeight: 1,
            tickHeight: 13,
            tickLeft: 1,
            svgSize: { width: 14, height: 14 },
          },
          lightParamDisplay: { fontSize: 11, labelFontSize: 10, letterSpacing: 1, marginTop: 2, swatch: 11, gap: 10 },
          colorPicker: { planeHeight: 115, stripHeight: 12, capSize: 12, gap: 6 },
          colorPickerPanel: { width: 195, padding: 8 },
        };
      case "midlow":
      case "low":
        return {
          param: {
            padding: "0 18px 10px 10px",
          },
          paramFlex: {
            gap: 26,
            padding: "16px 0px 16px 16px",
          },
          paramSlider: {
            containerHeight: "100%",
            containerWidth: 20,
            trackWidth: 1,
            capWidth: 10,
            capHeight: 10,
            capBorderOffset: 0,
          },
          paramButtonContainer: {
            width: Math.round(36 * uiState.resolution.factor),
            height: Math.round(36 * uiState.resolution.factor),
          },
          lightParam: {
            capWidth: 10,
            capHeight: 10,
            capBorderOffset: 0,
            containerWidth: 140,
            containerHeight: 16,
            trackHeight: 1,
            tickHeight: 12,
            tickLeft: 1,
            svgSize: { width: 12, height: 12 },
          },
          lightParamDisplay: { fontSize: 9, labelFontSize: 8, letterSpacing: 1, marginTop: 2, swatch: 10, gap: 10 },
          colorPicker: { planeHeight: 100, stripHeight: 10, capSize: 10, gap: 5 },
          colorPickerPanel: { width: 175, padding: 7 },
        };
    }
  });
  const carouselEntryKey = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return "";
    const carouselEntry = uiState.carouselEntries[carouselIndex];
    const maskKey = coreState.project.masks.entries().find((m) => m[0] == carouselEntry.key)?.[0];
    if (!maskKey) return "";
    switch (carouselEntry.type) {
      case "light":
        return maskLightInputId(maskKey, carouselEntry.lightId);
      case "object":
        return maskObjectInputId(maskKey, carouselEntry.objectId);
      default:
        return "";
    }
  }, [uiState.carouselEntries, coreState.project.masks, carouselIndex]);

  const activeLightEntry = useMemo(() => {
    if (carouselIndex >= uiState.carouselEntries.length) return undefined;
    const entry = uiState.carouselEntries[carouselIndex];
    return entry.type === "light" ? entry : undefined;
  }, [carouselIndex, uiState.carouselEntries]);
  const activeLightMaskData = activeLightEntry ? coreState.canvasMasks.get(activeLightEntry.key) : undefined;
  const activeLight = useMemo(() => {
    if (!activeLightEntry) return undefined;
    return activeLightMaskData?.lights.find((c) => c.id === activeLightEntry.lightId);
  }, [activeLightEntry, activeLightMaskData]);

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

  const restingControls = useMemo((): LightSourceUnitControls => {
    const base: LightSourceUnitControls = {
      light_intensity: defaultLightSourceEquation.light_intensity,
      light_falloff: defaultLightSourceEquation.light_falloff,
      light_darkness: defaultLightSourceEquation.light_darkness,
      object_elevation: defaultLightSourceEquation.object_elevation,
      object_falloff: defaultLightSourceEquation.object_falloff,
      object_fill_r: defaultLightSourceEquation.object_fill_r,
      object_fill_g: defaultLightSourceEquation.object_fill_g,
      object_fill_b: defaultLightSourceEquation.object_fill_b,
      object_fill_a: defaultLightSourceEquation.object_fill_a,
      object_fill_h: defaultLightSourceEquation.object_fill_h,
      object_fill_s: defaultLightSourceEquation.object_fill_s,
      time: 0,
      loop: defaultLightSourceEquation.loop,
      limit_factor: defaultLightSourceEquation.limit_factor,
    };
    if (activeObject) {
      return {
        ...base,
        object_elevation: activeObject.elevation,
        object_falloff: activeObject.falloff,
        ...toObjectFillEquationFields(toObjectFill(activeObject)),
      };
    }
    if (activeLight) {
      return {
        ...base,
        light_intensity: activeLight.intensity,
        light_falloff: activeLight.falloff,
        light_darkness: activeLight.darkness,
      };
    }
    return base;
  }, [activeObject, activeLight]);

  const trackOffset = dynamicSizes.lightParam.capWidth - dynamicSizes.lightParam.capBorderOffset;

  const intensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [intensityCursor, setIntensityCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getIntensityValue, getTrackCursor: getIntensityCursor } = useTrackpadState(
    trackOffset,
    LIGHT_INTENSITY_MAX,
  );
  const intensityTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_intensity.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const intensityRef = useRef<HTMLInputElement | null>(null);

  const lightFalloffMax = activeLightMaskData
    ? Math.min(activeLightMaskData.width, activeLightMaskData.height)
    : LIGHT_FALLOFF_MAX;
  const falloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [falloffCursor, setFalloffCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getFalloffValue, getTrackCursor: getFalloffCursor } = useTrackpadState(
    trackOffset,
    lightFalloffMax,
  );
  const falloffTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_falloff.toFixed(1)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const falloffRef = useRef<HTMLInputElement | null>(null);

  const darknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [darknessCursor, setDarknessCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getDarknessValue, getTrackCursor: getDarknessCursor } = useTrackpadState(
    trackOffset,
    LIGHT_DARKNESS_MAX,
  );
  const darknessTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_darkness.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const darknessRef = useRef<HTMLInputElement | null>(null);

  const objectFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [objectFalloffCursor, setObjectFalloffCursor] = useState({ x: 0, y: 0 });
  const { getPivotTrackValue: getObjectFalloffValue, getPivotTrackCursor: getObjectFalloffCursor } =
    usePivotTrackpadState(trackOffset, MIN_MASK_OBJECT_FALLOFF, NEUTRAL_MASK_OBJECT_FALLOFF, MAX_MASK_OBJECT_FALLOFF);
  const objectFalloffTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.object_falloff.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const objectFalloffRef = useRef<HTMLInputElement | null>(null);

  const elevationTrackRef = useRef<HTMLDivElement | null>(null);
  const [elevationCursor, setElevationCursor] = useState({ x: 0, y: 0 });
  const { getPivotTrackValue: getElevationValue, getPivotTrackCursor: getElevationCursor } = usePivotTrackpadState(
    trackOffset,
    -MAX_MASK_OBJECT_ELEVATION,
    OBJECT_ELEVATION_DEFAULT,
    MAX_MASK_OBJECT_ELEVATION,
  );
  const elevationTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.object_elevation.toFixed(0)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const elevationRef = useRef<HTMLInputElement | null>(null);

  const restingFill = useMemo(
    (): LaurusColor => ({
      r: restingControls.object_fill_r,
      g: restingControls.object_fill_g,
      b: restingControls.object_fill_b,
      a: restingControls.object_fill_a,
      h: restingControls.object_fill_h,
      s: restingControls.object_fill_s,
    }),
    [restingControls],
  );
  const fill = useMemo((): LaurusColor => {
    const equation = lightSource.math.get(carouselEntryKey);
    return equation ? toEquationObjectFill(equation) : restingFill;
  }, [carouselEntryKey, lightSource.math, restingFill]);

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
        case "light": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "light",
            locallyActivatedEffectKey: lightSource.light_source_id,
            lightId: carouselEntry.lightId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: carouselEntry.key, type: "light", lightId: carouselEntry.lightId },
          });
          notifyMaskSelectionChanged(newActiveElement.key);
          notifyMaskSelectedLightChanged(newActiveElement.key, carouselEntry.lightId);
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
          notifyMaskSelectedLightChanged(newActiveElement.key, undefined);
          break;
        }
      }
    },
    [
      lightSource.light_source_id,
      notifyMaskSelectedLightChanged,
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
    const isNextNavigable = target === "object" ? isLightCarouselEntry : isObjectCarouselEntry;
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
      if (intensityTrackRef.current) {
        setIntensityCursor({
          x: getIntensityCursor(newControls.light_intensity, intensityTrackRef.current.clientWidth),
          y: 0,
        });
      }
      if (falloffTrackRef.current) {
        setFalloffCursor({
          x: getFalloffCursor(newControls.light_falloff, falloffTrackRef.current.clientWidth),
          y: 0,
        });
      }
      if (darknessTrackRef.current) {
        setDarknessCursor({
          x: getDarknessCursor(newControls.light_darkness, darknessTrackRef.current.clientWidth),
          y: 0,
        });
      }
      if (timeTrackRef.current) {
        setTimeCursor({ y: getTimeCursor(newControls.time, timeTrackRef.current.clientHeight), x: 0 });
      }
      if (objectFalloffTrackRef.current) {
        setObjectFalloffCursor({
          x: getObjectFalloffCursor(newControls.object_falloff, objectFalloffTrackRef.current.clientWidth),
          y: 0,
        });
      }
      if (elevationTrackRef.current) {
        setElevationCursor({
          x: getElevationCursor(newControls.object_elevation, elevationTrackRef.current.clientWidth),
          y: 0,
        });
      }
      if (intensityRef.current) {
        intensityRef.current.value = newControls.light_intensity.toFixed(2);
      }
      if (falloffRef.current) {
        falloffRef.current.value = newControls.light_falloff.toFixed(1);
      }
      if (darknessRef.current) {
        darknessRef.current.value = newControls.light_darkness.toFixed(2);
      }
      if (objectFalloffRef.current) {
        objectFalloffRef.current.value = newControls.object_falloff.toFixed(2);
      }
      if (elevationRef.current) {
        elevationRef.current.value = newControls.object_elevation.toFixed(0);
      }
    },
    [
      getIntensityCursor,
      getFalloffCursor,
      getDarknessCursor,
      getTimeCursor,
      getObjectFalloffCursor,
      getElevationCursor,
    ],
  );

  const newEquationSeed = useMemo((): LaurusLightSourceEquation => {
    return {
      ...defaultLightSourceEquation,
      ...restingControls,
      time: defaultLightSourceEquation.time,
    };
  }, [restingControls]);

  const saveLightSourceFields = useCallback(
    (patch: Partial<LaurusLightSourceEquation>) => {
      const activeKey = carouselEntryKey;
      if (!activeKey) return;
      const snapshot: LaurusLightSourceResult = { ...lightSource };
      const activeEquation = snapshot.math.get(activeKey);
      const newEquation: LaurusLightSourceEquation = activeEquation
        ? { ...activeEquation, ...patch }
        : {
            ...newEquationSeed,
            input_id: activeKey,
            ...patch,
          };
      saveNewEquation(snapshot, newEquation);
    },
    [carouselEntryKey, lightSource, saveNewEquation, newEquationSeed],
  );

  useLayoutEffect(() => {
    (async () => {
      const activeKey = carouselEntryKey;
      const activeEquation = lightSource.math.get(activeKey);
      const initControls: LightSourceUnitControls = { ...currentControls };
      if (activeEquation) {
        initControls.light_intensity = activeEquation.light_intensity;
        initControls.light_falloff = activeEquation.light_falloff;
        initControls.light_darkness = activeEquation.light_darkness;
        initControls.object_elevation = activeEquation.object_elevation;
        initControls.object_falloff = activeEquation.object_falloff;
        initControls.object_fill_r = activeEquation.object_fill_r;
        initControls.object_fill_g = activeEquation.object_fill_g;
        initControls.object_fill_b = activeEquation.object_fill_b;
        initControls.object_fill_a = activeEquation.object_fill_a;
        initControls.object_fill_h = activeEquation.object_fill_h;
        initControls.object_fill_s = activeEquation.object_fill_s;
        initControls.time = activeEquation.time / 1000;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.light_intensity = restingControls.light_intensity;
        initControls.light_falloff = restingControls.light_falloff;
        initControls.light_darkness = restingControls.light_darkness;
        initControls.object_elevation = restingControls.object_elevation;
        initControls.object_falloff = restingControls.object_falloff;
        initControls.object_fill_r = restingControls.object_fill_r;
        initControls.object_fill_g = restingControls.object_fill_g;
        initControls.object_fill_b = restingControls.object_fill_b;
        initControls.object_fill_a = restingControls.object_fill_a;
        initControls.object_fill_h = restingControls.object_fill_h;
        initControls.object_fill_s = restingControls.object_fill_s;
        initControls.time = restingControls.time;
        initControls.loop = restingControls.loop;
        initControls.limit_factor = restingControls.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [
    currentControls,
    restingControls,
    carouselEntryKey,
    lightSource.math,
    updateTrackpads,
    coreState.timelineUnit,
    target,
  ]);

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
                  padding: 0,
                  display: "grid",
                  gridTemplateColumns: "min-content auto min-content auto min-content",
                  gridTemplateRows: "auto",
                  height: dynamicSizes.paramButtonContainer.height * 7,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    overflow: "hidden",
                    ...dynamicSizes.paramFlex,
                  }}
                >
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"time"}
                    hash={`${lightSource.light_source_id}|p1`}
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
                    escapeOverflow={true}
                  />
                </div>
                <div />
                <div
                  style={{
                    display: "grid",
                    alignContent: "center",
                    height: "100%",
                    width: "100%",
                    gap: dynamicSizes.lightParamDisplay.gap,
                  }}
                >
                  {target === "object" ? (
                    <>
                      <LightSourceParam
                        resolution={{ ...uiState.resolution }}
                        label={"elevation"}
                        hash={`${lightSource.light_source_id}|object|p1`}
                        size={dynamicSizes.lightParam}
                        display={dynamicSizes.lightParamDisplay}
                        containerRef={elevationTrackRef}
                        valueRef={elevationRef}
                        cursor={elevationCursor}
                        onNewCursor={(newCursor) => {
                          setElevationCursor({ ...newCursor, y: 0 });
                          if (!elevationTrackRef.current) return;
                          const newVal = getElevationValue(newCursor.x, elevationTrackRef.current.clientWidth);
                          setCurrentControls((v) => ({ ...v, object_elevation: newVal }));
                          saveLightSourceFields({ object_elevation: newVal });
                        }}
                        onCursorMove={(c) => {
                          if (!elevationTrackRef.current || !elevationRef.current) return;
                          const val = getElevationValue(c.x, elevationTrackRef.current.clientWidth);
                          elevationRef.current.value = val.toFixed(0);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={elevationTitle}
                        first
                        signed
                      />
                      <LightSourceParam
                        resolution={{ ...uiState.resolution }}
                        label={"falloff"}
                        hash={`${lightSource.light_source_id}|object|p2`}
                        size={dynamicSizes.lightParam}
                        display={dynamicSizes.lightParamDisplay}
                        containerRef={objectFalloffTrackRef}
                        valueRef={objectFalloffRef}
                        cursor={objectFalloffCursor}
                        onNewCursor={(newCursor) => {
                          setObjectFalloffCursor({ ...newCursor, y: 0 });
                          if (!objectFalloffTrackRef.current) return;
                          const newVal = getObjectFalloffValue(newCursor.x, objectFalloffTrackRef.current.clientWidth);
                          setCurrentControls((v) => ({ ...v, object_falloff: newVal }));
                          saveLightSourceFields({ object_falloff: newVal });
                        }}
                        onCursorMove={(c) => {
                          if (!objectFalloffTrackRef.current || !objectFalloffRef.current) return;
                          const val = getObjectFalloffValue(c.x, objectFalloffTrackRef.current.clientWidth);
                          objectFalloffRef.current.value = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={objectFalloffTitle}
                        signed
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          marginTop: dynamicSizes.lightParamDisplay.marginTop,
                          gap: 16,
                        }}
                      >
                        <div
                          className={dmSans.className}
                          style={{
                            color: "rgb(220, 220, 220)",
                            fontWeight: "bold",
                            fontSize: dynamicSizes.lightParamDisplay.labelFontSize,
                          }}
                        >
                          {"fill"}
                        </div>
                        <ColorPickerButton
                          resolution={{ ...uiState.resolution }}
                          hash={`${lightSource.light_source_id}|object|black-point`}
                          size={dynamicSizes.colorPicker}
                          panel={dynamicSizes.colorPickerPanel}
                          swatchSize={dynamicSizes.lightParamDisplay.swatch}
                          readoutFontSize={dynamicSizes.lightParamDisplay.fontSize}
                          color={fill}
                          onOpenChange={notifyMaskHighlightSuppressed}
                          onNewColor={(color) => {
                            setCurrentControls((v) => ({ ...v, ...toObjectFillEquationFields(color) }));
                            saveLightSourceFields(toObjectFillEquationFields(color));
                          }}
                          disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <LightSourceParam
                        resolution={{ ...uiState.resolution }}
                        label={"intensity"}
                        hash={`${lightSource.light_source_id}|p2`}
                        size={dynamicSizes.lightParam}
                        display={dynamicSizes.lightParamDisplay}
                        containerRef={intensityTrackRef}
                        valueRef={intensityRef}
                        cursor={intensityCursor}
                        onNewCursor={(newCursor) => {
                          setIntensityCursor({ ...newCursor, y: 0 });
                          if (!intensityTrackRef.current) return;
                          const newVal = getIntensityValue(newCursor.x, intensityTrackRef.current.clientWidth, 0);
                          setCurrentControls((v) => ({ ...v, light_intensity: newVal }));
                          saveLightSourceFields({ light_intensity: newVal });
                        }}
                        onCursorMove={(c) => {
                          if (!intensityTrackRef.current || !intensityRef.current) return;
                          const val = getIntensityValue(c.x, intensityTrackRef.current.clientWidth, 0);
                          intensityRef.current.value = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={intensityTitle}
                        first
                      />
                      <LightSourceParam
                        resolution={{ ...uiState.resolution }}
                        label={"falloff"}
                        hash={`${lightSource.light_source_id}|p3`}
                        size={dynamicSizes.lightParam}
                        display={dynamicSizes.lightParamDisplay}
                        containerRef={falloffTrackRef}
                        valueRef={falloffRef}
                        cursor={falloffCursor}
                        onNewCursor={(newCursor) => {
                          setFalloffCursor({ ...newCursor, y: 0 });
                          if (!falloffTrackRef.current) return;
                          const newVal = getFalloffValue(newCursor.x, falloffTrackRef.current.clientWidth, 0);
                          setCurrentControls((v) => ({ ...v, light_falloff: newVal }));
                          saveLightSourceFields({ light_falloff: newVal });
                        }}
                        onCursorMove={(c) => {
                          if (!falloffTrackRef.current || !falloffRef.current) return;
                          const val = getFalloffValue(c.x, falloffTrackRef.current.clientWidth, 0);
                          falloffRef.current.value = val.toFixed(1);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={falloffTitle}
                      />
                      <LightSourceParam
                        resolution={{ ...uiState.resolution }}
                        label={"darkness"}
                        hash={`${lightSource.light_source_id}|p4`}
                        size={dynamicSizes.lightParam}
                        display={dynamicSizes.lightParamDisplay}
                        containerRef={darknessTrackRef}
                        valueRef={darknessRef}
                        cursor={darknessCursor}
                        onNewCursor={(newCursor) => {
                          setDarknessCursor({ ...newCursor, y: 0 });
                          if (!darknessTrackRef.current) return;
                          const newVal = getDarknessValue(newCursor.x, darknessTrackRef.current.clientWidth, 0);
                          setCurrentControls((v) => ({ ...v, light_darkness: newVal }));
                          saveLightSourceFields({ light_darkness: newVal });
                        }}
                        onCursorMove={(c) => {
                          if (!darknessTrackRef.current || !darknessRef.current) return;
                          const val = getDarknessValue(c.x, darknessTrackRef.current.clientWidth, 0);
                          darknessRef.current.value = val.toFixed(2);
                        }}
                        disabled={lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                        title={darknessTitle}
                      />
                    </>
                  )}
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
