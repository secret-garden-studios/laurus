import { RefObject, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext, LaurusEffect, LaurusRotateResult, LaurusRotateEquation } from "./workspace.client";
import { dellaRespira } from "../fonts";
import { autorenew, playArrow, skipPrevious, menu, SvgRepo, fileCopy, contentPaste, toysFan } from "../svg-repo";
import { useTrackpadState } from "../hooks/useTrackpadState";
import Dial from "../components/dial";
import ParameterSlider from "../components/parameter-slider";
import { getParamTrackPadding, getParamCapSize, getParamTrackSize, getParamButtonSize, getParamGrooveWidth, getDisplaySize, getHeaderSize, getTopLevelPadding } from "./unit-resolution";
import UnitDisplay from "./unit-display";
import { deleteRotate, getRotate, updateRotate } from "./workspace.server";

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
}
export default function RotateUnit({ rotate, svgElementsRef, imgElementsRef }: RotateUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [displaySize] = useState(() => getDisplaySize(appState.resolution));
    const [carouselIndex, setCarouselIndex] = useState(() => {
        const index = appState.carouselEntries.findIndex(c => c.value.media_key == appState.activeElement?.value.value.media_key)
        if (index > -1) {
            return index;
        }
        else {
            return 0;
        }
    });
    const [headerSize] = useState(() => getHeaderSize(appState.resolution));
    const [topLevelPadding] = useState(() => getTopLevelPadding(appState.resolution));
    const [mainControls, setMainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<RotateUnitControls>({
        x: 0,
        y: 0,
        z: 0,
        time: 0,
        angle: 0,
    });
    const [paramTrackPadding] = useState(() => getParamTrackPadding(appState.resolution));
    const [paramCapSize] = useState(() => getParamCapSize(appState.resolution));
    const [paramTrackSize] = useState(() => getParamTrackSize(appState.resolution));
    const [paramButtonSize] = useState(() => getParamButtonSize(appState.resolution));
    const [paramGrooveWidth] = useState(() => getParamGrooveWidth(appState.resolution));
    const [paramTrackCapBorderAdj] = useState(2);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                paramFlex: { gap: 38 }
            }
            case "midhigh": return {
                paramFlex: { gap: 28 }
            }
            case "midlow":
            case "low": return {
                paramFlex: { gap: 30 }
            }
        }
    })

    // param 1
    const xTrackRef = useRef<HTMLDivElement | null>(null);
    const [xCursor, setXCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getXValue, getInverseTrackCursor: getXCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            1);

    // param 2
    const yTrackRef = useRef<HTMLDivElement | null>(null);
    const [yCursor, setYCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getYValue, getInverseTrackCursor: getYCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            1);

    // param 3
    const zTrackRef = useRef<HTMLDivElement | null>(null);
    const [zCursor, setZCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getZValue, getInverseTrackCursor: getZCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            1);

    // param 4
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            appState.timelineMaxValue);

    // main param
    const [angleTrackPadding] = useState(Math.round(15 * appState.resolution.factor));
    const [angle, setAngle] = useState(0);

    const saveNewEquation = useCallback(async (rollback: LaurusRotateResult, newEquation: LaurusRotateEquation) => {
        const newMath: Map<string, LaurusRotateEquation> = new Map(rollback.math);
        newMath.set(newEquation.input_id, newEquation);
        const newRotate: LaurusRotateResult = { ...rollback, math: newMath };
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
    }, [appState.accessToken, appState.apiOrigin, dispatch]);

    const updateTrackpads = useCallback((newControls: RotateUnitControls) => {
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
                initControls.time = 0;
                initControls.angle = 0;
            }
            updateTrackpads(initControls);
        })();
    }, [currentControls, getCarouselEntryKey, rotate.math, updateTrackpads]);

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        const activeKey = getCarouselEntryKey();
        if (!activeKey) return [];
        const newAnimations: Animation[] = [];
        const response: LaurusRotateResult | undefined =
            await getRotate(appState.apiOrigin, rotate.rotate_id, activeKey);
        if (response) {
            const activeMath = response.math
                .get(activeKey);
            if (!activeMath) return [];
            const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
                .map(s => { return { transform: `rotate3d(${s.x},${s.y},${s.z},${s.angle}deg)` } }) ?? [];
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
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, getCarouselEntryKey, imgElementsRef, rotate.rotate_id, svgElementsRef]);

    return (
        <div style={{
            gridTemplateRows: 'min-content auto',
            gridTemplateColumns: 'min-content auto',
            display: "grid",
            borderTop: '1px solid rgba(255,255,255,0.05)',
            alignItems: 'center',
        }}>
            {/* header */}
            <div
                className={dellaRespira.className}
                style={{
                    gridColumn: 'span 2',
                    display: 'flex',
                    height: '100%',
                    alignItems: 'center',
                    padding: headerSize.padding,
                }}>
                <div
                    style={{
                        fontSize: headerSize.font,
                        display: 'grid', placeContent: 'center', width: 'min-content', height: '100%'
                    }}>
                    {'Rotate'}
                </div>
                <SvgRepo
                    svg={toysFan()}
                    containerSize={{
                        width: headerSize.logo,
                        height: headerSize.logo
                    }}
                    scale={0.75} />
                <div
                    style={{ display: 'grid', placeContent: 'center', width: 'min-content', height: '100%', marginLeft: 'auto' }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
                    onClick={() => { setMainControls(v => !v); }}
                >
                    <SvgRepo
                        svg={menu()}
                        containerSize={{
                            width: headerSize.more,
                            height: headerSize.more
                        }}
                        scale={1} />
                </div>
            </div>
            {mainControls ?
                <>
                    <UnitDisplay carouselIndex={carouselIndex} onNewCarouselIndex={setCarouselIndex} />
                    {/* controls */}
                    <div style={{
                        display: 'grid',
                        gridTemplateRows: 'min-content auto',

                    }}>
                        {/* parameters */}
                        <div style={{ padding: topLevelPadding }}>
                            <div style={{
                                border: '1px solid rgba(10,10,10,1)',
                                display: 'grid',
                                gridTemplateColumns: 'auto min-content auto min-content',
                                gridTemplateRows: 'auto',
                            }}>
                                <div />
                                <div style={{
                                    height: 'min-content',
                                    display: 'flex',
                                    borderLeft: '1px solid rgb(10, 10, 10)',
                                    borderRight: '1px solid rgb(10, 10, 10)',
                                    padding: paramTrackPadding,
                                    ...dynamicSizes.paramFlex
                                }}>
                                    <ParameterSlider
                                        label={"x"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={xTrackRef}
                                        cursor={xCursor}
                                        onNewCursor={(newCursor) => {
                                            setXCursor({ ...newCursor, x: 0 });

                                            if (!xTrackRef.current) return;
                                            const newX = getXValue(newCursor.y, xTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, x: newX } });

                                            const activeKey = getCarouselEntryKey();
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, x: newX } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
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
                                        grooveWidth={paramGrooveWidth}
                                        disabled={rotate.locked} />
                                    <ParameterSlider
                                        label={"y"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={yTrackRef}
                                        cursor={yCursor}
                                        onNewCursor={(newCursor) => {
                                            setYCursor({ ...newCursor, x: 0 });

                                            if (!yTrackRef.current) return;
                                            const newY = getYValue(newCursor.y, yTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, y: newY } });

                                            const activeKey = getCarouselEntryKey();
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, y: newY } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
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
                                        grooveWidth={paramGrooveWidth}
                                        disabled={rotate.locked} />
                                    <ParameterSlider
                                        label={"z"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={zTrackRef}
                                        cursor={zCursor}
                                        onNewCursor={(newCursor) => {
                                            setZCursor({ ...newCursor, x: 0 });

                                            if (!zTrackRef.current) return;
                                            const newZ = getZValue(newCursor.y, zTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, z: newZ } });

                                            const activeKey = getCarouselEntryKey();
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusRotateEquation = activeEquation ?
                                                    { ...activeEquation, z: newZ } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
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
                                        grooveWidth={paramGrooveWidth}
                                        disabled={rotate.locked} />
                                    <ParameterSlider
                                        label={"time"}
                                        hash={`${rotate.rotate_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={timeTrackRef}
                                        cursor={timeCursor}
                                        onNewCursor={(newCursor) => {
                                            setTimeCursor({ ...newCursor, x: 0 });

                                            if (!timeTrackRef.current) return;
                                            const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, time: newTime } });

                                            const activeKey = getCarouselEntryKey();
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
                                        grooveWidth={paramGrooveWidth}
                                        disabled={rotate.locked} />
                                </div>
                                <div />
                                <div style={{
                                    borderLeft: '1px solid rgba(10,10,10,1)',
                                    background: 'linear-gradient(45deg, rgb(13, 13, 13), rgb(17, 17, 17))',
                                    padding: 0,
                                    display: 'grid',
                                    alignContent: 'start',
                                }}>
                                    <div
                                        onClick={() => {
                                            if (rotate.locked) return;
                                            const activeKey = getCarouselEntryKey();
                                            if (activeKey) {
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation = activeEquation ?
                                                    { ...activeEquation, loop: !activeEquation.loop } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
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
                                            cursor: rotate.locked ? '' : rotate.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                            background: rotate.math.get(getCarouselEntryKey())?.loop ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(getCarouselEntryKey()) ? autorenew() : autorenew("rgb(62, 62, 62)")}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
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
                                            cursor: rotate.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(getCarouselEntryKey()) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
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
                                            cursor: rotate.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(getCarouselEntryKey()) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
                                            scale={1} />
                                    </div>
                                    <div
                                        onClick={() => {
                                            if (!zTrackRef.current) return;
                                            let clipboardData: RotateUnitControls = { ...currentControls };
                                            const activeEquation = rotate.math.get(getCarouselEntryKey());
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
                                            cursor: rotate.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={rotate.math.has(getCarouselEntryKey()) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
                                            scale={0.8} />
                                    </div>
                                    <div
                                        onClick={() => {
                                            if (appState.effectClipboard && appState.effectClipboard.type == 'rotate') {
                                                const clipboardEquation = appState.effectClipboard.value.math.get("clipboard");
                                                if (!clipboardEquation) return;
                                                const snapshot: LaurusRotateResult = { ...rotate };
                                                const activeKey = getCarouselEntryKey();
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
                                            cursor: rotate.math.has(getCarouselEntryKey()) ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={appState.effectClipboard?.type == 'rotate' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
                                            scale={0.88} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* main control */}
                        <div style={{ padding: topLevelPadding }}>
                            <div style={{
                                width: '100%',
                                padding: angleTrackPadding,
                                border: 'solid rgba(10,10,10,1) 1px',
                                display: 'flex',
                                alignItems: 'start',
                                justifyContent: 'center',
                            }}>
                                <Dial
                                    ids={{
                                        contextId: `${rotate.rotate_id}|main|c1`,
                                        draggableId: `${rotate.rotate_id}|main|d1`
                                    }}
                                    value={angle}
                                    onNewValue={function (v: number): void {
                                        const newAngle: number = ((v) => { const x = (Math.round(v) % 360); return x < 0 ? x + 360 : x; })(v);
                                        setCurrentControls(v => { return { ...v, angle: newAngle } });
                                        const activeKey = getCarouselEntryKey();
                                        if (activeKey) {
                                            const snapshot: LaurusRotateResult = { ...rotate };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            const newEquation: LaurusRotateEquation = activeEquation ?
                                                { ...activeEquation, angle: newAngle } :
                                                {
                                                    input_id: activeKey,
                                                    time: 0,
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
                                    disabled={rotate.locked} />
                            </div>
                        </div>
                    </div>
                </> :
                <>
                    {/* deep controls */}
                    <div
                        style={{
                            gridColumn: 'span 2',
                            padding: topLevelPadding,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontSize: 16,
                        }}>
                        <div
                            style={{
                                display: 'grid',
                                height: `${displaySize.height}px`,
                                alignContent: 'center',
                                gap: 4,
                            }}>
                            <div>{'You are about to part ways with this effect forever...'}</div>
                            <div style={{ marginLeft: 'auto' }}>
                                {'Click'}
                                <span
                                    onClick={async () => {
                                        const snapshot: LaurusRotateResult = { ...rotate };
                                        const deleted = await deleteRotate(appState.apiOrigin, appState.accessToken, snapshot.rotate_id);
                                        if (deleted) {
                                            dispatch({
                                                type: WorkspaceActionType.SetEffects,
                                                value: appState.effects.filter(e => {
                                                    switch (e.type) {
                                                        case "scale": {
                                                            return true;
                                                        }
                                                        case "move": {
                                                            return true;
                                                        }
                                                        case "rotate": {
                                                            return e.value.rotate_id != snapshot.rotate_id;
                                                        }
                                                    }
                                                })
                                            });
                                        }
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                                    style={{ color: 'rgb(243, 115, 120)' }}>
                                    {' delete '}
                                </span>
                                {'to proceed.'}
                            </div>
                        </div>
                    </div>
                </>
            }
        </div >
    )
}
