'use client'

import Image from "next/image";
import { useDraggable, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';
import { LaurusImgResult, LaurusSvgResult, WorkspaceContext, LaurusProjectImg, LaurusProjectSvg } from "./workspace.client";
import { useContext } from "react";
import { SvgRepo } from "../svg-repo";

interface ReactImg {
    img: LaurusImgResult,
    containerSize: { width: number, height: number }
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    inputId?: string,
}
export function ReactImg({ img, containerSize, onImgRef, inputId }: ReactImg) {
    return (
        <div style={{
            width: containerSize.width,
            height: containerSize.height,
            position: 'relative',
        }}>
            <Image
                ref={(r) => {
                    if (onImgRef) {
                        onImgRef(r, `${inputId ?? img.media_key}`);
                    }
                }}
                draggable={false}
                alt={img.media_key}
                src={img.src}
                fill
                style={{ objectFit: 'cover', border: 'none' }} />
        </div>
    )
}

interface ReactImgNode {
    id: string
    position: { x: number, y: number, z: number, },
    data: LaurusImgResult,
    containerSize: { width: number, height: number },
    onImgRef?: (element: HTMLImageElement | null, refKey: string) => void,
    inputId?: string,
}
function ReactImgNode({ id, position, data, containerSize, onImgRef, inputId }: ReactImgNode) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const { appState } = useContext(WorkspaceContext);

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
                cursor: (() => {
                    if (appState.tool.type == 'activate') {
                        return '';
                    }
                    else {
                        return isDragging ? 'grabbing' : 'grab';
                    }
                })(),
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

interface DraggableReactImg {
    contextId: string
    nodeId: string,
    data: LaurusImgResult,
    meta: LaurusProjectImg,
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
    inputId }: DraggableReactImg) {
    const { appState } = useContext(WorkspaceContext);
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
                const newPosition = {
                    x: Math.min(appState.project.canvas_width - meta.width, Math.max(0, Math.round(meta.left + delta.x))),
                    y: Math.min(appState.project.canvas_height - meta.height, Math.max(0, Math.round(meta.top + delta.y)))
                };
                onNewPosition({ ...newPosition });
            }}
        >
            <ReactImgNode
                id={nodeId}
                position={(() => {
                    switch (appState.tool.type) {
                        case "viewport": {
                            return {
                                x: (meta.left - appState.project.frame_left),
                                y: (meta.top - appState.project.frame_top),
                                z: zIndex
                            }
                        }
                        default: {
                            return {
                                x: Math.max(0, meta.left),
                                y: Math.max(0, meta.top),
                                z: zIndex
                            }
                        }
                    }
                })()}
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



interface ReactSvgNode {
    id: string
    position: { x: number, y: number, z: number, },
    data: LaurusSvgResult,
    containerSize: { width: number, height: number },
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    inputId?: string,
}
function ReactSvgNode({ id, position, data, containerSize, onSvgRef, inputId }: ReactSvgNode) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const { appState } = useContext(WorkspaceContext);

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
                cursor: (() => {
                    if (appState.tool.type == 'activate') {
                        return '';
                    }
                    else {
                        return isDragging ? 'grabbing' : 'grab';
                    }
                })(),
                position: 'absolute',
                width: containerSize.width,
                height: containerSize.height,
                zIndex: position.z
            }} >
            <SvgRepo
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

interface DraggableReactSvg {
    contextId: string
    nodeId: string,
    data: LaurusSvgResult,
    meta: LaurusProjectSvg,
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
    inputId }: DraggableReactSvg) {
    const { appState } = useContext(WorkspaceContext);
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
                const newPosition = {
                    x: Math.min(appState.project.canvas_width - meta.width, Math.max(0, Math.round(meta.left + delta.x))),
                    y: Math.min(appState.project.canvas_height - meta.height, Math.max(0, Math.round(meta.top + delta.y)))
                };
                onNewPosition({ ...newPosition });
            }}
        >
            <ReactSvgNode
                id={nodeId}
                position={(() => {
                    switch (appState.tool.type) {
                        case "viewport": {
                            return {
                                x: (meta.left - appState.project.frame_left),
                                y: (meta.top - appState.project.frame_top),
                                z: zIndex
                            }
                        }
                        default: {
                            return {
                                x: Math.max(0, meta.left),
                                y: Math.max(0, meta.top),
                                z: zIndex
                            }
                        }
                    }
                })()}
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
