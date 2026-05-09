import { useContext, useState, useCallback } from "react";
import { SvgRepo, chevronLeft, chevronRight } from "../svg-repo";
import { CarouselEntry, LaurusActiveElement, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import styles from "../app.module.css";
import NextImage from "next/image";
import { getDynamicUnitSizes } from "./workspace-resolution";

interface UnitDisplay {
    carouselIndex: number,
    effectKey: string,
    localIndex: number,
    onNewLocalIndex: (v: number) => void,
}
export default function UnitDisplay({ carouselIndex, effectKey, localIndex, onNewLocalIndex}: UnitDisplay) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => getDynamicUnitSizes(appState.resolution));

    const setActiveElement = useCallback((newCarouselIndex: number) => {
        if (appState.carouselEntries.length <= newCarouselIndex) return;
        if (newCarouselIndex < 0) return;
        const entry: CarouselEntry = { ...appState.carouselEntries[newCarouselIndex] };
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
                dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                dispatch({ type: WorkspaceActionType.SetProjectSvg, key: entry.key, value: { ...projectSvg, showContextMenu: true } });
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
                dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                dispatch({ type: WorkspaceActionType.SetProjectImg, key: entry.key, value: { ...projectImg, showContextMenu: true } });
                break;
            }
        }
    }, [appState.canvasImgs, appState.canvasSvgs, appState.carouselEntries, appState.project.imgs, appState.project.svgs, dispatch, effectKey]);

    const hideContextMenu = useCallback((entry: CarouselEntry) => {
        switch (entry.type) {
            case "svg": {
                const projectSvg = appState.project.svgs.get(entry.key);
                if (!projectSvg) break;
                dispatch({ type: WorkspaceActionType.SetProjectSvg, key: entry.key, value: { ...projectSvg, showContextMenu: false } });
                break;
            }
            case "img": {
                const projectImg = appState.project.imgs.get(entry.key);
                if (!projectImg) break;
                dispatch({ type: WorkspaceActionType.SetProjectImg, key: entry.key, value: { ...projectImg, showContextMenu: false } });
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
                        svg={appState.carouselEntries.length == 0 || carouselIndex == 0 ? chevronLeft('rgb(67,67,67)') : chevronLeft()}
                        containerSize={{
                            width: 30,
                            height: 30
                        }}
                        scale={0.7}
                        onContainerClick={() => {
                            const newIndex = Math.max(carouselIndex - 1, 0);
                            const newLocalIndex = Math.max(localIndex - 1, 0);
                            onNewLocalIndex(newLocalIndex);
                            setActiveElement(newIndex);
                            const inactives = appState.carouselEntries.filter((_, index) => index !== newIndex);
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
                    {appState.carouselEntries.map((c, i) => {
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
                                            style={{
                                                position: 'relative',
                                                ...dynamicSizes.displayImg
                                            }}>
                                            <NextImage
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
                                            containerSize={{ ...dynamicSizes.displaySvg }}
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
                            const newLocalIndex = Math.min(localIndex + 1, Math.max(appState.carouselEntries.length - 1, 0));
                            onNewLocalIndex(newLocalIndex);
                            setActiveElement(newIndex);
                            const inactives = appState.carouselEntries.filter((_, index) => index !== newIndex);
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
    const { appState } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => getDynamicUnitSizes(appState.resolution));
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
