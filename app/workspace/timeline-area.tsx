import { CSSProperties, RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
    LaurusMixState,
    LaurusEffectGroupResult,
    LaurusEffectGroup
} from "./workspace.client";
import { createEffectGroup, createMove, createRotate, createScale, deleteEffectGroup, updateEffectGroup, updateMove, updateRotate, updateScale } from "./workspace.server";
import useDebounce from "../hooks/useDebounce";
import EffectUnit from "./units/effect-unit";
import { WorkspaceResolution } from "./workspace.config";
import { updateProject, createProject } from "../projects/projects.server";
import { LaurusProjectResult } from "../projects/projects.client";
import Toggle from "../components/toggle";

function reindexEffects(
    effects: LaurusEffect[],
    effectGroups: Map<string, LaurusEffectGroupResult>
): LaurusEffect[] {
    const sortedGroups = Array.from(effectGroups.values())
        .sort((a, b) => (a.order - b.order) || (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));

    const groupOrderMap = new Map(sortedGroups.map((g, index) => [g.effect_group_id, index]));

    return [...effects]
        .sort((a, b) => {
            const groupOrderA = groupOrderMap.get(a.value.effect_group_id) ?? -1;
            const groupOrderB = groupOrderMap.get(b.value.effect_group_id) ?? -1;

            if (groupOrderA !== groupOrderB) {
                return groupOrderA - groupOrderB;
            }

            return (a.value.order - b.value.order) || (new Date(a.value.timestamp).getTime() - new Date(b.value.timestamp).getTime());
        })
        .map((e, i) => ({ ...e, value: { ...e.value, order: i } } as LaurusEffect));
};

async function persistReindexedEffects(
    apiOrigin: string | undefined,
    accessToken: string | undefined,
    reindexedEffects: LaurusEffect[],
    previousEffects: LaurusEffect[]
) {
    const updates = reindexedEffects.filter(ne => {
        const oe = previousEffects.find(e => e.key === ne.key);
        return !oe || oe.value.effect_group_id !== ne.value.effect_group_id || oe.value.order !== ne.value.order;
    });

    for (const effect of updates) {
        switch (effect.type) {
            case 'scale':
                await updateScale(apiOrigin, accessToken, effect.key, effect.value);
                break;
            case 'move':
                await updateMove(apiOrigin, accessToken, effect.key, effect.value);
                break;
            case 'rotate':
                await updateRotate(apiOrigin, accessToken, effect.key, effect.value);
                break;
        }
    }
};

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
    const { appState } = useContext(WorkspaceContext);
    const { selectedEffectUnitKeys } = useContext(HoverContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return { width: 1000 };
            case "midhigh": return { width: 740 };
            case "midlow":
            case "low": return { width: 580 };
        }
    });

    return (<>
        <div className={styles[`${appState.resolution.type == 'high' ? 'noisy-background-20-2' : 'noisy-background-20-2-low-res'}`]}
            style={{
                width: "100%",
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gridTemplateRows: `min-content auto min-content`,
            }}>
            <TimelineRuler
                containerStyle={{
                    gridRow: '1',
                    gridColumn: 'span 2',
                }} />
            <div style={{
                overflowY: 'auto',
                gridRow: '2',
                gridColumn: '1',
                display: 'grid',
                alignContent: 'start',
                ...dynamicSizes
            }}>
                {appState.effectGroups.size == 0
                    ? (<EffectGroupSkeleton maxWidth={dynamicSizes.width} />)
                    : (<>{Array.from(appState.effectGroups.entries())
                        .sort((a, b) => {
                            if (a[1].order !== b[1].order) {
                                return a[1].order - b[1].order;
                            }
                            return new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime();
                        })
                        .map((groupEntry) => {
                            const [effectGroupId, effectGroup] = groupEntry;
                            return <div key={effectGroupId}>
                                <EffectGroup
                                    effectGroupId={effectGroupId}
                                    effectGroupResult={effectGroup}
                                    maxWidth={dynamicSizes.width}
                                    svgElementsRef={svgElementsRef}
                                    imgElementsRef={imgElementsRef} />
                            </div>
                        })}</>)
                }
            </div>
            <Bumper
                onBumperClick={onRightPanelClick}
                borderLeft={'1px solid rgba(255, 255, 255, 0.05)'}
                borderRight={'1px solid rgba(255, 255, 255, 0.05)'} />
            <div style={{
                gridRow: '3',
                gridColumn: 'span 2',
                display: 'grid',
                alignContent: 'space-between',
            }}>
                {selectedEffectUnitKeys.size > 0 ? <SelectionControlPanel /> : <ControlPanel />}
            </div>
        </div>
    </>)
}

