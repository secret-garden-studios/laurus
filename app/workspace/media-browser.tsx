import { useContext, useRef, useState, DragEvent, useCallback, useMemo, useEffect } from "react";
import { dellaRespira } from "../fonts";
import { DEFAULT_CONTEXT_MENU_CONFIG, defaultWorkspace, LaurusImgResult, LaurusSvgResult, LaurusThumbnail, LaurusTool, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import NextImage from "next/image";
import styles from "../app.module.css";
import { bookmarkStacks, LaurusCropSvg, publicIcon, SvgRepo, timerArrowDown } from "../svg-repo";
import { createImg, createSvg } from "./workspace.server";
import { getCropSize, HIGH_FACTOR, MIDHIGH_FACTOR, MIDLOW_FACTOR } from "./workspace-resolution";
import { updateProject, createProject } from "../projects/projects.server";
import { LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "../projects/projects.client";
import { v4 as getUuidV4 } from "uuid";
import { BrowserContextMenu } from "./context-menu";
import Toggle from "../components/toggle";

export type MediaBrowserFilter = 'img' | 'svg' | 'frame';

function dataUrlToFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
}

async function rasterizeSvg(
    svgXml: string,
    width: number = 1120,
    height: number = 1120
): Promise<string> {
    return new Promise((resolve, reject) => {
        const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const pngDataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            resolve(pngDataUrl);
        };

        img.onerror = (err) => {
            console.log({ err });
            reject(err)
        };
        img.src = url;
    });
}

