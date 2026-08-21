import type { MaskCurve_V1_0, PeakBlackPoint_V1_0 } from "./workspace.server";
import type { PeakShape } from "./canvas-media/peak-shape";

export const CAPTURE_SIZE_CSS_PX_DEFAULT = 150;
export const CAPTURE_INTENSITY_DEFAULT = 0.05;
export const CAPTURE_FALLOFF_CSS_PX_DEFAULT = 350;
export const CAPTURE_DARKNESS_DEFAULT = 0.2;
export const CAPTURE_FALLOFF_TO_SIZE_RATIO = CAPTURE_FALLOFF_CSS_PX_DEFAULT / CAPTURE_SIZE_CSS_PX_DEFAULT;
export const TEXTURE_MIX_DEFAULT = 0.5;
export const MAX_MASK_LIGHT_SOURCES = 8;
export const MAX_MASK_PEAKS = 16;
export const PEAK_ELEVATION_DEFAULT = 80;
export const MAX_MASK_PEAK_ELEVATION = 300;
export const MIN_MASK_PEAK_FALLOFF = 1.0;
export const MAX_MASK_PEAK_FALLOFF = 6.0;
export const MIN_MASK_PEAK_RADIUS_PX = 8;
export const MASK_PEAK_SWELL = 0.5;
export const MASK_PEAK_SWELL_LIMIT = 0.9;
export const PEAK_SHAPE_SLOPE_RANGE = 8.0;
export const PEAK_SHAPE_MIN_RHO = 0.05;
export const PEAK_GRADIENT_LIMIT = 32.0;
export const PEAK_BLACK_POINT_RELIEF_K = 1e-3;
export const PEAK_BLACK_POINT_HALO_MAX = 0.2;
export const PEAK_BLACK_POINT_HALO_EASE = 0.35;
export const PEAK_BLACK_POINT_HALO_FADE = 1.5;
export const MASK_BUMP_STRENGTH = 0.85;
export const MASK_LIGHT_HEIGHT_SCALE = 1.0;
export const PEAK_SUBDIVISION_TOLERANCE_PX = 0.75;
export const MASK_STROKE_WIDTH_PX = 1.0;
export const MASK_HIGHLIGHT_STROKE_WIDTH_PX = 3.0;
export const MASK_STROKE_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 0.2];
export const HIGHLIGHT_SELECTED_COLOR: [number, number, number, number] = [0.258824, 0.521569, 0.956863, 1.0];
export const HIGHLIGHT_SIBLING_COLOR: [number, number, number, number] = [0.258824, 0.521569, 0.956863, 0.35];
export const HIGHLIGHT_MOVING_COLOR: [number, number, number, number] = [1, 1, 1, 0.15];

function glFloat(n: number): string {
  return n.toFixed(6);
}

export interface Shader {
  vertex: string;
  fragment: string;
}

