import { dmSans } from "@/app/fonts";
import { LaurusClientSvg, SvgRepo, add2, autorenew, cancelCircle, circleFillZero, contentPaste, earthquake, ellipseFillZero, fileCopy, playArrow, remove, syncAlt, updateDisabled } from "@/app/svg-repo";
import { Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { CoreContext, HoverContext, UIContext } from "../../workspace.client";
import { getMoveFrames, LaurusEffect, LaurusLoopType, LaurusMoveEquation, LaurusMoveResult, LaurusShapeType, updateMove } from "../../workspace.server";
import { getDynamicUnitSizes, LIMIT_FACTOR_STEP, MAX_LIMIT_FACTOR, MIN_LIMIT_FACTOR } from "../../workspace.config";
import { MoveUnitControls, defaultMoveEquation } from "../move-unit";
import { UIActionType } from "../../states/ui-state";
import { CoreActionType } from "../../states/core-state";

interface MoveUnitbar {
    move: LaurusMoveResult,
    carouselEntryKey: string,
    saveNewEquation: (rollback: LaurusMoveResult, newEquation: LaurusMoveEquation) => Promise<void>,
    updateTrackpads: (newControls: MoveUnitControls) => void,
    currentControls: MoveUnitControls,
    setCurrentControls: Dispatch<SetStateAction<MoveUnitControls>>,
}

export default function MoveUnitbar({
    move,
    carouselEntryKey,
    saveNewEquation,
    updateTrackpads,
    currentControls,
    setCurrentControls, }: MoveUnitbar) {
    const { appState, dispatch, handlePlayTarget } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const { isMetaKeyPressed } = useContext(HoverContext);

    const [dynamicSizes] = useState(() => {
        const ds = getDynamicUnitSizes(uiState.resolution);
        switch (uiState.resolution.type) {
            case "high": return {
                ...ds,
                angleParam: { padding: 15 }
            }
            case "midhigh": return {
                ...ds,
                angleParam: { padding: Math.round(15 * uiState.resolution.factor) }

            }
            case "midlow": return {
                ...ds,
                angleParam: { padding: Math.round(15 * uiState.resolution.factor) }
            }
            case "low": return {
                ...ds,
                angleParam: { padding: Math.round(15 * uiState.resolution.factor) }
            }
        }
    });

    const loopSvg = useMemo((): LaurusClientSvg => {
        const loopType = move.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        const enabled = move.math.has(carouselEntryKey) ? true : false;
        switch (loopType) {
            default:
            case LaurusLoopType.none: {
                return enabled ? updateDisabled() : updateDisabled('rgb(62,62,62)');
            }
            case LaurusLoopType.loop_reverse_infinite: {
                return enabled ? syncAlt() : syncAlt('rgb(62,62,62)');
            }
            case LaurusLoopType.loop_reverse: {
                return enabled ? syncAlt() : syncAlt('rgb(62,62,62)');
            }
            case LaurusLoopType.loop_infinite: {
                return enabled ? autorenew() : autorenew('rgb(62,62,62)');
            }

        }
    }, [carouselEntryKey, move.math]);

    const loopSvgScale = useMemo((): number => {
        const loopType = move.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        switch (loopType) {
            case LaurusLoopType.none: return 0.85;
            default: return 0.9;
        }
    }, [carouselEntryKey, move.math]);

    const loopType = useMemo((): LaurusLoopType => {
        return move.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    }, [carouselEntryKey, move.math]);

    const getNextLoopType = useCallback((): LaurusLoopType => {
        const currentLoop = move.math.get(carouselEntryKey)?.loop;
        switch (currentLoop) {
            case LaurusLoopType.loop:
            case LaurusLoopType.none: {
                return LaurusLoopType.loop_infinite;
            }
            case LaurusLoopType.loop_infinite: {
                return LaurusLoopType.loop_reverse_infinite;
            }
            case LaurusLoopType.loop_reverse_infinite: {
                return LaurusLoopType.loop_reverse;
            }
            default:
            case LaurusLoopType.loop_reverse: {
                return LaurusLoopType.none;
            }
        }
    }, [carouselEntryKey, move.math]);

    const decrementLimitFactor = useCallback((): number => {
        const currentFactor = move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor;
        return Math.max(MIN_LIMIT_FACTOR, Math.round((currentFactor - LIMIT_FACTOR_STEP) * 100) / 100);
    }, [carouselEntryKey, move.math]);

    const incrementLimitFactor = useCallback((): number => {
        const currentFactor = move.math.get(carouselEntryKey)?.limit_factor ?? defaultMoveEquation.limit_factor;
        return Math.min(MAX_LIMIT_FACTOR, Math.round((currentFactor + LIMIT_FACTOR_STEP) * 100) / 100);
    }, [carouselEntryKey, move.math]);

    const shapeSvg = useMemo((): LaurusClientSvg => {
        const shapeType = move.math.get(carouselEntryKey)?.shape ?? LaurusShapeType.wave;
        const enabled = move.math.has(carouselEntryKey) ? true : false;
        switch (shapeType) {
            default:
            case LaurusShapeType.wave:
                return enabled ? earthquake() : earthquake('rgb(62,62,62)');
            case LaurusShapeType.circle: {
                return enabled ? circleFillZero() : circleFillZero('rgb(62,62,62)');
            }
            case LaurusShapeType.ellipse: {
                return enabled ? ellipseFillZero() : ellipseFillZero('rgb(62,62,62)');
            }
        }
    }, [carouselEntryKey, move.math]);

    const getNextShapeType = useCallback((): LaurusShapeType => {
        const currentLoop = move.math.get(carouselEntryKey)?.shape;
        switch (currentLoop) {
            case LaurusShapeType.wave: {
                return LaurusShapeType.circle;
            }
            case LaurusShapeType.circle: {
                return LaurusShapeType.ellipse;
            }
            default:
            case LaurusShapeType.ellipse: {
                return LaurusShapeType.wave;
            }
        }
    }, [carouselEntryKey, move.math]);

    return <>
        <div style={{
            background: 'linear-gradient(45deg, rgb(18, 18, 18), rgb(22, 22, 22))',
            borderLeft: '1px solid rgba(255, 255, 255, 0.025)',
            padding: 0,
            display: 'grid',
            alignContent: 'start',
            overflowY: 'auto',
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
        }}>
            <div title={"shape"}
                onDoubleClick={() => {
                    if (move.locked || isMetaKeyPressed) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            { ...activeEquation, shape: getNextShapeType() } :
                            {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                shape: getNextShapeType(),
                            };
                        saveNewEquation(snapshot, newEquation);
                    }
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    borderTopRightRadius: 6,
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"shape"}
                    svg={shapeSvg}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.85}
                    scaleToContaier={true} />
            </div>
            <div title={"loop"}
                onDoubleClick={() => {
                    if (move.locked || isMetaKeyPressed) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const nextLoop = getNextLoopType();
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            { ...activeEquation, loop: nextLoop } :
                            {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                loop: nextLoop,
                            };
                        setCurrentControls(v => ({ ...v, loop: nextLoop }));
                        saveNewEquation(snapshot, newEquation);
                    }
                }}
                style={{
                    position: 'relative',
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"loop"}
                    svg={loopSvg}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={loopSvgScale}
                    scaleToContaier={true} />
                {loopType === LaurusLoopType.loop_reverse && (
                    <div className={dmSans.className} style={{
                        position: 'absolute',
                        top: 1,
                        right: 1,
                        width: '2ch',
                        height: '2ch',
                        backgroundColor: 'rgb(220, 112, 112)',
                        borderRadius: '50%',
                        color: 'rgb(15, 15, 15)',
                        fontSize: 11,
                        fontWeight: 'bolder',
                        display: 'grid',
                        placeContent: 'center',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        userSelect: 'none'
                    }}>
                        {'1'}
                    </div>
                )}
            </div>
            <div title={"preview"}
                onClick={() => {
                    if (isMetaKeyPressed || !uiState.playbackControlsEnabled) return;
                    handlePlayTarget({
                        inputKey: carouselEntryKey,
                        getFrames: (apiOrigin) => getMoveFrames(apiOrigin, move.move_id, carouselEntryKey),
                        effectKey: move.move_id
                    });
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"preview"}
                    svg={move.math.has(carouselEntryKey) && uiState.playbackControlsEnabled ? playArrow() : playArrow("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.math.has(carouselEntryKey) && uiState.playbackControlsEnabled ? 'pointer' : move.math.has(carouselEntryKey) ? 'progress' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={1}
                    scaleToContaier={true} />
            </div>
            <div title={"increase limits"}
                onClick={() => {
                    if (isMetaKeyPressed || move.locked || (move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor == MAX_LIMIT_FACTOR)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && move.math.has(activeKey)) {
                        const nextFactor = incrementLimitFactor();
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: nextFactor,
                            } :
                            {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                limit_factor: nextFactor,
                            };
                        setCurrentControls(v => ({ ...v, limit_factor: nextFactor }));
                        saveNewEquation(snapshot, newEquation);
                    }
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer,
                }}>
                <SvgRepo
                    title={"increase limits"}
                    svg={move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor != MAX_LIMIT_FACTOR ? add2() : add2("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"decrease limits"}
                onClick={() => {
                    if (isMetaKeyPressed || move.locked || (move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor == MIN_LIMIT_FACTOR)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && move.math.has(activeKey)) {
                        const nextFactor = decrementLimitFactor();
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: nextFactor,
                            } :
                            {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                limit_factor: nextFactor,
                            };
                        setCurrentControls(v => ({ ...v, limit_factor: nextFactor }));
                        saveNewEquation(snapshot, newEquation);
                    }
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer,
                }}>
                <SvgRepo
                    title={"decrease limits"}
                    svg={move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor != MIN_LIMIT_FACTOR ? remove() : remove("rgb(62,62,62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"copy"}
                onClick={() => {
                    if (isMetaKeyPressed) return;
                    let clipboardData: MoveUnitControls = { ...currentControls };
                    const activeEquation = move.math.get(carouselEntryKey);
                    if (activeEquation) {
                        clipboardData = { ...activeEquation };
                    }
                    const currentMoveEq: LaurusMoveEquation = {
                        ...clipboardData,
                        input_id: "clipboard",
                        solution: defaultMoveEquation.solution,
                    }
                    const newMath: Map<string, LaurusMoveEquation> = new Map();
                    newMath.set("clipboard", currentMoveEq);
                    const newClipboardEffect: LaurusEffect = {
                        type: 'move',
                        key: move.move_id,
                        value: { ...move, math: newMath }
                    };
                    uiDispatch({ type: UIActionType.SetEffectClipboard, value: newClipboardEffect });
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"copy"}
                    svg={move.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
            <div title={"paste"}
                onClick={() => {
                    if (isMetaKeyPressed) return;
                    if (uiState.effectClipboard && uiState.effectClipboard.type == 'move') {
                        const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
                        if (!clipboardEquation) return;
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeKey = carouselEntryKey;
                        const newEquation: LaurusMoveEquation = { ...clipboardEquation };
                        const newControls: MoveUnitControls = { ...newEquation };
                        setCurrentControls(newControls);
                        updateTrackpads(newControls);
                        if (activeKey) {
                            const newMath: LaurusMoveEquation = {
                                ...newEquation,
                                input_id: activeKey
                            }
                            saveNewEquation(snapshot, newMath);
                        }
                    }
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"paste"}
                    svg={uiState.effectClipboard?.type == 'move' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.9}
                    scaleToContaier={true} />
            </div>
            <div title={"clear"}
                onClick={async () => {
                    if (isMetaKeyPressed || move.locked) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && move.math.has(activeKey)) {
                        const confirmed = confirm('are you sure you want to clear this equation?');
                        if (!confirmed) return;
                        const snapshot: LaurusMoveResult = { ...move };
                        const newMath = new Map(snapshot.math);
                        newMath.delete(activeKey);
                        const newMove: LaurusMoveResult = { ...snapshot, math: newMath };
                        const defaultControls: MoveUnitControls = { ...defaultMoveEquation, time: 0 };
                        setCurrentControls(defaultControls);
                        updateTrackpads(defaultControls);
                        dispatch({
                            type: CoreActionType.SetEffect,
                            value: { type: 'move', value: { ...newMove }, key: newMove.move_id },
                        });
                        const updated = await updateMove(appState.apiOrigin, appState.accessToken, snapshot.move_id, { ...newMove });
                        if (!updated) {
                            dispatch({
                                type: CoreActionType.SetEffect,
                                value: { type: 'move', value: { ...snapshot }, key: snapshot.move_id },
                            });
                        }
                    }
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"clear"}
                    svg={move.math.has(carouselEntryKey) ? cancelCircle() : cancelCircle("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
        </div>
    </>
}
