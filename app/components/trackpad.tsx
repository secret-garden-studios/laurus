import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { CSSProperties, RefObject, useContext, useState } from "react";
import { WorkspaceContext } from "../workspace/workspace.client";

export enum PointerStyle {
    Blurry,
    Solid,
    BlurryBottomTitle
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
    disabled?: boolean,
    title?: string,
    liveTitleRef?: RefObject<HTMLDivElement | null>
}

export function Trackpad({
    ids,
    width,
    height,
    coarsePointer,
    value,
    onNewValue,
    onMove,
    zIndex,
    disabled,
    title,
    liveTitleRef }: TrackpadProps) {

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
                    disabled={disabled}
                    title={title}
                    liveTitleRef={liveTitleRef}
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
    disabled?: boolean,
    title?: string,
    liveTitleRef?: RefObject<HTMLDivElement | null>,
}

function CoarsePointer({ id, width, height, pointerStyle, coords, zIndex, borderColor, disabled, title, liveTitleRef }: CoarsePointerProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
    const { appState } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                tooltip: {
                    letterSpacing: 1,
                    fontSize: 11,
                },
                titleOffsets: {
                    top: 8,
                    left: 6
                }
            }
            case "midhigh": return {
                tooltip: {
                    letterSpacing: 1,
                    fontSize: 9,
                },
                titleOffsets: {
                    top: 6,
                    left: 4
                }
            }
            case "midlow":
            case "low": return {
                tooltip: {
                    letterSpacing: 1,
                    fontSize: 8,
                },
                titleOffsets: {
                    top: 6,
                    left: 4
                }
            }
        }
    });
    const [isHovered, setIsHovered] = useState(false);
    const dndCss = {
        left: coords.x,
        top: coords.y,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
    };
    const tooltipCss: CSSProperties = ((p) => {
        switch (p) {
            case PointerStyle.BlurryBottomTitle: return {
                position: 'absolute',
                top: `calc(100% + ${dynamicSizes.titleOffsets.top}px)`,
                transform: 'translateY(-50%)',
                color: 'rgb(227,227,227)',
                fontWeight: 'bold',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 1000,
                ...dynamicSizes.tooltip
            }
            default: return {
                position: 'absolute',
                top: '50%',
                left: `calc(100% + ${dynamicSizes.titleOffsets.left}px)`,
                transform: 'translateY(-50%)',
                color: 'rgb(227,227,227)',
                fontWeight: 'bold',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 1000,
                ...dynamicSizes.tooltip
            }
        }
    })(pointerStyle);

    const css: CSSProperties = ((p) => {
        switch (p) {
            case PointerStyle.BlurryBottomTitle:
            case PointerStyle.Blurry: {
                return {
                    background: 'rgba(255,255,255,0.01)',
                    border: `1px solid ${borderColor ?? "rgb(70, 70, 70)"}`,
                    backdropFilter: 'blur(3px)',
                    borderRadius: '50%',
                    boxShadow: "1px 1px 6px rgba(0,0,0,0.4)",
                }
            }
            case PointerStyle.Solid: {
                return {
                    background: 'radial-gradient(circle at 30% 30%, rgb(230, 230, 230) 0%, rgb(170, 170, 170) 45%, rgb(115, 115, 115) 100%)',
                    borderRadius: '50%',
                    boxShadow: "1px 1px 6px rgba(0, 0, 0, 0.9)",
                }
            }

        }
    })(pointerStyle);

    if (liveTitleRef !== undefined) {
        return (<div ref={setNodeRef}
            {...listeners}
            {...attributes}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                ...dndCss,
                ...css,
                cursor: isDragging ? 'grabbing' : disabled ? '' : 'grab',
                position: 'absolute',
                width,
                height,
                zIndex
            }} >
            {(title && (isDragging || isHovered)) && (
                <div
                    ref={liveTitleRef}
                    style={tooltipCss} >
                    {title}
                </div>
            )}
            {(!title && (isDragging || isHovered)) && (
                <div
                    ref={liveTitleRef}
                    style={tooltipCss} >
                </div>
            )}
        </div>);
    }
    else {
        return (<div ref={setNodeRef}
            title={title}
            {...listeners}
            {...attributes}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                ...dndCss,
                ...css,
                cursor: isDragging ? 'grabbing' : disabled ? '' : 'grab',
                position: 'absolute',
                width,
                height,
                zIndex
            }} >
        </div>);
    }
}