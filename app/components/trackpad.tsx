import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { CSSProperties } from "react";

export enum PointerStyle {
    Blurry,
}

interface TrackpadProps {
    ids: { contextId: string, draggableId: string }
    width: number | string,
    height: number | string,
    coarsePointer: {
        width: number | string,
        height: number | string,
        pointerStyle: PointerStyle,
        zIndex?: number,
        borderColor?: string,
    }
    value: { x: number, y: number },
    onNewValue: (v: { x: number, y: number }) => void,
    onMove?: (v: { x: number, y: number }) => void
    zIndex?: number,
}

export function Trackpad({
    ids,
    width,
    height,
    coarsePointer,
    value,
    onNewValue,
    onMove,
    zIndex }: TrackpadProps) {

    const sensors = useSensors(
        useSensor(PointerSensor)
    );

    return (<>
        <div style={{
            width,
            height,
            zIndex
        }}>
            <DndContext
                id={ids.contextId}
                sensors={sensors}
                autoScroll={false}
                onDragStart={() => {
                    document.body.style.cursor = 'grabbing';
                }}
                onDragMove={(e) => {
                    if (!onMove) return;
                    const delta = e.delta;
                    const newPosition = { x: Math.round(value.x + delta.x), y: Math.round(value.y + delta.y) };
                    onMove(newPosition);
                }}
                onDragEnd={(e) => {
                    document.body.style.cursor = '';
                    const delta = e.delta;
                    const newPosition = { x: Math.round(value.x + delta.x), y: Math.round(value.y + delta.y) };
                    onNewValue(newPosition);
                }}
                modifiers={[restrictToParentElement]}
            >
                <CoarsePointer
                    id={ids.draggableId}
                    coords={value}
                    width={coarsePointer.width}
                    height={coarsePointer.height}
                    pointerStyle={coarsePointer.pointerStyle}
                    zIndex={coarsePointer.zIndex}
                    borderColor={coarsePointer.borderColor}
                />
            </DndContext>
        </div>
    </>)
}

interface CoarsePointerProps {
    id: string
    coords: { x: number, y: number },
    width: number | string,
    height: number | string,
    pointerStyle: PointerStyle,
    zIndex?: number,
    borderColor?: string,
}

function CoarsePointer({ id, width, height, pointerStyle, coords, zIndex, borderColor }: CoarsePointerProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const dndCss = {
        left: coords.x,
        top: coords.y,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
    };

    const css: CSSProperties = ((p) => {
        switch (p) {
            case PointerStyle.Blurry: {
                return {
                    background: 'rgba(255,255,255,0.01)',
                    border: `1px solid ${borderColor ?? "rgb(70, 70, 70)"}`,
                    backdropFilter: 'blur(3px)',
                    borderRadius: 4,
                    boxShadow: "1px 1px 6px rgba(0,0,0,0.4)",
                }
            }
        }
    })(pointerStyle);

    return (<>
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{
                ...dndCss,
                ...css,
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'absolute',
                width,
                height,
                zIndex
            }} >
        </div>
    </>)
}