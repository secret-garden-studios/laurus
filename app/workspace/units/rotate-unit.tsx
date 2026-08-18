import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, convertTime, HoverContext, UIContext } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import Dial from "../../components/dial";
import { ParameterSliderY } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { LaurusLoopType, LaurusRotateEquation, LaurusRotateResult, updateRotate } from "../workspace.server";
import { getDynamicUnitSizes, MIN_LIMIT_FACTOR, ROTATE_AXIS_MAX } from "../workspace.config";
import { nearestNavigableIndex, useCarouselIndex } from "../hooks/useCarouselIndex";
import RotateUnitbar from "./bars/rotate-unitbar";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";
import { carouselEntryMathKey } from "../effects-utils";

export interface RotateUnitControls {
  x: number;
  y: number;
  z: number;
  time: number;
  angle: number;
  loop: LaurusLoopType;
  limit_factor: number;
}

export const defaultRotateEquation: LaurusRotateEquation = {
  input_id: "",
  time: 0.000001,
  loop: LaurusLoopType.none,
  solution: [],
  angle: 0,
  x: 0,
  y: 0,
  z: 0,
  limit_factor: MIN_LIMIT_FACTOR,
};

// Rotate acts on a whole element's transform, which neither a capture nor a topology peak has (see
// this file's own carouselEntryKey) -- passed to useCarouselIndex and UnitDisplay so neither ever
// derives an index onto one.
const isRotateCarouselEntry = (entry: CarouselEntry) => entry.type !== "capture" && entry.type !== "peak";

// Which kind of media this unit is currently editing the rotation of. Not state and not persisted
// -- it's read off whichever carousel entry the display is showing, exactly the way scale-unit.tsx
// reads its own target off the identical place. Capture and peak are never a target here -- see
// isRotateCarouselEntry above.
export type RotateUnitTarget = "img" | "svg" | "mask";

// The order the unitbar's target button walks. Fixed rather than read off the carousel, which is
// ordered by canvas position (see workspace.client.tsx's initCarouselEntries) and so interleaves
// the types with no order of its own to borrow -- mirrors scale-unit.tsx's own SCALE_TARGET_ORDER.
const ROTATE_TARGET_ORDER: RotateUnitTarget[] = ["img", "svg", "mask"];

