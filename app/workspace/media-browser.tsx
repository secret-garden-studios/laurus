import { useContext, useRef, useState, DragEvent, useCallback } from "react";
import { dellaRespira } from "../fonts";
import { LaurusImgResult, LaurusProjectResult, LaurusSvgResult, LaurusThumbnail, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import NextImage from "next/image";
import styles from "../app.module.css";
import { bookmarkStacks, LaurusCropSvg, SvgRepo, timerArrowDown } from "../svg-repo";
import { createImg, createProject, createSvg, getImg, getSvg, updateProject } from "./workspace.server";
import { getCropSize, HIGH_FACTOR, MIDHIGH_FACTOR, MIDLOW_FACTOR } from "./workspace-resolution";

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
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [uploading, setUploading] = useState(false);
    const [sortStrategy, setSortStrategy] = useState<'timestamp' | 'order' | 'none'>('none');
    const [mediaFilterSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                container: 50,
                letterSpacing: "3px",
                fontSize: 14
            }
            case "midhigh": return {
                container: 40,
                letterSpacing: "2px",
                fontSize: 11
            }
            case "low":
            case "midlow": return {
                container: 38,
                letterSpacing: "2px",
                fontSize: 11
            }
        }
    });
    const [mediaItemSize] = useState({
        container: Math.round(300 * appState.resolution.factor),
        svg: Math.round(100 * appState.resolution.factor),
        padding: `0px 0px ${Math.round(20 * appState.resolution.factor)}px 0px`,
    });
    const [mediaSortSize] = useState({
        container: Math.round(36 * appState.resolution.factor),
        svg: Math.round(20 * appState.resolution.factor),
    });
    const [frameScales] = useState(() => {
        return {
            high: 1.6 * appState.resolution.factor,
            midhigh: 1.1 * appState.resolution.factor,
            midlow: 0.6 * appState.resolution.factor
        }
    })
    const lastScrollTop = useRef<number>(0);

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
                    if (typeof svgString !== "string" || !svgString.startsWith("<svg")) return;
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
                        const response = await createSvg(appState.apiOrigin, { svg: file, raster: svgFile });
                        if (response) {
                            dispatch({ type: WorkspaceActionType.AddBrowserSvg, value: response, first: true });
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
                    const response = await createImg(appState.apiOrigin, file);
                    if (response) {
                        dispatch({ type: WorkspaceActionType.AddBrowserImg, value: { ...response }, first: true });
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
    }, [appState.apiOrigin, dispatch]);

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
        dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop' } })
    }, [dispatch]);

    return (<>
        <div
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onDrop={handleDrop}
            style={{
                display: 'grid',
                gridTemplateRows: 'min-content auto min-content',
                height: '100%',
            }}>
            <div style={{
                gridRow: 1,
                display: 'flex',
                alignItems: 'center',
                height: mediaFilterSize.container,
                borderBottom: '1px solid rgba(10, 10, 10, 1)',
                background: 'linear-gradient(45deg, rgb(17, 17, 17), rgb(13, 13, 13))'
            }}>
                <div
                    onClick={() => {
                        onFilterSelect('img');
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    className={dellaRespira.className}
                    style={{
                        letterSpacing: mediaFilterSize.letterSpacing,
                        fontSize: mediaFilterSize.fontSize,
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: filter == 'img' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: filter == 'img' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0)'
                    }}>
                    {'img'}
                </div>
                <div style={{ height: '100%', width: 1, background: 'rgba(10, 10, 10, 1)' }} />
                <div
                    onClick={() => {
                        onFilterSelect('svg');
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    className={dellaRespira.className}
                    style={{
                        letterSpacing: mediaFilterSize.letterSpacing,
                        fontSize: mediaFilterSize.fontSize,
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: filter == 'svg' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: filter == 'svg' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0)'
                    }}>
                    {'svg'}
                </div>
                <div style={{ height: '100%', width: 1, background: 'rgba(10, 10, 10, 1)' }} />
                <div
                    onClick={() => {
                        onFilterSelect('frame');
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    className={dellaRespira.className}
                    style={{
                        letterSpacing: mediaFilterSize.letterSpacing,
                        fontSize: mediaFilterSize.fontSize,
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: filter == 'frame' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: filter == 'frame' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0)'
                    }}>
                    {'frame'}
                </div>
            </div>
            <div
                className={styles["noisy-background"]}
                onScroll={handleScroll}
                style={{
                    gridRow: 2,
                    position: 'relative',
                    overflowY: 'auto',
                }}
            >
                {/* content area */}
                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: 0,
                        display: 'grid',
                        alignContent: 'start',
                        gridTemplateColumns: 'min-content auto',
                        width: '100%',
                        color: 'rgba(220, 220, 220, 1)',
                        height: '100%',
                        paddingTop: Math.round(10 * appState.resolution.factor),
                    }} >
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 6,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            border: uploading ? '1px solid rgb(239, 239, 239)' : '1px solid rgba(255, 255, 255, 0.03)',
                            background: uploading ? 'linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))' : 'rgba(255, 255, 255, 0.03)',
                            boxShadow: uploading ? 'rgba(255, 255, 255, 1) 0px 0px 100px 10px' : 'none'
                        }} />
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
                        .map((img) => {
                            return (
                                <div
                                    key={img.media_path}
                                    style={{
                                        gridColumn: 2,
                                        padding: mediaItemSize.padding,
                                        display: 'grid',
                                        alignItems: 'start',
                                        justifyContent: 'center',
                                    }}>
                                    <div
                                        onClick={() => {
                                            onMediaClick({ value: { ...img }, type: 'img' });
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                                        style={{
                                            width: mediaItemSize.container,
                                            height: mediaItemSize.container,
                                            position: 'relative',
                                        }}>
                                        {img.src && <NextImage
                                            draggable={false}
                                            alt={img.media_path}
                                            src={img.src}
                                            fill
                                            style={{
                                                objectFit: 'cover',
                                                border: 'none',
                                                boxShadow: "5px 5px 12px rgba(0, 0, 0, 0.5)",
                                                borderRadius: 2,
                                            }} />}
                                    </div>
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
                        .map((svg) => {
                            const decodedString = decodeURIComponent(
                                atob(svg.markup)
                                    .split('')
                                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                    .join('')
                            );
                            return (
                                <div
                                    key={svg.media_path}
                                    style={{
                                        gridColumn: 2,
                                        padding: mediaItemSize.padding,
                                        display: 'grid',
                                        alignItems: 'start',
                                        justifyContent: 'center',
                                    }}>
                                    <div
                                        onClick={() => {
                                            onMediaClick({ value: { ...svg }, type: 'svg' });
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                                        style={{
                                            width: mediaItemSize.container,
                                            height: mediaItemSize.container,
                                            position: 'relative',
                                            display: 'grid',
                                            placeContent: 'center',
                                        }}>
                                        {decodedString && <svg
                                            version="1.1"
                                            width={mediaItemSize.svg}
                                            height={mediaItemSize.svg}
                                            fill={svg.fill}
                                            stroke={svg.stroke}
                                            strokeWidth={svg.stroke_width}
                                            viewBox={svg.viewbox}
                                            dangerouslySetInnerHTML={{ __html: decodedString }} />}
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
                        .map((frameSvg) => {
                            const decodedString = decodeURIComponent(
                                atob(frameSvg.svg.markup)
                                    .split('')
                                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                    .join('')
                            );
                            return (
                                <div
                                    key={frameSvg.svg.media_path}
                                    style={{
                                        gridColumn: 2,
                                        padding: mediaItemSize.padding,
                                        display: 'grid',
                                        alignItems: 'start',
                                        justifyContent: 'center',
                                    }}>
                                    <FrameSvg
                                        scale={frameScales.high}
                                        footer="3x"
                                        crop={frameSvg}
                                        cropFactor={HIGH_FACTOR}
                                        decodedString={decodedString}
                                        containerSize={mediaItemSize.container}
                                        svgSize={mediaItemSize.svg} />
                                    <div style={{
                                        paddingTop: Math.round(20 * appState.resolution.factor),
                                        paddingBottom: Math.round(20 * appState.resolution.factor),
                                    }}>
                                        <FrameSvg
                                            scale={frameScales.midhigh}
                                            footer="2x"
                                            crop={frameSvg}
                                            cropFactor={MIDHIGH_FACTOR}
                                            decodedString={decodedString}
                                            containerSize={mediaItemSize.container}
                                            svgSize={mediaItemSize.svg} />
                                    </div>
                                    <FrameSvg
                                        scale={frameScales.midlow}
                                        footer="1x"
                                        crop={frameSvg}
                                        cropFactor={MIDLOW_FACTOR}
                                        decodedString={decodedString}
                                        containerSize={mediaItemSize.container}
                                        svgSize={mediaItemSize.svg} />
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
                height: mediaSortSize.container,
                borderTop: '1px solid rgba(10, 10, 10, 1)',
                background: 'linear-gradient(45deg, rgb(17, 17, 17), rgb(13, 13, 13))'
            }}>
                <div
                    onClick={async () => {
                        switch (filter) {
                            case "img": {
                                const currentImgs = [...appState.browserImgs];
                                const newImgs: LaurusImgResult[] = [];
                                for (let i = 0; i < currentImgs.length; i++) {
                                    const currentImg = currentImgs[i];
                                    const latestImg = await getImg(appState.apiOrigin, currentImgs[i].img_media_id);
                                    if (!latestImg) continue;
                                    newImgs.push({ ...currentImg, order: latestImg.order });
                                }
                                dispatch({ type: WorkspaceActionType.UpdateBrowserImgs, value: newImgs })
                                setSortStrategy('order');
                                break;
                            }
                            case "svg": {
                                const currentSvgs = [...appState.browserSvgs];
                                const newSvgs: LaurusSvgResult[] = [];
                                for (let i = 0; i < currentSvgs.length; i++) {
                                    const currentSvg = currentSvgs[i];
                                    const latestSvg = await getSvg(appState.apiOrigin, currentSvgs[i].svg_media_id);
                                    if (!latestSvg) continue;
                                    newSvgs.push({ ...currentSvg, order: latestSvg.order });
                                }
                                dispatch({ type: WorkspaceActionType.UpdateBrowserSvgs, value: newSvgs })
                                setSortStrategy('order');
                                break;
                            }
                            case "frame": {
                                setSortStrategy('order');
                                break;
                            }
                        }
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    style={{
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: sortStrategy == 'order' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: sortStrategy == 'order' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                    <SvgRepo
                        svg={bookmarkStacks('rgb(220, 220, 220)')}
                        containerSize={{
                            width: mediaSortSize.svg,
                            height: mediaSortSize.svg
                        }} scale={1} />
                </div>
                <div
                    onClick={() => { setSortStrategy('timestamp') }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    style={{
                        display: 'grid',
                        placeContent: 'center',
                        borderLeft: '1px solid rgba(10, 10, 10, 1)',
                        width: '100%',
                        height: '100%',
                        background: sortStrategy == 'timestamp' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: sortStrategy == 'timestamp' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                    <SvgRepo svg={timerArrowDown('rgb(220, 220, 220)')} containerSize={{
                        width: mediaSortSize.svg,
                        height: mediaSortSize.svg
                    }} scale={1} />
                </div>
            </div>
        </div>
    </>)
}

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
                    await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
                }
                else {
                    const response = await createProject(appState.apiOrigin, { ...newProject });
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