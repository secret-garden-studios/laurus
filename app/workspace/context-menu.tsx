import { useContext, useMemo, useCallback, CSSProperties } from "react";
import { LaurusProjectImg, LaurusProjectSvg, LaurusProjectResult, projectImgIsTransformed, projectSvgIsTransformed } from "../projects/projects.client";
import { updateProject } from "../projects/projects.server";
import { LaurusImgResult, LaurusSvgResult, WorkspaceContext, WorkspaceActionType, LaurusScaleResult, LaurusMoveResult, LaurusRotateResult, LaurusActiveElement, LaurusTransform, LaurusBrowserElement } from "./workspace.client";
import { updateScale, updateMove, updateRotate } from "./workspace.server";
import styles from "../app.module.css";
import { RiToolsLine } from "react-icons/ri";
import { allOut, browse, earthquake, keyboardCommandKey, lassoSelect, SvgRepo, toysFan } from "../svg-repo";

export type ContextMenuMedia =
    | { type: 'img', key: string, meta: LaurusProjectImg, data: LaurusImgResult }
    | { type: 'svg', key: string, meta: LaurusProjectSvg, data: LaurusSvgResult }
interface ContextMenu {
    media: ContextMenuMedia,
    transform?: LaurusTransform,
}
export default function ContextMenu({ media, transform }: ContextMenu) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const selected = useMemo<boolean>(() => { return (appState.activeElement?.key ?? "") == media.key }, [appState.activeElement?.key, media.key]);

    const deleteProjectMedia = useCallback(async (
        snapshot: LaurusProjectResult,
        newSvgs: Map<string, LaurusProjectSvg> | undefined,
        newImgs: Map<string, LaurusProjectImg> | undefined) => {
        const newProject: LaurusProjectResult = {
            ...snapshot,
            ...(newSvgs !== undefined && { svgs: newSvgs }),
            ...(newImgs !== undefined && { imgs: newImgs })
        };
        if (newProject.project_id) {
            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (!updated) {
                dispatch({ type: WorkspaceActionType.SetProject, value: snapshot });
            }
            else {
                if (appState.activeElement?.key == media.key) {
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: undefined });
                }
                dispatch({ type: WorkspaceActionType.DeleteCarouselEntry, key: media.key });
                // clean up effects
                for (let i = 0; i < appState.effects.length; i++) {
                    const effect = appState.effects[i];
                    if (!effect.value.math.has(media.key)) continue;
                    switch (effect.type) {
                        case "scale": {
                            const newMath = new Map(effect.value.math);
                            newMath.delete(media.key);
                            const newScale: LaurusScaleResult = { ...effect.value, math: newMath };
                            const updated = await updateScale(appState.apiOrigin, appState.accessToken, effect.key, newScale);
                            if (updated) {
                                dispatch({
                                    type: WorkspaceActionType.SetEffect,
                                    value: { type: 'scale', key: effect.key, locked: effect.locked, value: { ...newScale } }
                                });
                            }
                            break;
                        }
                        case "move": {
                            const newMath = new Map(effect.value.math);
                            newMath.delete(media.key);
                            const newMove: LaurusMoveResult = { ...effect.value, math: newMath };
                            const updated = await updateMove(appState.apiOrigin, appState.accessToken, effect.key, { ...newMove });
                            if (updated) {
                                dispatch({
                                    type: WorkspaceActionType.SetEffect,
                                    value: { type: 'move', key: effect.key, locked: effect.locked, value: { ...newMove } }
                                });
                            }
                            break;
                        }
                        case "rotate": {
                            const newMath = new Map(effect.value.math);
                            newMath.delete(media.key);
                            const newRotate: LaurusRotateResult = { ...effect.value, math: newMath };
                            const updated = await updateRotate(appState.apiOrigin, appState.accessToken, effect.key, { ...newRotate });
                            if (updated) {
                                dispatch({
                                    type: WorkspaceActionType.SetEffect,
                                    value: { type: 'rotate', key: effect.key, locked: effect.locked, value: { ...newRotate } }
                                });
                            }
                            break;
                        }
                    }
                }
                // clean up canvas media
                switch (media.type) {
                    case "img": {
                        dispatch({ type: WorkspaceActionType.DeleteCanvasImg, key: media.key });
                        break;
                    }
                    case "svg": {
                        dispatch({ type: WorkspaceActionType.DeleteCanvasSvg, key: media.key });
                        break;
                    }
                }
            }
        }
    }, [appState.accessToken, appState.activeElement?.key, appState.apiOrigin, appState.effects, dispatch, media.key, media.type]);

    const leftSide = useMemo(() => {
        if (media.meta.contextMenuConfig.position.toLowerCase().endsWith('left')) {
            return true;
        }
        else {
            return false;
        }
    }, [media.meta.contextMenuConfig.position]);

    const bottomSide = useMemo(() => {
        if (media.meta.contextMenuConfig.position.toLowerCase().startsWith('bottom')) {
            return true;
        }
        else {
            return false;
        }
    }, [media.meta.contextMenuConfig.position]);

    const dynamicClipPath = useMemo(() => {
        const getPath = (isInner: boolean) => {
            const w = isInner ? media.meta.contextMenuConfig.width - 8 : media.meta.contextMenuConfig.width;
            const h = isInner ? media.meta.contextMenuConfig.height - 6 : media.meta.contextMenuConfig.height;
            // radius
            const r = isInner ? 8 : 8;
            // triangle radius
            const tr = isInner ? 0 : 0;
            // caret dimensions
            const cs = isInner ? 10 : 12;
            const ch = isInner ? 24 : 30;
            if (leftSide) {
                if (bottomSide) {
                    return `path('M ${r} 0 H ${w - cs - r} A ${r} ${r} 0 0 1 ${w - cs} ${r} V ${h - ch + tr} A ${tr} ${tr} 0 0 1 ${w - cs + tr / 2} ${h - ch + tr / 2} L ${w - tr} ${h - ch / 2 + tr / 2} A ${tr} ${tr} 0 0 1 ${w - tr} ${h - ch / 2 - tr / 2} L ${w - cs + tr / 2} ${h - tr / 2} A ${tr} ${tr} 0 0 1 ${w - cs} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z')`;
                }
                return `path('M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 H ${w - cs} A ${tr} ${tr} 0 0 1 ${w - cs + tr / 2} ${tr / 2} L ${w - tr} ${ch / 2 - tr / 2} A ${tr} ${tr} 0 0 1 ${w - tr} ${ch / 2 + tr / 2} L ${w - cs + tr / 2} ${ch - tr / 2} A ${tr} ${tr} 0 0 1 ${w - cs} ${ch} V ${h - r} A ${r} ${r} 0 0 1 ${w - cs - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} Z')`;
            }
            else {
                if (bottomSide) {
                    return `path('M ${cs + r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${cs} A ${tr} ${tr} 0 0 1 ${cs - tr / 2} ${h - tr / 2} L ${tr} ${h - ch / 2 + tr / 2} A ${tr} ${tr} 0 0 1 ${tr} ${h - ch / 2 - tr / 2} L ${cs - tr / 2} ${h - ch + tr / 2} A ${tr} ${tr} 0 0 1 ${cs} ${h - ch} V ${r} A ${r} ${r} 0 0 1 ${cs + r} 0 Z')`;
                }
                return `path('M ${cs} ${ch} A ${tr} ${tr} 0 0 1 ${cs - tr / 2} ${ch - tr / 2} L ${tr} ${ch / 2 + tr / 2} A ${tr} ${tr} 0 0 1 ${tr} ${ch / 2 - tr / 2} L ${cs - tr / 2} ${tr / 2} A ${tr} ${tr} 0 0 1 ${cs} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${cs + r} A ${r} ${r} 0 0 1 ${cs} ${h - r} Z')`;
            }
        }
        return {
            outer: getPath(false),
            inner: getPath(true)
        };
    }, [bottomSide, leftSide, media.meta.contextMenuConfig.width, media.meta.contextMenuConfig.height]);

    const swapMedia = useCallback(async () => {
        if (!appState.browserElement) return;
        const browserElement: LaurusBrowserElement = { ...appState.browserElement };
        const snapshot: LaurusProjectResult = { ...appState.project };
        const newImgs = new Map(snapshot.imgs);
        const newSvgs = new Map(snapshot.svgs);
        const newCanvasImgs = new Map(appState.canvasImgs);
        const newCanvasSvgs = new Map(appState.canvasSvgs);
        switch (media.type) {
            case "img": {
                switch (browserElement.type) {
                    case "svg": {
                        newImgs.delete(media.key);
                        newCanvasImgs.delete(media.key)
                        const newProjectSvg: LaurusProjectSvg = {
                            ...media.meta,
                            svg_media_id: browserElement.value.svg_media_id,
                            media_key: browserElement.value.media_key,
                            viewbox: browserElement.value.viewbox,
                            stroke: browserElement.value.stroke,
                            stroke_width: browserElement.value.stroke_width,
                            fill: browserElement.value.fill,
                        }
                        const newSvgResult: LaurusSvgResult = {
                            ...newProjectSvg,
                            timestamp: browserElement.value.timestamp,
                            last_active: browserElement.value.last_active,
                            media_uri: browserElement.value.media_uri,
                            order: browserElement.value.order,
                            categories: browserElement.value.categories,
                            markup: browserElement.value.markup
                        }
                        newSvgs.set(media.key, newProjectSvg);
                        newCanvasSvgs.set(media.key, newSvgResult);
                        break;
                    }
                    case "img": {
                        const newProjectImg: LaurusProjectImg = {
                            ...media.meta,
                            img_media_id: browserElement.value.img_media_id,
                            media_key: browserElement.value.media_key,
                        }
                        const newImgResult: LaurusImgResult = {
                            ...newProjectImg,
                            timestamp: browserElement.value.timestamp,
                            last_active: browserElement.value.last_active,
                            media_uri: browserElement.value.media_uri,
                            order: browserElement.value.order,
                            categories: browserElement.value.categories,
                            src: browserElement.value.src
                        }
                        newImgs.set(media.key, newProjectImg);
                        newCanvasImgs.set(media.key, newImgResult);
                        break;
                    }
                }
                break;
            }
            case "svg": {
                switch (browserElement.type) {
                    case "svg": {
                        const newProjectSvg: LaurusProjectSvg = {
                            ...media.meta,
                            svg_media_id: browserElement.value.svg_media_id,
                            media_key: browserElement.value.media_key,
                            viewbox: browserElement.value.viewbox,
                        }
                        const newSvgResult: LaurusSvgResult = {
                            ...newProjectSvg,
                            timestamp: browserElement.value.timestamp,
                            last_active: browserElement.value.last_active,
                            media_uri: browserElement.value.media_uri,
                            order: browserElement.value.order,
                            categories: browserElement.value.categories,
                            markup: browserElement.value.markup
                        }
                        newSvgs.set(media.key, newProjectSvg);
                        newCanvasSvgs.set(media.key, newSvgResult);
                        break;
                    }
                    case "img": {
                        newSvgs.delete(media.key);
                        newCanvasSvgs.delete(media.key);
                        const newProjectImg: LaurusProjectImg = {
                            ...media.meta,
                            img_media_id: browserElement.value.img_media_id,
                            media_key: browserElement.value.media_key,
                        }
                        const newImgResult: LaurusImgResult = {
                            ...newProjectImg,
                            timestamp: browserElement.value.timestamp,
                            last_active: browserElement.value.last_active,
                            media_uri: browserElement.value.media_uri,
                            order: browserElement.value.order,
                            categories: browserElement.value.categories,
                            src: browserElement.value.src
                        }
                        newImgs.set(media.key, newProjectImg);
                        newCanvasImgs.set(media.key, newImgResult);
                        break;
                    }
                }
                break;
            }
        }
        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs, svgs: newSvgs }
        const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
        if (updated) {
            dispatch({ type: WorkspaceActionType.SetCanvasImgs, value: newCanvasImgs });
            dispatch({ type: WorkspaceActionType.SetCanvasSvgs, value: newCanvasSvgs });
            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
        }
    }, [appState.accessToken, appState.apiOrigin, appState.browserElement, appState.canvasImgs, appState.canvasSvgs, appState.project, dispatch, media.key, media.meta, media.type]);

    const updateMediaOrder = useCallback(async (direction: 'increment' | 'decrement') => {
        const snapshot = { ...appState.project }
        const newImgs = new Map(Array.from(snapshot.imgs, ([k, v]) => [k, { ...v }]));
        const newSvgs = new Map(Array.from(snapshot.svgs, ([k, v]) => [k, { ...v }]));
        const targetItem = newImgs.get(media.key) || newSvgs.get(media.key);
        if (!targetItem) return;
        const allItems = [...newImgs.values(), ...newSvgs.values()];
        if (direction === 'decrement') {
            targetItem.order = Math.max(0, targetItem.order - 1);
        } else {
            const maxOrder = allItems.length - 1;
            targetItem.order = Math.min(maxOrder, targetItem.order + 1);
        }
        allItems.sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            if (a === targetItem) return direction === 'decrement' ? -1 : 1;
            if (b === targetItem) return direction === 'decrement' ? 1 : -1;
            return 0;
        });
        allItems.forEach((item, index) => {
            item.order = index;
        });
        const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs, svgs: newSvgs, };
        const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
        if (updated) {
            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
        }
    }, [appState.project, appState.apiOrigin, appState.accessToken, media.key, dispatch]);

    const revertEnabled = useMemo(() => {
        switch (media.type) {
            case "img": {
                const m = appState.project.imgs.get(media.key);
                if (!m) return false;
                return projectImgIsTransformed(m);
            }
            case "svg": {
                const m = appState.project.svgs.get(media.key);
                if (!m) return false;
                return projectSvgIsTransformed(m);
            }
        }
    }, [appState.project.imgs, appState.project.svgs, media.key, media.type]);

    const revertMedia = useCallback(async () => {
        const snapshot: LaurusProjectResult = { ...appState.project };
        const newImgs = new Map(snapshot.imgs);
        const newSvgs = new Map(snapshot.svgs);
        switch (media.type) {
            case "img": {
                const m = newImgs.get(media.key);
                if (!m) return;
                if (projectImgIsTransformed(m)) {
                    const newImg: LaurusProjectImg = { ...m, scale_x: 1, scale_y: 1, rotate_x: 0, rotate_y: 0, rotate_z: 0, rotate_angle: 0 }
                    newImgs.set(media.key, newImg);
                }
                break;
            }
            case "svg": {
                const m = newSvgs.get(media.key);
                if (!m) return;
                if (projectSvgIsTransformed(m)) {
                    const newSvg: LaurusProjectSvg = { ...m, scale_x: 1, scale_y: 1, rotate_x: 0, rotate_y: 0, rotate_z: 0, rotate_angle: 0 }
                    newSvgs.set(media.key, newSvg);
                }
                break;
            }
        }
        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs, svgs: newSvgs }
        const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
        if (updated) {
            dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch, media.key, media.type]);

    const cellStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '0px 6px',
        height: '100%',
    }

    return <>
        <div
            style={{
                position: 'absolute',
                display: 'flex',
                top: transform?.bounds.deltas.top ?? 0,
                left: transform?.bounds.deltas.left ?? 0,
                width: transform?.bounds.width ?? 0,
                height: transform?.bounds.height ?? 0,

            }}>
            <div style={{
                position: 'absolute',
                ...(media.meta.contextMenuConfig.position.toLowerCase().endsWith('right') && { left: '100%' }),
                ...(leftSide && { right: '100%' }),
                ...(bottomSide && { bottom: '0%' }),
                display: 'grid',
                height: (transform?.bounds.height ?? 0) < media.meta.contextMenuConfig.height ? media.meta.contextMenuConfig.height : '100%',
                gridTemplateColumns: `${media.meta.contextMenuConfig.width}px`,
                gridTemplateRows: 'auto',
                padding: leftSide ? '0px 8px 0px 0px' : '0px 0px 0px 8px',

            }}>
                <div style={{
                    gridColumn: 1,
                    gridRow: 1,
                    position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute',
                        width: media.meta.contextMenuConfig.width,
                        height: media.meta.contextMenuConfig.height,
                        backdropFilter: 'blur(10px)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        clipPath: dynamicClipPath.outer,
                        overflow: 'hidden',
                        display: 'grid',
                        fontSize: 12,
                    }} />
                    <div style={{
                        position: 'absolute',
                        left: leftSide ? 3 : 5,
                        top: 3,
                        width: media.meta.contextMenuConfig.width - 4,
                        height: media.meta.contextMenuConfig.height - 4,
                        background: 'rgba(0, 0, 0, 0.37)',
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gridTemplateRows: 'min-content auto',
                        fontSize: 12,
                        gap: 12,
                        letterSpacing: '2px',
                        textAlign: 'left',
                        overflowX: 'hidden',
                        whiteSpace: 'nowrap',
                        textWrap: 'nowrap',
                        padding: leftSide ? '10px 26px 10px 14px' : '10px 14px 10px 20px',
                        clipPath: dynamicClipPath.inner,
                    }}>
                        <div style={{ gridRow: 1, gridColumn: 1, display: 'grid', gap: 4 }}>
                            <div style={{ overflowX: 'auto', fontWeight: 'bold', fontSize: 14 }}>{media.meta.media_key}</div>
                            <div title='top left corner' style={{ display: 'flex' }}>
                                <div>{media.meta.top.toFixed()}{' | '}{media.meta.left.toFixed()}</div>
                            </div>
                        </div>
                        <div style={{ gridRow: 2, gridColumn: 1, display: 'grid', gap: 0, }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                height: '100%',
                                padding: '0px 6px 12px 6px'
                            }}>
                                <span style={{ opacity: selected ? 1 : 1 }}>
                                    {'selected'}
                                </span>
                                <div
                                    onClick={() => {
                                        if (selected) {
                                            dispatch({ type: WorkspaceActionType.SetActiveElement, value: undefined });
                                            return;
                                        }
                                        switch (media.type) {
                                            case "img": {
                                                const newActiveElement: LaurusActiveElement = {
                                                    key: media.key,
                                                    type: 'img',
                                                }
                                                dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                                break;
                                            }
                                            case "svg": {
                                                const newActiveElement: LaurusActiveElement = {
                                                    key: media.key,
                                                    type: 'svg',
                                                }
                                                dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                                                break;
                                            }
                                        }
                                    }}
                                    style={{
                                        cursor: 'pointer',
                                        position: 'relative',
                                        width: 34,
                                        height: 18,
                                        background: selected ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: 20,
                                        transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '2px',
                                        border: selected ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.2)',
                                        boxShadow: selected ? '0 0 6px 0px rgba(255, 255, 255, 0.2)' : 'none',
                                    }}>
                                    <div style={{
                                        width: 14,
                                        height: 14,
                                        background: 'radial-gradient(circle at 30% 30%, rgb(255, 255, 255) 0%, rgb(200, 200, 200) 45%, rgb(150, 150, 150) 100%)',
                                        borderRadius: '50%',
                                        transition: 'transform 0.2s',
                                        transform: selected ? 'translateX(15px)' : 'translateX(0px)',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                    }} />
                                </div>
                            </div>
                            <div
                                style={{ ...cellStyle }}
                                className={styles['animated-nav-dark']}
                                onClick={swapMedia}>
                                {'swap'}
                            </div>
                            <div style={{ ...cellStyle }} className={styles['animated-nav-dark']} onClick={() => { updateMediaOrder('increment') }}>{'move up'}</div>
                            <div style={{ ...cellStyle }} className={styles['animated-nav-dark']} onClick={() => { updateMediaOrder('decrement') }}>{'move down'}</div>
                            <div
                                className={revertEnabled ? styles['animated-nav-dark'] : ''}
                                style={{
                                    color: revertEnabled ? 'inherit' : 'rgba(127,127,127, 1)',
                                    ...cellStyle
                                }}
                                onClick={() => {
                                    if (!revertEnabled) return;
                                    revertMedia();
                                }}>
                                {'revert'}
                            </div>
                            <div
                                style={{ color: 'rgb(242, 83, 83)', ...cellStyle }}
                                className={styles['animated-nav-dark']}
                                onClick={async () => {
                                    const snapshot: LaurusProjectResult = { ...appState.project };
                                    switch (media.type) {
                                        case "img": {
                                            const newImgs: Map<string, LaurusProjectImg> = new Map(snapshot.imgs);
                                            newImgs.delete(media.key);
                                            deleteProjectMedia(snapshot, undefined, newImgs);
                                            break;
                                        }
                                        case "svg": {
                                            const newSvgs: Map<string, LaurusProjectSvg> = new Map(snapshot.svgs);
                                            newSvgs.delete(media.key);
                                            deleteProjectMedia(snapshot, newSvgs, undefined);
                                            break;
                                        }
                                    }

                                }}>
                                {'delete'}
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'end',
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                height: '100%',
                                paddingTop: 12
                            }}>
                                {appState.tool.type == 'none' ?
                                    <div title="active tool" style={{ width: 20, height: 20, display: 'grid', placeContent: 'center' }}>
                                        <RiToolsLine size={20} color="rgb(62, 62, 62)" />
                                    </div> :
                                    <SvgRepo
                                        title="active tool"
                                        svg={(() => {
                                            switch (appState.tool.type) {
                                                case "drop": return lassoSelect();
                                                case "contextmenu": return keyboardCommandKey();
                                                case "viewport": return browse();
                                                case "move": return earthquake();
                                                case "scale": return allOut();
                                                case "rotate": return toysFan();
                                            }
                                        })()}
                                        containerSize={{
                                            width: 20,
                                            height: 20
                                        }}
                                        scale={1} />
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>
}

