import { RefObject, useContext, useEffect, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira, ubuntuMono } from "../fonts";
import { ReactSvg } from "./media";
import { addCircle, circle } from "../svg-repo";
import { LaurusProject, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { createProject, updateProject } from "./workspace.server";
import { v4 } from "uuid";
import useDebounce from "../hooks/useDebounce";

interface TimelineArea {
    effectsEnum: string[],
    size: { width: number, height: number },
}

export default function TimelineArea({
    effectsEnum,
    size,
}: TimelineArea) {
    const [rulerSize] = useState(20);
    const [layerLight] = useState(false);
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
                backgroundImage: 'linear-gradient(45deg, rgb(46, 46, 46), rgb(46, 46, 46))',
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
                className={ubuntuMono.className}
                style={{
                    fontSize: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gridRow: '1', gridColumn: '2',
                    height: rulerSize,
                    backgroundImage: 'linear-gradient(45deg, rgb(46, 46, 46), rgb(46, 46, 46))',
                }} >
                {[...Array(50)].map((_, i) => (
                    <div key={i}>
                        {i % 10 == 0 ?
                            (<div

                                style={{
                                    //flex: 1,
                                    paddingLeft: 2,
                                    width: 10,
                                    height: '75%',
                                    borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                }}
                            >
                                {`${i * 2}`}
                            </div>
                            ) :
                            (<div
                                style={{
                                    //flex: 1,
                                    height: '50%',
                                    width: 10,
                                    borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                }}
                            />)}
                    </div>
                ))}
                <div style={{
                    width: 48,
                    borderRadius: 0,
                    border: layerLight ? '1px solid rgba(69, 88, 97, 1)' : '1px solid rgba(0, 0, 0, 1)',
                    backgroundColor: layerLight ? 'rgba(150, 214, 243, 1)' : 'rgba(33, 33, 33, 1)',
                    boxShadow: layerLight ? 'rgba(255, 255, 255, 0.8) 0px 0px 100px -10px' : 'none'
                }} />
            </div>
            {/* content area */}
            <div
                className={styles["grainy-background"] + " " + dellaRespira.className}
                style={{
                    gridRow: '2', gridColumn: '2',
                    width: size.width,
                    padding: 2
                }}>
                <TimelineAreaContent effectsEnum={effectsEnum} />
            </div>
        </div >
    </>)
}

interface TimelineAreaContentProps {
    effectsEnum: string[], // candidate for reducer 
}
function TimelineAreaContent({ effectsEnum }: TimelineAreaContentProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);
    const [layerLight, setLayerLight] = useState(false);
    const layerNameRef = useRef<HTMLInputElement | null>(null);
    return (<>
        {Array.from(appState.project.layers.entries()).map((layerEntry) => {

            return (<div style={{
                display: 'flex', width: '100%',
                maxHeight: 256
            }}
                key={layerEntry[0]}>
                <div style={{
                    display: 'grid', width: '100%',
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
                            <div style={{ width: 'min-content', height: 'min-content' }}>
                                <ReactSvg
                                    svg={circle('rgb(204, 204, 204)', 12, 12)}
                                    containerSize={{
                                        width: 12,
                                        height: 12
                                    }}
                                    scale={undefined} />
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        alignContent: 'start',
                        width: '100%',
                        minHeight: 46,
                        borderLeft: '1px solid black',
                        borderRight: '1px solid black',
                        borderBottomLeftRadius: 10,
                    }}>
                        {/* effect unit */}
                        <div
                            style={{
                                width: '100%', height: 46,
                                padding: 10,
                                borderBottom: showEffectsBrowser ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid black',
                                boxShadow: showEffectsBrowser ? '0px 13px 30px -20px rgba(255, 255, 255, 0.65)' : 'none',
                                background: 'rgba(255,255,255,0.01)',
                            }}>
                            <div style={{ width: 'min-content' }}
                                onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                onClick={() => {
                                    setShowEffectsBrowser(v => !v);
                                }}>
                                <ReactSvg
                                    svg={showEffectsBrowser ?
                                        circle('rgba(204, 204, 204, 0.1)', 20, 20) :
                                        addCircle('rgba(204, 204, 204, 0.8)', 20, 20)}
                                    containerSize={{
                                        width: 20,
                                        height: 20
                                    }}
                                    scale={undefined} />
                            </div>
                        </div>
                        {showEffectsBrowser && (
                            <div
                                style={{
                                    width: '100%',
                                    borderBottom: '1px solid black',
                                    overflowY: 'auto',
                                    borderBottomLeftRadius: 10,
                                }}>
                                {effectsEnum.map((effectName, i) => {
                                    return (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: 14,
                                                letterSpacing: "3px",
                                                height: 64,
                                                borderRadius: 4,
                                                padding: 10,
                                                background: i % 2 == 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)'
                                            }}
                                            key={effectName}>
                                            <div>
                                                {effectName}
                                            </div>
                                            <div style={{ width: 'min-content', height: 'min-content' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                                onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                                onClick={async () => {

                                                    if (!appState.project.project_id) {
                                                        const newProject: LaurusProject = { ...appState.project }
                                                        const response = await createProject(appState.apiOrigin, { ...newProject });
                                                        if (response) {
                                                            const newProject2: LaurusProject = { ...newProject, project_id: response.project_id }
                                                            dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                                                        }
                                                    }

                                                    // post effects.

                                                    setShowEffectsBrowser(false);
                                                }}>
                                                <ReactSvg
                                                    svg={addCircle('rgba(204, 204, 204, 0.8', 20, 20)}
                                                    containerSize={{
                                                        width: 20,
                                                        height: 20
                                                    }}
                                                    scale={undefined} />
                                            </div>
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
                        border: layerLight ? '1px solid rgba(69, 88, 97, 1)' : '1px solid rgba(0, 0, 0, 1)',
                        backgroundColor: layerLight ? 'rgba(150, 214, 243, 1)' : 'rgba(33, 33, 33, 1)',
                        boxShadow: layerLight ? 'rgba(255, 255, 255, 0.8) 0px 0px 100px -10px' : 'none'
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
    const projectRef = useRef<LaurusProject | undefined>(undefined);
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
                    const newProject2: LaurusProject = { ...newProject, project_id: response.project_id }
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