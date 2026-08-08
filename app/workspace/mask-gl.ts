import { MaskCurve_V1_0 } from "./workspace.server";

/** Default width/height of the light source's bright core, in on-screen (CSS) pixels -- converted to buffer pixels per frame. Adjustable via Maskbar's light source size slider. */
export const LIGHT_SOURCE_SIZE_CSS_PX_DEFAULT = 150;

/** Default brightness of the light source's core, 0-1 -- 1 mixes the epicenter fully to white. Adjustable via Maskbar's light source intensity slider. */
export const LIGHT_SOURCE_INTENSITY_DEFAULT = 0.05;

/** Default distance, in on-screen (CSS) pixels, over which the darkening ramps up beyond the core -- independent of canvas size. Adjustable via Maskbar's light source falloff slider. */
export const LIGHT_SOURCE_FALLOFF_CSS_PX_DEFAULT = 350;

/** Default strength of the darkening at the far edge of the spread, 0-1 -- 1 drives it fully to black. Adjustable via Maskbar's light source darkness slider. */
export const LIGHT_SOURCE_DARKNESS_DEFAULT = 0.2;

/** Default blend between the flat masked color and the source image sampled through the mesh, 0-1. Adjustable via Maskbar's texture slider. */
export const TEXTURE_MIX_DEFAULT = 0.5;

/** How many simultaneous light sources one mask's draw call supports -- must match the fragment
 * shader's own MAX_LIGHT_SOURCES #define below. drawMaskMesh silently drops anything past this
 * many entries in DrawMaskMeshOptions.lightSources. */
export const MAX_MASK_LIGHT_SOURCES = 8;

/** A vertex/fragment GLSL pair, compiled and linked together into one WebGLProgram by createProgram. */
export interface Shader {
  vertex: string;
  fragment: string;
}

