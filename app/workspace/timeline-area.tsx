import { CSSProperties, RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import { ReactSvg } from "./media";
import { addCircle, circle, moreVert, playArrow, skipNext, skipPrevious } from "../svg-repo";
import {
    LaurusEffect,
    LaurusProjectResult,
    LaurusScale,
    convertTime,
    WorkspaceActionType, WorkspaceContext,
    LaurusMove,
    LaurusLayer
} from "./workspace.client";
import { createMove, createProject, createScale, getFrames, updateProject } from "./workspace.server";
import { v4 } from "uuid";
import useDebounce from "../hooks/useDebounce";
import EffectUnit from "./effect-unit";

interface TimelineArea {
    size: { width: number, height: number },
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    onRightPanelClick: () => void,
}
export default function TimelineArea({
    size,
    svgElementsRef,
    imgElementsRef,
    onRightPanelClick
}: TimelineArea) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [rulerSize] = useState(20);
    const [fastRate] = useState(25);
    const [playEnabled, setPlayEnabled] = useState(true);
    const [skipPreviousEnabled, setSkipPreviousEnabled] = useState<boolean>(true);
    const [skipNextEnabled, setSkipNextEnabled] = useState<boolean>(true);

    const getWideRulerParams = useCallback(() => {
        switch (appState.timelineMaxValue) {
            case 30: {
                return { modulo: 10, factor: 0.5 };
            }
            case 60: {
                return { modulo: 10, factor: 1 };
            }
            case 90: {
                return { modulo: 10, factor: 1.5 };
            }
            default: {
                return { modulo: 10, factor: 1 };
            }
        }

    }, [appState.timelineMaxValue]);

    const getNewAnimations = useCallback(async (fill: FillMode, firstFrame: boolean) => {
        const newAnimations: Animation[] = [];
        const globalLimit: number = Math.max(...appState.effects
            .map(e => e.value.end));
        const options: KeyframeAnimationOptions = {
            duration: firstFrame ? 2 / appState.fps : globalLimit * 1000,
            iterations: 1,
            fill,
        };

        const imgArray = Array.from(appState.project.imgs.entries().filter(e => !e[1].pending));
        for (let i = 0; i < imgArray.length; i++) {
            const [key] = imgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, appState.fps);
            if (frames) {
                const framesToMap = firstFrame ? [frames[0]] : frames;
                const keyframes: Keyframe[] = framesToMap.map((f, i) => {
                    return i < frames.length - 1 ?
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s, easing: 'step-end' } :
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s }
                });
                const imgRef = imgElementsRef.current?.get(key);
                if (!imgRef) return [];
                const animations = imgRef.getAnimations();
                for (let j = 0; j < animations.length; j++) {
                    animations[j].cancel();
                }
                const keyframeEffect =
                    new KeyframeEffect(imgRef, keyframes, options);
                newAnimations.push(new Animation(keyframeEffect, document.timeline));
            }
        };

        const svgArray = Array.from(appState.project.svgs.entries().filter(e => !e[1].pending));
        for (let i = 0; i < svgArray.length; i++) {
            const [key] = svgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, appState.fps);
            if (frames) {
                const framesToMap = firstFrame ? [frames[0]] : frames;
                const keyframes: Keyframe[] = framesToMap.map((f, i) => {
                    return i < frames.length - 1 ?
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s, easing: 'step-end' } :
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s }
                });
                const svgRef = svgElementsRef.current?.get(key);
                if (!svgRef) return [];
                const animations = svgRef.getAnimations();
                for (let j = 0; j < animations.length; j++) {
                    animations[j].cancel();
                }
                const keyframeEffect =
                    new KeyframeEffect(svgRef, keyframes, options);
                newAnimations.push(new Animation(keyframeEffect, document.timeline));
            }
        };

        return newAnimations;
    }, [appState.apiOrigin, appState.effects, appState.project.imgs, appState.project.project_id, appState.project.svgs, appState.fps, imgElementsRef, svgElementsRef]);

    const enableAllControls = useCallback(() => {
        setPlayEnabled(true);
        setSkipPreviousEnabled(true);
        setSkipNextEnabled(true);
    }, []);

    return (<>
        <div
            style={{
                width: "100%",
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gridTemplateRows: `min-content 1fr min-content`,
            }}>
            {/* wide ruler (time) */}
            <div
                className={dellaRespira.className}
                style={{
                    gridRow: '1', gridColumn: 'span 2',
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    borderBottom: '1px solid rgba(255,255,255,0.15)',
                    borderRight: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    height: rulerSize,
                }} >
                <div
                    onDoubleClick={() => {
                        dispatch({ type: WorkspaceActionType.IncrementTimelineMaxValue });
                    }}
                    style={{
                        padding: '0px 10px 0px 22px',
                        fontSize: 10,
                        display: 'flex',
                        width: '100%',
                        justifyContent: 'space-between',
                        background: 'rgba(46,46,46,1)',
                    }}>
                    {[...Array(61)].map((_, i) => {
                        const params = getWideRulerParams();
                        return <div key={i}>
                            {i % params.modulo == 0 ?
                                <div
                                    style={{
                                        paddingLeft: 2,
                                        width: 10,
                                        height: '75%',
                                        borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                    }} >
                                    {`${i * params.factor}`}
                                </div> :
                                <div
                                    style={{
                                        height: '50%',
                                        width: 10,
                                        borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                    }}
                                />
                            }
                        </div>
                    })}
                </div>
                <div
                    className={dellaRespira.className}
                    onDoubleClick={() => {
                        const currentUnit = appState.timelineUnit;
                        const currentUnits = [...appState.timelineUnits];
                        const currentIndex = currentUnits.findIndex(v => v == currentUnit);
                        const newUnit: string = (currentIndex >= 0) && (currentIndex + 1 < currentUnits.length)
                            ? currentUnits[currentIndex + 1]
                            : currentUnits[0];
                        dispatch({ type: WorkspaceActionType.SetTimelineUnit, value: newUnit });
                        const newEffects: LaurusEffect[] = appState.effects.map(e => {
                            switch (e.type) {
                                case "scale": {
                                    const clientEffect: LaurusEffect = {
                                        ...e,
                                        value: {
                                            ...e.value,
                                            start: convertTime(e.value.start, currentUnit, newUnit),
                                            end: convertTime(e.value.end, currentUnit, newUnit)
                                        }
                                    }
                                    return clientEffect;
                                }
                                case "move": {
                                    const clientEffect: LaurusEffect = {
                                        ...e,
                                        value: {
                                            ...e.value,
                                            start: convertTime(e.value.start, currentUnit, newUnit),
                                            end: convertTime(e.value.end, currentUnit, newUnit)
                                        }
                                    }
                                    return clientEffect;
                                }
                            }
                        });
                        dispatch({ type: WorkspaceActionType.SetEffects, value: newEffects });
                    }}
                    style={{
                        fontSize: 12,
                        textAlign: 'center',
                        position: 'relative',
                        width: 38,
                        backgroundColor: 'rgb(33, 33, 33)',
                        color: 'rgb(255, 255, 255)',
                    }} >
                    {(() => {
                        return (<>
                            <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
                                {appState.timelineUnit}
                            </div>
                            <div style={{ position: 'absolute', width: '100%', height: '100%' }} />
                        </>);
                    })()}
                </div>
            </div>
            {/* content area */}
            <div
                className={styles["grainy-background"] + " " + dellaRespira.className}
                style={{
                    overflowY: 'auto',
                    gridRow: '2',
                    gridColumn: '1',
                    width: size.width,
                    display: 'grid',
                    alignContent: 'space-between',
                }}>
                <TimelineAreaContent
                    maxWidth={size.width}
                    svgElementsRef={svgElementsRef}
                    imgElementsRef={imgElementsRef} />
            </div>
            <div
                className={dellaRespira.className}
                style={{
                    border: '1px solid rgb(24, 24, 24)',
                    background: 'rgba(20, 20, 20, 1)',
                    width: 20,
                    display: 'grid',
                    placeContent: 'center',
                }}>
                <ReactSvg
                    svg={moreVert('rgba(255, 255, 255, 0.5)')}
                    containerSize={{
                        width: 20,
                        height: 38
                    }}
                    scale={1}
                    onContainerClick={onRightPanelClick} />
            </div>
            {/* control area */}
            <div
                className={styles["grainy-background"] + " " + dellaRespira.className}
                style={{
                    gridRow: '3',
                    gridColumn: 'span 2',
                    display: 'grid',
                    alignContent: 'space-between',
                }}>
                <div
                    style={{
                        borderTop: '1px solid rgb(0, 0, 0)',
                        borderLeft: '1px solid rgb(0, 0, 0)',
                        borderRight: '1px solid rgb(0, 0, 0)',
                        borderTopRightRadius: 10,
                        borderTopLeftRadius: 10,
                        backgroundColor: "rgba(30, 30, 30, 0.6)",
                        paddingTop: 10,
                        paddingLeft: 6,
                        paddingRight: 6,
                        paddingBottom: 10,
                        display: 'grid',
                        width: '100%',
                    }}>
                    <div style={{
                        display: 'flex',
                        position: 'relative',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <div style={{
                            left: 6,
                            display: 'flex',
                            position: 'absolute'
                        }}>
                            <input
                                className={dellaRespira.className}
                                id={`fps-input`}
                                type="text"
                                placeholder="60"
                                value={appState.fps}
                                onChange={(e) => {
                                    const newFps: number = parseFloat(e.currentTarget.value) || 60;
                                    dispatch({ type: WorkspaceActionType.SetFps, value: newFps });
                                }}
                                style={{
                                    textAlign: "center",
                                    background: 'none',
                                    color: "rgb(227, 227, 227)",
                                    borderRadius: "2px",
                                    border: 'none',
                                    outline: 'none',
                                    width: 20,
                                    lineHeight: '1',
                                    display: 'inline-block',
                                    overflowX: 'scroll',
                                    fontSize: 16,
                                }}
                            />
                            <div
                                style={{
                                    fontSize: 15,
                                    color: "rgba(255, 255, 255, 0.5)",
                                }}>
                                {<i>{'fps'}</i>}
                            </div>
                        </div>
                        <ReactSvg
                            svg={skipPreviousEnabled ? skipPrevious() : skipPrevious('rgba(255, 255, 255, 0.2)')}
                            containerSize={{
                                width: 20,
                                height: 20
                            }}
                            scale={1}
                            onContainerClick={async () => {
                                if (!skipPreviousEnabled) return;
                                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'viewport' } });
                                const newAnimations = await getNewAnimations('forwards', true);
                                if (newAnimations) {
                                    Promise.all(newAnimations.map(animation => animation.finished))
                                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                        .then((_animations: Animation[]) => {
                                            enableAllControls();
                                            dispatch({ type: WorkspaceActionType.SetRecordingLight, value: false });
                                        })
                                        .catch(err => {
                                            if (err instanceof Error && err.name !== 'AbortError') {
                                                console.log('unknown error from waapi:', err);
                                            }
                                        });
                                    setSkipPreviousEnabled(false);
                                    newAnimations.forEach(a => {
                                        a.updatePlaybackRate(fastRate);
                                        a.play()
                                    });
                                }
                            }} />
                        <ReactSvg
                            svg={playEnabled ? playArrow() : playArrow('rgba(255, 255, 255, 0.2)')}
                            containerSize={{
                                width: 50,
                                height: 50
                            }}
                            scale={1}
                            onContainerClick={async () => {
                                if (!playEnabled) return;
                                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'viewport' } });
                                const newAnimations = await getNewAnimations('none', false);
                                Promise.all(newAnimations.map(animation => animation.finished))
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                    .then((_animations: Animation[]) => {
                                        enableAllControls();
                                        dispatch({ type: WorkspaceActionType.SetRecordingLight, value: false });
                                        dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                                    })
                                    .catch(err => {
                                        if (err instanceof Error && err.name !== 'AbortError') {
                                            console.log('unknown error from waapi:', err);
                                        }
                                    });
                                setPlayEnabled(false);
                                newAnimations.forEach(a => a.play());
                                dispatch({ type: WorkspaceActionType.SetRecordingLight, value: true });
                            }} />
                        <ReactSvg
                            svg={skipNextEnabled ? skipNext() : skipNext('rgba(255, 255, 255, 0.2)')}
                            containerSize={{
                                width: 20,
                                height: 20
                            }}
                            scale={1}
                            onContainerClick={async () => {
                                if (!skipNextEnabled) return;
                                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'viewport' } });
                                const newAnimations = await getNewAnimations('forwards', false);
                                Promise.all(newAnimations.map(animation => animation.finished))
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                    .then((_animations: Animation[]) => {
                                        enableAllControls();
                                        dispatch({ type: WorkspaceActionType.SetRecordingLight, value: false });
                                    })
                                    .catch(err => {
                                        if (err instanceof Error && err.name !== 'AbortError') {
                                            console.log('unknown error from waapi:', err);
                                        }
                                    });
                                setSkipNextEnabled(false);
                                newAnimations.forEach(a => {
                                    a.updatePlaybackRate(fastRate);
                                    a.play();
                                });
                            }} />
                        <div style={{
                            right: 6,
                            display: 'flex',
                            position: 'absolute'
                        }}>
                            <div
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    border: appState.recordingLight ? '1px solid rgb(239, 239, 239)' : '1px solid rgba(255, 255, 255, 0.03)',
                                    background: appState.recordingLight ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'rgba(255, 255, 255, 0.03)',
                                    boxShadow: appState.recordingLight ? 'rgba(255, 255, 255, 1) 0px 0px 100px 10px' : 'none'
                                }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>)
}