interface MediaBrowser {
    filter: MediaBrowserFilter,
    onNextPage: () => void,
    onPrevPage?: () => void,
    onFilterSelect: (filter: MediaBrowserFilter) => void,
}
export default function MediaBrowser({
    filter,
    onNextPage,
    onFilterSelect,
}: MediaBrowser) {
    const { appState, dispatch, isMetaKeyPressed } = useContext(WorkspaceContext);
    const [uploading, setUploading] = useState(false);
    const [sortStrategy, setSortStrategy] = useState<'timestamp' | 'order' | 'none'>('none');
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                mediaFilterSize: {
                    container: 50,
                    letterSpacing: "3px",
                    fontSize: 14
                },
                mediaItemSize: {
                    container: 300,
                    svg: 100,
                    padding: '0px 0px 20px 0px',
                    marginTop: 28
                },
                mediaSortSize: {
                    container: 36,
                    svg: 20,
                },
                frameScales: {
                    high: 1.6,
                    midhigh: 1.1,
                    midlow: 0.6
                },
                switch: {
                    container: {
                        left: 10,
                        gap: 10,
                        fontSize: 13,
                        letterSpacing: 1,
                    },
                    track: {
                        width: 30,
                        height: 16,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 10,
                        height: 10,
                    }
                },
                uploadingLight: {
                    container: {
                        top: 10,
                        left: 0
                    },
                    dot: {
                        top: 0,
                        right: 6,
                        width: 10,
                        height: 10,
                    }
                }
            }
            case "midhigh": return {
                mediaFilterSize: {
                    container: 40,
                    letterSpacing: "2px",
                    fontSize: 11
                },
                mediaItemSize: {
                    container: 230,
                    svg: 72,
                    padding: '0px 0px 14px 0px',
                    marginTop: 28
                },
                mediaSortSize: {
                    container: 25,
                    svg: 14,
                },
                frameScales: {
                    high: 1.12,
                    midhigh: 0.77,
                    midlow: 0.42
                },
                switch: {
                    container: {
                        left: 10,
                        gap: 10,
                        fontSize: 10,
                        letterSpacing: 1,
                    },
                    track: {
                        width: 28,
                        height: 14,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    }
                },
                uploadingLight: {
                    container: {
                        top: 10,
                        left: 0
                    },
                    dot: {
                        top: 0,
                        right: 8,
                        width: 10,
                        height: 10,
                    }
                }
            }
            case "midlow":
            case "low": return {
                mediaFilterSize: {
                    container: 38,
                    letterSpacing: "2px",
                    fontSize: 11
                },
                mediaItemSize: {
                    container: 180,
                    svg: 50,
                    padding: '0px 0px 10px 0px',
                    marginTop: 28
                },
                mediaSortSize: {
                    container: 18,
                    svg: 10,
                },
                frameScales: {
                    high: 0.8,
                    midhigh: 0.55,
                    midlow: 0.3
                },
                switch: {
                    container: {
                        left: 10,
                        gap: 10,
                        fontSize: 10,
                        letterSpacing: 1,
                    },
                    track: {
                        width: 28,
                        height: 14,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    }
                },
                uploadingLight: {
                    container: {
                        top: 10,
                        left: 0
                    },
                    dot: {
                        top: 0,
                        right: 8,
                        width: 10,
                        height: 10,
                    }
                }
            }
        }
    });

    const lastScrollTop = useRef<number>(0);

    const handleImgDrop = useCallback(async (imgMediaResult: LaurusImgResult) => {
        const newKey = getUuidV4();
        const projectImg: LaurusProjectImg = {
            width: imgMediaResult.width,
            height: imgMediaResult.height,
            media_key: imgMediaResult.media_key,
            showContextMenu: false,
            img_media_id: imgMediaResult.img_media_id,
            top: -1,
            left: -1,
            order: Array.from(appState.project.imgs.values()).reduce((max, i) => Math.max(max, i.order), -1) + 1,
            rotate_x: 0,
            rotate_y: 0,
            rotate_z: 0,
            rotate_angle: 0,
            scale_x: 1,
            scale_y: 1,
            contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
        };
        const newImgs: Map<string, LaurusProjectImg> = new Map(appState.project.imgs);
        newImgs.set(newKey, projectImg);
        const rollback: LaurusProjectResult = { ...appState.project }
        const newProject: LaurusProjectResult = { ...rollback, imgs: newImgs }
        if (appState.project.project_id) {
            const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (projectUpdated) {
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { type: 'img', value: { ...imgMediaResult } } });
            }
            else {
                dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
            }
        }
        else {
            const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
            if (projectCreated) {
                const newProject2: LaurusProjectResult = { ...projectCreated, imgs: newImgs }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { type: 'img', value: { ...imgMediaResult } } });
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch]);

    const handleSvgDrop = useCallback(async (imgMediaResult: LaurusSvgResult) => {
        const newKey = getUuidV4();
        const projectSvg: LaurusProjectSvg = {
            width: imgMediaResult.width,
            height: imgMediaResult.height,
            media_key: imgMediaResult.media_key,
            showContextMenu: false,
            svg_media_id: imgMediaResult.svg_media_id,
            top: -1,
            left: -1,
            order: Array.from(appState.project.svgs.values()).reduce((max, s) => Math.max(max, s.order), -1) + 1,
            rotate_x: 0,
            rotate_y: 0,
            rotate_z: 0,
            rotate_angle: 0,
            scale_x: 1,
            scale_y: 1,
            viewbox: imgMediaResult.viewbox,
            stroke: imgMediaResult.stroke,
            stroke_width: imgMediaResult.stroke_width,
            fill: imgMediaResult.fill,
            contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
        };
        const newSvgs: Map<string, LaurusProjectSvg> = new Map(appState.project.svgs);
        newSvgs.set(newKey, projectSvg);
        const rollback: LaurusProjectResult = { ...appState.project }
        const newProject: LaurusProjectResult = { ...rollback, svgs: newSvgs }
        if (appState.project.project_id) {
            const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (projectUpdated) {
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { type: 'svg', value: { ...imgMediaResult } } });
            }
            else {
                dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
            }
        }
        else {
            const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
            if (projectCreated) {
                const newProject2: LaurusProjectResult = { ...projectCreated, svgs: newSvgs }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { type: 'svg', value: { ...imgMediaResult } } });
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch]);

    const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const MAX_DIMENSION = 4096;
        const files = Array.from(event.dataTransfer.files);
        const expectedSvgUploads = files.filter(f => f.type == "image/svg+xml").length;
        const expectedImgUploads = files.filter(f => f.type.startsWith("image/") && f.type != "image/svg+xml").length;
        let actualSvgUploads = 0;
        let actualImgUploads = 0;
        setSortStrategy('none');
        setUploading(true);
        for (const file of files) {
            if (file.type === "image/svg+xml") {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const svgString = e.target?.result;
                    if (typeof svgString !== "string") { setUploading(false); return };
                    try {
                        const parser = new DOMParser();
                        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
                        const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;
                        let width = svgElement.viewBox.baseVal.width ||
                            parseFloat(svgElement.getAttribute('width') || '1120');
                        let height = svgElement.viewBox.baseVal.height ||
                            parseFloat(svgElement.getAttribute('height') || '1120');
                        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                            const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                            width = Math.round(width * scale);
                            height = Math.round(height * scale);
                        }
                        const pngDataUrl = await rasterizeSvg(svgString, width, height);
                        const svgFile: File = dataUrlToFile(pngDataUrl, `${file.name.split('.')[0]}.png`);
                        const created = await createSvg(appState.apiOrigin, { svg: file, raster: svgFile });
                        if (created) {
                            dispatch({ type: WorkspaceActionType.AddBrowserSvg, value: created, first: true });
                            if (appState.browserSvgs.findIndex(v => v.svg_media_id == created.svg_media_id) < 0) {
                                await handleSvgDrop(created);
                            }
                            if (++actualSvgUploads == expectedSvgUploads) {
                                setUploading(false);
                            }
                        }
                    } catch (err) {
                        setUploading(false);
                        console.error("svg upload error", err);
                    }
                };
                reader.readAsText(file);
            } else if (file.type.startsWith("image/")) {
                try {
                    const created = await createImg(appState.apiOrigin, file);
                    if (created) {
                        dispatch({ type: WorkspaceActionType.AddBrowserImg, value: { ...created }, first: true });
                        if (appState.browserImgs.findIndex(v => v.img_media_id == created.img_media_id) < 0) {
                            await handleImgDrop(created);
                        }
                        if (++actualImgUploads == expectedImgUploads) {
                            setUploading(false);
                        }
                    }
                }
                catch (err) {
                    setUploading(false);
                    console.error("img upload error", err);
                }
            }
        }
    }, [appState.apiOrigin, appState.browserImgs, appState.browserSvgs, dispatch, handleImgDrop, handleSvgDrop]);

    function sortByTimestamp(
        a: LaurusImgResult | LaurusSvgResult | LaurusCropSvg,
        b: LaurusImgResult | LaurusSvgResult | LaurusCropSvg) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }

    function sortByOrder(
        a: LaurusImgResult | LaurusSvgResult | LaurusCropSvg,
        b: LaurusImgResult | LaurusSvgResult | LaurusCropSvg) {
        return a.order - b.order;
    }

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isScrollingDown = scrollTop > lastScrollTop.current;
        lastScrollTop.current = scrollTop;
        if (!isScrollingDown) return;
        const isBottom = Math.abs(scrollHeight - (scrollTop + clientHeight)) <= 1;
        if (isBottom) {
            onNextPage();
        }
    }, [onNextPage]);

    const onMediaClick = useCallback((selectedMedia: LaurusThumbnail) => {
        dispatch({ type: WorkspaceActionType.SetBrowserElement, value: { ...selectedMedia } });
        const currentTool = { ...appState.tool };
        const newTool: LaurusTool = currentTool.type == 'drop' ? currentTool : {
            type: 'drop',
            stack: false,
            size: { value: false, width: undefined, height: undefined },
            position: { value: false, x: undefined, y: undefined }
        };
        dispatch({
            type: WorkspaceActionType.SetTool,
            value: newTool,
        })
    }, [appState.tool, dispatch]);

    const onImgDiscoverToggle = useCallback(async () => {
        let newProjectIdAck = "";
        const newBrowsePublicImgs = !appState.project.browse_public_imgs;
        const newProject: LaurusProjectResult = { ...appState.project, browse_public_imgs: newBrowsePublicImgs }
        if (!appState.project.project_id) {
            const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
            if (projectCreated) {
                newProjectIdAck = projectCreated.project_id;
                const newProject2: LaurusProjectResult = { ...newProject, project_id: newProjectIdAck }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
            }
        }
        else {
            const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (projectUpdated) {
                newProjectIdAck = newProject.project_id;
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            }
        }
        if (!newBrowsePublicImgs && newProjectIdAck) {
            const newBrowserImgs = appState.browserImgs
                .filter(b => Array.from(newProject.imgs.values())
                    .flatMap(v => v.img_media_id)
                    .includes(b.img_media_id));
            dispatch({ type: WorkspaceActionType.SetBrowserImgs, value: newBrowserImgs });
            dispatch({
                type: WorkspaceActionType.SetBrowserElement,
                value: defaultWorkspace.browserElement == undefined ? undefined : { ...defaultWorkspace.browserElement }
            });
        }
    }, [appState.accessToken, appState.apiOrigin, appState.browserImgs, appState.project, dispatch]);

    const onSvgDiscoverToggle = useCallback(async () => {
        let newProjectIdAck = "";
        const newBrowsePublicSvgs = !appState.project.browse_public_svgs;
        const newProject: LaurusProjectResult = { ...appState.project, browse_public_svgs: newBrowsePublicSvgs }
        if (!appState.project.project_id) {
            const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
            if (projectCreated) {
                newProjectIdAck = projectCreated.project_id;
                const newProject2: LaurusProjectResult = { ...newProject, project_id: newProjectIdAck }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
            }
        }
        else {
            const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (projectUpdated) {
                newProjectIdAck = newProject.project_id;
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            }
        }
        if (!newBrowsePublicSvgs && newProjectIdAck) {
            const newBrowserSvgs = appState.browserSvgs
                .filter(b => Array.from(newProject.svgs.values())
                    .flatMap(v => v.svg_media_id)
                    .includes(b.svg_media_id));
            dispatch({ type: WorkspaceActionType.SetBrowserSvgs, value: newBrowserSvgs });
            dispatch({
                type: WorkspaceActionType.SetBrowserElement,
                value: defaultWorkspace.browserElement == undefined ? undefined : { ...defaultWorkspace.browserElement }
            });
        }
    }, [appState.accessToken, appState.apiOrigin, appState.browserSvgs, appState.project, dispatch]);

    const browserElementMediaId = useMemo(() => {
        if (!appState.browserElement) return "";
        switch (appState.browserElement.type) {
            case "img": {
                return appState.browserElement.value.img_media_id;
            }
            case "svg": {
                return appState.browserElement.value.svg_media_id;
            }
        }
    }, [appState.browserElement]);

    const [showContextMenu, setShowContextMenu] = useState(false);

    const calculateSquareDisplay = useCallback((width: number, height: number) => {
        const containerSize = dynamicSizes.mediaItemSize.container;
        const aspectRatio = width / height;
        const isSquareish = aspectRatio >= 0.9 && aspectRatio <= 1.1;
        let displayWidth, displayHeight;
        if (isSquareish) {
            displayWidth = containerSize;
            displayHeight = containerSize;
        } else {
            const targetSize = containerSize * 1.33;
            const scale = Math.max(targetSize / width, targetSize / height);
            displayWidth = Math.round(width * scale);
            displayHeight = Math.round(height * scale);
        }
        return { isSquareish, displayWidth, displayHeight }
    }, [dynamicSizes.mediaItemSize.container])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowContextMenu(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (<>
        <div style={{ display: 'grid', gridTemplateRows: 'min-content auto min-content', height: '100%' }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onDrop={handleDrop} >
            <div style={{
                gridRow: 1,
                display: 'flex',
                alignItems: 'center',
                height: dynamicSizes.mediaFilterSize.container,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: "rgb(15, 15, 15)",
            }}>
                <MediaBrowserTab
                    label={'img'}
                    letterSpacing={dynamicSizes.mediaFilterSize.letterSpacing}
                    fontSize={dynamicSizes.mediaFilterSize.fontSize}
                    onClick={() => onFilterSelect('img')}
                    selected={(filter == 'img')} />
                <MediaBrowserTab
                    label={'svg'}
                    letterSpacing={dynamicSizes.mediaFilterSize.letterSpacing}
                    fontSize={dynamicSizes.mediaFilterSize.fontSize}
                    onClick={() => onFilterSelect('svg')}
                    selected={(filter == 'svg')} />
                <MediaBrowserTab
                    label={'frame'}
                    letterSpacing={dynamicSizes.mediaFilterSize.letterSpacing}
                    fontSize={dynamicSizes.mediaFilterSize.fontSize}
                    onClick={() => onFilterSelect('frame')}
                    selected={(filter == 'frame')} />
            </div>
            <div className={styles[`${appState.resolution.type == 'high' ? 'noisy-background-23-2' : 'noisy-background-23-2-low-res'}`]}
                onScroll={handleScroll}
                style={{
                    gridRow: 2,
                    position: 'relative',
                    overflowY: 'auto',
                }} >
                {/* content area */}
                <div style={{
                    position: 'absolute',
                    display: 'grid',
                    alignContent: 'start',
                    gridTemplateColumns: 'min-content auto',
                    width: '100%',
                    color: 'rgba(220, 220, 220, 1)',
                    height: '100%',
                    paddingTop: Math.round(10 * appState.resolution.factor),
                    ...dynamicSizes.uploadingLight.container
                }} >
                    <div title={"light"}
                        style={{
                            position: 'absolute',
                            borderRadius: '50%',
                            border: uploading ? '1px solid rgb(239, 239, 239)' : '1px solid rgba(255, 255, 255, 0.03)',
                            background: uploading ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'rgba(255, 255, 255, 0.03)',
                            boxShadow: uploading ? 'rgba(255, 255, 255, 1) 0px 0px 100px 10px' : 'none',
                            ...dynamicSizes.uploadingLight.dot
                        }} />
                    {/* switches */}
                    {filter == 'img' && <>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            display: 'flex',
                            alignItems: 'center',
                            ...dynamicSizes.switch.container
                        }}>
                            <SvgRepo
                                title={"discover images"}
                                svg={appState.project.browse_public_imgs ? publicIcon() : publicIcon('rgba(227,227,227,0.7)')}
                                containerStyle={{
                                    width: dynamicSizes.switch.track.height * 1.33,
                                    height: dynamicSizes.switch.track.height * 1.33
                                }}
                                scale={1}
                                scaleToContaier={true} />
                            <Toggle
                                value={appState.project.browse_public_imgs}
                                onClick={onImgDiscoverToggle}
                                trackStyles={{ ...dynamicSizes.switch.track }}
                                buttonStyles={{ ...dynamicSizes.switch.button }} />
                        </div>
                    </>}
                    {filter == 'svg' && <>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            display: 'flex',
                            alignItems: 'center',
                            ...dynamicSizes.switch.container
                        }}>
                            <SvgRepo
                                title={"discover svgs"}
                                svg={appState.project.browse_public_svgs ? publicIcon() : publicIcon('rgba(227,227,227,0.7)')}
                                containerStyle={{
                                    width: dynamicSizes.switch.track.height * 1.33,
                                    height: dynamicSizes.switch.track.height * 1.33
                                }}
                                scale={1}
                                scaleToContaier={true} />
                            <Toggle
                                value={appState.project.browse_public_svgs}
                                onClick={onSvgDiscoverToggle}
                                trackStyles={{ ...dynamicSizes.switch.track }}
                                buttonStyles={{ ...dynamicSizes.switch.button }} />
                        </div>
                    </>}
                    {filter == 'frame' && <>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            display: 'flex',
                            alignItems: 'center',
                            ...dynamicSizes.switch.container
                        }}>
                            <div style={{
                                width: dynamicSizes.switch.track.height * 1.33,
                                height: dynamicSizes.switch.track.height * 1.33,
                                display: 'grid',
                                placeContent: 'center'
                            }}>
                                <div title={"light frame background"}
                                    style={{
                                        width: dynamicSizes.switch.track.height,
                                        height: dynamicSizes.switch.track.height,
                                        background: 'rgb(227,227,227)'
                                    }} />
                            </div>
                            <Toggle
                                value={appState.lightFrameBackground}
                                onClick={() => {
                                    dispatch({ type: WorkspaceActionType.SetLightFrameBackground, value: !appState.lightFrameBackground });
                                }}
                                trackStyles={{ ...dynamicSizes.switch.track }}
                                buttonStyles={{ ...dynamicSizes.switch.button }} />
                        </div>
                    </>}
                    {/* media thumbnails */}
                    {filter == 'img' && appState.browserImgs
                        .sort((a, b) => {
                            switch (sortStrategy) {
                                case 'order': {
                                    return sortByOrder(a, b);
                                }
                                case 'timestamp': {
                                    return sortByTimestamp(a, b)
                                }
                                case "none": {
                                    return 0;
                                }
                            }
                        })
                        .map((img, i) => {
                            const display = calculateSquareDisplay(img.width, img.height);
                            return (
                                <div key={i}
                                    style={{
                                        gridColumn: 2,
                                        padding: dynamicSizes.mediaItemSize.padding,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        marginTop: i == 0 ? dynamicSizes.mediaItemSize.marginTop : 0,
                                    }}>
                                    <div style={{
                                        width: dynamicSizes.mediaItemSize.container,
                                        height: dynamicSizes.mediaItemSize.container,
                                        position: 'relative',
                                    }} >
                                        {img.src &&
                                            <ScrollableImageContainer
                                                squarish={display.isSquareish}
                                                displayWidth={display.displayWidth}
                                                displayHeight={display.displayHeight}>
                                                <NextImage
                                                    onClick={(e) => {
                                                        if (e.metaKey && appState.tool.type !== 'viewport') {
                                                            let newShowContextMenu = false;
                                                            const thisIsNotSelected = !browserElementMediaId || (browserElementMediaId && browserElementMediaId != img.img_media_id);
                                                            if (thisIsNotSelected && showContextMenu) {
                                                                newShowContextMenu = true;
                                                            }
                                                            else {
                                                                newShowContextMenu = !showContextMenu;
                                                            }
                                                            setShowContextMenu(newShowContextMenu);
                                                            onMediaClick({ value: { ...img }, type: 'img' });
                                                        }
                                                        else {
                                                            if (showContextMenu) setShowContextMenu(false);
                                                            onMediaClick({ value: { ...img }, type: 'img' });
                                                        }
                                                    }}
                                                    draggable={false}
                                                    alt={img.media_key}
                                                    src={img.src}
                                                    width={display.displayWidth}
                                                    height={display.displayHeight}
                                                    style={{
                                                        display: 'block',
                                                        objectFit: display.isSquareish ? 'cover' : 'unset',
                                                        borderRadius: 10,
                                                    cursor: (isMetaKeyPressed && appState.tool.type !== 'viewport') ? 'context-menu' : 'pointer',
                                                    }} />
                                            </ScrollableImageContainer>}
                                        {(showContextMenu && browserElementMediaId == img.img_media_id) &&
                                            <BrowserContextMenu
                                                media={{ type: 'img', key: appState.project.imgs.entries().find(e => e[1].img_media_id == img.img_media_id)?.[0] ?? "", data: img }}
                                                position={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    bottom: 0,
                                                    top: 0,
                                                    left: 0,
                                                }} />
                                        }
                                    </ div>
                                </div>)
                        })}
                    {filter == 'svg' && appState.browserSvgs
                        .sort((a, b) => {
                            switch (sortStrategy) {
                                case 'order': {
                                    return sortByOrder(a, b);
                                }
                                case 'timestamp': {
                                    return sortByTimestamp(a, b)
                                }
                                case "none": {
                                    return 0;
                                }
                            }
                        })
                        .map((svg, i) => {
                            let decodedString = "";
                            try {
                                decodedString = decodeURIComponent(
                                    atob(svg.markup)
                                        .split('')
                                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                        .join(''));
                            }
                            catch (error) {
                                console.log("Failed to decodeURIComponent from svg markup", { error });
                            }
                            if (!decodedString) return;
                            return (
                                <div key={i}
                                    style={{
                                        gridColumn: 2,
                                        padding: dynamicSizes.mediaItemSize.padding,
                                        display: 'grid',
                                        alignItems: 'start',
                                        justifyContent: 'center',
                                        marginTop: i == 0 ? dynamicSizes.mediaItemSize.marginTop : 0,
                                    }}>
                                    <div style={{
                                        width: dynamicSizes.mediaItemSize.container,
                                        height: dynamicSizes.mediaItemSize.container,
                                        position: 'relative',
                                    }} >
                                        <div className={styles['transparent-checkerboard-background']}
                                            onClick={(e) => {
                                                if (e.metaKey && appState.tool.type !== 'viewport') {
                                                    let newShowContextMenu = false;
                                                    const thisIsNotSelected = !browserElementMediaId || (browserElementMediaId && browserElementMediaId != svg.svg_media_id);
                                                    if (thisIsNotSelected && showContextMenu) {
                                                        newShowContextMenu = true;
                                                    }
                                                    else {
                                                        newShowContextMenu = !showContextMenu;
                                                    }
                                                    setShowContextMenu(newShowContextMenu);
                                                    onMediaClick({ value: { ...svg }, type: 'svg' });
                                                }
                                                else {
                                                    if (showContextMenu) setShowContextMenu(false);
                                                    onMediaClick({ value: { ...svg }, type: 'svg' });
                                                }
                                            }}
                                            style={{
                                                width: dynamicSizes.mediaItemSize.container,
                                                height: dynamicSizes.mediaItemSize.container,
                                                position: 'relative',
                                                display: 'grid',
                                                placeContent: 'center',
                                                borderRadius: 10,
                                                boxShadow: '5px 5px 12px rgba(11, 11, 11, 0.6)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                cursor: (isMetaKeyPressed && appState.tool.type !== 'viewport') ? 'context-menu' : 'pointer',
                                            }}>
                                            <svg
                                                version="1.1"
                                                width={dynamicSizes.mediaItemSize.svg}
                                                height={dynamicSizes.mediaItemSize.svg}
                                                fill={svg.fill}
                                                stroke={svg.stroke}
                                                strokeWidth={svg.stroke_width}
                                                viewBox={svg.viewbox}
                                                dangerouslySetInnerHTML={{ __html: decodedString }} />
                                        </div>
                                        {(showContextMenu && browserElementMediaId == svg.svg_media_id) &&
                                            <BrowserContextMenu
                                                media={{ type: 'svg', key: appState.project.svgs.entries().find(e => e[1].svg_media_id == svg.svg_media_id)?.[0] ?? "", data: svg }}
                                                position={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    bottom: 0,
                                                    top: 0,
                                                    left: 0,
                                                }} />
                                        }
                                    </div>
                                </div>
                            )
                        })}
                    {filter == 'frame' && appState.browserFrames
                        .sort((a, b) => {
                            switch (sortStrategy) {
                                case 'order': {
                                    return sortByOrder(a, b);
                                }
                                case 'timestamp': {
                                    return sortByTimestamp(a, b)
                                }
                                case "none": {
                                    return 0;
                                }
                            }
                        })
                        .map((frameSvg, i) => {
                            const decodedString = decodeURIComponent(
                                atob(frameSvg.svg.markup)
                                    .split('')
                                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                    .join('')
                            );
                            return (
                                <div key={frameSvg.svg.media_key}
                                    style={{
                                        gridColumn: 2,
                                        padding: dynamicSizes.mediaItemSize.padding,
                                        display: 'grid',
                                        alignItems: 'start',
                                        justifyContent: 'center',
                                        marginTop: i == 0 ? dynamicSizes.mediaItemSize.marginTop : 0,
                                    }}>
                                    <FrameSvg
                                        scale={dynamicSizes.frameScales.high}
                                        footer="3x"
                                        crop={frameSvg}
                                        cropFactor={HIGH_FACTOR}
                                        decodedString={decodedString}
                                        containerSize={dynamicSizes.mediaItemSize.container}
                                        svgSize={dynamicSizes.mediaItemSize.svg} />
                                    <div style={{
                                        paddingTop: Math.round(20 * appState.resolution.factor),
                                        paddingBottom: Math.round(20 * appState.resolution.factor),
                                    }}>
                                        <FrameSvg
                                            scale={dynamicSizes.frameScales.midhigh}
                                            footer="2x"
                                            crop={frameSvg}
                                            cropFactor={MIDHIGH_FACTOR}
                                            decodedString={decodedString}
                                            containerSize={dynamicSizes.mediaItemSize.container}
                                            svgSize={dynamicSizes.mediaItemSize.svg} />
                                    </div>
                                    <FrameSvg
                                        scale={dynamicSizes.frameScales.midlow}
                                        footer="1x"
                                        crop={frameSvg}
                                        cropFactor={MIDLOW_FACTOR}
                                        decodedString={decodedString}
                                        containerSize={dynamicSizes.mediaItemSize.container}
                                        svgSize={dynamicSizes.mediaItemSize.svg} />
                                </div>
                            )
                        })}
                </div>
            </div>
            <div style={{
                gridRow: 3,
                gridColumn: 1,
                display: 'flex',
                alignItems: 'center',
                height: dynamicSizes.mediaSortSize.container,
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(20,20,20,1)'
            }}>
                <div
                    onClick={() => { setSortStrategy('order') }}
                    style={{
                        cursor: 'pointer',
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: sortStrategy == 'order' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: sortStrategy == 'order' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                    <SvgRepo
                        svg={bookmarkStacks('rgb(220, 220, 220)')}
                        containerStyle={{
                            cursor: 'pointer',
                            width: dynamicSizes.mediaSortSize.svg,
                            height: dynamicSizes.mediaSortSize.svg
                        }}
                        scale={1}
                        scaleToContaier={true} />
                </div>
                <div style={{ height: '100%', width: 1, background: 'rgba(255, 255, 255, 0.05)' }} />
                <div
                    onClick={() => { setSortStrategy('timestamp') }}
                    style={{
                        cursor: 'pointer',
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: sortStrategy == 'timestamp' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: sortStrategy == 'timestamp' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                    <SvgRepo
                        svg={timerArrowDown('rgb(220, 220, 220)')}
                        containerStyle={{
                            cursor: 'pointer',
                            width: dynamicSizes.mediaSortSize.svg,
                            height: dynamicSizes.mediaSortSize.svg
                        }}
                        scale={1}
                        scaleToContaier={true} />
                </div>
            </div>
        </div>
    </>)
}

interface ScrollableImageContainer {
    squarish: boolean,
    displayWidth: number;
    displayHeight: number;
    children: React.ReactNode;
}

const ScrollableImageContainer = ({
    squarish,
    displayWidth,
    displayHeight,
    children
}: ScrollableImageContainer) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            const scrollLeft = (displayWidth - container.clientWidth) / 2;
            const scrollTop = (displayHeight - container.clientHeight) / 2;
            container.scrollTo({
                left: scrollLeft,
                top: scrollTop,
                behavior: 'instant',
            });
        }
    }, [displayWidth, displayHeight]);

    return (
        <div className={styles['transparent-checkerboard-background']}
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                overflow: squarish ? 'none' : 'auto',
                borderRadius: 10,
                boxShadow: '5px 5px 12px rgba(11, 11, 11, 0.6)',
            }}
        >
            {children}
        </div>
    );
};

