import { RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import { addCircle, allOut, circle, closeIcon, earthquake, playArrow, skipNext, skipPrevious, SvgRepo, toysFan } from "../svg-repo";
import {
    LaurusEffect,
    LaurusScale,
    WorkspaceActionType, WorkspaceContext,
    HoverContext,
    LaurusMove,
    LaurusRotate,
    Bumper,
    LaurusMixState
} from "./workspace.client";
import { createMove, createRotate, createScale } from "./workspace.server";
import { v4 } from "uuid";
import useDebounce from "../hooks/useDebounce";
import EffectUnit from "./units/effect-unit";
import { WorkspaceResolution } from "./workspace.config";
import { updateProject, createProject } from "../projects/projects.server";
import { LaurusProjectResult, LaurusProjectLayer } from "../projects/projects.client";

interface TimelineArea {
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    onRightPanelClick: () => void,
}
export default function TimelineArea({
    svgElementsRef,
    imgElementsRef,
    onRightPanelClick,
}: TimelineArea) {
    const { appState, dispatch, handleRewindAll, handlePlayAll, handleFastForwardAll } = useContext(WorkspaceContext);
    const [rulerSize] = useState(20);
    const [fastRate] = useState(25);
    const [width] = useState<number>(() => {
        switch (appState.resolution.type) {
            case "high": {
                return 1000;
            }
            case "midhigh": {
                return 740;
            }
            case "midlow":
            case "low": {
                return 580;
            }
        }
    });
    const [controlAreaSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                padding: '10px 6px',
                fpsInputWidth: 20,
                fpsInputFontSize: 16,
                fpsLabelFontSize: 15,
                mainSvg: 50,
                secondarySvg: 20,
                recordingLightSize: 16
            }
            case "midhigh": return {
                padding: '10px 6px',
                fpsInputWidth: 20,
                fpsInputFontSize: 14,
                fpsLabelFontSize: 13,
                mainSvg: 40,
                secondarySvg: 16,
                recordingLightSize: 12
            }
            case "midlow":
            case "low": return {
                padding: '10px 6px',
                fpsInputWidth: 20,
                fpsInputFontSize: 12,
                fpsLabelFontSize: 11,
                mainSvg: 38,
                secondarySvg: 14,
                recordingLightSize: 11
            }
        }
    })

    function calculateRuler(timelineMaxValue: number, resolution: WorkspaceResolution) {
        switch (resolution.type) {
            case "high": {
                switch (timelineMaxValue) {
                    case 15: {
                        return { modulo: 10, factor: 0.25, ticks: 61 };
                    }
                    default:
                    case 30: {
                        return { modulo: 10, factor: 0.5, ticks: 61 };
                    }
                    case 60: {
                        return { modulo: 10, factor: 1, ticks: 61 };
                    }
                    case 90: {
                        return { modulo: 10, factor: 1.5, ticks: 61 };
                    }
                }
            }
            case "midhigh": {
                switch (timelineMaxValue) {
                    case 15: {
                        return { modulo: 5, factor: 0.5, ticks: 31 };
                    }
                    default:
                    case 30: {
                        return { modulo: 5, factor: 1, ticks: 31 };
                    }
                    case 60: {
                        return { modulo: 5, factor: 2, ticks: 31 };
                    }
                    case 90: {
                        return { modulo: 5, factor: 3, ticks: 31 };
                    }
                }
            }
            case "midlow":
            case "low": {
                switch (timelineMaxValue) {
                    case 15: {
                        return { modulo: 1, factor: 2.5, ticks: 7 };
                    }
                    default:
                    case 30: {
                        return { modulo: 1, factor: 5, ticks: 7 };
                    }
                    case 60: {
                        return { modulo: 1, factor: 10, ticks: 7 };
                    }
                    case 90: {
                        return { modulo: 1, factor: 15, ticks: 7 };
                    }
                }
            }
        }
    };

    const [rulerParams, setRulerParams] = useState(
        calculateRuler(appState.timelineMaxValue, appState.resolution)
    );

    return (<>
        <div className={styles[`${appState.resolution.type == 'high' ? 'noisy-background-20-2' : 'noisy-background-20-2-low-res'}`]}
            style={{
                width: "100%",
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gridTemplateRows: `min-content 1fr min-content`,
            }}>
            {/* wide ruler (time) */}
            <div style={{
                gridRow: '1',
                gridColumn: 'span 2',
                borderTop: '1px solid rgba(255,255,255,0.15)',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                borderRight: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                height: rulerSize,
            }}>
                <div style={{
                    padding: (() => {
                        switch (appState.resolution.type) {
                            case "high": return '0px 20px 0px 28px'
                            case "midhigh": return '0px 12px 0px 28px'
                            case "midlow":
                            case "low": return '0px 10px 0px 26px'
                        }
                    })(),
                    fontSize: 10,
                    display: 'flex',
                    width: '100%',
                    justifyContent: 'space-between',
                    background: 'rgba(46,46,46,1)',
                }}
                    onDoubleClick={() => {
                        const currentTimelineValues = [...appState.timelineValues];
                        const currentIndex = currentTimelineValues.findIndex(v => v == appState.timelineMaxValue);
                        const newValue: number = (currentIndex >= 0) && (currentIndex + 1 < currentTimelineValues.length)
                            ? currentTimelineValues[currentIndex + 1]
                            : currentTimelineValues[0];
                        setRulerParams(calculateRuler(newValue, appState.resolution));
                        dispatch({ type: WorkspaceActionType.SetTimelineMaxValue, value: newValue });
                    }}>
                    {[...Array(rulerParams.ticks)].map((_, i) => {
                        return <div key={i}>
                            {i % rulerParams.modulo == 0 ?
                                <div style={{
                                    paddingLeft: 2,
                                    width: 10,
                                    height: '75%',
                                    borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                }} >
                                    {`${i * rulerParams.factor}`}
                                </div> :
                                <div style={{
                                    height: '50%',
                                    width: 10,
                                    borderLeft: `1px solid ${'rgb(72, 72, 72)'}`,
                                }}
                                />
                            }
                        </div>
                    })}
                </div>
                <div style={{
                    fontSize: 12,
                    textAlign: 'center',
                    position: 'relative',
                    width: 38,
                    backgroundColor: 'rgb(33, 33, 33)',
                    color: 'rgb(255, 255, 255)',
                }}
                    onDoubleClick={() => {
                        const currentUnit = appState.timelineUnit;
                        const currentUnits = [...appState.timelineUnits];
                        const currentIndex = currentUnits.findIndex(v => v == currentUnit);
                        const newUnit: string = (currentIndex >= 0) && (currentIndex + 1 < currentUnits.length)
                            ? currentUnits[currentIndex + 1]
                            : currentUnits[0];
                        dispatch({ type: WorkspaceActionType.SetTimelineUnit, value: newUnit });
                    }}>
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
            <div style={{
                overflowY: 'auto',
                gridRow: '2',
                gridColumn: '1',
                width,
                display: 'grid',
                alignContent: 'space-between',
            }}>
                <TimelineAreaContent
                    maxWidth={width}
                    svgElementsRef={svgElementsRef}
                    imgElementsRef={imgElementsRef} />
            </div>
            <Bumper
                onBumperClick={onRightPanelClick}
                borderLeft={'1px solid rgba(255, 255, 255, 0.05)'}
                borderRight={'1px solid rgba(255, 255, 255, 0.05)'} />
            {/* control area */}
            <div style={{
                gridRow: '3',
                gridColumn: 'span 2',
                display: 'grid',
                alignContent: 'space-between',
            }}>
                <div style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                    borderTopRightRadius: 10,
                    borderTopLeftRadius: 10,
                    background: 'rgb(20, 20, 20)',
                    padding: controlAreaSize.padding,
                    display: 'grid',
                    width: '100%',
                }}>
                    <div style={{
                        display: 'flex',
                        position: 'relative',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <div title={"frame rate"}
                            style={{
                                left: 6,
                                display: 'flex',
                                position: 'absolute'
                            }}>
                            <input className={dellaRespira.className}
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
                                    width: controlAreaSize.fpsInputWidth,
                                    lineHeight: '1',
                                    display: 'inline-block',
                                    overflowX: 'scroll',
                                    fontSize: controlAreaSize.fpsInputFontSize,
                                }}
                            />
                            <div style={{
                                fontSize: controlAreaSize.fpsLabelFontSize,
                                color: "rgba(255, 255, 255, 0.5)",
                            }}>
                                {<i>{'fps'}</i>}
                            </div>
                        </div>
                        <SvgRepo
                            title={"rewind all"}
                            svg={appState.skipPreviousEnabled ? skipPrevious() : skipPrevious('rgba(255, 255, 255, 0.2)')}
                            scale={1}
                            scaleToContaier={true}
                            onContainerClick={handleRewindAll}
                            containerStyle={appState.skipPreviousEnabled ? {
                                width: controlAreaSize.secondarySvg,
                                height: controlAreaSize.secondarySvg
                            } : {
                                cursor: 'progress',
                                width: controlAreaSize.secondarySvg,
                                height: controlAreaSize.secondarySvg
                            }} />
                        <SvgRepo
                            title={"play all"}
                            svg={appState.playEnabled ? playArrow() : playArrow('rgba(255, 255, 255, 0.2)')}
                            scale={1}
                            scaleToContaier={true}
                            onContainerClick={handlePlayAll}
                            containerStyle={appState.playEnabled ? {
                                width: controlAreaSize.mainSvg,
                                height: controlAreaSize.mainSvg
                            } : {
                                cursor: 'progress',
                                width: controlAreaSize.mainSvg,
                                height: controlAreaSize.mainSvg
                            }} />
                        <SvgRepo
                            title={"fast-forward all"}
                            svg={appState.skipNextEnabled ? skipNext() : skipNext('rgba(255, 255, 255, 0.2)')}
                            scale={1}
                            scaleToContaier={true}
                            onContainerClick={async () => await handleFastForwardAll(fastRate)}
                            containerStyle={appState.skipNextEnabled ? {
                                width: controlAreaSize.secondarySvg,
                                height: controlAreaSize.secondarySvg
                            } : {
                                cursor: 'progress',
                                width: controlAreaSize.secondarySvg,
                                height: controlAreaSize.secondarySvg
                            }} />
                        <div title={"light"}
                            style={{
                                right: 6,
                                display: 'flex',
                                position: 'absolute'
                            }}>
                            <div style={{
                                width: controlAreaSize.recordingLightSize,
                                height: controlAreaSize.recordingLightSize,
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
    const {
        setMostRecentlyEnteredEffectUnitKey,
        setSelectedEffectUnitKeys,
        selectedEffectUnitKeys,
        isMetaKeyPressed
    } = useContext(HoverContext);
    const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);
    const layerNameRef = useRef<HTMLInputElement | null>(null);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                layerHeaderStyle: {
                    height: 32,
                    paddingLeft: 10,
                },
                timelineAreaContent: {
                    height: 40,
                    padding: '0px 8px',
                    svg: { width: 20, height: 40 }
                },
                indexColumn: {
                    width: '4ch',
                    fontSize: 9,
                }
            }
            case "midhigh": return {
                layerHeaderStyle: {
                    height: 24,
                    paddingLeft: 10,
                },
                timelineAreaContent: {
                    height: 32,
                    padding: '0px 6px',
                    svg: { width: 16, height: 32 }
                },
                indexColumn: {
                    width: '4ch',
                    fontSize: 7,
                }
            }
            case "midlow":
            case "low": return {
                layerHeaderStyle: {
                    height: 20,
                    paddingLeft: 10,
                },
                timelineAreaContent: {
                    height: 32,
                    padding: '0px 6px',
                    svg: { width: 16, height: 32 }
                },
                indexColumn: {
                    width: '4ch',
                    fontSize: 7,
                }
            }
        }
    });

    return (<>
        {/* empty timeline area */}
        {appState.project.layers.size == 0 && (
            <div style={{
                maxWidth,
                display: 'grid',
                width: '100%',
                gridTemplateRows: 'min-content auto',
            }}>
                <div style={{
                    display: 'grid',
                    alignContent: 'start',
                    minHeight: 46,
                }}>
                    <div style={{
                        width: '100%',
                        padding: dynamicSizes.timelineAreaContent.padding,
                        background: showEffectsBrowser ? 'rgba(255,255,255, 0.01)' : 'none',
                        border: showEffectsBrowser ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0)',
                        display: 'flex',
                        justifyContent: showEffectsBrowser ? 'start' : 'end'
                    }}>
                        <SvgRepo
                            title={`${showEffectsBrowser ? 'close effects browser' : 'open effects browser'}`}
                            svg={showEffectsBrowser ?
                                closeIcon('rgba(204, 204, 204, 0.8)') :
                                addCircle('rgba(204, 204, 204, 0.8)')}
                            containerStyle={{
                                width: dynamicSizes.timelineAreaContent.svg.width,
                                height: dynamicSizes.timelineAreaContent.svg.height
                            }}
                            scale={1}
                            scaleToContaier={true}
                            onContainerClick={() => setShowEffectsBrowser(v => !v)} />
                    </div>
                    {showEffectsBrowser && (
                        <EffectsBrowser
                            onAddClick={() => setShowEffectsBrowser(false)}
                            layer_id={""}
                            layerNameRef={layerNameRef} />
                    )}
                </div>
            </div>)}
        {/* effect units */}
        {Array.from(appState.project.layers.entries()).map((layerEntry) => {
            return (
                <div key={layerEntry[0]}
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
                        background: "linear-gradient(10deg, rgb(25, 25, 25), rgb(23, 23, 23))",
                        ...dynamicSizes.layerHeaderStyle,
                    }}>
                        <LayerTitle
                            layerId={layerEntry[0]}
                            layerNameInit={layerEntry[1].name}
                            layerNameRef={layerNameRef} />
                    </div>
                    {/* effects */}
                    <div style={{
                        display: 'grid',
                        alignContent: 'start',
                        minHeight: dynamicSizes.timelineAreaContent.height,
                    }}>
                        {appState.effects.sort((a, b) => a.value.order - b.value.order).map((effect, i) => {
                            const isSelected = selectedEffectUnitKeys.has(effect.key);
                            return <div key={effect.key}
                                onClick={(e) => {
                                    if (e.metaKey) {
                                        setSelectedEffectUnitKeys((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(effect.key)) next.delete(effect.key);
                                            else next.add(effect.key);
                                            return next;
                                        });
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    setMostRecentlyEnteredEffectUnitKey(effect.key);
                                    e.currentTarget.style.background = isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.border = isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.0275)';
                                    e.currentTarget.style.border = isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0)';
                                }}
                                style={{
                                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0)',
                                    background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.0275)',
                                    display: 'flex',
                                    borderRadius: 0,
                                    cursor: isMetaKeyPressed ? 'crosshair' : 'default',
                                }}>
                                <div style={{
                                    height: '100%',
                                    background: 'rgba(22, 22, 22, 0.9)',
                                    display: 'grid',
                                    placeContent: 'center',
                                    ...dynamicSizes.indexColumn,
                                }}>{(i + 1).toFixed()}</div>
                                <EffectUnit
                                    effect={effect}
                                    svgElementsRef={svgElementsRef}
                                    imgElementsRef={imgElementsRef} />
                            </div>
                        })}
                        <div style={{
                            width: '100%',
                            padding: dynamicSizes.timelineAreaContent.padding,
                            background: showEffectsBrowser ? 'rgba(255,255,255, 0.01)' : 'none',
                            border: showEffectsBrowser ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0)',
                            display: 'flex',
                            justifyContent: showEffectsBrowser ? 'start' : 'end'
                        }}>
                            <SvgRepo
                                title={`${showEffectsBrowser ? 'close effects browser' : 'open effects browser'}`}
                                svg={showEffectsBrowser ?
                                    closeIcon('rgba(204, 204, 204, 0.8)') :
                                    addCircle('rgba(204, 204, 204, 0.8)')}
                                containerStyle={{
                                    width: dynamicSizes.timelineAreaContent.svg.width,
                                    height: dynamicSizes.timelineAreaContent.svg.height
                                }}
                                scale={1}
                                scaleToContaier={true}
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
    const [layerNameSnapshot] = useState<string>(layerNameInit);
    const layerNameHook = useDebounce<string>(layerName, 1000);
    const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
    const layerIdRef = useRef<string | undefined>(undefined);
    const [fontSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return 10
            case "midhigh": return 8
            case "midlow":
            case "low": return 8
        }
    });

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
                const newProject = { ...projectRef.current, layers: newLayers };
                const updated = await updateProject(
                    appState.apiOrigin,
                    appState.accessToken,
                    projectRef.current.project_id,
                    newProject);
                if (updated) {
                    dispatch({ type: WorkspaceActionType.SetProject, value: { ...newProject } });
                }
                else {
                    if (layerNameRef.current) {
                        layerNameRef.current.value = layerNameSnapshot;
                    }
                }
            }
            else if (layerIdRef.current && layerNameHook) {
                const newProject = { ...projectRef.current, layers: newLayers };
                const created = await createProject(
                    appState.apiOrigin,
                    appState.accessToken,
                    newProject);
                if (created) {
                    const newProject2: LaurusProjectResult = { ...newProject, project_id: created.project_id }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                }
                else {
                    if (layerNameRef.current) {
                        layerNameRef.current.value = layerNameSnapshot;
                    }
                }
            }
        });
        renameProjectOnSever();
    }, [appState.apiOrigin, layerNameHook, dispatch, appState.accessToken, layerNameSnapshot, layerNameRef]);

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
        <div style={{
            width: '100%',
            display: 'grid',
            alignContent: 'center',
            justifyContent: 'start',
            height: '100%',
        }}>
            <input id={`layer-name-input-${layerId}`}
                ref={layerNameRef}
                className={dellaRespira.className}
                placeholder="name me..."
                style={{
                    letterSpacing: '3px',
                    background: 'none',
                    color: "rgb(227, 227, 227)",
                    fontSize: fontSize,
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
    const [effectBrowserSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                height: 96,
                itemFontSize: 14,
                itemHeight: 36,
                itemPadding: 10,
                svg: 20,
            }
            case "midhigh": return {
                height: 96,
                itemFontSize: 12,
                itemHeight: 36,
                itemPadding: 10,
                svg: 16,
            }
            case "midlow":
            case "low": return {
                height: 96,
                itemFontSize: 10,
                itemHeight: 32,
                itemPadding: 8,
                svg: 14,
            }
        }
    });

    const createEffect = useCallback(async (effectName: string) => {
        const newLayers: Map<string, LaurusProjectLayer> = new Map(appState.project.layers);
        const newLayerId = v4();
        if (!layer_id) {
            const newLayerName = layerNameRef.current?.value ?? "untitled";
            newLayers.set(newLayerId, { name: newLayerName, order: 0 });
        }
        let newProjectIdAck = "";
        if (!appState.project.project_id) {
            const newProject: LaurusProjectResult = { ...appState.project, layers: newLayers }
            const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
            if (projectCreated) {
                newProjectIdAck = projectCreated.project_id;
                const newProject2: LaurusProjectResult = { ...newProject, project_id: newProjectIdAck }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
            }
        }
        else {
            const newProject: LaurusProjectResult = { ...appState.project, layers: newLayers }
            const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (projectUpdated) {
                newProjectIdAck = newProject.project_id;
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            }
        }
        if (!newProjectIdAck) return;
        const sortedEffects = appState.effects
            .sort((a, b) => new Date(a.value.timestamp).getTime() - new Date(b.value.timestamp).getTime());
        const newOrder = sortedEffects.length > 0 ? Math.max(...sortedEffects.map(e => e.value.order)) + 1 : 1;

        switch (effectName) {
            case 'scale': {
                const newScale: LaurusScale = {
                    math: new Map(),
                    start: 0,
                    end: 0,
                    project_id: newProjectIdAck,
                    layer_id: layer_id ? layer_id : newLayerId,
                    fps: appState.fps,
                    locked: false,
                    order: newOrder,
                    mix: false,
                    description: "",
                    disabled: false
                };
                const created = await createScale(appState.apiOrigin, appState.accessToken, newScale);
                if (created) {
                    const newEffect: LaurusEffect = {
                        type: 'scale',
                        key: created.scale_id,
                        value: { ...created, mixState: LaurusMixState.None }
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
                    project_id: newProjectIdAck,
                    layer_id: layer_id ? layer_id : newLayerId,
                    fps: appState.fps,
                    locked: false,
                    order: newOrder,
                    mix: false,
                    description: "",
                    disabled: false
                };
                const created = await createMove(appState.apiOrigin, appState.accessToken, newMove);
                if (created) {
                    const newEffect: LaurusEffect = {
                        type: 'move',
                        key: created.move_id,
                        value: { ...created, mixState: LaurusMixState.None }
                    }
                    dispatch({
                        type: WorkspaceActionType.SetEffects,
                        value: [...appState.effects, newEffect]
                    });
                }
                break;
            }
            case 'rotate': {
                const newRotate: LaurusRotate = {
                    math: new Map(),
                    start: 0,
                    end: 0,
                    project_id: newProjectIdAck,
                    layer_id: layer_id ? layer_id : newLayerId,
                    fps: appState.fps,
                    locked: false,
                    order: newOrder,
                    mix: false,
                    description: "",
                    disabled: false
                };
                const created = await createRotate(appState.apiOrigin, appState.accessToken, newRotate);
                if (created) {
                    const newEffect: LaurusEffect = {
                        type: 'rotate',
                        key: created.rotate_id,
                        value: { ...created, mixState: LaurusMixState.None }
                    }
                    dispatch({
                        type: WorkspaceActionType.SetEffects,
                        value: [...appState.effects, newEffect]
                    });
                }
                break;
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.effects, appState.fps, appState.project, dispatch, layerNameRef, layer_id])

    return (<>
        <div style={{
            width: '100%',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            height: effectBrowserSize.height,
            overflowY: 'auto',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
        }}>
            {appState.effectNames.map((effectName, i) => {
                return (
                    <div key={effectName}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = i % 2 == 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)';
                            e.currentTarget.style.border = '1px solid rgba(0, 0, 0, 0)';
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: effectBrowserSize.itemFontSize,
                            letterSpacing: "3px",
                            height: effectBrowserSize.itemHeight,
                            border: '1px solid rgba(0, 0, 0, 0)',
                            padding: effectBrowserSize.itemPadding,
                            background: i % 2 == 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
                            color: effectName == 'skew' ? 'rgba(255, 255, 255, 0.3)' : 'rgb(227,227,227)'
                        }}>
                        <div>
                            {`${effectName}${effectName == 'skew' ? " · coming soon" : ""}`}
                        </div>
                        {(effectName != 'skew') && <SvgRepo svg={(() => {
                            switch (effectName) {
                                case "scale": return allOut();
                                case "move": return earthquake();
                                case "rotate": return toysFan();
                                default: return circle('rgba(0,0,0,0)')
                            }
                        })()}
                            containerStyle={{
                                width: effectBrowserSize.svg,
                                height: effectBrowserSize.svg
                            }}
                            scale={0.7}
                            scaleToContaier={true} />}
                        <div style={{ marginLeft: 'auto' }} />
                        {(effectName != 'skew') && <SvgRepo
                            svg={addCircle('rgba(204, 204, 204, 0.8)')}
                            containerStyle={{
                                width: effectBrowserSize.svg,
                                height: effectBrowserSize.svg
                            }}
                            scale={1}
                            scaleToContaier={true}
                            onContainerClick={async () => {
                                await createEffect(effectName);
                                onAddClick();
                            }} />}
                    </div>
                );
            })}
        </div>
    </>)
}