interface TimelineRuler {
    containerStyle?: CSSProperties
}
function TimelineRuler({ containerStyle }: TimelineRuler) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [rulerSize] = useState(20);
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
    return (
        <div style={{
            display: 'flex',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            borderRight: '1px solid rgba(255,255,255,0.15)',
            height: rulerSize,
            ...containerStyle
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
    );
}

interface EffectGroup {
    effectGroupId: string,
    effectGroupResult: LaurusEffectGroupResult,
    maxWidth: number,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
}
function EffectGroup({ effectGroupId, effectGroupResult, maxWidth, svgElementsRef, imgElementsRef }: EffectGroup) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const {
        setMostRecentlyEnteredEffectUnitKey,
        setSelectedEffectUnitKeys,
        selectedEffectUnitKeys,
        isMetaKeyPressed
    } = useContext(HoverContext);
    const [effectsBrowserToggle, setEffectsBrowserToggle] = useState(false);
    const showEffectsBrowser = useMemo(() => {
        return effectsBrowserToggle && selectedEffectUnitKeys.size === 0;
    }, [effectsBrowserToggle, selectedEffectUnitKeys.size]);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
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

    const onEffectsBrowserExpandClick = useCallback(async () => {
        if (selectedEffectUnitKeys.size > 0) {
            const snapshot = [...appState.effects];
            const effectsWithNewGroups = snapshot.map(e => {
                if (selectedEffectUnitKeys.has(e.key)) {
                    return { ...e, value: { ...e.value, effect_group_id: effectGroupId } } as LaurusEffect;
                }
                return e;
            });
            const reindexedEffects = reindexEffects(effectsWithNewGroups, appState.effectGroups);
            await persistReindexedEffects(appState.apiOrigin, appState.accessToken, reindexedEffects, snapshot);
            dispatch({ type: WorkspaceActionType.SetEffects, value: reindexedEffects });
        }
        else {
            setEffectsBrowserToggle(v => !v);
        }
    }, [appState.accessToken, appState.apiOrigin, appState.effectGroups, appState.effects, dispatch, effectGroupId, selectedEffectUnitKeys]);

    return (
        <div
            style={{
                maxWidth,
                display: 'grid',
                width: '100%',
                gridTemplateRows: 'min-content auto',
            }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: "linear-gradient(10deg, rgb(25, 25, 25), rgb(23, 23, 23))",
            }}>
                <EffectGroupTitlebar
                    effectGroupId={effectGroupId}
                    effectGroupDescriptionInit={effectGroupResult.description} />
            </div>
            {/* effects */}
            <div style={{
                display: 'grid',
                alignContent: 'start',
                minHeight: dynamicSizes.timelineAreaContent.height,
            }}>
                {appState.effects
                    .filter(e => e.value.effect_group_id === effectGroupId)
                    .sort((a, b) => {
                        if (a.value.order !== b.value.order) {
                            return a.value.order - b.value.order;
                        }
                        return new Date(a.value.timestamp).getTime() - new Date(b.value.timestamp).getTime();
                    })
                    .map((effect) => {
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
                                cursor: isMetaKeyPressed ? 'crosshair' : '',
                            }}>
                            <div style={{
                                height: '100%',
                                background: 'rgba(22, 22, 22, 0.9)',
                                display: 'grid',
                                placeContent: 'center',
                                ...dynamicSizes.indexColumn,
                            }}>{(effect.value.order + 1).toFixed()}</div>
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
                    justifyContent: showEffectsBrowser ? 'start' : 'start'
                }}>
                    <SvgRepo
                        title={`${showEffectsBrowser ? 'close effects browser' : selectedEffectUnitKeys.size > 0 ? 'add to group' : 'open effects browser'}`}
                        svg={showEffectsBrowser ?
                            closeIcon('rgba(204, 204, 204, 0.8)') :
                            addCircle('rgba(204, 204, 204, 0.8)')}
                        containerStyle={{
                            width: dynamicSizes.timelineAreaContent.svg.width,
                            height: dynamicSizes.timelineAreaContent.svg.height
                        }}
                        scale={1}
                        scaleToContaier={true}
                        onContainerClick={onEffectsBrowserExpandClick} />
                </div>
                {showEffectsBrowser && (
                    <EffectsBrowser
                        onAddClick={() => setEffectsBrowserToggle(false)}
                        effect_group_id={effectGroupId} />
                )}
            </div>
        </div>
    );
}

