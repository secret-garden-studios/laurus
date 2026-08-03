import { MaskCurve_V1_0 } from "./workspace.server";

/** Width/height of the click sheen, in on-screen (CSS) pixels -- converted to buffer pixels per click. */
export const SHEEN_SIZE_CSS_PX = 50;

export const VERTEX_SHADER_SOURCE = `
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

export const FRAGMENT_SHADER_SOURCE = `
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

// The silhouette curves, rasterized to a coverage mask. WebGL has no
// equivalent of a 2d context's ctx.clip(), so the clip becomes a multiply on
// alpha here: this is what gives the shape its smooth curved edge instead of
// the mesh's faceted one. Its own antialiasing comes free, since the mask is
// filled on a 2d canvas. 0 when the source had no alpha channel and so no
// silhouette to trace, in which case nothing is clipped away.
//
// .a is coverage, including the glow's soft falloff outside the silhouette.
// .r says how much of that coverage is glow rather than subject: 1 out in the
// falloff, 0 within the shape. The glow is its own colour -- a drop shadow is
// dark, a neon glow saturated, neither is the subject's mean -- so it can't
// just inherit whatever the mesh underneath happens to be.
uniform sampler2D u_mask;
uniform float u_maskActive;
uniform vec3 u_glowColor;

void main() {
  float edgeDist = min(min(v_barycentric.x, v_barycentric.y), v_barycentric.z);
  // Fades out with u_textureMix -- it reads as a helpful wireframe over the flat masked
  // colors, but as white strokes cutting across the real photo once the texture takes over.
  float edge = (1.0 - smoothstep(0.0, 0.025, edgeDist)) * (1.0 - u_textureMix);

  vec3 base = mix(v_color, texture2D(u_texture, v_uv).rgb, u_textureMix);

  float dist = distance(gl_FragCoord.xy, u_sheenCenter);
  float sheen = (1.0 - smoothstep(u_sheenRadius * 0.35, u_sheenRadius, dist)) * u_sheenActive;

  vec3 shaded = base + sheen * 0.45;
  vec3 withEdge = mix(shaded, vec3(1.0), edge * 0.18);

  vec4 mask = texture2D(u_mask, v_uv);
  vec3 withGlow = mix(withEdge, u_glowColor, mask.r * u_maskActive);
  gl_FragColor = vec4(withGlow, mix(1.0, mask.a, u_maskActive));
}
`;

export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
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

export function createProgram(gl: WebGLRenderingContext): WebGLProgram | undefined {
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

export interface GLState {
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
  maskLoc: WebGLUniformLocation;
  maskActiveLoc: WebGLUniformLocation;
  glowColorLoc: WebGLUniformLocation;
}

export function initGLState(canvas: HTMLCanvasElement): GLState | undefined {
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
  const maskLoc = gl.getUniformLocation(program, "u_mask");
  const maskActiveLoc = gl.getUniformLocation(program, "u_maskActive");
  const glowColorLoc = gl.getUniformLocation(program, "u_glowColor");
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
    !textureMixLoc ||
    !maskLoc ||
    !maskActiveLoc ||
    !glowColorLoc
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
    maskLoc,
    maskActiveLoc,
    glowColorLoc,
  };
}

export interface DrawMaskMeshOptions {
  vertexCount: number;
  sheen: { x: number; y: number; radius: number };
  texture: WebGLTexture | undefined;
  textureMix: number;
  maskTexture: WebGLTexture | undefined;
  glowColor: [number, number, number];
}

/**
 * Draws one frame of a masked mesh -- the uniform-setting and draw-call boilerplate shared by
 * every WebGL renderer in this file's family (the live streaming preview and the static,
 * already-complete one both feed the same shader the same way; they only differ in how the
 * buffers they draw get filled).
 */
export function drawMaskMesh(state: GLState, options: DrawMaskMeshOptions): void {
  const { gl } = state;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (options.vertexCount === 0) return;

  gl.useProgram(state.program);
  gl.uniform2f(state.resolutionLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform2f(state.sheenCenterLoc, options.sheen.x, options.sheen.y);
  gl.uniform1f(state.sheenRadiusLoc, Math.max(options.sheen.radius, 1));
  gl.uniform1f(state.sheenActiveLoc, options.sheen.radius > 0 ? 1 : 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, options.texture ?? null);
  gl.uniform1i(state.textureLoc, 0);
  // Falls back to the flat masked colors if the source image never made it into a texture
  // (cross-origin, deleted, decode failure), regardless of where the slider sits.
  gl.uniform1f(state.textureMixLoc, options.texture ? options.textureMix : 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, options.maskTexture ?? null);
  gl.uniform1i(state.maskLoc, 1);
  gl.uniform1f(state.maskActiveLoc, options.maskTexture ? 1 : 0);
  gl.uniform3fv(state.glowColorLoc, options.glowColor);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.enableVertexAttribArray(state.positionLoc);
  gl.vertexAttribPointer(state.positionLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.enableVertexAttribArray(state.colorLoc);
  gl.vertexAttribPointer(state.colorLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
  gl.enableVertexAttribArray(state.barycentricLoc);
  gl.vertexAttribPointer(state.barycentricLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
  gl.enableVertexAttribArray(state.uvLoc);
  gl.vertexAttribPointer(state.uvLoc, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, options.vertexCount);
}

// Reading getComputedStyle-style colors ("shaded" is any CSS color the server feels like emitting) is
// only reliable via a 1x1 2d canvas round-trip -- it's the one place the browser will parse arbitrary
// CSS color syntax for us instead of hand-rolling a parser for rgb()/hex/named colors.
export function colorToRGB01(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

/**
 * Rasterize the silhouette curves, and the glow outside them, into the mask
 * texture the fragment shader reads -- the WebGL stand-in for ctx.clip(),
 * which has no GL equivalent.
 *
 * Filling on a 2d context rather than tessellating the Beziers into GL
 * geometry is deliberate: Path2D already understands cubic path data and the
 * nonzero winding rule that makes each curve's holes punch through, and its
 * fill is antialiased, so the clipped edge lands smooth for free. The mask is
 * only rebuilt when a curve arrives (a handful of times per image), so the 2d
 * round-trip never touches the per-frame path.
 *
 * The glow is drawn as concentric strokes, widest first, one per measured
 * band. A stroke is centred on its path, so half-width `offset` reaches
 * exactly that far out and the solid fill afterwards covers the half that
 * fell inward. Strokes rather than a shadowBlur because the measured falloff
 * is not Gaussian -- it drops far faster right at the edge than any blur
 * does, and shadowBlur would render it as a flat haze.
 *
 * Red marks glow and black marks subject, giving the shader its .r channel.
 * Hue survives the un-premultiply on upload even where alpha is tiny, which a
 * brightness ramp would not.
 */
export function uploadCurveMask(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  curves: { d: string; glow: { offset: number; opacity: number }[] }[],
  existing: WebGLTexture | undefined,
): WebGLTexture | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return existing;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Round joins: at these stroke widths a default miter would throw long
  // spikes off every corner of the outline.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ff0000";

  for (const curve of curves) {
    const path = new Path2D(curve.d);
    let covered = 0;
    for (const stop of [...curve.glow].sort((a, b) => b.offset - a.offset)) {
      // Each stroke lands on top of the wider ones already drawn, so painting
      // this band's opacity directly would stack on what's underneath and run
      // the falloff dark. Solve instead for the alpha that takes the
      // accumulated coverage from where it is to where this band wants it.
      const alpha = (stop.opacity - covered) / (1 - covered);
      if (!(alpha > 0)) continue;
      ctx.globalAlpha = Math.min(alpha, 1);
      ctx.lineWidth = stop.offset * 2;
      ctx.stroke(path);
      covered = stop.opacity;
    }
  }

  ctx.globalAlpha = 1;
  // Opaque black over the top: full coverage for the subject, and .r back to
  // 0 so the shader stops treating it as glow.
  ctx.fillStyle = "#000000";
  for (const curve of curves) ctx.fill(new Path2D(curve.d));

  const texture = existing ?? gl.createTexture();
  if (!texture) return undefined;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Same y-flip as the source-image texture, so the mask lines up with the
  // UVs the mesh's vertices already carry. Un-premultiplied on purpose: the
  // shader reads .r as a ratio independent of .a, which only holds if the
  // colour hasn't been scaled by alpha.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  // LINEAR + CLAMP_TO_EDGE and no mipmaps: required for a non-power-of-two
  // texture in WebGL1, which an arbitrary image size usually is.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function loadImageTexture(
  gl: WebGLRenderingContext,
  src: string,
  onLoaded: (texture: WebGLTexture) => void,
  onError?: (error: unknown) => void,
): void {
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
      onLoaded(texture);
    } catch (error) {
      onError?.(error);
    }
  };
  image.onerror = (error) => {
    onError?.(error);
  };
  image.src = src;
}

// Pulls the vertex coordinates back out of a path's `d` string ("M x,y L x,y L x,y Z") --
// PolygonPath_V1_0 (the persisted, post-mask format) only keeps `d`, unlike the live
// streaming MaskTriangle_V1_0 which also carries a raw `points` array alongside it.
export function parsePathPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /(-?\d*\.?\d+(?:e[-+]?\d+)?)[,\s]+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) {
    points.push([parseFloat(match[1]), parseFloat(match[2])]);
  }
  return points;
}

/**
 * Builds the static position/color/barycentric/uv buffers for an already-complete mask
 * result (see ProjectMaskItem's "static" source in draggables/project-mask-item.tsx) -- the persisted
 * counterpart to that same component's "live" source, which builds the buffers incrementally as
 * curves/triangles stream in instead. Since the whole mesh is in hand up front here, it's built
 * once rather than incrementally.
 */
export function buildStaticMaskMesh(
  maskData: {
    width: number;
    height: number;
    polygons: { d: string; fill: string }[];
    curves: { d: string; fill: string }[];
  },
  colorCtx: CanvasRenderingContext2D,
): { positions: number[]; colors: number[]; barycentrics: number[]; uvs: number[]; vertexCount: number } {
  const positions: number[] = [];
  const colors: number[] = [];
  const barycentrics: number[] = [];
  const uvs: number[] = [];

  // A backing quad under the mesh, trimmed to the silhouette by the curve mask (see
  // uploadCurveMask) -- without it, the sliver between the mesh's straight boundary chords and
  // the smooth curve it's inscribed in would read as a transparent fringe around the shape.
  if (maskData.curves.length > 0) {
    const [r, g, b] = colorToRGB01(colorCtx, maskData.curves[0].fill);
    const corners: [number, number][] = [
      [0, 0],
      [maskData.width, 0],
      [0, maskData.height],
      [maskData.width, 0],
      [maskData.width, maskData.height],
      [0, maskData.height],
    ];
    for (const [x, y] of corners) {
      positions.push(x, y);
      colors.push(r, g, b);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
      barycentrics.push(1, 1, 1);
    }
  }

  for (const polygon of maskData.polygons) {
    const [r, g, b] = colorToRGB01(colorCtx, polygon.fill);
    for (const [x, y] of parsePathPoints(polygon.d)) {
      positions.push(x, y);
      colors.push(r, g, b);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
    }
    barycentrics.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }

  return { positions, colors, barycentrics, uvs, vertexCount: positions.length / 2 };
}

export type MaskMeshRefs = {
  positionsRef: React.RefObject<number[]>;
  colorsRef: React.RefObject<number[]>;
  barycentricsRef: React.RefObject<number[]>;
  uvsRef: React.RefObject<number[]>;
  vertexCountRef: React.RefObject<number>;
  dirtyRef: React.RefObject<boolean>;
  curvesRef: React.RefObject<MaskCurve_V1_0[]>;
  glowColorRef: React.RefObject<[number, number, number]>;
};
