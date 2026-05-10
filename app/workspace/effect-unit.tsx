import { RefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import ScaleUnit from "./scale-unit";
import { convertTime, LaurusEffect, LaurusMoveResult, LaurusRotateResult, LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { allOut, cancelCircle, earthquake, lock, lockOpenRight, SvgRepo, toysFan, tune } from "../svg-repo";
import { deleteMove, deleteRotate, deleteScale, updateMove, updateRotate, updateScale } from "./workspace.server";
import { useTrackpadState } from "../hooks/useTrackpadState";
import MoveUnit from "./move-unit";
import TimelineSlider from "../components/timeline-slider";
import RotateUnit from "./rotate-unit";
import { dellaRespira } from "../fonts";
import useDebounce from "../hooks/useDebounce";

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
        case "rotate": {
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
    const [scaleCarouselIndex, setScaleCarouselIndex] = useState(0);
    const [moveCarouselIndex, setMoveCarouselIndex] = useState(0);
    const [rotateCarouselIndex, setRotateCarouselIndex] = useState(0);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                timelineSliderContainer: {
                    padding: '0px 15px 0px 15px',
                },
                timelineTrackSize: {
                    containerHeight: 44,
                    containerWidth: '100%',
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
                    gap: 4
                },
                input: {
                    fontSize: 10,
                    width: 30
                },
                footer: {
                    height: 20
                },
                toolbar: {
                    width: 24
                }
            }
            case "midhigh": return {
                timelineSliderContainer: {
                    padding: '0px 14px 0px 14px',
                },
                timelineTrackSize: {
                    containerHeight: 40,
                    containerWidth: '100%',
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
                    gap: 4
                },
                input: {
                    fontSize: 9,
                    width: '6ch'
                },
                footer: {
                    height: 22
                },
                toolbar: {
                    width: 19
                }
            }
            case "midlow":
            case "low": return {
                timelineSliderContainer: {
                    padding: '0px 14px 0px 14px',
                },
                timelineTrackSize: {
                    containerHeight: 40,
                    containerWidth: '100%',
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
                    gap: 4
                },
                input: {
                    fontSize: 9,
                    width: '6ch'
                },
                footer: {
                    height: 20
                },
                toolbar: {
                    width: 19
                }
            }
        }
    });

    const timelineTrackRef = useRef<HTMLDivElement | null>(null);
    const [startCursor, setStartCursor] = useState({ x: 0, y: 0 });
    const startRef = useRef<HTMLInputElement | null>(null);
    const [endCursor, setEndCursor] = useState({ x: 0, y: 0 });
    const endRef = useRef<HTMLInputElement | null>(null);

    const { getTrackValue: getTimeValue, getTrackCursor: getTimeCursor } =
        useTrackpadState(0, appState.timelineMaxValue);

    const cursorToTime = useCallback((cursorX: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeValue(cursorX, (timelineTrackRef.current.clientWidth - dynamicSizes.timelineTrackSize.capWidth), 0);
    }, [getTimeValue, dynamicSizes.timelineTrackSize.capWidth]);

    const timeToCursor = useCallback((time: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeCursor(time, (timelineTrackRef.current.clientWidth - dynamicSizes.timelineTrackSize.capWidth));
    }, [getTimeCursor, dynamicSizes.timelineTrackSize.capWidth]);

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
                const newScale: LaurusScaleResult = { ...effect.value, locked: effect.locked }
                const updated = await updateScale(
                    appState.apiOrigin,
                    appState.accessToken,
                    effect.key,
                    newScale);
                if (updated) {
                    const newEffect: LaurusEffect = {
                        type: 'scale',
                        key: effect.key,
                        locked: newScale.locked,
                        value: {
                            ...newScale,
                            start: convertTime(newScale.start, 'sec', appState.timelineUnit),
                            end: convertTime(newScale.end, 'sec', appState.timelineUnit)
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
                const newMove: LaurusMoveResult = { ...effect.value, locked: effect.locked }
                const updated = await updateMove(
                    appState.apiOrigin,
                    appState.accessToken,
                    effect.key,
                    newMove);
                if (updated) {
                    const newEffect: LaurusEffect = {
                        type: 'move',
                        key: effect.key,
                        locked: newMove.locked,
                        value: {
                            ...newMove,
                            start: convertTime(newMove.start, 'sec', appState.timelineUnit),
                            end: convertTime(newMove.end, 'sec', appState.timelineUnit)
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
            case "rotate": {
                const newRotate: LaurusRotateResult = { ...effect.value, locked: effect.locked }
                const updated = await updateRotate(
                    appState.apiOrigin,
                    appState.accessToken,
                    effect.key,
                    newRotate);
                if (updated) {
                    const newEffect: LaurusEffect = {
                        type: 'rotate',
                        key: effect.key,
                        locked: newRotate.locked,
                        value: {
                            ...newRotate,
                            start: convertTime(newRotate.start, 'sec', appState.timelineUnit),
                            end: convertTime(newRotate.end, 'sec', appState.timelineUnit)
                        }
                    };
                    dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                }
                else {
                    const rollbackRotateResult = rollback.value as LaurusRotateResult;
                    const newEffect: LaurusEffect = {
                        type: 'rotate',
                        key: rollback.key,
                        locked: rollback.locked,
                        value: { ...rollbackRotateResult }
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

    const deleteEffect = useCallback(async (effect: LaurusEffect) => {
        switch (effect.type) {
            case "move": {
                const deleted = await deleteMove(appState.apiOrigin, appState.accessToken, effect.value.move_id);
                if (deleted) {
                    dispatch({ type: WorkspaceActionType.DeleteEffect, key: effect.key })
                }
                break;
            }
            case "rotate": {
                const deleted = await deleteRotate(appState.apiOrigin, appState.accessToken, effect.value.rotate_id);
                if (deleted) {
                    dispatch({ type: WorkspaceActionType.DeleteEffect, key: effect.key })
                }
                break;
            }
            case "scale": {
                const deleted = await deleteScale(appState.apiOrigin, appState.accessToken, effect.value.scale_id);
                if (deleted) {
                    dispatch({ type: WorkspaceActionType.DeleteEffect, key: effect.key })
                }
                break;
            }
        }
    }, [appState.accessToken, appState.apiOrigin, dispatch]);

    return (
        <div style={{ display: 'flex', width: '100%', }}>
            <div style={{ display: 'grid', width: '100%', }}>
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: 'rgb(227, 227, 227)',
                        ...dynamicSizes.headerFlex
                    }}>
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', ...dynamicSizes.inputFlex }}>
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', fontSize: dynamicSizes.input.fontSize }}>{'start'}</div>
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
                                ...dynamicSizes.input
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', height: '100%', width: '60%', marginTop: 4, alignItems: 'center' }}>
                        <EffectDescription
                            effectKey={effect.key}
                            effectDescriptionInit={effect.value.description} />
                    </div>
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', ...dynamicSizes.inputFlex }}>
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', fontSize: dynamicSizes.input.fontSize }}>{'end'}</div>
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
                                ...dynamicSizes.input
                            }}
                        />
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '100%',
                    ...dynamicSizes.timelineSliderContainer,
                }}>
                    <TimelineSlider
                        hash={`${effect.key}|t1`}
                        size={dynamicSizes.timelineTrackSize}
                        trackRef={timelineTrackRef}
                        trackBackground={'rgb(60, 60, 60)'}
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
                        ...dynamicSizes.footer
                    }} />
                {showUnitControls && (() => {
                    switch (effect.type) {
                        case "scale": {
                            return <ScaleUnit
                                scale={effect.value}
                                svgElementsRef={svgElementsRef}
                                imgElementsRef={imgElementsRef}
                                carouselIndexInit={scaleCarouselIndex} />
                        }
                        case "move": {
                            return <MoveUnit
                                move={effect.value}
                                svgElementsRef={svgElementsRef}
                                imgElementsRef={imgElementsRef}
                                carouselIndexInit={moveCarouselIndex} />
                        }
                        case "rotate": {
                            return <RotateUnit
                                rotate={effect.value}
                                svgElementsRef={svgElementsRef}
                                imgElementsRef={imgElementsRef}
                                carouselIndexInit={rotateCarouselIndex} />
                        }
                    }
                })()}
            </div>
            <div style={{
                height: '100%',
                background: 'rgba(22, 22, 22, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                ...dynamicSizes.toolbar
            }}>
                <div
                    style={{ width: dynamicSizes.toolbar.width, height: dynamicSizes.toolbar.width, }}>
                    <SvgRepo svg={(() => {
                        switch (effect.type) {
                            case "scale": return allOut();
                            case "move": return earthquake();
                            case "rotate": return toysFan();
                        }
                    })()}
                        containerSize={{ width: dynamicSizes.toolbar.width, height: dynamicSizes.toolbar.width }}
                        scale={0.6} />
                </div>
                <div
                    onClick={() => {
                        const closed = !showUnitControls;
                        if (closed) {
                            if (!appState.activeElement) {
                                switch (effect.type) {
                                    case "move": {
                                        const moveEqautionKeys = Array.from(effect.value.math.keys())
                                        const keys = appState.carouselEntries;
                                        const k = keys.findIndex(k => moveEqautionKeys.includes(k.key));
                                        const newIndex = k > -1 ? k : 0;
                                        setMoveCarouselIndex(newIndex);
                                        break;
                                    }
                                    case "rotate": {
                                        const eqKeys = Array.from(effect.value.math.keys())
                                        const carouselKeys = appState.carouselEntries;
                                        const k = carouselKeys.findIndex(k => eqKeys.includes(k.key));
                                        const newIndex = k > -1 ? k : 0;
                                        setRotateCarouselIndex(newIndex);
                                        break;
                                    }
                                    case "scale": {
                                        const moveEqautionKeys = Array.from(effect.value.math.keys())
                                        const keys = appState.carouselEntries;
                                        const k = keys.findIndex(k => moveEqautionKeys.includes(k.key));
                                        const newIndex = k > -1 ? k : 0;
                                        setScaleCarouselIndex(newIndex);
                                        break;
                                    }
                                }
                            }
                            else if (appState.activeElement.locallyActivatedEffectKey == undefined) {
                                const activeKey = appState.activeElement.key;
                                const initialIndex = appState.carouselEntries.findIndex(c => c.key == activeKey);
                                if (initialIndex > -1) {
                                    setScaleCarouselIndex(initialIndex);
                                    setMoveCarouselIndex(initialIndex);
                                    setRotateCarouselIndex(initialIndex);
                                }
                            }
                            setShowUnitControls(true);
                        }
                        else {
                            setShowUnitControls(false);
                        }
                    }}
                    style={{
                        cursor: 'pointer',
                        width: dynamicSizes.toolbar.width,
                        height: dynamicSizes.toolbar.width,
                        background: showUnitControls ? 'rgba(255,255,255,0.075)' : 'none',
                        border: '1px solid rgba(0,0,0,0)',
                        transition: 'border-left 0.25s ease-out'
                    }}>
                    <SvgRepo svg={tune()}
                        containerSize={{ width: dynamicSizes.toolbar.width, height: dynamicSizes.toolbar.width }}
                        scale={0.65} />
                </div>
                <div
                    onClick={async () => {
                        const rollback: LaurusEffect = { ...effect };
                        const newEffect: LaurusEffect = {
                            ...effect,
                            locked: !effect.locked,
                        }
                        await saveEffect(newEffect, rollback);
                    }}
                    style={{
                        cursor: 'pointer', width: dynamicSizes.toolbar.width, height: dynamicSizes.toolbar.width,
                        background: 'none',
                        border: '1px solid rgba(0,0,0,0)',
                        transition: 'border-left 0.25s ease-out'
                    }}>
                    <SvgRepo
                        title={effect.locked ? "locked" : "unlocked"}
                        svg={effect.locked ? lock('rgba(255,255,255,0.7)') : lockOpenRight('rgba(255,255,255,0.7)')}
                        containerSize={{
                            width: dynamicSizes.toolbar.width,
                            height: dynamicSizes.toolbar.width
                        }}
                        scale={0.6} />
                </div>
                {showUnitControls && <div
                    onClick={() => {
                        const confirmed = confirm('are you sure you want to delete this effect?');
                        if (confirmed) {
                            deleteEffect(effect);
                        }
                    }}
                    style={{
                        cursor: 'pointer',
                        width: dynamicSizes.toolbar.width,
                        height: dynamicSizes.toolbar.width,
                        background: 'none',
                        border: '1px solid rgba(0,0,0,0)',
                        transition: 'border-left 0.25s ease-out'
                    }}>
                    <SvgRepo
                        title={"delete effect"}
                        svg={cancelCircle('rgb(220, 112, 112)')}
                        containerSize={{
                            width: dynamicSizes.toolbar.width,
                            height: dynamicSizes.toolbar.width
                        }}
                        scale={0.6} />
                </div>}
            </div>
        </div>
    );
}

