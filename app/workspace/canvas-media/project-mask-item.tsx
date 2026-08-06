"use client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CoreContext, HoverContext, LaurusTransform, UIContext } from "../workspace.client";
import { RefObject, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  buildStaticMaskMesh,
  colorToRGB01,
  drawMaskMesh,
  GLState,
  initGLState,
  loadImageTexture,
  TEXTURE_MIX_DEFAULT,
  uploadCurveMask,
} from "../mask-gl";
import { DEFAULT_LIGHT_SOURCE_VALUE } from "../states/core-state";
import { UseMaskPreview } from "../hooks/useMaskPreview";
import { Z_INDEX } from "../workspace.config";
import { findHighlightedPolygonIndices, parseLightSourceTriangles } from "./light-source-capture";
import ContextMenu from "../context-menu";
import {
  getLightSourceFrames,
  getMoveFrames,
  LaurusEffect,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
} from "../workspace.server";

export type ProjectMaskItemSource =
  { kind: "static"; maskData: LaurusMaskResult } | { kind: "live"; mask: UseMaskPreview; sourceImg: LaurusImgResult };

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
  const { uiState } = useContext(UIContext);
  const { coreState } = useContext(CoreContext);
  const { topology } = coreState;
  const { selectedMaskKeys, setSelectedMaskKeys, isAltKeyPressed } = useContext(HoverContext);
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

  // The project key of the svg (if any) wired to this mask as a "light source" -- see
  // canvas.tsx's handleSvgDrop (sets target_mask_key on drop) and workspace.client.tsx's
  // render loop (skips mounting a DraggableProjectSvg for it; it's a wiring key only). This is
  // what a "move" effect's epicenter position and a "light_source" effect's dials are wired to,
  // replacing the old sourceImgKey-proxy this used before light sources had a project key of their own.
  const lightSourceKey = useMemo(() => {
    if (source.kind !== "static") return undefined;
    for (const [key, svgMeta] of coreState.project.svgs) {
      if (svgMeta.target_mask_key === mediaKey) return key;
    }
    return undefined;
  }, [source, coreState.project.svgs, mediaKey]);

  // Where the light source actually sits in the mesh (the centroid of its own captured triangles, in
  // the same top-left-origin mesh space as maskData.polygons) -- this is the epicenter's "home"
  // position that a wired move effect's frames (pixel deltas from a resting position, same
  // meaning they have as a CSS `translate`) get added to. Without this, playLightSourceAnimation had
  // no better option than the mesh's geometric center, which is only coincidentally where a
  // light source was actually drawn.
  const lightSourceRestPosition = useMemo(() => {
    if (source.kind !== "static" || lightSourceKey === undefined) return undefined;
    const lightSourceSvg = coreState.canvasSvgs.get(lightSourceKey);
    if (!lightSourceSvg) return undefined;
    const allPoints = parseLightSourceTriangles(lightSourceSvg.markup).flat();
    if (allPoints.length === 0) return undefined;
    return {
      x: allPoints.reduce((sum, [px]) => sum + px, 0) / allPoints.length,
      y: allPoints.reduce((sum, [, py]) => sum + py, 0) / allPoints.length,
    };
  }, [source, lightSourceKey, coreState.canvasSvgs]);

  // Piggybacks on the same "active element" mechanism svg/img already use (unit-display.tsx's
  // chevrons, and being freshly dropped) -- a light source has no on-screen presence of its own to
  // anchor a context menu to (see unit-display.tsx's setActiveElement, which skips showing one
  // for a light source), so becoming the active element highlights the mesh triangles it covers instead.
  const activeLightSourceKey = useMemo(() => {
    if (source.kind !== "static") return undefined;
    if (uiState.activeElement?.type !== "svg") return undefined;
    const activeKey = uiState.activeElement.key;
    return coreState.project.svgs.get(activeKey)?.target_mask_key === mediaKey ? activeKey : undefined;
  }, [source, uiState.activeElement, coreState.project.svgs, mediaKey]);

  // A not-yet-uploaded capture candidate targeting this mask (see PendingLightSourceCapture,
  // core-state.ts) previews the same way an already-confirmed, active light source does -- letting the
  // user see exactly what they're about to commit to before an upload ever happens.
  const pendingCaptureIndices = useMemo(() => {
    if (source.kind !== "static" || coreState.pendingLightSourceCapture?.maskKey !== mediaKey) return undefined;
    return new Set(coreState.pendingLightSourceCapture.polygonIndices);
  }, [source, coreState.pendingLightSourceCapture, mediaKey]);

  const highlightedPolygonIndices = useMemo(() => {
    if (source.kind !== "static") return undefined;
    if (pendingCaptureIndices) return pendingCaptureIndices;
    if (activeLightSourceKey === undefined) return undefined;
    const lightSourceSvg = coreState.canvasSvgs.get(activeLightSourceKey);
    if (!lightSourceSvg) return undefined;
    return findHighlightedPolygonIndices(source.maskData.polygons, lightSourceSvg.markup);
  }, [source, pendingCaptureIndices, activeLightSourceKey, coreState.canvasSvgs]);

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
  const cursor = dragDisabled ? "" : isDragging ? "grabbing" : "grab";

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
  }, [source, sourceImgSrc, render]);

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
      if (source.kind !== "static" || lightSourceKey === undefined) return Promise.resolve();

      const wiredMove = coreState.effects.find(
        (effect): effect is Extract<LaurusEffect, { type: "move" }> =>
          effect.type === "move" &&
          effect.value.math.has(lightSourceKey) &&
          (effectKey === undefined || effect.key === effectKey),
      );
      const wiredLightSource = coreState.effects.find(
        (effect): effect is Extract<LaurusEffect, { type: "light_source" }> =>
          effect.type === "light_source" &&
          effect.value.math.has(lightSourceKey) &&
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
          getMoveFrames(coreState.apiOrigin, wiredMove.key, lightSourceKey).then((result) => {
            if (activePlaybackRef.current === session) moveFrames = result;
          });
        }
        if (wiredLightSource) {
          getLightSourceFrames(coreState.apiOrigin, wiredLightSource.key, lightSourceKey).then((result) => {
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
    [
      source,
      lightSourceKey,
      lightSourceRestPosition,
      coreState.effects,
      coreState.apiOrigin,
      render,
      stopLightSourceAnimation,
    ],
  );

  // Registers this mask's play()/stop() into the shared map handlePlayAll/handlePlayTarget read
  // from (workspace.client.tsx), keyed by lightSourceKey -- the same key those handlers already use
  // for img/svg's imgElementsRef/svgElementsRef. Multiple masks could in principle share one
  // light source key, hence a Set per key rather than a single player (though each light-source-svg is
  // currently only ever dropped onto one mask).
  useEffect(() => {
    if (source.kind !== "static" || lightSourceKey === undefined || !maskLightSourcePlayersRef) return;
    if (!maskLightSourcePlayersRef.current) maskLightSourcePlayersRef.current = new Map();
    const players = maskLightSourcePlayersRef.current;
    const player: MaskLightSourcePlayer = { play: playLightSourceAnimation, stop: stopLightSourceAnimation };
    const forThisKey = players.get(lightSourceKey) ?? new Set<MaskLightSourcePlayer>();
    forThisKey.add(player);
    players.set(lightSourceKey, forThisKey);

    return () => {
      forThisKey.delete(player);
      if (forThisKey.size === 0) players.delete(lightSourceKey);
      stopLightSourceAnimation();
    };
  }, [source, lightSourceKey, maskLightSourcePlayersRef, playLightSourceAnimation, stopLightSourceAnimation]);

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
                  }
                  return next;
                });
                return;
              }
              if (source.kind === "static") onClick?.(e.metaKey);
            }}
            onMouseMove={(e) => {
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
              type: "mask",
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