interface TimelineAreaContent {
    maxWidth: number,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}
function TimelineAreaContent({ maxWidth, svgElementsRef, imgElementsRef }: TimelineAreaContent) {
    const { appState } = useContext(WorkspaceContext);
    const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);
    const layerNameRef = useRef<HTMLInputElement | null>(null);
    const layerHeaderStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: 32,
        borderTop: '1px solid rgb(0, 0, 0)',
        borderLeft: '1px solid rgb(0, 0, 0)',
        borderRight: '1px solid rgb(0, 0, 0)',
        borderBottom: '1px solid rgb(18, 18, 18)',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        background: 'rgba(30,30,30,1)',
        padding: 6,
    };
    const layerBodyStyle: CSSProperties = {
        display: 'grid',
        alignContent: 'start',
        minHeight: 46,
        borderLeft: '1px solid black',
        borderRight: '1px solid black',
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
    };

    return (<>
        {appState.project.layers.size == 0 && (
            <div
                style={{
                    maxWidth,
                    display: 'grid',
                    width: '100%',
                    gridTemplateRows: 'min-content auto',
                }}>
                {/* layer header */}
                <div style={layerHeaderStyle}>
                    <LayerTitle
                        layerId={""}
                        layerNameInit={"untitled"}
                        layerNameRef={layerNameRef} />
                    <div
                        className={dellaRespira.className}
                        style={{
                            display: 'grid',
                        }}>
                        {/* layer options placeholder */}
                        <ReactSvg
                            svg={circle('rgba(204, 204, 204, 0)')}
                            containerSize={{
                                width: 12,
                                height: 12
                            }}
                            scale={1} />
                    </div>
                </div>
                <div style={layerBodyStyle}>
                    <div
                        style={{
                            width: '100%',
                            height: 46,
                            padding: 10,
                            borderBottom: showEffectsBrowser ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid black',
                            background: 'rgb(20, 20, 20)',
                            borderBottomLeftRadius: showEffectsBrowser ? 0 : 10,
                            borderBottomRightRadius: showEffectsBrowser ? 0 : 10,
                        }}>
                        <ReactSvg
                            svg={showEffectsBrowser ?
                                addCircle('rgba(204, 204, 204, 0.2)') :
                                addCircle('rgba(204, 204, 204, 0.8)')}
                            containerSize={{
                                width: 20,
                                height: 20
                            }}
                            scale={1}
                            onContainerClick={() => setShowEffectsBrowser(v => !v)} />
                    </div>
                    {showEffectsBrowser && (
                        <EffectsBrowser
                            onAddClick={() => setShowEffectsBrowser(false)}
                            layer_id={""} layerNameRef={layerNameRef} />
                    )}
                </div>
            </div>)}
        {Array.from(appState.project.layers.entries()).map((layerEntry) => {
            return (
                <div
                    key={layerEntry[0]}
                    style={{
                        maxWidth,
                        display: 'grid',
                        width: '100%',
                        gridTemplateRows: 'min-content auto',
                    }}>
                    {/* layer header */}
                    <div style={layerHeaderStyle}>
                        <LayerTitle
                            layerId={layerEntry[0]}
                            layerNameInit={layerEntry[1].name}
                            layerNameRef={layerNameRef} />
                        <div
                            className={dellaRespira.className}
                            style={{
                                display: 'grid',
                            }}>
                            {/* layer options placeholder */}
                            <ReactSvg
                                svg={circle('rgba(204, 204, 204, 0)')}
                                containerSize={{
                                    width: 12,
                                    height: 12
                                }}
                                scale={1} />
                        </div>
                    </div>
                    {/* effects */}
                    <div style={layerBodyStyle}>
                        {appState.effects.sort((a, b) => a.value.order - b.value.order).map((s, i) => {
                            return <div
                                style={{
                                    borderBottom: 'solid rgba(0, 0, 0, 1) 1px',
                                    padding: "0px 6px",
                                    background: 'rgba(23, 23, 23, 0.5)'
                                }}
                                key={i}>
                                <EffectUnit
                                    effect={s}
                                    svgElementsRef={svgElementsRef}
                                    imgElementsRef={imgElementsRef} />
                            </div>
                        })}
                        <div
                            style={{
                                width: '100%',
                                height: 46,
                                padding: 10,
                                borderBottom: showEffectsBrowser ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid black',
                                background: 'rgb(20, 20, 20)',
                                borderBottomLeftRadius: showEffectsBrowser ? 0 : 10,
                                borderBottomRightRadius: showEffectsBrowser ? 0 : 10,
                            }}>
                            <ReactSvg
                                svg={showEffectsBrowser ?
                                    addCircle('rgba(204, 204, 204, 0.2)') :
                                    addCircle('rgba(204, 204, 204, 0.8)')}
                                containerSize={{
                                    width: 20,
                                    height: 20
                                }}
                                scale={1}
                                onContainerClick={() => setShowEffectsBrowser(v => !v)} />
                        </div>
                        {showEffectsBrowser && (
                            <EffectsBrowser
                                onAddClick={() => setShowEffectsBrowser(false)}
                                layer_id={layerEntry[0]} layerNameRef={layerNameRef} />
                        )}
                    </div>
                </div>)
        })}
    </>)
}

