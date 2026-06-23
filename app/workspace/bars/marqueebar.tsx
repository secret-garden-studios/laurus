import { useContext, useMemo, useRef, useState, CSSProperties, useCallback } from "react";
import { UIContext } from "../workspace.client";
import { lassoSelect, SvgRepo } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import styles from "@/app/app.module.css";
import { UIActionType } from "../states/ui-state";

export default function Marqueebar() {
    const { uiState, uiDispatch } = useContext(UIContext);
    const [dynamicSizes] = useState(() => {
        switch (uiState.resolution.type) {
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
                        width: 26,
                        height: 12,
                        borderRadius: 10,
                        padding: 1,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    },
                    translateX: 14,
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
                        width: 20,
                        height: 9,
                        borderRadius: 10,
                        padding: 1,
                    },
                    button: {
                        width: 6,
                        height: 6,
                    },
                    translateX: 10,
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

    const isPositionOn = useMemo(() => { return uiState.tool.type === 'marquee' ? uiState.tool.position.value : false; }, [uiState.tool]);
    const isSizeOn = useMemo(() => { return uiState.tool.type === 'marquee' ? uiState.tool.size.value : false }, [uiState.tool]);
    const xValue = useMemo(() => { return uiState.tool.type === 'marquee' ? uiState.tool.position.x?.toString() ?? "0" : "0" }, [uiState.tool]);
    const yValue = useMemo(() => { return uiState.tool.type === 'marquee' ? uiState.tool.position.y?.toString() ?? "0" : "0" }, [uiState.tool]);
    const widthValue = useMemo(() => { return uiState.tool.type === 'marquee' ? uiState.tool.size.width?.toString() ?? "0" : "0" }, [uiState.tool]);
    const heightValue = useMemo(() => { return uiState.tool.type === 'marquee' ? uiState.tool.size.height?.toString() ?? "0" : "0" }, [uiState.tool]);
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
        if (uiState.tool.type === 'marquee') {
            const newX = parseFloat(xInputRef.current?.value || "");
            const newY = parseFloat(yInputRef.current?.value || "");
            uiDispatch({
                type: UIActionType.SetTool,
                value: {
                    ...uiState.tool,
                    position: {
                        ...uiState.tool.position,
                        x: isNaN(newX) ? undefined : newX,
                        y: isNaN(newY) ? undefined : newY
                    }
                }
            });
        }
    }, [uiState.tool, uiDispatch]);

    const updateToolSize = useCallback(() => {
        if (uiState.tool.type === 'marquee') {
            const newWidth: number = parseFloat(wInputRef.current?.value || "");
            const newHeight: number = parseFloat(hInputRef.current?.value || "");
            uiDispatch({
                type: UIActionType.SetTool,
                value: {
                    ...uiState.tool,
                    size: {
                        ...uiState.tool.size,
                        width: isNaN(newWidth) ? undefined : newWidth,
                        height: isNaN(newHeight) ? undefined : newHeight
                    }
                }
            });
        }
    }, [uiState.tool, uiDispatch]);

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
                            if (uiState.tool.type === 'marquee') {
                                const newPositionValue = !isPositionOn;
                                const newX = parseFloat(xInputRef.current?.value || "");
                                const newY = parseFloat(yInputRef.current?.value || "");
                                uiDispatch({
                                    type: UIActionType.SetTool,
                                    value: {
                                        ...uiState.tool,
                                        position: {
                                            value: newPositionValue,
                                            x: newPositionValue && !isNaN(newX) ? newX : undefined,
                                            y: newPositionValue && !isNaN(newY) ? newY : undefined
                                        },
                                        ...(newPositionValue && { stack: false, select: false }),
                                    },
                                });
                            }
                        }}
                        trackStyles={{ ...dynamicSizes.toggle.track }}
                        buttonStyles={{ ...dynamicSizes.toggle.button }}
                        translateX={dynamicSizes.toggle.translateX} />
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
                    id={`${uiState.activeElement?.key ?? 'marqueebar'}|input|x`}
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
                    id={`${uiState.activeElement?.key ?? 'marqueebar'}|input|y`}
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
                            if (uiState.tool.type === 'marquee') {
                                const newSizeValue = !isSizeOn;
                                const newWidth = parseFloat(wInputRef.current?.value || "");
                                const newHeight = parseFloat(hInputRef.current?.value || "");
                                uiDispatch({
                                    type: UIActionType.SetTool,
                                    value: {
                                        ...uiState.tool,
                                        size: {
                                            value: newSizeValue,
                                            width: newSizeValue && !isNaN(newWidth) ? newWidth : undefined,
                                            height: newSizeValue && !isNaN(newHeight) ? newHeight : undefined
                                        },
                                        ...(newSizeValue && { stack: false, select: false }),
                                    }
                                });
                            }
                        }}
                        trackStyles={{ ...dynamicSizes.toggle.track }}
                        buttonStyles={{ ...dynamicSizes.toggle.button }}
                        translateX={dynamicSizes.toggle.translateX} />
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
                    id={`${uiState.activeElement?.key ?? 'marqueebar'}|input|w`}
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
                    id={`${uiState.activeElement?.key ?? 'marqueebar'}|input|h`}
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
                <span style={{ textShadow: (uiState.tool.type === 'marquee' && uiState.tool.stack) ? '0 0 1px rgba(255, 255, 255, 1)' : 'none' }}>
                    {'stack'}
                </span>
                <Toggle
                    value={uiState.tool.type === 'marquee' ? uiState.tool.stack : false}
                    onClick={() => {
                        const currentTool = { ...uiState.tool };
                        if (currentTool.type === 'marquee') {
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
                            uiDispatch({
                                type: UIActionType.SetTool,
                                value: newValue
                            });
                        }
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }}
                    translateX={dynamicSizes.toggle.translateX} />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                ...dynamicSizes.toggle.div
            }}>
                <span style={{ textShadow: (uiState.tool.type === 'marquee' && uiState.tool.select) ? '0 0 1px rgba(255, 255, 255, 1)' : 'none' }}>
                    {'select'}
                </span>
                <Toggle
                    value={uiState.tool.type === 'marquee' ? uiState.tool.select : false}
                    onClick={() => {
                        const currentTool = { ...uiState.tool };
                        if (currentTool.type === 'marquee') {
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
                            uiDispatch({
                                type: UIActionType.SetTool,
                                value: newValue
                            });
                        }
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }}
                    translateX={dynamicSizes.toggle.translateX} />
            </div>
        </div>
    </>
}
