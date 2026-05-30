import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LaurusMoveEquation, LaurusMoveResult, WorkspaceActionType, WorkspaceContext, LaurusActiveElement, convertTime } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { updateMove, LaurusLoopType, LaurusShapeType } from "../workspace.server";
import Dial from "../../components/dial";
import { ParameterSliderY } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getDynamicUnitSizes } from "../workspace-resolution";
import { useCarouselIndex } from "../../hooks/useCarouselIndex";
import MoveUnitbar from "./bars/move-unitbar";

export interface MoveUnitControls {
    amplitude: number,
    frequency: number,
    wavelength: number,
    distance: number,
    time: number,
    angle: number,
    shape: LaurusShapeType,
}

export const defaultMoveEquation: LaurusMoveEquation = {
    input_id: "",
    time: 0.000001,
    loop: LaurusLoopType.none,
    shape: LaurusShapeType.wave,
    solution: [],
    angle: 0,
    amplitude: 0,
    frequency: 0,
    wavelength: 0,
    distance: 0,
    limit_factor: 1.0
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
        useCarouselIndex(appState.activeElement, appState.carouselEntries, carouselIndexInit);
    const [mainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<MoveUnitControls>({
        ...defaultMoveEquation,
        time: 0,
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
    const amplitudeTrackRef = useRef<HTMLDivElement | null>(null);
    const [amplitudeCursor, setAmplitudeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getAmplitudeValue, getInverseTrackCursor: getAmplitudeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            500 * (move.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const amplitudeTitle = useMemo(() => {
        return move.math.has(carouselEntryKey) ? (move.math.get(carouselEntryKey)!.amplitude.toFixed(2)) + 'px' : undefined;
    }, [carouselEntryKey, move.math]);
    const amplitudeRef = useRef<HTMLDivElement | null>(null);

    // param 2
    const frequencyTrackRef = useRef<HTMLDivElement | null>(null);
    const [frequencyCursor, setFrequencyCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getFrequencyValue, getInverseTrackCursor: getFrequencyCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            20 * (move.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const frequencyTitle = useMemo(() => {
        return move.math.has(carouselEntryKey) ? (move.math.get(carouselEntryKey)!.frequency.toFixed(2)) + 'hz' : undefined;
    }, [carouselEntryKey, move.math]);
    const frequencyRef = useRef<HTMLDivElement | null>(null);

    // param 3
    const wavelengthTrackRef = useRef<HTMLDivElement | null>(null);
    const [wavelengthCursor, setWavelengthCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getWavelengthValue, getInverseTrackCursor: getWavelengthCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            1000 * (move.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const wavelengthTitle = useMemo(() => {
        return move.math.has(carouselEntryKey) ? (move.math.get(carouselEntryKey)!.wavelength.toFixed(2)) + 'px' : undefined;
    }, [carouselEntryKey, move.math]);
    const wavelengthRef = useRef<HTMLDivElement | null>(null);

    // param 4
    const distanceTrackRef = useRef<HTMLDivElement | null>(null);
    const [distanceCursor, setDistanceCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getDistanceValue, getInverseTrackCursor: getDistanceCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            3000 * (move.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const distanceTitle = useMemo(() => {
        return move.math.has(carouselEntryKey) ? (move.math.get(carouselEntryKey)!.distance.toFixed(2)) + 'px' : undefined;
    }, [carouselEntryKey, move.math]);
    const distanceRef = useRef<HTMLDivElement | null>(null);

    // param 5
    const timeUpperLimit = useMemo(() => {
        return convertTime(appState.timelineMaxValue, appState.timelineUnit, 'sec')
    }, [appState.timelineMaxValue, appState.timelineUnit]);
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            timeUpperLimit * (move.math.get(carouselEntryKey)?.limit_factor ?? 1));
    const timeTitle = useMemo(() => {
        return move.math.has(carouselEntryKey) ? ((move.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + 's') : undefined;
    }, [carouselEntryKey, move.math]);
    const timeRef = useRef<HTMLDivElement | null>(null);

    // main param
    const [angle, setAngle] = useState(0);
    const angleTitle = useMemo(() => {
        return move.math.has(carouselEntryKey) ? (move.math.get(carouselEntryKey)!.angle.toFixed(0)) + '°' : undefined;
    }, [carouselEntryKey, move.math]);

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
            value: { type: 'move', value: { ...newMove }, key: newMove.move_id },
        });
        const updated = await updateMove(appState.apiOrigin, appState.accessToken, rollback.move_id, { ...newMove });
        if (!updated) {
            dispatch({
                type: WorkspaceActionType.SetEffect,
                value: { type: 'move', value: { ...rollback }, key: rollback.move_id },
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
                initControls.amplitude = defaultMoveEquation.amplitude;
                initControls.frequency = defaultMoveEquation.frequency;
                initControls.wavelength = defaultMoveEquation.wavelength;
                initControls.distance = defaultMoveEquation.distance;
                initControls.time = 0;
                initControls.angle = defaultMoveEquation.angle;
            }
            updateTrackpads(initControls);
        })();
    }, [currentControls, carouselEntryKey, move.math, updateTrackpads]);


    const shapeType = useMemo((): LaurusShapeType => {
        return move.math.get(carouselEntryKey)?.shape ?? LaurusShapeType.wave;
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
                                border: '1px solid rgba(255, 255, 255, 0.025)',
                                backgroundColor: "rgba(20, 20, 20, 0.25)",
                                boxShadow: '4px 4px 12px rgba(11, 11, 11, 0.5)',
                                borderRadius: 6,
                                padding: 0,
                                display: 'grid',
                                gridTemplateColumns: 'auto min-content auto min-content',
                                gridTemplateRows: 'auto',
                                height: dynamicSizes.paramButtonContainer.height * 7,
                            }}>
                                <div />
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    ...dynamicSizes.paramFlex
                                }}>
                                    <ParameterSliderY
                                        label={"amplitude"}
                                        hash={`${move.move_id}|p1`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={amplitudeTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
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
                                                        ...defaultMoveEquation,
                                                        input_id: activeKey,
                                                        amplitude: newAmplitude,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        onCursorMove={(c) => {
                                            if (!amplitudeTrackRef.current || !amplitudeRef.current) return;
                                            const val = getAmplitudeValue(c.y, amplitudeTrackRef.current.clientHeight, 0);
                                            amplitudeRef.current.innerHTML = val.toFixed(2) + 'px';
                                        }}
                                        disabled={move.locked}
                                        title={amplitudeTitle}
                                        liveTitleRef={amplitudeRef} />
                                    <ParameterSliderY
                                        label={"frequency"}
                                        hash={`${move.move_id}|p2`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={frequencyTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
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
                                                        ...defaultMoveEquation,
                                                        input_id: activeKey,
                                                        frequency: newFrequency,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        onCursorMove={(c) => {
                                            if (!frequencyTrackRef.current || !frequencyRef.current) return;
                                            const val = getFrequencyValue(c.y, frequencyTrackRef.current.clientHeight);
                                            frequencyRef.current.innerHTML = val.toFixed(2) + 'hz';
                                        }}
                                        disabled={move.locked}
                                        title={frequencyTitle}
                                        liveTitleRef={frequencyRef} />
                                    {(shapeType != LaurusShapeType.circle && shapeType != LaurusShapeType.ellipse) && <ParameterSliderY
                                        label={"wavelength"}
                                        hash={`${move.move_id}|p3`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={wavelengthTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
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
                                                        ...defaultMoveEquation,
                                                        input_id: activeKey,
                                                        wavelength: newWavelength,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        onCursorMove={(c) => {
                                            if (!wavelengthTrackRef.current || !wavelengthRef.current) return;
                                            const val = getWavelengthValue(c.y, wavelengthTrackRef.current.clientHeight);
                                            wavelengthRef.current.innerHTML = val.toFixed(2) + 'px';
                                        }}
                                        disabled={move.locked}
                                        title={wavelengthTitle}
                                        liveTitleRef={wavelengthRef} />}
                                    {shapeType != LaurusShapeType.circle && <ParameterSliderY
                                        label={"distance"}
                                        hash={`${move.move_id}|p4`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={distanceTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
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
                                                        ...defaultMoveEquation,
                                                        input_id: activeKey,
                                                        distance: newDistance,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        onCursorMove={(c) => {
                                            if (!distanceTrackRef.current || !distanceRef.current) return;
                                            const val = getDistanceValue(c.y, distanceTrackRef.current.clientHeight);
                                            distanceRef.current.innerHTML = val.toFixed(2) + 'px';
                                        }}
                                        disabled={move.locked}
                                        title={distanceTitle}
                                        liveTitleRef={distanceRef} />}
                                    <ParameterSliderY
                                        label={"time"}
                                        hash={`${move.move_id}|p5`}
                                        size={dynamicSizes.paramSlider}
                                        trackRef={timeTrackRef}
                                        trackBackground={'linear-gradient(1deg, rgb(68, 68, 68), rgb(72, 72, 72))'}
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
                                                        ...defaultMoveEquation,
                                                        input_id: activeKey,
                                                        time: newServerTime,
                                                    };
                                                saveNewEquation(snapshot, newEquation);
                                            }
                                        }}
                                        onCursorMove={(c) => {
                                            if (!timeTrackRef.current || !timeRef.current) return;
                                            const val = getTimeValue(c.y, timeTrackRef.current.clientHeight);
                                            timeRef.current.innerHTML = val.toFixed(2) + 's';
                                        }}
                                        disabled={move.locked}
                                        title={timeTitle}
                                        liveTitleRef={timeRef} />
                                </div>
                                <div />
                                {/* toolbar */}
                                <MoveUnitbar
                                    move={move}
                                    imgElementsRef={imgElementsRef}
                                    svgElementsRef={svgElementsRef}
                                    carouselEntryKey={carouselEntryKey}
                                    carouselIndex={carouselIndex}
                                    currentControls={currentControls}
                                    setCurrentControls={setCurrentControls}
                                    updateTrackpads={updateTrackpads}
                                    saveNewEquation={saveNewEquation}
                                />
                            </div>
                        </div>
                        {/* main control */}
                        {shapeType != LaurusShapeType.circle && <div style={{ ...dynamicSizes.param }}>
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
                                                    ...defaultMoveEquation,
                                                    input_id: activeKey,
                                                    angle: newAngle,
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
                                    }}
                                    title={angleTitle} />
                            </div>
                        </div>}
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
