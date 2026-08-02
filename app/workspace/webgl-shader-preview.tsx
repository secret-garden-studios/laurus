"use client";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext } from "./workspace.client";
import {
  LaurusImgResult,
  LaurusPolygonResult,
  VectorizeComplete_V1_0,
  VectorizeError_V1_0,
  VectorizeTriangle_V1_0,
  vectorizeImage,
} from "./workspace.server";

type VectorizeStatus = "idle" | "connecting" | "streaming" | "done" | "error";

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec3 a_color;
attribute vec3 a_barycentric;
attribute vec2 a_uv;

uniform vec2 u_resolution;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_color = a_color;
  v_barycentric = a_barycentric;
  v_uv = a_uv;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;

// Sheen center is in gl_FragCoord space (drawing-buffer pixels, origin bottom-left);
// radius is likewise in drawing-buffer pixels so it survives the canvas being displayed
// at a different size than its backing resolution.
uniform vec2 u_sheenCenter;
uniform float u_sheenRadius;
uniform float u_sheenActive;

uniform sampler2D u_texture;
// 0 = flat server-shaded triangle color, 1 = source-image texture.
uniform float u_textureMix;

void main() {
  float edgeDist = min(min(v_barycentric.x, v_barycentric.y), v_barycentric.z);
  // Fades out with u_textureMix -- it reads as a helpful wireframe over the flat vectorized
  // colors, but as white strokes cutting across the real photo once the texture takes over.
  float edge = (1.0 - smoothstep(0.0, 0.025, edgeDist)) * (1.0 - u_textureMix);

  vec3 base = mix(v_color, texture2D(u_texture, v_uv).rgb, u_textureMix);

  float dist = distance(gl_FragCoord.xy, u_sheenCenter);
  float sheen = (1.0 - smoothstep(u_sheenRadius * 0.35, u_sheenRadius, dist)) * u_sheenActive;

  vec3 shaded = base + sheen * 0.45;
  vec3 withEdge = mix(shaded, vec3(1.0), edge * 0.18);
  gl_FragColor = vec4(withEdge, 1.0);
}
`;

/** Width/height of the click sheen, in on-screen (CSS) pixels -- converted to buffer pixels per click. */
const SHEEN_SIZE_CSS_PX = 50;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log("shader compile error", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return undefined;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | undefined {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) return undefined;
  const program = gl.createProgram();
  if (!program) return undefined;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log("program link error", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return undefined;
  }
  return program;
}

interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  barycentricBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  positionLoc: number;
  colorLoc: number;
  barycentricLoc: number;
  uvLoc: number;
  resolutionLoc: WebGLUniformLocation;
  sheenCenterLoc: WebGLUniformLocation;
  sheenRadiusLoc: WebGLUniformLocation;
  sheenActiveLoc: WebGLUniformLocation;
  textureLoc: WebGLUniformLocation;
  textureMixLoc: WebGLUniformLocation;
}

function initGLState(canvas: HTMLCanvasElement): GLState | undefined {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) return undefined;
  const program = createProgram(gl);
  if (!program) return undefined;

  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const barycentricBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  if (!positionBuffer || !colorBuffer || !barycentricBuffer || !uvBuffer) return undefined;

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const colorLoc = gl.getAttribLocation(program, "a_color");
  const barycentricLoc = gl.getAttribLocation(program, "a_barycentric");
  const uvLoc = gl.getAttribLocation(program, "a_uv");
  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const sheenCenterLoc = gl.getUniformLocation(program, "u_sheenCenter");
  const sheenRadiusLoc = gl.getUniformLocation(program, "u_sheenRadius");
  const sheenActiveLoc = gl.getUniformLocation(program, "u_sheenActive");
  const textureLoc = gl.getUniformLocation(program, "u_texture");
  const textureMixLoc = gl.getUniformLocation(program, "u_textureMix");
  if (
    positionLoc < 0 ||
    colorLoc < 0 ||
    barycentricLoc < 0 ||
    uvLoc < 0 ||
    !resolutionLoc ||
    !sheenCenterLoc ||
    !sheenRadiusLoc ||
    !sheenActiveLoc ||
    !textureLoc ||
    !textureMixLoc
  )
    return undefined;

  return {
    gl,
    program,
    positionBuffer,
    colorBuffer,
    barycentricBuffer,
    uvBuffer,
    positionLoc,
    colorLoc,
    barycentricLoc,
    uvLoc,
    resolutionLoc,
    sheenCenterLoc,
    sheenRadiusLoc,
    sheenActiveLoc,
    textureLoc,
    textureMixLoc,
  };
}

// Reading getComputedStyle-style colors ("shaded" is any CSS color the server feels like emitting) is
// only reliable via a 1x1 2d canvas round-trip -- it's the one place the browser will parse arbitrary
// CSS color syntax for us instead of hand-rolling a parser for rgb()/hex/named colors.
function colorToRGB01(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

export interface WebGLShaderPreview {
  img: LaurusImgResult;
}

/**
 * Same trigger + streaming setup as VectorizePreview -- opens the /media/polygon/vectorize
 * websocket and consumes the same triangle stream -- but rendered on a WebGL canvas instead of
 * drawing Path2D fills on a 2d context. Each triangle's server-shaded color becomes a flat vertex
 * color, and each vertex also gets a UV derived straight from its image-space point; the source
 * image loads into a texture on the side, and the "texture" slider mixes between the flat vectorized
 * color and the real photo sampled through the mesh. The fragment shader also adds a
 * barycentric-coordinate wireframe outline and a sheen -- a soft ~50x50px highlight dropped wherever
 * you click the canvas -- none of which is practical to redo per-frame on a 2d canvas at this
 * triangle count. The GL context and texture upload are both deferred to the first Vectorize
 * click rather than created on mount, so a page full of these (e.g. a media list) doesn't burn
 * through the browser's WebGL context limit before the user ever asks to vectorize anything. Not
 * wired into the project/tool/drag-drop system -- a rendering-technique proof, same as its sibling.
 */
export default function WebGLShaderPreview({ img }: WebGLShaderPreview) {
  const { coreState } = useContext(CoreContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const glStateRef = useRef<GLState | undefined>(undefined);
  const colorCtxRef = useRef<CanvasRenderingContext2D | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  // Where the last click landed, already converted to gl_FragCoord space so the render loop
  // can hand it straight to the shader. radius 0 == nothing clicked yet.
  const sheenRef = useRef<{ x: number; y: number; radius: number }>({ x: 0, y: 0, radius: 0 });
  const textureRef = useRef<WebGLTexture | undefined>(undefined);
  // Mirrors the textureMix state into a ref so the render loop (set up once, on the first
  // Vectorize click) can read the live slider value without needing to be re-created every time it moves.
  const textureMixRef = useRef(0);

  const positionsRef = useRef<number[]>([]);
  const colorsRef = useRef<number[]>([]);
  const barycentricsRef = useRef<number[]>([]);
  const uvsRef = useRef<number[]>([]);
  const vertexCountRef = useRef(0);
  const dirtyRef = useRef(false);

  const [status, setStatus] = useState<VectorizeStatus>("idle");
  const [triangleCount, setTriangleCount] = useState(0);
  const [result, setResult] = useState<LaurusPolygonResult | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [textureMix, setTextureMix] = useState(0);
  const [textureReady, setTextureReady] = useState(false);

  const teardownGL = useCallback(() => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    const state = glStateRef.current;
    if (state) {
      state.gl.deleteProgram(state.program);
      state.gl.deleteBuffer(state.positionBuffer);
      state.gl.deleteBuffer(state.colorBuffer);
      state.gl.deleteBuffer(state.barycentricBuffer);
      state.gl.deleteBuffer(state.uvBuffer);
      if (textureRef.current) state.gl.deleteTexture(textureRef.current);
    }
    socketRef.current?.close();
  }, []);

  // GL context creation and the texture upload both happen lazily on the first Vectorize click
  // (see handleVectorize) rather than eagerly on mount -- eagerly calling getContext("webgl") for
  // every mounted preview (including ones off-screen in a long list) can exhaust the browser's
  // WebGL context limit, which then makes getContext return null for previews further down and
  // incorrectly reports them as "WebGL is not supported" even though it is. This effect only
  // handles teardown for whatever was actually created.
  useEffect(() => {
    return () => {
      teardownGL();
    };
  }, [teardownGL]);

  const startRenderLoop = useCallback((state: GLState) => {
    const render = () => {
      const {
        gl,
        program,
        positionBuffer,
        colorBuffer,
        barycentricBuffer,
        uvBuffer,
        positionLoc,
        colorLoc,
        barycentricLoc,
        uvLoc,
        resolutionLoc,
        sheenCenterLoc,
        sheenRadiusLoc,
        sheenActiveLoc,
        textureLoc,
        textureMixLoc,
      } = state;

      if (dirtyRef.current) {
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionsRef.current), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorsRef.current), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, barycentricBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barycentricsRef.current), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvsRef.current), gl.DYNAMIC_DRAW);
        vertexCountRef.current = positionsRef.current.length / 2;
        dirtyRef.current = false;
      }

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (vertexCountRef.current > 0) {
        gl.useProgram(program);
        gl.uniform2f(resolutionLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform2f(sheenCenterLoc, sheenRef.current.x, sheenRef.current.y);
        gl.uniform1f(sheenRadiusLoc, Math.max(sheenRef.current.radius, 1));
        gl.uniform1f(sheenActiveLoc, sheenRef.current.radius > 0 ? 1 : 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureRef.current ?? null);
        gl.uniform1i(textureLoc, 0);
        gl.uniform1f(textureMixLoc, textureRef.current ? textureMixRef.current : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, barycentricBuffer);
        gl.enableVertexAttribArray(barycentricLoc);
        gl.vertexAttribPointer(barycentricLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, vertexCountRef.current);
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
  }, []);

  const loadTexture = useCallback(
    (gl: WebGLRenderingContext) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const texture = gl.createTexture();
          if (!texture) return;
          gl.bindTexture(gl.TEXTURE_2D, texture);
          // Image rows come in top-first (DOM convention); flipping here makes v=1 land on the
          // image's top row, matching the vertex shader's own y-flip for gl_Position.
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          if (textureRef.current) gl.deleteTexture(textureRef.current);
          textureRef.current = texture;
          setTextureReady(true);
        } catch (error) {
          // Cross-origin image without permissive CORS headers, etc -- fall back to the flat
          // vectorized colors rather than breaking the rest of the preview.
          console.log("failed to upload source image as a WebGL texture", { error });
        }
      };
      image.onerror = () => {
        console.log("failed to load source image for WebGL texture", img.src);
      };
      image.src = img.src;
    },
    [img.src],
  );

  const getColorCtx = useCallback((): CanvasRenderingContext2D | undefined => {
    if (colorCtxRef.current) return colorCtxRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) colorCtxRef.current = ctx;
    return colorCtxRef.current;
  }, []);

  const handleVectorize = useCallback(() => {
    if (!glStateRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const state = initGLState(canvas);
      if (!state) {
        setStatus("error");
        setErrorMessage("WebGL is not supported in this browser");
        return;
      }
      glStateRef.current = state;
      startRenderLoop(state);
      loadTexture(state.gl);
    }

    positionsRef.current = [];
    colorsRef.current = [];
    barycentricsRef.current = [];
    uvsRef.current = [];
    vertexCountRef.current = 0;
    dirtyRef.current = true;
    setTriangleCount(0);
    setResult(undefined);
    setErrorMessage(undefined);
    setStatus("connecting");

    socketRef.current?.close();
    socketRef.current = vectorizeImage(
      coreState.apiOrigin,
      coreState.accessToken,
      { img_media_id: img.img_media_id },
      {
        onGroupStart: () => {
          setStatus("streaming");
        },
        onTriangle: (event: VectorizeTriangle_V1_0) => {
          const colorCtx = getColorCtx();
          const [r, g, b] = colorCtx ? colorToRGB01(colorCtx, event.shaded) : [1, 1, 1];
          for (const [x, y] of event.points) {
            positionsRef.current.push(x, y);
            colorsRef.current.push(r, g, b);
            uvsRef.current.push(x / img.width, 1 - y / img.height);
          }
          barycentricsRef.current.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
          dirtyRef.current = true;
          setTriangleCount((n) => n + 1);
        },
        onComplete: (event: VectorizeComplete_V1_0) => {
          setStatus("done");
          setResult(event.result);
        },
        onError: (message: VectorizeError_V1_0["message"]) => {
          setStatus("error");
          setErrorMessage(message);
        },
      },
    );
  }, [
    coreState.apiOrigin,
    coreState.accessToken,
    img.img_media_id,
    img.width,
    img.height,
    getColorCtx,
    startRenderLoop,
    loadTexture,
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={handleVectorize}
        disabled={status === "connecting" || status === "streaming"}
        style={{
          fontSize: 12,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.9)",
          cursor: status === "connecting" || status === "streaming" ? "default" : "pointer",
        }}
      >
        {status === "connecting" || status === "streaming" ? "Vectorizing…" : "Vectorize"}
      </button>
      <canvas
        ref={canvasRef}
        width={img.width}
        height={img.height}
        onClick={(e) => {
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
        }}
        style={{
          width: "100%",
          maxWidth: 240,
          height: "auto",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 6,
          display: status === "idle" ? "none" : "block",
          cursor: status === "done" || status === "streaming" ? "crosshair" : "",
        }}
      />
      {textureReady && status !== "idle" && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.7 }}>
          texture
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={textureMix}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setTextureMix(value);
              textureMixRef.current = value;
            }}
          />
        </label>
      )}
      {status === "streaming" && <span style={{ fontSize: 11, opacity: 0.7 }}>{triangleCount} triangles…</span>}
      {status === "done" && result && (
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          done — {result.polygons.length} triangles, saved as {result.polygon_media_id}
        </span>
      )}
      {status === "error" && errorMessage && (
        <span style={{ fontSize: 11, color: "rgba(255,120,120,0.9)" }}>{errorMessage}</span>
      )}
    </div>
  );
}