interface EffectGroupSkeleton {
    maxWidth: number,
}
function EffectGroupSkeleton({ maxWidth }: EffectGroupSkeleton) {
    const { appState } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                timelineAreaContent: {
                    padding: '0px 8px',
                    svg: { width: 20, height: 40 }
                },
            }
            case "midhigh": return {
                timelineAreaContent: {
                    padding: '0px 6px',
                    svg: { width: 16, height: 32 }
                },
            }
            case "midlow":
            case "low": return {
                timelineAreaContent: {
                    padding: '0px 6px',
                    svg: { width: 16, height: 32 }
                },
            }
        }
    });

    const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);

    return <>
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
                        effect_group_id={""} />
                )}
            </div>
        </div>
    </>
}

interface EffectGroupTitlebar {
    effectGroupId: string,
    effectGroupDescriptionInit: string,
}
function EffectGroupTitlebar({ effectGroupId, effectGroupDescriptionInit }: EffectGroupTitlebar) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const { isMetaKeyPressed, setSelectedEffectUnitKeys } = useContext(HoverContext);
    const [effectGroupDescription, setEffectGroupDescription] = useState<string>(effectGroupDescriptionInit);
    const [effectGroupDescriptionSnapshot] = useState<string>(effectGroupDescriptionInit);
    const effectGroupDescriptionDebounce = useDebounce<string>(effectGroupDescription, 1000);
    const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
    const effectGroupsRef = useRef<Map<string, LaurusEffectGroupResult> | undefined>(undefined);
    const effectGroupIdRef = useRef<string | undefined>(undefined);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                flex: {
                    height: 32,
                    paddingLeft: 0,
                },
                input: {
                    fontSize: 10,
                },
                svg: {
                    width: 24,
                    height: 32
                },
                toggle: {
                    div: {
                        paddingLeft: 6,
                        paddingRight: 10,
                        gap: 0,
                        fontSize: 10,
                    },
                    track: {
                        width: 22,
                        height: 10,
                        borderRadius: 10,
                        padding: 1,
                    },
                    button: {
                        width: 6,
                        height: 6,
                    },
                    translateX: 12,
                },
                delete: {
                    container: {
                        width: 40,
                        height: 32
                    },
                    button: {
                        width: 10,
                        height: 10
                    }
                },
            }
            case "midhigh": return {
                flex: {
                    height: 24,
                    paddingLeft: 0,
                },
                input: {
                    fontSize: 8,
                },
                svg: {
                    width: 19,
                    height: 24
                },
                toggle: {
                    div: {
                        paddingLeft: 6,
                        paddingRight: 6,
                        gap: 0,
                        fontSize: 10,
                    },
                    track: {
                        width: 18,
                        height: 8,
                        borderRadius: 10,
                        padding: 1,
                    },
                    button: {
                        width: 5,
                        height: 5,
                    },
                    translateX: 9,
                },
                delete: {
                    container: {
                        width: 36,
                        height: 24
                    },
                    button: {
                        width: 12,
                        height: 12
                    }
                },
            }
            case "midlow":
            case "low": return {
                flex: {
                    height: 24,
                    paddingLeft: 0,
                },
                input: {
                    fontSize: 8,
                },
                svg: {
                    width: 19,
                    height: 24
                },
                toggle: {
                    div: {
                        paddingLeft: 6,
                        paddingRight: 6,
                        gap: 0,
                        fontSize: 10,
                    },
                    track: {
                        width: 18,
                        height: 8,
                        borderRadius: 10,
                        padding: 1,
                    },
                    button: {
                        width: 5,
                        height: 5,
                    },
                    translateX: 9,
                },
                delete: {
                    container: {
                        width: 30,
                        height: 24
                    },
                    button: {
                        width: 10,
                        height: 10
                    }
                },
            }
        }
    });

    const effectGroupDescriptionRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const renameProjectOnSever = (async () => {
            if (!effectGroupsRef.current || !projectRef.current) return;
            const newEffectGroupResults: Map<string, LaurusEffectGroupResult> = new Map(effectGroupsRef.current);
            if (effectGroupIdRef
                && effectGroupIdRef.current
                && newEffectGroupResults.has(effectGroupIdRef.current)
                && effectGroupDescriptionDebounce) {
                const newEffectGroup = newEffectGroupResults.get(effectGroupIdRef.current)!;
                newEffectGroup.description = effectGroupDescriptionDebounce;
                const updated = await updateEffectGroup(appState.apiOrigin, appState.accessToken, effectGroupIdRef.current, newEffectGroup);
                if (updated) {
                    dispatch({ type: WorkspaceActionType.SetEffectGroup, value: newEffectGroup });
                }
                else {
                    if (effectGroupDescriptionRef.current) {
                        effectGroupDescriptionRef.current.value = effectGroupDescriptionSnapshot;
                    }
                }
            }
            else if (effectGroupDescriptionDebounce) {
                const newEffectGroup: LaurusEffectGroup = { description: effectGroupDescriptionDebounce, order: 0, project_id: projectRef.current.project_id }
                const created = await createEffectGroup(appState.apiOrigin, appState.accessToken, newEffectGroup);
                if (created) {
                    dispatch({ type: WorkspaceActionType.SetEffectGroup, value: { ...created } });
                }
                else {
                    if (effectGroupDescriptionRef.current) {
                        effectGroupDescriptionRef.current.value = effectGroupDescriptionSnapshot;
                    }
                }
            }
        });
        renameProjectOnSever();
    }, [appState.apiOrigin, effectGroupDescriptionDebounce, dispatch, appState.accessToken, effectGroupDescriptionSnapshot, effectGroupDescriptionRef]);

    const onEffectGroupDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEffectGroups: Map<string, LaurusEffectGroup> = new Map(appState.effectGroups);
        if (effectGroupId && newEffectGroups.has(effectGroupId)) {
            effectGroupIdRef.current = effectGroupId;
            const newEffectGroup = newEffectGroups.get(effectGroupId)!;
            newEffectGroup.description = e.target.value;
        }
        projectRef.current = { ...appState.project };
        effectGroupsRef.current = new Map(appState.effectGroups);
        setEffectGroupDescription(e.target.value);
    };

    const deleteEffectGroupClick = useCallback(async () => {
        if (!isMetaKeyPressed) return;
        const confirmed = confirm("are you sure you want to delete this effect group?");
        if (!confirmed) return;
        const deleted = await deleteEffectGroup(appState.apiOrigin, appState.accessToken, effectGroupId);
        if (deleted) {
            const localEffectGroups = new Map(appState.effectGroups);
            localEffectGroups.delete(effectGroupId);
            const snapshot = [...appState.effects];
            const remainingEffects = snapshot.filter(e => e.value.effect_group_id !== effectGroupId);
            const reindexedEffects = reindexEffects(remainingEffects, localEffectGroups);

            await persistReindexedEffects(appState.apiOrigin, appState.accessToken, reindexedEffects, remainingEffects);

            dispatch({ type: WorkspaceActionType.DeleteEffectGroup, key: effectGroupId });
            dispatch({ type: WorkspaceActionType.SetEffects, value: reindexedEffects });
            setSelectedEffectUnitKeys(prev => {
                const next = new Set(prev);
                snapshot
                    .filter(e => e.value.effect_group_id === effectGroupId)
                    .forEach(e => next.delete(e.key));
                return next;
            });
        }
    }, [appState.accessToken, appState.apiOrigin, appState.effectGroups, appState.effects, dispatch, effectGroupId, isMetaKeyPressed, setSelectedEffectUnitKeys]);

    const [effectGroupDisabled] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (<>
        <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.025)',
            borderRadius: 0,
            ...dynamicSizes.flex
        }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <SvgRepo
                title={"delete effect group"}
                svg={isMetaKeyPressed && isHovered ? circle('rgb(220, 112, 112)') : circle('rgba(255, 255, 255, 0.05)')}
                scale={0.4}
                scaleToContaier={true}
                onContainerClick={deleteEffectGroupClick}
                style={{
                    cursor: isMetaKeyPressed ? 'pointer' : '',
                }}
                containerStyle={{
                    cursor: '',
                    ...dynamicSizes.delete.container,
                }} />
            <input id={`effect-group-description-input-${effectGroupId}`}
                ref={effectGroupDescriptionRef}
                className={dellaRespira.className}
                placeholder="name me..."
                style={{
                    textAlign: "center",
                    letterSpacing: '3px',
                    background: 'none',
                    color: "rgb(227, 227, 227)",
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    ...dynamicSizes.input
                }}
                type="text"
                value={effectGroupDescription}
                onChange={onEffectGroupDescriptionChange}
            />
            <div title="enable effect group" style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                ...dynamicSizes.toggle.div
            }}>
                <Toggle
                    value={!effectGroupDisabled}
                    onClick={() => { }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }}
                    translateX={dynamicSizes.toggle.translateX} />
            </div>
        </div>
    </>)
}

