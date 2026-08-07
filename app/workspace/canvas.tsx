import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "./workspace.client";
import { v4 as newUUID } from "uuid";
import {
  updateProject,
  createProject,
  DEFAULT_CONTEXT_MENU_CONFIG,
  LaurusProjectImg,
  LaurusProjectResult,
  LaurusProjectSvg,
} from "../projects/projects.server";
import { LaurusTool, UIActionType } from "./states/ui-state";
import { LaurusImgResult, LaurusSvgResult } from "./workspace.server";
import { CoreActionType } from "./states/core-state";
import { ProjectMaskItem, ProjectMaskItemSource } from "./canvas-media/project-mask-item";
import { captureTriangleIndicesInCircle } from "./canvas-media/light-source-capture";

function calcMousePosition(canvas: HTMLCanvasElement, event: React.MouseEvent<HTMLElement>) {
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
  lineWidth: number,
) {
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
  radius: number,
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
  cx: number;
  cy: number;
  radius: number;
}

function calculateDropFrame(width: number, height: number, dropArea: ProjectCircle, tool: LaurusTool) {
  const frame = getCenteredRectInCircle(width, height, dropArea.cx, dropArea.cy, dropArea.radius);
  if (tool.type != "marquee") return frame;
  if (tool.size.value) {
    const mediaAspectRatio = width / height;
    if (tool.size.width !== undefined && tool.size.height !== undefined) {
      if (mediaAspectRatio > tool.size.width / tool.size.height) {
        frame.width = tool.size.width;
        frame.height = frame.width / mediaAspectRatio;
      } else {
        frame.height = tool.size.height;
        frame.width = frame.height * mediaAspectRatio;
      }
    } else if (tool.size.width !== undefined) {
      frame.width = tool.size.width;
      frame.height = frame.width / mediaAspectRatio;
    } else if (tool.size.height !== undefined) {
      frame.height = tool.size.height;
      frame.width = frame.height * mediaAspectRatio;
    }
    frame.x = dropArea.cx - frame.width / 2;
    frame.y = dropArea.cy - frame.height / 2;
  }
  if (tool.position.value) {
    if (tool.position.x !== undefined) {
      frame.x = tool.position.x;
    }
    if (tool.position.y !== undefined) {
      frame.y = tool.position.y;
    }
  }
  return frame;
}

function isBadFrame(
  newFrame: { x: number; y: number; width: number; height: number },
  canvas_width: number,
  canvas_height: number,
): boolean {
  if (newFrame.width < 0 || newFrame.height < 0) {
    alert("drop area is too small!");
    return true;
  }
  if (newFrame.width > canvas_width || newFrame.height > canvas_height) {
    alert("drop area is too big!");
    return true;
  }

  if (
    newFrame.x < 0 ||
    newFrame.y < 0 ||
    newFrame.x + newFrame.width > canvas_width ||
    newFrame.y + newFrame.height > canvas_height
  ) {
    alert("drop area is out of bounds!");
    return true;
  }
  return false;
}

