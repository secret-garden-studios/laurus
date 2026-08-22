"use client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CoreContext,
  HoverContext,
  LaurusTransform,
  MaskContext,
  SocketContext,
  UIContext,
  getNewContextMenuConfig,
} from "../workspace.client";
import { useToolCursor } from "../hooks/useToolCursor";
import { RefObject, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  buildStaticMaskMesh,
  colorToRGB01,
  drawMaskMesh,
  GLState,
  initGLState,
  loadImageTexture,
  HIGHLIGHT_MOVING_COLOR,
  HIGHLIGHT_SELECTED_COLOR,
  HIGHLIGHT_SIBLING_COLOR,
  MaskLightSource,
  ObjectGeometryInput,
  TEXTURE_MIX_DEFAULT,
  uploadCurveMask,
  uploadStaticMaskMesh,
} from "../mask-gl";
import { CoreActionType, DEFAULT_CAPTURE_VALUE, PendingTopologyEdit } from "../states/core-state";
import { LaurusActiveElement, LaurusSelectedElement, UIActionType } from "../states/ui-state";
import { DEFAULT_CONTEXT_MENU_CONFIG, LaurusProjectMask } from "../../projects/projects.server";
import { UseMaskPreview } from "../hooks/useMaskPreview";
import { Z_INDEX } from "../workspace.config";
import ContextMenu from "../context-menu";
import {
  capturedRegionCircle,
  captureCenterFromCentroids,
  captureIdAtPoint,
  centerOfIndices,
  indicesInCircleFromCentroids,
  indicesInObjectFromCentroids,
  objectIdAtPoint,
  polygonIndexAtPoint,
} from "./light-source-capture";
import { MaskGeometry, maskGeometry, maskPolygonColors } from "./mask-geometry";
import { applyCaptureDelta, applyObjectDelta } from "./mask-delta";
import { cachedObjectShape } from "./object-shape";
import {
  getFrames,
  getImg,
  getLightSourceFrames,
  getMoveFrames,
  getScaleFrames,
  LaurusCapture,
  LaurusEffect,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
  LaurusObject,
  LaurusObjectBlackPoint,
  LaurusPolygonPath,
  toEquationObjectBlackPoint,
  toObjectBlackPoint,
  toObjectBlackPointFields,
} from "../workspace.server";
import { maskCaptureInputId, maskObjectInputId } from "../effects-utils";

export type ProjectMaskItemSource =
  { kind: "static"; maskData: LaurusMaskResult } | { kind: "live"; mask: UseMaskPreview; sourceImg: LaurusImgResult };

const CAPTURE_DRAG_EPSILON_SQ = 1;

function sameIndices(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const i of a) if (!b.has(i)) return false;
  return true;
}

function buildCapturesMap(polygons: LaurusPolygonPath[]): Map<number, Set<number>> {
  const byCapture = new Map<number, Set<number>>();
  polygons.forEach((p, i) => {
    if (p.capture_id === 0) return;
    const indices = byCapture.get(p.capture_id) ?? new Set<number>();
    indices.add(i);
    byCapture.set(p.capture_id, indices);
  });
  return byCapture;
}

function buildCapturesMetaMap(captures: LaurusCapture[]): Map<number, LaurusCapture> {
  return new Map(captures.map((capture) => [capture.id, capture]));
}

function buildObjectsMap(polygons: LaurusPolygonPath[]): Map<number, Set<number>> {
  const byObject = new Map<number, Set<number>>();
  polygons.forEach((p, i) => {
    if (p.object_id === 0) return;
    const indices = byObject.get(p.object_id) ?? new Set<number>();
    indices.add(i);
    byObject.set(p.object_id, indices);
  });
  return byObject;
}

/** What the *mesh* depends on across every object, and nothing else.
 *
 *  The triangulation is subdivided around objects (see subdivideMeshForObjects),
 *  so it changes only when an object's position, reach or profile changes.
 *  Renaming an object, describing it, retagging which polygons it owns, or
 *  editing its black point all leave the triangulation identical -- and those
 *  are the majority of edits, including every accept/reject in a review. */
function objectsMeshSignature(objects: LaurusObject[]): string {
  return objects.map((o) => `${o.id}:${o.cx},${o.cy},${o.radius},${o.elevation},${o.falloff},${o.shape}`).join("|");
}

function toObjectGeometry(object: LaurusObject): ObjectGeometryInput {
  return {
    cx: object.cx,
    cy: object.cy,
    radius: object.radius,
    elevation: object.elevation,
    falloff: object.falloff,
    shape: cachedObjectShape(object.shape),
    blackPoint: toObjectBlackPoint(object),
  };
}

function toBufferPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | undefined {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
}

export interface MaskImperativeHandle {
  play: (effectKey?: string, captureId?: number, objectId?: number) => Promise<void>;
  preparePlayback: (
    effectKey?: string,
    captureId?: number,
    objectId?: number,
  ) => Promise<(() => Promise<void>) | undefined>;
  stop: () => void;
  abortCaptureDragForToolChange: (newToolType: string) => void;
  abortTopologyDragForToolChange: () => void;
  setSelectedHighlighted: (active: boolean) => void;
  setSelectedCapture: (captureId: number | undefined) => void;
  setSelectedObject: (objectId: number | undefined) => void;
  setPendingCapture: (indices: Set<number>, captureId?: number) => void;
  clearPendingCapture: () => void;
  syncCapturedIndices: (updated: LaurusMaskResult) => void;
  setPendingTopology: (edit: PendingTopologyEdit) => void;
  clearPendingTopology: () => void;
  setObjectReviewPreview: (indices: Set<number> | undefined) => void;
  syncObjects: (updated: LaurusMaskResult) => void;
  applyMaskAppearanceDefaults: (override?: MaskAppearanceOverride) => void;
  onLightSourcePreviewToggled: (enabled: boolean) => void;
}

export interface MaskAppearanceOverride {
  textureMix?: number;
  capture?: { size: number; intensity: number; falloff: number; darkness: number };
}

interface ProjectMaskItem {
  dndId: string;
  dndPosition: { x: number; y: number };
  zIndex: number;
  mediaKey: string;
  frame: { width: number; height: number; scale_x: number; scale_y: number };
  source: ProjectMaskItemSource;
  title?: string;
  maskHandlesRef?: RefObject<Map<string, Set<MaskImperativeHandle>> | null>;
  maskElementsRef?: RefObject<Map<string, HTMLCanvasElement> | null>;
  transform?: LaurusTransform;
  framesCacheRef?: RefObject<Map<string, LaurusFrame[]>>;
  meta?: LaurusProjectMask;
  maxZIndex?: number;
}

