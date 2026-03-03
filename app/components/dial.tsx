import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useEffect, useRef, useState } from "react";

interface DialProps {
    ids: { contextId: string, draggableId: string }
    value: number,
    onNewValue: (v: number) => void,
    onMove?: (v: number) => void,
}

export default function Dial({ ids, value, onMove, onNewValue }: DialProps) {
    const rotationRef = useRef(value);
    const [rotation, setRotation] = useState(value);
    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        rotationRef.current = value;
        (async () => { setRotation(value); })();
    }, [value]);

    return (<>
        <DndContext
            id={ids.contextId}
            sensors={sensors}
            autoScroll={false}
            onDragStart={() => {
                document.body.style.cursor = 'grabbing';
                rotationRef.current = rotation;
            }}
            onDragMove={(event) => {
                const { delta } = event;
                const dragDistanceY = delta.y;
                const degreesPerPixel = -0.75;
                const newRotation = rotationRef.current + (dragDistanceY * degreesPerPixel);
                setRotation(newRotation);
                if (onMove) {
                    onMove(newRotation);
                }
            }}
            onDragEnd={(event) => {
                document.body.style.cursor = '';
                const { delta } = event;
                const dragDistanceY = delta.y;
                const degreesPerPixel = -0.75;
                const newRotation = rotationRef.current + (dragDistanceY * degreesPerPixel);
                rotationRef.current = newRotation;
                setRotation(newRotation);
                onNewValue(newRotation);
            }}
            modifiers={[restrictToVerticalAxis]}>
            <BlurryCap
                id={ids.draggableId}
                rotation={rotation} />
        </DndContext>
    </>)
}

interface BlurryCapProps {
    id: string,
    rotation: number,
}

function BlurryCap({ id, rotation }: BlurryCapProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
    const dndCss = { touchAction: 'none', };
    const [dialTickLeftPercentage] = useState(73);
    const [containerSize] = useState(90);
    const [gaugeSize] = useState(90);
    const [gaugeFactor] = useState(45);
    const [dialSize] = useState(80);
    const [gaugeTickCount] = useState(360 / gaugeFactor);
    const [gaugeTicks] = useState(Array.from({ length: gaugeTickCount }, (_, i) => i));

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${containerSize}px`,
            height: `${containerSize}px`,
            position: 'relative',
        }}>
            {/* gauge */}
            <div style={{
                zIndex: 1,
                position: 'absolute',
                width: `${gaugeSize}px`,
                height: `${gaugeSize}px`,
            }}>
                {gaugeTicks.map((_, index) => {
                    const r = index * gaugeFactor;
                    return (
                        <div
                            key={index}
                            style={
                                {
                                    zIndex: 1,
                                    position: 'absolute',
                                    left: '50%',
                                    top: '0%',
                                    width: `${1}px`,
                                    height: `${7}px`,
                                    transformOrigin: `center ${gaugeSize / 2}px`,
                                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                    transform: `translateX(-50%) rotate(${r}deg)`,
                                }
                            }
                        />
                    );
                })}
            </div>
            {/* dial */}
            <div style={{
                zIndex: 1,
                position: 'absolute',
                width: `${dialSize}px`,
                height: `${dialSize}px`,
                background: 'rgba(255,255,255,0.01)',
                border: `1px solid rgb(70, 70, 70)`,
                backdropFilter: 'blur(3px)',
                borderRadius: '50%',
            }} />
            <div style={{
                zIndex: 1,
                transform: `rotate(${rotation}deg)`,
                position: 'absolute',
                width: `${containerSize}px`,
                height: `${containerSize}px`,
            }}>
                {/* tick */}
                <div style={{
                    zIndex: 2,
                    top: '50%',
                    left: `${dialTickLeftPercentage}%`,
                    position: 'absolute',
                    borderRadius: '2px',
                    width: `${11}px`,
                    height: `${2}px`,
                    backgroundImage: 'linear-gradient(to right, rgb(189, 189, 189) 15%,rgb(228, 228, 228))',
                }} />
            </div>
            <div
                ref={setNodeRef}
                {...attributes}
                {...listeners}
                style={{
                    zIndex: 3,
                    ...dndCss,
                    position: 'absolute',
                    width: `${dialSize}px`,
                    height: `${dialSize}px`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    borderRadius: '50%',
                }} />
        </div >
    );
};