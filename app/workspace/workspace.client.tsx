'use client'
import { createContext, CSSProperties, use, useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
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
    getSvgDiscoveryPage,
    ImgMediaResult_V1_0,
    SvgMediaResult_V1_0,
    Rotate_V1_0,
    RotateEquation_V1_0,
    RotateResult_V1_0,
    LaurusFrame
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "./statusbar";
import Canvas from "./canvas";
import MediaBrowser, { MediaBrowserFilter } from "./media-browser";
import { moreVert, playArrow, SvgRepo, photo, getCrops, LaurusCropSvg } from "../svg-repo";
import { DraggableProjectImg, DraggableProjectSvg } from "./draggable-media";
import Projectbar from "./projectbar";
import TimelineArea from "./timeline-area";
import DraggableCamera from "./camera";
import { NEW_PROJECT_CANVAS_SIZE, FRAME_HEIGHT_5_7, FRAME_WIDTH_5_7, WorkspaceResolution } from "./workspace-resolution";
import { ProjectDependencies, BrowserDependencies } from "./page";
import Toolbar from "./toolbar";
import { ProjectResult_V1_0, updateProject, createProject } from "../projects/projects.server";
import { MeDependencies } from "../page";
import SubProjectbar from "./sub-projectbar";
import { LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "../projects/projects.client";
import NextImage from "next/image";

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
export type LaurusRotateEquation = RotateEquation_V1_0;
export interface LaurusRotate extends Rotate_V1_0 {
    math: Map<string, LaurusRotateEquation>,
}
export interface LaurusRotateResult extends RotateResult_V1_0 {
    math: Map<string, LaurusRotateEquation>,
}
export type LaurusEffect =
    | { type: 'scale', key: string, locked: boolean, value: LaurusScaleResult }
    | { type: 'move', key: string, locked: boolean, value: LaurusMoveResult }
    | { type: 'rotate', key: string, locked: boolean, value: LaurusRotateResult }
export type LaurusThumbnail =
    | { type: 'svg', value: LaurusSvgResult }
    | { type: 'img', value: LaurusImgResult }
export type LaurusTool =
    | { type: 'drop' }
    | { type: 'none' }
    | { type: 'contextmenu' }
    | { type: 'viewport' }
    | { type: 'move' }
    | { type: 'scale' }
    | { type: 'rotate' }
export type LaurusBrowserElement = LaurusThumbnail
export type LaurusActiveElement = { key: string, type: 'svg' | 'img', locallyActivatedEffectKey?: string }
export enum AbsolutePosition {
    topRight = 'topRight',
    topLeft = 'topLeft',
    bottomRight = 'bottomRight',
    bottomLeft = 'bottomLeft',
}
export type ContextMenuConfig =
    | { position: AbsolutePosition.topRight, width: number, height: number }
    | { position: AbsolutePosition.topLeft, width: number, height: number }
    | { position: AbsolutePosition.bottomRight, width: number, height: number }
    | { position: AbsolutePosition.bottomLeft, width: number, height: number }
export const DEFAULT_CONTEXT_MENU_CONFIG: ContextMenuConfig = { position: AbsolutePosition.topRight, width: 300, height: 400 }
export function getNewContextMenuConfig(
    newPosition: { top: number, left: number },
    canvasSize: { width: number, height: number },
    mediaSize: { width: number, height: number },
    mediaScale: { x: number, y: number },
    currentValue: ContextMenuConfig): ContextMenuConfig {
    const left = (newPosition.left + (mediaSize.width * mediaScale.x) + currentValue.width > canvasSize.width) ? true : false;
    const bottom = (newPosition.top + (mediaSize.height * mediaScale.y) + currentValue.height > canvasSize.height) ? true : false;
    if (bottom && left) {
        return { ...currentValue, position: AbsolutePosition.bottomLeft };
    }
    else if (bottom && !left) {
        return { ...currentValue, position: AbsolutePosition.bottomRight };
    }
    else if (!bottom && left) {
        return { ...currentValue, position: AbsolutePosition.topLeft };
    }
    else {
        return { ...currentValue, position: AbsolutePosition.topRight };
    }
}
export interface LaurusTransform {
    cssProps: CSSProperties,
    bounds: {
        width: number,
        height: number,
        deltas: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        }
    }
}
export type CarouselEntry =
    | { type: 'svg', key: string }
    | { type: 'img', key: string }

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

export function toKeyframes(firstFrame: boolean, laurusFrames: LaurusFrame[]): Keyframe[] {
    const framesToMap = firstFrame ? [laurusFrames[0]] : laurusFrames;
    const keyframes: Keyframe[] = framesToMap.map((f, i) => {
        return i < laurusFrames.length - 1 ?
            {
                translate: `${f.x}px ${f.y}px 0px`,
                scale: `${f.sx} ${f.sy}`,
                rotate: `${f.rx} ${f.ry} ${f.rz} ${f.rangle}deg`,
                easing: 'step-end'
            } :
            {
                translate: `${f.x}px ${f.y}px 0px`,
                scale: `${f.sx} ${f.sy}`,
                rotate: `${f.rx} ${f.ry} ${f.rz} ${f.rangle}deg`,
            }
    });
    return keyframes;
}

export interface WorkspaceState {
    apiOrigin: string | undefined,
    accessToken: string | undefined,
    project: LaurusProjectResult,
    lightFrameBackground: boolean,
    canvasImgs: Map<string, LaurusImgResult>,
    canvasSvgs: Map<string, LaurusSvgResult>,
    browserImgs: LaurusImgResult[],
    browserSvgs: LaurusSvgResult[],
    browserFrames: LaurusCropSvg[],
    carouselEntries: CarouselEntry[],
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
    accessToken: undefined,
    project: {
        name: "untitled",
        canvas_width: NEW_PROJECT_CANVAS_SIZE,
        canvas_height: NEW_PROJECT_CANVAS_SIZE,
        frame_top: -1,
        frame_left: -1,
        frame_width: 0,
        frame_height: 0,
        frame_scale_x: 1,
        frame_scale_y: 1,
        frame_rotate_x: 0,
        frame_rotate_y: 0,
        frame_rotate_z: 0,
        frame_rotate_angle: 0,
        project_id: "",
        timestamp: "",
        last_active: "",
        imgs: new Map(),
        svgs: new Map(),
        layers: new Map(),
        browse_public_imgs: false,
        browse_public_svgs: false,
        creator: "",
        last_editor: ""
    },
    lightFrameBackground: false,
    tool: { type: 'none' },
    canvasImgs: new Map(),
    canvasSvgs: new Map(),
    browserImgs: [],
    browserSvgs: [],
    browserFrames: [],
    carouselEntries: [],
    effectNames: [],
    effects: [],
    effectClipboard: undefined,
    timelineUnit: '',
    timelineMaxValue: 0,
    timelineUnits: [],
    timelineValues: [],
    browserElement: {
        value: {
            ...photo("rgb(62,62,62)"),
            timestamp: "",
            last_active: "",
            svg_media_id: "",
            categories: [],
            order: 0,
            media_uri: ""
        },
        type: 'svg'
    },
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
    SetBrowserImgs,
    DeleteBrowserImg,
    AddBrowserSvg,
    UpdateBrowserSvgs,
    SetBrowserSvgs,
    DeleteBrowserSvg,
    SetCanvasImg,
    DeleteCanvasImg,
    SetCanvasImgs,
    SetCanvasSvg,
    DeleteCanvasSvg,
    SetCanvasSvgs,
    SetTool,
    SetBrowserElement,
    SetActiveElement,
    SetProjectImg,
    SetProjectSvg,
    DeleteProjectImg,
    DeleteProjectSvg,
    SetLightFrameBackground,
    SetEffects,
    SetEffect,
    DeleteEffect,
    SetEffectClipboard,
    SetTimelineUnit,
    SetTimelineMaxValue,
    SetRecordingLight,
    SetFps,
    AddCarouselEntry,
    DeleteCarouselEntry,
}

export type WorkspaceAction =
    | { type: WorkspaceActionType.SetWorkspace, value: WorkspaceState }
    | { type: WorkspaceActionType.SetProject, value: LaurusProjectResult }
    | { type: WorkspaceActionType.AddBrowserImg, value: LaurusImgResult, first: boolean }
    | { type: WorkspaceActionType.UpdateBrowserImgs, value: LaurusImgResult[] }
    | { type: WorkspaceActionType.SetBrowserImgs, value: LaurusImgResult[] }
    | { type: WorkspaceActionType.DeleteBrowserImg, value: string }
    | { type: WorkspaceActionType.AddBrowserSvg, value: LaurusSvgResult, first: boolean }
    | { type: WorkspaceActionType.UpdateBrowserSvgs, value: LaurusSvgResult[] }
    | { type: WorkspaceActionType.SetBrowserSvgs, value: LaurusSvgResult[] }
    | { type: WorkspaceActionType.DeleteBrowserSvg, value: string }
    | { type: WorkspaceActionType.SetCanvasImg, key: string, value: LaurusImgResult }
    | { type: WorkspaceActionType.DeleteCanvasImg, key: string }
    | { type: WorkspaceActionType.SetCanvasImgs, value: Map<string, LaurusImgResult> }
    | { type: WorkspaceActionType.SetCanvasSvg, key: string, value: LaurusSvgResult }
    | { type: WorkspaceActionType.DeleteCanvasSvg, key: string }
    | { type: WorkspaceActionType.SetCanvasSvgs, value: Map<string, LaurusSvgResult> }
    | { type: WorkspaceActionType.SetTool, value: LaurusTool }
    | { type: WorkspaceActionType.SetBrowserElement, value: LaurusBrowserElement | undefined }
    | { type: WorkspaceActionType.SetActiveElement, value: LaurusActiveElement | undefined }
    | { type: WorkspaceActionType.SetProjectImg, key: string, value: LaurusProjectImg }
    | { type: WorkspaceActionType.DeleteProjectImg, key: string }
    | { type: WorkspaceActionType.SetProjectSvg, key: string, value: LaurusProjectSvg }
    | { type: WorkspaceActionType.DeleteProjectSvg, key: string }
    | { type: WorkspaceActionType.SetLightFrameBackground, value: boolean }
    | { type: WorkspaceActionType.SetEffects, value: LaurusEffect[] }
    | { type: WorkspaceActionType.SetEffect, value: LaurusEffect }
    | { type: WorkspaceActionType.DeleteEffect, key: string }
    | { type: WorkspaceActionType.SetEffectClipboard, value: LaurusEffect }
    | { type: WorkspaceActionType.SetTimelineUnit, value: string }
    | { type: WorkspaceActionType.SetTimelineMaxValue, value: number }
    | { type: WorkspaceActionType.SetRecordingLight, value: boolean }
    | { type: WorkspaceActionType.SetFps, value: number }
    | { type: WorkspaceActionType.AddCarouselEntry, value: CarouselEntry }
    | { type: WorkspaceActionType.DeleteCarouselEntry, key: string }

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
            const i = currentBrowserImgs.findIndex(i => i.img_media_id == action.value.img_media_id);
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
                const index = newBrowserImgs.findIndex(img => img.img_media_id == newBrowserImg.img_media_id);
                if (index > -1) {
                    newBrowserImgs[index] = { ...newBrowserImg }
                }
            }
            return { ...state, browserImgs: newBrowserImgs }
        }
        case WorkspaceActionType.SetBrowserImgs: {
            return { ...state, browserImgs: [...action.value] }
        }
        case WorkspaceActionType.DeleteBrowserImg: {
            const newBrowserImgs = state.browserImgs.filter(b => b.img_media_id != action.value);
            return { ...state, browserImgs: newBrowserImgs }
        }
        case WorkspaceActionType.AddBrowserSvg: {
            const currentBrowserSvgs = [...state.browserSvgs];
            const i = currentBrowserSvgs.findIndex(i => i.svg_media_id == action.value.svg_media_id);
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
                const index = newBrowserSvgs.findIndex(svg => svg.svg_media_id == newBrowserSvg.svg_media_id);
                if (index > -1) {
                    newBrowserSvgs[index] = { ...newBrowserSvg }
                }
            }
            return { ...state, browserSvgs: newBrowserSvgs }
        }
        case WorkspaceActionType.SetBrowserSvgs: {
            return { ...state, browserSvgs: [...action.value] }
        }
        case WorkspaceActionType.DeleteBrowserSvg: {
            const newBrowserSvgs = state.browserSvgs.filter(b => b.svg_media_id != action.value);
            return { ...state, browserSvgs: newBrowserSvgs }
        }
        case WorkspaceActionType.SetCanvasImg: {
            const newImgs = new Map(state.canvasImgs);
            newImgs.set(action.key, action.value);
            return { ...state, canvasImgs: newImgs }
        }
        case WorkspaceActionType.DeleteCanvasImg: {
            const newImgs = new Map(state.canvasImgs);
            newImgs.delete(action.key);
            return { ...state, canvasImgs: newImgs }
        }
        case WorkspaceActionType.SetCanvasImgs: {
            return { ...state, canvasImgs: new Map(action.value) }
        }
        case WorkspaceActionType.SetCanvasSvg: {
            const newSvgs = new Map(state.canvasSvgs);
            newSvgs.set(action.key, action.value);
            return { ...state, canvasSvgs: newSvgs }
        }
        case WorkspaceActionType.DeleteCanvasSvg: {
            const newSvgs = new Map(state.canvasSvgs);
            newSvgs.delete(action.key);
            return { ...state, canvasSvgs: newSvgs }
        }
        case WorkspaceActionType.SetCanvasSvgs: {
            return { ...state, canvasSvgs: new Map(action.value) }
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
        case WorkspaceActionType.SetLightFrameBackground: {
            return { ...state, lightFrameBackground: action.value }
        }
        case WorkspaceActionType.SetEffects: {
            return { ...state, effects: [...action.value] }
        }
        case WorkspaceActionType.SetEffect: {
            return { ...state, effects: state.effects.map(e => e.key == action.value.key ? { ...action.value } : e) }
        }
        case WorkspaceActionType.DeleteEffect: {
            const newEffects = state.effects.filter(e => e.key != action.key);
            return { ...state, effects: newEffects }
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
        case WorkspaceActionType.AddCarouselEntry: {
            return { ...state, carouselEntries: [...state.carouselEntries, action.value] }
        }
        case WorkspaceActionType.DeleteCarouselEntry: {
            const newEntries = [...state.carouselEntries].filter(m => m.key != action.key);
            return { ...state, carouselEntries: newEntries }
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
        new Map(p.imgs.entries().map(e => [e[0],
        {
            ...e[1],
            showContextMenu: false,
            contextMenuConfig: getNewContextMenuConfig(
                { top: e[1].top, left: e[1].left },
                { width: p.canvas_width, height: p.canvas_height },
                { ...e[1] },
                { x: e[1].scale_x, y: e[1].scale_y },
                { ...DEFAULT_CONTEXT_MENU_CONFIG })
        }]));

    const projectSvgsInit: Map<string, LaurusProjectSvg> =
        new Map(p.svgs.entries().map(e => [e[0], {
            ...e[1],
            showContextMenu: false,
            contextMenuConfig: getNewContextMenuConfig(
                { top: e[1].top, left: e[1].left },
                { width: p.canvas_width, height: p.canvas_height },
                { ...e[1] },
                { x: e[1].scale_x, y: e[1].scale_y },
                { ...DEFAULT_CONTEXT_MENU_CONFIG })
        }]));

    return {
        ...p,
        imgs: projectImgsInit,
        svgs: projectSvgsInit,
        frame_width: p.frame_width > 0 && p.frame_width <= p.canvas_width ? p.frame_width : FRAME_WIDTH_5_7,
        frame_height: p.frame_height > 0 && p.frame_height <= p.canvas_height ? p.frame_height : FRAME_HEIGHT_5_7,
    }
}

function initCarouselEntries(
    project: LaurusProjectResult,
): CarouselEntry[] {
    const temp: { entry: CarouselEntry, distance: number }[] = [];
    project.imgs.entries().forEach((projectImg) => {
        if (projectImg[1].left < 0 || projectImg[1].top < 0) return;
        const distance = Math.sqrt(projectImg[1].top ** 2 + projectImg[1].left ** 2);
        temp.push({
            entry: {
                type: 'img',
                key: projectImg[0],
            },
            distance
        });
    });
    project.svgs.entries().forEach((projectSvg) => {
        if (projectSvg[1].left < 0 || projectSvg[1].top < 0) return;
        const distance = Math.sqrt(projectSvg[1].top ** 2 + projectSvg[1].left ** 2);
        temp.push({
            entry: {
                type: 'svg',
                key: projectSvg[0],
            },
            distance
        });
    });
    const entries = temp
        .sort((a, b) => a.distance - b.distance)
        .map(item => item.entry);
    return entries;
}

interface InitReducer {
    arg1: ProjectDependencies | undefined,
    arg2: string[] | undefined,
    arg3: number[],
    arg4: string[],
    arg5: string | undefined,
    arg6: BrowserDependencies,
    arg7: WorkspaceResolution,
    arg8: string | undefined,
}
function initReducer({
    arg1: projectDependencies,
    arg2: effectNames,
    arg3: timelineValues,
    arg4: timelineUnits,
    arg5: apiOrigin,
    arg6: browserDependencies,
    arg7: resolution,
    arg8: accessToken,
}: InitReducer): WorkspaceState {
    const newEffects: LaurusEffect[] = [];
    if (projectDependencies) {
        projectDependencies.scales.forEach(e => {
            newEffects.push({ type: 'scale', key: e.scale_id, locked: e.locked, value: { ...e } })
        });
        projectDependencies?.moves.forEach(e => {
            newEffects.push({ type: 'move', key: e.move_id, locked: e.locked, value: { ...e } })
        });
        projectDependencies?.rotates.forEach(e => {
            newEffects.push({ type: 'rotate', key: e.rotate_id, locked: e.locked, value: { ...e } })
        });
    }

    const defaultProject: LaurusProjectResult = {
        ...defaultWorkspace.project,
        frame_width: Math.round(FRAME_WIDTH_5_7 * resolution.factor),
        frame_height: Math.round(FRAME_HEIGHT_5_7 * resolution.factor)
    };

    const newProject = projectDependencies ? initProject(projectDependencies.project) : defaultProject;

    const newCanvasSvgs: Map<string, LaurusSvgResult> = projectDependencies ? new Map(
        projectDependencies.project.svgs.entries().map(e => [
            e[0],
            { ...projectDependencies.canvasSvgs.find(i => i.svg_media_id == e[1].svg_media_id) }
        ])
    ) : new Map();

    const newCanvasImgs: Map<string, LaurusImgResult> = projectDependencies ? new Map(
        projectDependencies.project.imgs.entries().map(e => [
            e[0],
            { ...projectDependencies.canvasImgs.find(i => i.img_media_id == e[1].img_media_id) }
        ])
    ) : new Map();

    const browserImgIds = new Set(browserDependencies.browserImgs.map(i => i.img_media_id));
    const browserSvgIds = new Set(browserDependencies.browserSvgs.map(s => s.svg_media_id));

    const missingImgs = Array.from(newCanvasImgs.values()).filter(i => !browserImgIds.has(i.img_media_id));
    const missingSvgs = Array.from(newCanvasSvgs.values()).filter(s => !browserSvgIds.has(s.svg_media_id));

    const projectImgIds = new Set(projectDependencies?.project.imgs.values().map(i => i.img_media_id) || []);
    const projectSvgIds = new Set(projectDependencies?.project.svgs.values().map(s => s.svg_media_id) || []);

    const combinedImgs = [...browserDependencies.browserImgs, ...missingImgs];
    const newBrowserImgs: LaurusImgResult[] = newProject.browse_public_imgs
        ? combinedImgs.sort((a, b) => {
            const aExists = projectImgIds.has(a.img_media_id);
            const bExists = projectImgIds.has(b.img_media_id);
            if (aExists && !bExists) return -1;
            if (!aExists && bExists) return 1;
            return a.order - b.order;
        }).map(v => ({ ...v }))
        : Array.from(newCanvasImgs.values()).sort((a, b) => a.order - b.order);

    const combinedSvgs = [...browserDependencies.browserSvgs, ...missingSvgs];
    const newBrowserSvgs: LaurusSvgResult[] = newProject.browse_public_svgs
        ? combinedSvgs.sort((a, b) => {
            const aExists = projectSvgIds.has(a.svg_media_id);
            const bExists = projectSvgIds.has(b.svg_media_id);
            if (aExists && !bExists) return -1;
            if (!aExists && bExists) return 1;
            return a.order - b.order;
        }).map(v => ({ ...v }))
        : Array.from(newCanvasSvgs.values()).sort((a, b) => a.order - b.order);

    const newBrowserFrames: LaurusCropSvg[] = getCrops('rgba(200, 200, 200, 1)');
    const newBrowserElement: LaurusBrowserElement | undefined =
        defaultWorkspace.browserElement == undefined ? undefined : { ...defaultWorkspace.browserElement }

    const newCarouselEntries = initCarouselEntries(newProject);

    return {
        ...defaultWorkspace,
        project: newProject,
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
        resolution,
        accessToken,
        carouselEntries: newCarouselEntries
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
    me: MeDependencies,
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
    me
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
            arg8: me.accessToken,
        }, initReducer);
    const canvasAreaRef = useRef<HTMLDivElement>(null);
    const [mediabarHeight] = useState(() => {
        switch (resolutionInit.type) {
            case "high": return 50
            case "midhigh": return 40
            case "low":
            case "midlow": return 38
        }
    });
    const [showMediaBrowser, setShowMediaBrowser] = useState<boolean>(true);
    const [mediaPageSize] = useState(mediaPageSizeInit);
    const [showTimeline, setShowTimeline] = useState<boolean>(true);
    const [mediaBrowserFilter, setMediaBrowserFilter] = useState<MediaBrowserFilter>('img');
    const [mediaBrowserWidth] = useState(() => {
        switch (resolutionInit.type) {
            case "high": return 400
            case "midhigh": return 300
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

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            const clearAllContextMenus = () => {
                const inactiveImgs = Array.from(appState.project.imgs.entries());
                const inactiveSvgs = Array.from(appState.project.svgs.entries());
                inactiveImgs.forEach(i => {
                    dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                });
                inactiveSvgs.forEach(i => {
                    dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                });
            };

            if (event.key === 'Escape') {
                const pendingSvgs = Array.from(appState.project.svgs.entries()).filter(m => m[1].showContextMenu);
                for (let i = 0; i < pendingSvgs.length; i++) {
                    const [key, svgMeta] = pendingSvgs[i];
                    const newSvg: LaurusProjectSvg = { ...svgMeta, showContextMenu: false }
                    dispatch({ type: WorkspaceActionType.SetProjectSvg, key, value: newSvg });
                }
                const pendingImgs = Array.from(appState.project.imgs.entries()).filter(m => m[1].showContextMenu);
                for (let i = 0; i < pendingImgs.length; i++) {
                    const [key, imgMeta] = pendingImgs[i];
                    const newImg: LaurusProjectImg = { ...imgMeta, showContextMenu: false }
                    dispatch({ type: WorkspaceActionType.SetProjectImg, key, value: newImg });
                }
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                dispatch({
                    type: WorkspaceActionType.SetBrowserElement,
                    value: defaultWorkspace.browserElement == undefined ? undefined : { ...defaultWorkspace.browserElement }
                });
            } else if (event.key.toLowerCase() === 'm') {
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'move' } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'r') {
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'rotate' } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 's') {
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'scale' } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'v') {
                const newToolType = appState.tool.type === 'viewport' ? 'none' : 'viewport';
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: newToolType } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'd') {
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop' } });
                clearAllContextMenus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [appState.project.imgs, appState.project.svgs, appState.tool.type, dispatch]);

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

        const imgArray = Array.from(appState.project.imgs.entries());
        for (let i = 0; i < imgArray.length; i++) {
            if (imgArray[i][1].left < 0 || imgArray[i][1].top < 0) continue;
            const [key] = imgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, appState.fps);
            if (frames) {
                const keyframes = toKeyframes(firstFrame, frames);
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

        const svgArray = Array.from(appState.project.svgs.entries());
        for (let i = 0; i < svgArray.length; i++) {
            if (svgArray[i][1].left < 0 || svgArray[i][1].top < 0) continue;
            const [key] = svgArray[i];
            const frames = await getFrames(appState.apiOrigin, appState.project.project_id, key, appState.fps);
            if (frames) {
                const keyframes = toKeyframes(firstFrame, frames);
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
    }, [appState.apiOrigin, appState.effects, appState.project.imgs, appState.project.project_id, appState.project.svgs, appState.fps, imgElementsRef, svgElementsRef]);

    return (<>
        <div
            style={{
                width: "100vw",
                height: '100vh',
                display: 'grid',
                gridTemplateColumns: 'min-content 1fr min-content min-content min-content',
                gridTemplateRows: `min-content min-content min-content 1fr min-content`,
            }}>
            <WorkspaceContext value={{ appState, dispatch }}>
                <div style={{ gridRow: '1', gridColumn: 'span 5', }}>
                    <Menubar resolution={resolutionInit} me={me.me} />
                </div>
                <div style={{ gridRow: '2 / span 3', gridColumn: '1', overflowY: 'auto', }}>
                    {showTimeline ?
                        <TimelineArea
                            svgElementsRef={svgElementsRef}
                            imgElementsRef={imgElementsRef}
                            onRightPanelClick={() => setShowTimeline(false)}
                            getNewAnimations={getNewAnimations}
                        /> :
                        <>
                            <Bumper onBumperClick={() => {
                                setShowTimeline(true);
                            }} borderLeft={'1px solid rgba(255, 255, 255, 0.05)'} borderRight={'1px solid rgba(255, 255, 255, 0.05)'} />
                            <div style={{
                                zIndex: 99,
                                position: 'fixed',
                                bottom: minifiedControlsSize.playBottom,
                                left: minifiedControlsSize.playLeft,
                                width: minifiedControlsSize.playContainer,
                                height: minifiedControlsSize.playContainer,
                                borderRadius: '50%',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
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
                                        const inactiveSvgs = Array.from(appState.project.svgs.entries());
                                        const inactiveImgs = Array.from(appState.project.imgs.entries());
                                        inactiveSvgs.forEach(i => {
                                            dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                                        });
                                        inactiveImgs.forEach(i => {
                                            dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                                        });
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
                                zIndex: 99,
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
                <div
                    style={{
                        gridRow: '3',
                        gridColumn: '2 / span 2',
                        width: '100%',
                    }} >
                    <SubProjectbar />
                </div>
                {/* canvas area */}
                <div
                    ref={canvasAreaRef}
                    style={{
                        gridRow: '4',
                        gridColumn: '2',
                        overflowY: 'auto',
                        position: 'relative',
                        width: "100%",
                        height: '100%',
                    }}>
                    <div
                        className={styles[`${appState.resolution.type == 'high' ? 'noisy-background-20-3' : 'noisy-background-20-3-low-res'}`]}
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
                            zIndex: 1000
                        }}>
                        <Canvas />
                    </div>}
                    {/* camera frame */}
                    <DraggableCamera
                        contextId={"draggable-camera-context-id"}
                        nodeId={"draggable-camera-node-id"}
                        svgElementsRef={svgElementsRef}
                        imgElementsRef={imgElementsRef}
                        zIndex={1}
                        onNewPosition={async function (newPosition: { x: number; y: number; }) {
                            const rollback: LaurusProjectResult = { ...appState.project };
                            const newProject: LaurusProjectResult = {
                                ...appState.project,
                                frame_left: newPosition.x,
                                frame_top: newPosition.y
                            };
                            if (appState.project.project_id) {
                                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                                const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
                                if (!updated) {
                                    dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
                                }
                            }
                            else {
                                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                                const created = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
                                if (created) {
                                    dispatch({ type: WorkspaceActionType.SetProject, value: { ...created } });
                                } else {
                                    dispatch({ type: WorkspaceActionType.SetProject, value: { ...rollback } });
                                }
                            }
                        }}
                        disabled={appState.tool.type != 'move'} />
                    {appState.tool.type != 'viewport' &&
                        <>
                            {Array.from(appState.project.imgs.entries()).map((e) => {
                                const [key, meta] = e;
                                if (meta.top < 0 || meta.left < 0) return;
                                const refKey = appState.tool.type != 'viewport' ? `${key}|preview` : key;
                                const imgData = appState.canvasImgs.get(key);
                                if (imgData) {
                                    return (
                                        <div key={key}>
                                            <DraggableProjectImg
                                                mediaKey={key}
                                                data={imgData}
                                                meta={meta}
                                                zIndex={meta.order + 3}
                                                imgElementsRef={imgElementsRef}
                                                refKey={refKey}
                                                disbaled={{
                                                    value: appState.tool.type != 'move',
                                                    cursor: ""
                                                }} />
                                        </div>
                                    );
                                }
                            })}
                            {Array.from(appState.project.svgs.entries()).map((e) => {
                                const [key, meta] = e;
                                if (meta.top < 0 || meta.left < 0) return;
                                const refKey = appState.tool.type != 'viewport' ? `${key}|preview` : key;
                                const svgData = appState.canvasSvgs.get(key);
                                if (svgData) {
                                    return (
                                        <div key={key}>
                                            <DraggableProjectSvg
                                                mediaKey={key}
                                                data={svgData}
                                                meta={meta}
                                                zIndex={meta.order + 3}
                                                svgElementsRef={svgElementsRef}
                                                refKey={refKey}
                                                disabled={{
                                                    value: appState.tool.type != 'move',
                                                    cursor: ""
                                                }} />
                                        </div>
                                    );
                                }
                            })}
                        </>}
                </div>
                {showMediaBrowser &&
                    <div
                        style={{
                            gridRow: '4',
                            gridColumn: '3',
                        }}>
                        <Bumper onBumperClick={() => {
                            setShowMediaBrowser(false);
                        }} borderLeft={'1px solid rgba(255,255,255,0.05)'} borderRight={'1px solid rgba(255,255,255,0.05)'} />
                    </div>
                }
                {showMediaBrowser &&
                    <div
                        style={{
                            gridRow: '3 / span 2',
                            gridColumn: '4',
                            width: mediaBrowserWidth,
                            height: '100%',
                        }} >
                        <MediaBrowser
                            filter={mediaBrowserFilter}
                            onNextPage={async () => {
                                switch (mediaBrowserFilter) {
                                    case "img": {
                                        if (appState.project.browse_public_imgs) {
                                            await handleImgPageRequest();
                                        }
                                        break;
                                    }
                                    case "svg": {
                                        if (appState.project.browse_public_svgs) {
                                            await handleSvgPageRequest();
                                        }
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
                        gridRow: '3 / span 2',
                        gridColumn: '5',
                    }}>
                    <Toolbar resolution={resolutionInit} />
                </div>
                {/* mediabar */}
                <div style={{ gridRow: '5', gridColumn: 'span 5' }}>
                    <div style={{
                        height: mediabarHeight,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: 'end',
                        background: "linear-gradient(34deg, rgba(25, 25, 25, 1) 34%, rgba(21, 21, 21, 1))",
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}>
                        <div
                            title='browser element'
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            onClick={() => setShowMediaBrowser(v => !v)}
                            style={{
                                borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                                position: 'relative'
                            }}>
                            {appState.browserElement ? (() => {
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
                                        return <>
                                            <div
                                                style={{
                                                    width: mediabarHeight - 2,
                                                    height: mediabarHeight - 2,
                                                    position: 'relative',
                                                }}
                                            >
                                                <NextImage
                                                    draggable={false}
                                                    alt={appState.browserElement.value.media_key}
                                                    src={appState.browserElement.value.src}
                                                    fill
                                                    style={{
                                                        objectFit: 'cover',
                                                    }}
                                                />
                                            </div>
                                        </>
                                    }
                                }
                            })() : <div style={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }} />}
                        </div>
                    </div>
                    <Statusbar action={statusAction} body={statusBody} />
                </div>
            </WorkspaceContext >
        </div >
    </>)
}

interface Bumper {
    borderLeft: string,
    borderRight: string,
    onBumperClick: () => void,
}
export function Bumper({ borderLeft, borderRight, onBumperClick }: Bumper) {
    const { appState } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                svg: {
                    width: 18,
                    height: 38,
                }
            }
            case "midhigh": return {
                svg: {
                    width: 13,
                    height: 33,
                }
            }
            case "midlow":
            case "low": return {
                svg: {
                    width: 13,
                    height: 33,
                }
            }
        }
    })
    return (<>
        <div
            style={{
                width: dynamicSizes.svg.width,
                height: '100%',
                gridTemplateRows: '1fr',
                display: 'grid',
                placeContent: 'start',
            }} >
            <div
                className={styles[`${appState.resolution.type == 'high' ? 'noisy-background-16-2' : 'noisy-background-16-2-low-res'}`]}
                style={{
                    borderLeft,
                    borderRight,
                    width: dynamicSizes.svg.width,
                    display: 'grid',
                    placeContent: 'center',
                }} >
                <SvgRepo
                    svg={moreVert('rgba(255, 255, 255, 0.6)')}
                    containerSize={{
                        width: dynamicSizes.svg.width,
                        height: dynamicSizes.svg.height,
                    }}
                    scale={1}
                    onContainerClick={onBumperClick} />
            </div>
        </div>
    </>)
}
