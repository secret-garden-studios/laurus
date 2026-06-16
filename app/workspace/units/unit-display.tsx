import { useContext, useState, useCallback } from "react";
import { SvgRepo, chevronLeft, chevronRight } from "../../svg-repo";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import { getDynamicUnitSizes } from "../workspace.config";
import styles from "@/app/app.module.css";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

interface UnitDisplay {
    carouselIndex: number,
    effectKey: string,
    localIndex: number,
    onNewLocalIndex: (v: number) => void,
}
export default function UnitDisplay({ carouselIndex, effectKey, localIndex, onNewLocalIndex }: UnitDisplay) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const { isMetaKeyPressed } = useContext(HoverContext);
    const [dynamicSizes] = useState(() => getDynamicUnitSizes(uiState.resolution));

    const setActiveElement = useCallback((newCarouselIndex: number) => {
        if (uiState.carouselEntries.length <= newCarouselIndex) return;
        if (newCarouselIndex < 0) return;
        const entry: CarouselEntry = { ...uiState.carouselEntries[newCarouselIndex] };
        switch (entry.type) {
            case "svg": {
                const projectSvg = appState.project.svgs.get(entry.key);
                if (!projectSvg) break;
                const canvasSvg = appState.canvasSvgs.get(entry.key);
                if (!canvasSvg) break;
                const newActiveElement: LaurusActiveElement = {
                    key: entry.key,
                    type: 'svg',
                    locallyActivatedEffectKey: effectKey,
                }
                uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                dispatch({ type: CoreActionType.SetProjectSvg, key: entry.key, value: { ...projectSvg, showContextMenu: true } });
                break;
            }
            case "img": {
                const projectImg = appState.project.imgs.get(entry.key);
                if (!projectImg) break;
                const canvasImg = appState.canvasImgs.get(entry.key);
                if (!canvasImg) break;
                const newActiveElement: LaurusActiveElement = {
                    key: entry.key,
                    type: 'img',
                    locallyActivatedEffectKey: effectKey,
                }
                uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                dispatch({ type: CoreActionType.SetProjectImg, key: entry.key, value: { ...projectImg, showContextMenu: true } });
                break;
            }
        }
    }, [uiState.carouselEntries, appState.project.svgs, appState.project.imgs, appState.canvasSvgs, appState.canvasImgs, effectKey, uiDispatch, dispatch]);

    const hideContextMenu = useCallback((entry: CarouselEntry) => {
        switch (entry.type) {
            case "svg": {
                const projectSvg = appState.project.svgs.get(entry.key);
                if (!projectSvg) break;
                dispatch({ type: CoreActionType.SetProjectSvg, key: entry.key, value: { ...projectSvg, showContextMenu: false } });
                break;
            }
            case "img": {
                const projectImg = appState.project.imgs.get(entry.key);
                if (!projectImg) break;
                dispatch({ type: CoreActionType.SetProjectImg, key: entry.key, value: { ...projectImg, showContextMenu: false } });
                break;
            }
        }
    }, [appState.project.imgs, appState.project.svgs, dispatch]);

    return <>
        <div style={{ padding: dynamicSizes.param.padding }}>
            <div
                className={styles["large-tiled-background-squares"]}
                style={{
                    display: 'grid',
                    borderRadius: 10,
                    border: '1px solid rgba(10,10,10,1)',
                    gridTemplateColumns: 'min-content auto min-content',
                    ...dynamicSizes.display
                }}>
                <div style={{ width: 30, height: '100%', display: 'grid', placeContent: 'center' }}>
                    <SvgRepo
                        title={"select previous"}
                        svg={uiState.carouselEntries.length == 0 || carouselIndex == 0 ? chevronLeft('rgb(67,67,67)') : chevronLeft()}
                        containerStyle={{
                            width: 30,
                            height: 30,
                            cursor: isMetaKeyPressed ? 'crosshair' : 'pointer',
                        }}
                        scale={1}
                        onContainerClick={() => {
                            if (isMetaKeyPressed) return;
                            const newIndex = Math.max(carouselIndex - 1, 0);
                            const newLocalIndex = Math.max(localIndex - 1, 0);
                            onNewLocalIndex(newLocalIndex);
                            setActiveElement(newIndex);
                            const inactives = uiState.carouselEntries.filter((_, index) => index !== newIndex);
                            inactives.forEach(ce => {
                                hideContextMenu(ce);
                            });
                        }} />
                </div>
                {/* active element */}
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeContent: 'center'
                }}>
                    {uiState.carouselEntries.map((c, i) => {
                        if (i == carouselIndex) {
                            switch (c.type) {
                                case "img": {
                                    const projectImg = appState.project.imgs.get(c.key);
                                    if (!projectImg) break;
                                    const canvasImg = appState.canvasImgs.get(c.key);
                                    if (!canvasImg) return;
                                    return (
                                        <div
                                            key={c.key}
                                            onClick={() => {
                                                if (isMetaKeyPressed) return;
                                                setActiveElement(i);
                                                const inactives = uiState.carouselEntries.filter((_, index) => index !== i);
                                                inactives.forEach(ce => {
                                                    hideContextMenu(ce);
                                                });
                                            }}
                                            style={{
                                                position: 'relative',
                                                cursor: isMetaKeyPressed ? 'crosshair' : 'pointer',
                                                ...dynamicSizes.displayImg
                                            }}>
                                            <LaurusImage
                                                draggable={false}
                                                alt={c.key}
                                                src={canvasImg.src}
                                                fill
                                                style={{
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        </div>
                                    )
                                }
                                case "svg": {
                                    const projectSvg = appState.project.svgs.get(c.key);
                                    if (!projectSvg) break;
                                    const canvasSvg = appState.canvasSvgs.get(c.key);
                                    if (!canvasSvg) return;
                                    return (
                                        <SvgRepo
                                            key={c.key}
                                            svg={canvasSvg}
                                            containerStyle={{ ...dynamicSizes.displaySvg, cursor: isMetaKeyPressed ? 'crosshair' : 'pointer' }}
                                            onContainerClick={() => {
                                                if (isMetaKeyPressed) return;
                                                setActiveElement(i);
                                                const inactives = uiState.carouselEntries.filter((_, index) => index !== i);
                                                inactives.forEach(ce => {
                                                    hideContextMenu(ce);
                                                });
                                            }}
                                            scale={1}
                                            scaleToContaier={true}
                                        />
                                    )
                                }
                            }
                        }
                    })}
                </div>
                <div style={{ width: 30, height: '100%', display: 'grid', placeContent: 'center' }}>
                    <SvgRepo
                        title={"select next"}
                        svg={uiState.carouselEntries.length == 0 || carouselIndex >= uiState.carouselEntries.length - 1 ? chevronRight('rgb(67,67,67)') : chevronRight()}
                        containerStyle={{
                            width: 30,
                            height: 30,
                            cursor: isMetaKeyPressed ? 'crosshair' : 'pointer',
                        }}
                        scale={1}
                        onContainerClick={() => {
                            if (isMetaKeyPressed) return;
                            const newIndex = Math.min(carouselIndex + 1, Math.max(uiState.carouselEntries.length - 1, 0));
                            const newLocalIndex = Math.min(localIndex + 1, Math.max(uiState.carouselEntries.length - 1, 0));
                            onNewLocalIndex(newLocalIndex);
                            setActiveElement(newIndex);
                            const inactives = uiState.carouselEntries.filter((_, index) => index !== newIndex);
                            inactives.forEach(ce => {
                                hideContextMenu(ce);
                            });
                        }} />
                </div>
            </div>
        </div>
    </>
}

export function DeepControls() {
    const { uiState } = useContext(UIContext);
    const [dynamicSizes] = useState(() => getDynamicUnitSizes(uiState.resolution));
    return <>
        <div
            style={{
                gridColumn: 'span 2',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 16,
                padding: dynamicSizes.param.padding
            }}>
            <div
                style={{
                    display: 'grid',
                    height: `${dynamicSizes.display.height}px`,
                    alignContent: 'center',
                    gap: 4,
                }}>
                <div>{'coming soon...'}</div>
            </div>
        </div>
    </>
}
