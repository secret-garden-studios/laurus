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
  MaskLightSource,
  parsePathPoints,
  PeakGeometryInput,
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
  captureTriangleIndicesInCircle,
  captureIdAtPoint,
  indicesInPeakFromCentroids,
  peakIdAtPoint,
  peakTriangleIndices,
  polygonCentroids,
} from "./light-source-capture";
import { cachedPeakShape } from "./peak-shape";
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
  LaurusPeak,
  LaurusPeakBlackPoint,
  LaurusPolygonPath,
  toPeakBlackPoint,
  toPeakBlackPointFields,
} from "../workspace.server";
import { maskCaptureInputId, maskPeakInputId } from "../effects-utils";

const DIM_HIGHLIGHT = 0.35;

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

function buildPeaksMap(polygons: LaurusPolygonPath[]): Map<number, Set<number>> {
  const byPeak = new Map<number, Set<number>>();
  polygons.forEach((p, i) => {
    if (p.peak_id === 0) return;
    const indices = byPeak.get(p.peak_id) ?? new Set<number>();
    indices.add(i);
    byPeak.set(p.peak_id, indices);
  });
  return byPeak;
}

function toPeakGeometry(peak: LaurusPeak): PeakGeometryInput {
  return {
    cx: peak.cx,
    cy: peak.cy,
    radius: peak.radius,
    elevation: peak.elevation,
    falloff: peak.falloff,
    shape: cachedPeakShape(peak.shape),
    blackPoint: toPeakBlackPoint(peak),
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
  play: (effectKey?: string, captureId?: number, peakId?: number) => Promise<void>;
  preparePlayback: (
    effectKey?: string,
    captureId?: number,
    peakId?: number,
  ) => Promise<(() => Promise<void>) | undefined>;
  stop: () => void;
  abortCaptureDragForToolChange: (newToolType: string) => void;
  abortTopologyDragForToolChange: () => void;
  setSelectedHighlighted: (active: boolean) => void;
  setSelectedCapture: (captureId: number | undefined) => void;
  setSelectedPeak: (peakId: number | undefined) => void;
  setPendingCapture: (indices: Set<number>, captureId?: number) => void;
  clearPendingCapture: () => void;
  syncCapturedIndices: (updated: LaurusMaskResult) => void;
  setPendingTopology: (edit: PendingTopologyEdit) => void;
  clearPendingTopology: () => void;
  syncPeaks: (updated: LaurusMaskResult) => void;
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
  const { sendMaskCaptureUpdate, sendMaskPeakUpdate } = useContext(SocketContext);
  const {
    notifyMaskSelectionChanged,
    notifyMaskSelectedCaptureChanged,
    notifyMaskSelectedPeakChanged,
    notifyMaskPendingCaptureSet,
    notifyMaskPendingCaptureCleared,
    notifyMaskCaptureUpdated,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskPeaksUpdated,
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
  const playbackPeaksRef = useRef<
    Map<number, { cx: number; cy: number; elevation: number; radius: number; falloff: number }>
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
  const peakDragRef = useRef<
    | {
        pointerId: number;
        peakId: number;
        startX: number;
        startY: number;
        originalCx: number;
        originalCy: number;
        originalRadius: number;
        originalElevation: number;
        originalFalloff: number;
        originalShape: string;
        originalBlackPoint: LaurusPeakBlackPoint;
        rafId: number | undefined;
        latestX: number;
        latestY: number;
      }
    | undefined
  >(undefined);
  const peakCommitInFlightRef = useRef<Set<number>>(new Set());
  const [isDraggingTopology, setIsDraggingTopology] = useState(false);
  const peaksRef = useRef<LaurusPeak[]>([]);
  const pendingTopologyRef = useRef<PendingTopologyEdit | undefined>(undefined);
  const pendingCaptureRef = useRef<Set<number> | undefined>(undefined);
  const pendingCaptureIdRef = useRef<number | undefined>(undefined);
  const selectedHighlightRef = useRef(false);
  const capturesRef = useRef<Map<number, Set<number>>>(new Map());
  const capturesMetaRef = useRef<Map<number, LaurusCapture>>(new Map());
  const selectedCaptureIdRef = useRef<number | undefined>(undefined);
  const peaksMapRef = useRef<Map<number, Set<number>>>(new Map());
  const polygonCentroidsRef = useRef<[number, number][]>([]);
  const selectedPeakIdRef = useRef<number | undefined>(undefined);
  const captureIndicesAtOffset = useCallback(
    (drag: NonNullable<typeof captureDragRef.current>, dx: number, dy: number): Set<number> => {
      if (source.kind !== "static") return new Set();
      if (dx * dx + dy * dy <= CAPTURE_DRAG_EPSILON_SQ) return drag.originalIndices;
      return captureTriangleIndicesInCircle(source.maskData.polygons, {
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

  const resolvePeakUniforms = useCallback((): PeakGeometryInput[] => {
    const pending = pendingTopologyRef.current;
    const peaks = peaksRef.current.map((peak): PeakGeometryInput => {
      const shape = cachedPeakShape(peak.shape);
      const playing = playbackPeaksRef.current.get(peak.id);
      if (playing) {
        return {
          cx: playing.cx,
          cy: playing.cy,
          radius: playing.radius,
          elevation: playing.elevation,
          falloff: playing.falloff,
          shape,
          blackPoint: toPeakBlackPoint(peak),
        };
      }
      return pending && pending.peakId === peak.id
        ? {
            cx: pending.cx,
            cy: pending.cy,
            radius: pending.radius,
            elevation: pending.elevation,
            falloff: pending.falloff,
            shape,
            blackPoint: pending.blackPoint,
          }
        : toPeakGeometry(peak);
    });
    if (pending && !peaksRef.current.some((peak) => peak.id === pending.peakId)) {
      peaks.push({
        cx: pending.cx,
        cy: pending.cy,
        radius: pending.radius,
        elevation: pending.elevation,
        falloff: pending.falloff,
        shape: cachedPeakShape(pending.shape),
        blackPoint: pending.blackPoint,
      });
    }
    return peaks;
  }, []);

  const recomputeTopologyDrag = useCallback(() => {
    const drag = peakDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const dx = drag.latestX - drag.startX;
    const dy = drag.latestY - drag.startY;
    const edit: PendingTopologyEdit = {
      maskKey: mediaKey,
      peakId: drag.peakId,
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
    const drag = peakDragRef.current;
    if (!drag) return;
    if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
    canvasRef.current?.releasePointerCapture(drag.pointerId);
    peakDragRef.current = undefined;
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
      const allPoints = source.maskData.polygons.filter((_, i) => indices.has(i)).flatMap((p) => parsePathPoints(p.d));
      if (allPoints.length === 0) return undefined;
      return {
        x: allPoints.reduce((sum, [px]) => sum + px, 0) / allPoints.length,
        y: allPoints.reduce((sum, [, py]) => sum + py, 0) / allPoints.length,
      };
    },
    [source, resolveTargetCaptureId],
  );

  const resolveRestingLightSources = useCallback((): MaskLightSource[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const centroids = polygonCentroidsRef.current;
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

  const cursor = useToolCursor({
    target: source.kind === "static" ? "mask" : undefined,
    dragDisabled,
    isDragging: isDragging || isDraggingCapture || isDraggingTopology,
  });

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
      peaks: resolvePeakUniforms(),
      texture: textureRef.current,
      textureMix: textureMixRef.current,
      maskTexture: maskTextureRef.current,
      glowColor: glowColorRef.current,
    });
  }, [resolvePeakUniforms, resolveRestingLightSources]);

  const recolorHighlight = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;
    const vertexCount = vertexCountRef.current;
    if (vertexCount === 0) return;
    const latestSource = latestRef.current.source;
    if (latestSource.kind !== "static") return;
    const { gl } = state;

    const highlights = new Float32Array(vertexCount);
    const vertexRanges = vertexRangesRef.current;
    const paint = (indices: Set<number>, intensity: number) => {
      indices.forEach((polygonIndex) => {
        const range = vertexRanges[polygonIndex];
        if (!range) return;
        const [startVertex, count] = range;
        for (let v = 0; v < count; v++) {
          const vertex = startVertex + v;
          if (vertex >= vertexCount) continue;
          highlights[vertex] = intensity;
        }
      });
    };

    const pendingCapture = pendingCaptureRef.current;
    if (pendingCapture && pendingCapture.size > 0) {
      paint(pendingCapture, 1);
    } else if (selectedHighlightRef.current) {
      const activeCaptureId = selectedCaptureIdRef.current;
      capturesRef.current.forEach((indices, captureId) => {
        paint(indices, captureId === activeCaptureId ? 1 : DIM_HIGHLIGHT);
      });
    }

    const pendingTopology = pendingTopologyRef.current;
    if (pendingTopology) {
      paint(indicesInPeakFromCentroids(polygonCentroidsRef.current, pendingTopology), 1);
    } else if (selectedHighlightRef.current) {
      const activePeakId = selectedPeakIdRef.current;
      peaksMapRef.current.forEach((indices, peakId) => {
        paint(indices, peakId === activePeakId ? 1 : DIM_HIGHLIGHT);
      });
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, highlights, gl.STATIC_DRAW);
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
    playbackPeaksRef.current = new Map();
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    applyDefaultCaptureValue();
    render();
  }, [render, applyDefaultCaptureValue]);

  const preparePlayback = useCallback(
    (effectKey?: string, captureId?: number, peakId?: number): Promise<(() => Promise<void>) | undefined> => {
      stopLightSourceAnimation();
      if (source.kind !== "static") return Promise.resolve(undefined);
      const playAll = effectKey === undefined && captureId === undefined && peakId === undefined;
      const candidateCaptureIds = playAll
        ? Array.from(capturesRef.current.keys())
        : peakId !== undefined
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

      const candidatePeakIds = playAll ? peaksRef.current.map((peak) => peak.id) : peakId !== undefined ? [peakId] : [];
      const peakTargets = candidatePeakIds
        .map((id) => {
          const inputId = maskPeakInputId(mediaKey, id);
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
          return { peakId: id, inputId, wiredMove, wiredLightSource, wiredScale };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale);

      if (targets.length === 0 && peakTargets.length === 0) return Promise.resolve(undefined);

      wiredMoveRef.current = targets.length > 0;

      const mergedFramesByCapture = new Map<number, LaurusFrame[]>();
      const moveFramesByCapture = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByCapture = new Map<number, LaurusFrame[]>();
      const scaleFramesByCapture = new Map<number, LaurusFrame[]>();
      const mergedFramesByPeak = new Map<number, LaurusFrame[]>();
      const moveFramesByPeak = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByPeak = new Map<number, LaurusFrame[]>();
      const scaleFramesByPeak = new Map<number, LaurusFrame[]>();
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
          ...peakTargets.map((t) =>
            fetchFramesCached(t.inputId, t.inputId, () =>
              getFrames(coreState.apiOrigin, coreState.project.project_id, t.inputId, fps),
            ).then((result) => {
              if (activePlaybackRef.current !== session) return;
              mergedFramesByPeak.set(t.peakId, result ?? []);
            }),
          ),
        ]).then(() => {
          if (activePlaybackRef.current !== session) return;
          totalFrames = Math.max(
            1,
            ...Array.from(mergedFramesByCapture.values()).map((f) => f.length),
            ...Array.from(mergedFramesByPeak.values()).map((f) => f.length),
          );
          durationSeconds = totalFrames / fps;
        });
      } else if (targets.length === 0) {
        const peakTarget = peakTargets[0];
        const timingValue = (peakTarget.wiredMove ?? peakTarget.wiredLightSource ?? peakTarget.wiredScale)!.value;
        fps = timingValue.fps > 0 ? timingValue.fps : projectFps;
        totalFrames = Math.max(Math.round((timingValue.end - timingValue.start) * fps), 1);
        durationSeconds = totalFrames / fps;
        const peakFetches: Promise<void>[] = [];
        if (peakTarget.wiredMove) {
          const wiredMove = peakTarget.wiredMove;
          peakFetches.push(
            fetchFramesCached(peakTarget.inputId, `move:${peakTarget.inputId}`, () =>
              getMoveFrames(coreState.apiOrigin, wiredMove.key, peakTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) moveFramesByPeak.set(peakTarget.peakId, result);
            }),
          );
        }
        if (peakTarget.wiredLightSource) {
          const wiredLightSource = peakTarget.wiredLightSource;
          peakFetches.push(
            fetchFramesCached(peakTarget.inputId, `light_source:${peakTarget.inputId}`, () =>
              getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, peakTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                lightSourceFramesByPeak.set(peakTarget.peakId, result);
            }),
          );
        }
        if (peakTarget.wiredScale) {
          const wiredScale = peakTarget.wiredScale;
          peakFetches.push(
            fetchFramesCached(peakTarget.inputId, `scale:${peakTarget.inputId}`, () =>
              getScaleFrames(coreState.apiOrigin, wiredScale.key, peakTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) scaleFramesByPeak.set(peakTarget.peakId, result);
            }),
          );
        }
        ready = Promise.all(peakFetches).then(() => {});
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

                peakTargets.forEach((t) => {
                  const peak = peaksRef.current.find((p) => p.id === t.peakId);
                  if (!peak) return;
                  const mergedFrames = mergedFramesByPeak.get(t.peakId);
                  const moveFrames = moveFramesByPeak.get(t.peakId);
                  const lightSourceFrames = lightSourceFramesByPeak.get(t.peakId);
                  const scaleFrames = scaleFramesByPeak.get(t.peakId);

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
                  const cx = peak.cx + (movePoint?.x ?? 0) * scaleX;
                  const cy = peak.cy + (movePoint?.y ?? 0) * scaleY;
                  const elevation = lightSourcePoint?.peak_elevation ?? peak.elevation;
                  const radius = lightSourcePoint?.peak_radius ?? peak.radius;
                  const falloff = lightSourcePoint?.peak_falloff ?? peak.falloff;
                  const scaleMultiplier = scalePoint?.sx ?? 1;

                  playbackPeaksRef.current.set(t.peakId, {
                    cx,
                    cy,
                    elevation,
                    radius: radius * scaleMultiplier,
                    falloff,
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
    (effectKey?: string, captureId?: number, peakId?: number): Promise<void> =>
      preparePlayback(effectKey, captureId, peakId).then((start) => start?.()),
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
        const mesh = colorCtx
          ? buildStaticMaskMesh({ ...maskData, peaks: maskData.peaks.map(toPeakGeometry) }, colorCtx)
          : { positions: [], colors: [], barycentrics: [], uvs: [], centroids: [], vertexCount: 0, vertexRanges: [] };
        vertexCountRef.current = mesh.vertexCount;
        vertexRangesRef.current = mesh.vertexRanges;
        uploadStaticMaskMesh(state, mesh);
        gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertexCount), gl.STATIC_DRAW);

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
        selectedPeakIdRef.current =
          selectedHighlightRef.current && uiState.selectedElement?.type === "peak"
            ? uiState.selectedElement.peakId
            : undefined;
        capturesRef.current = buildCapturesMap(maskData.polygons);
        capturesMetaRef.current = buildCapturesMetaMap(maskData.captures);
        peaksRef.current = maskData.peaks;
        peaksMapRef.current = buildPeaksMap(maskData.polygons);
        polygonCentroidsRef.current = polygonCentroids(maskData.polygons);
        pendingTopologyRef.current =
          coreState.pendingTopologyEdit?.maskKey === mediaKey ? coreState.pendingTopologyEdit : undefined;

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
          play: (effectKey, captureId, peakId) =>
            latestRef.current.playLightSourceAnimation(effectKey, captureId, peakId),
          preparePlayback: (effectKey, captureId, peakId) =>
            latestRef.current.preparePlayback(effectKey, captureId, peakId),
          stop: () => latestRef.current.stopLightSourceAnimation(),
          abortCaptureDragForToolChange: (newToolType) => {
            if (newToolType === "move") return;
            if (captureDragRef.current) abortCaptureDrag();
          },
          abortTopologyDragForToolChange: () => {
            if (!peakDragRef.current) return;
            const tool = latestRef.current.uiState.tool;
            if (tool.type === "mask" && tool.editingTopology) return;
            abortTopologyDrag();
          },
          setSelectedHighlighted: (active) => {
            selectedHighlightRef.current = active;
            if (!active) {
              selectedCaptureIdRef.current = undefined;
              selectedPeakIdRef.current = undefined;
            }
            recolorHighlight();
          },
          setSelectedCapture: (captureId) => {
            selectedCaptureIdRef.current = captureId;
            recolorHighlight();
          },
          setSelectedPeak: (peakId) => {
            selectedPeakIdRef.current = peakId;
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
            polygonCentroidsRef.current = polygonCentroids(updated.polygons);
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
          syncPeaks: (updated) => {
            const latestSource = latestRef.current.source;
            if (latestSource.kind !== "static") return;
            if (latestSource.maskData.mask_media_id !== updated.mask_media_id) return;
            peaksRef.current = updated.peaks;
            peaksMapRef.current = buildPeaksMap(updated.polygons);
            polygonCentroidsRef.current = polygonCentroids(updated.polygons);
            const glState = glStateRef.current;
            if (glState && colorCtx) {
              const mesh = buildStaticMaskMesh({ ...updated, peaks: updated.peaks.map(toPeakGeometry) }, colorCtx);
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
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexCountRef.current), gl.DYNAMIC_DRAW);
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
              if (source.kind !== "static") return;
              const hitSubElement = (): Extract<LaurusSelectedElement, { type: "capture" | "peak" }> | undefined => {
                if (source.kind !== "static") return undefined;
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return undefined;
                const peakId = peakIdAtPoint(peaksRef.current, point);
                if (peakId !== undefined) return { key: mediaKey, type: "peak", peakId };
                const captureId = captureIdAtPoint(source.maskData.polygons, point);
                if (captureId !== undefined) return { key: mediaKey, type: "capture", captureId };
                return undefined;
              };
              const select = (selected: LaurusSelectedElement) => {
                uiDispatch({ type: UIActionType.SetSelectedElement, value: selected });
                notifyMaskSelectionChanged(mediaKey);
                notifyMaskSelectedCaptureChanged(
                  mediaKey,
                  selected.type === "capture" ? selected.captureId : undefined,
                );
                notifyMaskSelectedPeakChanged(mediaKey, selected.type === "peak" ? selected.peakId : undefined);
              };
              const previouslySelectedCaptureId =
                uiState.selectedElement?.type === "capture" && uiState.selectedElement.key === mediaKey
                  ? uiState.selectedElement.captureId
                  : undefined;
              const previouslySelectedPeakId =
                uiState.selectedElement?.type === "peak" && uiState.selectedElement.key === mediaKey
                  ? uiState.selectedElement.peakId
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
                        : previouslySelectedPeakId === hit.peakId;
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
              const hitPeakId = hit?.type === "peak" ? hit.peakId : undefined;
              if (hit) {
                select(hit);
              } else if (
                showContextMenu &&
                (previouslySelectedCaptureId !== undefined || previouslySelectedPeakId !== undefined)
              ) {
                select({ key: mediaKey, type: "mask" });
              }
              if (
                showContextMenu &&
                (previouslySelectedCaptureId !== hitCaptureId || previouslySelectedPeakId !== hitPeakId)
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
              if (source.kind !== "static") return;
              const isTopologyTool = uiState.tool.type === "mask" && uiState.tool.editingTopology;
              const isMoveTool = uiState.tool.type === "move";
              if (isTopologyTool || isMoveTool) {
                const canvas = e.currentTarget;
                const point = toBufferPoint(canvas, e.clientX, e.clientY);
                const peakId = point ? peakIdAtPoint(peaksRef.current, point) : undefined;
                const peak = peakId !== undefined ? peaksRef.current.find((p) => p.id === peakId) : undefined;
                if (point && peakId !== undefined && peak && !peakCommitInFlightRef.current.has(peakId)) {
                  const [bufferX, bufferY] = point;
                  e.stopPropagation();
                  e.preventDefault();
                  canvas.setPointerCapture(e.pointerId);
                  peakDragRef.current = {
                    pointerId: e.pointerId,
                    peakId,
                    startX: bufferX,
                    startY: bufferY,
                    originalCx: peak.cx,
                    originalCy: peak.cy,
                    originalRadius: peak.radius,
                    originalElevation: peak.elevation,
                    originalFalloff: peak.falloff,
                    originalShape: peak.shape,
                    originalBlackPoint: toPeakBlackPoint(peak),
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
              const captureId = captureIdAtPoint(source.maskData.polygons, [bufferX, bufferY]);
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
                  : capturedRegionCircle(source.maskData.polygons, captureId);
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
              const peakDrag = peakDragRef.current;
              if (peakDrag && e.pointerId === peakDrag.pointerId) {
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return;
                [peakDrag.latestX, peakDrag.latestY] = point;
                if (peakDrag.rafId === undefined) peakDrag.rafId = requestAnimationFrame(recomputeTopologyDrag);
              }
            }}
            onPointerUp={(e) => {
              const peakDrag = peakDragRef.current;
              if (peakDrag && e.pointerId === peakDrag.pointerId && source.kind === "static") {
                if (peakDrag.rafId !== undefined) cancelAnimationFrame(peakDrag.rafId);
                e.currentTarget.releasePointerCapture(e.pointerId);
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                const dx = (point?.[0] ?? peakDrag.latestX) - peakDrag.startX;
                const dy = (point?.[1] ?? peakDrag.latestY) - peakDrag.startY;
                const peakId = peakDrag.peakId;
                const finalCx = peakDrag.originalCx + dx;
                const finalCy = peakDrag.originalCy + dy;
                const finalElevation = peakDrag.originalElevation;
                const finalFalloff = peakDrag.originalFalloff;
                const existingPeak = source.maskData.peaks.find((p) => p.id === peakId);
                const peakName = existingPeak?.name ?? `peak ${peakId}`;
                peakDragRef.current = undefined;
                setIsDraggingTopology(false);
                const edit: PendingTopologyEdit = {
                  maskKey: mediaKey,
                  peakId,
                  cx: finalCx,
                  cy: finalCy,
                  radius: peakDrag.originalRadius,
                  elevation: finalElevation,
                  falloff: finalFalloff,
                  shape: peakDrag.originalShape,
                  blackPoint: peakDrag.originalBlackPoint,
                };
                dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
                notifyMaskPendingTopologySet(mediaKey, edit);
                peakCommitInFlightRef.current.add(peakId);
                sendMaskPeakUpdate(source.maskData.mask_media_id, {
                  peak_id: peakId,
                  name: peakName,
                  cx: finalCx,
                  cy: finalCy,
                  radius: peakDrag.originalRadius,
                  elevation: finalElevation,
                  falloff: finalFalloff,
                  shape: peakDrag.originalShape,
                  ...toPeakBlackPointFields(peakDrag.originalBlackPoint),
                  remove: false,
                  polygon_indices: [
                    ...peakTriangleIndices(source.maskData.polygons, {
                      cx: finalCx,
                      cy: finalCy,
                      radius: peakDrag.originalRadius,
                      shape: peakDrag.originalShape,
                    }),
                  ],
                }).then((updated) => {
                  peakCommitInFlightRef.current.delete(peakId);
                  if (updated) {
                    dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: updated });
                    notifyMaskPeaksUpdated(mediaKey, updated);
                    uiDispatch({
                      type: UIActionType.SetSelectedElement,
                      value: { key: mediaKey, type: "peak", peakId },
                    });
                    notifyMaskSelectionChanged(mediaKey);
                    notifyMaskSelectedPeakChanged(mediaKey, peakId);
                    notifyMaskSelectedCaptureChanged(mediaKey, undefined);
                  }
                  dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
                  notifyMaskPendingTopologyCleared(mediaKey);
                });
                return;
              }
              const drag = captureDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId || source.kind !== "static") return;
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
                if (updated) {
                  dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: updated });
                  notifyMaskCaptureUpdated(mediaKey, updated);
                  uiDispatch({
                    type: UIActionType.SetSelectedElement,
                    value: { key: mediaKey, type: "capture", captureId },
                  });
                  notifyMaskSelectionChanged(mediaKey);
                  notifyMaskSelectedCaptureChanged(mediaKey, captureId);
                  notifyMaskSelectedPeakChanged(mediaKey, undefined);
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
              const peakDrag = peakDragRef.current;
              if (peakDrag && e.pointerId === peakDrag.pointerId) {
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
              if (captureDragRef.current || peakDragRef.current) return;
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
                : uiState.selectedElement?.type === "peak" && uiState.selectedElement.key === mediaKey
                  ? { key: mediaKey, type: "peak", peakId: uiState.selectedElement.peakId, meta: maskMeta }
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