interface LayerTitle {
    layerId: string,
    layerNameInit: string,
    layerNameRef: RefObject<HTMLInputElement | null>,
}
function LayerTitle({ layerId, layerNameRef, layerNameInit }: LayerTitle) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [layerName, setLayerName] = useState<string>(layerNameInit);
    const layerNameHook = useDebounce<string>(layerName, 1000);
    const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
    const layerIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        const renameProjectOnSever = (async () => {
            if (!projectRef.current) return;

            const newLayers = new Map(projectRef.current.layers);
            if (layerIdRef && layerIdRef.current && newLayers.has(layerIdRef.current)) {
                const newLayer = newLayers.get(layerIdRef.current)!;
                newLayer.name = layerNameHook;
            }
            else {
                const newLayerId = v4();
                newLayers.set(newLayerId, { name: layerNameHook, order: 0 });
            }

            if (layerIdRef.current && projectRef.current.project_id && layerNameHook) {
                const response = await updateProject(
                    appState.apiOrigin,
                    projectRef.current.project_id,
                    { ...projectRef.current, layers: newLayers });
                if (response) {
                    const newProject: LaurusProjectResult = { ...response }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                }
            }
            else if (layerIdRef.current && layerNameHook) {
                const newProject = { ...projectRef.current, layers: newLayers };
                const response = await createProject(
                    appState.apiOrigin,
                    newProject);
                if (response) {
                    const newProject2: LaurusProjectResult = { ...newProject, project_id: response.project_id }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                }
            }
        });
        renameProjectOnSever();
    }, [appState.apiOrigin, layerNameHook, dispatch]);

    const onLayerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {

        const newLayers = new Map(appState.project.layers);
        if (layerId && newLayers.has(layerId)) {
            layerIdRef.current = layerId;
            const newLayer = newLayers.get(layerId)!;
            newLayer.name = e.target.value;
        }
        else {
            const newLayerId = v4();
            layerIdRef.current = newLayerId;
            newLayers.set(newLayerId, { name: e.target.value, order: 0 });
        }

        projectRef.current = { ...appState.project, layers: newLayers };
        setLayerName(e.target.value);
    };

    return (<>
        <div
            style={{
                width: '100%',
                display: 'grid',
                alignContent: 'center',
                justifyContent: 'start',
                height: '100%',
            }}>
            <input
                id={`layer-name-input-${layerId}`}
                ref={layerNameRef}
                className={dellaRespira.className}
                placeholder="name me..."
                style={{
                    letterSpacing: '3px',
                    background: 'none',
                    color: "rgb(227, 227, 227)",
                    fontSize: 10,
                    border: 'none',
                    outline: 'none',
                }}
                type="text"
                value={layerName}
                onChange={onLayerNameChange}
            />
        </div>
    </>)
}

