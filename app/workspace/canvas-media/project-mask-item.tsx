"use client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  buildStaticMaskMesh,
  colorToRGB01,
  drawMaskMesh,
  GLState,
  initGLState,
  loadImageTexture,
  SHEEN_SIZE_CSS_PX,
  uploadCurveMask,
} from "../mask-gl";
import { UseMaskPreview } from "../hooks/useMaskPreview";
import { Z_INDEX } from "../workspace.config";
import { LaurusImgResult, LaurusMaskResult } from "../workspace.server";

export type ProjectMaskItemSource =
  { kind: "static"; maskData: LaurusMaskResult } | { kind: "live"; mask: UseMaskPreview; sourceImg: LaurusImgResult };

interface ProjectMaskItem {
  dndId: string;
  dndPosition: { x: number; y: number };
  zIndex: number;
  mediaKey: string;
  frame: { width: number; height: number; scale_x: number; scale_y: number };
  source: ProjectMaskItemSource;
  title?: string;
}
/**
 * Renders a mask result on a WebGL canvas -- either the already-complete, persisted result
 * (`source.kind === "static"`) or the mesh still streaming in over the websocket
 * (`source.kind === "live"`, polling a dirty-flagged ref every animation frame since triangles
 * arrive outside React's render cycle). Both share the same GL context setup, curve-mask clip,
 * click sheen, and texture blend against the source image -- they only differ in where the mesh
 * buffers come from and how often they change. A live preview isn't draggable or selectable:
 * there's no persisted mediaKey yet to attach that state to.
 */
export function ProjectMaskItem({ dndId, dndPosition, zIndex, mediaKey, frame, source, title }: ProjectMaskItem) {
  const { uiState } = useContext(UIContext);
  const { coreState } = useContext(CoreContext);
  const { selectedMaskKeys, setSelectedMaskKeys, isAltKeyPressed, maskTextureMix } = useContext(HoverContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glStateRef = useRef<GLState | undefined>(undefined);
  const maskTextureRef = useRef<WebGLTexture | undefined>(undefined);
  const textureRef = useRef<WebGLTexture | undefined>(undefined);
  const textureMixRef = useRef(0);
  const glowColorRef = useRef<[number, number, number]>([1, 1, 1]);
  const vertexCountRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastCurveCountRef = useRef(0);
  // Where the last click landed, already converted to gl_FragCoord space. radius 0 == nothing
  // clicked yet.
  const sheenRef = useRef<{ x: number; y: number; radius: number }>({ x: 0, y: 0, radius: 0 });

  const isSelected = source.kind === "static" && selectedMaskKeys.has(mediaKey);
  const canvasSize =
    source.kind === "static"
      ? { width: source.maskData.width, height: source.maskData.height }
      : { width: source.sourceImg.width, height: source.sourceImg.height };
  // The image this mask was traced from, if it's still on the canvas -- imgs are keyed by
  // project element key here, not by img_media_id, so this has to search by value. A live preview
  // already has its source image handed to it directly.
  const sourceImgSrc = useMemo(() => {
    if (source.kind !== "static") return source.sourceImg.src;
    for (const [key, img] of coreState.project.imgs) {
      if (img.img_media_id === source.maskData.source_img_media_id) {
        return coreState.canvasImgs.get(key)?.src;
      }
    }
    return undefined;
  }, [source, coreState.project.imgs, coreState.canvasImgs]);

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
      sheen: sheenRef.current,
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
      : { positions: [], colors: [], barycentrics: [], uvs: [], vertexCount: 0 };
    vertexCountRef.current = mesh.vertexCount;

    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.colors), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.barycentrics), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);

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

    sheenRef.current = { x: 0, y: 0, radius: 0 };
    render();

    return () => {
      gl.deleteProgram(state.program);
      gl.deleteBuffer(state.positionBuffer);
      gl.deleteBuffer(state.colorBuffer);
      gl.deleteBuffer(state.barycentricBuffer);
      gl.deleteBuffer(state.uvBuffer);
      if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
      if (textureRef.current) gl.deleteTexture(textureRef.current);
      glStateRef.current = undefined;
      maskTextureRef.current = undefined;
      textureRef.current = undefined;
    };
  }, [source, sourceImgSrc, render]);

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
      if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);
      if (textureRef.current) gl.deleteTexture(textureRef.current);
      glStateRef.current = undefined;
      maskTextureRef.current = undefined;
      textureRef.current = undefined;
    };
    // This is remounted (React `key`'d by the source image, see canvas.tsx) whenever the
    // mask target changes, so the GL context is only ever created once per mount.
  }, [source, render]);

  // Keeps the slider's live value in a ref so render() (called on demand, not in a loop) can read
  // it without needing to be re-created -- and re-renders immediately so moving the slider shows
  // up without waiting for some other interaction. Only applies to placed (static) masks; a live
  // preview's mix is driven straight off mask.textureMixRef in its own frame loop above.
  useEffect(() => {
    if (source.kind !== "static") return;
    textureMixRef.current = maskTextureMix.get(mediaKey) ?? 0;
    render();
  }, [source, maskTextureMix, mediaKey, render]);

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
      <div {...listeners} title={title} style={{ position: "relative", zIndex: Z_INDEX.ITEM_CONTENT, cursor }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={(e) => {
            // Alt-click toggles selection, same as images/svgs (see DraggableProjectImg's
            // onImgClick) -- it doesn't also drop a sheen, matching that click not doing anything
            // else either. Not available on a live preview -- there's no persisted mediaKey yet.
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

            const canvas = e.currentTarget;
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            // The canvas is displayed smaller than its backing resolution, so scale the click
            // (and the sheen's on-screen size) from CSS pixels into drawing-buffer pixels.
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const bufferX = (e.clientX - rect.left) * scaleX;
            const bufferY = (e.clientY - rect.top) * scaleY;
            sheenRef.current = {
              x: bufferX,
              // gl_FragCoord's origin is bottom-left; the DOM's is top-left.
              y: canvas.height - bufferY,
              radius: (SHEEN_SIZE_CSS_PX / 2) * scaleX,
            };
            render();
          }}
          style={{
            ...containerSize,
            display: "block",
            outline: isSelected ? "2px solid rgba(66, 133, 244, 1)" : "none",
          }}
        />
      </div>
    </div>
  );
}
