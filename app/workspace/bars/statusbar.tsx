'use client'

import { RefObject, useContext, useState } from "react";
import { CoreContext, UIContext } from "../workspace.client";
import { dellaRespira, ubuntuMono } from "../../fonts";
import { allOut, autorenew, browse, contentPaste, earthquake, experiment, forward, keyboardCommandKey, lassoSelect, publicIcon, SvgRepo, toysFan } from "../../svg-repo";
import { RiToolsLine } from "react-icons/ri";
import { Tooltip } from "react-tooltip";
import { LaurusFrame } from "../workspace.server";
import { CoreActionType } from "../states/core-state";

export interface Statusbar {
    action: string,
    body: string[],
    framesCacheRef: RefObject<Map<string, LaurusFrame[]>>
}
export default function Statusbar({ action, body, framesCacheRef }: Statusbar) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState } = useContext(UIContext);
    const [statusbarSize] = useState(() => {
        switch (uiState.resolution.type) {
            case "high": return {
                height: 30,
                actionFont: 11,
                bodyFont: 10,
                padding: "0px 12px",
            }
            case "midhigh": return {
                height: 24,
                actionFont: 8,
                bodyFont: 10,
                padding: "0px 12px",
            }
            case "midlow":
            case "low": return {
                height: 20,
                actionFont: 7,
                bodyFont: 10,
                padding: "0px 12px",
            }
        }
    });

    return (
        <>
            <div style={{
                height: statusbarSize.height,
                width: "100%",
                display: "flex",
                alignItems: "center",
                left: "0",
                bottom: "0",
                backgroundColor: "rgb(18, 18, 18)",
                whiteSpace: "nowrap",
                padding: statusbarSize.padding,
                gap: 6,
            }}>
                <div className={dellaRespira.className}
                    style={{
                        fontWeight: "bolder",
                        fontSize: statusbarSize.actionFont,
                    }}>
                    {action}
                </div>
                <div className={ubuntuMono.className}
                    style={{
                        overflowX: 'auto',
                        display: 'flex',
                        fontSize: statusbarSize.bodyFont,
                    }}>
                    {body.map((m, i) => {
                        return (
                            <div
                                key={i} >
                                {`${m} `}
                            </div>
                        );
                    })}
                </div>
                <div
                    title={uiState.effectClipboard ? "" : "clipboard"}
                    data-tooltip-id="clipboard-tooltip-id"
                    style={{
                        marginLeft: "auto",
                        fontSize: statusbarSize.actionFont,
                    }}>
                    <SvgRepo
                        title={uiState.effectClipboard ? "" : "clipboard"}
                        svg={uiState.effectClipboard ? contentPaste() : contentPaste("rgb(62, 62, 62)")}
                        containerStyle={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.5} />
                </div>
                {uiState.effectClipboard &&
                    <>
                        <Tooltip
                            className={dellaRespira.className}
                            id="clipboard-tooltip-id"
                            data-tooltip-place="top-start"
                            style={{
                                backgroundColor: 'rgb(40, 40, 40)',
                                color: 'rgb(227, 227, 227)',
                                fontSize: 14,
                                borderRadius: "8px",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                                maxWidth: "300px",
                            }}
                            render={() => {
                                const clipboardData = uiState.effectClipboard?.value.math.get("clipboard") ?? undefined;
                                return <div style={{ padding: 4, width: '100%' }}>
                                    <SvgRepo
                                        svg={(() => {
                                            switch (uiState.effectClipboard!.type) {
                                                case "scale": return allOut();
                                                case "move": return earthquake();
                                                case "rotate": return toysFan();
                                            }
                                        })()}
                                        containerStyle={{
                                            width: 30,
                                            height: 30
                                        }}
                                        scale={1} />
                                    {clipboardData && <div style={{ margin: '0 0 8px 0', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', padding: 10 }}>
                                        <div>
                                            {JSON.stringify(
                                                clipboardData,
                                                (key, value) => {
                                                    if (key === 'solution' || key === 'input_id') return undefined;
                                                    return value;
                                                },
                                                2)}
                                        </div>
                                    </div>}
                                </div>
                            }} />
                    </>
                }
                <div title={"cache"}
                    onDoubleClick={() => {
                        if (!appState.cacheNeedsRefresh && framesCacheRef.current) {
                            framesCacheRef.current.clear();
                            dispatch({ type: CoreActionType.SetCacheNeedsRefresh, value: true });
                        }
                    }}
                    style={{
                        fontSize: statusbarSize.actionFont,
                    }}>
                    <SvgRepo
                        title={"cache"}
                        svg={!appState.cacheNeedsRefresh ? autorenew() : autorenew("rgb(62, 62, 62)")}
                        containerStyle={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.5} />
                </div>
                <div title={"filled forwards"}
                    style={{
                        fontSize: statusbarSize.actionFont,
                    }}>
                    <SvgRepo
                        title={"filled forwards"}
                        svg={uiState.filledForwards ? forward() : forward("rgb(62, 62, 62)")}
                        containerStyle={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.5} />
                </div>
                <div
                    title="active tool"
                    style={{
                        fontSize: statusbarSize.actionFont,
                    }}>
                    {uiState.tool.type == 'none' ?
                        <div style={{ width: 30, height: 30, display: 'grid', placeContent: 'center' }}>
                            <RiToolsLine size={15} color="rgb(62, 62, 62)" />
                        </div> :
                        <SvgRepo
                            title="active tool"
                            svg={(() => {
                                switch (uiState.tool.type) {
                                    case "marquee": return lassoSelect();
                                    case "contextmenu": return keyboardCommandKey();
                                    case "viewport": return browse();
                                    case "move": return earthquake();
                                    case "scale": return allOut();
                                    case "rotate": return toysFan();
                                    case "mix": return experiment();
                                }
                            })()}
                            containerStyle={{
                                width: 30,
                                height: 30
                            }}
                            scale={0.5} />
                    }
                </div>
                <div title="media source"
                    data-tooltip-id="media-source-tooltip-id"
                    style={{
                        fontSize: statusbarSize.actionFont,
                    }}>
                    <SvgRepo
                        title="media source"
                        svg={appState.project.browse_public_imgs || appState.project.browse_public_svgs ? publicIcon() : publicIcon("rgb(62, 62, 62)")}
                        containerStyle={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.55} />
                </div>
                <Tooltip
                    className={dellaRespira.className}
                    id="media-source-tooltip-id"
                    data-tooltip-place="top-start"
                    style={{
                        backgroundColor: 'rgb(40, 40, 40)',
                        color: 'rgb(227, 227, 227)',
                        fontSize: 14,
                        borderRadius: "8px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                        maxWidth: "300px",
                    }}
                    render={() => {
                        return <div style={{ padding: 4, width: '100%' }}>
                            <div style={{ overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', padding: 10 }}>
                                <div>
                                    {JSON.stringify(
                                        { discoverImgs: appState.project.browse_public_imgs, discoverSvgs: appState.project.browse_public_svgs },
                                        (key, value) => {
                                            return value;
                                        },
                                        2)}
                                </div>
                            </div>
                        </div>
                    }} />
                <div
                    title="screen resolution"
                    className={dellaRespira.className}
                    style={{
                        fontSize: statusbarSize.bodyFont,
                        letterSpacing: '1px',
                        userSelect: 'none',
                        pointerEvents: 'none',
                    }}>
                    {`${uiState.resolution.value.width}x${uiState.resolution.value.height}`}
                </div>
            </div>
        </>
    );
}
