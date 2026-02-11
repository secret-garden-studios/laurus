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
    ProjectSvg_V1_0
} from "./workspace.server";
import Menubar from "../menubar";
import Statusbar from "../statusbar";
import Canvas from "./canvas";
import MediaBrowserArea from "./media-browser";
import { videoCameraBack } from "../svg-repo";
import { redHatDisplay } from "../fonts";
import { DraggableReactImg, DraggableReactSvg, ReactImg, ReactSvg } from "./media";

export type LaurusProject = ProjectResult_V1_0;
export type EncodedImg = EncodedImg_V1_0;
export type EncodedSvg = EncodedSvg_V1_0;
export type LaurusImg = ProjectImg_V1_0;
export type LaurusSvg = ProjectSvg_V1_0;
export type LaurusThumbnail =
    | { type: 'svg', media: EncodedSvg }
    | { type: 'img', media: EncodedImg }
export type LaurusTool =
    | { type: 'drop', value: LaurusThumbnail | undefined }
    | { type: 'delete' }

/**
 * if state is nested by three or more virtual DOM layers, it belongs in here.
 */
export interface WorkspaceState {
    project: LaurusProject,

    downloadedImgs: EncodedImg[],
    downloadedSvgs: EncodedSvg[],

    tool: LaurusTool | undefined,

    pendingImgs: Map<string, ProjectImg_V1_0>
    pendingSvgs: Map<string, ProjectSvg_V1_0>
}

export const defaultWorkspace: WorkspaceState = {
    project: {
        name: "[untitled]",
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
    },
    tool: { type: 'drop', value: undefined },
    downloadedImgs: [],
    downloadedSvgs: [],
    pendingImgs: new Map(),
    pendingSvgs: new Map()
}


export enum WorkspaceActionType {
    SetWorkspace,
    SetProject,
    AddDownloadedImg,
    AddDownloadedSvg,
    SetTool,

    SetProjectImg,
    SetProjectSvg,
    DeleteProjectImg,
    DeleteProjectSvg,

    SetPendingImg,
    SetPendingSvg,
    DeletePendingImg,
    DeletePendingSvg,
}

