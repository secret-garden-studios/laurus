import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { ParameterSliderY } from "../../components/parameter-slider";
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
  LIGHT_SOURCE_DARKNESS_MAX,
  LIGHT_SOURCE_FALLOFF_MAX,
  LIGHT_SOURCE_INTENSITY_MAX,
  LIGHT_SOURCE_SIZE_MAX,
} from "../workspace.config";
import { useCarouselIndex } from "../hooks/useCarouselIndex";
import { maskCaptureInputId } from "../effects-utils";
import LightSourceUnitbar from "./bars/light-source-unitbar";
import { LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

export interface LightSourceUnitControls {
  light_source_size: number;
  light_source_intensity: number;
  light_source_falloff: number;
  light_source_darkness: number;
  time: number;
  loop: LaurusLoopType;
  limit_factor: number;
}

export const defaultLightSourceEquation: LaurusLightSourceEquation = {
  input_id: "",
  time: 0.000001,
  loop: LaurusLoopType.none,
  solution: [],
  light_source_size: 0,
  light_source_intensity: 0,
  light_source_falloff: 0,
  light_source_darkness: 0,
  limit_factor: MIN_LIMIT_FACTOR,
};

interface LightSourceUnit {
  lightSource: LaurusLightSourceResult;
  carouselIndexInit: number;
}
export default function LightSourceUnit({ lightSource, carouselIndexInit }: LightSourceUnit) {
  const { coreState, dispatch, notifyMaskActiveElementChanged, notifyMaskActiveCaptureChanged } =
    useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, localIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    lightSource.light_source_id,
  );
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<LightSourceUnitControls>({
    light_source_size: 0,
    light_source_intensity: 0,
    light_source_falloff: 0,
    light_source_darkness: 0,
    time: 0.000001,
    loop: defaultLightSourceEquation.loop,
    limit_factor: defaultLightSourceEquation.limit_factor,
  });
  const [dynamicSizes] = useState(() => {
    return getDynamicUnitSizes(uiState.resolution);
  });
  const carouselEntryKey = useMemo(() => {
    if (carouselIndex < uiState.carouselEntries.length) {
      const carouselEntry = uiState.carouselEntries[carouselIndex];
      switch (carouselEntry.type) {
        case "svg": {
          return coreState.project.svgs.entries().find((m) => m[0] == carouselEntry.key)?.[0] ?? "";
        }
        case "img": {
          return coreState.project.imgs.entries().find((m) => m[0] == carouselEntry.key)?.[0] ?? "";
        }
        case "mask": {
          const maskKey = coreState.project.masks.entries().find((m) => m[0] == carouselEntry.key)?.[0];
          // Each capture on a mask is its own carousel entry (see CarouselEntry) and needs its own
          // math -- keying purely off the mask's element key would collapse every capture on the
          // same mask onto the same equation. See maskCaptureInputId.
          return maskKey ? maskCaptureInputId(maskKey, carouselEntry.captureId) : "";
        }
      }
    } else {
      return "";
    }
  }, [uiState.carouselEntries, coreState.project.imgs, coreState.project.svgs, coreState.project.masks, carouselIndex]);

  // param 1: light_source_size
  const sizeTrackRef = useRef<HTMLDivElement | null>(null);
  const [sizeCursor, setSizeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getSizeValue, getInverseTrackCursor: getSizeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    LIGHT_SOURCE_SIZE_MAX,
  );
  const sizeTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_source_size.toFixed(1)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const sizeRef = useRef<HTMLDivElement | null>(null);

  // param 2: light_source_intensity
  const intensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [intensityCursor, setIntensityCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getIntensityValue, getInverseTrackCursor: getIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    LIGHT_SOURCE_INTENSITY_MAX,
  );
  const intensityTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_source_intensity.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const intensityRef = useRef<HTMLDivElement | null>(null);

  // param 3: light_source_falloff
  const falloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [falloffCursor, setFalloffCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getFalloffValue, getInverseTrackCursor: getFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    LIGHT_SOURCE_FALLOFF_MAX,
  );
  const falloffTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_source_falloff.toFixed(1)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const falloffRef = useRef<HTMLDivElement | null>(null);

  // param 4: light_source_darkness
  const darknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [darknessCursor, setDarknessCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getDarknessValue, getInverseTrackCursor: getDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    LIGHT_SOURCE_DARKNESS_MAX,
  );
  const darknessTitle = useMemo(() => {
    return lightSource.math.has(carouselEntryKey)
      ? lightSource.math.get(carouselEntryKey)!.light_source_darkness.toFixed(2)
      : undefined;
  }, [carouselEntryKey, lightSource.math]);
  const darknessRef = useRef<HTMLDivElement | null>(null);

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

  const setActiveElementIfNull = useCallback(() => {
    if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
      const carouselEntry = uiState.carouselEntries[carouselIndex];
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
          // activeCaptureId has to travel with the mask key here -- omitting it (as this used to)
          // leaves uiState.activeElement.activeCaptureId undefined, and useCarouselIndex's own
          // activeIndex lookup falls back to "any entry with this mask key" whenever that's
          // unset, i.e. whichever of this mask's captures happens to sit first in the carousel.
          // Since this callback's whole point is to re-anchor the active element on the capture
          // the carousel is *already* showing (carouselIndex), leaving activeCaptureId off would
          // make this component's own next render silently snap back to a different capture than
          // the one just edited -- see notifyMaskActiveCaptureChanged's sibling call in
          // unit-display.tsx's own setActiveElement, which this mirrors.
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "mask",
            locallyActivatedEffectKey: lightSource.light_source_id,
            activeCaptureId: carouselEntry.captureId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          notifyMaskActiveElementChanged(newActiveElement.key);
          notifyMaskActiveCaptureChanged(newActiveElement.key, carouselEntry.captureId);
          break;
        }
      }
    }
  }, [
    carouselIndex,
    uiState.carouselEntries,
    uiState.activeElement,
    lightSource.light_source_id,
    notifyMaskActiveCaptureChanged,
    uiDispatch,
    notifyMaskActiveElementChanged,
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
        setSizeCursor({ y: getSizeCursor(newControls.light_source_size, sizeTrackRef.current.clientHeight), x: 0 });
      }
      if (intensityTrackRef.current) {
        setIntensityCursor({
          y: getIntensityCursor(newControls.light_source_intensity, intensityTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (falloffTrackRef.current) {
        setFalloffCursor({
          y: getFalloffCursor(newControls.light_source_falloff, falloffTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (darknessTrackRef.current) {
        setDarknessCursor({
          y: getDarknessCursor(newControls.light_source_darkness, darknessTrackRef.current.clientHeight),
          x: 0,
        });
      }
      if (timeTrackRef.current) {
        setTimeCursor({ y: getTimeCursor(newControls.time, timeTrackRef.current.clientHeight), x: 0 });
      }
    },
    [getSizeCursor, getIntensityCursor, getFalloffCursor, getDarknessCursor, getTimeCursor],
  );

  useLayoutEffect(() => {
    (async () => {
      const activeKey = carouselEntryKey;
      const activeEquation = lightSource.math.get(activeKey);
      const initControls: LightSourceUnitControls = { ...currentControls };
      if (activeEquation) {
        initControls.light_source_size = activeEquation.light_source_size;
        initControls.light_source_intensity = activeEquation.light_source_intensity;
        initControls.light_source_falloff = activeEquation.light_source_falloff;
        initControls.light_source_darkness = activeEquation.light_source_darkness;
        initControls.time = activeEquation.time / 1000;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.light_source_size = defaultLightSourceEquation.light_source_size;
        initControls.light_source_intensity = defaultLightSourceEquation.light_source_intensity;
        initControls.light_source_falloff = defaultLightSourceEquation.light_source_falloff;
        initControls.light_source_darkness = defaultLightSourceEquation.light_source_darkness;
        initControls.time = defaultLightSourceEquation.time;
        initControls.loop = defaultLightSourceEquation.loop;
        initControls.limit_factor = defaultLightSourceEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [currentControls, carouselEntryKey, lightSource.math, updateTrackpads, coreState.timelineUnit]);

  const saveLightSourceField = useCallback(
    (
      field: "light_source_size" | "light_source_intensity" | "light_source_falloff" | "light_source_darkness",
      newValue: number,
    ) => {
      const activeKey = carouselEntryKey;
      if (!activeKey) return;
      const snapshot: LaurusLightSourceResult = { ...lightSource };
      const activeEquation = snapshot.math.get(activeKey);
      const newEquation: LaurusLightSourceEquation = activeEquation
        ? { ...activeEquation, [field]: newValue }
        : {
            ...defaultLightSourceEquation,
            input_id: activeKey,
            [field]: newValue,
          };
      saveNewEquation(snapshot, newEquation);
    },
    [carouselEntryKey, lightSource, saveNewEquation],
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
            localIndex={localIndex}
            onNewLocalIndex={setLocalIndex}
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
                      setCurrentControls((v) => ({ ...v, light_source_size: newVal }));
                      saveLightSourceField("light_source_size", newVal);
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
                      setCurrentControls((v) => ({ ...v, light_source_intensity: newVal }));
                      saveLightSourceField("light_source_intensity", newVal);
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
                      setCurrentControls((v) => ({ ...v, light_source_falloff: newVal }));
                      saveLightSourceField("light_source_falloff", newVal);
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
                      setCurrentControls((v) => ({ ...v, light_source_darkness: newVal }));
                      saveLightSourceField("light_source_darkness", newVal);
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
                              ...defaultLightSourceEquation,
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