interface EffectsBrowser {
    effect_group_id: string,
    onAddClick: () => void,
}
function EffectsBrowser({ effect_group_id, onAddClick }: EffectsBrowser) {
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

    const onAddEffectClick = useCallback(async (effectName: string) => {
        let newEffectGroupIdAck = "";
        let newProjectIdAck = "";
        if (!appState.project.project_id) {
            const newProject: LaurusProjectResult = { ...appState.project }
            const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
            if (projectCreated) {
                newProjectIdAck = projectCreated.project_id;
                const newProject2: LaurusProjectResult = { ...newProject, project_id: newProjectIdAck }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
            }
        }
        else {
            const newProject: LaurusProjectResult = { ...appState.project }
            const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (projectUpdated) {
                newProjectIdAck = newProject.project_id;
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            }
        }
        if (!newProjectIdAck) return;

        const localEffectGroups = new Map(appState.effectGroups);

        if (!effect_group_id) {
            // coming from an empty project, 
            const newEffectGroup: LaurusEffectGroup = {
                description: "",
                order: 0,
                project_id: newProjectIdAck
            }
            const created = await createEffectGroup(appState.apiOrigin, appState.accessToken, newEffectGroup);
            if (created) {
                newEffectGroupIdAck = created.effect_group_id;
                dispatch({ type: WorkspaceActionType.SetEffectGroup, value: { ...created } });
                localEffectGroups.set(created.effect_group_id, created);
            }
        }
        else {
            newEffectGroupIdAck = effect_group_id;
        }
        if (!newEffectGroupIdAck) return;

        const newOrder = appState.effects.length;

        switch (effectName) {
            case 'scale': {
                const newScale: LaurusScale = {
                    math: new Map(),
                    start: 0,
                    end: 0,
                    project_id: newProjectIdAck,
                    effect_group_id: newEffectGroupIdAck,
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
                    const snapshot = [...appState.effects];
                    const reindexed = reindexEffects([...snapshot, newEffect], localEffectGroups);
                    await persistReindexedEffects(appState.apiOrigin, appState.accessToken, reindexed, [...snapshot, newEffect]);

                    dispatch({ type: WorkspaceActionType.SetEffects, value: reindexed });
                }
                break;
            }
            case 'move': {
                const newMove: LaurusMove = {
                    math: new Map(),
                    start: 0,
                    end: 0,
                    project_id: newProjectIdAck,
                    effect_group_id: newEffectGroupIdAck,
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
                    const snapshot = [...appState.effects];
                    const reindexed = reindexEffects([...snapshot, newEffect], localEffectGroups);
                    await persistReindexedEffects(appState.apiOrigin, appState.accessToken, reindexed, [...snapshot, newEffect]);
                    dispatch({ type: WorkspaceActionType.SetEffects, value: reindexed });
                }
                break;
            }
            case 'rotate': {
                const newRotate: LaurusRotate = {
                    math: new Map(),
                    start: 0,
                    end: 0,
                    project_id: newProjectIdAck,
                    effect_group_id: newEffectGroupIdAck,
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
                    const snapshot = [...appState.effects];
                    const reindexed = reindexEffects([...snapshot, newEffect], localEffectGroups);
                    await persistReindexedEffects(appState.apiOrigin, appState.accessToken, reindexed, [...snapshot, newEffect]);
                    dispatch({ type: WorkspaceActionType.SetEffects, value: reindexed });
                }
                break;
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.effectGroups, appState.effects, appState.fps, appState.project, dispatch, effect_group_id])

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
                                await onAddEffectClick(effectName);
                                onAddClick();
                            }} />}
                    </div>
                );
            })}
        </div>
    </>)
}

