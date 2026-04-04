'use client'
import { createContext, RefObject, use, useCallback, useContext, useLayoutEffect, useReducer, useRef, useState } from "react";
import styles from '../app.module.css';
import {
    ScaleEquation_V1_0,
    Scale_V1_0,
    ScaleResult_V1_0,
    MoveEquation_V1_0,
    Move_V1_0,
    MoveResult_V1_0,
    getFrames,
    ImgMedia_V1_0,
    getImgDiscoveryPage,
    updateMove,
    updateScale,
    getSvgDiscoveryPage,
    ImgMediaResult_V1_0,
    SvgMediaResult_V1_0
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "./statusbar";
import Canvas from "./canvas";
import MediaBrowser, { MediaBrowserFilter } from "./media-browser";
import { hexagon, checkCircle, moreVert, playArrow, SvgRepo, photo, getCrops, LaurusCropSvg } from "../svg-repo";
import { DraggableReactImg, DraggableReactSvg, ReactImg } from "./media";
import Projectbar from "./projectbar";
import TimelineArea from "./timeline-area";
import DraggableCamera from "./camera";
import { dellaRespira } from "../fonts";
import { NEW_PROJECT_CANVAS_SIZE, FRAME_HEIGHT_5_7, FRAME_WIDTH_5_7, WorkspaceResolution } from "./workspace-resolution";
import { ProjectDependencies, BrowserDependencies } from "./page";
import Toolbar from "./toolbar";
import { ProjectResult_V1_0, updateProject, createProject, ProjectImg_V1_0, ProjectSvg_V1_0, ProjectLayer_V1_0 } from "../projects/projects.server";

export type LaurusImgResult = ImgMediaResult_V1_0;
export type LaurusSvgResult = SvgMediaResult_V1_0;
export type LaurusImg = ImgMedia_V1_0;

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
    | { type: 'svg', value: LaurusSvgResult }
    | { type: 'img', value: LaurusImgResult }
export type LaurusTool =
    | { type: 'drop' }
    | { type: 'none' }
    | { type: 'activate' }
    | { type: 'viewport' }
export type LaurusBrowserElement = LaurusThumbnail
export type LaurusActiveElement = { key: string, value: LaurusThumbnail }
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
}
export interface LaurusProjectImg extends ProjectImg_V1_0 {
    pending: boolean
}
export interface LaurusProjectSvg extends ProjectSvg_V1_0 {
    pending: boolean
}
export type LaurusLayer = ProjectLayer_V1_0;
export interface LaurusProjectResult extends ProjectResult_V1_0 {
    imgs: Map<string, LaurusProjectImg>
    svgs: Map<string, LaurusProjectSvg>
}

/**
 * if state is used across a depth of three or more components, it belongs in here.
 */
export interface WorkspaceState {
    apiOrigin: string | undefined,
    project: LaurusProjectResult,
    canvasImgs: LaurusImgResult[],
    canvasSvgs: LaurusSvgResult[],
    browserImgs: LaurusImgResult[],
    browserSvgs: LaurusSvgResult[],
    browserFrames: LaurusCropSvg[],
    tool: LaurusTool,
    browserElement: LaurusBrowserElement | undefined,
    activeElement: LaurusActiveElement | undefined,
    effectNames: string[],
    effects: LaurusEffect[],
    effectClipboard: LaurusEffect | undefined,
    timelineUnit: string,
    timelineMaxValue: number,
    recordingLight: boolean,
    fps: number,
    timelineUnits: string[],
    timelineValues: number[],
    resolution: WorkspaceResolution,
}
export const defaultWorkspace: WorkspaceState = {
    apiOrigin: undefined,
    project: {
        name: "untitled",
        canvas_width: NEW_PROJECT_CANVAS_SIZE,
        canvas_height: NEW_PROJECT_CANVAS_SIZE,
        frame_top: -1,
        frame_left: -1,
        frame_width: 0,
        frame_height: 0,
        project_id: "",
        timestamp: "",
        last_active: "",
        imgs: new Map(),
        svgs: new Map(),
        layers: new Map()
    },
    tool: { type: 'none' },
    canvasImgs: [],
    canvasSvgs: [],
    browserImgs: [],
    browserSvgs: [],
    browserFrames: [],
    effectNames: [],
    effects: [],
    effectClipboard: undefined,
    timelineUnit: '',
    timelineMaxValue: 0,
    timelineUnits: [],
    timelineValues: [],
    browserElement: undefined,
    activeElement: undefined,
    recordingLight: false,
    fps: 60,
    resolution: { type: 'midhigh', factor: 0.7, value: { width: 0, height: 0 } }
}

