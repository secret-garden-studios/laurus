import { useContext, useLayoutEffect, useRef, useState } from "react";
import { EncodedImg, EncodedSvg, LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { v4 } from "uuid";
import { createProject, findImg, findSvg, updateProject } from "./workspace.server";

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
    const newHeight = diameter / Math.sqrt(Math.pow(aspectRatio, 2) + 1);
    const newWidth = newHeight * aspectRatio;
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
    const [anchor, setAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const [minRadius] = useState(10);

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

    const click = (event: React.MouseEvent<HTMLCanvasElement>) => {
        switch (appState.tool.type) {
            case 'drop': {
                const canvas = drawingCanvasRef.current;
                if (!canvas) return;
                const p = calcMousePosition(canvas, event);
                setAnchor({ x: p.x, y: p.y });
                break;
            }
        }
    }

    const mouseDrag = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!anchor) return;
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        switch (appState.tool.type) {
            case 'drop': {
                const radius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
        }
    }

    async function handleSvgDrop(svgData: EncodedSvg, dropArea: ProjectCircle) {
        const newFrame = getCenteredRectInCircle(
            svgData.width,
            svgData.height,
            dropArea.cx,
            dropArea.cy,
            dropArea.radius);
        const newKey = v4();
        const svgMediaResult = await findSvg(appState.apiOrigin, svgData.media_path);
        if (svgMediaResult) {
            const projectSvg: LaurusProjectSvg = {
                svg_media_id: svgMediaResult.svg_media_id,
                width: newFrame.width,
                height: newFrame.height,
                top: newFrame.y,
                left: newFrame.x,
                media_path: svgData.media_path,
                viewbox: svgData.viewbox,
                fill: svgData.fill,
                stroke: svgData.stroke,
                stroke_width: svgData.stroke_width,
                pending: false,
            }
            const newProjectSvgs: Map<string, LaurusProjectSvg> = new Map(appState.project.svgs);
            newProjectSvgs.set(newKey, projectSvg);
            const encodedSvg = appState.browserSvgs.find(i => i.media_path == svgData.media_path);
            if (encodedSvg) {
                dispatch({ type: WorkspaceActionType.AddCanvasSvg, value: { ...encodedSvg } });
            }

            if (appState.project.project_id) {
                const newProject: LaurusProjectResult = { ...appState.project, svgs: newProjectSvgs }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
            }
            else {
                const newProject: LaurusProjectResult = { ...appState.project, svgs: newProjectSvgs }
                const response = await createProject(appState.apiOrigin, { ...newProject });
                if (response) {
                    const newProject2: LaurusProjectResult = { ...newProject, svgs: newProjectSvgs, project_id: response.project_id }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                }
            }
        }
    }

    async function handleImgDrop(imgData: EncodedImg, dropArea: ProjectCircle) {
        const newFrame = getCenteredRectInCircle(
            imgData.width,
            imgData.height,
            dropArea.cx,
            dropArea.cy,
            dropArea.radius);
        const newKey = v4();
        const imgMediaResult = await findImg(appState.apiOrigin, imgData.media_path);
        if (imgMediaResult) {
            const laurusImg: LaurusProjectImg = {
                width: newFrame.width,
                height: newFrame.height,
                media_path: imgData.media_path,
                pending: false,
                img_media_id: imgMediaResult.img_media_id,
                top: newFrame.y,
                left: newFrame.x,
            };

            const newImgs: Map<string, LaurusProjectImg> = new Map(appState.project.imgs);
            newImgs.set(newKey, laurusImg);
            const encodedImg = appState.browserImgs.find(i => i.media_path == imgData.media_path);
            if (encodedImg) {
                dispatch({ type: WorkspaceActionType.AddCanvasImg, value: { ...encodedImg } });
            }

            if (appState.project.project_id) {
                const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs }
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                await updateProject(appState.apiOrigin, newProject.project_id, { ...newProject });
            }
            else {
                const newProject: LaurusProjectResult = { ...appState.project, imgs: newImgs }
                const response = await createProject(appState.apiOrigin, { ...newProject });
                if (response) {
                    const newProject2: LaurusProjectResult = { ...newProject, imgs: newImgs, project_id: response.project_id }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                }
            }
        }
    }

    const mouseRelease = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!anchor) return;
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        switch (appState.tool.type) {
            case 'drop':
                {
                    const newRadius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
                    if (newRadius < minRadius || !appState.browserElement) break;
                    const dropArea: ProjectCircle = {
                        cx: anchor.x,
                        cy: anchor.y,
                        radius: newRadius,
                    };
                    switch (appState.browserElement.type) {
                        case "svg": {
                            const key = appState.browserElement.value.media_path;
                            const svgData = appState.browserSvgs.find(s => s.media_path === key);
                            if (svgData) {
                                handleSvgDrop(svgData, dropArea);
                            }
                            break;
                        }
                        case "img": {
                            const key = appState.browserElement.value.media_path;
                            const imgData = appState.browserImgs.find(s => s.media_path === key);
                            if (imgData) {
                                handleImgDrop(imgData, dropArea)
                            }
                            break;
                        }
                    }
                    break;
                }
        }
        setAnchor(undefined);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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