interface RotateUnit {
  rotate: LaurusRotateResult;
  carouselIndexInit: number;
}
export default function RotateUnit({ rotate, carouselIndexInit }: RotateUnit) {
  const {
    coreState,
    dispatch,
    notifyMaskSelectionChanged,
    notifyMaskSelectedCaptureChanged,
    notifyMaskSelectedPeakChanged,
  } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const { carouselIndex, setLocalIndex } = useCarouselIndex(
    uiState.activeElement,
    uiState.carouselEntries,
    carouselIndexInit,
    rotate.rotate_id,
    isRotateCarouselEntry,
  );
  // Whatever the display is showing is what this unit is editing -- see RotateUnitTarget. The
  // "img" fallback covers both a carousel entry rotate can't target (a capture/peak, which
  // isRotateCarouselEntry already keeps carouselIndex off of) and a carousel with nothing on it at
  // all, where there's no equation to wire either way and the full parameter set is the right
  // thing to leave standing.
  const entryType = uiState.carouselEntries[carouselIndex]?.type;
  const target: RotateUnitTarget = entryType === "svg" || entryType === "mask" ? entryType : "img";
  const [mainControls] = useState(true);
  const [currentControls, setCurrentControls] = useState<RotateUnitControls>({
    x: 0,
    y: 0,
    z: 0,
    time: 0.000001,
    angle: 0,
    loop: defaultRotateEquation.loop,
    limit_factor: defaultRotateEquation.limit_factor,
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
        case "mask": {
          // The whole mask, wired the same way an img/svg wires its own bare key -- see
          // effects-utils.ts's comment. Unlike move/scale, rotate never had a capture-scoped
          // format to worry about colliding with.
          return coreState.project.masks.entries().find((m) => m[0] == carouselEntry.key)?.[0] ?? "";
        }
        // Neither a capture nor a topology peak is wireable to rotate -- it acts on a whole
        // element's transform, which neither has (see effects-utils.ts's own comment).
        case "capture":
        case "peak": {
          return "";
        }
      }
    } else {
      return "";
    }
  }, [uiState.carouselEntries, coreState.project.imgs, coreState.project.svgs, coreState.project.masks, carouselIndex]);

  // param 1
  const xTrackRef = useRef<HTMLDivElement | null>(null);
  const [xCursor, setXCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getXValue, getInverseTrackCursor: getXCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    ROTATE_AXIS_MAX,
  );
  const xTitle = useMemo(() => {
    return rotate.math.has(carouselEntryKey) ? rotate.math.get(carouselEntryKey)!.x.toFixed(2) : undefined;
  }, [carouselEntryKey, rotate.math]);
  const xRef = useRef<HTMLDivElement | null>(null);

  // param 2
  const yTrackRef = useRef<HTMLDivElement | null>(null);
  const [yCursor, setYCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getYValue, getInverseTrackCursor: getYCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    ROTATE_AXIS_MAX,
  );
  const yTitle = useMemo(() => {
    return rotate.math.has(carouselEntryKey) ? rotate.math.get(carouselEntryKey)!.y.toFixed(2) : undefined;
  }, [carouselEntryKey, rotate.math]);
  const yRef = useRef<HTMLDivElement | null>(null);

  // param 3
  const zTrackRef = useRef<HTMLDivElement | null>(null);
  const [zCursor, setZCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getZValue, getInverseTrackCursor: getZCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    ROTATE_AXIS_MAX,
  );
  const zTitle = useMemo(() => {
    return rotate.math.has(carouselEntryKey) ? rotate.math.get(carouselEntryKey)!.z.toFixed(2) : undefined;
  }, [carouselEntryKey, rotate.math]);
  const zRef = useRef<HTMLDivElement | null>(null);

  // param 4
  const timeUpperLimit = useMemo(() => {
    return convertTime(coreState.timelineMaxValue, coreState.timelineUnit, "sec");
  }, [coreState.timelineMaxValue, coreState.timelineUnit]);
  const timeTrackRef = useRef<HTMLDivElement | null>(null);
  const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
  const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } = useTrackpadState(
    dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
    timeUpperLimit * (rotate.math.get(carouselEntryKey)?.limit_factor ?? defaultRotateEquation.limit_factor),
  );
  const timeTitle = useMemo(() => {
    return rotate.math.has(carouselEntryKey)
      ? (rotate.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + "s"
      : undefined;
  }, [carouselEntryKey, rotate.math]);
  const timeRef = useRef<HTMLDivElement | null>(null);

  // main param
  const [angle, setAngle] = useState(0);
  const angleTitle = useMemo(() => {
    return rotate.math.has(carouselEntryKey) ? rotate.math.get(carouselEntryKey)!.angle.toFixed(0) + "°" : undefined;
  }, [carouselEntryKey, rotate.math]);
  const angleRef = useRef<HTMLDivElement | null>(null);

  const [counterClockwise, setCounterClockwise] = useState<boolean>(() => {
    return (rotate.math.get(carouselEntryKey)?.angle ?? 0) < 0 ? true : false;
  });

  // Makes `carouselEntry` the app's active element, tagged as activated by this unit. Extracted
  // from setActiveElementIfNull below so the target toggle can reuse it -- see toggleTarget.
  // Mirrors scale-unit.tsx's own activateEntry on the selection question too: activating a capture
  // also selects it, while the svg/img/mask cases leave the selection alone (see
  // LaurusSelectedElement). A "peak" case is never reached -- isRotateCarouselEntry keeps
  // carouselIndex off peak entries, and ROTATE_TARGET_ORDER never walks the toggle onto one.
  const activateEntry = useCallback(
    (carouselEntry: CarouselEntry) => {
      switch (carouselEntry.type) {
        case "svg": {
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "svg",
            locallyActivatedEffectKey: rotate.rotate_id,
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
            locallyActivatedEffectKey: rotate.rotate_id,
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
            locallyActivatedEffectKey: rotate.rotate_id,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          break;
        }
        case "capture": {
          // Rotate has no equation for a capture (see this file's carouselEntryKey above), but
          // the active-element/highlight system still tracks whichever entry is being browsed --
          // see move-unit.tsx's own activateEntry for why this must be type "capture" (not "mask")
          // here.
          const newActiveElement: LaurusActiveElement = {
            key: carouselEntry.key,
            type: "capture",
            locallyActivatedEffectKey: rotate.rotate_id,
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
      }
    },
    [
      rotate.rotate_id,
      uiDispatch,
      notifyMaskSelectionChanged,
      notifyMaskSelectedCaptureChanged,
      notifyMaskSelectedPeakChanged,
    ],
  );

  const setActiveElementIfNull = useCallback(() => {
    if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
      activateEntry(uiState.carouselEntries[carouselIndex]);
    }
  }, [carouselIndex, uiState.carouselEntries, uiState.activeElement, activateEntry]);

  // Switching target *is* moving the carousel -- each kind of media lives on its own carousel
  // entries and the target is read back off whichever one is showing (see RotateUnitTarget), so
  // there's no separate mode to flip. The chevrons already walk every entry; this is the shortcut
  // past however many entries of the kinds in between sit in the way. Mirrors scale-unit.tsx's own
  // toggleTarget, minus the capture/peak legs neither ROTATE_TARGET_ORDER nor
  // isRotateCarouselEntry ever lets this land on.
  const toggleTarget = useCallback(() => {
    const startIndex = ROTATE_TARGET_ORDER.indexOf(target);
    for (let offset = 1; offset <= ROTATE_TARGET_ORDER.length; offset++) {
      const candidate = ROTATE_TARGET_ORDER[(startIndex + offset) % ROTATE_TARGET_ORDER.length];
      if (candidate === target) continue;
      const isCandidateEntry = (entry: CarouselEntry) => entry.type === candidate;
      const withMathIndex = uiState.carouselEntries.findIndex(
        (entry) => isCandidateEntry(entry) && rotate.math.has(carouselEntryMathKey(entry)),
      );
      const nextIndex =
        withMathIndex > -1
          ? withMathIndex
          : nearestNavigableIndex(uiState.carouselEntries, carouselIndex, isCandidateEntry);
      const nextEntry = uiState.carouselEntries[nextIndex];
      // nearestNavigableIndex falls back to the index it was handed when nothing qualifies, so
      // this is also the "carousel has no entry of this kind" test -- move on to the next kind.
      if (!nextEntry || !isCandidateEntry(nextEntry)) continue;

      setLocalIndex(nextIndex);
      // While this unit is the one holding the active element, the carousel follows that element
      // rather than the local index (see useCarouselIndex) -- so the jump above would be silently
      // ignored unless the active element moves with it.
      if (uiState.activeElement?.locallyActivatedEffectKey === rotate.rotate_id) {
        activateEntry(nextEntry);
      }
      return;
    }
  }, [
    target,
    carouselIndex,
    uiState.carouselEntries,
    uiState.activeElement,
    rotate.math,
    rotate.rotate_id,
    setLocalIndex,
    activateEntry,
  ]);

  const saveNewEquation = useCallback(
    async (rollback: LaurusRotateResult, newEquation: LaurusRotateEquation) => {
      const newMath: Map<string, LaurusRotateEquation> = new Map(rollback.math);
      newMath.set(newEquation.input_id, newEquation);
      const newRotate: LaurusRotateResult = { ...rollback, math: newMath };
      setActiveElementIfNull();
      dispatch({
        type: CoreActionType.SetEffect,
        value: {
          type: "rotate",
          value: { ...newRotate },
          key: newRotate.rotate_id,
        },
      });
      const updated = await updateRotate(coreState.apiOrigin, coreState.accessToken, rollback.rotate_id, {
        ...newRotate,
      });
      if (!updated) {
        dispatch({
          type: CoreActionType.SetEffect,
          value: {
            type: "rotate",
            value: { ...rollback },
            key: rollback.rotate_id,
          },
        });
      }
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, setActiveElementIfNull],
  );

  const updateTrackpads = useCallback(
    (newControls: RotateUnitControls) => {
      if (newControls.angle < 0) {
        setCounterClockwise(true);
      } else {
        setCounterClockwise(false);
      }
      setAngle(newControls.angle);

      if (xTrackRef.current) {
        const newCursor = getXCursor(newControls.x, xTrackRef.current.clientHeight);
        setXCursor({ y: newCursor, x: 0 });
      }
      if (yTrackRef.current) {
        const newCursor = getYCursor(newControls.y, yTrackRef.current.clientHeight);
        setYCursor({ y: newCursor, x: 0 });
      }
      if (zTrackRef.current) {
        const newCursor = getZCursor(newControls.z, zTrackRef.current.clientHeight);
        setZCursor({ y: newCursor, x: 0 });
      }
      if (timeTrackRef.current) {
        const newCursor = getTimeCursor(newControls.time, timeTrackRef.current.clientHeight);
        setTimeCursor({ y: newCursor, x: 0 });
      }
    },
    [getXCursor, getYCursor, getTimeCursor, getZCursor],
  );

  useLayoutEffect(() => {
    (async () => {
      const activeKey = carouselEntryKey;
      const activeEquation = rotate.math.get(activeKey);
      const initControls: RotateUnitControls = { ...currentControls };
      if (activeEquation) {
        initControls.x = activeEquation.x;
        initControls.y = activeEquation.y;
        initControls.z = activeEquation.z;
        initControls.time = activeEquation.time / 1000;
        initControls.angle = activeEquation.angle;
        initControls.loop = activeEquation.loop;
        initControls.limit_factor = activeEquation.limit_factor;
      } else if (activeKey) {
        initControls.x = defaultRotateEquation.x;
        initControls.y = defaultRotateEquation.y;
        initControls.z = defaultRotateEquation.z;
        initControls.time = defaultRotateEquation.time;
        initControls.angle = defaultRotateEquation.angle;
        initControls.loop = defaultRotateEquation.loop;
        initControls.limit_factor = defaultRotateEquation.limit_factor;
      }
      updateTrackpads(initControls);
    })();
  }, [currentControls, carouselEntryKey, rotate.math, updateTrackpads, coreState.timelineUnit]);

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
            effectKey={rotate.rotate_id}
            onNewLocalIndex={setLocalIndex}
            isEntryWireable={isRotateCarouselEntry}
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
                    label={"x"}
                    hash={`${rotate.rotate_id}|p1`}
                    size={dynamicSizes.paramSlider}
                    trackRef={xTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={xCursor}
                    onNewCursor={(newCursor) => {
                      setXCursor({ ...newCursor, x: 0 });
                      if (!xTrackRef.current) return;
                      const newX = getXValue(newCursor.y, xTrackRef.current.clientHeight, 0);
                      setCurrentControls((v) => {
                        return { ...v, x: newX };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusRotateResult = { ...rotate };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation: LaurusRotateEquation = activeEquation
                          ? { ...activeEquation, x: newX }
                          : {
                              ...defaultRotateEquation,
                              input_id: activeKey,
                              x: newX,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    onCursorMove={(c) => {
                      if (!xTrackRef.current || !xRef.current) return;
                      const val = getXValue(c.y, xTrackRef.current.clientHeight, 0);
                      xRef.current.innerHTML = val.toFixed(2);
                    }}
                    disabled={rotate.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                    title={xTitle}
                    liveTitleRef={xRef}
                  />
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"y"}
                    hash={`${rotate.rotate_id}|p2`}
                    size={dynamicSizes.paramSlider}
                    trackRef={yTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={yCursor}
                    onNewCursor={(newCursor) => {
                      setYCursor({ ...newCursor, x: 0 });
                      if (!yTrackRef.current) return;
                      const newY = getYValue(newCursor.y, yTrackRef.current.clientHeight, 0);
                      setCurrentControls((v) => {
                        return { ...v, y: newY };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusRotateResult = { ...rotate };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation: LaurusRotateEquation = activeEquation
                          ? { ...activeEquation, y: newY }
                          : {
                              ...defaultRotateEquation,
                              input_id: activeKey,
                              y: newY,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    onCursorMove={(c) => {
                      if (!yTrackRef.current || !yRef.current) return;
                      const val = getYValue(c.y, yTrackRef.current.clientHeight, 0);
                      yRef.current.innerHTML = val.toFixed(2);
                    }}
                    disabled={rotate.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                    title={yTitle}
                    liveTitleRef={yRef}
                  />
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"z"}
                    hash={`${rotate.rotate_id}|p3`}
                    size={dynamicSizes.paramSlider}
                    trackRef={zTrackRef}
                    trackBackground={"linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))"}
                    cursor={zCursor}
                    onNewCursor={(newCursor) => {
                      setZCursor({ ...newCursor, x: 0 });
                      if (!zTrackRef.current) return;
                      const newZ = getZValue(newCursor.y, zTrackRef.current.clientHeight, 0);
                      setCurrentControls((v) => {
                        return { ...v, z: newZ };
                      });
                      const activeKey = carouselEntryKey;
                      if (activeKey) {
                        const snapshot: LaurusRotateResult = { ...rotate };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation: LaurusRotateEquation = activeEquation
                          ? { ...activeEquation, z: newZ }
                          : {
                              ...defaultRotateEquation,
                              input_id: activeKey,
                              z: newZ,
                            };
                        saveNewEquation(snapshot, newEquation);
                      }
                    }}
                    onCursorMove={(c) => {
                      if (!zTrackRef.current || !zRef.current) return;
                      const val = getZValue(c.y, zTrackRef.current.clientHeight, 0);
                      zRef.current.innerHTML = val.toFixed(2);
                    }}
                    disabled={rotate.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                    title={zTitle}
                    liveTitleRef={zRef}
                  />
                  <ParameterSliderY
                    resolution={{ ...uiState.resolution }}
                    label={"time"}
                    hash={`${rotate.rotate_id}|p4`}
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
                        const snapshot: LaurusRotateResult = { ...rotate };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newServerTime = newTime * 1000;
                        const newEquation: LaurusRotateEquation = activeEquation
                          ? { ...activeEquation, time: newServerTime }
                          : {
                              ...defaultRotateEquation,
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
                    disabled={rotate.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                    title={timeTitle}
                    liveTitleRef={timeRef}
                  />
                </div>
                <div />
                {/* toolbar */}
                <RotateUnitbar
                  rotate={rotate}
                  carouselEntryKey={carouselEntryKey}
                  updateTrackpads={updateTrackpads}
                  saveNewEquation={saveNewEquation}
                  currentControls={currentControls}
                  setCurrentControls={setCurrentControls}
                  counterClockwise={counterClockwise}
                  setCounterClockwise={setCounterClockwise}
                  target={target}
                  onToggleTarget={toggleTarget}
                />
              </div>
            </div>
            {/* main control */}
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
                    contextId: `${rotate.rotate_id}|main|c1`,
                    draggableId: `${rotate.rotate_id}|main|d1`,
                  }}
                  value={Math.abs(angle)}
                  onNewValue={function (v: number): void {
                    const newAngle: number = ((v) => {
                      const x = Math.round(v) % 360;
                      const x2 = x < 0 ? x + 360 : x;
                      return counterClockwise ? x2 * -1 : x2;
                    })(v);
                    setCurrentControls((v) => {
                      return { ...v, angle: newAngle };
                    });
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                      const snapshot: LaurusRotateResult = { ...rotate };
                      const activeEquation = snapshot.math.get(activeKey);
                      const newEquation: LaurusRotateEquation = activeEquation
                        ? { ...activeEquation, angle: newAngle }
                        : {
                            ...defaultRotateEquation,
                            input_id: activeKey,
                            angle: newAngle,
                          };
                      saveNewEquation(snapshot, newEquation);
                    }
                  }}
                  disabled={rotate.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped"}
                  size={{
                    container: 90,
                    gauge: 90,
                    gaugeTick: 7,
                    dial: 80,
                    dialTick: 11,
                  }}
                  onMove={(v) => {
                    if (!angleRef.current) return;
                    const newAngle: number = ((v) => {
                      const x = Math.round(v) % 360;
                      const x2 = x < 0 ? x + 360 : x;
                      return counterClockwise ? x2 * -1 : x2;
                    })(v);
                    angleRef.current.innerHTML = newAngle.toFixed(0) + "°";
                  }}
                />
              </div>
            </div>
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
