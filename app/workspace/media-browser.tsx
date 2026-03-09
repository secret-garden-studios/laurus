import { RefObject, useContext, useEffect, useRef, useState, DragEvent, useCallback } from "react";
import { dellaRespira, michroma, redHatDisplay } from "../fonts";
import { LaurusThumbnail, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import NextImage from "next/image";
import styles from "../app.module.css";
import { ReactSvg } from "./media";
import { arrowDropDown } from "../svg-repo";
import { createImg, createSvg } from "./workspace.server";

interface MediaBrowserArea {
    filter: 'img' | 'svg',
    nextPageRef: RefObject<HTMLDivElement | null>,
    onNextPage: () => void,
    onPrevPage: () => void,
    onMediaClick: (media: LaurusThumbnail) => void,
    onFilterSelect: (filter: 'img' | 'svg') => void,
}

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

export default function MediaBrowserArea({
    filter,
    nextPageRef,
    onNextPage,
    onMediaClick,
    onFilterSelect,
}: MediaBrowserArea) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [autoscroll, setAutoscroll] = useState(false);
    const moreImgsRef = useRef<HTMLDivElement>(null);
    const moreSvgsRef = useRef<HTMLDivElement>(null);
    const [detailView, setDetailView] = useState(false);
    useEffect(() => {
        if (!autoscroll) return;
        switch (filter) {
            case "img": {
                if (appState.downloadedImgs.length > 0) {
                    moreImgsRef.current?.scrollIntoView(
                        {
                            behavior: 'smooth'
                        });
                }
                break;
            }
            case "svg": {
                if (appState.downloadedSvgs.length > 0) {
                    moreSvgsRef.current?.scrollIntoView(
                        {
                            behavior: 'smooth'
                        }
                    );
                }
                break;
            }
        }
    }, [filter, autoscroll, appState.downloadedImgs.length, appState.downloadedSvgs.length]);

    const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const MAX_DIMENSION = 4096;
        const files = Array.from(event.dataTransfer.files);
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
                            dispatch({ type: WorkspaceActionType.AddDownloadedSvg, value: response });
                        }
                    } catch (err) {
                        console.error("SVG rasterization failed", err);
                    }
                };
                reader.readAsText(file);
            } else if (file.type.startsWith("image/")) {
                const response = await createImg(appState.apiOrigin, file);
                if (response) {
                    dispatch({ type: WorkspaceActionType.AddDownloadedImg, value: response });
                }
            }
        }
    }, [appState.apiOrigin, dispatch]);

    return (<>
        <div
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onDrop={handleDrop}
            style={{
                display: 'grid',
                gridTemplateRows: 'min-content auto',
                width: "100%",
                height: '100%',
            }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: 50,
                marginBottom: 10,
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
                style={{
                    position: 'relative',
                    overflowY: 'auto',
                }}
            >
                {/* content area */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        display: 'grid',
                        width: '100%',
                        color: 'rgba(220, 220, 220, 1)',
                    }} >
                    {filter == 'img' && appState.downloadedImgs.map((img, i) => {
                        return (
                            <div key={img.media_path} style={{
                                padding: 10,
                                display: 'grid',
                                alignItems: 'start',
                                justifyContent: 'center',
                            }}>
                                {!detailView && <div
                                    onDoubleClick={() => setDetailView(v => !v)}
                                    onClick={() => {
                                        onMediaClick({ value: { ...img }, type: 'img' });
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
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
                                </div>}
                                {detailView &&
                                    <div
                                        onDoubleClick={() => setDetailView(v => !v)}
                                        style={{
                                            width: 256,
                                            height: 256,
                                            position: 'relative',
                                            display: 'grid',
                                            alignContent: 'start'
                                        }}>
                                        <div
                                            className={michroma.className}
                                            style={{
                                                fontSize: 8,
                                                color: 'rgb(200, 200, 200)'
                                            }}>
                                            {`${img.width}x${img.height}`}
                                        </div>
                                        <div className={redHatDisplay.className}
                                            style={{
                                                fontSize: 8,
                                                color: 'rgb(200, 200, 200)'
                                            }}>
                                            {`${img.media_path}`}
                                        </div>
                                    </div>
                                }
                                {i == appState.downloadedImgs.length - 1 && (
                                    <div
                                        ref={moreImgsRef}
                                        style={{
                                            width: '100%',
                                            height: 40,
                                            zIndex: 1,
                                            padding: 6,
                                            display: 'grid',
                                            placeContent: 'center',
                                        }} >
                                        <div
                                            ref={nextPageRef}
                                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                            onClick={() => {
                                                setAutoscroll(true);
                                                onNextPage();
                                            }}>
                                            <ReactSvg
                                                svg={arrowDropDown()}
                                                containerSize={{
                                                    width: 22,
                                                    height: 22
                                                }}
                                                scale={1} />
                                        </div>
                                    </div>
                                )}
                            </div>)

                    })}
                    {filter == 'svg' && appState.downloadedSvgs.map((svg, i) => {
                        const decodedString = decodeURIComponent(
                            atob(svg.markup)
                                .split('')
                                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                .join('')
                        );
                        return (
                            <div key={svg.media_path} style={{
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
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                    style={{
                                        width: 256,
                                        height: 256,
                                        position: 'relative',
                                        display: 'grid',
                                        placeContent: 'center',
                                        boxShadow: "5px 5px 12px rgba(0, 0, 0, 0.5)",
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
                                {i == appState.downloadedSvgs.length - 1 && (
                                    <div
                                        ref={moreSvgsRef}
                                        style={{
                                            width: '100%',
                                            height: 40,
                                            zIndex: 1,
                                            padding: 6,
                                            display: 'grid',
                                            placeContent: 'center',
                                        }} >
                                        <div
                                            ref={nextPageRef}
                                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                            onClick={() => {
                                                setAutoscroll(true);
                                                onNextPage();
                                            }}>
                                            <ReactSvg
                                                svg={arrowDropDown()}
                                                containerSize={{
                                                    width: 22,
                                                    height: 22
                                                }}
                                                scale={1} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    </>)
}