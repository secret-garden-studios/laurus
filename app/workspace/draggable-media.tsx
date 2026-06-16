'use client'
import LaurusImage from "../components/laurus-image";
import { useDraggable, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';
import {
    CoreContext,
    HoverContext,
    getNewContextMenuConfig,
    LaurusTransform,
    UIContext,
} from "./workspace.client";
import { RefObject, useCallback, useContext, useMemo, useState } from "react";
import { updateProject, DEFAULT_CONTEXT_MENU_CONFIG, LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "../projects/projects.server";
import ContextMenu from "./context-menu";
import { v4 } from "uuid";
import { Z_INDEX } from "./workspace.config";
import { LaurusFrame, LaurusImgResult } from "./workspace.server";
import { LaurusActiveElement, UIActionType } from "./states/ui-state";
import { CoreActionType } from "./states/core-state";

interface Point2D {
    x: number;
    y: number;
}
interface CornerTravel {
    topLeft: Point2D;
    topRight: Point2D;
    bottomLeft: Point2D;
    bottomRight: Point2D;
}
function calculate3DTravelWithPerspective(
    meta: LaurusProjectImg | LaurusProjectSvg,
    perspective: number = Infinity
): CornerTravel {
    const { width, height, scale_x, scale_y, rotate_x: rx, rotate_y: ry, rotate_z: rz, rotate_angle } = meta;
    const theta = rotate_angle * (Math.PI / 180);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const omc = 1 - cosT;

    const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (len === 0) {
        const zero = { x: 0, y: 0 };
        return { topLeft: zero, topRight: zero, bottomLeft: zero, bottomRight: zero };
    }

    const ux = rx / len;
    const uy = ry / len;
    const uz = rz / len;
    const r11 = cosT + ux * ux * omc;
    const r12 = ux * uy * omc - uz * sinT;
    const r13 = ux * uz * omc + uy * sinT;
    const r21 = uy * ux * omc + uz * sinT;
    const r22 = cosT + uy * uy * omc;
    const r23 = uy * uz * omc - ux * sinT;
    const r31 = uz * ux * omc - uy * sinT;
    const r32 = uz * uy * omc + ux * sinT;
    const r33 = cosT + uz * uz * omc;
    const scaledW = width * scale_x;
    const scaledH = height * scale_y;

    const getTravel = (origX: number, origY: number, origZ: number): Point2D => {
        const rotX = r11 * origX + r12 * origY + r13 * origZ;
        const rotY = r21 * origX + r22 * origY + r23 * origZ;
        const rotZ = r31 * origX + r32 * origY + r33 * origZ;
        const f = perspective === Infinity ? 1 : perspective / (perspective - rotZ);
        const projX = rotX * f;
        const projY = rotY * f;
        return {
            x: projX - origX,
            y: projY - origY
        };
    };

    return {
        topLeft: getTravel(0, 0, 0),
        topRight: getTravel(scaledW, 0, 0),
        bottomLeft: getTravel(0, scaledH, 0),
        bottomRight: getTravel(scaledW, scaledH, 0),
    };
}

function calculateBoundingDeltas(
    meta: LaurusProjectImg | LaurusProjectSvg
): {
    top: number;
    right: number;
    bottom: number;
    left: number;
} {
    const { width, height, scale_x, scale_y } = meta;
    const travel = calculate3DTravelWithPerspective(meta);
    const scaledW = width * scale_x;
    const scaledH = height * scale_y;
    const newX = [
        0 + travel.topLeft.x,
        scaledW + travel.topRight.x,
        0 + travel.bottomLeft.x,
        scaledW + travel.bottomRight.x
    ];
    const newY = [
        0 + travel.topLeft.y,
        0 + travel.topRight.y,
        scaledH + travel.bottomLeft.y,
        scaledH + travel.bottomRight.y
    ];
    return {
        top: Math.min(...newY),
        right: Math.max(...newX) - width,
        bottom: Math.max(...newY) - height,
        left: Math.min(...newX)
    };
}

function calculateTransformedBounds(
    meta: LaurusProjectImg | LaurusProjectSvg
): {
    width: number,
    height: number,
    deltas: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    }
} {
    const { width, height } = meta;
    const deltas = calculateBoundingDeltas(
        meta
    );
    return {
        width: width + deltas.right - deltas.left,
        height: height + deltas.bottom - deltas.top,
        deltas
    };
}

interface ProjectImg {
    dndId: string
    dndPosition: { x: number, y: number },
    zIndex: number,
    maxZIndex: number,
    mediaKey: string,
    meta: LaurusProjectImg,
    data: LaurusImgResult,
    framesCacheRef: RefObject<Map<string, LaurusFrame[]>>,
    onClick: (metaKey: boolean) => void,
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    refKey?: string,
    title?: string,
    transform?: LaurusTransform,
}
function ProjectImg({
    dndId,
    dndPosition,
    zIndex,
    maxZIndex,
    mediaKey,
    meta,
    data,
    framesCacheRef,
    onClick,
    onImgRef,
    refKey,
    title,
    transform }: ProjectImg) {
    const { uiState } = useContext(UIContext);
    const { isMetaKeyPressed, selectedImgKeys } = useContext(HoverContext);
    const [isHovered, setIsHovered] = useState(false);
    const isSelected = selectedImgKeys.has(mediaKey);
    const dragDisabled = useMemo(() => {
        return uiState.tool.type != 'move';
    }, [uiState.tool.type]);
    const isStackable = useMemo(() => {
        return uiState.tool.type === 'marquee' && uiState.tool.stack
    }, [uiState.tool]);
    const { attributes, listeners, setNodeRef, transform: dndTransform, isDragging } =
        useDraggable({
            id: dndId,
            disabled: dragDisabled ?? false
        });
    const dndCss = {
        left: dndPosition.x,
        top: dndPosition.y,
        transform: CSS.Translate.toString(dndTransform),
        touchAction: 'none',
    };

    const imgCursor = useMemo(() => {
        return (isMetaKeyPressed && uiState.tool.type === 'marquee' && uiState.tool.select)
            ? 'crosshair'
            : (isMetaKeyPressed && uiState.tool.type !== 'viewport' && uiState.tool.type !== 'move')
                ? 'context-menu'
                : (isStackable || uiState.tool.type === 'scale')
                    ? 'crosshair'
                    : dragDisabled ? '' : isDragging ? 'grabbing' : 'grab'
    }, [uiState.tool, dragDisabled, isDragging, isMetaKeyPressed, isStackable]);

    return <>
        <div
            ref={setNodeRef}
            style={{
                ...dndCss,
                position: 'absolute',
                width: meta.width * meta.scale_x,
                height: meta.height * meta.scale_y,
                zIndex: meta.showContextMenu ? Z_INDEX.CONTEXT_MENU_OFFSET + maxZIndex + zIndex : zIndex,
            }} >
            <div>
                <div
                    {...listeners}
                    {...attributes}
                    title={title}
                    style={{
                        ...(transform && { ...transform.cssProps }),
                        position: 'relative',
                        zIndex: Z_INDEX.ITEM_CONTENT,
                        cursor: imgCursor,
                    }} >
                    <LaurusImage
                        onClick={(e) => onClick(e.metaKey)}
                        onMouseEnter={() => {
                            setIsHovered(true);
                        }}
                        onMouseLeave={() => {
                            setIsHovered(false);
                        }}
                        imgRef={(r) => {
                            if (onImgRef && refKey) {
                                onImgRef(r, `${refKey}`);
                            }
                        }}
                        draggable={false}
                        alt={data.media_key}
                        src={data.src}
                        fill
                        style={{
                            objectFit: 'cover',
                            cursor: 'inherit',
                            outline: (isSelected)
                                ? '2px solid rgba(66, 133, 244, 1)'
                                : (isStackable && isHovered)
                                    ? '2px solid rgba(255, 255, 255, 0.9)'
                                    : meta.showContextMenu
                                        ? '1px solid rgba(255, 255, 255, 0.175)'
                                        : 'none',
                            backdropFilter: meta.showContextMenu ? 'blur(10px)' : 'none',
                            background: meta.showContextMenu ? `
                                linear-gradient(to right, rgba(255, 255, 255, 0.055) 0.5px, transparent 1px) 0 0 / 20px 20px,
                                linear-gradient(to bottom, rgba(255, 255, 255, 0.055) 0.5px, transparent 1px) 0 0 / 20px 20px,
                                linear-gradient(45deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0.005))
                            `
                                : 'none',
                        }}
                    />
                </div>
                {meta.showContextMenu &&
                    <ContextMenu
                        media={{
                            key: mediaKey,
                            type: 'img',
                            meta: meta,
                        }}
                        framesCacheRef={framesCacheRef}
                        transform={transform} />
                }
            </div>
        </div>
    </>
}

interface ProjectSvg {
    dndId: string
    dndPosition: { x: number, y: number },
    zIndex: number,
    maxZIndex: number,
    mediaKey: string,
    meta: LaurusProjectSvg,
    decodedString: string,
    framesCacheRef: RefObject<Map<string, LaurusFrame[]>>,
    onClick: (metaKey: boolean) => void,
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    refKey?: string,
    title?: string,
    transform?: LaurusTransform,
}
function ProjectSvg({
    dndId,
    dndPosition,
    zIndex,
    maxZIndex,
    mediaKey,
    meta,
    decodedString,
    framesCacheRef,
    onClick,
    onSvgRef,
    refKey,
    title,
    transform }: ProjectSvg) {
    const { uiState } = useContext(UIContext);
    const { isMetaKeyPressed, selectedSvgKeys } = useContext(HoverContext);
    const isSelected = selectedSvgKeys.has(mediaKey);

    const dragDisabled = useMemo(() => {
        return uiState.tool.type != 'move';
    }, [uiState.tool.type]);
    const isStackable = useMemo(() => {
        return uiState.tool.type === 'marquee' && uiState.tool.stack
    }, [uiState.tool]);
    const { attributes, listeners, setNodeRef, transform: dndTransform, isDragging } =
        useDraggable({
            id: dndId,
            disabled: dragDisabled ?? false
        });
    const [isHovered, setIsHovered] = useState(false);
    const containerSize = useMemo(() => {
        return {
            width: meta.width * meta.scale_x,
            height: meta.height * meta.scale_y
        }
    }, [meta.height, meta.scale_x, meta.scale_y, meta.width]);
    const dndCss = {
        left: dndPosition.x,
        top: dndPosition.y,
        transform: CSS.Translate.toString(dndTransform),
        touchAction: 'none',
    };

    const svgCursor = useMemo(() => {
        return (isMetaKeyPressed && uiState.tool.type === 'marquee' && uiState.tool.select)
            ? 'crosshair'
            : (isMetaKeyPressed && uiState.tool.type !== 'viewport' && uiState.tool.type !== 'move')
                ? 'context-menu'
                : (isStackable || uiState.tool.type === 'scale')
                    ? 'crosshair'
                    : dragDisabled ? '' : isDragging ? 'grabbing' : 'grab'
    }, [uiState.tool, dragDisabled, isDragging, isMetaKeyPressed, isStackable]);

    return <>
        <div
            ref={setNodeRef}
            style={{
                ...dndCss,
                position: 'absolute',
                ...containerSize,
                zIndex: meta.showContextMenu ? Z_INDEX.CONTEXT_MENU_OFFSET + maxZIndex + zIndex : zIndex,
            }} >
            <div
                {...listeners}
                {...attributes}
                title={title}
                onClick={(e) => onClick(e.metaKey)}
                onMouseEnter={() => {
                    setIsHovered(true);
                }}
                onMouseLeave={() => {
                    setIsHovered(false);
                }}
                style={{
                    ...(transform && { ...transform.cssProps }),
                    position: 'relative',
                    zIndex: Z_INDEX.ITEM_CONTENT,
                    cursor: svgCursor,
                }}>
                <div
                    style={{
                        ...containerSize,
                        display: 'grid',
                        placeContent: 'center',
                        cursor: 'inherit',
                        outline: (isSelected)
                            ? '2px solid rgba(66, 133, 244, 1)'
                            : (isStackable && isHovered)
                                ? '2px solid rgba(255, 255, 255, 0.9)'
                                : meta.showContextMenu
                                    ? '1px solid rgba(255, 255, 255, 0.175)'
                                    : 'none',
                        backdropFilter: meta.showContextMenu ? 'blur(10px)' : 'none',
                        background: meta.showContextMenu ? `
                                linear-gradient(to right, rgba(255, 255, 255, 0.055) 0.5px, transparent 1px) 0 0 / 20px 20px,
                                linear-gradient(to bottom, rgba(255, 255, 255, 0.055) 0.5px, transparent 1px) 0 0 / 20px 20px,
                                linear-gradient(45deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0.005))
                            `
                            : 'none',
                    }}>
                    {decodedString &&
                        <svg
                            ref={(r) => {
                                if (onSvgRef && refKey) {
                                    onSvgRef(r, `${refKey}`);
                                }
                            }}
                            version="1.1"
                            width={containerSize.width}
                            height={containerSize.height}
                            fill={meta.fill}
                            stroke={meta.stroke}
                            strokeWidth={meta.stroke_width}
                            viewBox={meta.viewbox}
                            dangerouslySetInnerHTML={{ __html: decodedString }} />
                    }
                </div>
            </div>
            {meta.showContextMenu &&
                <ContextMenu
                    media={{
                        key: mediaKey,
                        type: 'svg',
                        meta: meta,
                    }}
                    framesCacheRef={framesCacheRef}
                    transform={transform} />
            }
        </div>
    </>
}

interface DraggableProjectImg {
    mediaKey: string
    data: LaurusImgResult,
    meta: LaurusProjectImg,
    zIndex: number,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    framesCacheRef: RefObject<Map<string, LaurusFrame[]>>,
    refKey?: string,
}
export function DraggableProjectImg({
    mediaKey,
    data,
    meta,
    zIndex,
    imgElementsRef,
    framesCacheRef,
    refKey }: DraggableProjectImg) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const { selectedImgKeys, selectedSvgKeys, setSelectedImgKeys } = useContext(HoverContext);
    const transformedBounds = useMemo(() => { return calculateTransformedBounds(meta) }, [meta]);
    const dndPosition = useMemo(() => {
        switch (uiState.tool.type) {
            case "viewport": {
                return {
                    x: (meta.left - appState.project.frame_left),
                    y: (meta.top - appState.project.frame_top)
                }
            }
            default: {
                return {
                    x: Math.max(0, meta.left),
                    y: Math.max(0, meta.top)
                }
            }
        }
    }, [appState.project.frame_left, appState.project.frame_top, uiState.tool.type, meta.left, meta.top]);
    const laurusTransform = useMemo<LaurusTransform>(() => {
        return {
            cssProps: {
                perspective: 750,
                width: meta.width * meta.scale_x,
                height: meta.height * meta.scale_y,
                transform: `rotate3d(${meta.rotate_x},${meta.rotate_y},${meta.rotate_z},${meta.rotate_angle}deg)`,
                transition: 'transform 0.25s ease-out',
                transformOrigin: 'top left'
            },
            bounds: { ...transformedBounds }
        }
    }, [meta.height, meta.rotate_angle, meta.rotate_x, meta.rotate_y, meta.rotate_z, meta.scale_x, meta.scale_y, meta.width, transformedBounds]);
    const highestOrder = useMemo(() => {
        let max = 0;
        for (const img of appState.project.imgs.values()) {
            if (img.order > max) max = img.order;
        }
        for (const svg of appState.project.svgs.values()) {
            if (svg.order > max) max = svg.order;
        }
        return max;
    }, [appState.project.imgs, appState.project.svgs]);

    const sensors = useSensors(
        useSensor(PointerSensor)
    );

    const lazyLoadImgElementsRef = () => {
        if (!imgElementsRef.current) {
            imgElementsRef.current = new Map();
        }
        return imgElementsRef.current;
    };


    const onImgRef = (element: HTMLImageElement | null, refKey: string) => {
        const m = lazyLoadImgElementsRef();
        if (element) {
            m.set(refKey, element);
        }
        else {
            m.delete(refKey);
        }
    };

    const onNewImgPosition = useCallback(async (deltaX: number, deltaY: number) => {
        const rollback: LaurusProjectResult = { ...appState.project };
        const newImgs = new Map(appState.project.imgs);
        const newSvgs = new Map(appState.project.svgs);
        const updateItem = (itemKey: string, itemType: 'img' | 'svg') => {
            const itemMeta = itemType === 'img' ? newImgs.get(itemKey) : newSvgs.get(itemKey);
            if (!itemMeta) return;
            const bounds = calculateTransformedBounds(itemMeta);
            let newLeft = Math.min(appState.project.canvas_width - itemMeta.width, Math.max(0, Math.round(itemMeta.left + deltaX)));
            let newTop = Math.min(appState.project.canvas_height - itemMeta.height, Math.max(0, Math.round(itemMeta.top + deltaY)));
            const yMaxActual = newTop + itemMeta.height + bounds.deltas.bottom;
            const xMaxActual = newLeft + itemMeta.width + bounds.deltas.right;
            const yMinActual = newTop + bounds.deltas.top;
            const xMinActual = newLeft + bounds.deltas.left;
            if (yMaxActual > appState.project.canvas_height) newTop -= (yMaxActual - appState.project.canvas_height);
            if (xMaxActual > appState.project.canvas_width) newLeft -= (xMaxActual - appState.project.canvas_width);
            if (yMinActual < 0) newTop += Math.abs(yMinActual);
            if (xMinActual < 0) newLeft += Math.abs(xMinActual);
            const nContextMenuConfig = getNewContextMenuConfig(
                { left: newLeft, top: newTop },
                { width: appState.project.canvas_width, height: appState.project.canvas_height },
                { ...itemMeta },
                { x: itemMeta.scale_x, y: itemMeta.scale_y },
                itemMeta.contextMenuConfig);
            if (itemType === 'img') {
                newImgs.set(itemKey, { ...itemMeta as LaurusProjectImg, left: newLeft, top: newTop, contextMenuConfig: nContextMenuConfig });
            } else {
                newSvgs.set(itemKey, { ...itemMeta as LaurusProjectSvg, left: newLeft, top: newTop, contextMenuConfig: nContextMenuConfig });
            }
        };

        updateItem(mediaKey, 'img');
        selectedImgKeys.forEach(key => {
            if (key !== mediaKey) updateItem(key, 'img');
        });
        selectedSvgKeys.forEach(key => {
            updateItem(key, 'svg');
        });

        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs, svgs: newSvgs };
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        if (newProject.project_id) {
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (!updated) {
                dispatch({ type: CoreActionType.SetProject, value: rollback });
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch, mediaKey, selectedImgKeys, selectedSvgKeys]);

    const onImgStackDrop = useCallback(async () => {
        if (!uiState.browserElement) return;
        const browserElement = { ...uiState.browserElement };
        const snapshot = { ...appState.project };
        const newKey = v4();
        const maxOrder = Math.max(
            ...Array.from(snapshot.imgs.values()).map(i => i.order),
            ...Array.from(snapshot.svgs.values()).map(s => s.order),
            -1
        );

        if (browserElement.type === 'img') {
            const newProjectImg: LaurusProjectImg = {
                ...meta,
                media_key: browserElement.value.media_key,
                img_media_id: browserElement.value.img_media_id,
                order: maxOrder + 1,
                showContextMenu: false,
                contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
            } as LaurusProjectImg;
            const newImgs = new Map(snapshot.imgs);
            newImgs.set(newKey, newProjectImg);
            const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs };
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (updated) {
                dispatch({ type: CoreActionType.SetProject, value: newProject });
                const encodedImg = uiState.browserImgs.find(i => i.media_key === browserElement.value.media_key);
                if (encodedImg) {
                    dispatch({ type: CoreActionType.SetCanvasImg, key: newKey, value: { ...encodedImg } });
                    uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: 'img', key: newKey } });
                }
            }
        } else if (browserElement.type === 'svg') {
            const newProjectSvg: LaurusProjectSvg = {
                ...meta,
                media_key: browserElement.value.media_key,
                svg_media_id: browserElement.value.svg_media_id,
                viewbox: browserElement.value.viewbox,
                fill: browserElement.value.fill,
                stroke: browserElement.value.stroke,
                stroke_width: browserElement.value.stroke_width,
                order: maxOrder + 1,
                showContextMenu: false,
                contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
            } as LaurusProjectSvg;
            const newSvgs = new Map(snapshot.svgs);
            newSvgs.set(newKey, newProjectSvg);
            const newProject: LaurusProjectResult = { ...snapshot, svgs: newSvgs };
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (updated) {
                dispatch({ type: CoreActionType.SetProject, value: newProject });
                const encodedSvg = uiState.browserSvgs.find(i => i.media_key === browserElement.value.media_key);
                if (encodedSvg) {
                    dispatch({ type: CoreActionType.SetCanvasSvg, key: newKey, value: { ...encodedSvg } });
                    uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: 'svg', key: newKey } });
                }
            }
        }
    }, [uiState.browserElement, uiState.browserImgs, uiState.browserSvgs, appState.project, appState.apiOrigin, appState.accessToken, meta, dispatch, uiDispatch]);

    const onImgClick = useCallback((metaKey: boolean) => {
        if (metaKey && uiState.tool.type === 'marquee' && uiState.tool.select) {
            setSelectedImgKeys(prev => {
                const next = new Set(prev);
                if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                } else {
                    next.add(mediaKey);
                }
                return next;
            });
        }
        else if (metaKey && uiState.tool.type !== 'viewport') {
            const newContextMenuConfig = getNewContextMenuConfig(
                { ...meta },
                { width: appState.project.canvas_width, height: appState.project.canvas_height },
                { ...meta },
                { x: meta.scale_x, y: meta.scale_y },
                meta.contextMenuConfig);
            const newImg: LaurusProjectImg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
            dispatch({ type: CoreActionType.SetProjectImg, key: mediaKey, value: newImg });
            const inactiveImgs = Array.from(appState.project.imgs.entries()).filter(i => i[0] != mediaKey);
            const inactiveSvgs = Array.from(appState.project.svgs.entries());
            inactiveImgs.forEach(i => {
                dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
            inactiveSvgs.forEach(i => {
                dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
        }
        else {
            if (uiState.tool.type === 'marquee' && uiState.tool.stack) {
                onImgStackDrop();
                return;
            }
            switch (uiState.tool.type) {
                case "marquee": { break; }
                case "none": { break; }
                case "contextmenu": {
                    const newContextMenuConfig = getNewContextMenuConfig(
                        { ...meta },
                        { width: appState.project.canvas_width, height: appState.project.canvas_height },
                        { ...meta },
                        { x: meta.scale_x, y: meta.scale_y },
                        meta.contextMenuConfig);
                    const newImg: LaurusProjectImg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
                    dispatch({ type: CoreActionType.SetProjectImg, key: mediaKey, value: newImg });
                    const inactiveImgs = Array.from(appState.project.imgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveSvgs = Array.from(appState.project.svgs.entries());
                    inactiveImgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
                case "viewport": { break; }
                case "move": { break; }
                case "scale": {
                    setSelectedImgKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(mediaKey)) {
                            next.delete(mediaKey);
                        } else {
                            next.add(mediaKey);
                        }
                        return next;
                    });
                    break;
                }
                case "rotate": {
                    const newActiveElement: LaurusActiveElement = {
                        key: mediaKey,
                        type: 'img',
                    };
                    uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                    dispatch({ type: CoreActionType.SetProjectImg, key: mediaKey, value: { ...meta, showContextMenu: true } });
                    const inactiveImgs = Array.from(appState.project.imgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveSvgs = Array.from(appState.project.svgs.entries());
                    inactiveImgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
            }
        }
    }, [uiState.tool, setSelectedImgKeys, mediaKey, meta, appState.project.canvas_width, appState.project.canvas_height, appState.project.imgs, appState.project.svgs, dispatch, onImgStackDrop, uiDispatch]);

    return (<>
        <DndContext
            id={`dnd-context-${mediaKey}`}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = '';
                const delta = e.delta;
                onNewImgPosition(delta.x, delta.y);
            }}>
            <ProjectImg
                dndId={`dnd-node-${mediaKey}`}
                dndPosition={dndPosition}
                zIndex={zIndex}
                maxZIndex={highestOrder}
                mediaKey={mediaKey}
                meta={meta}
                data={data}
                framesCacheRef={framesCacheRef}
                onClick={onImgClick}
                onImgRef={onImgRef}
                refKey={refKey}
                title={meta.media_key}
                transform={laurusTransform} />
        </DndContext>
    </>)
}

interface DraggableProjectSvg {
    mediaKey: string
    decodedString: string,
    meta: LaurusProjectSvg,
    zIndex: number,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    framesCacheRef: RefObject<Map<string, LaurusFrame[]>>,
    refKey?: string,
}
export function DraggableProjectSvg({
    mediaKey,
    decodedString,
    meta,
    zIndex,
    svgElementsRef,
    framesCacheRef,
    refKey }: DraggableProjectSvg) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const { selectedImgKeys, selectedSvgKeys, setSelectedSvgKeys } = useContext(HoverContext);
    const transformedBounds = useMemo(() => { return calculateTransformedBounds(meta) }, [meta]);
    const dndPosition = useMemo(() => {
        switch (uiState.tool.type) {
            case "viewport": {
                return {
                    x: (meta.left - appState.project.frame_left),
                    y: (meta.top - appState.project.frame_top)
                }
            }
            default: {
                return {
                    x: Math.max(0, meta.left),
                    y: Math.max(0, meta.top)
                }
            }
        }
    }, [appState.project.frame_left, appState.project.frame_top, uiState.tool.type, meta.left, meta.top]);
    const laurusTransform = useMemo<LaurusTransform>(() => {
        return {
            cssProps: {
                perspective: 750,
                width: meta.width * meta.scale_x,
                height: meta.height * meta.scale_y,
                transform: `rotate3d(${meta.rotate_x},${meta.rotate_y},${meta.rotate_z},${meta.rotate_angle}deg)`,
                transition: 'transform 0.25s ease-out',
                transformOrigin: 'top left'
            },
            bounds: { ...transformedBounds }
        }
    }, [meta.height, meta.rotate_angle, meta.rotate_x, meta.rotate_y, meta.rotate_z, meta.scale_x, meta.scale_y, meta.width, transformedBounds]);
    const highestOrder = useMemo(() => {
        let max = 0;
        for (const img of appState.project.imgs.values()) {
            if (img.order > max) max = img.order;
        }
        for (const svg of appState.project.svgs.values()) {
            if (svg.order > max) max = svg.order;
        }
        return max;
    }, [appState.project.imgs, appState.project.svgs]);

    const sensors = useSensors(
        useSensor(PointerSensor)
    );

    const lazyLoadSvgElementsRef = () => {
        if (!svgElementsRef.current) {
            svgElementsRef.current = new Map();
        }
        return svgElementsRef.current;
    };

    const onSvgRef = (element: SVGSVGElement | null, refKey: string) => {
        const m = lazyLoadSvgElementsRef();
        if (element) {
            m.set(refKey, element);
        }
        else {
            m.delete(refKey);
        }
    };

    const onNewSvgPosition = useCallback(async (deltaX: number, deltaY: number) => {
        const rollback: LaurusProjectResult = { ...appState.project };
        const newImgs = new Map(appState.project.imgs);
        const newSvgs = new Map(appState.project.svgs);
        const updateItem = (itemKey: string, itemType: 'img' | 'svg') => {
            const itemMeta = itemType === 'img' ? newImgs.get(itemKey) : newSvgs.get(itemKey);
            if (!itemMeta) return;
            const bounds = calculateTransformedBounds(itemMeta);
            let newLeft = Math.min(appState.project.canvas_width - itemMeta.width, Math.max(0, Math.round(itemMeta.left + deltaX)));
            let newTop = Math.min(appState.project.canvas_height - itemMeta.height, Math.max(0, Math.round(itemMeta.top + deltaY)));
            const yMaxActual = newTop + itemMeta.height + bounds.deltas.bottom;
            const xMaxActual = newLeft + itemMeta.width + bounds.deltas.right;
            const yMinActual = newTop + bounds.deltas.top;
            const xMinActual = newLeft + bounds.deltas.left;
            if (yMaxActual > appState.project.canvas_height) newTop -= (yMaxActual - appState.project.canvas_height);
            if (xMaxActual > appState.project.canvas_width) newLeft -= (xMaxActual - appState.project.canvas_width);
            if (yMinActual < 0) newTop += Math.abs(yMinActual);
            if (xMinActual < 0) newLeft += Math.abs(xMinActual);
            const nContextMenuConfig = getNewContextMenuConfig(
                { left: newLeft, top: newTop },
                { width: appState.project.canvas_width, height: appState.project.canvas_height },
                { ...itemMeta },
                { x: itemMeta.scale_x, y: itemMeta.scale_y },
                itemMeta.contextMenuConfig);
            if (itemType === 'img') {
                newImgs.set(itemKey, { ...itemMeta as LaurusProjectImg, left: newLeft, top: newTop, contextMenuConfig: nContextMenuConfig });
            } else {
                newSvgs.set(itemKey, { ...itemMeta as LaurusProjectSvg, left: newLeft, top: newTop, contextMenuConfig: nContextMenuConfig });
            }
        };

        updateItem(mediaKey, 'svg');
        selectedImgKeys.forEach(key => {
            updateItem(key, 'img');
        });
        selectedSvgKeys.forEach(key => {
            if (key !== mediaKey) updateItem(key, 'svg');
        });

        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs, svgs: newSvgs };
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        if (newProject.project_id) {
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (!updated) {
                dispatch({ type: CoreActionType.SetProject, value: rollback });
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch, mediaKey, selectedImgKeys, selectedSvgKeys]);

    const onSvgStackDrop = useCallback(async () => {
        if (!uiState.browserElement) return;
        const browserElement = { ...uiState.browserElement };
        const snapshot = { ...appState.project };
        const newKey = v4();
        const maxOrder = Math.max(
            ...Array.from(snapshot.imgs.values()).map(i => i.order),
            ...Array.from(snapshot.svgs.values()).map(s => s.order),
            -1
        );

        if (browserElement.type === 'img') {
            const newProjectImg: LaurusProjectImg = {
                ...meta,
                media_key: browserElement.value.media_key,
                img_media_id: browserElement.value.img_media_id,
                order: maxOrder + 1,
                showContextMenu: false,
                contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
            } as LaurusProjectImg;
            const newImgs = new Map(snapshot.imgs);
            newImgs.set(newKey, newProjectImg);
            const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs };
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (updated) {
                dispatch({ type: CoreActionType.SetProject, value: newProject });
                const encodedImg = uiState.browserImgs.find(i => i.media_key === browserElement.value.media_key);
                if (encodedImg) {
                    dispatch({ type: CoreActionType.SetCanvasImg, key: newKey, value: { ...encodedImg } });
                    uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: 'img', key: newKey } });
                }
            }
        } else if (browserElement.type === 'svg') {
            const newProjectSvg: LaurusProjectSvg = {
                ...meta,
                media_key: browserElement.value.media_key,
                svg_media_id: browserElement.value.svg_media_id,
                viewbox: browserElement.value.viewbox,
                fill: browserElement.value.fill,
                stroke: browserElement.value.stroke,
                stroke_width: browserElement.value.stroke_width,
                order: maxOrder + 1,
                showContextMenu: false,
                contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
            } as LaurusProjectSvg;
            const newSvgs = new Map(snapshot.svgs);
            newSvgs.set(newKey, newProjectSvg);
            const newProject: LaurusProjectResult = { ...snapshot, svgs: newSvgs };
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (updated) {
                dispatch({ type: CoreActionType.SetProject, value: newProject });
                const encodedSvg = uiState.browserSvgs.find(i => i.media_key === browserElement.value.media_key);
                if (encodedSvg) {
                    dispatch({ type: CoreActionType.SetCanvasSvg, key: newKey, value: { ...encodedSvg } });
                    uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: 'svg', key: newKey } });
                }
            }
        }
    }, [uiState.browserElement, uiState.browserImgs, uiState.browserSvgs, appState.project, appState.apiOrigin, appState.accessToken, meta, dispatch, uiDispatch]);

    const onSvgClick = useCallback((metaKey: boolean) => {
        if (metaKey && uiState.tool.type === 'marquee' && uiState.tool.select) {
            setSelectedSvgKeys(prev => {
                const next = new Set(prev);
                if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                } else {
                    next.add(mediaKey);
                }
                return next;
            });
        }
        else if (metaKey && uiState.tool.type !== 'viewport') {
            const newContextMenuConfig = getNewContextMenuConfig(
                { ...meta },
                { width: appState.project.canvas_width, height: appState.project.canvas_height },
                { ...meta },
                { x: meta.scale_x, y: meta.scale_y },
                meta.contextMenuConfig);
            const newSvg: LaurusProjectSvg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
            dispatch({ type: CoreActionType.SetProjectSvg, key: mediaKey, value: newSvg });
            const inactiveSvgs = Array.from(appState.project.svgs.entries()).filter(i => i[0] != mediaKey);
            const inactiveImgs = Array.from(appState.project.imgs.entries());
            inactiveSvgs.forEach(i => {
                dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
            inactiveImgs.forEach(i => {
                dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
        }
        else {
            if (uiState.tool.type === 'marquee' && uiState.tool.stack) {
                onSvgStackDrop();
                return;
            }
            switch (uiState.tool.type) {
                case "marquee": { break; }
                case "none": { break; }
                case "contextmenu": {
                    const newContextMenuConfig = getNewContextMenuConfig(
                        { ...meta },
                        { width: appState.project.canvas_width, height: appState.project.canvas_height },
                        { ...meta },
                        { x: meta.scale_x, y: meta.scale_y },
                        meta.contextMenuConfig);
                    const newSvg: LaurusProjectSvg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
                    dispatch({ type: CoreActionType.SetProjectSvg, key: mediaKey, value: newSvg });
                    const inactiveSvgs = Array.from(appState.project.svgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveImgs = Array.from(appState.project.imgs.entries());
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveImgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
                case "viewport": { break; }
                case "move": { break; }
                case "scale": {
                    setSelectedSvgKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(mediaKey)) {
                            next.delete(mediaKey);
                        } else {
                            next.add(mediaKey);
                        }
                        return next;
                    });
                    break;
                }
                case "rotate": {
                    const newActiveElement: LaurusActiveElement = {
                        key: mediaKey,
                        type: 'svg',
                    };
                    uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                    dispatch({ type: CoreActionType.SetProjectSvg, key: mediaKey, value: { ...meta, showContextMenu: true } });
                    const inactiveSvgs = Array.from(appState.project.svgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveImgs = Array.from(appState.project.imgs.entries());
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveImgs.forEach(i => {
                        dispatch({ type: CoreActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
            }
        }
    }, [uiState.tool, setSelectedSvgKeys, mediaKey, meta, appState.project.canvas_width, appState.project.canvas_height, appState.project.svgs, appState.project.imgs, dispatch, onSvgStackDrop, uiDispatch]);

    return (<>
        <DndContext
            id={`dnd-context-${mediaKey}`}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = '';
                const delta = e.delta;
                onNewSvgPosition(delta.x, delta.y);
            }}>
            <ProjectSvg
                title={meta.media_key}
                dndId={`dnd-node-${mediaKey}`}
                dndPosition={dndPosition}
                zIndex={zIndex}
                maxZIndex={highestOrder}
                mediaKey={mediaKey}
                meta={meta}
                decodedString={decodedString}
                framesCacheRef={framesCacheRef}
                onClick={onSvgClick}
                onSvgRef={onSvgRef}
                refKey={refKey}
                transform={laurusTransform} />
        </DndContext>
    </>)
}