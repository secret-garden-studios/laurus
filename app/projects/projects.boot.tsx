'use client'
import { useState, useLayoutEffect, Suspense } from "react";
import { getScreenResolution } from "../screens/screens-resolution";
import styles from "../app.module.css";
import { italiana } from "../fonts";
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
        <Suspense fallback={<Skeleton />}>
            <Projects
                apiOriginInit={laurusApi}
                projectsPromise={projectsPromise}
                resolutionInit={resolution}
            />
        </Suspense> :
        <Skeleton />
}

function Skeleton() {
    return (<>
        <div
            className={`${styles["noisy-background"]} ${italiana.className}`}
            style={{ cursor: 'progress', width: '100vw', height: '100vh' }} />
    </>)
}