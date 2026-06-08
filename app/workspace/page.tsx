import { getMe, logout } from "../landing.server";
import { fetchMe } from "../page";
import { getProjects, ProjectResult_V1_0 } from "../projects/projects.server";
import WorkspaceBoot from "./workspace.boot";
import {
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
    getRotates,
    RotateResult_V1_0,
    getEffectGroups,
    EffectGroupResult_V1_0,
} from "./workspace.server";
export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';

export interface ProjectDependencies {
    project: ProjectResult_V1_0,
    scales: ScaleResult_V1_0[],
    moves: MoveResult_V1_0[],
    rotates: RotateResult_V1_0[],
    effectGroups: EffectGroupResult_V1_0[],
    canvasImgs: ImgMediaResult_V1_0[],
    canvasSvgs: SvgMediaResult_V1_0[],
}
async function fetchProject(
    laurusApi: string | undefined,
    logoutFlag: boolean,
    projects: Promise<ProjectResult_V1_0[] | undefined>,
    project_id: string | undefined): Promise<ProjectDependencies | undefined> {
    const p = await projects;
    if (p && p.length > 0) {
        const cookieStore = await cookies();
        const token = cookieStore.get('refresh_token')?.value;
        if (token && logoutFlag) {
            await logout(laurusApi, token);
        }

        const requestedProject = project_id ? p.find(p => p.project_id == project_id) : undefined;
        const myUsername: string = token && !logoutFlag ? (await getMe(laurusApi, token))?.username ?? "" : "";
        let newProject: ProjectResult_V1_0 | undefined = undefined;
        if (requestedProject) {
            newProject = requestedProject;
        }
        else if (myUsername) {
            const myLatestEdits = p
                .filter(n => n.last_editor == myUsername)
                .sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
            if (myLatestEdits.length > 0) {
                newProject = myLatestEdits[0];
            }
        }
        else {
            const thePublicsLatestEdits = p.sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
            if (thePublicsLatestEdits.length > 0) {
                newProject = thePublicsLatestEdits[0];
            }
        }
        if (!newProject) return undefined;
        const scales = await getScales(laurusApi, newProject.project_id);
        const moves = await getMoves(laurusApi, newProject.project_id);
        const rotates = await getRotates(laurusApi, newProject.project_id);
        const effectGroups = await getEffectGroups(laurusApi, newProject.project_id);
        const svgsArray = Array.from(newProject.svgs.values());
        const canvasSvgs: SvgMediaResult_V1_0[] = [];
        for (let i = 0; i < svgsArray.length; i++) {
            const svgMediaResult = await getSvg(laurusApi, svgsArray[i].svg_media_id, svgsArray[i].media_key);
            if (svgMediaResult) {
                canvasSvgs.push({ ...svgMediaResult });
            }
        }
        const imgsArray = Array.from(newProject.imgs.values());
        const canvasImgs: ImgMediaResult_V1_0[] = [];
        for (let i = 0; i < imgsArray.length; i++) {
            const imgMediaResult = await getImg(laurusApi, imgsArray[i].img_media_id, imgsArray[i].media_key);
            if (imgMediaResult) {
                canvasImgs.push({ ...imgMediaResult });
            }
        }
        return {
            project: newProject,
            scales: scales ?? [],
            moves: moves ?? [],
            rotates: rotates ?? [],
            effectGroups: effectGroups ?? [],
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

export default async function Page({ searchParams }: { searchParams: Promise<{ guest?: string, project_id?: string }> }) {
    const { guest, project_id } = await searchParams;
    const mediaPageSize = process.env.MEDIA_PAGE_SIZE;
    const laurusApi = process.env.LAURUS_API;
    const me = fetchMe(laurusApi, Boolean(guest));
    const projects = getProjects(laurusApi);
    const effectsEnum = getEffects(laurusApi);
    const mediaPageSizeInit = mediaPageSize ? (parseInt(mediaPageSize) || 0) : 0;
    const projectDependencies = fetchProject(laurusApi, Boolean(guest), projects, project_id,);
    const browserDependencies = fetchMediaFromServer(laurusApi, mediaPageSizeInit);

    return <>
        <WorkspaceBoot
            laurusApi={laurusApi}
            mediaPageSizeInit={mediaPageSizeInit}
            effectsEnum={effectsEnum}
            projectDependencies={projectDependencies}
            browserDependencies={browserDependencies}
            mePromise={me} />
    </>
}
