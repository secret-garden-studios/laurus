'use client'

import { useContext } from "react";
import { WorkspaceContext } from "./workspace.client";

export interface Statusbar {
    action: string,
    body: string[],
}
export default function Statusbar({ action, body }: Statusbar) {
    const { appState } = useContext(WorkspaceContext);
    return (
        <>
            <div style={{
                height: `30px`,
                width: "100%",
                display: "flex",
                alignItems: "center",
                left: "0",
                bottom: "0",
                backgroundColor: "#121212ff",
                overflow: "hidden",
                whiteSpace: "nowrap",
                padding: "0px 12px",
                gap: 6
            }}>
                <div style={{
                    fontFamily: "monospace",
                    fontWeight: "bolder",
                    fontSize: "9px",
                }}>{action}</div>
                {body.map((m, i) => {
                    if (i === 0) {
                        return (
                            <div key={i} style={{
                                fontFamily: "monospace",
                                fontWeight: "lighter",
                                fontSize: "9px",
                            }}>
                                {`${m}`}
                            </div>
                        );
                    }
                    else {
                        return (
                            <div key={i} style={{
                                fontFamily: "monospace",
                                fontWeight: "lighter",
                                fontSize: "9px",
                            }}>
                                {`, ${m}`}
                            </div>
                        );
                    }
                })}
                <div style={{
                    marginLeft: "auto",
                    fontFamily: "monospace",
                    fontWeight: "normal",
                    fontSize: "9px",
                }}>
                    {`${appState.resolution.value.width}x${appState.resolution.value.height}`}
                </div>
            </div>
        </>
    );
}
