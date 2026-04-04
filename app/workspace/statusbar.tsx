'use client'

import { useContext, useState } from "react";
import { WorkspaceContext } from "./workspace.client";
import { dellaRespira, ubuntuMono } from "../fonts";
import { allOut, browse, contentPaste, deployedCode, earthquake, folder, lassoSelect, SvgRepo } from "../svg-repo";
import { RiToolsLine } from "react-icons/ri";
import { Tooltip } from "react-tooltip";

export interface Statusbar {
    action: string,
    body: string[],
}
export default function Statusbar({ action, body }: Statusbar) {
    const { appState } = useContext(WorkspaceContext);

    const [statusbarSize] = useState(() => {
        switch (appState.resolution.type) {
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
            <div
                style={{
                    height: statusbarSize.height,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    left: "0",
                    bottom: "0",
                    backgroundColor: "#121212ff",
                    whiteSpace: "nowrap",
                    padding: statusbarSize.padding,
                    gap: 6,
                }}>
                <div
                    title="page"
                    className={dellaRespira.className}
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
                    title={appState.effectClipboard ? "" : "clipboard"}
                    data-tooltip-id="clipboard-tooltip-id"
                    style={{
                        marginLeft: "auto",
                        fontSize: statusbarSize.actionFont,
                    }}>
                    <SvgRepo
                        title={appState.effectClipboard ? "" : "clipboard"}
                        svg={appState.effectClipboard ? contentPaste() : contentPaste("rgb(62, 62, 62)")}
                        containerSize={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.5} />
                </div>
                {appState.effectClipboard &&
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
                                const clipboardData = appState.effectClipboard?.value.math.get("clipboard") ?? undefined;
                                return <div style={{ padding: 4, width: '100%' }}>
                                    <div
                                        className={dellaRespira.className}
                                        style={{ display: 'grid', placeContent: 'center' }}>
                                        <SvgRepo
                                            svg={(() => {
                                                switch (appState.effectClipboard!.type) {
                                                    case "scale": return allOut();
                                                    case "move": return earthquake();
                                                }
                                            })()}
                                            containerSize={{
                                                width: 30,
                                                height: 30
                                            }}
                                            scale={1} />
                                    </div>
                                    {clipboardData && <div style={{ margin: '0 0 8px 0', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', padding: 10 }}>
                                        <div>
                                            {JSON.stringify(
                                                clipboardData,
                                                (key, value) => {
                                                    if (key === 'solution' || key === 'input_id' || key === 'loop') return undefined;
                                                    return value;
                                                },
                                                2)}
                                        </div>
                                    </div>}
                                </div>
                            }} />
                    </>
                }
                <div
                    title="active tool"
                    style={{
                        fontSize: statusbarSize.actionFont,
                    }}>
                    {appState.tool.type == 'none' ?
                        <div style={{ width: 30, height: 30, display: 'grid', placeContent: 'center' }}>
                            <RiToolsLine size={15} color="rgb(62, 62, 62)" />
                        </div> :
                        <SvgRepo
                            title="active tool"
                            svg={(() => {
                                switch (appState.tool.type) {
                                    case "drop": return lassoSelect();
                                    case "activate": return deployedCode();
                                    case "viewport": return browse();
                                }
                            })()}
                            containerSize={{
                                width: 30,
                                height: 30
                            }}
                            scale={0.5} />
                    }
                </div>
                <div
                    title="media source"
                    style={{
                        fontSize: statusbarSize.actionFont,
                    }}>
                    <SvgRepo
                        title="media source"
                        svg={folder("rgb(62, 62, 62)")}
                        containerSize={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.5} />
                </div>
                <div
                    title="screen resolution"
                    className={dellaRespira.className}
                    style={{
                        fontSize: statusbarSize.bodyFont,
                        letterSpacing: '1px'
                    }}>
                    {`${appState.resolution.value.width}x${appState.resolution.value.height}`}
                </div>
            </div>
        </>
    );
}
