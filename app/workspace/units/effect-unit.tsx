import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ScaleUnit from "../units/scale-unit";
import { convertTime, CoreContext, HoverContext, UIContext } from "../workspace.client";
import {
  LaurusEffect,
  LaurusMoveResult,
  LaurusRotateResult,
  LaurusScaleResult,
  updateMove,
  updateRotate,
  updateScale,
} from "../workspace.server";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import MoveUnit from "../units/move-unit";
import TimelineSlider from "../../components/timeline-slider";
import RotateUnit from "../units/rotate-unit";
import { dellaRespira } from "../../fonts";
import useDebounce from "../../hooks/useDebounce";
import EffectUnitbar from "./bars/effect-unitbar";
import { CoreActionType } from "../states/core-state";

interface EffectUnit {
  effect: LaurusEffect;
  showUnitControlsInit: boolean;
}
export default function EffectUnit({ effect, showUnitControlsInit }: EffectUnit) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { selectedEffectUnitKeys, isAltKeyPressed } = useContext(HoverContext);
  const [moveCarouselIndex, setMoveCarouselIndex] = useState(0);
  const [scaleCarouselIndex, setScaleCarouselIndex] = useState(0);
  const [rotateCarouselIndex, setRotateCarouselIndex] = useState(0);
  const [showUnitControls, setShowUnitControls] = useState(() => {
    const keys = uiState.carouselEntries;
    const activeElementIndex = uiState.activeElement ? keys.findIndex((k) => k.key === uiState.activeElement?.key) : -1;
    switch (effect.type) {
      case "move": {
        const moveEqautionKeys = Array.from(effect.value.math.keys());
        const k = keys.findIndex((k) => moveEqautionKeys.includes(k.key));
        const newIndex = k > -1 ? k : activeElementIndex > -1 ? activeElementIndex : 0;
        setMoveCarouselIndex(newIndex);
        break;
      }
      case "rotate": {
        const eqKeys = Array.from(effect.value.math.keys());
        const k = keys.findIndex((k) => eqKeys.includes(k.key));
        const newIndex = k > -1 ? k : activeElementIndex > -1 ? activeElementIndex : 0;
        setRotateCarouselIndex(newIndex);
        break;
      }
      case "scale": {
        const moveEqautionKeys = Array.from(effect.value.math.keys());
        const k = keys.findIndex((k) => moveEqautionKeys.includes(k.key));
        const newIndex = k > -1 ? k : activeElementIndex > -1 ? activeElementIndex : 0;
        setScaleCarouselIndex(newIndex);
        break;
      }
    }
    return showUnitControlsInit;
  });
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          timelineSliderContainer: {
            padding: "0px 24px 0px 16px",
          },
          timelineTrackSize: {
            containerHeight: 44,
            containerWidth: "100%",
            trackHeight: 1,
            capWidth: 16,
            capHeight: 16,
          },
          headerFlex: {
            height: 36,
            padding: "0px 0px 0px 8px",
            fontSize: 12,
          },
          inputFlex: {
            gap: 0,
            fontSize: 10,
          },
          input: {
            fontSize: 10,
            width: "7ch",
            letterSpacing: 1,
          },
          footer: {
            height: 20,
          },
        };
      case "midhigh":
        return {
          timelineSliderContainer: {
            padding: "0px 14px 0px 14px",
          },
          timelineTrackSize: {
            containerHeight: 40,
            containerWidth: "100%",
            trackHeight: 1,
            capWidth: 12,
            capHeight: 12,
          },
          headerFlex: {
            height: 26,
            padding: "0px 0px 0px 8px",
            fontSize: 10,
          },
          inputFlex: {
            gap: 0,
            fontSize: 8,
          },
          input: {
            fontSize: 8,
            width: "7ch",
            letterSpacing: 1,
          },
          footer: {
            height: 22,
          },
        };
      case "midlow":
      case "low":
        return {
          timelineSliderContainer: {
            padding: "0px 14px 0px 14px",
          },
          timelineTrackSize: {
            containerHeight: 40,
            containerWidth: "100%",
            trackHeight: 1,
            capWidth: 10,
            capHeight: 10,
          },
          headerFlex: {
            height: 26,
            padding: "0px 0px 0px 8px",
            fontSize: 10,
          },
          inputFlex: {
            gap: 4,
            fontSize: 12,
          },
          input: {
            fontSize: 9,
            width: "6ch",
            letterSpacing: 1,
          },
          footer: {
            height: 20,
          },
        };
    }
  });

  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const [startCursor, setStartCursor] = useState({ x: 0, y: 0 });
  const startRef = useRef<HTMLInputElement | null>(null);
  const [endCursor, setEndCursor] = useState({ x: 0, y: 0 });
  const endRef = useRef<HTMLInputElement | null>(null);

  const { getTrackValue: getTimeValue, getTrackCursor: getTimeCursor } = useTrackpadState(
    0,
    coreState.timelineMaxValue,
  );

  const cursorToTime = useCallback(
    (cursorX: number): number => {
      if (!timelineTrackRef.current) return 0;
      return getTimeValue(cursorX, timelineTrackRef.current.clientWidth - dynamicSizes.timelineTrackSize.capWidth, 0);
    },
    [getTimeValue, dynamicSizes.timelineTrackSize.capWidth],
  );

  const timeToCursor = useCallback(
    (time: number): number => {
      if (!timelineTrackRef.current) return 0;
      return getTimeCursor(time, timelineTrackRef.current.clientWidth - dynamicSizes.timelineTrackSize.capWidth);
    },
    [getTimeCursor, dynamicSizes.timelineTrackSize.capWidth],
  );

  const getNewEndTime = useCallback(
    (newStartCursorX: number): [number, boolean] => {
      return endCursor.x < newStartCursorX ? [cursorToTime(newStartCursorX), true] : [cursorToTime(endCursor.x), false];
    },
    [cursorToTime, endCursor.x],
  );

  const getNewStartTime = useCallback(
    (newEndCursorX: number): [number, boolean] => {
      return startCursor.x > newEndCursorX ? [cursorToTime(newEndCursorX), true] : [cursorToTime(startCursor.x), false];
    },
    [cursorToTime, startCursor.x],
  );

  const updateTrackpads = useCallback(() => {
    const convertedStart = convertTime(effect.value.start, "sec", coreState.timelineUnit);
    const convertedEnd = convertTime(effect.value.end, "sec", coreState.timelineUnit);
    const clampedStart = Math.min(coreState.timelineMaxValue, Math.max(0, convertedStart));
    const clampedEnd = Math.min(coreState.timelineMaxValue, Math.max(0, convertedEnd));
    const newStartCursor = timeToCursor(clampedStart);
    const newEndCursor = timeToCursor(clampedEnd);
    setStartCursor({ x: newStartCursor, y: 0 });
    setEndCursor({ x: newEndCursor, y: 0 });
    if (startRef.current) {
      startRef.current.value = clampedStart.toFixed(2);
    }
    if (endRef.current) {
      endRef.current.value = clampedEnd.toFixed(2);
    }
  }, [coreState.timelineMaxValue, coreState.timelineUnit, effect.value.end, effect.value.start, timeToCursor]);

  const saveEffect = useCallback(
    async (effect: LaurusEffect, rollback: LaurusEffect) => {
      let updated: boolean = false;
      switch (effect.type) {
        case "scale": {
          updated = await updateScale(
            coreState.apiOrigin,
            coreState.accessToken,
            effect.key,
            effect.value as LaurusScaleResult,
          );
          break;
        }
        case "move": {
          updated = await updateMove(
            coreState.apiOrigin,
            coreState.accessToken,
            effect.key,
            effect.value as LaurusMoveResult,
          );
          break;
        }
        case "rotate": {
          updated = await updateRotate(
            coreState.apiOrigin,
            coreState.accessToken,
            effect.key,
            effect.value as LaurusRotateResult,
          );
          break;
        }
      }
      if (updated) {
        dispatch({ type: CoreActionType.SetEffect, value: effect });
      } else {
        updateTrackpads();
        dispatch({ type: CoreActionType.SetEffect, value: rollback });
      }
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, updateTrackpads],
  );

  useLayoutEffect(() => {
    (() => {
      updateTrackpads();
    })();
  }, [updateTrackpads]);

  const startTitle = useMemo(() => {
    return convertTime(effect.value.start, "sec", coreState.timelineUnit).toPrecision(7);
  }, [coreState.timelineUnit, effect.value.start]);

  const endTitle = useMemo(() => {
    return convertTime(effect.value.end, "sec", coreState.timelineUnit).toPrecision(7);
  }, [coreState.timelineUnit, effect.value.end]);

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ display: "grid", width: "100%" }}>
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgb(227, 227, 227)",
            ...dynamicSizes.headerFlex,
          }}
        >
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              ...dynamicSizes.inputFlex,
            }}
          >
            <input
              className={dellaRespira.className}
              title={"start time"}
              id={`start-input-${effect.key}`}
              disabled
              ref={startRef}
              type="text"
              placeholder="0.00"
              style={{
                textAlign: "left",
                background: "none",
                color: "rgb(220, 220, 220)",
                fontWeight: "bold",
                border: "none",
                outline: "none",
                height: "100%",
                display: "inline-block",
                overflowX: "scroll",
                pointerEvents: "none",
                ...dynamicSizes.input,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              height: "100%",
              width: "60%",
              marginTop: 4,
              alignItems: "center",
            }}
          >
            <EffectDescription effectKey={effect.key} effectDescriptionInit={effect.value.description} />
          </div>
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              ...dynamicSizes.inputFlex,
            }}
          >
            <input
              className={dellaRespira.className}
              title={"end time"}
              id={`end-input-${effect.key}`}
              disabled
              ref={endRef}
              type="text"
              placeholder="0.00"
              style={{
                textAlign: "left",
                background: "none",
                color: "rgb(220, 220, 220)",
                fontWeight: "bold",
                border: "none",
                outline: "none",
                height: "100%",
                display: "inline-block",
                overflowX: "scroll",
                pointerEvents: "none",
                ...dynamicSizes.input,
              }}
            />
          </div>
        </div>
        <div
          style={{
            width: "100%",
            height: "100%",
            ...dynamicSizes.timelineSliderContainer,
          }}
        >
          <TimelineSlider
            resolution={{ ...uiState.resolution }}
            hash={`${effect.key}|t1`}
            size={dynamicSizes.timelineTrackSize}
            trackRef={timelineTrackRef}
            trackBackground={"rgb(60, 60, 60)"}
            cursor={startCursor}
            onNewCursor={async (c) => {
              const newStart = cursorToTime(c.x);
              if (selectedEffectUnitKeys.has(effect.key)) {
                const currentStart = convertTime(effect.value.start, "sec", coreState.timelineUnit);
                const delta = newStart - currentStart;
                await Promise.all(
                  Array.from(selectedEffectUnitKeys).map(async (key) => {
                    const item = coreState.effects.find((e) => e.key === key);
                    if (item) {
                      const iStart = convertTime(item.value.start, "sec", coreState.timelineUnit);
                      const iEnd = convertTime(item.value.end, "sec", coreState.timelineUnit);
                      const duration = iEnd - iStart;
                      let nStart = iStart + delta;
                      let nEnd = iEnd + delta;
                      if (nStart < 0) {
                        nStart = 0;
                        nEnd = duration;
                      } else if (nEnd > coreState.timelineMaxValue) {
                        nEnd = coreState.timelineMaxValue;
                        nStart = Math.max(0, nEnd - duration);
                      }
                      if (key === effect.key) {
                        setStartCursor({ x: timeToCursor(nStart), y: 0 });
                        setEndCursor({ x: timeToCursor(nEnd), y: 0 });
                        if (startRef.current) startRef.current.value = nStart.toFixed(2);
                        if (endRef.current) endRef.current.value = nEnd.toFixed(2);
                      }
                      const rollback: LaurusEffect = { ...item };
                      const updatedEffect: LaurusEffect = {
                        ...rollback,
                        value: {
                          ...rollback.value,
                          start: convertTime(nStart, coreState.timelineUnit, "sec"),
                          end: convertTime(nEnd, coreState.timelineUnit, "sec"),
                        },
                      } as LaurusEffect;
                      await saveEffect(updatedEffect, rollback);
                    }
                  }),
                );
                return;
              }
              const newEnd = getNewEndTime(c.x);
              setStartCursor({ ...c });
              if (newEnd[1] && endRef.current) {
                setEndCursor({ ...endCursor, x: c.x });
                endRef.current.value = newStart.toFixed(2);
              }
              const rollback: LaurusEffect = { ...effect };
              const updatedEffect: LaurusEffect = {
                ...rollback,
                value: {
                  ...rollback.value,
                  start: convertTime(newStart, coreState.timelineUnit, "sec"),
                  end: convertTime(newEnd[0], coreState.timelineUnit, "sec"),
                },
              } as LaurusEffect;
              await saveEffect(updatedEffect, rollback);
            }}
            rangeCursor={endCursor}
            onNewRangeCursor={async (c) => {
              const newEnd = cursorToTime(c.x);
              if (selectedEffectUnitKeys.has(effect.key)) {
                const currentEnd = convertTime(effect.value.end, "sec", coreState.timelineUnit);
                const delta = newEnd - currentEnd;
                await Promise.all(
                  Array.from(selectedEffectUnitKeys).map(async (key) => {
                    const item = coreState.effects.find((e) => e.key === key);
                    if (item) {
                      const iStart = convertTime(item.value.start, "sec", coreState.timelineUnit);
                      const iEnd = convertTime(item.value.end, "sec", coreState.timelineUnit);
                      const duration = iEnd - iStart;
                      let nStart = iStart + delta;
                      let nEnd = iEnd + delta;
                      if (nStart < 0) {
                        nStart = 0;
                        nEnd = duration;
                      } else if (nEnd > coreState.timelineMaxValue) {
                        nEnd = coreState.timelineMaxValue;
                        nStart = Math.max(0, nEnd - duration);
                      }
                      if (key === effect.key) {
                        setStartCursor({ x: timeToCursor(nStart), y: 0 });
                        setEndCursor({ x: timeToCursor(nEnd), y: 0 });
                        if (startRef.current) startRef.current.value = nStart.toFixed(2);
                        if (endRef.current) endRef.current.value = nEnd.toFixed(2);
                      }
                      const rollback: LaurusEffect = { ...item };
                      const updatedEffect: LaurusEffect = {
                        ...rollback,
                        value: {
                          ...rollback.value,
                          start: convertTime(nStart, coreState.timelineUnit, "sec"),
                          end: convertTime(nEnd, coreState.timelineUnit, "sec"),
                        },
                      } as LaurusEffect;
                      await saveEffect(updatedEffect, rollback);
                    }
                  }),
                );
                return;
              }
              const newStart = getNewStartTime(c.x);
              setEndCursor({ ...c });
              if (newStart[1] && startRef.current) {
                setStartCursor({ ...startCursor, x: c.x });
                startRef.current.value = newEnd.toFixed(2);
              }
              const rollback: LaurusEffect = { ...effect };
              const updatedEffect: LaurusEffect = {
                ...rollback,
                value: {
                  ...rollback.value,
                  start: convertTime(newStart[0], coreState.timelineUnit, "sec"),
                  end: convertTime(newEnd, coreState.timelineUnit, "sec"),
                },
              } as LaurusEffect;
              await saveEffect(updatedEffect, rollback);
            }}
            onCursorMove={(c) => {
              if (!startRef.current || effect.value.locked) return;
              const newValue = cursorToTime(c.x);
              startRef.current.value = newValue.toFixed(2);
            }}
            onRangeMove={(c) => {
              if (!endRef.current || effect.value.locked) return;
              const newValue = cursorToTime(c.x);
              endRef.current.value = newValue.toFixed(2);
            }}
            disabled={effect.value.locked || isAltKeyPressed}
            isSelected={selectedEffectUnitKeys.has(effect.key)}
            startTitle={startTitle}
            endTitle={endTitle}
          />
        </div>
        <div
          style={{
            width: "100%",
            ...dynamicSizes.footer,
          }}
        />
        {showUnitControls &&
          (() => {
            switch (effect.type) {
              case "scale": {
                return <ScaleUnit scale={effect.value} carouselIndexInit={scaleCarouselIndex} />;
              }
              case "move": {
                return <MoveUnit move={effect.value} carouselIndexInit={moveCarouselIndex} />;
              }
              case "rotate": {
                return <RotateUnit rotate={effect.value} carouselIndexInit={rotateCarouselIndex} />;
              }
            }
          })()}
      </div>
      <EffectUnitbar
        effect={effect}
        showUnitControls={showUnitControls}
        saveEffect={saveEffect}
        setShowUnitControls={setShowUnitControls}
        setMoveCarouselIndex={setMoveCarouselIndex}
        setRotateCarouselIndex={setRotateCarouselIndex}
        setScaleCarouselIndex={setScaleCarouselIndex}
      />
    </div>
  );
}

