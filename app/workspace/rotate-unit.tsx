import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext, LaurusEffect, LaurusRotateResult, LaurusRotateEquation, LaurusActiveElement, convertTime } from "./workspace.client";
import { autorenew, playArrow, skipPrevious, SvgRepo, fileCopy, contentPaste, updateCounterClockwise, refresh, LaurusClientSvg, add2, remove } from "../svg-repo";
import { useTrackpadState } from "../hooks/useTrackpadState";
import Dial from "../components/dial";
import { ParameterSliderY } from "../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getRotate, LaurusLoopType, updateRotate } from "./workspace.server";
import { getDynamicUnitSizes } from "./workspace-resolution";
import { useCarouselIndex } from "../hooks/useCarouselIndex";

interface RotateUnitControls {
    x: number,
    y: number,
    z: number,
    time: number,
    angle: number,
}

const defaultRotateEquation: LaurusRotateEquation = {
    input_id: "",
    time: 0.000001,
    loop: LaurusLoopType.none,
    solution: [],
    angle: 0,
    x: 0,
    y: 0,
    z: 0,
    limit_factor: 1.0
}

interface RotateUnit {
    rotate: LaurusRotateResult,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    carouselIndexInit: number,
}
export default function RotateUnit({ rotate, svgElementsRef, imgElementsRef, carouselIndexInit }: RotateUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const { carouselIndex, localIndex, setLocalIndex } =
        useCarouselIndex(appState.activeElement, appState.carouselEntries, carouselIndexInit, rotate.rotate_id);
    const [mainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<RotateUnitControls>({
        x: 0,
        y: 0,
        z: 0,
        time: 0.000001,
        angle: 0,
    });
    const [dynamicSizes] = useState(() => {
        return {
            ...getDynamicUnitSizes(appState.resolution),
            angleParam: { padding: Math.round(15 * appState.resolution.factor) }
        };
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
    const xTrackRef = useRef<HTMLDivElement | null>(null);
    const [xCursor, setXCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getXValue, getInverseTrackCursor: getXCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            1);

    // param 2
    const yTrackRef = useRef<HTMLDivElement | null>(null);
    const [yCursor, setYCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getYValue, getInverseTrackCursor: getYCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            1);

    // param 3
    const zTrackRef = useRef<HTMLDivElement | null>(null);
    const [zCursor, setZCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getZValue, getInverseTrackCursor: getZCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            1);

    // param 4
    const timeUpperLimit = useMemo(() => {
        return convertTime(appState.timelineMaxValue, appState.timelineUnit, 'sec')
    }, [appState.timelineMaxValue, appState.timelineUnit]);
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            timeUpperLimit * (rotate.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const timeTitle = useMemo(() => {
        return rotate.math.has(carouselEntryKey) ? ((rotate.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + 's') : undefined;
    }, [carouselEntryKey, rotate.math]);

    // main param
    const [angle, setAngle] = useState(0);

    const [counterClockwise, setCounterClockwise] = useState<boolean>(() => {
        return (rotate.math.get(carouselEntryKey)?.angle ?? 0) < 0 ? true : false
    });

    const setActiveElementIfNull = useCallback(() => {
        if (carouselIndex < appState.carouselEntries.length && appState.activeElement == undefined) {
            const carouselEntry = appState.carouselEntries[carouselIndex];
            switch (carouselEntry.type) {
                case "svg": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "svg",
                        locallyActivatedEffectKey: rotate.rotate_id
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
                case "img": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "img",
                        locallyActivatedEffectKey: rotate.rotate_id
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
            }
        }
    }, [appState.activeElement, appState.carouselEntries, carouselIndex, dispatch, rotate.rotate_id]);

    const saveNewEquation = useCallback(async (rollback: LaurusRotateResult, newEquation: LaurusRotateEquation) => {
        const newMath: Map<string, LaurusRotateEquation> = new Map(rollback.math);
        newMath.set(newEquation.input_id, newEquation);
        const newRotate: LaurusRotateResult = { ...rollback, math: newMath };
        setActiveElementIfNull();
        dispatch({
            type: WorkspaceActionType.SetEffect,
            value: { type: 'rotate', value: { ...newRotate }, key: newRotate.rotate_id, locked: newRotate.locked },
        });
        const updated = await updateRotate(appState.apiOrigin, appState.accessToken, rollback.rotate_id, { ...newRotate });
        if (!updated) {
            dispatch({
                type: WorkspaceActionType.SetEffect,
                value: { type: 'rotate', value: { ...rollback }, key: rollback.rotate_id, locked: rollback.locked },
            });
        }
    }, [appState.accessToken, appState.apiOrigin, dispatch, setActiveElementIfNull]);

    const updateTrackpads = useCallback((newControls: RotateUnitControls) => {
        if (newControls.angle < 0) {
            setCounterClockwise(true);
        } else {
            setCounterClockwise(false);
        }
        setAngle(newControls.angle);

        if (xTrackRef.current) {
            const newCursor = getXCursor(newControls.x, (xTrackRef.current.clientHeight));
            setXCursor({ y: newCursor, x: 0 });
        }
        if (yTrackRef.current) {
            const newCursor = getYCursor(newControls.y, (yTrackRef.current.clientHeight));
            setYCursor({ y: newCursor, x: 0 });
        }
        if (zTrackRef.current) {
            const newCursor = getZCursor(newControls.z, (zTrackRef.current.clientHeight));
            setZCursor({ y: newCursor, x: 0 });
        }
        if (timeTrackRef.current) {
            const newCursor = getTimeCursor(newControls.time, (timeTrackRef.current.clientHeight));
            setTimeCursor({ y: newCursor, x: 0 });
        }
    }, [getXCursor, getYCursor, getTimeCursor, getZCursor]);

    useLayoutEffect(() => {
        (async () => {
            const activeKey = carouselEntryKey;
            const activeEquation = rotate.math.get(activeKey);
            const initControls: RotateUnitControls = { ...currentControls }
            if (activeEquation) {
                initControls.x = activeEquation.x;
                initControls.y = activeEquation.y;
                initControls.z = activeEquation.z;
                initControls.time = activeEquation.time / 1000;
                initControls.angle = activeEquation.angle;
            }
            else if (activeKey) {
                initControls.x = 0;
                initControls.y = 0;
                initControls.z = 0;
                initControls.time = 0.000001;
                initControls.angle = 0;
            }
            updateTrackpads(initControls);
        })();
    }, [currentControls, carouselEntryKey, rotate.math, updateTrackpads, appState.timelineUnit]);

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        const activeKey = carouselEntryKey;
        if (!activeKey) return [];
        const newAnimations: Animation[] = [];
        const response: LaurusRotateResult | undefined =
            await getRotate(appState.apiOrigin, rotate.rotate_id, activeKey);
        if (response) {
            const activeMath = response.math
                .get(activeKey);
            if (!activeMath) return [];
            const framesToMap = firstFrame ? [activeMath.solution[0]] : activeMath.solution;
            const keyframes: Keyframe[] = framesToMap
                .map((f, i) => {
                    return i < activeMath.solution.length - 1 ? {
                        rotate: `${f.x} ${f.y} ${f.z} ${f.angle}deg`,
                        easing: 'step-end'
                    } : {
                        rotate: `${f.x} ${f.y} ${f.z} ${f.angle}deg`
                    }
                }) ?? [];
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
    }, [carouselEntryKey, appState.apiOrigin, appState.tool.type, appState.carouselEntries, rotate.rotate_id, carouselIndex, svgElementsRef, imgElementsRef]);

    const loopSvg = useMemo((): [boolean, LaurusClientSvg] => {
        const loopType = rotate.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        const enabled = rotate.math.has(carouselEntryKey) ? true : false;
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
    }, [carouselEntryKey, rotate.math]);

    const getNextLoopType = useCallback((): LaurusLoopType => {
        const currentLoop = rotate.math.get(carouselEntryKey)?.loop;
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
    }, [carouselEntryKey, rotate.math]);

    const decrementLimitFactor = useCallback((): number => {
        const currentFactor = rotate.math.get(carouselEntryKey)?.limit_factor;
        if (!currentFactor) return 1;
        return Math.max(0.1, Math.round((currentFactor - 0.1) * 100) / 100);
    }, [carouselEntryKey, rotate.math]);

    const incrementLimitFactor = useCallback((): number => {
        const currentFactor = rotate.math.get(carouselEntryKey)?.limit_factor;
        if (!currentFactor) return 1;
        return Math.min(1, Math.round((currentFactor + 0.1) * 100) / 100);
    }, [carouselEntryKey, rotate.math]);

    return (
        <div style={{
            gridTemplateRows: 'auto',
            gridTemplateColumns: 'min-content auto',
            display: "grid",
            alignItems: 'center',
        }}>
            {mainControls ?
                <>
                    <UnitDisplay
                        carouselIndex={carouselIndex}
                        effectKey={rotate.rotate_id}
                        localIndex={localIndex}
                        onNewLocalIndex={setLocalIndex} />
                    {/* controls */}
                    <div style={{ display: 'grid' }}>
                        {/* parameters */}
                        <div style={{ ...dynamicSizes.param }}>
                            <div style={{
                                border: '1px solid rgba(255, 255, 255, 0.025)',
                                backgroundColor: "rgba(20, 20, 20, 0.25)",
                                boxShadow: '4px 4px 12px rgba(11, 11, 11, 0.5)',
                                borderRadius: 6,
                                display: 'grid',
                                gridTemplateColumns: 'auto min-content auto min-content',
                                gridTemplateRows: 'auto',
                                height: dynamicSizes.paramButtonContainer.height * 7
                            }}>
                                <div />
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    ...dynamicSizes.paramFlex
                                }}>
                                    <ParameterSliderY
                                        label={"x"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={xTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
                                        cursor={xCursor}
                                        onNewCursor={(newCursor) => {
                                            setXCursor({ ...newCursor, x: 0 });
                                            if (!xTrackRef.current) return;
                                            const newX = getXValue(newCursor.y, xTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, x: newX } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, x: newX } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                        x: newX,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked}
                                        title={(rotate.math.get(carouselEntryKey)?.x.toFixed(2))} />
                                    <ParameterSliderY
                                        label={"y"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={yTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
                                        cursor={yCursor}
                                        onNewCursor={(newCursor) => {
                                            setYCursor({ ...newCursor, x: 0 });
                                            if (!yTrackRef.current) return;
                                            const newY = getYValue(newCursor.y, yTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, y: newY } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, y: newY } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                        y: newY,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked}
                                        title={(rotate.math.get(carouselEntryKey)?.y.toFixed(2))} />
                                    <ParameterSliderY
                                        label={"z"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={zTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
                                        cursor={zCursor}
                                        onNewCursor={(newCursor) => {
                                            setZCursor({ ...newCursor, x: 0 });
                                            if (!zTrackRef.current) return;
                                            const newZ = getZValue(newCursor.y, zTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, z: newZ } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, z: newZ } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                        z: newZ,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked}
                                        title={(rotate.math.get(carouselEntryKey)?.z.toFixed(2))} />
                                    <ParameterSliderY
                                        label={"time"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={timeTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
                                        cursor={timeCursor}
                                        onNewCursor={(newCursor) => {
                                            setTimeCursor({ ...newCursor, x: 0 });
                                            if (!timeTrackRef.current) return;
                                            const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, time: newTime } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newServerTime = newTime * 1000;
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, time: newServerTime } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                        time: newServerTime,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked}
                                        title={timeTitle} />
                                </div>
                                <div />
                                {/* toolbar */}
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
                                    <div title="loop"
                                        onClick={() => {
                                            if (rotate.locked) return;
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation = activeEquation ?
                                                    {
                                                        ...activeEquation,
                                                        loop: getNextLoopType(),
                                                    } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                        loop: getNextLoopType(),
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        style={{
                                            cursor: rotate.locked ? '' : rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            background: loopSvg[0] ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                            borderTopRightRadius: 6,
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="loop"
                                            svg={loopSvg[1]}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.9} />
                                    </div>
                                    <div title="rotate counter-clockwise"
                                        onClick={() => {
                                            const newCounterClockwise: boolean = !counterClockwise;
                                            const activeKey = carouselEntryKey;
                                            if (!activeKey) return;
                                            const snapshot: LaurusRotateResult = { ...rotate };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            if (activeEquation) {
                                                const newAngle: number = ((currentAngle) => {
                                                    const x = Math.abs(currentAngle);
                                                    return newCounterClockwise ? x * -1 : x;
                                                })(activeEquation.angle);
                                                const newEquation: LaurusRotateEquation = { ...activeEquation, angle: newAngle }
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                            else {
                                                const newEquation: LaurusRotateEquation = {
                                                    ...defaultRotateEquation,
                                                    input_id: activeKey,
                                                };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                            setCounterClockwise(newCounterClockwise);
                                        }}
                                        style={{
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            background: counterClockwise ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="rotate counter-clockwise"
                                            svg={rotate.math.has(carouselEntryKey) ? updateCounterClockwise() : updateCounterClockwise("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.9} />
                                    </div>
                                    <div title="rewind"
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
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="rewind"
                                            svg={rotate.math.has(carouselEntryKey) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.9} />
                                    </div>
                                    <div title="play"
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
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="play"
                                            svg={rotate.math.has(carouselEntryKey) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={1} />
                                    </div>
                                    <div title="increase limits"
                                        onClick={() => {
                                            if (rotate.locked || (rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor == 1)) return;
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation = activeEquation ?
                                                    {
                                                        ...activeEquation,
                                                        limit_factor: incrementLimitFactor(),
                                                    } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        style={{
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="increase limits"
                                            svg={rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor != 1 ? add2() : add2("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.88} />
                                    </div>
                                    <div title="decrease limits"
                                        onClick={() => {
                                            if (rotate.locked || (rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor == 0.1)) return;
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation = activeEquation ?
                                                    {
                                                        ...activeEquation,
                                                        limit_factor: decrementLimitFactor(),
                                                    } :
                                                    {
                                                        ...defaultRotateEquation,
                                                        input_id: activeKey,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        style={{
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="decrease limits"
                                            svg={rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor != 0.1 ? remove() : remove("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.88} />
                                    </div>
                                    <div title="copy"
                                        onClick={() => {
                                            if (!zTrackRef.current) return;
                                            let clipboardData: RotateUnitControls = { ...currentControls };
                                            const activeEquation = rotate.math.get(carouselEntryKey);
                                            if (activeEquation) {
                                                clipboardData = { ...activeEquation };
                                            }
                                            const currentEq: LaurusRotateEquation = {
                                                ...clipboardData,
                                                input_id: "clipboard",
                                                loop: defaultRotateEquation.loop,
                                                solution: defaultRotateEquation.solution,
                                                limit_factor: defaultRotateEquation.limit_factor
                                            }
                                            const newMath: Map<string, LaurusRotateEquation> = new Map();
                                            newMath.set("clipboard", currentEq);
                                            const newClipboardEffect: LaurusEffect = {
                                                type: 'rotate',
                                                key: rotate.rotate_id,
                                                locked: rotate.locked,
                                                value: { ...rotate, math: newMath }
                                            };
                                            dispatch({ type: WorkspaceActionType.SetEffectClipboard, value: newClipboardEffect });
                                        }}
                                        style={{
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="copy"
                                            svg={rotate.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.8} />
                                    </div>
                                    <div title="paste"
                                        onClick={() => {
                                            if (appState.effectClipboard && appState.effectClipboard.type == 'rotate') {
                                                const clipboardEquation = appState.effectClipboard.value.math.get("clipboard");
                                                if (!clipboardEquation) return;
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeKey = carouselEntryKey;
                                                const newEquation: LaurusRotateEquation = { ...clipboardEquation };
                                                const newControls: RotateUnitControls = { ...newEquation };
                                                setCurrentControls(newControls);
                                                updateTrackpads(newControls);
                                                if (activeKey) {
                                                    const newMath: LaurusRotateEquation = {
                                                        ...newEquation,
                                                        input_id: activeKey
                                                    }
                                                    saveNewEquation(snapshot, newMath);
                                                }
                                            }
                                        }}
                                        style={{
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            title="paste"
                                            svg={appState.effectClipboard?.type == 'rotate' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.88} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* main control */}
                        <div style={{ ...dynamicSizes.param }}>
                            <div style={{
                                width: '100%',
                                border: '1px solid rgba(255, 255, 255, 0.025)',
                                backgroundColor: "rgba(20, 20, 20, 0.25)",
                                boxShadow: '4px 4px 12px rgba(11, 11, 11, 0.5)',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'start',
                                justifyContent: 'center',
                                ...dynamicSizes.angleParam
                            }}>
                                <Dial
                                    ids={{
                                        contextId: `${rotate.rotate_id}|main|c1`,
                                        draggableId: `${rotate.rotate_id}|main|d1`
                                    }}
                                    value={Math.abs(angle)}
                                    onNewValue={function (v: number): void {
                                        const newAngle: number = ((v) => {
                                            const x = (Math.round(v) % 360);
                                            const x2 = x < 0 ? x + 360 : x;
                                            return counterClockwise ? x2 * -1 : x2;
                                        })(v);
                                        setCurrentControls(v => { return { ...v, angle: newAngle }; });
                                        const activeKey = carouselEntryKey;
                                        if (activeKey) {
                                            const snapshot: LaurusRotateResult = { ...rotate };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            const newEquation: LaurusRotateEquation = activeEquation ?
                                                { ...activeEquation, angle: newAngle } :
                                                {
                                                    ...defaultRotateEquation,
                                                    input_id: activeKey,
                                                    angle: newAngle,
                                                };
                                            saveNewEquation(snapshot, newEquation);
                                        }
                                    }}
                                    disabled={rotate.locked}
                                    size={{
                                        container: 90,
                                        gauge: 90,
                                        gaugeTick: 7,
                                        dial: 80,
                                        dialTick: 11
                                    }}
                                    title={rotate.math.get(carouselEntryKey)?.angle.toFixed(0) + '°'} />
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