export default function Canvas() {
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const { coreState, dispatch, captureMeshSection } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { selectedImgKeys, selectedSvgKeys, selectedMaskKeys, setSelectedImgKeys, setSelectedSvgKeys } =
    useContext(HoverContext);
  const mask = useContext(MaskContext);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
  const [minRadius] = useState(10);

  // Keyed off selectedImgKeys rather than activeElement -- that's what Maskbar actually
  // masks (see its selectedImgKey), so the live preview needs to watch the same thing or it
  // silently never shows up for an image that was only ever alt-selected, not plain-clicked.
  //
  // Hidden once mask.status reaches "done": Maskbar's persistMask runs synchronously off that
  // same "complete" event (see useMaskPreview's onComplete), placing a real static mask at the
  // exact same frame/position liveMaskFrame/liveMaskDndPosition already mirror. Leaving this live
  // overlay mounted after that point meant two WebGL canvases -- this one and the freshly-placed
  // static one, which still has to open its own GL context and async-load its own texture --
  // rendering on top of each other at the same spot, which is what read as a flicker on the mask
  // right as masking finished. mask.start() flips status back to "connecting" immediately if the
  // user re-masks the same image, so this comes right back for another streaming pass.
  const activeMaskImg = useMemo(() => {
    if (uiState.tool.type !== "mask" || selectedImgKeys.size !== 1 || mask.status === "done") return undefined;
    const key = Array.from(selectedImgKeys)[0];
    const meta = coreState.project.imgs.get(key);
    const imgData = coreState.canvasImgs.get(key);
    if (!meta || !imgData) return undefined;
    return { key, meta, imgData };
  }, [uiState.tool.type, selectedImgKeys, coreState.project.imgs, coreState.canvasImgs, mask.status]);

  // Mirrors Maskbar's persistMask defaulting exactly, so the live preview lands at the
  // same place/size the placed result will -- without this, the preview always sits on the
  // source image and only jumps to the position/size override once masking finishes.
  const liveMaskFrame = useMemo(() => {
    if (!activeMaskImg) return undefined;
    const meta = activeMaskImg.meta;
    return {
      width: mask.size.value && mask.size.width !== undefined ? mask.size.width : meta.width,
      height: mask.size.value && mask.size.height !== undefined ? mask.size.height : meta.height,
      scale_x: meta.scale_x,
      scale_y: meta.scale_y,
    };
  }, [activeMaskImg, mask.size]);

  const liveMaskDndPosition = useMemo(() => {
    if (!activeMaskImg) return undefined;
    const meta = activeMaskImg.meta;
    return {
      x: mask.position.value && mask.position.x !== undefined ? mask.position.x : meta.left,
      y: mask.position.value && mask.position.y !== undefined ? mask.position.y : meta.top,
    };
  }, [activeMaskImg, mask.position]);

  // Deliberately not re-created every time `mask` itself changes reference -- it does, on
  // every single triangle/status update, because useMaskPreview's provider re-renders and
  // hands out a fresh wrapper object each time. What ProjectMaskItem's live GL effect actually
  // reads off it (meshRefs, textureMixRef) are refs that stay the same underlying objects
  // regardless, so a "stale" wrapper is functionally identical to a fresh one here. Without this
  // memo, ProjectMaskItem saw a "new" source prop on every triangle and tore down + rebuilt its
  // entire WebGL context (including a fresh async texture reload) each time -- the actual cause of
  // the streaming flicker and the "reverts to the plain image, pauses" glitch right at completion.
  const liveMaskSource = useMemo<ProjectMaskItemSource | undefined>(() => {
    if (!activeMaskImg) return undefined;
    return { kind: "live", mask, sourceImg: activeMaskImg.imgData };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMaskImg]);

  useLayoutEffect(() => {
    const c = drawingCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const strokeStyle = ctx.createLinearGradient(0, 0, 200, 0);
      strokeStyle.addColorStop(0, "rgb(152, 152, 152)");
      strokeStyle.addColorStop(1, "rgb(81, 81, 81)");
      ctx.strokeStyle = "rgba(50, 50, 50, 1)";
      ctx.shadowColor = "rgba(255, 255, 255, 0.7)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 1;
    }
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      switch (uiState.tool.type) {
        case "marquee": {
          const canvas = drawingCanvasRef.current;
          if (!canvas) return;
          const p = calcMousePosition(canvas, event);
          setAnchor({ x: p.x, y: p.y });
          break;
        }
        case "mask": {
          if (!uiState.tool.capturingMeshSection) break;
          const canvas = drawingCanvasRef.current;
          if (!canvas) return;
          const p = calcMousePosition(canvas, event);
          setAnchor({ x: p.x, y: p.y });
          break;
        }
      }
    },
    [uiState.tool],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!anchor) return;
      const canvas = drawingCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      switch (uiState.tool.type) {
        case "marquee": {
          const radius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "mask": {
          if (!uiState.tool.capturingMeshSection) break;
          const radius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
    },
    [anchor, uiState.tool],
  );

  const handleSvgDrop = useCallback(
    async (svgData: LaurusSvgResult, dropArea: ProjectCircle) => {
      const newFrame = calculateDropFrame(svgData.width, svgData.height, dropArea, uiState.tool);
      if (isBadFrame(newFrame, coreState.project.canvas_width, coreState.project.canvas_height)) {
        return;
      }
      const projectSvg: LaurusProjectSvg = {
        svg_media_id: svgData.svg_media_id,
        media_group_id: "",
        width: newFrame.width,
        height: newFrame.height,
        top: newFrame.y,
        left: newFrame.x,
        order:
          Math.max(
            -1,
            ...Array.from(coreState.project.svgs.values()).map((s) => s.order),
            ...Array.from(coreState.project.masks.values()).map((v) => v.order),
          ) + 1,
        media_key: svgData.media_key,
        viewbox: svgData.viewbox,
        fill: svgData.fill,
        stroke: svgData.stroke,
        stroke_width: svgData.stroke_width,
        rotate_x: 0,
        rotate_y: 0,
        rotate_z: 0,
        rotate_angle: 0,
        scale_x: 1,
        scale_y: 1,
        description: "",
      };
      const newSvgs: Map<string, LaurusProjectSvg> = new Map(coreState.project.svgs);
      const newKey = newUUID();
      newSvgs.set(newKey, projectSvg);
      const newProject: LaurusProjectResult = {
        ...coreState.project,
        svgs: newSvgs,
      };
      if (coreState.project.project_id) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        const projectUpdated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (projectUpdated) {
          const encodedSvg = uiState.browserSvgs.find((i) => i.media_key == svgData.media_key);
          if (encodedSvg) {
            dispatch({
              type: CoreActionType.SetCanvasSvg,
              key: newKey,
              value: { ...encodedSvg },
            });
            uiDispatch({
              type: UIActionType.AddCarouselEntry,
              value: { type: "svg", key: newKey },
            });
            uiDispatch({
              type: UIActionType.SetProjectContextMenu,
              key: newKey,
              showContextMenu: false,
              contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
            });
          }
        }
      } else {
        const projectCreated = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
        if (projectCreated) {
          const newProject2: LaurusProjectResult = {
            ...projectCreated,
            svgs: newSvgs,
          };
          dispatch({ type: CoreActionType.SetProject, value: newProject2 });
          const encodedSvg = uiState.browserSvgs.find((i) => i.media_key == svgData.media_key);
          if (encodedSvg) {
            dispatch({
              type: CoreActionType.SetCanvasSvg,
              key: newKey,
              value: { ...encodedSvg },
            });
            uiDispatch({
              type: UIActionType.AddCarouselEntry,
              value: { type: "svg", key: newKey },
            });
            uiDispatch({
              type: UIActionType.SetProjectContextMenu,
              key: newKey,
              showContextMenu: false,
              contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
            });
          }
        }
      }
    },
    [
      uiState.tool,
      uiState.browserSvgs,
      coreState.project,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      uiDispatch,
    ],
  );

  const handleImgDrop = useCallback(
    async (imgData: LaurusImgResult, dropArea: ProjectCircle) => {
      const newFrame = calculateDropFrame(imgData.width, imgData.height, dropArea, uiState.tool);
      if (isBadFrame(newFrame, coreState.project.canvas_width, coreState.project.canvas_height)) {
        return;
      }
      const projectImg: LaurusProjectImg = {
        width: newFrame.width,
        height: newFrame.height,
        media_key: imgData.media_key,
        img_media_id: imgData.img_media_id,
        media_group_id: "",
        top: newFrame.y,
        left: newFrame.x,
        order:
          Math.max(
            -1,
            ...Array.from(coreState.project.imgs.values()).map((i) => i.order),
            ...Array.from(coreState.project.masks.values()).map((v) => v.order),
          ) + 1,
        rotate_x: 0,
        rotate_y: 0,
        rotate_z: 0,
        rotate_angle: 0,
        scale_x: 1,
        scale_y: 1,
        description: "",
      };
      const newImgs: Map<string, LaurusProjectImg> = new Map(coreState.project.imgs);
      const newKey = newUUID();
      newImgs.set(newKey, projectImg);
      const newProject: LaurusProjectResult = {
        ...coreState.project,
        imgs: newImgs,
      };
      if (coreState.project.project_id) {
        const projectUpdated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (projectUpdated) {
          dispatch({ type: CoreActionType.SetProject, value: newProject });
          const encodedImg = uiState.browserImgs.find((i) => i.media_key == imgData.media_key);
          if (encodedImg) {
            dispatch({
              type: CoreActionType.SetCanvasImg,
              key: newKey,
              value: { ...encodedImg },
            });
            uiDispatch({
              type: UIActionType.AddCarouselEntry,
              value: { type: "img", key: newKey },
            });
            uiDispatch({
              type: UIActionType.SetProjectContextMenu,
              key: newKey,
              showContextMenu: false,
              contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
            });
          }
        }
      } else {
        const projectCreated = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
        if (projectCreated) {
          const newProject2: LaurusProjectResult = {
            ...projectCreated,
            imgs: newImgs,
          };
          dispatch({ type: CoreActionType.SetProject, value: newProject2 });
          const encodedImg = uiState.browserImgs.find((i) => i.media_key == imgData.media_key);
          if (encodedImg) {
            dispatch({
              type: CoreActionType.SetCanvasImg,
              key: newKey,
              value: { ...encodedImg },
            });
            uiDispatch({
              type: UIActionType.AddCarouselEntry,
              value: { type: "img", key: newKey },
            });
            uiDispatch({
              type: UIActionType.SetProjectContextMenu,
              key: newKey,
              showContextMenu: false,
              contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
            });
          }
        }
      }
    },
    [
      uiState.tool,
      uiState.browserImgs,
      coreState.project,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      uiDispatch,
    ],
  );

  // Captures whichever triangles of the one selected mask's mesh fall inside the drag circle and
  // immediately persists them -- drawing the circle *is* the confirmation, no separate confirm
  // step (see workspace.client.tsx's captureMeshSection). Shown optimistically as a mesh highlight
  // in project-mask-item.tsx while the request is in flight.
  //
  // The circle arrives in main-canvas space (same space `anchor`/dropArea already live in, and
  // the same space this drawing canvas's own getBoundingClientRect() lives in). Rather than
  // re-derive the mask's on-screen rect from project placement metadata (top/left/scale/frame
  // offsets -- several assumptions that can silently drift out of sync with what's actually
  // rendered), this measures the mask's real DOM canvas directly (found via the data-mask-key
  // attribute project-mask-item.tsx sets on it), the same way that component's own onMouseMove
  // handler already converts screen coordinates into mesh-buffer-pixel space for the
  // mouse-driven light source.
  const handleLightSourceCapture = useCallback(
    (dropArea: ProjectCircle) => {
      if (selectedMaskKeys.size !== 1) return;
      const maskKey = Array.from(selectedMaskKeys)[0];
      const maskData = coreState.canvasMasks.get(maskKey);
      const drawingCanvas = drawingCanvasRef.current;
      if (!maskData || !drawingCanvas) return;

      const maskCanvasEl = document.querySelector<HTMLCanvasElement>(`canvas[data-mask-key="${CSS.escape(maskKey)}"]`);
      if (!maskCanvasEl) return;

      const drawingRect = drawingCanvas.getBoundingClientRect();
      const maskRect = maskCanvasEl.getBoundingClientRect();
      if (maskRect.width === 0 || maskRect.height === 0) return;

      // dropArea.cx/cy are relative to the drawing canvas's own top-left (see
      // calcMousePosition) -- reconstruct a viewport-relative position and re-express it
      // relative to the mask canvas's own top-left instead.
      const localX = dropArea.cx + drawingRect.left - maskRect.left;
      const localY = dropArea.cy + drawingRect.top - maskRect.top;

      const scaleX = maskCanvasEl.width / maskRect.width;
      const scaleY = maskCanvasEl.height / maskRect.height;

      const meshCircle = {
        cx: localX * scaleX,
        cy: localY * scaleY,
        radius: dropArea.radius * scaleX,
      };

      const polygonIndices = captureTriangleIndicesInCircle(maskData.polygons, meshCircle);
      if (polygonIndices.size === 0) return;

      captureMeshSection(maskKey, Array.from(polygonIndices));
    },
    [selectedMaskKeys, coreState.canvasMasks, captureMeshSection],
  );

  const handleDuplicateDrop = useCallback(
    async (dropArea: ProjectCircle) => {
      const snapshot = coreState.project;
      const selectedImgEntries = Array.from(selectedImgKeys)
        .map((key) => ({ key, meta: snapshot.imgs.get(key) }))
        .filter((entry): entry is { key: string; meta: LaurusProjectImg } => Boolean(entry.meta));
      const selectedSvgEntries = Array.from(selectedSvgKeys)
        .map((key) => ({ key, meta: snapshot.svgs.get(key) }))
        .filter((entry): entry is { key: string; meta: LaurusProjectSvg } => Boolean(entry.meta));
      if (selectedImgEntries.length === 0 && selectedSvgEntries.length === 0) return;

      const allMetas = [...selectedImgEntries.map((e) => e.meta), ...selectedSvgEntries.map((e) => e.meta)];
      const minX = Math.min(...allMetas.map((m) => m.left));
      const minY = Math.min(...allMetas.map((m) => m.top));
      const maxX = Math.max(...allMetas.map((m) => m.left + m.width * m.scale_x));
      const maxY = Math.max(...allMetas.map((m) => m.top + m.height * m.scale_y));
      let deltaX = dropArea.cx - (minX + maxX) / 2;
      let deltaY = dropArea.cy - (minY + maxY) / 2;
      if (uiState.tool.type === "marquee" && uiState.tool.position.value) {
        if (uiState.tool.position.x !== undefined) {
          deltaX = uiState.tool.position.x - minX;
        }
        if (uiState.tool.position.y !== undefined) {
          deltaY = uiState.tool.position.y - minY;
        }
      }

      const groupFrame = { x: minX + deltaX, y: minY + deltaY, width: maxX - minX, height: maxY - minY };
      if (isBadFrame(groupFrame, coreState.project.canvas_width, coreState.project.canvas_height)) {
        return;
      }

      let maxOrder = Math.max(
        -1,
        ...Array.from(snapshot.imgs.values()).map((i) => i.order),
        ...Array.from(snapshot.svgs.values()).map((s) => s.order),
        ...Array.from(snapshot.masks.values()).map((v) => v.order),
      );

      const newImgs = new Map(snapshot.imgs);
      const newSvgs = new Map(snapshot.svgs);
      const newImgKeys = new Set<string>();
      const newSvgKeys = new Set<string>();
      const newCanvasImgEntries: { key: string; value: LaurusImgResult }[] = [];
      const newCanvasSvgEntries: { key: string; value: LaurusSvgResult }[] = [];

      selectedImgEntries.forEach(({ key, meta }) => {
        const newKey = newUUID();
        maxOrder += 1;
        newImgs.set(newKey, {
          ...meta,
          media_group_id: "",
          left: Math.round(meta.left + deltaX),
          top: Math.round(meta.top + deltaY),
          order: maxOrder,
        });
        const canvasImg = coreState.canvasImgs.get(key);
        if (canvasImg) newCanvasImgEntries.push({ key: newKey, value: canvasImg });
        newImgKeys.add(newKey);
      });

      selectedSvgEntries.forEach(({ key, meta }) => {
        const newKey = newUUID();
        maxOrder += 1;
        newSvgs.set(newKey, {
          ...meta,
          media_group_id: "",
          left: Math.round(meta.left + deltaX),
          top: Math.round(meta.top + deltaY),
          order: maxOrder,
        });
        const canvasSvg = coreState.canvasSvgs.get(key);
        if (canvasSvg) newCanvasSvgEntries.push({ key: newKey, value: canvasSvg });
        newSvgKeys.add(newKey);
      });

      const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs, svgs: newSvgs };
      if (!newProject.project_id) return;

      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (!updated) return;

      dispatch({ type: CoreActionType.SetProject, value: newProject });
      newCanvasImgEntries.forEach(({ key, value }) => {
        dispatch({ type: CoreActionType.SetCanvasImg, key, value });
        uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "img", key } });
        uiDispatch({
          type: UIActionType.SetProjectContextMenu,
          key,
          showContextMenu: false,
          contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
        });
      });
      newCanvasSvgEntries.forEach(({ key, value }) => {
        dispatch({ type: CoreActionType.SetCanvasSvg, key, value });
        uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "svg", key } });
        uiDispatch({
          type: UIActionType.SetProjectContextMenu,
          key,
          showContextMenu: false,
          contextMenuConfig: { ...DEFAULT_CONTEXT_MENU_CONFIG },
        });
      });
      setSelectedImgKeys(newImgKeys);
      setSelectedSvgKeys(newSvgKeys);
      uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
    },
    [
      selectedImgKeys,
      selectedSvgKeys,
      coreState.project,
      coreState.canvasImgs,
      coreState.canvasSvgs,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      uiDispatch,
      setSelectedImgKeys,
      setSelectedSvgKeys,
      uiState.tool,
    ],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!anchor) return;
      const canvas = drawingCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      switch (uiState.tool.type) {
        case "marquee": {
          const newRadius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
          if (newRadius < minRadius) break;

          const dropArea: ProjectCircle = {
            cx: anchor.x,
            cy: anchor.y,
            radius: newRadius,
          };

          if (uiState.tool.select) {
            const foundImgKeys = new Set<string>();
            const foundSvgKeys = new Set<string>();
            const isInside = (meta: LaurusProjectImg | LaurusProjectSvg) => {
              const centerX = meta.left + (meta.width * meta.scale_x) / 2;
              const centerY = meta.top + (meta.height * meta.scale_y) / 2;
              const dx = centerX - dropArea.cx;
              const dy = centerY - dropArea.cy;
              return dx * dx + dy * dy <= dropArea.radius * dropArea.radius;
            };

            coreState.project.imgs.forEach((meta, key) => {
              if (isInside(meta)) foundImgKeys.add(key);
            });

            coreState.project.svgs.forEach((meta, key) => {
              if (isInside(meta)) foundSvgKeys.add(key);
            });

            setSelectedImgKeys(foundImgKeys);
            setSelectedSvgKeys(foundSvgKeys);
            uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
            break;
          }

          if (uiState.tool.duplicate) {
            if (selectedImgKeys.size > 0 || selectedSvgKeys.size > 0) {
              handleDuplicateDrop(dropArea);
            }
            break;
          }

          if (!uiState.browserElement) break;

          switch (uiState.browserElement.type) {
            case "svg": {
              const key = uiState.browserElement.value.media_key;
              const svgData = uiState.browserSvgs.find((s) => s.media_key === key);
              if (svgData) {
                handleSvgDrop(svgData, dropArea);
              }
              break;
            }
            case "img": {
              const key = uiState.browserElement.value.media_key;
              const imgData = uiState.browserImgs.find((s) => s.media_key === key);
              if (imgData) {
                handleImgDrop(imgData, dropArea);
              }
              break;
            }
          }
          break;
        }
        case "mask": {
          if (!uiState.tool.capturingMeshSection) break;
          const newRadius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
          if (newRadius < minRadius) break;
          handleLightSourceCapture({ cx: anchor.x, cy: anchor.y, radius: newRadius });
          break;
        }
      }
      setAnchor(undefined);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    [
      anchor,
      uiState.tool,
      uiState.browserElement,
      uiState.browserSvgs,
      uiState.browserImgs,
      minRadius,
      coreState.project.imgs,
      coreState.project.svgs,
      handleLightSourceCapture,
      selectedImgKeys,
      selectedSvgKeys,
      setSelectedImgKeys,
      setSelectedSvgKeys,
      handleSvgDrop,
      handleImgDrop,
      handleDuplicateDrop,
      uiDispatch,
    ],
  );

  return (
    <>
      <div
        style={{
          width: coreState.project.canvas_width,
          height: coreState.project.canvas_height,
        }}
      >
        <canvas
          ref={drawingCanvasRef}
          width={coreState.project.canvas_width}
          height={coreState.project.canvas_height}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={handleMouseDown}
        />
      </div>
      {activeMaskImg && liveMaskFrame && liveMaskDndPosition && liveMaskSource && (
        <ProjectMaskItem
          key={activeMaskImg.key}
          dndId={`dnd-node-live-mask-${activeMaskImg.key}`}
          dndPosition={liveMaskDndPosition}
          // Only needs to sit above the marquee drawing canvas it's a sibling of here -- placed
          // masks' own stacking (by project order) is handled where they're actually rendered.
          zIndex={1}
          mediaKey={activeMaskImg.key}
          frame={liveMaskFrame}
          source={liveMaskSource}
        />
      )}
    </>
  );
}