interface EffectDescription {
  effectKey: string;
  effectDescriptionInit: string;
}
function EffectDescription({ effectKey, effectDescriptionInit }: EffectDescription) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [effectDescription, setEffectDescription] = useState<string>(effectDescriptionInit);
  const [effectDescriptionSnapshot] = useState<string>(effectDescriptionInit);
  const effectDescriptionHook = useDebounce<string>(effectDescription, 300);
  const dependenciesRef = useRef<LaurusEffect | undefined>(undefined);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return { fontSize: 13, padding: 6 };
      case "midhigh":
        return { fontSize: 12, padding: 6 };
      case "midlow":
      case "low":
        return { fontSize: 10, padding: 6 };
    }
  });
  const effectDescriptionInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      if (!dependenciesRef.current || !effectDescriptionInputRef.current) return;
      if (effectDescriptionHook) {
        const effect: LaurusEffect = { ...dependenciesRef.current };
        switch (effect.type) {
          case "scale": {
            const newScale: LaurusScaleResult = {
              ...effect.value,
              description: effectDescriptionHook,
            };
            const updated = await updateScale(coreState.apiOrigin, coreState.accessToken, effect.key, newScale);
            if (updated) {
              const newEffect: LaurusEffect = {
                ...effect,
                value: {
                  ...newScale,
                },
              };
              dispatch({ type: CoreActionType.SetEffect, value: newEffect, preserveCache: true });
            } else {
              effectDescriptionInputRef.current.value = effectDescriptionSnapshot;
            }
            break;
          }
          case "move": {
            const newMove: LaurusMoveResult = {
              ...effect.value,
              description: effectDescriptionHook,
            };
            const updated = await updateMove(coreState.apiOrigin, coreState.accessToken, effect.key, newMove);
            if (updated) {
              const newEffect: LaurusEffect = {
                ...effect,
                value: {
                  ...newMove,
                },
              };
              dispatch({ type: CoreActionType.SetEffect, value: newEffect, preserveCache: true });
            } else {
              effectDescriptionInputRef.current.value = effectDescriptionSnapshot;
            }
            break;
          }
          case "rotate": {
            const newRotate: LaurusRotateResult = {
              ...effect.value,
              description: effectDescriptionHook,
            };
            const updated = await updateRotate(coreState.apiOrigin, coreState.accessToken, effect.key, newRotate);
            if (updated) {
              const newEffect: LaurusEffect = {
                ...effect,
                value: {
                  ...newRotate,
                },
              };
              dispatch({ type: CoreActionType.SetEffect, value: newEffect, preserveCache: true });
            } else {
              effectDescriptionInputRef.current.value = effectDescriptionSnapshot;
            }
            break;
          }
        }
      }
    })();
  }, [coreState.accessToken, coreState.apiOrigin, dispatch, effectDescriptionHook, effectDescriptionSnapshot]);

  const onEffectDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const effect = coreState.effects.find((e) => e.key == effectKey);
      if (!effect) return;

      switch (effect.type) {
        case "scale": {
          const newEffect: LaurusScaleResult = {
            ...effect.value,
            description: e.target.value,
          };
          dependenciesRef.current = { ...effect, value: { ...newEffect } };
          setEffectDescription(e.target.value);
          break;
        }
        case "move": {
          const newEffect: LaurusMoveResult = {
            ...effect.value,
            description: e.target.value,
          };
          dependenciesRef.current = { ...effect, value: { ...newEffect } };
          setEffectDescription(e.target.value);
          break;
        }
        case "rotate": {
          const newEffect: LaurusRotateResult = {
            ...effect.value,
            description: e.target.value,
          };
          dependenciesRef.current = { ...effect, value: { ...newEffect } };
          setEffectDescription(e.target.value);
          break;
        }
      }
    },
    [coreState.effects, effectKey],
  );

  return (
    <>
      <input
        id={`effect-description-input-${effectKey}`}
        ref={effectDescriptionInputRef}
        className={dellaRespira.className}
        type="text"
        placeholder="describe me..."
        style={{
          textAlign: "center",
          background: "none",
          color: "rgb(220, 220, 220)",
          border: "none",
          outline: "none",
          height: "100%",
          display: "inline-block",
          overflowX: "scroll",
          width: "100%",
          ...dynamicSizes,
        }}
        value={effectDescription}
        onChange={onEffectDescriptionChange}
      />
    </>
  );
}
