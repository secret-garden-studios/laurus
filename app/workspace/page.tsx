import { Suspense } from "react";
import Workspace from "./workspace.client";
import {
    EncodedImg_V1_0,
    EncodedSvg_V1_0,
    getEffects,
    getImg,
    getImgDiscoveryPage,
    getMoves,
    getProjects,
    getScales,
    getSvg,
    getSvgDiscoveryPage,
    MoveResult_V1_0,
    ProjectResult_V1_0,
    ScaleResult_V1_0
} from "./workspace.server";
import styles from "../app.module.css";
import { italiana } from "../fonts";
export const dynamic = 'force-dynamic';

export interface ProjectDependencies {
    project: ProjectResult_V1_0,
    scales: ScaleResult_V1_0[],
    moves: MoveResult_V1_0[],
    canvasImgs: EncodedImg_V1_0[],
    canvasSvgs: EncodedSvg_V1_0[],
}
async function fetchMostRecentProject(projects: Promise<ProjectResult_V1_0[] | undefined>) {
    const p = await projects;
    if (p && p.length > 0) {
        const newProject: ProjectResult_V1_0 = p.sort((a, b) =>
            Date.parse(b.last_active) - Date.parse(a.last_active))[0];
        const scales = await getScales(process.env.LAURUS_API, newProject.project_id);
        const moves = await getMoves(process.env.LAURUS_API, newProject.project_id);

        const svgsArray = Array.from(newProject.svgs.values());
        const canvasSvgs: EncodedSvg_V1_0[] = [];
        for (let i = 0; i < svgsArray.length; i++) {
            const svgMediaResult = await getSvg(process.env.LAURUS_API, svgsArray[i].svg_media_id, svgsArray[i].media_path);
            if (svgMediaResult) {
                canvasSvgs.push({ ...svgMediaResult });
            }
        }

        const imgsArray = Array.from(newProject.imgs.values());
        const canvasImgs: EncodedImg_V1_0[] = [];
        for (let i = 0; i < imgsArray.length; i++) {
            const imgMediaResult = await getImg(process.env.LAURUS_API, imgsArray[i].img_media_id, imgsArray[i].media_path);
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
    browserImgs: EncodedImg_V1_0[],
    browserSvgs: EncodedSvg_V1_0[],
}
async function fetchMedia() {
    const pageSize = process.env.MEDIA_PAGE_SIZE ? (parseInt(process.env.MEDIA_PAGE_SIZE) || 10) : 10;
    const imgPageOne = await getImgDiscoveryPage(process.env.LAURUS_API, 1, pageSize);
    const browserImgs: EncodedImg_V1_0[] = [];
    if (imgPageOne && imgPageOne.length > 0) {
        for (let i = 0; i < imgPageOne.length; i++) {
            browserImgs.push({ ...imgPageOne[i] });
        }
    }

    const svgPageOne = await getSvgDiscoveryPage(process.env.LAURUS_API, 1, pageSize);
    const browserSvgs: EncodedSvg_V1_0[] = [];
    if (svgPageOne && svgPageOne.length > 0) {
        for (let i = 0; i < svgPageOne.length; i++) {
            browserSvgs.push({ ...svgPageOne[i] });
        }
    }

    return { browserImgs, browserSvgs }
}

export default function Page() {
    const projects = getProjects(process.env.LAURUS_API);
    const effectsEnum = getEffects(process.env.LAURUS_API);
    const projectDependencies = fetchMostRecentProject(projects);
    const browserDependencies = fetchMedia();
    const mediaPageSize = process.env.MEDIA_PAGE_SIZE;
    const apiOrigin = process.env.LAURUS_API;
    const timelineValues = [30, 60, 90];
    const timelineUnits = ['sec', 'min'];
    return (
        <Suspense fallback={<Skeleton />}>
            <Workspace
                apiOriginInit={apiOrigin}
                mediaPageSizeInit={mediaPageSize}
                effectNamesInitPromise={effectsEnum}
                timelineValuesInit={timelineValues}
                timelineUnitsInit={timelineUnits}
                projectInitPromise={projectDependencies}
                browserInitPromise={browserDependencies}
            />
        </Suspense>
    );
}

function Skeleton() {
    return (<>
        <div
            className={`${styles["animated-grainy-background"]} ${italiana.className}`}
            style={{
                color: 'rgb(239, 239, 239)',
                fontSize: 32,
                letterSpacing: 10,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'progress'
            }}>
            {"Laurus"}
        </div>
    </>)
}