import { RefObject, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import ScaleUnit from "./scale-unit";
import { convertTime, LaurusEffect, LaurusMove, LaurusMoveResult, LaurusScale, LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { arrowDropDown, arrowDropUp, lock, lockOpenRight, SvgRepo } from "../svg-repo";
import { updateMove, updateScale } from "./workspace.server";
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

    const getNewEndTime = useCallback((newStartCursorX: number): [number, boolean] => {
        return (endCursor.x < newStartCursorX) ?
            [cursorToTime(newStartCursorX), true] :
            [cursorToTime(endCursor.x), false];
    }, [cursorToTime, endCursor.x]);

    const getNewStartTime = useCallback((newEndCursorX: number): [number, boolean] => {
        return (startCursor.x > newEndCursorX) ?
            [cursorToTime(newEndCursorX), true] :
            [cursorToTime(startCursor.x), false];
    }, [cursorToTime, startCursor.x]);

    const saveEffect = useCallback(async (effect: LaurusEffect, rollback: LaurusEffect) => {
        switch (effect.type) {
            case "scale": {
                const newScale: LaurusScale = { ...effect.value, locked: effect.locked }
                const updated = await updateScale(
                    appState.apiOrigin,
                    appState.accessToken,
                    effect.key,
                    newScale);
                if (updated) {
                    const newEffect: LaurusEffect = {
                        type: 'scale',
                        key: updated.scale_id,
                        locked: updated.locked,
                        value: {
                            ...updated,
                            start: convertTime(updated.start, 'sec', appState.timelineUnit),
                            end: convertTime(updated.end, 'sec', appState.timelineUnit)
                        }
                    };
                    dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                }
                else {
                    const rollbackScaleResult = rollback.value as LaurusScaleResult;
                    const newEffect: LaurusEffect = {
                        type: 'scale',
                        key: rollback.key,
                        locked: rollback.locked,
                        value: { ...rollbackScaleResult }
                    };
                    dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                }
                break;
            }
            case "move": {
                const newMove: LaurusMove = { ...effect.value, locked: effect.locked }
                const updated = await updateMove(
                    appState.apiOrigin,
                    appState.accessToken,
                    effect.key,
                    newMove);
                if (updated) {
                    const newEffect: LaurusEffect = {
                        type: 'move',
                        key: updated.move_id,
                        locked: updated.locked,
                        value: {
                            ...updated,
                            start: convertTime(updated.start, 'sec', appState.timelineUnit),
                            end: convertTime(updated.end, 'sec', appState.timelineUnit)
                        }
                    };
                    dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                }
                else {
                    const rollbackMoveResult = rollback.value as LaurusMoveResult;
                    const newEffect: LaurusEffect = {
                        type: 'move',
                        key: rollback.key,
                        locked: rollback.locked,
                        value: { ...rollbackMoveResult }
                    };
                    dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                }
                break;
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.timelineUnit, dispatch]);

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
                        disabled
                        ref={startRef}
                        type="text"
                        placeholder="0.00"
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
                        disabled
                        ref={endRef}
                        type="text"
                        placeholder="0.00"
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
                        const newStart = cursorToTime(c.x);
                        const newEnd = getNewEndTime(c.x);

                        setStartCursor({ ...c });
                        if (newEnd[1] && endRef.current) {
                            setEndCursor({ ...endCursor, x: c.x });
                            endRef.current.value = newStart.toFixed(2);
                        }

                        const newServerStart = convertTime(newStart, appState.timelineUnit, 'sec');
                        const newServerEnd = convertTime(newEnd[0], appState.timelineUnit, 'sec');
                        const rollback: LaurusEffect = { ...effect };
                        const newEffect = injectTime(effect, newServerStart, newServerEnd);
                        await saveEffect(newEffect, rollback);
                    }}
                    rangeCursor={endCursor}
                    onNewRangeCursor={async (c) => {
                        const newStart = getNewStartTime(c.x);
                        const newEnd = cursorToTime(c.x);

                        setEndCursor({ ...c });
                        if (newStart[1] && startRef.current) {
                            setStartCursor({ ...startCursor, x: c.x });
                            startRef.current.value = newEnd.toFixed(2);
                        }

                        const newServerStart = convertTime(newStart[0], appState.timelineUnit, 'sec');
                        const newServerEnd = convertTime(newEnd, appState.timelineUnit, 'sec');
                        const rollback: LaurusEffect = { ...effect };
                        const newEffect = injectTime(effect, newServerStart, newServerEnd);
                        await saveEffect(newEffect, rollback);
                    }}
                    onCursorMove={(c) => {
                        if (!startRef.current || effect.locked) return;
                        const newValue = cursorToTime(c.x);
                        startRef.current.value = newValue.toFixed(2);
                    }}
                    onRangeMove={(c) => {
                        if (!endRef.current || effect.locked) return;
                        const newValue = cursorToTime(c.x);
                        endRef.current.value = newValue.toFixed(2);
                    }}
                    disabled={effect.locked}
                />
            </div>
            <div
                style={{
                    width: '100%',
                    height: timelineDropDownSize.height,
                    padding: timelineDropDownSize.padding,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                <SvgRepo
                    title={effect.locked ? "locked" : "unlocked"}
                    svg={effect.locked ? lock('rgba(255,255,255,0.7)') : lockOpenRight('rgba(255,255,255,0.7)')}
                    containerSize={{
                        width: timelineDropDownSize.svg,
                        height: timelineDropDownSize.svg
                    }}
                    scale={0.7}
                    onContainerClick={async () => {
                        const rollback: LaurusEffect = { ...effect };
                        const newEffect: LaurusEffect = {
                            ...effect,
                            locked: !effect.locked,
                        }
                        await saveEffect(newEffect, rollback);
                    }} />
                <SvgRepo
                    title={showUnitControls ? "hide controls" : "show controls"}
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