interface ControlPanel {
    containerStyle?: CSSProperties
}
function ControlPanel({ containerStyle }: ControlPanel) {
    const { appState, dispatch, handleRewindAll, handlePlayAll, handleFastForwardAll } = useContext(WorkspaceContext);
    const [fastRate] = useState(25);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                padding: 10,
                fpsInputWidth: '2ch',
                fpsInputFontSize: 16,
                fpsLabelFontSize: 15,
                fpsInputGap: 2,
                mainSvg: 50,
                secondarySvg: 20,
                recordingLightSize: 16
            }
            case "midhigh": return {
                padding: 10,
                fpsInputWidth: '2ch',
                fpsInputFontSize: 14,
                fpsLabelFontSize: 13,
                fpsInputGap: 2,
                mainSvg: 40,
                secondarySvg: 16,
                recordingLightSize: 12
            }
            case "midlow":
            case "low": return {
                padding: 10,
                fpsInputWidth: '2ch',
                fpsInputFontSize: 12,
                fpsLabelFontSize: 11,
                fpsInputGap: 2,
                mainSvg: 38,
                secondarySvg: 14,
                recordingLightSize: 11
            }
        }
    });
    const fpsValue = useMemo(() => { return appState.fps ?? "60" }, [appState.fps]);
    return (
        <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            borderTopRightRadius: 10,
            borderTopLeftRadius: 10,
            background: 'rgb(20, 20, 20)',
            padding: dynamicSizes.padding,
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            ...containerStyle,
        }}>
            <div title={"frame rate"} style={{ display: 'flex', gap: dynamicSizes.fpsInputGap }}>
                <input className={dellaRespira.className + ' ' + styles['numberInput']}
                    id={`fps-input`}
                    type="text"
                    autoComplete="off"
                    value={fpsValue}
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
                        lineHeight: '1',
                        display: 'inline-block',
                        overflowX: 'scroll',
                        width: dynamicSizes.fpsInputWidth,
                        fontSize: dynamicSizes.fpsInputFontSize,
                    }}
                />
                <div style={{
                    fontSize: dynamicSizes.fpsLabelFontSize,
                    color: "rgba(255, 255, 255, 0.5)",
                }}>
                    {<i>{'fps'}</i>}
                </div>
            </div>
            <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                <SvgRepo
                    title={"rewind all"}
                    svg={appState.skipPreviousEnabled ? skipPrevious() : skipPrevious('rgba(255, 255, 255, 0.2)')}
                    scale={1}
                    scaleToContaier={true}
                    onContainerClick={handleRewindAll}
                    containerStyle={appState.skipPreviousEnabled ? {
                        width: dynamicSizes.secondarySvg,
                        height: dynamicSizes.secondarySvg
                    } : {
                        cursor: 'progress',
                        width: dynamicSizes.secondarySvg,
                        height: dynamicSizes.secondarySvg
                    }} />
                <SvgRepo
                    title={"play all"}
                    svg={appState.playEnabled ? playArrow() : playArrow('rgba(255, 255, 255, 0.2)')}
                    scale={1}
                    scaleToContaier={true}
                    onContainerClick={handlePlayAll}
                    containerStyle={appState.playEnabled ? {
                        width: dynamicSizes.mainSvg,
                        height: dynamicSizes.mainSvg
                    } : {
                        cursor: 'progress',
                        width: dynamicSizes.mainSvg,
                        height: dynamicSizes.mainSvg
                    }} />
                <SvgRepo
                    title={"fast-forward all"}
                    svg={appState.skipNextEnabled ? skipNext() : skipNext('rgba(255, 255, 255, 0.2)')}
                    scale={1}
                    scaleToContaier={true}
                    onContainerClick={async () => await handleFastForwardAll(fastRate)}
                    containerStyle={appState.skipNextEnabled ? {
                        width: dynamicSizes.secondarySvg,
                        height: dynamicSizes.secondarySvg
                    } : {
                        cursor: 'progress',
                        width: dynamicSizes.secondarySvg,
                        height: dynamicSizes.secondarySvg
                    }} />
            </div>
            <div title={"light"}>
                <div style={{
                    width: dynamicSizes.recordingLightSize,
                    height: dynamicSizes.recordingLightSize,
                    borderRadius: '50%',
                    border: appState.recordingLight ? '1px solid rgb(239, 239, 239)' : '1px solid rgba(255, 255, 255, 0.03)',
                    background: appState.recordingLight ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'rgba(255, 255, 255, 0.03)',
                    boxShadow: appState.recordingLight ? 'rgba(255, 255, 255, 1) 0px 0px 100px 10px' : 'none'
                }} />
            </div>
        </div>
    );
}

