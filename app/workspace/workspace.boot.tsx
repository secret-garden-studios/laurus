'use client'
import { useState, useLayoutEffect, Suspense } from "react";
import { WorkspaceResolution, getScreenResolution } from "./workspace-resolution";
import Workspace from "./workspace.client";
import {
    getEffects,
    getImg,
    getImgDiscoveryPage,
    getMoves,
    getProjects,
    getScales,
    getSvg,
    getSvgDiscoveryPage,
    ImgMediaResult_V1_0,
    MoveResult_V1_0,
    ProjectResult_V1_0,
    ScaleResult_V1_0,
    SvgMediaResult_V1_0
} from "./workspace.server";
import styles from "../app.module.css";
import { dellaRespira, italiana } from "../fonts";

export interface ProjectDependencies {
    project: ProjectResult_V1_0,
    scales: ScaleResult_V1_0[],
    moves: MoveResult_V1_0[],
    canvasImgs: ImgMediaResult_V1_0[],
    canvasSvgs: SvgMediaResult_V1_0[],
}
async function fetchMostRecentProject(laurusApi: string | undefined, projects: Promise<ProjectResult_V1_0[] | undefined>) {
    const p = await projects;
    if (p && p.length > 0) {
        const newProject: ProjectResult_V1_0 = p.sort((a, b) =>
            Date.parse(b.last_active) - Date.parse(a.last_active))[0];
        const scales = await getScales(laurusApi, newProject.project_id);
        const moves = await getMoves(laurusApi, newProject.project_id);

        const svgsArray = Array.from(newProject.svgs.values());
        const canvasSvgs: SvgMediaResult_V1_0[] = [];
        for (let i = 0; i < svgsArray.length; i++) {
            const svgMediaResult = await getSvg(laurusApi, svgsArray[i].svg_media_id, svgsArray[i].media_path);
            if (svgMediaResult) {
                canvasSvgs.push({ ...svgMediaResult });
            }
        }

        const imgsArray = Array.from(newProject.imgs.values());
        const canvasImgs: ImgMediaResult_V1_0[] = [];
        for (let i = 0; i < imgsArray.length; i++) {
            const imgMediaResult = await getImg(laurusApi, imgsArray[i].img_media_id, imgsArray[i].media_path);
            if (imgMediaResult) {
                canvasImgs.push({ ...imgMediaResult });
            }
        }

        return {
            project: newProject,
            scales: scales ?? [],
            moves: moves ?? [],
            canvasImgs,
            canvasSvgs,
        }
    }
}

export interface BrowserDependencies {
    browserImgs: ImgMediaResult_V1_0[],
    browserSvgs: SvgMediaResult_V1_0[],
}
async function fetchMediaFromServer(laurusApi: string | undefined, pageSize: number) {
    const browserImgs: ImgMediaResult_V1_0[] = [];
    const browserSvgs: SvgMediaResult_V1_0[] = [];

    if (pageSize <= 0) {
        return { browserImgs, browserSvgs }
    }

    const imgPageOne = await getImgDiscoveryPage(laurusApi, pageSize);
    if (imgPageOne && imgPageOne.length > 0) {
        for (let i = 0; i < imgPageOne.length; i++) {
            browserImgs.push({ ...imgPageOne[i] });
        }
    }

    const svgPageOne = await getSvgDiscoveryPage(laurusApi, pageSize);
    if (svgPageOne && svgPageOne.length > 0) {
        for (let i = 0; i < svgPageOne.length; i++) {
            browserSvgs.push({ ...svgPageOne[i] });
        }
    }

    return { browserImgs, browserSvgs }
}

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
    mediaPageSize: string | undefined,
}
export default function WorkspaceBoot({ laurusApi, mediaPageSize }: WorkspaceBoot) {
    const [resolution, setResolution] = useState<WorkspaceResolution | undefined>(undefined)
    useLayoutEffect(() => {
        (() => {
            if (!resolution)
                setResolution(getScreenResolution())
        })();
    });

    const mediaPageSizeInit = mediaPageSize ? (parseInt(mediaPageSize) || 0) : 0;
    const projects = getProjects(laurusApi);
    const effectsEnum = getEffects(laurusApi);
    const projectDependencies = fetchMostRecentProject(laurusApi, projects);
    const browserDependencies = fetchMediaFromServer(laurusApi, mediaPageSizeInit);
    const timelineValues = [30, 60, 90];
    const timelineUnits = ['sec', 'min'];
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