import { RefObject, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext, LaurusRotateResult, LaurusRotateEquation, LaurusActiveElement, convertTime } from "../workspace.client";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import Dial from "../../components/dial";
import { ParameterSliderY } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { LaurusLoopType, updateRotate } from "../workspace.server";
import { getDynamicUnitSizes, MIN_LIMIT_FACTOR, ROTATE_AXIS_MAX } from "../workspace.config";
import { useCarouselIndex } from "../../hooks/useCarouselIndex";
import RotateUnitbar from "./bars/rotate-unitbar";

export interface RotateUnitControls {
    x: number,
    y: number,
    z: number,
    time: number,
    angle: number,
}

export const defaultRotateEquation: LaurusRotateEquation = {
    input_id: "",
    time: 0.000001,
    loop: LaurusLoopType.none,
    solution: [],
    angle: 0,
    x: 0,
    y: 0,
    z: 0,
    limit_factor: MIN_LIMIT_FACTOR
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
        const ds = getDynamicUnitSizes(appState.resolution);
        switch (appState.resolution.type) {
            case "high": return {
                ...ds,
                angleParam: { padding: 15 },
                angleTitle: {
                    top: 10,
                    right: 10,
                    letterSpacing: 1,
                    fontSize: 11,
                }
            }
            case "midhigh": return {
                ...ds,
                angleParam: { padding: 11 },
                angleTitle: {
                    top: 8,
                    right: 8,
                    letterSpacing: 1,
                    fontSize: 8,
                }
            }
            case "low":
            case "midlow": return {
                ...ds,
                angleParam: { padding: 8 },
                angleTitle: {
                    top: 8,
                    right: 8,
                    letterSpacing: 1,
                    fontSize: 7,
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
    const xTrackRef = useRef<HTMLDivElement | null>(null);
    const [xCursor, setXCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getXValue, getInverseTrackCursor: getXCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            ROTATE_AXIS_MAX);
    const xTitle = useMemo(() => {
        return rotate.math.has(carouselEntryKey) ? (rotate.math.get(carouselEntryKey)!.x.toFixed(2)) : undefined;
    }, [carouselEntryKey, rotate.math]);
    const xRef = useRef<HTMLDivElement | null>(null);

    // param 2
    const yTrackRef = useRef<HTMLDivElement | null>(null);
    const [yCursor, setYCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getYValue, getInverseTrackCursor: getYCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            ROTATE_AXIS_MAX);
    const yTitle = useMemo(() => {
        return rotate.math.has(carouselEntryKey) ? (rotate.math.get(carouselEntryKey)!.y.toFixed(2)) : undefined;
    }, [carouselEntryKey, rotate.math]);
    const yRef = useRef<HTMLDivElement | null>(null);

    // param 3
    const zTrackRef = useRef<HTMLDivElement | null>(null);
    const [zCursor, setZCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getZValue, getInverseTrackCursor: getZCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            ROTATE_AXIS_MAX);
    const zTitle = useMemo(() => {
        return rotate.math.has(carouselEntryKey) ? (rotate.math.get(carouselEntryKey)!.z.toFixed(2)) : undefined;
    }, [carouselEntryKey, rotate.math]);
    const zRef = useRef<HTMLDivElement | null>(null);

    // param 4
    const timeUpperLimit = useMemo(() => {
        return convertTime(appState.timelineMaxValue, appState.timelineUnit, 'sec')
    }, [appState.timelineMaxValue, appState.timelineUnit]);
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            timeUpperLimit * (rotate.math.get(carouselEntryKey)?.limit_factor ?? defaultRotateEquation.limit_factor));
    const timeTitle = useMemo(() => {
        return rotate.math.has(carouselEntryKey) ? ((rotate.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + 's') : undefined;
    }, [carouselEntryKey, rotate.math]);
    const timeRef = useRef<HTMLDivElement | null>(null);

    // main param
    const [angle, setAngle] = useState(0);
    const angleTitle = useMemo(() => {
        return rotate.math.has(carouselEntryKey) ? (rotate.math.get(carouselEntryKey)!.angle.toFixed(0)) + '°' : undefined;
    }, [carouselEntryKey, rotate.math]);
    const angleRef = useRef<HTMLDivElement | null>(null);

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
            value: { type: 'rotate', value: { ...newRotate }, key: newRotate.rotate_id },
        });
        const updated = await updateRotate(appState.apiOrigin, appState.accessToken, rollback.rotate_id, { ...newRotate });
        if (!updated) {
            dispatch({
                type: WorkspaceActionType.SetEffect,
                value: { type: 'rotate', value: { ...rollback }, key: rollback.rotate_id },
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
                initControls.x = defaultRotateEquation.x;
                initControls.y = defaultRotateEquation.y;
                initControls.z = defaultRotateEquation.z;
                initControls.time = defaultRotateEquation.time;
                initControls.angle = defaultRotateEquation.angle;
            }
            updateTrackpads(initControls);
        })();
    }, [currentControls, carouselEntryKey, rotate.math, updateTrackpads, appState.timelineUnit]);

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
                                        onCursorMove={(c) => {
                                            if (!xTrackRef.current || !xRef.current) return;
                                            const val = getXValue(c.y, xTrackRef.current.clientHeight, 0);
                                            xRef.current.innerHTML = val.toFixed(2);
                                        }}
                                        disabled={rotate.locked}
                                        title={xTitle}
                                        liveTitleRef={xRef} />
                                    <ParameterSliderY
                                        label={"y"}
                                        hash={`${rotate.rotate_id}|p2`}
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
                                        onCursorMove={(c) => {
                                            if (!yTrackRef.current || !yRef.current) return;
                                            const val = getYValue(c.y, yTrackRef.current.clientHeight, 0);
                                            yRef.current.innerHTML = val.toFixed(2);
                                        }}
                                        disabled={rotate.locked}
                                        title={yTitle}
                                        liveTitleRef={yRef} />
                                    <ParameterSliderY
                                        label={"z"}
                                        hash={`${rotate.rotate_id}|p3`}
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
                                        onCursorMove={(c) => {
                                            if (!zTrackRef.current || !zRef.current) return;
                                            const val = getZValue(c.y, zTrackRef.current.clientHeight, 0);
                                            zRef.current.innerHTML = val.toFixed(2);
                                        }}
                                        disabled={rotate.locked}
                                        title={zTitle}
                                        liveTitleRef={zRef} />
                                    <ParameterSliderY
                                        label={"time"}
                                        hash={`${rotate.rotate_id}|p4`}
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
                                        onCursorMove={(c) => {
                                            if (!timeTrackRef.current || !timeRef.current) return;
                                            const val = getTimeValue(c.y, timeTrackRef.current.clientHeight);
                                            timeRef.current.innerHTML = val.toFixed(2) + 's';
                                        }}
                                        disabled={rotate.locked}
                                        title={timeTitle}
                                        liveTitleRef={timeRef} />
                                </div>
                                <div />
                                {/* toolbar */}
                                <RotateUnitbar
                                    rotate={rotate}
                                    carouselIndex={carouselIndex}
                                    svgElementsRef={svgElementsRef}
                                    imgElementsRef={imgElementsRef}
                                    carouselEntryKey={carouselEntryKey}
                                    updateTrackpads={updateTrackpads}
                                    saveNewEquation={saveNewEquation}
                                    currentControls={currentControls}
                                    setCurrentControls={setCurrentControls}
                                    counterClockwise={counterClockwise}
                                    setCounterClockwise={setCounterClockwise} />
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
                                position: 'relative',
                                ...dynamicSizes.angleParam
                            }}>
                                {angleTitle && <div
                                    ref={angleRef}
                                    style={{
                                        position: 'absolute',
                                        color: 'rgb(220,220,220)',
                                        fontWeight: 'bold',
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'none',
                                        userSelect: 'none',
                                        ...dynamicSizes.angleTitle
                                    }}>
                                    {angleTitle}
                                </div>}
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
                                    onMove={(v) => {
                                        if (!angleRef.current) return;
                                        const newAngle: number = ((v) => {
                                            const x = (Math.round(v) % 360);
                                            const x2 = x < 0 ? x + 360 : x;
                                            return counterClockwise ? x2 * -1 : x2;
                                        })(v);
                                        angleRef.current.innerHTML = newAngle.toFixed(0) + '°';
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
