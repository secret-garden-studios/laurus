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
import { isAnyDragActive, useToolCursor } from "../hooks/useToolCursor";
import { toCanvasTranslate, useCanvasZoomValue } from "../hooks/useCanvasZoom";
import { RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  highlightObjectReviewAddedColor,
  highlightShapeEditColor,
  MaskLightSource,
  ObjectGeometryInput,
  ObjectRotation,
  objectTransform,
  TEXTURE_MIX_DEFAULT,
  uploadCurveMask,
  uploadStaticMaskMesh,
} from "../mask-gl";
import { CoreActionType, DEFAULT_LIGHT_VALUE, PendingTopologyEdit } from "../states/core-state";
import {
  EditableRegion,
  LaurusActiveElement,
  LaurusSelectedElement,
  MaskEditSession,
  UIActionType,
  editedRegion,
  isAwaitingRegionPick,
  isMaskEditLocked,
  isPenArmed,
} from "../states/ui-state";
import { DEFAULT_CONTEXT_MENU_CONFIG, LaurusProjectMask } from "../../projects/projects.server";
import { UseMaskPreview } from "../hooks/useMaskPreview";
import { Z_INDEX } from "../workspace.config";
import ContextMenu from "../context-menu";
import {
  litRegionCircle,
  lightCenterFromCentroids,
  lightIdAtPoint,
  centerOfIndices,
  dropIndicesClaimedByObjects,
  indicesInObjectFromCentroids,
  objectIdAtPoint,
  swelledPolygonIndexAtPoint,
} from "./light-geometry";
import {
  MaskGeometry,
  maskGeometry,
  maskPolygonColors,
  polygonIndicesForLight,
  polygonIndicesForObject,
} from "./mask-geometry";
import { applyLightDelta } from "./mask-delta";
import { OBJECT_SDF_DRAFT_TILE, OBJECT_SDF_TILE, cachedObjectShape } from "./object-shape";
import { shapeOutline } from "./object-clip";
import { frontElementOrder, isBehindMask, MASK_ORDER_UNRANKED, maskStack } from "./mask-order";
import { retouchMesh } from "./object-retouch";
import { unitCirclePath } from "./object-path";
import ObjectShapeEditor, { type ShapeEdit } from "./object-shape-editor";
import {
  getFrames,
  getImg,
  getLightSourceFrames,
  getMoveFrames,
  getRotateFrames,
  getSkewFrames,
  getScaleFrames,
  LaurusLight,
  LaurusEffect,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
  LaurusObject,
  LaurusObjectFill,
  LaurusPolygonPath,
  newLight,
  toEquationObjectFill,
  toLightUpdate,
  toObjectFill,
} from "../workspace.server";
import { maskLightInputId, maskObjectInputId } from "../effects-utils";

export type ProjectMaskItemSource =
  { kind: "static"; maskData: LaurusMaskResult } | { kind: "live"; mask: UseMaskPreview; sourceImg: LaurusImgResult };

const LIGHT_DRAG_EPSILON_SQ = 1;

type LightDragRegion = { cx: number; cy: number; radius: number; shape: string };

function maskEditSubjectFor(
  session: MaskEditSession | undefined,
  maskKey: string,
): { subject: "light" | "object"; id: number } | undefined {
  if (session?.maskKey !== maskKey) return undefined;
  const region = editedRegion(session);
  return region && { subject: session.subject, id: region.id };
}

function withoutNeighbouringObjects(
  indices: Set<number>,
  session: MaskEditSession,
  geometry: MaskGeometry,
  polygons: LaurusPolygonPath[],
): Set<number> {
  if (session.subject !== "object") return indices;
  const edited = editedRegion(session);
  if (!edited) return indices;
  return dropIndicesClaimedByObjects(indices, geometry, polygons, { objectId: edited.id });
}

function sameIndices(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const i of a) if (!b.has(i)) return false;
  return true;
}

function buildLightsMap(polygons: LaurusPolygonPath[]): Map<number, Set<number>> {
  const byLight = new Map<number, Set<number>>();
  polygons.forEach((p, i) => {
    if (p.light_id === 0) return;
    const indices = byLight.get(p.light_id) ?? new Set<number>();
    indices.add(i);
    byLight.set(p.light_id, indices);
  });
  return byLight;
}

