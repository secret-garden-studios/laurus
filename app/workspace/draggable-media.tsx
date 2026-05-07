'use client'
import Image from "next/image";
import { useDraggable, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';
import { LaurusImgResult, LaurusSvgResult, WorkspaceContext, WorkspaceActionType, getNewContextMenuConfig, LaurusActiveElement, LaurusTransform } from "./workspace.client";
import { RefObject, useCallback, useContext, useMemo } from "react";
import { updateProject } from "../projects/projects.server";
import { LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "../projects/projects.client";
import ContextMenu from "./context-menu";

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
    onClick: (metaKey: boolean) => void,
    onMouseEnter?: () => void,
    onMouseLeave?: () => void,
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    refKey?: string,
    transform?: LaurusTransform,
    disabled?: { value: boolean, cursor: string },
}
function ProjectImg({ dndId, dndPosition, zIndex, maxZIndex, mediaKey, meta, data, onClick, onMouseEnter, onMouseLeave, onImgRef, refKey, transform, disabled }: ProjectImg) {
    const { attributes, listeners, setNodeRef, transform: dndTransform, isDragging } = useDraggable({ id: dndId, disabled: disabled?.value ?? false });
    const dndCss = {
        left: dndPosition.x,
        top: dndPosition.y,
        transform: CSS.Translate.toString(dndTransform),
        touchAction: 'none',
    };

    return <>
        <div
            ref={setNodeRef}
            style={{
                ...dndCss,
                cursor: disabled?.value ? disabled.cursor : '',
                position: 'absolute',
                width: meta.width * meta.scale_x,
                height: meta.height * meta.scale_y,
                zIndex: meta.showContextMenu ? maxZIndex + zIndex + 1 : zIndex,
            }} >
            <div>
                <div
                    {...listeners}
                    {...attributes}
                    style={{
                        cursor: disabled?.value ? disabled.cursor : isDragging ? 'grabbing' : 'grab',
                        ...(transform && { ...transform.cssProps }),
                        position: 'relative',
                        zIndex: 1,
                    }} >
                    <Image
                        onClick={(e) => onClick(e.metaKey)}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        ref={(r) => {
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
                            outline: meta.showContextMenu ? '1px solid rgba(255, 255, 255, 0.175)' : 'none',
                            borderRadius: meta.showContextMenu ? 6 : 0,
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
                            data: data,
                        }}
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
    data: LaurusSvgResult,
    onClick: (metaKey: boolean) => void,
    onMouseEnter?: () => void,
    onMouseLeave?: () => void,
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    refKey?: string,
    title?: string,
    transform?: LaurusTransform,
    disabled?: { value: boolean, cursor: string },
}
function ProjectSvg({ dndId, dndPosition, zIndex, maxZIndex, mediaKey, meta, data, onClick, onMouseEnter, onMouseLeave, onSvgRef, refKey, title, transform, disabled }: ProjectSvg) {
    const { attributes, listeners, setNodeRef, transform: dndTransform, isDragging } = useDraggable({ id: dndId, disabled: disabled?.value ?? false });
    const dndCss = {
        left: dndPosition.x,
        top: dndPosition.y,
        transform: CSS.Translate.toString(dndTransform),
        touchAction: 'none',
    };
    const decodedString = decodeURIComponent(
        atob(data.markup)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
    );
    const containerSize = useMemo(() => {
        return {
            width: meta.width * meta.scale_x,
            height: meta.height * meta.scale_y
        }
    }, [meta.height, meta.scale_x, meta.scale_y, meta.width]);

    return <>
        <div
            ref={setNodeRef}
            style={{
                ...dndCss,
                cursor: disabled?.value ? disabled.cursor : '',
                position: 'absolute',
                ...containerSize,
                zIndex: meta.showContextMenu ? maxZIndex + zIndex + 1 : zIndex,
            }} >
            <div
                {...listeners}
                {...attributes}
                style={{
                    cursor: disabled?.value ? disabled.cursor : isDragging ? 'grabbing' : 'grab',
                    ...(transform && { ...transform.cssProps }),
                    position: 'relative',
                    zIndex: 1
                }}>
                <div
                    title={title ?? ""}
                    style={{
                        ...containerSize,
                        display: 'grid',
                        placeContent: 'center',
                        outline: meta.showContextMenu ? '1px solid rgba(255, 255, 255, 0.175)' : 'none',
                        borderRadius: meta.showContextMenu ? 6 : 0,
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
                            onClick={(e) => onClick(e.metaKey)}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            ref={(r) => {
                                if (onSvgRef && refKey) {
                                    onSvgRef(r, `${refKey}`);
                                }
                            }}
                            version="1.1"
                            width={containerSize.width}
                            height={containerSize.height}
                            fill={data.fill}
                            stroke={data.stroke}
                            strokeWidth={data.stroke_width}
                            viewBox={data.viewbox}
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
                        data: data,
                    }}
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
    refKey?: string,
    disbaled?: { value: boolean, cursor: string },
}
export function DraggableProjectImg({
    mediaKey,
    data,
    meta,
    zIndex,
    imgElementsRef,
    refKey,
    disbaled }: DraggableProjectImg) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const transformedBounds = useMemo(() => { return calculateTransformedBounds(meta) }, [meta]);
    const dndPosition = useMemo(() => {
        switch (appState.tool.type) {
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
    }, [appState.project.frame_left, appState.project.frame_top, appState.tool.type, meta.left, meta.top]);
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
        useSensor(PointerSensor, {
            activationConstraint: { distance: 1, },
        })
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
        let newLeft = Math.min(appState.project.canvas_width - meta.width, Math.max(0, Math.round(meta.left + deltaX)));
        let newTop = Math.min(appState.project.canvas_height - meta.height, Math.max(0, Math.round(meta.top + deltaY)));

        const yMaxActual = newTop + meta.height + transformedBounds.deltas.bottom;
        const xMaxActual = newLeft + meta.width + transformedBounds.deltas.right;
        const yMinActual = newTop + transformedBounds.deltas.top;
        const xMinActual = newLeft + transformedBounds.deltas.left;
        if (yMaxActual > appState.project.canvas_height) {
            newTop -= (yMaxActual - appState.project.canvas_height);
        }
        if (xMaxActual > appState.project.canvas_width) {
            newLeft -= (xMaxActual - appState.project.canvas_width);
        }
        if (yMinActual < 0) {
            newTop += Math.abs(yMinActual);
        }
        if (xMinActual < 0) {
            newLeft += Math.abs(xMinActual);
        }

        const newContextMenuConfig = getNewContextMenuConfig(
            { left: newLeft, top: newTop },
            { width: appState.project.canvas_width, height: appState.project.canvas_height },
            { ...meta },
            { x: meta.scale_x, y: meta.scale_y },
            meta.contextMenuConfig);
        const newImg: LaurusProjectImg = { ...meta, left: newLeft, top: newTop, contextMenuConfig: newContextMenuConfig };
        const newImgs: Map<string, LaurusProjectImg> = new Map(appState.project.imgs);
        newImgs.set(mediaKey, newImg);
        const rollback: LaurusProjectResult = { ...appState.project };
        const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs };
        dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
        if (newProject.project_id) {
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (!updated) {
                dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, transformedBounds.deltas, dispatch, mediaKey, meta]);

    const onImgClick = useCallback((metaKey: boolean) => {
        if (metaKey) {
            if (appState.tool.type == 'viewport') {
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
            };
            const newContextMenuConfig = getNewContextMenuConfig(
                { ...meta },
                { width: appState.project.canvas_width, height: appState.project.canvas_height },
                { ...meta },
                { x: meta.scale_x, y: meta.scale_y },
                meta.contextMenuConfig);
            const newImg: LaurusProjectImg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
            dispatch({ type: WorkspaceActionType.SetProjectImg, key: mediaKey, value: newImg });
            const inactiveImgs = Array.from(appState.project.imgs.entries()).filter(i => i[0] != mediaKey);
            const inactiveSvgs = Array.from(appState.project.svgs.entries());
            inactiveImgs.forEach(i => {
                dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
            inactiveSvgs.forEach(i => {
                dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
        }
        else {
            switch (appState.tool.type) {
                case "drop": { break; }
                case "none": { break; }
                case "contextmenu": {
                    const newContextMenuConfig = getNewContextMenuConfig(
                        { ...meta },
                        { width: appState.project.canvas_width, height: appState.project.canvas_height },
                        { ...meta },
                        { x: meta.scale_x, y: meta.scale_y },
                        meta.contextMenuConfig);
                    const newImg: LaurusProjectImg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
                    dispatch({ type: WorkspaceActionType.SetProjectImg, key: mediaKey, value: newImg });
                    const inactiveImgs = Array.from(appState.project.imgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveSvgs = Array.from(appState.project.svgs.entries());
                    inactiveImgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
                case "viewport": { break; }
                case "move": { break; }
                case "scale":
                case "rotate": {
                    const newActiveElement: LaurusActiveElement = {
                        key: mediaKey,
                        type: 'img',
                    };
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    dispatch({ type: WorkspaceActionType.SetProjectImg, key: mediaKey, value: { ...meta, showContextMenu: true } });
                    const inactiveImgs = Array.from(appState.project.imgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveSvgs = Array.from(appState.project.svgs.entries());
                    inactiveImgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
            }
        }
    }, [appState.project.canvas_height, appState.project.canvas_width, appState.project.imgs, appState.project.svgs, appState.tool.type, dispatch, mediaKey, meta]);

    return (<>
        <DndContext
            id={`dnd-context-${mediaKey}`}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = 'default';
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
                onClick={onImgClick}
                onImgRef={onImgRef}
                refKey={refKey}
                disabled={disbaled}
                transform={laurusTransform} />
        </DndContext>
    </>)
}

interface DraggableProjectSvg {
    mediaKey: string
    data: LaurusSvgResult,
    meta: LaurusProjectSvg,
    zIndex: number,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    refKey?: string,
    disabled?: { value: boolean, cursor: string }
}
export function DraggableProjectSvg({
    mediaKey,
    data,
    meta,
    zIndex,
    svgElementsRef,
    refKey,
    disabled, }: DraggableProjectSvg) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const transformedBounds = useMemo(() => { return calculateTransformedBounds(meta) }, [meta]);
    const dndPosition = useMemo(() => {
        switch (appState.tool.type) {
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
    }, [appState.project.frame_left, appState.project.frame_top, appState.tool.type, meta.left, meta.top]);
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
        useSensor(PointerSensor, {
            activationConstraint: { distance: 1, },
        })
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
        let newLeft = Math.min(appState.project.canvas_width - meta.width, Math.max(0, Math.round(meta.left + deltaX)));
        let newTop = Math.min(appState.project.canvas_height - meta.height, Math.max(0, Math.round(meta.top + deltaY)));

        const yMaxActual = newTop + meta.height + transformedBounds.deltas.bottom;
        const xMaxActual = newLeft + meta.width + transformedBounds.deltas.right;
        const yMinActual = newTop + transformedBounds.deltas.top;
        const xMinActual = newLeft + transformedBounds.deltas.left;
        if (yMaxActual > appState.project.canvas_height) {
            newTop -= (yMaxActual - appState.project.canvas_height);
        }
        if (xMaxActual > appState.project.canvas_width) {
            newLeft -= (xMaxActual - appState.project.canvas_width);
        }
        if (yMinActual < 0) {
            newTop += Math.abs(yMinActual);
        }
        if (xMinActual < 0) {
            newLeft += Math.abs(xMinActual);
        }

        const newContextMenuConfig = getNewContextMenuConfig(
            { left: newLeft, top: newTop },
            { width: appState.project.canvas_width, height: appState.project.canvas_height },
            { ...meta },
            { x: meta.scale_x, y: meta.scale_y },
            meta.contextMenuConfig);
        const newSvg: LaurusProjectSvg = {
            ...meta,
            top: newTop,
            left: newLeft,
            contextMenuConfig: newContextMenuConfig,
        };
        const newSvgs: Map<string, LaurusProjectSvg> = new Map(appState.project.svgs);
        newSvgs.set(mediaKey, newSvg);
        const rollback: LaurusProjectResult = { ...appState.project };
        const newProject: LaurusProjectResult = { ...appState.project, svgs: newSvgs };
        dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
        if (newProject.project_id) {
            const updated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
            if (!updated) {
                dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, transformedBounds.deltas, dispatch, mediaKey, meta]);

    const onSvgClick = useCallback((metaKey: boolean) => {
        if (metaKey) {
            if (appState.tool.type == 'viewport') {
                dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
            };
            const newContextMenuConfig = getNewContextMenuConfig(
                { ...meta },
                { width: appState.project.canvas_width, height: appState.project.canvas_height },
                { ...meta },
                { x: meta.scale_x, y: meta.scale_y },
                meta.contextMenuConfig);
            const newSvg: LaurusProjectSvg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
            dispatch({ type: WorkspaceActionType.SetProjectSvg, key: mediaKey, value: newSvg });
            const inactiveSvgs = Array.from(appState.project.svgs.entries()).filter(i => i[0] != mediaKey);
            const inactiveImgs = Array.from(appState.project.imgs.entries());
            inactiveSvgs.forEach(i => {
                dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
            inactiveImgs.forEach(i => {
                dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
            });
        }
        else {
            switch (appState.tool.type) {
                case "drop": { break; }
                case "none": { break; }
                case "contextmenu": {
                    const newContextMenuConfig = getNewContextMenuConfig(
                        { ...meta },
                        { width: appState.project.canvas_width, height: appState.project.canvas_height },
                        { ...meta },
                        { x: meta.scale_x, y: meta.scale_y },
                        meta.contextMenuConfig);
                    const newSvg: LaurusProjectSvg = { ...meta, showContextMenu: !meta.showContextMenu, contextMenuConfig: newContextMenuConfig };
                    dispatch({ type: WorkspaceActionType.SetProjectSvg, key: mediaKey, value: newSvg });
                    const inactiveSvgs = Array.from(appState.project.svgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveImgs = Array.from(appState.project.imgs.entries());
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveImgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
                case "viewport": { break; }
                case "move": { break; }
                case "scale":
                case "rotate": {
                    const newActiveElement: LaurusActiveElement = {
                        key: mediaKey,
                        type: 'svg',
                    };
                    dispatch({ type: WorkspaceActionType.SetActiveElement, value: newActiveElement });
                    dispatch({ type: WorkspaceActionType.SetProjectSvg, key: mediaKey, value: { ...meta, showContextMenu: true } });
                    const inactiveSvgs = Array.from(appState.project.svgs.entries()).filter(i => i[0] != mediaKey);
                    const inactiveImgs = Array.from(appState.project.imgs.entries());
                    inactiveSvgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    inactiveImgs.forEach(i => {
                        dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                    });
                    break;
                }
            }
        }
    }, [appState.project.canvas_height, appState.project.canvas_width, appState.project.imgs, appState.project.svgs, appState.tool.type, dispatch, mediaKey, meta]);

    return (<>
        <DndContext
            id={`dnd-context-${mediaKey}`}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = 'default';
                const delta = e.delta;
                onNewSvgPosition(delta.x, delta.y);
            }}>
            <ProjectSvg
                dndId={`dnd-node-${mediaKey}`}
                dndPosition={dndPosition}
                zIndex={zIndex}
                maxZIndex={highestOrder}
                mediaKey={mediaKey}
                meta={meta}
                data={data}
                onClick={onSvgClick}
                onSvgRef={onSvgRef}
                refKey={refKey}
                disabled={disabled}
                transform={laurusTransform} />
        </DndContext>
    </>)
}