const PEAK_FIELD_GLSL = `
#define MAX_MASK_PEAKS ${MAX_MASK_PEAKS}
#define MASK_PEAK_SWELL ${glFloat(MASK_PEAK_SWELL)}
#define MASK_PEAK_SWELL_LIMIT ${glFloat(MASK_PEAK_SWELL_LIMIT)}
#define PEAK_SHAPE_SLOPE_RANGE ${glFloat(PEAK_SHAPE_SLOPE_RANGE)}
#define PEAK_SHAPE_MIN_RHO ${glFloat(PEAK_SHAPE_MIN_RHO)}
#define PEAK_GRADIENT_LIMIT ${glFloat(PEAK_GRADIENT_LIMIT)}
#define PEAK_FIELD_PI 3.141592653589793

uniform mediump vec4 u_peaks[MAX_MASK_PEAKS];
uniform mediump float u_peakFalloffs[MAX_MASK_PEAKS];
uniform mediump int u_peakCount;

uniform mediump sampler2D u_peakShapes;
uniform mediump float u_peakShapeRows[MAX_MASK_PEAKS];
uniform mediump float u_peakShapeSamples;

float decodePeakShape16(vec2 bytes) {
  return bytes.x + bytes.y * (1.0 / 255.0);
}

vec2 peakShapeAt(float row, float theta) {
  if (row < 0.0) return vec2(1.0, 0.0);
  float t = (theta + PEAK_FIELD_PI) / (2.0 * PEAK_FIELD_PI) * u_peakShapeSamples;
  float index = floor(t);
  float v = (row + 0.5) / float(MAX_MASK_PEAKS);
  vec4 lower = texture2D(u_peakShapes, vec2((index + 0.5) / u_peakShapeSamples, v));
  vec4 upper = texture2D(u_peakShapes, vec2((index + 1.5) / u_peakShapeSamples, v));
  vec2 pair = mix(
    vec2(decodePeakShape16(lower.rg), decodePeakShape16(lower.ba)),
    vec2(decodePeakShape16(upper.rg), decodePeakShape16(upper.ba)),
    t - index);
  return vec2(max(pair.x, PEAK_SHAPE_MIN_RHO), (pair.y * 2.0 - 1.0) * PEAK_SHAPE_SLOPE_RANGE);
}

vec2 peakProfile(float u, float falloff) {
  float s = max(1.0 - u * u, 0.0);
  float sSafe = max(s, 1e-4);
  float k = pow(sSafe, falloff);
  float dk = -2.0 * falloff * u * pow(sSafe, falloff - 1.0);
  return vec2(k, dk);
}

vec3 peakField(vec2 p) {
  vec3 field = vec3(0.0);
  for (int i = 0; i < MAX_MASK_PEAKS; i++) {
    if (i >= u_peakCount) break;
    vec2 toPoint = p - u_peaks[i].xy;
    float elevation = u_peaks[i].w;
    float dist = length(toPoint);
    float theta = dist > 1e-4 ? atan(toPoint.y, toPoint.x) : 0.0;
    vec2 shape = peakShapeAt(u_peakShapeRows[i], theta);
    float radius = u_peaks[i].z * shape.x;
    float u = dist / radius;
    if (u >= 1.0) continue;
    vec2 profile = peakProfile(u, u_peakFalloffs[i]);
    field.z += elevation * profile.x;
    if (dist > 1e-4) {
      vec2 radial = toPoint / dist;
      vec2 tangential = vec2(-radial.y, radial.x);
      vec2 gradU = radial / radius - tangential * (shape.y / (u_peaks[i].z * shape.x * shape.x));
      gradU = clamp(gradU, -PEAK_GRADIENT_LIMIT, PEAK_GRADIENT_LIMIT);
      field.xy = clamp(
        field.xy + (elevation * profile.y) * gradU, -PEAK_GRADIENT_LIMIT, PEAK_GRADIENT_LIMIT);
    }
  }
  return field;
}

vec2 peakSwell(vec2 p) {
  vec2 swell = vec2(0.0);
  for (int i = 0; i < MAX_MASK_PEAKS; i++) {
    if (i >= u_peakCount) break;
    vec2 toPoint = p - u_peaks[i].xy;
    float dist = length(toPoint);
    float theta = dist > 1e-4 ? atan(toPoint.y, toPoint.x) : 0.0;
    float radius = u_peaks[i].z * peakShapeAt(u_peakShapeRows[i], theta).x;
    float u = dist / radius;
    if (u >= 1.0) continue;
    float height = u_peaks[i].w * peakProfile(u, u_peakFalloffs[i]).x;
    float coefficient = clamp(
      MASK_PEAK_SWELL * height / radius, -MASK_PEAK_SWELL_LIMIT, MASK_PEAK_SWELL_LIMIT);
    swell += coefficient * toPoint;
  }
  return swell;
}
`;

