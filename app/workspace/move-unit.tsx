import { RefObject, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { EncodedImg, EncodedSvg, LaurusMoveEquation, LaurusMoveResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { dellaRespira, dmSans } from "../fonts";
import { ReactImg, ReactSvg } from "./media";
import { autorenew, playArrow, moreVert, earthquake, skipPrevious } from "../svg-repo";
import styles from "../app.module.css";
import { PointerStyle, Trackpad } from "../components/trackpad";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { deleteMove, getMove, updateMove } from "./workspace.server";
import Dial from "../components/dial";

interface MoveUnitProps {
    move: LaurusMoveResult
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}

export default function MoveUnit({ move, svgElementsRef, imgElementsRef }: MoveUnitProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const placeholderElementRef = useRef<HTMLDivElement>(null);

    const [displaySize] = useState({ 'width': 400, 'height': 450, 'padding': 0 });
    const [mainControls, setMainControls] = useState(true);

    const [mathLimits] = useState({
        amplitude: 1000,
        frequency: 100,
        wavelength: 1000,
        distance: 5000,
    })
    const [paramCapSize] = useState({ width: 45, height: 21 });
    const [paramTrackSize] = useState({ width: 45, height: 200 });
    const [paramTrackOffsets] = useState({ padding: 15, border: 2 });

    // param 1
    const amplitudeTrackRef = useRef<HTMLDivElement | null>(null);
    const [amplitudeCursor, setAmplitudeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getAmplitudeValue, getInverseTrackCursor: getAmplitudeCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackOffsets.border,
            mathLimits.amplitude);


    // param 2
    const frequencyTrackRef = useRef<HTMLDivElement | null>(null);
    const [frequencyCursor, setFrequencyCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getFrequencyValue, getInverseTrackCursor: getFrequencyCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackOffsets.border,
            mathLimits.frequency);

    // param 3
    const wavelengthTrackRef = useRef<HTMLDivElement | null>(null);
    const [wavelengthCursor, setWavelengthCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getWavelengthValue, getInverseTrackCursor: getWavelengthCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackOffsets.border,
            mathLimits.wavelength);

    // param 4
    const distanceTrackRef = useRef<HTMLDivElement | null>(null);
    const [distanceCursor, setDistanceCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getDistanceValue, getInverseTrackCursor: getDistanceCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackOffsets.border,
            mathLimits.distance);

    // param 5
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            paramCapSize.height - paramTrackOffsets.border,
            appState.timelineMaxValue);

    // main param
    const [angleTrackOffsets] = useState({ padding: 15, border: 2 });
    const [angle, setAngle] = useState(0);

    const saveNewEquation = useCallback((newEquation: LaurusMoveEquation) => {
        const newMath: Map<string, LaurusMoveEquation> = new Map(move.math);
        newMath.set(newEquation.input_id, newEquation);

        const newMove: LaurusMoveResult = { ...move, math: newMath };
        dispatch({
            type: WorkspaceActionType.SetEffect,
            value: { type: 'move', value: { ...newMove }, key: newMove.move_id },
        });
        updateMove(appState.apiOrigin, move.move_id, { ...newMove });
    }, [appState.apiOrigin, dispatch, move]);

    useLayoutEffect(() => {
        /*  reads the current track widths and updates sliders 
            using initial values from a parent component */

        (async () => {
            const activeEquation = move.math.get(appState.activeElement?.key ?? "");
            let angleInit = 0;
            let amplitudeInit = 0
            let frequencyInit = 0
            let wavelengthInit = 0
            let distanceInit = 0
            let timeInit = 0
            if (activeEquation) {
                amplitudeInit = activeEquation.amplitude;
                frequencyInit = activeEquation.frequency;
                wavelengthInit = activeEquation.wavelength;
                distanceInit = activeEquation.distance;
                timeInit = activeEquation.time / 1000;
                angleInit = activeEquation.angle;
            }

            setAngle(angleInit);

            if (amplitudeTrackRef.current) {
                const newCursor = getAmplitudeCursor(amplitudeInit, (amplitudeTrackRef.current.clientHeight));
                setAmplitudeCursor({ y: newCursor, x: 0 });
            }
            if (frequencyTrackRef.current) {
                const newCursor = getFrequencyCursor(frequencyInit, (frequencyTrackRef.current.clientHeight));
                setFrequencyCursor({ y: newCursor, x: 0 });
            }
            if (wavelengthTrackRef.current) {
                const newCursor = getWavelengthCursor(wavelengthInit, (wavelengthTrackRef.current.clientHeight));
                setWavelengthCursor({ y: newCursor, x: 0 });
            }
            if (distanceTrackRef.current) {
                const newCursor = getDistanceCursor(distanceInit, (distanceTrackRef.current.clientHeight));
                setDistanceCursor({ y: newCursor, x: 0 });
            }
            if (timeTrackRef.current) {
                const newCursor = getTimeCursor(timeInit, (timeTrackRef.current.clientHeight));
                setTimeCursor({ y: newCursor, x: 0 });
            }
        })();
    }, [appState.activeElement?.key, appState.timelineMaxValue, getAmplitudeCursor, getDistanceCursor, getFrequencyCursor, getTimeCursor, getWavelengthCursor, move.math]);

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
                duration: firstFrame ? 2 / response.fps : response.duration * 1000,
            }
            const previewKey = appState.tool.type == 'drop' ? `${appState.activeElement.key}|preview` : appState.activeElement.key;
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
            {/* row 1 */}
            <div
                className={dellaRespira.className}
                style={{
                    gridColumn: 'span 2',
                    display: 'flex',
                    height: '100%',
                    alignItems: 'center',
                    padding: 10,
                }}>
                <div
                    style={{
                        fontSize: 32,
                        display: 'grid', placeContent: 'center', width: 'min-content', height: '100%'
                    }}>
                    {'Move'}
                </div>
                <ReactSvg
                    svg={earthquake()}
                    containerSize={{
                        width: 40,
                        height: 40
                    }}
                    scale={0.75} />
                <div
                    style={{ display: 'grid', placeContent: 'center', width: 'min-content', height: '100%', marginLeft: 'auto' }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
                    onClick={() => { setMainControls(v => !v); }}
                >
                    <ReactSvg
                        svg={moreVert()}
                        containerSize={{
                            width: 24,
                            height: 24
                        }}
                        scale={1} />
                </div>
            </div>

            {mainControls ?
                <>
                    {/* display */}
                    <div style={{ padding: '0 20px 20px 20px' }}>
                        <div
                            className={styles["large-tiled-background-squares"]}
                            style={{
                                padding: `${displaySize.padding}px`,
                                display: 'grid',
                                width: `${displaySize.width}px`, height: `${displaySize.height}px`,
                                borderRadius: 10,
                                border: '1px solid black',
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
                                        className={dmSans.className}
                                        ref={placeholderElementRef}
                                        style={{
                                            position: 'absolute',
                                            fontSize: 14,
                                            color: 'rgb(246, 246, 246)',
                                        }}>
                                        {appState.activeElement ? (() => {
                                            switch (appState.activeElement.value.type) {
                                                case "svg": {
                                                    return (
                                                        <ReactSvg
                                                            svg={appState.activeElement.value.value as EncodedSvg}
                                                            containerSize={{ width: 200, height: 200 }}
                                                            scale={1}
                                                        />
                                                    )
                                                }
                                                case "img": {
                                                    return (
                                                        <ReactImg
                                                            img={appState.activeElement.value.value as EncodedImg}
                                                            containerSize={{ width: 200, height: 200 }}
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
                        justifySelf: 'start',
                        display: 'grid',
                        gridTemplateRows: 'min-content auto',
                    }}>
                        <div style={{ padding: '0 20px 20px 20px' }}>
                            <div style={{
                                border: '1px solid black',
                                backgroundColor: "rgba(20, 20, 20, 0.2)",
                                borderRadius: 0,
                                padding: 0,
                                display: 'grid',
                                gridTemplateColumns: 'auto  min-content',
                            }}>
                                <div style={{
                                    height: 'min-content',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: `${paramTrackOffsets.padding}px 15px`,
                                    gap: 20,
                                }}>
                                    <VerticalSlider
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

                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, amplitude: newAmplitude } :
                                                    {
                                                        input_id: appState.activeElement.key,
                                                        time: appState.timelineMaxValue * 1000,
                                                        loop: false,
                                                        solution: [],
                                                        angle: 0,
                                                        amplitude: newAmplitude,
                                                        frequency: 0,
                                                        wavelength: 0,
                                                        distance: 0,
                                                    };
                                                saveNewEquation(newEquation);
                                            }
                                        }} />
                                    <VerticalSlider
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

                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
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
                                                saveNewEquation(newEquation);
                                            }
                                        }} />
                                    <VerticalSlider
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

                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
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
                                                saveNewEquation(newEquation);
                                            }
                                        }} />
                                    <VerticalSlider
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

                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
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
                                                saveNewEquation(newEquation);
                                            }
                                        }} />
                                    <VerticalSlider
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

                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
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
                                                saveNewEquation(newEquation);
                                            }
                                        }} />
                                </div>
                                <div style={{
                                    borderLeft: '2px solid black',
                                    background: 'linear-gradient(45deg, rgb(13, 13, 13), rgb(17, 17, 17))',
                                    padding: 0,
                                    display: 'grid', alignContent: 'start',
                                }}>
                                    <div
                                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
                                        onClick={() => {
                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
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
                                                saveNewEquation(newEquation);
                                            }
                                        }}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            display: 'grid', placeContent: 'center',
                                            border: '1px solid rgb(0, 0, 0)',
                                            background: move.math.get(appState.activeElement?.key ?? "")?.loop ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                        }}>
                                        <ReactSvg
                                            svg={autorenew()}
                                            containerSize={{
                                                width: 20,
                                                height: 20
                                            }}
                                            scale={0.9} />
                                    </div>
                                    <div
                                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
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
                                            width: 36,
                                            height: 36,
                                            display: 'grid', placeContent: 'center',
                                            border: '1px solid rgb(0, 0, 0)',
                                        }}>
                                        <ReactSvg
                                            svg={skipPrevious()}
                                            containerSize={{
                                                width: 20,
                                                height: 20
                                            }}
                                            scale={0.9} />
                                    </div>
                                    <div
                                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
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
                                            width: 36,
                                            height: 36,
                                            display: 'grid', placeContent: 'center',
                                            border: '1px solid rgb(0, 0, 0)',
                                        }}>
                                        <ReactSvg
                                            svg={playArrow()}
                                            containerSize={{
                                                width: 20,
                                                height: 20
                                            }}
                                            scale={1} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: `0 20px 20px 20px` }}>
                            <div style={{
                                width: 'min-content',
                                padding: `15px ${angleTrackOffsets.padding}px`,
                                border: 'solid rgba(0, 0, 0, 1) 1px',
                                backgroundColor: "rgba(20, 20, 20, 0.2)",
                                borderRadius: 0,
                            }}>
                                <div style={{
                                    width: 430,
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
                                            if (appState.activeElement) {
                                                const activeEquation = move.math.get(appState.activeElement!.key);
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
                                                saveNewEquation(newEquation);
                                            }
                                        }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </> :
                <>
                    {/* deep controls */}
                    <div
                        style={{
                            gridColumn: 'span 2', padding: '0 20px 20px 20px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
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
                            <div style={{ justifySelf: 'end' }}>{'Click'}
                                <span
                                    onClick={async () => {
                                        await deleteMove(appState.apiOrigin, move.move_id);
                                        dispatch({
                                            type: WorkspaceActionType.SetEffects,
                                            value: appState.effects.filter(e => {
                                                switch (e.type) {
                                                    case "scale": {
                                                        return true;
                                                    }
                                                    case "move": {
                                                        return e.value.move_id != move.move_id;
                                                    }
                                                }
                                            })
                                        });
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

interface VerticalSliderProps {
    label: string,
    hash: string,
    capSize: { width: number | string, height: number | string }
    trackSize: { width: number | string, height: number | string }
    trackRef: RefObject<HTMLDivElement | null>,
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,
}
function VerticalSlider({
    label,
    hash,
    capSize,
    trackSize,
    trackRef,
    cursor,
    onNewCursor,
    onCursorMove,
}: VerticalSliderProps) {
    return (<>
        <div style={{ height: '100%', width: 'min-content' }}>
            <div style={{ position: "relative", ...trackSize, }}>
                <div style={{ position: 'absolute', height: '100%', width: '100%', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
                        width={capSize.width}
                        height={'100%'}
                        coarsePointer={{
                            ...capSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={onCursorMove} />
                </div>
                <div
                    ref={trackRef}
                    onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        const yOffset: number = parseFloat(`${capSize.height}`) || 0;
                        onNewCursor({ x, y: Math.min(y, rect.height - yOffset) });
                    }}
                    style={{
                        zIndex: 0,
                        cursor: 'crosshair',
                        position: "absolute",
                        justifySelf: 'center',
                        height: trackSize.height,
                        width: 10,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(5, 5, 5)'
                    }}
                />
            </div>
            <div className={dmSans.className}
                style={{
                    alignSelf: "start", justifySelf: "center",
                    fontSize: "10px", paddingTop: '10px'
                }}>{label}</div>
        </div>
    </>)
}