export type WorkspaceAction =
    | { type: WorkspaceActionType.SetWorkspace, value: WorkspaceState }
    | { type: WorkspaceActionType.SetProject, value: LaurusProject }

    | { type: WorkspaceActionType.AddDownloadedImg, value: EncodedImg }
    | { type: WorkspaceActionType.AddDownloadedSvg, value: EncodedSvg }

    | { type: WorkspaceActionType.SetTool, value: LaurusTool | undefined }

    | { type: WorkspaceActionType.SetProjectImg, value: LaurusImg }
    | { type: WorkspaceActionType.SetProjectSvg, value: LaurusSvg }
    | { type: WorkspaceActionType.DeleteProjectImg, key: string }
    | { type: WorkspaceActionType.DeleteProjectSvg, key: string }

    | { type: WorkspaceActionType.SetPendingImg, value: LaurusImg }
    | { type: WorkspaceActionType.SetPendingSvg, value: LaurusSvg }
    | { type: WorkspaceActionType.DeletePendingImg, key: string }
    | { type: WorkspaceActionType.DeletePendingSvg, key: string }

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
        case WorkspaceActionType.SetProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.set(action.value.key, action.value);
            const newProject: LaurusProject = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.SetProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.set(action.value.key, action.value);
            const newProject: LaurusProject = { ...state.project, svgs: newSvgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.DeleteProjectImg: {
            const newImgs = new Map(state.project.imgs);
            newImgs.delete(action.key);
            const newProject: LaurusProject = { ...state.project, imgs: newImgs }
            return { ...state, project: newProject }
        }
        case WorkspaceActionType.DeleteProjectSvg: {
            const newSvgs = new Map(state.project.svgs);
            newSvgs.delete(action.key);
            const newProject: LaurusProject = { ...state.project, svgs: newSvgs }
            return { ...state, project: newProject }
        }

        case WorkspaceActionType.SetPendingImg: {
            const newImgs = new Map(state.pendingImgs);
            newImgs.set(action.value.key, action.value);
            return { ...state, pendingImgs: newImgs }
        }
        case WorkspaceActionType.SetPendingSvg: {
            const newSvgs = new Map(state.pendingSvgs);
            newSvgs.set(action.value.key, action.value);
            return { ...state, pendingSvgs: newSvgs }
        }
        case WorkspaceActionType.DeletePendingImg: {
            const newImgs = new Map(state.pendingImgs);
            newImgs.delete(action.key);
            return { ...state, pendingImgs: newImgs }
        }
        case WorkspaceActionType.DeletePendingSvg: {
            const newSvgs = new Map(state.pendingSvgs);
            newSvgs.delete(action.key);
            return { ...state, pendingSvgs: newSvgs }
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
    p: ProjectResult_V1_0[] | undefined,
}

function initReducer(
    {
        p,
    }: InitReducerProps): WorkspaceState {

    const projectInit = ((): LaurusProject => {
        if (p && p.length > 0) {
            const sortedProjects = p.sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
            const mostRecent: LaurusProject = { ...sortedProjects[0] };
            return mostRecent;
        }
        else {
            return defaultWorkspace.project;
        }
    })();

    return {
        project: projectInit,
        downloadedImgs: defaultWorkspace.downloadedImgs,
        downloadedSvgs: defaultWorkspace.downloadedSvgs,
        tool: defaultWorkspace.tool,
        pendingImgs: new Map(),
        pendingSvgs: new Map(),
    };
}

interface WorkspaceProps {
    projectsInit: Promise<ProjectResult_V1_0[] | undefined>,
    mediaBrowserPageSize: number,
    imgsInit: Promise<ImgMetadataPage_V1_0[] | undefined>,
    svgsInit: Promise<SvgMetadataPage_V1_0[] | undefined>,
}

export default function Workspace({
    projectsInit,
    mediaBrowserPageSize,
    imgsInit,
    svgsInit,
}: WorkspaceProps) {
    const p = use(projectsInit);
    const mImg = use(imgsInit);
    const mSvg = use(svgsInit);

    const [appState, dispatch] = useReducer(
        workspaceContextReducer,
        {
            p,
        },
        initReducer);

    const [activeThumbnail] = useState<LaurusThumbnail | undefined>(
        {
            media: { ...videoCameraBack('rgba(255, 255, 255, 0.15)', 32, 32) },
            type: 'svg'
        });
    const [browserThumbnail, setBrowserThumbnail] = useState<LaurusThumbnail | undefined>(undefined);

    const canvasAreaRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const initCurrentPaper = (async () => {
            if (canvasAreaRef.current && appState.project &&
                (appState.project.frame_top < 0 || appState.project.frame_left < 0)) {
                const centerX = canvasAreaRef.current.clientWidth / 2;
                const centerY = canvasAreaRef.current.clientHeight / 2;
                const left = centerX - (appState.project.frame_width / 2);
                const top = centerY - (appState.project.frame_height / 2);
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
    const [showTimeline] = useState<boolean>(false);
    const [mediaBrowserFilter, setMediaBrowserFilter] = useState<'img' | 'svg'>('img');
    const [imgPageIndex, setImgPageIndex] = useState(0);
    const [svgPageIndex, setSvgPageIndex] = useState(0);
    const nextPageRef = useRef<HTMLDivElement | null>(null);

    const handleImgPageRequest = useCallback(async (pageIndex: number) => {
        if (nextPageRef.current) {
            nextPageRef.current.style.visibility = 'hidden'
        }
        const response: ImgMetadataPage_V1_0[] | undefined =
            await enumerateImgs(mediaBrowserPageSize, undefined, pageIndex + 1);
        if (response && pageIndex < response.length) {
            const requestedPage: ImgMetadataPage_V1_0 = response[pageIndex];
            const encodings = await getImgsByPage(requestedPage);
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
    }, [appState.downloadedImgs, mediaBrowserPageSize]);

    const handleSvgPageRequest = useCallback(async (pageIndex: number) => {
        if (nextPageRef.current) {
            nextPageRef.current.style.visibility = 'hidden'
        }
        const response: SvgMetadataPage_V1_0[] | undefined =
            await enumerateSvgs(mediaBrowserPageSize, undefined, pageIndex + 1);
        if (response && pageIndex < response.length) {
            const requestedPage: SvgMetadataPage_V1_0 = response[pageIndex];
            const encodings = await getSvgsByPage(requestedPage);
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
    }, [appState.downloadedSvgs, mediaBrowserPageSize]);

    /**
     * background media download for optimization
     */
    useEffect(() => {
        const initDownloadRetryLimit = 5;
        const downloadImgsFromMetas = async () => {
            if (mImg && mImg.length > 0) {
                for (let i = 0; i < mImg.length; i++) {
                    const response = await getImgsByPage(mImg[i]);
                    for (let i = 0; i < response.length; i++) {
                        const newEncoding = response[i];
                        if (i == 0) {
                            const newThumnail: LaurusThumbnail = { media: { ...newEncoding }, type: 'img' }
                            setBrowserThumbnail(newThumnail);
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop', value: { ...newThumnail } } });
                        }
                        dispatch({ type: WorkspaceActionType.AddDownloadedImg, value: { ...newEncoding } })
                    }
                }
                const newPageIndex = mImg[mImg.length - 1].page_number - 1;
                setImgPageIndex(newPageIndex);
            }
            else {
                const response = await enumerateImgs(
                    mediaBrowserPageSize,
                    initDownloadRetryLimit,
                    undefined);
                if (response && response.length > 0) {
                    for (let i = 0; i < response.length; i++) {
                        const response2 = await getImgsByPage(response[i]);
                        for (let i = 0; i < response2.length; i++) {
                            const newEncoding = response2[i];
                            if (i == 0) {
                                const newThumnail: LaurusThumbnail = { media: { ...newEncoding }, type: 'img' }
                                setBrowserThumbnail(newThumnail);
                                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop', value: { ...newThumnail } } });
                            }
                            dispatch({ type: WorkspaceActionType.AddDownloadedImg, value: { ...newEncoding } })
                        }
                    }
                    const newPageIndex = response[response.length - 1].page_number - 1;
                    setImgPageIndex(newPageIndex);
                }
                else {
                    console.log('failed to find initial images');
                }
            }
        };

        const downloadSvgsFromMetas = async () => {
            if (mSvg && mSvg.length > 0) {
                for (let i = 0; i < mSvg.length; i++) {
                    const response = await getSvgsByPage(mSvg[i]);
                    for (let i = 0; i < response.length; i++) {
                        const newEncoding = response[i];
                        dispatch({ type: WorkspaceActionType.AddDownloadedSvg, value: { ...newEncoding } });
                    }
                }
                const newPageIndex = mSvg[mSvg.length - 1].page_number - 1;
                setSvgPageIndex(newPageIndex);
            }
            else {
                const response = await enumerateSvgs(
                    mediaBrowserPageSize,
                    initDownloadRetryLimit,
                    undefined);
                if (response && response.length > 0) {
                    for (let i = 0; i < response.length; i++) {
                        const response2 = await getSvgsByPage(response[i]);
                        for (let i = 0; i < response2.length; i++) {
                            const newEncoding = response2[i];
                            dispatch({ type: WorkspaceActionType.AddDownloadedSvg, value: { ...newEncoding } })
                        }
                    }
                    const newPageIndex = response[response.length - 1].page_number - 1;
                    setSvgPageIndex(newPageIndex);
                }
                else {
                    console.log('failed to find initial svgs');
                }
            }
        };

        downloadImgsFromMetas();
        downloadSvgsFromMetas();
    }, [mediaBrowserPageSize, mImg, mSvg]);

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
                    {/*projectbar*/}
                    {showTimeline && <div
                        className={styles["grainy-background"]}
                        style={{
                            height: 36,
                            width: "100%",
                            display: "flex",
                            justifyContent: 'start',
                            alignItems: "center",
                            border: '1px solid black',
                        }}>
                        <div
                            className={redHatDisplay.className}
                            style={{
                                fontSize: 14,
                                letterSpacing: 1,
                                width: 1000,
                                display: 'grid',
                                placeContent: 'center',
                                height: '100%',
                                borderRight: true ? '1px solid rgb(0, 0, 0)' : '1px solid rgb(37, 37, 37)',
                                borderRadius: 0,
                                color: true ? 'rgb(237, 237, 237)' : 'rgb(94, 94, 94)',

                            }}>
                            {appState.project.imgs.size > 0 && appState.project.name}
                        </div>
                    </div>}
                </div>

                <div style={{ gridRow: '2', gridColumn: '1', overflowY: 'auto', }}>
                    {showTimeline &&
                        <TimelineArea
                            size={{ width: 1000, height: 5000 }} />}
                </div>

                {/* left bumper */}
                <div
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
                    <CanvasArea />
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
                <div style={{
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
                                                svg={activeThumbnail.media as EncodedSvg_V1_0}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={activeThumbnail.media as EncodedImg_V1_0}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>

                        <div
                            onClick={() => { setShowMediaBrowser(v => !v); }}
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            style={{
                                borderLeft: '1px solid rgb(0, 0, 0)',
                                position: 'relative'
                            }}>
                            {browserThumbnail && (() => {
                                switch (browserThumbnail.type) {
                                    case "svg": {
                                        return (
                                            <ReactSvg
                                                svg={browserThumbnail.media as EncodedSvg_V1_0}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                                scale={undefined}
                                            />
                                        )
                                    }
                                    case "img": {
                                        return (
                                            <ReactImg
                                                img={browserThumbnail.media as EncodedImg_V1_0}
                                                containerSize={{ width: mediabarHeight - 2, height: mediabarHeight - 2 }}
                                            />
                                        )
                                    }
                                }
                            })()}
                        </div>
                    </div>
                    <Statusbar
                        zIndex={0}
                        action={'statusAction'}
                        body={[]}
                        counter={0} />
                </div>
            </WorkspaceContext>
        </div>
    </>)
}

function CanvasArea() {
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
                {Array.from(appState.project.imgs.values()).map((imgMeta) => {
                    const imgData = appState.downloadedImgs.find(i => i.media_path == imgMeta.media_path);
                    if (imgData) {
                        return (
                            <div key={imgMeta.key}>
                                <DraggableReactImg
                                    contextId={`dnd-context-${imgMeta.key}`}
                                    nodeId={`dnd-node-${imgMeta.key}`}
                                    data={imgData}
                                    meta={imgMeta}
                                    zIndex={3}
                                    onNewPosition={function (newPosition: { x: number; y: number; }): void {
                                        const newImg: LaurusImg = { ...imgMeta, top: newPosition.y, left: newPosition.x };
                                        dispatch({ type: WorkspaceActionType.SetProjectImg, value: newImg });
                                    }} />

                            </div>
                        );
                    }
                })}
                {Array.from(appState.project.svgs.values()).map((svgMeta) => {
                    const svgData = appState.downloadedSvgs.find(i => i.media_path == svgMeta.media_path);
                    if (svgData) {
                        return (
                            <div key={svgMeta.key}>
                                <DraggableReactSvg
                                    contextId={`dnd-context-${svgMeta.key}`}
                                    nodeId={`dnd-node-${svgMeta.key}`}
                                    data={svgData}
                                    meta={svgMeta}
                                    zIndex={3}
                                    onNewPosition={function (newPosition: { x: number; y: number; }): void {
                                        const newSvg: LaurusSvg = { ...svgMeta, top: newPosition.y, left: newPosition.x };
                                        dispatch({ type: WorkspaceActionType.SetProjectSvg, value: newSvg });
                                    }} />

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

interface TimelineArea {
    size: { width: number, height: number },
}

function TimelineArea({
    size,
}: TimelineArea) {
    const [rulerSize] = useState(20);
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
                    height: size.height - rulerSize,
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
                    width: size.width - rulerSize,
                    display: 'grid',
                    backgroundImage: 'linear-gradient(45deg, rgb(7, 7, 7), rgb(10, 10, 10))',
                }} />
            {/* content area */}
            <div style={{
                gridRow: '2', gridColumn: '2',
                width: size.width,
                height: size.height,
            }}>
                <div
                    className={styles["grainy-background"]}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: size.width,
                        height: size.height,
                        zIndex: 0,
                    }} />

            </div>
        </div>
    </>)
}

