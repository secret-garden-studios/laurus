import { RefObject, useContext, useState } from "react";
import { dmSans } from "../fonts";
import { Trackpad, PointerStyle } from "./trackpad";
import { WorkspaceContext } from "../workspace/workspace.client";

interface ParameterSlider {
    label: string,
    hash: string,
    capSize: { width: number | string, height: number | string }
    trackSize: { width: number | string, height: number | string }
    trackRef: RefObject<HTMLDivElement | null>,
    grooveWidth: number,
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
    onCursorMove?: (newCursor: { x: number, y: number }) => void,
    disabled?: boolean,
}
export default function ParameterSlider({
    label,
    hash,
    capSize,
    trackSize,
    trackRef,
    grooveWidth,
    cursor,
    onNewCursor,
    onCursorMove,
    disabled,
}: ParameterSlider) {
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
    return (<>
        <div style={{
            height: '100%',
            width: 'min-content',
            display: 'grid',
            justifyItems: 'center'
        }}>
            <div style={{
                position: "relative",
                ...trackSize,
            }}>
                <div style={{ position: 'absolute', height: '100%', width: '100%' }}>
                    <Trackpad
                        ids={{ contextId: `${hash}|c1`, draggableId: `${hash}|d1` }}
                        width={capSize.width}
                        height={'100%'}
                        coarsePointer={{
                            ...capSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor}
                        onMove={onCursorMove}
                        disabled={disabled} />
                </div>
                <div
                    ref={trackRef}
                    onMouseDown={(e) => {
                        if (disabled) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        const yOffset: number = parseFloat(`${capSize.height}`) || 0;
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
                        height: trackSize.height,
                        width: grooveWidth,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(5, 5, 5)'
                    }}
                />
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