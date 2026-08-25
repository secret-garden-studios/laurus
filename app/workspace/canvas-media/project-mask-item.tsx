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
  HIGHLIGHT_OBJECT_REVIEW_ADDED_COLOR,
  HIGHLIGHT_SELECTED_COLOR,
  HIGHLIGHT_SIBLING_COLOR,
  MaskLightSource,
  ObjectGeometryInput,
  ObjectRotation,
  objectRotation,
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
  isMaskEditLocked,
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
  indicesInObjectFromCentroids,
  objectIdAtPoint,
  swelledPolygonIndexAtPoint,
  translateIndices,
} from "./light-geometry";
import { MaskGeometry, maskGeometry, maskPolygonColors } from "./mask-geometry";
import { applyLightDelta, applyObjectDelta } from "./mask-delta";
import { OBJECT_SDF_DRAFT_TILE, OBJECT_SDF_TILE, cachedObjectShape } from "./object-shape";
import { shapeOutline } from "./object-clip";
import { retouchMesh } from "./object-retouch";
import { unitCirclePath } from "./object-path";
import ObjectShapeEditor, { type ShapeEdit } from "./object-shape-editor";
import {
  getFrames,
  getImg,
  getLightSourceFrames,
  getMoveFrames,
  getRotateFrames,
  getScaleFrames,
  LaurusLight,
  LaurusEffect,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
  LaurusObject,
  LaurusObjectBlackPoint,
  LaurusPolygonPath,
  newLight,
  toEquationObjectBlackPoint,
  toLightUpdate,
  toObjectBlackPoint,
  toObjectBlackPointFields,
} from "../workspace.server";
import { maskLightInputId, maskObjectInputId } from "../effects-utils";

export type ProjectMaskItemSource =
  { kind: "static"; maskData: LaurusMaskResult } | { kind: "live"; mask: UseMaskPreview; sourceImg: LaurusImgResult };

const LIGHT_DRAG_EPSILON_SQ = 1;

/**
 * The silhouette a light drag carries with it.
 *
 * A drag is a translation of the region the light covers, so it has to be the
 * light's *own* region -- an empty `shape` here is a circle, exactly as it is
 * everywhere else, which is what keeps a light drawn before lights could be
 * shaped dragging the way it always did.
 *
 * This used to be a bare circle, reconstructed from the light's triangles at
 * the start of every drag. That was right when every light was a circle, and
 * became wrong the moment one could be drawn: the reconstruction threw the
 * outline away, so dragging a shaped light picked up whatever triangles a
 * circle of the same reach happened to cover and the shape appeared to snap
 * back to a disc.
 */
type LightDragRegion = { cx: number; cy: number; radius: number; shape: string };

/** What an open session is editing on this mask, if anything -- see maskEditSubjectRef. */
function maskEditSubjectFor(
  session: MaskEditSession | undefined,
  maskKey: string,
): { subject: "light" | "object"; id: number } | undefined {
  if (session?.maskKey !== maskKey) return undefined;
  const region = editedRegion(session);
  return region && { subject: session.subject, id: region.id };
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

/**
 * What resolution to rasterize a pending edit's shape at: draft while the
 * gesture is still running, full once it has settled.
 */
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
    shape: cachedObjectShape(object.shape),
    blackPoint: toObjectBlackPoint(object),
  };
}

