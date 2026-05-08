'use client'

import { useState } from "react";
import { dellaRespira } from "../fonts";
import { ScreensResolution } from "./screens-resolution";

export interface Statusbar {
    action: string,
    resolution: ScreensResolution,
}
export default function Statusbar({ action, resolution, }: Statusbar) {

    const [statusbarSize] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                height: 30,
                actionFont: 11,
                bodyFont: 10,
                inputFontSize: 10,
                padding: "0px 12px",
                gap: 10
            }
            case "midhigh": return {
                height: 24,
                actionFont: 9,
                bodyFont: 8,
                inputFontSize: 9,
                padding: "0px 12px",
                gap: 10
            }
            case "midlow":
            case "low": return {
                height: 20,
                actionFont: 8,
                bodyFont: 7,
                inputFontSize: 8,
                padding: "0px 12px",
                gap: 10
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
                gap: statusbarSize.gap
            }}>
                <div
                    className={dellaRespira.className}
                    style={{
                        fontWeight: "bolder",
                        fontSize: statusbarSize.actionFont,
                    }}>
                    {action}
                </div>

                <div
                    title="screen resolution"
                    className={dellaRespira.className}
                    style={{
                        marginLeft: 'auto',
                        fontSize: statusbarSize.bodyFont,
                        letterSpacing: '1px'
                    }}>
                    {`${resolution.value.width}x${resolution.value.height}`}
                </div>
            </div>
        </>
    );
}
