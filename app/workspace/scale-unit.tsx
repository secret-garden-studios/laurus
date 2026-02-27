import { RefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EncodedImg, EncodedSvg, LaurusScaleEquation, LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { dellaRespira, dmSans } from "../fonts";
import { ReactImg, ReactSvg } from "./media";
import { circle, add2, remove, playCircle, autorenew, fastRewind } from "../svg-repo";
import styles from "../app.module.css";
import { PointerStyle, Trackpad } from "../components/trackpad";
import { deleteScale, getScale, updateScale } from "./workspace.server";
import { useComplexTrackpadState } from "../hooks/useComplexTrackpadState";
import useDebounce from "../hooks/useDebounce";
import { useTrackpadState } from "../hooks/useTrackpadState";

interface ScaleUnitProps {
    scale: LaurusScaleResult
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}

export default function ScaleUnit({ scale, svgElementsRef, imgElementsRef }: ScaleUnitProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const placeholderElementRef = useRef<HTMLDivElement>(null);

    const [displaySize] = useState({ 'width': 400, 'height': 400, 'padding': 0 });
    const [mainControls, setMainControls] = useState(true);
    const [prevActiveElementId, setPrevActiveElementId] = useState<string>(appState.activeElement?.key ?? "");

    // param 1
    const timeRef = useRef<HTMLInputElement | null>(null);
    const timeTrackRef = useRef<HTMLDivElement | null>(null);
    const [timeTrackOffsets] = useState({ padding: 20, border: 2 });
    const [timeCapSize] = useState({ width: 45, height: 21 });
    const [timeTrackSize] = useState({ width: 45, height: 200 });
    const [timeCursor, setTimeCursor] = useState({ x: 0, y: 0 });
    const { getTrackValue: getTimeValue, getTrackCursor: getTimeCursor } =
        useTrackpadState(
            timeCapSize.height - timeTrackOffsets.border,
            appState.timelineMaxValue);

    // main param
    const scaleRef = useRef<HTMLInputElement | null>(null);
    const scaleTrackRef = useRef<HTMLDivElement | null>(null);
    const [maxScale] = useState(30);
    const [scaleTrackOffsets] = useState({ padding: 15, border: 2 });
    const [scaleCapSize] = useState({ width: 51, height: 50 });
    const [scaleTrackSize] = useState({ width: 430, height: 50 });
    const [scaleCursor, setScaleCursor] = useState({ x: 0, y: 0 });
    function initDisplayScaleValue(): string {
        const scaleInit = scale.math.get(appState.activeElement?.key ?? "")?.scale;
        if (scaleInit) {
            return scaleInit >= 1 ? scaleInit.toFixed(2) : scaleInit.toFixed(3);
        }
        else {
            return '1.00'
        }
    }
    const [scaleInputValue, setScaleInputValue] = useState<string>(initDisplayScaleValue);
    const { getComplexTrackValue: getScaleValue, getComplexTrackCursor: getScaleCursor } =
        useComplexTrackpadState(
            scaleCapSize.width - scaleTrackOffsets.border,
            maxScale);

    // auto save dependencies
    const scaleDebouncerRef = useRef<[LaurusScaleResult, number] | undefined>(undefined);
    const timeDebouncerRef = useRef<[LaurusScaleResult, number] | undefined>(undefined);
    const [debounceInput, setDebounceInput] = useState<Map<string, LaurusScaleEquation>>(scale.math);
    const mathDebouncer = useDebounce(debounceInput, 1000);

    const saveNewEquation = useCallback((newEquation: LaurusScaleEquation) => {
        const newMath: Map<string, LaurusScaleEquation> = new Map(scale.math);
        newMath.set(newEquation.input_id, newEquation);

        const newScale: LaurusScaleResult = { ...scale, math: newMath };
        dispatch({
            type: WorkspaceActionType.SetEffect,
            value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id },
        });
        updateScale(appState.apiOrigin, scale.scale_id, { ...newScale });
    }, [appState.apiOrigin, dispatch, scale]);

    if (prevActiveElementId != (appState.activeElement?.key ?? "")) {
        setPrevActiveElementId((appState.activeElement?.key ?? ""));
        setScaleInputValue(initDisplayScaleValue);
    }

    useLayoutEffect(() => {
        /*  reads the current track widths and updates sliders 
            using initial values from a parent component */

        (async () => {
            const activeEquation = scale.math.get(appState.activeElement?.key ?? "");
            let scaleInit = 1;
            let timeInit = appState.timelineMaxValue
            if (activeEquation) {
                timeInit = activeEquation.time / 1000;
                scaleInit = activeEquation.scale;
            }

            if (scaleTrackRef.current) {
                const newScaleCursor = getScaleCursor(scaleInit, scaleTrackRef.current.clientWidth);
                setScaleCursor({ x: newScaleCursor, y: 0 });
            }

            if (timeTrackRef.current) {
                const newTimeCursor = getTimeCursor(timeInit, (timeTrackRef.current.clientHeight));
                setTimeCursor({ y: newTimeCursor, x: 0 });
            }
        })();
    }, [appState.activeElement?.key, appState.timelineMaxValue, getScaleCursor, getTimeCursor, scale.math]);

    useEffect(() => {
        /* on a delay, pushes data from input boxes to the server */

        const newMath = new Map(mathDebouncer);
        if (scaleDebouncerRef.current) {
            if (scaleRef.current && scaleTrackRef.current) {
                const newScaleCursor = getTimeCursor(scaleDebouncerRef.current[1], scaleTrackRef.current.clientHeight);
                setScaleCursor({ x: newScaleCursor, y: 0 });
            }

            const newScale: LaurusScaleResult = { ...scaleDebouncerRef.current[0], math: newMath };
            dispatch({ type: WorkspaceActionType.SetEffect, value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id } });
            updateScale(appState.apiOrigin, newScale.scale_id, newScale);
            scaleDebouncerRef.current = undefined;
        }

        if (timeDebouncerRef.current) {
            if (timeRef.current && timeTrackRef.current) {
                const newTimeCursor = getTimeCursor(timeDebouncerRef.current[1], timeTrackRef.current.clientHeight);
                setTimeCursor({ x: 0, y: newTimeCursor });
            }

            const newScale: LaurusScaleResult = { ...timeDebouncerRef.current[0], math: newMath };
            dispatch({ type: WorkspaceActionType.SetEffect, value: { type: 'scale', value: { ...newScale }, key: newScale.scale_id } });
            updateScale(appState.apiOrigin, newScale.scale_id, newScale);
            timeDebouncerRef.current = undefined;
        }
    }, [appState.apiOrigin, dispatch, getTimeCursor, mathDebouncer]);
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
                    {'Scale'}
                </div>
                <ReactSvg
                    svg={circle()}
                    containerSize={{
                        width: 24,
                        height: 24
                    }}
                    scale={1} />
                <div
                    style={{ display: 'grid', placeContent: 'start', width: 'min-content', height: '100%', marginLeft: 'auto' }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
                    onClick={() => { setMainControls(v => !v); }}
                >
                    <ReactSvg
                        svg={circle()}
                        containerSize={{
                            width: 12,
                            height: 12
                        }}
                        scale={1} />
                </div>
            </div>

            {mainControls ?
                <>
                    {/* display */}
                    <div style={{ padding: '0 20px 20px 20px' }}>
                        <div
                            className={styles["tiled-background-squares"]}
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
                                        })() : (<div>{'n/a'}</div>)}
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
                                borderRadius: 0,
                                padding: 0
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'min-content 3fr min-content', }}>
                                    <div style={{
                                        height: 'min-content',
                                        display: 'flex',
                                        padding: `${timeTrackOffsets.padding}px 15px`,
                                        gap: 20,
                                        borderRight: 'solid rgba(0, 0, 0, 1) 1px',
                                    }}>
                                        <VerticalSlider
                                            label={"speed"}
                                            hash={`${scale.scale_id}|p1`}
                                            capSize={timeCapSize}
                                            trackSize={timeTrackSize}
                                            trackRef={timeTrackRef}
                                            cursor={timeCursor}
                                            onNewCursor={(newCursor) => {
                                                setTimeCursor({ ...newCursor, x: 0 });

                                                if (!timeTrackRef.current) return;
                                                const newTime = getTimeValue(newCursor.y, timeTrackRef.current.clientHeight);

                                                if (appState.activeElement) {
                                                    const activeEquation = scale.math.get(appState.activeElement!.key);
                                                    const newServerTime = newTime * 1000;
                                                    const newEquation = activeEquation ?
                                                        { ...activeEquation, time: newServerTime } :
                                                        {
                                                            input_id: appState.activeElement.key,
                                                            time: newServerTime,
                                                            scale: 1,
                                                            loop: false,
                                                            solution: []
                                                        };
                                                    saveNewEquation(newEquation);
                                                }
                                            }} />
                                    </div>
                                    <div
                                        style={{
                                            padding: 0,
                                            display: 'grid',
                                            placeContent: 'center',
                                        }}>
                                        <div style={{ display: 'flex' }}>
                                            <input
                                                className={dellaRespira.className}
                                                id={`scale-input-${scale.scale_id}`}
                                                ref={scaleRef}
                                                type="text"
                                                placeholder="0.00"
                                                value={scaleInputValue}
                                                onChange={() => {
                                                    if (!scaleRef.current || !scaleTrackRef.current) return;
                                                    const newScaleValue: number = parseFloat(scaleRef.current.value) || 0;
                                                    setScaleInputValue(newScaleValue >= 1 ?
                                                        (newScaleValue).toFixed(2) :
                                                        (newScaleValue).toFixed(3));

                                                    if (newScaleValue > maxScale || newScaleValue < 0) {
                                                        return;
                                                    }

                                                    const activeEq = scale.math.get(appState.activeElement?.key ?? "");
                                                    if (activeEq) {
                                                        const newEquation = { ...activeEq, scale: newScaleValue };
                                                        const newMath: Map<string, LaurusScaleEquation> = new Map(scale.math);
                                                        newMath.set(newEquation.input_id, newEquation);
                                                        setDebounceInput(newMath);
                                                        timeDebouncerRef.current = [{ ...scale }, newScaleValue];
                                                    }
                                                    else {
                                                        const newScaleCursor = getScaleCursor(newScaleValue, scaleTrackRef.current.clientWidth);
                                                        setScaleCursor({ x: newScaleCursor, y: 0 });
                                                    }
                                                }}
                                                style={{
                                                    textAlign: "center",
                                                    background: 'none',
                                                    color: "rgba(255, 255, 255, 0.7)",
                                                    borderRadius: "2px",
                                                    padding: '0px 0px',
                                                    border: 'none',
                                                    outline: 'none',
                                                    lineHeight: '1',
                                                    display: 'inline-block',
                                                    overflowX: 'scroll',
                                                    letterSpacing: '5px',
                                                    fontSize: 28,
                                                    height: '30px',
                                                    textShadow: '2px 2px 3px rgba(0, 0, 0, 1)',
                                                }} />
                                        </div>
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
                                                    const activeEquation = scale.math.get(appState.activeElement!.key);
                                                    const newEquation = activeEquation ?
                                                        { ...activeEquation, loop: !activeEquation.loop } :
                                                        {
                                                            input_id: appState.activeElement.key,
                                                            time: appState.timelineMaxValue * 1000,
                                                            scale: 1,
                                                            loop: true,
                                                            solution: []
                                                        };
                                                    saveNewEquation(newEquation);
                                                }
                                            }}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                display: 'grid', placeContent: 'center',
                                                border: '1px solid rgb(0, 0, 0)',
                                                background: scale.math.get(appState.activeElement?.key ?? "")?.loop ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                            }}>
                                            <ReactSvg
                                                svg={autorenew()}
                                                containerSize={{
                                                    width: 20,
                                                    height: 20
                                                }}
                                                scale={1} />
                                        </div>
                                        <div
                                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
                                            onClick={() => {
                                                if (!appState.activeElement) return;
                                                switch (appState.activeElement.value.type) {
                                                    case "svg": {
                                                        const svgRef = svgElementsRef.current?.get(appState.activeElement.key);
                                                        if (!svgRef) return;
                                                        svgRef.getAnimations().forEach((a) => a.cancel());
                                                        break;
                                                    }
                                                    case "img": {
                                                        const imgRef = imgElementsRef.current?.get(appState.activeElement.key);
                                                        if (!imgRef) return;
                                                        imgRef.getAnimations().forEach((a) => a.cancel());
                                                        break;
                                                    }
                                                }
                                            }}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                display: 'grid', placeContent: 'center',
                                                border: '1px solid rgb(0, 0, 0)',
                                            }}>
                                            <ReactSvg
                                                svg={fastRewind()}
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
                                                if (!appState.activeElement) return;
                                                const response: LaurusScaleResult | undefined =
                                                    await getScale(appState.apiOrigin, scale.scale_id, appState.activeElement.key);
                                                if (response) {
                                                    const keyframes: Keyframe[] = response.math
                                                        .get(appState.activeElement.key)?.solution
                                                        .map(s => { return { "scale": s } }) ?? [];
                                                    const options: KeyframeAnimationOptions = {
                                                        duration: response.duration * 1000,
                                                        iterations: 1,
                                                    };
                                                    switch (appState.activeElement.value.type) {
                                                        case "svg": {
                                                            const svgRef = svgElementsRef.current?.get(appState.activeElement.key);
                                                            if (!svgRef) return;
                                                            svgRef.getAnimations().forEach((a) => a.cancel());
                                                            const keyframeEffect =
                                                                new KeyframeEffect(svgRef, keyframes, options);
                                                            const animation = new Animation(keyframeEffect, document.timeline);
                                                            animation.play();
                                                            break;
                                                        }
                                                        case "img": {
                                                            const imgRef = imgElementsRef.current?.get(appState.activeElement.key);
                                                            if (!imgRef) return;
                                                            imgRef.getAnimations().forEach((a) => a.cancel());
                                                            const keyframeEffect =
                                                                new KeyframeEffect(imgRef, keyframes, options);
                                                            const animation = new Animation(keyframeEffect, document.timeline);
                                                            animation.play();
                                                            break;
                                                        }
                                                    }
                                                }
                                            }}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                display: 'grid', placeContent: 'center',
                                                border: '1px solid rgb(0, 0, 0)',
                                            }}>
                                            <ReactSvg
                                                svg={playCircle()}
                                                containerSize={{
                                                    width: 20,
                                                    height: 20
                                                }}
                                                scale={1} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: `0 20px 20px 20px` }}>
                            <div style={{
                                width: 'min-content',
                                padding: `20px ${scaleTrackOffsets.padding}px`,
                                display: 'flex',
                                alignItems: 'start',
                                border: 'solid rgba(0, 0, 0, 1) 1px',
                                backgroundColor: "rgb(20, 20, 20)",
                                borderRadius: 0,
                            }}>
                                <HorizontalSlider
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|p2`}
                                    capSize={scaleCapSize}
                                    trackSize={scaleTrackSize}
                                    trackRef={scaleTrackRef}
                                    cursor={scaleCursor}
                                    onCursorMove={(newCursor) => {
                                        if (!scaleTrackRef.current || !scaleRef.current) return;
                                        const newScaleValue = getScaleValue(newCursor.x, scaleTrackRef.current.clientWidth);
                                        scaleRef.current.value = newScaleValue >= 1 ?
                                            (newScaleValue).toFixed(2) :
                                            (newScaleValue).toFixed(3);

                                    }}
                                    onNewCursor={(newCursor) => {
                                        setScaleCursor({ ...newCursor, y: 0 });

                                        if (!scaleTrackRef.current) return;
                                        const newScaleValue = getScaleValue(newCursor.x, scaleTrackRef.current.clientWidth);

                                        setScaleInputValue(newScaleValue >= 1 ?
                                            (newScaleValue).toFixed(2) :
                                            (newScaleValue).toFixed(3));

                                        if (appState.activeElement) {
                                            const activeEquation = scale.math.get(appState.activeElement!.key);
                                            const newEquation = activeEquation ?
                                                { ...activeEquation, scale: newScaleValue } :
                                                {
                                                    input_id: appState.activeElement.key,
                                                    time: appState.timelineMaxValue * 1000,
                                                    scale: newScaleValue,
                                                    loop: false,
                                                    solution: []
                                                };
                                            saveNewEquation(newEquation);
                                        }
                                    }} />
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
                                        await deleteScale(appState.apiOrigin, scale.scale_id);
                                        dispatch({
                                            type: WorkspaceActionType.SetEffects,
                                            value: appState.effects.filter(e => {
                                                switch (e.type) {
                                                    case "scale": {
                                                        return e.value.scale_id != scale.scale_id;
                                                    }
                                                    case "move": {
                                                        return true;
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

interface ScaleUnitSliderProps {
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
}: ScaleUnitSliderProps) {
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

function HorizontalSlider({
    label,
    hash,
    capSize,
    trackSize,
    trackRef,
    cursor,
    onNewCursor,
    onCursorMove
}: ScaleUnitSliderProps) {
    return (<>
        <div
            className={dellaRespira.className}
            style={{ width: 'min-content', height: '100%', }}>
            <div style={{
                position: "relative",
                ...trackSize,
                alignContent: 'center',
            }}>
                <div style={{ position: 'absolute', width: '100%', alignSelf: 'center', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
                        width={'100%'}
                        height={capSize.height}
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
                    style={{
                        zIndex: 1,
                        top: 0,
                        width: trackSize.width,
                        height: 8,
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{
                        height: 12,
                        width: '50%',
                        background: "linear-gradient(45deg, rgb(11, 11, 11), rgb(18, 18, 18))",
                        border: '1px solid rgb(27, 27, 27)',
                    }} />
                    <div style={{
                        height: 12,
                        width: '50%',
                        background: "linear-gradient(45deg, rgb(18, 18, 18), rgb(25, 25, 25))",
                        border: '1px solid rgb(27, 27, 27)',
                    }} />
                </div>
                <div
                    ref={trackRef}
                    onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        onNewCursor({ x, y });
                    }}
                    style={{
                        zIndex: 0,
                        cursor: 'crosshair',
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        ...trackSize,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(27, 27, 27)',
                        borderBottomLeftRadius: 2,
                        borderBottomRightRadius: 2,
                        boxShadow: "rgba(0, 0, 0, 0.7) -10px -10px 40px inset",
                    }}
                >
                    <div style={{
                        padding: '0px 10px',
                        display: 'flex',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <ReactSvg
                            svg={remove('rgb(227, 227, 227)')}
                            containerSize={{
                                width: 20,
                                height: 20
                            }} scale={1} />

                        <ReactSvg
                            svg={add2('rgb(227, 227, 227)')}
                            containerSize={{
                                width: 20,
                                height: 20
                            }} scale={0.75} />

                    </div>
                </div>

            </div>
            <div

                style={{
                    alignSelf: "start", justifySelf: "center",
                    fontSize: "10px", paddingTop: '10px'
                }}>{label}</div>
        </div>
    </>)
}