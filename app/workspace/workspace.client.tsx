'use client'
import { createContext, CSSProperties, use, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
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
    LaurusFrame,
    EffectGroupResult_V1_0,
    EffectGroup_V1_0
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "./bars/statusbar";
import Canvas from "./canvas";
import MediaBrowser, { MediaBrowserFilter } from "./media-browser";
import { moreVert, playArrow, SvgRepo, getCrops, LaurusCropSvg } from "../svg-repo";
import { DraggableProjectImg, DraggableProjectSvg } from "./draggable-media";
import Projectbar, { ProjectbarLevel2 } from "./bars/projectbar";
import TimelineArea from "./timeline-area";
import DraggableCamera from "./camera";
import {
    NEW_PROJECT_CANVAS_SIZE,
    FRAME_HEIGHT_5_7,
    FRAME_WIDTH_5_7,
    WorkspaceResolution,
    Z_INDEX
} from "./workspace.config";
import { ProjectDependencies, BrowserDependencies } from "./page";
import Toolbar from "./bars/toolbar";
import { ProjectResult_V1_0, updateProject, createProject } from "../projects/projects.server";
import { MeDependencies } from "../page";
import { LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "../projects/projects.client";
import LaurusImage from "../components/laurus-image";

export type LaurusImgResult = ImgMediaResult_V1_0;
export type LaurusSvgResult = SvgMediaResult_V1_0;
export type LaurusImg = ImgMedia_V1_0;
export type LaurusScaleEquation = ScaleEquation_V1_0;
export enum LaurusMixState {
    None = 'none',
    Waiting = 'waiting',
    Selected = 'selected',
    Active = 'active',
}
export interface LaurusScale extends Scale_V1_0 {
    math: Map<string, LaurusScaleEquation>,
}
export interface LaurusScaleResult extends ScaleResult_V1_0 {
    math: Map<string, LaurusScaleEquation>,
    mixState: LaurusMixState,
}
export type LaurusMoveEquation = MoveEquation_V1_0;
export interface LaurusMove extends Move_V1_0 {
    math: Map<string, LaurusMoveEquation>,
}
export interface LaurusMoveResult extends MoveResult_V1_0 {
    math: Map<string, LaurusMoveEquation>,
    mixState: LaurusMixState,
}
export type LaurusRotateEquation = RotateEquation_V1_0;
export interface LaurusRotate extends Rotate_V1_0 {
    math: Map<string, LaurusRotateEquation>,
}
export interface LaurusRotateResult extends RotateResult_V1_0 {
    math: Map<string, LaurusRotateEquation>,
    mixState: LaurusMixState,
}
export type LaurusEffect =
    | { type: 'scale', key: string, value: LaurusScaleResult }
    | { type: 'move', key: string, value: LaurusMoveResult }
    | { type: 'rotate', key: string, value: LaurusRotateResult }
export type LaurusEffectGroup = EffectGroup_V1_0;
export type LaurusEffectGroupResult = EffectGroupResult_V1_0;
export type LaurusThumbnail =
    | { type: 'svg', value: LaurusSvgResult }
    | { type: 'img', value: LaurusImgResult }
export type LaurusTool =
    | {
        type: 'marquee',
        stack: boolean,
        size: { value: boolean, width: number | undefined, height: number | undefined },
        position: { value: boolean, x: number | undefined, y: number | undefined },
        select: boolean,
    }
    | { type: 'none' }
    | { type: 'contextmenu' }
    | { type: 'viewport' }
    | { type: 'move' }
    | { type: 'scale' }
    | { type: 'rotate' }
    | { type: 'mix' }
export const defaultMarqueeTool: LaurusTool = {
    type: 'marquee',
    stack: false, size: { value: false, width: undefined, height: undefined },
    position: { value: false, x: undefined, y: undefined },
    select: false,
}
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

export interface UIState {
    lightFrameBackground: boolean;
    browserImgs: LaurusImgResult[];
    browserSvgs: LaurusSvgResult[];
    browserFrames: LaurusCropSvg[];
    carouselEntries: CarouselEntry[];
    tool: LaurusTool;
    browserElement: LaurusBrowserElement | undefined;
    activeElement: LaurusActiveElement | undefined;
    effectNames: string[];
    effectClipboard: LaurusEffect | undefined;
    recordingLight: boolean;
    timelineUnits: string[];
    timelineValues: number[];
    resolution: WorkspaceResolution;
    mixableEffects: string[];
    playEnabled: boolean;
    skipPreviousEnabled: boolean;
    skipNextEnabled: boolean;
}

export interface CoreState {
    apiOrigin: string | undefined,
    accessToken: string | undefined,
    project: LaurusProjectResult,
    canvasImgs: Map<string, LaurusImgResult>,
    canvasSvgs: Map<string, LaurusSvgResult>,
    effects: LaurusEffect[],
    effectGroups: Map<string, LaurusEffectGroupResult>,
    timelineUnit: string,
    timelineMaxValue: number,
    fps: number,
}

export const defaultUIState: UIState = {
    lightFrameBackground: false,
    tool: { type: 'none' },
    browserImgs: [],
    browserSvgs: [],
    browserFrames: [],
    carouselEntries: [],
    effectNames: [],
    effectClipboard: undefined,
    browserElement: undefined,
    activeElement: undefined,
    recordingLight: false,
    timelineUnits: [],
    timelineValues: [],
    resolution: { type: 'midhigh', factor: 0.7, value: { width: 0, height: 0 } },
    mixableEffects: [],
    playEnabled: true,
    skipPreviousEnabled: true,
    skipNextEnabled: true,
}

export const defaultCoreState: CoreState = {
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
        browse_public_imgs: false,
        browse_public_svgs: false,
        creator: "",
        last_editor: ""
    },
    canvasImgs: new Map(),
    canvasSvgs: new Map(),
    effects: [],
    effectGroups: new Map(),
    timelineUnit: '',
    timelineMaxValue: 0,
    fps: 60,
}

export enum CoreActionType {
    SetCoreState,
    SetProject,
    SetCanvasImg,
    DeleteCanvasImg,
    SetCanvasImgs,
    SetCanvasSvg,
    DeleteCanvasSvg,
    SetCanvasSvgs,
    SetProjectImg,
    SetProjectSvg,
    DeleteProjectImg,
    DeleteProjectSvg,
    SetLightFrameBackground,
    SetEffects,
    SetEffect,
    DeleteEffect,
    SetEffectGroup,
    DeleteEffectGroup,
    SetTimelineUnit,
    SetTimelineMaxValue,
    SetFps,
}

export enum UIActionType {
    SetUIState,
    AddBrowserImg,
    UpdateBrowserImgs,
    SetBrowserImgs,
    DeleteBrowserImg,
    AddBrowserSvg,
    UpdateBrowserSvgs,
    SetBrowserSvgs,
    DeleteBrowserSvg,
    SetTool,
    SetBrowserElement,
    SetActiveElement,
    SetLightFrameBackground,
    SetEffectClipboard,
    SetRecordingLight,
    AddCarouselEntry,
    DeleteCarouselEntry,
    SetPlayEnabled,
    SetSkipPreviousEnabled,
    SetSkipNextEnabled,
    SetResolution,
    SetEffectNames,
    SetTimelineUnits,
    SetTimelineValues,
    SetMixableEffects,
}

export type CoreAction =
    | { type: CoreActionType.SetCoreState, value: CoreState }
    | { type: CoreActionType.SetProject, value: LaurusProjectResult }
    | { type: CoreActionType.SetCanvasImg, key: string, value: LaurusImgResult }
    | { type: CoreActionType.DeleteCanvasImg, key: string }
    | { type: CoreActionType.SetCanvasImgs, value: Map<string, LaurusImgResult> }
    | { type: CoreActionType.SetCanvasSvg, key: string, value: LaurusSvgResult }
    | { type: CoreActionType.DeleteCanvasSvg, key: string }
    | { type: CoreActionType.SetCanvasSvgs, value: Map<string, LaurusSvgResult> }
    | { type: CoreActionType.SetProjectImg, key: string, value: LaurusProjectImg }
    | { type: CoreActionType.DeleteProjectImg, key: string }
    | { type: CoreActionType.SetProjectSvg, key: string, value: LaurusProjectSvg }
    | { type: CoreActionType.DeleteProjectSvg, key: string }
    | { type: CoreActionType.SetEffects, value: LaurusEffect[] }
    | { type: CoreActionType.SetEffect, value: LaurusEffect }
    | { type: CoreActionType.DeleteEffect, key: string }
    | { type: CoreActionType.SetEffectGroup, value: LaurusEffectGroupResult }
    | { type: CoreActionType.DeleteEffectGroup, key: string }
    | { type: CoreActionType.SetTimelineUnit, value: string }
    | { type: CoreActionType.SetTimelineMaxValue, value: number }
    | { type: CoreActionType.SetFps, value: number }

export type UIAction =
    | { type: UIActionType.SetUIState, value: UIState }
    | { type: UIActionType.AddBrowserImg, value: LaurusImgResult, first: boolean }
    | { type: UIActionType.UpdateBrowserImgs, value: LaurusImgResult[] }
    | { type: UIActionType.SetBrowserImgs, value: LaurusImgResult[] }
    | { type: UIActionType.DeleteBrowserImg, value: string }
    | { type: UIActionType.AddBrowserSvg, value: LaurusSvgResult, first: boolean }
    | { type: UIActionType.UpdateBrowserSvgs, value: LaurusSvgResult[] }
    | { type: UIActionType.SetBrowserSvgs, value: LaurusSvgResult[] }
    | { type: UIActionType.DeleteBrowserSvg, value: string }
    | { type: UIActionType.SetTool, value: LaurusTool }
    | { type: UIActionType.SetBrowserElement, value: LaurusBrowserElement | undefined }
    | { type: UIActionType.SetActiveElement, value: LaurusActiveElement | undefined }
    | { type: UIActionType.SetLightFrameBackground, value: boolean }
    | { type: UIActionType.SetEffectClipboard, value: LaurusEffect }
    | { type: UIActionType.SetRecordingLight, value: boolean }
    | { type: UIActionType.AddCarouselEntry, value: CarouselEntry }
    | { type: UIActionType.DeleteCarouselEntry, key: string }
    | { type: UIActionType.SetPlayEnabled, value: boolean }
    | { type: UIActionType.SetSkipPreviousEnabled, value: boolean }
    | { type: UIActionType.SetSkipNextEnabled, value: boolean }
    | { type: UIActionType.SetResolution, value: WorkspaceResolution }
    | { type: UIActionType.SetEffectNames, value: string[] }
    | { type: UIActionType.SetTimelineUnits, value: string[] }
    | { type: UIActionType.SetTimelineValues, value: number[] }
    | { type: UIActionType.SetMixableEffects, value: string[] }


function coreContextReducer(state: CoreState, action: CoreAction): CoreState {
    switch (action.type) {
        case CoreActionType.SetCoreState: {
            return { ...action.value }
        }
        case CoreActionType.SetProject: {
            return { ...state, project: { ...action.value } }
        }
        case CoreActionType.SetCanvasImg: {
            const newImgs = new Map(state.canvasImgs);
            newImgs.set(action.key, action.value);
            return { ...state, canvasImgs: newImgs }
        }
        case CoreActionType.DeleteCanvasImg: {
            const newImgs = new Map(state.canvasImgs);
            newImgs.delete(action.key);
            return { ...state, canvasImgs: newImgs }
        }
        case CoreActionType.SetCanvasImgs: {
            return { ...state, canvasImgs: new Map(action.value) }
        }
        case CoreActionType.SetCanvasSvg: {
            const newSvgs = new Map(state.canvasSvgs);
            newSvgs.set(action.key, action.value);
            return { ...state, canvasSvgs: newSvgs }
        }
        case CoreActionType.DeleteCanvasSvg: {
            const newSvgs = new Map(state.canvasSvgs);
            newSvgs.delete(action.key);
            return { ...state, canvasSvgs: newSvgs }
        }
        case CoreActionType.SetCanvasSvgs: {
            return { ...state, canvasSvgs: new Map(action.value) }
        }
        case CoreActionType.SetProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.set(action.key, action.value);
            const newProject: LaurusProjectResult = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case CoreActionType.DeleteProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.delete(action.key);
            const newProject: LaurusProjectResult = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case CoreActionType.SetProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.set(action.key, action.value);
            const newProject: LaurusProjectResult = { ...state.project, svgs: newSvgs }
            return { ...state, project: newProject }
        }
        case CoreActionType.DeleteProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.delete(action.key);
            const newProject: LaurusProjectResult = { ...state.project, svgs: newSvgs }
            return { ...state, project: newProject }
        }
        case CoreActionType.SetEffects: {
            return { ...state, effects: [...action.value] }
        }
        case CoreActionType.SetEffect: {
            return { ...state, effects: state.effects.map(e => e.key == action.value.key ? { ...action.value } : e) }
        }
        case CoreActionType.DeleteEffect: {
            const newEffects = state.effects.filter(e => e.key != action.key);
            return { ...state, effects: newEffects }
        }
        case CoreActionType.SetEffectGroup: {
            const newEffectGroups = new Map(state.effectGroups);
            newEffectGroups.set(action.value.effect_group_id, action.value);
            return { ...state, effectGroups: newEffectGroups }
        }
        case CoreActionType.DeleteEffectGroup: {
            const newEffectGroups = new Map(state.effectGroups);
            newEffectGroups.delete(action.key);
            return { ...state, effectGroups: newEffectGroups }
        }
        case CoreActionType.SetTimelineUnit: {
            return { ...state, timelineUnit: action.value }
        }
        case CoreActionType.SetTimelineMaxValue: {
            return { ...state, timelineMaxValue: action.value }
        }
        case CoreActionType.SetFps: {
            return { ...state, fps: action.value }
        }
    }
}

