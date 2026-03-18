import { useContext, useRef, useState, DragEvent, useCallback } from "react";
import { dellaRespira } from "../fonts";
import { LaurusImgResult, LaurusSvgResult, LaurusThumbnail, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import NextImage from "next/image";
import styles from "../app.module.css";
import { bookmarkStacks, ReactSvg, timerArrowDown } from "../svg-repo";
import { createImg, createSvg, getImg, getSvg } from "./workspace.server";

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

interface MediaBrowserArea {
    filter: 'img' | 'svg',
    onNextPage: () => void,
    onPrevPage?: () => void,
    onMediaClick: (media: LaurusThumbnail) => void,
    onFilterSelect: (filter: 'img' | 'svg') => void,
}
export default function MediaBrowserArea({
    filter,
    onNextPage,
    onMediaClick,
    onFilterSelect,
}: MediaBrowserArea) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [uploading, setUploading] = useState(false);
    const [sortStrategy, setSortStrategy] = useState<'timestamp' | 'order' | 'none'>('none');
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

    function sortByTimestamp(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }

    function sortByOrder(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
        return b.order - a.order;
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
                height: 50,
            }}>
                <div
                    onClick={() => {
                        onFilterSelect('img');
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    className={dellaRespira.className}
                    style={{
                        letterSpacing: "3px",
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        border: filter == 'img' ? '1px solid rgb(20, 20, 20)' : 'none',
                        color: filter == 'img' ? 'rgb(215, 215, 215)' : 'rgb(81, 81, 81)',
                        filter: filter == 'img' ? 'none' : 'blur(0.8px)',
                        boxShadow: filter == 'img' ? "none" : "rgba(0, 0, 0, 0.47) 0px 0px 2px inset, rgba(0, 0, 0, 0.28) 0px 0px 50px inset",
                    }}>
                    {'img'}
                </div>
                <div
                    onClick={() => {
                        onFilterSelect('svg');
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                    className={dellaRespira.className}
                    style={{
                        letterSpacing: "3px",
                        display: 'grid',
                        placeContent: 'center',
                        width: '100%',
                        height: '100%',
                        border: filter == 'svg' ? '1px solid rgb(20, 20, 20)' : 'none',
                        color: filter == 'svg' ? 'rgb(215, 215, 215)' : 'rgb(81, 81, 81)',
                        filter: filter == 'svg' ? 'none' : 'blur(0.8px)',
                        boxShadow: filter == 'svg' ? "none" : "rgba(0, 0, 0, 0.47) 0px 0px 2px inset, rgba(0, 0, 0, 0.28) 0px 0px 50px inset",
                    }}>
                    {'svg'}
                </div>
            </div>
            <div
                className={styles["grainy-background"]}
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
                        height: '100%'
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
                                        padding: 10,
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
                                            width: 256,
                                            height: 256,
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
                                <div key={svg.media_path} style={{
                                    gridColumn: 2,
                                    padding: 10,
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
                                            width: 256,
                                            height: 256,
                                            position: 'relative',
                                            display: 'grid',
                                            placeContent: 'center',
                                            boxShadow: "5px 5px 12px rgba(0, 0, 0, 0.2)",
                                        }}>
                                        {decodedString && <svg
                                            version="1.1"
                                            width={100}
                                            height={100}
                                            fill={svg.fill}
                                            stroke={svg.stroke}
                                            strokeWidth={svg.stroke_width}
                                            viewBox={svg.viewbox}
                                            dangerouslySetInnerHTML={{ __html: decodedString }} />}
                                    </div>
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
                height: 36,
                borderTop: '1px solid rgb(0, 0, 0)',
                background: 'linear-gradient(45deg, rgb(17, 17, 17), rgb(13, 13, 13))',
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
                    <ReactSvg
                        svg={bookmarkStacks('rgb(220, 220, 220)')}
                        containerSize={{
                            width: 20,
                            height: 20
                        }} scale={1} />
                </div>
                <div
                    onClick={() => { setSortStrategy('timestamp') }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    style={{
                        display: 'grid',
                        placeContent: 'center',
                        borderLeft: '1px solid rgb(0, 0, 0)',
                        width: '100%',
                        height: '100%',
                        background: sortStrategy == 'timestamp' ? 'rgba(255,255,255,0.05)' : 'none',
                        border: sortStrategy == 'timestamp' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                    <ReactSvg svg={timerArrowDown('rgb(220, 220, 220)')} containerSize={{
                        width: 20,
                        height: 20
                    }} scale={1} />
                </div>
            </div>
        </div>
    </>)
}