'use client'
import { createContext, RefObject, use, useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import styles from '../app.module.css';
import {
    getImgsByPage, getSvgsByPage, enumerateImgs, enumerateSvgs,
    EncodedImg_V1_0,
    EncodedSvg_V1_0,
    ImgMetadataPage_V1_0,
    SvgMetadataPage_V1_0,
    ProjectResult_V1_0,
    ProjectImg_V1_0,
    ProjectSvg_V1_0,
    getImg,
    ImgMetadata_V1_0,
    SvgMetadata_V1_0,
    getSvg,
    updateProject,
    createProject,
    ProjectLayer_V1_0,
    ScaleEquation_V1_0,
    Scale_V1_0,
    ScaleResult_V1_0,
    getScales,
    MoveEquation_V1_0,
    Move_V1_0,
    MoveResult_V1_0,
    getMoves,
    getFrames
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "./statusbar";
import Canvas from "./canvas";
import MediaBrowserArea from "./media-browser";
import { lassoSelect, hexagon, deployedCode, browse, checkCircle, moreVert, playArrow } from "../svg-repo";
import { DraggableReactImg, DraggableReactSvg, ReactImg, ReactSvg } from "./media";
import Projectbar from "./projectbar";
import TimelineArea from "./timeline-area";
import { v4 } from "uuid";
import DraggableCamera from "./camera";
import { dellaRespira } from "../fonts";

export interface LaurusProjectResult extends ProjectResult_V1_0 {
    imgs: Map<string, LaurusImg>
    svgs: Map<string, LaurusSvg>
}
export type LaurusImgMetadata = ImgMetadata_V1_0;
export type LaurusSvgMetadata = SvgMetadata_V1_0;
export type EncodedImg = EncodedImg_V1_0;
export type EncodedSvg = EncodedSvg_V1_0;
export interface LaurusImg extends ProjectImg_V1_0 {
    pending: boolean,
}
export interface LaurusSvg extends ProjectSvg_V1_0 {
    pending: boolean,
}
export type LaurusLayer = ProjectLayer_V1_0;
export type LaurusScaleEquation = ScaleEquation_V1_0;
export interface LaurusScale extends Scale_V1_0 {
    math: Map<string, LaurusScaleEquation>,
}
export interface LaurusScaleResult extends ScaleResult_V1_0 {
    math: Map<string, LaurusScaleEquation>,
}
export type LaurusMoveEquation = MoveEquation_V1_0;
export interface LaurusMove extends Move_V1_0 {
    math: Map<string, LaurusMoveEquation>,
}
export interface LaurusMoveResult extends MoveResult_V1_0 {
    math: Map<string, LaurusMoveEquation>,
}
export type LaurusEffect =
    | { type: 'scale', key: string, value: LaurusScaleResult }
    | { type: 'move', key: string, value: LaurusMoveResult }
export type LaurusThumbnail =
    | { type: 'svg', value: EncodedSvg }
    | { type: 'img', value: EncodedImg }
export type LaurusTool =
    | { type: 'drop' }
    | { type: 'none' }
    | { type: 'activate' }
    | { type: 'viewport' }
export type LaurusBrowserElement = LaurusThumbnail;
export type LaurusActiveElement = { key: string, value: LaurusThumbnail };
export const timelineValues = [30, 60, 90];
export const timelineUnits = ['sec', 'min'];
export function convertTime(time: number, currentUnit: string, newUnit: string) {
    switch (currentUnit + newUnit) {
        case 'secmin': {
            return time / 60;
        }
        case 'minsec': {
            return time * 60;
        }
        default: {
            return time;
        }
    }
};

/**
 * if state is used across a depth of three or more components, it belongs in here.
 */
export interface WorkspaceState {
    apiOrigin: string | undefined,
    project: LaurusProjectResult,

    downloadedImgs: EncodedImg[],
    downloadedSvgs: EncodedSvg[],

    tool: LaurusTool,
    browserElement: LaurusBrowserElement | undefined,
    activeElement: LaurusActiveElement | undefined,

    effectNames: string[],
    effects: LaurusEffect[],

    timelineUnit: string,
    timelineMaxValue: number,

    recordingLight: boolean,
    fps: number,
}
const defaultLayer: LaurusLayer = {
    name: "untitled",
    order: 0
}
export const defaultWorkspace: WorkspaceState = {
    apiOrigin: undefined,
    project: {
        name: "untitled",
        canvas_width: 5000,
        canvas_height: 5000,
        frame_top: -1,
        frame_left: -1,
        frame_width: 1080,
        frame_height: 1440,
        project_id: "",
        timestamp: "",
        last_active: "",
        imgs: new Map(),
        svgs: new Map(),
        layers: new Map().set(v4(), { ...defaultLayer })
    },
    tool: { type: 'none' },
    downloadedImgs: [],
    downloadedSvgs: [],
    effectNames: [],
    effects: [],
    timelineUnit: '',
    timelineMaxValue: 0,
    browserElement: undefined,
    activeElement: undefined,
    recordingLight: false,
    fps: 60,
}

export enum WorkspaceActionType {
    SetWorkspace,
    SetProject,
    AddDownloadedImg,
    AddDownloadedSvg,
    SetTool,
    SetBrowserElement,
    SetActiveElement,

    SetProjectImg,
    SetProjectSvg,
    DeleteProjectImg,
    DeleteProjectSvg,

    SetPendingImg,
    SetPendingSvg,

    SetEffects,
    SetEffect,

    SetTimelineUnit,
    IncrementTimelineMaxValue,

    SetRecordingLight,
    SetFps,
}

export type WorkspaceAction =
    | { type: WorkspaceActionType.SetWorkspace, value: WorkspaceState }
    | { type: WorkspaceActionType.SetProject, value: LaurusProjectResult }

    | { type: WorkspaceActionType.AddDownloadedImg, value: EncodedImg }
    | { type: WorkspaceActionType.AddDownloadedSvg, value: EncodedSvg }

    | { type: WorkspaceActionType.SetTool, value: LaurusTool }
    | { type: WorkspaceActionType.SetBrowserElement, value: LaurusBrowserElement | undefined }
    | { type: WorkspaceActionType.SetActiveElement, value: LaurusActiveElement | undefined }

    | { type: WorkspaceActionType.SetProjectImg, key: string, value: LaurusImg }
    | { type: WorkspaceActionType.SetProjectSvg, key: string, value: LaurusSvg }
    | { type: WorkspaceActionType.DeleteProjectImg, key: string }
    | { type: WorkspaceActionType.DeleteProjectSvg, key: string }

    | { type: WorkspaceActionType.SetEffects, value: LaurusEffect[] }
    | { type: WorkspaceActionType.SetEffect, value: LaurusEffect }

    | { type: WorkspaceActionType.SetTimelineUnit, value: string }
    | { type: WorkspaceActionType.IncrementTimelineMaxValue }

    | { type: WorkspaceActionType.SetRecordingLight, value: boolean }
    | { type: WorkspaceActionType.SetFps, value: number }

function workspaceContextReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
    switch (action.type) {
        case WorkspaceActionType.SetWorkspace: {
            return { ...action.value }
        }
        case WorkspaceActionType.SetProject: {
            return { ...state, project: { ...action.value } }
        }
        case WorkspaceActionType.AddDownloadedImg: {
            const i = state.downloadedImgs.findIndex(i => i.media_path == action.value.media_path);
            if (i < 0) {
                return { ...state, downloadedImgs: [...state.downloadedImgs, action.value] }
            }
            else {
                return { ...state }
            }
        }
        case WorkspaceActionType.AddDownloadedSvg: {
            const i = state.downloadedSvgs.findIndex(i => i.media_path == action.value.media_path);
            if (i < 0) {
                return { ...state, downloadedSvgs: [...state.downloadedSvgs, action.value] }
            }
            else {
                return { ...state }
            }
        }
        case WorkspaceActionType.SetTool: {
            return { ...state, tool: { ...action.value } }
        }
        case WorkspaceActionType.SetBrowserElement: {
            return { ...state, browserElement: action.value }
        }
        case WorkspaceActionType.SetActiveElement: {
            return { ...state, activeElement: action.value }
        }
        case WorkspaceActionType.SetProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.set(action.key, action.value);
            const newProject: LaurusProjectResult = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.SetProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.set(action.key, action.value);
            const newProject: LaurusProjectResult = { ...state.project, svgs: newSvgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.DeleteProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.delete(action.key);
            const newProject: LaurusProjectResult = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.DeleteProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.delete(action.key);
            const newProject: LaurusProjectResult = { ...state.project, svgs: newSvgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.SetEffects: {
            return { ...state, effects: [...action.value] }
        }
        case WorkspaceActionType.SetEffect: {
            return { ...state, effects: state.effects.map(e => e.key == action.value.key ? { ...action.value } : e) }
        }
        case WorkspaceActionType.SetTimelineUnit: {
            return { ...state, timelineUnit: action.value }
        }
        case WorkspaceActionType.IncrementTimelineMaxValue: {
            const currentIndex = timelineValues.findIndex(v => v == state.timelineMaxValue);
            const newValue: number = (currentIndex >= 0) && (currentIndex + 1 < timelineValues.length)
                ? timelineValues[currentIndex + 1]
                : timelineValues[0];
            return { ...state, timelineMaxValue: newValue }
        }
        case WorkspaceActionType.SetRecordingLight: {
            return { ...state, recordingLight: action.value }
        }
        case WorkspaceActionType.SetFps: {
            return { ...state, fps: action.value }
        }
    }
}

export interface WorkspaceContextProps {
    appState: WorkspaceState;
    dispatch: React.Dispatch<WorkspaceAction>;
}

export const WorkspaceContext = createContext<WorkspaceContextProps>(
    {
        appState: { ...defaultWorkspace },
        dispatch: () => { }
    }
)

interface InitReducerProps {
    api: string | undefined,
    p: ProjectResult_V1_0[] | undefined,
    eN: string[] | undefined,
}

function getMostRecentProject(p: ProjectResult_V1_0[]) {
    const sortedProjects = p.sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
    const mostRecentImgs: Map<string, LaurusImg> = new Map(sortedProjects[0].imgs.entries()
        .map(e => [e[0], { ...e[1], pending: false }]));
    const mostRecentSvgs: Map<string, LaurusSvg> = new Map(sortedProjects[0].svgs.entries()
        .map(e => [e[0], { ...e[1], pending: false }]));
    const mostRecent: LaurusProjectResult = {
        ...sortedProjects[0],
        imgs: mostRecentImgs,
        svgs: mostRecentSvgs
    };
    if (mostRecent.layers.size == 0) {
        mostRecent.layers.set(v4(), { ...defaultLayer })
    }
    return mostRecent;
}

function initReducer(
    {
        api,
        p,
        eN: e,
    }: InitReducerProps): WorkspaceState {

    const projectInit = ((): LaurusProjectResult => {
        if (p && p.length > 0) {
            return getMostRecentProject([...p]);
        }
        else {
            return defaultWorkspace.project;
        }
    })();

    return {
        apiOrigin: api,
        project: projectInit,
        downloadedImgs: defaultWorkspace.downloadedImgs,
        downloadedSvgs: defaultWorkspace.downloadedSvgs,
        tool: defaultWorkspace.tool,
        effectNames: e ?? [],
        effects: defaultWorkspace.effects,
        timelineUnit: timelineUnits[0],
        timelineMaxValue: timelineValues[2],
        browserElement: defaultWorkspace.browserElement,
        activeElement: defaultWorkspace.activeElement,
        recordingLight: defaultWorkspace.recordingLight,
        fps: defaultWorkspace.fps
    };
}

interface WorkspaceProps {
    apiOrigin: string | undefined,
    mediaPreloadLimit: string | undefined,
    projectsInit: Promise<ProjectResult_V1_0[] | undefined>,
    effectsEnum: Promise<string[] | undefined>,
}

export default function Workspace({
    apiOrigin: api,
    mediaPreloadLimit: mpl,
    projectsInit,
    effectsEnum,
}: WorkspaceProps) {
    const p = use(projectsInit);
    const eN = use(effectsEnum);

    const [appState, dispatch] = useReducer(
        workspaceContextReducer,
        {
            api,
            p,
            eN,
        },
        initReducer);

    const canvasAreaRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const initCurrentPaper = (async () => {
            if (canvasAreaRef.current && (appState.project.frame_top < 0 || appState.project.frame_left < 0)) {
                const centerX = canvasAreaRef.current.clientWidth / 2;
                const centerY = canvasAreaRef.current.clientHeight / 2;
                const left = Math.max(0, centerX - (appState.project.frame_width / 2));
                const top = Math.max(0, centerY - (appState.project.frame_height / 2));
                dispatch({
                    type: WorkspaceActionType.SetProject,
                    value: { ...appState.project, frame_left: left, frame_top: top }
                })
            }
        });

        initCurrentPaper();

    }, [appState.project]);

    const [mediabarHeight] = useState(50);
    const [showMediaBrowser, setShowMediaBrowser] = useState<boolean>(false);
    const [mediaBrowserPageSize] = useState(5);
    const [showTimeline, setShowTimeline] = useState<boolean>(true);
    const [mediaBrowserFilter, setMediaBrowserFilter] = useState<'img' | 'svg'>('img');
    const [imgPageIndex, setImgPageIndex] = useState(0);
    const [svgPageIndex, setSvgPageIndex] = useState(0);
    const nextPageRef = useRef<HTMLDivElement | null>(null);

    const handleImgPageRequest = useCallback(async (pageIndex: number) => {
        if (nextPageRef.current) {
            nextPageRef.current.style.visibility = 'hidden'
        }
        const response: ImgMetadataPage_V1_0[] | undefined =
            await enumerateImgs(appState.apiOrigin, mediaBrowserPageSize, undefined, pageIndex + 1);
        if (response && pageIndex < response.length) {
            const requestedPage: ImgMetadataPage_V1_0 = response[pageIndex];
            const encodings = await getImgsByPage(appState.apiOrigin, requestedPage);
            const cachedSrcs = appState.downloadedImgs.flatMap(c => c.media_path);
            const newEncodings = encodings.filter(e => !cachedSrcs.includes(e.media_path));
            for (let i = 0; i < newEncodings.length; i++) {
                const newEncoding = newEncodings[i]
                dispatch({ type: WorkspaceActionType.AddDownloadedImg, value: { ...newEncoding } })
            }

            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return requestedPage;
        }
        else {
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return undefined;
        }
    }, [appState.apiOrigin, appState.downloadedImgs, mediaBrowserPageSize]);

    const handleSvgPageRequest = useCallback(async (pageIndex: number) => {
        if (nextPageRef.current) {
            nextPageRef.current.style.visibility = 'hidden'
        }
        const response: SvgMetadataPage_V1_0[] | undefined =
            await enumerateSvgs(appState.apiOrigin, mediaBrowserPageSize, undefined, pageIndex + 1);
        if (response && pageIndex < response.length) {
            const requestedPage: SvgMetadataPage_V1_0 = response[pageIndex];
            const encodings = await getSvgsByPage(appState.apiOrigin, requestedPage);
            const cachedSrcs = appState.downloadedSvgs.flatMap(c => c.media_path);
            const newEncodings = encodings.filter(e => !cachedSrcs.includes(e.media_path));
            for (let i = 0; i < newEncodings.length; i++) {
                const newEncoding = newEncodings[i]
                dispatch({ type: WorkspaceActionType.AddDownloadedSvg, value: { ...newEncoding } })
            }
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return requestedPage;
        }
        else {
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return undefined;
        }
    }, [appState.apiOrigin, appState.downloadedSvgs, mediaBrowserPageSize]);

    useEffect(() => {
        /* background project downloader */

        const downloadImgsFromProjectInit = async () => {
            const projectImgsInit = ((): Map<string, ProjectImg_V1_0> => {
                if (p && p.length > 0) {
                    const mostRecent = getMostRecentProject([...p]);
                    return mostRecent.imgs;
                }
                else {
                    return new Map();
                }
            })();
            const a = Array.from(projectImgsInit.values());
            for (let i = 0; i < a.length; i++) {
                const imgMeta = a[i];
                const img = await getImg(api, imgMeta.media_path);
                if (img) {
                    dispatch({ type: WorkspaceActionType.AddDownloadedImg, value: { ...img } });
                }
            }
        };

        const downloadImgsForBrowser = async (top: number) => {
            const response = await enumerateImgs(api, mediaBrowserPageSize, top, undefined);
            let firstImg: EncodedImg | undefined = undefined;
            if (response && response.length > 0) {
                for (let i = 0; i < response.length; i++) {
                    const page = response[i];
                    for (let j = 0; j < page.value.length; j++) {
                        const imgMeta = page.value[j];
                        const img = await getImg(api, imgMeta.media_path);
                        if (img) {
                            if (!firstImg) {
                                firstImg = { ...img };
                            }
                            dispatch({ type: WorkspaceActionType.AddDownloadedImg, value: { ...img } })
                        }
                    }
                }
                const newPageIndex = response[response.length - 1].page_number - 1;
                setImgPageIndex(newPageIndex);
            }
            if (firstImg) {
                const newThumnail: LaurusThumbnail = { value: { ...firstImg }, type: 'img' }
                dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { ...newThumnail } });
            }
        };

        const downloadSvgsFromProjectInit = async () => {
            const projectSvgsInit = ((): Map<string, ProjectSvg_V1_0> => {
                if (p && p.length > 0) {
                    const mostRecent = getMostRecentProject([...p]);
                    return mostRecent.svgs;
                }
                else {
                    return new Map();
                }
            })();
            const a = Array.from(projectSvgsInit.values());
            for (let i = 0; i < a.length; i++) {
                const svgMeta = a[i];
                const svg = await getSvg(api, svgMeta.media_path);
                if (svg) {
                    dispatch({ type: WorkspaceActionType.AddDownloadedSvg, value: { ...svg } });
                }
            }
        };

        const downloadSvgsForBrowser = async (top: number) => {
            const response = await enumerateSvgs(api, mediaBrowserPageSize, top, undefined);
            if (response && response.length > 0) {
                for (let i = 0; i < response.length; i++) {
                    const page = response[i];
                    for (let j = 0; j < page.value.length; j++) {
                        const svgMeta = page.value[j];
                        const svg = await getSvg(api, svgMeta.media_path);
                        if (svg) {
                            dispatch({ type: WorkspaceActionType.AddDownloadedSvg, value: { ...svg } })
                        }
                    }
                }
                const newPageIndex = response[response.length - 1].page_number - 1;
                setSvgPageIndex(newPageIndex);
            }
        };

        const downloadEffectsFromProjectInit = async () => {
            if (p && p.length > 0) {
                const mostRecent = getMostRecentProject([...p]);
                const scales = await getScales(api, mostRecent.project_id);
                const moves = await getMoves(api, mostRecent.project_id);
                const newEffects: LaurusEffect[] = [];
                if (scales) {
                    const newScales: LaurusEffect[] = scales.map(s => {
                        return {
                            type: 'scale',
                            key: s.scale_id,
                            value: {
                                ...s,
                            }
                        }
                    });
                    newEffects.push(...newScales);
                }
                if (moves) {
                    const newMoves: LaurusEffect[] = moves.map(e => {
                        return {
                            type: 'move',
                            key: e.move_id,
                            value: {
                                ...e,
                            }
                        }
                    });
                    newEffects.push(...newMoves);
                }
                dispatch({ type: WorkspaceActionType.SetEffects, value: newEffects });
            }
        };

        const top: number = mpl ? (parseInt(mpl) || 2) : 2;
        downloadEffectsFromProjectInit();
        downloadImgsFromProjectInit();
        downloadImgsForBrowser(top);
        downloadSvgsFromProjectInit();
        downloadSvgsForBrowser(top);
    }, [api, mpl, mediaBrowserPageSize, p]);

    const svgElementsRef = useRef<Map<string, SVGSVGElement>>(null);
    const imgElementsRef = useRef<Map<string, HTMLImageElement>>(null);

    const getNewAnimations = useCallback(async (fill: FillMode, firstFrame: boolean) => {
        const newAnimations: Animation[] = [];
        const globalLimit: number = Math.max(...appState.effects
            .map(e => e.value.duration));
        const options: KeyframeAnimationOptions = {
            duration: firstFrame ? 2 / appState.fps : globalLimit * 1000,
            iterations: 1,
            fill,
        };

        const imgArray = Array.from(appState.project.imgs.entries().filter(e => !e[1].pending));
        for (let i = 0; i < imgArray.length; i++) {
            const [key] = imgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, appState.fps);
            if (frames) {
                const framesToMap = firstFrame ? [frames[0]] : frames;
                const keyframes: Keyframe[] = framesToMap.map((f, i) => {
                    return i < frames.length - 1 ?
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s, easing: 'step-end' } :
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s }
                });
                const imgRef = imgElementsRef.current?.get(key);
                if (!imgRef) return [];
                const animations = imgRef.getAnimations();
                for (let j = 0; j < animations.length; j++) {
                    animations[j].cancel();
                }
                const keyframeEffect =
                    new KeyframeEffect(imgRef, keyframes, options);
                newAnimations.push(new Animation(keyframeEffect, document.timeline));
            }
        };

        const svgArray = Array.from(appState.project.svgs.entries().filter(e => !e[1].pending));
        for (let i = 0; i < svgArray.length; i++) {
            const [key] = svgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, appState.fps);
            if (frames) {
                const framesToMap = firstFrame ? [frames[0]] : frames;
                const keyframes: Keyframe[] = framesToMap.map((f, i) => {
                    return i < frames.length - 1 ?
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s, easing: 'step-end' } :
                        { translate: `${f.x}px ${f.y}px 0px`, scale: f.s }
                });
                const svgRef = svgElementsRef.current?.get(key);
                if (!svgRef) return [];
                const animations = svgRef.getAnimations();
                for (let j = 0; j < animations.length; j++) {
                    animations[j].cancel();
                }
                const keyframeEffect =
                    new KeyframeEffect(svgRef, keyframes, options);
                newAnimations.push(new Animation(keyframeEffect, document.timeline));
            }
        };

        return newAnimations;
    }, [appState.apiOrigin, appState.effects, appState.fps, appState.project.imgs, appState.project.project_id, appState.project.svgs]);

    return (<>
        <div
            style={{
                width: "100vw",
                height: '100vh',
                display: 'grid',
                gridTemplateColumns: 'min-content min-content 1fr min-content min-content min-content',
                gridTemplateRows: `min-content 1fr min-content`,
                overflowX: "auto",
            }}>
            <WorkspaceContext value={{ appState: appState, dispatch }}>
                <div style={{ gridRow: '1', gridColumn: 'span 6', }}>
                    <Menubar />
                    <Projectbar />
                </div>

                <div style={{ gridRow: '2', gridColumn: '1', overflowY: 'auto', }}>
                    {showTimeline ?
                        <TimelineArea
                            size={{ width: 1000, height: 5000 }}
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef}
                            onRightPanelClick={() => setShowTimeline(false)}
                        /> :
                        <>
                            <div
                                style={{
                                    width: 20,
                                    height: '100%',
                                    gridTemplateRows: '1fr',
                                    display: 'grid',
                                    placeContent: 'start',
                                }} >
                                <div
                                    className={dellaRespira.className}
                                    style={{
                                        border: '1px solid rgb(24, 24, 24)',
                                        background: 'rgba(20, 20, 20, 1)',
                                        width: 20,
                                        display: 'grid',
                                        placeContent: 'center',
                                    }} >
                                    <ReactSvg
                                        svg={moreVert('rgba(255, 255, 255, 0.5)')}
                                        containerSize={{
                                            width: 20,
                                            height: 38
                                        }}
                                        scale={1}
                                        onContainerClick={() => {
                                            setShowTimeline(true);
                                        }} />
                                </div>
                            </div>
                            <div style={{
                                zIndex: 1,
                                position: 'fixed',
                                bottom: 100,
                                left: 40,
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                border: '1px solid rgba(0, 0, 0, 0.4)',
                                background: 'rgb(20, 20, 20)',
                                boxShadow: "rgba(0 ,0, 0, 0.4) 2px 2px 4px 0px",
                            }}>
                                <ReactSvg
                                    svg={playArrow()}
                                    containerSize={{
                                        width: 44,
                                        height: 44
                                    }}
                                    scale={0.5}
                                    onContainerClick={async () => {
                                        dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'viewport' } });
                                        const newAnimations = await getNewAnimations('none', false);
                                        Promise.all(newAnimations.map(animation => animation.finished))
                                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                            .then((_animations: Animation[]) => {
                                                dispatch({ type: WorkspaceActionType.SetRecordingLight, value: false });
                                                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                                            })
                                            .catch(err => {
                                                if (err instanceof Error && err.name !== 'AbortError') {
                                                    console.log('unknown error from waapi:', err);
                                                }
                                            });
                                        newAnimations.forEach(a => {
                                            a.play();
                                        });
                                        dispatch({ type: WorkspaceActionType.SetRecordingLight, value: true });
                                    }} />
                            </div>
                            <div style={{
                                zIndex: 1,
                                position: 'fixed',
                                bottom: 115,
                                right: 86,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                border: appState.recordingLight ? '1px solid rgb(239, 239, 239)' : 'none',
                                background: appState.recordingLight ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'none',
                                boxShadow: appState.recordingLight ? 'rgba(255, 255, 255, 1) 0px 0px 100px 10px' : 'none'
                            }}>
                            </div>
                        </>
                    }
                </div>
                {/* canvas area */}
                <div
                    className={styles["large-tiled-background-squares"]}
                    ref={canvasAreaRef}
                    style={{
                        gridRow: '2', gridColumn: '3',
                        overflowY: 'auto',
                        position: 'relative',
                        width: "100%",
                        height: '100%',
                    }}>
                    <div
                        className={styles["large-tiled-background-squares"]}
                        style={{
                            position: 'absolute',

                            top: 0,
                            left: 0,
                            width: appState.project.canvas_width,
                            height: appState.project.canvas_height,
                            zIndex: 0,
                        }} />
                    {appState.tool.type == 'drop' && <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 'min-content',
                            height: 'min-content',
                            zIndex: 2
                        }}>
                        <Canvas />
                    </div>}
                    {/* camera frame */}
                    <DraggableCamera
                        contextId={"draggable-camera-context-id"}
                        nodeId={"draggable-camera-node-id"}
                        data={{
                            svgElementsRef,
                            imgElementsRef
                        }}
                        zIndex={1}
                        onNewPosition={async function (newPosition: { x: number; y: number; }) {
                            const newProject: LaurusProjectResult = {
                                ...appState.project,
                                frame_left: newPosition.x,
                                frame_top: newPosition.y
                            };
                            dispatch({
                                type: WorkspaceActionType.SetProject,
                                value: newProject,
                            });
                            await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                        }} />
                    {appState.tool.type != 'viewport' &&
                        <MediaOverlays
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef}
                            zIndex={3} />}
                </div>
                {/* right bumper */}
                {showMediaBrowser && <div
                    onClick={() => setShowMediaBrowser(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    style={{
                        gridRow: '2', gridColumn: '4',
                        width: 30,
                        display: 'grid',
                        placeContent: 'center',
                        border: '1px solid black',
                        background: 'rgba(20, 20, 20, 1)',
                        borderRadius: 10
                    }} >
                </div>}
                {/* media browser */}
                {showMediaBrowser &&
                    <>
                        <div
                            style={{
                                gridRow: '2', gridColumn: '5',
                                width: 400,
                                border: '1px solid black',
                                background: 'rgba(20, 20, 20, 1)'
                            }} >
                            <MediaBrowserArea
                                filter={mediaBrowserFilter}
                                nextPageRef={nextPageRef}
                                onPrevPage={async () => {
                                    switch (mediaBrowserFilter) {
                                        case "img": {
                                            if (imgPageIndex != 0) {
                                                const newIndex = Math.max(0, imgPageIndex - 1);
                                                await handleImgPageRequest(newIndex);
                                                setImgPageIndex(newIndex);
                                            }
                                            break;
                                        }
                                        case "svg": {
                                            if (svgPageIndex != 0) {
                                                const newIndex = Math.max(0, svgPageIndex - 1);
                                                await handleSvgPageRequest(newIndex);
                                                setSvgPageIndex(newIndex);
                                            }
                                            break;
                                        }
                                    }
                                }}
                                onNextPage={async () => {
                                    switch (mediaBrowserFilter) {
                                        case "img": {
                                            const newIndex = imgPageIndex + 1;
                                            const response = await handleImgPageRequest(newIndex);
                                            if (response) {
                                                setImgPageIndex(newIndex);
                                            }
                                            break;
                                        }
                                        case "svg": {
                                            const newIndex = svgPageIndex + 1;
                                            const response = await handleSvgPageRequest(newIndex);
                                            if (response) {
                                                setSvgPageIndex(newIndex);
                                            }
                                            break;
                                        }
                                    }
                                }}
                                onMediaClick={(m) => {
                                    dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { ...m } });
                                }}
                                onFilterSelect={setMediaBrowserFilter}
                            />
                        </div>
                    </>}
                {/* right panel */}
                <div
                    style={{
                        gridRow: '2', gridColumn: '6',
                        display: "grid",
                        gridTemplateRows: 'min-content min-content auto',
                        borderLeft: '1px solid black',
                        background: 'linear-gradient(45deg, rgb(11, 11, 11), rgb(19, 19, 19))',
                        width: 50,
                        justifyContent: 'center'
                    }}>
                    <div style={{
                        width: 'min-content',
                        height: 'min-content',
                        background: appState.tool.type == 'drop' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    }}>
                        <ReactSvg
                            svg={lassoSelect()}
                            containerSize={{
                                width: 50,
                                height: 50
                            }}
                            scale={0.5}
                            onContainerClick={() => {
                                if (appState.tool.type == 'drop') {
                                    dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                                }
                                else {
                                    dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop' } })
                                }
                            }} />
                    </div>
                    <div style={{
                        width: 'min-content',
                        height: 'min-content',
                        background: appState.tool.type == 'activate' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    }}>
                        <ReactSvg
                            svg={deployedCode()}
                            containerSize={{
                                width: 50,
                                height: 50
                            }}
                            scale={0.5}
                            onContainerClick={() => {
                                if (appState.tool.type == 'activate') {
                                    dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                                }
                                else {
                                    dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'activate' } })
                                }
                            }} />
                    </div>
                    <div style={{
                        width: 'min-content',
                        height: 'min-content',
                        background: appState.tool.type == 'viewport' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                    }}>
                        <ReactSvg
                            svg={browse()}
                            containerSize={{
                                width: 50,
                                height: 50
                            }}
                            scale={0.5}
                            onContainerClick={() => {
                                if (appState.tool.type == 'viewport') {
                                    dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                                }
                                else {
                                    dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'viewport' } })
                                }
                            }} />
                    </div>
                </div>
                <div style={{ gridRow: '3', gridColumn: 'span 6' }}>
                    <div style={{
                        height: mediabarHeight,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: 'space-between',
                        backgroundImage: "linear-gradient(34deg, rgba(21, 21, 21, 1) 34%, rgba(13, 13, 13, 1))",
                        border: '1px solid black',
                    }}>
                        <div
                            onClick={() => {
                                //todo: hightlight active element in canvasarea
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            style={{
                                borderRight: '1px solid rgb(0, 0, 0)',
                                position: 'relative'
                            }}>
                            {appState.activeElement && (() => {
                                switch (appState.activeElement.value.type) {
                                    case "svg": {
                                        return (
                                            <ReactSvg
                                                svg={appState.activeElement.value.value as EncodedSvg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={appState.activeElement.value.value as EncodedImg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>
                        <div
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            onClickCapture={() => setShowMediaBrowser(v => !v)}
                            style={{
                                borderLeft: '1px solid rgb(0, 0, 0)',
                                position: 'relative'
                            }}>
                            {appState.browserElement && (() => {
                                switch (appState.browserElement.type) {
                                    case "svg": {
                                        return (
                                            <ReactSvg
                                                svg={appState.browserElement.value as EncodedSvg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={appState.browserElement.value as EncodedImg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>
                    </div>
                    <Statusbar action={'laurus workspace'} body={[]} counter={0.00} />
                </div>
            </WorkspaceContext>
        </div>
    </>)
}

interface MediaOverlaysProps {
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    zIndex: number,
}
export function MediaOverlays({ svgElementsRef, imgElementsRef, zIndex }: MediaOverlaysProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);

    const lazyLoadSvgElementsRef = () => {
        if (!svgElementsRef.current) {
            svgElementsRef.current = new Map();
        }
        return svgElementsRef.current;
    };

    const lazyLoadImgElementsRef = () => {
        if (!imgElementsRef.current) {
            imgElementsRef.current = new Map();
        }
        return imgElementsRef.current;
    };

    const onSvgRef = (element: SVGSVGElement | null, refKey: string) => {
        const m = lazyLoadSvgElementsRef();
        if (element) {
            m.set(refKey, element);
        }
        else {
            m.delete(refKey);
        }
    };

    const onImgRef = (element: HTMLImageElement | null, refKey: string) => {
        const m = lazyLoadImgElementsRef();
        if (element) {
            m.set(refKey, element);
        }
        else {
            m.delete(refKey);
        }
    };

    const onNewImgPosition = useCallback(async (key: string, imgMeta: LaurusImg, newPosition: { x: number, y: number }) => {
        const newImg: LaurusImg = { ...imgMeta, top: newPosition.y, left: newPosition.x };
        const newImgs: Map<string, LaurusImg> = new Map(appState.project.imgs);
        newImgs.set(key, newImg);
        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs }
        if (newProject.project_id) {
            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
        }
        else {
            const response = await createProject(appState.apiOrigin, { ...newProject });
            if (response) {
                const newProject2: LaurusProjectResult = { ...newProject, imgs: newImgs, project_id: response.project_id }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
            }
            else {
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            }
        }
    }, [appState.apiOrigin, appState.project, dispatch]);

    const onNewSvgPosition = useCallback(async (key: string, svgMeta: LaurusSvg, newPosition: { x: number, y: number }) => {
        const newSvg: LaurusSvg = { ...svgMeta, top: newPosition.y, left: newPosition.x };
        const newSvgs: Map<string, LaurusSvg> = new Map(appState.project.svgs);
        newSvgs.set(key, newSvg);
        const newProject: LaurusProjectResult = { ...appState.project, svgs: newSvgs }
        if (newProject.project_id) {
            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
        }
        else {
            const response = await createProject(appState.apiOrigin, { ...newProject });
            if (response) {
                const newProject2: LaurusProjectResult = { ...newProject, svgs: newSvgs, project_id: response.project_id }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
            }
            else {
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            }
        }
    }, [appState.apiOrigin, appState.project, dispatch]);

    return (<>
        {Array.from(appState.project.imgs.entries().filter(e => !e[1].pending)).map((e) => {
            const [key, imgMeta] = e;
            const refKey = appState.tool.type != 'viewport' ? `${key}|preview` : key;
            const imgData = appState.downloadedImgs.find(i => i.media_path == imgMeta.media_path);
            if (imgData) {
                return (
                    <div
                        onClick={(event) => {
                            // option key on mac
                            if (event.altKey || appState.tool.type == 'activate') {
                                const newImg: LaurusImg = { ...imgMeta, pending: true }
                                dispatch({ type: WorkspaceActionType.SetProjectImg, key, value: newImg });
                            }
                        }}
                        key={key}>
                        <DraggableReactImg
                            contextId={`dnd-context-${key}`}
                            nodeId={`dnd-node-${key}`}
                            data={imgData}
                            meta={imgMeta}
                            zIndex={zIndex}
                            onNewPosition={(newPosition) => onNewImgPosition(key, imgMeta, newPosition)}
                            onImgRef={onImgRef}
                            inputId={refKey}
                        />
                    </div>
                );
            }
        })}
        {Array.from(appState.project.svgs.entries().filter(e => !e[1].pending)).map((e) => {
            const [key, svgMeta] = e;
            const refKey = appState.tool.type != 'viewport' ? `${key}|preview` : key;
            const svgData = appState.downloadedSvgs.find(s => s.media_path == svgMeta.media_path);
            if (svgData) {
                return (
                    <div
                        onClick={(event) => {
                            // option key on mac
                            if (event.altKey || appState.tool.type == 'activate') {
                                const newSvg: LaurusSvg = { ...svgMeta, pending: true }
                                dispatch({ type: WorkspaceActionType.SetProjectSvg, key, value: newSvg });
                            }
                        }}
                        key={key}>
                        <DraggableReactSvg
                            contextId={`dnd-context-${key}`}
                            nodeId={`dnd-node-${key}`}
                            data={svgData}
                            meta={svgMeta}
                            zIndex={zIndex}
                            onNewPosition={(newPosition) => onNewSvgPosition(key, svgMeta, newPosition)}
                            onSvgRef={onSvgRef}
                            inputId={refKey} />
                    </div>
                );
            }
        })}
        {Array.from(appState.project.imgs.entries().filter(e => e[1].pending)).map((e) => {
            const [key, imgMeta] = e;
            const position = appState.tool.type != 'viewport' ? { top: Math.max(0, imgMeta.top), left: Math.max(0, imgMeta.left) }
                : { top: (imgMeta.top - appState.project.frame_top), left: (imgMeta.left - appState.project.frame_left) };
            const imgData = appState.downloadedImgs.find(i => i.media_path == imgMeta.media_path);
            if (imgData) {
                const threshold = 80;
                const hexSize = imgMeta.width < threshold || imgMeta.height < threshold ? 12 : 16;
                const activateSize = imgMeta.width < threshold || imgMeta.height < threshold ? 32 : 52;
                return (
                    <div
                        style={{
                            position: 'absolute',
                            width: imgMeta.width,
                            height: imgMeta.height,
                            zIndex: zIndex,
                            ...position
                        }}
                        onClick={(event) => {
                            // option key on mac
                            if (event.altKey || appState.tool.type == 'activate') {
                                const newImg: LaurusImg = { ...imgMeta, pending: false }
                                dispatch({ type: WorkspaceActionType.SetProjectImg, key, value: newImg });
                            }
                        }}
                        key={key}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute', filter: 'blur(16px)',
                            }}>
                                <ReactImg
                                    img={imgData}
                                    containerSize={{
                                        width: imgMeta.width,
                                        height: imgMeta.height
                                    }} />
                            </div>
                            <div style={{
                                position: 'absolute',
                                display: 'grid',
                                gridTemplateRows: 'min-content auto',
                                gridTemplateColumns: '1fr',
                                background: imgMeta.width < threshold || imgMeta.height < threshold ? 'rgba(255, 255, 255, 0.15)' : 'none',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 6,
                                height: Math.max(threshold * 1.25, imgMeta.height),
                                width: Math.max(threshold, imgMeta.width),
                                padding: imgMeta.width < threshold || imgMeta.height < threshold ? 2 : 6,
                            }}>
                                <div
                                    style={{ width: 'min-content', height: 'min-content', justifySelf: 'start' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                    onClick={async () => {
                                        const newImgs: Map<string, LaurusImg> = new Map(appState.project.imgs);
                                        newImgs.delete(key);
                                        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs }
                                        if (newProject.project_id) {
                                            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                                            await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                                        }
                                    }}>
                                    <ReactSvg
                                        svg={hexagon('rgb(238, 91, 108)')}
                                        containerSize={{
                                            width: hexSize,
                                            height: hexSize
                                        }}
                                        scale={1} />
                                </div>
                                <div
                                    style={{ width: 'min-content', height: 'min-content', placeSelf: 'center' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                    onClick={() => {
                                        const newImg: LaurusImg = { ...imgMeta, pending: false };
                                        dispatch({ type: WorkspaceActionType.SetProjectImg, key, value: newImg });
                                        const newActiveElement: LaurusActiveElement = { key, value: { type: 'img', value: { ...imgData } } };
                                        dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                    }}>
                                    <ReactSvg
                                        svg={checkCircle('rgb(227, 227, 227)')}
                                        containerSize={{
                                            width: activateSize,
                                            height: activateSize
                                        }}
                                        scale={1} />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        })}
        {Array.from(appState.project.svgs.entries().filter(e => e[1].pending)).map((e) => {
            const [key, svgMeta] = e;
            const position = appState.tool.type != 'viewport' ? { top: Math.max(0, svgMeta.top), left: Math.max(0, svgMeta.left) }
                : { top: (svgMeta.top - appState.project.frame_top), left: (svgMeta.left - appState.project.frame_left) };
            const svgData = appState.downloadedSvgs.find(s => s.media_path == svgMeta.media_path);
            if (svgData) {
                const threshold = 80;
                const hexSize = svgMeta.width < threshold || svgMeta.height < threshold ? 12 : 16;
                const activateSize = svgMeta.width < threshold || svgMeta.height < threshold ? 32 : 48;
                return (
                    <div
                        style={{
                            position: 'absolute',
                            width: svgMeta.width,
                            height: svgMeta.height,
                            zIndex: zIndex,
                            ...position
                        }}
                        onClick={(event) => {
                            // option key on mac
                            if (event.altKey || appState.tool.type == 'activate') {
                                const newSvg: LaurusSvg = { ...svgMeta, pending: false }
                                dispatch({ type: WorkspaceActionType.SetProjectSvg, key, value: newSvg });
                            }
                        }}
                        key={key}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute', filter: 'blur(16px)',
                                border: '1px solid pink'
                            }}>
                                <ReactSvg
                                    svg={svgData}
                                    containerSize={{
                                        width: svgMeta.width,
                                        height: svgMeta.height
                                    }}
                                    scale={0.9} />
                            </div>
                            <div style={{
                                position: 'absolute',
                                display: 'grid',
                                gridTemplateRows: 'min-content auto',
                                gridTemplateColumns: '1fr',
                                background: svgMeta.width < threshold || svgMeta.height < threshold ?
                                    'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: 6,
                                height: Math.max(threshold * 1.25, svgMeta.height),
                                width: Math.max(threshold, svgMeta.width),
                                padding: svgMeta.width < threshold || svgMeta.height < threshold ? 2 : 6,
                            }}>
                                <div
                                    style={{ width: 'min-content', height: 'min-content', justifySelf: 'start' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                    onClick={async () => {
                                        const newSvgs: Map<string, LaurusSvg> = new Map(appState.project.svgs);
                                        newSvgs.delete(key);
                                        const newProject: LaurusProjectResult = { ...appState.project, svgs: newSvgs }
                                        if (newProject.project_id) {
                                            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                                            await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                                        }
                                    }}>
                                    <ReactSvg
                                        svg={hexagon('rgb(238, 91, 108)')}
                                        containerSize={{
                                            width: hexSize,
                                            height: hexSize
                                        }}
                                        scale={1} />
                                </div>
                                <div
                                    style={{ width: 'min-content', height: 'min-content', placeSelf: 'center' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                    onClick={() => {
                                        const newSvg: LaurusSvg = { ...svgMeta, pending: false }
                                        dispatch({ type: WorkspaceActionType.SetProjectSvg, key, value: newSvg });
                                        const newActiveElement: LaurusActiveElement = { key, value: { type: 'svg', value: { ...svgData } } };
                                        dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                    }}>
                                    <ReactSvg
                                        svg={checkCircle('rgb(227, 227, 227)')}
                                        containerSize={{
                                            width: activateSize,
                                            height: activateSize
                                        }}
                                        scale={1} />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        })}
    </>)
}
