import { useDraggable, useSensors, useSensor, PointerSensor, DndContext } from "@dnd-kit/core";
import { RefObject, useContext } from "react";
import { UIContext, CoreContext } from "./workspace.client";
import { CSS as DndCss } from '@dnd-kit/utilities';
import styles from "../app.module.css";
import { DraggableProjectImg, DraggableProjectSvg } from "./draggable-media";
import { Z_INDEX } from "./workspace.config";
import { LaurusFrame } from "./workspace.server";

interface CameraDragOverlay {
    id: string
    position: { x: number, y: number, z: number, },
    containerSize: { width: number, height: number },
    disabled?: boolean,
}
function CameraDragOverlay({ id, position, containerSize, disabled }: CameraDragOverlay) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
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
                cursor: disabled ? '' : isDragging ? 'grabbing' : 'grab',
                position: 'absolute',
                width: containerSize.width,
                height: containerSize.height,
                zIndex: position.z
            }} >
        </div>
    )
}

interface DraggableCamera {
    contextId: string
    nodeId: string,
    svgElementsRef: RefObject<Map<string, SVGSVGElement> | null>,
    imgElementsRef: RefObject<Map<string, HTMLImageElement> | null>,
    framesCacheRef: RefObject<Map<string, LaurusFrame[]>>,
    zIndex: number,
    onNewPosition: (newPosition: { x: number, y: number }) => void,
    disabled?: boolean,
}
export default function DraggableCamera({
    contextId,
    nodeId,
    svgElementsRef,
    imgElementsRef,
    framesCacheRef,
    zIndex,
    onNewPosition,
    disabled }: DraggableCamera) {
    const { appState } = useContext(CoreContext);
    const { uiState } = useContext(UIContext);
    const sensors = useSensors(
        useSensor(PointerSensor)
    );
    return (<>
        <DndContext
            id={contextId}
            sensors={sensors}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
            }}
            onDragEnd={(e) => {
                document.body.style.cursor = '';
                const delta = e.delta;
                const newPosition = {
                    x: Math.min(appState.project.canvas_width - appState.project.frame_width, Math.max(0, Math.round(appState.project.frame_left + delta.x))),
                    y: Math.min(appState.project.canvas_height - appState.project.frame_height, Math.max(0, Math.round(appState.project.frame_top + delta.y)))
                };
                onNewPosition({ ...newPosition });
            }}
        >
            <div style={{ position: 'relative' }}>
                <div
                    className={styles[`${uiState.resolution.type == 'high' ? 'noisy-background-20-2' : 'noisy-background-20-2-low-res'}`]}
                    style={{
                        position: 'absolute',
                        top: appState.project.frame_top,
                        left: appState.project.frame_left,
                        width: appState.project.frame_width,
                        height: appState.project.frame_height,
                        overflow: 'hidden',
                        boxShadow: "0px 0px 30px rgba(0, 0, 0, 0.65)",
                        borderRadius: 3,
                        outline: uiState.lightFrameBackground ? '1px solid rgba(0, 0, 0, 0)' : '1px solid rgba(255,255,255,0.2)',
                        background: uiState.lightFrameBackground ? 'rgb(227, 227, 227)' : 'none'
                    }} >
                    {uiState.tool.type == 'viewport' &&
                        <>
                            {Array.from(appState.project.imgs.entries()).map((e) => {
                                const [key, meta] = e;
                                if (meta.top < 0 || meta.left < 0 || meta.showContextMenu) return;
                                const imgData = appState.canvasImgs.get(key);
                                if (imgData) {
                                    return (
                                        <div key={key}>
                                            <DraggableProjectImg
                                                mediaKey={key}
                                                data={imgData}
                                                meta={meta}
                                                zIndex={meta.order + zIndex + Z_INDEX.CAMERA_ITEMS_OFFSET}
                                                imgElementsRef={imgElementsRef}
                                                framesCacheRef={framesCacheRef}
                                                refKey={key} />
                                        </div>
                                    );
                                }
                            })}
                            {Array.from(appState.project.svgs.entries()).map((e) => {
                                const [key, meta] = e;
                                if (meta.top < 0 || meta.left < 0 || meta.showContextMenu) return;
                                const svgData = appState.canvasSvgs.get(key);
                                if (!svgData) return;
                                let decodedString = "";
                                try {
                                    decodedString = decodeURIComponent(
                                        atob(svgData.markup)
                                            .split('')
                                            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                                            .join(''));
                                }
                                catch (error) {
                                    console.log("Failed to decodeURIComponent from svg markup", { error })
                                }
                                if (decodedString) {
                                    return (
                                        <div key={key}>
                                            <DraggableProjectSvg
                                                mediaKey={key}
                                                decodedString={decodedString}
                                                meta={meta}
                                                zIndex={meta.order + zIndex + Z_INDEX.CAMERA_ITEMS_OFFSET}
                                                svgElementsRef={svgElementsRef}
                                                framesCacheRef={framesCacheRef}
                                                refKey={key} />
                                        </div>
                                    );
                                }
                            })}
                        </>}
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
                        }}
                        disabled={disabled} />
                </div>
            </div>
        </DndContext>
    </>)
}
