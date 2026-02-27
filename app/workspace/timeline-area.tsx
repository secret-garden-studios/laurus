import { RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import { ReactSvg } from "./media";
import { addCircle, circle } from "../svg-repo";
import {
    LaurusEffect, LaurusProjectResult, LaurusScale,
    timelineUnits,
    convertTime,
    WorkspaceActionType, WorkspaceContext
} from "./workspace.client";
import { createProject, createScale, updateProject } from "./workspace.server";
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

    return (<>
        <div
            style={{
                overflowY: 'auto',
                width: "100%",
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'min-content 1fr',
                gridTemplateRows: `min-content 1fr`,
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
                    gridRow: '2', gridColumn: '2',
                    width: size.width,
                }}>
                <TimelineAreaContent
                    maxWidth={size.width}
                    svgElementsRef={svgElementsRef}
                    imgElementsRef={imgElementsRef} />
            </div>
        </div >
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
    const [layerLight, setLayerLight] = useState(false);
    const layerNameRef = useRef<HTMLInputElement | null>(null);

    return (<>
        {Array.from(appState.project.layers.entries()).map((layerEntry) => {
            return (
                <div style={{ display: 'flex', maxWidth, }} key={layerEntry[0]}>
                    <div style={{
                        display: 'grid',
                        width: '100%',
                        gridTemplateRows: 'min-content auto',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifySelf: 'center',
                            width: '100%',
                            height: 32,
                            borderTop: '1px solid rgb(0, 0, 0)',
                            borderLeft: '1px solid rgb(0, 0, 0)',
                            borderRight: '1px solid rgb(0, 0, 0)',
                            borderBottom: '1px solid rgb(18, 18, 18)',
                            borderTopRightRadius: 10,
                            borderTopLeftRadius: 10,
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
                                <ReactSvg
                                    svg={circle('rgb(204, 204, 204)')}
                                    containerSize={{
                                        width: 12,
                                        height: 12
                                    }}
                                    scale={1} />
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            alignContent: 'start',
                            minHeight: 46,
                            borderLeft: '1px solid black',
                            borderRight: '1px solid black',
                            borderBottomLeftRadius: 10,

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
                                                        }

                                                        setShowEffectsBrowser(false);
                                                    }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div
                        onDoubleClick={() => setLayerLight(v => !v)}
                        style={{
                            width: '48px',
                            borderRadius: '10px',
                            border: layerLight ? '1px solid rgb(168, 168, 168)' : '1px solid rgba(0, 0, 0, 1)',
                            background: layerLight ? 'linear-gradient(270deg, rgba(239, 239, 239, 0.6), rgba(255, 255, 255, 0.8))' : 'rgba(33, 33, 33, 1)',
                            boxShadow: layerLight ? 'rgba(255, 255, 255, 0.8) 0px 0px 100px -7px' : 'none'
                        }} />
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
