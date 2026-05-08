import { RefObject, useCallback, useEffect, useState } from "react"
import { PointerStyle, Trackpad } from "./trackpad"
import { useTrackpadState } from "../hooks/useTrackpadState";

interface TimelineSlider {
    hash: string,
    size: {
        containerHeight: number | string,
        containerWidth: number | string,
        trackHeight: number | string,
        capWidth: number | string,
        capHeight: number | string,
    },
    trackRef: RefObject<HTMLDivElement | null>,
    trackBackground: string,
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,
    rangeCursor: { x: number, y: number },
    onNewRangeCursor: (newCursor: { x: number, y: number }) => void,
    onRangeMove?: (newCursor: { x: number, y: number }) => void,
    disabled?: boolean,
}
export default function TimelineSlider({
    size,
    hash,
    trackRef,
    trackBackground,
    cursor,
    onNewCursor,
    onCursorMove,
    rangeCursor,
    onNewRangeCursor,
    onRangeMove,
    disabled,
}: TimelineSlider) {
    const { getTrackValue } = useTrackpadState(0, 100);

    const cursorToValue = useCallback((cursorX: number): number => {
        if (!trackRef.current) return 0;
        const offset: number = parseFloat(size.capWidth.toString()) || 0;
        const value = getTrackValue(cursorX, (trackRef.current.clientWidth - offset), 0);
        return value;
    }, [getTrackValue, size.capWidth, trackRef]);

    const [startValue, setStartValue] = useState(0);
    const [rangeValue, setRangeValue] = useState(0);

    useEffect(() => {
        (async () => {
            setStartValue(cursorToValue(cursor.x))
            setRangeValue(cursorToValue(rangeCursor.x));
        })();
    }, [cursor.x, cursorToValue, rangeCursor.x]);

    return (<>
        <div style={{ width: '100%', height: '100%', }}>
            <div
                style={{
                    position: "relative",
                    width: size.containerWidth,
                    height: size.containerHeight,
                }}>
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: size.capHeight,
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    margin: 'auto',
                }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
                        width={'100%'}
                        height={size.capHeight}
                        coarsePointer={{
                            width: size.capWidth,
                            height: size.capHeight,
                            pointerStyle: PointerStyle.Solid,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={(c) => {
                            const newStartValue = cursorToValue(c.x);
                            setStartValue(newStartValue);
                            if (onCursorMove) { onCursorMove(c) }
                        }}
                        disabled={disabled} />
                </div>
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: size.capHeight,
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    margin: 'auto',
                }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c2`, draggableId: `${hash}|d2` }}
                        width={'100%'}
                        height={size.capHeight}
                        coarsePointer={{
                            width: size.capWidth,
                            height: size.capHeight,
                            pointerStyle: PointerStyle.Solid,
                            zIndex: 2
                        }}
                        value={rangeCursor}
                        onNewValue={onNewRangeCursor}
                        onMove={(c) => {
                            const newRangeValue = cursorToValue(c.x);
                            setRangeValue(newRangeValue);
                            if (onRangeMove) { onRangeMove(c) }
                        }}
                        disabled={disabled} />
                </div>
                {/* Track */}
                <div
                    ref={trackRef}
                    style={{
                        zIndex: 0,
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        position: "absolute",
                        margin: 'auto',
                        width: size.containerWidth,
                        height: size.trackHeight,
                        background: trackBackground,
                        borderRadius: 8,
                    }}
                >
                    {/* Highlighted Glowing Section */}
                    <div
                        style={{
                            position: 'absolute',
                            left: `${Math.min(startValue, rangeValue)}%`,
                            width: `${Math.abs(rangeValue - startValue)}%`,
                            height: '100%',
                            zIndex: 1,
                            background: 'linear-gradient(1deg, rgb(219, 219, 219), rgb(141, 141, 141))',
                            boxShadow: '0 0 8px 1px rgba(255, 255, 255, 0.275)',
                        }}
                    />
                </div>
            </div>
        </div>
    </>)
}