export const LIGHT_SOURCE_SHADER: Shader = {
  vertex: `
attribute vec2 a_position;
attribute vec3 a_color;
attribute vec3 a_barycentric;
attribute vec2 a_uv;
// Every vertex of a triangle carries the same value here (its parent triangle's centroid, in
// the same space as a_position) -- see a_color for the same trick. Since all 3 corners agree,
// interpolating it across the triangle's interior can't produce anything but that one constant
// value, which is what lets the fragment shader treat a whole triangle as one light source facet
// instead of a continuous per-pixel gradient.
attribute vec2 a_centroid;
// 1.0 for every vertex of a triangle the app wants outlined (an active capture's own triangles --
// see ProjectMaskItem's recolorHighlight), 0.0 otherwise. A per-vertex float rather than a
// uniform flag so a single draw call can outline an arbitrary subset of the mesh's triangles.
attribute float a_highlight;

uniform vec2 u_resolution;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying float v_highlight;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_color = a_color;
  v_barycentric = a_barycentric;
  v_uv = a_uv;
  // a_centroid arrives in the same top-left/y-down space as a_position; flip it to match
  // gl_FragCoord's bottom-left origin, which is the space u_lightSourceCenter is given in.
  v_lightSourcePos = vec2(a_centroid.x, u_resolution.y - a_centroid.y);
  v_highlight = a_highlight;
}
`,
  fragment: `
precision mediump float;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying float v_highlight;

// Matches the rgba(66, 133, 244, 1) selection outline drawn around a selected media item
// (project-img.tsx/project-svg.tsx/project-mask-item.tsx) -- the active capture's own outline
// (see a_highlight/v_highlight), drawn as a stroke along the highlighted triangles' edges with
// no fill tint, so the capture's original colors stay untouched underneath it.
const vec3 CAPTURE_STROKE_COLOR = vec3(0.258824, 0.521569, 0.956863);

// A mesh can carry several captures (see project-mask-item.tsx), each its own light source --
// Play All animates every one of them at once (project-mask-item.tsx's playLightSourceAnimation),
// so this can no longer be one scalar epicenter. MAX_LIGHT_SOURCES bounds a GLSL ES 1.00 array's
// size, which has to be a compile-time constant -- generous relative to how many captures a mask
// realistically carries; drawMaskMesh (mask-gl.ts) silently drops anything past it.
#define MAX_LIGHT_SOURCES 8

// Every light source's own center is in gl_FragCoord space (drawing-buffer pixels, origin
// bottom-left); radius/falloff are likewise in drawing-buffer pixels so they survive the canvas
// being displayed at a different size than its backing resolution.
//
// Each is a light source for the whole mesh, not just a local glow: triangles inside its own
// u_lightSourceRadii[i] sit in its bright core, and everything further out darkens smoothly over
// the next u_lightSourceFalloffs[i] pixels, giving the flat-shaded mesh a 3D relief instead of an
// isolated highlight. The falloff is a distance, not a canvas-relative fraction, so it's tunable
// independent of how big the mesh happens to be on screen.
uniform vec2 u_lightSourceCenters[MAX_LIGHT_SOURCES];
uniform float u_lightSourceRadii[MAX_LIGHT_SOURCES];
uniform float u_lightSourceFalloffs[MAX_LIGHT_SOURCES];
// Brightness of each light's own core, 0-1 -- 1.0 mixes its epicenter fully to white rather than
// just tinting it.
uniform float u_lightSourceIntensities[MAX_LIGHT_SOURCES];
// Strength of each light's own darkening at the far edge of its spread, 0-1 -- 1.0 drives it
// fully to black.
uniform float u_lightSourceDarknesses[MAX_LIGHT_SOURCES];
// How many of the arrays above are actually populated -- drawMaskMesh only ever fills (and only
// ever counts) lights with a positive radius, so every index below this is implicitly active;
// there's no separate "active" flag to check per-light.
uniform int u_lightSourceCount;

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

  // v_lightSourcePos is constant across a triangle's interior (see a_centroid), so dist -- and
  // everything derived from it below -- is one flat value per triangle, not a smooth per-pixel
  // gradient. That's what makes the mesh's facets themselves read as the shading delimiters.
  //
  // Each active light contributes its own highlight/shadow at this facet; the brightest light's
  // highlight wins (mix() saturates past "fully lit" at 1.0, so summing would overshoot into
  // visible banding once two cores overlap) and the least-shadowed light's darkening wins (a
  // facet lit by any one nearby light shouldn't still read as fully shadowed just because a
  // second, farther light also has it inside its own falloff).
  float bestHighlight = 0.0;
  float leastShadow = 0.0;
  for (int i = 0; i < MAX_LIGHT_SOURCES; i++) {
    if (i >= u_lightSourceCount) break;
    float dist = distance(v_lightSourcePos, u_lightSourceCenters[i]);
    // Bright core: full strength within the inner 35% of the radius.
    float highlight = 1.0 - smoothstep(u_lightSourceRadii[i] * 0.35, u_lightSourceRadii[i], dist);
    // Beyond the core, darken smoothly over the next falloff pixels -- this is what makes the
    // whole mesh read as lit from one point instead of just the disc.
    float shadow = smoothstep(u_lightSourceRadii[i], u_lightSourceRadii[i] + u_lightSourceFalloffs[i], dist);
    float shadowContribution = shadow * u_lightSourceDarknesses[i];
    bestHighlight = max(bestHighlight, highlight * u_lightSourceIntensities[i]);
    leastShadow = i == 0 ? shadowContribution : min(leastShadow, shadowContribution);
  }

  // mix (not additive) so bestHighlight at 1.0 reaches pure white at an epicenter instead of just
  // an oversaturated tint.
  vec3 lit = mix(base, vec3(1.0), bestHighlight);
  vec3 shaded = lit - leastShadow;
  // The wireframe's own "white stroke" endpoint darkens with the same shadow term as the fill
  // above, so a triangle sitting deep in a light source's shadow doesn't keep a bright hairline
  // around it while its interior goes dark.
  vec3 strokeColor = vec3(1.0) - leastShadow;
  vec3 withEdge = mix(shaded, strokeColor, edge * 0.18);

  vec4 mask = texture2D(u_mask, v_uv);
  vec3 withGlow = mix(withEdge, u_glowColor, mask.r * u_maskActive);

  // A thicker, always-visible edge (independent of u_textureMix, unlike the subtle facet
  // wireframe above) around whichever triangles a_highlight marks -- outline only, the fill
  // underneath is left exactly as shaded above.
  float captureEdge = (1.0 - smoothstep(0.0, 0.08, edgeDist)) * v_highlight;
  vec3 withCaptureStroke = mix(withGlow, CAPTURE_STROKE_COLOR, captureEdge);

  gl_FragColor = vec4(withCaptureStroke, mix(1.0, mask.a, u_maskActive));
}
`,
};

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

