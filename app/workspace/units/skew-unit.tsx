import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import Dial from "../../components/dial";
import Toggle from "../../components/toggle";
import { ParameterSliderY } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { LaurusLoopType, LaurusSkewEquation, LaurusSkewResult, updateSkew } from "../workspace.server";
import { getDynamicUnitSizes, MIN_LIMIT_FACTOR } from "../workspace.config";
import { nearestNavigableIndex, useCarouselIndex } from "../hooks/useCarouselIndex";
import SkewUnitbar from "./bars/skew-unitbar";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";
import { carouselEntryMathKey } from "../effects-utils";
import { SvgRepo, updateCounterClockwise } from "@/app/svg-repo";

export interface SkewUnitControls {
  ax: number;
  ay: number;
  time: number;
  loop: LaurusLoopType;
  limit_factor: number;
}

export const defaultSkewEquation: LaurusSkewEquation = {
  input_id: "",
  time: 0.000001,
  loop: LaurusLoopType.none,
  solution: [],
  ax: 0,
  ay: 0,
  limit_factor: MIN_LIMIT_FACTOR,
};

const isSkewCarouselEntry = (entry: CarouselEntry) => entry.type !== "light" && entry.type !== "object";

export type SkewUnitTarget = "img" | "svg" | "mask";

const SKEW_TARGET_ORDER: SkewUnitTarget[] = ["img", "svg", "mask"];

const toDialAngle = (v: number, counterClockwise: boolean): number => {
  const x = Math.round(v) % 360;
  const x2 = x < 0 ? x + 360 : x;
  return counterClockwise ? x2 * -1 : x2;
};

