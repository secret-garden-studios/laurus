import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { updateMove, LaurusLoopType, LaurusShapeType, LaurusMoveEquation, LaurusMoveResult } from "../workspace.server";
import Dial from "../../components/dial";
import { ParameterSliderY } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import {
  getDynamicUnitSizes,
  MIN_LIMIT_FACTOR,
  MOVE_AMPLITUDE_MAX,
  MOVE_DISTANCE_MAX,
  MOVE_FREQUENCY_MAX,
  MOVE_WAVELENGTH_MAX,
} from "../workspace.config";
import { useCarouselIndex } from "../hooks/useCarouselIndex";
import MoveUnitbar from "./bars/move-unitbar";
import { LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

export interface MoveUnitControls {
  amplitude: number;
  frequency: number;
  wavelength: number;
  distance: number;
  time: number;
  angle: number;
  shape: LaurusShapeType;
  loop: LaurusLoopType;
  limit_factor: number;
}

export const defaultMoveEquation: LaurusMoveEquation = {
  input_id: "",
  time: 0.000001,
  loop: LaurusLoopType.none,
  shape: LaurusShapeType.wave,
  solution: [],
  angle: 0,
  amplitude: 0,
  frequency: 0,
  wavelength: 0,
  distance: 0,
  limit_factor: MIN_LIMIT_FACTOR,
};

interface MoveUnit {
  move: LaurusMoveResult;
  carouselIndexInit: number;
}
export default function MoveUnit({ move, carouselIndexInit }: MoveUnit) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, localIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    move.move_id,
  );
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<MoveUnitControls>({
    ...defaultMoveEquation,
    time: 0,
  });
  const [dynamicSizes] = useState(() => {
    const ds = getDynamicUnitSizes(uiState.resolution);
    switch (uiState.resolution.type) {
      case "high":
        return {
          ...ds,
          angleParam: { padding: 15 },
          angleTitle: {
            top: 10,
            right: 10,
            letterSpacing: 1,
            fontSize: 11,
          },
        };
      case "midhigh":
        return {
          ...ds,
          angleParam: { padding: 11 },
          angleTitle: {
            top: 8,
            right: 8,
            letterSpacing: 1,
            fontSize: 8,
          },
        };
      case "low":
      case "midlow":
        return {
          ...ds,
          angleParam: { padding: 8 },
          angleTitle: {
            top: 8,
            right: 8,
            letterSpacing: 1,
            fontSize: 7,
          },
        };
    }
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
      }
    } else {
      return "";
    }
  }, [uiState.carouselEntries, coreState.project.imgs, coreState.project.svgs, carouselIndex]);

  // param 1
  const amplitudeTrackRef = useRef<HTMLDivElement | null>(null);
  const [amplitudeCursor, setAmplitudeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getAmplitudeValue, getInverseTrackCursor: getAmplitudeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    MOVE_AMPLITUDE_MAX * (move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor),
  );
  const amplitudeTitle = useMemo(() => {
    return move.math.has(carouselEntryKey) ? move.math.get(carouselEntryKey)!.amplitude.toFixed(2) + "px" : undefined;
  }, [carouselEntryKey, move.math]);
  const amplitudeRef = useRef<HTMLDivElement | null>(null);

  // param 2
  const frequencyTrackRef = useRef<HTMLDivElement | null>(null);
  const [frequencyCursor, setFrequencyCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getFrequencyValue, getInverseTrackCursor: getFrequencyCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    MOVE_FREQUENCY_MAX * (move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor),
  );
  const frequencyTitle = useMemo(() => {
    return move.math.has(carouselEntryKey) ? move.math.get(carouselEntryKey)!.frequency.toFixed(2) + "hz" : undefined;
  }, [carouselEntryKey, move.math]);
  const frequencyRef = useRef<HTMLDivElement | null>(null);

  // param 3
  const wavelengthTrackRef = useRef<HTMLDivElement | null>(null);
  const [wavelengthCursor, setWavelengthCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getWavelengthValue, getInverseTrackCursor: getWavelengthCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    MOVE_WAVELENGTH_MAX * (move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor),
  );
  const wavelengthTitle = useMemo(() => {
    return move.math.has(carouselEntryKey) ? move.math.get(carouselEntryKey)!.wavelength.toFixed(2) + "px" : undefined;
  }, [carouselEntryKey, move.math]);
  const wavelengthRef = useRef<HTMLDivElement | null>(null);

  // param 4
  const distanceTrackRef = useRef<HTMLDivElement | null>(null);
  const [distanceCursor, setDistanceCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getDistanceValue, getInverseTrackCursor: getDistanceCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    MOVE_DISTANCE_MAX * (move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor),
  );
  const distanceTitle = useMemo(() => {
    return move.math.has(carouselEntryKey) ? move.math.get(carouselEntryKey)!.distance.toFixed(2) + "px" : undefined;
  }, [carouselEntryKey, move.math]);
  const distanceRef = useRef<HTMLDivElement | null>(null);

  // param 5
  const timeUpperLimit = useMemo(() => {
    return convertTime(coreState.timelineMaxValue, coreState.timelineUnit, "sec");
  }, [coreState.timelineMaxValue, coreState.timelineUnit]);
  const timeTrackRef = useRef<HTMLDivElement | null>(null);
  const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    timeUpperLimit * (move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor),
  );
  const timeTitle = useMemo(() => {
    return move.math.has(carouselEntryKey)
      ? (move.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + "s"
      : undefined;
  }, [carouselEntryKey, move.math]);
  const timeRef = useRef<HTMLDivElement | null>(null);

  // main param
  const [angle, setAngle] = useState(0);
  const angleTitle = useMemo(() => {
    return move.math.has(carouselEntryKey) ? move.math.get(carouselEntryKey)!.angle.toFixed(0) + "°" : undefined;
  }, [carouselEntryKey, move.math]);
  const angleRef = useRef<HTMLDivElement | null>(null);

  const setActiveElementIfNull = useCallback(() => {
    if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
      const carouselEntry = uiState.carouselEntries[carouselIndex];
      switch (carouselEntry.type) {
        case "svg": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "svg",
            locallyActivatedEffectKey: move.move_id,
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
            locallyActivatedEffectKey: move.move_id,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          break;
        }
      }
    }
  }, [carouselIndex, uiState.carouselEntries, uiState.activeElement, move.move_id, uiDispatch]);

  const saveNewEquation = useCallback(
    async (rollback: LaurusMoveResult, newEquation: LaurusMoveEquation) => {
      const newMath: Map<string, LaurusMoveEquation> = new Map(rollback.math);
      newMath.set(newEquation.input_id, newEquation);
      const newMove: LaurusMoveResult = { ...rollback, math: newMath };
      setActiveElementIfNull();
      dispatch({
        type: CoreActionType.SetEffect,
        value: { type: "move", value: { ...newMove }, key: newMove.move_id },
      });
      const updated = await updateMove(coreState.apiOrigin, coreState.accessToken, rollback.move_id, { ...newMove });
      if (!updated) {
        dispatch({
          type: CoreActionType.SetEffect,
          value: {
            type: "move",
            value: { ...rollback },
            key: rollback.move_id,
          },
        });
      }
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, setActiveElementIfNull],
  );

  const updateTrackpads = useCallback(
    (newControls: MoveUnitControls) => {
      setAngle(newControls.angle);
      if (amplitudeTrackRef.current) {
        const newCursor = getAmplitudeCursor(newControls.amplitude, amplitudeTrackRef.current.clientHeight);
        setAmplitudeCursor({ y: newCursor, x: 0 });
      }
      if (frequencyTrackRef.current) {
        const newCursor = getFrequencyCursor(newControls.frequency, frequencyTrackRef.current.clientHeight);
        setFrequencyCursor({ y: newCursor, x: 0 });
      }
      if (wavelengthTrackRef.current) {
        const newCursor = getWavelengthCursor(newControls.wavelength, wavelengthTrackRef.current.clientHeight);
        setWavelengthCursor({ y: newCursor, x: 0 });
      }
      if (distanceTrackRef.current) {
        const newCursor = getDistanceCursor(newControls.distance, distanceTrackRef.current.clientHeight);
        setDistanceCursor({ y: newCursor, x: 0 });
      }
      if (timeTrackRef.current) {
        const newCursor = getTimeCursor(newControls.time, timeTrackRef.current.clientHeight);
        setTimeCursor({ y: newCursor, x: 0 });
      }
    },
    [getAmplitudeCursor, getDistanceCursor, getFrequencyCursor, getTimeCursor, getWavelengthCursor],
  );

  useLayoutEffect(() => {
    (async () => {
      const activeKey = carouselEntryKey;
      const activeEquation = move.math.get(activeKey);
      const initControls: MoveUnitControls = { ...currentControls };
      if (activeEquation) {
        initControls.amplitude = activeEquation.amplitude;
        initControls.frequency = activeEquation.frequency;
        initControls.wavelength = activeEquation.wavelength;
        initControls.distance = activeEquation.distance;
        initControls.time = activeEquation.time / 1000;
        initControls.angle = activeEquation.angle;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.amplitude = defaultMoveEquation.amplitude;
        initControls.frequency = defaultMoveEquation.frequency;
        initControls.wavelength = defaultMoveEquation.wavelength;
        initControls.distance = defaultMoveEquation.distance;
        initControls.time = 0;
        initControls.angle = defaultMoveEquation.angle;
        initControls.loop = defaultMoveEquation.loop;
        initControls.limit_factor = defaultMoveEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [currentControls, carouselEntryKey, move.math, updateTrackpads]);

  const shapeType = useMemo((): LaurusShapeType => {
    return move.math.get(carouselEntryKey)?.shape ?? LaurusShapeType.wave;
  }, [carouselEntryKey, move.math]);

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
            effectKey={move.move_id}
            localIndex={localIndex}
            onNewLocalIndex={setLocalIndex}
          />
          {/* controls */}
          <div style={{ display: "grid" }}>
            {/* parameters */}
            <div style={{ ...dynamicSizes.param }}>
              <div
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.025)",
                  backgroundColor: "rgba(20, 20, 20, 0.25)",
                  boxShadow: "4px 4px 12px rgba(11, 11, 11, 0.5)",
                  borderRadius: 6,
                  padding: 0,
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
                    label={"amplitude"}
                    hash={`${move.move_id}|p1`}
                    size={dynamicSizes.paramSlider}
                    trackRef={amplitudeTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={amplitudeCursor}
                    onNewCursor={(newCursor) => {
                      setAmplitudeCursor({ ...newCursor, x: 0 });
                      if (!amplitudeTrackRef.current) return;
                      const newAmplitude = getAmplitudeValue(newCursor.y, amplitudeTrackRef.current.clientHeight, 0);
                      setCurrentControls((v) => {
                        return { ...v, amplitude: newAmplitude };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation: LaurusMoveEquation = activeEquation
                          ? { ...activeEquation, amplitude: newAmplitude }
                          : {
                              ...defaultMoveEquation,
                              input_id: activeKey,
                              amplitude: newAmplitude,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    onCursorMove={(c) => {
                      if (!amplitudeTrackRef.current || !amplitudeRef.current) return;
                      const val = getAmplitudeValue(c.y, amplitudeTrackRef.current.clientHeight, 0);
                      amplitudeRef.current.innerHTML = val.toFixed(2) + "px";
                    }}
                    disabled={move.locked || isAltKeyPressed}
                    title={amplitudeTitle}
                    liveTitleRef={amplitudeRef}
                  />
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"frequency"}
                    hash={`${move.move_id}|p2`}
                    size={dynamicSizes.paramSlider}
                    trackRef={frequencyTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={frequencyCursor}
                    onNewCursor={(newCursor) => {
                      setFrequencyCursor({ ...newCursor, x: 0 });
                      if (!frequencyTrackRef.current) return;
                      const newFrequency = getFrequencyValue(newCursor.y, frequencyTrackRef.current.clientHeight);
                      setCurrentControls((v) => {
                        return { ...v, frequency: newFrequency };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation: LaurusMoveEquation = activeEquation
                          ? { ...activeEquation, frequency: newFrequency }
                          : {
                              ...defaultMoveEquation,
                              input_id: activeKey,
                              frequency: newFrequency,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    onCursorMove={(c) => {
                      if (!frequencyTrackRef.current || !frequencyRef.current) return;
                      const val = getFrequencyValue(c.y, frequencyTrackRef.current.clientHeight);
                      frequencyRef.current.innerHTML = val.toFixed(2) + "hz";
                    }}
                    disabled={move.locked || isAltKeyPressed}
                    title={frequencyTitle}
                    liveTitleRef={frequencyRef}
                  />
                  {shapeType != LaurusShapeType.circle && shapeType != LaurusShapeType.ellipse && (
                    <ParameterSliderY
                      resolution={{ ...uiState.resolution }}
                      label={"wavelength"}
                      hash={`${move.move_id}|p3`}
                      size={dynamicSizes.paramSlider}
                      trackRef={wavelengthTrackRef}
                      trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                      cursor={wavelengthCursor}
                      onNewCursor={(newCursor) => {
                        setWavelengthCursor({ ...newCursor, x: 0 });
                        if (!wavelengthTrackRef.current) return;
                        const newWavelength = getWavelengthValue(newCursor.y, wavelengthTrackRef.current.clientHeight);
                        setCurrentControls((v) => {
                          return { ...v, wavelength: newWavelength };
                        });
                        const activeKey = carouselEntryKey;
                        if (activeKey) {
                          const snapshot: LaurusMoveResult = { ...move };
                          const activeEquation = snapshot.math.get(activeKey);
                          const newEquation: LaurusMoveEquation = activeEquation
                            ? {
                                ...activeEquation,
                                wavelength: newWavelength,
                              }
                            : {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                wavelength: newWavelength,
                              };
                          saveNewEquation(snapshot, newEquation);
                        }
                      }}
                      onCursorMove={(c) => {
                        if (!wavelengthTrackRef.current || !wavelengthRef.current) return;
                        const val = getWavelengthValue(c.y, wavelengthTrackRef.current.clientHeight);
                        wavelengthRef.current.innerHTML = val.toFixed(2) + "px";
                      }}
                      disabled={move.locked || isAltKeyPressed}
                      title={wavelengthTitle}
                      liveTitleRef={wavelengthRef}
                    />
                  )}
                  {shapeType != LaurusShapeType.circle && (
                    <ParameterSliderY
                      resolution={{ ...uiState.resolution }}
                      label={"distance"}
                      hash={`${move.move_id}|p4`}
                      size={dynamicSizes.paramSlider}
                      trackRef={distanceTrackRef}
                      trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                      cursor={distanceCursor}
                      onNewCursor={(newCursor) => {
                        setDistanceCursor({ ...newCursor, x: 0 });
                        if (!distanceTrackRef.current) return;
                        const newDistance = getDistanceValue(newCursor.y, distanceTrackRef.current.clientHeight);
                        setCurrentControls((v) => {
                          return { ...v, distance: newDistance };
                        });
                        const activeKey = carouselEntryKey;
                        if (activeKey) {
                          const snapshot: LaurusMoveResult = { ...move };
                          const activeEquation = snapshot.math.get(activeKey);
                          const newEquation: LaurusMoveEquation = activeEquation
                            ? { ...activeEquation, distance: newDistance }
                            : {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                distance: newDistance,
                              };
                          saveNewEquation(snapshot, newEquation);
                        }
                      }}
                      onCursorMove={(c) => {
                        if (!distanceTrackRef.current || !distanceRef.current) return;
                        const val = getDistanceValue(c.y, distanceTrackRef.current.clientHeight);
                        distanceRef.current.innerHTML = val.toFixed(2) + "px";
                      }}
                      disabled={move.locked || isAltKeyPressed}
                      title={distanceTitle}
                      liveTitleRef={distanceRef}
                    />
                  )}
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"time"}
                    hash={`${move.move_id}|p5`}
                    size={dynamicSizes.paramSlider}
                    trackRef={timeTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={timeCursor}
                    onNewCursor={(newCursor) => {
                      setTimeCursor({ ...newCursor, x: 0 });
                      if (!timeTrackRef.current) return;
                      const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight, 0);
                      setCurrentControls((v) => {
                        return { ...v, time: newTime };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newServerTime = newTime * 1000;
                        const newEquation: LaurusMoveEquation = activeEquation
                          ? { ...activeEquation, time: newServerTime }
                          : {
                              ...defaultMoveEquation,
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
                    disabled={move.locked || isAltKeyPressed}
                    title={timeTitle}
                    liveTitleRef={timeRef}
                  />
                </div>
                <div />
                {/* toolbar */}
                <MoveUnitbar
                  move={move}
                  carouselEntryKey={carouselEntryKey}
                  currentControls={currentControls}
                  setCurrentControls={setCurrentControls}
                  updateTrackpads={updateTrackpads}
                  saveNewEquation={saveNewEquation}
                />
              </div>
            </div>
            {/* main control */}
            {shapeType != LaurusShapeType.circle && (
              <div style={{ ...dynamicSizes.param }}>
                <div
                  style={{
                    width: "100%",
                    border: "1px solid rgba(255, 255, 255, 0.025)",
                    backgroundColor: "rgba(20, 20, 20, 0.25)",
                    boxShadow: "4px 4px 12px rgba(11, 11, 11, 0.5)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "center",
                    position: "relative",
                    ...dynamicSizes.angleParam,
                  }}
                >
                  {angleTitle && (
                    <div
                      ref={angleRef}
                      style={{
                        position: "absolute",
                        color: "rgb(220,220,220)",
                        fontWeight: "bold",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        userSelect: "none",
                        ...dynamicSizes.angleTitle,
                      }}
                    >
                      {angleTitle}
                    </div>
                  )}
                  <Dial
                    resolution={{ ...uiState.resolution }}
                    ids={{
                      contextId: `${move.move_id}|main|c1`,
                      draggableId: `${move.move_id}|main|d1`,
                    }}
                    value={angle}
                    onNewValue={function (v: number): void {
                      const newAngle: number = ((v) => {
                        const x = Math.round(v) % 360;
                        return x < 0 ? x + 360 : x;
                      })(v);
                      setCurrentControls((v) => {
                        return { ...v, angle: newAngle };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation: LaurusMoveEquation = activeEquation
                          ? { ...activeEquation, angle: newAngle }
                          : {
                              ...defaultMoveEquation,
                              input_id: activeKey,
                              angle: newAngle,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    disabled={move.locked || isAltKeyPressed}
                    size={{
                      container: 90,
                      gauge: 90,
                      gaugeTick: 7,
                      dial: 80,
                      dialTick: 11,
                    }}
                    onMove={(v) => {
                      if (!angleRef.current) return;
                      const newAngle = ((v) => {
                        const x = Math.round(v) % 360;
                        return x < 0 ? x + 360 : x;
                      })(v);
                      angleRef.current.innerHTML = newAngle.toFixed(0) + "°";
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* deep controls */}
          <DeepControls />
        </>
      )}
    </div>
  );
}
