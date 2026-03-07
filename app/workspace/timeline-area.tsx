import { RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import { ReactSvg } from "./media";
import { addCircle, circle, playArrow, skipNext, skipPrevious } from "../svg-repo";
import {
    LaurusEffect, LaurusProjectResult, LaurusScale,
    timelineUnits,
    convertTime,
    WorkspaceActionType, WorkspaceContext,
    LaurusMove,
} from "./workspace.client";
import { createMove, createProject, createScale, getFrames, updateProject } from "./workspace.server";
import { v4 } from "uuid";
import useDebounce from "../hooks/useDebounce";
import EffectUnit from "./effect-unit";

interface TimelineArea {
    size: { width: number, height: number },
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}

export default function TimelineArea({
    size,
    svgElementsRef,
    imgElementsRef
}: TimelineArea) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [rulerSize] = useState(20);
    const [fps, setFps] = useState(60);
    const [fastRate] = useState(50);
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
            .map(e => e.value.duration));
        const options: KeyframeAnimationOptions = {
            duration: firstFrame ? 2 / fps : globalLimit * 1000,
            iterations: 1,
            fill,
        };

        const imgArray = Array.from(appState.project.imgs.entries().filter(e => !e[1].pending));
        for (let i = 0; i < imgArray.length; i++) {
            const [key] = imgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, fps);
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
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, fps);
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
    }, [appState.apiOrigin, appState.effects, appState.project.imgs, appState.project.project_id, appState.project.svgs, fps, imgElementsRef, svgElementsRef]);

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
                gridTemplateColumns: 'min-content 1fr',
                gridTemplateRows: `min-content 1fr min-content`,
            }}>
            {/* ruler intersection */}
            <div style={{
                gridRow: '1', gridColumn: '1',
                width: 14,
                height: rulerSize,
                backgroundImage: 'linear-gradient(45deg, rgb(28, 28, 28), rgb(28, 28, 28))',
                display: 'grid',
                placeItems: 'center',
            }} >
            </div>
            {/* tall ruler */}
            <div
                style={{
                    gridRow: '2', gridColumn: '1',
                    width: 14,
                    display: 'grid',
                    backgroundImage: 'linear-gradient(45deg, rgb(37, 37, 37), rgb(37, 37, 37))',
                }} />
            {/* wide ruler (time) */}
            <div
                className={dellaRespira.className}
                style={{
                    gridRow: '1', gridColumn: '2',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    height: rulerSize,
                }} >
                <div style={{
                    width: 15,
                    background: 'rgba(46,46,46,1)',
                }} />
                <div
                    onDoubleClick={() => {
                        dispatch({ type: WorkspaceActionType.IncrementTimelineMaxValue });
                    }}
                    style={{
                        fontSize: 10,
                        display: 'flex',
                        width: '100%',
                        justifyContent: 'space-between',
                        background: 'rgba(46,46,46,1)',
                    }}>
                    {[...Array(61)].map((_, i) => {
                        const params = getWideRulerParams();
                        return (
                            <div key={i}>
                                {i % params.modulo == 0 ?
                                    (<div
                                        style={{
                                            paddingLeft: 2,
                                            width: 10,
                                            height: '75%',
                                            borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                        }}
                                    >
                                        {i < 60 ? `${i * params.factor}` : ''}
                                    </div>
                                    ) :
                                    (<div
                                        style={{
                                            height: '50%',
                                            width: 10,
                                            borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                        }}
                                    />)}
                            </div>
                        )
                    })}
                </div>
                <div style={{
                    width: 5,
                    background: 'rgba(46,46,46,1)',
                }} />
                <div
                    onDoubleClick={() => {
                        const currentUnit = appState.timelineUnit;
                        const currentIndex = timelineUnits.findIndex(v => v == appState.timelineUnit);
                        const newUnit: string = (currentIndex >= 0) && (currentIndex + 1 < timelineUnits.length)
                            ? timelineUnits[currentIndex + 1]
                            : timelineUnits[0];

                        dispatch({ type: WorkspaceActionType.SetTimelineUnit, value: newUnit });
                        const newEffects: LaurusEffect[] = appState.effects.map(e => {
                            switch (e.type) {
                                case "scale": {
                                    const clientEffect: LaurusEffect = {
                                        ...e,
                                        value: {
                                            ...e.value,
                                            offset: convertTime(e.value.offset, currentUnit, newUnit),
                                            duration: convertTime(e.value.duration, currentUnit, newUnit)
                                        }
                                    }
                                    return clientEffect;
                                }
                                case "move": {
                                    const clientEffect: LaurusEffect = {
                                        ...e,
                                        value: {
                                            ...e.value,
                                            offset: convertTime(e.value.offset, currentUnit, newUnit),
                                            duration: convertTime(e.value.duration, currentUnit, newUnit)
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
                        width: 48,
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
                    gridRow: '2', gridColumn: '2',
                    width: size.width,
                    display: 'grid',
                    alignContent: 'space-between',
                }}>
                <TimelineAreaContent
                    maxWidth={size.width}
                    svgElementsRef={svgElementsRef}
                    imgElementsRef={imgElementsRef} />
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
                            <div
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    border: appState.recordingLight ? '1px solid rgb(239, 239, 239)' : 'none',
                                    background: appState.recordingLight ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'none',
                                    boxShadow: appState.recordingLight ? 'rgba(255, 255, 255, 0.9) 0px 0px 100px 8px' : 'none'
                                }} />
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
                                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
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
                                        dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
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
                            right: 0,
                            display: 'flex',
                            position: 'absolute'
                        }}>
                            <input
                                className={dellaRespira.className}
                                id={`fps-input`}
                                type="text"
                                placeholder="30"
                                value={fps}
                                onChange={(e) => {
                                    const newFps: number = parseFloat(e.currentTarget.value) || 30;
                                    setFps(newFps);
                                }}
                                style={{
                                    textAlign: "right",
                                    background: 'none',
                                    color: "rgb(227, 227, 227)",
                                    borderRadius: "2px",
                                    border: 'none',
                                    outline: 'none',
                                    lineHeight: '1',
                                    display: 'inline-block',
                                    overflowX: 'scroll',
                                    fontSize: 16,
                                }}
                            />
                            <div
                                style={{
                                    fontSize: 15,
                                    padding: '0px 3px',
                                    color: "rgba(255, 255, 255, 0.5)",
                                }}>
                                {<i>{'fps'}</i>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>)
}

interface TimelineAreaContentProps {
    maxWidth: number,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}
function TimelineAreaContent({ maxWidth, svgElementsRef, imgElementsRef }: TimelineAreaContentProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);
    const layerNameRef = useRef<HTMLInputElement | null>(null);

    return (<>
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
                    <div style={{
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
                    }}>
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
                    <div style={{
                        display: 'grid',
                        alignContent: 'start',
                        minHeight: 46,
                        borderLeft: '1px solid black',
                        borderRight: '1px solid black',
                        borderBottomLeftRadius: 10,
                        borderBottomRightRadius: 10,
                    }}>
                        {appState.effects.sort((a, b) => a.value.order - b.value.order).map((s, i) => {
                            return <div
                                style={{
                                    borderBottom: 'solid rgba(0, 0, 0, 1) 1px',
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
                                width: '100%', height: 46,
                                padding: 10,
                                borderBottom: showEffectsBrowser ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid black',
                                background: 'rgba(255,255,255,0.01)',
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
                                                    let newProjectId = "";
                                                    if (!appState.project.project_id) {
                                                        const newProject: LaurusProjectResult = { ...appState.project }
                                                        const response = await createProject(appState.apiOrigin, { ...newProject });
                                                        if (response) {
                                                            newProjectId = response.project_id;
                                                            const newProject2: LaurusProjectResult = { ...newProject, project_id: newProjectId }
                                                            dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                                                        }
                                                    }

                                                    switch (effectName) {
                                                        case 'scale': {
                                                            const newScale: LaurusScale = {
                                                                math: new Map(),
                                                                offset: 0,
                                                                duration: 0,
                                                                project_id: appState.project.project_id ? appState.project.project_id : newProjectId,
                                                                layer_id: layerEntry[0],
                                                                fps: 30,
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
                                                                offset: 0,
                                                                duration: 0,
                                                                project_id: appState.project.project_id ? appState.project.project_id : newProjectId,
                                                                layer_id: layerEntry[0],
                                                                fps: 30,
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

                                                    setShowEffectsBrowser(false);
                                                }} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>)
        })}
    </>)
}

interface LayerTitleProps {
    layerId: string,
    layerNameInit: string,
    layerNameRef: RefObject<HTMLInputElement | null>,
}
function LayerTitle({ layerId, layerNameRef, layerNameInit }: LayerTitleProps) {
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
                await updateProject(
                    appState.apiOrigin,
                    projectRef.current.project_id,
                    { ...projectRef.current, layers: newLayers });
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
