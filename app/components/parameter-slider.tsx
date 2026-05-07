import { RefObject, useCallback, useContext, useEffect, useState } from "react";
import { dmSans } from "../fonts";
import { Trackpad, PointerStyle } from "./trackpad";
import { WorkspaceContext } from "../workspace/workspace.client";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { SvgRepo, remove, add2 } from "../svg-repo";

interface ParameterSliderY {
    label: string,
    hash: string,
    size: {
        containerHeight: number | string,
        containerWidth: number | string,
        trackWidth: number | string,
        capWidth: number | string,
        capHeight: number | string,
        capBorderOffset: number,
    },
    trackRef: RefObject<HTMLDivElement | null>,
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,
    disabled?: boolean,
}
export default function ParameterSliderY({
    label,
    hash,
    size,
    trackRef,
    cursor,
    onNewCursor,
    onCursorMove,
    disabled,
}: ParameterSliderY) {
    const { appState } = useContext(WorkspaceContext);
    const [labelFontSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return 11
            case "midhigh": return 8
            case "midlow":
            case "low": return 7
        }
    });
    const [labelPaddingTop] = useState(Math.round(10 * appState.resolution.factor));
    const { getInverseTrackValue } = useTrackpadState(0, 100);

    const cursorToValue = useCallback((cursorY: number): number => {
        if (!trackRef.current) return 0;
        const offset: number = (parseFloat(size.capHeight.toString()) || 0) + size.capBorderOffset;
        const value = getInverseTrackValue(cursorY, (trackRef.current.clientHeight - offset), 0);
        return value;
    }, [getInverseTrackValue, size.capBorderOffset, size.capHeight, trackRef]);

    const [startValue, setStartValue] = useState(0);

    useEffect(() => {
        (async () => {
            setStartValue(cursorToValue(cursor.y));
        })();
    }, [cursor.y, cursorToValue]);

    return (<>
        <div style={{
            height: '100%',
            width: 'min-content',
            display: 'grid',
            justifyItems: 'center'
        }}>
            <div style={{
                position: "relative",
                width: size.containerWidth,
                height: size.containerHeight,
            }}>
                <div style={{
                    position: 'absolute',
                    height: '100%',
                    width: size.capWidth,
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    margin: 'auto',
                }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
                        width={size.capWidth}
                        height={'100%'}
                        coarsePointer={{
                            width: size.capWidth,
                            height: size.capHeight,
                            pointerStyle: PointerStyle.Solid,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={(c) => {
                            const newStartValue = cursorToValue(c.y);
                            setStartValue(newStartValue);
                            if (onCursorMove) { onCursorMove(c) }
                        }}
                        disabled={disabled} />
                </div>
                <div
                    ref={trackRef}
                    onMouseDown={(e) => {
                        if (disabled) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        const yOffset: number = parseFloat(`${size.capHeight}`) || 0;
                        onNewCursor({ x, y: Math.min(y, rect.height - yOffset) });
                    }}
                    style={{
                        zIndex: 0,
                        cursor: disabled ? '' : 'crosshair',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        margin: 'auto',
                        position: "absolute",
                        height: size.containerHeight,
                        width: size.trackWidth,
                        background: 'linear-gradient(1deg, rgb(53, 53, 53), rgb(56, 56, 56))',
                        borderRadius: 8,
                    }}
                >
                    {/* Highlighted Glowing Section */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            height: `${startValue}%`,
                            width: '100%',
                            background: 'linear-gradient(45deg, rgb(141, 141, 141), rgb(219, 219, 219))',
                            zIndex: 1,
                            boxShadow: '0 0 8px 1px rgba(255, 255, 255, 0.275)',
                        }}
                    />
                </div>
            </div>
            {label &&
                <div
                    className={dmSans.className}
                    style={{ fontSize: labelFontSize, paddingTop: labelPaddingTop }}>
                    {label}
                </div>}
        </div>
    </>)
}

interface ParameterSliderX {
    label?: string,
    hash: string,
    size: {
        capWidth: number | string,
        capHeight: number | string,
        capBorderOffset: number,
        containerWidth: number | string,
        containerHeight: number | string,
        trackHeight: number | string,
        tickHeight: number | string,
        tickLeft: number | string,
    }
    containerRef: RefObject<HTMLDivElement | null>,
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,
    disabled?: boolean,
}
export function ParameterSliderX({
    hash,
    size,
    containerRef,
    cursor,
    onNewCursor,
    onCursorMove,
    disabled,
}: ParameterSliderX) {
    return (<>
        <div style={{
            display: 'flex',
            alignItems: 'center',
        }}>
            <SvgRepo
                svg={remove('rgb(227, 227, 227)')}
                containerSize={{
                    width: 24,
                    height: 24
                }} scale={0.75} />
            <div
                style={{
                    position: "relative",
                    width: size.containerWidth,
                    height: size.containerHeight
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
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2,
                            borderColor: 'rgba(255,255,255,0.3)'

                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={onCursorMove}
                        disabled={disabled} />
                </div>
                {/* label*/}
                <div
                    style={{
                        zIndex: 1,
                        top: 0,
                        left: size.tickLeft,
                        right: 0,
                        bottom: 0,
                        margin: 'auto',
                        width: 1,
                        height: size.tickHeight,
                        position: "absolute",
                        background: 'rgb(100, 100, 100)'
                    }}
                />
                <div
                    ref={containerRef}
                    onMouseDown={(e) => {
                        if (disabled) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        onNewCursor({ x, y });
                    }}
                    style={{
                        zIndex: 0,
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        cursor: disabled ? '' : 'crosshair',
                        position: "absolute",
                        margin: 'auto',
                        width: size.containerWidth,
                        height: size.trackHeight,
                        background: 'linear-gradient(1deg, rgb(63, 63, 63), rgb(66, 66, 66))',
                        borderRadius: 8,
                    }}
                />
            </div>
            <SvgRepo
                svg={add2('rgb(227, 227, 227)')}
                containerSize={{
                    width: 24,
                    height: 24
                }} scale={0.5} />
        </div>

    </>)
}