export enum WorkspaceActionType {
    SetWorkspace,
    SetProject,
    AddBrowserImg,
    UpdateBrowserImgs,
    AddBrowserSvg,
    UpdateBrowserSvgs,
    AddCanvasImg,
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
    SetEffectClipboard,
    SetTimelineUnit,
    SetTimelineMaxValue,
    SetRecordingLight,
    SetFps,
}

export type WorkspaceAction =
    | { type: WorkspaceActionType.SetWorkspace, value: WorkspaceState }
    | { type: WorkspaceActionType.SetProject, value: LaurusProjectResult }
    | { type: WorkspaceActionType.AddBrowserImg, value: LaurusImgResult, first: boolean }
    | { type: WorkspaceActionType.UpdateBrowserImgs, value: LaurusImgResult[] }
    | { type: WorkspaceActionType.AddBrowserSvg, value: LaurusSvgResult, first: boolean }
    | { type: WorkspaceActionType.UpdateBrowserSvgs, value: LaurusSvgResult[] }
    | { type: WorkspaceActionType.AddCanvasImg, value: LaurusImgResult }
    | { type: WorkspaceActionType.AddCanvasSvg, value: LaurusSvgResult }
    | { type: WorkspaceActionType.SetTool, value: LaurusTool }
    | { type: WorkspaceActionType.SetBrowserElement, value: LaurusBrowserElement | undefined }
    | { type: WorkspaceActionType.SetActiveElement, value: LaurusActiveElement | undefined }
    | { type: WorkspaceActionType.SetProjectImg, key: string, value: LaurusProjectImg }
    | { type: WorkspaceActionType.DeleteProjectImg, key: string }
    | { type: WorkspaceActionType.SetProjectSvg, key: string, value: LaurusProjectSvg }
    | { type: WorkspaceActionType.DeleteProjectSvg, key: string }
    | { type: WorkspaceActionType.SetEffects, value: LaurusEffect[] }
    | { type: WorkspaceActionType.SetEffect, value: LaurusEffect }
    | { type: WorkspaceActionType.SetEffectClipboard, value: LaurusEffect }
    | { type: WorkspaceActionType.SetTimelineUnit, value: string }
    | { type: WorkspaceActionType.SetTimelineMaxValue, value: number }
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
            const currentBrowserImgs = [...state.browserImgs];
            const i = currentBrowserImgs.findIndex(i => i.media_key == action.value.media_key);
            if (i < 0) {
                return action.first ?
                    { ...state, browserImgs: [action.value, ...currentBrowserImgs] } :
                    { ...state, browserImgs: [...currentBrowserImgs, action.value] }
            }
            else {
                return state
            }
        }
        case WorkspaceActionType.UpdateBrowserImgs: {
            const newBrowserImgs = [...state.browserImgs];
            for (let i = 0; i < action.value.length; i++) {
                const newBrowserImg = action.value[i];
                const index = newBrowserImgs.findIndex(img => img.media_key == newBrowserImg.media_key);
                if (index > -1) {
                    newBrowserImgs[index] = { ...newBrowserImg }
                }
            }
            return { ...state, browserImgs: newBrowserImgs }
        }
        case WorkspaceActionType.AddBrowserSvg: {
            const currentBrowserSvgs = [...state.browserSvgs];
            const i = currentBrowserSvgs.findIndex(i => i.media_key == action.value.media_key);
            if (i < 0) {
                return action.first ?
                    { ...state, browserSvgs: [action.value, ...currentBrowserSvgs] } :
                    { ...state, browserSvgs: [...currentBrowserSvgs, action.value] }
            }
            else {
                return state
            }
        }
        case WorkspaceActionType.UpdateBrowserSvgs: {
            const newBrowserSvgs = [...state.browserSvgs];
            for (let i = 0; i < action.value.length; i++) {
                const newBrowserSvg = action.value[i];
                const index = newBrowserSvgs.findIndex(svg => svg.media_key == newBrowserSvg.media_key);
                if (index > -1) {
                    newBrowserSvgs[index] = { ...newBrowserSvg }
                }
            }
            return { ...state, browserSvgs: newBrowserSvgs }
        }
        case WorkspaceActionType.AddCanvasImg: {
            const currentCanvasImgs = [...state.canvasImgs];
            const i = currentCanvasImgs.findIndex(i => i.media_key == action.value.media_key);
            if (i < 0) {
                return { ...state, canvasImgs: [...currentCanvasImgs, action.value] }
            }
            else {
                return state
            }
        }
        case WorkspaceActionType.AddCanvasSvg: {
            const currentCanvasSvgs = [...state.canvasSvgs];
            const i = currentCanvasSvgs.findIndex(i => i.media_key == action.value.media_key);
            if (i < 0) {
                return { ...state, canvasSvgs: [...currentCanvasSvgs, action.value] }
            }
            else {
                return state
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
        case WorkspaceActionType.SetEffectClipboard: {
            return { ...state, effectClipboard: { ...action.value } }
        }
        case WorkspaceActionType.SetTimelineUnit: {
            return { ...state, timelineUnit: action.value }
        }
        case WorkspaceActionType.SetTimelineMaxValue: {

            return { ...state, timelineMaxValue: action.value }
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

function initProject(p: ProjectResult_V1_0) {
    const projectImgsInit: Map<string, LaurusProjectImg> =
        new Map(p.imgs.entries().map(e => [e[0], { ...e[1], pending: false }]));

    const projectSvgsInit: Map<string, LaurusProjectSvg> =
        new Map(p.svgs.entries().map(e => [e[0], { ...e[1], pending: false }]));

    return {
        ...p,
        imgs: projectImgsInit,
        svgs: projectSvgsInit,
        frame_width: p.frame_width > 0 && p.frame_width <= p.canvas_width ? p.frame_width : FRAME_WIDTH_5_7,
        frame_height: p.frame_height > 0 && p.frame_height <= p.canvas_height ? p.frame_height : FRAME_HEIGHT_5_7,
    }
}

interface InitReducer {
    arg1: ProjectDependencies | undefined,
    arg2: string[] | undefined,
    arg3: number[],
    arg4: string[],
    arg5: string | undefined,
    arg6: BrowserDependencies,
    arg7: WorkspaceResolution,
}
function initReducer({
    arg1: projectDependencies,
    arg2: effectNames,
    arg3: timelineValues,
    arg4: timelineUnits,
    arg5: apiOrigin,
    arg6: browserDependencies,
    arg7: resolution,
}: InitReducer): WorkspaceState {
    const newEffects: LaurusEffect[] = [];
    if (projectDependencies) {
        projectDependencies.scales.forEach(e => {
            newEffects.push({
                type: 'scale',
                key: e.scale_id,
                value: {
                    ...e,
                }
            })
        });
        projectDependencies?.moves.forEach(e => {
            newEffects.push({
                type: 'move',
                key: e.move_id,
                value: {
                    ...e,
                }
            })
        });
    }

    const newCanvasSvgs: LaurusSvgResult[] =
        projectDependencies?.canvasSvgs.map(v => { return { ...v } }) ?? [];
    const newCanvasImgs: LaurusImgResult[] =
        projectDependencies?.canvasImgs.map(v => { return { ...v } }) ?? [];

    const newBrowserImgs: LaurusImgResult[] =
        browserDependencies.browserImgs.map(v => { return { ...v } });
    const newBrowserSvgs: LaurusSvgResult[] =
        browserDependencies.browserSvgs.map(v => { return { ...v } });
    const newBrowserFrames: LaurusCropSvg[] = getCrops('rgba(200, 200, 200, 1)');

    const newBrowserElement: LaurusThumbnail | undefined = newBrowserImgs.length > 0 ?
        { value: { ...newBrowserImgs[0] }, type: 'img' } :
        {
            value: {
                ...photo(),
                timestamp: "",
                last_active: "",
                svg_media_id: "",
                categories: [],
                order: 0,
                media_uri: ""
            }, type: 'svg'
        };

    const defaulProject: LaurusProjectResult = {
        ...defaultWorkspace.project,
        frame_width: Math.round(FRAME_WIDTH_5_7 * resolution.factor),
        frame_height: Math.round(FRAME_HEIGHT_5_7 * resolution.factor)
    };

    return {
        ...defaultWorkspace,
        project: projectDependencies ?
            initProject(projectDependencies.project) :
            defaulProject,
        effects: newEffects,
        canvasImgs: newCanvasImgs,
        canvasSvgs: newCanvasSvgs,
        effectNames: effectNames ?? [],
        apiOrigin: apiOrigin,
        timelineUnit: timelineUnits[0],
        timelineMaxValue: timelineValues[0],
        timelineUnits: [...timelineUnits],
        timelineValues: [...timelineValues],
        browserImgs: newBrowserImgs,
        browserSvgs: newBrowserSvgs,
        browserFrames: newBrowserFrames,
        browserElement: newBrowserElement,
        resolution
    }
}

interface Workspace {
    apiOriginInit: string | undefined,
    mediaPageSizeInit: number,
    timelineValuesInit: number[],
    timelineUnitsInit: string[],
    effectNamesInitPromise: Promise<string[] | undefined>,
    projectInitPromise: Promise<ProjectDependencies | undefined>,
    browserInitPromise: Promise<BrowserDependencies>,
    resolutionInit: WorkspaceResolution,
}
export default function Workspace({
    apiOriginInit,
    mediaPageSizeInit,
    timelineValuesInit,
    timelineUnitsInit,
    effectNamesInitPromise,
    projectInitPromise,
    browserInitPromise,
    resolutionInit,
}: Workspace) {
    const svgElementsRef = useRef<Map<string, SVGSVGElement>>(null);
    const imgElementsRef = useRef<Map<string, HTMLImageElement>>(null);

    const effectNamesInit = use(effectNamesInitPromise);
    const projectInit = use(projectInitPromise);
    const browserInit = use(browserInitPromise);
    const [appState, dispatch] = useReducer(
        workspaceContextReducer,
        {
            arg1: projectInit,
            arg2: effectNamesInit,
            arg3: timelineValuesInit,
            arg4: timelineUnitsInit,
            arg5: apiOriginInit,
            arg6: browserInit,
            arg7: resolutionInit,
        }, initReducer);
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
    const [mediabarHeight] = useState(() => {
        switch (resolutionInit.type) {
            case "high": return 50
            case "midhigh": return 40
            case "low":
            case "midlow": return 38
        }
    });
    const [showMediaBrowser, setShowMediaBrowser] = useState<boolean>(false);
    const [mediaPageSize] = useState(mediaPageSizeInit);
    const [showTimeline, setShowTimeline] = useState<boolean>(true);
    const [mediaBrowserFilter, setMediaBrowserFilter] = useState<MediaBrowserFilter>('img');
    const [mediaBrowserWidth] = useState(() => {
        switch (resolutionInit.type) {
            case "high": return 400
            case "midhigh": return 280
            case "low":
            case "midlow": return 240
        }
    });

    const [minifiedControlsSize] = useState(() => {
        switch (resolutionInit.type) {
            case "high": return {
                playContainer: 44,
                playSvg: 44,
                playBottom: 100,
                playLeft: 40,
                recordingWidth: 14,
                recordingHeight: 14,
                recordingBottom: 115,
                recordingRight1: 506,
                recordingRight2: 86,
            }
            case "midhigh": return {
                playContainer: 44,
                playSvg: 44,
                playBottom: 80,
                playLeft: 40,
                recordingWidth: 14,
                recordingHeight: 14,
                recordingBottom: 95,
                recordingRight1: 366,
                recordingRight2: 66,
            }
            case "low":
            case "midlow": return {
                playContainer: 40,
                playSvg: 40,
                playBottom: 80,
                playLeft: 40,
                recordingWidth: 14,
                recordingHeight: 14,
                recordingBottom: 95,
                recordingRight1: 336,
                recordingRight2: 66,
            }
        }
    });
    const [statusAction] = useState<string>("laurus workspace");
    const [statusBody] = useState<string[]>([]);

    const handleImgPageRequest = useCallback(async () => {
        const mediaArray = Array.from(appState.browserImgs.values());
        const response = await getImgDiscoveryPage(appState.apiOrigin, mediaPageSize, mediaArray.flatMap(m => m.img_media_id));
        if (response && response.length > 0) {
            for (let i = 0; i < response.length; i++) {
                dispatch({ type: WorkspaceActionType.AddBrowserImg, value: { ...response[i] }, first: false })
            }
            return true;
        }

        else {
            return false;
        }
    }, [appState.apiOrigin, appState.browserImgs, mediaPageSize]);

    const handleSvgPageRequest = useCallback(async () => {
        const mediaArray = Array.from(appState.browserSvgs.values());
        const response = await getSvgDiscoveryPage(appState.apiOrigin, mediaPageSize, mediaArray.flatMap(m => m.svg_media_id));
        if (response && response.length > 0) {
            for (let i = 0; i < response.length; i++) {
                dispatch({ type: WorkspaceActionType.AddBrowserSvg, value: { ...response[i] }, first: false })
            }
            return true;
        }

        else {
            return false;
        }
    }, [appState.apiOrigin, appState.browserSvgs, mediaPageSize]);

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
            }}>
            <WorkspaceContext value={{ appState: appState, dispatch }}>
                <div style={{ gridRow: '1', gridColumn: 'span 5', }}>
                    <Menubar resolution={resolutionInit} />
                </div>
                <div style={{ gridRow: '2 / span 2', gridColumn: '1', overflowY: 'auto', }}>
                    {showTimeline ?
                        <TimelineArea
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
                                bottom: minifiedControlsSize.playBottom,
                                left: minifiedControlsSize.playLeft,
                                width: minifiedControlsSize.playContainer,
                                height: minifiedControlsSize.playContainer,
                                borderRadius: '50%',
                                border: '1px solid rgba(0, 0, 0, 0.4)',
                                background: 'rgb(32, 32, 32)',
                                boxShadow: "rgba(0 ,0, 0, 0.4) 2px 2px 4px 0px",
                            }}>
                                <SvgRepo
                                    svg={playArrow()}
                                    containerSize={{
                                        width: minifiedControlsSize.playSvg,
                                        height: minifiedControlsSize.playSvg
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
                                bottom: minifiedControlsSize.recordingBottom,
                                right: showMediaBrowser ? minifiedControlsSize.recordingRight1 : minifiedControlsSize.recordingRight2,
                                width: minifiedControlsSize.recordingWidth,
                                height: minifiedControlsSize.recordingHeight,
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
                            const newProject: LaurusProjectResult = {
                                ...appState.project,
                                frame_left: newPosition.x,
                                frame_top: newPosition.y
                            };
                            if (appState.project.project_id) {
                                dispatch({ type: WorkspaceActionType.SetProject, value: newProject, });
                                await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                            }
                            else {
                                const response = await createProject(appState.apiOrigin, { ...newProject });
                                if (response) {
                                    dispatch({ type: WorkspaceActionType.SetProject, value: { ...response } });
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
                            width: mediaBrowserWidth,
                            height: '100%',
                            border: '1px solid rgba(10, 10, 10, 1)',
                            background: 'rgba(20, 20, 20, 1)'
                        }} >
                        <MediaBrowser
                            filter={mediaBrowserFilter}
                            onNextPage={async () => {
                                switch (mediaBrowserFilter) {
                                    case "img": {
                                        await handleImgPageRequest();
                                        break;
                                    }
                                    case "svg": {
                                        await handleSvgPageRequest();
                                        break;
                                    }
                                }
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
                        borderLeft: '1px solid rgba(10, 10, 10, 1)',
                        background: "linear-gradient(34deg, rgba(25, 25, 25, 1) 34%, rgba(21, 21, 21, 1))",
                        width: 'min-content',
                        justifyContent: 'center'
                    }}>
                    <Toolbar resolution={resolutionInit} />
                </div>
                <div style={{ gridRow: '4', gridColumn: 'span 5' }}>
                    <div style={{
                        height: mediabarHeight,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: 'space-between',
                        background: "linear-gradient(34deg, rgba(25, 25, 25, 1) 34%, rgba(21, 21, 21, 1))",
                        border: '1px solid rgb(19, 19, 19)',
                    }}>
                        <div
                            title='active element'
                            onClick={() => setShowTimeline(v => !v)}
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            style={{
                                borderRight: '1px solid rgba(10, 10, 10, 1)',
                                position: 'relative'
                            }}>
                            {appState.activeElement && (() => {
                                switch (appState.activeElement.value.type) {
                                    case "svg": {
                                        return (
                                            <SvgRepo
                                                svg={appState.activeElement.value.value as LaurusSvgResult}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={appState.activeElement.value.value as LaurusImgResult}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>
                        <div
                            title='browser element'
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            onClick={() => setShowMediaBrowser(v => !v)}
                            style={{
                                borderLeft: '1px solid rgba(10, 10, 10, 1)',
                                position: 'relative'
                            }}>
                            {appState.browserElement && (() => {
                                switch (appState.browserElement.type) {
                                    case "svg": {
                                        return (
                                            <SvgRepo
                                                svg={appState.browserElement.value as LaurusSvgResult}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={appState.browserElement.value as LaurusImgResult}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>
                    </div>
                    <Statusbar action={statusAction} body={statusBody} />
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
            const imgData = appState.canvasImgs.find(i => i.media_key == imgMeta.media_key);
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
            const svgData = appState.canvasSvgs.find(s => s.media_key == svgMeta.media_key);
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
            const imgData = appState.canvasImgs.find(i => i.media_key == imgMeta.media_key);
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
                                                        const newScale: LaurusScaleResult = { ...effect.value, math: newMath }
                                                        dispatch({
                                                            type: WorkspaceActionType.SetEffect,
                                                            value: { type: 'scale', key: effect.key, value: { ...newScale } }
                                                        });
                                                        await updateScale(appState.apiOrigin, effect.key, newScale);
                                                    }
                                                    break;
                                                }
                                                case "move": {
                                                    if (effect.value.math.has(key)) {
                                                        const newMath = new Map(effect.value.math);
                                                        newMath.delete(key);
                                                        const newMove: LaurusMoveResult = { ...effect.value, math: newMath }
                                                        dispatch({
                                                            type: WorkspaceActionType.SetEffect,
                                                            value: { type: 'move', key: effect.key, value: { ...newMove } }
                                                        });
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
                                    <SvgRepo
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
                                    onClick={async () => {
                                        const newImg: LaurusProjectImg = { ...imgMeta, pending: false };
                                        dispatch({ type: WorkspaceActionType.SetProjectImg, key, value: newImg });
                                        const newActiveElement: LaurusActiveElement = { key, value: { type: 'img', value: { ...imgData } } };
                                        dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                    }}>
                                    <SvgRepo
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
                const svgData = appState.canvasSvgs.find(s => s.media_key == svgMeta.media_key);
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
                                    <SvgRepo
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
                                        <SvgRepo
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
                                        <SvgRepo
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
                <SvgRepo
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
