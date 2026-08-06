"use client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CoreContext, HoverContext, LaurusTransform, UIContext } from "../workspace.client";
import { RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildStaticMaskMesh,
  colorToRGB01,
  drawMaskMesh,
  GLState,
  initGLState,
  loadImageTexture,
  parsePathPoints,
  TEXTURE_MIX_DEFAULT,
  uploadCurveMask,
} from "../mask-gl";
import { CoreActionType, DEFAULT_LIGHT_SOURCE_VALUE } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { UseMaskPreview } from "../hooks/useMaskPreview";
import { Z_INDEX } from "../workspace.config";
import ContextMenu from "../context-menu";
import { capturedRegionCircle, captureTriangleIndicesInCircle, isPointInCapturedPolygon } from "./light-source-capture";
import {
  getLightSourceFrames,
  getMoveFrames,
  LaurusEffect,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
  updateMaskCapture,
} from "../workspace.server";

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

// Screen coordinates -> mesh-local buffer-pixel space (top-left origin, unflipped -- matching
// polygon.d points, not gl_FragCoord's bottom-left-origin space used for lightSourceRef).
function toBufferPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | undefined {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
}

// A mask whose light source epicenter is wired to a "move" effect (see the registration effect below)
// exposes itself this way so handlePlayAll/handlePlayTarget (workspace.client.tsx) can trigger
// its playback imperatively, the same way they call `.play()` on the WAAPI Animations they build
// for img/svg elements -- masks have no such Animation (they render to a WebGL canvas, not a CSS
// transform), so this is the non-WAAPI equivalent.
export interface MaskLightSourcePlayer {
  // Resolves once playback finishes and the canvas has been reset back to its original state (or
  // immediately, if nothing is wired) -- foldable into the same Promise.all(...) used to detect
  // when to flip playbackMode back to "stopped". An effectKey restricts playback to just that one
  // effect (a single-effect preview, e.g. LightSourceUnitbar's "preview" button) -- omitted
  // (handlePlayAll) plays every wired move/light_source effect together, mixed.
  play: (effectKey?: string) => Promise<void>;
  stop: () => void;
}