interface EffectsBrowser {
    layer_id: string,
    layerNameRef: RefObject<HTMLInputElement | null>,
    onAddClick: () => void,
}
function EffectsBrowser({ layer_id, layerNameRef, onAddClick }: EffectsBrowser) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    return (<>
        <div
            style={{
                width: '100%',
                borderBottom: '1px solid black',
                height: 96,
                overflowY: 'auto',
                borderBottomLeftRadius: 10,
            }}>
            {appState.effectNames.map((effectName, i) => {
                return (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 14,
                            letterSpacing: "3px",
                            height: 36,
                            borderRadius: 4,
                            padding: 10,
                            background: i % 2 == 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)'
                        }}
                        key={effectName}>
                        <div>
                            {effectName}
                        </div>
                        <ReactSvg
                            svg={addCircle('rgba(204, 204, 204, 0.8')}
                            containerSize={{
                                width: 20,
                                height: 20
                            }}
                            scale={1}
                            onContainerClick={async () => {
                                const newLayers: Map<string, LaurusLayer> = new Map(appState.project.layers);
                                if (!layer_id) {
                                    const newLayerId = v4();
                                    const newLayerName = layerNameRef.current?.value ?? "untitled";
                                    newLayers.set(newLayerId, { name: newLayerName, order: 0 });
                                }
                                let newProjectId = "";
                                if (!appState.project.project_id) {
                                    const newProject: LaurusProjectResult = { ...appState.project, layers: newLayers }
                                    const response = await createProject(appState.apiOrigin, { ...newProject });
                                    if (response) {
                                        newProjectId = response.project_id;
                                        const newProject2: LaurusProjectResult = { ...newProject, project_id: newProjectId }
                                        dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                                    }
                                }
                                else {
                                    const newProject: LaurusProjectResult = { ...appState.project, layers: newLayers }
                                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                                    await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                                }

                                switch (effectName) {
                                    case 'scale': {
                                        const newScale: LaurusScale = {
                                            math: new Map(),
                                            start: 0,
                                            end: 0,
                                            project_id: appState.project.project_id ? appState.project.project_id : newProjectId,
                                            layer_id,
                                            fps: appState.fps,
                                            order: appState.effects.filter(e => e.type == 'scale').length,
                                        };
                                        const response = await createScale(appState.apiOrigin, newScale);
                                        if (response) {
                                            const newEffect: LaurusEffect = {
                                                type: 'scale',
                                                key: response.scale_id,
                                                value: { ...response }
                                            }
                                            dispatch({
                                                type: WorkspaceActionType.SetEffects,
                                                value: [...appState.effects, newEffect]
                                            });
                                        }
                                        break;
                                    }
                                    case 'move': {
                                        const newMove: LaurusMove = {
                                            math: new Map(),
                                            start: 0,
                                            end: 0,
                                            project_id: appState.project.project_id ? appState.project.project_id : newProjectId,
                                            layer_id,
                                            fps: appState.fps,
                                            order: appState.effects.filter(e => e.type == 'move').length,
                                        };
                                        const response = await createMove(appState.apiOrigin, newMove);
                                        if (response) {
                                            const newEffect: LaurusEffect = {
                                                type: 'move',
                                                key: response.move_id,
                                                value: { ...response }
                                            }
                                            dispatch({
                                                type: WorkspaceActionType.SetEffects,
                                                value: [...appState.effects, newEffect]
                                            });
                                        }
                                        break;
                                    }
                                }
                                onAddClick();
                            }} />
                    </div>
                );
            })}
        </div>
    </>)
}