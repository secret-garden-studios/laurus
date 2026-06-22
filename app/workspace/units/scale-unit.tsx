import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { convertTime, CoreContext, HoverContext, UIContext } from "../workspace.client";
import { dellaRespira, dmSans } from "../../fonts";
import { updateScale, LaurusLoopType, LaurusScaleEquation, LaurusScaleResult } from "../workspace.server";
import { ComplexTrackpadOptions, useComplexTrackpadState } from "../../hooks/useComplexTrackpadState";
import { useTrackpadState } from "../../hooks/useTrackpadState";
import { ParameterSliderY, ParameterSliderXPlusMinus } from "../../components/parameter-slider";
import UnitDisplay, { DeepControls } from "./unit-display";
import { getDynamicUnitSizes, MIN_LIMIT_FACTOR, SCALE_MAX } from "../workspace.config";
import { LaurusProjectResult } from "../../projects/projects.server";
import { useCarouselIndex } from "../hooks/useCarouselIndex";
import ScaleUnitbar from "./bars/scale-unitbar";
import { LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";


export interface ScaleUnitControls {
    scale_x: number,
    scale_y: number,
    time: number,
    loop: LaurusLoopType,
    limit_factor: number,
}

export const defaultScaleEquation: LaurusScaleEquation = {
    input_id: "",
    time: 0.000001,
    scale_x: 1,
    scale_y: 1,
    loop: LaurusLoopType.none,
    solution: [],
    limit_factor: MIN_LIMIT_FACTOR
}

interface ScaleUnit {
    scale: LaurusScaleResult
    carouselIndexInit: number,
}
export default function ScaleUnit({ scale, carouselIndexInit }: ScaleUnit) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const { isAltKeyPressed } = useContext(HoverContext);
    const { carouselIndex, localIndex, setLocalIndex } =
        useCarouselIndex(uiState.activeElement, uiState.carouselEntries, carouselIndexInit, scale.scale_id);
    const [mainControls] = useState(true);
    const [currentControls, setCurrentControls] = useState<ScaleUnitControls>({
        scale_x: defaultScaleEquation.scale_x,
        scale_y: defaultScaleEquation.scale_y,
        time: 0,
        loop: defaultScaleEquation.loop,
        limit_factor: defaultScaleEquation.limit_factor,
    });
    const [dynamicSizes] = useState(() => {
        const ds = getDynamicUnitSizes(uiState.resolution);
        switch (uiState.resolution.type) {
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
                    capWidth: 15,
                    capHeight: 15,
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
                    capWidth: 13,
                    capHeight: 13,
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
        if (carouselIndex < uiState.carouselEntries.length) {
            const carouselEntry = uiState.carouselEntries[carouselIndex];
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
    }, [uiState.carouselEntries, appState.project.imgs, appState.project.svgs, carouselIndex]);

    // param 1
    const timeUpperLimit = useMemo(() => {
        return convertTime(appState.timelineMaxValue, appState.timelineUnit, 'sec')
    }, [appState.timelineMaxValue, appState.timelineUnit]);
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getInverseTrackValue: getTimeValue, getInverseTrackCursor: getTimeCursor } =
        useTrackpadState(
            dynamicSizes.paramSlider.capHeight - dynamicSizes.paramSlider.capBorderOffset,
            timeUpperLimit * (scale.math.get(carouselEntryKey)?.limit_factor ?? defaultScaleEquation.limit_factor));
    const timeTitle = useMemo(() => {
        return scale.math.has(carouselEntryKey) ? ((scale.math.get(carouselEntryKey)!.time / 1000).toFixed(2) + 's') : undefined;
    }, [carouselEntryKey, scale.math]);
    const timeRef = useRef<HTMLDivElement | null>(null);

    // main params
    const [complexTrackpadOptions] = useState<ComplexTrackpadOptions>({ fineTuningLimit: 2 });
    const [unlockAspectRatio, setUnlockAspectRatio] = useState(false);

    const scaleXRef = useRef<HTMLInputElement | null>(null);
    const scaleXTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleXCursor, setScaleXCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleXValue, getComplexTrackCursor: getScaleXCursor } =
        useComplexTrackpadState(
            dynamicSizes.scaleParam.capWidth - dynamicSizes.scaleParam.capBorderOffset,
            SCALE_MAX);
    const scaleXTitle = useMemo(() => {
        return scale.math.has(carouselEntryKey) ? (scale.math.get(carouselEntryKey)!.scale_x.toFixed(3)) : undefined;
    }, [carouselEntryKey, scale.math]);

    const scaleYRef = useRef<HTMLInputElement | null>(null);
    const scaleYTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleYCursor, setScaleYCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleYValue, getComplexTrackCursor: getScaleYCursor } =
        useComplexTrackpadState(
            dynamicSizes.scaleParam.capWidth - dynamicSizes.scaleParam.capBorderOffset,
            SCALE_MAX);
    const scaleYTitle = useMemo(() => {
        return scale.math.has(carouselEntryKey) ? (scale.math.get(carouselEntryKey)!.scale_y.toFixed(3)) : undefined;
    }, [carouselEntryKey, scale.math]);

    const setActiveElementIfNull = useCallback(() => {
        if (carouselIndex < uiState.carouselEntries.length && uiState.activeElement == undefined) {
            const carouselEntry = uiState.carouselEntries[carouselIndex];
            switch (carouselEntry.type) {
                case "svg": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "svg",
                        locallyActivatedEffectKey: scale.scale_id
                    }
                    uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
                case "img": {
                    const newActiveElement: LaurusActiveElement = {
                        key: carouselEntry.key,
                        type: "img",
                        locallyActivatedEffectKey: scale.scale_id
                    }
                    uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                    break;
                }
            }
        }
    }, [carouselIndex, uiState.carouselEntries, uiState.activeElement, scale.scale_id, uiDispatch]);

    const getActiveScale = useCallback((): [number, number] => {
        if (!uiState.activeElement) return [1, 1];
        const activeElement = { ...uiState.activeElement };
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
    }, [uiState.activeElement, appState.project]);

    const saveNewEquation = useCallback(async (rollback: LaurusScaleResult, newEquation: LaurusScaleEquation) => {
        const newMath: Map<string, LaurusScaleEquation> = new Map(rollback.math);
        newMath.set(newEquation.input_id, newEquation);
        const newScale: LaurusScaleResult = { ...rollback, math: newMath };
        setActiveElementIfNull();
        dispatch({
            type: CoreActionType.SetEffect,
            value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id },
        });
        const updated = await updateScale(appState.apiOrigin, appState.accessToken, rollback.scale_id, { ...newScale });
        if (!updated) {
            dispatch({
                type: CoreActionType.SetEffect,
                value: { type: 'scale', value: { ...rollback }, key: rollback.scale_id },
            });
        }
    }, [setActiveElementIfNull, dispatch, appState.apiOrigin, appState.accessToken]);

    const updateTrackpads = useCallback((newControls: ScaleUnitControls) => {
        if (scaleXTrackRef.current) {
            const newScaleXCursor = getScaleXCursor(newControls.scale_x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
            setScaleXCursor({ x: newScaleXCursor, y: 0 });
        }
        if (scaleYTrackRef.current) {
            const newScaleYCursor = getScaleYCursor(newControls.scale_y, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
            setScaleYCursor({ x: newScaleYCursor, y: 0 });
        }
        if (timeTrackRef.current) {
            const newTimeCursor = getTimeCursor(newControls.time, (timeTrackRef.current.clientHeight));
            setTimeCursor({ y: newTimeCursor, x: 0 });
        }
        if (scaleXRef.current) {
            scaleXRef.current.value = newControls.scale_x >= 10 ? newControls.scale_x.toFixed(2) : newControls.scale_x.toFixed(3);
        }
        if (scaleYRef.current) {
            scaleYRef.current.value = newControls.scale_y >= 10 ? newControls.scale_y.toFixed(2) : newControls.scale_y.toFixed(3);
        }
    }, [complexTrackpadOptions, getScaleXCursor, getScaleYCursor, getTimeCursor]);

    useLayoutEffect(() => {
        (async () => {
            const activeKey = carouselEntryKey;
            const activeEquation = scale.math.get(activeKey);
            const initControls: ScaleUnitControls = { ...currentControls }
            if (activeEquation) {
                initControls.time = activeEquation.time / 1000;
                initControls.scale_x = activeEquation.scale_x;
                initControls.scale_y = activeEquation.scale_y;
                initControls.loop = activeEquation.loop;
                initControls.limit_factor = activeEquation.limit_factor;
            }
            else if (activeKey) {
                initControls.scale_x = defaultScaleEquation.scale_x;
                initControls.scale_y = defaultScaleEquation.scale_y;
                initControls.time = 0;
                initControls.loop = defaultScaleEquation.loop;
                initControls.limit_factor = defaultScaleEquation.limit_factor;
            }
            updateTrackpads(initControls);
        })();
    }, [carouselEntryKey, scale.math, updateTrackpads, currentControls]);

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
                            border: '1px solid rgba(255, 255, 255, 0.025)',
                            backgroundColor: "rgba(20, 20, 20, 0.25)",
                            boxShadow: '4px 4px 12px rgba(11, 11, 11, 0.5)',
                            borderRadius: 6,
                            padding: 0,
                            display: 'grid',
                            gridTemplateColumns: 'min-content auto min-content auto min-content',
                            gridTemplateRows: 'auto',
                            height: dynamicSizes.paramButtonContainer.height * 7,
                        }}>
                            <div style={{
                                height: '100%',
                                display: 'flex',
                                ...dynamicSizes.paramFlex
                            }}>
                                <ParameterSliderY
                                    resolution={{ ...uiState.resolution }}
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
                                        setCurrentControls(v => { return { ...v, time: newTime } });
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
                                    onCursorMove={(c) => {
                                        if (!timeTrackRef.current || !timeRef.current) return;
                                        const val = getTimeValue(c.y, timeTrackRef.current.clientHeight);
                                        timeRef.current.innerHTML = val.toFixed(2) + 's';
                                    }}
                                    disabled={scale.locked || isAltKeyPressed}
                                    title={timeTitle}
                                    liveTitleRef={timeRef} />
                            </div>
                            <div />
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
                                    resolution={{ ...uiState.resolution }}
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p2`}
                                    size={dynamicSizes.scaleParam}
                                    containerRef={scaleXTrackRef}
                                    cursor={scaleXCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleXTrackRef.current || !scaleXRef.current || !scaleYRef.current) return;
                                        const newScaleValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
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
                                        const newScaleXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                                        const newControls: ScaleUnitControls = { ...currentControls, scale_x: newScaleXValue };
                                        let newScaleYValue: number | undefined = undefined;
                                        if (!unlockAspectRatio) {
                                            const d = getActiveScale();
                                            const r = d[0] / d[1];
                                            const newYCursor = newCursor.x / r;
                                            const newYValue = newScaleXValue / r;
                                            setScaleYCursor({ x: newYCursor, y: 0 });
                                            newScaleYValue = newYValue;
                                            newControls.scale_y = newYValue;
                                        }
                                        setCurrentControls(newControls);
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
                                    disabled={scale.locked || isAltKeyPressed}
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
                                    resolution={{ ...uiState.resolution }}
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p3`}
                                    size={dynamicSizes.scaleParam}
                                    containerRef={scaleYTrackRef}
                                    cursor={scaleYCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleYTrackRef.current || !scaleYRef.current || !scaleXRef.current) return;
                                        const newScaleValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
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
                                        const newScaleYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                                        const newControls: ScaleUnitControls = { ...currentControls, scale_y: newScaleYValue };
                                        let newScaleXValue: number | undefined = undefined;
                                        if (!unlockAspectRatio) {
                                            const d = getActiveScale();
                                            const r = d[0] / d[1];
                                            const newXCursor = newCursor.x * r;
                                            const newXValue = newScaleYValue / r;
                                            setScaleXCursor({ x: newXCursor, y: 0 });
                                            newScaleXValue = newXValue;
                                            newControls.scale_x = newXValue;
                                        }
                                        setCurrentControls(newControls);
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
                                    disabled={scale.locked || isAltKeyPressed}
                                    title={scaleYTitle} />
                            </div>
                            <div />
                            {/* toolbar */}
                            <ScaleUnitbar
                                scale={scale}
                                carouselEntryKey={carouselEntryKey}
                                unlockAspectRatio={unlockAspectRatio}
                                updateTrackpads={updateTrackpads}
                                currentControls={currentControls}
                                setCurrentControls={setCurrentControls}
                                setUnlockAspectRatio={setUnlockAspectRatio}
                                saveNewEquation={saveNewEquation} />
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
