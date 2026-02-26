'use client'
import { createContext, use, useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
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
    getScales
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "./statusbar";
import Canvas from "./canvas";
import MediaBrowserArea from "./media-browser";
import { hexagon, motionPhotosOn } from "../svg-repo";
import { DraggableReactImg, DraggableReactSvg, ReactImg, ReactSvg } from "./media";
import Projectbar from "./projectbar";
import TimelineArea from "./timeline-area";
import { v4 } from "uuid";

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
type LaurusMoveResult = {
    offset: number,
    duration: number,
    order: number,
}
export interface LaurusScaleResult extends ScaleResult_V1_0 {
    math: Map<string, LaurusScaleEquation>,
}
export type LaurusEffect =
    | { type: 'scale', key: string, value: LaurusScaleResult }
    | { type: 'move', key: string, value: LaurusMoveResult }
export type LaurusThumbnail =
    | { type: 'svg', value: EncodedSvg }
    | { type: 'img', value: EncodedImg }
export type LaurusTool =
    | { type: 'drop', value: LaurusThumbnail | undefined }
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
 * if state is nested by three or more virtual DOM layers, it belongs in here.
 */
export interface WorkspaceState {
    apiOrigin: string | undefined,
    project: LaurusProjectResult,

    downloadedImgs: EncodedImg[],
    downloadedSvgs: EncodedSvg[],

    tool: LaurusTool | undefined,
    activeElement: LaurusActiveElement | undefined,

    effectNames: string[],
    effects: LaurusEffect[],

    timelineUnit: string,
    timelineMaxValue: number,
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
    tool: { type: 'drop', value: undefined },
    downloadedImgs: [],
    downloadedSvgs: [],
    effectNames: [],
    effects: [],
    timelineUnit: '',
    timelineMaxValue: 0,
    activeElement: undefined
}

export enum WorkspaceActionType {
    SetWorkspace,
    SetProject,
    AddDownloadedImg,
    AddDownloadedSvg,
    SetTool,
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
}

export type WorkspaceAction =
    | { type: WorkspaceActionType.SetWorkspace, value: WorkspaceState }
    | { type: WorkspaceActionType.SetProject, value: LaurusProjectResult }

    | { type: WorkspaceActionType.AddDownloadedImg, value: EncodedImg }
    | { type: WorkspaceActionType.AddDownloadedSvg, value: EncodedSvg }

    | { type: WorkspaceActionType.SetTool, value: LaurusTool | undefined }
    | { type: WorkspaceActionType.SetActiveElement, value: LaurusActiveElement | undefined }

    | { type: WorkspaceActionType.SetProjectImg, key: string, value: LaurusImg }
    | { type: WorkspaceActionType.SetProjectSvg, key: string, value: LaurusSvg }
    | { type: WorkspaceActionType.DeleteProjectImg, key: string }
    | { type: WorkspaceActionType.DeleteProjectSvg, key: string }

    | { type: WorkspaceActionType.SetEffects, value: LaurusEffect[] }
    | { type: WorkspaceActionType.SetEffect, value: LaurusEffect }

    | { type: WorkspaceActionType.SetTimelineUnit, value: string }
    | { type: WorkspaceActionType.IncrementTimelineMaxValue }

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
            if (action.value) {
                return { ...state, tool: { ...action.value } }
            }
            else {
                return { ...state }
            }
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
        activeElement: defaultWorkspace.activeElement,
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

    const [activeThumbnail, setActiveThumbnail] = useState<LaurusThumbnail | undefined>(undefined);
    const [browserThumbnail, setBrowserThumbnail] = useState<LaurusThumbnail | undefined>(undefined);

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
                setBrowserThumbnail(newThumnail);
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop', value: { ...newThumnail } } });
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

        const downloadScalesFromProjectInit = async () => {
            if (p && p.length > 0) {
                const mostRecent = getMostRecentProject([...p]);
                const response = await getScales(api, mostRecent.project_id);
                if (response) {
                    const newEffects: LaurusEffect[] = response.map(s => {
                        return {
                            type: 'scale',
                            key: s.scale_id,
                            value: {
                                ...s,
                            }
                        }
                    });
                    dispatch({ type: WorkspaceActionType.SetEffects, value: newEffects });
                }
            }
        };

        const top: number = mpl ? (parseInt(mpl) || 2) : 2;
        downloadScalesFromProjectInit();
        downloadImgsFromProjectInit();
        downloadImgsForBrowser(top);
        downloadSvgsFromProjectInit();
        downloadSvgsForBrowser(top);
    }, [api, mpl, mediaBrowserPageSize, p]);

    return (<>
        <div
            style={{
                width: "100vw",
                height: '100vh',
                display: 'grid',
                gridTemplateColumns: 'min-content min-content 1fr min-content min-content',
                gridTemplateRows: `min-content 1fr min-content`,
                overflowX: "auto",
            }}>
            <WorkspaceContext value={{ appState: appState, dispatch }}>
                <div style={{ gridRow: '1', gridColumn: 'span 5', }}>
                    <Menubar />
                    <Projectbar />
                </div>

                <div style={{ gridRow: '2', gridColumn: '1', overflowY: 'auto', }}>
                    {showTimeline &&
                        <TimelineArea
                            size={{ width: 1000, height: 5000 }} />}
                </div>

                {/* left bumper */}
                <div
                    onClick={() => { setShowTimeline(v => !v); }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    style={{
                        gridRow: '2', gridColumn: '2',
                        width: 30,
                        display: 'grid',
                        placeContent: 'center',
                        border: '1px solid black',
                        background: 'rgba(20, 20, 20, 1)',
                        borderRadius: 10
                    }} >
                </div>

                {/* canvas area */}
                <div
                    ref={canvasAreaRef}
                    style={{ gridRow: '2', gridColumn: '3', }}>
                    <CanvasArea onActivate={setActiveThumbnail} />
                </div>

                {/* media browser */}
                {showMediaBrowser &&
                    <>
                        <div
                            style={{
                                gridRow: '2', gridColumn: '4',
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
                                    setBrowserThumbnail({ ...m });
                                    if (appState.tool && appState.tool.type == 'drop') {
                                        const newTool: LaurusTool = { ...appState.tool, value: { ...m } };
                                        dispatch({ type: WorkspaceActionType.SetTool, value: newTool });
                                    }
                                }}
                                onFilterSelect={setMediaBrowserFilter}
                            />
                        </div>
                    </>}

                {/* right panel */}
                <div
                    onClick={() => { setShowMediaBrowser(v => !v); }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    style={{
                        gridRow: '2', gridColumn: '5',
                        display: "grid",
                        borderLeft: '6px solid black',
                        background: 'linear-gradient(45deg, rgb(11, 11, 11), rgb(19, 19, 19))',
                        width: 50,
                    }}>
                </div>

                <div style={{ gridRow: '3', gridColumn: 'span 5' }}>
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
                            {activeThumbnail && (() => {
                                switch (activeThumbnail.type) {
                                    case "svg": {
                                        return (
                                            <ReactSvg
                                                svg={activeThumbnail.value as EncodedSvg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={activeThumbnail.value as EncodedImg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>
                        <div
                            style={{
                                borderLeft: '1px solid rgb(0, 0, 0)',
                                position: 'relative'
                            }}>
                            {browserThumbnail && (() => {
                                switch (browserThumbnail.type) {
                                    case "svg": {
                                        return (
                                            <ReactSvg
                                                svg={browserThumbnail.value as EncodedSvg}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={browserThumbnail.value as EncodedImg}
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

interface CanvasAreaProps {
    onActivate: (media: LaurusThumbnail) => void,
}
function CanvasArea({ onActivate }: CanvasAreaProps) {
    const [rulerSize] = useState(20);
    const { appState, dispatch } = useContext(WorkspaceContext);

    return (<>
        <div
            style={{
                overflowY: 'auto',
                position: 'relative',
                width: "100%",
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'min-content 1fr',
                gridTemplateRows: `min-content 1fr`,
            }}>

            {/* canvas area */}
            <div style={{ gridRow: '2', gridColumn: '2', }}>
                <div
                    className={styles["tiled-background-squares"]}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: appState.project.canvas_width,
                        height: appState.project.canvas_height,
                        zIndex: 0,
                    }} />
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 'min-content',
                        height: 'min-content',
                        zIndex: appState.tool && appState.tool.type == 'drop' ? 2 : 1,

                    }}>
                    <Canvas />
                </div>

                {/* paper */}
                {appState.project && <div
                    style={{
                        position: 'absolute',
                        top: appState.project.frame_top,
                        left: appState.project.frame_left,
                        width: appState.project.frame_width,
                        height: appState.project.frame_height,
                        overflow: 'hidden',
                        backgroundImage: 'linear-gradient(45deg, rgb(7, 7, 7), rgb(20, 20, 20))',
                        boxShadow: "8px 8px 20px rgba(0, 0, 0, 0.7)",
                        border: "1px solid black",
                        borderRadius: 2,
                        zIndex: appState.tool && appState.tool.type == 'drop' ? 1 : 0,
                    }} />}

                {/* media overlays */}
                {Array.from(appState.project.imgs.entries().filter(e => !e[1].pending)).map((e) => {
                    const [key, imgMeta] = e;
                    const imgData = appState.downloadedImgs.find(i => i.media_path == imgMeta.media_path);
                    if (imgData) {
                        return (
                            <div
                                onClick={(event) => {
                                    // option key on mac
                                    if (event.altKey) {
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
                                    zIndex={3}
                                    onNewPosition={async function (newPosition: { x: number; y: number; }) {
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
                                    }} />

                            </div>
                        );
                    }
                })}
                {Array.from(appState.project.svgs.entries().filter(e => !e[1].pending)).map((e) => {
                    const [key, svgMeta] = e;
                    const svgData = appState.downloadedSvgs.find(s => s.media_path == svgMeta.media_path);
                    if (svgData) {
                        return (
                            <div
                                onClick={(event) => {
                                    // option key on mac
                                    if (event.altKey) {
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
                                    zIndex={3}
                                    onNewPosition={async function (newPosition: { x: number; y: number; }) {
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
                                    }} />
                            </div>
                        );
                    }
                })}
                {Array.from(appState.project.imgs.entries().filter(e => e[1].pending)).map((e) => {
                    const [key, imgMeta] = e;
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
                                    top: imgMeta.top,
                                    left: imgMeta.left,
                                    zIndex: 3,
                                }}
                                onClick={(event) => {
                                    // option key on mac
                                    if (event.altKey) {
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
                                                onActivate({ type: 'img', value: { ...imgData } });
                                                const newImg: LaurusImg = { ...imgMeta, pending: false };
                                                dispatch({ type: WorkspaceActionType.SetProjectImg, key, value: newImg });
                                                const newActiveElement: LaurusActiveElement = { key, value: { type: 'img', value: { ...imgData } } };
                                                dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                            }}>
                                            <ReactSvg
                                                svg={motionPhotosOn('rgb(227, 227, 227)')}
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
                                    top: svgMeta.top,
                                    left: svgMeta.left,
                                    zIndex: 3,
                                }}
                                onClick={(event) => {
                                    // option key on mac
                                    if (event.altKey) {
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
                                                onActivate({ type: 'svg', value: { ...svgData } });
                                                const newSvg: LaurusSvg = { ...svgMeta, pending: false }
                                                dispatch({ type: WorkspaceActionType.SetProjectSvg, key, value: newSvg });
                                                const newActiveElement: LaurusActiveElement = { key, value: { type: 'svg', value: { ...svgData } } };
                                                dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                            }}>
                                            <ReactSvg
                                                svg={motionPhotosOn('rgb(227, 227, 227)')}
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

                {/* ruler intersection */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 3, gridRow: '1', gridColumn: '1',
                    width: rulerSize, height: rulerSize,
                    backgroundImage: 'linear-gradient(45deg, rgb(36, 36, 36), rgb(39, 39, 39))',
                    display: 'grid',
                    border: '1px solid black',
                    placeItems: 'center',
                }} >
                </div>
                {/* tall ruler */}
                <div
                    style={{
                        position: 'absolute',
                        top: rulerSize,
                        left: 0,
                        zIndex: 3,
                        gridRow: '2', gridColumn: '1',
                        width: rulerSize,
                        height: appState.project.canvas_height - rulerSize,
                        display: 'grid',
                        backgroundImage: 'linear-gradient(45deg, rgb(7, 7, 7), rgb(10, 10, 10))',
                    }} />
                {/* wide ruler */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: rulerSize,
                        zIndex: 3,
                        gridRow: '1', gridColumn: '2',
                        height: rulerSize,
                        width: appState.project.canvas_width - rulerSize,
                        display: 'grid',
                        backgroundImage: 'linear-gradient(45deg, rgb(7, 7, 7), rgb(10, 10, 10))',
                    }} />
            </div>
        </div >
    </>)
}