interface SkewUnit {
  skew: LaurusSkewResult;
  carouselIndexInit: number;
}
export default function SkewUnit({ skew, carouselIndexInit }: SkewUnit) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    skew.skew_id,
    isSkewCarouselEntry,
  );
  const entryType = uiState.carouselEntries[carouselIndex]?.type;
  const target: SkewUnitTarget = entryType === "svg" || entryType === "mask" ? entryType : "img";
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<SkewUnitControls>({
    ax: 0,
    ay: 0,
    time: 0.000001,
    loop: defaultSkewEquation.loop,
    limit_factor: defaultSkewEquation.limit_factor,
  });
  const [dynamicSizes] = useState(() => {
    const ds = getDynamicUnitSizes(uiState.resolution);
    const dial = Math.round(ds.paramButtonContainer.height * 2);
    const panel = { height: ds.paramButtonContainer.height * 7 };
    const fill = { height: "100%" };
    const axesContainer = { padding: 0, width: "100%" };
    const axisLabelWidth = "2ch";
    const readoutWidth = "4ch";
    switch (uiState.resolution.type) {
      case "high":
        return {
          ...ds,
          panel,
          timeFlex: fill,
          axesContainer,
          skewParam: { dial, rowGap: 20, colGap: 10, labelFontSize: 12, readoutFontSize: 24 },
          axisLabel: { width: axisLabelWidth, gap: 6 },
          readout: { width: readoutWidth, letterSpacing: 1 },
          ccwRow: { gap: 8, paddingTop: 10 },
          ccwSvg: { width: 16, height: 16 },
          skewToggle: {
            track: { width: 26, height: 12, borderRadius: 10, padding: 1 },
            button: { width: 8, height: 8 },
            translateX: 14,
          },
        };
      case "midhigh":
        return {
          ...ds,
          panel,
          timeFlex: fill,
          axesContainer,
          skewParam: { dial, rowGap: 14, colGap: 7, labelFontSize: 11, readoutFontSize: 18 },
          axisLabel: { width: axisLabelWidth, gap: 5 },
          readout: { width: readoutWidth, letterSpacing: 1 },
          ccwRow: { gap: 6, paddingTop: 7 },
          ccwSvg: { width: 13, height: 13 },
          skewToggle: {
            track: { width: 22, height: 10, borderRadius: 10, padding: 1 },
            button: { width: 6, height: 6 },
            translateX: 12,
          },
        };
      case "low":
      case "midlow":
        return {
          ...ds,
          panel,
          timeFlex: fill,
          axesContainer,
          skewParam: { dial, rowGap: 12, colGap: 6, labelFontSize: 10, readoutFontSize: 15 },
          axisLabel: { width: axisLabelWidth, gap: 4 },
          readout: { width: readoutWidth, letterSpacing: 1 },
          ccwRow: { gap: 5, paddingTop: 6 },
          ccwSvg: { width: 11, height: 11 },
          skewToggle: {
            track: { width: 20, height: 9, borderRadius: 10, padding: 1 },
            button: { width: 5, height: 5 },
            translateX: 11,
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
        case "mask": {
          return coreState.project.masks.entries().find((m) => m[0] == carouselEntry.key)?.[0] ?? "";
        }
        case "object":
        case "light": {
          return "";
        }
      }
    } else {
      return "";
    }
  }, [uiState.carouselEntries, coreState.project.imgs, coreState.project.svgs, coreState.project.masks, carouselIndex]);

  const timeUpperLimit = useMemo(() => {
    return convertTime(coreState.timelineMaxValue, coreState.timelineUnit, "sec");
  }, [coreState.timelineMaxValue, coreState.timelineUnit]);
  const timeTrackRef = useRef<HTMLDivElement | null>(null);
  const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    timeUpperLimit * (skew.math.get(carouselEntryKey)?.limit_factor ?? defaultSkewEquation.limit_factor),
  );
  const timeTitle = useMemo(() => {
    return skew.math.has(carouselEntryKey)
      ? (skew.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + "s"
      : undefined;
  }, [carouselEntryKey, skew.math]);
  const timeRef = useRef<HTMLDivElement | null>(null);

  const [ax, setAx] = useState(0);
  const axTitle = useMemo(() => {
    return skew.math.has(carouselEntryKey) ? skew.math.get(carouselEntryKey)!.ax.toFixed(0) + "°" : undefined;
  }, [carouselEntryKey, skew.math]);
  const axRef = useRef<HTMLDivElement | null>(null);

  const [ay, setAy] = useState(0);
  const ayTitle = useMemo(() => {
    return skew.math.has(carouselEntryKey) ? skew.math.get(carouselEntryKey)!.ay.toFixed(0) + "°" : undefined;
  }, [carouselEntryKey, skew.math]);
  const ayRef = useRef<HTMLDivElement | null>(null);

  const [axCounterClockwise, setAxCounterClockwise] = useState<boolean>(() => {
    return (skew.math.get(carouselEntryKey)?.ax ?? 0) < 0;
  });
  const [ayCounterClockwise, setAyCounterClockwise] = useState<boolean>(() => {
    return (skew.math.get(carouselEntryKey)?.ay ?? 0) < 0;
  });

  const activateEntry = useCallback(
    (carouselEntry: CarouselEntry) => {
      switch (carouselEntry.type) {
        case "svg":
        case "img": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: carouselEntry.type,
            locallyActivatedEffectKey: skew.skew_id,
          };
          uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
          break;
        }
        case "mask": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "mask",
            locallyActivatedEffectKey: skew.skew_id,
          };
          uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
          break;
        }
        case "object":
        case "light": {
          break;
        }
      }
    },
    [skew.skew_id, uiDispatch],
  );

  const setActiveElementIfNull = useCallback(() => {
    if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
      activateEntry(uiState.carouselEntries[carouselIndex]);
    }
  }, [carouselIndex, uiState.carouselEntries, uiState.activeElement, activateEntry]);

  const toggleTarget = useCallback(() => {
    const startIndex = SKEW_TARGET_ORDER.indexOf(target);
    for (let offset = 1; offset <= SKEW_TARGET_ORDER.length; offset++) {
      const candidate = SKEW_TARGET_ORDER[(startIndex + offset) % SKEW_TARGET_ORDER.length];
      if (candidate === target) continue;
      const isCandidateEntry = (entry: CarouselEntry) => entry.type === candidate;
      const withMathIndex = uiState.carouselEntries.findIndex(
        (entry) => isCandidateEntry(entry) && skew.math.has(carouselEntryMathKey(entry)),
      );
      const nextIndex =
        withMathIndex > -1
          ? withMathIndex
          : nearestNavigableIndex(uiState.carouselEntries, carouselIndex, isCandidateEntry);
      const nextEntry = uiState.carouselEntries[nextIndex];
      if (!nextEntry || !isCandidateEntry(nextEntry)) continue;

      setLocalIndex(nextIndex);
      if (uiState.activeElement?.locallyActivatedEffectKey === skew.skew_id) {
        activateEntry(nextEntry);
      }
      return;
    }
  }, [
    target,
    carouselIndex,
    uiState.carouselEntries,
    uiState.activeElement,
    skew.math,
    skew.skew_id,
    setLocalIndex,
    activateEntry,
  ]);

  const saveNewEquation = useCallback(
    async (rollback: LaurusSkewResult, newEquation: LaurusSkewEquation) => {
      const newMath: Map<string, LaurusSkewEquation> = new Map(rollback.math);
      newMath.set(newEquation.input_id, newEquation);
      const newSkew: LaurusSkewResult = { ...rollback, math: newMath };
      setActiveElementIfNull();
      dispatch({
        type: CoreActionType.SetEffect,
        value: { type: "skew", value: { ...newSkew }, key: newSkew.skew_id },
      });
      const updated = await updateSkew(coreState.apiOrigin, coreState.accessToken, rollback.skew_id, { ...newSkew });
      if (!updated) {
        dispatch({
          type: CoreActionType.SetEffect,
          value: { type: "skew", value: { ...rollback }, key: rollback.skew_id },
        });
      }
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, setActiveElementIfNull],
  );

  const updateTrackpads = useCallback(
    (newControls: SkewUnitControls) => {
      setAxCounterClockwise(newControls.ax < 0);
      setAyCounterClockwise(newControls.ay < 0);
      setAx(newControls.ax);
      setAy(newControls.ay);
      if (timeTrackRef.current) {
        const newCursor = getTimeCursor(newControls.time, timeTrackRef.current.clientHeight);
        setTimeCursor({ y: newCursor, x: 0 });
      }
    },
    [getTimeCursor],
  );

  useLayoutEffect(() => {
    (async () => {
      const activeKey = carouselEntryKey;
      const activeEquation = skew.math.get(activeKey);
      const initControls: SkewUnitControls = { ...currentControls };
      if (activeEquation) {
        initControls.ax = activeEquation.ax;
        initControls.ay = activeEquation.ay;
        initControls.time = activeEquation.time / 1000;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.ax = defaultSkewEquation.ax;
        initControls.ay = defaultSkewEquation.ay;
        initControls.time = defaultSkewEquation.time;
        initControls.loop = defaultSkewEquation.loop;
        initControls.limit_factor = defaultSkewEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [currentControls, carouselEntryKey, skew.math, updateTrackpads, coreState.timelineUnit]);

  const saveAngle = useCallback(
    (axis: "ax" | "ay", value: number) => {
      const activeKey = carouselEntryKey;
      if (!activeKey) return;
      const snapshot: LaurusSkewResult = { ...skew };
      const activeEquation = snapshot.math.get(activeKey);
      const newEquation: LaurusSkewEquation = activeEquation
        ? { ...activeEquation, [axis]: value }
        : { ...defaultSkewEquation, input_id: activeKey, [axis]: value };
      saveNewEquation(snapshot, newEquation);
    },
    [carouselEntryKey, skew, saveNewEquation],
  );

  const dialDisabled = skew.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped";
  const dialSize = {
    container: dynamicSizes.skewParam.dial,
    gauge: dynamicSizes.skewParam.dial,
    gaugeTick: dynamicSizes.skewParam.dial * (7 / 90),
    dial: dynamicSizes.skewParam.dial * (80 / 90),
    dialTick: dynamicSizes.skewParam.dial * (11 / 90),
  };

  const axes = [
    {
      axis: "ax" as const,
      value: ax,
      title: axTitle,
      readoutRef: axRef,
      counterClockwise: axCounterClockwise,
      setCounterClockwise: setAxCounterClockwise,
    },
    {
      axis: "ay" as const,
      value: ay,
      title: ayTitle,
      readoutRef: ayRef,
      counterClockwise: ayCounterClockwise,
      setCounterClockwise: setAyCounterClockwise,
    },
  ];

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
            effectKey={skew.skew_id}
            onNewLocalIndex={setLocalIndex}
            isEntryWireable={isSkewCarouselEntry}
          />
          <div style={{ ...dynamicSizes.param }}>
            <div
              style={{
                border: "1px solid rgba(255, 255, 255, 0.025)",
                backgroundColor: "rgba(20, 20, 20, 0.25)",
                boxShadow: "4px 4px 12px rgba(11, 11, 11, 0.5)",
                borderRadius: 6,
                display: "grid",
                gridTemplateColumns: "min-content auto min-content auto min-content",
                gridTemplateRows: "auto",
                ...dynamicSizes.panel,
              }}
            >
              <div
                style={{
                  display: "flex",
                  overflow: "hidden",
                  ...dynamicSizes.timeFlex,
                  ...dynamicSizes.paramFlex,
                }}
              >
                <ParameterSliderY
                  resolution={{ ...uiState.resolution }}
                  label={"time"}
                  hash={`${skew.skew_id}|p1`}
                  size={dynamicSizes.paramSlider}
                  trackRef={timeTrackRef}
                  trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                  cursor={timeCursor}
                  onNewCursor={(newCursor) => {
                    setTimeCursor({ ...newCursor, x: 0 });
                    if (!timeTrackRef.current) return;
                    const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight);
                    setCurrentControls((v) => {
                      return { ...v, time: newTime };
                    });
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                      const snapshot: LaurusSkewResult = { ...skew };
                      const activeEquation = snapshot.math.get(activeKey);
                      const newServerTime = newTime * 1000;
                      const newEquation: LaurusSkewEquation = activeEquation
                        ? { ...activeEquation, time: newServerTime }
                        : { ...defaultSkewEquation, input_id: activeKey, time: newServerTime };
                      saveNewEquation(snapshot, newEquation);
                    }
                  }}
                  onCursorMove={(c) => {
                    if (!timeTrackRef.current || !timeRef.current) return;
                    const val = getTimeValue(c.y, timeTrackRef.current.clientHeight);
                    timeRef.current.innerHTML = val.toFixed(2) + "s";
                  }}
                  disabled={skew.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                  title={timeTitle}
                  liveTitleRef={timeRef}
                />
              </div>
              <div />
              <div
                style={{
                  display: "flex",
                  gap: dynamicSizes.skewParam.rowGap,
                  alignItems: "center",
                  ...dynamicSizes.axesContainer,
                }}
              >
                {axes.map(({ axis, value, title, readoutRef, counterClockwise, setCounterClockwise }) => (
                  <div
                    key={axis}
                    style={{
                      display: "grid",
                      justifyItems: "center",
                      gap: dynamicSizes.skewParam.colGap,
                    }}
                  >
                    <div
                      style={{
                        color: "rgb(220, 220, 220)",
                        fontWeight: "bold",
                        fontSize: dynamicSizes.skewParam.labelFontSize,
                        userSelect: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        ...dynamicSizes.axisLabel,
                      }}
                    >
                      <div>{axis}</div>
                      <div
                        ref={readoutRef}
                        style={{
                          color: title ? "rgb(220, 220, 220)" : "rgb(90, 90, 90)",
                          fontSize: dynamicSizes.skewParam.readoutFontSize,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          userSelect: "none",
                          ...dynamicSizes.readout,
                        }}
                      >
                        {title ?? "0°"}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Dial
                        resolution={{ ...uiState.resolution }}
                        ids={{
                          contextId: `${skew.skew_id}|main|${axis}|c1`,
                          draggableId: `${skew.skew_id}|main|${axis}|d1`,
                        }}
                        value={Math.abs(value)}
                        onNewValue={function (v: number): void {
                          const next = toDialAngle(v, counterClockwise);
                          setCurrentControls((c) => ({ ...c, [axis]: next }));
                          saveAngle(axis, next);
                        }}
                        disabled={dialDisabled}
                        size={dialSize}
                        onMove={(v) => {
                          if (!readoutRef.current) return;
                          readoutRef.current.innerHTML = toDialAngle(v, counterClockwise).toFixed(0) + "°";
                        }}
                      />
                    </div>
                    <div
                      title={`${axis} counterclockwise`}
                      style={{ display: "flex", alignItems: "center", ...dynamicSizes.ccwRow }}
                    >
                      <SvgRepo
                        containerStyle={{ ...dynamicSizes.ccwSvg }}
                        scale={1}
                        scaleToContaier={true}
                        title={`${axis} counterclockwise`}
                        svg={updateCounterClockwise()}
                      />
                      <Toggle
                        value={counterClockwise}
                        disabled={dialDisabled}
                        onClick={() => {
                          const activeKey = carouselEntryKey;
                          if (!activeKey) return;
                          const next = !counterClockwise;
                          const snapshot: LaurusSkewResult = { ...skew };
                          const activeEquation = snapshot.math.get(activeKey);
                          if (activeEquation) {
                            const magnitude = Math.abs(activeEquation[axis]);
                            saveNewEquation(snapshot, {
                              ...activeEquation,
                              [axis]: next ? magnitude * -1 : magnitude,
                            });
                          } else {
                            saveNewEquation(snapshot, { ...defaultSkewEquation, input_id: activeKey });
                          }
                          setCounterClockwise(next);
                        }}
                        trackStyles={{ ...dynamicSizes.skewToggle.track }}
                        buttonStyles={{ ...dynamicSizes.skewToggle.button }}
                        translateX={dynamicSizes.skewToggle.translateX}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div />
              <SkewUnitbar
                skew={skew}
                carouselEntryKey={carouselEntryKey}
                updateTrackpads={updateTrackpads}
                saveNewEquation={saveNewEquation}
                currentControls={currentControls}
                setCurrentControls={setCurrentControls}
                target={target}
                onToggleTarget={toggleTarget}
              />
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
