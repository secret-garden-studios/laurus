'use client'
import { createContext, CSSProperties, use, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import styles from '../app.module.css';
import {
    getFrames,
    getImgDiscoveryPage,
    getSvgDiscoveryPage,
    LaurusEffect,
    LaurusEffectGroupResult,
    LaurusFrame,
    LaurusImgResult,
    LaurusMixState,
    LaurusSvgResult,
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
    FRAME_HEIGHT_5_7,
    FRAME_WIDTH_5_7,
    WorkspaceResolution,
    Z_INDEX
} from "./workspace.config";
import { ProjectDependencies, BrowserDependencies } from "./page";
import Toolbar from "./bars/toolbar";
import {
    ProjectResult_V1_0,
    updateProject,
    createProject,
    AbsolutePosition,
    ContextMenuConfig,
    DEFAULT_CONTEXT_MENU_CONFIG,
    LaurusProjectImg,
    LaurusProjectResult,
    LaurusProjectSvg
} from "../projects/projects.server";
import { MeDependencies } from "../page";
import LaurusImage from "../components/laurus-image";
import { uiContextReducer, CarouselEntry, UIAction, UIActionType, UIState, defaultMarqueeTool, defaultUIState, ProjectMediaContextMenu, LaurusTool } from "./states/ui-state";
import { CoreAction, CoreActionType, CoreState, coreContextReducer, defaultCoreState } from "./states/core-state";

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

export interface AnimationTarget {
    inputKey: string;
    getFrames: (apiOrigin: string | undefined) => Promise<LaurusFrame[] | undefined>;
    effectKey: string;
}

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

export function toKeyframes(laurusFrames: LaurusFrame[], firstFrame: boolean): Keyframe[] {
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

export interface CoreContextProps {
    appState: CoreState;
    dispatch: React.Dispatch<CoreAction>;
    handleRewindAll: (playbackRate: number) => void;
    handlePlayAll: () => void;
    handleFastForwardAll: (playbackRate: number) => void;
    handlePlayTarget: (target: AnimationTarget) => void;
    handleStopAll: () => void;
}

export interface UIContextProps {
    uiState: UIState;
    uiDispatch: React.Dispatch<UIAction>;
}

export interface HoverContextProps {
    mostRecentlyEnteredEffectUnitKey: string | undefined;
    setMostRecentlyEnteredEffectUnitKey: (key: string | undefined) => void;
    isMetaKeyPressed: boolean;
    isAltKeyPressed: boolean;
    selectedEffectUnitKeys: Set<string>;
    setSelectedEffectUnitKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedImgKeys: Set<string>;
    setSelectedImgKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedSvgKeys: Set<string>;
    setSelectedSvgKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const HoverContext = createContext<HoverContextProps>({
    mostRecentlyEnteredEffectUnitKey: undefined,
    setMostRecentlyEnteredEffectUnitKey: () => { },
    isMetaKeyPressed: false,
    isAltKeyPressed: false,
    selectedEffectUnitKeys: new Set<string>(),
    setSelectedEffectUnitKeys: () => { },
    selectedImgKeys: new Set<string>(),
    setSelectedImgKeys: () => { },
    selectedSvgKeys: new Set<string>(),
    setSelectedSvgKeys: () => { }
});

export const CoreContext = createContext<CoreContextProps>(
    {
        appState: { ...defaultCoreState },
        dispatch: () => { },
        handleRewindAll: () => { },
        handlePlayAll: () => { },
        handleFastForwardAll: () => { },
        handlePlayTarget: () => { },
        handleStopAll: () => { },
    }
);

export const UIContext = createContext<UIContextProps>(
    {
        uiState: { ...defaultUIState },
        uiDispatch: () => { },
    }
);

function initProject(p: ProjectResult_V1_0) {
    const projectImgsInit: Map<string, LaurusProjectImg> =
        new Map(p.imgs.entries().map(e => [e[0], { ...e[1] }]));

    const projectSvgsInit: Map<string, LaurusProjectSvg> =
        new Map(p.svgs.entries().map(e => [e[0], { ...e[1] }]));

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

    const newProjectContextMenus = new Map<string, ProjectMediaContextMenu>();
    if (projectDependencies) {
        projectDependencies.project.imgs.forEach((img, key) => {
            newProjectContextMenus.set(key, {
                showContextMenu: false,
                contextMenuConfig: getNewContextMenuConfig(
                    { top: img.top, left: img.left },
                    { width: projectDependencies.project.canvas_width, height: projectDependencies.project.canvas_height },
                    { ...img },
                    { x: img.scale_x, y: img.scale_y },
                    { ...DEFAULT_CONTEXT_MENU_CONFIG }
                )
            });
        });
        projectDependencies.project.svgs.forEach((svg, key) => {
            newProjectContextMenus.set(key, {
                showContextMenu: false,
                contextMenuConfig: getNewContextMenuConfig(
                    { top: svg.top, left: svg.left },
                    { width: projectDependencies.project.canvas_width, height: projectDependencies.project.canvas_height },
                    { ...svg },
                    { x: svg.scale_x, y: svg.scale_y },
                    { ...DEFAULT_CONTEXT_MENU_CONFIG }
                )
            });
        });
    }

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
            projectContextMenus: newProjectContextMenus,
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
    const effectNamesInit = use(effectNamesInitPromise);
    const projectInit = use(projectInitPromise);
    const browserInit = use(browserInitPromise);
    const [isMetaKeyPressed, setIsMetaKeyPressed] = useState(false);
    const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);
    const [mostRecentlyEnteredEffectUnitKey, setMostRecentlyEnteredEffectUnitKey] = useState<string | undefined>(undefined);
    const [selectedEffectUnitKeys, setSelectedEffectUnitKeys] = useState<Set<string>>(new Set<string>());
    const [selectedImgKeys, setSelectedImgKeys] = useState<Set<string>>(new Set<string>());
    const [selectedSvgKeys, setSelectedSvgKeys] = useState<Set<string>>(new Set<string>());
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
    const svgElementsRef = useRef<Map<string, SVGSVGElement>>(null);
    const imgElementsRef = useRef<Map<string, HTMLImageElement>>(null);
    const canvasAreaRef = useRef<HTMLDivElement>(null);
    const framesCacheRef = useRef<Map<string, LaurusFrame[]>>(new Map());

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
    }, [appState.apiOrigin, mediaPageSize, uiState.browserImgs]);

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
    }, [appState.apiOrigin, mediaPageSize, uiState.browserSvgs]);

    const handleMixRestoration = useCallback(() => {
        if (uiState.tool.type === 'mix') {
            const restoredEffects = appState.effects.map(e => ({
                ...e,
                value: {
                    ...e.value,
                    mixState: e.value.mix ? LaurusMixState.Active : LaurusMixState.None
                }
            })) as LaurusEffect[];
            dispatch({ type: CoreActionType.SetEffects, value: restoredEffects, preserveCache: true });
        }
    }, [uiState.tool.type, appState.effects, dispatch]);

    const closeContextMenus = useCallback(() => {
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
    }, [uiDispatch]);

    const getNewAnimationsByTarget = useCallback(async (
        fill: FillMode,
        reverse: boolean,
        target: AnimationTarget) => {
        const { inputKey, getFrames, effectKey } = target;
        try {
            document.body.style.cursor = 'progress';
            const enabledEffects = [...appState.effects
                .filter(e => !e.value.disabled
                    && !appState.effectGroups.get(e.value.effect_group_id)?.disabled)];
            const foundEffect = enabledEffects.find(e =>
                e.key === effectKey
            );
            if (!foundEffect) return [];

            const animationOptions: KeyframeAnimationOptions = {
                duration: (foundEffect.value.end * 1000) - (foundEffect.value.start * 1000),
                iterations: 1,
                fill,
            };
            uiDispatch({ type: UIActionType.SetAnimationDownloadProgress, value: 0 });
            const newAnimations: Animation[] = [];
            const framesFromServer = await getFrames(appState.apiOrigin);
            if (!framesFromServer) return [];
            if (reverse) {
                framesFromServer.reverse();
            }
            const keyframes: Keyframe[] = toKeyframes(framesFromServer, false);
            const element = imgElementsRef.current?.get(inputKey) || svgElementsRef.current?.get(inputKey);
            if (element) {
                const keyframeEffect = new KeyframeEffect(element, keyframes, animationOptions);
                const animation = new Animation(keyframeEffect, document.timeline);
                uiDispatch({ type: UIActionType.SetAnimationDownloadProgress, value: 100 });
                newAnimations.push(animation);
            }
            return newAnimations;
        } finally {
            document.body.style.cursor = '';
            uiDispatch({ type: UIActionType.SetAnimationDownloadProgress, value: undefined });
        }
    }, [appState.apiOrigin, appState.effectGroups, appState.effects]);

    const getNewAnimations = useCallback(async (
        fill: FillMode,
        reverse: boolean,
        setCache: boolean
    ) => {
        try {
            document.body.style.cursor = 'progress';
            const enabledEffects = [...appState.effects
                .filter(e => !e.value.disabled
                    && !appState.effectGroups.get(e.value.effect_group_id)?.disabled)];
            const eligibleItems = new Set<string>();
            let globalLimit = 0;
            enabledEffects.forEach(e => {
                e.value.math.forEach((_, inputKey) => {
                    if (appState.project.imgs.has(inputKey) || appState.project.svgs.has(inputKey)) {
                        eligibleItems.add(inputKey);
                        globalLimit = Math.max(globalLimit, e.value.end);
                    }
                });
            });
            const animationOptions: KeyframeAnimationOptions = {
                duration: globalLimit * 1000,
                iterations: 1,
                fill,
            };
            const total = eligibleItems.size;
            let current = 0;
            if (total > 0) uiDispatch({ type: UIActionType.SetAnimationDownloadProgress, value: 0 });
            const newAnimations: Animation[] = [];
            for (const inputKey of eligibleItems) {
                let laurusFrames: LaurusFrame[] = [];
                if (!appState.cacheNeedsRefresh) {
                    laurusFrames = [...(framesCacheRef.current.get(inputKey) ?? [])];
                }
                if (laurusFrames.length === 0) {
                    const framesFromServer = await getFrames(appState.apiOrigin, appState.project.project_id, inputKey, appState.fps);
                    if (!framesFromServer) continue;
                    laurusFrames = framesFromServer;
                    if (setCache) {
                        framesCacheRef.current.set(inputKey, [...framesFromServer]);
                    }
                }
                if (reverse) {
                    laurusFrames.reverse();
                }
                const keyframes: Keyframe[] = toKeyframes(laurusFrames, false);
                const element = imgElementsRef.current?.get(inputKey) || svgElementsRef.current?.get(inputKey);
                if (element) {
                    const keyframeEffect = new KeyframeEffect(element, keyframes, animationOptions);
                    const animation = new Animation(keyframeEffect, document.timeline);
                    current++;
                    if (total > 0) uiDispatch({ type: UIActionType.SetAnimationDownloadProgress, value: Math.round((current / total) * 100) });
                    newAnimations.push(animation);
                }
            }
            return newAnimations;
        } finally {
            document.body.style.cursor = '';
            uiDispatch({ type: UIActionType.SetAnimationDownloadProgress, value: undefined });
        }
    }, [appState.apiOrigin, appState.cacheNeedsRefresh, appState.effectGroups, appState.effects, appState.fps, appState.project.imgs, appState.project.project_id, appState.project.svgs]);

    const handleRewindAll = useCallback(async (playbackRate: number) => {
        if (uiState.playbackMode.type !== 'stopped' || !uiState.filledForwards) return;
        handleMixRestoration();
        closeContextMenus();
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'waiting' } });

        const newAnimations = await getNewAnimations('forwards', true, false);
        if (newAnimations.length == 0) {
            uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
            uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
            uiDispatch({ type: UIActionType.SetFilledForwards, value: false });
            return;
        };
        Promise.all(newAnimations.map(animation => animation.finished))
            .then(() => {
                uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
                uiDispatch({ type: UIActionType.SetFilledForwards, value: false });
            })
            .catch(err => {
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.log('unknown error from waapi:', err);
                }
            });
        newAnimations.forEach(a => {
            a.updatePlaybackRate(playbackRate);
            a.play();
        });
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'playing' } });
    }, [closeContextMenus, getNewAnimations, handleMixRestoration, uiState.filledForwards, uiState.playbackMode.type]);

    const handlePlayAll = useCallback(async () => {
        if (uiState.playbackMode.type !== 'stopped') return;
        handleMixRestoration();
        closeContextMenus();
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'waiting' } });
        uiDispatch({ type: UIActionType.SetRecordingLight, value: true });
        dispatch({ type: CoreActionType.SetCacheNeedsRefresh, value: false });

        /* 
        temp sln to switch to viewport here and read from the frames cache reliably: 
        Yield execution to the event loop so React can render and commit the tool change to 'viewport',
        which unmounts the items from the main canvas and mounts them inside the camera viewport.
        This ensures the ref collections (imgElementsRef/svgElementsRef) point to the new mounted DOM elements.
        uiDispatch({ type: UIActionType.SetTool, value: { type: 'viewport' } });
        await new Promise(resolve => setTimeout(resolve, 50));
        */
        if (uiState.tool.type !== 'viewport' && uiState.tool.type !== 'none') {
            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
        }

        const newAnimations = await getNewAnimations('none', false, true);
        if (newAnimations.length == 0) {
            uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
            uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
            return;
        };
        Promise.all(newAnimations.map(animation => animation.finished))
            .then(() => {
                uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
            })
            .catch(err => {
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.log('unknown error from waapi:', err);
                }
            });

        newAnimations.forEach(a => a.play());
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'playing' } });
    }, [closeContextMenus, getNewAnimations, handleMixRestoration, uiState.playbackMode.type, uiState.tool.type]);

    const handlePlayTarget = useCallback(async (target: AnimationTarget) => {
        if (uiState.playbackMode.type !== 'stopped') return;
        handleMixRestoration();
        closeContextMenus();
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'waiting' } });
        uiDispatch({ type: UIActionType.SetRecordingLight, value: true });

        const newAnimations = await getNewAnimationsByTarget('none', false, target);
        if (newAnimations.length == 0) {
            uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
            uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
            return;
        };
        Promise.all(newAnimations.map(animation => animation.finished))
            .then(() => {
                uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
            })
            .catch(err => {
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.log('unknown error from waapi:', err);
                }
            });

        newAnimations.forEach(a => a.play());
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'playing' } });
    }, [closeContextMenus, getNewAnimationsByTarget, handleMixRestoration, uiState.playbackMode.type]);

    const handleFastForwardAll = useCallback(async (playbackRate: number) => {
        if (uiState.playbackMode.type !== 'stopped') return;
        handleMixRestoration();
        closeContextMenus();
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'waiting' } });

        const newAnimations = await getNewAnimations('forwards', false, false);
        if (newAnimations.length == 0) {
            uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
            uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
            uiDispatch({ type: UIActionType.SetFilledForwards, value: true });
            return;
        };
        Promise.all((newAnimations).map(animation => animation.finished))
            .then(() => {
                uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
                uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
                uiDispatch({ type: UIActionType.SetFilledForwards, value: true });
            })
            .catch(err => {
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.log('unknown error from waapi:', err);
                }
            });
        newAnimations.forEach(a => {
            a.updatePlaybackRate(playbackRate);
            a.play();
        });
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'playing' } });
    }, [closeContextMenus, getNewAnimations, handleMixRestoration, uiState.playbackMode.type]);

    const handleStopAll = useCallback(async () => {
        if (uiState.playbackMode.type === 'stopped') return;
        if (!svgElementsRef.current || !imgElementsRef.current) return;
        svgElementsRef.current.forEach(el => el.getAnimations().forEach(a => a.cancel()));
        imgElementsRef.current.forEach(el => el.getAnimations().forEach(a => a.cancel()));
        uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
        uiDispatch({ type: UIActionType.SetPlaybackMode, value: { type: 'stopped' } });
        uiDispatch({ type: UIActionType.SetFilledForwards, value: false });
    }, [uiState.playbackMode.type]);

    const hoverContextValue = useMemo(() => ({
        mostRecentlyEnteredEffectUnitKey,
        setMostRecentlyEnteredEffectUnitKey,
        isMetaKeyPressed,
        isAltKeyPressed,
        selectedEffectUnitKeys,
        setSelectedEffectUnitKeys,
        selectedImgKeys,
        setSelectedImgKeys,
        selectedSvgKeys,
        setSelectedSvgKeys
    }), [mostRecentlyEnteredEffectUnitKey, isMetaKeyPressed, isAltKeyPressed, selectedEffectUnitKeys, selectedImgKeys, selectedSvgKeys]);

    const coreContextValue = useMemo(() => ({
        appState,
        dispatch,
        getNewAnimations,
        getNewAnimationsByTarget,
        handleRewindAll,
        handlePlayAll,
        handleFastForwardAll,
        handlePlayTarget,
        handleStopAll,
    }), [appState, getNewAnimations, getNewAnimationsByTarget, handleRewindAll, handlePlayAll, handleFastForwardAll, handlePlayTarget, handleStopAll]);

    const uiContextValue = useMemo(() => ({
        uiState,
        uiDispatch,
    }), [uiState]);

    const canvasCursor = useMemo(() => {
        return (isMetaKeyPressed && uiState.tool.type === 'marquee' && uiState.tool.select)
            ? 'crosshair'
            : (isMetaKeyPressed && uiState.tool.type !== 'viewport')
                ? 'context-menu'
                : (uiState.tool.type === 'scale')
                    ? 'crosshair'
                    : '';
    }, [uiState.tool, isMetaKeyPressed]);

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
            const isInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
            if (event.metaKey) return;
            if (event.key === 'Escape') {
                setSelectedEffectUnitKeys(new Set<string>());
                setSelectedImgKeys(new Set<string>());
                setSelectedSvgKeys(new Set<string>());
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
            } else if (event.key === " " && !isInput) {
                event.preventDefault();
                switch (uiState.playbackMode.type) {
                    case 'waiting':
                        break;
                    case 'playing':
                        handleStopAll();
                        break;
                    case 'stopped':
                        handlePlayAll();
                        break;
                }
            }
            else if (event.key.toLowerCase() === 'm' && !isInput && uiState.playbackMode.type === 'stopped') {
                const newTool: LaurusTool = uiState.tool.type === 'move' ? { type: 'none' } : { type: 'move' };
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
            } else if (event.key.toLowerCase() === 'r' && !isInput && uiState.playbackMode.type === 'stopped') {
                const newTool: LaurusTool = uiState.tool.type === 'rotate' ? { type: 'none' } : { type: 'rotate' };
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
            } else if (event.key.toLowerCase() === 's' && !isInput && uiState.playbackMode.type === 'stopped') {
                const newTool: LaurusTool = uiState.tool.type === 'scale' ? { type: 'none' } : { type: 'scale' };
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
            } else if (event.key.toLowerCase() === 'v' && !isInput && uiState.playbackMode.type === 'stopped') {
                const newTool: LaurusTool = uiState.tool.type === 'viewport' ? { type: 'none' } : { type: 'viewport' };
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
            } else if (event.key.toLowerCase() === 'd' && !isInput && uiState.playbackMode.type === 'stopped') {
                const newTool: LaurusTool = uiState.tool.type === 'marquee' ? { type: 'none' } : defaultMarqueeTool;
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
            } else if (event.key.toLowerCase() === 'x' && !isInput && uiState.playbackMode.type === 'stopped') {
                const newTool: LaurusTool = uiState.tool.type === 'mix' ? { type: 'none' } : { type: 'mix' };
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handlePlayAll, handleStopAll, uiState.playbackMode.type, uiState.tool.type]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            setIsMetaKeyPressed(e.metaKey);
            setIsAltKeyPressed(e.altKey);
        };
        const handleBlur = () => {
            setIsMetaKeyPressed(false);
            setIsAltKeyPressed(false);
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
                                            svg={uiState.playbackMode.type === 'stopped' ? playArrow() : playArrow("rgb(67,67,67)")}
                                            containerStyle={{
                                                width: minifiedControlsSize.playSvg,
                                                height: minifiedControlsSize.playSvg,
                                                cursor: uiState.playbackMode.type === 'stopped' ? 'pointer' : 'progress',
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
                                framesCacheRef={framesCacheRef}
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
                            <>
                                {Array.from(appState.project.imgs.entries()).map((e) => {
                                    const [key, meta] = e;
                                    const showContextMenu = uiState.projectContextMenus.get(key)?.showContextMenu ?? false;
                                    if (meta.top < 0 || meta.left < 0 || (uiState.tool.type === 'viewport' && !showContextMenu)) return;
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
                                                    framesCacheRef={framesCacheRef}
                                                    refKey={key}
                                                    forceAbsolutePosition={uiState.tool.type === 'viewport' && showContextMenu} />
                                            </div>
                                        );
                                    }
                                })}
                                {Array.from(appState.project.svgs.entries()).map((e) => {
                                    const [key, meta] = e;
                                    const showContextMenu = uiState.projectContextMenus.get(key)?.showContextMenu ?? false;
                                    if (meta.top < 0 || meta.left < 0 || (uiState.tool.type === 'viewport' && !showContextMenu)) return;
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
                                                    framesCacheRef={framesCacheRef}
                                                    refKey={key}
                                                    forceAbsolutePosition={uiState.tool.type === 'viewport' && showContextMenu} />
                                            </div>
                                        );
                                    }
                                })}
                            </>
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
                                    framesCacheRef={framesCacheRef}
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
                                body={statusBody}
                                framesCacheRef={framesCacheRef} />
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