export function createProgram(gl: WebGLRenderingContext, shader: Shader): WebGLProgram | undefined {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, shader.vertex);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, shader.fragment);
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
  centroidBuffer: WebGLBuffer;
  highlightBuffer: WebGLBuffer;
  positionLoc: number;
  colorLoc: number;
  barycentricLoc: number;
  uvLoc: number;
  centroidLoc: number;
  highlightLoc: number;
  resolutionLoc: WebGLUniformLocation;
  lightSourceCentersLoc: WebGLUniformLocation;
  lightSourceRadiiLoc: WebGLUniformLocation;
  lightSourceFalloffsLoc: WebGLUniformLocation;
  lightSourceIntensitiesLoc: WebGLUniformLocation;
  lightSourceDarknessesLoc: WebGLUniformLocation;
  lightSourceCountLoc: WebGLUniformLocation;
  textureLoc: WebGLUniformLocation;
  textureMixLoc: WebGLUniformLocation;
  maskLoc: WebGLUniformLocation;
  maskActiveLoc: WebGLUniformLocation;
  glowColorLoc: WebGLUniformLocation;
}

export function initGLState(canvas: HTMLCanvasElement): GLState | undefined {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) return undefined;
  const program = createProgram(gl, LIGHT_SOURCE_SHADER);
  if (!program) return undefined;

  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const barycentricBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const centroidBuffer = gl.createBuffer();
  const highlightBuffer = gl.createBuffer();
  if (!positionBuffer || !colorBuffer || !barycentricBuffer || !uvBuffer || !centroidBuffer || !highlightBuffer)
    return undefined;

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const colorLoc = gl.getAttribLocation(program, "a_color");
  const barycentricLoc = gl.getAttribLocation(program, "a_barycentric");
  const uvLoc = gl.getAttribLocation(program, "a_uv");
  const centroidLoc = gl.getAttribLocation(program, "a_centroid");
  const highlightLoc = gl.getAttribLocation(program, "a_highlight");
  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const lightSourceCentersLoc = gl.getUniformLocation(program, "u_lightSourceCenters");
  const lightSourceRadiiLoc = gl.getUniformLocation(program, "u_lightSourceRadii");
  const lightSourceFalloffsLoc = gl.getUniformLocation(program, "u_lightSourceFalloffs");
  const lightSourceIntensitiesLoc = gl.getUniformLocation(program, "u_lightSourceIntensities");
  const lightSourceDarknessesLoc = gl.getUniformLocation(program, "u_lightSourceDarknesses");
  const lightSourceCountLoc = gl.getUniformLocation(program, "u_lightSourceCount");
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
    centroidLoc < 0 ||
    highlightLoc < 0 ||
    !resolutionLoc ||
    !lightSourceCentersLoc ||
    !lightSourceRadiiLoc ||
    !lightSourceFalloffsLoc ||
    !lightSourceIntensitiesLoc ||
    !lightSourceDarknessesLoc ||
    !lightSourceCountLoc ||
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
    centroidBuffer,
    highlightBuffer,
    positionLoc,
    colorLoc,
    barycentricLoc,
    uvLoc,
    centroidLoc,
    highlightLoc,
    resolutionLoc,
    lightSourceCentersLoc,
    lightSourceRadiiLoc,
    lightSourceFalloffsLoc,
    lightSourceIntensitiesLoc,
    lightSourceDarknessesLoc,
    lightSourceCountLoc,
    textureLoc,
    textureMixLoc,
    maskLoc,
    maskActiveLoc,
    glowColorLoc,
  };
}

export interface MaskLightSource {
  x: number;
  y: number;
  radius: number;
  falloff: number;
  intensity: number;
  darkness: number;
}