interface EffectDescription {
    effectKey: string,
    effectDescriptionInit: string,
}
function EffectDescription({ effectKey, effectDescriptionInit }: EffectDescription) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [effectDescription, setEffectDescription] = useState<string>(effectDescriptionInit);
    const [effectDescriptionSnapshot] = useState<string>(effectDescriptionInit);
    const effectDescriptionHook = useDebounce<string>(effectDescription, 300);
    const dependenciesRef = useRef<LaurusEffect | undefined>(undefined);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return { fontSize: 12, padding: 6 }
            case "midhigh": return { fontSize: 10, padding: 6 }
            case "midlow":
            case "low": return { fontSize: 10, padding: 6 }
        }
    });
    const effectDescriptionInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        (async () => {
            if (!dependenciesRef.current || !effectDescriptionInputRef.current) return;
            if (effectDescriptionHook) {
                const effect: LaurusEffect = { ...dependenciesRef.current }
                switch (effect.type) {
                    case "scale": {
                        const newScale: LaurusScaleResult = { ...effect.value, description: effectDescriptionHook }
                        const updated = await updateScale(
                            appState.apiOrigin,
                            appState.accessToken,
                            effect.key,
                            newScale);
                        if (updated) {
                            const newEffect: LaurusEffect = {
                                ...effect,
                                value: {
                                    ...newScale,
                                }
                            };
                            dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                        }
                        else {
                            effectDescriptionInputRef.current.value = effectDescriptionSnapshot;
                        }
                        break;
                    }
                    case "move": {
                        const newMove: LaurusMoveResult = { ...effect.value, description: effectDescriptionHook }
                        const updated = await updateMove(
                            appState.apiOrigin,
                            appState.accessToken,
                            effect.key,
                            newMove);
                        if (updated) {
                            const newEffect: LaurusEffect = {
                                ...effect,
                                value: {
                                    ...newMove,
                                }
                            };
                            dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                        }
                        else {
                            effectDescriptionInputRef.current.value = effectDescriptionSnapshot;
                        }
                        break;
                    }
                    case "rotate": {
                        const newRotate: LaurusRotateResult = { ...effect.value, description: effectDescriptionHook }
                        const updated = await updateRotate(
                            appState.apiOrigin,
                            appState.accessToken,
                            effect.key,
                            newRotate);
                        if (updated) {
                            const newEffect: LaurusEffect = {
                                ...effect,
                                value: {
                                    ...newRotate,
                                }
                            };
                            dispatch({ type: WorkspaceActionType.SetEffect, value: newEffect });
                        }
                        else {
                            effectDescriptionInputRef.current.value = effectDescriptionSnapshot;
                        }
                        break;
                    }
                }
            }
        })();
    }, [appState.accessToken, appState.apiOrigin, dispatch, effectDescriptionHook, effectDescriptionSnapshot]);

    const onEffectDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const effect = appState.effects.find(e => e.key == effectKey);
        if (!effect) return;

        switch (effect.type) {
            case "scale": {
                const newEffect: LaurusScaleResult = { ...effect.value, description: e.target.value }
                dependenciesRef.current = { ...effect, value: { ...newEffect } };
                setEffectDescription(e.target.value);
                break;
            }
            case "move": {
                const newEffect: LaurusMoveResult = { ...effect.value, description: e.target.value }
                dependenciesRef.current = { ...effect, value: { ...newEffect } };
                setEffectDescription(e.target.value);
                break;
            }
            case "rotate": {
                const newEffect: LaurusRotateResult = { ...effect.value, description: e.target.value }
                dependenciesRef.current = { ...effect, value: { ...newEffect } };
                setEffectDescription(e.target.value);
                break;
            }
        }
    }, [appState.effects, effectKey]);

    return (<>
        <input
            ref={effectDescriptionInputRef}
            className={dellaRespira.className}
            id={`effect-description-input-${effectKey}`}
            type="text"
            placeholder="describe me..."
            style={{
                textAlign: "center",
                background: 'none',
                color: "rgba(255, 255, 255, 0.8)",
                borderRadius: "2px",
                border: 'none',
                outline: 'none',
                height: '100%',
                display: 'inline-block',
                overflowX: 'scroll',
                width: '100%',
                ...dynamicSizes
            }}
            value={effectDescription}
            onChange={onEffectDescriptionChange}
        />
    </>)
}