function confirmObjectMove(object: LaurusObject): boolean {
  const label = object.description ?? object.name ?? object.id;
  return confirm(
    `"${label}" is an object accepted during a manual review, so its position and its triangles are exactly where ` +
      "someone put them. moving it changes both. are you sure?",
  );
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
  abortTopologyDragForToolChange: () => void;
  setSelectedHighlighted: (active: boolean) => void;
  setSelectedLight: (lightId: number | undefined) => void;
  setSelectedObject: (objectId: number | undefined) => void;
  setPendingLight: (indices: Set<number>, lightId?: number) => void;
  clearPendingLight: () => void;
  syncLitIndices: (updated: LaurusMaskResult) => void;
  setPendingTopology: (edit: PendingTopologyEdit) => void;
  clearPendingTopology: () => void;
  /** Recut this mask's mesh against the outline the pen has open -- see retouchMesh. */
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
  const { sendMaskLightUpdate, sendMaskObjectUpdate } = useContext(SocketContext);
  const {
    notifyMaskSelectionChanged,
    notifyMaskSelectedLightChanged,
    notifyMaskSelectedObjectChanged,
    notifyMaskPendingLightSet,
    notifyMaskPendingLightCleared,
    notifyMaskLightUpdated,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
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
      {
        cx: number;
        cy: number;
        elevation: number;
        radius: number;
        falloff: number;
        blackPoint: LaurusObjectBlackPoint;
        rotation: ObjectRotation | undefined;
      }
    >
  >(new Map());
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
        originalReviewed: boolean;
        originalLift: boolean;
        originalIndices: Set<number>;
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
  const objectReviewDiffBaseRef = useRef<Set<number> | undefined>(undefined);
  /**
   * Which region the open session is editing, if it is on this mask.
   *
   * Read only by recolorHighlight, and only to make the loops that paint
   * *stored* membership stand aside for it. While a session is open the
   * preview is the authority on which triangles that region covers, and the
   * mask still holds the membership it had when the session opened -- so
   * painting both puts the union on screen: the triangles the outline has
   * moved off stay lit, and the reshape looks like it did nothing.
   *
   * Kept in step by an effect rather than pushed through
   * setObjectReviewPreview, which is where it used to live. That channel fires
   * many times during one session -- every re-tag, every recut, every revert --
   * and all but the first of those carried no subject, so the suppression was
   * switched on when the session opened and switched straight back off by the
   * first thing the session did.
   */
  const maskEditSubjectRef = useRef<{ subject: "light" | "object"; id: number } | undefined>(undefined);
  const pendingLightRef = useRef<Set<number> | undefined>(undefined);
  const pendingLightIdRef = useRef<number | undefined>(undefined);
  const selectedHighlightRef = useRef(false);
  const lightsRef = useRef<Map<number, Set<number>>>(new Map());
  const lightsMetaRef = useRef<Map<number, LaurusLight>>(new Map());
  /**
   * Where a light's silhouette is being moved to, held only while some gesture
   * is moving it -- the pen reshaping it, or the move tool dragging it whole.
   * Read by resolveRestingLightSources so the light itself follows the gesture
   * without a round trip, exactly as pendingLightRef already does for the
   * triangles.
   *
   * One ref for both because they are the same question ("where is this light
   * right now, as against where it is stored?") and the two gestures cannot
   * overlap: the pen owns the pointer while it is open. Each clears it on the
   * way out -- the pen through clearPendingTopology, the drag through
   * clearPendingLight -- so it is never left behind.
   */
  const pendingLightShapeRef = useRef<
    { lightId: number; cx: number; cy: number; radius: number; shape: string; draft: boolean } | undefined
  >(undefined);
  // `render` is defined below, and the preview is only ever called from a
  // pointer handler long after that -- so it is reached through a ref rather
  // than by hoisting the whole of `render` above the callbacks it depends on.
  const renderRef = useRef<() => void>(() => {});
  const selectedLightIdRef = useRef<number | undefined>(undefined);
  const objectsMapRef = useRef<Map<number, Set<number>>>(new Map());
  const maskGeometryRef = useRef<MaskGeometry>({ corners: [], points: [], centroids: [] });
  /** The polygon array the uploaded mesh was built from -- see syncObjects. */
  const polygonsRef = useRef<LaurusPolygonPath[]>([]);
  const objectsMeshSignatureRef = useRef<string>("");
  const highlightScratchRef = useRef<Float32Array>(new Float32Array(0));
  const highlightUploadedRef = useRef<Float32Array>(new Float32Array(0));
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
    // The light goes with its triangles. A shaped light draws from its stored
    // centre, which has not moved yet, so without this the glow would sit
    // still while the triangles slid out from under it and only catch up when
    // the drag was let go. Not a draft: the outline is not changing, only
    // where it is, so the tile it was already sampled at is the right one.
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
    // A pending edit may have reshaped the object, not just moved it, so its
    // own shape is the one to render -- reading the stored shape here would
    // show a reshape as a move. Built at draft resolution while the gesture is
    // still in flight; see cachedObjectShape.
    const pendingShape = pending ? cachedObjectShape(pending.shape, pendingTileSize(pending)) : undefined;
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
          rotation: playing.rotation,
          // Lift only ever means something against a pose the object has moved
          // away from, so it is attached here and nowhere else: `playing` is
          // the animated pose and the stored object is still the resting one.
          // A lifted object nothing is animating never reaches this branch.
          lift: object.lift ? { cx: object.cx, cy: object.cy, radius: object.radius } : undefined,
        };
      }
      return pending && pending.objectId === object.id
        ? {
            cx: pending.cx,
            cy: pending.cy,
            radius: pending.radius,
            elevation: pending.elevation,
            falloff: pending.falloff,
            shape: pendingShape,
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
        shape: pendingShape,
        blackPoint: pending.blackPoint,
      });
    }
    return objects;
  }, []);

  const objectDragEdit = useCallback(
    (drag: NonNullable<typeof objectDragRef.current>, dx: number, dy: number): PendingTopologyEdit => {
      const moved = {
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
      return {
        ...moved,
        polygonIndices:
          drag.originalIndices.size > 0
            ? translateIndices(
                maskGeometryRef.current.points,
                maskGeometryRef.current.centroids,
                drag.originalIndices,
                dx,
                dy,
              )
            : indicesInObjectFromCentroids(maskGeometryRef.current.centroids, moved),
      };
    },
    [mediaKey],
  );

  const recomputeTopologyDrag = useCallback(() => {
    const drag = objectDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const edit = objectDragEdit(drag, drag.latestX - drag.startX, drag.latestY - drag.startY);
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
    notifyMaskPendingTopologySet(mediaKey, edit);
  }, [mediaKey, dispatch, notifyMaskPendingTopologySet, objectDragEdit]);

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

  const resolveTargetLightId = useCallback((): number | undefined => {
    if (selectedLightIdRef.current !== undefined) return selectedLightIdRef.current;
    return lightsRef.current.keys().next().value;
  }, []);

  /**
   * The silhouette a light is drawing with right now -- the one a gesture is
   * moving it to, or the one it has stored -- or undefined for a light drawn
   * before they could be shaped, which is still drawn from its triangles.
   *
   * The single answer to "where is this light", so that everything which needs
   * to know cannot disagree about it. They did disagree: the animation derived
   * a rest position from the light's triangles while the canvas drew the light
   * at its own centre, and for anything but a blob those are different points
   * -- a crescent's triangles sit in its arc, its centre in the notch. The
   * first frame of a move therefore teleported the light from one to the other
   * before it had moved at all.
   */
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
      // Rest means where it rests on screen, so a shaped light answers with its
      // own centre -- the same one resolveRestingLightSources draws it at.
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

  /**
   * Every light on the mask as the shader wants it.
   *
   * Where a light's silhouette comes from is a three-way choice, most specific
   * first: the outline the pen is dragging right now, the one the light has
   * stored, or -- for a light drawn before they could be shaped -- the disc it
   * has always lit with, centred on its triangles and half its `size` across.
   * The
   * last is not a fallback so much as the original behaviour, still exactly
   * itself: lightProfile's two branches are the same formula, so a light with
   * no outline lights as it always did.
   *
   * A stored outline stops the centre following the triangles, and that is
   * deliberate rather than a limitation. Once someone has drawn where the light
   * falls, that is where it falls; re-deriving the centre would slide their
   * curve sideways the next time the grouping changed. It is also the pairing
   * rule the outline itself demands -- a normalized path is only meaningful
   * with the cx/cy/radius it was measured against.
   */
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
      const appearance = { falloff: meta.falloff, intensity: meta.intensity, darkness: meta.darkness };

      if (shaped) {
        lights.push({
          x: shaped.cx,
          y: canvas.height - shaped.cy,
          radius: shaped.radius,
          // Mid-drag the outline is sampled at the editor's own lower tile
          // resolution: it is rebuilt on every pointer move, and the full field
          // costs far more than the difference can be seen to be worth while
          // an anchor is still moving. The commit that ends the gesture is not
          // a draft, so the light settles at full resolution the moment the
          // anchor is let go rather than waiting for the save.
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
  }, [resolveLightSilhouette]);

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
  const dndCss = {
    left: dndPosition.x,
    top: dndPosition.y,
    transform: CSS.Translate.toString(toCanvasTranslate(dndTransform, canvasZoom)),
    touchAction: "none",
  };

  const toolCursor = useToolCursor({
    target: source.kind === "static" ? "mask" : undefined,
    dragDisabled,
    isDragging: isDragging || isDraggingLight || isDraggingTopology,
  });
  const isReviewingThisMask =
    source.kind === "static" && uiState.maskEdit?.maskKey === mediaKey && !isMaskEditLocked(uiState.maskEdit);
  const cursor = isReviewingThisMask ? "crosshair" : toolCursor;

  /**
   * The silhouette a light already has, or the one it should start from.
   *
   * A light drawn today is born with one, so this is for the ones drawn before
   * they could be: those have no geometry of their own, and zeros are not
   * something the pen can draw. What such a light *does* have is the
   * silhouette it has been lighting with all along -- a disc of `size / 2`
   * centred on its triangles -- which is exactly what resolveRestingLightSources
   * derives to draw it. Seeding from that is what makes opening the pen a
   * no-op to look at: the first thing shown is the light as it already is,
   * rather than a circle that has appeared from nowhere and moved it.
   *
   * The membership passed in is the session's, not the mask's, so the seed
   * follows triangles the editor has already added or removed rather than
   * centring on where the light used to be.
   */
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

  /**
   * The outline the pen should be showing, and the one it started from.
   *
   * `current` is what the editor draws and `original` the ghost behind it,
   * present only once the two differ. Both are needed here rather than in the
   * editor because only this component can see the mask, and the mask is what
   * settles which of the three possible outlines is the live one.
   */
  const reviewShape = useMemo(() => {
    const session = uiState.maskEdit;
    if (source.kind !== "static" || session?.maskKey !== mediaKey) return undefined;

    // Not the session's own copy, and for an object not `decisions` either:
    // a review can be resumed on a mask that was half decided days ago, and
    // what settles whether an outline was accepted is whether it is on the
    // mask now. The same rule gives a light its stored outline.
    const maskData = coreState.canvasMasks.get(mediaKey);

    // A stored light that has never been shaped is still all zeros, so it goes
    // through the same seeding the session's own copy does -- otherwise saving
    // only a description would hand the pen a radius of 0 the next time it
    // opened. Resolved inside the branch rather than after it so that neither
    // side has to be told what the other's `stored` is.
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

    // Geometry and outline must come from the same place. A path is normalized
    // against the geometry it was measured with -- pulling an anchor outward
    // grows the radius rather than the path -- so pairing one with another's
    // cx/cy/radius renders it back at roughly the size and position that other
    // one had. Which looks exactly like the pen snapping back the instant it
    // is released.
    const from = session.editedShape ?? base;
    const current = {
      id: opened.id,
      cx: from.cx,
      cy: from.cy,
      radius: from.radius,
      shape: session.editedShape?.path ?? base.shape,
      // what the editor is remounted on -- see the key below
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

  // The region the pen is open on, if any.
  const shapeEditorObject = uiState.maskEdit?.editingShape ? reviewShape : undefined;

  // A reshape previews without a round trip and without touching the state the
  // editor reads its own rings from. Which channel depends on what is being
  // reshaped: an object's outline is relief, so it goes through the same
  // pending-topology channel an object drag already uses, while a light's is
  // light, so it goes to the uniform the mesh is shaded with.
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
      const pending: PendingTopologyEdit = {
        maskKey: mediaKey,
        objectId: candidate.id,
        cx: edit.cx,
        cy: edit.cy,
        radius: edit.radius,
        elevation: candidate.elevation,
        falloff: candidate.falloff,
        shape: edit.path,
        blackPoint: toObjectBlackPoint(candidate),
        polygonIndices: session.currentIndices,
        draft,
      };

      if (!draft) dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: pending });
      notifyMaskPendingTopologySet(mediaKey, pending);
    },
    [uiState.maskEdit, mediaKey, dispatch, notifyMaskPendingTopologySet],
  );

  /**
   * Re-tag the triangles to the ones the outline actually encloses -- an
   * object's or a light's, on the same rule.
   *
   * **Only ever called for an edit the editor actually made.** Opening the
   * pen must leave things exactly as they were -- it is a view onto the
   * outline, and a view that rewrites what it is shown is not one. This was
   * briefly wired to run on open as well, on the theory that the triangles
   * ought to look flush the moment the curve appears; what it actually did was
   * silently re-cut every rim triangle of an object nobody had touched yet.
   * Keep the single call site below.
   *
   * The two were only ever cousins: membership came from the server's
   * per-triangle vote on which region it mostly covers, while the outline is a
   * smoothed curve through a couple of dozen anchors of that same region's
   * boundary. Both describe the region, neither is derived from the other, and
   * the smoothing is exactly where they part company -- so the triangles sat
   * near the curve rather than flush against it, and reshaping moved the curve
   * without moving them at all.
   *
   * Taking membership from the outline makes the curve the thing that decides,
   * which is what anyone dragging an anchor expects. A triangle is in when its
   * centroid is, which is the same test the mesh already uses everywhere else
   * -- and a retouch afterwards cuts the rim triangles flush to the curve, so
   * the edge stops being a staircase of whole triangles.
   */
  const snapIndicesToShape = useCallback(
    (region: { cx: number; cy: number; radius: number; shape: string }) => {
      const review = uiState.maskEdit;
      if (!review || review.maskKey !== mediaKey || isMaskEditLocked(review)) return;
      const indices = indicesInObjectFromCentroids(maskGeometryRef.current.centroids, region);
      uiDispatch({ type: UIActionType.SetMaskEditIndices, indices });
      // routes straight back to this component's own setObjectReviewPreview,
      // which sets the ref and repaints
      notifyMaskObjectReviewPreview(mediaKey, indices, objectReviewDiffBaseRef.current);
    },
    [uiState.maskEdit, mediaKey, uiDispatch, notifyMaskObjectReviewPreview],
  );

  // Recorded only on release: this is the value the accept decision carries,
  // and writing it mid-drag would feed the edit straight back into the editor.
  const commitShapeEdit = useCallback(
    (edit: ShapeEdit) => {
      // no longer a draft: the gesture is over, so this one gets built at full
      // resolution and is what the relief settles on
      previewShapeEdit(edit, false);
      uiDispatch({ type: UIActionType.SetMaskEditShape, shape: edit });
      snapIndicesToShape({ cx: edit.cx, cy: edit.cy, radius: edit.radius, shape: edit.path });
    },
    [previewShapeEdit, uiDispatch, snapIndicesToShape],
  );

  /**
   * Recut the mask's mesh along the outline the pen has open, so the triangles
   * near the curve follow it instead of straddling it.
   *
   * The recut mesh goes straight into the mask the canvas is drawing, because
   * the whole point of it is to be looked at -- a recut nobody could see until
   * they saved it would be worthless. It is still uncommitted: the mesh it
   * replaced rides along on the review session as `restore`, and every way out
   * of the pen puts it back. Only accepting the object sends it anywhere.
   *
   * Membership comes back from the recut rather than being re-derived here.
   * Every fragment now lies wholly on one side of the curve, and which side is
   * what the cut decided; asking the centroid test again would only be a
   * chance to disagree with it.
   */
  const retouchObjectMesh = useCallback(() => {
    const session = uiState.maskEdit;
    if (source.kind !== "static" || session?.maskKey !== mediaKey || isMaskEditLocked(session)) return;

    // the outline the pen is showing, not the one it opened on: a recut has to
    // follow the curve being looked at, and after an accepted reshape those are
    // two different curves -- see reviewShape, which is also what seeds an
    // unshaped light's circle, so there is always something here to cut to
    const from = reviewShape?.current;
    if (!from) return;
    const outline = shapeOutline(from.shape, from);
    const maskData = coreState.canvasMasks.get(mediaKey);
    if (!outline || !maskData) return;

    const geometry = maskGeometry(maskData);
    const result = retouchMesh(maskData.polygons, geometry.points, outline);
    // nothing crossed the curve that was worth cutting -- the mesh already
    // follows it, which is the ordinary answer for a second retouch in a row
    if (result.added === 0) return;

    const patched = { ...maskData, polygons: result.polygons };
    dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: patched });
    uiDispatch({
      type: UIActionType.SetMaskEditRetouch,
      retouch: { polygons: result.polygons, restore: maskData.polygons, added: result.added },
    });
    uiDispatch({ type: UIActionType.SetMaskEditIndices, indices: result.indices });
    notifyMaskObjectsUpdated(mediaKey, patched);
    notifyMaskObjectReviewPreview(mediaKey, result.indices, objectReviewDiffBaseRef.current);

    // the relief preview names the triangles it is raised over, and the recut
    // has just renumbered them
    const pending = coreState.pendingTopologyEdit;
    if (pending?.maskKey === mediaKey) {
      const next = { ...pending, polygonIndices: result.indices };
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
        ? Array.from(playbackLightSourcesRef.current.values())
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
    });
  }, [resolveObjectUniforms, resolveRestingLightSources]);
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

    const pendingLight = pendingLightRef.current;
    const maskEditSubject = maskEditSubjectRef.current;
    // Two ways a light's stored membership is not the one to paint: a drag is
    // moving it, or a session has it open. Both mean something else on this
    // pass is painting those triangles.
    const editingLightId =
      (pendingLight ? (pendingLightIdRef.current ?? selectedLightIdRef.current) : undefined) ??
      (maskEditSubject?.subject === "light" ? maskEditSubject.id : undefined);
    if (selectedHighlightRef.current) {
      const activeLightId = selectedLightIdRef.current;
      lightsRef.current.forEach((indices, lightId) => {
        if (lightId === editingLightId) return;
        paint(indices, lightId === activeLightId ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
      });
    }
    if (pendingLight && pendingLight.size > 0) {
      paint(pendingLight, HIGHLIGHT_MOVING_COLOR);
    }

    const pendingTopology = pendingTopologyRef.current;
    if (selectedHighlightRef.current) {
      const activeObjectId = selectedObjectIdRef.current;
      objectsMapRef.current.forEach((indices, objectId) => {
        if (objectId === pendingTopology?.objectId) return;
        if (maskEditSubject?.subject === "object" && objectId === maskEditSubject.id) return;
        paint(indices, objectId === activeObjectId ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
      });
    }
    if (pendingTopology) {
      paint(
        pendingTopology.polygonIndices ??
          indicesInObjectFromCentroids(maskGeometryRef.current.centroids, pendingTopology),
        HIGHLIGHT_MOVING_COLOR,
      );
    }

    const objectReviewPreview = objectReviewPreviewRef.current;
    const objectReviewDiffBase = objectReviewDiffBaseRef.current;
    if (objectReviewDiffBase) {
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
      paint(edited, HIGHLIGHT_OBJECT_REVIEW_ADDED_COLOR);
    } else if (objectReviewPreview?.size) {
      paint(objectReviewPreview, HIGHLIGHT_SELECTED_COLOR);
    }

    const uploaded = highlightUploadedRef.current;
    gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
    if (resized) {
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
      // No highlight byte moved -- but this runs for every change the canvas
      // has to react to, not only for the highlight, and something else may
      // well have moved: a light's silhouette, its appearance, the mesh under
      // it. Skipping the upload is the optimization; skipping the frame was
      // only ever an accident of the two sharing a function.
      if (first < 0) {
        render();
        return;
      }
      const start = first - (first % 4);
      const end = last + (4 - (last % 4));
      uploaded.set(highlights.subarray(start, end), start);
      gl.bufferSubData(gl.ARRAY_BUFFER, start * Float32Array.BYTES_PER_ELEMENT, highlights.subarray(start, end));
    }
    render();
  }, [render]);

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
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    applyDefaultLightValue();
    render();
  }, [render, applyDefaultLightValue]);

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
          return { lightId: id, inputId, wiredMove, wiredLightSource, wiredScale };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale)
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
          return { objectId: id, inputId, wiredMove, wiredLightSource, wiredScale, wiredRotate };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale || t.wiredRotate);

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
          objectTarget.wiredRotate)!.value;
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
                  const mergedFrames = mergedFramesByLight.get(t.lightId);
                  const moveFrames = moveFramesByLight.get(t.lightId);
                  const lightSourceFrames = lightSourceFramesByLight.get(t.lightId);
                  const scaleFrames = scaleFramesByLight.get(t.lightId);

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

                  // A light keeps its silhouette while it animates. Position
                  // comes from the move -- that is what is being animated --
                  // but the outline and the reach it was drawn with are the
                  // light's own, or a shaped light would snap back to a disc
                  // the moment playback started and back again when it ended.
                  //
                  // Through the same resolver the rest position came from, so
                  // that frame zero of a move -- where the move contributes
                  // nothing -- lands exactly where the light already was.
                  const shapedMeta = resolveLightSilhouette(t.lightId);
                  playbackLightSourcesRef.current.set(t.lightId, {
                    x: bufferX,
                    y: canvas.height - bufferY,
                    radius: (shapedMeta ? shapedMeta.radius : size / 2) * scaleMultiplier,
                    shape: shapedMeta ? cachedObjectShape(shapedMeta.shape) : undefined,
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
                  const rotateFrames = rotateFramesByObject.get(t.objectId);

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
                  const cx = object.cx + (movePoint?.x ?? 0) * scaleX;
                  const cy = object.cy + (movePoint?.y ?? 0) * scaleY;
                  const elevation = lightSourcePoint?.object_elevation ?? object.elevation;
                  const radius = object.radius;
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
                    rotation: rotatePoint
                      ? objectRotation(rotatePoint.rx, rotatePoint.ry, rotatePoint.rz, rotatePoint.rangle)
                      : undefined,
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

  // The session can open, move to another candidate and close without the
  // canvas being torn down, so this is reconciled on every change rather than
  // read once at mount. Repainting from here because nothing else will: the
  // highlight this decides is only redrawn when something asks for it, and
  // "the session changed" is not otherwise one of those things.
  useEffect(() => {
    const next = maskEditSubjectFor(uiState.maskEdit, mediaKey);
    const previous = maskEditSubjectRef.current;
    if (next?.subject === previous?.subject && next?.id === previous?.id) return;
    maskEditSubjectRef.current = next;
    recolorHighlight();
  }, [uiState.maskEdit, mediaKey, recolorHighlight]);

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
          abortTopologyDragForToolChange: () => {
            if (!objectDragRef.current) return;
            const tool = latestRef.current.uiState.tool;
            if (tool.type === "mask" && tool.raisingObjects) return;
            abortTopologyDrag();
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
            // The drag is over, so its preview of where the light was going
            // goes with it -- by now the mask either holds the new position or
            // the drag was abandoned, and either way the stored light is the
            // one to draw. Same pairing clearPendingTopology has with the pen.
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
            recolorHighlight();
          },
          clearPendingTopology: () => {
            pendingTopologyRef.current = undefined;
            // The two are one signal wearing two names: this fires from every
            // way out of an uncommitted reshape -- reverting, stepping away,
            // shutting the pen, ending the session -- and a light's drafted
            // silhouette is the same uncommitted reshape seen from the other
            // side. Clearing only the relief would leave a light lit by a
            // curve nobody can see any more.
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
            // The lights' own tagging is derived from the very same polygons,
            // and a recut appends fragments carrying the tags of the triangles
            // they were cut from. Rebuilt alongside the objects' rather than
            // left to the next light update, which may never come: a recut
            // driven from a light edit changes the mesh without changing any
            // light, and a stale map would leave that light's highlight and
            // hit-testing pointing at triangles that are no longer its shape.
            lightsRef.current = buildLightsMap(updated.polygons);
            const geometry = maskGeometry(updated);
            maskGeometryRef.current = geometry;
            const signature = objectsMeshSignature(updated.objects);
            const glState = glStateRef.current;
            // A retouch changes the polygons without touching a single object,
            // so the objects' signature alone would miss it and leave the
            // canvas drawing the mesh from before the recut. Identity is the
            // right test: the recut leaves every triangle it did not cut as
            // the very same entry, and hands back a new array only when
            // something actually moved.
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
      abortLightDrag,
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
              if (uiState.maskEdit?.maskKey === mediaKey) {
                if (isMaskEditLocked(uiState.maskEdit)) return;
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
                  uiDispatch({ type: UIActionType.SetLightSourcePreview, value: false });
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
              const hitLightId = hit?.type === "light" ? hit.lightId : undefined;
              const hitObjectId = hit?.type === "object" ? hit.objectId : undefined;
              if (hit) {
                select(hit);
              } else if (
                showContextMenu &&
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
              const isRaisingObjects = uiState.tool.type === "mask" && uiState.tool.raisingObjects;
              const isMoveTool = uiState.tool.type === "move";
              if (isRaisingObjects || isMoveTool) {
                const canvas = e.currentTarget;
                const point = toBufferPoint(canvas, e.clientX, e.clientY);
                const objectId = point ? objectIdAtPoint(objectsRef.current, point) : undefined;
                const object = objectId !== undefined ? objectsRef.current.find((p) => p.id === objectId) : undefined;
                if (point && objectId !== undefined && object && !objectCommitInFlightRef.current.has(objectId)) {
                  const [bufferX, bufferY] = point;
                  e.stopPropagation();
                  e.preventDefault();
                  if (object.reviewed) {
                    if (!confirmObjectMove(object)) return;
                    try {
                      canvas.setPointerCapture(e.pointerId);
                    } catch {
                      return;
                    }
                  } else {
                    canvas.setPointerCapture(e.pointerId);
                  }
                  const originalIndices = new Set<number>();
                  source.maskData.polygons.forEach((p, i) => {
                    if (p.object_id === objectId) originalIndices.add(i);
                  });
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
                    originalReviewed: object.reviewed,
                    originalLift: object.lift,
                    originalIndices,
                    rafId: undefined,
                    latestX: bufferX,
                    latestY: bufferY,
                  };
                  setIsDraggingTopology(true);
                  return;
                }
                if (isRaisingObjects) return;
              }
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
              // A light that has a silhouette of its own is dragged by it,
              // full stop -- there is nothing to reconstruct and nothing that
              // could be more authoritative than the outline someone drew.
              // The reconstruction below is for lights drawn before they could
              // be shaped: rebuild the disc they have been lighting with, and
              // remember it across drags so repeated nudges do not each
              // re-derive a slightly different centre from the triangles.
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
                const finalElevation = objectDrag.originalElevation;
                const finalFalloff = objectDrag.originalFalloff;
                const existingObject = source.maskData.objects.find((p) => p.id === objectId);
                const objectName = existingObject?.name ?? `object ${objectId}`;
                const edit = objectDragEdit(objectDrag, dx, dy);
                const finalCx = edit.cx;
                const finalCy = edit.cy;
                objectDragRef.current = undefined;
                setIsDraggingTopology(false);
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
                  reviewed: objectDrag.originalReviewed,
                  lift: objectDrag.originalLift,
                  remove: false,
                  polygon_indices: [...(edit.polygonIndices ?? [])],
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
                  // A drag is a translation, so a light that has been given a
                  // silhouette is translated by the same offset its triangles
                  // were. Leaving the outline where it was would make dragging
                  // a shaped light do nothing anyone could see -- the triangles
                  // would move out from under the light rather than with it.
                  // A light with no silhouette has nothing to move: its centre
                  // is derived from the triangles and follows them already.
                  //
                  // Off the drag's own region rather than the mask's copy,
                  // because the region is what was actually dragged and the
                  // offset below is measured against it.
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
              const objectDrag = objectDragRef.current;
              if (objectDrag && e.pointerId === objectDrag.pointerId) {
                abortTopologyDrag();
                return;
              }
              const drag = lightDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId) return;
              abortLightDrag();
            }}
            onMouseEnter={() => {
              setIsHovered(true);
            }}
            onMouseMove={(e) => {
              setIsHovered(true);
              if (lightDragRef.current || objectDragRef.current) return;
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
                radius: (lightSizeRef.current / 2) * scaleX,
                falloff: lightFalloffRef.current * scaleX,
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
          {shapeEditorObject && (
            <ObjectShapeEditor
              key={`${mediaKey}:${shapeEditorObject.current.id}:${shapeEditorObject.current.origin}`}
              object={shapeEditorObject.current}
              reference={shapeEditorObject.original}
              bufferWidth={canvasSize.width}
              bufferHeight={canvasSize.height}
              cssWidth={containerSize.width}
              cssHeight={containerSize.height}
              onPreview={previewShapeEdit}
              onCommit={commitShapeEdit}
              stitch={uiState.tool.type === "pen" && uiState.tool.stitch}
              addAnchor={uiState.tool.type === "pen" && uiState.tool.addAnchor}
              showAnchors={uiState.tool.type !== "pen" || uiState.tool.showAnchors}
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
