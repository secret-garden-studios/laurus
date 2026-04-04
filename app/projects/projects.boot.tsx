'use client'
import { useState, useLayoutEffect, Suspense } from "react";
import { getScreenResolution } from "../screens/screens-resolution";
import styles from "../app.module.css";
import { dellaRespira, italiana } from "../fonts";
import { ProjectResult_V1_0 } from "./projects.server";
import Projects from "./projects.client";
import { ProjectsResolution } from "./projects-resolution";

interface ProjectsBoot {
    laurusApi: string | undefined,
    projectsPromise: Promise<ProjectResult_V1_0[] | undefined>,
}
export default function ProjectsBoot({
    laurusApi,
    projectsPromise }: ProjectsBoot) {

    const [resolution, setResolution] = useState<ProjectsResolution | undefined>(undefined);

    useLayoutEffect(() => {
        (() => {
            if (!resolution)
                setResolution(getScreenResolution())
        })();
    });

    return resolution ?
        resolution.type != 'low' ?
            <Suspense fallback={<Skeleton />}>
                <Projects
                    apiOriginInit={laurusApi}
                    projectsPromise={projectsPromise}
                    resolutionInit={resolution}
                />
            </Suspense> :
            <Forbidden resolution={resolution} /> :
        <Skeleton />
}

function Skeleton() {
    return (<>
        <div
            className={`${styles["noisy-background"]} ${italiana.className}`}
            style={{ cursor: 'progress', width: '100vw', height: '100vh' }} />
    </>)
}

interface Forbidden { resolution: ProjectsResolution }
function Forbidden({ resolution }: Forbidden) {
    return (<>
        <div
            className={`${styles["noisy-background"]} ${dellaRespira.className}`}
            style={{
                width: '100vw',
                height: '100vh',
                display: 'grid',
                placeContent: 'center',
                letterSpacing: '1px',
            }} >
            <div style={{ display: 'grid', width: '100%', padding: '24px 30px' }}>
                <div className={`${italiana.className}`}
                    style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', padding: "10px 0px" }}>
                    <p style={{ fontSize: 54 }}>{resolution.value.width > 0 ? resolution.value.width : '[undefined]'}</p>
                    <p style={{ fontSize: 38, padding: '0px 10px' }}>{'x'}</p>
                    <p style={{ fontSize: 54 }}>{resolution.value.height > 0 ? resolution.value.height : '[undefined]'}</p>
                    <p style={{ fontSize: 32, padding: '0px 16px' }}>{':('}</p>
                </div>
                <div style={{ fontSize: 18, justifySelf: 'center', padding: 4 }}>
                    <div >{`Your screen is not wide enough to browse projects.`}</div>
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