import { RefObject, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { LaurusImgResult, LaurusSvgResult, LaurusMoveEquation, LaurusMoveResult, WorkspaceActionType, WorkspaceContext, LaurusEffect } from "./workspace.client";
import { dellaRespira } from "../fonts";
import { ReactImg } from "./media";
import { autorenew, playArrow, earthquake, skipPrevious, menu, SvgRepo, fileCopy, contentPaste } from "../svg-repo";
import styles from "../app.module.css";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { deleteMove, getMove, updateMove } from "./workspace.server";
import Dial from "../components/dial";
import ParameterSlider from "../components/parameter-slider";
import { getParamTrackPadding, getParamCapSize, getParamTrackSize, getParamButtonSize, getParamGrooveWidth, getDisplaySize, getHeaderSize, getTopLevelPadding } from "./unit-resolution";

interface MoveUnitControls {
    amplitude: number,
    frequency: number,
    wavelength: number,
    distance: number,
    time: number,
    angle: number,
}

interface MoveUnit {
    move: LaurusMoveResult
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}
export default function MoveUnit({ move, svgElementsRef, imgElementsRef }: MoveUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const placeholderElementRef = useRef<HTMLDivElement>(null);

    const [displaySize] = useState(() => getDisplaySize(appState.resolution));
    const [headerSize] = useState(() => getHeaderSize(appState.resolution));
    const [topLevelPadding] = useState(() => getTopLevelPadding(appState.resolution));
    const [mainControls, setMainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<MoveUnitControls>({
        amplitude: 0,
        frequency: 0,
        wavelength: 0,
        distance: 0,
        time: 0,
        angle: 0,
    });
    const [paramTrackPadding] = useState(() => getParamTrackPadding(appState.resolution));
    const [paramCapSize] = useState(() => getParamCapSize(appState.resolution));
    const [paramTrackSize] = useState(() => getParamTrackSize(appState.resolution));
    const [paramButtonSize] = useState(() => getParamButtonSize(appState.resolution));
    const [paramGrooveWidth] = useState(() => getParamGrooveWidth(appState.resolution));
    const [paramTrackCapBorderAdj] = useState(2);

    // param 1
    const amplitudeTrackRef = useRef<HTMLDivElement | null>(null);
    const [amplitudeCursor, setAmplitudeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getAmplitudeValue, getInverseTrackCursor: getAmplitudeCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            1000);

    // param 2
    const frequencyTrackRef = useRef<HTMLDivElement | null>(null);
    const [frequencyCursor, setFrequencyCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getFrequencyValue, getInverseTrackCursor: getFrequencyCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            100);

    // param 3
    const wavelengthTrackRef = useRef<HTMLDivElement | null>(null);
    const [wavelengthCursor, setWavelengthCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getWavelengthValue, getInverseTrackCursor: getWavelengthCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            1000);

    // param 4
    const distanceTrackRef = useRef<HTMLDivElement | null>(null);
    const [distanceCursor, setDistanceCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getDistanceValue, getInverseTrackCursor: getDistanceCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            5000);

    // param 5
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackCapBorderAdj,
            appState.timelineMaxValue);

    // main param
    const [angleTrackPadding] = useState(Math.round(15 * appState.resolution.factor));
    const [angle, setAngle] = useState(0);

    const saveNewEquation = useCallback(async (rollback: LaurusMoveResult, newEquation: LaurusMoveEquation) => {
        const newMath: Map<string, LaurusMoveEquation> = new Map(rollback.math);
        newMath.set(newEquation.input_id, newEquation);
        const newMove: LaurusMoveResult = { ...rollback, math: newMath };
        dispatch({
            type: WorkspaceActionType.SetEffect,
            value: { type: 'move', value: { ...newMove }, key: newMove.move_id, locked: newMove.locked },
        });
        const updated = await updateMove(appState.apiOrigin, appState.accessToken, rollback.move_id, { ...newMove });
        if (!updated) {
            dispatch({
                type: WorkspaceActionType.SetEffect,
                value: { type: 'move', value: { ...rollback }, key: rollback.move_id, locked: rollback.locked },
            });
        }
    }, [appState.accessToken, appState.apiOrigin, dispatch]);

    const updateTrackpads = useCallback((newControls: MoveUnitControls) => {
        setAngle(newControls.angle);

        if (amplitudeTrackRef.current) {
            const newCursor = getAmplitudeCursor(newControls.amplitude, (amplitudeTrackRef.current.clientHeight));
            setAmplitudeCursor({ y: newCursor, x: 0 });
        }
        if (frequencyTrackRef.current) {
            const newCursor = getFrequencyCursor(newControls.frequency, (frequencyTrackRef.current.clientHeight));
            setFrequencyCursor({ y: newCursor, x: 0 });
        }
        if (wavelengthTrackRef.current) {
            const newCursor = getWavelengthCursor(newControls.wavelength, (wavelengthTrackRef.current.clientHeight));
            setWavelengthCursor({ y: newCursor, x: 0 });
        }
        if (distanceTrackRef.current) {
            const newCursor = getDistanceCursor(newControls.distance, (distanceTrackRef.current.clientHeight));
            setDistanceCursor({ y: newCursor, x: 0 });
        }
        if (timeTrackRef.current) {
            const newCursor = getTimeCursor(newControls.time, (timeTrackRef.current.clientHeight));
            setTimeCursor({ y: newCursor, x: 0 });
        }
    }, [getAmplitudeCursor, getDistanceCursor, getFrequencyCursor, getTimeCursor, getWavelengthCursor]);

    useLayoutEffect(() => {
        (async () => {
            const activeEquation = move.math.get(appState.activeElement?.key ?? "");
            const initControls: MoveUnitControls = { ...currentControls }
            if (activeEquation) {
                initControls.amplitude = activeEquation.amplitude;
                initControls.frequency = activeEquation.frequency;
                initControls.wavelength = activeEquation.wavelength;
                initControls.distance = activeEquation.distance;
                initControls.time = activeEquation.time / 1000;
                initControls.angle = activeEquation.angle;
            }
            else if (appState.activeElement) {
                initControls.amplitude = 0;
                initControls.frequency = 0;
                initControls.wavelength = 0;
                initControls.distance = 0;
                initControls.time = 0;
                initControls.angle = 0;
            }
            updateTrackpads(initControls);
        })();
    }, [appState.activeElement, currentControls, move.math, updateTrackpads]);

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        if (!appState.activeElement) return [];
        const newAnimations: Animation[] = [];
        const response: LaurusMoveResult | undefined =
            await getMove(appState.apiOrigin, move.move_id, appState.activeElement.key);
        if (response) {
            const activeMath = response.math
                .get(appState.activeElement.key);
            if (!activeMath) return [];
            const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
                .map(s => { return { translate: `${s.x}px ${s.y}px 0px`, } }) ?? [];
            const options: KeyframeAnimationOptions = {
                duration: firstFrame ? 2 / response.fps : response.end * 1000,
            }
            const previewKey = appState.tool.type != 'viewport' ? `${appState.activeElement.key}|preview` : appState.activeElement.key;
            switch (appState.activeElement.value.type) {
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
    }, [appState.activeElement, appState.apiOrigin, appState.tool.type, imgElementsRef, move.move_id, svgElementsRef]);

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
                    {'Move'}
                </div>
                <SvgRepo
                    svg={earthquake()}
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
                    {/* display */}
                    <div style={{ padding: topLevelPadding }}>
                        <div
                            className={styles["large-tiled-background-squares"]}
                            style={{
                                padding: `${displaySize.padding}px`,
                                display: 'grid',
                                width: `${displaySize.width}px`, height: `${displaySize.height}px`,
                                borderRadius: 10,
                                border: '1px solid rgba(10,10,10,1)',
                                position: 'relative',
                            }}>
                            {/* active element */}
                            <div style={{ position: 'absolute', width: '100%', height: '100%', }}>
                                <div style={{
                                    position: 'relative',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '100%', height: '100%',
                                    overflow: 'hidden'
                                }}>
                                    <div
                                        ref={placeholderElementRef}
                                        style={{
                                            position: 'absolute',
                                        }}>
                                        {appState.activeElement ? (() => {
                                            switch (appState.activeElement.value.type) {
                                                case "svg": {
                                                    return (
                                                        <SvgRepo
                                                            svg={appState.activeElement.value.value as LaurusSvgResult}
                                                            containerSize={{
                                                                width: displaySize.activeSvgElementSize,
                                                                height: displaySize.activeSvgElementSize
                                                            }}
                                                            scale={1}
                                                        />
                                                    )
                                                }
                                                case "img": {
                                                    return (
                                                        <ReactImg
                                                            img={appState.activeElement.value.value as LaurusImgResult}
                                                            containerSize={{
                                                                width: displaySize.activeImgElementSize,
                                                                height: displaySize.activeImgElementSize
                                                            }}
                                                        />
                                                    )
                                                }
                                            }
                                        })() : (<></>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* controls */}
                    <div style={{
                        display: 'grid',
                        gridTemplateRows: 'min-content auto',
                    }}>
                        {/* parameters */}
                        <div style={{ padding: topLevelPadding }}>
                            <div style={{
                                border: '1px solid rgba(10,10,10,1)',
                                backgroundColor: "rgba(20, 20, 20, 0.2)",
                                borderRadius: 0,
                                padding: 0,
                                display: 'flex',
                            }}>
                                <div style={{
                                    height: 'min-content',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: paramTrackPadding,
                                    width: '100%'
                                }}>
                                    <ParameterSlider
                                        label={"amplitude"}
                                        hash={`${move.move_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={amplitudeTrackRef}
                                        cursor={amplitudeCursor}
                                        onNewCursor={(newCursor) => {
                                            setAmplitudeCursor({ ...newCursor, x: 0 });

                                            if (!amplitudeTrackRef.current) return;
                                            const newAmplitude = getAmplitudeValue(newCursor.y, amplitudeTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, amplitude: newAmplitude } });

                                            if (appState.activeElement) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(appState.activeElement.key);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, amplitude: newAmplitude } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: 0,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: newAmplitude,
                                                        frequency: 0,
                                                        wavelength: 0,
                                                        distance: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        grooveWidth={paramGrooveWidth}
                                        disabled={move.locked} />
                                    <ParameterSlider
                                        label={"frequency"}
                                        hash={`${move.move_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={frequencyTrackRef}
                                        cursor={frequencyCursor}
                                        onNewCursor={(newCursor) => {
                                            setFrequencyCursor({ ...newCursor, x: 0 });

                                            if (!frequencyTrackRef.current) return;
                                            const newFrequency = getFrequencyValue(newCursor.y, frequencyTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, frequency: newFrequency } });

                                            if (appState.activeElement) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(appState.activeElement.key);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, frequency: newFrequency } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: 0,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: 0,
                                                        frequency: newFrequency,
                                                        wavelength: 0,
                                                        distance: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        grooveWidth={paramGrooveWidth}
                                        disabled={move.locked} />
                                    <ParameterSlider
                                        label={"wavelength"}
                                        hash={`${move.move_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={wavelengthTrackRef}
                                        cursor={wavelengthCursor}
                                        onNewCursor={(newCursor) => {
                                            setWavelengthCursor({ ...newCursor, x: 0 });

                                            if (!wavelengthTrackRef.current) return;
                                            const newWavelength = getWavelengthValue(newCursor.y, wavelengthTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, wavelength: newWavelength } });

                                            if (appState.activeElement) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(appState.activeElement.key);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, wavelength: newWavelength } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: 0,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: 0,
                                                        frequency: 0,
                                                        wavelength: newWavelength,
                                                        distance: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        grooveWidth={paramGrooveWidth}
                                        disabled={move.locked} />
                                    <ParameterSlider
                                        label={"distance"}
                                        hash={`${move.move_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={distanceTrackRef}
                                        cursor={distanceCursor}
                                        onNewCursor={(newCursor) => {
                                            setDistanceCursor({ ...newCursor, x: 0 });

                                            if (!distanceTrackRef.current) return;
                                            const newDistance = getDistanceValue(newCursor.y, distanceTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, distance: newDistance } });

                                            if (appState.activeElement) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(appState.activeElement.key);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, distance: newDistance } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: 0,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: 0,
                                                        frequency: 0,
                                                        wavelength: 0,
                                                        distance: newDistance,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        grooveWidth={paramGrooveWidth}
                                        disabled={move.locked} />
                                    <ParameterSlider
                                        label={"time"}
                                        hash={`${move.move_id}|p1`}
                                        capSize={paramCapSize}
                                        trackSize={paramTrackSize}
                                        trackRef={timeTrackRef}
                                        cursor={timeCursor}
                                        onNewCursor={(newCursor) => {
                                            setTimeCursor({ ...newCursor, x: 0 });

                                            if (!timeTrackRef.current) return;
                                            const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, time: newTime } });

                                            if (appState.activeElement) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(appState.activeElement.key);
                                                const newServerTime = newTime * 1000;
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, time: newServerTime } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: newServerTime,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: 0,
                                                        frequency: 0,
                                                        wavelength: 0,
                                                        distance: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        grooveWidth={paramGrooveWidth}
                                        disabled={move.locked} />
                                </div>
                                <div style={{
                                    borderLeft: '1px solid rgba(10,10,10,1)',
                                    background: 'linear-gradient(45deg, rgb(13, 13, 13), rgb(17, 17, 17))',
                                    padding: 0,
                                    display: 'grid',
                                    alignContent: 'start',
                                }}>
                                    <div
                                        onClick={() => {
                                            if (appState.activeElement) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(appState.activeElement.key);
                                                const newEquation = activeEquation ?
                                                    { ...activeEquation, loop: !activeEquation.loop } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: 0,
                                                        loop: true,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: 0,
                                                        frequency: 0,
                                                        wavelength: 0,
                                                        distance: 0,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        style={{
                                            cursor: move.math.has(appState.activeElement?.key ?? "") ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                            background: move.math.get(appState.activeElement?.key ?? "")?.loop ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(appState.activeElement?.key ?? "") ? autorenew() : autorenew("rgb(62, 62, 62)")}
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
                                            cursor: move.math.has(appState.activeElement?.key ?? "") ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(appState.activeElement?.key ?? "") ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
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
                                            cursor: move.math.has(appState.activeElement?.key ?? "") ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(appState.activeElement?.key ?? "") ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
                                            scale={1} />
                                    </div>
                                    <div
                                        onClick={() => {
                                            if (!wavelengthTrackRef.current) return;
                                            let clipboardData: MoveUnitControls = { ...currentControls };
                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement.key);
                                                if (activeEquation) {
                                                    clipboardData = { ...activeEquation };
                                                }
                                            }
                                            const currentMoveEq: LaurusMoveEquation = {
                                                ...clipboardData,
                                                input_id: "clipboard",
                                                loop: false,
                                                solution: []
                                            }
                                            const newMath: Map<string, LaurusMoveEquation> = new Map();
                                            newMath.set("clipboard", currentMoveEq);
                                            const newClipboardEffect: LaurusEffect = {
                                                type: 'move',
                                                key: move.move_id,
                                                locked: move.locked,
                                                value: { ...move, math: newMath }
                                            };
                                            dispatch({ type: WorkspaceActionType.SetEffectClipboard, value: newClipboardEffect });
                                        }}
                                        style={{
                                            cursor: move.math.has(appState.activeElement?.key ?? "") ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(appState.activeElement?.key ?? "") ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                                            containerSize={{
                                                width: paramButtonSize.svg,
                                                height: paramButtonSize.svg
                                            }}
                                            scale={0.8} />
                                    </div>
                                    <div
                                        onClick={() => {
                                            if (appState.effectClipboard && appState.effectClipboard.type == 'move') {
                                                const clipboardEquation = appState.effectClipboard.value.math.get("clipboard");
                                                if (!clipboardEquation) return;
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeKey = appState.activeElement?.key ?? "";
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
                                            cursor: move.math.has(appState.activeElement?.key ?? "") ? 'pointer' : '',
                                            width: paramButtonSize.container,
                                            height: paramButtonSize.container,
                                            display: 'grid',
                                            placeContent: 'center',
                                            borderBottom: '1px solid rgba(10,10,10,1)',
                                        }}>
                                        <SvgRepo
                                            svg={appState.effectClipboard?.type == 'move' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
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
                                backgroundColor: "rgba(20, 20, 20, 0.2)",
                                borderRadius: 0,
                                display: 'flex',
                                alignItems: 'start',
                                justifyContent: 'center',
                            }}>
                                <Dial
                                    ids={{
                                        contextId: `${move.move_id}|main|c1`,
                                        draggableId: `${move.move_id}|main|d1`
                                    }}
                                    value={angle}
                                    onNewValue={function (v: number): void {
                                        const newAngle: number = ((v) => { const x = (Math.round(v) % 360); return x < 0 ? x + 360 : x; })(v);
                                        setCurrentControls(v => { return { ...v, angle: newAngle } });
                                        if (appState.activeElement) {
                                            const snapshot: LaurusMoveResult = { ...move };
                                            const activeEquation = snapshot.math.get(appState.activeElement.key);
                                            const newEquation: LaurusMoveEquation = activeEquation ?
                                                { ...activeEquation, angle: newAngle } :
                                                {
                                                    input_id: appState.activeElement.key,
                                                    time: 0,
                                                    loop: false,
                                                    solution: [],
                                                    angle: newAngle,
                                                    amplitude: 0,
                                                    frequency: 0,
                                                    wavelength: 0,
                                                    distance: 0,
                                                };
                                            saveNewEquation(snapshot, newEquation);
                                        }
                                    }}
                                    disabled={move.locked} />
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
                                        const snapshot: LaurusMoveResult = { ...move };
                                        const deleted = await deleteMove(appState.apiOrigin, appState.accessToken, snapshot.move_id);
                                        if (deleted) {
                                            dispatch({
                                                type: WorkspaceActionType.SetEffects,
                                                value: appState.effects.filter(e => {
                                                    switch (e.type) {
                                                        case "scale": {
                                                            return true;
                                                        }
                                                        case "move": {
                                                            return e.value.move_id != snapshot.move_id;
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
