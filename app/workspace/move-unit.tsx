import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LaurusMoveEquation, LaurusMoveResult, WorkspaceActionType, WorkspaceContext, LaurusEffect, LaurusActiveElement } from "./workspace.client";
import { autorenew, playArrow, skipPrevious, SvgRepo, fileCopy, contentPaste, refresh, LaurusClientSvg } from "../svg-repo";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { getMove, updateMove, LaurusLoopType } from "./workspace.server";
import Dial from "../components/dial";
import { ParameterSliderY } from "../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getDynamicUnitSizes } from "./workspace-resolution";
import { useCarouselIndex } from "../hooks/useCarouselIndex";

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
    carouselIndexInit: number,
}
export default function MoveUnit({ move, svgElementsRef, imgElementsRef, carouselIndexInit }: MoveUnit) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const { carouselIndex, localIndex, setLocalIndex } =
        useCarouselIndex(appState.activeElement, appState.carouselEntries, carouselIndexInit, move.move_id);
    const [mainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<MoveUnitControls>({
        amplitude: 0,
        frequency: 0,
        wavelength: 0,
        distance: 0,
        time: 0,
        angle: 0,
    });
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

    // param 1
    const amplitudeTrackRef = useRef<HTMLDivElement | null>(null);
    const [amplitudeCursor, setAmplitudeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getAmplitudeValue, getInverseTrackCursor: getAmplitudeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            500);

    // param 2
    const frequencyTrackRef = useRef<HTMLDivElement | null>(null);
    const [frequencyCursor, setFrequencyCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getFrequencyValue, getInverseTrackCursor: getFrequencyCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            20);

    // param 3
    const wavelengthTrackRef = useRef<HTMLDivElement | null>(null);
    const [wavelengthCursor, setWavelengthCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getWavelengthValue, getInverseTrackCursor: getWavelengthCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            1000);

    // param 4
    const distanceTrackRef = useRef<HTMLDivElement | null>(null);
    const [distanceCursor, setDistanceCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getDistanceValue, getInverseTrackCursor: getDistanceCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            5000);

    // param 5
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            appState.timelineMaxValue * 0.5);

    // main param
    const [angle, setAngle] = useState(0);

    const setActiveElementIfNull = useCallback(() => {
        if (carouselIndex < appState.carouselEntries.length && appState.activeElement == undefined) {
            const carouselEntry = appState.carouselEntries[carouselIndex];
            switch (carouselEntry.type) {
                case "svg": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "svg",
                        locallyActivatedEffectKey: move.move_id
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
                case "img": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "img",
                        locallyActivatedEffectKey: move.move_id
                    }
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
            }
        }
    }, [appState.activeElement, appState.carouselEntries, carouselIndex, dispatch, move.move_id]);

    const saveNewEquation = useCallback(async (rollback: LaurusMoveResult, newEquation: LaurusMoveEquation) => {
        const newMath: Map<string, LaurusMoveEquation> = new Map(rollback.math);
        newMath.set(newEquation.input_id, newEquation);
        const newMove: LaurusMoveResult = { ...rollback, math: newMath };
        setActiveElementIfNull();
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
    }, [appState.accessToken, appState.apiOrigin, dispatch, setActiveElementIfNull]);

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

    useLayoutEffect(() => {
        (async () => {
            const activeKey = carouselEntryKey;
            const activeEquation = move.math.get(activeKey);
            const initControls: MoveUnitControls = { ...currentControls }
            if (activeEquation) {
                initControls.amplitude = activeEquation.amplitude;
                initControls.frequency = activeEquation.frequency;
                initControls.wavelength = activeEquation.wavelength;
                initControls.distance = activeEquation.distance;
                initControls.time = activeEquation.time / 1000;
                initControls.angle = activeEquation.angle;
            }
            else if (activeKey) {
                initControls.amplitude = 0;
                initControls.frequency = 0;
                initControls.wavelength = 0;
                initControls.distance = 0;
                initControls.time = 0;
                initControls.angle = 0;
            }
            updateTrackpads(initControls);
        })();
    }, [currentControls, carouselEntryKey, move.math, updateTrackpads]);

    const getPreviewAnimations = useCallback(async (firstFrame: boolean) => {
        const activeKey = carouselEntryKey;
        if (!activeKey) return [];
        const newAnimations: Animation[] = [];
        const response: LaurusMoveResult | undefined =
            await getMove(appState.apiOrigin, move.move_id, activeKey);
        if (response) {
            const activeMath = response.math
                .get(activeKey);
            if (!activeMath) return [];
            const keyframes: Keyframe[] = (firstFrame ? [activeMath.solution[0]] : activeMath.solution)
                .map(s => { return { translate: `${s.x}px ${s.y}px 0px`, } }) ?? [];
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
    }, [appState.apiOrigin, appState.carouselEntries, appState.tool.type, carouselIndex, carouselEntryKey, imgElementsRef, move.move_id, svgElementsRef]);

    const loopSvg = useMemo((): [boolean, LaurusClientSvg] => {
        const loopType = move.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
        const enabled = move.math.has(carouselEntryKey) ? true : false;
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
    }, [carouselEntryKey, move.math]);

    const getNextLoopType = useCallback((): LaurusLoopType => {
        const currentLoop = move.math.get(carouselEntryKey)?.loop;
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
    }, [carouselEntryKey, move.math]);

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
                        effectKey={move.move_id}
                        localIndex={localIndex}
                        onNewLocalIndex={setLocalIndex} />
                    {/* controls */}
                    <div style={{ display: 'grid' }}>
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
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    ...dynamicSizes.paramFlex
                                }}>
                                    <ParameterSliderY
                                        label={"amplitude"}
                                        hash={`${move.move_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={amplitudeTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
                                        cursor={amplitudeCursor}
                                        onNewCursor={(newCursor) => {
                                            setAmplitudeCursor({ ...newCursor, x: 0 });
                                            if (!amplitudeTrackRef.current) return;
                                            const newAmplitude = getAmplitudeValue(newCursor.y, amplitudeTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, amplitude: newAmplitude } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, amplitude: newAmplitude } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
                                                        loop: LaurusLoopType.none,
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
                                        disabled={move.locked} />
                                    <ParameterSliderY
                                        label={"frequency"}
                                        hash={`${move.move_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={frequencyTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
                                        cursor={frequencyCursor}
                                        onNewCursor={(newCursor) => {
                                            setFrequencyCursor({ ...newCursor, x: 0 });
                                            if (!frequencyTrackRef.current) return;
                                            const newFrequency = getFrequencyValue(newCursor.y, frequencyTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, frequency: newFrequency } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, frequency: newFrequency } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
                                                        loop: LaurusLoopType.none,
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
                                        disabled={move.locked} />
                                    <ParameterSliderY
                                        label={"wavelength"}
                                        hash={`${move.move_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={wavelengthTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
                                        cursor={wavelengthCursor}
                                        onNewCursor={(newCursor) => {
                                            setWavelengthCursor({ ...newCursor, x: 0 });
                                            if (!wavelengthTrackRef.current) return;
                                            const newWavelength = getWavelengthValue(newCursor.y, wavelengthTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, wavelength: newWavelength } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, wavelength: newWavelength } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
                                                        loop: LaurusLoopType.none,
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
                                        disabled={move.locked} />
                                    <ParameterSliderY
                                        label={"distance"}
                                        hash={`${move.move_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={distanceTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
                                        cursor={distanceCursor}
                                        onNewCursor={(newCursor) => {
                                            setDistanceCursor({ ...newCursor, x: 0 });
                                            if (!distanceTrackRef.current) return;
                                            const newDistance = getDistanceValue(newCursor.y, distanceTrackRef.current.clientHeight);
                                            setCurrentControls(v => { return { ...v, distance: newDistance } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, distance: newDistance } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
                                                        loop: LaurusLoopType.none,
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
                                        disabled={move.locked} />
                                    <ParameterSliderY
                                        label={"time"}
                                        hash={`${move.move_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={timeTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))'}
                                        cursor={timeCursor}
                                        onNewCursor={(newCursor) => {
                                            setTimeCursor({ ...newCursor, x: 0 });
                                            if (!timeTrackRef.current) return;
                                            const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight, 0);
                                            setCurrentControls(v => { return { ...v, time: newTime } });
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newServerTime = newTime * 1000;
                                                const newEquation: LaurusMoveEquation = activeEquation ?
                                                    { ...activeEquation, time: newServerTime } :
                                                    {
                                                        input_id: activeKey,
                                                        time: newServerTime,
                                                        loop: LaurusLoopType.none,
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
                                        disabled={move.locked} />
                                </div>
                                {/* toolbar */}
                                <div style={{
                                    borderLeft: '1px solid rgba(10,10,10,1)',
                                    background: 'linear-gradient(45deg, rgb(18, 18, 18), rgb(22, 22, 22))',
                                    padding: 0,
                                    display: 'grid',
                                    alignContent: 'start',
                                }}>
                                    <div
                                        onClick={() => {
                                            if (move.locked) return;
                                            const activeKey = carouselEntryKey;
                                            if (activeKey) {
                                                const snapshot: LaurusMoveResult = { ...move };
                                                const activeEquation = snapshot.math.get(activeKey);
                                                const newEquation = activeEquation ?
                                                    { ...activeEquation, loop: getNextLoopType() } :
                                                    {
                                                        input_id: activeKey,
                                                        time: 0,
                                                        loop: getNextLoopType(),
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
                                            cursor: move.locked ? '' : move.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            background: loopSvg[0] ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                            ...dynamicSizes.paramButtonContainer
                                        }}>
                                        <SvgRepo
                                            svg={loopSvg[1]}
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
                                            cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(carouselEntryKey) ? skipPrevious() : skipPrevious("rgb(62, 62, 62)")}
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
                                            cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(carouselEntryKey) ? playArrow() : playArrow("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={1} />
                                    </div>
                                    <div
                                        onClick={() => {
                                            if (!wavelengthTrackRef.current) return;
                                            let clipboardData: MoveUnitControls = { ...currentControls };
                                            const activeEquation = move.math.get(carouselEntryKey);
                                            if (activeEquation) {
                                                clipboardData = { ...activeEquation };
                                            }
                                            const currentMoveEq: LaurusMoveEquation = {
                                                ...clipboardData,
                                                input_id: "clipboard",
                                                loop: LaurusLoopType.none,
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
                                            cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer
                                        }}>
                                        <SvgRepo
                                            svg={move.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
                                            containerSize={{ ...dynamicSizes.paramButton }}
                                            scale={0.8} />
                                    </div>
                                    <div
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
                                            cursor: move.math.has(carouselEntryKey) ? 'pointer' : '',
                                            display: 'grid',
                                            placeContent: 'center',
                                            ...dynamicSizes.paramButtonContainer
                                        }}>
                                        <SvgRepo
                                            svg={appState.effectClipboard?.type == 'move' ? contentPaste() : contentPaste('rgb(62, 62, 62)')}
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
                                borderRadius: 0,
                                display: 'flex',
                                alignItems: 'start',
                                justifyContent: 'center',
                                ...dynamicSizes.angleParam
                            }}>
                                <Dial
                                    ids={{
                                        contextId: `${move.move_id}|main|c1`,
                                        draggableId: `${move.move_id}|main|d1`
                                    }}
                                    value={angle}
                                    onNewValue={function (v: number): void {
                                        const newAngle: number = ((v) => { const x = (Math.round(v) % 360); return x < 0 ? x + 360 : x; })(v);
                                        setCurrentControls(v => { return { ...v, angle: newAngle }; });
                                        const activeKey = carouselEntryKey;
                                        if (activeKey) {
                                            const snapshot: LaurusMoveResult = { ...move };
                                            const activeEquation = snapshot.math.get(activeKey);
                                            const newEquation: LaurusMoveEquation = activeEquation ?
                                                { ...activeEquation, angle: newAngle } :
                                                {
                                                    input_id: activeKey,
                                                    time: 0,
                                                    loop: LaurusLoopType.none,
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
                                    disabled={move.locked}
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
