import { RefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import ScaleUnit from "./scale-unit";
import { convertTime, LaurusEffect, LaurusScale, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { arrowDropDown, arrowDropUp, SvgRepo } from "../svg-repo";
import { MoveResult_V1_0, ScaleResult_V1_0, updateMove, updateScale } from "./workspace.server";
import useDebounce from "../hooks/useDebounce";
import { useTrackpadState } from "../hooks/useTrackpadState";
import MoveUnit from "./move-unit";
import TimelineSlider from "../components/timeline-slider";

function injectTime(
    e: LaurusEffect,
    newOffset: number,
    newDuration: number): LaurusEffect {
    switch (e.type) {
        case "scale": {
            const newEffect: LaurusEffect = {
                ...e,
                value: {
                    ...e.value,
                    start: newOffset,
                    end: newDuration,
                }
            };
            return newEffect;
        }
        case "move": {
            const newEffect: LaurusEffect = {
                ...e,
                value: {
                    ...e.value,
                    start: newOffset,
                    end: newDuration,
                }
            };
            return newEffect;
        }
    }
}

interface EffectUnit {
    effect: LaurusEffect,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}
export default function EffectUnit({ effect, svgElementsRef, imgElementsRef }: EffectUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [showUnitControls, setShowUnitControls] = useState(false);

    const [timelineTrackLabelSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return { font: 12, height: 22, paddingLeft: 7 }
            case "midhigh": return { font: 11, height: 16, paddingLeft: 5 }
            case "midlow": return { font: 10, height: 14, paddingLeft: 4 }
            case "midlow": return { font: 10, height: 14, paddingLeft: 4 }
        }
    });
    const [timelineTrackSize] = useState({ width: '100%', height: 54 });
    const [trackSidePadding] = useState(15);
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);

    const [offsetCapSize] = useState({ width: 17, height: 54 });
    const [offsetCursor, setOffsetCursor] = useState({ x: 0, y: 0 });
    const offsetRef = useRef<HTMLInputElement | null>(null);
    const [durationCapSize] = useState({ width: 17, height: 54 });
    const [durationCursor, setDurationCursor] = useState({ x: 0, y: 0 });
    const durationRef = useRef<HTMLInputElement | null>(null);

    const { getTrackValue: getTimeCursor, getTrackCursor: getCursor } =
        useTrackpadState(0, appState.timelineMaxValue);
    const cursorToTime = useCallback((cursorX: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeCursor(cursorX, (timelineTrackRef.current.clientWidth - trackSidePadding), 0);
    }, [getTimeCursor, trackSidePadding]);
    const timeToCursor = useCallback((time: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getCursor(time, (timelineTrackRef.current.clientWidth - trackSidePadding));
    }, [getCursor, trackSidePadding]);

    const debounceDependenciesRef = useRef<LaurusEffect | undefined>(undefined);
    const [debounceInput, setDebounceInput] = useState<LaurusEffect>(effect);
    const effectDebouncer = useDebounce(debounceInput, 1000);
    const adjustDurationCursor = useCallback((newX: number): number => {
        if (durationCursor.x < newX && durationRef.current) {
            const newValue = cursorToTime(newX);
            setDurationCursor({ ...durationCursor, x: newX });
            durationRef.current.value = newValue.toFixed(2);
            return newValue;
        }
        return cursorToTime(durationCursor.x);
    }, [cursorToTime, durationCursor]);

    const adjustOffsetCursor = useCallback((newX: number): number => {
        if (offsetCursor.x > newX && offsetRef.current) {
            const newValue = cursorToTime(newX);
            setOffsetCursor({ ...offsetCursor, x: newX });
            offsetRef.current.value = newValue.toFixed(2);
            return newValue;
        }
        return cursorToTime(offsetCursor.x);
    }, [cursorToTime, offsetCursor]);

    const saveEffect = useCallback(async (effect: LaurusEffect) => {
        switch (effect.type) {
            case "scale": {
                const effectForServer = injectTime(
                    effect,
                    convertTime(effect.value.start, appState.timelineUnit, 'sec'),
                    convertTime(effect.value.end, appState.timelineUnit, 'sec'));
                const response = await updateScale(
                    appState.apiOrigin,
                    effectForServer.key,
                    effectForServer.value as ScaleResult_V1_0);
                if (!response) return;
                const newEffect: LaurusEffect = {
                    type: 'scale',
                    key: response.scale_id,
                    value: {
                        ...response,
                        start: convertTime(response.start, 'sec', appState.timelineUnit),
                        end: convertTime(response.end, 'sec', appState.timelineUnit)
                    }
                };
                dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                break;
            }
            case "move": {
                const effectForServer = injectTime(
                    effect,
                    convertTime(effect.value.start, appState.timelineUnit, 'sec'),
                    convertTime(effect.value.end, appState.timelineUnit, 'sec'));
                const response = await updateMove(
                    appState.apiOrigin,
                    effectForServer.key,
                    effectForServer.value as MoveResult_V1_0);
                if (!response) return;
                const newEffect: LaurusEffect = {
                    type: 'move',
                    key: response.move_id,
                    value: {
                        ...response,
                        start: convertTime(response.start, 'sec', appState.timelineUnit),
                        end: convertTime(response.end, 'sec', appState.timelineUnit)
                    }
                };
                dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                break;
            }
        }

    }, [appState.apiOrigin, appState.timelineUnit, dispatch]);

    useLayoutEffect(() => {
        (async () => {
            const offsetInit = Math.min(appState.timelineMaxValue, Math.max(0, effect.value.start));
            const durationInit = Math.min(appState.timelineMaxValue, Math.max(0, effect.value.end));

            const newOffsetCursor = timeToCursor(offsetInit);
            const newDurationCursor = timeToCursor(durationInit);
            setOffsetCursor({ x: newOffsetCursor, y: 0 });
            setDurationCursor({ x: newDurationCursor, y: 0 });

            if (offsetRef.current) {
                const newOffset = cursorToTime(newOffsetCursor);
                offsetRef.current.value = newOffset.toFixed(2);
            }

            if (durationRef.current) {
                const newDuration = cursorToTime(newDurationCursor);
                durationRef.current.value = newDuration.toFixed(2);
            }
        })();

    }, [appState.timelineMaxValue, cursorToTime, effect.value, timeToCursor]);

    // pushes data from input boxes to the server on a delay
    useEffect(() => {
        if (debounceDependenciesRef.current) {
            switch (debounceDependenciesRef.current.type) {
                case "scale": {
                    const newScale: LaurusScale = {
                        ...debounceDependenciesRef.current.value,
                        start: convertTime(effectDebouncer.value.start, appState.timelineUnit, 'sec'),
                        end: convertTime(effectDebouncer.value.end, appState.timelineUnit, 'sec')
                    };
                    dispatch({ type: WorkspaceActionType.SetEffect, value: { ...effectDebouncer } });
                    updateScale(appState.apiOrigin, debounceDependenciesRef.current.key, newScale);
                    debounceDependenciesRef.current = undefined;
                    break;
                }
                case "move": {
                    break;
                }
            }
        }
    }, [appState.apiOrigin, effectDebouncer, appState.timelineUnit, dispatch]);

    return (
        <div style={{ display: 'grid' }} key={effect.key}>
            <div
                style={{
                    width: '100%',
                    height: 24,
                    padding: "0px 0px 0px 8px",
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                    color: 'rgb(227, 227, 227)'
                }}>
                <div style={{ display: 'flex', height: '100%', gap: 4, alignItems: 'center' }}>
                    <div>{'start'}</div>
                    <input
                        id={`offset-input-${effect.key}`}
                        ref={offsetRef}
                        type="text"
                        placeholder="0.00"
                        onChange={() => {
                            if (!timelineTrackRef.current || !offsetRef.current) return;
                            const newOffset: number = parseFloat(offsetRef.current.value) || 0;

                            const newCursor: number = timeToCursor(newOffset);
                            setOffsetCursor(v => { return { ...v, x: newCursor } });
                            const newDuration = adjustDurationCursor(newCursor);

                            const newEffect: LaurusEffect = injectTime(effect, newOffset, newDuration);
                            setDebounceInput(newEffect);
                            debounceDependenciesRef.current = { ...effect };
                        }}
                        style={{
                            textAlign: "left",
                            background: 'none',
                            color: "rgba(255, 255, 255, 0.8)",
                            borderRadius: "2px",
                            border: 'none',
                            outline: 'none',
                            lineHeight: '1',
                            display: 'inline-block',
                            overflowX: 'scroll',
                            fontSize: 10,
                            width: 30,
                        }}
                    />
                </div>
                <div style={{ display: 'flex', height: '100%', gap: 4, alignItems: 'center' }}>
                    <div >{'end'}</div>
                    <input
                        id={`duration-input-${effect.key}`}
                        ref={durationRef}
                        type="text"
                        placeholder="0.00"
                        onChange={() => {
                            if (!timelineTrackRef.current || !durationRef.current) return;
                            const newDuration: number = parseFloat(durationRef.current.value) || 0;

                            const newCursor: number = timeToCursor(newDuration);
                            setDurationCursor(v => { return { ...v, x: newCursor } });
                            const newOffset = adjustOffsetCursor(newCursor);

                            const newEffect: LaurusEffect = injectTime(effect, newOffset, newDuration);
                            setDebounceInput(newEffect);
                            debounceDependenciesRef.current = { ...effect };
                        }}
                        style={{
                            textAlign: "left",
                            background: 'none',
                            color: "rgba(255, 255, 255, 0.8)",
                            borderRadius: "2px",
                            border: 'none',
                            outline: 'none',
                            lineHeight: '1',
                            display: 'inline-block',
                            overflowX: 'scroll',
                            fontSize: 10,
                            width: 30,
                        }}
                    />
                </div>
            </div>
            <div style={{
                width: '100%',
                padding: `0px ${trackSidePadding}px 0px ${trackSidePadding}px`,
            }}>
                <TimelineSlider
                    label={effect.type}
                    labelSize={timelineTrackLabelSize}
                    hash={`${effect.key}|t1`}
                    capSize={offsetCapSize}
                    rangeCapSize={durationCapSize}
                    trackSize={timelineTrackSize}
                    trackRef={timelineTrackRef}
                    cursor={offsetCursor}
                    onNewCursor={async (c) => {
                        setOffsetCursor({ ...c });
                        const adjustedDuration = adjustDurationCursor(c.x);
                        const newOffset: number = cursorToTime(c.x);
                        const newEffect = injectTime(effect, newOffset, adjustedDuration);
                        await saveEffect(newEffect);
                    }}
                    rangeCursor={durationCursor}
                    onNewRangeCursor={async (c) => {
                        setDurationCursor({ ...c });
                        const adjustedOffset = adjustOffsetCursor(c.x);
                        const newDuration: number = cursorToTime(c.x);
                        const newEffect = injectTime(effect, adjustedOffset, newDuration);
                        await saveEffect(newEffect);
                    }}
                    onCursorMove={(c) => {
                        if (!offsetRef.current) return;
                        const newValue = cursorToTime(c.x);
                        offsetRef.current.value = newValue.toFixed(2);
                    }}
                    onRangeMove={(c) => {
                        if (!durationRef.current) return;
                        const newValue = cursorToTime(c.x);
                        durationRef.current.value = newValue.toFixed(2);
                    }}
                />
            </div>
            <div
                style={{
                    width: '100%', height: 24,
                    padding: 6, display: 'flex', justifyContent: 'end'
                }}>
                <SvgRepo
                    svg={showUnitControls ? arrowDropUp() : arrowDropDown()}
                    containerSize={{
                        width: 17,
                        height: 17
                    }}
                    scale={1}
                    onContainerClick={() => setShowUnitControls(v => !v)} />
            </div>
            {showUnitControls && (() => {
                switch (effect.type) {
                    case "scale": {
                        return <ScaleUnit
                            scale={effect.value}
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef} />
                    }
                    case "move": {
                        return <MoveUnit
                            move={effect.value}
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef} />
                    }
                }
            })()}
        </div>
    );
}

