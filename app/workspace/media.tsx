'use client'

import { EncodedImg_V1_0, EncodedSvg_V1_0 } from "./workspace.server";
import Image from "next/image";
import { useDraggable, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { CSS } from '@dnd-kit/utilities';
import { LaurusImg, LaurusSvg } from "./workspace.client";

interface ReactSvgProps {
    svg: EncodedSvg_V1_0,
    containerSize: { width: number, height: number }
    scale: number | undefined,
    onContainerClick?: () => void,
}
export function ReactSvg({ svg, containerSize, scale, onContainerClick }: ReactSvgProps) {
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
interface ReactImgProps {
    img: EncodedImg_V1_0,
    containerSize: { width: number, height: number }
}
export function ReactImg({ img, containerSize }: ReactImgProps) {
    return (
        <div style={{
            width: containerSize.width,
            height: containerSize.height,
            position: 'relative',
        }}>
            <Image
                draggable={false}
                alt={img.media_path}
                src={img.src}
                fill
                style={{ objectFit: 'cover', border: 'none' }} />
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
}
export function DraggableReactImg({
    contextId,
    nodeId,
    data,
    meta,
    zIndex,
    onNewPosition }: DraggableReactImgProps) {
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
                }} />
        </DndContext>
    </>)
}
interface ReactImgNodeProps {
    id: string
    position: { x: number, y: number, z: number, },
    data: EncodedImg_V1_0,
    containerSize: { width: number, height: number }
}
function ReactImgNode({ id, position, data, containerSize }: ReactImgNodeProps) {
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
                }} />
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
}
export function DraggableReactSvg({
    contextId,
    nodeId,
    data,
    meta,
    zIndex,
    onNewPosition }: DraggableReactSvgProps) {
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
                }} />
        </DndContext>
    </>)
}
interface ReactSvgNodeProps {
    id: string
    position: { x: number, y: number, z: number, },
    data: EncodedSvg_V1_0,
    containerSize: { width: number, height: number }
}
function ReactSvgNode({ id, position, data, containerSize }: ReactSvgNodeProps) {
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
                scale={0.9} />
        </div>
    )
}