interface FrameSvg {
    scale: number,
    footer: string,
    crop: LaurusCropSvg,
    cropFactor: number,
    decodedString: string,
    containerSize: number,
    svgSize: number
}
function FrameSvg({ scale, footer, crop, cropFactor, decodedString, containerSize, svgSize }: FrameSvg) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [cropSize] = useState(() => {
        const s = getCropSize(crop);
        return {
            width: Math.round(s.width * cropFactor),
            height: Math.round(s.height * cropFactor)
        }
    });
    const [overlaySize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                padding: "9px 13px",
                xWidth: 17,
                footerPaddingBottom: 9,
                dimensionFont: 17,
                xFont: 15,
                aspectFont: 17,
                footerFont: 16,
            }
            case "midhigh": return {
                padding: "6px 10px",
                xWidth: 11,
                footerPaddingBottom: 6,
                dimensionFont: 11,
                xFont: 9,
                aspectFont: 11,
                footerFont: 10,
            }
            case "low":
            case "midlow": return {
                padding: "5px 9px",
                xWidth: 8,
                footerPaddingBottom: 5,
                dimensionFont: 10,
                xFont: 8,
                aspectFont: 10,
                footerFont: 9,
            }
        }
    });

    return <>
        <div
            onClick={async () => {
                const newProject: LaurusProjectResult = {
                    ...appState.project,
                    frame_width: cropSize.width,
                    frame_height: cropSize.height
                };
                if (appState.project.project_id) {
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject, });
                    await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
                }
                else {
                    const response = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
                    if (response) {
                        dispatch({ type: WorkspaceActionType.SetProject, value: { ...response } });
                    }
                }
            }}
            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
            onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
            style={{
                width: containerSize,
                height: containerSize,
                position: 'relative',
                display: 'grid',
                placeContent: 'center',
                boxShadow: "5px 5px 12px rgba(0, 0, 0, 0.2)",
                border: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.005)',
                borderRadius: 5,
            }}>
            {decodedString && <svg
                version="1.1"
                width={svgSize * scale}
                height={svgSize * scale}
                fill={crop.svg.fill}
                stroke={crop.svg.stroke}
                strokeWidth={crop.svg.stroke_width}
                viewBox={crop.svg.viewbox}
                dangerouslySetInnerHTML={{ __html: decodedString }} />}
            <div style={{ position: 'absolute', display: 'grid', width: '100%', height: '100%', gridTemplateRows: 'min-content auto min-content' }}>
                <div
                    className={dellaRespira.className}
                    style={{
                        display: 'flex',
                        padding: overlaySize.padding,
                    }}>
                    <div style={{ fontSize: overlaySize.dimensionFont, }}>{cropSize.width}</div>
                    <div style={{ fontSize: overlaySize.xFont, width: overlaySize.xWidth, textAlign: 'center' }}>{'x'}</div>
                    <div style={{ fontSize: overlaySize.dimensionFont }}>{cropSize.height}</div>
                    <div className={dellaRespira.className} style={{ marginLeft: 'auto', fontSize: overlaySize.aspectFont, alignSelf: 'start' }}>{crop.type}</div>
                </div>
                <div
                    className={dellaRespira.className}
                    style={{
                        gridRow: 3,
                        display: 'grid',
                        placeContent: 'center',
                        paddingBottom: overlaySize.footerPaddingBottom,
                        fontSize: overlaySize.footerFont
                    }}>
                    <i>{footer}</i>
                </div>
            </div>
        </div>
    </>
}

interface MediaBrowserTab {
    label: string,
    letterSpacing: number | string,
    fontSize: number | string,
    onClick: () => void,
    selected: boolean,
}
function MediaBrowserTab({ label, letterSpacing, fontSize, onClick, selected }: MediaBrowserTab) {
    return <>
        <div
            className={styles['animated-nav-dark']}
            onClick={onClick}
            style={{
                display: 'grid',
                width: '100%',
                height: '100%',
                gridTemplateRows: 'auto min-content',
            }}>
            <div style={{
                letterSpacing,
                fontSize,
                display: 'grid',
                placeContent: 'center',
                color: 'rgb(240,240,240)'
            }}>
                {label}
            </div>
            <div style={{
                height: 1,
                borderRadius: 10,
                background: selected ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                boxShadow: selected ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
            }} />
        </div>
    </>
}
