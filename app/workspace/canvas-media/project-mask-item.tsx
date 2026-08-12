"use client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CoreContext, HoverContext, LaurusTransform, UIContext, getNewContextMenuConfig } from "../workspace.client";
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
import { LaurusActiveElement, UIActionType } from "../states/ui-state";
import { DEFAULT_CONTEXT_MENU_CONFIG, LaurusProjectMask } from "../../projects/projects.server";
import { UseMaskPreview } from "../hooks/useMaskPreview";
import { Z_INDEX } from "../workspace.config";
import ContextMenu from "../context-menu";
import {
  capturedRegionCircle,
  captureTriangleIndicesInCircle,
  captureIdAtPoint,
  indicesInCircleFromCentroids,
  peakIdAtPoint,
  polygonCentroids,
} from "./light-source-capture";
import {
  getFrames,
  getImg,
  getLightSourceFrames,
  getMoveFrames,
  getScaleFrames,
  LaurusEffect,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
  LaurusPeak,
  LaurusPolygonPath,
} from "../workspace.server";
import { maskCaptureInputId, maskPeakInputId } from "../effects-utils";

// Intensity written into a_highlight (see recolorHighlight/mask-gl.ts) for every capture's or
// topology peak's own triangles alike, on the active mask that *isn't* the selected one -- lets
// you see where a mesh's other light sources/topology bumps already sit (so a freshly drawn
// circle doesn't land blindly on top of one) without them reading as equally "selected" as the
// one actually being edited. The shader mixes this straight into the stroke's opacity
// (captureEdge = ... * v_highlight), so it degrades gracefully to a fainter outline rather than
// needing a distinct color. Shared between the two so they read as consistently "dim" against
// each other, mirroring HIGHLIGHT_STROKE_COLOR's own single-source-of-truth reasoning
// (mask-gl.ts) for the color itself.
const DIM_HIGHLIGHT = 0.35;

export type ProjectMaskItemSource =
  { kind: "static"; maskData: LaurusMaskResult } | { kind: "live"; mask: UseMaskPreview; sourceImg: LaurusImgResult };

// Combined movement (buffer-pixel^2) under which a capture-relocate drag (see captureDragRef
// below) counts as a no-op and snaps back to its exact starting indices, rather than picking up
// rounding/boundary noise from re-deriving the capture circle at a barely-moved center.
const CAPTURE_DRAG_EPSILON_SQ = 1;

function sameIndices(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const i of a) if (!b.has(i)) return false;
  return true;
}

// Groups a mesh's own polygon indices by which capture (if any) they belong to -- capture_id 0
// means "no capture", so never gets an entry of its own.
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

// Mirrors buildCapturesMap exactly, one topology peak instead of a capture: groups a mesh's own
// polygon indices by which peak (if any) they belong to, using PolygonPath_V1_0's own peak_id
// (0 means "no peak"). This is what recolorHighlight now paints a peak's triangles from, in place
// of the old continuous-distance ring stroke -- see peaksMapRef's own comment.
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

// Screen coordinates -> mesh-local buffer-pixel space (top-left origin, unflipped -- matching
// polygon.d points, not gl_FragCoord's bottom-left-origin space used for lightSourceRef).
function toBufferPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | undefined {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
}

