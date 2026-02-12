import { RefObject, useContext, useEffect, useRef, useState } from "react";
import { geistSansLite, michroma, redHatDisplay } from "../fonts";
import { LaurusThumbnail, WorkspaceContext } from "./workspace.client";
import Image from "next/image";
import styles from "../app.module.css";

interface MediaBrowserArea {
    filter: 'img' | 'svg',
    nextPageRef: RefObject<HTMLDivElement | null>,
    onNextPage: () => void,
    onPrevPage: () => void,
    onMediaClick: (media: LaurusThumbnail) => void,
    onFilterSelect: (filter: 'img' | 'svg') => void,
}

export default function MediaBrowserArea({
    filter,
    nextPageRef,
    onNextPage,
    onMediaClick,
    onFilterSelect,
}: MediaBrowserArea) {
    const [rulerSize] = useState(20);
    const { appState } = useContext(WorkspaceContext);
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

    return (<>
        <div
            style={{
                position: 'relative',
                overflow: 'hidden',
                width: "100%",
                height: '100%',
                overflowY: 'auto',
            }}
        >
            <div
                className={styles["grainy-background"]}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                }} >

            </div>

            {/* content area */}
            <div
                style={{
                    gridRow: '2', gridColumn: '2',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    display: 'grid',
                    width: '100%',
                    height: '100%',
                    color: 'rgba(220, 220, 220, 1)',
                    gridTemplateColumns: `${rulerSize}px auto`,
                    gridTemplateRows: `${rulerSize}px auto`,

                }} >

                <div style={{
                    gridRow: 1,
                    gridColumn: 1,
                    backgroundImage: 'linear-gradient(45deg, rgb(36, 36, 36), rgb(39, 39, 39))',
                }}></div>
                <div style={{
                    gridRow: 1,
                    gridColumn: 2,
                    backgroundImage: 'linear-gradient(45deg, rgb(7, 7, 7), rgb(14, 14, 14))',
                }}></div>
                <div style={{
                    gridRow: 2,
                    gridColumn: 1,
                    backgroundImage: 'linear-gradient(45deg, rgb(7, 7, 7), rgb(14, 14, 14))',
                }}></div>
                <div style={{
                    gridRow: 2,
                    gridColumn: 2,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifySelf: 'center',
                        width: '100%',
                        height: 60,
                        marginBottom: 20,
                    }}>
                        <div
                            onClick={() => {
                                onFilterSelect('img');
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            className={geistSansLite.className}
                            style={{
                                display: 'grid',
                                placeContent: 'center',
                                width: '100%',
                                height: '100%',
                                border: filter == 'img' ? '1px solid rgb(40, 40, 40)' : '1px solid rgb(37, 37, 37)',
                                borderRadius: 4,
                                background: filter == 'img' ? "linear-gradient(45deg, rgba(17, 17, 17, 1), rgba(33, 33, 33, 1))" : 'none',
                                color: filter == 'img' ? 'rgb(227, 227, 227)' : 'rgb(94, 94, 94)',
                                boxShadow: filter == 'img' ? "inset 3px 3px 10px rgba(0, 0, 0, 1), inset -160px -160px 0 rgba(0, 0, 0, 0)" : 'none',
                            }}>
                            {'img'}
                        </div>
                        <div
                            onClick={() => {
                                onFilterSelect('svg');
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                            onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                            className={geistSansLite.className}
                            style={{
                                display: 'grid',
                                placeContent: 'center',
                                width: '100%',
                                height: '100%',
                                border: filter == 'svg' ? '1px solid rgb(40, 40, 40)' : '1px solid rgb(37, 37, 37)',
                                borderRadius: 4,
                                background: filter == 'svg' ? "linear-gradient(45deg, rgba(17, 17, 17, 1), rgba(33, 33, 33, 1))" : 'none',
                                color: filter == 'svg' ? 'rgb(227, 227, 227)' : 'rgb(94, 94, 94)',
                                boxShadow: filter == 'svg' ? "inset 3px 3px 10px rgba(0, 0, 0, 1), inset -160px -160px 0 rgba(0, 0, 0, 0)" : 'none',
                            }}>
                            {'svg'}
                        </div>
                    </div>

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
                                        onMediaClick({ media: { ...img }, type: 'img' });
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                                    style={{
                                        width: 256,
                                        height: 256,
                                        position: 'relative',
                                    }}>
                                    {img.src && <Image
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
                                            <Image
                                                src="/material-ui/arrow_drop_down_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg"
                                                alt="arrow_drop_down"
                                                width={22}
                                                height={22}
                                            />
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
                                        onMediaClick({ media: { ...svg }, type: 'svg' });
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
                                            <Image
                                                src="/material-ui/arrow_drop_down_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg"
                                                alt="arrow_drop_down"
                                                width={22}
                                                height={22} />
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