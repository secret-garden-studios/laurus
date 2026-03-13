'use client'
import { createContext, RefObject, use, useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import styles from '../app.module.css';
import {
    EncodedSvg_V1_0,
    ProjectResult_V1_0,
    ProjectSvg_V1_0,
    getImg,
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
    getFrames,
    ImgMedia_V1_0,
    EncodedImg_V1_0,
    getImgDiscoveryPage,
    ProjectImg_V1_0,
    updateMove,
    updateScale,
    getSvgDiscoveryPage
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "./statusbar";
import Canvas from "./canvas";
import MediaBrowserArea from "./media-browser";
import { lassoSelect, hexagon, deployedCode, browse, checkCircle, moreVert, playArrow } from "../svg-repo";
import { DraggableReactImg, DraggableReactSvg, ReactImg, ReactSvg } from "./media";
import Projectbar from "./projectbar";
import TimelineArea from "./timeline-area";
import DraggableCamera from "./camera";
import { dellaRespira } from "../fonts";

export interface LaurusProjectResult extends ProjectResult_V1_0 {
    imgs: Map<string, LaurusProjectImg>
    svgs: Map<string, LaurusProjectSvg>
}
export type EncodedImg = EncodedImg_V1_0;
export type EncodedSvg = EncodedSvg_V1_0;
export type LaurusImg = ImgMedia_V1_0;
export interface LaurusProjectImg extends ProjectImg_V1_0 {
    pending: boolean,
}
export interface LaurusProjectSvg extends ProjectSvg_V1_0 {
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
    browserImgs: EncodedImg[],
    canvasImgs: EncodedImg[],
    browserSvgs: EncodedSvg[],
    canvasSvgs: EncodedSvg[],
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
        layers: new Map()
    },
    tool: { type: 'none' },
    browserImgs: [],
    canvasImgs: [],
    browserSvgs: [],
    canvasSvgs: [],
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
    AddBrowserImg,
    AddCanvasImg,
    AddBrowserSvg,
    AddCanvasSvg,
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
    | { type: WorkspaceActionType.AddBrowserImg, value: EncodedImg }
    | { type: WorkspaceActionType.AddCanvasImg, value: EncodedImg }
    | { type: WorkspaceActionType.AddBrowserSvg, value: EncodedSvg }
    | { type: WorkspaceActionType.AddCanvasSvg, value: EncodedSvg }
    | { type: WorkspaceActionType.SetTool, value: LaurusTool }
    | { type: WorkspaceActionType.SetBrowserElement, value: LaurusBrowserElement | undefined }
    | { type: WorkspaceActionType.SetActiveElement, value: LaurusActiveElement | undefined }
    | { type: WorkspaceActionType.SetProjectImg, key: string, value: LaurusProjectImg }
    | { type: WorkspaceActionType.DeleteProjectImg, key: string }
    | { type: WorkspaceActionType.SetProjectSvg, key: string, value: LaurusProjectSvg }
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
        case WorkspaceActionType.AddBrowserImg: {
            const i = state.browserImgs.findIndex(i => i.media_path == action.value.media_path);
            if (i < 0) {
                return { ...state, browserImgs: [...state.browserImgs, action.value] }
            }
            else {
                return { ...state }
            }
        }
        case WorkspaceActionType.AddCanvasImg: {
            const i = state.canvasImgs.findIndex(i => i.media_path == action.value.media_path);
            if (i < 0) {
                return { ...state, canvasImgs: [...state.browserImgs, action.value] }
            }
            else {
                return { ...state }
            }
        }
        case WorkspaceActionType.AddBrowserSvg: {
            const i = state.browserSvgs.findIndex(i => i.media_path == action.value.media_path);
            if (i < 0) {
                return { ...state, browserSvgs: [...state.browserSvgs, action.value] }
            }
            else {
                return { ...state }
            }
        }
        case WorkspaceActionType.AddCanvasSvg: {
            const i = state.canvasSvgs.findIndex(i => i.media_path == action.value.media_path);
            if (i < 0) {
                return { ...state, canvasSvgs: [...state.browserSvgs, action.value] }
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
        case WorkspaceActionType.DeleteProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.delete(action.key);
            const newProject: LaurusProjectResult = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.SetProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.set(action.key, action.value);
            const newProject: LaurusProjectResult = { ...state.project, svgs: newSvgs }
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

function initProject(p: ProjectResult_V1_0[] | undefined) {
    const sortedProjects = (p && p.length > 0) ?
        p.sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active)) :
        [{ ...defaultWorkspace.project }];

    const projectImgsInit: Map<string, LaurusProjectImg> = new Map(sortedProjects[0].imgs.entries()
        .map(e => [e[0], { ...e[1], pending: false }]));

    const projectSvgsInit: Map<string, LaurusProjectSvg> = new Map(sortedProjects[0].svgs.entries()
        .map(e => [e[0], { ...e[1], pending: false }]));

    return {
        ...sortedProjects[0],
        imgs: projectImgsInit,
        svgs: projectSvgsInit
    }
}

function initReducer(
    {
        api,
        p,
        eN: e,
    }: InitReducerProps): WorkspaceState {
    return {
        apiOrigin: api,
        project: initProject(p),
        browserImgs: defaultWorkspace.browserImgs,
        canvasImgs: defaultWorkspace.canvasImgs,
        browserSvgs: defaultWorkspace.browserSvgs,
        canvasSvgs: defaultWorkspace.canvasSvgs,
        tool: defaultWorkspace.tool,
        effectNames: e ?? [],
        effects: defaultWorkspace.effects,
        timelineUnit: timelineUnits[0],
        timelineMaxValue: timelineValues[0],
        browserElement: defaultWorkspace.browserElement,
        activeElement: defaultWorkspace.activeElement,
        recordingLight: defaultWorkspace.recordingLight,
        fps: defaultWorkspace.fps,
    };
}

interface Workspace {
    apiOrigin: string | undefined,
    mediaPageSize: string | undefined,
    projectsInit: Promise<ProjectResult_V1_0[] | undefined>,
    effectsEnum: Promise<string[] | undefined>,
}

export default function Workspace({
    apiOrigin: api,
    mediaPageSize: mps,
    projectsInit,
    effectsEnum,
}: Workspace) {
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
    const [mediaPageSize] = useState(mps ? (parseInt(mps) || 2) : 2);
    const [showTimeline, setShowTimeline] = useState<boolean>(true);
    const [mediaBrowserFilter, setMediaBrowserFilter] = useState<'img' | 'svg'>('img');
    const [imgPageIndex, setImgPageIndex] = useState(0);
    const [svgPageIndex, setSvgPageIndex] = useState(0);
    const nextPageRef = useRef<HTMLDivElement | null>(null);

    const handleImgPageRequest = useCallback(async (pageIndex: number) => {
        if (nextPageRef.current) {
            nextPageRef.current.style.visibility = 'hidden'
        }
        const response = await getImgDiscoveryPage(appState.apiOrigin, pageIndex + 1, mediaPageSize);
        if (response && response.length > 0) {
            for (let i = 0; i < response.length; i++) {
                dispatch({ type: WorkspaceActionType.AddBrowserImg, value: { ...response[i] } })
            }
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return true;
        }

        else {
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return false;
        }
    }, [appState.apiOrigin, mediaPageSize]);

    const handleSvgPageRequest = useCallback(async (pageIndex: number) => {
        if (nextPageRef.current) {
            nextPageRef.current.style.visibility = 'hidden'
        }
        const response = await getSvgDiscoveryPage(appState.apiOrigin, pageIndex + 1, mediaPageSize);
        if (response && response.length > 0) {
            for (let i = 0; i < response.length; i++) {
                dispatch({ type: WorkspaceActionType.AddBrowserSvg, value: { ...response[i] } })
            }
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return true;
        }

        else {
            if (nextPageRef.current) {
                nextPageRef.current.style.visibility = 'visible'
            }
            return false;
        }
    }, [appState.apiOrigin, mediaPageSize]);

    useEffect(() => {
        /* background project downloader */

        const downloadImgsFromProjectInit = async () => {
            if (p && p.length > 0) {
                const project = initProject([...p]);
                const imgsArray = Array.from(project.imgs.values());
                for (let i = 0; i < imgsArray.length; i++) {
                    const imgMediaResult = await getImg(api, imgsArray[i].img_media_id, imgsArray[i].media_path);
                    if (imgMediaResult) {
                        dispatch({ type: WorkspaceActionType.AddCanvasImg, value: { ...imgMediaResult } });
                    }
                }
            }
        };

        const downloadImgsForBrowser = async (pageSize: number) => {
            const response = await getImgDiscoveryPage(api, 1, pageSize);
            if (response && response.length > 0) {
                const firstImg = response[0];
                for (let i = 0; i < response.length; i++) {
                    dispatch({ type: WorkspaceActionType.AddBrowserImg, value: { ...response[i] } })
                }
                const newThumnail: LaurusThumbnail = { value: { ...firstImg }, type: 'img' }
                dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { ...newThumnail } });
            }
        };

        const downloadSvgsFromProjectInit = async () => {
            if (p && p.length > 0) {
                const project = initProject([...p]);
                const svgsArray = Array.from(project.svgs.values());
                for (let i = 0; i < svgsArray.length; i++) {
                    const svgMediaResult = await getSvg(api, svgsArray[i].svg_media_id, svgsArray[i].media_path);
                    if (svgMediaResult) {
                        dispatch({ type: WorkspaceActionType.AddCanvasSvg, value: { ...svgMediaResult } });
                    }
                }
            }
        };

        const downloadSvgsForBrowser = async (pageSize: number) => {
            const response = await getSvgDiscoveryPage(api, 1, pageSize);
            if (response && response.length > 0) {
                for (let i = 0; i < response.length; i++) {
                    dispatch({ type: WorkspaceActionType.AddBrowserSvg, value: { ...response[i] } });
                }
            }
        };

        const downloadEffectsFromProjectInit = async () => {
            if (p && p.length > 0) {
                const mostRecent = initProject([...p]);
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

        const pageSize: number = mps ? (parseInt(mps) || 2) : 2;
        downloadEffectsFromProjectInit();
        downloadImgsFromProjectInit();
        downloadImgsForBrowser(pageSize);
        downloadSvgsFromProjectInit();
        downloadSvgsForBrowser(pageSize);
    }, [api, mps, mediaPageSize, p]);

    const svgElementsRef = useRef<Map<string, SVGSVGElement>>(null);
    const imgElementsRef = useRef<Map<string, HTMLImageElement>>(null);

    const getNewAnimations = useCallback(async (fill: FillMode, firstFrame: boolean) => {
        const newAnimations: Animation[] = [];
        const globalLimit: number = Math.max(...appState.effects
            .map(e => e.value.end));
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
                gridTemplateColumns: 'min-content 1fr min-content min-content min-content',
                gridTemplateRows: `min-content min-content 1fr min-content`,
                overflowX: "auto",
            }}>
            <WorkspaceContext value={{ appState: appState, dispatch }}>
                <div style={{ gridRow: '1', gridColumn: 'span 5', }}>
                    <Menubar />
                </div>
                <div style={{ gridRow: '2 / span 2', gridColumn: '1', overflowY: 'auto', }}>
                    {showTimeline ?
                        <TimelineArea
                            size={{ width: 1000, height: 5000 }}
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef}
                            onRightPanelClick={() => setShowTimeline(false)}
                        /> :
                        <>
                            <Bumper onBumperClick={() => {
                                setShowTimeline(true);
                            }} />
                            <div style={{
                                zIndex: 1,
                                position: 'fixed',
                                bottom: 100,
                                left: 40,
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                border: '1px solid rgba(0, 0, 0, 0.4)',
                                background: 'rgb(32, 32, 32)',
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
                                right: showMediaBrowser ? 506 : 86,
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
                <div
                    style={{
                        gridRow: '2',
                        gridColumn: '2 / -1',
                        width: '100%',
                    }} >
                    <Projectbar />
                </div>
                {/* canvas area */}
                <div
                    ref={canvasAreaRef}
                    style={{
                        gridRow: '3',
                        gridColumn: '2',
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
                            if (appState.project.project_id) {
                                const newProject: LaurusProjectResult = {
                                    ...appState.project,
                                    frame_left: newPosition.x,
                                    frame_top: newPosition.y
                                };
                                dispatch({ type: WorkspaceActionType.SetProject, value: newProject, });
                                await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                            }
                            else {
                                const newProject: LaurusProjectResult = {
                                    ...appState.project,
                                    frame_left: newPosition.x,
                                    frame_top: newPosition.y
                                };
                                const response = await createProject(appState.apiOrigin, { ...newProject });
                                if (response) {
                                    const newProject2: LaurusProjectResult = { ...newProject, project_id: response.project_id }
                                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                                }
                            }
                        }} />
                    {appState.tool.type != 'viewport' &&
                        <MediaOverlays
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef}
                            zIndex={3} />}
                </div>
                {showMediaBrowser &&
                    <Bumper onBumperClick={() => {
                        setShowMediaBrowser(false);
                    }} />
                }
                {showMediaBrowser &&
                    <div
                        style={{
                            gridRow: '3', gridColumn: '4',
                            width: 400,
                            height: '100%',
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
                }
                {/* right panel */}
                <div
                    style={{
                        gridRow: '3', gridColumn: '5',
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
                <div style={{ gridRow: '4', gridColumn: 'span 5' }}>
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
                            onClick={() => setShowTimeline(v => !v)}
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

interface MediaOverlays {
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    zIndex: number,
}
export function MediaOverlays({ svgElementsRef, imgElementsRef, zIndex }: MediaOverlays) {
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

    const onNewImgPosition = useCallback(async (key: string, imgMeta: LaurusProjectImg, newPosition: { x: number, y: number }) => {
        const newImg: LaurusProjectImg = { ...imgMeta, top: newPosition.y, left: newPosition.x };
        const newImgs: Map<string, LaurusProjectImg> = new Map(appState.project.imgs);
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

    const onNewSvgPosition = useCallback(async (key: string, svgMeta: LaurusProjectSvg, newPosition: { x: number, y: number }) => {
        const newSvg: LaurusProjectSvg = { ...svgMeta, top: newPosition.y, left: newPosition.x };
        const newSvgs: Map<string, LaurusProjectSvg> = new Map(appState.project.svgs);
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
            const imgData = appState.canvasImgs.find(i => i.media_path == imgMeta.media_path);
            if (imgData) {
                return (
                    <div
                        onClick={(event) => {
                            // option key on mac
                            if (event.altKey || appState.tool.type == 'activate') {
                                const newImg: LaurusProjectImg = { ...imgMeta, pending: true }
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
            const svgData = appState.browserSvgs.find(s => s.media_path == svgMeta.media_path);
            if (svgData) {
                return (
                    <div
                        onClick={(event) => {
                            // option key on mac
                            if (event.altKey || appState.tool.type == 'activate') {
                                const newSvg: LaurusProjectSvg = { ...svgMeta, pending: true }
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
            const imgData = appState.canvasImgs.find(i => i.media_path == imgMeta.media_path);
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
                                const newImg: LaurusProjectImg = { ...imgMeta, pending: false }
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
                                        for (let i = 0; i < appState.effects.length; i++) {
                                            const effect = appState.effects[i];
                                            switch (effect.type) {
                                                case "scale": {
                                                    if (effect.value.math.has(key)) {
                                                        const newMath = new Map(effect.value.math);
                                                        newMath.delete(key);
                                                        const newMove: LaurusScale = { ...effect.value, math: newMath }
                                                        await updateScale(appState.apiOrigin, effect.key, newMove);
                                                    }
                                                    break;
                                                }
                                                case "move": {
                                                    if (effect.value.math.has(key)) {
                                                        const newMath = new Map(effect.value.math);
                                                        newMath.delete(key);
                                                        const newMove: LaurusMove = { ...effect.value, math: newMath }
                                                        await updateMove(appState.apiOrigin, effect.key, newMove);
                                                    }
                                                    break;
                                                }
                                            }

                                        }

                                        if (appState.activeElement?.key == key) {
                                            dispatch({ type: WorkspaceActionType.SetActiveElement, value: undefined });
                                        }

                                        const newImgs: Map<string, LaurusProjectImg> = new Map(appState.project.imgs);
                                        newImgs.delete(key);
                                        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs }
                                        if (newProject.project_id) {
                                            await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                                            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
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
                                        const newImg: LaurusProjectImg = { ...imgMeta, pending: false };
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
                    </div >
                );
            }
        })}
        {
            Array.from(appState.project.svgs.entries().filter(e => e[1].pending)).map((e) => {
                const [key, svgMeta] = e;
                const position = appState.tool.type != 'viewport' ? { top: Math.max(0, svgMeta.top), left: Math.max(0, svgMeta.left) }
                    : { top: (svgMeta.top - appState.project.frame_top), left: (svgMeta.left - appState.project.frame_left) };
                const svgData = appState.browserSvgs.find(s => s.media_path == svgMeta.media_path);
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
                                    const newSvg: LaurusProjectSvg = { ...svgMeta, pending: false }
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
                                            for (let i = 0; i < appState.effects.length; i++) {
                                                const effect = appState.effects[i];
                                                switch (effect.type) {
                                                    case "scale": {
                                                        if (effect.value.math.has(key)) {
                                                            const newMath = new Map(effect.value.math);
                                                            newMath.delete(key);
                                                            const newMove: LaurusScale = { ...effect.value, math: newMath }
                                                            await updateScale(appState.apiOrigin, effect.key, newMove);
                                                        }
                                                        break;
                                                    }
                                                    case "move": {
                                                        if (effect.value.math.has(key)) {
                                                            const newMath = new Map(effect.value.math);
                                                            newMath.delete(key);
                                                            const newMove: LaurusMove = { ...effect.value, math: newMath }
                                                            await updateMove(appState.apiOrigin, effect.key, newMove);
                                                        }
                                                        break;
                                                    }
                                                }
                                            }

                                            if (appState.activeElement?.key == key) {
                                                dispatch({ type: WorkspaceActionType.SetActiveElement, value: undefined });
                                            }

                                            const newSvgs: Map<string, LaurusProjectSvg> = new Map(appState.project.svgs);
                                            newSvgs.delete(key);
                                            const newProject: LaurusProjectResult = { ...appState.project, svgs: newSvgs }
                                            if (newProject.project_id) {
                                                await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                                                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
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
                                            const newSvg: LaurusProjectSvg = { ...svgMeta, pending: false }
                                            dispatch({ type: WorkspaceActionType.SetProjectSvg, key, value: newSvg });
                                            const newActiveElement: LaurusActiveElement = { key, value: { type: 'svg', value: { ...svgData } } };
                                            dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                        }}>
                                        <ReactSvg
                                            svg={checkCircle('rgb(40, 40, 40)')}
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
            })
        }
    </>)
}

interface Bumper {
    onBumperClick: () => void,
}
function Bumper({ onBumperClick }: Bumper) {
    return (<>
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
                    onContainerClick={onBumperClick} />
            </div>
        </div>
    </>)
}
