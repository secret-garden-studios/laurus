import { useContext, useState, useEffect } from "react";
import { SvgRepo, chevronLeft, chevronRight } from "../svg-repo";
import { ReactImg } from "./media";
import { getTopLevelPadding, getDisplaySize } from "./unit-resolution";
import { WorkspaceContext } from "./workspace.client";
import styles from "../app.module.css";

interface UnitDisplay {
    carouselIndex: number,
    onNewCarouselIndex: (newIndex: number) => void,
}
export default function UnitDisplay({ carouselIndex, onNewCarouselIndex }: UnitDisplay) {
    const { appState } = useContext(WorkspaceContext);
    const [topLevelPadding] = useState(() => getTopLevelPadding(appState.resolution));
    const [displaySize] = useState(() => getDisplaySize(appState.resolution));

    useEffect(() => {
        (async () => {
            const index = appState.carouselEntries.findIndex(c => c.value.media_key == appState.activeElement?.value.value.media_key);
            if (index > -1) {
                onNewCarouselIndex(index);
            }
            else {
                onNewCarouselIndex(0);
            }
        })()
    }, [appState.activeElement?.value.value.media_key, appState.carouselEntries, onNewCarouselIndex]);

    return <>
        <div style={{ padding: topLevelPadding }}>
            <div
                className={styles["large-tiled-background-squares"]}
                style={{
                    padding: `${displaySize.padding}px`,
                    display: 'grid',
                    width: `${displaySize.width}px`, height: `${displaySize.height}px`,
                    borderRadius: 10,
                    border: '1px solid rgba(10,10,10,1)',
                    gridTemplateColumns: 'min-content auto min-content'
                }}>
                <div style={{ width: 30, height: '100%', display: 'grid', placeContent: 'center' }}>
                    <SvgRepo
                        svg={appState.carouselEntries.length == 0 || carouselIndex == 0 ? chevronLeft('rgb(67,67,67)') : chevronLeft()}
                        containerSize={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.7}
                        onContainerClick={() => {
                            const newIndex = Math.max(carouselIndex - 1, 0);
                            if (appState.carouselEntries.length > newIndex) {
                                onNewCarouselIndex(newIndex);
                            }
                        }} />
                </div>
                {/* active element */}
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeContent: 'center'
                }}>
                    {appState.carouselEntries.map((c, i) => {
                        if (i == carouselIndex) {
                            switch (c.type) {
                                case "img": {
                                    const canvasImg = appState.canvasImgs.find(i => i.img_media_id == c.value.img_media_id);
                                    if (!canvasImg) return;
                                    return (
                                        <ReactImg
                                            key={c.value.img_media_id}
                                            img={canvasImg}
                                            containerSize={{
                                                width: displaySize.activeImgElementSize,
                                                height: displaySize.activeImgElementSize
                                            }}
                                        />
                                    )
                                }
                                case "svg": {
                                    const canvasSvg = appState.canvasSvgs.find(i => i.svg_media_id == c.value.svg_media_id);
                                    if (!canvasSvg) return;
                                    return (
                                        <SvgRepo
                                            key={c.value.svg_media_id}
                                            svg={canvasSvg}
                                            containerSize={{
                                                width: displaySize.activeSvgElementSize,
                                                height: displaySize.activeSvgElementSize
                                            }}
                                            scale={1}
                                        />
                                    )
                                }
                            }
                        }
                    })}
                </div>
                <div style={{ width: 30, height: '100%', display: 'grid', placeContent: 'center' }}>
                    <SvgRepo
                        svg={appState.carouselEntries.length == 0 || carouselIndex >= appState.carouselEntries.length - 1 ? chevronRight('rgb(67,67,67)') : chevronRight()}
                        containerSize={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.7}
                        onContainerClick={() => {
                            const newIndex = Math.min(carouselIndex + 1, Math.max(appState.carouselEntries.length - 1, 0));
                            if (appState.carouselEntries.length > newIndex) {
                                onNewCarouselIndex(newIndex);
                            }
                        }} />
                </div>
            </div>
        </div>
    </>
}