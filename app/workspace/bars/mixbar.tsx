import { geistMono } from "@/app/fonts";
import { SvgRepo, allOut, arrowDownwardAlt, check, circle, earthquake, experiment, toysFan } from "@/app/svg-repo";
import { useContext, useEffect, useMemo, useState } from "react";
import { UIContext, CoreContext } from "../workspace.client";
import styles from "@/app/app.module.css";
import { LaurusEffect, LaurusMixState, LaurusMoveResult, LaurusRotateResult, LaurusScaleResult, updateMove, updateRotate, updateScale } from "../workspace.server";
import { UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

export default function Mixbar() {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const [dynamicSizes] = useState(() => {
        switch (uiState.resolution.type) {
            case "high": return {
                container: {
                    height: 50,
                    fontSize: 14,
                    padding: '0px 0px 0px 10px',
                    letterSpacing: 0,
                },
                paramSize: {
                    containerHeight: 38,
                    containerWidth: 190,
                    capWidth: 17,
                    capHeight: 17,
                    capBorderOffset: 0,
                    trackHeight: 1,
                    tickHeight: 0,
                    tickLeft: 2,
                    svgSize: { width: 24, height: 24 }
                },
                svgSize: {
                    width: 20,
                    height: 20
                },
                unitFontSize: 11,
                input: {
                    fontSize: 13,
                    width: '4ch',
                    padding: 0
                },
                grid: {
                    gap: 10
                },
                effectBrowser: {
                    height: 96,
                    itemFontSize: 14,
                    itemHeight: 36,
                    itemPadding: '0px 10px',
                    svg: 20,
                }
            }
            case "midhigh": return {
                container: {
                    height: 40,
                    fontSize: 11,
                    padding: '0px 0px 0px 10px',
                    letterSpacing: 0,
                },
                paramSize: {
                    capWidth: 13,
                    capHeight: 13,
                    capBorderOffset: 0,
                    containerWidth: 170,
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 1,
                    svgSize: { width: 20, height: 20 }
                },
                svgSize: {
                    width: 18,
                    height: 18
                },
                unitFontSize: 10,
                input: {
                    fontSize: 11,
                    width: '4ch',
                    padding: 0
                },
                grid: {
                    gap: 10
                },
                effectBrowser: {
                    height: 96,
                    itemFontSize: 12,
                    itemHeight: 36,
                    itemPadding: '0px 10px',
                    svg: 16,
                }
            }
            case "midlow":
            case "low": return {
                container: {
                    height: 38,
                    fontSize: 11,
                    padding: '0px 0px 0px 10px',
                    letterSpacing: 0,
                },
                paramSize: {
                    capWidth: 13,
                    capHeight: 13,
                    capBorderOffset: 0,
                    containerWidth: 170,
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 1,
                    svgSize: { width: 20, height: 20 }
                },
                svgSize: {
                    width: 20,
                    height: 20
                },
                unitFontSize: 11,
                input: {
                    fontSize: 13,
                    width: '4ch',
                    padding: 0
                },
                grid: {
                    gap: 10
                },
                effectBrowser: {
                    height: 96,
                    itemFontSize: 10,
                    itemHeight: 32,
                    itemPadding: '0px 8px',
                    svg: 14,
                }
            }
        }
    });
    const [selectedEffectType, setSelectedEffectType] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [prevEffects, setPrevEffects] = useState<LaurusEffect[]>(() => { return [...appState.effects] });
    const createMenuSelectHeader = 'scroll down and select an effect type';
    const updateMenuSelectHeader = 'scroll down and select an effect type';

    const selectedMixablesCount = useMemo(() => {
        return appState.effects.filter(e => uiState.mixableEffects.includes(e.type) && e.value.mixState === LaurusMixState.Selected).length;
    }, [appState.effects, uiState.mixableEffects]);

    const someActiveMixables = useMemo(() => {
        return appState.effects.some(e => uiState.mixableEffects.includes(e.type) && e.value.mixState === LaurusMixState.Active);
    }, [appState.effects, uiState.mixableEffects]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }
            if (event.key === 'Escape') {
                if (selectedEffectType && !isSaving) {
                    dispatch({ type: CoreActionType.SetEffects, value: prevEffects });
                    setSelectedEffectType("");
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [appState.effects, dispatch, uiState.mixableEffects, selectedEffectType, prevEffects, isSaving]);

    return <>
        <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            overflowX: 'auto',
            userSelect: 'none',
            ...dynamicSizes.grid
        }}>
            <SvgRepo
                svg={experiment()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={1}
                scaleToContaier={true} />

            {/* create menu */}
            {(!selectedEffectType && !someActiveMixables) && <>
                <SelectionMenu
                    selectHeader={createMenuSelectHeader}
                    setSelectedEffectType={setSelectedEffectType}
                    setSnapshot={setPrevEffects} />
            </>}

            {/* form */}
            {(selectedEffectType && !someActiveMixables) && <>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    height: '100%',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', letterSpacing: 1, padding: '0px 10px' }}>
                        <div style={{ textWrap: 'nowrap', paddingRight: 6 }}>{'edit your mix using the flashing flasks'}</div>
                        <SvgRepo
                            svg={experiment()}
                            containerStyle={{
                                width: 20,
                                height: 20,
                                transition: 'all 0.2s ease-out',
                                animation: `${styles['pulse-opacity']} 1.5s infinite`,
                            }}
                            scale={1}
                            scaleToContaier={true} />
                        <div style={{ textWrap: 'nowrap', padding: '0 6px' }}>{`then click`}</div>
                        <SvgRepo
                            svg={check()}
                            containerStyle={{
                                width: dynamicSizes.effectBrowser.svg,
                                height: dynamicSizes.effectBrowser.svg,
                            }}
                            scale={0.9}
                            scaleToContaier={true} />
                        <div style={{ textWrap: 'nowrap', paddingLeft: 6 }}>{`to confirm`}</div>
                    </div>
                    <div title="mix count"
                        style={{
                            display: 'flex',
                            width: dynamicSizes.container.height,
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            letterSpacing: 1,
                            paddingLeft: 10,
                            paddingRight: 10,
                            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                        }}>
                        <div className={geistMono.className} style={{ textWrap: 'nowrap' }}>{selectedMixablesCount}</div>
                    </div>
                    <div title="save mix"
                        style={{
                            width: dynamicSizes.container.height,
                            display: 'flex',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            letterSpacing: 1,
                            cursor: 'pointer',
                            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                        }}>
                        <SvgRepo
                            title="save mix"
                            svg={check()}
                            containerStyle={{
                                width: dynamicSizes.effectBrowser.svg,
                                height: dynamicSizes.effectBrowser.svg,
                            }}
                            scale={1}
                            scaleToContaier={true}
                            onContainerClick={async () => {
                                if (!uiState.mixableEffects.includes(selectedEffectType)) return;
                                setIsSaving(true);
                                try {
                                    const snapshot: LaurusEffect[] = [...appState.effects];
                                    const newEffects: LaurusEffect[] = snapshot.map(e => {
                                        if (e.type === selectedEffectType && uiState.mixableEffects.includes(e.type)) {
                                            const newMixState: LaurusMixState = e.value.mixState === LaurusMixState.Selected ? LaurusMixState.Active : LaurusMixState.None;
                                            const newMix: boolean = newMixState == LaurusMixState.Active ? true : false;
                                            switch (e.type) {
                                                case "move": return { ...e, value: { ...e.value, mixState: newMixState, mix: newMix } } as LaurusEffect;
                                                case "rotate": return { ...e, value: { ...e.value, mixState: newMixState, mix: newMix } } as LaurusEffect;
                                                case "scale": return { ...e, value: { ...e.value, mixState: newMixState, mix: newMix } } as LaurusEffect;
                                            }
                                        }
                                        return e;
                                    });
                                    let updateCount = 0;
                                    for (let i = 0; i < newEffects.length; i++) {
                                        const e = newEffects[i];
                                        if (e.type === selectedEffectType && uiState.mixableEffects.includes(e.type)) {
                                            let updated = false;
                                            switch (e.type) {
                                                case "move": {
                                                    updated = await updateMove(appState.apiOrigin, appState.accessToken, e.key, { ...e.value });
                                                    break;
                                                }
                                                case "rotate": {
                                                    updated = await updateRotate(appState.apiOrigin, appState.accessToken, e.key, { ...e.value });
                                                    break;
                                                }
                                                case "scale": {
                                                    updated = await updateScale(appState.apiOrigin, appState.accessToken, e.key, { ...e.value });
                                                    break;
                                                }
                                            }
                                            if (updated) {
                                                updateCount++;
                                            }
                                        }
                                    }
                                    if (updateCount > 0) {
                                        dispatch({ type: CoreActionType.SetEffects, value: newEffects });
                                    }
                                    else {
                                        dispatch({ type: CoreActionType.SetEffects, value: prevEffects });
                                    }
                                } catch (error) {
                                    console.error("Failed to save mix", error);
                                    dispatch({ type: CoreActionType.SetEffects, value: prevEffects });
                                } finally {
                                    setSelectedEffectType("");
                                    setIsSaving(false);
                                    uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                                }
                            }} />
                    </div>
                </div>
            </>}

            {/* update menu */}
            {someActiveMixables && <>
                <SelectionMenu
                    selectHeader={updateMenuSelectHeader}
                    setSelectedEffectType={setSelectedEffectType}
                    setSnapshot={setPrevEffects} />
            </>}
        </div>
    </>
}

interface SelectionMenu {
    selectHeader: string,
    setSelectedEffectType: React.Dispatch<React.SetStateAction<string>>,
    setSnapshot: React.Dispatch<React.SetStateAction<LaurusEffect[]>>,
}
function SelectionMenu({ selectHeader, setSelectedEffectType, setSnapshot }: SelectionMenu) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState } = useContext(UIContext);
    const selectList = useMemo(() => {
        const prioritySet = new Set<string>(uiState.mixableEffects);
        const effectNames = uiState.effectNames
            .filter(e => e != 'skew')
            .sort((a, b) => {
                const hasA = prioritySet.has(a) ? 1 : 0;
                const hasB = prioritySet.has(b) ? 1 : 0;
                return hasB - hasA;
            });
        return [selectHeader, ...effectNames];
    }, [uiState.effectNames, uiState.mixableEffects, selectHeader]);

    const [dynamicSizes] = useState(() => {
        switch (uiState.resolution.type) {
            case "high": return {
                effectBrowser: {
                    height: 96,
                    itemFontSize: 14,
                    itemHeight: 36,
                    itemPadding: '0px 10px',
                    svg: 20,
                }
            }
            case "midhigh": return {
                effectBrowser: {
                    height: 96,
                    itemFontSize: 12,
                    itemHeight: 36,
                    itemPadding: '0px 10px',
                    svg: 16,
                }
            }
            case "midlow":
            case "low": return {
                effectBrowser: {
                    height: 96,
                    itemFontSize: 10,
                    itemHeight: 32,
                    itemPadding: '0px 8px',
                    svg: 14,
                }
            }
        }
    });

    return <>
        <div style={{
            width: '100%',
            padding: '0px 0px',
            height: '100%',
            overflowY: 'auto',
            textWrap: 'nowrap',
        }}>
            {selectList.map((selectOption) => {
                return (
                    <div key={selectOption}
                        className={styles[uiState.mixableEffects.includes(selectOption) ? 'animated-nav-dark' : '']}
                        onMouseEnter={(e) => {
                            if (!uiState.mixableEffects.includes(selectOption)) return;
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            if (!uiState.mixableEffects.includes(selectOption)) return;
                            e.currentTarget.style.background = 'none';
                        }}
                        onClick={(e) => {
                            e.currentTarget.style.background = 'none';
                            if (!uiState.mixableEffects.includes(selectOption)) return;
                            const newSelectedEffectType = selectOption;
                            const snapshot: LaurusEffect[] = [...appState.effects];
                            const newEffects: LaurusEffect[] = [];
                            snapshot
                                .forEach(e => {
                                    const i = newEffects.findIndex(ne => ne.key == e.key);
                                    if (e.type === newSelectedEffectType && uiState.mixableEffects.includes(e.type)) {
                                        const newMixState = e.value.mixState === LaurusMixState.Active ? LaurusMixState.Selected : LaurusMixState.Waiting;
                                        const newEffect = (() => {
                                            switch (e.type) {
                                                case "move": return { ...e, value: { ...e.value, mixState: newMixState } as LaurusMoveResult };
                                                case "rotate": return { ...e, value: { ...e.value, mixState: newMixState } as LaurusRotateResult };
                                                case "scale": return { ...e, value: { ...e.value, mixState: newMixState } as LaurusScaleResult };
                                            }
                                        })();
                                        if (i > -1) {
                                            newEffects[i] = newEffect;
                                        }
                                        else {
                                            newEffects.push(newEffect);
                                        }
                                    }
                                    else if (i < 0) {
                                        newEffects.push(e);
                                    }
                                });
                            dispatch({ type: CoreActionType.SetEffects, value: newEffects });
                            setSelectedEffectType(newSelectedEffectType);
                            setSnapshot(snapshot);
                        }}
                        style={{
                            cursor: !uiState.mixableEffects.includes(selectOption) ? '' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: dynamicSizes.effectBrowser.itemFontSize,
                            letterSpacing: 2,
                            height: '100%',
                            padding: dynamicSizes.effectBrowser.itemPadding,
                            borderRadius: 0,
                            color: uiState.mixableEffects.includes(selectOption) || selectOption == selectHeader ? 'rgb(227,227,227)' : 'rgba(255, 255, 255, 0.3)',
                        }}>
                        <div >
                            {selectOption}
                        </div>
                        {<SvgRepo
                            svg={(() => {
                                switch (selectOption) {
                                    case selectHeader: return arrowDownwardAlt();
                                    case "scale": return uiState.mixableEffects.includes(selectOption) ? allOut() : allOut("rgb(67,67,67)");
                                    case "move": return uiState.mixableEffects.includes(selectOption) ? earthquake() : earthquake("rgb(67,67,67)");
                                    case "rotate": return uiState.mixableEffects.includes(selectOption) ? toysFan() : toysFan("rgb(67,67,67)");
                                    default: return circle('rgba(0,0,0,0)')
                                }
                            })()}
                            containerStyle={{
                                width: dynamicSizes.effectBrowser.svg,
                                height: dynamicSizes.effectBrowser.svg
                            }}
                            scale={selectOption == selectHeader ? 0.9 : 0.7}
                            scaleToContaier={true} />}
                        <div style={{ marginLeft: 'auto' }} />
                    </div>
                );
            })}
        </div>
    </>
}