export interface DrawMaskMeshOptions {
  vertexCount: number;
  // One entry per simultaneously-animating light source (see project-mask-item.tsx's
  // playLightSourceAnimation) -- only entries with a positive radius are actually sent to the
  // shader (see drawMaskMesh below), and only the first MAX_MASK_LIGHT_SOURCES of those.
  lightSources: MaskLightSource[];
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

  // Only lights with a positive radius count as active -- mirrors the old single-light
  // u_lightSourceActive gate, just decided client-side now instead of per-fragment, since an
  // inactive light contributes nothing the shader's loop needs to see at all.
  const activeLights = options.lightSources.filter((l) => l.radius > 0).slice(0, MAX_MASK_LIGHT_SOURCES);
  gl.uniform1i(state.lightSourceCountLoc, activeLights.length);
  if (activeLights.length > 0) {
    const centers = new Float32Array(activeLights.length * 2);
    const radii = new Float32Array(activeLights.length);
    const falloffs = new Float32Array(activeLights.length);
    const intensities = new Float32Array(activeLights.length);
    const darknesses = new Float32Array(activeLights.length);
    activeLights.forEach((light, i) => {
      centers[i * 2] = light.x;
      centers[i * 2 + 1] = light.y;
      radii[i] = Math.max(light.radius, 1);
      falloffs[i] = Math.max(light.falloff, 1);
      intensities[i] = light.intensity;
      darknesses[i] = light.darkness;
    });
    gl.uniform2fv(state.lightSourceCentersLoc, centers);
    gl.uniform1fv(state.lightSourceRadiiLoc, radii);
    gl.uniform1fv(state.lightSourceFalloffsLoc, falloffs);
    gl.uniform1fv(state.lightSourceIntensitiesLoc, intensities);
    gl.uniform1fv(state.lightSourceDarknessesLoc, darknesses);
  }

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

  gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
  gl.enableVertexAttribArray(state.centroidLoc);
  gl.vertexAttribPointer(state.centroidLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
  gl.enableVertexAttribArray(state.highlightLoc);
  gl.vertexAttribPointer(state.highlightLoc, 1, gl.FLOAT, false, 0, 0);

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
): {
  positions: number[];
  colors: number[];
  barycentrics: number[];
  uvs: number[];
  centroids: number[];
  vertexCount: number;
} {
  const positions: number[] = [];
  const colors: number[] = [];
  const barycentrics: number[] = [];
  const uvs: number[] = [];
  const centroids: number[] = [];

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
    // One shared centroid (the image's own center) for the whole quad rather than one per its
    // two triangles -- it's a rendering trick to fill the curve-clipped sliver, not real mesh
    // geometry, so splitting its light source facet in two would just show a seam along its diagonal.
    const center: [number, number] = [maskData.width / 2, maskData.height / 2];
    for (const [x, y] of corners) {
      positions.push(x, y);
      colors.push(r, g, b);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
      barycentrics.push(1, 1, 1);
      centroids.push(...center);
    }
  }

  for (const polygon of maskData.polygons) {
    const [r, g, b] = colorToRGB01(colorCtx, polygon.fill);
    const points = parsePathPoints(polygon.d);
    const centroid: [number, number] = [
      points.reduce((sum, [x]) => sum + x, 0) / points.length,
      points.reduce((sum, [, y]) => sum + y, 0) / points.length,
    ];
    for (const [x, y] of points) {
      positions.push(x, y);
      colors.push(r, g, b);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
      centroids.push(...centroid);
    }
    barycentrics.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }

  return { positions, colors, barycentrics, uvs, centroids, vertexCount: positions.length / 2 };
}

export type MaskMeshRefs = {
  positionsRef: React.RefObject<number[]>;
  colorsRef: React.RefObject<number[]>;
  barycentricsRef: React.RefObject<number[]>;
  uvsRef: React.RefObject<number[]>;
  centroidsRef: React.RefObject<number[]>;
  vertexCountRef: React.RefObject<number>;
  dirtyRef: React.RefObject<boolean>;
  curvesRef: React.RefObject<MaskCurve_V1_0[]>;
  glowColorRef: React.RefObject<[number, number, number]>;
};