// A mask whose light source epicenter is wired to a "move" effect (see the mount ref-callback
// below) exposes itself this way so handlePlayAll/handlePlayTarget (workspace.client.tsx) can
// trigger its playback imperatively, the same way they call `.play()` on the WAAPI Animations
// they build for img/svg elements -- masks have no such Animation (they render to a WebGL
// canvas, not a CSS transform), so this is the non-WAAPI equivalent.
//
// This file has no useEffect: every one of this mask's own GL-affecting state changes is driven
// either by this component's own event handlers (pointer/click), or -- for state that changes
// elsewhere in the app (active element, tool, texture, ...) -- by the
// file that actually dispatches that change calling straight through one of CoreContext's
// notifyMask* functions, which reach into workspace.client.tsx's maskHandlesRef and invoke the
// matching method below directly. That's what every method past play/stop on this interface is
// for. Two earlier attempts at reacting to this via useEffect dependency arrays (mesh geometry
// torn down and rebuilt whenever the source image changed, then a texture reload firing on every
// capture-relocate commit) each fixed one bug and reintroduced another -- getting a dependency
// array to rerun on exactly the changes that matter and nothing else proved fragile. Pushing the
// update from the exact call site that caused it removes that whole class of bug instead of
// tuning it away.
export interface MaskImperativeHandle {
  // captureId pins playback to one specific capture's own wired equation (see
  // playLightSourceAnimation's resolveTargetCaptureId comment) -- passed by handlePlayTarget,
  // which recovers it straight from the AnimationTarget.inputKey a unit's own preview button
  // built (see maskCaptureInputId/parseMaskCaptureInputId). Omitted by handlePlayAll's bare
  // play(), which still falls back to resolveTargetCaptureId's own guess.
  //
  // peakId is the peak-flavored equivalent, mutually exclusive with captureId: a "light_source"
  // effect wired to one of this mesh's own topology peaks (see maskPeakInputId) ramps that peak's
  // relief rather than an epicenter's dials, so playback drives the height field's uniforms
  // instead of the light list (see playbackPeaksRef).
  play: (effectKey?: string, captureId?: number, peakId?: number) => Promise<void>;
  // Fetch-only half of play(): resolves once this mask's own frames are loaded, to a start()
  // closure that kicks off the actual playback clock -- or to undefined if there's nothing wired
  // to play, or if a fresher play()/preparePlayback() call superseded this one while it was
  // loading. Lets a caller juggling several masks at once (handlePlayAll) await every one of
  // their frames before starting any of their clocks, so a slow fetch on one mask doesn't
  // visibly stagger its start relative to the others -- see this method's implementation
  // (preparePlayback) for why play() alone doesn't already do this.
  preparePlayback: (
    effectKey?: string,
    captureId?: number,
    peakId?: number,
  ) => Promise<(() => Promise<void>) | undefined>;
  stop: () => void;
  // Mirrors the old tool-change effect: aborts a capture-relocate drag in progress on this mesh
  // (if any) the moment the tool stops being "move" elsewhere in the app.
  abortCaptureDragForToolChange: (newToolType: string) => void;
  // Same reasoning as abortCaptureDragForToolChange, for a topology elevate/move drag in progress
  // -- takes no toolType, unlike its capture sibling, since notifyMaskToolChanged("mask") fires
  // for *both* the capture and topology toggles (see maskbar.tsx), so the passed string alone
  // can't tell which sub-flag actually changed; this re-checks the real current tool off
  // latestRef instead.
  abortTopologyDragForToolChange: () => void;
  // Whether this mask is the app's current active element -- recolors its captured triangles
  // in/out of the highlight accordingly (folded with any pending capture preview, see
  // recolorHighlight), and (via activePeakIdRef's own reset here) its peaks' ring strokes too.
  setActiveHighlighted: (active: boolean) => void;
  // Which of this (already-active) mask's captures reads as the bright one, dimming the rest --
  // see DIM_HIGHLIGHT/recolorHighlight. undefined highlights every capture equally dim.
  setActiveCapture: (captureId: number | undefined) => void;
  // Mirrors setActiveCapture exactly, for this mesh's own topology peaks -- see DIM_HIGHLIGHT/
  // render()'s own peaks-building. undefined highlights every peak equally dim.
  setActivePeak: (peakId: number | undefined) => void;
  setPendingCapture: (indices: Set<number>) => void;
  clearPendingCapture: () => void;
  // The server's response to a just-committed capture change (a relocate drag, a fresh
  // circle-drawn capture, or a clear) -- updates this mask's own idea of which polygons are
  // captured directly off that response rather than off `source`, which is still last render's
  // stale data at the exact point every one of those flows calls this (right after dispatching
  // SetCanvasMask, before React has re-rendered with the new prop). See capturesRef.
  syncCapturedIndices: (updated: LaurusMaskResult) => void;
  // Mirrors setPendingCapture/clearPendingCapture/syncCapturedIndices above, one topology peak
  // edit (creation, or an existing peak's elevate/move drag) at a time instead of a capture --
  // see peaksRef/pendingTopologyRef's own comments.
  setPendingTopology: (edit: PendingTopologyEdit) => void;
  clearPendingTopology: () => void;
  syncPeaks: (updated: LaurusMaskResult) => void;
  // Re-applies this mask's own texture value (ProjectMask_V1_0.texture, persisted server-side via
  // updateProject the same way capture_preview_* is -- see Maskbar's saveTextureField) and resting
  // preview-toggle dial values. Reads off coreState.project.masks by default, but a caller that
  // just optimistically wrote a fresh value (and kicked off persisting it) can pass it directly via
  // `override` -- necessary because this fires synchronously right after that write, before React
  // has re-rendered this component with the new `coreState` prop (same stale-closure hazard
  // syncCapturedIndices avoids above by taking `updated` directly instead of re-reading `source`).
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
  // Only meaningful for placed (static) masks -- see the mount ref-callback below. Omitted by
  // the live-preview call site in canvas.tsx, which has nothing to register (no persisted
  // mediaKey/lightSourceKey yet).
  maskHandlesRef?: RefObject<Map<string, Set<MaskImperativeHandle>> | null>;
  // The mask's own <canvas> element, registered alongside maskHandlesRef in the same mount
  // ref-callback below -- lets a whole-mask CarouselEntry drive it through workspace.client.tsx's
  // WAAPI pipeline (getNewAnimations/getNewAnimationsByTarget) the same way img/svg's own element
  // refs do. Omitted by the live-preview call site for the same reason as maskHandlesRef above.
  maskElementsRef?: RefObject<Map<string, HTMLCanvasElement> | null>;
  // The following four are only meaningful for placed (static) masks too -- they exist purely to
  // mount <ContextMenu> and drive this mesh's own click handling (mirrors ProjectImg/ProjectSvg's
  // own `meta` prop -- see maxZIndex's own comment below for the rest). Omitted by the
  // live-preview call site in canvas.tsx for the same reason as maskHandlesRef above.
  transform?: LaurusTransform;
  framesCacheRef?: RefObject<Map<string, LaurusFrame[]>>;
  meta?: LaurusProjectMask;
  // The highest order among every img/svg/mask in the project -- mirrors ProjectImg/ProjectSvg's
  // own maxZIndex exactly, boosting this mask's zIndex (via Z_INDEX.CONTEXT_MENU_OFFSET) above
  // every other item, and above the marquee/mask tool's interaction-canvas overlay in
  // workspace.client.tsx (Z_INDEX.INTERACTION_CANVAS), while its own context menu is open --
  // otherwise that overlay (pointer-events: auto whenever the mask tool isn't idle) sits on top
  // and swallows clicks meant for the menu's own buttons.
  maxZIndex?: number;
}
/**
 * Renders a mask result on a WebGL canvas -- either the already-complete, persisted result
 * (`source.kind === "static"`) or the mesh still streaming in over the websocket
 * (`source.kind === "live"`, polling a dirty-flagged ref every animation frame since triangles
 * arrive outside React's render cycle). Both share the same GL context setup, curve-mask clip,
 * cursor-follow light source, and texture blend against the source image -- they only differ in where the mesh
 * buffers come from and how often they change. A live preview isn't draggable or selectable:
 * there's no persisted mediaKey yet to attach that state to.
 */
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
  const {
    coreState,
    dispatch,
    notifyMaskActiveElementChanged,
    notifyMaskActiveCaptureChanged,
    notifyMaskActivePeakChanged,
    notifyMaskPendingCaptureSet,
    notifyMaskPendingCaptureCleared,
    notifyMaskCaptureUpdated,
    sendMaskCaptureUpdate,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskPeaksUpdated,
    sendMaskPeakUpdate,
    deleteMaskPeak,
  } = useContext(CoreContext);
  const { selectedMaskKeys, setSelectedMaskKeys, isAltKeyPressed } = useContext(HoverContext);
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
  // [startVertex, vertexCount] per source.maskData.polygons entry, in that same order -- what
  // buildStaticMaskMesh's own vertexRanges returns, kept alongside vertexCountRef since a peak can
  // expand a polygon into more than 3 vertices (see recolorHighlight, which reads this instead of
  // assuming a fixed 3-per-polygon layout).
  const vertexRangesRef = useRef<[number, number][]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const lastCurveCountRef = useRef(0);
  // Where the cursor-driven epicenter currently is, already converted to gl_FragCoord space.
  // radius 0 == inactive. This is the mouse's own light source (the default, hover-driven mode --
  // see the canvas's onMouseMove below) and is always exactly one light; it plays no part once
  // playLightSourceAnimation is running (wiredMoveRef true) -- see playbackLightSourcesRef below
  // for that case instead, which can hold more than one simultaneously.
  const lightSourceRef = useRef<{ x: number; y: number; radius: number; falloff: number }>({
    x: 0,
    y: 0,
    radius: 0,
    falloff: 0,
  });
  const wiredMoveRef = useRef(false);
  // One entry per capture playLightSourceAnimation is currently animating, keyed by captureId --
  // a single-effect preview only ever populates one, but Play All (bare play(), see
  // MaskImperativeHandle) can populate several at once, one per capture with its own wired
  // move/light_source effect, all rendered simultaneously (see mask-gl.ts's array uniforms).
  // render() reads this instead of lightSourceRef/captureSizeRef&co. whenever wiredMoveRef is
  // true. Cleared by stopLightSourceAnimation.
  const playbackLightSourcesRef = useRef<Map<number, MaskLightSource>>(new Map());
  // The peak-flavored counterpart of playbackLightSourcesRef, keyed by peakId -- one entry per
  // topology peak playLightSourceAnimation is currently animating, holding that peak's own solved
  // shape for this frame. A peak's epicenter never moves under playback (an equation ramps
  // elevation/radius/falloff only, see LightSourceEquation_V1_0), so cx/cy stay the peak's own and
  // aren't carried here. Consulted by resolvePeakUniforms; cleared by stopLightSourceAnimation.
  const playbackPeaksRef = useRef<Map<number, { elevation: number; radius: number; falloff: number }>>(new Map());
  // The in-flight playLightSourceAnimation() session, if any -- lets stopLightSourceAnimation() (and a
  // fresh play() call) cancel whatever's currently running instead of two loops racing.
  const activePlaybackRef = useRef<{ rafId: number | undefined; resolve: () => void } | undefined>(undefined);
  // A capture-relocate drag in progress (move tool, grabbed directly on the mesh's own captured
  // triangles rather than its body -- see the canvas's onPointerDown below). A ref, not state:
  // nothing about the drag needs to trigger a re-render, since the live preview already comes
  // free from pendingCaptureRef/recolorHighlight once setPendingCapture is called (locally or via
  // notifyMaskPendingCaptureSet). originalIndices lets a true zero-movement drag snap back to
  // exactly what it started as instead of picking up boundary noise from re-deriving the circle
  // at every tick.
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
  // The circle actually behind each of the mesh's current captures, if a previous relocate drag in
  // this same component instance is the reason it looks the way it does -- carried forward and
  // only ever translated (radius untouched) by later drags, rather than re-derived from the
  // resulting triangles via capturedRegionCircle every time. Re-deriving on every commit was the
  // original bug here: capturedRegionCircle's circle is centered on the captured centroids' own
  // mean, not the actual drag circle's center, so re-running the circle test from that
  // slightly-off center tends to pick up a few extra boundary triangles -- and since each
  // relocation re-derived from whatever the *previous* one left behind, that error compounded
  // every drag until the capture ate the whole mesh. Keyed by captureId (not a single slot) since
  // a mesh can carry more than one capture -- a single-slot version of this cache still hit the
  // same growth bug whenever two captures were dragged alternately, each drag evicting the other's
  // cached circle and forcing a fresh capturedRegionCircle reconstruction every time. `indices`
  // records which captured set a given entry's circle is known to produce, so a drag that starts
  // after that capture changed some other way (a fresh circle-drawn capture, a clear, page load)
  // detects the mismatch and falls back to a one-time capturedRegionCircle estimate instead of
  // trusting a stale circle.
  const lastKnownCaptureRef = useRef<
    Map<number, { indices: Set<number>; circle: { cx: number; cy: number; radius: number } }>
  >(new Map());
  // captureIds with a relocate commit currently in flight -- checked by onPointerDown to refuse
  // starting a second relocate drag on the same capture until the server acks the first. Without
  // this, grabbing a capture again before that ack lands raced the two commits: the second drag's
  // onPointerDown still read `source.maskData.polygons` (which won't reflect the first commit
  // until it resolves), so it rederived its start circle from the *original* pre-drag position and
  // the capture visibly hopped back there. Simpler than trying to reconcile the two -- just make a
  // second relocate impossible until the first is confirmed.
  const captureCommitInFlightRef = useRef<Set<number>>(new Set());
  // Mirrors captureDragRef's presence in state (rather than being read off the ref directly) so
  // the "grabbing" cursor below can react to it -- dnd-kit's own `isDragging` never turns on for
  // this gesture, since onPointerDown claims it via stopPropagation before dnd-kit's sensor ever
  // sees the pointer.
  const [isDraggingCapture, setIsDraggingCapture] = useState(false);
  // A topology elevate/move drag in progress (topology tool, grabbed directly on an existing
  // peak's own epicenter -- see the canvas's onPointerDown below). Mirrors captureDragRef exactly:
  // a ref, not state, since the live preview comes free from pendingTopologyRef/render() once
  // setPendingTopology is called (locally or via notifyMaskPendingTopologySet).
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
        rafId: number | undefined;
        latestX: number;
        latestY: number;
        // Nothing but scalars: a drag no longer needs a geometry snapshot at all. It used to carry
        // the mesh's parsed/welded points so each rAF tick could re-warp a pristine copy on the CPU,
        // because the displacement was baked into the vertex buffers. Now the displacement is a
        // shader uniform (see mask-gl.ts's PEAK_FIELD_GLSL), so a tick's whole job is to publish the
        // peak's new epicenter and let the next draw evaluate the field from it.
      }
    | undefined
  >(undefined);
  // peakIds with an elevate/move commit currently in flight -- mirrors captureCommitInFlightRef's
  // own reasoning exactly (refuse a second drag on the same peak until the first's ack lands).
  const peakCommitInFlightRef = useRef<Set<number>>(new Set());
  // Mirrors isDraggingCapture's own reasoning (dnd-kit's isDragging never turns on for this
  // gesture either).
  const [isDraggingTopology, setIsDraggingTopology] = useState(false);
  // This mesh's own persisted peaks, by id -- mirrors capturesRef exactly: kept in sync directly
  // off the server's own response (syncPeaks) rather than re-derived from source.maskData.peaks on
  // every render, for the same staleness reason capturesRef never is (see its own comment).
  const peaksRef = useRef<LaurusPeak[]>([]);
  // The one topology peak edit currently in flight (a fresh circle-drawn peak, or an existing
  // peak's elevate/move drag), if any -- mirrors pendingCaptureRef exactly, and always wins over
  // peaksRef for that one peak's id when present (see render()'s own peaks list below).
  const pendingTopologyRef = useRef<PendingTopologyEdit | undefined>(undefined);
  // This mesh's own current highlight inputs -- mirrors what the old highlightedPolygonIndices
  // memo derived reactively, but pushed imperatively instead: pendingCaptureRef is set/cleared
  // both locally (this file's own pointer handlers) and externally (canvas.tsx's circle-draw
  // capture flow, via notifyMaskPendingCaptureSet/Cleared) and always wins when present;
  // activeHighlightRef mirrors whether this mask is uiState.activeElement, kept in sync by
  // setActiveHighlighted below. capturesRef is what activeHighlightRef actually paints --
  // deliberately NOT re-derived from source.maskData.polygons on every recolor: a capture commit
  // (this file's onPointerUp, captureMeshSection, the capture context-menu's delete)
  // dispatches SetCanvasMask and then immediately wants the new indices to paint, but dispatch()
  // doesn't apply synchronously -- `source` is still last render's stale polygons at that exact
  // point, so deriving from it right there would (and did) paint the *previous* capture for one
  // render's worth of time, which is what a mesh with a wired move effect briefly recentering
  // on the old spot -- or a whole relocate drag appearing to snap back -- actually was. Every one
  // of those call sites instead calls notifyMaskCaptureUpdated with the LaurusMaskResult it just
  // got back from the server, which updates this ref directly off the real response instead of
  // waiting on a re-render. See recolorHighlight.
  const pendingCaptureRef = useRef<Set<number> | undefined>(undefined);
  const activeHighlightRef = useRef(false);
  // Every one of this mesh's own captures, by id -- what activeHighlightRef actually paints (one
  // bright, the rest dim -- see activeCaptureIdRef/DIM_HIGHLIGHT/recolorHighlight).
  // Deliberately NOT re-derived from source.maskData.polygons on every recolor, for the same
  // staleness reason capturedIndicesRef never was (see the comment above): kept in sync directly
  // off the server's own response by syncCapturedIndices instead.
  const capturesRef = useRef<Map<number, Set<number>>>(new Map());
  // Which capture (if any) reads as the bright one among capturesRef's -- mirrors
  // uiState.activeElement's own captureId when its type is "capture", refreshed on mount/via
  // setActiveCapture below for the same reason activeHighlightRef mirrors uiState.activeElement
  // itself.
  const activeCaptureIdRef = useRef<number | undefined>(undefined);
  // Every one of this mesh's own topology peaks, by id -- mirrors capturesRef exactly (built with
  // buildPeaksMap instead of buildCapturesMap, off PolygonPath_V1_0's own peak_id), and what
  // activeHighlightRef actually paints for peaks the same way capturesRef does for captures. Kept
  // in sync directly off the server's own response by syncPeaks, for the same staleness reason as
  // capturesRef.
  const peaksMapRef = useRef<Map<number, Set<number>>>(new Map());
  // Every polygon's own centroid, in polygons order -- the parse-once cache behind recolorHighlight's
  // pending-peak circle test (see polygonCentroids, light-source-capture.ts). Refreshed wherever
  // peaksMapRef/capturesRef are, since all three are derived from the same polygons array and go
  // stale together; a mask's triangulation itself never changes after it's built, so nothing else
  // can invalidate it.
  const polygonCentroidsRef = useRef<[number, number][]>([]);
  // Which of this mesh's own peaks (peaksMapRef above) reads as the bright one -- mirrors
  // activeCaptureIdRef exactly, one peakId instead of a captureId, refreshed on mount/via
  // setActivePeak below.
  const activePeakIdRef = useRef<number | undefined>(undefined);

  // Which of this mesh's own polygon indices a capture-relocate drag would land on if released
  // `dx`/`dy` (buffer pixels) away from where it started -- shared by the rAF-throttled live
  // preview (onPointerMove) and the synchronous final commit (onPointerUp), so both agree on
  // exactly the same rule for "did this actually move".
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

  // Throttled to one recompute per frame (rAF, mirrors rafRef's playback loop above) -- an
  // unthrottled per-pointermove recompute would re-hit-test and fully re-upload the mesh's color
  // buffer (recolorHighlight below) synchronously on every raw pointer event.
  const recomputeCaptureDrag = useCallback(() => {
    const drag = captureDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const indices = captureIndicesAtOffset(drag, drag.latestX - drag.startX, drag.latestY - drag.startY);
    dispatch({
      type: CoreActionType.SetPendingLightSourceCapture,
      value: { maskKey: mediaKey, captureId: drag.captureId, polygonIndices: [...indices] },
    });
    notifyMaskPendingCaptureSet(mediaKey, indices);
  }, [captureIndicesAtOffset, mediaKey, dispatch, notifyMaskPendingCaptureSet]);

  // Abandons an in-progress capture-relocate drag without persisting anything -- used both by a
  // browser-interrupted gesture (onPointerCancel), the tool-change safety net (now
  // abortCaptureDragForToolChange, called via notifyMaskToolChanged), and onPointerCancel below.
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

  // The one place the shader's peak state is assembled: this mesh's persisted peaks, with any edit
  // that's mid-flight to the server overriding the peak it belongs to. A pending edit for an id that
  // isn't in peaksRef yet is a peak being created, so it appears rather than being dropped.
  //
  // This is the whole preview mechanism. Because the height field is evaluated from uniforms rather
  // than baked into vertex buffers (see mask-gl.ts's PEAK_FIELD_GLSL), "showing an uncommitted edit"
  // and "showing the committed state" are the same code path with different numbers in it -- which is
  // what makes a live drag or slider preview exact rather than an approximation of what the commit
  // will look like. It also means the preview costs one uniform upload per frame and no buffer
  // traffic at all.
  //
  // Playback (playbackPeaksRef) overrides the same way a pending edit does, and takes precedence
  // over it: the two never legitimately coexist -- a peak-driving effect only plays once its
  // slider edits have committed -- and if a stale pending edit ever did linger, the animation
  // being watched is the one that should win. Only elevation/radius/falloff come from playback;
  // the epicenter stays wherever the peak actually sits.
  const resolvePeakUniforms = useCallback((): PeakGeometryInput[] => {
    const pending = pendingTopologyRef.current;
    const peaks = peaksRef.current.map((peak): PeakGeometryInput => {
      const playing = playbackPeaksRef.current.get(peak.id);
      if (playing) {
        return {
          cx: peak.cx,
          cy: peak.cy,
          radius: playing.radius,
          elevation: playing.elevation,
          falloff: playing.falloff,
        };
      }
      return pending && pending.peakId === peak.id
        ? {
            cx: pending.cx,
            cy: pending.cy,
            radius: pending.radius,
            elevation: pending.elevation,
            falloff: pending.falloff,
          }
        : { cx: peak.cx, cy: peak.cy, radius: peak.radius, elevation: peak.elevation, falloff: peak.falloff };
    });
    if (pending && !peaksRef.current.some((peak) => peak.id === pending.peakId)) {
      peaks.push({
        cx: pending.cx,
        cy: pending.cy,
        radius: pending.radius,
        elevation: pending.elevation,
        falloff: pending.falloff,
      });
    }
    return peaks;
  }, []);

  // Mirrors recomputeCaptureDrag exactly (same rAF throttling, same reasoning) -- dx/dy translate
  // the epicenter. elevation/falloff are left at their originals: a peak's own profile is defined
  // relative to its own radius (see mask-gl.ts's peakProfile), so none of its shape depends on where
  // the epicenter sits and a move needs no rescaling of anything else.
  //
  // Publishing the pending edit is now the entire tick. The existing
  // notifyMaskPendingTopologySet -> setPendingTopology -> recolorHighlight -> render chain already
  // redraws, and render() reads the peak's live position straight out of resolvePeakUniforms, so
  // there's no geometry to rebuild and no separate preview path to keep in step.
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
    };
    dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
    notifyMaskPendingTopologySet(mediaKey, edit);
  }, [mediaKey, dispatch, notifyMaskPendingTopologySet]);

  // Mirrors abortCaptureDrag exactly. Clearing the pending edit is all an abort has to do now: the
  // mesh's own buffers were never touched by the drag, so dropping the override sends the next draw
  // straight back to the peak's resting position with nothing to undo.
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

  // Where the light source actually sits in the mesh (the centroid of its own captured triangles, in
  // the same top-left-origin mesh space as maskData.polygons) -- this is the epicenter's "home"
  // position that a wired move effect's frames (pixel deltas from a resting position, same
  // meaning they have as a CSS `translate`) get added to. Without this, playLightSourceAnimation had
  // no better option than the mesh's geometric center, which is only coincidentally where a
  // light source was actually drawn.
  //
  // Reads pendingCaptureRef/capturesRef (see their comments above) rather than
  // source.maskData.polygons' own `capture_id`s: those refs are updated the instant a
  // capture-relocate drag commits, while `source` only catches up once sendMaskCaptureUpdate's
  // response round-trips and SetCanvasMask has been dispatched *and* re-rendered. Deriving from
  // `source` directly meant Play All, clicked in that window, would animate from the capture's
  // previous location -- the geometry (p.d) a polygon index maps to doesn't change when a
  // capture moves, only which indices count as captured, so this still needs `source` for the
  // shapes themselves, just not for which ones are currently captured.
  //
  // A wired move/light_source effect targets one particular capture (its math is keyed by
  // maskCaptureInputId(mediaKey, captureId), not mediaKey alone -- see effects-utils.ts), so
  // playback needs to settle on *which* capture before it can look up that effect or anchor on
  // its rest position: whichever one is currently selected (activeCaptureIdRef), or failing that
  // the mesh's first capture -- deterministic and, for the common single-capture case, the only
  // one there is anyway. Shared by computeLightSourceRestPosition (below) and
  // playLightSourceAnimation, which must agree on the same capture or the epicenter would move
  // relative to one capture while playing back another's equation.
  const resolveTargetCaptureId = useCallback((): number | undefined => {
    if (activeCaptureIdRef.current !== undefined) return activeCaptureIdRef.current;
    return capturesRef.current.keys().next().value;
  }, []);

  // captureIdOverride lets a caller that has already settled on a specific capture (playback,
  // which must anchor on the exact same capture its wired equation was resolved for) skip this
  // function's own resolveTargetCaptureId guess and hand that capture straight through instead.
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
  // isDragging (dnd-kit's own) never turns on for a capture-relocate or topology drag --
  // onPointerDown claims that gesture via stopPropagation before dnd-kit's sensor sees the pointer
  // -- so isDraggingCapture/isDraggingTopology cover them separately. Routed through the same
  // tool-cursor logic img/svg use (see useToolCursor) rather than a bespoke ternary -- a live
  // preview has no persisted mediaKey to select, so it passes `undefined` rather than "mask" to
  // keep it out of any tool's targets.
  const cursor = useToolCursor({
    target: source.kind === "static" ? "mask" : undefined,
    dragDisabled,
    isDragging: isDragging || isDraggingCapture || isDraggingTopology,
  });

  const render = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;
    // Playback (wiredMoveRef) owns however many lights playLightSourceAnimation is currently
    // animating; otherwise it's just the cursor's own single light, using the mask's resting
    // preview-toggle dial values (captureIntensityRef&co.) rather than anything per-capture.
    const lightSources: MaskLightSource[] = wiredMoveRef.current
      ? Array.from(playbackLightSourcesRef.current.values())
      : [
          {
            ...lightSourceRef.current,
            intensity: captureIntensityRef.current,
            darkness: captureDarknessRef.current,
          },
        ];
    // Peaks are uniforms, read fresh every frame (see resolvePeakUniforms) -- so an edit to one is a
    // handful of floats and a redraw, never a buffer rewrite. What the mesh's own vertex buffers
    // still carry is the *topology* subdivision refreshed at commit time by syncPeaks below, which is
    // only there to give the shader's displacement enough vertices to bend. A peak's highlighting is
    // the one peak-related thing that is genuinely per-vertex: see recolorHighlight/peaksMapRef.
    drawMaskMesh(state, {
      vertexCount: vertexCountRef.current,
      lightSources,
      peaks: resolvePeakUniforms(),
      texture: textureRef.current,
      textureMix: textureMixRef.current,
      maskTexture: maskTextureRef.current,
      glowColor: glowColorRef.current,
    });
  }, [resolvePeakUniforms]);

  // Marks the mesh's covered triangles to reflect pendingCaptureRef/activeHighlightRef (see
  // their own comment) by re-uploading the shader's a_highlight buffer -- a 1.0/0.0 flag per
  // vertex that the fragment shader (mask-gl.ts) uses to draw a sky-blue stroke along those
  // triangles' edges, leaving colorBuffer -- and so the mesh's own fill -- untouched. Vertex
  // layout mirrors buildStaticMaskMesh's own vertexRanges (vertexRangesRef) -- unlike a plain
  // fixed "3 vertices per polygon" offset, a polygon near an active peak's own epicenter can have
  // expanded into many more than 3 (see subdivideMeshForPeaks, mask-gl.ts), so this has to look
  // up each polygon's own actual range rather than compute one. Stable (empty deps, reads
  // everything through refs, including source via latestRef below) -- called both from this file's
  // own local handlers and from the mount-created MaskImperativeHandle's methods, which may run
  // long after the render that created them.
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
    } else if (activeHighlightRef.current) {
      const activeCaptureId = activeCaptureIdRef.current;
      capturesRef.current.forEach((indices, captureId) => {
        paint(indices, captureId === activeCaptureId ? 1 : DIM_HIGHLIGHT);
      });
    }

    // Mirrors the capture precedence immediately above, one topology peak instead of a capture:
    // peaksMapRef (built with buildPeaksMap off PolygonPath_V1_0's own peak_id) is what an active
    // mesh paints, one peak bright and the rest dim. A drag/create preview (pendingTopologyRef) has
    // no polygon_indices of its own the way pendingCaptureRef does -- only a circle -- so its
    // triangles are re-derived on the fly by the same centroid-in-circle test the eventual commit's
    // own polygon_indices use (see createTopologyPeak/onPointerUp below); every other peak goes fully
    // dark for that one frame, the same way capturesRef's other captures do while pendingCaptureRef
    // is set.
    //
    // Against the cached centroids rather than captureTriangleIndicesInCircle, which would re-parse
    // every triangle's `d` with a regex. That mattered little when a pending edit only existed for the
    // duration of a round trip, but a peak's parameters are live-previewable now, so this path runs on
    // every animation frame of a slider or epicenter drag -- see polygonCentroidsRef.
    const pendingTopology = pendingTopologyRef.current;
    if (pendingTopology) {
      paint(indicesInCircleFromCentroids(polygonCentroidsRef.current, pendingTopology), 1);
    } else if (activeHighlightRef.current) {
      const activePeakId = activePeakIdRef.current;
      peaksMapRef.current.forEach((indices, peakId) => {
        paint(indices, peakId === activePeakId ? 1 : DIM_HIGHLIGHT);
      });
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, highlights, gl.STATIC_DRAW);
    render();
  }, [render]);

  // Resets the preview dials (size/intensity/falloff/darkness) to this mask's own starting
  // appearance (ProjectMask_V1_0.capture_preview_*, set via LightSourcebar/Maskbar and persisted
  // the same way scale_x/scale_y are) -- shared by applyMaskAppearanceDefaults (below, via
  // latestRef) and by stopLightSourceAnimation, so leaving mouse control or finishing a
  // wired-effect playback both land back on the same static baseline instead of stranding the
  // dials at whatever a played frame last set them to.
  const applyDefaultCaptureValue = useCallback(() => {
    if (source.kind !== "static") return;
    const maskMeta = coreState.project.masks.get(mediaKey);
    captureSizeRef.current = maskMeta?.capture_preview_size ?? DEFAULT_CAPTURE_VALUE.size;
    captureIntensityRef.current = maskMeta?.capture_preview_intensity ?? DEFAULT_CAPTURE_VALUE.intensity;
    captureFalloffRef.current = maskMeta?.capture_preview_falloff ?? DEFAULT_CAPTURE_VALUE.falloff;
    captureDarknessRef.current = maskMeta?.capture_preview_darkness ?? DEFAULT_CAPTURE_VALUE.darkness;
  }, [source, coreState.project.masks, mediaKey]);

  // Cancels whatever playLightSourceAnimation() session is currently running (if any), resolving its
  // promise so callers awaiting it don't hang, and returns the epicenter to mouse control --
  // mirrors handleStopAll's `el.getAnimations().forEach(a => a.cancel())` for WAAPI elements. Also
  // called on natural completion (see playLightSourceAnimation's loop below): there's no fast-forward
  // button yet to justify holding on the final frame like the real WAAPI animations' fill:
  // "forwards" do, so playback -- however it ends -- always leaves the canvas back at its
  // original, unanimated state rather than parked mid-effect.
  const stopLightSourceAnimation = useCallback(() => {
    const session = activePlaybackRef.current;
    if (session) {
      if (session.rafId !== undefined) cancelAnimationFrame(session.rafId);
      activePlaybackRef.current = undefined;
      session.resolve();
    }
    wiredMoveRef.current = false;
    playbackLightSourcesRef.current = new Map();
    // Dropping these sends the next draw straight back to every peak's persisted relief, the same
    // way abortTopologyDrag does for a drag -- the mesh's own buffers were never touched.
    playbackPeaksRef.current = new Map();
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    applyDefaultCaptureValue();
    render();
  }, [render, applyDefaultCaptureValue]);

  // Plays the light source epicenter/dials through whichever "move" and/or "light_source" effects are
  // wired to this mask's light source key (see lightSourceKey above) instead of the mouse; the mouse handlers
  // below defer to this once wiredMoveRef is set. Resolves immediately if neither is wired -- see
  // MaskImperativeHandle.
  //
  // An effectKey (passed by handlePlayTarget's single-effect preview, e.g. LightSourceUnitbar's
  // "preview" button) restricts this to just the one effect the button belongs to -- otherwise a
  // light_source-only preview would also drag the epicenter through a move effect that happens to
  // share this lightSourceKey, which isn't what "preview this effect" means. In that case the two
  // effects share one timeline taken from whichever is present (move's own start/end/fps wins if
  // both are wired, since position is the primary consumer of "duration" here), and each is fetched
  // by its own id via getMoveFrames/getLightSourceFrames.
  //
  // handlePlayAll omits effectKey, and Play All needs every move/light_source effect wired to this
  // key played in sequence -- not just the first one found -- the same way img/svg's WAAPI playback
  // does (see getNewAnimations). So the effectKey === undefined case instead fetches one pre-merged,
  // project-wide frame timeline via getFrames, matching how the backend already solves multiple
  // effects (including gaps between them, e.g. a move ending at t=2 and the next starting at t=5)
  // for img/svg inputs -- getMoveFrames/getLightSourceFrames only ever solve a single effect's own
  // window and have no notion of siblings sharing this key.
  //
  // Split into a fetch phase (this) and a start phase (the closure it resolves to) so a caller
  // juggling several of these at once -- handlePlayAll, across several masks -- can await every
  // target's frames before starting any of their clocks. Starting each clock the instant its own
  // fetch resolved (the old, single-phase shape) made Play All's masks visibly stagger: each
  // mask's own getFrames round-trip has independent network/server-solve latency, so nothing
  // guaranteed they resolved together. Resolves to undefined if nothing's wired to play, or if a
  // fresher play()/stop() superseded this one while its frames were still in flight.
  const preparePlayback = useCallback(
    (effectKey?: string, captureId?: number, peakId?: number): Promise<(() => Promise<void>) | undefined> => {
      stopLightSourceAnimation();
      if (source.kind !== "static") return Promise.resolve(undefined);

      // Play All (bare play(), no effectKey/captureId/peakId given -- see MaskImperativeHandle)
      // animates every one of this mesh's own captures that has something wired, all at once (see
      // mask-gl.ts's array uniforms). A single-effect preview always concerns exactly one capture:
      // the one handlePlayTarget recovered from the preview button's own AnimationTarget.inputKey
      // (captureId), or -- for the rarer case of a caller that only knows the effectKey --
      // resolveTargetCaptureId's own guess.
      const playAll = effectKey === undefined && captureId === undefined && peakId === undefined;
      // A peak-flavored preview drives no capture at all, so it contributes nothing here -- its
      // own target is resolved separately below (peakTargets).
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
          // A capture's own "radius" isn't a stored value -- unlike move/light_source, "scale"
          // doesn't set an absolute epicenter/dial, it multiplies whatever the light glow's radius
          // would otherwise be (light_source's own size dial, or the mask's resting default if
          // nothing else is wired) by this equation's resolved sx. See the render loop below.
          const wiredScale = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "scale" }> =>
              effect.type === "scale" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          return { captureId: id, inputId, wiredMove, wiredLightSource, wiredScale };
        })
        .filter((t) => t.wiredMove || t.wiredLightSource || t.wiredScale)
        // Read once, right before playback starts, not memoized on `source` -- see
        // computeLightSourceRestPosition's comment. Anchored on the exact same capture each
        // target resolved above, so a capture's epicenter never anchors on a different capture
        // than the one whose frames are driving it.
        .map((t) => ({ ...t, restPosition: computeLightSourceRestPosition(t.captureId) }));

      // The peak half of the same resolution, mirroring `targets` above. Only "light_source" can
      // wire a peak (a peak has no transform for move/scale to act on), so there's one effect kind
      // to look for rather than three, and no rest position to anchor: a peak's epicenter is its
      // own cx/cy and playback never moves it (see playbackPeaksRef).
      const candidatePeakIds = playAll ? peaksRef.current.map((peak) => peak.id) : peakId !== undefined ? [peakId] : [];
      const peakTargets = candidatePeakIds
        .map((id) => {
          const inputId = maskPeakInputId(mediaKey, id);
          const wiredLightSource = coreState.effects.find(
            (effect): effect is Extract<LaurusEffect, { type: "light_source" }> =>
              effect.type === "light_source" &&
              effect.value.math.has(inputId) &&
              (effectKey === undefined || effect.key === effectKey),
          );
          return { peakId: id, inputId, wiredLightSource };
        })
        .filter((t) => t.wiredLightSource);

      if (targets.length === 0 && peakTargets.length === 0) return Promise.resolve(undefined);

      // Only the capture half of playback owns the light list -- a peak-only preview leaves the
      // mesh lit exactly as it was (its resting dials, or the cursor's own light), since flipping
      // this on with no capture targets would swap in an empty playbackLightSourcesRef and darken
      // the mesh for the duration of an animation that has nothing to do with its lighting.
      wiredMoveRef.current = targets.length > 0;

      // Keyed by captureId, same as targets/playbackLightSourcesRef -- playAll fetches one
      // pre-merged, project-wide frame timeline per target capture (matching how the backend
      // already solves multiple effects -- including gaps between them -- for img/svg inputs);
      // a single-target preview instead fetches that one target's own move/light_source frames
      // directly, each solved only over that one effect's own start/end window.
      const mergedFramesByCapture = new Map<number, LaurusFrame[]>();
      const moveFramesByCapture = new Map<number, LaurusFrame[]>();
      const lightSourceFramesByCapture = new Map<number, LaurusFrame[]>();
      const scaleFramesByCapture = new Map<number, LaurusFrame[]>();
      // Keyed by peakId, mirroring the four above -- one timeline per peak being animated, whether
      // it came from playAll's merged solve or a single peak's own light_source frames.
      const framesByPeak = new Map<number, LaurusFrame[]>();
      const session: { rafId: number | undefined; resolve: () => void } = { rafId: undefined, resolve: () => {} };
      activePlaybackRef.current = session;

      const projectFps = coreState.project.fps > 0 ? coreState.project.fps : 30;
      let fps: number;
      let totalFrames: number;
      let durationSeconds: number;
      let ready: Promise<void>;

      // Same cache workspace.client.tsx's getNewAnimations already threads through for img/svg
      // frames (framesCacheRef), and the same invalidation rule: a fetch's own inputId (not the
      // cacheKey it's stored under, which for move/light_source frames also folds in which kind
      // -- see below) is only trusted from cache while SetEffect/SetEffects's own reducer logic
      // hasn't added it to inputsToRender. cacheKey and inputId are the same string for playAll's
      // merged frames (one entry per capture, just like an img/svg's own inputKey), but diverge
      // for a single-effect preview -- a capture can have a wired move AND light_source at once,
      // each with its own frames, sharing that one inputId.
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
        // Refined once every target's getFrames resolves below -- read only after `ready`
        // resolves, so these are never read mid-fetch.
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
          // Peaks go through the same project-wide merged solve their captures do -- a peak's own
          // input_id is just another input as far as /frames is concerned.
          ...peakTargets.map((t) =>
            fetchFramesCached(t.inputId, t.inputId, () =>
              getFrames(coreState.apiOrigin, coreState.project.project_id, t.inputId, fps),
            ).then((result) => {
              if (activePlaybackRef.current !== session) return;
              framesByPeak.set(t.peakId, result ?? []);
            }),
          ),
        ]).then(() => {
          if (activePlaybackRef.current !== session) return;
          totalFrames = Math.max(
            1,
            ...Array.from(mergedFramesByCapture.values()).map((f) => f.length),
            ...Array.from(framesByPeak.values()).map((f) => f.length),
          );
          durationSeconds = totalFrames / fps;
        });
      } else if (targets.length === 0) {
        // A peak-flavored preview -- mutually exclusive with the capture case below, since
        // handlePlayTarget passes exactly one of captureId/peakId (see this function's own
        // candidateCaptureIds/candidatePeakIds above). Always exactly one peak, and always exactly
        // one effect kind, so there's a single fetch and the timeline comes straight from it.
        const peakTarget = peakTargets[0];
        const wiredLightSource = peakTarget.wiredLightSource!;
        const timingValue = wiredLightSource.value;
        fps = timingValue.fps > 0 ? timingValue.fps : projectFps;
        totalFrames = Math.max(Math.round((timingValue.end - timingValue.start) * fps), 1);
        durationSeconds = totalFrames / fps;
        ready = fetchFramesCached(peakTarget.inputId, `light_source:${peakTarget.inputId}`, () =>
          getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, peakTarget.inputId),
        ).then((result) => {
          if (activePlaybackRef.current === session && result) framesByPeak.set(peakTarget.peakId, result);
        });
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
        // Superseded by a stop() or another play()/preparePlayback() while frames were in
        // flight -- don't hand back a start() that would clobber whatever's running now.
        if (activePlaybackRef.current !== session) return undefined;

        return () =>
          new Promise<void>((resolve) => {
            session.resolve = resolve;
            const loopStartMs = performance.now();

            const loop = () => {
              // Superseded by a stop() or another play() while this tick was in flight.
              if (activePlaybackRef.current !== session) return;

              const elapsedSeconds = (performance.now() - loopStartMs) / 1000;
              // Clamped, not wrapped: any repeat/reverse pattern (LaurusLoopType) is already baked
              // into `frames` by the server's own equation solve, and the real WAAPI playback always
              // plays it with iterations: 1 (see getNewAnimationsByTarget's animationOptions) -- so
              // restarting this from frame 0 once elapsed exceeds the duration would invent a loop the
              // equation never asked for.
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
                  // Gated on wiredLightSource even in the merged-frames case: merge_frames
                  // (server-side) fills capture_size/intensity/falloff/darkness with 0 whenever
                  // no light_source effect is wired for this capture, and unlike a move's x/y=0 (a
                  // legitimate "stay at rest" no-op) a capture_size/falloff of 0 would actively
                  // drop this capture's light out of drawMaskMesh's activeLights filter, killing it
                  // entirely rather than just leaving it unmoved.
                  const capturePoint = playAll
                    ? t.wiredLightSource
                      ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                      : undefined
                    : lightSourceFrames && lightSourceFrames.length > 0
                      ? lightSourceFrames[Math.min(frameIndex, lightSourceFrames.length - 1)]
                      : undefined;
                  // No gating needed here the way capturePoint needs it above: both merge_frames
                  // (server) and getScaleFrames' own unwired case leave sx at 1 -- already the
                  // correct "no scale wired" neutral multiplier, not a value that would zero anything
                  // out.
                  const scalePoint = playAll
                    ? mergedFrames?.[Math.min(frameIndex, (mergedFrames?.length ?? 1) - 1)]
                    : scaleFrames && scaleFrames.length > 0
                      ? scaleFrames[Math.min(frameIndex, scaleFrames.length - 1)]
                      : undefined;

                  // point.x/y are a pixel-space delta from the mesh's own resting position -- the
                  // same meaning they have applied as a CSS `translate` on the real element (see
                  // toKeyframes). Reinterpreted here as a delta from this capture's own rest position
                  // in the mesh instead, converted into buffer-pixel space the same way mouse
                  // coordinates are below. Falls back to the mesh's geometric center only if the
                  // capture's own position couldn't be recovered. No move wired for this capture ->
                  // its epicenter just stays at rest, so the dials alone can still be previewed.
                  const restX = t.restPosition?.x ?? canvas.width / 2;
                  const restY = t.restPosition?.y ?? canvas.height / 2;
                  const pointX = movePoint?.x ?? 0;
                  const pointY = movePoint?.y ?? 0;
                  const bufferX = restX + pointX * scaleX;
                  const bufferY = restY + pointY * scaleY;
                  // Falls back to this capture's *own* persisted resting appearance whenever it has
                  // no light_source effect wired -- not the mask's preview-toggle dials, which are
                  // a different concern (the mesh-wide mouse-hover epicenter) and, unlike these,
                  // are measured in on-screen pixels. Mixing the two here would put a screen-space
                  // size on a mesh-space radius below. Only a capture with no registry entry at all
                  // (membership tagged on polygons but the entry itself gone) falls through to the
                  // preview dials, purely so it still draws something.
                  const captureMeta = source.maskData.captures.find((c) => c.id === t.captureId);
                  const size = capturePoint?.capture_size ?? captureMeta?.size ?? captureSizeRef.current;
                  const intensity = capturePoint?.capture_intensity ?? captureMeta?.intensity ?? captureIntensityRef.current;
                  const falloff = capturePoint?.capture_falloff ?? captureMeta?.falloff ?? captureFalloffRef.current;
                  const darkness = capturePoint?.capture_darkness ?? captureMeta?.darkness ?? captureDarknessRef.current;
                  // "scale" doesn't set the radius outright -- it multiplies whatever `size` above
                  // already resolved to, the same relative-not-absolute role scale_x/scale_y play
                  // for an img/svg's own base size. sy is unused: the light glow is a circle, with
                  // one radius, not an ellipse.
                  const scaleMultiplier = scalePoint?.sx ?? 1;

                  playbackLightSourcesRef.current.set(t.captureId, {
                    x: bufferX,
                    // gl_FragCoord's origin is bottom-left; the DOM's is top-left.
                    y: canvas.height - bufferY,
                    // No scaleX on either of these, unlike the cursor-driven preview epicenter
                    // below: a capture's own size/falloff live in the mesh's own space (which is
                    // this canvas's buffer space -- see screenCircleToMeshSpace in canvas.tsx), the
                    // same space the sliders that authored them work in, exactly as a peak's
                    // radius/elevation/falloff already do. That's what lets `size` double as the
                    // capture's own geometry: the circle whose triangles it owns is the same circle
                    // this lights, at any zoom (see saveCaptureSizeField in lightsourcebar.tsx).
                    radius: (size / 2) * scaleMultiplier,
                    falloff,
                    intensity,
                    darkness,
                  });
                });

                // The peak half: each animating peak's solved relief for this frame, published for
                // resolvePeakUniforms to pick up on the render() below. No coordinate conversion
                // like the epicenter's above -- elevation/radius/falloff all live in the mesh's own
                // space already, the same space the sliders that authored them work in.
                peakTargets.forEach((t) => {
                  const frames = framesByPeak.get(t.peakId);
                  if (!frames || frames.length === 0) return;
                  const point = frames[Math.min(frameIndex, frames.length - 1)];
                  playbackPeaksRef.current.set(t.peakId, {
                    elevation: point.peak_elevation,
                    radius: point.peak_radius,
                    falloff: point.peak_falloff,
                  });
                });
                render();
              }

              // Once the duration elapses, resets back to the canvas's original state via
              // stopLightSourceAnimation (see its comment) rather than holding on the final frame --
              // fast-forward's fill: "forwards" hold is deliberately out of scope for now.
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

  // Thin play()-shaped wrapper over preparePlayback for callers (handlePlayTarget's single-effect
  // preview) that don't need to coordinate several of these against each other -- fetch, then
  // start immediately once this one target's own frames are in.
  const playLightSourceAnimation = useCallback(
    (effectKey?: string, captureId?: number, peakId?: number): Promise<void> =>
      preparePlayback(effectKey, captureId, peakId).then((start) => start?.()),
    [preparePlayback],
  );

  // "Always latest" indirection: the mount ref-callback below (and the MaskImperativeHandle it
  // builds) is only created once per mount/mask identity -- not every render -- but a few of its
  // methods need this render's `source`/`coreState`/play-stop rather than whatever was current
  // when it was built. Reassigned every render (plain ref mutation, not a side effect on any
  // external system, so this is safe to do directly in the render body); read only from inside
  // callbacks invoked later, never during render itself.
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

  // Builds this mesh's GL state once per mount (or when mask_media_id genuinely changes -- see
  // the dependency comment below) via React 19's ref-callback cleanup, and registers a
  // MaskImperativeHandle for the lifetime of that same mount into maskHandlesRef, if given one.
  // Replaces what used to be four separate useEffects (geometry setup, source-image texture load,
  // the live-mesh rAF loop, and play/stop registration) -- see this file's own top-of-file
  // comment for why none of this reacts to state via effects anymore.
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
        // Cancels the getImg fallback below (see sourceImgSrc) once this mount's cleanup runs, so
        // a slow response arriving after unmount can't touch gl state that's already torn down.
        const cleanupFns: (() => void)[] = [];

        const colorCanvas = document.createElement("canvas");
        colorCanvas.width = 1;
        colorCanvas.height = 1;
        const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
        const mesh = colorCtx
          ? buildStaticMaskMesh(maskData, colorCtx)
          : { positions: [], colors: [], barycentrics: [], uvs: [], centroids: [], vertexCount: 0, vertexRanges: [] };
        vertexCountRef.current = mesh.vertexCount;
        vertexRangesRef.current = mesh.vertexRanges;
        uploadStaticMaskMesh(state, mesh);
        // Zeroed here; recolorHighlight (called below, once the capture/active state is seeded)
        // uploads the real pattern.
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

        // Source image's own project key, if it's still on the canvas -- imgs are keyed by
        // project element key here, not by img_media_id, so this has to search by value. Only
        // consulted here, at mount, for the initial texture load: once loaded, the texture is its
        // own independent GPU resource, so the source image being deleted or swapped out later
        // has no bearing on it -- this is deliberately not watched reactively.
        let sourceImgSrc: string | undefined;
        for (const [key, img] of coreState.project.imgs) {
          if (img.img_media_id === maskData.source_img_media_id) {
            sourceImgSrc = coreState.canvasImgs.get(key)?.src;
            break;
          }
        }
        // Falls back to the media browser's own list -- a mask dropped straight off an armed
        // img-browser thumbnail (see useMaskPersist/canvas.tsx's handleMaskDrop) never gets a
        // project.imgs entry of its own, so the loop above always misses for it.
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
          // Both caches above are ephemeral (project.imgs only holds *placed* images, browserImgs
          // only whatever page/folder the media browser happens to be showing right now) and can
          // both miss -- e.g. a mask dropped straight from a public-img thumbnail, followed by
          // toggling "browse public imgs" off, drops that image from browserImgs without it ever
          // having been placed. getImg resolves the source image directly by id (kept purely for
          // bookkeeping otherwise -- see MaskMedia's own doc comment), so it works regardless of
          // what's currently placed or browsed.
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
        pendingCaptureRef.current =
          coreState.pendingLightSourceCapture?.maskKey === mediaKey
            ? new Set(coreState.pendingLightSourceCapture.polygonIndices)
            : undefined;
        activeHighlightRef.current =
          (uiState.activeElement?.type === "mask" ||
            uiState.activeElement?.type === "capture" ||
            uiState.activeElement?.type === "peak") &&
          uiState.activeElement.key === mediaKey;
        activeCaptureIdRef.current =
          activeHighlightRef.current && uiState.activeElement?.type === "capture"
            ? uiState.activeElement.captureId
            : undefined;
        activePeakIdRef.current =
          activeHighlightRef.current && uiState.activeElement?.type === "peak"
            ? uiState.activeElement.peakId
            : undefined;
        capturesRef.current = buildCapturesMap(maskData.polygons);
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
          setActiveHighlighted: (active) => {
            activeHighlightRef.current = active;
            if (!active) {
              activeCaptureIdRef.current = undefined;
              activePeakIdRef.current = undefined;
            }
            recolorHighlight();
          },
          setActiveCapture: (captureId) => {
            activeCaptureIdRef.current = captureId;
            recolorHighlight();
          },
          setActivePeak: (peakId) => {
            activePeakIdRef.current = peakId;
            recolorHighlight();
          },
          setPendingCapture: (indices) => {
            pendingCaptureRef.current = indices;
            recolorHighlight();
          },
          clearPendingCapture: () => {
            pendingCaptureRef.current = undefined;
            recolorHighlight();
          },
          syncCapturedIndices: (updated) => {
            const latestSource = latestRef.current.source;
            if (latestSource.kind !== "static") return;
            if (latestSource.maskData.mask_media_id !== updated.mask_media_id) return;
            capturesRef.current = buildCapturesMap(updated.polygons);
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
            // Rebuilds the mesh's geometry buffers from scratch after every committed peak edit --
            // the same build this file's own mount-time setup above already runs once.
            //
            // This is a *topology refresh*, not what makes the edit visible. The peak itself became
            // visible the moment its numbers reached the shader's uniforms (see resolvePeakUniforms
            // and render above); what this recovers is the subdivision -- the extra vertices near the
            // peak that give the shader's displacement enough geometry to bend smoothly rather than
            // in three straight chords (see subdivideMeshForPeaks, mask-gl.ts).
            //
            // Which is also why it only runs on commit and never per drag-tick: since the subdivision
            // budget depends on elevation/radius/falloff, re-tessellating live would mean a full
            // rebuild every frame of a slider drag. The visible consequence of deferring it is that
            // wireframe density and the smoothness of the dome's own linearization settle at the
            // moment of release; the relief itself doesn't move, because per-fragment shading doesn't
            // care how many triangles it's spread across. If that settling ever reads as a pop, the
            // fix is to budget subdivision against a fixed planning elevation rather than the live
            // one, so topology stops depending on the parameter being dragged at all.
            const glState = glStateRef.current;
            if (glState && colorCtx) {
              const mesh = buildStaticMaskMesh(updated, colorCtx);
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
          // Only remove if this mount's own canvas is still the one registered -- guards against
          // a fresher mount's registration (see the set() above) racing ahead of this cleanup.
          if (maskElementsRef?.current?.get(mediaKey) === canvas) {
            maskElementsRef.current.delete(mediaKey);
          }
          latestRef.current.stopLightSourceAnimation();
        };
      }

      // The live mesh: polled every animation frame off mask.meshRefs' dirty-flagged refs, since
      // triangles arrive over the websocket outside React's render cycle and nothing about them
      // needs to trigger a React re-render. No MaskImperativeHandle is registered for a live
      // preview -- it has no persisted mediaKey, drag, or highlight state of its own.
      const { mask, sourceImg } = source;
      const state = initGLState(canvas);
      if (!state) return;
      glStateRef.current = state;
      const { gl } = state;

      let maskCanvas: HTMLCanvasElement | undefined;

      // sourceImg is already in hand (passed straight from the img the user is masking, unlike
      // the static branch's sourceImgSrc which has to be resolved after the fact) -- no lookup or
      // getImg fallback needed here.
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
          // A live preview has no capture/highlight of its own -- always zero, just kept sized to
          // match vertexCount so the shader's a_highlight reads stay in bounds.
          gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexCountRef.current), gl.DYNAMIC_DRAW);
          dirtyRef.current = false;
        }

        // The curve mask only needs rebuilding when a new curve has streamed in, not every frame.
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
      // Deliberately keyed on mask_media_id rather than `source` itself for a static mask: every
      // flow that updates an *existing* mask's polygons this session (captureMeshSection,
      // maskbar's clear-capture, the capture context-menu's delete, and this file's own
      // capture-relocate drag) only ever flips `capture_id`s via sendMaskCaptureUpdate -- shape,
      // fill, stroke, and curves are untouched, so nothing this callback builds (positions, base
      // colors, the source-image texture) is actually stale; those flows reach any mask-specific
      // GL state that *does* need to react (the highlight) through the registered handle's own
      // methods instead, called via notifyMask* right at the point something actually changed.
      // Depending on `source` directly would force a full GL teardown/rebuild (plus an async
      // source-image texture discard-and-reload) on every capture save even though only the
      // highlight needed to react -- the discarded texture took a beat to reload, which is what
      // showed up as a visible color flicker right after dropping a relocated capture.
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

  // Only meaningful for placed (static) masks -- a live preview has no persisted mediaKey to
  // key uiState.projectContextMenus by, and never gets a transform/framesCacheRef/meta from
  // its call site (canvas.tsx) to begin with.
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
            // Lets canvas.tsx's light-source-capture tool find this exact DOM canvas (via
            // document.querySelector) to measure its real on-screen rect for a precise
            // screen -> mesh-buffer-pixel conversion, the same way this component's own
            // onMouseMove handler below already does -- rather than re-derive it from project
            // placement metadata (top/left/scale/frame offsets), which is one more place for
            // that conversion to silently drift out of sync with what's actually on screen.
            data-mask-key={source.kind === "static" ? mediaKey : undefined}
            onClick={(e) => {
              // Not available on a live preview -- there's no persisted mediaKey yet, and no
              // `meta` from this component's own call site (canvas.tsx) to begin with. Every
              // branch below depends on this narrowing (source.maskData, or just the mediaKey
              // being meaningful to dispatch against).
              if (source.kind !== "static") return;
              // Alt-click toggles selection, same as images/svgs (see DraggableProjectImg's
              // onImgClick). So does a plain click while the scale tool is active -- mirroring
              // DraggableProjectImg/Svg's own `case "scale":` in their tool-type switch, which
              // toggles selectedImgKeys/selectedSvgKeys the same way. Excluded on a meta-click so
              // that still falls through to the capture-menu handling below instead of also
              // toggling selection. Mutually exclusive with the metaKey/tool-driven click below,
              // mirroring how DraggableProjectImg's onImgClick only falls through to its tool-type
              // switch once the alt-select branch has already been ruled out. The light source
              // tool shares this same branch (rather than getting its own, like rotate below)
              // since Lightsourcebar, like Scalebar, reads selectedMaskKeys directly and has no
              // need for uiState.activeElement beyond the capture-activation already handled here.
              if (
                isAltKeyPressed ||
                ((uiState.tool.type === "scale" || uiState.tool.type === "light_source") && !e.metaKey)
              ) {
                setSelectedMaskKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                  } else {
                    next.add(mediaKey);
                    // Selecting a mesh that already has a capture activates it immediately, the
                    // same way alt-clicking a wired svg used to -- no extra step to see/wire what
                    // it covers (recolorHighlight above). No particular capture is singled out by
                    // this (every capture on the mesh renders its dim, unselected highlight) --
                    // meta-clicking one specifically (below) is what picks a bright one.
                    if (source.maskData.captures.length > 0) {
                      uiDispatch({ type: UIActionType.SetActiveElement, value: { key: mediaKey, type: "mask" } });
                      notifyMaskActiveElementChanged(mediaKey);
                    }
                  }
                  return next;
                });
                return;
              }
              // A plain click while the rotate tool is active also toggles selection, mirroring
              // the scale-tool branch above -- but doesn't return early, since (unlike scale) the
              // rotate tool still needs the metaKey/tool-driven switch further down to run so its
              // own "rotate" case can set uiState.activeElement, which Rotatebar and other
              // activeElement consumers (e.g. the units carousel) still depend on independently of
              // this selection set.
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
              // Meta-clicking directly on one of the mesh's captures or topology peaks opens that
              // element's own flavor of the context menu instead of the mesh's general one, and
              // selects it (the bright highlight -- Lightsourcebar's own target, for either flavor,
              // see notifyMaskActivePeakChanged/MaskImperativeHandle.setActivePeak) -- hit-tested in
              // the same buffer-pixel space
              // onMouseMove already converts screen coordinates into below (unflipped: polygon.d
              // points, unlike lightSourceRef, are top-left-origin, not gl_FragCoord's). All three
              // flavors share the same shown/hidden toggle further down. A peak hit wins over a
              // capture hit at the same point -- a peak is a much smaller, more deliberate target
              // (point + radius) than a capture's polygon region.
              let hitCaptureId: number | undefined;
              let hitPeakId: number | undefined;
              if (e.metaKey) {
                const canvas = e.currentTarget;
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const bufferX = (e.clientX - rect.left) * scaleX;
                  const bufferY = (e.clientY - rect.top) * scaleY;
                  hitPeakId = peakIdAtPoint(peaksRef.current, [bufferX, bufferY]);
                  if (hitPeakId === undefined) {
                    hitCaptureId = captureIdAtPoint(source.maskData.polygons, [bufferX, bufferY]);
                  }
                }
              }
              const previouslyActiveCaptureId =
                uiState.activeElement?.type === "capture" && uiState.activeElement.key === mediaKey
                  ? uiState.activeElement.captureId
                  : undefined;
              const previouslyActivePeakId =
                uiState.activeElement?.type === "peak" && uiState.activeElement.key === mediaKey
                  ? uiState.activeElement.peakId
                  : undefined;
              if (hitPeakId !== undefined) {
                uiDispatch({
                  type: UIActionType.SetActiveElement,
                  value: { key: mediaKey, type: "peak", peakId: hitPeakId },
                });
                notifyMaskActiveElementChanged(mediaKey);
                notifyMaskActivePeakChanged(mediaKey, hitPeakId);
                // Clear any capture highlight still showing from before this click -- the peak
                // just selected is now this mesh's sole active sub-element.
                notifyMaskActiveCaptureChanged(mediaKey, undefined);
              } else if (hitCaptureId !== undefined) {
                uiDispatch({
                  type: UIActionType.SetActiveElement,
                  value: { key: mediaKey, type: "capture", captureId: hitCaptureId },
                });
                notifyMaskActiveElementChanged(mediaKey);
                notifyMaskActiveCaptureChanged(mediaKey, hitCaptureId);
                // Mirrors the peak branch's own symmetric clear above.
                notifyMaskActivePeakChanged(mediaKey, undefined);
              } else if (
                showContextMenu &&
                (previouslyActiveCaptureId !== undefined || previouslyActivePeakId !== undefined)
              ) {
                // Meta-clicking off the capture/peak while its own menu is still showing switches
                // the display back to the mesh's general flavor -- the <ContextMenu> render below
                // has no separate local flavor to flip (it derives "mask" vs "capture" vs "peak"
                // straight from uiState.activeElement, mirroring the highlight above), so clearing
                // the active element here is what makes that switch happen.
                uiDispatch({ type: UIActionType.SetActiveElement, value: { key: mediaKey, type: "mask" } });
                notifyMaskActiveElementChanged(mediaKey);
                notifyMaskActiveCaptureChanged(mediaKey, undefined);
                notifyMaskActivePeakChanged(mediaKey, undefined);
              }
              // Meta-clicking a different part of the mesh while a menu is already showing
              // switches which flavor is displayed in place, rather than closing it -- the
              // shown/hidden toggle below (shared across all three flavors) only fires when the
              // displayed capture/peak isn't changing, so a second meta-click on the *same* kind
              // of target still closes it as expected.
              if (
                showContextMenu &&
                (previouslyActiveCaptureId !== hitCaptureId || previouslyActivePeakId !== hitPeakId)
              ) {
                return;
              }
              // Mirrors DraggableProjectImg/Svg's own onImgClick metaKey-toggle/tool-switch tail
              // exactly -- the metaKey branch toggles the menu unconditionally; a plain click only
              // toggles it (or moves the active element) for specific tools.
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
                  notifyMaskActiveElementChanged(mediaKey);
                  break;
                }
              }
            }}
            onPointerDown={(e) => {
              if (source.kind !== "static") return;
              // Moving/deleting an existing topology peak -- the move tool grabs one exactly the
              // way it grabs a capture below (so relocating a peak works the same way relocating a
              // capture does, tool for tool), and the topology tool *also* grabs one directly
              // (letting you nudge a peak you're already mid-edit on without switching tools).
              // Alt/meta-click-to-delete is scoped to the topology tool only -- see its own comment
              // below -- so an ordinary move-tool relocate never risks deleting on a stray modifier.
              const isTopologyTool = uiState.tool.type === "mask" && uiState.tool.editingTopology;
              const isMoveTool = uiState.tool.type === "move";
              if (isTopologyTool || isMoveTool) {
                const canvas = e.currentTarget;
                const point = toBufferPoint(canvas, e.clientX, e.clientY);
                const peakId = point ? peakIdAtPoint(peaksRef.current, point) : undefined;
                const peak = peakId !== undefined ? peaksRef.current.find((p) => p.id === peakId) : undefined;
                if (point && peakId !== undefined && peak && !peakCommitInFlightRef.current.has(peakId)) {
                  const [bufferX, bufferY] = point;
                  // Alt/meta-click deletes the peak outright instead of starting a drag -- a
                  // lighter-weight affordance than the context-menu delete cell, consistent with
                  // meta-click already being this app's modifier for "target this specific
                  // sub-element" (see captureIdAtPoint's own callers). Gated on the topology tool
                  // specifically so the move tool's own alt-click-to-select-mask gesture
                  // (ProjectMaskItem's onClick) never doubles as an accidental peak delete.
                  //
                  // Everything the delete actually entails -- the request, reconciling the mask,
                  // refreshing the mesh, and falling the active element back when the peak being
                  // removed was the active one -- lives in deleteMaskPeak (workspace.client.tsx),
                  // shared with the context menu and Maskbar's peak list. This site's only remaining
                  // job is the in-flight guard, which is local to this canvas's own gestures.
                  if (isTopologyTool && (e.altKey || e.metaKey)) {
                    peakCommitInFlightRef.current.add(peakId);
                    void deleteMaskPeak(mediaKey, peakId).finally(() => {
                      peakCommitInFlightRef.current.delete(peakId);
                    });
                    return;
                  }
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
                    rafId: undefined,
                    latestX: bufferX,
                    latestY: bufferY,
                  };
                  setIsDraggingTopology(true);
                  return;
                }
                // The topology tool claims the whole mesh even off a peak, the same way capturing a
                // fresh mesh-section does -- falling through to the capture-relocate/whole-mask-drag
                // logic below would be surprising while actively editing topology. The move tool has
                // no such exclusive claim (see the "isMoveTool" comment below): missing a peak here
                // just falls through to try a capture instead.
                if (isTopologyTool) return;
              }
              // Only the move tool relocates a capture, and only when the gesture actually starts
              // on one of the mesh's own captures -- everywhere else on the mesh (or a mesh with
              // no capture at all) falls through untouched, letting the wrapper div's own
              // dnd-kit listeners (whole-mask drag) see the event exactly as they do today.
              if (uiState.tool.type !== "move") return;
              const canvas = e.currentTarget;
              const point = toBufferPoint(canvas, e.clientX, e.clientY);
              if (!point) return;
              const [bufferX, bufferY] = point;
              const captureId = captureIdAtPoint(source.maskData.polygons, [bufferX, bufferY]);
              if (captureId === undefined) return;
              // A relocate for this exact capture is still awaiting its server ack -- refuse to
              // start another one on top of it (see captureCommitInFlightRef) rather than let the
              // two race. Falls through untouched, same as a click that missed the capture
              // entirely.
              if (captureCommitInFlightRef.current.has(captureId)) return;
              const originalIndices = new Set<number>();
              source.maskData.polygons.forEach((p, i) => {
                if (p.capture_id === captureId) originalIndices.add(i);
              });
              // The capture's own persisted `size` is the authority on its radius -- it *is* the
              // circle this capture owns (see Capture_V1_0), so a relocate can carry it across
              // verbatim instead of reconstructing it. That's what makes the radius stable across
              // any number of relocations: capturedRegionCircle only ever sees the triangles that
              // survived the last test, so re-deriving from them compounds (the growing-capture
              // bug lastKnownCaptureRef was added to work around). The centre still has to be
              // reconstructed -- a capture has no persisted cx/cy of its own, unlike a peak.
              //
              // A capture drawn before `size` existed carries 0, so the cache and the
              // reconstruction both remain as fallbacks for exactly those.
              const persistedSize = source.maskData.captures.find((c) => c.id === captureId)?.size ?? 0;
              const known = lastKnownCaptureRef.current.get(captureId);
              const reconstructed =
                known && sameIndices(known.indices, originalIndices)
                  ? known.circle
                  : capturedRegionCircle(source.maskData.polygons, captureId);
              if (!reconstructed) return;
              const circle = persistedSize > 0 ? { ...reconstructed, radius: persistedSize / 2 } : reconstructed;
              // Claims the gesture before dnd-kit's own onPointerDown (spread as `{...listeners}`
              // on the ancestor wrapper div) gets a chance to see it -- ordinary React synthetic
              // bubbling, confirmed against @dnd-kit/core's actual source. preventDefault also
              // suppresses this pointer's compatibility mouse events (mousedown/move/up/click) per
              // spec, which is what the onMouseMove guard below otherwise has to defend against.
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
              notifyMaskPendingCaptureSet(mediaKey, originalIndices);
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
                // A peak's own profile is defined relative to its own radius (mask-gl.ts's
                // peakProfile), so none of its shape depends on where the epicenter sits -- the
                // drag-start elevation and falloff stay exactly right at any final position.
                const finalElevation = peakDrag.originalElevation;
                const finalFalloff = peakDrag.originalFalloff;
                peakDragRef.current = undefined;
                setIsDraggingTopology(false);
                // Left showing the dragged-to preview until the request resolves -- mirrors the
                // capture relocate's own reasoning below (clearing immediately would fall back to
                // the mesh's still-stale peak position and flash back for the round trip). No
                // separate final geometry sync is needed the way it once was: the pending edit *is*
                // what the shader draws from, so publishing it here is already an exact match for
                // what's being sent, and syncPeaks' eventual rebuild only refreshes the subdivision.
                const edit: PendingTopologyEdit = {
                  maskKey: mediaKey,
                  peakId,
                  cx: finalCx,
                  cy: finalCy,
                  radius: peakDrag.originalRadius,
                  elevation: finalElevation,
                  falloff: finalFalloff,
                };
                dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
                notifyMaskPendingTopologySet(mediaKey, edit);
                peakCommitInFlightRef.current.add(peakId);
                sendMaskPeakUpdate(source.maskData.mask_media_id, {
                  peak_id: peakId,
                  cx: finalCx,
                  cy: finalCy,
                  radius: peakDrag.originalRadius,
                  elevation: finalElevation,
                  falloff: finalFalloff,
                  remove: false,
                  polygon_indices: [
                    ...captureTriangleIndicesInCircle(source.maskData.polygons, {
                      cx: finalCx,
                      cy: finalCy,
                      radius: peakDrag.originalRadius,
                    }),
                  ],
                }).then((updated) => {
                  peakCommitInFlightRef.current.delete(peakId);
                  if (updated) {
                    dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: updated });
                    notifyMaskPeaksUpdated(mediaKey, updated);
                    // Grabbing a peak (even a barely-moved click) makes it the active element --
                    // mirrors the capture relocate's own SetActiveElement below, and is what lets
                    // Lightsourcebar's elevation slider pick it up immediately afterwards.
                    uiDispatch({ type: UIActionType.SetActiveElement, value: { key: mediaKey, type: "peak", peakId } });
                    notifyMaskActiveElementChanged(mediaKey);
                    notifyMaskActivePeakChanged(mediaKey, peakId);
                    // Mirrors the capture relocate's own symmetric clear below.
                    notifyMaskActiveCaptureChanged(mediaKey, undefined);
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
              // Computed synchronously from the up event's own position rather than whatever the
              // last dispatched pending state was, avoiding a race with an outstanding throttled
              // rAF frame from onPointerMove.
              const finalIndices = captureIndicesAtOffset(drag, dx, dy);
              const captureId = drag.captureId;
              const existingCapture = source.maskData.captures.find((c) => c.id === captureId);
              const captureName = existingCapture?.name ?? `light ${captureId}`;
              captureDragRef.current = undefined;
              setIsDraggingCapture(false);
              if (finalIndices.size === 0) {
                // Dropped somewhere with no triangles -- cancel, leaving the mask's persisted
                // capture completely untouched (mirrors handleLightSourceCapture's own "zero
                // indices" early-return for the creation flow). Reaffirms the cache rather than
                // leaving it stale, since nothing about the actual captured set changed.
                lastKnownCaptureRef.current.set(captureId, {
                  indices: drag.originalIndices,
                  circle: drag.originalCircle,
                });
                dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
                notifyMaskPendingCaptureCleared(mediaKey);
                return;
              }
              // Left showing the dragged-to preview until the request resolves -- clearing it
              // immediately would fall back to the mesh's still-stale captured flags and flash back
              // to the original position for the round trip.
              dispatch({
                type: CoreActionType.SetPendingLightSourceCapture,
                value: { maskKey: mediaKey, captureId, polygonIndices: [...finalIndices] },
              });
              notifyMaskPendingCaptureSet(mediaKey, finalIndices);
              // Locks this capture against a second relocate (see onPointerDown /
              // captureCommitInFlightRef) until this request's ack lands, whether it succeeds or
              // fails.
              captureCommitInFlightRef.current.add(captureId);
              sendMaskCaptureUpdate(source.maskData.mask_media_id, {
                capture_id: captureId,
                name: captureName,
                polygon_indices: [...finalIndices],
                // A relocate never touches the capture's own light appearance -- carry it through
                // unchanged, since this websocket call is a full-replace of the whole record.
                size: existingCapture?.size ?? 0,
                intensity: existingCapture?.intensity ?? 0,
                falloff: existingCapture?.falloff ?? 0,
                darkness: existingCapture?.darkness ?? 0,
              }).then(
                (updated) => {
                  captureCommitInFlightRef.current.delete(captureId);
                  if (updated) {
                    dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: updated });
                    // Before the active-element/pending-capture notifies below, which recolor off
                    // this mask's own captured-indices ref -- `source` is still last render's stale
                    // polygons at this exact point (dispatch() doesn't apply synchronously), so
                    // recoloring off it here would briefly repaint the *previous* capture position.
                    notifyMaskCaptureUpdated(mediaKey, updated);
                    uiDispatch({
                      type: UIActionType.SetActiveElement,
                      value: { key: mediaKey, type: "capture", captureId },
                    });
                    notifyMaskActiveElementChanged(mediaKey);
                    notifyMaskActiveCaptureChanged(mediaKey, captureId);
                    // Mirrors the peak relocate's own symmetric clear -- a relocated capture is now
                    // this mesh's sole active sub-element.
                    notifyMaskActivePeakChanged(mediaKey, undefined);
                    // Cache the circle actually used, translated by this drag's own delta -- not
                    // re-derived from the resulting triangles (capturedRegionCircle), which is what
                    // let the radius creep up over successive relocations. See lastKnownCaptureRef.
                    lastKnownCaptureRef.current.set(captureId, {
                      indices: finalIndices,
                      circle: {
                        cx: drag.originalCircle.cx + dx,
                        cy: drag.originalCircle.cy + dy,
                        radius: drag.originalCircle.radius,
                      },
                    });
                  } else {
                    // Request failed -- the server-side capture is still whatever it was before this
                    // drag, so reaffirm that instead of leaving a stale/wrong cache entry behind.
                    lastKnownCaptureRef.current.set(captureId, {
                      indices: drag.originalIndices,
                      circle: drag.originalCircle,
                    });
                  }
                  dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
                  notifyMaskPendingCaptureCleared(mediaKey);
                },
              );
            }}
            onPointerCancel={(e) => {
              // A browser-interrupted gesture (e.g. window blur) shouldn't commit a possibly
              // incomplete drag -- mirrors the abort half of onPointerUp only, never persists.
              const peakDrag = peakDragRef.current;
              if (peakDrag && e.pointerId === peakDrag.pointerId) {
                abortTopologyDrag();
                return;
              }
              const drag = captureDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId) return;
              abortCaptureDrag();
            }}
            onMouseMove={(e) => {
              // A capture-relocate or topology drag owns this mesh's pointer for its duration --
              // defense in depth on top of onPointerDown's preventDefault (which should already
              // suppress the compatibility mousemove for this pointer).
              if (captureDragRef.current || peakDragRef.current) return;
              // A wired move effect (see the mount ref-callback above) owns the epicenter instead
              // -- the mouse no longer drives it for this mesh. Same when the "preview" toggle
              // (Lightsourcebar) is off -- hovering shouldn't run the animation at all.
              if (wiredMoveRef.current || !uiState.lightSourcePreview) return;
              const canvas = e.currentTarget;
              const rect = canvas.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return;
              // The canvas is displayed smaller than its backing resolution, so scale the cursor
              // (and the light source's on-screen size) from CSS pixels into drawing-buffer pixels.
              const scaleX = canvas.width / rect.width;
              const scaleY = canvas.height / rect.height;
              const bufferX = (e.clientX - rect.left) * scaleX;
              const bufferY = (e.clientY - rect.top) * scaleY;
              lightSourceRef.current = {
                x: bufferX,
                // gl_FragCoord's origin is bottom-left; the DOM's is top-left.
                y: canvas.height - bufferY,
                radius: (captureSizeRef.current / 2) * scaleX,
                falloff: captureFalloffRef.current * scaleX,
              };
              render();
            }}
            onMouseLeave={() => {
              if (wiredMoveRef.current) return;
              lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
              render();
            }}
            style={{
              ...containerSize,
              display: "block",
              outline: isSelected ? "2px solid rgba(66, 133, 244, 1)" : "none",
            }}
          />
        </div>
        {showContextMenu && maskMeta && framesCacheRef && (
          <ContextMenu
            media={
              uiState.activeElement?.type === "capture" && uiState.activeElement.key === mediaKey
                ? { key: mediaKey, type: "capture", captureId: uiState.activeElement.captureId, meta: maskMeta }
                : uiState.activeElement?.type === "peak" && uiState.activeElement.key === mediaKey
                  ? { key: mediaKey, type: "peak", peakId: uiState.activeElement.peakId, meta: maskMeta }
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