interface ProjectMaskItem {
  dndId: string;
  dndPosition: { x: number; y: number };
  zIndex: number;
  mediaKey: string;
  frame: { width: number; height: number; scale_x: number; scale_y: number };
  source: ProjectMaskItemSource;
  title?: string;
  // Only meaningful for placed (static) masks -- see the registration effect below. Omitted by
  // the live-preview call site in canvas.tsx, which has nothing to register (no persisted
  // mediaKey/lightSourceKey yet).
  maskLightSourcePlayersRef?: RefObject<Map<string, Set<MaskLightSourcePlayer>> | null>;
  // The following three are only meaningful for placed (static) masks too -- they exist purely
  // to mount <ContextMenu> with parity to ProjectImg/ProjectSvg (see DraggableProjectMask's
  // onMaskClick). Omitted by the live-preview call site in canvas.tsx for the same reason as
  // maskLightSourcePlayersRef above.
  transform?: LaurusTransform;
  framesCacheRef?: RefObject<Map<string, LaurusFrame[]>>;
  onClick?: (metaKey: boolean) => void;
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
  maskLightSourcePlayersRef,
  transform,
  framesCacheRef,
  onClick,
}: ProjectMaskItem) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch } = useContext(CoreContext);
  const { topology } = coreState;
  const { selectedMaskKeys, setSelectedMaskKeys, isAltKeyPressed } = useContext(HoverContext);
  // Which flavor of <ContextMenu> a meta-click should open -- "capture" when the click lands on
  // the mesh's own captured triangles, "mask" otherwise (the existing general mask menu). Both
  // share the same shown/hidden state (uiState.projectContextMenus, toggled via the passed-down
  // onClick below) and the same on-screen anchor (transform); this only decides which `media`
  // gets handed to the one <ContextMenu> mount.
  const [contextMenuVariant, setContextMenuVariant] = useState<"mask" | "capture">("mask");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glStateRef = useRef<GLState | undefined>(undefined);
  const maskTextureRef = useRef<WebGLTexture | undefined>(undefined);
  const textureRef = useRef<WebGLTexture | undefined>(undefined);
  const textureMixRef = useRef(TEXTURE_MIX_DEFAULT);
  const lightSourceSizeRef = useRef(DEFAULT_LIGHT_SOURCE_VALUE.size);
  const lightSourceIntensityRef = useRef(DEFAULT_LIGHT_SOURCE_VALUE.intensity);
  const lightSourceFalloffRef = useRef(DEFAULT_LIGHT_SOURCE_VALUE.falloff);
  const lightSourceDarknessRef = useRef(DEFAULT_LIGHT_SOURCE_VALUE.darkness);
  const glowColorRef = useRef<[number, number, number]>([1, 1, 1]);
  // The mesh's own per-vertex colors as built by buildStaticMaskMesh, kept around so the
  // highlight effect below can blend from the real base color instead of whatever the previous
  // highlight pass left in colorBuffer -- see the highlight effect's comment.
  const baseColorsRef = useRef<number[]>([]);
  const vertexCountRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastCurveCountRef = useRef(0);
  // Where the epicenter currently is, already converted to gl_FragCoord space. radius 0 == no
  // light source active. Driven either by the mouse (default) or, while playLightSourceAnimation() is running
  // (see below), by a wired move effect's saved equation instead -- wiredMoveRef tracks which
  // source is currently in control so the two don't fight over lightSourceRef.
  const lightSourceRef = useRef<{ x: number; y: number; radius: number; falloff: number }>({
    x: 0,
    y: 0,
    radius: 0,
    falloff: 0,
  });
  const wiredMoveRef = useRef(false);
  // The in-flight playLightSourceAnimation() session, if any -- lets stopLightSourceAnimation() (and a
  // fresh play() call) cancel whatever's currently running instead of two loops racing.
  const activePlaybackRef = useRef<{ rafId: number | undefined; resolve: () => void } | undefined>(undefined);
  // A capture-relocate drag in progress (move tool, grabbed directly on the mesh's own captured
  // triangles rather than its body -- see the canvas's onPointerDown below). A ref, not state:
  // nothing about the drag needs to trigger a re-render, since the live preview already comes
  // free from pendingCaptureIndices/highlightedPolygonIndices once SetPendingLightSourceCapture is
  // dispatched. originalIndices lets a true zero-movement drag snap back to exactly what it
  // started as instead of picking up boundary noise from re-deriving the circle at every tick.
  const captureDragRef = useRef<
    | {
        pointerId: number;
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
  // The circle actually behind the mesh's current capture, if a previous relocate drag in this
  // same component instance is the reason it looks the way it does -- carried forward and only
  // ever translated (radius untouched) by later drags, rather than re-derived from the resulting
  // triangles via capturedRegionCircle every time. Re-deriving on every commit was the original
  // bug here: capturedRegionCircle's circle is centered on the captured centroids' own mean, not
  // the actual drag circle's center, so re-running the circle test from that slightly-off center
  // tends to pick up a few extra boundary triangles -- and since each relocation re-derived from
  // whatever the *previous* one left behind, that error compounded every drag until the capture
  // ate the whole mesh. `indices` records which captured set this circle is known to produce, so
  // a drag that starts after the mesh's capture changed some other way (a fresh circle-drawn
  // capture, a clear, page load) detects the mismatch and falls back to a single one-time
  // capturedRegionCircle estimate instead of trusting a stale circle.
  const lastKnownCaptureRef = useRef<{ indices: Set<number>; circle: { cx: number; cy: number; radius: number } } | undefined>(
    undefined,
  );
  // Mirrors captureDragRef's presence in state (rather than being read off the ref directly) so
  // the "grabbing" cursor below can react to it -- dnd-kit's own `isDragging` never turns on for
  // this gesture, since onPointerDown claims it via stopPropagation before dnd-kit's sensor ever
  // sees the pointer.
  const [isDraggingCapture, setIsDraggingCapture] = useState(false);

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
  // buffer (the highlight effect above) synchronously on every raw pointer event.
  const recomputeCaptureDrag = useCallback(() => {
    const drag = captureDragRef.current;
    if (!drag) return;
    drag.rafId = undefined;
    const indices = captureIndicesAtOffset(drag, drag.latestX - drag.startX, drag.latestY - drag.startY);
    dispatch({
      type: CoreActionType.SetPendingLightSourceCapture,
      value: { maskKey: mediaKey, polygonIndices: [...indices] },
    });
  }, [captureIndicesAtOffset, mediaKey, dispatch]);

  // Abandons an in-progress capture-relocate drag without persisting anything -- used both by a
  // browser-interrupted gesture (onPointerCancel) and by the tool-change safety net below (Alt-key
  // auto-exit and other tool shortcuts can fire mid-drag; without this the gesture would run to
  // completion and commit on release regardless).
  const abortCaptureDrag = useCallback(() => {
    const drag = captureDragRef.current;
    if (!drag) return;
    if (drag.rafId !== undefined) cancelAnimationFrame(drag.rafId);
    canvasRef.current?.releasePointerCapture(drag.pointerId);
    captureDragRef.current = undefined;
    setIsDraggingCapture(false);
    dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
  }, [dispatch]);

  // Not theoretical: holding Alt while the move tool is active force-resets the tool to "none"
  // globally (workspace.client.tsx), and other single-key tool shortcuts can fire mid-drag too.
  // Left uncaught, a mid-drag tool change would let the gesture commit anyway, and could race with
  // maskbar's own confirm/cancel buttons reading this same pendingLightSourceCapture slot.
  useEffect(() => {
    if (uiState.tool.type === "move") return;
    if (captureDragRef.current) abortCaptureDrag();
  }, [uiState.tool.type, abortCaptureDrag]);

  const isSelected = source.kind === "static" && selectedMaskKeys.has(mediaKey);
  const canvasSize =
    source.kind === "static"
      ? { width: source.maskData.width, height: source.maskData.height }
      : { width: source.sourceImg.width, height: source.sourceImg.height };
  // The source image's own project key, if it's still on the canvas -- imgs are keyed by
  // project element key here, not by img_media_id, so this has to search by value. A live
  // preview has no project key of its own yet (its source image is handed to it directly,
  // not placed as an element), so this is undefined for it. Also doubles as the key a "move"
  // effect wiring the light source epicenter (see the wiring effect below) would need to be animating.
  const sourceImgKey = useMemo(() => {
    if (source.kind !== "static") return undefined;
    for (const [key, img] of coreState.project.imgs) {
      if (img.img_media_id === source.maskData.source_img_media_id) return key;
    }
    return undefined;
  }, [source, coreState.project.imgs]);

  const sourceImgSrc = useMemo(() => {
    if (source.kind !== "static") return source.sourceImg.src;
    return sourceImgKey ? coreState.canvasImgs.get(sourceImgKey)?.src : undefined;
  }, [source, sourceImgKey, coreState.canvasImgs]);

  // Where the light source actually sits in the mesh (the centroid of its own captured triangles, in
  // the same top-left-origin mesh space as maskData.polygons) -- this is the epicenter's "home"
  // position that a wired move effect's frames (pixel deltas from a resting position, same
  // meaning they have as a CSS `translate`) get added to. Without this, playLightSourceAnimation had
  // no better option than the mesh's geometric center, which is only coincidentally where a
  // light source was actually drawn.
  const lightSourceRestPosition = useMemo(() => {
    if (source.kind !== "static") return undefined;
    const allPoints = source.maskData.polygons
      .filter((p) => p.captured)
      .flatMap((p) => parsePathPoints(p.d));
    if (allPoints.length === 0) return undefined;
    return {
      x: allPoints.reduce((sum, [px]) => sum + px, 0) / allPoints.length,
      y: allPoints.reduce((sum, [, py]) => sum + py, 0) / allPoints.length,
    };
  }, [source]);

  // Piggybacks on the same "active element" mechanism svg/img already use (unit-display.tsx's
  // chevrons, and being freshly dropped) -- a captured region has no on-screen presence of its
  // own to anchor a context menu to (see unit-display.tsx's setActiveElement, which skips showing
  // one for a mask entry), so becoming the active element highlights the mesh triangles it covers
  // instead.
  const activeLightSourceKey = useMemo(() => {
    if (source.kind !== "static") return undefined;
    if (uiState.activeElement?.type !== "mask") return undefined;
    return uiState.activeElement.key === mediaKey ? mediaKey : undefined;
  }, [source, uiState.activeElement, mediaKey]);

  // A not-yet-persisted capture candidate targeting this mask (see PendingLightSourceCapture,
  // core-state.ts) previews the same way an already-confirmed, active capture does -- letting the
  // user see exactly what they're about to commit to before it's ever sent to the server.
  const pendingCaptureIndices = useMemo(() => {
    if (source.kind !== "static" || coreState.pendingLightSourceCapture?.maskKey !== mediaKey) return undefined;
    return new Set(coreState.pendingLightSourceCapture.polygonIndices);
  }, [source, coreState.pendingLightSourceCapture, mediaKey]);

  const highlightedPolygonIndices = useMemo(() => {
    if (source.kind !== "static") return undefined;
    if (pendingCaptureIndices) return pendingCaptureIndices;
    if (activeLightSourceKey === undefined) return undefined;
    const indices = new Set<number>();
    source.maskData.polygons.forEach((p, i) => {
      if (p.captured) indices.add(i);
    });
    return indices;
  }, [source, pendingCaptureIndices, activeLightSourceKey]);

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
  // isDragging (dnd-kit's own) never turns on for a capture-relocate drag -- onPointerDown claims
  // that gesture via stopPropagation before dnd-kit's sensor sees the pointer -- so
  // isDraggingCapture covers it separately.
  const cursor = dragDisabled ? "" : isDragging || isDraggingCapture ? "grabbing" : "grab";

  const render = useCallback(() => {
    const state = glStateRef.current;
    if (!state) return;
    drawMaskMesh(state, {
      vertexCount: vertexCountRef.current,
      lightSource: lightSourceRef.current,
      lightSourceIntensity: lightSourceIntensityRef.current,
      lightSourceDarkness: lightSourceDarknessRef.current,
      texture: textureRef.current,
      textureMix: textureMixRef.current,
      maskTexture: maskTextureRef.current,
      glowColor: glowColorRef.current,
    });
  }, []);

  // The static mesh: built once from the already-complete result.
  useEffect(() => {
    if (source.kind !== "static") return;
    const maskData = source.maskData;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = initGLState(canvas);
    if (!state) return;
    glStateRef.current = state;
    const { gl } = state;

    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
    const mesh = colorCtx
      ? buildStaticMaskMesh(maskData, colorCtx)
      : { positions: [], colors: [], barycentrics: [], uvs: [], centroids: [], vertexCount: 0 };
    vertexCountRef.current = mesh.vertexCount;
    baseColorsRef.current = mesh.colors;

    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.colors), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.barycentrics), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.centroids), gl.STATIC_DRAW);

    if (maskData.curves.length > 0 && colorCtx) {
      const glowSource = maskData.curves.find((c) => c.glow_color)?.glow_color;
      if (glowSource) glowColorRef.current = colorToRGB01(colorCtx, glowSource);
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = maskData.width;
      maskCanvas.height = maskData.height;
      maskTextureRef.current = uploadCurveMask(gl, maskCanvas, maskData.curves, undefined);
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
    }

    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    render();

    return () => {
      gl.deleteProgram(state.program);
      gl.deleteBuffer(state.positionBuffer);
      gl.deleteBuffer(state.colorBuffer);
      gl.deleteBuffer(state.barycentricBuffer);
      gl.deleteBuffer(state.uvBuffer);
      gl.deleteBuffer(state.centroidBuffer);
      if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
      if (textureRef.current) gl.deleteTexture(textureRef.current);
      glStateRef.current = undefined;
      maskTextureRef.current = undefined;
      textureRef.current = undefined;
    };
    // Deliberately keyed on mask_media_id rather than `source` itself for a static mask: every
    // flow that updates an *existing* mask's polygons this session (confirmLightSourceCapture,
    // maskbar's clear-capture, the capture context-menu's delete, and this file's own
    // capture-relocate drag) only ever flips `captured` booleans via updateMaskCapture -- shape,
    // fill, stroke, and curves are untouched, so nothing this effect builds (positions, base
    // colors, the source-image texture) is actually stale. Depending on `source` directly used to
    // force this whole effect (full GL teardown, plus an async source-image texture
    // discard-and-reload) to re-run on every capture save even though only the separate, much
    // cheaper highlight-recolor effect below needed to react -- the discarded texture took a beat
    // to reload, which is what showed up as a visible color flicker right after dropping a
    // relocated capture. mask_media_id is stable across all of those flows and only ever changes
    // when this is genuinely a different mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind === "static" ? source.maskData.mask_media_id : source, sourceImgSrc, render]);

  // Recolors the mesh's covered triangles when its wired light source is the active element (see
  // highlightedPolygonIndices above), by re-uploading a blended copy of colorBuffer -- reuses
  // the existing shader/render path entirely rather than adding a new attribute/uniform for
  // this. Vertex layout mirrors buildStaticMaskMesh exactly: an optional 6-vertex backing quad
  // (only when the mask has curves), then 3 vertices per polygon in maskData.polygons order.
  useEffect(() => {
    if (source.kind !== "static") return;
    const state = glStateRef.current;
    if (!state) return;
    const baseColors = baseColorsRef.current;
    if (baseColors.length === 0) return;
    const { gl } = state;

    if (!highlightedPolygonIndices || highlightedPolygonIndices.size === 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(baseColors), gl.STATIC_DRAW);
      render();
      return;
    }

    const HIGHLIGHT_COLOR: [number, number, number] = [66 / 255, 133 / 255, 244 / 255];
    const HIGHLIGHT_MIX = 0.75;
    const quadVertexCount = source.maskData.curves.length > 0 ? 6 : 0;
    const highlighted = [...baseColors];
    highlightedPolygonIndices.forEach((polygonIndex) => {
      const startVertex = quadVertexCount + polygonIndex * 3;
      for (let v = 0; v < 3; v++) {
        const base = (startVertex + v) * 3;
        if (base + 2 >= highlighted.length) continue;
        highlighted[base] = highlighted[base] * (1 - HIGHLIGHT_MIX) + HIGHLIGHT_COLOR[0] * HIGHLIGHT_MIX;
        highlighted[base + 1] = highlighted[base + 1] * (1 - HIGHLIGHT_MIX) + HIGHLIGHT_COLOR[1] * HIGHLIGHT_MIX;
        highlighted[base + 2] = highlighted[base + 2] * (1 - HIGHLIGHT_MIX) + HIGHLIGHT_COLOR[2] * HIGHLIGHT_MIX;
      }
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(highlighted), gl.STATIC_DRAW);
    render();
  }, [source, highlightedPolygonIndices, render]);

  // The live mesh: polled every animation frame off mask.meshRefs' dirty-flagged refs, since
  // triangles arrive over the websocket outside React's render cycle and nothing about them needs
  // to trigger a React re-render.
  useEffect(() => {
    if (source.kind !== "live") return;
    const { mask, sourceImg } = source;
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      lightSourceSizeRef.current = mask.lightSourceSizeRef.current;
      lightSourceIntensityRef.current = mask.lightSourceIntensityRef.current;
      lightSourceFalloffRef.current = mask.lightSourceFalloffRef.current;
      lightSourceDarknessRef.current = mask.lightSourceDarknessRef.current;

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
      if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
      if (textureRef.current) gl.deleteTexture(textureRef.current);
      glStateRef.current = undefined;
      maskTextureRef.current = undefined;
      textureRef.current = undefined;
    };
    // This is remounted (React `key`'d by the source image, see canvas.tsx) whenever the
    // mask target changes, so the GL context is only ever created once per mount.
  }, [source, render]);

  // Resets the light source dials (size/intensity/falloff/darkness) to this mask's own starting
  // appearance (ProjectMask_V1_0.light_source_*, set via LightSourcebar/Maskbar and persisted the
  // same way scale_x/scale_y are) -- shared by the sync effect below and by
  // stopLightSourceAnimation, so leaving mouse control or finishing a wired-effect playback both
  // land back on the same static baseline instead of stranding the dials at whatever a played
  // frame last set them to.
  const applyDefaultLightSourceValue = useCallback(() => {
    if (source.kind !== "static") return;
    const maskMeta = coreState.project.masks.get(mediaKey);
    lightSourceSizeRef.current = maskMeta?.light_source_size ?? DEFAULT_LIGHT_SOURCE_VALUE.size;
    lightSourceIntensityRef.current = maskMeta?.light_source_intensity ?? DEFAULT_LIGHT_SOURCE_VALUE.intensity;
    lightSourceFalloffRef.current = maskMeta?.light_source_falloff ?? DEFAULT_LIGHT_SOURCE_VALUE.falloff;
    lightSourceDarknessRef.current = maskMeta?.light_source_darkness ?? DEFAULT_LIGHT_SOURCE_VALUE.darkness;
  }, [source, coreState.project.masks, mediaKey]);

  // Keeps the sliders' live values in refs so render() (called on demand, not in a loop) can read
  // them without needing to be re-created -- and re-renders immediately so moving a slider shows
  // up without waiting for some other interaction. Only applies to placed (static) masks; a live
  // preview's values are driven straight off mask.*Ref in its own frame loop above.
  useEffect(() => {
    if (source.kind !== "static") return;
    textureMixRef.current = topology.get(mediaKey)?.textureMix ?? TEXTURE_MIX_DEFAULT;
    applyDefaultLightSourceValue();
    render();
  }, [source, topology, mediaKey, render, applyDefaultLightSourceValue]);

  // Clears a mouse-driven epicenter left over from before the "preview" toggle (Lightsourcebar)
  // was switched off -- otherwise a mesh the mouse happens to be sitting on when it's toggled off
  // stays lit until the next mousemove/mouseleave instead of going dark immediately.
  useEffect(() => {
    if (uiState.lightSourcePreview || wiredMoveRef.current) return;
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    render();
  }, [uiState.lightSourcePreview, render]);

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
    lightSourceRef.current = { x: 0, y: 0, radius: 0, falloff: 0 };
    applyDefaultLightSourceValue();
    render();
  }, [render, applyDefaultLightSourceValue]);

  // Plays the light source epicenter/dials through whichever "move" and/or "light_source" effects are
  // wired to this mask's light source key (see lightSourceKey above) instead of the mouse; the mouse handlers
  // below defer to this once wiredMoveRef is set. The two effects are independent -- a mask can
  // have only one, the other, or both wired -- and share one timeline (taken from whichever is
  // present; move's own start/end/fps wins if both are wired, since position is the primary
  // consumer of "duration" here). Resolves immediately if neither is wired -- see
  // MaskLightSourcePlayer.
  //
  // An effectKey (passed by handlePlayTarget's single-effect preview, e.g. LightSourceUnitbar's
  // "preview" button) restricts this to just the one effect the button belongs to -- otherwise a
  // light_source-only preview would also drag the epicenter through a move effect that happens to
  // share this lightSourceKey, which isn't what "preview this effect" means. handlePlayAll omits it, so
  // Play All still mixes both together the same as it always has.
  //
  // No WAAPI, no live playhead: the server already solved each equation into `frames` (an
  // ordered point sequence covering the effect's whole [start, end) window), so there's no
  // timeline left to construct -- just play those points back at the shared fps. The loop period
  // is taken from the timing effect's declared start/end rather than frames.length, since that's
  // the authoritative duration; frames.length only bounds the array read (it should match
  // fps * (end - start), but isn't trusted to). Not called on its own -- triggered by
  // handlePlayAll/handlePlayTarget via the registration effect below, same as every other
  // effect's playback.
  const playLightSourceAnimation = useCallback(
    (effectKey?: string): Promise<void> => {
      stopLightSourceAnimation();
      if (source.kind !== "static") return Promise.resolve();

      const wiredMove = coreState.effects.find(
        (effect): effect is Extract<LaurusEffect, { type: "move" }> =>
          effect.type === "move" &&
          effect.value.math.has(mediaKey) &&
          (effectKey === undefined || effect.key === effectKey),
      );
      const wiredLightSource = coreState.effects.find(
        (effect): effect is Extract<LaurusEffect, { type: "light_source" }> =>
          effect.type === "light_source" &&
          effect.value.math.has(mediaKey) &&
          (effectKey === undefined || effect.key === effectKey),
      );
      if (!wiredMove && !wiredLightSource) return Promise.resolve();

      wiredMoveRef.current = true;

      return new Promise<void>((resolve) => {
        let moveFrames: LaurusFrame[] | undefined;
        let lightSourceFrames: LaurusFrame[] | undefined;
        const session: { rafId: number | undefined; resolve: () => void } = { rafId: undefined, resolve };
        activePlaybackRef.current = session;

        if (wiredMove) {
          getMoveFrames(coreState.apiOrigin, wiredMove.key, mediaKey).then((result) => {
            if (activePlaybackRef.current === session) moveFrames = result;
          });
        }
        if (wiredLightSource) {
          getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, mediaKey).then((result) => {
            if (activePlaybackRef.current === session) lightSourceFrames = result;
          });
        }

        const timingValue = (wiredMove ?? wiredLightSource)!.value;
        const fps = timingValue.fps > 0 ? timingValue.fps : 30;
        const totalFrames = Math.max(Math.round((timingValue.end - timingValue.start) * fps), 1);
        const durationSeconds = totalFrames / fps;
        const loopStartMs = performance.now();

        const loop = () => {
          // Superseded by a stop() or another play() while this tick was in flight.
          if (activePlaybackRef.current !== session) return;

          // Not loaded yet -- keep checking until every wired effect's getFrames resolves.
          if ((wiredMove && !moveFrames) || (wiredLightSource && !lightSourceFrames)) {
            session.rafId = requestAnimationFrame(loop);
            return;
          }

          const elapsedSeconds = (performance.now() - loopStartMs) / 1000;
          // Clamped, not wrapped: any repeat/reverse pattern (LaurusLoopType) is already baked
          // into `frames` by the server's own equation solve, and the real WAAPI playback always
          // plays it with iterations: 1 (see getNewAnimationsByTarget's animationOptions) -- so
          // restarting this from frame 0 once elapsed exceeds the duration would invent a loop the
          // equation never asked for.
          const frameIndex = Math.min(Math.floor(elapsedSeconds * fps), totalFrames - 1);
          const movePoint =
            moveFrames && moveFrames.length > 0 ? moveFrames[Math.min(frameIndex, moveFrames.length - 1)] : undefined;
          const lightSourcePoint =
            lightSourceFrames && lightSourceFrames.length > 0
              ? lightSourceFrames[Math.min(frameIndex, lightSourceFrames.length - 1)]
              : undefined;

          // Only overridden when a light_source effect is actually wired -- otherwise these refs
          // keep whatever the mask's own starting appearance (applyDefaultLightSourceValue below)
          // already set them to.
          if (lightSourcePoint) {
            lightSourceSizeRef.current = lightSourcePoint.light_source_size;
            lightSourceIntensityRef.current = lightSourcePoint.light_source_intensity;
            lightSourceFalloffRef.current = lightSourcePoint.light_source_falloff;
            lightSourceDarknessRef.current = lightSourcePoint.light_source_darkness;
          }

          const canvas = canvasRef.current;
          const rect = canvas?.getBoundingClientRect();
          if (canvas && rect && rect.width > 0 && rect.height > 0) {
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            // point.x/y are a pixel-space delta from the mesh's own resting position -- the same
            // meaning they have applied as a CSS `translate` on the real element (see
            // toKeyframes). Reinterpreted here as a delta from the light source's own captured position
            // in the mesh (lightSourceRestPosition) instead, converted into buffer-pixel space the same
            // way mouse coordinates are below. Falls back to the mesh's geometric center only if
            // the light source's own position couldn't be recovered. No move wired -> epicenter just
            // stays at rest, so the dials alone can still be previewed.
            const restX = lightSourceRestPosition?.x ?? canvas.width / 2;
            const restY = lightSourceRestPosition?.y ?? canvas.height / 2;
            const pointX = movePoint?.x ?? 0;
            const pointY = movePoint?.y ?? 0;
            const bufferX = restX + pointX * scaleX;
            const bufferY = restY + pointY * scaleY;
            lightSourceRef.current = {
              x: bufferX,
              // gl_FragCoord's origin is bottom-left; the DOM's is top-left.
              y: canvas.height - bufferY,
              radius: (lightSourceSizeRef.current / 2) * scaleX,
              falloff: lightSourceFalloffRef.current * scaleX,
            };
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
    },
    [source, mediaKey, lightSourceRestPosition, coreState.effects, coreState.apiOrigin, render, stopLightSourceAnimation],
  );

  // Registers this mask's play()/stop() into the shared map handlePlayAll/handlePlayTarget read
  // from (workspace.client.tsx), keyed by mediaKey -- the same key those handlers already use for
  // img/svg's imgElementsRef/svgElementsRef, and the mask's own stable project key (rather than a
  // synthetic per-capture svg key) so a wired effect stays valid across re-captures. Registered
  // unconditionally from mount (not gated on having an active capture) since an effect can stay
  // wired to a mask's key even after its capture is cleared -- Play All still needs to find it.
  useEffect(() => {
    if (source.kind !== "static" || !maskLightSourcePlayersRef) return;
    if (!maskLightSourcePlayersRef.current) maskLightSourcePlayersRef.current = new Map();
    const players = maskLightSourcePlayersRef.current;
    const player: MaskLightSourcePlayer = { play: playLightSourceAnimation, stop: stopLightSourceAnimation };
    const forThisKey = players.get(mediaKey) ?? new Set<MaskLightSourcePlayer>();
    forThisKey.add(player);
    players.set(mediaKey, forThisKey);

    return () => {
      forThisKey.delete(player);
      if (forThisKey.size === 0) players.delete(mediaKey);
      stopLightSourceAnimation();
    };
  }, [source, mediaKey, maskLightSourcePlayersRef, playLightSourceAnimation, stopLightSourceAnimation]);

  // Only meaningful for placed (static) masks -- a live preview has no persisted mediaKey to
  // key uiState.projectContextMenus by, and never gets a transform/framesCacheRef/onClick from
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
        zIndex,
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
            ref={canvasRef}
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
              // Alt-click toggles selection, same as images/svgs (see DraggableProjectImg's
              // onImgClick). Not available on a live preview -- there's no persisted mediaKey yet.
              // Mutually exclusive with the metaKey/tool-driven click below, mirroring how
              // DraggableProjectImg's onImgClick only falls through to its tool-type switch once
              // the alt-select branch has already been ruled out.
              if (isAltKeyPressed && source.kind === "static") {
                setSelectedMaskKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(mediaKey)) {
                    next.delete(mediaKey);
                  } else {
                    next.add(mediaKey);
                    // Selecting a mesh that already has a capture activates it immediately, the
                    // same way alt-clicking a wired svg used to -- no extra step to see/wire what
                    // it covers (highlightedPolygonIndices above).
                    if (source.maskData.polygons.some((p) => p.captured)) {
                      uiDispatch({ type: UIActionType.SetActiveElement, value: { key: mediaKey, type: "mask" } });
                    }
                  }
                  return next;
                });
                return;
              }
              // Meta-clicking directly on the captured triangles opens the capture's own flavor of
              // the context menu instead of the mesh's general one -- hit-tested in the same
              // buffer-pixel space onMouseMove already converts screen coordinates into below
              // (unflipped: polygon.d points, unlike lightSourceRef, are top-left-origin, not
              // gl_FragCoord's). Both flavors share the same shown/hidden toggle (onClick below).
              let hitCapture = false;
              if (source.kind === "static" && e.metaKey) {
                const canvas = e.currentTarget;
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const bufferX = (e.clientX - rect.left) * scaleX;
                  const bufferY = (e.clientY - rect.top) * scaleY;
                  hitCapture = isPointInCapturedPolygon(source.maskData.polygons, [bufferX, bufferY]);
                }
              }
              if (source.kind === "static") {
                const newVariant = hitCapture ? "capture" : "mask";
                // Meta-clicking a different part of the mesh while a menu is already showing
                // switches which flavor is displayed in place, rather than closing it -- the
                // shown/hidden toggle below (shared with the mask's general menu) only fires when
                // the variant isn't changing, so a second meta-click on the *same* kind of target
                // still closes it as expected.
                const switchingVariantWhileOpen = showContextMenu && newVariant !== contextMenuVariant;
                setContextMenuVariant(newVariant);
                if (!switchingVariantWhileOpen) {
                  onClick?.(e.metaKey);
                }
              }
            }}
            onPointerDown={(e) => {
              // Only the move tool relocates a capture, and only when the gesture actually starts
              // on the captured triangles themselves -- everywhere else on the mesh (or a mesh with
              // no capture at all) falls through untouched, letting the wrapper div's own
              // dnd-kit listeners (whole-mask drag) see the event exactly as they do today.
              if (source.kind !== "static" || uiState.tool.type !== "move") return;
              const canvas = e.currentTarget;
              const point = toBufferPoint(canvas, e.clientX, e.clientY);
              if (!point) return;
              const [bufferX, bufferY] = point;
              if (!isPointInCapturedPolygon(source.maskData.polygons, [bufferX, bufferY])) return;
              const originalIndices = new Set<number>();
              source.maskData.polygons.forEach((p, i) => {
                if (p.captured) originalIndices.add(i);
              });
              // Trust the circle a previous relocate drag actually used, if the mesh's captured
              // set still matches what it left behind -- only falling back to reconstructing one
              // from the triangles themselves (capturedRegionCircle) the first time, or after some
              // other flow (a fresh circle-drawn capture, a clear) changed the capture out from
              // under this cache. See lastKnownCaptureRef's comment for why re-deriving on every
              // drag, rather than just this once, was the actual growing-capture bug.
              const known = lastKnownCaptureRef.current;
              const circle =
                known && sameIndices(known.indices, originalIndices)
                  ? known.circle
                  : capturedRegionCircle(source.maskData.polygons);
              if (!circle) return;
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
                value: { maskKey: mediaKey, polygonIndices: [...originalIndices] },
              });
            }}
            onPointerMove={(e) => {
              const drag = captureDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId) return;
              const point = toBufferPoint(e.currentTarget, e.clientX, e.clientY);
              if (!point) return;
              [drag.latestX, drag.latestY] = point;
              if (drag.rafId === undefined) drag.rafId = requestAnimationFrame(recomputeCaptureDrag);
            }}
            onPointerUp={(e) => {
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
              captureDragRef.current = undefined;
              setIsDraggingCapture(false);
              if (finalIndices.size === 0) {
                // Dropped somewhere with no triangles -- cancel, leaving the mask's persisted
                // capture completely untouched (mirrors handleLightSourceCapture's own "zero
                // indices" early-return for the creation flow). Reaffirms the cache rather than
                // leaving it stale, since nothing about the actual captured set changed.
                lastKnownCaptureRef.current = { indices: drag.originalIndices, circle: drag.originalCircle };
                dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
                return;
              }
              // Left showing the dragged-to preview until the request resolves -- clearing it
              // immediately would fall back to the mesh's still-stale captured flags and flash back
              // to the original position for the round trip.
              dispatch({
                type: CoreActionType.SetPendingLightSourceCapture,
                value: { maskKey: mediaKey, polygonIndices: [...finalIndices] },
              });
              updateMaskCapture(coreState.apiOrigin, coreState.accessToken, source.maskData.mask_media_id, [
                ...finalIndices,
              ]).then((updated) => {
                if (updated) {
                  dispatch({ type: CoreActionType.SetCanvasMask, key: mediaKey, value: updated });
                  uiDispatch({ type: UIActionType.SetActiveElement, value: { key: mediaKey, type: "mask" } });
                  // Cache the circle actually used, translated by this drag's own delta -- not
                  // re-derived from the resulting triangles (capturedRegionCircle), which is what
                  // let the radius creep up over successive relocations. See lastKnownCaptureRef.
                  lastKnownCaptureRef.current = {
                    indices: finalIndices,
                    circle: { cx: drag.originalCircle.cx + dx, cy: drag.originalCircle.cy + dy, radius: drag.originalCircle.radius },
                  };
                } else {
                  // Request failed -- the server-side capture is still whatever it was before this
                  // drag, so reaffirm that instead of leaving a stale/wrong cache entry behind.
                  lastKnownCaptureRef.current = { indices: drag.originalIndices, circle: drag.originalCircle };
                }
                dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
              });
            }}
            onPointerCancel={(e) => {
              // A browser-interrupted gesture (e.g. window blur) shouldn't commit a possibly
              // incomplete drag -- mirrors the abort half of onPointerUp only, never persists.
              const drag = captureDragRef.current;
              if (!drag || e.pointerId !== drag.pointerId) return;
              abortCaptureDrag();
            }}
            onMouseMove={(e) => {
              // A capture-relocate drag owns this mesh's pointer for its duration -- defense in
              // depth on top of onPointerDown's preventDefault (which should already suppress the
              // compatibility mousemove for this pointer).
              if (captureDragRef.current) return;
              // A wired move effect (see the effect above) owns the epicenter instead -- the
              // mouse no longer drives it for this mesh. Same when the "preview" toggle
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
                radius: (lightSourceSizeRef.current / 2) * scaleX,
                falloff: lightSourceFalloffRef.current * scaleX,
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
            media={{
              key: mediaKey,
              type: contextMenuVariant,
              meta: maskMeta,
            }}
            framesCacheRef={framesCacheRef}
            transform={transform}
          />
        )}
      </div>
    </div>
  );
}
