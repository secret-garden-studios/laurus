import { dmSans } from "@/app/fonts";
import { LaurusClientSvg, SvgRepo, add2, autorenew, cancelCircle, contentPaste, fileCopy, link, linkOff, playArrow, remove, skipPrevious, syncAlt, updateDisabled } from "@/app/svg-repo";
import { Dispatch, RefObject, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { LaurusEffect, LaurusScaleEquation, LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "../../workspace.client";
import { getScale, LaurusLoopType, updateScale } from "../../workspace.server";
import { ScaleUnitControls, defaultScaleEquation } from "../scale-unit";
import { getDynamicUnitSizes } from "../../workspace.config";

interface ScaleUnitbar {
    scale: LaurusScaleResult,
    carouselEntryKey: string,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    carouselIndex: number,
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
    svgElementsRef,
    imgElementsRef,
    carouselIndex,
    unlockAspectRatio,
    updateTrackpads,
    currentControls,
    setCurrentControls,
    saveNewEquation,
    setUnlockAspectRatio }: ScaleUnitbar) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        const ds = getDynamicUnitSizes(appState.resolution);
        switch (appState.resolution.type) {
            case "high": return {
                ...ds,
                angleParam: { padding: 15 }
            }
            case "midhigh": return {
                ...ds,
                angleParam: { padding: Math.round(15 * appState.resolution.factor) }

            }
            case "midlow": return {
                ...ds,
                angleParam: { padding: Math.round(15 * appState.resolution.factor) }
            }
            case "low": return {
                ...ds,
                angleParam: { padding: Math.round(15 * appState.resolution.factor) }
            }
        }
    });

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        const activeKey = carouselEntryKey;
        if (!activeKey) return [];
        const newAnimations: Animation[] = [];
        const response = await getScale(appState.apiOrigin, scale.scale_id, activeKey);
        const math: Map<string, LaurusScaleEquation> | undefined = response?.math;
        const fps = response?.fps;
        const end = response?.end;
        if (!math || math.size == 0 || !fps || !end) return [];
        const activeMath = math
            .get(activeKey);
        if (!activeMath) return [];
        const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
            .map(s => { return { "scale": `${s.x} ${s.y}` } }) ?? [];
        const options: KeyframeAnimationOptions = {
            duration: firstFrame ? 2 / fps : end * 1000,
        }
        const previewKey = appState.tool.type != 'viewport' ? `${activeKey}|preview` : activeKey;
        switch (appState.carouselEntries[carouselIndex].type) {
            case "svg": {
                const svgRef = svgElementsRef.current?.get(previewKey);
                if (!svgRef) return [];
                svgRef.getAnimations().forEach((a) => a.cancel());
                const keyframeEffect =
                    new KeyframeEffect(svgRef, keyframes, options);
                newAnimations.push(new Animation(keyframeEffect, document.timeline));
                break;
            }
            case "img": {
                const imgRef = imgElementsRef.current?.get(previewKey);
                if (!imgRef) return [];
                imgRef.getAnimations().forEach((a) => a.cancel());
                const keyframeEffect =
                    new KeyframeEffect(imgRef, keyframes, options);
                newAnimations.push(new Animation(keyframeEffect, document.timeline));
                break;
            }
        }
        return newAnimations;
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, carouselEntryKey, imgElementsRef, scale.scale_id, svgElementsRef]);

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
        const currentFactor = scale.math.get(carouselEntryKey)?.limit_factor;
        if (!currentFactor) return 1;
        return Math.max(0.1, Math.round((currentFactor - 0.1) * 100) / 100);
    }, [carouselEntryKey, scale.math]);

    const incrementLimitFactor = useCallback((): number => {
        const currentFactor = scale.math.get(carouselEntryKey)?.limit_factor;
        if (!currentFactor) return 1;
        return Math.min(1, Math.round((currentFactor + 0.1) * 100) / 100);
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
                    if (scale.locked) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            { ...activeEquation, loop: getNextLoopType() } :
                            {
                                ...defaultScaleEquation,
                                input_id: activeKey,
                                loop: getNextLoopType(),
                            };
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
                        cursor: scale.locked ? '' : scale.math.has(carouselEntryKey) ? 'pointer' : '',
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
            <div title={"rewind"}
                onClick={async () => {
                    const newAnimations = await getPreviewAnimations(true);
                    Promise.all(newAnimations.map(animation => animation.finished))
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .then((_animations: Animation[]) => {
                            dispatch({ type: WorkspaceActionType.SetRecordingLight, value: false });
                        })
                        .catch(err => {
                            if (err instanceof Error && err.name !== 'AbortError') {
                                console.log('unknown error from waapi:', err);
                            }
                        });
                    newAnimations.forEach(a => {
                        a.play();
                    });
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"rewind"}
                    svg={scale.math.has(carouselEntryKey) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.9}
                    scaleToContaier={true} />
            </div>
            <div title={"play"}
                onClick={async () => {
                    const newAnimations = await getPreviewAnimations(false);
                    Promise.all(newAnimations.map(animation => animation.finished))
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .then((_animations: Animation[]) => {
                            dispatch({ type: WorkspaceActionType.SetRecordingLight, value: false });
                        })
                        .catch(err => {
                            if (err instanceof Error && err.name !== 'AbortError') {
                                console.log('unknown error from waapi:', err);
                            }
                        });
                    newAnimations.forEach(a => {
                        a.play();
                    });
                    dispatch({ type: WorkspaceActionType.SetRecordingLight, value: true });
                }}
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"play"}
                    svg={scale.math.has(carouselEntryKey) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={1}
                    scaleToContaier={true} />
            </div>
            <div title={"increase limits"}
                onClick={() => {
                    if (scale.locked || (scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor == 1)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: incrementLimitFactor(),
                            } :
                            {
                                ...defaultScaleEquation,
                                input_id: activeKey,
                            };
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
                    svg={scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor != 1 ? add2() : add2("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"decrease limits"}
                onClick={() => {
                    if (scale.locked || (scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor == 0.1)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const snapshot: LaurusScaleResult = { ...scale };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: decrementLimitFactor(),
                            } :
                            {
                                ...defaultScaleEquation,
                                input_id: activeKey,
                            };
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
                    svg={scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor != 0.1 ? remove() : remove("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"link width and height"}
                onClick={() => {
                    setUnlockAspectRatio(v => !v);
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
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={1}
                    scaleToContaier={true} />
            </div>
            <div title={"copy"}
                onClick={() => {
                    let clipboardData: ScaleUnitControls = { ...currentControls };
                    const activeEquation = scale.math.get(carouselEntryKey);
                    if (activeEquation) {
                        clipboardData = { ...activeEquation };
                    }
                    const currentEq: LaurusScaleEquation = {
                        ...clipboardData,
                        input_id: "clipboard",
                        loop: defaultScaleEquation.loop,
                        solution: defaultScaleEquation.solution,
                        limit_factor: defaultScaleEquation.limit_factor
                    }
                    const newMath: Map<string, LaurusScaleEquation> = new Map();
                    newMath.set("clipboard", currentEq);
                    const newClipboardEffect: LaurusEffect = {
                        type: 'scale',
                        key: scale.scale_id,
                        value: { ...scale, math: newMath }
                    };
                    dispatch({ type: WorkspaceActionType.SetEffectClipboard, value: newClipboardEffect });
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
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
            <div title={"paste"}
                onClick={() => {
                    if (appState.effectClipboard && appState.effectClipboard.type == 'scale') {
                        const clipboardEquation = appState.effectClipboard.value.math.get("clipboard");
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
                    svg={appState.effectClipboard?.type == 'scale' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
                    containerStyle={{
                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.9}
                    scaleToContaier={true} />
            </div>
            <div title={"clear"}
                onClick={async () => {
                    if (scale.locked) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && scale.math.has(activeKey)) {
                        const confirmed = confirm('are you sure you want to clear this equation?');
                        if (!confirmed) return;
                        const snapshot: LaurusScaleResult = { ...scale };
                        const newMath = new Map(snapshot.math);
                        newMath.delete(activeKey);
                        const newScale: LaurusScaleResult = { ...snapshot, math: newMath };
                        const defaultControls: ScaleUnitControls = { scale_x: defaultScaleEquation.scale_x, scale_y: defaultScaleEquation.scale_y, time: 0 };
                        setCurrentControls(defaultControls);
                        updateTrackpads(defaultControls);
                        dispatch({
                            type: WorkspaceActionType.SetEffect,
                            value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id },
                        });
                        const updated = await updateScale(appState.apiOrigin, appState.accessToken, snapshot.scale_id, { ...newScale });
                        if (!updated) {
                            dispatch({
                                type: WorkspaceActionType.SetEffect,
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
                        cursor: scale.locked ? '' : scale.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
        </div>
    </>
}
