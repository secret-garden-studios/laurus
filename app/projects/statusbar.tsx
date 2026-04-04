import { useState } from "react";
import { ProjectsResolution } from "./projects-resolution";
import { dellaRespira, ubuntuMono } from "../fonts";

export interface Statusbar {
    action: string,
    body: string[],
    resolution: ProjectsResolution,
}
export default function Statusbar({ action, body, resolution }: Statusbar) {

    const [statusbarSize] = useState(() => {
        switch (resolution.type) {
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

    return <>
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
}