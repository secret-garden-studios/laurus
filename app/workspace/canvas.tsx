import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { indicesInCircleFromCentroids } from "./canvas-media/light-geometry";
import { maskGeometry } from "./canvas-media/mask-geometry";
import { warmImageTexture } from "./mask-gl";
import { useMaskPersist } from "./hooks/useMaskPersist";

function calcMousePosition(canvas: HTMLCanvasElement, event: React.MouseEvent<HTMLElement>) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width === 0 ? 1 : canvas.width / rect.width;
  const scaleY = rect.height === 0 ? 1 : canvas.height / rect.height;
  const p = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
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
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { selectedImgKeys, selectedSvgKeys, selectedMaskKeys, setSelectedImgKeys, setSelectedSvgKeys } =
    useContext(HoverContext);
  const { lightMeshSection, createObject, ...mask } = useContext(MaskContext);
  const { triggerMask } = useMaskPersist();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
  const [minRadius] = useState(10);

  const [pendingMaskDrop, setPendingMaskDrop] = useState<
    { imgData: LaurusImgResult; frame: { width: number; height: number; top: number; left: number } } | undefined
  >(undefined);

  const activeMaskImg = useMemo(() => {
    if (uiState.tool.type !== "mask" || selectedImgKeys.size !== 1 || mask.status === "done") return undefined;
    const key = Array.from(selectedImgKeys)[0];
    const meta = coreState.project.imgs.get(key);
    const imgData = coreState.canvasImgs.get(key);
    if (!meta || !imgData) return undefined;
    return { key, meta, imgData };
  }, [uiState.tool.type, selectedImgKeys, coreState.project.imgs, coreState.canvasImgs, mask.status]);

  const activeBrowserMaskDrop = useMemo(() => {
    if (uiState.tool.type !== "mask" || mask.status === "done" || activeMaskImg) return undefined;
    return pendingMaskDrop;
  }, [uiState.tool.type, mask.status, activeMaskImg, pendingMaskDrop]);

  const liveMaskFrame = useMemo(() => {
    const frame = activeMaskImg?.meta ?? activeBrowserMaskDrop?.frame;
    if (!frame) return undefined;
    return {
      width: mask.size.value && mask.size.width !== undefined ? mask.size.width : frame.width,
      height: mask.size.value && mask.size.height !== undefined ? mask.size.height : frame.height,
      scale_x: activeMaskImg?.meta.scale_x ?? 1,
      scale_y: activeMaskImg?.meta.scale_y ?? 1,
    };
  }, [activeMaskImg, activeBrowserMaskDrop, mask.size]);

  const liveMaskDndPosition = useMemo(() => {
    const frame = activeMaskImg?.meta ?? activeBrowserMaskDrop?.frame;
    if (!frame) return undefined;
    return {
      x: mask.position.value && mask.position.x !== undefined ? mask.position.x : frame.left,
      y: mask.position.value && mask.position.y !== undefined ? mask.position.y : frame.top,
    };
  }, [activeMaskImg, activeBrowserMaskDrop, mask.position]);

  const liveMaskKey = activeMaskImg?.key ?? activeBrowserMaskDrop?.imgData.media_key;

  const liveMaskSource = useMemo<ProjectMaskItemSource | undefined>(() => {
    const imgData = activeMaskImg?.imgData ?? activeBrowserMaskDrop?.imgData;
    if (!imgData) return undefined;
    return { kind: "live", mask, sourceImg: imgData };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMaskImg, activeBrowserMaskDrop]);

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
          if (
            !uiState.tool.lightingMeshSection &&
            !uiState.tool.raisingObjects &&
            uiState.browserElement?.type !== "img"
          )
            break;
          const canvas = drawingCanvasRef.current;
          if (!canvas) return;
          const p = calcMousePosition(canvas, event);
          setAnchor({ x: p.x, y: p.y });
          break;
        }
      }
    },
    [uiState.tool, uiState.browserElement],
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
          if (
            !uiState.tool.lightingMeshSection &&
            !uiState.tool.raisingObjects &&
            uiState.browserElement?.type !== "img"
          )
            break;
          const radius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
    },
    [anchor, uiState.tool, uiState.browserElement],
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
        skew_ax: 0,
        skew_ay: 0,
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
        skew_ax: 0,
        skew_ay: 0,
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

  useEffect(() => {
    if (uiState.browserElement?.type === "img") warmImageTexture(uiState.browserElement.value.src);
    warmImageTexture(activeMaskImg?.imgData.src);
  }, [uiState.browserElement, activeMaskImg]);

  const handleMaskDrop = useCallback(
    (imgData: LaurusImgResult, dropArea: ProjectCircle) => {
      const newFrame = calculateDropFrame(imgData.width, imgData.height, dropArea, uiState.tool);
      if (isBadFrame(newFrame, coreState.project.canvas_width, coreState.project.canvas_height)) {
        return;
      }
      const frame = { width: newFrame.width, height: newFrame.height, top: newFrame.y, left: newFrame.x };
      setPendingMaskDrop({ imgData, frame });
      triggerMask(imgData, { ...frame, scale_x: 1, scale_y: 1 });
    },
    [uiState.tool, coreState.project.canvas_width, coreState.project.canvas_height, triggerMask],
  );

  function screenCircleToMeshSpace(
    maskKey: string,
    drawingCanvas: HTMLCanvasElement,
    dropArea: ProjectCircle,
  ): { cx: number; cy: number; radius: number } | undefined {
    const maskCanvasEl = document.querySelector<HTMLCanvasElement>(`canvas[data-mask-key="${CSS.escape(maskKey)}"]`);
    if (!maskCanvasEl) return undefined;

    const drawingRect = drawingCanvas.getBoundingClientRect();
    const maskRect = maskCanvasEl.getBoundingClientRect();
    if (maskRect.width === 0 || maskRect.height === 0) return undefined;

    if (drawingRect.width === 0) return undefined;
    const zoomed = drawingRect.width / drawingCanvas.width;
    const localX = dropArea.cx * zoomed + drawingRect.left - maskRect.left;
    const localY = dropArea.cy * zoomed + drawingRect.top - maskRect.top;

    const scaleX = maskCanvasEl.width / maskRect.width;
    const scaleY = maskCanvasEl.height / maskRect.height;

    return {
      cx: localX * scaleX,
      cy: localY * scaleY,
      radius: dropArea.radius * zoomed * scaleX,
    };
  }

  const handleLightDrop = useCallback(
    (dropArea: ProjectCircle) => {
      if (selectedMaskKeys.size !== 1) return;
      const maskKey = Array.from(selectedMaskKeys)[0];
      const maskData = coreState.canvasMasks.get(maskKey);
      const drawingCanvas = drawingCanvasRef.current;
      if (!maskData || !drawingCanvas) return;

      const meshCircle = screenCircleToMeshSpace(maskKey, drawingCanvas, dropArea);
      if (!meshCircle) return;

      const polygonIndices = indicesInCircleFromCentroids(maskGeometry(maskData).centroids, meshCircle);
      if (polygonIndices.size === 0) return;
      lightMeshSection(maskKey, Array.from(polygonIndices), meshCircle.radius * 2);
    },
    [selectedMaskKeys, coreState.canvasMasks, lightMeshSection],
  );

  const handleTopologyDrop = useCallback(
    (dropArea: ProjectCircle) => {
      if (selectedMaskKeys.size !== 1) return;
      const maskKey = Array.from(selectedMaskKeys)[0];
      const maskData = coreState.canvasMasks.get(maskKey);
      const drawingCanvas = drawingCanvasRef.current;
      if (!maskData || !drawingCanvas) return;

      const meshCircle = screenCircleToMeshSpace(maskKey, drawingCanvas, dropArea);
      if (!meshCircle) return;

      createObject(maskKey, meshCircle, { ...uiState.stagedObject });
    },
    [selectedMaskKeys, coreState.canvasMasks, createObject, uiState.stagedObject],
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
          const newRadius = caclRadius(anchor.x, anchor.y, canvas, event, ctx.lineWidth);
          if (newRadius < minRadius) break;
          const dropArea: ProjectCircle = { cx: anchor.x, cy: anchor.y, radius: newRadius };

          if (uiState.tool.lightingMeshSection) {
            handleLightDrop(dropArea);
            break;
          }

          if (uiState.tool.raisingObjects && selectedMaskKeys.size === 1) {
            handleTopologyDrop(dropArea);
            break;
          }

          if (uiState.browserElement?.type === "img") {
            const key = uiState.browserElement.value.media_key;
            const imgData = uiState.browserImgs.find((s) => s.media_key === key);
            if (imgData) {
              handleMaskDrop(imgData, dropArea);
            }
          }
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
      handleLightDrop,
      handleTopologyDrop,
      selectedMaskKeys,
      selectedImgKeys,
      selectedSvgKeys,
      setSelectedImgKeys,
      setSelectedSvgKeys,
      handleSvgDrop,
      handleImgDrop,
      handleMaskDrop,
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
      {liveMaskKey && liveMaskFrame && liveMaskDndPosition && liveMaskSource && (
        <ProjectMaskItem
          key={liveMaskKey}
          dndId={`dnd-node-live-mask-${liveMaskKey}`}
          dndPosition={liveMaskDndPosition}
          zIndex={1}
          mediaKey={liveMaskKey}
          frame={liveMaskFrame}
          source={liveMaskSource}
        />
      )}
    </>
  );
}
