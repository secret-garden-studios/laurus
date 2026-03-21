import WorkspaceBoot from "./workspace.boot";
import {
    ProjectResult_V1_0,
    ScaleResult_V1_0,
    MoveResult_V1_0,
    ImgMediaResult_V1_0,
    SvgMediaResult_V1_0,
    getScales,
    getMoves,
    getSvg,
    getImg,
    getImgDiscoveryPage,
    getSvgDiscoveryPage,
    getEffects,
    getProjects
} from "./workspace.server";
export const dynamic = 'force-dynamic';

export interface ProjectDependencies {
    project: ProjectResult_V1_0,
    scales: ScaleResult_V1_0[],
    moves: MoveResult_V1_0[],
    canvasImgs: ImgMediaResult_V1_0[],
    canvasSvgs: SvgMediaResult_V1_0[],
}
async function fetchMostRecentProject(
    laurusApi: string | undefined,
    projects: Promise<ProjectResult_V1_0[] | undefined>): Promise<ProjectDependencies | undefined> {
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
async function fetchMediaFromServer(
    laurusApi: string | undefined,
    pageSize: number): Promise<BrowserDependencies> {
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

export default function Page() {
    const mediaPageSize = process.env.MEDIA_PAGE_SIZE;
    const laurusApi = process.env.LAURUS_API;
    const projects = getProjects(laurusApi);
    const effectsEnum = getEffects(laurusApi);
    const mediaPageSizeInit = mediaPageSize ? (parseInt(mediaPageSize) || 0) : 0;
    const projectDependencies = fetchMostRecentProject(laurusApi, projects);
    const browserDependencies = fetchMediaFromServer(laurusApi, mediaPageSizeInit);

    return <WorkspaceBoot
        laurusApi={laurusApi}
        mediaPageSizeInit={mediaPageSizeInit}
        effectsEnum={effectsEnum}
        projectDependencies={projectDependencies}
        browserDependencies={browserDependencies} />
}
