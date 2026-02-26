import { RefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PointerStyle, Trackpad } from "../components/trackpad";
import ScaleUnit from "./scale-unit";
import { convertTime, LaurusEffect, LaurusScale, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { ReactSvg } from "./media";
import { circle } from "../svg-repo";
import { ScaleResult_V1_0, updateScale } from "./workspace.server";
import useDebounce from "../hooks/useDebounce";
import { useTrackpadState } from "../hooks/useTrackpadState";

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
                    offset: newOffset,
                    duration: newDuration,
                }
            };
            return newEffect;
        }
        case "move": {
            const newEffect: LaurusEffect = {
                ...e,
                value: {
                    ...e.value,
                    offset: newOffset,
                    duration: newDuration,
                }
            };
            return newEffect;
        }
    }
}

interface EffectUnitProps {
    effect: LaurusEffect,
}

export default function EffectUnit({ effect }: EffectUnitProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [showUnitControls, setShowUnitControls] = useState(false);

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
        return getTimeCursor(cursorX, (timelineTrackRef.current.clientWidth - trackSidePadding));
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
                    convertTime(effect.value.offset, appState.timelineUnit, 'sec'),
                    convertTime(effect.value.duration, appState.timelineUnit, 'sec'));
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
                        offset: convertTime(response.offset, 'sec', appState.timelineUnit),
                        duration: convertTime(response.duration, 'sec', appState.timelineUnit)
                    }
                };
                dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                break;
            }
            case "move": {
                break;
            }
        }

    }, [appState.apiOrigin, appState.timelineUnit, dispatch]);

    useLayoutEffect(() => {
        /*  reads the current track width and updates sliders 
            using initial values from a parent component */

        (async () => {
            const offsetInit = Math.min(appState.timelineMaxValue, Math.max(0, effect.value.offset));
            const durationInit = Math.min(appState.timelineMaxValue, Math.max(0, effect.value.duration));

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

    useEffect(() => {
        /* on a delay, pushes data from input boxes to the server */

        if (debounceDependenciesRef.current) {
            switch (debounceDependenciesRef.current.type) {
                case "scale": {
                    const newScale: LaurusScale = {
                        ...debounceDependenciesRef.current.value,
                        offset: convertTime(effectDebouncer.value.offset, appState.timelineUnit, 'sec'),
                        duration: convertTime(effectDebouncer.value.duration, appState.timelineUnit, 'sec')
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
                    width: '100%', height: 24,
                    padding: "0px 6px 0px 8px",
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                    color: 'rgba(255,255,255,1)'
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
                    label={"scale"}
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
                <ReactSvg
                    svg={circle()}
                    containerSize={{
                        width: 12,
                        height: 12
                    }}
                    scale={0.9}
                    onContainerClick={() => setShowUnitControls(v => !v)} />
            </div>
            {showUnitControls && (() => {
                switch (effect.type) {
                    case "scale": {
                        return <ScaleUnit scale={effect.value} />
                    }
                    case "move": {
                        return <></>
                    }
                }
            })()}
        </div>
    );
}

interface TimelineSliderProps {
    label: string,
    hash: string,
    trackSize: { width: number | string, height: number | string }
    trackRef: RefObject<HTMLDivElement | null>,

    capSize: { width: number | string, height: number | string }
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,

    rangeCapSize: { width: number | string, height: number | string }
    rangeCursor: { x: number, y: number },
    onNewRangeCursor: (newCursor: { x: number, y: number }) => void,
    onRangeMove?: (newCursor: { x: number, y: number }) => void,
}
function TimelineSlider({
    label,
    hash,
    trackSize,
    trackRef,
    capSize,
    cursor,
    onNewCursor,
    onCursorMove,
    rangeCapSize,
    rangeCursor,
    onNewRangeCursor,
    onRangeMove,
}: TimelineSliderProps) {
    return (<>
        <div style={{ width: '100%', height: '100%', }}>
            <div
                style={{
                    position: "relative",
                    ...trackSize,
                    alignContent: 'center',
                }}>
                <div style={{ position: 'absolute', width: '100%', alignSelf: 'center', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
                        width={'100%'}
                        height={capSize.height}
                        coarsePointer={{
                            ...capSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={onCursorMove} />
                </div>
                <div style={{ position: 'absolute', width: '100%', alignSelf: 'center', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c2`, draggableId: `${hash}|d2` }}
                        width={'100%'}
                        height={rangeCapSize.height}
                        coarsePointer={{
                            ...rangeCapSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={rangeCursor}
                        onNewValue={onNewRangeCursor}
                        onMove={onRangeMove} />
                </div>
                <div
                    style={{
                        zIndex: 1,
                        top: 0,
                        width: trackSize.width,
                        height: 20,
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        display: 'flex',
                        justifyContent: 'start',
                        background: "linear-gradient(45deg, rgb(11, 11, 11), rgb(25, 25, 25))",
                        border: '1px solid rgb(27, 27, 27)',
                        fontSize: 10,
                        paddingLeft: 7,
                        alignItems: 'center',
                        color: 'rgba(200,200,200,1)',
                    }}
                >
                    {label}
                    <ReactSvg
                        svg={circle('rgba(200,200,200,0.7)')}
                        containerSize={{
                            width: 10,
                            height: 10
                        }}
                        scale={0.8} />
                </div>
                <div
                    ref={trackRef}
                    style={{
                        zIndex: 0,
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        ...trackSize,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(27, 27, 27)',
                        borderBottomLeftRadius: 10,
                        borderBottomRightRadius: 10,
                        boxShadow: "rgba(0, 0, 0, 0.7) -10px -10px 40px inset",
                    }}
                />
            </div>
        </div>
    </>)
}