function buildLightsMetaMap(lights: LaurusLight[]): Map<number, LaurusLight> {
  return new Map(lights.map((light) => [light.id, light]));
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

function objectsMeshSignature(objects: LaurusObject[]): string {
  return objects.map((o) => `${o.id}:${o.cx},${o.cy},${o.radius},${o.elevation},${o.falloff},${o.shape}`).join("|");
}

function pendingTileSize(pending: PendingTopologyEdit): number {
  return pending.draft ? OBJECT_SDF_DRAFT_TILE : OBJECT_SDF_TILE;
}

function toObjectGeometry(object: LaurusObject): ObjectGeometryInput {
  return {
    cx: object.cx,
    cy: object.cy,
    radius: object.radius,
    elevation: object.elevation,
    falloff: object.falloff,
    order: object.order,
    shape: cachedObjectShape(object.shape),
    fill: toObjectFill(object),
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
  play: (effectKey?: string, lightId?: number, objectId?: number) => Promise<void>;
  preparePlayback: (
    effectKey?: string,
    lightId?: number,
    objectId?: number,
  ) => Promise<(() => Promise<void>) | undefined>;
  stop: () => void;
  abortLightDragForToolChange: (newToolType: string) => void;
  setSelectedHighlighted: (active: boolean) => void;
  setHighlightSuppressed: (suppressed: boolean) => void;
  setSelectedLight: (lightId: number | undefined) => void;
  setSelectedObject: (objectId: number | undefined) => void;
  setPendingLight: (indices: Set<number>, lightId?: number) => void;
  clearPendingLight: () => void;
  syncLitIndices: (updated: LaurusMaskResult) => void;
  setPendingTopology: (edit: PendingTopologyEdit) => void;
  clearPendingTopology: () => void;
  retouchObjectMesh: () => void;
  setObjectReviewPreview: (indices: Set<number> | undefined, diffBase?: Set<number>) => void;
  syncObjects: (updated: LaurusMaskResult) => void;
  applyMaskAppearanceDefaults: (override?: MaskAppearanceOverride) => void;
  onLightSourcePreviewToggled: (enabled: boolean) => void;
}

export interface MaskAppearanceOverride {
  textureMix?: number;
  light?: { size: number; intensity: number; falloff: number; darkness: number };
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
  const { sendMaskLightUpdate } = useContext(SocketContext);
  const {
    notifyMaskSelectionChanged,
    notifyMaskSelectedLightChanged,
    notifyMaskSelectedObjectChanged,
    notifyMaskPendingLightSet,
    notifyMaskPendingLightCleared,
    notifyMaskLightUpdated,
    notifyMaskPendingTopologySet,
    notifyMaskObjectsUpdated,
    notifyMaskObjectReviewPreview,
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
  const lightSizeRef = useRef(DEFAULT_LIGHT_VALUE.size);
  const lightIntensityRef = useRef(DEFAULT_LIGHT_VALUE.intensity);
  const lightFalloffRef = useRef(DEFAULT_LIGHT_VALUE.falloff);
  const lightDarknessRef = useRef(DEFAULT_LIGHT_VALUE.darkness);
  const glowColorRef = useRef<[number, number, number]>([1, 1, 1]);
  const vertexCountRef = useRef(0);
  const vertexRangesRef = useRef<[number, number][]>([]);
  const backingVertexCountRef = useRef(0);
  const backingGreyRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastCurveCountRef = useRef(0);
  const lightSourceRef = useRef<{ x: number; y: number; radius: number; falloff: number; order: number }>({
    x: 0,
    y: 0,
    radius: 0,
    falloff: 0,
    order: MASK_ORDER_UNRANKED,
  });
  const wiredMoveRef = useRef(false);
  const playbackLightSourcesRef = useRef<Map<number, MaskLightSource>>(new Map());
  const playbackObjectsRef = useRef<
    Map<
      number,
      {
        cx: number;
        cy: number;
        elevation: number;
        radius: number;
        falloff: number;
        fill: LaurusObjectFill;
        rotation: ObjectRotation | undefined;
      }
    >
  >(new Map());
  const playingObjectIdsRef = useRef<Set<number>>(new Set());
  const activePlaybackRef = useRef<{ rafId: number | undefined; resolve: () => void } | undefined>(undefined);
  const lightDragRef = useRef<
    | {
        pointerId: number;
        lightId: number;
        startX: number;
        startY: number;
        originalRegion: LightDragRegion;
        originalIndices: Set<number>;
        rafId: number | undefined;
        latestX: number;
        latestY: number;
      }
    | undefined
  >(undefined);

  const lastKnownLightRef = useRef<Map<number, { indices: Set<number>; region: LightDragRegion }>>(new Map());
  const lightCommitInFlightRef = useRef<Set<number>>(new Set());
  const [isDraggingLight, setIsDraggingLight] = useState(false);
  const suppressNextClickRef = useRef(false);
  const objectsRef = useRef<LaurusObject[]>([]);
  const pendingTopologyRef = useRef<PendingTopologyEdit | undefined>(undefined);
  const objectReviewPreviewRef = useRef<Set<number> | undefined>(undefined);
  const objectReviewDiffBaseRef = useRef<Set<number> | undefined>(undefined);
  const maskEditSubjectRef = useRef<{ subject: "light" | "object"; id: number } | undefined>(undefined);
  const editingShapeRef = useRef(false);
  const pendingLightRef = useRef<Set<number> | undefined>(undefined);
  const pendingLightIdRef = useRef<number | undefined>(undefined);
  const selectedHighlightRef = useRef(false);
  const pickHoverRef = useRef(false);
  const highlightSuppressedRef = useRef(false);
  const lightsRef = useRef<Map<number, Set<number>>>(new Map());
  const lightsMetaRef = useRef<Map<number, LaurusLight>>(new Map());
  const pendingLightShapeRef = useRef<
    { lightId: number; cx: number; cy: number; radius: number; shape: string; draft: boolean } | undefined
  >(undefined);
  const renderRef = useRef<() => void>(() => {});
  const selectedLightIdRef = useRef<number | undefined>(undefined);
  const objectsMapRef = useRef<Map<number, Set<number>>>(new Map());
  const maskGeometryRef = useRef<MaskGeometry>({ corners: [], points: [], centroids: [] });
  const polygonsRef = useRef<LaurusPolygonPath[]>([]);
  const objectsMeshSignatureRef = useRef<string>("");
  const highlightScratchRef = useRef<Float32Array>(new Float32Array(0));
  const highlightUploadedRef = useRef<Float32Array>(new Float32Array(0));
  const fillOverlayScratchRef = useRef<Float32Array>(new Float32Array(0));
  const fillOverlayUploadedRef = useRef<Float32Array>(new Float32Array(0));
  const selectedObjectIdRef = useRef<number | undefined>(undefined);
  const lightIndicesAtOffset = useCallback(
    (drag: NonNullable<typeof lightDragRef.current>, dx: number, dy: number): Set<number> => {
      if (source.kind !== "static") return new Set();
      if (dx * dx + dy * dy <= LIGHT_DRAG_EPSILON_SQ) return drag.originalIndices;
      return indicesInObjectFromCentroids(maskGeometry(source.maskData).centroids, {
        ...drag.originalRegion,
        cx: drag.originalRegion.cx + dx,
        cy: drag.originalRegion.cy + dy,
      });
    },
    [source],
  );

  const recomputeLightDrag = useCallback(() => {
    const drag = lightDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const dx = drag.latestX - drag.startX;
    const dy = drag.latestY - drag.startY;
    const indices = lightIndicesAtOffset(drag, dx, dy);
    if (drag.originalRegion.shape) {
      pendingLightShapeRef.current = {
        lightId: drag.lightId,
        cx: drag.originalRegion.cx + dx,
        cy: drag.originalRegion.cy + dy,
        radius: drag.originalRegion.radius,
        shape: drag.originalRegion.shape,
        draft: false,
      };
    }
    dispatch({
      type: CoreActionType.SetPendingLight,
      value: { maskKey: mediaKey, lightId: drag.lightId, polygonIndices: [...indices] },
    });
    notifyMaskPendingLightSet(mediaKey, indices, drag.lightId);
  }, [lightIndicesAtOffset, mediaKey, dispatch, notifyMaskPendingLightSet]);

  const abortLightDrag = useCallback(() => {
    const drag = lightDragRef.current;
    if (!drag) return;
    if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
    canvasRef.current?.releasePointerCapture(drag.pointerId);
    lightDragRef.current = undefined;
    setIsDraggingLight(false);
    dispatch({ type: CoreActionType.SetPendingLight, value: undefined });
    notifyMaskPendingLightCleared(mediaKey);
  }, [dispatch, mediaKey, notifyMaskPendingLightCleared]);

  const resolveObjectUniforms = useCallback((): ObjectGeometryInput[] => {
    const pending = pendingTopologyRef.current;
    const pendingShape = pending ? cachedObjectShape(pending.shape, pendingTileSize(pending)) : undefined;
    const restingFill = (object: ObjectGeometryInput): ObjectGeometryInput =>
      object.fill ? { ...object, fill: { ...object.fill, a: 0 } } : object;
    const animating = playingObjectIdsRef.current;
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
          order: object.order,
          shape,
          fill: playing.fill,
          rotation: playing.rotation,
          lift: object.lift ? { cx: object.cx, cy: object.cy, radius: object.radius } : undefined,
        };
      }
      const geometry =
        pending && pending.objectId === object.id
          ? {
              cx: pending.cx,
              cy: pending.cy,
              radius: pending.radius,
              elevation: pending.elevation,
              falloff: pending.falloff,
              order: object.order,
              shape: pendingShape,
              fill: pending.fill,
            }
          : toObjectGeometry(object);
      return animating.has(object.id) ? geometry : restingFill(geometry);
    });
    if (pending && !objectsRef.current.some((object) => object.id === pending.objectId)) {
      const candidate: ObjectGeometryInput = {
        cx: pending.cx,
        cy: pending.cy,
        radius: pending.radius,
        elevation: pending.elevation,
        falloff: pending.falloff,
        order: frontElementOrder([...objectsRef.current, ...lightsMetaRef.current.values()]),
        shape: pendingShape,
        fill: pending.fill,
      };
      objects.push(animating.has(pending.objectId) ? candidate : restingFill(candidate));
    }
    return objects;
  }, []);

  const isSelected = source.kind === "static" && selectedMaskKeys.has(mediaKey);
  const canvasSize =
    source.kind === "static"
      ? { width: source.maskData.width, height: source.maskData.height }
      : { width: source.sourceImg.width, height: source.sourceImg.height };

  const resolveTargetLightId = useCallback((): number | undefined => {
    if (selectedLightIdRef.current !== undefined) return selectedLightIdRef.current;
    return lightsRef.current.keys().next().value;
  }, []);

  const resolveLightSilhouette = useCallback((lightId: number): (LightDragRegion & { draft: boolean }) | undefined => {
    const drafted = pendingLightShapeRef.current?.lightId === lightId ? pendingLightShapeRef.current : undefined;
    if (drafted) return drafted;
    const meta = lightsMetaRef.current.get(lightId);
    return meta && meta.radius > 0 ? { ...meta, draft: false } : undefined;
  }, []);

  const computeLightSourceRestPosition = useCallback(
    (lightIdOverride?: number) => {
      if (source.kind !== "static") return undefined;
      const targetLightId = lightIdOverride ?? resolveTargetLightId();
      const shaped = targetLightId !== undefined ? resolveLightSilhouette(targetLightId) : undefined;
      if (shaped) return { x: shaped.cx, y: shaped.cy };
      const indices =
        pendingLightRef.current ??
        (targetLightId !== undefined ? lightsRef.current.get(targetLightId) : undefined) ??
        lightsRef.current.values().next().value;
      if (!indices) return undefined;
      return centerOfIndices(maskGeometry(source.maskData).points, indices);
    },
    [source, resolveTargetLightId, resolveLightSilhouette],
  );

  const lightGridlinesMix = useCallback(
    (lightId: number): number => {
      const gridlines = latestRef.current.uiState.lightGridlines;
      return gridlines && gridlines.key === mediaKey && gridlines.lightId === lightId ? gridlines.value : 0;
    },
    [mediaKey],
  );

  const lightLowpoly = useCallback(
    (lightId: number, stored: boolean): boolean => {
      const edit = latestRef.current.uiState.maskEdit;
      if (edit?.subject !== "light" || edit.maskKey !== mediaKey || edit.light.id !== lightId) return stored;
      return edit.lowpoly;
    },
    [mediaKey],
  );

  const resolveRestingLightSources = useCallback((): MaskLightSource[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const centroids = maskGeometryRef.current.centroids;
    const lights: MaskLightSource[] = [];
    lightsRef.current.forEach((indices, lightId) => {
      if (playbackLightSourcesRef.current.has(lightId)) return;
      const meta = lightsMetaRef.current.get(lightId);
      if (!meta) return;

      const shaped = resolveLightSilhouette(lightId);
      const appearance = {
        falloff: meta.falloff,
        intensity: meta.intensity,
        darkness: meta.darkness,
        order: meta.order,
        gridlines: lightGridlinesMix(lightId),
        lowpoly: lightLowpoly(lightId, meta.lowpoly),
      };

      if (shaped) {
        lights.push({
          x: shaped.cx,
          y: canvas.height - shaped.cy,
          radius: shaped.radius,
          shape: cachedObjectShape(shaped.shape, shaped.draft ? OBJECT_SDF_DRAFT_TILE : OBJECT_SDF_TILE),
          ...appearance,
        });
        return;
      }

      const pending = pendingLightIdRef.current === lightId ? pendingLightRef.current : undefined;
      const center = lightCenterFromCentroids(centroids, pending ?? indices);
      if (!center) return;
      lights.push({
        x: center[0],
        y: canvas.height - center[1],
        radius: meta.size / 2,
        ...appearance,
      });
    });
    return lights;
  }, [resolveLightSilhouette, lightGridlinesMix, lightLowpoly]);

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
  const canvasZoom = useCanvasZoomValue();
  const bufferScaleRef = useRef({ x: 1, y: 1 });
  bufferScaleRef.current = {
    x: containerSize.width > 0 ? canvasSize.width / containerSize.width : 1,
    y: containerSize.height > 0 ? canvasSize.height / containerSize.height : 1,
  };
  const dndCss = {
    left: dndPosition.x,
    top: dndPosition.y,
    transform: CSS.Translate.toString(toCanvasTranslate(dndTransform, canvasZoom)),
    touchAction: "none",
  };

  const toolCursor = useToolCursor({
    target: source.kind === "static" ? "mask" : undefined,
    dragDisabled,
    isDragging: isDragging || isDraggingLight,
  });
  const sessionHere = source.kind === "static" && uiState.maskEdit?.maskKey === mediaKey ? uiState.maskEdit : undefined;
  const isPickingTriangles = sessionHere !== undefined && !isMaskEditLocked(sessionHere) && !sessionHere.editingShape;
  const cursor = isPickingTriangles ? "crosshair" : toolCursor;

  const lightRegion = useCallback((light: LaurusLight, indices: Set<number>): EditableRegion => {
    if (light.radius > 0) return light;
    const center = lightCenterFromCentroids(maskGeometryRef.current.centroids, indices);
    return {
      ...light,
      cx: center?.[0] ?? light.cx,
      cy: center?.[1] ?? light.cy,
      radius: light.size / 2,
      shape: unitCirclePath(),
    };
  }, []);

  const reviewShape = useMemo(() => {
    const session = uiState.maskEdit;
    if (source.kind !== "static" || session?.maskKey !== mediaKey) return undefined;

    const maskData = coreState.canvasMasks.get(mediaKey);

    const resolved: { opened: EditableRegion; stored: EditableRegion | undefined } | undefined = (() => {
      if (session.subject === "light") {
        const held = maskData?.lights.find((l) => l.id === session.light.id);
        return {
          opened: lightRegion(session.light, session.currentIndices),
          stored: held && lightRegion(held, session.currentIndices),
        };
      }
      const candidate = session.candidates[session.currentIndex]?.object;
      if (!candidate) return undefined;
      return { opened: candidate, stored: maskData?.objects.find((o) => o.id === candidate.id) };
    })();
    if (!resolved) return undefined;
    const { opened, stored } = resolved;
    const base = stored ?? opened;

    const from = session.editedShape ?? base;
    const current = {
      id: opened.id,
      cx: from.cx,
      cy: from.cy,
      radius: from.radius,
      shape: session.editedShape?.path ?? base.shape,
      origin: session.editedShape ? "edited" : stored ? "stored" : "detected",
    };
    const changed =
      current.shape !== opened.shape ||
      current.cx !== opened.cx ||
      current.cy !== opened.cy ||
      current.radius !== opened.radius;
    return {
      current,
      original: changed ? { cx: opened.cx, cy: opened.cy, radius: opened.radius, shape: opened.shape } : undefined,
    };
  }, [uiState.maskEdit, source.kind, mediaKey, coreState.canvasMasks, lightRegion]);

  const shapeEditorObject = uiState.maskEdit?.editingShape ? reviewShape : undefined;

  const previewShapeEdit = useCallback(
    (edit: ShapeEdit, draft = true) => {
      const session = uiState.maskEdit;
      if (!session) return;

      if (session.subject === "light") {
        pendingLightShapeRef.current = {
          lightId: session.light.id,
          cx: edit.cx,
          cy: edit.cy,
          radius: edit.radius,
          shape: edit.path,
          draft,
        };
        renderRef.current();
        return;
      }

      const candidate = session.candidates[session.currentIndex]?.object;
      if (!candidate) return;
      const stored = coreState.canvasMasks.get(mediaKey)?.objects.find((o) => o.id === candidate.id);
      const appearance = stored ?? candidate;
      const pending: PendingTopologyEdit = {
        maskKey: mediaKey,
        objectId: candidate.id,
        cx: edit.cx,
        cy: edit.cy,
        radius: edit.radius,
        elevation: appearance.elevation,
        falloff: appearance.falloff,
        shape: edit.path,
        fill: toObjectFill(appearance),
        polygonIndices: dropIndicesClaimedByObjects(
          indicesInObjectFromCentroids(
            maskGeometryRef.current.centroids,
            { cx: edit.cx, cy: edit.cy, radius: edit.radius, shape: edit.path },
            draft ? OBJECT_SDF_DRAFT_TILE : OBJECT_SDF_TILE,
          ),
          maskGeometryRef.current,
          polygonsRef.current,
          { objectId: candidate.id },
        ),
        draft,
      };

      if (!draft) dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: pending });
      notifyMaskPendingTopologySet(mediaKey, pending);
    },
    [uiState.maskEdit, mediaKey, coreState.canvasMasks, dispatch, notifyMaskPendingTopologySet],
  );

  const snapIndicesToShape = useCallback(
    (region: { cx: number; cy: number; radius: number; shape: string }) => {
      const review = uiState.maskEdit;
      if (!review || review.maskKey !== mediaKey || isMaskEditLocked(review)) return;
      const indices = withoutNeighbouringObjects(
        indicesInObjectFromCentroids(maskGeometryRef.current.centroids, region),
        review,
        maskGeometryRef.current,
        polygonsRef.current,
      );
      uiDispatch({ type: UIActionType.SetMaskEditIndices, indices });
      notifyMaskObjectReviewPreview(mediaKey, indices, objectReviewDiffBaseRef.current);
    },
    [uiState.maskEdit, mediaKey, uiDispatch, notifyMaskObjectReviewPreview],
  );

  const commitShapeEdit = useCallback(
    (edit: ShapeEdit) => {
      previewShapeEdit(edit, false);
      uiDispatch({ type: UIActionType.SetMaskEditShape, shape: edit });
      snapIndicesToShape({ cx: edit.cx, cy: edit.cy, radius: edit.radius, shape: edit.path });
    },
    [previewShapeEdit, uiDispatch, snapIndicesToShape],
  );

  const retouchObjectMesh = useCallback(() => {
    const session = uiState.maskEdit;
    if (source.kind !== "static" || session?.maskKey !== mediaKey || isMaskEditLocked(session)) return;

    const from = reviewShape?.current;
    if (!from) return;
    const outline = shapeOutline(from.shape, from);
    const maskData = coreState.canvasMasks.get(mediaKey);
    if (!outline || !maskData) return;

    const geometry = maskGeometry(maskData);
    const result = retouchMesh(maskData.polygons, geometry.points, outline);
    if (result.added === 0) return;

    const patched = { ...maskData, polygons: result.polygons };
    const indices = withoutNeighbouringObjects(result.indices, session, maskGeometry(patched), result.polygons);
    dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: patched });
    uiDispatch({
      type: UIActionType.SetMaskEditRetouch,
      retouch: { polygons: result.polygons, restore: maskData.polygons, added: result.added },
    });
    uiDispatch({ type: UIActionType.SetMaskEditIndices, indices });
    notifyMaskObjectsUpdated(mediaKey, patched);
    notifyMaskObjectReviewPreview(mediaKey, indices, objectReviewDiffBaseRef.current);

    const pending = coreState.pendingTopologyEdit;
    if (pending?.maskKey === mediaKey) {
      const next = { ...pending, polygonIndices: indices };
      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: next });
      notifyMaskPendingTopologySet(mediaKey, next);
    }
  }, [
    uiState.maskEdit,
    reviewShape,
    source.kind,
    mediaKey,
    coreState.canvasMasks,
    coreState.pendingTopologyEdit,
    dispatch,
    uiDispatch,
    notifyMaskObjectsUpdated,
    notifyMaskObjectReviewPreview,
    notifyMaskPendingTopologySet,
  ]);

  const render = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;

    const lightSources: MaskLightSource[] = [
      ...(wiredMoveRef.current
        ? Array.from(playbackLightSourcesRef.current.entries()).map(([lightId, light]) => ({
            ...light,
            gridlines: lightGridlinesMix(lightId),
            lowpoly: lightLowpoly(lightId, light.lowpoly ?? false),
          }))
        : [
            {
              ...lightSourceRef.current,
              intensity: lightIntensityRef.current,
              darkness: lightDarknessRef.current,
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
      backingVertexCount: backingVertexCountRef.current,
      backingGrey: backingGreyRef.current,
    });
  }, [resolveObjectUniforms, resolveRestingLightSources, lightGridlinesMix, lightLowpoly]);
  renderRef.current = render;

  const recolorHighlight = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;
    const vertexCount = vertexCountRef.current;
    if (vertexCount === 0) return;
    const latestSource = latestRef.current.source;
    if (latestSource.kind !== "static") return;
    const { gl } = state;

    const length = vertexCount * 4;
    const resized = highlightScratchRef.current.length !== length;
    if (resized) {
      highlightScratchRef.current = new Float32Array(length);
      highlightUploadedRef.current = new Float32Array(length);
      fillOverlayScratchRef.current = new Float32Array(length);
      fillOverlayUploadedRef.current = new Float32Array(length);
    }
    const highlights = highlightScratchRef.current;
    highlights.fill(0);
    const fillOverlay = fillOverlayScratchRef.current;
    fillOverlay.fill(0);
    const suppressed = highlightSuppressedRef.current;
    const vertexRanges = vertexRangesRef.current;
    const paintInto = (
      target: Float32Array,
      indices: Set<number>,
      color: readonly [number, number, number, number],
    ) => {
      indices.forEach((polygonIndex) => {
        const range = vertexRanges[polygonIndex];
        if (!range) return;
        const [startVertex, count] = range;
        for (let v = 0; v < count; v++) {
          const vertex = startVertex + v;
          if (vertex >= vertexCount) continue;
          target.set(color, vertex * 4);
        }
      });
    };
    const paint = (indices: Set<number>, color: readonly [number, number, number, number]) =>
      paintInto(highlights, indices, color);

    const pendingLight = pendingLightRef.current;
    const maskEditSubject = maskEditSubjectRef.current;
    const editingLightId =
      (pendingLight ? (pendingLightIdRef.current ?? selectedLightIdRef.current) : undefined) ??
      (maskEditSubject?.subject === "light" ? maskEditSubject.id : undefined);
    if ((selectedHighlightRef.current || pickHoverRef.current) && !suppressed) {
      const activeLightId = selectedLightIdRef.current;
      lightsRef.current.forEach((indices, lightId) => {
        if (lightId === editingLightId) return;
        paint(indices, lightId === activeLightId ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
      });
    }
    if (pendingLight && pendingLight.size > 0 && !suppressed) {
      paint(pendingLight, HIGHLIGHT_MOVING_COLOR);
    }

    const pendingTopology = pendingTopologyRef.current;
    if ((selectedHighlightRef.current || pickHoverRef.current) && !suppressed) {
      const activeObjectId = selectedObjectIdRef.current;
      objectsMapRef.current.forEach((indices, objectId) => {
        if (objectId === pendingTopology?.objectId) return;
        if (maskEditSubject?.subject === "object" && objectId === maskEditSubject.id) return;
        paint(indices, objectId === activeObjectId ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
      });
    }
    if (pendingTopology && !suppressed) {
      paint(
        pendingTopology.polygonIndices ??
          indicesInObjectFromCentroids(maskGeometryRef.current.centroids, pendingTopology),
        HIGHLIGHT_MOVING_COLOR,
      );
    }

    const objectReviewPreview = objectReviewPreviewRef.current;
    const objectReviewDiffBase = objectReviewDiffBaseRef.current;
    if (objectReviewDiffBase && !editingShapeRef.current && !suppressed) {
      const unchanged = new Set<number>();
      const edited = new Set<number>();
      objectReviewPreview?.forEach((index) => {
        if (objectReviewDiffBase.has(index)) unchanged.add(index);
        else edited.add(index);
      });
      objectReviewDiffBase.forEach((index) => {
        if (!objectReviewPreview?.has(index)) edited.add(index);
      });
      paint(unchanged, HIGHLIGHT_SELECTED_COLOR);
      paint(edited, highlightObjectReviewAddedColor(latestRef.current.uiState.gridlinesBright));
    } else if (objectReviewPreview?.size && !suppressed) {
      paint(
        objectReviewPreview,
        editingShapeRef.current
          ? highlightShapeEditColor(latestRef.current.uiState.gridlinesBright)
          : HIGHLIGHT_SELECTED_COLOR,
      );
    }

    const animatingObjects = playingObjectIdsRef.current;
    const pendingObjectIndices = () =>
      pendingTopology &&
      (pendingTopology.polygonIndices ??
        indicesInObjectFromCentroids(maskGeometryRef.current.centroids, pendingTopology));
    const objectFills = objectsRef.current.map((object) => ({
      id: object.id,
      fill: toObjectFill(object),
      behind: isBehindMask(object),
      indices:
        maskEditSubject?.subject === "object" && maskEditSubject.id === object.id
          ? pendingTopology?.objectId === object.id && pendingTopology.draft
            ? pendingObjectIndices()
            : objectReviewPreview
          : pendingTopology?.objectId === object.id
            ? pendingObjectIndices()
            : objectsMapRef.current.get(object.id),
    }));
    if (pendingTopology && !objectsRef.current.some((object) => object.id === pendingTopology.objectId)) {
      objectFills.push({
        id: pendingTopology.objectId,
        fill: pendingTopology.fill,
        behind: false,
        indices: pendingObjectIndices(),
      });
    }
    objectFills.forEach(({ id, fill, indices, behind }) => {
      if (animatingObjects.has(id)) return;
      if (behind) return;
      if (suppressed && maskEditSubject?.subject === "object" && maskEditSubject.id === id) return;
      if (!indices || fill.a <= 0) return;
      paintInto(fillOverlay, indices, [fill.r, fill.g, fill.b, fill.a]);
    });

    const syncBuffer = (buffer: WebGLBuffer, data: Float32Array, uploaded: Float32Array) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      if (resized) {
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        uploaded.set(data);
        return;
      }
      let first = -1;
      let last = -1;
      for (let i = 0; i < length; i++) {
        if (data[i] === uploaded[i]) continue;
        if (first < 0) first = i;
        last = i;
      }
      if (first < 0) return;
      const start = first - (first % 4);
      const end = last + (4 - (last % 4));
      uploaded.set(data.subarray(start, end), start);
      gl.bufferSubData(gl.ARRAY_BUFFER, start * Float32Array.BYTES_PER_ELEMENT, data.subarray(start, end));
    };
    syncBuffer(state.highlightBuffer, highlights, highlightUploadedRef.current);
    syncBuffer(state.fillOverlayBuffer, fillOverlay, fillOverlayUploadedRef.current);
    render();
  }, [render]);

  const recolorFrameRef = useRef<number | undefined>(undefined);
  const scheduleRecolorHighlight = useCallback(() => {
    if (recolorFrameRef.current !== undefined) return;
    recolorFrameRef.current = requestAnimationFrame(() => {
      recolorFrameRef.current = undefined;
      recolorHighlight();
    });
  }, [recolorHighlight]);
  const cancelScheduledRecolorHighlight = useCallback(() => {
    if (recolorFrameRef.current === undefined) return;
    cancelAnimationFrame(recolorFrameRef.current);
    recolorFrameRef.current = undefined;
  }, []);

  const applyDefaultLightValue = useCallback(() => {
    if (source.kind !== "static") return;
    const maskMeta = coreState.project.masks.get(mediaKey);
    lightSizeRef.current = maskMeta?.light_preview_size ?? DEFAULT_LIGHT_VALUE.size;
    lightIntensityRef.current = maskMeta?.light_preview_intensity ?? DEFAULT_LIGHT_VALUE.intensity;
    lightFalloffRef.current = maskMeta?.light_preview_falloff ?? DEFAULT_LIGHT_VALUE.falloff;
    lightDarknessRef.current = maskMeta?.light_preview_darkness ?? DEFAULT_LIGHT_VALUE.darkness;
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
    const wasAnimating = playingObjectIdsRef.current.size > 0;
    playingObjectIdsRef.current = new Set();
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0, order: MASK_ORDER_UNRANKED };
    applyDefaultLightValue();
    render();
    if (wasAnimating) recolorHighlight();
  }, [render, recolorHighlight, applyDefaultLightValue]);

  const preparePlayback = useCallback(
    (effectKey?: string, lightId?: number, objectId?: number): Promise<(() => Promise<void>) | undefined> => {
      stopLightSourceAnimation();
      if (source.kind !== "static") return Promise.resolve(undefined);
      const playAll = effectKey === undefined && lightId === undefined && objectId === undefined;
      const candidateLightIds = playAll
        ? Array.from(lightsRef.current.keys())
        : objectId !== undefined
          ? []
          : [lightId ?? resolveTargetLightId()].filter((id): id is number => id !== undefined);

      const targets = candidateLightIds
        .map((id) => {
          const inputId = maskLightInputId(mediaKey, id);
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
          const wiredSkew = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "skew" }> =>
              effect.type === "skew" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          return { lightId: id, inputId, wiredMove, wiredLightSource, wiredScale, wiredSkew };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale || t.wiredSkew)
        .map((t) => ({ ...t, restPosition: computeLightSourceRestPosition(t.lightId) }));

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
          const wiredRotate = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "rotate" }> =>
              effect.type === "rotate" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          const wiredSkew = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "skew" }> =>
              effect.type === "skew" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          return { objectId: id, inputId, wiredMove, wiredLightSource, wiredScale, wiredRotate, wiredSkew };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale || t.wiredRotate || t.wiredSkew);

      if (targets.length === 0 && objectTargets.length === 0) return Promise.resolve(undefined);

      wiredMoveRef.current = targets.length > 0;

      const mergedFramesByLight = new Map<number, LaurusFrame[]>();
      const moveFramesByLight = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByLight = new Map<number, LaurusFrame[]>();
      const scaleFramesByLight = new Map<number, LaurusFrame[]>();
      const mergedFramesByObject = new Map<number, LaurusFrame[]>();
      const moveFramesByObject = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByObject = new Map<number, LaurusFrame[]>();
      const scaleFramesByObject = new Map<number, LaurusFrame[]>();
      const rotateFramesByObject = new Map<number, LaurusFrame[]>();
      const skewFramesByObject = new Map<number, LaurusFrame[]>();
      const skewFramesByLight = new Map<number, LaurusFrame[]>();
      const session: { rafId: number | undefined; resolve: () => void } = { rafId: undefined, resolve: () => {} };
      activePlaybackRef.current = session;
      if (objectTargets.length > 0) {
        playingObjectIdsRef.current = new Set(objectTargets.map((t) => t.objectId));
        recolorHighlight();
      }

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
              mergedFramesByLight.set(t.lightId, result ?? []);
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
            ...Array.from(mergedFramesByLight.values()).map((f) => f.length),
            ...Array.from(mergedFramesByObject.values()).map((f) => f.length),
          );
          durationSeconds = totalFrames / fps;
        });
      } else if (targets.length === 0) {
        const objectTarget = objectTargets[0];
        const timingValue = (objectTarget.wiredMove ??
          objectTarget.wiredLightSource ??
          objectTarget.wiredScale ??
          objectTarget.wiredRotate ??
          objectTarget.wiredSkew)!.value;
        fps = projectFps;
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
        if (objectTarget.wiredRotate) {
          const wiredRotate = objectTarget.wiredRotate;
          objectFetches.push(
            fetchFramesCached(objectTarget.inputId, `rotate:${objectTarget.inputId}`, () =>
              getRotateFrames(coreState.apiOrigin, wiredRotate.key, objectTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                rotateFramesByObject.set(objectTarget.objectId, result);
            }),
          );
        }
        if (objectTarget.wiredSkew) {
          const wiredSkew = objectTarget.wiredSkew;
          objectFetches.push(
            fetchFramesCached(objectTarget.inputId, `skew:${objectTarget.inputId}`, () =>
              getSkewFrames(coreState.apiOrigin, wiredSkew.key, objectTarget.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result)
                skewFramesByObject.set(objectTarget.objectId, result);
            }),
          );
        }
        ready = Promise.all(objectFetches).then(() => {});
      } else {
        const target = targets[0];
        const timingValue = (target.wiredMove ?? target.wiredLightSource ?? target.wiredScale ?? target.wiredSkew)!
          .value;
        fps = projectFps;
        totalFrames = Math.max(Math.round((timingValue.end - timingValue.start) * fps), 1);
        durationSeconds = totalFrames / fps;
        const fetches: Promise<void>[] = [];
        if (target.wiredMove) {
          const wiredMove = target.wiredMove;
          fetches.push(
            fetchFramesCached(target.inputId, `move:${target.inputId}`, () =>
              getMoveFrames(coreState.apiOrigin, wiredMove.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) moveFramesByLight.set(target.lightId, result);
            }),
          );
        }
        if (target.wiredLightSource) {
          const wiredLightSource = target.wiredLightSource;
          fetches.push(
            fetchFramesCached(target.inputId, `light_source:${target.inputId}`, () =>
              getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) lightSourceFramesByLight.set(target.lightId, result);
            }),
          );
        }
        if (target.wiredScale) {
          const wiredScale = target.wiredScale;
          fetches.push(
            fetchFramesCached(target.inputId, `scale:${target.inputId}`, () =>
              getScaleFrames(coreState.apiOrigin, wiredScale.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) scaleFramesByLight.set(target.lightId, result);
            }),
          );
        }
        if (target.wiredSkew) {
          const wiredSkew = target.wiredSkew;
          fetches.push(
            fetchFramesCached(target.inputId, `skew:${target.inputId}`, () =>
              getSkewFrames(coreState.apiOrigin, wiredSkew.key, target.inputId),
            ).then((result) => {
              if (activePlaybackRef.current === session && result) skewFramesByLight.set(target.lightId, result);
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
            let lastFrameIndex = -1;

            const loop = () => {
              if (activePlaybackRef.current !== session) return;

              const elapsedSeconds = (performance.now() - loopStartMs) / 1000;
              const frameIndex = Math.min(Math.floor(elapsedSeconds * fps), totalFrames - 1);

              if (frameIndex === lastFrameIndex) {
                if (elapsedSeconds < durationSeconds) {
                  session.rafId = requestAnimationFrame(loop);
                } else {
                  stopLightSourceAnimation();
                }
                return;
              }
              lastFrameIndex = frameIndex;

              const canvas = canvasRef.current;
              if (canvas) {
                const { x: scaleX, y: scaleY } = bufferScaleRef.current;

                targets.forEach((t) => {
                  const mergedFrames = mergedFramesByLight.get(t.lightId);
                  const moveFrames = moveFramesByLight.get(t.lightId);
                  const lightSourceFrames = lightSourceFramesByLight.get(t.lightId);
                  const scaleFrames = scaleFramesByLight.get(t.lightId);
                  const skewFrames = skewFramesByLight.get(t.lightId);

                  const movePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : moveFrames && moveFrames.length > 0
                      ? moveFrames[Math.min(frameIndex, moveFrames.length - 1)]
                      : undefined;
                  const lightPoint = playAll
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
                  const skewPoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : skewFrames && skewFrames.length > 0
                      ? skewFrames[Math.min(frameIndex, skewFrames.length - 1)]
                      : undefined;
                  const restX = t.restPosition?.x ?? canvas.width / 2;
                  const restY = t.restPosition?.y ?? canvas.height / 2;
                  const pointX = movePoint?.x ?? 0;
                  const pointY = movePoint?.y ?? 0;
                  const bufferX = restX + pointX * scaleX;
                  const bufferY = restY + pointY * scaleY;
                  const lightMeta = source.maskData.lights.find((c) => c.id === t.lightId);
                  const size = lightMeta?.size ?? lightSizeRef.current;
                  const intensity = lightPoint?.light_intensity ?? lightMeta?.intensity ?? lightIntensityRef.current;
                  const falloff = lightPoint?.light_falloff ?? lightMeta?.falloff ?? lightFalloffRef.current;
                  const darkness = lightPoint?.light_darkness ?? lightMeta?.darkness ?? lightDarknessRef.current;
                  const scaleMultiplier = scalePoint?.sx ?? 1;

                  const shapedMeta = resolveLightSilhouette(t.lightId);
                  playbackLightSourcesRef.current.set(t.lightId, {
                    order: lightMeta?.order ?? MASK_ORDER_UNRANKED,
                    lowpoly: lightMeta?.lowpoly ?? false,
                    x: bufferX,
                    y: canvas.height - bufferY,
                    radius: (shapedMeta ? shapedMeta.radius : size / 2) * scaleMultiplier,
                    shape: shapedMeta ? cachedObjectShape(shapedMeta.shape) : undefined,
                    falloff,
                    intensity,
                    darkness,
                    transform: skewPoint
                      ? objectTransform(undefined, { ax: skewPoint.ax, ay: skewPoint.ay })
                      : undefined,
                  });
                });

                objectTargets.forEach((t) => {
                  const object = objectsRef.current.find((p) => p.id === t.objectId);
                  if (!object) return;
                  const mergedFrames = mergedFramesByObject.get(t.objectId);
                  const moveFrames = moveFramesByObject.get(t.objectId);
                  const lightSourceFrames = lightSourceFramesByObject.get(t.objectId);
                  const scaleFrames = scaleFramesByObject.get(t.objectId);
                  const rotateFrames = rotateFramesByObject.get(t.objectId);
                  const skewFrames = skewFramesByObject.get(t.objectId);

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
                  const rotatePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : rotateFrames && rotateFrames.length > 0
                      ? rotateFrames[Math.min(frameIndex, rotateFrames.length - 1)]
                      : undefined;
                  const skewPoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : skewFrames && skewFrames.length > 0
                      ? skewFrames[Math.min(frameIndex, skewFrames.length - 1)]
                      : undefined;
                  const cx = object.cx + (movePoint?.x ?? 0) * scaleX;
                  const cy = object.cy + (movePoint?.y ?? 0) * scaleY;
                  const elevation = lightSourcePoint?.object_elevation ?? object.elevation;
                  const radius = object.radius;
                  const falloff = lightSourcePoint?.object_falloff ?? object.falloff;
                  const fill = lightSourcePoint ? toEquationObjectFill(lightSourcePoint) : toObjectFill(object);
                  const scaleMultiplier = scalePoint?.sx ?? 1;

                  playbackObjectsRef.current.set(t.objectId, {
                    cx,
                    cy,
                    elevation,
                    radius: radius * scaleMultiplier,
                    falloff,
                    fill,
                    rotation: objectTransform(
                      rotatePoint
                        ? {
                            x: rotatePoint.rx,
                            y: rotatePoint.ry,
                            z: rotatePoint.rz,
                            angleDegrees: rotatePoint.rangle,
                          }
                        : undefined,
                      skewPoint ? { ax: skewPoint.ax, ay: skewPoint.ay } : undefined,
                    ),
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
      resolveTargetLightId,
      computeLightSourceRestPosition,
      resolveLightSilhouette,
      coreState.effects,
      coreState.apiOrigin,
      coreState.project.fps,
      coreState.project.project_id,
      coreState.inputsToRender,
      framesCacheRef,
      render,
      recolorHighlight,
      stopLightSourceAnimation,
    ],
  );

  const playLightSourceAnimation = useCallback(
    (effectKey?: string, lightId?: number, objectId?: number): Promise<void> =>
      preparePlayback(effectKey, lightId, objectId).then((start) => start?.()),
    [preparePlayback],
  );

  const latestRef = useRef({
    source,
    coreState,
    uiState,
    applyDefaultLightValue,
    playLightSourceAnimation,
    preparePlayback,
    stopLightSourceAnimation,
    retouchObjectMesh,
  });
  latestRef.current = {
    source,
    coreState,
    uiState,
    applyDefaultLightValue,
    playLightSourceAnimation,
    preparePlayback,
    stopLightSourceAnimation,
    retouchObjectMesh,
  };

  useEffect(() => {
    const next = maskEditSubjectFor(uiState.maskEdit, mediaKey);
    const previous = maskEditSubjectRef.current;
    const editingShapeNext =
      uiState.maskEdit?.maskKey === mediaKey && uiState.maskEdit.subject === "object" && uiState.maskEdit.editingShape;
    if (
      next?.subject === previous?.subject &&
      next?.id === previous?.id &&
      editingShapeRef.current === editingShapeNext
    ) {
      return;
    }
    maskEditSubjectRef.current = next;
    editingShapeRef.current = editingShapeNext;
    recolorHighlight();
  }, [uiState.maskEdit, mediaKey, recolorHighlight]);

  useEffect(() => {
    recolorHighlight();
  }, [uiState.gridlinesBright, recolorHighlight]);

  useEffect(() => {
    render();
  }, [uiState.lightGridlines, render]);

  const editedLightLowpoly = uiState.maskEdit?.subject === "light" ? uiState.maskEdit.lowpoly : undefined;
  useEffect(() => {
    render();
  }, [editedLightLowpoly, render]);

  const pickHover = source.kind === "static" && isHovered && isAwaitingRegionPick(uiState);
  useEffect(() => {
    if (pickHoverRef.current === pickHover) return;
    pickHoverRef.current = pickHover;
    recolorHighlight();
  }, [pickHover, recolorHighlight]);

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
        highlightScratchRef.current = new Float32Array(0);
        highlightUploadedRef.current = new Float32Array(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, state.fillOverlayBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertexCount * 4), gl.STATIC_DRAW);
        fillOverlayScratchRef.current = new Float32Array(0);
        fillOverlayUploadedRef.current = new Float32Array(0);

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

        lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0, order: MASK_ORDER_UNRANKED };
        const pendingLight = coreState.pendingLight?.maskKey === mediaKey ? coreState.pendingLight : undefined;
        pendingLightRef.current = pendingLight ? new Set(pendingLight.polygonIndices) : undefined;
        pendingLightIdRef.current = pendingLight?.lightId;
        selectedHighlightRef.current = uiState.selectedElement?.key === mediaKey;
        selectedLightIdRef.current =
          selectedHighlightRef.current && uiState.selectedElement?.type === "light"
            ? uiState.selectedElement.lightId
            : undefined;
        selectedObjectIdRef.current =
          selectedHighlightRef.current && uiState.selectedElement?.type === "object"
            ? uiState.selectedElement.objectId
            : undefined;
        lightsRef.current = buildLightsMap(maskData.polygons);
        lightsMetaRef.current = buildLightsMetaMap(maskData.lights);
        objectsRef.current = maskData.objects;
        objectsMapRef.current = buildObjectsMap(maskData.polygons);
        maskGeometryRef.current = maskGeometry(maskData);
        polygonsRef.current = maskData.polygons;
        pendingTopologyRef.current =
          coreState.pendingTopologyEdit?.maskKey === mediaKey ? coreState.pendingTopologyEdit : undefined;
        const sessionHere = uiState.maskEdit?.maskKey === mediaKey ? uiState.maskEdit : undefined;
        objectReviewPreviewRef.current = sessionHere?.currentIndices;
        objectReviewDiffBaseRef.current =
          sessionHere?.subject === "object" && isMaskEditLocked(sessionHere)
            ? new Set(sessionHere.candidates[sessionHere.currentIndex].polygon_indices)
            : undefined;
        maskEditSubjectRef.current = maskEditSubjectFor(uiState.maskEdit, mediaKey);

        const applyMaskAppearanceDefaults = (override?: MaskAppearanceOverride) => {
          const latest = latestRef.current;
          if (latest.source.kind !== "static") return;
          textureMixRef.current =
            override?.textureMix ?? latest.coreState.project.masks.get(mediaKey)?.texture ?? TEXTURE_MIX_DEFAULT;
          if (override?.light) {
            lightSizeRef.current = override.light.size;
            lightIntensityRef.current = override.light.intensity;
            lightFalloffRef.current = override.light.falloff;
            lightDarknessRef.current = override.light.darkness;
          } else {
            latest.applyDefaultLightValue();
          }
          render();
        };
        applyMaskAppearanceDefaults();
        render();
        recolorHighlight();

        const handle: MaskImperativeHandle = {
          play: (effectKey, lightId, objectId) =>
            latestRef.current.playLightSourceAnimation(effectKey, lightId, objectId),
          preparePlayback: (effectKey, lightId, objectId) =>
            latestRef.current.preparePlayback(effectKey, lightId, objectId),
          stop: () => latestRef.current.stopLightSourceAnimation(),
          abortLightDragForToolChange: (newToolType) => {
            if (newToolType === "move") return;
            if (lightDragRef.current) abortLightDrag();
          },
          setHighlightSuppressed: (suppressed) => {
            if (highlightSuppressedRef.current === suppressed) return;
            highlightSuppressedRef.current = suppressed;
            recolorHighlight();
          },
          setSelectedHighlighted: (active) => {
            selectedHighlightRef.current = active;
            if (!active) {
              selectedLightIdRef.current = undefined;
              selectedObjectIdRef.current = undefined;
            }
            recolorHighlight();
          },
          setSelectedLight: (lightId) => {
            selectedLightIdRef.current = lightId;
            recolorHighlight();
          },
          setSelectedObject: (objectId) => {
            selectedObjectIdRef.current = objectId;
            recolorHighlight();
          },
          setPendingLight: (indices, lightId) => {
            pendingLightIdRef.current = lightId;
            pendingLightRef.current = indices;
            recolorHighlight();
          },
          clearPendingLight: () => {
            pendingLightIdRef.current = undefined;
            pendingLightRef.current = undefined;
            pendingLightShapeRef.current = undefined;
            recolorHighlight();
          },
          syncLitIndices: (updated) => {
            const latestSource = latestRef.current.source;
            if (latestSource.kind !== "static") return;
            if (latestSource.maskData.mask_media_id !== updated.mask_media_id) return;
            lightsRef.current = buildLightsMap(updated.polygons);
            lightsMetaRef.current = buildLightsMetaMap(updated.lights);
            maskGeometryRef.current = maskGeometry(updated);
            recolorHighlight();
          },
          retouchObjectMesh: () => latestRef.current.retouchObjectMesh(),
          setPendingTopology: (edit) => {
            pendingTopologyRef.current = edit;
            scheduleRecolorHighlight();
          },
          clearPendingTopology: () => {
            cancelScheduledRecolorHighlight();
            pendingTopologyRef.current = undefined;
            pendingLightShapeRef.current = undefined;
            recolorHighlight();
            renderRef.current();
          },
          setObjectReviewPreview: (indices, diffBase) => {
            objectReviewPreviewRef.current = indices;
            objectReviewDiffBaseRef.current = diffBase;
            recolorHighlight();
          },
          syncObjects: (updated) => {
            const latestSource = latestRef.current.source;
            if (latestSource.kind !== "static") return;
            if (latestSource.maskData.mask_media_id !== updated.mask_media_id) return;
            objectsRef.current = updated.objects;
            objectsMapRef.current = buildObjectsMap(updated.polygons);
            lightsRef.current = buildLightsMap(updated.polygons);
            const geometry = maskGeometry(updated);
            maskGeometryRef.current = geometry;
            const signature = objectsMeshSignature(updated.objects);
            const glState = glStateRef.current;
            const remeshed = updated.polygons !== polygonsRef.current;
            polygonsRef.current = updated.polygons;
            if (glState && colorCtx && (remeshed || signature !== objectsMeshSignatureRef.current)) {
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
            lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0, order: MASK_ORDER_UNRANKED };
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
          gl.deleteBuffer(state.fillOverlayBuffer);
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
          gl.bindBuffer(gl.ARRAY_BUFFER, state.fillOverlayBuffer);
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

        const streaming = mask.statusRef.current === "connecting" || mask.statusRef.current === "streaming";
        backingVertexCountRef.current = mask.meshRefs.backingVertexCountRef.current;
        backingGreyRef.current = streaming ? 1 : 0;
        textureMixRef.current = mask.textureMixRef.current;
        lightSizeRef.current = mask.lightSizeRef.current;
        lightIntensityRef.current = mask.lightIntensityRef.current;
        lightFalloffRef.current = mask.lightFalloffRef.current;
        lightDarknessRef.current = mask.lightDarknessRef.current;

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
        gl.deleteBuffer(state.fillOverlayBuffer);
        if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
        if (textureRef.current) gl.deleteTexture(textureRef.current);
        glStateRef.current = undefined;
        maskTextureRef.current = undefined;
        textureRef.current = undefined;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meshIdentityKey, render, recolorHighlight, abortLightDrag, maskHandlesRef, maskElementsRef, mediaKey],
  );

  const openPenOn = useCallback(
    (picked: Extract<LaurusSelectedElement, { type: "light" | "object" }>) => {
      if (source.kind !== "static") return;
      const maskData = source.maskData;
      if (picked.type === "object") {
        const object = maskData.objects.find((o) => o.id === picked.objectId);
        if (!object) return;
        const polygonIndices = polygonIndicesForObject(maskData.polygons, object.id);
        uiDispatch({
          type: UIActionType.StartObjectEdit,
          maskMediaId: maskData.mask_media_id,
          maskKey: mediaKey,
          object,
          polygonIndices,
        });
        notifyMaskObjectReviewPreview(mediaKey, new Set(polygonIndices));
        return;
      }
      const light = maskData.lights.find((l) => l.id === picked.lightId);
      if (!light) return;
      const polygonIndices = polygonIndicesForLight(maskData.polygons, light.id);
      uiDispatch({
        type: UIActionType.StartLightEdit,
        maskMediaId: maskData.mask_media_id,
        maskKey: mediaKey,
        light,
        polygonIndices,
      });
      notifyMaskObjectReviewPreview(mediaKey, new Set(polygonIndices));
    },
    [source, mediaKey, uiDispatch, notifyMaskObjectReviewPreview],
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
              if (uiState.maskEdit?.maskKey === mediaKey) {
                if (isMaskEditLocked(uiState.maskEdit) || uiState.maskEdit.editingShape) return;
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                const index = point
                  ? swelledPolygonIndexAtPoint(maskGeometryRef.current.points, resolveObjectUniforms(), point)
                  : undefined;
                if (index !== undefined) {
                  const previewed = new Set(objectReviewPreviewRef.current ?? []);
                  if (previewed.has(index)) previewed.delete(index);
                  else previewed.add(index);
                  objectReviewPreviewRef.current = previewed;
                  recolorHighlight();
                  uiDispatch({ type: UIActionType.ToggleMaskEditPolygon, index });
                }
                return;
              }
              const hitSubElement = (): Extract<LaurusSelectedElement, { type: "light" | "object" }> | undefined => {
                if (source.kind !== "static") return undefined;
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return undefined;
                const objectId = objectIdAtPoint(objectsRef.current, point);
                if (objectId !== undefined) return { key: mediaKey, type: "object", objectId };
                const lightId = lightIdAtPoint(
                  source.maskData.polygons,
                  maskGeometryRef.current.points,
                  resolveObjectUniforms(),
                  point,
                );
                if (lightId !== undefined) return { key: mediaKey, type: "light", lightId };
                return undefined;
              };
              const select = (selected: LaurusSelectedElement) => {
                uiDispatch({ type: UIActionType.SetSelectedElement, value: selected });
                if ((selected.type === "light" || selected.type === "object") && uiState.lightSourcePreview) {
                  notifyMaskLightSourcePreviewToggled(false);
                }
                notifyMaskSelectionChanged(mediaKey);
                notifyMaskSelectedLightChanged(mediaKey, selected.type === "light" ? selected.lightId : undefined);
                notifyMaskSelectedObjectChanged(mediaKey, selected.type === "object" ? selected.objectId : undefined);
              };
              const previouslySelectedLightId =
                uiState.selectedElement?.type === "light" && uiState.selectedElement.key === mediaKey
                  ? uiState.selectedElement.lightId
                  : undefined;
              const previouslySelectedObjectId =
                uiState.selectedElement?.type === "object" && uiState.selectedElement.key === mediaKey
                  ? uiState.selectedElement.objectId
                  : undefined;
              if (isPenArmed(uiState) && !isAltKeyPressed && !e.metaKey) {
                const hit = hitSubElement();
                if (hit) {
                  select(hit);
                  openPenOn(hit);
                }
                return;
              }
              const isIdleMaskTool =
                uiState.tool.type === "mask" && !uiState.tool.lightingMeshSection && !uiState.tool.raisingObjects;
              if (isIdleMaskTool && !isAltKeyPressed && !e.metaKey) {
                setSelectedMaskKeys(new Set([mediaKey]));
                if (source.maskData.lights.length > 0) {
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
                      hit.type === "light"
                        ? previouslySelectedLightId === hit.lightId
                        : previouslySelectedObjectId === hit.objectId;
                    select(alreadySelected ? { key: mediaKey, type: "mask" } : hit);
                    return;
                  }
                  if (previouslySelectedLightId !== undefined || previouslySelectedObjectId !== undefined) {
                    select({ key: mediaKey, type: "mask" });
                  }
                }
                setSelectedMaskKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                  } else {
                    next.add(mediaKey);
                    if (source.maskData.lights.length > 0) {
                      select({ key: mediaKey, type: "mask" });
                    }
                  }
                  return next;
                });
                return;
              }
              if ((uiState.tool.type === "rotate" || uiState.tool.type === "skew") && !e.metaKey) {
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
              const aimsContextMenu = e.metaKey || uiState.tool.type === "contextmenu";
              const hit = aimsContextMenu ? hitSubElement() : undefined;
              const hitLightId = hit?.type === "light" ? hit.lightId : undefined;
              const hitObjectId = hit?.type === "object" ? hit.objectId : undefined;
              if (hit) {
                select(hit);
              } else if (
                aimsContextMenu &&
                (previouslySelectedLightId !== undefined || previouslySelectedObjectId !== undefined)
              ) {
                select({ key: mediaKey, type: "mask" });
              }
              if (
                showContextMenu &&
                (previouslySelectedLightId !== hitLightId || previouslySelectedObjectId !== hitObjectId)
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
                case "skew":
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
              if (uiState.tool.type !== "move") return;
              const canvas = e.currentTarget;
              const point = toBufferPoint(canvas, e.clientX, e.clientY);
              if (!point) return;
              const [bufferX, bufferY] = point;
              const lightId = lightIdAtPoint(
                source.maskData.polygons,
                maskGeometryRef.current.points,
                resolveObjectUniforms(),
                [bufferX, bufferY],
              );
              if (lightId === undefined) return;
              if (lightCommitInFlightRef.current.has(lightId)) return;
              const originalIndices = new Set<number>();
              source.maskData.polygons.forEach((p, i) => {
                if (p.light_id === lightId) originalIndices.add(i);
              });
              const light = source.maskData.lights.find((c) => c.id === lightId);
              const known = lastKnownLightRef.current.get(lightId);
              let region: LightDragRegion;
              if (light && light.radius > 0) {
                region = { cx: light.cx, cy: light.cy, radius: light.radius, shape: light.shape };
              } else {
                const reconstructed =
                  known && sameIndices(known.indices, originalIndices)
                    ? known.region
                    : litRegionCircle(source.maskData.polygons, maskGeometryRef.current.centroids, lightId);
                if (!reconstructed) return;
                const persistedSize = light?.size ?? 0;
                region = {
                  ...reconstructed,
                  radius: persistedSize > 0 ? persistedSize / 2 : reconstructed.radius,
                  shape: "",
                };
              }
              e.stopPropagation();
              e.preventDefault();
              canvas.setPointerCapture(e.pointerId);
              lightDragRef.current = {
                pointerId: e.pointerId,
                lightId,
                startX: bufferX,
                startY: bufferY,
                originalRegion: region,
                originalIndices,
                rafId: undefined,
                latestX: bufferX,
                latestY: bufferY,
              };
              setIsDraggingLight(true);
              dispatch({
                type: CoreActionType.SetPendingLight,
                value: { maskKey: mediaKey, lightId, polygonIndices: [...originalIndices] },
              });
              notifyMaskPendingLightSet(mediaKey, originalIndices, lightId);
            }}
            onPointerMove={(e) => {
              const lightDrag = lightDragRef.current;
              if (lightDrag && e.pointerId === lightDrag.pointerId) {
                const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
                if (!point) return;
                [lightDrag.latestX, lightDrag.latestY] = point;
                if (lightDrag.rafId === undefined) lightDrag.rafId = requestAnimationFrame(recomputeLightDrag);
                return;
              }
            }}
            onPointerUp={(e) => {
              const drag = lightDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId || source.kind !== "static") return;
              suppressNextClickRef.current = true;
              if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
              const dx = (point?.[0] ?? drag.latestX) - drag.startX;
              const dy = (point?.[1] ?? drag.latestY) - drag.startY;
              const finalIndices = lightIndicesAtOffset(drag, dx, dy);
              const lightId = drag.lightId;
              const existingLight = source.maskData.lights.find((c) => c.id === lightId);
              const lightName = existingLight?.name ?? `light ${lightId}`;
              lightDragRef.current = undefined;
              setIsDraggingLight(false);
              if (finalIndices.size === 0) {
                lastKnownLightRef.current.set(lightId, {
                  indices: drag.originalIndices,
                  region: drag.originalRegion,
                });
                dispatch({ type: CoreActionType.SetPendingLight, value: undefined });
                notifyMaskPendingLightCleared(mediaKey);
                return;
              }
              dispatch({
                type: CoreActionType.SetPendingLight,
                value: { maskKey: mediaKey, lightId, polygonIndices: [...finalIndices] },
              });
              notifyMaskPendingLightSet(mediaKey, finalIndices, lightId);
              lightCommitInFlightRef.current.add(lightId);
              sendMaskLightUpdate(
                source.maskData.mask_media_id,
                toLightUpdate(existingLight ?? newLight(lightId, lightName), {
                  name: lightName,
                  polygon_indices: [...finalIndices],
                  ...(existingLight ? {} : { order: frontElementOrder(maskStack(source.maskData)) }),
                  ...(existingLight && existingLight.radius > 0
                    ? { cx: drag.originalRegion.cx + dx, cy: drag.originalRegion.cy + dy }
                    : {}),
                }),
              ).then((updated) => {
                lightCommitInFlightRef.current.delete(lightId);
                const latestMask = latestRef.current.source;
                if (updated && latestMask.kind === "static") {
                  const patched = applyLightDelta(latestMask.maskData, updated);
                  dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: patched });
                  notifyMaskLightUpdated(mediaKey, patched);
                  if (uiState.lightSourcePreview) {
                    uiDispatch({ type: UIActionType.SetLightSourcePreview, value: false });
                    notifyMaskLightSourcePreviewToggled(false);
                  }
                  lastKnownLightRef.current.set(lightId, {
                    indices: finalIndices,
                    region: {
                      ...drag.originalRegion,
                      cx: drag.originalRegion.cx + dx,
                      cy: drag.originalRegion.cy + dy,
                    },
                  });
                } else {
                  lastKnownLightRef.current.set(lightId, {
                    indices: drag.originalIndices,
                    region: drag.originalRegion,
                  });
                }
                dispatch({ type: CoreActionType.SetPendingLight, value: undefined });
                notifyMaskPendingLightCleared(mediaKey);
              });
            }}
            onPointerCancel={(e) => {
              const drag = lightDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId) return;
              abortLightDrag();
            }}
            onMouseEnter={() => {
              setIsHovered(true);
            }}
            onMouseMove={(e) => {
              setIsHovered(true);
              if (lightDragRef.current) return;
              if (wiredMoveRef.current || !uiState.lightSourcePreview) return;
              if (isAnyDragActive()) return;
              setMostRecentlyHoveredMaskKey(mediaKey);
              const canvas = e.currentTarget;
              const rect = canvas.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return;
              const bufferX = ((e.clientX - rect.left) * canvas.width) / rect.width;
              const bufferY = ((e.clientY - rect.top) * canvas.height) / rect.height;
              const bufferScaleX = bufferScaleRef.current.x;
              lightSourceRef.current = {
                x: bufferX,
                y: canvas.height - bufferY,
                radius: (lightSizeRef.current / 2) * bufferScaleX,
                falloff: lightFalloffRef.current * bufferScaleX,
                order: MASK_ORDER_UNRANKED,
              };
              render();
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              if (wiredMoveRef.current) return;
              lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0, order: MASK_ORDER_UNRANKED };
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
          {shapeEditorObject && (
            <ObjectShapeEditor
              key={`${mediaKey}:${shapeEditorObject.current.id}:${shapeEditorObject.current.origin}`}
              object={shapeEditorObject.current}
              reference={shapeEditorObject.original}
              bufferWidth={canvasSize.width}
              bufferHeight={canvasSize.height}
              cssWidth={containerSize.width}
              cssHeight={containerSize.height}
              canvasZoom={canvasZoom}
              onPreview={previewShapeEdit}
              onCommit={commitShapeEdit}
              stitch={uiState.tool.type === "pen" && uiState.tool.stitch}
              addAnchor={uiState.tool.type === "pen" && uiState.tool.addAnchor}
              showAnchors={uiState.tool.type !== "pen" || uiState.tool.showAnchors}
              gridlinesBright={uiState.gridlinesBright}
            />
          )}
        </div>
        {showContextMenu && maskMeta && framesCacheRef && (
          <ContextMenu
            media={
              uiState.selectedElement?.type === "light" && uiState.selectedElement.key === mediaKey
                ? { key: mediaKey, type: "light", lightId: uiState.selectedElement.lightId, meta: maskMeta }
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
