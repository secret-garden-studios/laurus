'use client'
import { useState, useLayoutEffect, Suspense } from "react";
import { WorkspaceResolution, getScreenResolution } from "./workspace-resolution";
import Workspace from "./workspace.client";
import styles from "../app.module.css";
import { dellaRespira, italiana } from "../fonts";
import { BrowserDependencies, ProjectDependencies } from "./page";

function Skeleton() {
    return (<>
        <div
            className={`${styles["animated-grainy-background"]} ${italiana.className}`}
            style={{ width: '100vw', height: '100vh' }} />
    </>)
}

interface Forbidden { resolution: WorkspaceResolution }
function Forbidden({ resolution }: Forbidden) {
    return (<>
        <div
            className={`${styles["animated-grainy-background"]} ${dellaRespira.className}`}
            style={{
                width: '100vw', height: '100vh',
                display: 'grid',
                placeContent: 'center',
                letterSpacing: '1px',
            }} >
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div className={`${italiana.className}`}
                    style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', padding: "10px 0px" }}>
                    <p style={{ fontSize: 54 }}>{resolution.value.width > 0 ? resolution.value.width : '[undefined]'}</p>
                    <p style={{ fontSize: 38, padding: '0px 10px' }}>{'x'}</p>
                    <p style={{ fontSize: 54 }}>{resolution.value.height > 0 ? resolution.value.height : '[undefined]'}</p>
                    <p style={{ fontSize: 32, padding: '0px 16px' }}>{':('}</p>
                </div>
                <div style={{ fontSize: 18, justifySelf: 'center', padding: 4 }}>
                    <div >{`Your screen is not wide enough for the workspace.`}</div>
                </div>
                <div style={{ fontSize: 12, justifySelf: 'center', padding: 4, marginTop: 20 }}>
                    <div >{`To use this page effectively your screen width must be greater than 1280 pixels.`}</div>
                </div>
                <div style={{ fontSize: 12, justifySelf: 'center', padding: 4, marginTop: 6 }}>
                    <div >{`If this is not a mobile device try adjusting your display scaling settings.`}</div>
                </div>
            </div>
        </div>
    </>)
}

interface WorkspaceBoot {
    laurusApi: string | undefined
    mediaPageSizeInit: number,
    effectsEnum: Promise<string[] | undefined>,
    projectDependencies: Promise<ProjectDependencies | undefined>,
    browserDependencies: Promise<BrowserDependencies>,
}
export default function WorkspaceBoot({
    laurusApi,
    mediaPageSizeInit,
    effectsEnum,
    projectDependencies,
    browserDependencies }: WorkspaceBoot) {

    const [resolution, setResolution] = useState<WorkspaceResolution | undefined>(undefined);
    const timelineValues = [30, 60, 90];
    const timelineUnits = ['sec', 'min'];

    useLayoutEffect(() => {
        (() => {
            if (!resolution)
                setResolution(getScreenResolution())
        })();
    });

    return resolution ?
        resolution.type != 'low' ?
            <Suspense fallback={<Skeleton />}>
                <Workspace
                    apiOriginInit={laurusApi}
                    mediaPageSizeInit={mediaPageSizeInit}
                    effectNamesInitPromise={effectsEnum}
                    timelineValuesInit={timelineValues}
                    timelineUnitsInit={timelineUnits}
                    projectInitPromise={projectDependencies}
                    browserInitPromise={browserDependencies}
                    resolutionInit={resolution}
                />
            </Suspense> :
            <Forbidden resolution={resolution} /> :
        <Skeleton />
}