interface SelectionControlPanel {
    containerStyle?: CSSProperties
}
function SelectionControlPanel({ containerStyle }: SelectionControlPanel) {
    const { appState, dispatch, } = useContext(WorkspaceContext);
    const { selectedEffectUnitKeys } = useContext(HoverContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                padding: '10px 12px 10px 10px',
                selectedInputWidth: '2ch',
                selectedInputFontSize: 16,
                selectedLabelFontSize: 15,
                mainSvg: 50,
                recordingLightSize: 16,
                input: {
                    fontSize: 12,
                    padding: 10
                },
            }
            case "midhigh": return {
                padding: '10px 12px 10px 10px',
                selectedInputWidth: '2ch',
                selectedInputFontSize: 14,
                selectedLabelFontSize: 13,
                mainSvg: 40,
                recordingLightSize: 12,
                input: {
                    fontSize: 10,
                    padding: 10
                },
            }
            case "midlow":
            case "low": return {
                padding: '10px 12px 10px 10px',
                selectedInputWidth: '2ch',
                selectedInputFontSize: 12,
                selectedLabelFontSize: 11,
                mainSvg: 38,
                recordingLightSize: 11,
                input: {
                    fontSize: 10,
                    padding: 10
                },
            }
        }
    });

    const [effectGroupDescription, setEffectGroupDescription] = useState<string>("");

    const onCreateEffectGroupClick = useCallback(async () => {
        if (selectedEffectUnitKeys.size === 0) return;
        if (!appState.project.project_id) return;
        const newEffectGroup: LaurusEffectGroup = {
            description: effectGroupDescription,
            order: Array.from(appState.effectGroups.values()).reduce((max, g) => Math.max(max, g.order), -1) + 1,
            project_id: appState.project.project_id
        }
        const created = await createEffectGroup(appState.apiOrigin, appState.accessToken, newEffectGroup);
        if (created) {
            dispatch({ type: WorkspaceActionType.SetEffectGroup, value: { ...created } });
            const localEffectGroups = new Map(appState.effectGroups);
            localEffectGroups.set(created.effect_group_id, created);
            const snapshot = [...appState.effects];
            const effectsWithNewGroups = snapshot.map(e => {
                if (selectedEffectUnitKeys.has(e.key)) {
                    return { ...e, value: { ...e.value, effect_group_id: created.effect_group_id } } as LaurusEffect;
                }
                return e;
            });
            const reindexedEffects = reindexEffects(effectsWithNewGroups, localEffectGroups);
            await persistReindexedEffects(appState.apiOrigin, appState.accessToken, reindexedEffects, snapshot);
            dispatch({ type: WorkspaceActionType.SetEffects, value: reindexedEffects });
        }
    }, [selectedEffectUnitKeys, appState.project.project_id, appState.effectGroups, appState.apiOrigin, appState.accessToken, appState.effects, effectGroupDescription, dispatch]);

    return (
        <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            borderTopRightRadius: 10,
            borderTopLeftRadius: 10,
            background: 'rgb(20, 20, 20)',
            padding: dynamicSizes.padding,
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            ...containerStyle,

        }}>
            <div title={"frame rate"} style={{ display: 'flex', }}>
                <input className={dellaRespira.className + ' ' + styles['numberInput']}
                    id={`fps-input`}
                    type="text"
                    disabled
                    autoComplete="off"
                    value={selectedEffectUnitKeys.size.toString()}
                    style={{
                        textAlign: "center",
                        background: 'none',
                        color: "rgb(227, 227, 227)",
                        borderRadius: "2px",
                        border: 'none',
                        outline: 'none',
                        lineHeight: '1',
                        display: 'inline-block',
                        overflowX: 'scroll',
                        width: dynamicSizes.selectedInputWidth,
                        fontSize: dynamicSizes.selectedInputFontSize,
                    }}
                />
                <div style={{
                    fontSize: dynamicSizes.selectedLabelFontSize,
                    color: "rgba(255, 255, 255, 0.5)",
                }}>
                    {<i>{'selected'}</i>}
                </div>
            </div>
            <input id={`new-effect-group-description-input`}
                className={dellaRespira.className}
                placeholder="name me..."
                style={{
                    textAlign: "center",
                    letterSpacing: '3px',
                    background: 'none',
                    color: "rgb(227, 227, 227)",
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    ...dynamicSizes.input
                }}
                type="text"
                value={effectGroupDescription}
                onChange={(e) => {
                    setEffectGroupDescription(e.target.value);
                }} />
            <SvgRepo
                title={"create effect group"}
                svg={addCircle()}
                scale={1.25}
                scaleToContaier={true}
                onContainerClick={onCreateEffectGroupClick}
                style={{
                    cursor: 'pointer',
                }}
                containerStyle={{
                    cursor: '',
                    width: dynamicSizes.recordingLightSize,
                    height: dynamicSizes.mainSvg,
                }} />
        </div>
    );
}
