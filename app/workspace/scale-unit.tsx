import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { convertTime, LaurusActiveElement, LaurusScaleEquation, LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { dellaRespira, dmSans } from "../fonts";
import { autorenew, playArrow, skipPrevious, SvgRepo, link, linkOff, refresh, LaurusClientSvg, add2, remove } from "../svg-repo";
import { getScale, updateScale, LaurusLoopType } from "./workspace.server";
import { useComplexTrackpadState } from "../hooks/useComplexTrackpadState";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { ParameterSliderY, ParameterSliderXPlusMinus } from "../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getDynamicUnitSizes } from "./workspace-resolution";
import { LaurusProjectResult } from "../projects/projects.client";
import { useCarouselIndex } from "../hooks/useCarouselIndex";

const defaultScaleEquation: LaurusScaleEquation = {
    input_id: "",
    time: 0.000001,
    scale_x: 1,
    scale_y: 1,
    loop: LaurusLoopType.none,
    solution: [],
    limit_factor: 1.0
}

interface ScaleUnit {
    scale: LaurusScaleResult
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    carouselIndexInit: number,
}
export default function ScaleUnit({ scale, svgElementsRef, imgElementsRef, carouselIndexInit }: ScaleUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const { carouselIndex, localIndex, setLocalIndex } =
        useCarouselIndex(appState.activeElement, appState.carouselEntries, carouselIndexInit, scale.scale_id);
    const [mainControls] = useState(true);
    const [dynamicSizes] = useState(() => {
        const ds = getDynamicUnitSizes(appState.resolution);
        switch (appState.resolution.type) {
            case "high": return {
                ...ds,
                scaleParam: {
                    capWidth: 21,
                    capHeight: 21,
                    capBorderOffset: 0,
                    containerWidth: 280,
                    containerHeight: 38,
                    trackHeight: 1,
                    tickHeight: 28,
                    tickLeft: 1,
                    svgSize: { width: 24, height: 24 }
                },
                scaleParamDisplay: {
                    fontSize: 24,
                    inputHeight: '100%',
                    unitLabelFontSize: 14,
                    unitFontSize: 18,
                    letterSpacing: 2,
                    gridGap: 0,
                    marginTop: 36,
                    flexGap: 4,
                }
            }
            case "midhigh": return {
                ...ds,
                scaleParam: {
                    capWidth: 13,
                    capHeight: 13,
                    capBorderOffset: 0,
                    containerWidth: 170,
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 1,
                    svgSize: { width: 20, height: 20 }
                },
                scaleParamDisplay: {
                    fontSize: 16,
                    inputHeight: '100%',
                    unitLabelFontSize: 10,
                    unitFontSize: 12,
                    letterSpacing: 2,
                    gridGap: 0,
                    marginTop: 20,
                    flexGap: 4,
                }
            }
            case "midlow":
            case "low": return {
                ...ds,
                scaleParam: {
                    capWidth: 11,
                    capHeight: 11,
                    capBorderOffset: 0,
                    containerWidth: 160,
                    containerHeight: 20,
                    trackHeight: 1,
                    tickHeight: 16,
                    tickLeft: 1,
                    svgSize: { width: 16, height: 16 }
                },
                scaleParamDisplay: {
                    fontSize: 12,
                    inputHeight: '100%',
                    unitLabelFontSize: 8,
                    unitFontSize: 10,
                    letterSpacing: 1,
                    gridGap: 0,
                    marginTop: 20,
                    flexGap: 1,
                }
            }
        }
    });
    const carouselEntryKey = useMemo(() => {
        if (carouselIndex < appState.carouselEntries.length) {
            const carouselEntry = appState.carouselEntries[carouselIndex];
            switch (carouselEntry.type) {
                case "svg": {
                    return appState.project.svgs.entries().find(m => m[0] == carouselEntry.key)?.[0] ?? "";
                }
                case "img": {
                    return appState.project.imgs.entries().find(m => m[0] == carouselEntry.key)?.[0] ?? "";
                }
            }
        }
        else {
            return "";
        }
    }, [appState.carouselEntries, appState.project.imgs, appState.project.svgs, carouselIndex]);

    // param 1
    const timeUpperLimit = useMemo(() => {
        return convertTime(appState.timelineMaxValue, appState.timelineUnit, 'sec')
    }, [appState.timelineMaxValue, appState.timelineUnit]);
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            timeUpperLimit * (scale.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const timeTitle = useMemo(() => {
        return scale.math.has(carouselEntryKey) ? ((scale.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + 's') : undefined;
    }, [carouselEntryKey, scale.math]);

    // main params
    const [maxScale] = useState(30);
    const [unlockAspectRatio, setUnlockAspectRatio] = useState(false);

    const scaleXRef = useRef<HTMLInputElement | null>(null);
    const scaleXTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleXCursor, setScaleXCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleXValue, getComplexTrackCursor: getScaleXCursor } =
        useComplexTrackpadState(
            dynamicSizes.scaleParam.capWidth - dynamicSizes.scaleParam.capBorderOffset,
            maxScale);
    const scaleXTitle = useMemo(() => {
        return scale.math.has(carouselEntryKey) ? (scale.math.get(carouselEntryKey)!.scale_x.toFixed(3)) : undefined;
    }, [carouselEntryKey, scale.math]);

    const scaleYRef = useRef<HTMLInputElement | null>(null);
    const scaleYTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleYCursor, setScaleYCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleYValue, getComplexTrackCursor: getScaleYCursor } =
        useComplexTrackpadState(
            dynamicSizes.scaleParam.capWidth - dynamicSizes.scaleParam.capBorderOffset,
            maxScale);
    const scaleYTitle = useMemo(() => {
        return scale.math.has(carouselEntryKey) ? (scale.math.get(carouselEntryKey)!.scale_y.toFixed(3)) : undefined;
    }, [carouselEntryKey, scale.math]);

    const setActiveElementIfNull = useCallback(() => {
        if (carouselIndex < appState.carouselEntries.length && appState.activeElement == undefined) {
            const carouselEntry = appState.carouselEntries[carouselIndex];
            switch (carouselEntry.type) {
                case "svg": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "svg",
                        locallyActivatedEffectKey: scale.scale_id
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
                case "img": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "img",
                        locallyActivatedEffectKey: scale.scale_id
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
            }
        }
    }, [appState.activeElement, appState.carouselEntries, carouselIndex, dispatch, scale.scale_id]);

    const getActiveScale = useCallback((): [number, number] => {
        if (!appState.activeElement) return [1, 1];
        const activeElement = { ...appState.activeElement };
        if (!activeElement) return [1, 1];
        const snapshot: LaurusProjectResult = { ...appState.project };
        switch (activeElement.type) {
            case "svg": {
                const svg = snapshot.svgs.get(activeElement.key);
                if (!svg) return [1, 1];
                return [svg.scale_x, svg.scale_y]
            }
            case "img": {
                const img = snapshot.imgs.get(activeElement.key);
                if (!img) return [1, 1];
                return [img.scale_x, img.scale_y]
            }
        }
    }, [appState.activeElement, appState.project]);

    const saveNewEquation = useCallback(async (rollback: LaurusScaleResult, newEquation: LaurusScaleEquation) => {
        const newMath: Map<string, LaurusScaleEquation> = new Map(rollback.math);
        newMath.set(newEquation.input_id, newEquation);
        const newScale: LaurusScaleResult = { ...rollback, math: newMath };
        setActiveElementIfNull();
        dispatch({
            type: WorkspaceActionType.SetEffect,
            value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id, locked: newScale.locked },
        });
        const updated = await updateScale(appState.apiOrigin, appState.accessToken, rollback.scale_id, { ...newScale });
        if (!updated) {
            dispatch({
                type: WorkspaceActionType.SetEffect,
                value: { type: 'scale', value: { ...rollback }, key: rollback.scale_id, locked: rollback.locked },
            });
        }
    }, [setActiveElementIfNull, dispatch, appState.apiOrigin, appState.accessToken]);

    useLayoutEffect(() => {
        (async () => {
            const activeKey = carouselEntryKey;
            const activeEquation = scale.math.get(activeKey);
            let scaleXInit = defaultScaleEquation.scale_x;
            let scaleYInit = defaultScaleEquation.scale_y;
            let timeInit = defaultScaleEquation.time;
            if (activeEquation) {
                timeInit = activeEquation.time / 1000;
                scaleXInit = activeEquation.scale_x;
                scaleYInit = activeEquation.scale_y;
            }
            if (scaleXTrackRef.current) {
                const newScaleXCursor = getScaleXCursor(scaleXInit, scaleXTrackRef.current.clientWidth);
                setScaleXCursor({ x: newScaleXCursor, y: 0 });
            }
            if (scaleYTrackRef.current) {
                const newScaleYCursor = getScaleYCursor(scaleYInit, scaleYTrackRef.current.clientWidth);
                setScaleYCursor({ x: newScaleYCursor, y: 0 });
            }
            if (timeTrackRef.current) {
                const newTimeCursor = getTimeCursor(timeInit, (timeTrackRef.current.clientHeight));
                setTimeCursor({ y: newTimeCursor, x: 0 });
            }
            if (scaleXRef.current) {
                const activeMath = scale.math.get(activeKey);
                if (activeMath) {
                    scaleXRef.current.value = activeMath.scale_x >= 10 ? activeMath.scale_x.toFixed(2) : activeMath.scale_x.toFixed(3);
                }
                else {
                    scaleXRef.current.value = '1.000'
                }
            }
            if (scaleYRef.current) {
                const activeMath = scale.math.get(activeKey);
                if (activeMath) {
                    scaleYRef.current.value = activeMath.scale_y >= 10 ? activeMath.scale_y.toFixed(2) : activeMath.scale_y.toFixed(3);
                }
                else {
                    scaleYRef.current.value = '1.000'
                }
            }
        })();
    }, [carouselEntryKey, getScaleXCursor, getScaleYCursor, getTimeCursor, scale.math]);

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        const activeKey = carouselEntryKey;
        if (!activeKey) return [];
        const newAnimations: Animation[] = [];
        const response: LaurusScaleResult | undefined =
            await getScale(appState.apiOrigin, scale.scale_id, activeKey);
        if (response) {
            const activeMath = response.math
                .get(activeKey);
            if (!activeMath) return [];
            const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
                .map(s => { return { "scale": `${s.x} ${s.y}` } }) ?? [];
            const options: KeyframeAnimationOptions = {
                duration: firstFrame ? 2 / response.fps : response.end * 1000,
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
        }
        return newAnimations;
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, carouselEntryKey, imgElementsRef, scale.scale_id, svgElementsRef]);

    const loopSvg = useMemo((): [boolean, LaurusClientSvg] => {
        const loopType = scale.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        const enabled = scale.math.has(carouselEntryKey) ? true : false;
        const selected = loopType != LaurusLoopType.none;
        switch (loopType) {
            case LaurusLoopType.none:
            case LaurusLoopType.loop: {
                return enabled ? [selected, refresh()] : [selected, refresh('rgb(62,62,62)')];
            }
            case LaurusLoopType.loop_reverse: {
                return enabled ? [selected, autorenew()] : [selected, autorenew('rgb(62,62,62)')];
            }
            default: {
                return [false, autorenew('rgb(62,62,62)')]
            }
        }
    }, [carouselEntryKey, scale.math]);

    const getNextLoopType = useCallback((): LaurusLoopType => {
        const currentLoop = scale.math.get(carouselEntryKey)?.loop;
        switch (currentLoop) {
            case LaurusLoopType.none: {
                return LaurusLoopType.loop;
            }
            case LaurusLoopType.loop: {
                return LaurusLoopType.loop_reverse;
            }
            case LaurusLoopType.loop_reverse: {
                return LaurusLoopType.none;
            }
            default: {
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

    return (
        <div style={{
            gridTemplateRows: 'auto',
            gridTemplateColumns: 'min-content auto',
            display: "grid",
            alignItems: 'center',
        }}>
            {mainControls ?
                <>
                    {/* display */}
                    <UnitDisplay
                        carouselIndex={carouselIndex}
                        effectKey={scale.scale_id}
                        localIndex={localIndex}
                        onNewLocalIndex={setLocalIndex} />
                    {/* controls */}
                    {/* parameters */}
                    <div style={{ ...dynamicSizes.param }}>
                        <div style={{
                            border: '1px solid rgba(255,255,255,0.025)',
                            backgroundColor: "rgba(20, 20, 20, 0.25)",
                            boxShadow: '4px 4px 12px rgba(11, 11, 11, 0.5)',
                            borderRadius: 6,
                            padding: 0,
                            display: 'flex',
                            height: dynamicSizes.paramButtonContainer.height * 8
                        }}>
                            <div style={{
                                height: '100%',
                                display: 'flex',
                                borderRight: '1px solid rgba(255,255,255,0.025)',
                                ...dynamicSizes.paramFlex
                            }}>
                                <ParameterSliderY
                                    label={"time"}
                                    hash={`${scale.scale_id}|p1`}
                                    size={dynamicSizes.paramSlider}
                                    trackRef={timeTrackRef}
                                    trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
                                    cursor={timeCursor}
                                    onNewCursor={(newCursor) => {
                                        setTimeCursor({ ...newCursor, x: 0 });
                                        if (!timeTrackRef.current) return;
                                        const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight, 0);
                                        const activeKey = carouselEntryKey;
                                        if (activeKey) {
                                            const snapshot: LaurusScaleResult = { ...scale };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            const newServerTime = newTime * 1000;
                                            const newEquation: LaurusScaleEquation = activeEquation ?
                                                { ...activeEquation, time: newServerTime } :
                                                {
                                                    ...defaultScaleEquation,
                                                    input_id: activeKey,
                                                    time: newServerTime,
                                                };
                                            saveNewEquation(snapshot, newEquation);
                                        }
                                    }}
                                    disabled={scale.locked}
                                    title={timeTitle} />
                            </div>
                            <div
                                style={{
                                    padding: 0,
                                    display: 'grid',
                                    gap: dynamicSizes.scaleParamDisplay.gridGap,
                                    placeContent: 'center',
                                    width: '100%'
                                }}>
                                <div style={{ display: 'flex', marginLeft: 0, gap: dynamicSizes.scaleParamDisplay.flexGap }}>
                                    <div className={dmSans.className} style={{
                                        height: dynamicSizes.scaleParamDisplay.inputHeight,
                                        display: 'grid',
                                        alignContent: 'center',
                                        color: "rgb(220, 220, 220)",
                                        fontWeight: 'bold',
                                        fontSize: dynamicSizes.scaleParamDisplay.unitLabelFontSize
                                    }}>
                                        {'w'}
                                    </div>
                                    <input className={dellaRespira.className}
                                        id={`scale-x-input-${scale.scale_id}`}
                                        disabled
                                        ref={scaleXRef}
                                        type="text"
                                        placeholder="0.00"
                                        style={{
                                            textAlign: "right",
                                            background: 'none',
                                            color: "rgba(255, 255, 255, 0.7)",
                                            border: 'none',
                                            outline: 'none',
                                            display: 'inline-block',
                                            overflowX: 'scroll',
                                            letterSpacing: `${dynamicSizes.scaleParamDisplay.letterSpacing}px`,
                                            fontSize: dynamicSizes.scaleParamDisplay.fontSize,
                                            height: dynamicSizes.scaleParamDisplay.inputHeight,
                                            width: '6ch',
                                            textShadow: '2px 2px 3px rgba(10,10,10,1)',
                                        }} />
                                    <div className={dmSans.className} style={{
                                        height: dynamicSizes.scaleParamDisplay.inputHeight,
                                        display: 'grid',
                                        alignContent: 'center',
                                        color: "rgb(240, 240, 240)",
                                        fontSize: dynamicSizes.scaleParamDisplay.unitFontSize
                                    }}>
                                        <i>{'x'}</i>
                                    </div>
                                </div>
                                <ParameterSliderXPlusMinus
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p2`}
                                    size={dynamicSizes.scaleParam}
                                    containerRef={scaleXTrackRef}
                                    cursor={scaleXCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleXTrackRef.current || !scaleXRef.current || !scaleYRef.current) return;
                                        const newScaleValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth);
                                        scaleXRef.current.value = newScaleValue >= 10 ?
                                            (newScaleValue).toFixed(2) :
                                            (newScaleValue).toFixed(3);

                                        if (!unlockAspectRatio) {
                                            scaleYRef.current.value = newScaleValue >= 10 ?
                                                (newScaleValue).toFixed(2) :
                                                (newScaleValue).toFixed(3);
                                        }
                                    }}
                                    onNewCursor={(newCursor) => {
                                        setScaleXCursor({ ...newCursor, y: 0 });
                                        if (!scaleXTrackRef.current) return;
                                        const newScaleXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth);
                                        let newScaleYValue: number | undefined = undefined;
                                        if (!unlockAspectRatio) {
                                            const d = getActiveScale();
                                            const r = d[0] / d[1];
                                            const newYCursor = newCursor.x / r;
                                            setScaleYCursor({ x: newYCursor, y: 0 });
                                            newScaleYValue = newScaleXValue / r;
                                        }
                                        const activeKey = carouselEntryKey;
                                        if (activeKey) {
                                            const snapshot: LaurusScaleResult = { ...scale };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            if (activeEquation) {
                                                const newEquation =
                                                {
                                                    ...activeEquation,
                                                    scale_x: newScaleXValue,
                                                    ...(newScaleYValue != undefined && { scale_y: newScaleYValue })
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                            else {
                                                const newEquation = {
                                                    ...defaultScaleEquation,
                                                    input_id: activeKey,
                                                    scale_x: newScaleXValue,
                                                    scale_y: newScaleYValue != undefined ? newScaleYValue : 1,
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }
                                    }}
                                    disabled={scale.locked}
                                    title={scaleXTitle} />
                                <div style={{ display: 'flex', marginTop: dynamicSizes.scaleParamDisplay.marginTop, gap: dynamicSizes.scaleParamDisplay.flexGap }}>
                                    <div className={dmSans.className}
                                        style={{
                                            height: dynamicSizes.scaleParamDisplay.inputHeight,
                                            display: 'grid',
                                            alignContent: 'center',
                                            color: "rgb(220, 220, 220)",
                                            fontWeight: 'bold',
                                            fontSize: dynamicSizes.scaleParamDisplay.unitLabelFontSize
                                        }}>
                                        {'h'}
                                    </div>
                                    <input className={dellaRespira.className}
                                        id={`scale-y-input-${scale.scale_id}`}
                                        disabled
                                        ref={scaleYRef}
                                        type="text"
                                        placeholder="0.00"
                                        style={{
                                            textAlign: "right",
                                            background: 'none',
                                            color: "rgba(255, 255, 255, 0.7)",
                                            border: 'none',
                                            outline: 'none',
                                            display: 'inline-block',
                                            overflowX: 'scroll',
                                            letterSpacing: `${dynamicSizes.scaleParamDisplay.letterSpacing}px`,
                                            fontSize: dynamicSizes.scaleParamDisplay.fontSize,
                                            height: dynamicSizes.scaleParamDisplay.inputHeight,
                                            width: '6ch',
                                            textShadow: '2px 2px 3px rgba(10,10,10,1)',
                                        }} />
                                    <div className={dmSans.className}
                                        style={{
                                            height: dynamicSizes.scaleParamDisplay.inputHeight,
                                            display: 'grid',
                                            alignContent: 'center',
                                            color: "rgb(240, 240, 240)",
                                            fontSize: dynamicSizes.scaleParamDisplay.unitFontSize
                                        }}>
                                        <i>{'x'}</i>
                                    </div>
                                </div>
                                <ParameterSliderXPlusMinus
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p3`}
                                    size={dynamicSizes.scaleParam}
                                    containerRef={scaleYTrackRef}
                                    cursor={scaleYCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleYTrackRef.current || !scaleYRef.current || !scaleXRef.current) return;
                                        const newScaleValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth);
                                        scaleYRef.current.value = newScaleValue >= 10 ?
                                            (newScaleValue).toFixed(2) :
                                            (newScaleValue).toFixed(3);

                                        if (!unlockAspectRatio) {
                                            scaleXRef.current.value = newScaleValue >= 10 ?
                                                (newScaleValue).toFixed(2) :
                                                (newScaleValue).toFixed(3);
                                        }
                                    }}
                                    onNewCursor={(newCursor) => {
                                        setScaleYCursor({ ...newCursor, y: 0 });
                                        if (!scaleYTrackRef.current) return;
                                        const newScaleYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth);
                                        let newScaleXValue: number | undefined = undefined;
                                        if (!unlockAspectRatio) {
                                            const d = getActiveScale();
                                            const r = d[0] / d[1];
                                            const newXCursor = newCursor.x * r;
                                            setScaleXCursor({ x: newXCursor, y: 0 });
                                            newScaleXValue = newScaleYValue / r;
                                        }
                                        const activeKey = carouselEntryKey;
                                        if (activeKey) {
                                            const snapshot: LaurusScaleResult = { ...scale };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            if (activeEquation) {
                                                const newEquation =
                                                {
                                                    ...activeEquation,
                                                    scale_y: newScaleYValue,
                                                    ...(newScaleXValue != undefined && { scale_x: newScaleXValue })
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                            else {
                                                const newEquation = {
                                                    ...defaultScaleEquation,
                                                    input_id: activeKey,
                                                    scale_x: newScaleXValue != undefined ? newScaleXValue : 1,
                                                    scale_y: newScaleYValue,
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }
                                    }}
                                    disabled={scale.locked}
                                    title={scaleYTitle} />
                            </div>
                            {/* toolbar */}
                            <div style={{
                                marginLeft: 'auto',
                                background: 'linear-gradient(45deg, rgb(18, 18, 18), rgb(22, 22, 22))',
                                borderLeft: '1px solid rgba(255,255,255,0.025)',
                                borderTopRightRadius: 6,
                                borderBottomRightRadius: 6,
                                padding: 0,
                                display: 'grid',
                                alignContent: 'start',
                            }}>
                                <div title={"loop"}
                                    onClick={() => {
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
                                        cursor: scale.locked ? '' : scale.math.has(carouselEntryKey) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        background: loopSvg[0] ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                        borderTopRightRadius: 6,
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        title={"loop"}
                                        svg={loopSvg[1]}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={0.9} />
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
                                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        title={"rewind"}
                                        svg={scale.math.has(carouselEntryKey) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={0.9} />
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
                                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        title={"play"}
                                        svg={scale.math.has(carouselEntryKey) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={1} />
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
                                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer,
                                    }}>
                                    <SvgRepo
                                        title={"increase limits"}
                                        svg={scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor != 1 ? add2() : add2("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={0.88} />
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
                                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer,
                                    }}>
                                    <SvgRepo
                                        title={"decrease limits"}
                                        svg={scale.math.has(carouselEntryKey) && scale.math.get(carouselEntryKey)!.limit_factor != 0.1 ? remove() : remove("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={0.88} />
                                </div>
                                <div title={"link width and height"}
                                    onClick={() => {
                                        setUnlockAspectRatio(v => !v);
                                    }}
                                    style={{
                                        cursor: scale.math.has(carouselEntryKey) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        title={"link width and height"}
                                        svg={scale.math.has(carouselEntryKey) ? (unlockAspectRatio ? linkOff() : link()) : (unlockAspectRatio ? linkOff("rgb(62, 62, 62)") : link("rgb(62, 62, 62)"))}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={1} />
                                </div>
                            </div>
                        </div>
                    </div>
                </> :
                <>
                    {/* deep controls */}
                    <DeepControls />
                </>
            }
        </div >
    )
}
