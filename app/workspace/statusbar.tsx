'use client'

import { useContext, useState } from "react";
import { WorkspaceContext } from "./workspace.client";

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
                fontSize: 9,
                padding: "0px 12px",
            }
            case "midhigh": return {
                height: 24,
                fontSize: 8,
                padding: "0px 12px",
            }
            case "midlow":
            case "low": return {
                height: 20,
                fontSize: 7,
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
                backgroundColor: "#121212ff",
                overflow: "hidden",
                whiteSpace: "nowrap",
                padding: statusbarSize.padding,
                gap: 6
            }}>
                <div style={{
                    fontFamily: "monospace",
                    fontWeight: "bolder",
                    fontSize: statusbarSize.fontSize,
                }}>{action}</div>
                {body.map((m, i) => {
                    if (i === 0) {
                        return (
                            <div key={i} style={{
                                fontFamily: "monospace",
                                fontWeight: "lighter",
                                fontSize: statusbarSize.fontSize,
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
                                fontSize: statusbarSize.fontSize,
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
                    fontSize: statusbarSize.fontSize,
                }}>
                    {`${appState.resolution.value.width}x${appState.resolution.value.height}`}
                </div>
            </div>
        </>
    );
}
