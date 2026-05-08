import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext, LaurusEffect, LaurusRotateResult, LaurusRotateEquation, LaurusActiveElement } from "./workspace.client";
import { autorenew, playArrow, skipPrevious, SvgRepo, fileCopy, contentPaste, rotateLeft } from "../svg-repo";
import { useTrackpadState } from "../hooks/useTrackpadState";
import Dial from "../components/dial";
import ParameterSliderY from "../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getRotate, updateRotate } from "./workspace.server";
import { getDynamicUnitSizes } from "./workspace-resolution";

interface RotateUnitControls {
    x: number,
    y: number,
    z: number,
    time: number,
    angle: number,
}

interface RotateUnit {
    rotate: LaurusRotateResult,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    carouselIndexInit: number,
}
export default function RotateUnit({ rotate, svgElementsRef, imgElementsRef, carouselIndexInit }: RotateUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [mainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<RotateUnitControls>({
        x: 0,
        y: 0,
        z: 0,
        time: 0.000001,
        angle: 0,
    });
    const carouselIndex = useMemo(() => {
        const index = appState.carouselEntries.findIndex(c => c.key == appState.activeElement?.key);
        return index > -1 ? index : carouselIndexInit
    }, [appState.activeElement?.key, appState.carouselEntries, carouselIndexInit]);

    const [dynamicSizes] = useState(() => {
        return {
            ...getDynamicUnitSizes(appState.resolution),
            angleParam: { padding: Math.round(15 * appState.resolution.factor) }
        };
    });

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
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            appState.timelineMaxValue);

    // main param
    const [angle, setAngle] = useState(0);

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
    }, [currentControls, carouselEntryKey, rotate.math, updateTrackpads]);

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
            const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
                .map(s => { return { rotate: `${s.x} ${s.y} ${s.z} ${s.angle}deg` } }) ?? [];
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
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, carouselEntryKey, imgElementsRef, rotate.rotate_id, svgElementsRef]);

    return (
        <div style={{
            gridTemplateRows: 'auto',
            gridTemplateColumns: 'min-content auto',
            display: "grid",
            alignItems: 'center',
        }}>
            {mainControls ?
                <>
                    <UnitDisplay carouselIndex={carouselIndex} />
                    {/* controls */}
                    <div style={{ display: 'grid' }}>
                        {/* parameters */}
                        <div style={{ ...dynamicSizes.param }}>
                            <div style={{
                                border: '1px solid rgb(20, 20, 20)',
                                backgroundColor: "rgba(20, 20, 20, 0.25)",
                                display: 'grid',
                                gridTemplateColumns: 'auto min-content auto min-content',
                                gridTemplateRows: 'auto',
                            }}>
                                <div />
                                <div style={{
                                    height: 'min-content',
                                    display: 'flex',
                                    borderLeft: '1px solid rgb(20, 20, 20)',
                                    borderRight: '1px solid rgb(20, 20, 20)',
                                    ...dynamicSizes.paramFlex
                                }}>
                                    <ParameterSliderY
                                        label={"x"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={xTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
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
                                                        input_id: activeKey,
                                                        time: 0.000001,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        x: newX,
                                                        y: 0,
                                                        z: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked} />
                                    <ParameterSliderY
                                        label={"y"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={yTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
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
                                                        input_id: activeKey,
                                                        time: 0.000001,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        x: 0,
                                                        y: newY,
                                                        z: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked} />
                                    <ParameterSliderY
                                        label={"z"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={zTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
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
                                                        input_id: activeKey,
                                                        time: 0.000001,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        x: 0,
                                                        y: 0,
                                                        z: newZ,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked} />
                                    <ParameterSliderY
                                        label={"time"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={timeTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
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
                                                        input_id: activeKey,
                                                        time: newServerTime,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        x: 0,
                                                        y: 0,
                                                        z: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        disabled={rotate.locked} />
                                </div>
                                <div />
                                {/* toolbar */}
                                <div style={{
                                    background: 'linear-gradient(45deg, rgb(18, 18, 18), rgb(22, 22, 22))',
                                    padding: 0,
                                    display: 'grid',
                                    alignContent: 'start',
                                }}>
                                    <div
                                        onClick={() => {
                                            if (rotate.locked) return;
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation = activeEquation ?
                                                    { ...activeEquation, loop: !activeEquation.loop } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0.000001,
                                                        loop: true,
                                                        solution: [],
                                                        angle: 0,
                                                        x: 0,
                                                        y: 0,
                                                        z: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        style={{
                                            cursor: rotate.locked ? '' : rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            background: rotate.math.get(carouselEntryKey)?.loop ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(carouselEntryKey) ? autorenew() : autorenew("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.9} />
                                    </div>
                                    <div
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
                                                    input_id: activeKey,
                                                    time: 0.000001,
                                                    loop: false,
                                                    solution: [],
                                                    angle: 0,
                                                    x: 0,
                                                    y: 0,
                                                    z: 0,
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
                                            svg={rotate.math.has(carouselEntryKey) ? rotateLeft() : rotateLeft("rgb(62, 62, 62)")}
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
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(carouselEntryKey) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
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
                                            cursor: rotate.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer,
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(carouselEntryKey) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={1} />
                                    </div>
                                    <div
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
                                                loop: false,
                                                solution: []
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
                                            svg={rotate.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.8} />
                                    </div>
                                    <div
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
                                border: '1px solid rgb(20, 20, 20)',
                                backgroundColor: "rgba(20, 20, 20, 0.25)",
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
                                                    input_id: activeKey,
                                                    time: 0.000001,
                                                    loop: false,
                                                    solution: [],
                                                    angle: newAngle,
                                                    x: 0,
                                                    y: 0,
                                                    z: 0,
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
                                    }} />
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
