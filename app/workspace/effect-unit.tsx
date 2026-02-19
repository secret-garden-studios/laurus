import { useRef, useState } from "react";
import { PointerStyle, Trackpad } from "../components/trackpad";
import ScaleUnit from "./scale-unit";
import { LaurusEffect } from "./workspace.client";
import { ReactSvg } from "./media";
import { circle } from "../svg-repo";

interface EffectUnitProps {
    effect: LaurusEffect,
}
export default function EffectUnit({ effect }: EffectUnitProps) {

    const [offsetCapSize] = useState({ width: 17, height: 54 });
    const [durationCapSize] = useState({ width: 17, height: 54 });
    const [timelineTrackSize] = useState({ width: '100%', height: 54 });
    const [offsetCursor, setOffsetCursor] = useState({ x: 0, y: 0 });
    const [durationCursor, setDurationCursor] = useState({ x: 0, y: 0 });
    const [showUnitControls, setShowUnitControls] = useState(false);
    const offsetRef = useRef<HTMLInputElement | null>(null);
    const durationRef = useRef<HTMLInputElement | null>(null);

    switch (effect.type) {
        case 'scale': {
            return (
                <div style={{ display: 'grid' }} key={effect.value.scale_id}>
                    <div
                        style={{
                            width: '100%', height: 24,
                            padding: "0px 6px 0px 8px",
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12,
                            color: 'rgba(255,255,255,1)'
                        }}>
                        <div style={{ display: 'flex', height: '100%', gap: 4, alignItems: 'center' }}>
                            <div>{'start'}</div>
                            <input
                                ref={offsetRef}
                                type="text"
                                placeholder="0.00"
                                value={offsetCursor.x}
                                onChange={() => { setOffsetCursor(v => { return { ...v, x: parseFloat(offsetRef.current?.value ?? "0") } }) }}
                                style={{
                                    textAlign: "left",
                                    background: 'none',
                                    color: "rgba(255, 255, 255, 0.8)",
                                    borderRadius: "2px",
                                    border: 'none',
                                    outline: 'none',
                                    lineHeight: '1',
                                    display: 'inline-block',
                                    overflowX: 'scroll',
                                    fontSize: 10,
                                    width: 30,
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', height: '100%', gap: 4, alignItems: 'center' }}>
                            <div >{'end'}</div>
                            <input
                                ref={durationRef}
                                type="text"
                                placeholder="0.00"
                                value={durationCursor.x}
                                onChange={() => { setDurationCursor(v => { return { ...v, x: parseFloat(durationRef.current?.value ?? "0") } }) }}
                                style={{
                                    textAlign: "left",
                                    background: 'none',
                                    color: "rgba(255, 255, 255, 0.8)",
                                    borderRadius: "2px",
                                    border: 'none',
                                    outline: 'none',
                                    lineHeight: '1',
                                    display: 'inline-block',
                                    overflowX: 'scroll',
                                    fontSize: 10,
                                    width: 30,
                                }}
                            />
                        </div>
                    </div>
                    <div style={{
                        width: '100%',
                        padding: '0px 15px 0px 15px',
                    }}>
                        <HorizontalSlider
                            label={"scale"}
                            hash={`${effect.value.scale_id}|timeline|${1}`}
                            capSize={offsetCapSize}
                            rangeCapSize={durationCapSize}
                            trackSize={timelineTrackSize}
                            cursor={offsetCursor}
                            onNewCursor={(c) => {
                                if (durationCursor.x < c.x) {
                                    setDurationCursor({ ...c });
                                    if (durationRef.current) {
                                        durationRef.current.value = c.x.toFixed(0);
                                    }
                                }
                                setOffsetCursor({ ...c });
                            }}
                            rangeCursor={durationCursor}
                            onNewRangeCursor={(c) => {
                                if (offsetCursor.x > c.x) {
                                    setOffsetCursor({ ...c });
                                    if (offsetRef.current) {
                                        offsetRef.current.value = c.x.toFixed(0);
                                    }
                                }
                                setDurationCursor({ ...c })
                            }}
                            onCursorMove={(c) => {
                                if (offsetRef.current) {
                                    offsetRef.current.value = c.x.toFixed(0);
                                }
                            }}
                            onRangeMove={(c) => {
                                if (durationRef.current) {
                                    durationRef.current.value = c.x.toFixed(0);
                                }
                            }}
                        />
                    </div>
                    <div
                        style={{
                            width: '100%', height: 24,
                            padding: 6, display: 'flex', justifyContent: 'end'
                        }}>
                        <ReactSvg
                            svg={circle()}
                            containerSize={{
                                width: 12,
                                height: 12
                            }}
                            scale={0.9}
                            onContainerClick={() => setShowUnitControls(v => !v)} />
                    </div>
                    {showUnitControls && <ScaleUnit scale={effect.value} />}
                </div>
            );
        }
    }
}

interface TimelineSliderProps {
    label: string,
    hash: string,
    trackSize: { width: number | string, height: number | string }

    capSize: { width: number | string, height: number | string }
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,

    rangeCapSize: { width: number | string, height: number | string }
    rangeCursor: { x: number, y: number },
    onNewRangeCursor: (newCursor: { x: number, y: number }) => void,
    onRangeMove?: (newCursor: { x: number, y: number }) => void,
}
function HorizontalSlider({
    label,
    hash,
    trackSize,
    capSize,
    cursor,
    onNewCursor,
    onCursorMove,
    rangeCapSize,
    rangeCursor,
    onNewRangeCursor,
    onRangeMove,
}: TimelineSliderProps) {
    return (<>
        <div style={{ width: '100%', height: '100%', }}>
            <div style={{
                position: "relative",
                ...trackSize,
                alignContent: 'center',
            }}>
                <div style={{ position: 'absolute', width: '100%', alignSelf: 'center', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `dnd-context-${hash}`, draggableId: `dnd-draggable-${hash}` }}
                        width={'100%'}
                        height={capSize.height}
                        coarsePointer={{
                            ...capSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={onCursorMove} />
                </div>
                <div style={{ position: 'absolute', width: '100%', alignSelf: 'center', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `dnd-context-${hash}`, draggableId: `dnd-draggable-${hash}` }}
                        width={'100%'}
                        height={rangeCapSize.height}
                        coarsePointer={{
                            ...rangeCapSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={rangeCursor}
                        onNewValue={onNewRangeCursor}
                        onMove={onRangeMove} />
                </div>
                <div
                    style={{
                        zIndex: 1,
                        top: 0,
                        width: trackSize.width,
                        height: 20,
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        display: 'flex',
                        justifyContent: 'start',
                        background: "linear-gradient(45deg, rgb(11, 11, 11), rgb(25, 25, 25))",
                        border: '1px solid rgb(27, 27, 27)',
                        fontSize: 10,
                        paddingLeft: 7,
                        alignItems: 'center',
                        color: 'rgba(200,200,200,1)',
                    }}
                >
                    {label}
                    <ReactSvg
                        svg={circle('rgba(200,200,200,0.7)')}
                        containerSize={{
                            width: 10,
                            height: 10
                        }}
                        scale={0.8} />
                </div>
                <div
                    style={{
                        zIndex: 0,
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        ...trackSize,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(27, 27, 27)',
                        borderBottomLeftRadius: 10,
                        borderBottomRightRadius: 10,
                        boxShadow: "rgba(0, 0, 0, 0.7) -10px -10px 40px inset",
                    }}
                />
            </div>
        </div>
    </>)
}