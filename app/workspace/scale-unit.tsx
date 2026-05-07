import { RefObject, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { LaurusActiveElement, LaurusScaleEquation, LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { dellaRespira } from "../fonts";
import { autorenew, playArrow, skipPrevious, SvgRepo, link, linkOff, } from "../svg-repo";
import { getScale, updateScale } from "./workspace.server";
import { useComplexTrackpadState } from "../hooks/useComplexTrackpadState";
import { useTrackpadState } from "../hooks/useTrackpadState";
import ParameterSliderY, { ParameterSliderX } from "../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getDynamicUnitSizes } from "./workspace-resolution";
import { LaurusProjectResult } from "../projects/projects.client";

interface ScaleUnit {
    scale: LaurusScaleResult
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    carouselIndexInit: number,
}
export default function ScaleUnit({ scale, svgElementsRef, imgElementsRef, carouselIndexInit }: ScaleUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [carouselIndex, setCarouselIndex] = useState(carouselIndexInit);
    const [mainControls] = useState(true);
    const [dynamicSizes] = useState(() => {
        const ds = getDynamicUnitSizes(appState.resolution);
        switch (appState.resolution.type) {
            case "high": return {
                ...ds,
                scaleParam: {
                    capWidth: 21,
                    capHeight: 21,
                    capBorderOffset: 1,
                    containerWidth: 280,
                    containerHeight: 38,
                    trackHeight: 1,
                    tickHeight: 28,
                    tickLeft: 2
                },
                scaleParamDisplay: {
                    fontSize: Math.round(28 * appState.resolution.factor),
                    inputHeight: Math.round(30 * appState.resolution.factor),
                    unitLabelFontSize: Math.round(16 * appState.resolution.factor),
                    unitFontSize: Math.round(20 * appState.resolution.factor),
                    letterSpacing: Math.round(5 * appState.resolution.factor)
                }
            }
            case "midhigh": return {
                ...ds,
                scaleParam: {
                    capWidth: 17,
                    capHeight: 17,
                    capBorderOffset: 2,
                    containerWidth: Math.round(230 * appState.resolution.factor),
                    containerHeight: 38,
                    trackHeight: 1,
                    tickHeight: 28,
                    tickLeft: 2
                },
                scaleParamDisplay: {
                    fontSize: Math.round(28 * appState.resolution.factor),
                    inputHeight: Math.round(30 * appState.resolution.factor),
                    unitLabelFontSize: Math.round(16 * appState.resolution.factor),
                    unitFontSize: Math.round(20 * appState.resolution.factor),
                    letterSpacing: Math.round(5 * appState.resolution.factor)
                }
            }
            case "midlow": return {
                ...ds,
                scaleParam: {
                    capWidth: 17,
                    capHeight: 17,
                    capBorderOffset: 2,
                    containerWidth: Math.round(230 * appState.resolution.factor),
                    containerHeight: 38,
                    trackHeight: 1,
                    tickHeight: 28,
                    tickLeft: 2
                },
                scaleParamDisplay: {
                    fontSize: Math.round(28 * appState.resolution.factor),
                    inputHeight: Math.round(30 * appState.resolution.factor),
                    unitLabelFontSize: Math.round(16 * appState.resolution.factor),
                    unitFontSize: Math.round(20 * appState.resolution.factor),
                    letterSpacing: Math.round(5 * appState.resolution.factor)
                }
            }
            case "low": return {
                ...ds,
                scaleParam: {
                    capWidth: 17,
                    capHeight: 17,
                    capBorderOffset: 2,
                    containerWidth: Math.round(230 * appState.resolution.factor),
                    containerHeight: 38,
                    trackHeight: 1,
                    tickHeight: 28,
                    tickLeft: 2
                },
                scaleParamDisplay: {
                    fontSize: Math.round(28 * appState.resolution.factor),
                    inputHeight: Math.round(30 * appState.resolution.factor),
                    unitLabelFontSize: Math.round(16 * appState.resolution.factor),
                    unitFontSize: Math.round(20 * appState.resolution.factor),
                    letterSpacing: Math.round(5 * appState.resolution.factor)
                }
            }
        }
    });

    // param 1
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getTrackValue: getTimeValue, getTrackCursor: getTimeCursor } =
        useTrackpadState(dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset, appState.timelineMaxValue);

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

    const scaleYRef = useRef<HTMLInputElement | null>(null);
    const scaleYTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleYCursor, setScaleYCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleYValue, getComplexTrackCursor: getScaleYCursor } =
        useComplexTrackpadState(
            dynamicSizes.scaleParam.capWidth - dynamicSizes.scaleParam.capBorderOffset,
            maxScale);

    const setActiveElementIfNull = useCallback(() => {
        if (carouselIndex < appState.carouselEntries.length && appState.activeElement == undefined) {
            const carouselEntry = appState.carouselEntries[carouselIndex];
            switch (carouselEntry.type) {
                case "svg": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "svg"
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
                case "img": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "img"
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
            }
        }
    }, [appState.activeElement, appState.carouselEntries, carouselIndex, dispatch]);

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

    const getCarouselEntryKey = useCallback(() => {
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

    useLayoutEffect(() => {
        (async () => {
            const activeKey = getCarouselEntryKey();
            const activeEquation = scale.math.get(activeKey);
            let scaleXInit = 1;
            let scaleYInit = 1;
            let timeInit = appState.timelineMaxValue
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
                    scaleXRef.current.value = activeMath.scale_x >= 1 ? activeMath.scale_x.toFixed(2) : activeMath.scale_x.toFixed(3);
                }
                else {
                    scaleXRef.current.value = '1.00'
                }
            }
            if (scaleYRef.current) {
                const activeMath = scale.math.get(activeKey);
                if (activeMath) {
                    scaleYRef.current.value = activeMath.scale_y >= 1 ? activeMath.scale_y.toFixed(2) : activeMath.scale_y.toFixed(3);
                }
                else {
                    scaleYRef.current.value = '1.00'
                }
            }
        })();
    }, [appState.timelineMaxValue, getCarouselEntryKey, getScaleXCursor, getScaleYCursor, getTimeCursor, scale.math]);

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        const activeKey = getCarouselEntryKey();
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
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, getCarouselEntryKey, imgElementsRef, scale.scale_id, svgElementsRef]);

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
                    <UnitDisplay carouselIndex={carouselIndex} onNewCarouselIndex={setCarouselIndex} />
                    {/* controls */}
                    {/* parameters */}
                    <div style={{ ...dynamicSizes.param }}>
                        <div style={{
                            border: '1px solid rgb(20, 20, 20)',
                            backgroundColor: "rgba(20, 20, 20, 0.25)",
                            borderRadius: 0,
                            padding: 0,
                            display: 'flex',
                        }}>
                            <div style={{
                                height: 'min-content',
                                display: 'flex',
                                borderRight: '1px solid rgb(20, 20, 20)',
                                ...dynamicSizes.paramFlex
                            }}>
                                <ParameterSliderY
                                    label={"speed"}
                                    hash={`${scale.scale_id}|p1`}
                                    size={dynamicSizes.paramSlider}
                                    trackRef={timeTrackRef}
                                    cursor={timeCursor}
                                    onNewCursor={(newCursor) => {
                                        setTimeCursor({ ...newCursor, x: 0 });

                                        if (!timeTrackRef.current) return;
                                        const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight);
                                        const activeKey = getCarouselEntryKey();
                                        if (activeKey) {
                                            const snapshot: LaurusScaleResult = { ...scale }
                                            const activeEquation = snapshot.math.get(activeKey);
                                            const newServerTime = newTime * 1000;
                                            const newEquation = activeEquation ?
                                                { ...activeEquation, time: newServerTime } :
                                                {
                                                    input_id: activeKey,
                                                    time: newServerTime,
                                                    scale_x: 1,
                                                    scale_y: 1,
                                                    loop: false,
                                                    solution: []
                                                };
                                            saveNewEquation(snapshot, newEquation);
                                        }
                                    }}
                                    disabled={scale.locked} />
                            </div>
                            <div
                                style={{
                                    padding: 0,
                                    display: 'grid',
                                    gap: 11,
                                    placeContent: 'center',
                                    width: '100%'
                                }}>
                                <div style={{ display: 'flex', marginLeft: 0 }}>
                                    <div style={{
                                        height: dynamicSizes.scaleParamDisplay.inputHeight,
                                        display: 'grid',
                                        alignContent: 'end',
                                        color: "rgba(255, 255, 255, 0.75)",
                                        fontSize: dynamicSizes.scaleParamDisplay.unitLabelFontSize
                                    }}>
                                        {'width'}
                                    </div>
                                    <input
                                        className={dellaRespira.className}
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
                                            width: '7ch',
                                            textShadow: '2px 2px 3px rgba(10,10,10,1)',
                                        }} />
                                    <div style={{
                                        height: dynamicSizes.scaleParamDisplay.inputHeight,
                                        display: 'grid',
                                        alignContent: 'end',
                                        color: "rgba(255, 255, 255, 0.5)",
                                        fontSize: dynamicSizes.scaleParamDisplay.unitFontSize
                                    }}>
                                        <i>{'x'}</i>
                                    </div>
                                </div>
                                <ParameterSliderX
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p2`}
                                    size={dynamicSizes.scaleParam}
                                    containerRef={scaleXTrackRef}
                                    cursor={scaleXCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleXTrackRef.current || !scaleXRef.current || !scaleYRef.current) return;
                                        const newScaleValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth);
                                        scaleXRef.current.value = newScaleValue >= 1 ?
                                            (newScaleValue).toFixed(2) :
                                            (newScaleValue).toFixed(3);

                                        if (!unlockAspectRatio) {
                                            scaleYRef.current.value = newScaleValue >= 1 ?
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
                                        const activeKey = getCarouselEntryKey();
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
                                                    input_id: activeKey,
                                                    time: appState.timelineMaxValue * 1000,
                                                    scale_x: newScaleXValue,
                                                    scale_y: newScaleYValue != undefined ? newScaleYValue : 1,
                                                    loop: false,
                                                    solution: []
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }
                                    }}
                                    disabled={scale.locked} />
                                <div style={{ display: 'flex', marginTop: 20 }}>
                                    <div style={{
                                        height: dynamicSizes.scaleParamDisplay.inputHeight,
                                        display: 'grid',
                                        alignContent: 'end',
                                        color: "rgba(255, 255, 255, 0.75)",
                                        fontSize: dynamicSizes.scaleParamDisplay.unitLabelFontSize
                                    }}>
                                        {'height'}
                                    </div>
                                    <input
                                        className={dellaRespira.className}
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
                                            width: '7ch',
                                            textShadow: '2px 2px 3px rgba(10,10,10,1)',
                                        }} />
                                    <div style={{
                                        height: dynamicSizes.scaleParamDisplay.inputHeight,
                                        display: 'grid',
                                        alignContent: 'end',
                                        color: "rgba(255, 255, 255, 0.5)",
                                        fontSize: dynamicSizes.scaleParamDisplay.unitFontSize
                                    }}>
                                        <i>{'x'}</i>
                                    </div>
                                </div>
                                <ParameterSliderX
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p2`}
                                    size={dynamicSizes.scaleParam}
                                    containerRef={scaleYTrackRef}
                                    cursor={scaleYCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleYTrackRef.current || !scaleYRef.current || !scaleXRef.current) return;
                                        const newScaleValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth);
                                        scaleYRef.current.value = newScaleValue >= 1 ?
                                            (newScaleValue).toFixed(2) :
                                            (newScaleValue).toFixed(3);

                                        if (!unlockAspectRatio) {
                                            scaleXRef.current.value = newScaleValue >= 1 ?
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
                                        const activeKey = getCarouselEntryKey();
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
                                                    input_id: activeKey,
                                                    time: appState.timelineMaxValue * 1000,
                                                    scale_x: newScaleXValue != undefined ? newScaleXValue : 1,
                                                    scale_y: newScaleYValue,
                                                    loop: false,
                                                    solution: []
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }
                                    }}
                                    disabled={scale.locked} />
                            </div>
                            {/* toolbar */}
                            <div style={{
                                marginLeft: 'auto',
                                background: 'linear-gradient(45deg, rgb(18, 18, 18), rgb(22, 22, 22))',
                                padding: 0,
                                display: 'grid',
                                alignContent: 'start',
                            }}>
                                <div
                                    onClick={() => {
                                        if (scale.locked) return;
                                        const activeKey = getCarouselEntryKey();
                                        if (activeKey) {
                                            const snapshot: LaurusScaleResult = { ...scale };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            const newEquation = activeEquation ?
                                                { ...activeEquation, loop: !activeEquation.loop } :
                                                {
                                                    input_id: activeKey,
                                                    time: appState.timelineMaxValue * 1000,
                                                    scale_x: 1,
                                                    scale_y: 1,
                                                    loop: true,
                                                    solution: []
                                                };
                                            saveNewEquation(snapshot, newEquation);
                                        }
                                    }}
                                    style={{
                                        cursor: scale.locked ? '' : scale.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        background: scale.math.get(getCarouselEntryKey())?.loop ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        svg={scale.math.has(getCarouselEntryKey()) ? autorenew() : autorenew("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={0.9} />
                                </div>
                                <div
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
                                        cursor: scale.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        svg={scale.math.has(getCarouselEntryKey()) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={0.9} />
                                </div>
                                <div
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
                                        cursor: scale.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        svg={scale.math.has(getCarouselEntryKey()) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                        containerSize={{ ...dynamicSizes.paramButton }}
                                        scale={1} />
                                </div>
                                <div
                                    onClick={() => {
                                        setUnlockAspectRatio(v => !v);
                                    }}
                                    style={{
                                        cursor: scale.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                        display: 'grid',
                                        placeContent: 'center',
                                        ...dynamicSizes.paramButtonContainer
                                    }}>
                                    <SvgRepo
                                        svg={scale.math.has(getCarouselEntryKey()) ? (unlockAspectRatio ? linkOff() : link()) : (unlockAspectRatio ? linkOff("rgb(62, 62, 62)") : link("rgb(62, 62, 62)"))}
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
