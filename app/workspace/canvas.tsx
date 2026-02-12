import { useContext, useLayoutEffect, useRef, useState } from "react";
import { LaurusImg, LaurusSvg, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { v4 } from "uuid"; // todo: uninstall package

function calcMousePosition(
    canvas: HTMLCanvasElement,
    event: React.MouseEvent<HTMLElement>) {

    const rect = canvas.getBoundingClientRect();
    const p = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
    return p;
}

function caclRadius(
    x: number,
    y: number,
    canvas: HTMLCanvasElement,
    event: React.MouseEvent<HTMLCanvasElement>,
    lineWidth: number) {

    const p = calcMousePosition(canvas, event);
    const padding = 2;
    const minRadius = lineWidth * 2 + padding;
    let radius = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));

    if (radius < minRadius) {
        radius = minRadius;
    }

    return radius;
}

function getCenteredRectInCircle(
    width: number,
    height: number,
    cx: number,
    cy: number,
    radius: number
): {
    x: number;
    y: number;
    width: number;
    height: number;
} {
    const aspectRatio = width / height;
    const diameter = radius * 2;

    // Calculate new dimensions based on Pythagoras: w^2 + h^2 = (2r)^2
    const newHeight = diameter / Math.sqrt(Math.pow(aspectRatio, 2) + 1);
    const newWidth = newHeight * aspectRatio;

    // Calculate centered top-left coordinates
    const x = cx - newWidth / 2;
    const y = cy - newHeight / 2;

    return { x, y, width: newWidth, height: newHeight };
}

interface ProjectCircle {
    cx: number,
    cy: number,
    radius: number,
}

export default function Canvas() {
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [liveAnchor, setLiveAnchor] = useState(false);
    const [anchor, setAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });


    useLayoutEffect(() => {
        const c = drawingCanvasRef.current;
        if (c) {
            const ctx = c.getContext('2d');
            if (!ctx) return;
            const strokeStyle = ctx.createLinearGradient(0, 0, 200, 0);
            strokeStyle.addColorStop(0, 'rgb(152, 152, 152)');
            strokeStyle.addColorStop(1, 'rgb(81, 81, 81)');
            ctx.strokeStyle = 'rgba(50, 50, 50, 1)';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.lineWidth = 1;

        }
    }, []);

    //const redrawStateCanvas = (circles: ProjectCircle[]) => {
    //    const canvas = drawingCanvasRef.current;
    //    if (!canvas) return;
    //    const ctx = canvas.getContext('2d');
    //    if (!ctx) return;
    //
    //    ctx.clearRect(0, 0, canvas.width, canvas.height);
    //    [...circles].forEach((shape) => {
    //        ctx.beginPath();
    //        ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
    //        ctx.stroke();
    //    });
    //}

    const click = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!appState.tool) return;
        switch (appState.tool.type) {
            case 'drop':
                {
                    const canvas = drawingCanvasRef.current;
                    if (!canvas) return;
                    const p = calcMousePosition(canvas, event);
                    setAnchor({ x: p.x, y: p.y });
                    setLiveAnchor(true);
                    break;
                }
            case 'delete':
                {
                    const canvas = drawingCanvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    //redrawStateCanvas([]);
                    break;
                }
        }
    }

    const mouseDrag = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!liveAnchor) return;
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (!appState.tool) return;
        switch (appState.tool.type) {
            case 'drop':
                {
                    const radius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.beginPath();
                    ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
            case "delete": {
                break
            }
        }
    }

    const mouseRelease = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!liveAnchor) return;
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (!appState.tool) return;

        switch (appState.tool.type) {
            case 'drop':
                {
                    const newCircle: ProjectCircle = {
                        cx: anchor.x,
                        cy: anchor.y,
                        radius: caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth),
                    };
                    if (appState.tool.value) {
                        switch (appState.tool.value.type) {
                            case "svg": {
                                const key = appState.tool.value.media.media_path;
                                const svg = appState.downloadedSvgs.find(s => s.media_path === key);
                                if (!svg) break;
                                const newFrame = getCenteredRectInCircle(
                                    svg.width,
                                    svg.height,
                                    newCircle.cx,
                                    newCircle.cy,
                                    newCircle.radius);
                                const laurusSvg: LaurusSvg = {
                                    ...svg,
                                    key: v4(),
                                    width: newFrame.width,
                                    height: newFrame.height,
                                    top: newFrame.y,
                                    left: newFrame.x
                                }
                                dispatch({ type: WorkspaceActionType.SetProjectSvg, value: laurusSvg });
                            }
                            case "img": {
                                const key = appState.tool.value.media.media_path;
                                const img = appState.downloadedImgs.find(s => s.media_path === key);
                                if (!img) break;
                                const newFrame = getCenteredRectInCircle(
                                    img.width,
                                    img.height,
                                    newCircle.cx,
                                    newCircle.cy,
                                    newCircle.radius);
                                const laurusImg: LaurusImg = {
                                    ...img,
                                    key: v4(),
                                    width: newFrame.width,
                                    height: newFrame.height,
                                    top: newFrame.y,
                                    left: newFrame.x
                                }
                                dispatch({ type: WorkspaceActionType.SetProjectImg, value: laurusImg });
                            }
                        }
                    }

                    setLiveAnchor(false);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    break;
                }
            case "delete": { break; }
        }
    }

    return (<>
        <div style={{
            width: appState.project.canvas_width,
            height: appState.project.canvas_height,
        }}>
            <canvas
                ref={drawingCanvasRef}
                width={appState.project.canvas_width}
                height={appState.project.canvas_height}
                onMouseMove={mouseDrag}
                onMouseUp={mouseRelease}
                onMouseLeave={mouseRelease}
                onMouseDown={click}
            />
        </div>
    </>)
}