function uiContextReducer(state: UIState, action: UIAction): UIState {
    switch (action.type) {
        case UIActionType.SetUIState: {
            return { ...action.value }
        }
        case UIActionType.AddBrowserImg: {
            const currentBrowserImgs = [...state.browserImgs];
            const i = currentBrowserImgs.findIndex(i => i.img_media_id == action.value.img_media_id);
            if (i < 0) {
                return action.first ?
                    { ...state, browserImgs: [action.value, ...currentBrowserImgs] } :
                    { ...state, browserImgs: [...currentBrowserImgs, action.value] }
            }
            else {
                const newBrowserImgs = [...currentBrowserImgs];
                newBrowserImgs.splice(i, 1);
                return action.first ?
                    { ...state, browserImgs: [action.value, ...newBrowserImgs] } :
                    { ...state, browserImgs: [...newBrowserImgs, action.value] }
            }
        }
        case UIActionType.UpdateBrowserImgs: {
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
        case UIActionType.SetBrowserImgs: {
            return { ...state, browserImgs: [...action.value] }
        }
        case UIActionType.DeleteBrowserImg: {
            const newBrowserImgs = state.browserImgs.filter(b => b.img_media_id != action.value);
            return { ...state, browserImgs: newBrowserImgs }
        }
        case UIActionType.AddBrowserSvg: {
            const currentBrowserSvgs = [...state.browserSvgs];
            const i = currentBrowserSvgs.findIndex(i => i.svg_media_id == action.value.svg_media_id);
            if (i < 0) {
                return action.first ?
                    { ...state, browserSvgs: [action.value, ...currentBrowserSvgs] } :
                    { ...state, browserSvgs: [...currentBrowserSvgs, action.value] }
            }
            else {
                const newBrowserSvgs = [...currentBrowserSvgs];
                newBrowserSvgs.splice(i, 1);
                return action.first ?
                    { ...state, browserSvgs: [action.value, ...newBrowserSvgs] } :
                    { ...state, browserSvgs: [...newBrowserSvgs, action.value] }
            }
        }
        case UIActionType.UpdateBrowserSvgs: {
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
        case UIActionType.SetBrowserSvgs: {
            return { ...state, browserSvgs: [...action.value] }
        }
        case UIActionType.DeleteBrowserSvg: {
            const newBrowserSvgs = state.browserSvgs.filter(b => b.svg_media_id != action.value);
            return { ...state, browserSvgs: newBrowserSvgs }
        }
        case UIActionType.SetTool: {
            return { ...state, tool: { ...action.value } }
        }
        case UIActionType.SetBrowserElement: {
            return { ...state, browserElement: action.value }
        }
        case UIActionType.SetActiveElement: {
            return { ...state, activeElement: action.value }
        }
        case UIActionType.SetLightFrameBackground: {
            return { ...state, lightFrameBackground: action.value }
        }
        case UIActionType.SetEffectClipboard: {
            return { ...state, effectClipboard: { ...action.value } }
        }
        case UIActionType.SetRecordingLight: {
            return { ...state, recordingLight: action.value }
        }
        case UIActionType.AddCarouselEntry: {
            return { ...state, carouselEntries: [...state.carouselEntries, action.value] }
        }
        case UIActionType.DeleteCarouselEntry: {
            const newEntries = [...state.carouselEntries].filter(m => m.key != action.key);
            return { ...state, carouselEntries: newEntries }
        }
        case UIActionType.SetPlayEnabled: {
            return { ...state, playEnabled: action.value }
        }
        case UIActionType.SetSkipPreviousEnabled: {
            return { ...state, skipPreviousEnabled: action.value }
        }
        case UIActionType.SetSkipNextEnabled: {
            return { ...state, skipNextEnabled: action.value }
        }
        case UIActionType.SetResolution: {
            return { ...state, resolution: action.value }
        }
        case UIActionType.SetEffectNames: {
            return { ...state, effectNames: action.value }
        }
        case UIActionType.SetTimelineUnits: {
            return { ...state, timelineUnits: action.value }
        }
        case UIActionType.SetTimelineValues: {
            return { ...state, timelineValues: action.value }
        }
        case UIActionType.SetMixableEffects: {
            return { ...state, mixableEffects: action.value }
        }
    }
}

export interface CoreContextProps {
    appState: CoreState;
    dispatch: React.Dispatch<CoreAction>;
    getNewAnimations: (fill: FillMode, firstFrame: boolean) => Promise<Animation[]>;
    handleRewindAll: () => Promise<void>;
    handlePlayAll: () => Promise<void>;
    handleFastForwardAll: (fastRate: number) => Promise<void>;
}

export interface UIContextProps {
    uiState: UIState;
    uiDispatch: React.Dispatch<UIAction>;
}

export interface HoverContextProps {
    mostRecentlyEnteredEffectUnitKey: string | undefined;
    setMostRecentlyEnteredEffectUnitKey: (key: string | undefined) => void;
    isMetaKeyPressed: boolean;
    selectedEffectUnitKeys: Set<string>;
    setSelectedEffectUnitKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedImgKeys: Set<string>;
    setSelectedImgKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedSvgKeys: Set<string>;
    setSelectedSvgKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    animationDownloadProgress: number | undefined;
}

export const HoverContext = createContext<HoverContextProps>({
    mostRecentlyEnteredEffectUnitKey: undefined,
    setMostRecentlyEnteredEffectUnitKey: () => { },
    isMetaKeyPressed: false,
    selectedEffectUnitKeys: new Set<string>(),
    setSelectedEffectUnitKeys: () => { },
    selectedImgKeys: new Set<string>(),
    setSelectedImgKeys: () => { },
    selectedSvgKeys: new Set<string>(),
    setSelectedSvgKeys: () => { },
    animationDownloadProgress: undefined,
});

export const CoreContext = createContext<CoreContextProps>(
    {
        appState: { ...defaultCoreState },
        dispatch: () => { },
        getNewAnimations: async () => [],
        handleRewindAll: async () => { },
        handlePlayAll: async () => { },
        handleFastForwardAll: async () => { },
    }
)

export const UIContext = createContext<UIContextProps>(
    {
        uiState: { ...defaultUIState },
        uiDispatch: () => { },
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
    arg9: string[],
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
    arg9: mixableEffects,
}: InitReducer): { core: CoreState, ui: UIState } {
    const newEffects: LaurusEffect[] = [];
    if (projectDependencies) {
        projectDependencies.scales.forEach(e => {
            newEffects.push({
                type: 'scale',
                key: e.scale_id,
                value: { ...e, locked: e.locked, mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None }
            })
        });
        projectDependencies?.moves.forEach(e => {
            newEffects.push({
                type: 'move',
                key: e.move_id,
                value: { ...e, locked: e.locked, mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None }
            })
        });
        projectDependencies?.rotates.forEach(e => {
            newEffects.push({
                type: 'rotate',
                key: e.rotate_id,
                value: { ...e, locked: e.locked, mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None }
            })
        });
    }
    const newEffectGroups: Map<string, LaurusEffectGroupResult> = new Map();
    if (projectDependencies) {
        projectDependencies.effectGroups.forEach(e => {
            newEffectGroups.set(e.effect_group_id, e);
        })
    }

    const defaultProject: LaurusProjectResult = {
        ...defaultCoreState.project,
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
    const rawBrowserImgs: LaurusImgResult[] = newProject.browse_public_imgs
        ? combinedImgs.sort((a, b) => {
            const aExists = projectImgIds.has(a.img_media_id);
            const bExists = projectImgIds.has(b.img_media_id);
            if (aExists && !bExists) return -1;
            if (!aExists && bExists) return 1;
            return a.order - b.order;
        }).map(v => ({ ...v }))
        : Array.from(newCanvasImgs.values()).sort((a, b) => a.order - b.order);
    const newBrowserImgs: LaurusImgResult[] = [];
    const seenImgIds = new Set<string>();
    for (const img of rawBrowserImgs) {
        if (!seenImgIds.has(img.img_media_id)) {
            newBrowserImgs.push(img);
            seenImgIds.add(img.img_media_id);
        }
    }

    const combinedSvgs = [...browserDependencies.browserSvgs, ...missingSvgs];
    const rawBrowserSvgs: LaurusSvgResult[] = newProject.browse_public_svgs
        ? combinedSvgs.sort((a, b) => {
            const aExists = projectSvgIds.has(a.svg_media_id);
            const bExists = projectSvgIds.has(b.svg_media_id);
            if (aExists && !bExists) return -1;
            if (!aExists && bExists) return 1;
            return a.order - b.order;
        }).map(v => ({ ...v }))
        : Array.from(newCanvasSvgs.values()).sort((a, b) => a.order - b.order);
    const newBrowserSvgs: LaurusSvgResult[] = [];
    const seenSvgIds = new Set<string>();
    for (const svg of rawBrowserSvgs) {
        if (!seenSvgIds.has(svg.svg_media_id)) {
            newBrowserSvgs.push(svg);
            seenSvgIds.add(svg.svg_media_id);
        }
    }

    const newBrowserFrames: LaurusCropSvg[] = getCrops('rgba(200, 200, 200, 1)');

    const newCarouselEntries = initCarouselEntries(newProject);

    return {
        core: {
            ...defaultCoreState,
            project: newProject,
            effects: newEffects,
            effectGroups: newEffectGroups,
            canvasImgs: newCanvasImgs,
            canvasSvgs: newCanvasSvgs,
            apiOrigin: apiOrigin,
            timelineUnit: timelineUnits[0],
            timelineMaxValue: timelineValues[1],
            accessToken,
            fps: 60,
        },
        ui: {
            ...defaultUIState,
            browserImgs: newBrowserImgs,
            browserSvgs: newBrowserSvgs,
            browserFrames: newBrowserFrames,
            resolution,
            carouselEntries: newCarouselEntries,
            mixableEffects: mixableEffects,
            effectNames: effectNames ?? [],
            timelineUnits: [...timelineUnits],
            timelineValues: [...timelineValues],
        }
    }
}

interface Workspace {
    apiOriginInit: string | undefined,
    mediaPageSizeInit: number,
    timelineValuesInit: number[],
    timelineUnitsInit: string[],
    mixableEffectsInit: string[],
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
    mixableEffectsInit,
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
    const [isMetaKeyPressed, setIsMetaKeyPressed] = useState(false);
    const [animationDownloadProgress, setAnimationDownloadProgress] = useState<number | undefined>(undefined);
    const [mostRecentlyEnteredEffectUnitKey, setMostRecentlyEnteredEffectUnitKey] = useState<string | undefined>(undefined);
    const [selectedEffectUnitKeys, setSelectedEffectUnitKeys] = useState<Set<string>>(new Set<string>());
    const [selectedImgKeys, setSelectedImgKeys] = useState<Set<string>>(new Set<string>());
    const [selectedSvgKeys, setSelectedSvgKeys] = useState<Set<string>>(new Set<string>());
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
    const [{ core: coreInit, ui: uiInit }] = useState(() => {
        return initReducer({
            arg1: projectInit,
            arg2: effectNamesInit,
            arg3: timelineValuesInit,
            arg4: timelineUnitsInit,
            arg5: apiOriginInit,
            arg6: browserInit,
            arg7: resolutionInit,
            arg8: me.accessToken,
            arg9: mixableEffectsInit,
        });
    });
    const [appState, dispatch] = useReducer(coreContextReducer, coreInit);
    const [uiState, uiDispatch] = useReducer(uiContextReducer, uiInit);

    const framesCacheRef = useRef<Map<string, LaurusFrame[]>>(new Map());
    const cacheNeedsRefreshRef = useRef<boolean>(true);
    useEffect(() => {
        cacheNeedsRefreshRef.current = true;
    }, [appState]);

    useLayoutEffect(() => {
        const initCurrentPaper = (async () => {
            if (canvasAreaRef.current && (appState.project.frame_top < 0 || appState.project.frame_left < 0)) {
                const centerX = canvasAreaRef.current.clientWidth / 2;
                const centerY = canvasAreaRef.current.clientHeight / 2;
                const left = Math.max(0, centerX - (appState.project.frame_width / 2));
                const top = Math.max(0, centerY - (appState.project.frame_height / 2));
                dispatch({
                    type: CoreActionType.SetProject,
                    value: { ...appState.project, frame_left: left, frame_top: top }
                })
            }
        });

        initCurrentPaper();
    }, [appState.project]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || event.metaKey) return;
            const clearAllContextMenus = () => {
                const inactiveImgs = Array.from(appState.project.imgs.entries());
                const inactiveSvgs = Array.from(appState.project.svgs.entries());
                inactiveImgs.forEach(i => {
                    dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                });
                inactiveSvgs.forEach(i => {
                    dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                });
            };
            if (event.key === 'Escape') {
                setSelectedEffectUnitKeys(new Set<string>());
                setSelectedImgKeys(new Set<string>());
                setSelectedSvgKeys(new Set<string>());
                const pendingSvgs = Array.from(appState.project.svgs.entries()).filter(m => m[1].showContextMenu);
                for (let i = 0; i < pendingSvgs.length; i++) {
                    const [key, svgMeta] = pendingSvgs[i];
                    const newSvg: LaurusProjectSvg = { ...svgMeta, showContextMenu: false }
                    dispatch({ type: CoreActionType.SetProjectSvg, key, value: newSvg });
                }
                const pendingImgs = Array.from(appState.project.imgs.entries()).filter(m => m[1].showContextMenu);
                for (let i = 0; i < pendingImgs.length; i++) {
                    const [key, imgMeta] = pendingImgs[i];
                    const newImg: LaurusProjectImg = { ...imgMeta, showContextMenu: false }
                    dispatch({ type: CoreActionType.SetProjectImg, key, value: newImg });
                }
            } else if (event.key.toLowerCase() === 'm') {
                const newToolType = uiState.tool.type === 'move' ? 'none' : 'move';
                uiDispatch({ type: UIActionType.SetTool, value: { type: newToolType } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'r') {
                uiDispatch({ type: UIActionType.SetTool, value: { type: 'rotate' } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 's') {
                uiDispatch({ type: UIActionType.SetTool, value: { type: 'scale' } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'v') {
                const newToolType = uiState.tool.type === 'viewport' ? 'none' : 'viewport';
                uiDispatch({ type: UIActionType.SetTool, value: { type: newToolType } });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'd') {
                uiDispatch({ type: UIActionType.SetTool, value: defaultMarqueeTool });
                clearAllContextMenus();
            } else if (event.key.toLowerCase() === 'x') {
                uiDispatch({ type: UIActionType.SetTool, value: { type: 'mix' } });
                clearAllContextMenus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [appState.project.imgs, appState.project.svgs, uiState.tool.type, dispatch, uiDispatch, setSelectedEffectUnitKeys]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            setIsMetaKeyPressed(e.metaKey);
        };
        const handleBlur = () => {
            setIsMetaKeyPressed(false);
        };
        window.addEventListener('keydown', handleKey);
        window.addEventListener('keyup', handleKey);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('keyup', handleKey);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    const handleImgPageRequest = useCallback(async () => {
        const mediaArray = Array.from(uiState.browserImgs.values());
        const response = await getImgDiscoveryPage(appState.apiOrigin, mediaPageSize, mediaArray.flatMap(m => m.img_media_id));
        if (response && response.length > 0) {
            for (let i = 0; i < response.length; i++) {
                uiDispatch({ type: UIActionType.AddBrowserImg, value: { ...response[i] }, first: false })
            }
            return true;
        }
        else {
            return false;
        }
    }, [appState.apiOrigin, uiState.browserImgs, mediaPageSize, uiDispatch]);

    const handleSvgPageRequest = useCallback(async () => {
        const mediaArray = Array.from(uiState.browserSvgs.values());
        const response = await getSvgDiscoveryPage(appState.apiOrigin, mediaPageSize, mediaArray.flatMap(m => m.svg_media_id));
        if (response && response.length > 0) {
            for (let i = 0; i < response.length; i++) {
                uiDispatch({ type: UIActionType.AddBrowserSvg, value: { ...response[i] }, first: false })
            }
            return true;
        }
        else {
            return false;
        }
    }, [appState.apiOrigin, uiState.browserSvgs, mediaPageSize, uiDispatch]);

    const getNewAnimations = useCallback(async (fill: FillMode, firstFrame: boolean) => {
        try {
            document.body.style.cursor = 'progress';

            const enabledEffects = [...appState.effects
                .filter(e => !e.value.disabled
                    && !appState.effectGroups.get(e.value.effect_group_id)?.disabled)];
            const keysWithMath = new Set<string>();
            enabledEffects.forEach(e => {
                e.value.math.forEach((_, key) => {
                    const meta = appState.project.imgs.get(key) || appState.project.svgs.get(key);
                    if (meta && meta.left >= 0 && meta.top >= 0) {
                        keysWithMath.add(key);
                    }
                });
            });

            const globalLimit: number = Math.max(...enabledEffects.map(e => e.value.end), 0);
            const options: KeyframeAnimationOptions = {
                duration: firstFrame ? 2 / appState.fps : globalLimit * 1000,
                iterations: 1,
                fill,
            };

            if (cacheNeedsRefreshRef.current) {
                framesCacheRef.current.clear();
            }

            const total = keysWithMath.size;
            let current = 0;
            if (total > 0) setAnimationDownloadProgress(0);
            const newAnimations: Animation[] = [];
            const keysWithMathArray = Array.from(keysWithMath);

            for (let i = 0; i < keysWithMathArray.length; i++) {
                const inputId = keysWithMathArray[i];
                let frames = framesCacheRef.current.get(inputId);

                // Source from the cache if available, otherwise call the server
                if (!frames) {
                    frames = await getFrames(appState.apiOrigin, appState.project.project_id, inputId, appState.fps);
                    if (frames) {
                        framesCacheRef.current.set(inputId, frames);
                    }
                }

                if (frames) {
                    const keyframes = toKeyframes(firstFrame, frames);
                    const element = imgElementsRef.current?.get(inputId) || svgElementsRef.current?.get(inputId);
                    if (element) {
                        element.getAnimations().forEach(a => a.cancel());
                        const keyframeEffect = new KeyframeEffect(element, keyframes, options);
                        const animation = new Animation(keyframeEffect, document.timeline);
                        current++;
                        if (total > 0) setAnimationDownloadProgress(Math.round((current / total) * 100));
                        newAnimations.push(animation);
                    }
                }
            }

            cacheNeedsRefreshRef.current = false;
            return newAnimations;
        } finally {
            document.body.style.cursor = '';
            setAnimationDownloadProgress(undefined);
        }
    }, [appState.apiOrigin, appState.effectGroups, appState.effects, appState.fps, appState.project.imgs, appState.project.project_id, appState.project.svgs]);

    const handleMixRestoration = useCallback(() => {
        if (uiState.tool.type === 'mix') {
            const restoredEffects = appState.effects.map(e => ({
                ...e,
                value: {
                    ...e.value,
                    mixState: e.value.mix ? LaurusMixState.Active : LaurusMixState.None
                }
            })) as LaurusEffect[];
            dispatch({ type: CoreActionType.SetEffects, value: restoredEffects });
        }
    }, [uiState.tool.type, appState.effects, dispatch]);

    const handleRewindAll = useCallback(async () => {
        if (!uiState.skipPreviousEnabled) return;
        handleMixRestoration();
        uiDispatch({ type: UIActionType.SetSkipPreviousEnabled, value: false });
        const inactiveSvgs = Array.from(appState.project.svgs.entries());
        const inactiveImgs = Array.from(appState.project.imgs.entries());
        inactiveSvgs.forEach(i => {
            dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
        });
        inactiveImgs.forEach(i => {
            dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
        });

        const newAnimations = await getNewAnimations('forwards', true);
        if (newAnimations) {
            Promise.all(newAnimations.map(animation => animation.finished))
                .then(() => {
                    uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                    uiDispatch({ type: UIActionType.SetPlayEnabled, value: true });
                    uiDispatch({ type: UIActionType.SetSkipNextEnabled, value: true });
                    uiDispatch({ type: UIActionType.SetSkipPreviousEnabled, value: true });
                })
                .catch(err => {
                    if (err instanceof Error && err.name !== 'AbortError') {
                        console.log('unknown error from waapi:', err);
                    }
                });
            newAnimations.forEach(a => {
                a.play()
            });
        }
    }, [appState.project.imgs, appState.project.svgs, uiState.skipPreviousEnabled, getNewAnimations, handleMixRestoration, uiDispatch, dispatch]);

    const handlePlayAll = useCallback(async () => {
        if (!uiState.playEnabled) return;
        handleMixRestoration();
        uiDispatch({ type: UIActionType.SetPlayEnabled, value: false });
        uiDispatch({ type: UIActionType.SetTool, value: { type: 'viewport' } });

        const inactiveSvgs = Array.from(appState.project.svgs.entries());
        const inactiveImgs = Array.from(appState.project.imgs.entries());
        inactiveSvgs.forEach(i => {
            dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
        });
        inactiveImgs.forEach(i => {
            dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
        });

        const newAnimations = await getNewAnimations('none', false);
        if (newAnimations) {
            Promise.all(newAnimations.map(animation => animation.finished))
                .then(() => {
                    uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                    uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                    uiDispatch({ type: UIActionType.SetPlayEnabled, value: true });
                    uiDispatch({ type: UIActionType.SetSkipNextEnabled, value: true });
                    uiDispatch({ type: UIActionType.SetSkipPreviousEnabled, value: true });
                })
                .catch(err => {
                    if (err instanceof Error && err.name !== 'AbortError') {
                        console.log('unknown error from waapi:', err);
                    }
                });
            newAnimations.forEach(a => a.play());
            uiDispatch({ type: UIActionType.SetRecordingLight, value: true });
        }
    }, [uiState.playEnabled, appState.project.imgs, appState.project.svgs, getNewAnimations, handleMixRestoration, uiDispatch, dispatch]);

    const handleFastForwardAll = useCallback(async (fastRate: number) => {
        if (!uiState.skipNextEnabled) return;
        handleMixRestoration();
        uiDispatch({ type: UIActionType.SetSkipNextEnabled, value: false });
        uiDispatch({ type: UIActionType.SetTool, value: { type: 'viewport' } });
        const inactiveSvgs = Array.from(appState.project.svgs.entries());
        const inactiveImgs = Array.from(appState.project.imgs.entries());
        inactiveSvgs.forEach(i => {
            dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
        });
        inactiveImgs.forEach(i => {
            dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
        });

        const newAnimations = await getNewAnimations('forwards', false);
        if (newAnimations) {
            Promise.all(newAnimations.map(animation => animation.finished))
                .then(() => {
                    uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                    uiDispatch({ type: UIActionType.SetPlayEnabled, value: true });
                    uiDispatch({ type: UIActionType.SetSkipNextEnabled, value: true });
                    uiDispatch({ type: UIActionType.SetSkipPreviousEnabled, value: true });
                })
                .catch(err => {
                    if (err instanceof Error && err.name !== 'AbortError') {
                        console.log('unknown error from waapi:', err);
                    }
                });
            newAnimations.forEach(a => {
                a.updatePlaybackRate(fastRate);
                a.play();
            });
        }
    }, [appState.project.imgs, appState.project.svgs, uiState.skipNextEnabled, getNewAnimations, handleMixRestoration, uiDispatch, dispatch]);

    const hoverContextValue = useMemo(() => ({
        mostRecentlyEnteredEffectUnitKey,
        setMostRecentlyEnteredEffectUnitKey,
        isMetaKeyPressed,
        selectedEffectUnitKeys,
        setSelectedEffectUnitKeys,
        selectedImgKeys,
        setSelectedImgKeys,
        selectedSvgKeys,
        setSelectedSvgKeys,
        animationDownloadProgress,
    }), [mostRecentlyEnteredEffectUnitKey, isMetaKeyPressed, selectedEffectUnitKeys, selectedImgKeys, selectedSvgKeys, animationDownloadProgress]);

    const coreContextValue = useMemo(() => ({
        appState,
        dispatch,
        getNewAnimations,
        handleRewindAll,
        handlePlayAll,
        handleFastForwardAll,
    }), [appState, getNewAnimations, handleRewindAll, handlePlayAll, handleFastForwardAll]);

    const uiContextValue = useMemo(() => ({
        uiState,
        uiDispatch,
    }), [uiState, uiDispatch]);

    const canvasCursor = useMemo(() => {
        return (isMetaKeyPressed && uiState.tool.type === 'marquee' && uiState.tool.select)
            ? 'crosshair'
            : (isMetaKeyPressed && uiState.tool.type !== 'viewport')
                ? 'context-menu'
                : (uiState.tool.type === 'scale')
                    ? 'crosshair'
                    : '';
    }, [uiState.tool, isMetaKeyPressed]);

    return (<>
        <div style={{
            width: "100vw",
            height: '100vh',
            display: 'grid',
            gridTemplateColumns: 'min-content 1fr min-content min-content min-content',
            gridTemplateRows: `min-content min-content min-content 1fr min-content`,
        }}>
            <HoverContext value={hoverContextValue}>
                <CoreContext value={coreContextValue}>
                    <UIContext value={uiContextValue}>
                        <div style={{ gridRow: '1', gridColumn: 'span 5', }}>
                            <Menubar
                                resolution={resolutionInit}
                                me={me.me} />
                        </div>
                        <div style={{ gridRow: '2 / span 3', gridColumn: '1', overflowY: 'auto', }}>
                            {showTimeline ?
                                <TimelineArea
                                    svgElementsRef={svgElementsRef}
                                    imgElementsRef={imgElementsRef}
                                    onRightPanelClick={() => setShowTimeline(false)}
                                /> :
                                <>
                                    <Bumper
                                        onBumperClick={() => {
                                            setShowTimeline(true);
                                        }}
                                        borderLeft={'1px solid rgba(255, 255, 255, 0.05)'}
                                        borderRight={'1px solid rgba(255, 255, 255, 0.05)'} />
                                    <div style={{
                                        zIndex: Z_INDEX.FLOATING_CONTROLS,
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
                                            svg={uiState.playEnabled ? playArrow() : playArrow("rgb(67,67,67)")}
                                            containerStyle={{
                                                width: minifiedControlsSize.playSvg,
                                                height: minifiedControlsSize.playSvg,
                                                cursor: uiState.playEnabled ? 'pointer' : 'progress',
                                            }}
                                            scale={0.5}
                                            scaleToContaier={true}
                                            onContainerClick={handlePlayAll} />
                                    </div>
                                    <div style={{
                                        zIndex: Z_INDEX.FLOATING_CONTROLS,
                                        position: 'fixed',
                                        bottom: minifiedControlsSize.recordingBottom,
                                        right: showMediaBrowser ? minifiedControlsSize.recordingRight1 : minifiedControlsSize.recordingRight2,
                                        width: minifiedControlsSize.recordingWidth,
                                        height: minifiedControlsSize.recordingHeight,
                                        borderRadius: '50%',
                                        border: uiState.recordingLight ? '1px solid rgb(239, 239, 239)' : 'none',
                                        background: uiState.recordingLight ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'none',
                                        boxShadow: uiState.recordingLight ? 'rgba(255, 255, 255, 1) 0px 0px 100px 10px' : 'none'
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
                            <ProjectbarLevel2 />
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
                                cursor: canvasCursor,
                            }}>
                            <div
                                className={styles[`${uiState.resolution.type == 'high' ? 'noisy-background-20-3' : 'noisy-background-20-3-low-res'}`]}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: appState.project.canvas_width,
                                    height: appState.project.canvas_height,
                                    zIndex: Z_INDEX.CANVAS_BG,
                                }} />
                            {uiState.tool.type === 'marquee' && <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: 'min-content',
                                    height: 'min-content',
                                    zIndex: (isMetaKeyPressed) ? Z_INDEX.META_KEY_CANVAS : Z_INDEX.INTERACTION_CANVAS,
                                    pointerEvents: (isMetaKeyPressed) ? 'none' : 'auto'
                                }}>
                                <Canvas />
                            </div>}
                            {/* camera frame */}
                            <DraggableCamera
                                contextId={"draggable-camera-context-id"}
                                nodeId={"draggable-camera-node-id"}
                                svgElementsRef={svgElementsRef}
                                imgElementsRef={imgElementsRef}
                                zIndex={Z_INDEX.CAMERA_FRAME}
                                onNewPosition={async function (newPosition: { x: number; y: number; }) {
                                    const rollback: LaurusProjectResult = { ...appState.project };
                                    const newProject: LaurusProjectResult = {
                                        ...appState.project,
                                        frame_left: newPosition.x,
                                        frame_top: newPosition.y
                                    };
                                    if (appState.project.project_id) {
                                        dispatch({ type: CoreActionType.SetProject, value: newProject });
                                        const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
                                        if (!updated) {
                                            dispatch({ type: CoreActionType.SetProject, value: rollback });
                                        }
                                    }
                                    else {
                                        dispatch({ type: CoreActionType.SetProject, value: newProject });
                                        const created = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
                                        if (created) {
                                            dispatch({ type: CoreActionType.SetProject, value: { ...created } });
                                        } else {
                                            dispatch({ type: CoreActionType.SetProject, value: { ...rollback } });
                                        }
                                    }
                                }}
                                disabled={uiState.tool.type != 'move'} />
                            {uiState.tool.type != 'viewport' &&
                                <>
                                    {Array.from(appState.project.imgs.entries()).map((e) => {
                                        const [key, meta] = e;
                                        if (meta.top < 0 || meta.left < 0) return;
                                        const refKey = uiState.tool.type != 'viewport' ? `${key}|preview` : key;
                                        const imgData = appState.canvasImgs.get(key);
                                        if (imgData) {
                                            return (
                                                <div key={key}>
                                                    <DraggableProjectImg
                                                        mediaKey={key}
                                                        data={imgData}
                                                        meta={meta}
                                                        zIndex={(uiState.tool.type === 'marquee' && uiState.tool.stack) ? Z_INDEX.ITEMS_STACKING_OFFSET + meta.order : meta.order + Z_INDEX.ITEMS_NORMAL_OFFSET}
                                                        imgElementsRef={imgElementsRef}
                                                        refKey={refKey} />
                                                </div>
                                            );
                                        }
                                    })}
                                    {Array.from(appState.project.svgs.entries()).map((e) => {
                                        const [key, meta] = e;
                                        if (meta.top < 0 || meta.left < 0) return;
                                        const refKey = uiState.tool.type != 'viewport' ? `${key}|preview` : key;
                                        const svgData = appState.canvasSvgs.get(key);
                                        if (!svgData) return;
                                        let decodedString = "";
                                        try {
                                            decodedString = decodeURIComponent(
                                                atob(svgData.markup)
                                                    .split('')
                                                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                                    .join(''));
                                        }
                                        catch (error) {
                                            console.log("Failed to decode svg markup", { media_key: meta.media_key, error });
                                        }
                                        if (decodedString) {
                                            return (
                                                <div key={key}>
                                                    <DraggableProjectSvg
                                                        mediaKey={key}
                                                        decodedString={decodedString}
                                                        meta={meta}
                                                        zIndex={(uiState.tool.type === 'marquee' && uiState.tool.stack) ? Z_INDEX.ITEMS_STACKING_OFFSET + meta.order : meta.order + Z_INDEX.ITEMS_NORMAL_OFFSET}
                                                        svgElementsRef={svgElementsRef}
                                                        refKey={refKey} />
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
                                <Bumper
                                    onBumperClick={() => {
                                        setShowMediaBrowser(false);
                                    }}
                                    borderLeft={'1px solid rgba(255,255,255,0.05)'}
                                    borderRight={'1px solid rgba(255,255,255,0.05)'} />
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
                            <Toolbar
                                resolution={resolutionInit}
                                handleMixRestoration={handleMixRestoration} />
                        </div>
                        {/* mediabar */}
                        <div style={{ gridRow: '5', gridColumn: 'span 5' }}>
                            <div style={{
                                height: mediabarHeight,
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: 'space-between',
                                background: "linear-gradient(34deg, rgba(25, 25, 25, 1) 34%, rgba(21, 21, 21, 1))",
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                            }}>
                                <div
                                    title='selected element'
                                    style={{
                                        borderRight: uiState.activeElement ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0)',
                                        position: 'relative'
                                    }}>
                                    {uiState.activeElement ? (() => {
                                        switch (uiState.activeElement.type) {
                                            case "svg": {
                                                const svg = appState.canvasSvgs.get(uiState.activeElement.key);
                                                if (!svg) return <div style={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }} />;
                                                return (
                                                    <SvgRepo
                                                        title="selected element"
                                                        svg={svg}
                                                        containerStyle={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                        scale={0.5}
                                                        scaleToContaier={true}
                                                    />
                                                );
                                            }
                                            case "img": {
                                                const img = appState.canvasImgs.get(uiState.activeElement.key);
                                                if (!img) return <div style={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }} />;
                                                return (
                                                    <div style={{
                                                        width: mediabarHeight - 2,
                                                        height: mediabarHeight - 2,
                                                        position: 'relative',
                                                    }} >
                                                        <LaurusImage
                                                            title="selected element"
                                                            draggable={false}
                                                            alt={img.media_key}
                                                            src={img.src}
                                                            fill
                                                            style={{
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            }
                                        }
                                    })() : <div style={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }} />}
                                </div>
                                <div
                                    title='browser element'
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                                    onClick={() => setShowMediaBrowser(v => !v)}
                                    style={{
                                        borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                                        position: 'relative'
                                    }}>
                                    {uiState.browserElement ? (() => {
                                        switch (uiState.browserElement.type) {
                                            case "svg": {
                                                return (
                                                    <SvgRepo
                                                        title={"browser element"}
                                                        svg={uiState.browserElement.value}
                                                        containerStyle={{ width: mediabarHeight - 2, height: mediabarHeight - 2, cursor: 'pointer' }}
                                                        scale={0.5}
                                                        scaleToContaier={true}
                                                    />
                                                );
                                            }
                                            case "img": {
                                                return (
                                                    <div style={{
                                                        width: mediabarHeight - 2,
                                                        height: mediabarHeight - 2,
                                                        position: 'relative',
                                                    }} >
                                                        <LaurusImage
                                                            title={"browser element"}
                                                            draggable={false}
                                                            alt={uiState.browserElement.value.media_key}
                                                            src={uiState.browserElement.value.src}
                                                            fill
                                                            style={{
                                                                objectFit: 'cover',
                                                                cursor: 'pointer',
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            }
                                        }
                                    })() : <div style={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }} />}
                                </div>
                            </div>
                            <Statusbar
                                action={statusAction}
                                body={statusBody} />
                        </div>
                    </UIContext>
                </CoreContext>
            </HoverContext>
        </div >
    </>)
}

interface Bumper {
    borderLeft: string,
    borderRight: string,
    onBumperClick: () => void,
}
export function Bumper({ borderLeft, borderRight, onBumperClick }: Bumper) {
    const { uiState } = useContext(UIContext);

    const [dynamicSizes] = useState(() => {
        switch (uiState.resolution.type) {
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
                className={styles[`${uiState.resolution.type == 'high' ? 'noisy-background-16-2' : 'noisy-background-16-2-low-res'}`]}
                style={{
                    borderLeft,
                    borderRight,
                    width: dynamicSizes.svg.width,
                    display: 'grid',
                    placeContent: 'center',
                }} >
                <SvgRepo
                    svg={moreVert('rgba(255, 255, 255, 0.6)')}
                    containerStyle={{
                        width: dynamicSizes.svg.width,
                        height: dynamicSizes.svg.height,
                    }}
                    scale={1}
                    scaleToContaier={true}
                    onContainerClick={onBumperClick} />
            </div>
        </div>
    </>)
}
