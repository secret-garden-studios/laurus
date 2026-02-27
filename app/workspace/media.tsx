'use client'

import { EncodedImg_V1_0, EncodedSvg_V1_0 } from "./workspace.server";
import Image from "next/image";
import { useDraggable, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { CSS } from '@dnd-kit/utilities';
import { LaurusImg, LaurusSvg } from "./workspace.client";

interface ReactImgProps {
    img: EncodedImg_V1_0,
    containerSize: { width: number, height: number }
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    inputId?: string,
}
export function ReactImg({ img, containerSize, onImgRef, inputId }: ReactImgProps) {
    return (
        <div style={{
            width: containerSize.width,
            height: containerSize.height,
            position: 'relative',
        }}>
            <Image
                ref={(r) => {
                    if (onImgRef) {
                        onImgRef(r, `${inputId ?? img.media_path}`);
                    }
                }}
                draggable={false}
                alt={img.media_path}
                src={img.src}
                fill
                style={{ objectFit: 'cover', border: 'none' }} />
        </div>
    )
}

interface ReactImgNodeProps {
    id: string
    position: { x: number, y: number, z: number, },
    data: EncodedImg_V1_0,
    containerSize: { width: number, height: number },
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    inputId?: string,
}
function ReactImgNode({ id, position, data, containerSize, onImgRef, inputId }: ReactImgNodeProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const dndCss = {
        left: position.x,
        top: position.y,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
    };
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{
                ...dndCss,
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'absolute',
                width: containerSize.width,
                height: containerSize.height,
                zIndex: position.z
            }} >
            <ReactImg
                img={data}
                containerSize={{
                    width: containerSize.width,
                    height: containerSize.height,
                }}
                onImgRef={onImgRef}
                inputId={inputId} />
        </div>
    )
}

interface DraggableReactImgProps {
    contextId: string
    nodeId: string,
    data: EncodedImg_V1_0,
    meta: LaurusImg,
    zIndex: number,
    onNewPosition: (newPosition: { x: number, y: number }) => void,
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    inputId?: string,
}
export function DraggableReactImg({
    contextId,
    nodeId,
    data,
    meta,
    zIndex,
    onNewPosition,
    onImgRef,
    inputId }: DraggableReactImgProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 1, },
        })
    );
    return (<>
        <DndContext
            id={contextId}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = 'default';
                const delta = e.delta;
                const newPosition = { x: Math.round(meta.left + delta.x), y: Math.round(meta.top + delta.y) };
                onNewPosition({ ...newPosition });
            }}
            modifiers={[restrictToFirstScrollableAncestor]}
        >
            <ReactImgNode
                id={nodeId}
                position={{ x: meta.left, y: meta.top, z: zIndex }}
                data={data}
                containerSize={{
                    width: meta.width,
                    height: meta.height
                }}
                onImgRef={onImgRef}
                inputId={inputId} />
        </DndContext>
    </>)
}

interface ReactSvgProps {
    svg: EncodedSvg_V1_0,
    containerSize: { width: number, height: number }
    scale: number | undefined,
    onContainerClick?: () => void,
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    inputId?: string,
}
export function ReactSvg({ svg, containerSize, scale, onContainerClick, onSvgRef, inputId }: ReactSvgProps) {
    const decodedString = decodeURIComponent(
        atob(svg.markup)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
    );
    return (
        <div
            onMouseEnter={(e) => { if (onContainerClick) e.currentTarget.style.cursor = 'pointer' }}
            onMouseLeave={(e) => { if (onContainerClick) e.currentTarget.style.cursor = 'default' }}
            onClick={() => { if (onContainerClick) onContainerClick() }}
            style={{
                width: containerSize.width,
                height: containerSize.height,
                display: 'grid',
                placeContent: 'center',
            }}>
            {decodedString && <svg
                ref={(r) => {
                    if (onSvgRef) {
                        onSvgRef(r, `${inputId ?? svg.media_path}`);
                    }
                }}
                version="1.1"
                width={scale ? scale * containerSize.width : svg.width}
                height={scale ? scale * containerSize.height : svg.height}
                fill={svg.fill}
                stroke={svg.stroke}
                strokeWidth={svg.stroke_width}
                viewBox={svg.viewbox}
                dangerouslySetInnerHTML={{ __html: decodedString }} />}
        </div>
    )
}

interface ReactSvgNodeProps {
    id: string
    position: { x: number, y: number, z: number, },
    data: EncodedSvg_V1_0,
    containerSize: { width: number, height: number },
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    inputId?: string,
}
function ReactSvgNode({ id, position, data, containerSize, onSvgRef, inputId }: ReactSvgNodeProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const dndCss = {
        left: position.x,
        top: position.y,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
    };
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{
                ...dndCss,
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'absolute',
                width: containerSize.width,
                height: containerSize.height,
                zIndex: position.z
            }} >
            <ReactSvg
                svg={data}
                containerSize={{
                    width: containerSize.width,
                    height: containerSize.height,
                }}
                scale={0.9}
                onSvgRef={onSvgRef}
                inputId={inputId} />
        </div>
    )
}

interface DraggableReactSvgProps {
    contextId: string
    nodeId: string,
    data: EncodedSvg_V1_0,
    meta: LaurusSvg,
    zIndex: number,
    onNewPosition: (newPosition: { x: number, y: number }) => void,
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    inputId?: string,
}
export function DraggableReactSvg({
    contextId,
    nodeId,
    data,
    meta,
    zIndex,
    onNewPosition,
    onSvgRef,
    inputId }: DraggableReactSvgProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 1, },
        })
    );
    return (<>
        <DndContext
            id={contextId}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = 'default';
                const delta = e.delta;
                const newPosition = { x: Math.round(meta.left + delta.x), y: Math.round(meta.top + delta.y) };
                onNewPosition({ ...newPosition });
            }}
            modifiers={[restrictToFirstScrollableAncestor]}
        >
            <ReactSvgNode
                id={nodeId}
                position={{ x: meta.left, y: meta.top, z: zIndex }}
                data={data}
                containerSize={{
                    width: meta.width,
                    height: meta.height
                }}
                onSvgRef={onSvgRef}
                inputId={inputId} />
        </DndContext>
    </>)
}
