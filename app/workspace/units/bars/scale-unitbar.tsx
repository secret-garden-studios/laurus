import { dmSans } from "@/app/fonts";
import { LaurusClientSvg, SvgRepo, add2, autorenew, cancelCircle, contentPaste, fileCopy, link, linkOff, playArrow, remove, syncAlt, updateDisabled } from "@/app/svg-repo";
import { Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { CoreContext, HoverContext, UIContext } from "../../workspace.client";
import { getScaleFrames, LaurusEffect, LaurusLoopType, LaurusScaleEquation, LaurusScaleResult, updateScale } from "../../workspace.server";
import { ScaleUnitControls, defaultScaleEquation } from "../scale-unit";
import { getDynamicUnitSizes, LIMIT_FACTOR_STEP, MAX_LIMIT_FACTOR, MIN_LIMIT_FACTOR } from "../../workspace.config";
import { UIActionType } from "../../states/ui-state";
import { CoreActionType } from "../../states/core-state";

interface ScaleUnitbar {
    scale: LaurusScaleResult,
    carouselEntryKey: string,
    unlockAspectRatio: boolean,
    updateTrackpads: (newControls: ScaleUnitControls) => void,
    currentControls: ScaleUnitControls,
    setCurrentControls: Dispatch<SetStateAction<ScaleUnitControls>>,
    saveNewEquation: (rollback: LaurusScaleResult, newEquation: LaurusScaleEquation) => Promise<void>,
    setUnlockAspectRatio: Dispatch<SetStateAction<boolean>>
}
export default function ScaleUnitbar({
    scale,
    carouselEntryKey,
    unlockAspectRatio,
    updateTrackpads,
    currentControls,
    setCurrentControls,
    saveNewEquation,
    setUnlockAspectRatio }: ScaleUnitbar) {
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
        const loopType = scale.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        const enabled = scale.math.has(carouselEntryKey) ? true : false;
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
    }, [carouselEntryKey, scale.math]);

    const loopSvgScale = useMemo((): number => {
        const loopType = scale.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        switch (loopType) {
            case LaurusLoopType.none: return 0.85;
            default: return 0.9;
        }
    }, [carouselEntryKey, scale.math]);

    const loopType = useMemo((): LaurusLoopType => {
        return scale.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    }, [carouselEntryKey, scale.math]);

    const getNextLoopType = useCallback((): LaurusLoopType => {
        const currentLoop = scale.math.get(carouselEntryKey)?.loop;
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
    }, [carouselEntryKey, scale.math]);

    const decrementLimitFactor = useCallback((): number => {
        const currentFactor = scale.math.get(carouselEntryKey)?.limit_factor ?? defaultScaleEquation.limit_factor;
        return Math.max(MIN_LIMIT_FACTOR, Math.round((currentFactor - LIMIT_FACTOR_STEP) * 100) / 100);
    }, [carouselEntryKey, scale.math]);

    const incrementLimitFactor = useCallback((): number => {
        const currentFactor = scale.math.get(carouselEntryKey)?.limit_factor ?? defaultScaleEquation.limit_factor;
        return Math.min(MAX_LIMIT_FACTOR, Math.round((currentFactor + LIMIT_FACTOR_STEP) * 100) / 100);
    }, [carouselEntryKey, scale.math]);


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
            <div title={"loop"}
                onDoubleClick={() => {
                    if (scale.locked || isMetaKeyPressed) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const nextLoop = getNextLoopType();
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            { ...activeEquation, loop: nextLoop } :
                            {
                                ...defaultScaleEquation,
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
                    borderTopRightRadius: 6,
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"loop"}
                    svg={loopSvg}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.locked ? '' : scale.math.has(carouselEntryKey) ? 'pointer' : ''),
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
                    if (isMetaKeyPressed || uiState.playbackMode.type !== 'stopped') return;
                    handlePlayTarget({
                        inputKey: carouselEntryKey,
                        getFrames: (apiOrigin) => getScaleFrames(apiOrigin, scale.scale_id, carouselEntryKey),
                        effectKey: scale.scale_id
                    });
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"preview"}
                    svg={scale.math.has(carouselEntryKey) && uiState.playbackMode.type === 'stopped' ? playArrow() : playArrow("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.math.has(carouselEntryKey) && uiState.playbackMode.type === 'stopped' ? 'pointer' : scale.math.has(carouselEntryKey) ? 'progress' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={1}
                    scaleToContaier={true} />
            </div>
            <div title={"increase limits"}
                onClick={() => {
                    if (isMetaKeyPressed || scale.locked || (scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor == MAX_LIMIT_FACTOR)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && scale.math.has(activeKey)) {
                        const nextFactor = incrementLimitFactor();
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: nextFactor,
                            } :
                            {
                                ...defaultScaleEquation,
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
                    svg={scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor != MAX_LIMIT_FACTOR ? add2() : add2("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"decrease limits"}
                onClick={() => {
                    if (isMetaKeyPressed || scale.locked || (scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor == MIN_LIMIT_FACTOR)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && scale.math.has(activeKey)) {
                        const nextFactor = decrementLimitFactor();
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: nextFactor,
                            } :
                            {
                                ...defaultScaleEquation,
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
                    svg={scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor != MIN_LIMIT_FACTOR ? remove() : remove("rgb(62,62,62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"link width and height"}
                onClick={() => {
                    if (isMetaKeyPressed || scale.locked) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && scale.math.has(activeKey)) {
                        setUnlockAspectRatio(v => !v);
                    }
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"link width and height"}
                    svg={scale.math.has(carouselEntryKey) ? (unlockAspectRatio ? linkOff() : link()) : (unlockAspectRatio ? linkOff("rgb(62, 62, 62)") : link("rgb(62, 62, 62)"))}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={1}
                    scaleToContaier={true} />
            </div>
            <div title={"copy"}
                onClick={() => {
                    if (isMetaKeyPressed) return;
                    let clipboardData: ScaleUnitControls = { ...currentControls };
                    const activeEquation = scale.math.get(carouselEntryKey);
                    if (activeEquation) {
                        clipboardData = { ...activeEquation };
                    }
                    const currentEq: LaurusScaleEquation = {
                        ...clipboardData,
                        input_id: "clipboard",
                        solution: defaultScaleEquation.solution,
                    }
                    const newMath: Map<string, LaurusScaleEquation> = new Map();
                    newMath.set("clipboard", currentEq);
                    const newClipboardEffect: LaurusEffect = {
                        type: 'scale',
                        key: scale.scale_id,
                        value: { ...scale, math: newMath }
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
                    svg={scale.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
            <div title={"paste"}
                onClick={() => {
                    if (isMetaKeyPressed) return;
                    if (uiState.effectClipboard && uiState.effectClipboard.type == 'scale') {
                        const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
                        if (!clipboardEquation) return;
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeKey = carouselEntryKey;
                        const newEquation: LaurusScaleEquation = { ...clipboardEquation };
                        const newControls: ScaleUnitControls = { ...newEquation };
                        setCurrentControls(newControls);
                        updateTrackpads(newControls);
                        if (activeKey) {
                            const newMath: LaurusScaleEquation = {
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
                    svg={uiState.effectClipboard?.type == 'scale' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.9}
                    scaleToContaier={true} />
            </div>
            <div title={"clear"}
                onClick={async () => {
                    if (isMetaKeyPressed || scale.locked) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && scale.math.has(activeKey)) {
                        const confirmed = confirm('are you sure you want to clear this equation?');
                        if (!confirmed) return;
                        const snapshot: LaurusScaleResult = { ...scale };
                        const newMath = new Map(snapshot.math);
                        newMath.delete(activeKey);
                        const newScale: LaurusScaleResult = { ...snapshot, math: newMath };
                        const defaultControls: ScaleUnitControls = {
                            ...defaultScaleEquation,
                            time: 0
                        };
                        setCurrentControls(defaultControls);
                        updateTrackpads(defaultControls);
                        dispatch({
                            type: CoreActionType.SetEffect,
                            value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id },
                        });
                        const updated = await updateScale(appState.apiOrigin, appState.accessToken, snapshot.scale_id, { ...newScale });
                        if (!updated) {
                            dispatch({
                                type: CoreActionType.SetEffect,
                                value: { type: 'scale', value: { ...snapshot }, key: snapshot.scale_id },
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
                    svg={scale.math.has(carouselEntryKey) ? cancelCircle() : cancelCircle("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: isMetaKeyPressed ? 'crosshair' : (scale.locked ? '' : scale.math.has(carouselEntryKey) ? 'pointer' : ''),
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
        </div>
    </>
}
