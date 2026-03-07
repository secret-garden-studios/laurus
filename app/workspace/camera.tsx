import { useDraggable, useSensors, useSensor, PointerSensor, DndContext } from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { RefObject, useContext } from "react";
import { MediaOverlays, WorkspaceContext } from "./workspace.client";
import { CSS as DndCss } from '@dnd-kit/utilities';
import styles from "../app.module.css";

interface CameraDragOverlayProps {
    id: string
    position: { x: number, y: number, z: number, },
    containerSize: { width: number, height: number },
}
function CameraDragOverlay({ id, position, containerSize }: CameraDragOverlayProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const dndCss = {
        left: position.x,
        top: position.y,
        transform: DndCss.Translate.toString(transform),
        touchAction: 'none',
        border: isDragging ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
        borderRadius: isDragging ? 10 : 0,
        background: isDragging ? 'linear-gradient(45deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.15))' : 'none'
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
        </div>
    )
}

interface DraggableCameraProps {
    contextId: string
    nodeId: string,
    data: {
        svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
        imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>
    }
    zIndex: number,
    onNewPosition: (newPosition: { x: number, y: number }) => void,
}
export default function DraggableCamera({
    contextId,
    nodeId,
    data,
    zIndex,
    onNewPosition }: DraggableCameraProps) {
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
                const newPosition = { x: Math.round(appState.project.frame_left + delta.x), y: Math.round(appState.project.frame_top + delta.y) };
                onNewPosition({ ...newPosition });
            }}
            modifiers={[restrictToFirstScrollableAncestor]}
        >
            <div style={{ position: 'relative' }}>
                <div
                    className={styles["grainy-background"]}
                    style={{
                        position: 'absolute',
                        top: appState.project.frame_top,
                        left: appState.project.frame_left,
                        width: appState.project.frame_width,
                        height: appState.project.frame_height,
                        overflow: 'hidden',
                        boxShadow: "6px 6px 10px rgba(0, 0, 0, 0.2)",
                        borderRadius: 2,
                    }} >
                    {appState.tool.type == 'viewport' &&
                        <MediaOverlays
                            svgElementsRef={data.svgElementsRef}
                            imgElementsRef={data.imgElementsRef}
                            zIndex={zIndex + 1} />}
                </div>
                <div style={{ position: 'absolute' }}>
                    <CameraDragOverlay
                        id={nodeId}
                        position={(() => {
                            return {
                                x: Math.max(0, appState.project.frame_left),
                                y: Math.max(0, appState.project.frame_top),
                                z: zIndex
                            }
                        })()}
                        containerSize={{
                            width: appState.project.frame_width,
                            height: appState.project.frame_height
                        }} />
                </div>
            </div>
        </DndContext>
    </>)
}
