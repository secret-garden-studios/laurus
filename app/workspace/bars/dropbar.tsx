import { useContext, useMemo, useRef, useState, CSSProperties, useCallback } from "react";
import { WorkspaceActionType, WorkspaceContext } from "../workspace.client";
import { lassoSelect, SvgRepo } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import styles from "@/app/app.module.css";

export default function Dropbar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                flex: {
                    gap: 0,
                },
                svgSize: {
                    width: 22,
                    height: 22
                },
                toggle: {
                    div: {
                        paddingLeft: 20,
                        paddingRight: 20,
                        gap: 12,
                        fontSize: 13,
                    },
                    track: {
                        width: 30,
                        height: 16,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 10,
                        height: 10,
                    }
                },
                input: {
                    container: {
                        gap: 10,
                        paddingRight: 20
                    },
                    label: {
                        fontSize: 12
                    },
                    input: {
                        fontSize: 12,
                        padding: 4,
                        letterSpacing: 1,
                    }
                }
            }
            case "midhigh": return {
                flex: {
                    gap: 0,
                },
                svgSize: {
                    width: 18,
                    height: 18
                },
                toggle: {
                    div: {
                        paddingLeft: 14,
                        paddingRight: 14,
                        gap: 8,
                        fontSize: 12,
                    },
                    track: {
                        width: 28,
                        height: 14,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    }
                },
                input: {
                    container: {
                        gap: 10,
                        paddingRight: 14,
                    },
                    label: {
                        fontSize: 11
                    },
                    input: {
                        fontSize: 11,
                        padding: 4,
                        letterSpacing: 1,
                    }
                }
            }
            case "low":
            case "midlow": return {
                flex: {
                    gap: 0,
                },
                svgSize: {
                    width: 20,
                    height: 20
                },
                toggle: {
                    div: {
                        paddingLeft: 16,
                        paddingRight: 16,
                        gap: 12,
                        fontSize: 12,
                    },
                    track: {
                        width: 28,
                        height: 14,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    }
                },
                input: {
                    container: {
                        gap: 10,
                        paddingRight: 16,
                    },
                    label: {
                        fontSize: 11
                    },
                    input: {
                        fontSize: 11,
                        padding: 4,
                        letterSpacing: 1,
                    }
                }
            }
        }
    });

    const xInputRef = useRef<HTMLInputElement | null>(null);
    const yInputRef = useRef<HTMLInputElement | null>(null);
    const wInputRef = useRef<HTMLInputElement | null>(null);
    const hInputRef = useRef<HTMLInputElement | null>(null);

    const isPositionOn = useMemo(() => { return appState.tool.type === 'drop' ? appState.tool.position.value : false; }, [appState.tool]);
    const isSizeOn = useMemo(() => { return appState.tool.type === 'drop' ? appState.tool.size.value : false }, [appState.tool]);
    const xValue = useMemo(() => { return appState.tool.type === 'drop' ? appState.tool.position.x?.toString() ?? "0" : "0" }, [appState.tool]);
    const yValue = useMemo(() => { return appState.tool.type === 'drop' ? appState.tool.position.y?.toString() ?? "0" : "0" }, [appState.tool]);
    const widthValue = useMemo(() => { return appState.tool.type === 'drop' ? appState.tool.size.width?.toString() ?? "0" : "0" }, [appState.tool]);
    const heightValue = useMemo(() => { return appState.tool.type === 'drop' ? appState.tool.size.height?.toString() ?? "0" : "0" }, [appState.tool]);
    const positionInputStyle = useMemo<CSSProperties>(() => {
        return {
            textAlign: "center",
            background: 'none',
            color: isPositionOn ? "inherit" : 'rgb(67,67,67)',
            border: 'none',
            outline: 'none',
            display: 'inline-block',
            overflowX: 'scroll',
            width: '6ch',
            ...dynamicSizes.input.input
        }
    }, [dynamicSizes.input.input, isPositionOn]);
    const sizeInputStyle = useMemo<CSSProperties>(() => {
        return {
            textAlign: "center",
            background: 'none',
            color: isSizeOn ? "inherit" : 'rgb(67,67,67)',
            border: 'none',
            outline: 'none',
            display: 'inline-block',
            overflowX: 'scroll',
            width: '6ch',
            ...dynamicSizes.input.input
        }
    }, [dynamicSizes.input.input, isSizeOn]);

    const updateToolPosition = useCallback(() => {
        if (appState.tool.type === 'drop') {
            const newX = parseFloat(xInputRef.current?.value || "");
            const newY = parseFloat(yInputRef.current?.value || "");
            dispatch({
                type: WorkspaceActionType.SetTool,
                value: {
                    ...appState.tool,
                    position: {
                        ...appState.tool.position,
                        x: isNaN(newX) ? undefined : newX,
                        y: isNaN(newY) ? undefined : newY
                    }
                }
            });
        }
    }, [appState.tool, dispatch]);

    const updateToolSize = useCallback(() => {
        if (appState.tool.type === 'drop') {
            const newWidth: number = parseFloat(wInputRef.current?.value || "");
            const newHeight: number = parseFloat(hInputRef.current?.value || "");
            dispatch({
                type: WorkspaceActionType.SetTool,
                value: {
                    ...appState.tool,
                    size: {
                        ...appState.tool.size,
                        width: isNaN(newWidth) ? undefined : newWidth,
                        height: isNaN(newHeight) ? undefined : newHeight
                    }
                }
            });
        }
    }, [appState.tool, dispatch]);

    return <>
        <div style={
            {
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                overflowX: 'auto',
                ...dynamicSizes.flex,
            }}>
            <SvgRepo
                svg={lassoSelect()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={1}
                scaleToContaier={true} />
            <div style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                ...dynamicSizes.input.container
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                    ...dynamicSizes.toggle.div
                }}>
                    <span style={{ textShadow: isPositionOn ? '0 0 1px rgba(255, 255, 255, 1)' : 'none' }}>
                        {'position'}
                    </span>
                    <Toggle
                        value={isPositionOn}
                        onClick={() => {
                            if (appState.tool.type === 'drop') {
                                const newPositionValue = !isPositionOn;
                                const newX = parseFloat(xInputRef.current?.value || "");
                                const newY = parseFloat(yInputRef.current?.value || "");
                                dispatch({
                                    type: WorkspaceActionType.SetTool,
                                    value: {
                                        ...appState.tool,
                                        position: {
                                            value: newPositionValue,
                                            x: newPositionValue && !isNaN(newX) ? newX : undefined,
                                            y: newPositionValue && !isNaN(newY) ? newY : undefined
                                        },
                                        ...(newPositionValue && { stack: false, select: false}),
                                    },
                                });
                            }
                        }}
                        trackStyles={{ ...dynamicSizes.toggle.track }}
                        buttonStyles={{ ...dynamicSizes.toggle.button }} />
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isPositionOn ? "inherit" : 'rgb(67,67,67)',
                    ...dynamicSizes.input.label
                }}>
                    {'x'}
                </div>
                <input className={styles['numberInput']}
                    id={`${appState.activeElement?.key ?? 'dropbar'}|input|x`}
                    disabled={!isPositionOn}
                    ref={xInputRef}
                    onChange={updateToolPosition}
                    type="text"
                    value={xValue}
                    autoComplete="off"
                    style={positionInputStyle}
                />
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isPositionOn ? "inherit" : 'rgb(67,67,67)',
                    ...dynamicSizes.input.label
                }}>
                    {'y'}
                </div>
                <input className={styles['numberInput']}
                    id={`${appState.activeElement?.key ?? 'dropbar'}|input|y`}
                    disabled={!isPositionOn}
                    ref={yInputRef}
                    onChange={updateToolPosition}
                    type="text"
                    value={yValue}
                    autoComplete="off"
                    style={positionInputStyle}
                />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                ...dynamicSizes.input.container
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                    ...dynamicSizes.toggle.div
                }}>
                    <span style={{ textShadow: isSizeOn ? '0 0 1px rgba(255, 255, 255, 1)' : 'none' }}>
                        {'size'}
                    </span>
                    <Toggle
                        value={isSizeOn}
                        onClick={() => {
                            if (appState.tool.type === 'drop') {
                                const newSizeValue = !isSizeOn;
                                const newWidth = parseFloat(wInputRef.current?.value || "");
                                const newHeight = parseFloat(hInputRef.current?.value || "");
                                dispatch({
                                    type: WorkspaceActionType.SetTool,
                                    value: {
                                        ...appState.tool,
                                        size: {
                                            value: newSizeValue,
                                            width: newSizeValue && !isNaN(newWidth) ? newWidth : undefined,
                                            height: newSizeValue && !isNaN(newHeight) ? newHeight : undefined
                                        },
                                        ...(newSizeValue && { stack: false, select: false}),
                                    }
                                });
                            }
                        }}
                        trackStyles={{ ...dynamicSizes.toggle.track }}
                        buttonStyles={{ ...dynamicSizes.toggle.button }} />
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isSizeOn ? "inherit" : 'rgb(67,67,67)',
                    ...dynamicSizes.input.label
                }}>
                    {'width'}
                </div>
                <input className={styles['numberInput']}
                    id={`${appState.activeElement?.key ?? 'dropbar'}|input|w`}
                    disabled={!isSizeOn}
                    ref={wInputRef}
                    onChange={updateToolSize}
                    type="text"
                    value={widthValue}
                    autoComplete="off"
                    style={sizeInputStyle}
                />
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: isSizeOn ? "inherit" : 'rgb(67,67,67)',
                    ...dynamicSizes.input.label
                }}>
                    {'height'}
                </div>
                <input className={styles['numberInput']}
                    id={`${appState.activeElement?.key ?? 'dropbar'}|input|h`}
                    disabled={!isSizeOn}
                    ref={hInputRef}
                    onChange={updateToolSize}
                    type="text"
                    value={heightValue}
                    autoComplete="off"
                    style={sizeInputStyle}
                />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                ...dynamicSizes.toggle.div
            }}>
                <span style={{ textShadow: (appState.tool.type === 'drop' && appState.tool.stack) ? '0 0 1px rgba(255, 255, 255, 1)' : 'none' }}>
                    {'stack'}
                </span>
                <Toggle
                    value={appState.tool.type === 'drop' ? appState.tool.stack : false}
                    onClick={() => {
                        const currentTool = { ...appState.tool };
                        if (currentTool.type === 'drop') {
                            const newStack = !currentTool.stack;
                            const newValue = newStack ? {
                                ...currentTool,
                                stack: newStack,
                                select: false,
                                position: {
                                    value: false,
                                    x: undefined,
                                    y: undefined
                                },
                                size: {
                                    value: false,
                                    width: undefined,
                                    height: undefined
                                }
                            } : {
                                ...currentTool,
                                stack: newStack
                            };
                            dispatch({
                                type: WorkspaceActionType.SetTool,
                                value: newValue
                            });
                        }
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }} />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                ...dynamicSizes.toggle.div
            }}>
                <span style={{ textShadow: (appState.tool.type === 'drop' && appState.tool.select) ? '0 0 1px rgba(255, 255, 255, 1)' : 'none' }}>
                    {'select'}
                </span>
                <Toggle
                    value={appState.tool.type === 'drop' ? appState.tool.select : false}
                    onClick={() => {
                        const currentTool = { ...appState.tool };
                        if (currentTool.type === 'drop') {
                            const newSelect = !currentTool.select;
                            const newValue = newSelect ? {
                                ...currentTool,
                                select: newSelect,
                                stack: false,
                                position: {
                                    value: false,
                                    x: undefined,
                                    y: undefined
                                },
                                size: {
                                    value: false,
                                    width: undefined,
                                    height: undefined
                                }
                            } : {
                                ...currentTool,
                                select: newSelect
                            };
                            dispatch({
                                type: WorkspaceActionType.SetTool,
                                value: newValue
                            });
                        }
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }} />
            </div>
        </div>
    </>
}
