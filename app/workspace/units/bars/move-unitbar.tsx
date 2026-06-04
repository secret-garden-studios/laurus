import { dmSans } from "@/app/fonts";
import { LaurusClientSvg, SvgRepo, add2, autorenew, cancelCircle, circleFillZero, contentPaste, earthquake, ellipseFillZero, fileCopy, playArrow, remove, skipPrevious, syncAlt, updateDisabled } from "@/app/svg-repo";
import { Dispatch, RefObject, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { LaurusEffect, LaurusMoveEquation, LaurusMoveResult, WorkspaceActionType, WorkspaceContext } from "../../workspace.client";
import { getMove, LaurusLoopType, LaurusShapeType, updateMove } from "../../workspace.server";
import { getDynamicUnitSizes, LIMIT_FACTOR_STEP, MIN_LIMIT_FACTOR } from "../../workspace.config";
import { MoveUnitControls, defaultMoveEquation } from "../move-unit";

interface MoveUnitbar {
    move: LaurusMoveResult,
    carouselEntryKey: string,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    carouselIndex: number,
    saveNewEquation: (rollback: LaurusMoveResult, newEquation: LaurusMoveEquation) => Promise<void>,
    updateTrackpads: (newControls: MoveUnitControls) => void,
    currentControls: MoveUnitControls,
    setCurrentControls: Dispatch<SetStateAction<MoveUnitControls>>,
}

export default function MoveUnitbar({
    move,
    carouselEntryKey,
    svgElementsRef,
    imgElementsRef,
    carouselIndex,
    saveNewEquation,
    updateTrackpads,
    currentControls,
    setCurrentControls, }: MoveUnitbar) {
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
        const response = await getMove(appState.apiOrigin, move.move_id, activeKey);
        const math: Map<string, LaurusMoveEquation> | undefined = response?.math;
        const fps = response?.fps;
        const end = response?.end;
        if (!math || math.size == 0 || !fps || !end) return [];

        const activeMath = math
            .get(activeKey);
        if (!activeMath) return [];
        const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
            .map(s => { return { translate: `${s.x}px ${s.y}px 0px`, } }) ?? [];
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
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, carouselEntryKey, imgElementsRef, move.move_id, svgElementsRef]);

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
        return Math.min(1, Math.round((currentFactor + LIMIT_FACTOR_STEP) * 100) / 100);
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
                    if (move.locked) return;
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
                        cursor: move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.85}
                    scaleToContaier={true} />
            </div>
            <div title={"loop"}
                onDoubleClick={() => {
                    if (move.locked) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            { ...activeEquation, loop: getNextLoopType() } :
                            {
                                ...defaultMoveEquation,
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
                    ...dynamicSizes.paramButtonContainer
                }}>
                <SvgRepo
                    title={"loop"}
                    svg={loopSvg}
                    containerStyle={{
                        cursor: move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : '',
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
                    svg={move.math.has(carouselEntryKey) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.92}
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
                    svg={move.math.has(carouselEntryKey) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={1}
                    scaleToContaier={true} />
            </div>
            <div title={"increase limits"}
                onClick={() => {
                    if (move.locked || (move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor == 1)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && move.math.has(activeKey)) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: incrementLimitFactor(),
                            } :
                            {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                limit_factor: incrementLimitFactor(),
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
                    svg={move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor != 1 ? add2() : add2("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"decrease limits"}
                onClick={() => {
                    if (move.locked || (move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor == MIN_LIMIT_FACTOR)) return;
                    const activeKey = carouselEntryKey;
                    if (activeKey && move.math.has(activeKey)) {
                        const snapshot: LaurusMoveResult = { ...move };
                        const activeEquation = snapshot.math.get(activeKey);
                        const newEquation = activeEquation ?
                            {
                                ...activeEquation,
                                limit_factor: decrementLimitFactor(),
                            } :
                            {
                                ...defaultMoveEquation,
                                input_id: activeKey,
                                limit_factor: decrementLimitFactor(),
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
                    svg={move.math.has(carouselEntryKey) && move.math.get(carouselEntryKey)!.limit_factor != MIN_LIMIT_FACTOR ? remove() : remove("rgb(62,62,62)")}
                    containerStyle={{
                        cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.88}
                    scaleToContaier={true} />
            </div>
            <div title={"copy"}
                onClick={() => {
                    let clipboardData: MoveUnitControls = { ...currentControls };
                    const activeEquation = move.math.get(carouselEntryKey);
                    if (activeEquation) {
                        clipboardData = { ...activeEquation };
                    }
                    const currentMoveEq: LaurusMoveEquation = {
                        ...clipboardData,
                        input_id: "clipboard",
                        loop: defaultMoveEquation.loop,
                        solution: defaultMoveEquation.solution,
                        limit_factor: defaultMoveEquation.limit_factor
                    }
                    const newMath: Map<string, LaurusMoveEquation> = new Map();
                    newMath.set("clipboard", currentMoveEq);
                    const newClipboardEffect: LaurusEffect = {
                        type: 'move',
                        key: move.move_id,
                        value: { ...move, math: newMath }
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
                    svg={move.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                    containerStyle={{
                        cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
            <div title={"paste"}
                onClick={() => {
                    if (appState.effectClipboard && appState.effectClipboard.type == 'move') {
                        const clipboardEquation = appState.effectClipboard.value.math.get("clipboard");
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
                    svg={appState.effectClipboard?.type == 'move' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
                    containerStyle={{
                        cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.9}
                    scaleToContaier={true} />
            </div>
            <div title={"clear"}
                onClick={async () => {
                    if (move.locked) return;
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
                            type: WorkspaceActionType.SetEffect,
                            value: { type: 'move', value: { ...newMove }, key: newMove.move_id },
                        });
                        const updated = await updateMove(appState.apiOrigin, appState.accessToken, snapshot.move_id, { ...newMove });
                        if (!updated) {
                            dispatch({
                                type: WorkspaceActionType.SetEffect,
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
                        cursor: move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : '',
                        ...dynamicSizes.paramButton
                    }}
                    scale={0.8}
                    scaleToContaier={true} />
            </div>
        </div>
    </>
}