export const LIGHT_SOURCE_SHADER: Shader = {
  vertex: `
attribute vec2 a_position;
attribute vec3 a_color;
attribute vec3 a_barycentric;
attribute vec2 a_uv;
attribute vec2 a_centroid;
attribute vec4 a_highlight;

uniform mediump vec2 u_resolution;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying vec4 v_highlight;
varying vec2 v_meshPos;
${PEAK_FIELD_GLSL}
void main() {
  vec2 displaced = a_position + peakSwell(a_position);
  vec2 zeroToOne = displaced / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_color = a_color;
  v_barycentric = a_barycentric;
  v_uv = a_uv;
  v_meshPos = a_position;
  vec2 centroid = a_centroid + peakSwell(a_centroid);
  v_lightSourcePos = vec2(centroid.x, u_resolution.y - centroid.y);
  v_highlight = a_highlight;
}
`,
  fragment: `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
${PEAK_FIELD_GLSL}
varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying vec4 v_highlight;
varying vec2 v_meshPos;

#define BUMP_STRENGTH ${glFloat(MASK_BUMP_STRENGTH)}
#define LIGHT_HEIGHT_SCALE ${glFloat(MASK_LIGHT_HEIGHT_SCALE)}

uniform vec2 u_resolution;

const vec3 STROKE_COLOR = vec3(${MASK_STROKE_COLOR.slice(0, 3).map(glFloat).join(", ")});
const float STROKE_ALPHA = ${glFloat(MASK_STROKE_COLOR[3])};

#define MAX_LIGHT_SOURCES 8

#define STROKE_WIDTH_PX ${glFloat(MASK_STROKE_WIDTH_PX)}
#define HIGHLIGHT_STROKE_WIDTH_PX ${glFloat(MASK_HIGHLIGHT_STROKE_WIDTH_PX)}

uniform vec2 u_lightSourceCenters[MAX_LIGHT_SOURCES];
uniform float u_lightSourceRadii[MAX_LIGHT_SOURCES];
uniform float u_lightSourceFalloffs[MAX_LIGHT_SOURCES];
uniform float u_lightSourceIntensities[MAX_LIGHT_SOURCES];
uniform float u_lightSourceDarknesses[MAX_LIGHT_SOURCES];
uniform int u_lightSourceCount;

uniform float u_textureMix;
uniform sampler2D u_texture;
uniform float u_hasTexture;

uniform sampler2D u_mask;
uniform float u_maskActive;
uniform vec3 u_glowColor;

uniform vec4 u_peakBlackPoints[MAX_MASK_PEAKS];

#define BLACK_POINT_HALO_MAX ${glFloat(PEAK_BLACK_POINT_HALO_MAX)}
#define BLACK_POINT_HALO_EASE ${glFloat(PEAK_BLACK_POINT_HALO_EASE)}
#define BLACK_POINT_HALO_FADE ${glFloat(PEAK_BLACK_POINT_HALO_FADE)}
#define BLACK_POINT_RELIEF_K ${glFloat(PEAK_BLACK_POINT_RELIEF_K)}
#define PEAK_FALLOFF_MIN ${glFloat(MIN_MASK_PEAK_FALLOFF)}
#define PEAK_FALLOFF_MAX ${glFloat(MAX_MASK_PEAK_FALLOFF)}

vec4 peakBlackPoint(vec2 p) {
  vec3 color = vec3(0.0);
  float total = 0.0;
  float weight = 0.0;
  for (int i = 0; i < MAX_MASK_PEAKS; i++) {
    if (i >= u_peakCount) break;
    vec2 toPoint = p - u_peaks[i].xy;
    float dist = length(toPoint);
    float theta = dist > 1e-4 ? atan(toPoint.y, toPoint.x) : 0.0;
    float radius = u_peaks[i].z * peakShapeAt(u_peakShapeRows[i], theta).x;
    float u = dist / radius;
    float falloff = max(u_peakFalloffs[i], PEAK_FALLOFF_MIN);
    float reliefEnd = sqrt(max(1.0 - pow(BLACK_POINT_RELIEF_K, 1.0 / falloff), 0.0));
    float haloT = clamp((falloff - PEAK_FALLOFF_MIN) / (PEAK_FALLOFF_MAX - PEAK_FALLOFF_MIN), 0.0, 1.0);
    float halo = BLACK_POINT_HALO_MAX * pow(haloT, BLACK_POINT_HALO_EASE);
    if (u >= reliefEnd + halo) continue;
    float t = clamp((u - reliefEnd) / max(halo, 1e-4), 0.0, 1.0);
    float w = pow(1.0 - t, BLACK_POINT_HALO_FADE) * u_peakBlackPoints[i].a;
    color += u_peakBlackPoints[i].rgb * w;
    total += w;
    weight = max(weight, w);
  }
  return total > 0.0 ? vec4(color / total, weight) : vec4(0.0);
}

vec3 liftToBlackPoint(vec3 color, vec4 blackPoint) {
  vec3 lifted = blackPoint.rgb + clamp(color, 0.0, 1.0) * (1.0 - blackPoint.rgb);
  return mix(color, lifted, blackPoint.a);
}

void main() {
  vec3 baryDeriv = fwidth(v_barycentric);
  vec3 edgeFactors = smoothstep(vec3(0.0), baryDeriv * STROKE_WIDTH_PX, v_barycentric);
  float edge = 1.0 - min(min(edgeFactors.x, edgeFactors.y), edgeFactors.z);
  vec3 highlightFactors = smoothstep(vec3(0.0), baryDeriv * HIGHLIGHT_STROKE_WIDTH_PX, v_barycentric);
  float highlightEdge = 1.0 - min(min(highlightFactors.x, highlightFactors.y), highlightFactors.z);

  vec2 screenUV = gl_FragCoord.xy / u_resolution;
  vec3 base = u_hasTexture > 0.5 ? texture2D(u_texture, screenUV).rgb : v_color;

  vec3 field = peakField(v_meshPos);
  vec3 normal = normalize(vec3(-field.xy, 1.0));
  vec3 surface = vec3(v_meshPos, field.z);
  float bumpLit = 0.0;
  float bumpShade = 0.0;

  float bestHighlight = 0.0;
  float leastShadow = 0.0;
  for (int i = 0; i < MAX_LIGHT_SOURCES; i++) {
    if (i >= u_lightSourceCount) break;
    float dist = distance(v_lightSourcePos, u_lightSourceCenters[i]);
    float highlight = 1.0 - smoothstep(u_lightSourceRadii[i] * 0.35, u_lightSourceRadii[i], dist);
    float shadow = smoothstep(u_lightSourceRadii[i], u_lightSourceRadii[i] + u_lightSourceFalloffs[i], dist);
    float shadowContribution = shadow * u_lightSourceDarknesses[i];
    bestHighlight = max(bestHighlight, highlight * u_lightSourceIntensities[i]);
    leastShadow = i == 0 ? shadowContribution : min(leastShadow, shadowContribution);

    vec3 lightPos = vec3(u_lightSourceCenters[i].x,
                         u_resolution.y - u_lightSourceCenters[i].y,
                         u_lightSourceRadii[i] * LIGHT_HEIGHT_SCALE);
    vec3 lightDir = normalize(lightPos - surface);
    float bump = dot(normal, lightDir) - lightDir.z;
    float reach = 1.0 - shadow;
    bumpLit = max(bumpLit, max(bump, 0.0) * reach * BUMP_STRENGTH);
    bumpShade = max(bumpShade, max(-bump, 0.0) * reach * BUMP_STRENGTH);
  }

  vec3 lit = mix(base, vec3(1.0), min(bestHighlight + bumpLit, 1.0));
  vec4 blackPoint = peakBlackPoint(v_meshPos);
  vec3 shaded = liftToBlackPoint(lit - leastShadow - bumpShade, blackPoint);
  vec3 strokeColor = liftToBlackPoint(STROKE_COLOR - leastShadow - bumpShade, blackPoint);
  vec3 withEdge = mix(shaded, strokeColor, edge * u_textureMix * STROKE_ALPHA);

  vec4 mask = texture2D(u_mask, v_uv);
  vec3 withGlow = mix(withEdge, u_glowColor, mask.r * u_maskActive);

  float captureEdge = highlightEdge * v_highlight.a;
  vec3 withCaptureStroke = mix(withGlow, v_highlight.rgb, captureEdge);

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
  peaksLoc: WebGLUniformLocation;
  peakFalloffsLoc: WebGLUniformLocation;
  peakCountLoc: WebGLUniformLocation;
  peakShapesLoc: WebGLUniformLocation;
  peakShapeRowsLoc: WebGLUniformLocation;
  peakShapeSamplesLoc: WebGLUniformLocation;
  peakBlackPointsLoc: WebGLUniformLocation;
  peakShapeTexture: WebGLTexture;
  peakShapeSignature: string;
  supportsVertexTextures: boolean;
  textureMixLoc: WebGLUniformLocation;
  textureLoc: WebGLUniformLocation;
  hasTextureLoc: WebGLUniformLocation;
  maskLoc: WebGLUniformLocation;
  maskActiveLoc: WebGLUniformLocation;
  glowColorLoc: WebGLUniformLocation;
}

export function encodePeakShapeTexture(shapes: (PeakShape | undefined)[], samples: number, rows: number): Uint8Array {
  const data = new Uint8Array(samples * rows * 4);
  shapes.forEach((shape, row) => {
    if (!shape || row >= rows) return;
    for (let i = 0; i < samples; i++) {
      const offset = (row * samples + i) * 4;
      const rho = Math.min(Math.max(shape.rho[i] ?? 1, 0), 1);
      const slope = shape.rhoPrime[i] ?? 0;
      const biased = Math.min(Math.max(slope / PEAK_SHAPE_SLOPE_RANGE, -1), 1) * 0.5 + 0.5;
      const rhoScaled = rho * 255;
      const slopeScaled = biased * 255;
      data[offset] = Math.floor(rhoScaled);
      data[offset + 1] = Math.round((rhoScaled - Math.floor(rhoScaled)) * 255);
      data[offset + 2] = Math.floor(slopeScaled);
      data[offset + 3] = Math.round((slopeScaled - Math.floor(slopeScaled)) * 255);
    }
  });
  return data;
}

export function initGLState(canvas: HTMLCanvasElement): GLState | undefined {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) return undefined;
  if (!gl.getExtension("OES_standard_derivatives")) return undefined;
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
  const peakShapeTexture = gl.createTexture();
  if (!peakShapeTexture) return undefined;
  gl.bindTexture(gl.TEXTURE_2D, peakShapeTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const lightSourceCentersLoc = gl.getUniformLocation(program, "u_lightSourceCenters");
  const lightSourceRadiiLoc = gl.getUniformLocation(program, "u_lightSourceRadii");
  const lightSourceFalloffsLoc = gl.getUniformLocation(program, "u_lightSourceFalloffs");
  const lightSourceIntensitiesLoc = gl.getUniformLocation(program, "u_lightSourceIntensities");
  const lightSourceDarknessesLoc = gl.getUniformLocation(program, "u_lightSourceDarknesses");
  const lightSourceCountLoc = gl.getUniformLocation(program, "u_lightSourceCount");
  const peaksLoc = gl.getUniformLocation(program, "u_peaks");
  const peakFalloffsLoc = gl.getUniformLocation(program, "u_peakFalloffs");
  const peakCountLoc = gl.getUniformLocation(program, "u_peakCount");
  const peakShapesLoc = gl.getUniformLocation(program, "u_peakShapes");
  const peakShapeRowsLoc = gl.getUniformLocation(program, "u_peakShapeRows");
  const peakShapeSamplesLoc = gl.getUniformLocation(program, "u_peakShapeSamples");
  const peakBlackPointsLoc = gl.getUniformLocation(program, "u_peakBlackPoints");
  const textureMixLoc = gl.getUniformLocation(program, "u_textureMix");
  const textureLoc = gl.getUniformLocation(program, "u_texture");
  const hasTextureLoc = gl.getUniformLocation(program, "u_hasTexture");
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
    !peaksLoc ||
    !peakFalloffsLoc ||
    !peakCountLoc ||
    !peakShapesLoc ||
    !peakShapeRowsLoc ||
    !peakShapeSamplesLoc ||
    !peakBlackPointsLoc ||
    !textureMixLoc ||
    !textureLoc ||
    !hasTextureLoc ||
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
    peaksLoc,
    peakFalloffsLoc,
    peakCountLoc,
    peakShapesLoc,
    peakShapeRowsLoc,
    peakShapeSamplesLoc,
    peakBlackPointsLoc,
    peakShapeTexture,
    peakShapeSignature: "",
    supportsVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0,
    textureMixLoc,
    textureLoc,
    hasTextureLoc,
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
  lightSources: MaskLightSource[];
  peaks: PeakGeometryInput[];
  textureMix: number;
  texture: WebGLTexture | undefined;
  maskTexture: WebGLTexture | undefined;
  glowColor: [number, number, number];
}

export function drawMaskMesh(state: GLState, options: DrawMaskMeshOptions): void {
  const { gl } = state;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (options.vertexCount === 0) return;

  gl.useProgram(state.program);
  gl.uniform2f(state.resolutionLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);

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

  const activePeaks = options.peaks
    .filter(isActivePeak)
    .sort((a, b) => Math.abs(b.elevation) - Math.abs(a.elevation))
    .slice(0, MAX_MASK_PEAKS);
  gl.uniform1i(state.peakCountLoc, activePeaks.length);
  if (activePeaks.length > 0) {
    const peaks = new Float32Array(activePeaks.length * 4);
    const falloffs = new Float32Array(activePeaks.length);
    const blackPoints = new Float32Array(activePeaks.length * 4);
    activePeaks.forEach((peak, i) => {
      peaks[i * 4] = peak.cx;
      peaks[i * 4 + 1] = peak.cy;
      peaks[i * 4 + 2] = Math.max(peak.radius, 1);
      peaks[i * 4 + 3] = peak.elevation;
      falloffs[i] = Math.max(peak.falloff, MIN_MASK_PEAK_FALLOFF);
      blackPoints[i * 4] = peak.blackPoint?.r ?? 0;
      blackPoints[i * 4 + 1] = peak.blackPoint?.g ?? 0;
      blackPoints[i * 4 + 2] = peak.blackPoint?.b ?? 0;
      blackPoints[i * 4 + 3] = peak.blackPoint?.a ?? 0;
    });
    gl.uniform4fv(state.peaksLoc, peaks);
    gl.uniform1fv(state.peakFalloffsLoc, falloffs);
    gl.uniform4fv(state.peakBlackPointsLoc, blackPoints);
  }

  const shapeRows = new Float32Array(MAX_MASK_PEAKS).fill(-1);
  const shapes = activePeaks.map((peak) => peak.shape);
  const usableShapes = state.supportsVertexTextures ? shapes : shapes.map(() => undefined);
  const samples = usableShapes.find((shape) => shape !== undefined)?.rho.length;
  if (samples !== undefined) {
    usableShapes.forEach((shape, i) => {
      if (shape) shapeRows[i] = i;
    });
    const signature = usableShapes.map((shape) => shape?.path ?? "").join("|");
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.peakShapeTexture);
    if (signature !== state.peakShapeSignature) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        samples,
        MAX_MASK_PEAKS,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        encodePeakShapeTexture(usableShapes, samples, MAX_MASK_PEAKS),
      );
      state.peakShapeSignature = signature;
    }
    gl.uniform1i(state.peakShapesLoc, 2);
    gl.uniform1f(state.peakShapeSamplesLoc, samples);
  }
  gl.uniform1fv(state.peakShapeRowsLoc, shapeRows);

  gl.uniform1f(state.textureMixLoc, options.textureMix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, options.texture ?? null);
  gl.uniform1i(state.textureLoc, 0);
  gl.uniform1f(state.hasTextureLoc, options.texture ? 1 : 0);

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
  gl.vertexAttribPointer(state.highlightLoc, 4, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, options.vertexCount);
}

export function colorToRGB01(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

export function uploadCurveMask(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  curves: { d: string; glow: { offset: number; opacity: number }[] }[],
  existing: WebGLTexture | undefined,
): WebGLTexture | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return existing;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ff0000";

  for (const curve of curves) {
    const path = new Path2D(curve.d);
    let covered = 0;
    for (const stop of [...curve.glow].sort((a, b) => b.offset - a.offset)) {
      const alpha = (stop.opacity - covered) / (1 - covered);
      if (!(alpha > 0)) continue;
      ctx.globalAlpha = Math.min(alpha, 1);
      ctx.lineWidth = stop.offset * 2;
      ctx.stroke(path);
      covered = stop.opacity;
    }
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  for (const curve of curves) ctx.fill(new Path2D(curve.d));

  const texture = existing ?? gl.createTexture();
  if (!texture) return undefined;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
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

export function parsePathPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /(-?\d*\.?\d+(?:e[-+]?\d+)?)[,\s]+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) {
    points.push([parseFloat(match[1]), parseFloat(match[2])]);
  }
  return points;
}

const WELD_EPSILON_PX = 0.1;

function weldPoints(pointGroups: [number, number][][]): void {
  const canonical = new Map<string, [number, number]>();
  for (const points of pointGroups) {
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      const key = `${Math.round(x / WELD_EPSILON_PX)},${Math.round(y / WELD_EPSILON_PX)}`;
      const existing = canonical.get(key);
      if (existing) {
        points[i] = existing;
      } else {
        canonical.set(key, points[i]);
      }
    }
  }
}

export function buildWeldedMaskPointGroups(maskData: {
  width: number;
  height: number;
  polygons: { d: string }[];
  curves: { d: string }[];
}): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
} {
  const corners: [number, number][] =
    maskData.curves.length > 0
      ? [
          [0, 0],
          [maskData.width, 0],
          [0, maskData.height],
          [maskData.width, 0],
          [maskData.width, maskData.height],
          [0, maskData.height],
        ]
      : [];
  const polygonPointSets = maskData.polygons.map((polygon) => parsePathPoints(polygon.d));
  weldPoints([corners, ...polygonPointSets]);
  return { corners, polygonPointSets };
}

function assembleMaskMeshPositions(
  maskData: { width: number; height: number },
  corners: [number, number][],
  polygonPointSets: [number, number][][],
): { positions: number[]; uvs: number[]; centroids: number[] } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const centroids: number[] = [];

  for (const [x, y] of corners) {
    positions.push(x, y);
    uvs.push(x / maskData.width, 1 - y / maskData.height);
    centroids.push(x, y);
  }

  polygonPointSets.forEach((points) => {
    const centroid: [number, number] = [
      points.reduce((sum, [x]) => sum + x, 0) / points.length,
      points.reduce((sum, [, y]) => sum + y, 0) / points.length,
    ];
    for (const [x, y] of points) {
      positions.push(x, y);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
      centroids.push(...centroid);
    }
  });

  return { positions, uvs, centroids };
}

export interface PeakGeometryInput {
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  shape?: PeakShape;
  blackPoint?: PeakBlackPoint_V1_0;
}

export function isActivePeak(peak: PeakGeometryInput): boolean {
  return peak.radius > 0 && peak.elevation !== 0;
}

export function peakProfileK(u: number, falloff: number): number {
  const s = Math.max(1 - u * u, 0);
  return Math.pow(Math.max(s, 1e-4), falloff);
}

export function peakShapeRhoAt(shape: PeakShape | undefined, theta: number): number {
  if (!shape) return 1;
  const samples = shape.rho.length;
  const t = ((theta + Math.PI) / (2 * Math.PI)) * samples;
  const index = Math.floor(t);
  const lower = shape.rho[((index % samples) + samples) % samples];
  const upper = shape.rho[(((index + 1) % samples) + samples) % samples];
  return Math.max(lower + (upper - lower) * (t - index), PEAK_SHAPE_MIN_RHO);
}

export function peakSwellAt(point: [number, number], peaks: PeakGeometryInput[]): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const peak of peaks) {
    const toPointX = point[0] - peak.cx;
    const toPointY = point[1] - peak.cy;
    const dist = Math.hypot(toPointX, toPointY);
    const radius = peak.shape
      ? peak.radius * peakShapeRhoAt(peak.shape, dist > 1e-4 ? Math.atan2(toPointY, toPointX) : 0)
      : peak.radius;
    const u = dist / radius;
    if (u >= 1) continue;
    const height = peak.elevation * peakProfileK(u, Math.max(peak.falloff, MIN_MASK_PEAK_FALLOFF));
    const coefficient = Math.min(
      Math.max((MASK_PEAK_SWELL * height) / peak.radius, -MASK_PEAK_SWELL_LIMIT),
      MASK_PEAK_SWELL_LIMIT,
    );
    dx += coefficient * toPointX;
    dy += coefficient * toPointY;
  }
  return [dx, dy];
}

const MAX_EDGE_SUBDIVISION_POINTS = 6;

function edgeSwellSag(a: [number, number], b: [number, number], peaks: PeakGeometryInput[]): number {
  const swellA = peakSwellAt(a, peaks);
  const swellB = peakSwellAt(b, peaks);
  let worst = 0;
  for (const t of [0.25, 0.5, 0.75]) {
    const at: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const swellAt = peakSwellAt(at, peaks);
    worst = Math.max(
      worst,
      Math.hypot(
        swellA[0] + (swellB[0] - swellA[0]) * t - swellAt[0],
        swellA[1] + (swellB[1] - swellA[1]) * t - swellAt[1],
      ),
    );
  }
  return worst;
}

function edgeSubdivisionCount(a: [number, number], b: [number, number], peaks: PeakGeometryInput[]): number {
  const sag = edgeSwellSag(a, b, peaks);
  if (!(sag > PEAK_SUBDIVISION_TOLERANCE_PX)) return 0;
  return Math.min(Math.ceil(Math.sqrt(sag / PEAK_SUBDIVISION_TOLERANCE_PX)) - 1, MAX_EDGE_SUBDIVISION_POINTS);
}

function pointsAlongEdge(a: [number, number], b: [number, number], n: number): [number, number][] {
  const points: [number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return points;
}

function pointId(point: [number, number], ids: Map<[number, number], number>): number {
  let id = ids.get(point);
  if (id === undefined) {
    id = ids.size;
    ids.set(point, id);
  }
  return id;
}

function edgeKey(idA: number, idB: number): string {
  return idA < idB ? `${idA},${idB}` : `${idB},${idA}`;
}

function computeEdgeSubdivisionCounts(
  triangles: [number, number][][],
  peaks: PeakGeometryInput[],
): { ids: Map<[number, number], number>; counts: Map<string, number> } {
  const ids = new Map<[number, number], number>();
  const counts = new Map<string, number>();
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  for (const tri of triangles) {
    for (const [i, j] of edges) {
      const a = tri[i];
      const b = tri[j];
      const key = edgeKey(pointId(a, ids), pointId(b, ids));
      if (!counts.has(key)) counts.set(key, edgeSubdivisionCount(a, b, peaks));
    }
  }
  return { ids, counts };
}

function boundaryLoopForTriangle(
  tri: [number, number][],
  ids: Map<[number, number], number>,
  counts: Map<string, number>,
): [number, number][] {
  const [a, b, c] = tri;
  const loop: [number, number][] = [];
  for (const [p, q] of [
    [a, b],
    [b, c],
    [c, a],
  ] as [number, number][][]) {
    loop.push(p);
    const n = counts.get(edgeKey(pointId(p, ids), pointId(q, ids))) ?? 0;
    if (n > 0) loop.push(...pointsAlongEdge(p, q, n));
  }
  return loop;
}

function isStrictlyInsideTriangle(point: [number, number], tri: [number, number][]): boolean {
  const [a, b, c] = tri;
  const cross = (p: [number, number], q: [number, number]): number =>
    (q[0] - p[0]) * (point[1] - p[1]) - (q[1] - p[1]) * (point[0] - p[0]);
  const ab = cross(a, b);
  const bc = cross(b, c);
  const ca = cross(c, a);
  const epsilon = 1e-6;
  return (ab > epsilon && bc > epsilon && ca > epsilon) || (ab < -epsilon && bc < -epsilon && ca < -epsilon);
}

function fanTriangulate(
  loop: [number, number][],
  tri: [number, number][],
  peaks: PeakGeometryInput[],
): [number, number][][] {
  if (loop.length === 3) return [[loop[0], loop[1], loop[2]]];

  let anchor: [number, number] | undefined;
  let bestElevation = 0;
  for (const peak of peaks) {
    const epicenter: [number, number] = [peak.cx, peak.cy];
    if (Math.abs(peak.elevation) <= bestElevation) continue;
    if (!isStrictlyInsideTriangle(epicenter, tri)) continue;
    anchor = epicenter;
    bestElevation = Math.abs(peak.elevation);
  }
  const center: [number, number] = anchor ?? [
    loop.reduce((sum, [x]) => sum + x, 0) / loop.length,
    loop.reduce((sum, [, y]) => sum + y, 0) / loop.length,
  ];

  const triangles: [number, number][][] = [];
  for (let i = 0; i < loop.length; i++) {
    triangles.push([center, loop[i], loop[(i + 1) % loop.length]]);
  }
  return triangles;
}

function subdivideForPeaks(
  triangles: [number, number][][],
  peaks: PeakGeometryInput[],
): { outputTriangles: [number, number][][]; outputCounts: number[] } {
  const { ids, counts } = computeEdgeSubdivisionCounts(triangles, peaks);
  const outputTriangles: [number, number][][] = [];
  const outputCounts: number[] = [];
  for (const tri of triangles) {
    const fanned = fanTriangulate(boundaryLoopForTriangle(tri, ids, counts), tri, peaks);
    outputTriangles.push(...fanned);
    outputCounts.push(fanned.length);
  }
  return { outputTriangles, outputCounts };
}

export function subdivideMeshForPeaks(
  corners: [number, number][],
  polygonPointSets: [number, number][][],
  peaks: PeakGeometryInput[],
): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
  polygonOutputCounts: number[];
} {
  const active = peaks.filter(isActivePeak);
  if (active.length === 0) {
    return { corners, polygonPointSets, polygonOutputCounts: polygonPointSets.map(() => 1) };
  }

  const cornerTriangles: [number, number][][] = [];
  for (let i = 0; i + 3 <= corners.length; i += 3) cornerTriangles.push(corners.slice(i, i + 3));

  const { outputTriangles, outputCounts } = subdivideForPeaks([...cornerTriangles, ...polygonPointSets], active);

  const cornerOutputCount = outputCounts.slice(0, cornerTriangles.length).reduce((sum, n) => sum + n, 0);
  return {
    corners: outputTriangles.slice(0, cornerOutputCount).flat(),
    polygonPointSets: outputTriangles.slice(cornerOutputCount),
    polygonOutputCounts: outputCounts.slice(cornerTriangles.length),
  };
}

export function buildStaticMaskMesh(
  maskData: {
    width: number;
    height: number;
    polygons: { d: string; fill: string }[];
    curves: { d: string; fill: string }[];
    peaks: PeakGeometryInput[];
  },
  colorCtx: CanvasRenderingContext2D,
): {
  positions: number[];
  colors: number[];
  barycentrics: number[];
  uvs: number[];
  centroids: number[];
  vertexCount: number;
  vertexRanges: [number, number][];
} {
  const built = buildWeldedMaskPointGroups(maskData);
  let corners = built.corners;
  let polygonPointSets = built.polygonPointSets;
  let polygonOutputCounts = polygonPointSets.map(() => 1);

  if (maskData.peaks.some(isActivePeak)) {
    const subdivided = subdivideMeshForPeaks(corners, polygonPointSets, maskData.peaks);
    corners = subdivided.corners;
    polygonPointSets = subdivided.polygonPointSets;
    polygonOutputCounts = subdivided.polygonOutputCounts;
  }

  const { positions, uvs, centroids } = assembleMaskMeshPositions(maskData, corners, polygonPointSets);
  const colors: number[] = [];
  const barycentrics: number[] = [];

  if (maskData.curves.length > 0) {
    const [r, g, b] = colorToRGB01(colorCtx, maskData.curves[0].fill);
    for (let i = 0; i < corners.length; i++) {
      colors.push(r, g, b);
      barycentrics.push(1, 1, 1);
    }
  }

  const vertexRanges: [number, number][] = [];
  let vertex = corners.length;
  maskData.polygons.forEach((polygon, i) => {
    const [r, g, b] = colorToRGB01(colorCtx, polygon.fill);
    const outputCount = polygonOutputCounts[i] ?? 1;
    for (let t = 0; t < outputCount; t++) {
      colors.push(r, g, b, r, g, b, r, g, b);
      barycentrics.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    }
    vertexRanges.push([vertex, outputCount * 3]);
    vertex += outputCount * 3;
  });

  return { positions, colors, barycentrics, uvs, centroids, vertexCount: positions.length / 2, vertexRanges };
}

export function uploadStaticMaskMesh(
  state: GLState,
  mesh: { positions: number[]; colors: number[]; barycentrics: number[]; uvs: number[]; centroids: number[] },
): void {
  const { gl } = state;
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
