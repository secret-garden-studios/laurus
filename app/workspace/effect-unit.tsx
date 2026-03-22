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
            case "low": return { font: 10, height: 14, paddingLeft: 4 }
        }
    });
    const [timelineTrackCapsSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return { height: 54, width: 17 }
            case "midhigh": return { height: 53, width: 16 }
            case "midlow":
            case "low": return { height: 48, width: 16 }
        }
    });
    const [timelineTrackSize] = useState({ width: '100%', height: timelineTrackCapsSize.height });
    const [trackSidePadding] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return 15
            case "midhigh": return 14
            case "midlow":
            case "low": return 14
        }
    });
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);

    const [startCapSize] = useState({ width: timelineTrackCapsSize.width, height: timelineTrackCapsSize.height });
    const [startCursor, setStartCursor] = useState({ x: 0, y: 0 });
    const startRef = useRef<HTMLInputElement | null>(null);
    const [endCapSize] = useState({ width: timelineTrackCapsSize.width, height: timelineTrackCapsSize.height });
    const [endCursor, setEndCursor] = useState({ x: 0, y: 0 });
    const endRef = useRef<HTMLInputElement | null>(null);

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
    const adjustEndCursor = useCallback((newX: number): number => {
        if (endCursor.x < newX && endRef.current) {
            const newValue = cursorToTime(newX);
            setEndCursor({ ...endCursor, x: newX });
            endRef.current.value = newValue.toFixed(2);
            return newValue;
        }
        return cursorToTime(endCursor.x);
    }, [cursorToTime, endCursor]);

    const adjustStartCursor = useCallback((newX: number): number => {
        if (startCursor.x > newX && startRef.current) {
            const newValue = cursorToTime(newX);
            setStartCursor({ ...startCursor, x: newX });
            startRef.current.value = newValue.toFixed(2);
            return newValue;
        }
        return cursorToTime(startCursor.x);
    }, [cursorToTime, startCursor]);

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
            const startInit = Math.min(appState.timelineMaxValue, Math.max(0, effect.value.start));
            const endInit = Math.min(appState.timelineMaxValue, Math.max(0, effect.value.end));

            const newStartCursor = timeToCursor(startInit);
            const newEndCursor = timeToCursor(endInit);
            setStartCursor({ x: newStartCursor, y: 0 });
            setEndCursor({ x: newEndCursor, y: 0 });

            if (startRef.current) {
                const newStart = cursorToTime(newStartCursor);
                startRef.current.value = newStart.toFixed(2);
            }

            if (endRef.current) {
                const newEnd = cursorToTime(newEndCursor);
                endRef.current.value = newEnd.toFixed(2);
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

    const [timelineUnitsSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                height: 30,
                fontSize: 12,
                gap: 4,
                inputFontSize: 10,
                inputWidth: 30,
            }
            case "midhigh": return {
                height: 26,
                fontSize: 11,
                gap: 3,
                inputFontSize: 10,
                inputWidth: 26,
            }
            case "midlow":
            case "low": return {
                height: 26,
                fontSize: 11,
                gap: 4,
                inputFontSize: 9,
                inputWidth: 28,
            }
        }
    });
    const [timelineDropDownSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                height: 24,
                padding: '0px 4px',
                svg: 17
            }
            case "midhigh": return {
                height: 22,
                padding: '0px 2px',
                svg: 16
            }
            case "midlow":
            case "low": return {
                height: 20,
                padding: '0px 1px',
                svg: 16
            }
        }
    });

    return (
        <div style={{ display: 'grid' }} key={effect.key}>
            <div
                style={{
                    width: '100%',
                    height: timelineUnitsSize.height,
                    padding: "0px 0px 0px 8px",
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: timelineUnitsSize.fontSize,
                    color: 'rgb(227, 227, 227)'
                }}>
                <div style={{ display: 'flex', height: '100%', gap: timelineUnitsSize.gap, alignItems: 'center' }}>
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>{'start'}</div>
                    <input
                        id={`start-input-${effect.key}`}
                        ref={startRef}
                        type="text"
                        placeholder="0.00"
                        onChange={() => {
                            if (!timelineTrackRef.current || !startRef.current) return;
                            const newStart: number = parseFloat(startRef.current.value) || 0;

                            const newCursor: number = timeToCursor(newStart);
                            setStartCursor(v => { return { ...v, x: newCursor } });
                            const newEnd = adjustEndCursor(newCursor);

                            const newEffect: LaurusEffect = injectTime(effect, newStart, newEnd);
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
                            height: '100%',
                            display: 'inline-block',
                            overflowX: 'scroll',
                            fontSize: timelineUnitsSize.inputFontSize,
                            width: timelineUnitsSize.inputWidth,
                        }}
                    />
                </div>
                <div style={{ display: 'flex', height: '100%', gap: 4, alignItems: 'center' }}>
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>{'end'}</div>
                    <input
                        id={`end-input-${effect.key}`}
                        ref={endRef}
                        type="text"
                        placeholder="0.00"
                        onChange={() => {
                            if (!timelineTrackRef.current || !endRef.current) return;
                            const newDuration: number = parseFloat(endRef.current.value) || 0;

                            const newCursor: number = timeToCursor(newDuration);
                            setEndCursor(v => { return { ...v, x: newCursor } });
                            const newOffset = adjustStartCursor(newCursor);

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
                            height: '100%',
                            display: 'inline-block',
                            overflowX: 'scroll',
                            fontSize: timelineUnitsSize.inputFontSize,
                            width: timelineUnitsSize.inputWidth,
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
                    capSize={startCapSize}
                    rangeCapSize={endCapSize}
                    trackSize={timelineTrackSize}
                    trackRef={timelineTrackRef}
                    cursor={startCursor}
                    onNewCursor={async (c) => {
                        setStartCursor({ ...c });
                        const adjustedDuration = adjustEndCursor(c.x);
                        const newOffset: number = cursorToTime(c.x);
                        const newEffect = injectTime(effect, newOffset, adjustedDuration);
                        await saveEffect(newEffect);
                    }}
                    rangeCursor={endCursor}
                    onNewRangeCursor={async (c) => {
                        setEndCursor({ ...c });
                        const adjustedOffset = adjustStartCursor(c.x);
                        const newDuration: number = cursorToTime(c.x);
                        const newEffect = injectTime(effect, adjustedOffset, newDuration);
                        await saveEffect(newEffect);
                    }}
                    onCursorMove={(c) => {
                        if (!startRef.current) return;
                        const newValue = cursorToTime(c.x);
                        startRef.current.value = newValue.toFixed(2);
                    }}
                    onRangeMove={(c) => {
                        if (!endRef.current) return;
                        const newValue = cursorToTime(c.x);
                        endRef.current.value = newValue.toFixed(2);
                    }}
                />
            </div>
            <div
                style={{
                    width: '100%',
                    height: timelineDropDownSize.height,
                    padding: timelineDropDownSize.padding,
                    display: 'flex',
                    justifyContent: 'end'
                }}>
                <SvgRepo
                    svg={showUnitControls ? arrowDropUp() : arrowDropDown()}
                    containerSize={{
                        width: timelineDropDownSize.svg,
                        height: timelineDropDownSize.svg
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

