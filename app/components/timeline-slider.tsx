import { RefObject } from "react"
import { PointerStyle, Trackpad } from "./trackpad"

interface TimelineSlider {
    label: string,
    hash: string,
    trackSize: { width: number | string, height: number | string }
    trackRef: RefObject<HTMLDivElement | null>,

    capSize: { width: number | string, height: number | string }
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,

    rangeCapSize: { width: number | string, height: number | string }
    rangeCursor: { x: number, y: number },
    onNewRangeCursor: (newCursor: { x: number, y: number }) => void,
    onRangeMove?: (newCursor: { x: number, y: number }) => void,
}
export default function TimelineSlider({
    label,
    hash,
    trackSize,
    trackRef,
    capSize,
    cursor,
    onNewCursor,
    onCursorMove,
    rangeCapSize,
    rangeCursor,
    onNewRangeCursor,
    onRangeMove,
}: TimelineSlider) {
    return (<>
        <div style={{ width: '100%', height: '100%', }}>
            <div
                style={{ position: "relative", ...trackSize, }}>
                <div style={{ position: 'absolute', width: '100%', }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
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
                <div style={{ position: 'absolute', width: '100%', }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c2`, draggableId: `${hash}|d2` }}
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
                {label && <div
                    style={{
                        zIndex: 1,
                        top: 0,
                        width: trackSize.width,
                        height: 22,
                        position: "absolute",
                        display: 'flex',
                        justifyContent: 'start',
                        background: "linear-gradient(45deg, rgb(11, 11, 11), rgb(25, 25, 25))",
                        border: '1px solid rgb(27, 27, 27)',
                        fontSize: 12,
                        paddingLeft: 7,
                        alignItems: 'center',
                        color: 'rgb(255, 255, 255)',
                    }}
                >
                    {label}
                </div>}
                <div
                    ref={trackRef}
                    style={{
                        zIndex: 0,
                        position: "absolute",
                        ...trackSize,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(27, 27, 27)',
                        borderRadius: 10,
                        boxShadow: "rgba(0, 0, 0, 0.7) -10px -10px 40px inset",
                    }}
                />
            </div>
        </div>
    </>)
}