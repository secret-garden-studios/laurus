import { RefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PointerStyle, Trackpad } from "../components/trackpad";
import ScaleUnit from "./scale-unit";
import { convertTime, LaurusEffect, LaurusScale, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { ReactSvg } from "./media";
import { circle } from "../svg-repo";
import { ScaleResult_V1_0, updateScale } from "./workspace.server";
import useDebounce from "../hooks/useDebounce";

function setTime(
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
            return e;
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

    // used to perform a delayed auto-save on input box changes
    const localEffectRef = useRef<LaurusEffect | undefined>(undefined);
    const [offsetDebounceInput, setOffsetDebounceInput] = useState(effect.value.offset);
    const offsetDebounce = useDebounce(offsetDebounceInput, 1000);
    const [durationDebounceInput, setDurationDebounceInput] = useState(effect.value.offset);
    const durationDebounce = useDebounce(durationDebounceInput, 1000);

    const cursorToTime = useCallback((cursorX: number): number => {
        if (!timelineTrackRef.current) return 0;
        const percentage = cursorX / (timelineTrackRef.current.clientWidth - trackSidePadding);
        return percentage * appState.timelineMaxValue;
    }, [appState.timelineMaxValue, trackSidePadding]);

    const timeToCursor = useCallback((time: number): number => {
        if (!timelineTrackRef.current) return 0;
        const percentage = time / appState.timelineMaxValue;
        return percentage * (timelineTrackRef.current.clientWidth - trackSidePadding);
    }, [appState.timelineMaxValue, trackSidePadding]);

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

    const updateAndDispatchEffect = useCallback(async (effect: LaurusEffect) => {
        setOffsetDebounceInput(effect.value.offset);
        setDurationDebounceInput(effect.value.duration);

        switch (effect.type) {
            case "scale": {
                const effectForServer = setTime(
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
                const newEffects: LaurusEffect[] = appState.effects.map(e => e.key == newEffect.key ? newEffect : e);
                dispatch({ type: WorkspaceActionType.SetEffects, value: newEffects });
                break;
            }
            case "move": {
                break;
            }
        }

    }, [appState.apiOrigin, appState.effects, dispatch, appState.timelineUnit]);

    useEffect(() => {
        /* on a delay, pushes data from input boxes to the server */
        if (localEffectRef.current) {
            switch (localEffectRef.current.type) {
                case "scale": {
                    const newScale: LaurusScale = {
                        ...localEffectRef.current.value,
                        offset: convertTime(offsetDebounce, appState.timelineUnit, 'sec'),
                        duration: convertTime(durationDebounce, appState.timelineUnit, 'sec')
                    };
                    updateScale(appState.apiOrigin, localEffectRef.current.key, newScale);
                    localEffectRef.current = undefined;
                    break;
                }
                case "move": {
                    break;
                }
            }
        }
    }, [appState.apiOrigin, durationDebounce, offsetDebounce, appState.timelineUnit]);

    useLayoutEffect(() => {
        /*  reads the current track width and updates sliders 
            using initial values from the parent component */
        const e = {
            offset: Math.min(appState.timelineMaxValue, Math.max(0, effect.value.offset)),
            duration: Math.min(appState.timelineMaxValue, Math.max(0, effect.value.duration))
        };

        (async (e) => {
            const offsetX = timeToCursor(e.offset);
            const durationX = timeToCursor(e.duration);
            setOffsetCursor({ x: offsetX, y: 0 });
            setDurationCursor({ x: durationX, y: 0 });
        })({ ...e });

        if (offsetRef.current) {
            offsetRef.current.value = e.offset.toFixed(2);
        }
        if (durationRef.current) {
            durationRef.current.value = e.duration.toFixed(2);
        }
    }, [appState.timelineMaxValue, effect.value, timeToCursor]);

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
                        ref={offsetRef}
                        type="text"
                        placeholder="0.00"
                        onChange={() => {
                            if (!timelineTrackRef.current || !offsetRef.current) return;
                            const newOffset: number = parseFloat(offsetRef.current.value) || 0;
                            if (newOffset > appState.timelineMaxValue) return;

                            const newCursor: number = timeToCursor(newOffset);
                            setOffsetCursor(v => { return { ...v, x: newCursor } });
                            const newDuration = adjustDurationCursor(newCursor);

                            const newEffects: LaurusEffect[] = appState.effects.map(e => {
                                if (e.key == effect.key) {
                                    return setTime(effect, newOffset, newDuration);
                                }
                                else {
                                    return e;
                                }
                            })
                            dispatch({ type: WorkspaceActionType.SetEffects, value: newEffects });

                            setOffsetDebounceInput(newOffset);
                            localEffectRef.current = { ...effect };
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
                        ref={durationRef}
                        type="text"
                        placeholder="0.00"
                        onChange={() => {
                            if (!timelineTrackRef.current || !durationRef.current) return;
                            const newDuration: number = parseFloat(durationRef.current.value) || 0;
                            if (newDuration > appState.timelineMaxValue) return;

                            const newCursor: number = timeToCursor(newDuration);
                            setDurationCursor(v => { return { ...v, x: newCursor } });
                            const newOffset = adjustOffsetCursor(newCursor);

                            const newEffects: LaurusEffect[] = appState.effects.map(e => {
                                if (e.key == effect.key) {
                                    return setTime(effect, newOffset, newDuration);
                                }
                                else {
                                    return e;
                                }
                            })
                            dispatch({ type: WorkspaceActionType.SetEffects, value: newEffects });

                            setDurationDebounceInput(newDuration);
                            localEffectRef.current = { ...effect };
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
                    hash={`${effect.key}|timeline|${1}`}
                    capSize={offsetCapSize}
                    rangeCapSize={durationCapSize}
                    trackSize={timelineTrackSize}
                    trackRef={timelineTrackRef}
                    cursor={offsetCursor}
                    onNewCursor={async (c) => {
                        setOffsetCursor({ ...c });
                        const adjustedDuration = adjustDurationCursor(c.x);
                        const newOffset: number = cursorToTime(c.x);
                        const newEffect = setTime(effect, newOffset, adjustedDuration);
                        await updateAndDispatchEffect(newEffect);
                    }}
                    rangeCursor={durationCursor}
                    onNewRangeCursor={async (c) => {
                        setDurationCursor({ ...c });
                        const adjustedOffset = adjustOffsetCursor(c.x);
                        const newDuration: number = cursorToTime(c.x);
                        const newEffect = setTime(effect, adjustedOffset, newDuration);
                        await updateAndDispatchEffect(newEffect);
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
                        ids={{ contextId: `dnd-context-${hash}`, draggableId: `dnd-draggable-${hash}` }}
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
                        ids={{ contextId: `dnd-context-${hash}`, draggableId: `dnd-draggable-${hash}` }}
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