export function ProjectMaskItem({
  dndId,
  dndPosition,
  zIndex,
  mediaKey,
  frame,
  source,
  title,
  maskHandlesRef,
  maskElementsRef,
  transform,
  framesCacheRef,
  meta,
  maxZIndex,
}: ProjectMaskItem) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch } = useContext(CoreContext);
  const { sendMaskCaptureUpdate, sendMaskObjectUpdate } = useContext(SocketContext);
  const {
    notifyMaskSelectionChanged,
    notifyMaskSelectedCaptureChanged,
    notifyMaskSelectedObjectChanged,
    notifyMaskPendingCaptureSet,
    notifyMaskPendingCaptureCleared,
    notifyMaskCaptureUpdated,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskObjectsUpdated,
    notifyMaskLightSourcePreviewToggled,
  } = useContext(MaskContext);
  const { selectedMaskKeys, setSelectedMaskKeys, isAltKeyPressed, setMostRecentlyHoveredMaskKey } =
    useContext(HoverContext);
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glStateRef = useRef<GLState | undefined>(undefined);
  const maskTextureRef = useRef<WebGLTexture | undefined>(undefined);
  const textureRef = useRef<WebGLTexture | undefined>(undefined);
  const textureMixRef = useRef(TEXTURE_MIX_DEFAULT);
  const captureSizeRef = useRef(DEFAULT_CAPTURE_VALUE.size);
  const captureIntensityRef = useRef(DEFAULT_CAPTURE_VALUE.intensity);
  const captureFalloffRef = useRef(DEFAULT_CAPTURE_VALUE.falloff);
  const captureDarknessRef = useRef(DEFAULT_CAPTURE_VALUE.darkness);
  const glowColorRef = useRef<[number, number, number]>([1, 1, 1]);
  const vertexCountRef = useRef(0);
  const vertexRangesRef = useRef<[number, number][]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const lastCurveCountRef = useRef(0);
  const lightSourceRef = useRef<{ x: number; y: number; radius: number; falloff: number }>({
    x: 0,
    y: 0,
    radius: 0,
    falloff: 0,
  });
  const wiredMoveRef = useRef(false);
  const playbackLightSourcesRef = useRef<Map<number, MaskLightSource>>(new Map());
  const playbackObjectsRef = useRef<
    Map<
      number,
      { cx: number; cy: number; elevation: number; radius: number; falloff: number; blackPoint: LaurusObjectBlackPoint }
    >
  >(new Map());
  const activePlaybackRef = useRef<{ rafId: number | undefined; resolve: () => void } | undefined>(undefined);
  const captureDragRef = useRef<
    | {
        pointerId: number;
        captureId: number;
        startX: number;
        startY: number;
        originalCircle: { cx: number; cy: number; radius: number };
        originalIndices: Set<number>;
        rafId: number | undefined;
        latestX: number;
        latestY: number;
      }
    | undefined
  >(undefined);

  const lastKnownCaptureRef = useRef<
    Map<number, { indices: Set<number>; circle: { cx: number; cy: number; radius: number } }>
  >(new Map());
  const captureCommitInFlightRef = useRef<Set<number>>(new Set());
  const [isDraggingCapture, setIsDraggingCapture] = useState(false);
  const objectDragRef = useRef<
    | {
        pointerId: number;
        objectId: number;
        startX: number;
        startY: number;
        originalCx: number;
        originalCy: number;
        originalRadius: number;
        originalElevation: number;
        originalFalloff: number;
        originalShape: string;
        originalBlackPoint: LaurusObjectBlackPoint;
        rafId: number | undefined;
        latestX: number;
        latestY: number;
      }
    | undefined
  >(undefined);
  const objectCommitInFlightRef = useRef<Set<number>>(new Set());
  const suppressNextClickRef = useRef(false);
  const [isDraggingTopology, setIsDraggingTopology] = useState(false);
  const objectsRef = useRef<LaurusObject[]>([]);
  const pendingTopologyRef = useRef<PendingTopologyEdit | undefined>(undefined);
  const objectReviewPreviewRef = useRef<Set<number> | undefined>(undefined);
  const pendingCaptureRef = useRef<Set<number> | undefined>(undefined);
  const pendingCaptureIdRef = useRef<number | undefined>(undefined);
  const selectedHighlightRef = useRef(false);
  const capturesRef = useRef<Map<number, Set<number>>>(new Map());
  const capturesMetaRef = useRef<Map<number, LaurusCapture>>(new Map());
  const selectedCaptureIdRef = useRef<number | undefined>(undefined);
  const objectsMapRef = useRef<Map<number, Set<number>>>(new Map());
  // The mask's parsed triangles, shared with every other consumer through
  // mask-geometry's cache -- held in a ref only so the per-frame paths below
  // reach it without a stale closure, not as a second copy of it.
  const maskGeometryRef = useRef<MaskGeometry>({ corners: [], points: [], centroids: [] });
  const objectsMeshSignatureRef = useRef<string>("");
  // Two persistent highlight buffers: what recolorHighlight paints into, and
  // what the GPU currently holds, so the two can be diffed into a small upload.
  const highlightScratchRef = useRef<Float32Array>(new Float32Array(0));
  const highlightUploadedRef = useRef<Float32Array>(new Float32Array(0));
  const selectedObjectIdRef = useRef<number | undefined>(undefined);
  const captureIndicesAtOffset = useCallback(
    (drag: NonNullable<typeof captureDragRef.current>, dx: number, dy: number): Set<number> => {
      if (source.kind !== "static") return new Set();
      if (dx * dx + dy * dy <= CAPTURE_DRAG_EPSILON_SQ) return drag.originalIndices;
      return indicesInCircleFromCentroids(maskGeometry(source.maskData).centroids, {
        cx: drag.originalCircle.cx + dx,
        cy: drag.originalCircle.cy + dy,
        radius: drag.originalCircle.radius,
      });
    },
    [source],
  );

  const recomputeCaptureDrag = useCallback(() => {
    const drag = captureDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const indices = captureIndicesAtOffset(drag, drag.latestX - drag.startX, drag.latestY - drag.startY);
    dispatch({
      type: CoreActionType.SetPendingLightSourceCapture,
      value: { maskKey: mediaKey, captureId: drag.captureId, polygonIndices: [...indices] },
    });
    notifyMaskPendingCaptureSet(mediaKey, indices, drag.captureId);
  }, [captureIndicesAtOffset, mediaKey, dispatch, notifyMaskPendingCaptureSet]);

  const abortCaptureDrag = useCallback(() => {
    const drag = captureDragRef.current;
    if (!drag) return;
    if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
    canvasRef.current?.releasePointerCapture(drag.pointerId);
    captureDragRef.current = undefined;
    setIsDraggingCapture(false);
    dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
    notifyMaskPendingCaptureCleared(mediaKey);
  }, [dispatch, mediaKey, notifyMaskPendingCaptureCleared]);

  const resolveObjectUniforms = useCallback((): ObjectGeometryInput[] => {
    const pending = pendingTopologyRef.current;
    const objects = objectsRef.current.map((object): ObjectGeometryInput => {
      const shape = cachedObjectShape(object.shape);
      const playing = playbackObjectsRef.current.get(object.id);
      if (playing) {
        return {
          cx: playing.cx,
          cy: playing.cy,
          radius: playing.radius,
          elevation: playing.elevation,
          falloff: playing.falloff,
          shape,
          blackPoint: playing.blackPoint,
        };
      }
      return pending && pending.objectId === object.id
        ? {
            cx: pending.cx,
            cy: pending.cy,
            radius: pending.radius,
            elevation: pending.elevation,
            falloff: pending.falloff,
            shape,
            blackPoint: pending.blackPoint,
          }
        : toObjectGeometry(object);
    });
    if (pending && !objectsRef.current.some((object) => object.id === pending.objectId)) {
      objects.push({
        cx: pending.cx,
        cy: pending.cy,
        radius: pending.radius,
        elevation: pending.elevation,
        falloff: pending.falloff,
        shape: cachedObjectShape(pending.shape),
        blackPoint: pending.blackPoint,
      });
    }
    return objects;
  }, []);

  const recomputeTopologyDrag = useCallback(() => {
    const drag = objectDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const dx = drag.latestX - drag.startX;
    const dy = drag.latestY - drag.startY;
    const edit: PendingTopologyEdit = {
      maskKey: mediaKey,
      objectId: drag.objectId,
      cx: drag.originalCx + dx,
      cy: drag.originalCy + dy,
      radius: drag.originalRadius,
      elevation: drag.originalElevation,
      falloff: drag.originalFalloff,
      shape: drag.originalShape,
      blackPoint: drag.originalBlackPoint,
    };
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
    notifyMaskPendingTopologySet(mediaKey, edit);
  }, [mediaKey, dispatch, notifyMaskPendingTopologySet]);

  const abortTopologyDrag = useCallback(() => {
    const drag = objectDragRef.current;
    if (!drag) return;
    if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
    canvasRef.current?.releasePointerCapture(drag.pointerId);
    objectDragRef.current = undefined;
    setIsDraggingTopology(false);
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
    notifyMaskPendingTopologyCleared(mediaKey);
  }, [dispatch, mediaKey, notifyMaskPendingTopologyCleared]);

  const isSelected = source.kind === "static" && selectedMaskKeys.has(mediaKey);
  const canvasSize =
    source.kind === "static"
      ? { width: source.maskData.width, height: source.maskData.height }
      : { width: source.sourceImg.width, height: source.sourceImg.height };

  const resolveTargetCaptureId = useCallback((): number | undefined => {
    if (selectedCaptureIdRef.current !== undefined) return selectedCaptureIdRef.current;
    return capturesRef.current.keys().next().value;
  }, []);

  const computeLightSourceRestPosition = useCallback(
    (captureIdOverride?: number) => {
      if (source.kind !== "static") return undefined;
      const targetCaptureId = captureIdOverride ?? resolveTargetCaptureId();
      const indices =
        pendingCaptureRef.current ??
        (targetCaptureId !== undefined ? capturesRef.current.get(targetCaptureId) : undefined) ??
        capturesRef.current.values().next().value;
      if (!indices) return undefined;
      return centerOfIndices(maskGeometry(source.maskData).points, indices);
    },
    [source, resolveTargetCaptureId],
  );

  const resolveRestingLightSources = useCallback((): MaskLightSource[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const centroids = maskGeometryRef.current.centroids;
    const lights: MaskLightSource[] = [];
    capturesRef.current.forEach((indices, captureId) => {
      if (playbackLightSourcesRef.current.has(captureId)) return;
      const meta = capturesMetaRef.current.get(captureId);
      if (!meta) return;
      const pending = pendingCaptureIdRef.current === captureId ? pendingCaptureRef.current : undefined;
      const center = captureCenterFromCentroids(centroids, pending ?? indices);
      if (!center) return;
      lights.push({
        x: center[0],
        y: canvas.height - center[1],
        radius: meta.size / 2,
        falloff: meta.falloff,
        intensity: meta.intensity,
        darkness: meta.darkness,
      });
    });
    return lights;
  }, []);

  const dragDisabled = useMemo(() => {
    return source.kind === "live" || uiState.tool.type != "move";
  }, [source.kind, uiState.tool.type]);
  const {
    listeners,
    setNodeRef,
    transform: dndTransform,
    isDragging,
  } = useDraggable({
    id: dndId,
    disabled: dragDisabled ?? false,
  });
  const containerSize = useMemo(() => {
    return {
      width: frame.width * frame.scale_x,
      height: frame.height * frame.scale_y,
    };
  }, [frame.height, frame.scale_x, frame.scale_y, frame.width]);
  const dndCss = {
    left: dndPosition.x,
    top: dndPosition.y,
    transform: CSS.Translate.toString(dndTransform),
    touchAction: "none",
  };

  const toolCursor = useToolCursor({
    target: source.kind === "static" ? "mask" : undefined,
    dragDisabled,
    isDragging: isDragging || isDraggingCapture || isDraggingTopology,
  });
  // Object review is a modal-ish overlay independent of whatever tool is
  // otherwise active, so its crosshair takes over regardless of tool state.
  const isReviewingThisMask = source.kind === "static" && uiState.objectReview?.maskKey === mediaKey;
  const cursor = isReviewingThisMask ? "crosshair" : toolCursor;

  const render = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;

    const lightSources: MaskLightSource[] = [
      ...(wiredMoveRef.current
        ? Array.from(playbackLightSourcesRef.current.values())
        : [
            {
              ...lightSourceRef.current,
              intensity: captureIntensityRef.current,
              darkness: captureDarknessRef.current,
            },
          ]),
      ...resolveRestingLightSources(),
    ];

    drawMaskMesh(state, {
      vertexCount: vertexCountRef.current,
      lightSources,
      objects: resolveObjectUniforms(),
      texture: textureRef.current,
      textureMix: textureMixRef.current,
      maskTexture: maskTextureRef.current,
      glowColor: glowColorRef.current,
    });
  }, [resolveObjectUniforms, resolveRestingLightSources]);

  const recolorHighlight = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;
    const vertexCount = vertexCountRef.current;
    if (vertexCount === 0) return;
    const latestSource = latestRef.current.source;
    if (latestSource.kind !== "static") return;
    const { gl } = state;

    // Painted into a persistent scratch buffer and diffed against what the GPU
    // already holds, so a highlight change uploads only the vertices that
    // actually changed. A review clean-up click toggles one triangle; without
    // this it allocated and re-uploaded the entire highlight attribute (four
    // floats per vertex, for every vertex in the mask) to do it.
    const length = vertexCount * 4;
    const resized = highlightScratchRef.current.length !== length;
    if (resized) {
      highlightScratchRef.current = new Float32Array(length);
      highlightUploadedRef.current = new Float32Array(length);
    }
    const highlights = highlightScratchRef.current;
    highlights.fill(0);
    const vertexRanges = vertexRangesRef.current;
    const paint = (indices: Set<number>, color: readonly [number, number, number, number]) => {
      indices.forEach((polygonIndex) => {
        const range = vertexRanges[polygonIndex];
        if (!range) return;
        const [startVertex, count] = range;
        for (let v = 0; v < count; v++) {
          const vertex = startVertex + v;
          if (vertex >= vertexCount) continue;
          highlights.set(color, vertex * 4);
        }
      });
    };

    const pendingCapture = pendingCaptureRef.current;
    const editingCaptureId = pendingCapture ? (pendingCaptureIdRef.current ?? selectedCaptureIdRef.current) : undefined;
    if (selectedHighlightRef.current) {
      const activeCaptureId = selectedCaptureIdRef.current;
      capturesRef.current.forEach((indices, captureId) => {
        if (captureId === editingCaptureId) return;
        paint(indices, captureId === activeCaptureId ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
      });
    }
    if (pendingCapture && pendingCapture.size > 0) {
      paint(pendingCapture, HIGHLIGHT_MOVING_COLOR);
    }

    const pendingTopology = pendingTopologyRef.current;
    if (selectedHighlightRef.current) {
      const activeObjectId = selectedObjectIdRef.current;
      objectsMapRef.current.forEach((indices, objectId) => {
        if (objectId === pendingTopology?.objectId) return;
        paint(indices, objectId === activeObjectId ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
      });
    }
    if (pendingTopology) {
      paint(indicesInObjectFromCentroids(maskGeometryRef.current.centroids, pendingTopology), HIGHLIGHT_MOVING_COLOR);
    }

    const objectReviewPreview = objectReviewPreviewRef.current;
    if (objectReviewPreview && objectReviewPreview.size > 0) {
      paint(objectReviewPreview, HIGHLIGHT_SELECTED_COLOR);
    }

    const uploaded = highlightUploadedRef.current;
    gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
    if (resized) {
      // The attribute itself changed size (the mesh was rebuilt), so the
      // buffer has to be reallocated rather than patched.
      gl.bufferData(gl.ARRAY_BUFFER, highlights, gl.STATIC_DRAW);
      uploaded.set(highlights);
    } else {
      let first = -1;
      let last = -1;
      for (let i = 0; i < length; i++) {
        if (highlights[i] === uploaded[i]) continue;
        if (first < 0) first = i;
        last = i;
      }
      // Nothing about the highlight changed -- not even a redraw is owed.
      if (first < 0) return;
      // Widen to whole vertices so the upload lines up with the attribute.
      const start = first - (first % 4);
      const end = last + (4 - (last % 4));
      uploaded.set(highlights.subarray(start, end), start);
      gl.bufferSubData(gl.ARRAY_BUFFER, start * Float32Array.BYTES_PER_ELEMENT, highlights.subarray(start, end));
    }
    render();
  }, [render]);

  const applyDefaultCaptureValue = useCallback(() => {
    if (source.kind !== "static") return;
    const maskMeta = coreState.project.masks.get(mediaKey);
    captureSizeRef.current = maskMeta?.capture_preview_size ?? DEFAULT_CAPTURE_VALUE.size;
    captureIntensityRef.current = maskMeta?.capture_preview_intensity ?? DEFAULT_CAPTURE_VALUE.intensity;
    captureFalloffRef.current = maskMeta?.capture_preview_falloff ?? DEFAULT_CAPTURE_VALUE.falloff;
    captureDarknessRef.current = maskMeta?.capture_preview_darkness ?? DEFAULT_CAPTURE_VALUE.darkness;
  }, [source, coreState.project.masks, mediaKey]);

  const stopLightSourceAnimation = useCallback(() => {
    const session = activePlaybackRef.current;
    if (session) {
      if (session.rafId !== undefined) cancelAnimationFrame(session.rafId);
      activePlaybackRef.current = undefined;
      session.resolve();
    }
    wiredMoveRef.current = false;
    playbackLightSourcesRef.current = new Map();
    playbackObjectsRef.current = new Map();
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    applyDefaultCaptureValue();
    render();
  }, [render, applyDefaultCaptureValue]);

  const preparePlayback = useCallback(
    (effectKey?: string, captureId?: number, objectId?: number): Promise<(() => Promise<void>) | undefined> => {
      stopLightSourceAnimation();
      if (source.kind !== "static") return Promise.resolve(undefined);
      const playAll = effectKey === undefined && captureId === undefined && objectId === undefined;
      const candidateCaptureIds = playAll
        ? Array.from(capturesRef.current.keys())
        : objectId !== undefined
          ? []
          : [captureId ?? resolveTargetCaptureId()].filter((id): id is number => id !== undefined);

      const targets = candidateCaptureIds
        .map((id) => {
          const inputId = maskCaptureInputId(mediaKey, id);
          const wiredMove = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "move" }> =>
              effect.type === "move" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          const wiredLightSource = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "light_source" }> =>
              effect.type === "light_source" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );

          const wiredScale = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "scale" }> =>
              effect.type === "scale" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          return { captureId: id, inputId, wiredMove, wiredLightSource, wiredScale };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale)
        .map((t) => ({ ...t, restPosition: computeLightSourceRestPosition(t.captureId) }));

      const candidateObjectIds = playAll
        ? objectsRef.current.map((object) => object.id)
        : objectId !== undefined
          ? [objectId]
          : [];
      const objectTargets = candidateObjectIds
        .map((id) => {
          const inputId = maskObjectInputId(mediaKey, id);
          const wiredMove = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "move" }> =>
              effect.type === "move" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          const wiredLightSource = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "light_source" }> =>
              effect.type === "light_source" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          const wiredScale = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "scale" }> =>
              effect.type === "scale" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          return { objectId: id, inputId, wiredMove, wiredLightSource, wiredScale };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale);

      if (targets.length === 0 && objectTargets.length === 0) return Promise.resolve(undefined);

      wiredMoveRef.current = targets.length > 0;

      const mergedFramesByCapture = new Map<number, LaurusFrame[]>();
      const moveFramesByCapture = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByCapture = new Map<number, LaurusFrame[]>();
      const scaleFramesByCapture = new Map<number, LaurusFrame[]>();
      const mergedFramesByObject = new Map<number, LaurusFrame[]>();
      const moveFramesByObject = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByObject = new Map<number, LaurusFrame[]>();
      const scaleFramesByObject = new Map<number, LaurusFrame[]>();
      const session: { rafId: number | undefined; resolve: () => void } = { rafId: undefined, resolve: () => {} };
      activePlaybackRef.current = session;

      const projectFps = coreState.project.fps > 0 ? coreState.project.fps : 30;
      let fps: number;
      let totalFrames: number;
      let durationSeconds: number;
      let ready: Promise<void>;

      const fetchFramesCached = (
        inputId: string,
        cacheKey: string,
        fetcher: () => Promise<LaurusFrame[] | undefined>,
      ): Promise<LaurusFrame[] | undefined> => {
        const stale = coreState.inputsToRender.has("*") || coreState.inputsToRender.has(inputId);
        const cached = !stale ? framesCacheRef?.current?.get(cacheKey) : undefined;
        if (cached) return Promise.resolve(cached);
        return fetcher().then((result) => {
          if (result && framesCacheRef?.current) framesCacheRef.current.set(cacheKey, [...result]);
          return result;
        });
      };

      if (playAll) {
        fps = projectFps;
        totalFrames = 1;
        durationSeconds = 0;
        ready = Promise.all([
          ...targets.map((t) =>
            fetchFramesCached(t.inputId, t.inputId, () =>
              getFrames(coreState.apiOrigin, coreState.project.project_id, t.inputId, fps),
            ).then((result) => {
              if (activePlaybackRef.current !== session) return;
              mergedFramesByCapture.set(t.captureId, result ?? []);
            }),
          ),
          ...objectTargets.map((t) =>
            fetchFramesCached(t.inputId, t.inputId, () =>
              getFrames(coreState.apiOrigin, coreState.project.project_id, t.inputId, fps),
            ).then((result) => {
              if (activePlaybackRef.current !== session) return;
              mergedFramesByObject.set(t.objectId, result ?? []);
            }),
          ),
        ]).then(() => {
          if (activePlaybackRef.current !== session) return;
          totalFrames = Math.max(
            1,
            ...Array.from(mergedFramesByCapture.values()).map((f) => f.length),
            ...Array.from(mergedFramesByObject.values()).map((f) => f.length),
          );
          durationSeconds = totalFrames / fps;
        });
      } else if (targets.length === 0) {
        const objectTarget = objectTargets[0];
        const timingValue = (objectTarget.wiredMove ?? objectTarget.wiredLightSource ?? objectTarget.wiredScale)!.value;
        fps = timingValue.fps > 0 ? timingValue.fps : projectFps;
        totalFrames = Math.max(Math.round((timingValue.end - timingValue.start) * fps), 1);
        durationSeconds = totalFrames / fps;
        const objectFetches: Promise<void>[] = [];
        if (objectTarget.wiredMove) {
          const wiredMove = objectTarget.wiredMove;
          objectFetches.push(
            fetchFramesCached(objectTarget.inputId, `move:${objectTarget.inputId}`, () =>
              getMoveFrames(coreState.apiOrigin, wiredMove.key, objectTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                moveFramesByObject.set(objectTarget.objectId, result);
            }),
          );
        }
        if (objectTarget.wiredLightSource) {
          const wiredLightSource = objectTarget.wiredLightSource;
          objectFetches.push(
            fetchFramesCached(objectTarget.inputId, `light_source:${objectTarget.inputId}`, () =>
              getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, objectTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                lightSourceFramesByObject.set(objectTarget.objectId, result);
            }),
          );
        }
        if (objectTarget.wiredScale) {
          const wiredScale = objectTarget.wiredScale;
          objectFetches.push(
            fetchFramesCached(objectTarget.inputId, `scale:${objectTarget.inputId}`, () =>
              getScaleFrames(coreState.apiOrigin, wiredScale.key, objectTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                scaleFramesByObject.set(objectTarget.objectId, result);
            }),
          );
        }
        ready = Promise.all(objectFetches).then(() => {});
      } else {
        const target = targets[0];
        const timingValue = (target.wiredMove ?? target.wiredLightSource ?? target.wiredScale)!.value;
        fps = timingValue.fps > 0 ? timingValue.fps : projectFps;
        totalFrames = Math.max(Math.round((timingValue.end - timingValue.start) * fps), 1);
        durationSeconds = totalFrames / fps;
        const fetches: Promise<void>[] = [];
        if (target.wiredMove) {
          const wiredMove = target.wiredMove;
          fetches.push(
            fetchFramesCached(target.inputId, `move:${target.inputId}`, () =>
              getMoveFrames(coreState.apiOrigin, wiredMove.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) moveFramesByCapture.set(target.captureId, result);
            }),
          );
        }
        if (target.wiredLightSource) {
          const wiredLightSource = target.wiredLightSource;
          fetches.push(
            fetchFramesCached(target.inputId, `light_source:${target.inputId}`, () =>
              getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                lightSourceFramesByCapture.set(target.captureId, result);
            }),
          );
        }
        if (target.wiredScale) {
          const wiredScale = target.wiredScale;
          fetches.push(
            fetchFramesCached(target.inputId, `scale:${target.inputId}`, () =>
              getScaleFrames(coreState.apiOrigin, wiredScale.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) scaleFramesByCapture.set(target.captureId, result);
            }),
          );
        }
        ready = Promise.all(fetches).then(() => {});
      }

      return ready.then((): (() => Promise<void>) | undefined => {
        if (activePlaybackRef.current !== session) return undefined;

        return () =>
          new Promise<void>((resolve) => {
            session.resolve = resolve;
            const loopStartMs = performance.now();

            const loop = () => {
              if (activePlaybackRef.current !== session) return;

              const elapsedSeconds = (performance.now() - loopStartMs) / 1000;
              const frameIndex = Math.min(Math.floor(elapsedSeconds * fps), totalFrames - 1);

              const canvas = canvasRef.current;
              const rect = canvas?.getBoundingClientRect();
              if (canvas && rect && rect.width > 0 && rect.height > 0) {
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                targets.forEach((t) => {
                  const mergedFrames = mergedFramesByCapture.get(t.captureId);
                  const moveFrames = moveFramesByCapture.get(t.captureId);
                  const lightSourceFrames = lightSourceFramesByCapture.get(t.captureId);
                  const scaleFrames = scaleFramesByCapture.get(t.captureId);

                  const movePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : moveFrames && moveFrames.length > 0
                      ? moveFrames[Math.min(frameIndex, moveFrames.length - 1)]
                      : undefined;
                  const capturePoint = playAll
                    ? t.wiredLightSource
                      ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                      : undefined
                    : lightSourceFrames && lightSourceFrames.length > 0
                      ? lightSourceFrames[Math.min(frameIndex, lightSourceFrames.length - 1)]
                      : undefined;
                  const scalePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : scaleFrames && scaleFrames.length > 0
                      ? scaleFrames[Math.min(frameIndex, scaleFrames.length - 1)]
                      : undefined;
                  const restX = t.restPosition?.x ?? canvas.width / 2;
                  const restY = t.restPosition?.y ?? canvas.height / 2;
                  const pointX = movePoint?.x ?? 0;
                  const pointY = movePoint?.y ?? 0;
                  const bufferX = restX + pointX * scaleX;
                  const bufferY = restY + pointY * scaleY;
                  const captureMeta = source.maskData.captures.find((c) => c.id === t.captureId);
                  const size = capturePoint?.capture_size ?? captureMeta?.size ?? captureSizeRef.current;
                  const intensity =
                    capturePoint?.capture_intensity ?? captureMeta?.intensity ?? captureIntensityRef.current;
                  const falloff = capturePoint?.capture_falloff ?? captureMeta?.falloff ?? captureFalloffRef.current;
                  const darkness =
                    capturePoint?.capture_darkness ?? captureMeta?.darkness ?? captureDarknessRef.current;
                  const scaleMultiplier = scalePoint?.sx ?? 1;

                  playbackLightSourcesRef.current.set(t.captureId, {
                    x: bufferX,
                    y: canvas.height - bufferY,
                    radius: (size / 2) * scaleMultiplier,
                    falloff,
                    intensity,
                    darkness,
                  });
                });

                objectTargets.forEach((t) => {
                  const object = objectsRef.current.find((p) => p.id === t.objectId);
                  if (!object) return;
                  const mergedFrames = mergedFramesByObject.get(t.objectId);
                  const moveFrames = moveFramesByObject.get(t.objectId);
                  const lightSourceFrames = lightSourceFramesByObject.get(t.objectId);
                  const scaleFrames = scaleFramesByObject.get(t.objectId);

                  const movePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : moveFrames && moveFrames.length > 0
                      ? moveFrames[Math.min(frameIndex, moveFrames.length - 1)]
                      : undefined;
                  const lightSourcePoint = playAll
                    ? t.wiredLightSource
                      ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                      : undefined
                    : lightSourceFrames && lightSourceFrames.length > 0
                      ? lightSourceFrames[Math.min(frameIndex, lightSourceFrames.length - 1)]
                      : undefined;
                  const scalePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : scaleFrames && scaleFrames.length > 0
                      ? scaleFrames[Math.min(frameIndex, scaleFrames.length - 1)]
                      : undefined;
                  const cx = object.cx + (movePoint?.x ?? 0) * scaleX;
                  const cy = object.cy + (movePoint?.y ?? 0) * scaleY;
                  const elevation = lightSourcePoint?.object_elevation ?? object.elevation;
                  const radius = lightSourcePoint?.object_radius ?? object.radius;
                  const falloff = lightSourcePoint?.object_falloff ?? object.falloff;
                  const blackPoint = lightSourcePoint
                    ? toEquationObjectBlackPoint(lightSourcePoint)
                    : toObjectBlackPoint(object);
                  const scaleMultiplier = scalePoint?.sx ?? 1;

                  playbackObjectsRef.current.set(t.objectId, {
                    cx,
                    cy,
                    elevation,
                    radius: radius * scaleMultiplier,
                    falloff,
                    blackPoint,
                  });
                });
                render();
              }

              if (elapsedSeconds < durationSeconds) {
                session.rafId = requestAnimationFrame(loop);
              } else {
                stopLightSourceAnimation();
              }
            };
            session.rafId = requestAnimationFrame(loop);
          });
      });
    },
    [
      source,
      mediaKey,
      resolveTargetCaptureId,
      computeLightSourceRestPosition,
      coreState.effects,
      coreState.apiOrigin,
      coreState.project.fps,
      coreState.project.project_id,
      coreState.inputsToRender,
      framesCacheRef,
      render,
      stopLightSourceAnimation,
    ],
  );

  const playLightSourceAnimation = useCallback(
    (effectKey?: string, captureId?: number, objectId?: number): Promise<void> =>
      preparePlayback(effectKey, captureId, objectId).then((start) => start?.()),
    [preparePlayback],
  );

  const latestRef = useRef({
    source,
    coreState,
    uiState,
    applyDefaultCaptureValue,
    playLightSourceAnimation,
    preparePlayback,
    stopLightSourceAnimation,
  });
  latestRef.current = {
    source,
    coreState,
    uiState,
    applyDefaultCaptureValue,
    playLightSourceAnimation,
    preparePlayback,
    stopLightSourceAnimation,
  };

  const meshIdentityKey = source.kind === "static" ? source.maskData.mask_media_id : source;
  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (!canvas) return;

      if (source.kind === "static") {
        const maskData = source.maskData;
        const state = initGLState(canvas);
        if (!state) return;
        glStateRef.current = state;
        const { gl } = state;
        const cleanupFns: (() => void)[] = [];

        const colorCanvas = document.createElement("canvas");
        colorCanvas.width = 1;
        colorCanvas.height = 1;
        const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
        const initialGeometry = maskGeometry(maskData);
        const mesh = colorCtx
          ? buildStaticMaskMesh(
              { ...maskData, objects: maskData.objects.map(toObjectGeometry) },
              colorCtx,
              { corners: initialGeometry.corners, polygonPointSets: initialGeometry.points },
              maskPolygonColors(maskData.polygons, colorCtx),
            )
          : { positions: [], colors: [], barycentrics: [], uvs: [], centroids: [], vertexCount: 0, vertexRanges: [] };
        objectsMeshSignatureRef.current = objectsMeshSignature(maskData.objects);
        vertexCountRef.current = mesh.vertexCount;
        vertexRangesRef.current = mesh.vertexRanges;
        uploadStaticMaskMesh(state, mesh);
        gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertexCount * 4), gl.STATIC_DRAW);
        // That just zeroed the highlight on the GPU behind recolorHighlight's
        // back. It keeps a mirror of what it last uploaded so it can patch
        // only what changed, and a stale mirror would make it conclude there
        // was nothing to re-upload and leave the highlight blank -- so the
        // mirror is dropped here, forcing the next paint to upload in full.
        highlightScratchRef.current = new Float32Array(0);
        highlightUploadedRef.current = new Float32Array(0);

        if (maskData.curves.length > 0 && colorCtx) {
          const glowSource = maskData.curves.find((c) => c.glow_color)?.glow_color;
          if (glowSource) glowColorRef.current = colorToRGB01(colorCtx, glowSource);
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = maskData.width;
          maskCanvas.height = maskData.height;
          maskTextureRef.current = uploadCurveMask(gl, maskCanvas, maskData.curves, undefined);
        }

        let sourceImgSrc: string | undefined;
        for (const [key, img] of coreState.project.imgs) {
          if (img.img_media_id === maskData.source_img_media_id) {
            sourceImgSrc = coreState.canvasImgs.get(key)?.src;
            break;
          }
        }

        if (!sourceImgSrc) {
          sourceImgSrc = uiState.browserImgs.find((img) => img.img_media_id === maskData.source_img_media_id)?.src;
        }
        if (sourceImgSrc) {
          loadImageTexture(
            gl,
            sourceImgSrc,
            (texture) => {
              textureRef.current = texture;
              render();
            },
            (error) => console.log("failed to load/upload source image for mask texture blend", { error }),
          );
        } else {
          let cancelled = false;
          cleanupFns.push(() => {
            cancelled = true;
          });
          getImg(coreState.apiOrigin, maskData.source_img_media_id).then((img) => {
            if (cancelled || !img) return;
            loadImageTexture(
              gl,
              img.src,
              (texture) => {
                textureRef.current = texture;
                render();
              },
              (error) => console.log("failed to load/upload source image for mask texture blend", { error }),
            );
          });
        }

        lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
        const pendingCapture =
          coreState.pendingLightSourceCapture?.maskKey === mediaKey ? coreState.pendingLightSourceCapture : undefined;
        pendingCaptureRef.current = pendingCapture ? new Set(pendingCapture.polygonIndices) : undefined;
        pendingCaptureIdRef.current = pendingCapture?.captureId;
        selectedHighlightRef.current = uiState.selectedElement?.key === mediaKey;
        selectedCaptureIdRef.current =
          selectedHighlightRef.current && uiState.selectedElement?.type === "capture"
            ? uiState.selectedElement.captureId
            : undefined;
        selectedObjectIdRef.current =
          selectedHighlightRef.current && uiState.selectedElement?.type === "object"
            ? uiState.selectedElement.objectId
            : undefined;
        capturesRef.current = buildCapturesMap(maskData.polygons);
        capturesMetaRef.current = buildCapturesMetaMap(maskData.captures);
        objectsRef.current = maskData.objects;
        objectsMapRef.current = buildObjectsMap(maskData.polygons);
        maskGeometryRef.current = maskGeometry(maskData);
        pendingTopologyRef.current =
          coreState.pendingTopologyEdit?.maskKey === mediaKey ? coreState.pendingTopologyEdit : undefined;
        // Seeded once here, alongside every other highlight input, because a
        // review can already be under way when this mask mounts (it is started
        // by the very generation that created it). Every later change arrives
        // through setObjectReviewPreview on the handle above.
        objectReviewPreviewRef.current =
          uiState.objectReview?.maskKey === mediaKey ? uiState.objectReview.currentIndices : undefined;

        const applyMaskAppearanceDefaults = (override?: MaskAppearanceOverride) => {
          const latest = latestRef.current;
          if (latest.source.kind !== "static") return;
          textureMixRef.current =
            override?.textureMix ?? latest.coreState.project.masks.get(mediaKey)?.texture ?? TEXTURE_MIX_DEFAULT;
          if (override?.capture) {
            captureSizeRef.current = override.capture.size;
            captureIntensityRef.current = override.capture.intensity;
            captureFalloffRef.current = override.capture.falloff;
            captureDarknessRef.current = override.capture.darkness;
          } else {
            latest.applyDefaultCaptureValue();
          }
          render();
        };
        applyMaskAppearanceDefaults();
        render();
        recolorHighlight();

        const handle: MaskImperativeHandle = {
          play: (effectKey, captureId, objectId) =>
            latestRef.current.playLightSourceAnimation(effectKey, captureId, objectId),
          preparePlayback: (effectKey, captureId, objectId) =>
            latestRef.current.preparePlayback(effectKey, captureId, objectId),
          stop: () => latestRef.current.stopLightSourceAnimation(),
          abortCaptureDragForToolChange: (newToolType) => {
            if (newToolType === "move") return;
            if (captureDragRef.current) abortCaptureDrag();
          },
          abortTopologyDragForToolChange: () => {
            if (!objectDragRef.current) return;
            const tool = latestRef.current.uiState.tool;
            if (tool.type === "mask" && tool.editingTopology) return;
            abortTopologyDrag();
          },
          setSelectedHighlighted: (active) => {
            selectedHighlightRef.current = active;
            if (!active) {
              selectedCaptureIdRef.current = undefined;
              selectedObjectIdRef.current = undefined;
            }
            recolorHighlight();
          },
          setSelectedCapture: (captureId) => {
            selectedCaptureIdRef.current = captureId;
            recolorHighlight();
          },
          setSelectedObject: (objectId) => {
            selectedObjectIdRef.current = objectId;
            recolorHighlight();
          },
          setPendingCapture: (indices, captureId) => {
            pendingCaptureIdRef.current = captureId;
            pendingCaptureRef.current = indices;
            recolorHighlight();
          },
          clearPendingCapture: () => {
            pendingCaptureIdRef.current = undefined;
            pendingCaptureRef.current = undefined;
            recolorHighlight();
          },
          syncCapturedIndices: (updated) => {
            const latestSource = latestRef.current.source;
            if (latestSource.kind !== "static") return;
            if (latestSource.maskData.mask_media_id !== updated.mask_media_id) return;
            capturesRef.current = buildCapturesMap(updated.polygons);
            capturesMetaRef.current = buildCapturesMetaMap(updated.captures);
            maskGeometryRef.current = maskGeometry(updated);
            recolorHighlight();
          },
          setPendingTopology: (edit) => {
            pendingTopologyRef.current = edit;
            recolorHighlight();
          },
          clearPendingTopology: () => {
            pendingTopologyRef.current = undefined;
            recolorHighlight();
          },
          setObjectReviewPreview: (indices) => {
            objectReviewPreviewRef.current = indices;
            recolorHighlight();
          },
          syncObjects: (updated) => {
            const latestSource = latestRef.current.source;
            if (latestSource.kind !== "static") return;
            if (latestSource.maskData.mask_media_id !== updated.mask_media_id) return;
            objectsRef.current = updated.objects;
            objectsMapRef.current = buildObjectsMap(updated.polygons);
            const geometry = maskGeometry(updated);
            maskGeometryRef.current = geometry;
            // Only a change to the objects' own geometry can move a vertex.
            // Everything else -- an accept/reject retagging polygons, a rename,
            // a black point -- leaves the triangulation byte-identical, so the
            // mesh is left alone and only the highlight is repainted.
            const signature = objectsMeshSignature(updated.objects);
            const glState = glStateRef.current;
            if (glState && colorCtx && signature !== objectsMeshSignatureRef.current) {
              objectsMeshSignatureRef.current = signature;
              const mesh = buildStaticMaskMesh(
                { ...updated, objects: updated.objects.map(toObjectGeometry) },
                colorCtx,
                { corners: geometry.corners, polygonPointSets: geometry.points },
                maskPolygonColors(updated.polygons, colorCtx),
              );
              vertexCountRef.current = mesh.vertexCount;
              vertexRangesRef.current = mesh.vertexRanges;
              uploadStaticMaskMesh(glState, mesh);
            }
            recolorHighlight();
          },
          applyMaskAppearanceDefaults,
          onLightSourcePreviewToggled: (enabled) => {
            if (enabled || wiredMoveRef.current) return;
            lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
            render();
          },
        };

        if (maskHandlesRef) {
          if (!maskHandlesRef.current) maskHandlesRef.current = new Map();
          const handles = maskHandlesRef.current;
          const forThisKey = handles.get(mediaKey) ?? new Set<MaskImperativeHandle>();
          forThisKey.add(handle);
          handles.set(mediaKey, forThisKey);
        }

        if (maskElementsRef) {
          if (!maskElementsRef.current) maskElementsRef.current = new Map();
          maskElementsRef.current.set(mediaKey, canvas);
        }

        return () => {
          cleanupFns.forEach((fn) => fn());
          gl.deleteProgram(state.program);
          gl.deleteBuffer(state.positionBuffer);
          gl.deleteBuffer(state.colorBuffer);
          gl.deleteBuffer(state.barycentricBuffer);
          gl.deleteBuffer(state.uvBuffer);
          gl.deleteBuffer(state.centroidBuffer);
          gl.deleteBuffer(state.highlightBuffer);
          if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
          if (textureRef.current) gl.deleteTexture(textureRef.current);
          glStateRef.current = undefined;
          maskTextureRef.current = undefined;
          textureRef.current = undefined;
          const handles = maskHandlesRef?.current;
          if (handles) {
            const forThisKey = handles.get(mediaKey);
            forThisKey?.delete(handle);
            if (forThisKey && forThisKey.size === 0) handles.delete(mediaKey);
          }
          if (maskElementsRef?.current?.get(mediaKey) === canvas) {
            maskElementsRef.current.delete(mediaKey);
          }
          latestRef.current.stopLightSourceAnimation();
        };
      }

      const { mask, sourceImg } = source;
      const state = initGLState(canvas);
      if (!state) return;
      glStateRef.current = state;
      const { gl } = state;

      let maskCanvas: HTMLCanvasElement | undefined;
      loadImageTexture(
        gl,
        sourceImg.src,
        (texture) => {
          textureRef.current = texture;
        },
        (error) => console.log("failed to load/upload mask preview source image", { src: sourceImg.src, error }),
      );

      const loop = () => {
        const {
          positionsRef,
          colorsRef,
          barycentricsRef,
          uvsRef,
          centroidsRef,
          dirtyRef,
          curvesRef,
          glowColorRef: liveGlowColorRef,
        } = mask.meshRefs;

        if (dirtyRef.current) {
          gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionsRef.current), gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorsRef.current), gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barycentricsRef.current), gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvsRef.current), gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(centroidsRef.current), gl.DYNAMIC_DRAW);
          vertexCountRef.current = positionsRef.current.length / 2;
          gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexCountRef.current * 4), gl.DYNAMIC_DRAW);
          dirtyRef.current = false;
        }

        if (curvesRef.current.length !== lastCurveCountRef.current) {
          lastCurveCountRef.current = curvesRef.current.length;
          if (!maskCanvas) {
            maskCanvas = document.createElement("canvas");
            maskCanvas.width = sourceImg.width;
            maskCanvas.height = sourceImg.height;
          }
          maskTextureRef.current = uploadCurveMask(gl, maskCanvas, curvesRef.current, maskTextureRef.current);
        }
        glowColorRef.current = liveGlowColorRef.current;
        textureMixRef.current = mask.textureMixRef.current;
        captureSizeRef.current = mask.captureSizeRef.current;
        captureIntensityRef.current = mask.captureIntensityRef.current;
        captureFalloffRef.current = mask.captureFalloffRef.current;
        captureDarknessRef.current = mask.captureDarknessRef.current;

        render();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      return () => {
        if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
        gl.deleteProgram(state.program);
        gl.deleteBuffer(state.positionBuffer);
        gl.deleteBuffer(state.colorBuffer);
        gl.deleteBuffer(state.barycentricBuffer);
        gl.deleteBuffer(state.uvBuffer);
        gl.deleteBuffer(state.centroidBuffer);
        gl.deleteBuffer(state.highlightBuffer);
        if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
        if (textureRef.current) gl.deleteTexture(textureRef.current);
        glStateRef.current = undefined;
        maskTextureRef.current = undefined;
        textureRef.current = undefined;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      meshIdentityKey,
      render,
      recolorHighlight,
      abortCaptureDrag,
      abortTopologyDrag,
      maskHandlesRef,
      maskElementsRef,
      mediaKey,
    ],
  );

  const showContextMenu =
    source.kind === "static" && (uiState.projectContextMenus.get(mediaKey)?.showContextMenu ?? false);
  const maskMeta = source.kind === "static" ? coreState.project.masks.get(mediaKey) : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dndCss,
        position: "absolute",
        ...containerSize,
        zIndex: showContextMenu && maxZIndex !== undefined ? Z_INDEX.CONTEXT_MENU_OFFSET + maxZIndex + zIndex : zIndex,
      }}
    >
      <div>
        <div
          {...listeners}
          title={title}
          style={{
            ...(transform && { ...transform.cssProps }),
            position: "relative",
            zIndex: Z_INDEX.ITEM_CONTENT,
            cursor,
          }}
        >
          <canvas
            ref={setupCanvas}
            width={canvasSize.width}
            height={canvasSize.height}
            data-mask-key={source.kind === "static" ? mediaKey : undefined}
            onClick={(e) => {
              if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                return;
              }
              if (source.kind !== "static") return;
              if (uiState.objectReview?.maskKey === mediaKey) {
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                const index = point ? polygonIndexAtPoint(maskGeometryRef.current.points, point) : undefined;
                if (index !== undefined) {
                  // Repaint straight away off this mask's own copy of the
                  // membership, then tell the session. The click and the
                  // highlight are the same gesture, so it should not wait on a
                  // dispatch and a re-render to land -- and the reducer arrives
                  // at exactly this set for the state that the decision reads.
                  const previewed = new Set(objectReviewPreviewRef.current ?? []);
                  if (previewed.has(index)) previewed.delete(index);
                  else previewed.add(index);
                  objectReviewPreviewRef.current = previewed;
                  recolorHighlight();
                  uiDispatch({ type: UIActionType.ToggleObjectReviewPolygon, index });
                }
                return;
              }
              const hitSubElement = (): Extract<LaurusSelectedElement, { type: "capture" | "object" }> | undefined => {
                if (source.kind !== "static") return undefined;
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return undefined;
                const objectId = objectIdAtPoint(objectsRef.current, point);
                if (objectId !== undefined) return { key: mediaKey, type: "object", objectId };
                const captureId = captureIdAtPoint(source.maskData.polygons, maskGeometryRef.current.points, point);
                if (captureId !== undefined) return { key: mediaKey, type: "capture", captureId };
                return undefined;
              };
              const select = (selected: LaurusSelectedElement) => {
                uiDispatch({ type: UIActionType.SetSelectedElement, value: selected });
                if ((selected.type === "capture" || selected.type === "object") && uiState.lightSourcePreview) {
                  uiDispatch({ type: UIActionType.SetLightSourcePreview, value: false });
                  notifyMaskLightSourcePreviewToggled(false);
                }
                notifyMaskSelectionChanged(mediaKey);
                notifyMaskSelectedCaptureChanged(
                  mediaKey,
                  selected.type === "capture" ? selected.captureId : undefined,
                );
                notifyMaskSelectedObjectChanged(mediaKey, selected.type === "object" ? selected.objectId : undefined);
              };
              const previouslySelectedCaptureId =
                uiState.selectedElement?.type === "capture" && uiState.selectedElement.key === mediaKey
                  ? uiState.selectedElement.captureId
                  : undefined;
              const previouslySelectedObjectId =
                uiState.selectedElement?.type === "object" && uiState.selectedElement.key === mediaKey
                  ? uiState.selectedElement.objectId
                  : undefined;
              const isIdleMaskTool =
                uiState.tool.type === "mask" && !uiState.tool.capturingMeshSection && !uiState.tool.editingTopology;
              if (isIdleMaskTool && !isAltKeyPressed && !e.metaKey) {
                setSelectedMaskKeys(new Set([mediaKey]));
                if (source.maskData.captures.length > 0) {
                  select({ key: mediaKey, type: "mask" });
                }
                return;
              }
              if (
                isAltKeyPressed ||
                ((uiState.tool.type === "scale" || uiState.tool.type === "light_source") && !e.metaKey)
              ) {
                if (isAltKeyPressed || uiState.tool.type === "light_source") {
                  const hit = hitSubElement();
                  if (hit) {
                    const alreadySelected =
                      hit.type === "capture"
                        ? previouslySelectedCaptureId === hit.captureId
                        : previouslySelectedObjectId === hit.objectId;
                    select(alreadySelected ? { key: mediaKey, type: "mask" } : hit);
                    return;
                  }
                }
                setSelectedMaskKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                  } else {
                    next.add(mediaKey);
                    if (source.maskData.captures.length > 0) {
                      select({ key: mediaKey, type: "mask" });
                    }
                  }
                  return next;
                });
                return;
              }
              if (uiState.tool.type === "rotate" && !e.metaKey) {
                setSelectedMaskKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                  } else {
                    next.add(mediaKey);
                  }
                  return next;
                });
              }
              const hit = e.metaKey ? hitSubElement() : undefined;
              const hitCaptureId = hit?.type === "capture" ? hit.captureId : undefined;
              const hitObjectId = hit?.type === "object" ? hit.objectId : undefined;
              if (hit) {
                select(hit);
              } else if (
                showContextMenu &&
                (previouslySelectedCaptureId !== undefined || previouslySelectedObjectId !== undefined)
              ) {
                select({ key: mediaKey, type: "mask" });
              }
              if (
                showContextMenu &&
                (previouslySelectedCaptureId !== hitCaptureId || previouslySelectedObjectId !== hitObjectId)
              ) {
                return;
              }
              if (!meta) return;
              const itemContextMenu = uiState.projectContextMenus.get(mediaKey);
              const contextMenuConfig = itemContextMenu?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG;
              const newContextMenuConfig = getNewContextMenuConfig(
                { ...meta },
                {
                  width: coreState.project.canvas_width,
                  height: coreState.project.canvas_height,
                },
                { ...meta },
                { x: meta.scale_x, y: meta.scale_y },
                contextMenuConfig,
              );
              if (e.metaKey && !uiState.filledForwards) {
                uiDispatch({
                  type: UIActionType.SetProjectContextMenu,
                  key: mediaKey,
                  showContextMenu: !showContextMenu,
                  contextMenuConfig: newContextMenuConfig,
                });
                return;
              }
              switch (uiState.tool.type) {
                case "contextmenu": {
                  uiDispatch({
                    type: UIActionType.SetProjectContextMenu,
                    key: mediaKey,
                    showContextMenu: !showContextMenu,
                    contextMenuConfig: newContextMenuConfig,
                  });
                  break;
                }
                case "rotate": {
                  const newActiveElement: LaurusActiveElement = { key: mediaKey, type: "mask" };
                  uiDispatch({ type: UIActionType.SetActiveElement, value: newActiveElement });
                  notifyMaskSelectionChanged(mediaKey);
                  break;
                }
              }
            }}
            onPointerDown={(e) => {
              suppressNextClickRef.current = false;
              if (source.kind !== "static") return;
              const isTopologyTool = uiState.tool.type === "mask" && uiState.tool.editingTopology;
              const isMoveTool = uiState.tool.type === "move";
              if (isTopologyTool || isMoveTool) {
                const canvas = e.currentTarget;
                const point = toBufferPoint(canvas, e.clientX, e.clientY);
                const objectId = point ? objectIdAtPoint(objectsRef.current, point) : undefined;
                const object = objectId !== undefined ? objectsRef.current.find((p) => p.id === objectId) : undefined;
                if (point && objectId !== undefined && object && !objectCommitInFlightRef.current.has(objectId)) {
                  const [bufferX, bufferY] = point;
                  e.stopPropagation();
                  e.preventDefault();
                  canvas.setPointerCapture(e.pointerId);
                  objectDragRef.current = {
                    pointerId: e.pointerId,
                    objectId,
                    startX: bufferX,
                    startY: bufferY,
                    originalCx: object.cx,
                    originalCy: object.cy,
                    originalRadius: object.radius,
                    originalElevation: object.elevation,
                    originalFalloff: object.falloff,
                    originalShape: object.shape,
                    originalBlackPoint: toObjectBlackPoint(object),
                    rafId: undefined,
                    latestX: bufferX,
                    latestY: bufferY,
                  };
                  setIsDraggingTopology(true);
                  return;
                }
                if (isTopologyTool) return;
              }
              if (uiState.tool.type !== "move") return;
              const canvas = e.currentTarget;
              const point = toBufferPoint(canvas, e.clientX, e.clientY);
              if (!point) return;
              const [bufferX, bufferY] = point;
              const captureId = captureIdAtPoint(source.maskData.polygons, maskGeometryRef.current.points, [
                bufferX,
                bufferY,
              ]);
              if (captureId === undefined) return;
              if (captureCommitInFlightRef.current.has(captureId)) return;
              const originalIndices = new Set<number>();
              source.maskData.polygons.forEach((p, i) => {
                if (p.capture_id === captureId) originalIndices.add(i);
              });
              const persistedSize = source.maskData.captures.find((c) => c.id === captureId)?.size ?? 0;
              const known = lastKnownCaptureRef.current.get(captureId);
              const reconstructed =
                known && sameIndices(known.indices, originalIndices)
                  ? known.circle
                  : capturedRegionCircle(source.maskData.polygons, maskGeometryRef.current.centroids, captureId);
              if (!reconstructed) return;
              const circle = persistedSize > 0 ? { ...reconstructed, radius: persistedSize / 2 } : reconstructed;
              e.stopPropagation();
              e.preventDefault();
              canvas.setPointerCapture(e.pointerId);
              captureDragRef.current = {
                pointerId: e.pointerId,
                captureId,
                startX: bufferX,
                startY: bufferY,
                originalCircle: circle,
                originalIndices,
                rafId: undefined,
                latestX: bufferX,
                latestY: bufferY,
              };
              setIsDraggingCapture(true);
              dispatch({
                type: CoreActionType.SetPendingLightSourceCapture,
                value: { maskKey: mediaKey, captureId, polygonIndices: [...originalIndices] },
              });
              notifyMaskPendingCaptureSet(mediaKey, originalIndices, captureId);
            }}
            onPointerMove={(e) => {
              const captureDrag = captureDragRef.current;
              if (captureDrag && e.pointerId === captureDrag.pointerId) {
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return;
                [captureDrag.latestX, captureDrag.latestY] = point;
                if (captureDrag.rafId === undefined) captureDrag.rafId = requestAnimationFrame(recomputeCaptureDrag);
                return;
              }
              const objectDrag = objectDragRef.current;
              if (objectDrag && e.pointerId === objectDrag.pointerId) {
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return;
                [objectDrag.latestX, objectDrag.latestY] = point;
                if (objectDrag.rafId === undefined) objectDrag.rafId = requestAnimationFrame(recomputeTopologyDrag);
              }
            }}
            onPointerUp={(e) => {
              const objectDrag = objectDragRef.current;
              if (objectDrag && e.pointerId === objectDrag.pointerId && source.kind === "static") {
                suppressNextClickRef.current = true;
                if (objectDrag.rafId !== undefined) cancelAnimationFrame(objectDrag.rafId);
                e.currentTarget.releasePointerCapture(e.pointerId);
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                const dx = (point?.[0] ?? objectDrag.latestX) - objectDrag.startX;
                const dy = (point?.[1] ?? objectDrag.latestY) - objectDrag.startY;
                const objectId = objectDrag.objectId;
                const finalCx = objectDrag.originalCx + dx;
                const finalCy = objectDrag.originalCy + dy;
                const finalElevation = objectDrag.originalElevation;
                const finalFalloff = objectDrag.originalFalloff;
                const existingObject = source.maskData.objects.find((p) => p.id === objectId);
                const objectName = existingObject?.name ?? `object ${objectId}`;
                objectDragRef.current = undefined;
                setIsDraggingTopology(false);
                const edit: PendingTopologyEdit = {
                  maskKey: mediaKey,
                  objectId,
                  cx: finalCx,
                  cy: finalCy,
                  radius: objectDrag.originalRadius,
                  elevation: finalElevation,
                  falloff: finalFalloff,
                  shape: objectDrag.originalShape,
                  blackPoint: objectDrag.originalBlackPoint,
                };
                dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
                notifyMaskPendingTopologySet(mediaKey, edit);
                objectCommitInFlightRef.current.add(objectId);
                sendMaskObjectUpdate(source.maskData.mask_media_id, {
                  object_id: objectId,
                  name: objectName,
                  cx: finalCx,
                  cy: finalCy,
                  radius: objectDrag.originalRadius,
                  elevation: finalElevation,
                  falloff: finalFalloff,
                  shape: objectDrag.originalShape,
                  ...toObjectBlackPointFields(objectDrag.originalBlackPoint),
                  description: existingObject?.description ?? "",
                  remove: false,
                  polygon_indices: [
                    ...indicesInObjectFromCentroids(maskGeometryRef.current.centroids, {
                      cx: finalCx,
                      cy: finalCy,
                      radius: objectDrag.originalRadius,
                      shape: objectDrag.originalShape,
                    }),
                  ],
                }).then((updated) => {
                  objectCommitInFlightRef.current.delete(objectId);
                  const latestMask = latestRef.current.source;
                  if (updated && latestMask.kind === "static") {
                    const patched = applyObjectDelta(latestMask.maskData, updated);
                    dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: patched });
                    notifyMaskObjectsUpdated(mediaKey, patched);
                    if (uiState.lightSourcePreview) {
                      uiDispatch({ type: UIActionType.SetLightSourcePreview, value: false });
                      notifyMaskLightSourcePreviewToggled(false);
                    }
                  }
                  dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
                  notifyMaskPendingTopologyCleared(mediaKey);
                });
                return;
              }
              const drag = captureDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId || source.kind !== "static") return;
              suppressNextClickRef.current = true;
              if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
              const dx = (point?.[0] ?? drag.latestX) - drag.startX;
              const dy = (point?.[1] ?? drag.latestY) - drag.startY;
              const finalIndices = captureIndicesAtOffset(drag, dx, dy);
              const captureId = drag.captureId;
              const existingCapture = source.maskData.captures.find((c) => c.id === captureId);
              const captureName = existingCapture?.name ?? `light ${captureId}`;
              captureDragRef.current = undefined;
              setIsDraggingCapture(false);
              if (finalIndices.size === 0) {
                lastKnownCaptureRef.current.set(captureId, {
                  indices: drag.originalIndices,
                  circle: drag.originalCircle,
                });
                dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
                notifyMaskPendingCaptureCleared(mediaKey);
                return;
              }
              dispatch({
                type: CoreActionType.SetPendingLightSourceCapture,
                value: { maskKey: mediaKey, captureId, polygonIndices: [...finalIndices] },
              });
              notifyMaskPendingCaptureSet(mediaKey, finalIndices, captureId);
              captureCommitInFlightRef.current.add(captureId);
              sendMaskCaptureUpdate(source.maskData.mask_media_id, {
                capture_id: captureId,
                name: captureName,
                polygon_indices: [...finalIndices],
                size: existingCapture?.size ?? 0,
                intensity: existingCapture?.intensity ?? 0,
                falloff: existingCapture?.falloff ?? 0,
                darkness: existingCapture?.darkness ?? 0,
              }).then((updated) => {
                captureCommitInFlightRef.current.delete(captureId);
                const latestMask = latestRef.current.source;
                if (updated && latestMask.kind === "static") {
                  const patched = applyCaptureDelta(latestMask.maskData, updated);
                  dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: patched });
                  notifyMaskCaptureUpdated(mediaKey, patched);
                  if (uiState.lightSourcePreview) {
                    uiDispatch({ type: UIActionType.SetLightSourcePreview, value: false });
                    notifyMaskLightSourcePreviewToggled(false);
                  }
                  lastKnownCaptureRef.current.set(captureId, {
                    indices: finalIndices,
                    circle: {
                      cx: drag.originalCircle.cx + dx,
                      cy: drag.originalCircle.cy + dy,
                      radius: drag.originalCircle.radius,
                    },
                  });
                } else {
                  lastKnownCaptureRef.current.set(captureId, {
                    indices: drag.originalIndices,
                    circle: drag.originalCircle,
                  });
                }
                dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
                notifyMaskPendingCaptureCleared(mediaKey);
              });
            }}
            onPointerCancel={(e) => {
              const objectDrag = objectDragRef.current;
              if (objectDrag && e.pointerId === objectDrag.pointerId) {
                abortTopologyDrag();
                return;
              }
              const drag = captureDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId) return;
              abortCaptureDrag();
            }}
            onMouseEnter={() => {
              setIsHovered(true);
            }}
            onMouseMove={(e) => {
              setIsHovered(true);
              if (captureDragRef.current || objectDragRef.current) return;
              if (wiredMoveRef.current || !uiState.lightSourcePreview) return;
              setMostRecentlyHoveredMaskKey(mediaKey);
              const canvas = e.currentTarget;
              const rect = canvas.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return;
              const scaleX = canvas.width / rect.width;
              const scaleY = canvas.height / rect.height;
              const bufferX = (e.clientX - rect.left) * scaleX;
              const bufferY = (e.clientY - rect.top) * scaleY;
              lightSourceRef.current = {
                x: bufferX,
                y: canvas.height - bufferY,
                radius: (captureSizeRef.current / 2) * scaleX,
                falloff: captureFalloffRef.current * scaleX,
              };
              render();
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              if (wiredMoveRef.current) return;
              lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
              render();
            }}
            style={{
              ...containerSize,
              display: "block",
              outline: isSelected
                ? "2px solid rgba(66, 133, 244, 1)"
                : source.kind === "static" && isHovered && (isAltKeyPressed || uiState.tool.type === "mask")
                  ? "2px solid rgba(255, 255, 255, 0.9)"
                  : showContextMenu
                    ? "1px solid rgba(255, 255, 255, 0.175)"
                    : "none",
            }}
          />
        </div>
        {showContextMenu && maskMeta && framesCacheRef && (
          <ContextMenu
            media={
              uiState.selectedElement?.type === "capture" && uiState.selectedElement.key === mediaKey
                ? { key: mediaKey, type: "capture", captureId: uiState.selectedElement.captureId, meta: maskMeta }
                : uiState.selectedElement?.type === "object" && uiState.selectedElement.key === mediaKey
                  ? { key: mediaKey, type: "object", objectId: uiState.selectedElement.objectId, meta: maskMeta }
                  : { key: mediaKey, type: "mask", meta: maskMeta }
            }
            framesCacheRef={framesCacheRef}
            transform={transform}
          />
        )}
      </div>
    </div>
  );
}
