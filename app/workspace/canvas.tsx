import { useContext, useLayoutEffect, useRef, useState } from "react";
import { LaurusImgResult, LaurusSvgResult, WorkspaceActionType, WorkspaceContext, DEFAULT_CONTEXT_MENU_CONFIG } from "./workspace.client";
import { v4 } from "uuid";
import { findImg, findSvg } from "./workspace.server";
import { updateProject, createProject } from "../projects/projects.server";
import { LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "../projects/projects.client";

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

    async function handleSvgDrop(svgData: LaurusSvgResult, dropArea: ProjectCircle) {
        const newFrame = getCenteredRectInCircle(
            svgData.width,
            svgData.height,
            dropArea.cx,
            dropArea.cy,
            dropArea.radius);
        const newKey = v4();
        const svgMediaResult = await findSvg(appState.apiOrigin, svgData.media_key);
        if (svgMediaResult) {
            const projectSvg: LaurusProjectSvg = {
                svg_media_id: svgMediaResult.svg_media_id,
                width: newFrame.width,
                height: newFrame.height,
                top: newFrame.y,
                left: newFrame.x,
                order: 0,
                media_key: svgData.media_key,
                viewbox: svgData.viewbox,
                fill: svgData.fill,
                stroke: svgData.stroke,
                stroke_width: svgData.stroke_width,
                showContextMenu: false,
                rotate_x: 0,
                rotate_y: 0,
                rotate_z: 0,
                rotate_angle: 0,
                scale_x: 1,
                scale_y: 1,
                contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
            }
            const newSvgs: Map<string, LaurusProjectSvg> = new Map(appState.project.svgs);
            newSvgs.set(newKey, projectSvg);
            const rollback: LaurusProjectResult = { ...appState.project }
            const newProject: LaurusProjectResult = { ...rollback, svgs: newSvgs }
            if (appState.project.project_id) {
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
                if (projectUpdated) {
                    const encodedSvg = appState.browserSvgs.find(i => i.media_key == svgData.media_key);
                    if (encodedSvg) {
                        dispatch({ type: WorkspaceActionType.SetCanvasSvg, key: newKey, value: { ...encodedSvg } });
                        dispatch({ type: WorkspaceActionType.AddCarouselEntry, value: { type: 'svg', key: newKey } });
                    }
                }
                else {
                    dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
                }
            }
            else {
                const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
                if (projectCreated) {
                    const newProject2: LaurusProjectResult = { ...projectCreated, svgs: newSvgs }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                    const encodedSvg = appState.browserSvgs.find(i => i.media_key == svgData.media_key);
                    if (encodedSvg) {
                        dispatch({ type: WorkspaceActionType.SetCanvasSvg, key: newKey, value: { ...encodedSvg } });
                        dispatch({ type: WorkspaceActionType.AddCarouselEntry, value: { type: 'svg', key: newKey } });
                    }
                }
            }
        }
    }

    async function handleImgDrop(imgData: LaurusImgResult, dropArea: ProjectCircle) {
        const newFrame = getCenteredRectInCircle(
            imgData.width,
            imgData.height,
            dropArea.cx,
            dropArea.cy,
            dropArea.radius);
        const newKey = v4();
        const imgMediaResult = await findImg(appState.apiOrigin, imgData.media_key);
        if (imgMediaResult) {
            const projectImg: LaurusProjectImg = {
                width: newFrame.width,
                height: newFrame.height,
                media_key: imgData.media_key,
                showContextMenu: false,
                img_media_id: imgMediaResult.img_media_id,
                top: newFrame.y,
                left: newFrame.x,
                order: 0,
                rotate_x: 0,
                rotate_y: 0,
                rotate_z: 0,
                rotate_angle: 0,
                scale_x: 1,
                scale_y: 1,
                contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG }
            };
            const newImgs: Map<string, LaurusProjectImg> = new Map(appState.project.imgs);
            newImgs.set(newKey, projectImg);
            const rollback: LaurusProjectResult = { ...appState.project }
            const newProject: LaurusProjectResult = { ...rollback, imgs: newImgs }
            if (appState.project.project_id) {
                dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                const projectUpdated = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, { ...newProject });
                if (projectUpdated) {
                    const encodedImg = appState.browserImgs.find(i => i.media_key == imgData.media_key);
                    if (encodedImg) {
                        dispatch({ type: WorkspaceActionType.SetCanvasImg, key: newKey, value: { ...encodedImg } });
                        dispatch({ type: WorkspaceActionType.AddCarouselEntry, value: { type: 'img', key: newKey } });
                    }
                }
                else {
                    dispatch({ type: WorkspaceActionType.SetProject, value: rollback });
                }
            }
            else {
                const projectCreated = await createProject(appState.apiOrigin, appState.accessToken, { ...newProject });
                if (projectCreated) {
                    const newProject2: LaurusProjectResult = { ...projectCreated, imgs: newImgs }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                    const encodedImg = appState.browserImgs.find(i => i.media_key == imgData.media_key);
                    if (encodedImg) {
                        dispatch({ type: WorkspaceActionType.SetCanvasImg, key: newKey, value: { ...encodedImg } });
                        dispatch({ type: WorkspaceActionType.AddCarouselEntry, value: { type: 'img', key: newKey } });
                    }
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
                            const key = appState.browserElement.value.media_key;
                            const svgData = appState.browserSvgs.find(s => s.media_key === key);
                            if (svgData) {
                                handleSvgDrop(svgData, dropArea);
                            }
                            break;
                        }
                        case "img": {
                            const key = appState.browserElement.value.media_key;
                            const imgData = appState.browserImgs.find(s => s.media_key === key);
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