import type { MaskCurve_V1_0, ObjectFill_V1_0 } from "./workspace.server";
import { isBehindMask } from "./canvas-media/object-order.ts";
import { toCssSkewAngle } from "./skew-angle.ts";
import {
  OBJECT_SDF_MARGIN,
  OBJECT_SDF_TILE,
  objectShapeProfileU,
  type ObjectShape,
} from "./canvas-media/object-shape.ts";

export const LIGHT_SIZE_CSS_PX_DEFAULT = 150;
export const LIGHT_INTENSITY_DEFAULT = 0.05;
export const LIGHT_FALLOFF_CSS_PX_DEFAULT = 350;
export const LIGHT_DARKNESS_DEFAULT = 0.2;
export const LIGHT_FALLOFF_TO_SIZE_RATIO = LIGHT_FALLOFF_CSS_PX_DEFAULT / LIGHT_SIZE_CSS_PX_DEFAULT;
export const TEXTURE_MIX_DEFAULT = 1.0;
export const MAX_MASK_LIGHT_SOURCES = 8;
export const MAX_MASK_OBJECTS = 16;
export const OBJECT_ELEVATION_DEFAULT = 0;
export const MAX_MASK_OBJECT_ELEVATION = 300;
export const MIN_MASK_OBJECT_FALLOFF = 1.0;
export const MAX_MASK_OBJECT_FALLOFF = 6.0;
export const NEUTRAL_MASK_OBJECT_FALLOFF = 2.0;
export const MIN_MASK_OBJECT_RADIUS_PX = 8;
export const MASK_OBJECT_COLLISION_BUFFER_PX = 1;
export const MASK_OBJECT_SWELL = 0.5;
export const MASK_OBJECT_SWELL_LIMIT = 0.9;
export const OBJECT_SDF_GRID = 4;
export const OBJECT_SDF_ATLAS = OBJECT_SDF_GRID * OBJECT_SDF_TILE;
export const LIGHT_SDF_GRID = 3;
export const LIGHT_SDF_ATLAS = LIGHT_SDF_GRID * OBJECT_SDF_TILE;
export const OBJECT_SDF_RANGE = OBJECT_SDF_MARGIN * Math.SQRT2;
export const OBJECT_GRADIENT_LIMIT = 32.0;
export const MASK_BUMP_STRENGTH = 0.85;
export const MASK_LIGHT_HEIGHT_SCALE = 1.0;
export const OBJECT_SUBDIVISION_TOLERANCE_PX = 0.75;
export const MASK_STROKE_WIDTH_PX = 1.0;
export const MASK_HIGHLIGHT_STROKE_WIDTH_PX = 3.0;
export const MASK_STROKE_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 0.2];
export const HIGHLIGHT_SELECTED_COLOR: [number, number, number, number] = [0.258824, 0.521569, 0.956863, 1.0];
export const HIGHLIGHT_SIBLING_COLOR: [number, number, number, number] = [0.258824, 0.521569, 0.956863, 0.35];
export const HIGHLIGHT_MOVING_COLOR: [number, number, number, number] = [1, 1, 1, 0.15];
export const GRIDLINES_DIM_ALPHA = 0.5;
export const GRIDLINES_BRIGHT_ALPHA = 1;
export const MASK_BACKING_VERTEX_COUNT = 6;
export const MASK_BACKING_GREY_LEVEL = 0.55;

export function highlightShapeEditColor(bright: boolean): [number, number, number, number] {
  return [0.258824, 0.521569, 0.956863, bright ? GRIDLINES_BRIGHT_ALPHA : GRIDLINES_DIM_ALPHA];
}
export function highlightObjectReviewAddedColor(bright: boolean): [number, number, number, number] {
  return [0.984314, 0.65098, 0.152941, bright ? GRIDLINES_BRIGHT_ALPHA : GRIDLINES_DIM_ALPHA];
}

function glFloat(n: number): string {
  return n.toFixed(6);
}

export interface Shader {
  vertex: string;
  fragment: string;
}

const OBJECT_FIELD_GLSL = `
#define MAX_MASK_OBJECTS ${MAX_MASK_OBJECTS}
#define MASK_OBJECT_SWELL ${glFloat(MASK_OBJECT_SWELL)}
#define MASK_OBJECT_SWELL_LIMIT ${glFloat(MASK_OBJECT_SWELL_LIMIT)}
#define OBJECT_SDF_TILE ${glFloat(OBJECT_SDF_TILE)}
#define OBJECT_SDF_GRID ${glFloat(OBJECT_SDF_GRID)}
#define OBJECT_SDF_ATLAS ${glFloat(OBJECT_SDF_ATLAS)}
#define OBJECT_SDF_MARGIN ${glFloat(OBJECT_SDF_MARGIN)}
#define OBJECT_SDF_RANGE ${glFloat(OBJECT_SDF_RANGE)}
#define OBJECT_GRADIENT_LIMIT ${glFloat(OBJECT_GRADIENT_LIMIT)}
#define OBJECT_FIELD_PI 3.141592653589793

uniform mediump vec4 u_objects[MAX_MASK_OBJECTS];
uniform mediump float u_objectFalloffs[MAX_MASK_OBJECTS];
uniform mediump int u_objectCount;

uniform mediump float u_objectOrders[MAX_MASK_OBJECTS];
#define OBJECT_ORDER_EPSILON 0.5

bool objectBehindMask(float order) {
  return order < 0.0;
}

bool objectOutranks(float order, float bestOrder, float u, float nearest) {
  if (order > bestOrder + OBJECT_ORDER_EPSILON) return true;
  if (order < bestOrder - OBJECT_ORDER_EPSILON) return false;
  return u < nearest;
}

uniform mediump vec4 u_objectRotations[MAX_MASK_OBJECTS];
#define OBJECT_ROTATION_NONE vec4(1.0, 0.0, 0.0, 1.0)

uniform mediump sampler2D u_objectShapes;
uniform mediump float u_objectShapeRows[MAX_MASK_OBJECTS];
uniform mediump float u_objectShapeMaxDepth[MAX_MASK_OBJECTS];

float decodeObjectShape16(vec2 bytes) {
  return bytes.x + bytes.y * (1.0 / 255.0);
}

vec3 objectShapeTexel(float row, vec2 texel) {
  float col = mod(row, OBJECT_SDF_GRID);
  float band = floor(row / OBJECT_SDF_GRID);
  vec2 held = clamp(texel, vec2(0.0), vec2(OBJECT_SDF_TILE - 1.0));
  vec2 uv = (vec2(col, band) * OBJECT_SDF_TILE + held + 0.5) / OBJECT_SDF_ATLAS;
  vec4 stored = texture2D(u_objectShapes, uv);
  return vec3(
    (decodeObjectShape16(stored.rg) - 0.5) * 2.0 * OBJECT_SDF_RANGE,
    stored.ba * 2.0 - 1.0);
}

vec3 objectDepthAt(float row, vec2 n) {
  vec2 local = (n + OBJECT_SDF_MARGIN) / (2.0 * OBJECT_SDF_MARGIN) * OBJECT_SDF_TILE - 0.5;
  vec2 base = floor(local);
  vec2 f = local - base;
  vec3 top = mix(objectShapeTexel(row, base), objectShapeTexel(row, base + vec2(1.0, 0.0)), f.x);
  vec3 bottom = mix(
    objectShapeTexel(row, base + vec2(0.0, 1.0)),
    objectShapeTexel(row, base + vec2(1.0, 1.0)),
    f.x);
  vec3 sampled = mix(top, bottom, f.y);
  float reach = length(sampled.yz);
  return vec3(sampled.x, reach > 1e-4 ? sampled.yz / reach : vec2(0.0));
}

vec2 objectToShape(vec4 rotation, vec2 v) {
  return vec2(rotation.x * v.x + rotation.y * v.y, rotation.z * v.x + rotation.w * v.y);
}

vec2 objectToMesh(vec4 rotation, vec2 v) {
  return vec2(rotation.x * v.x + rotation.z * v.y, rotation.y * v.x + rotation.w * v.y);
}

vec3 objectU(float row, float maxDepth, vec2 toPoint, float radius, vec4 rotation) {
  vec2 n = objectToShape(rotation, toPoint / radius);
  if (row < 0.0) {
    float dist = length(n);
    vec2 gradient = dist > 1e-4 ? objectToMesh(rotation, n / dist) : vec2(0.0);
    return vec3(dist, gradient / radius);
  }
  vec3 depth = objectDepthAt(row, n);
  return vec3(1.0 - depth.x / maxDepth, objectToMesh(rotation, -depth.yz / maxDepth) / radius);
}

vec2 objectProfile(float u, float falloff) {
  float s = max(1.0 - u * u, 0.0);
  float sSafe = max(s, 1e-4);
  float k = pow(sSafe, falloff);
  float dk = -2.0 * falloff * u * pow(sSafe, falloff - 1.0);
  return vec2(k, dk);
}

vec3 objectField(vec2 p) {
  vec3 field = vec3(0.0);
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    if (objectBehindMask(u_objectOrders[i])) continue;
    vec2 toPoint = p - u_objects[i].xy;
    float elevation = u_objects[i].w;
    vec3 profileU = objectU(
      u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, u_objects[i].z, u_objectRotations[i]);
    float u = profileU.x;
    if (u >= 1.0) continue;
    vec2 profile = objectProfile(u, u_objectFalloffs[i]);
    field.z += elevation * profile.x;
    vec2 gradU = clamp(profileU.yz, -OBJECT_GRADIENT_LIMIT, OBJECT_GRADIENT_LIMIT);
    field.xy = clamp(
      field.xy + (elevation * profile.y) * gradU, -OBJECT_GRADIENT_LIMIT, OBJECT_GRADIENT_LIMIT);
  }
  return field;
}

vec2 objectSwell(vec2 p) {
  vec2 swell = vec2(0.0);
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    if (objectBehindMask(u_objectOrders[i])) continue;
    vec2 toPoint = p - u_objects[i].xy;
    float radius = u_objects[i].z;
    float u = objectU(
      u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, radius, u_objectRotations[i]).x;
    if (u >= 1.0) continue;
    float height = u_objects[i].w * objectProfile(u, u_objectFalloffs[i]).x;
    float coefficient = clamp(
      MASK_OBJECT_SWELL * height / radius, -MASK_OBJECT_SWELL_LIMIT, MASK_OBJECT_SWELL_LIMIT);
    swell += coefficient * toPoint;
  }
  return swell;
}
`;

const LIGHT_FIELD_GLSL = `
#define MAX_LIGHT_SOURCES ${MAX_MASK_LIGHT_SOURCES}
#define LIGHT_SDF_GRID ${glFloat(LIGHT_SDF_GRID)}
#define LIGHT_SDF_ATLAS ${glFloat(LIGHT_SDF_ATLAS)}

uniform mediump sampler2D u_lightShapes;
uniform mediump float u_lightShapeRows[MAX_LIGHT_SOURCES];
uniform mediump float u_lightShapeMaxDepth[MAX_LIGHT_SOURCES];

vec3 lightShapeTexel(float row, vec2 texel) {
  float col = mod(row, LIGHT_SDF_GRID);
  float band = floor(row / LIGHT_SDF_GRID);
  vec2 held = clamp(texel, vec2(0.0), vec2(OBJECT_SDF_TILE - 1.0));
  vec2 uv = (vec2(col, band) * OBJECT_SDF_TILE + held + 0.5) / LIGHT_SDF_ATLAS;
  vec4 stored = texture2D(u_lightShapes, uv);
  return vec3(
    (decodeObjectShape16(stored.rg) - 0.5) * 2.0 * OBJECT_SDF_RANGE,
    stored.ba * 2.0 - 1.0);
}

float lightDepthAt(float row, vec2 n) {
  vec2 local = (n + OBJECT_SDF_MARGIN) / (2.0 * OBJECT_SDF_MARGIN) * OBJECT_SDF_TILE - 0.5;
  vec2 base = floor(local);
  vec2 f = local - base;
  float top = mix(lightShapeTexel(row, base).x, lightShapeTexel(row, base + vec2(1.0, 0.0)).x, f.x);
  float bottom = mix(
    lightShapeTexel(row, base + vec2(0.0, 1.0)).x,
    lightShapeTexel(row, base + vec2(1.0, 1.0)).x,
    f.x);
  return mix(top, bottom, f.y);
}

vec2 lightProfile(float row, float maxDepth, vec2 toPoint, float radius) {
  float dist = length(toPoint);
  if (row < 0.0) return vec2(dist / radius, max(dist - radius, 0.0));

  vec2 n = toPoint / radius;
  float reach = length(n);
  float overshoot = max(reach - OBJECT_SDF_MARGIN, 0.0);
  vec2 sampled = n * min(1.0, OBJECT_SDF_MARGIN / max(reach, 1e-6));
  float depth = lightDepthAt(row, sampled) - overshoot;

  return vec2(1.0 - depth / maxDepth, max(-depth * radius, 0.0));
}
`;

const OBJECT_LIFT_GLSL = `
uniform mediump vec4 u_objectLifts[MAX_MASK_OBJECTS];

struct ObjectLift {
  vec2 uv;
  float body;
  vec2 underUv;
  float under;
  float hole;
};

float objectCoverage(float u, float radius) {
  float width = 1.0 / max(radius, 1.0);
  return 1.0 - smoothstep(1.0 - width, 1.0, u);
}

ObjectLift objectLift(vec2 meshPos) {
  vec2 own = gl_FragCoord.xy / u_resolution;
  ObjectLift lift = ObjectLift(own, 0.0, own, 0.0, 0.0);
  float nearest = 1.0;
  float bestOrder = -1e9;
  float underNearest = 1.0;
  float underBestOrder = -1e9;
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    if (u_objectLifts[i].w < 0.5) continue;

    vec2 center = u_objects[i].xy;
    float radius = u_objects[i].z;
    vec2 restCenter = u_objectLifts[i].xy;
    float restRadius = max(u_objectLifts[i].z, 1.0);
    float row = u_objectShapeRows[i];
    float maxDepth = u_objectShapeMaxDepth[i];

    float body = objectU(row, maxDepth, meshPos - center, radius, u_objectRotations[i]).x;
    float rest = objectU(row, maxDepth, meshPos - restCenter, restRadius, OBJECT_ROTATION_NONE).x;
    float coverage = objectCoverage(body, radius);
    lift.hole = max(lift.hole, objectCoverage(rest, restRadius));

    float scale = radius / restRadius;
    vec2 here = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 there = restCenter + objectToShape(u_objectRotations[i], here - center) / scale;
    vec2 sampled = vec2(there.x, u_resolution.y - there.y) / u_resolution;

    float order = u_objectOrders[i];
    if (objectBehindMask(order)) {
      lift.under = max(lift.under, coverage);
      if (objectOutranks(order, underBestOrder, body, underNearest)) {
        underBestOrder = order;
        underNearest = body;
        lift.underUv = sampled;
      }
    } else {
      lift.body = max(lift.body, coverage);
      if (objectOutranks(order, bestOrder, body, nearest)) {
        bestOrder = order;
        nearest = body;
        lift.uv = sampled;
      }
    }
  }
  return lift;
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
attribute vec4 a_fillOverlay;

uniform mediump vec2 u_resolution;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying vec4 v_highlight;
varying vec4 v_fillOverlay;
varying vec2 v_meshPos;
${OBJECT_FIELD_GLSL}
void main() {
  vec2 displaced = a_position + objectSwell(a_position);
  vec2 zeroToOne = displaced / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_color = a_color;
  v_barycentric = a_barycentric;
  v_uv = a_uv;
  v_meshPos = a_position;
  vec2 centroid = a_centroid + objectSwell(a_centroid);
  v_lightSourcePos = vec2(centroid.x, u_resolution.y - centroid.y);
  v_highlight = a_highlight;
  v_fillOverlay = a_fillOverlay;
}
`,
  fragment: `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
${OBJECT_FIELD_GLSL}
${LIGHT_FIELD_GLSL}
varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying vec4 v_highlight;
varying vec4 v_fillOverlay;
varying vec2 v_meshPos;

#define BUMP_STRENGTH ${glFloat(MASK_BUMP_STRENGTH)}
#define LIGHT_HEIGHT_SCALE ${glFloat(MASK_LIGHT_HEIGHT_SCALE)}

uniform vec2 u_resolution;

const vec3 STROKE_COLOR = vec3(${MASK_STROKE_COLOR.slice(0, 3).map(glFloat).join(", ")});
const float STROKE_ALPHA = ${glFloat(MASK_STROKE_COLOR[3])};

#define STROKE_WIDTH_PX ${glFloat(MASK_STROKE_WIDTH_PX)}
#define HIGHLIGHT_STROKE_WIDTH_PX ${glFloat(MASK_HIGHLIGHT_STROKE_WIDTH_PX)}

uniform vec2 u_lightSourceCenters[MAX_LIGHT_SOURCES];
uniform float u_lightSourceRadii[MAX_LIGHT_SOURCES];
uniform float u_lightSourceFalloffs[MAX_LIGHT_SOURCES];
uniform float u_lightSourceIntensities[MAX_LIGHT_SOURCES];
uniform float u_lightSourceDarknesses[MAX_LIGHT_SOURCES];
uniform mediump vec4 u_lightTransforms[MAX_LIGHT_SOURCES];
uniform int u_lightSourceCount;

uniform float u_textureMix;
uniform sampler2D u_texture;
uniform float u_hasTexture;

uniform sampler2D u_mask;
uniform float u_maskActive;
uniform vec3 u_glowColor;

uniform float u_backingGrey;
#define BACKING_GREY_LEVEL ${glFloat(MASK_BACKING_GREY_LEVEL)}
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

uniform vec4 u_objectFills[MAX_MASK_OBJECTS];
${OBJECT_LIFT_GLSL}

vec4 objectFill(vec2 p, bool behind) {
  vec4 fill = vec4(0.0);
  float nearest = 1.0;
  float bestOrder = -1e9;
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    if (u_objectFills[i].a <= 0.0) continue;
    float order = u_objectOrders[i];
    if (objectBehindMask(order) != behind) continue;
    vec2 toPoint = p - u_objects[i].xy;
    float u = objectU(
      u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, u_objects[i].z, u_objectRotations[i]).x;
    if (u >= 1.0) continue;
    if (!objectOutranks(order, bestOrder, u, nearest)) continue;
    bestOrder = order;
    nearest = u;
    fill = u_objectFills[i];
  }
  return fill;
}

void main() {
  vec3 baryDeriv = fwidth(v_barycentric);
  vec3 edgeFactors = smoothstep(vec3(0.0), baryDeriv * STROKE_WIDTH_PX, v_barycentric);
  float edge = 1.0 - min(min(edgeFactors.x, edgeFactors.y), edgeFactors.z);
  vec3 highlightFactors = smoothstep(vec3(0.0), baryDeriv * HIGHLIGHT_STROKE_WIDTH_PX, v_barycentric);
  float highlightEdge = 1.0 - min(min(highlightFactors.x, highlightFactors.y), highlightFactors.z);

  ObjectLift lift = objectLift(v_meshPos);
  vec4 mask = texture2D(u_mask, v_uv);

  vec2 restingUv = gl_FragCoord.xy / u_resolution;
  vec4 restingTexel = u_hasTexture > 0.5 ? texture2D(u_texture, restingUv) : vec4(v_color, 1.0);
  vec4 carriedTexel = u_hasTexture > 0.5 ? texture2D(u_texture, lift.uv) : vec4(v_color, 1.0);
  vec4 underTexel = u_hasTexture > 0.5 ? texture2D(u_texture, lift.underUv) : vec4(v_color, 1.0);

  float carried = lift.body * carriedTexel.a;

  float restingCoverage = u_hasTexture > 0.5 ? restingTexel.a : mix(1.0, mask.a, u_maskActive);
  float restingAlpha = restingCoverage * (1.0 - lift.hole);

  vec4 behindFill = objectFill(v_meshPos, true);
  float under = lift.under * underTexel.a;
  vec3 underRgb = mix(underTexel.rgb, behindFill.rgb, behindFill.a);

  float lowerAlpha = restingAlpha + under * (1.0 - restingAlpha);
  float safeLower = max(lowerAlpha, 1e-4);
  vec3 lowerRgb =
    (restingTexel.rgb * restingAlpha + underRgb * under * (1.0 - restingAlpha)) / safeLower;

  float alpha = carried + lowerAlpha * (1.0 - carried);
  float safeAlpha = max(alpha, 1e-4);
  vec3 textured = (carriedTexel.rgb * carried + lowerRgb * lowerAlpha * (1.0 - carried)) / safeAlpha;

  float beneath = restingAlpha * (1.0 - carried) / safeAlpha;

  vec4 fill = objectFill(v_meshPos, false);
  vec3 base = mix(textured, fill.rgb, fill.a);
  base = mix(base, v_fillOverlay.rgb, v_fillOverlay.a * beneath);

  vec3 field = objectField(v_meshPos);
  vec3 normal = normalize(vec3(-field.xy, 1.0));
  vec3 surface = vec3(v_meshPos, field.z);
  float bumpLit = 0.0;
  float bumpShade = 0.0;

  float bestHighlight = 0.0;
  float leastShadow = 0.0;
  for (int i = 0; i < MAX_LIGHT_SOURCES; i++) {
    if (i >= u_lightSourceCount) break;
    vec2 offset = v_lightSourcePos - u_lightSourceCenters[i];
    vec2 shaped = objectToShape(u_lightTransforms[i], vec2(offset.x, -offset.y));
    vec2 profile = lightProfile(
      u_lightShapeRows[i], u_lightShapeMaxDepth[i], shaped, u_lightSourceRadii[i]);
    float highlight = 1.0 - smoothstep(0.35, 1.0, profile.x);
    float shadow = smoothstep(0.0, u_lightSourceFalloffs[i], profile.y);
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
  vec3 shaded = lit - leastShadow - bumpShade;
  vec3 strokeColor = STROKE_COLOR - leastShadow - bumpShade;
  vec3 withEdge = mix(shaded, strokeColor, edge * u_textureMix * STROKE_ALPHA * beneath);

  float glowMix = mask.r * u_maskActive * beneath * (u_hasTexture > 0.5 ? 0.0 : 1.0);
  vec3 withGlow = mix(withEdge, u_glowColor, glowMix);

  float lightEdge = highlightEdge * v_highlight.a;
  vec3 withLightStroke = mix(withGlow, v_highlight.rgb, lightEdge);

  float luma = dot(withLightStroke, LUMA);
  vec3 greyed = mix(withLightStroke, vec3(luma * BACKING_GREY_LEVEL), u_backingGrey);

  gl_FragColor = vec4(greyed, alpha);
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
  fillOverlayBuffer: WebGLBuffer;
  positionLoc: number;
  colorLoc: number;
  barycentricLoc: number;
  uvLoc: number;
  centroidLoc: number;
  highlightLoc: number;
  fillOverlayLoc: number;
  resolutionLoc: WebGLUniformLocation;
  lightSourceCentersLoc: WebGLUniformLocation;
  lightSourceRadiiLoc: WebGLUniformLocation;
  lightTransformsLoc: WebGLUniformLocation;
  lightSourceFalloffsLoc: WebGLUniformLocation;
  lightSourceIntensitiesLoc: WebGLUniformLocation;
  lightSourceDarknessesLoc: WebGLUniformLocation;
  lightSourceCountLoc: WebGLUniformLocation;
  objectsLoc: WebGLUniformLocation;
  objectRotationsLoc: WebGLUniformLocation;
  objectFalloffsLoc: WebGLUniformLocation;
  objectOrdersLoc: WebGLUniformLocation;
  objectCountLoc: WebGLUniformLocation;
  objectShapesLoc: WebGLUniformLocation;
  objectShapeRowsLoc: WebGLUniformLocation;
  objectShapeMaxDepthLoc: WebGLUniformLocation;
  objectFillsLoc: WebGLUniformLocation;
  objectLiftsLoc: WebGLUniformLocation;
  objectShapeTexture: WebGLTexture;
  objectShapeSignature: string;
  lightShapesLoc: WebGLUniformLocation;
  lightShapeRowsLoc: WebGLUniformLocation;
  lightShapeMaxDepthLoc: WebGLUniformLocation;
  lightShapeTexture: WebGLTexture;
  lightShapeSignature: string;
  supportsVertexTextures: boolean;
  textureMixLoc: WebGLUniformLocation;
  textureLoc: WebGLUniformLocation;
  hasTextureLoc: WebGLUniformLocation;
  maskLoc: WebGLUniformLocation;
  maskActiveLoc: WebGLUniformLocation;
  glowColorLoc: WebGLUniformLocation;
  backingGreyLoc: WebGLUniformLocation;
}

export function encodeObjectSdfAtlas(shapes: (ObjectShape | undefined)[], grid = OBJECT_SDF_GRID): Uint8Array {
  const atlas = grid * OBJECT_SDF_TILE;
  const data = new Uint8Array(atlas * atlas * 4);
  shapes.forEach((shape, slot) => {
    if (!shape || slot >= grid * grid) return;
    const tileCol = slot % grid;
    const tileRow = Math.floor(slot / grid);
    for (let row = 0; row < OBJECT_SDF_TILE; row++) {
      for (let col = 0; col < OBJECT_SDF_TILE; col++) {
        const sourceRow = Math.min(shape.tile - 1, Math.floor((row * shape.tile) / OBJECT_SDF_TILE));
        const sourceCol = Math.min(shape.tile - 1, Math.floor((col * shape.tile) / OBJECT_SDF_TILE));
        const source = sourceRow * shape.tile + sourceCol;

        const biased = Math.min(Math.max(shape.sdf[source] / (2 * OBJECT_SDF_RANGE) + 0.5, 0), 1) * 255;
        const x = tileCol * OBJECT_SDF_TILE + col;
        const y = tileRow * OBJECT_SDF_TILE + row;
        const offset = (y * atlas + x) * 4;
        data[offset] = Math.floor(biased);
        data[offset + 1] = Math.round((biased - Math.floor(biased)) * 255);
        data[offset + 2] = Math.round(((shape.grad[source * 2] / 127) * 0.5 + 0.5) * 255);
        data[offset + 3] = Math.round(((shape.grad[source * 2 + 1] / 127) * 0.5 + 0.5) * 255);
      }
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
  const fillOverlayBuffer = gl.createBuffer();
  if (
    !positionBuffer ||
    !colorBuffer ||
    !barycentricBuffer ||
    !uvBuffer ||
    !centroidBuffer ||
    !highlightBuffer ||
    !fillOverlayBuffer
  )
    return undefined;

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const colorLoc = gl.getAttribLocation(program, "a_color");
  const barycentricLoc = gl.getAttribLocation(program, "a_barycentric");
  const uvLoc = gl.getAttribLocation(program, "a_uv");
  const centroidLoc = gl.getAttribLocation(program, "a_centroid");
  const highlightLoc = gl.getAttribLocation(program, "a_highlight");
  const fillOverlayLoc = gl.getAttribLocation(program, "a_fillOverlay");
  const objectShapeTexture = gl.createTexture();
  const lightShapeTexture = gl.createTexture();
  if (!objectShapeTexture || !lightShapeTexture) return undefined;
  for (const texture of [objectShapeTexture, lightShapeTexture]) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const lightSourceCentersLoc = gl.getUniformLocation(program, "u_lightSourceCenters");
  const lightSourceRadiiLoc = gl.getUniformLocation(program, "u_lightSourceRadii");
  const lightTransformsLoc = gl.getUniformLocation(program, "u_lightTransforms");
  const lightSourceFalloffsLoc = gl.getUniformLocation(program, "u_lightSourceFalloffs");
  const lightSourceIntensitiesLoc = gl.getUniformLocation(program, "u_lightSourceIntensities");
  const lightSourceDarknessesLoc = gl.getUniformLocation(program, "u_lightSourceDarknesses");
  const lightSourceCountLoc = gl.getUniformLocation(program, "u_lightSourceCount");
  const objectsLoc = gl.getUniformLocation(program, "u_objects");
  const objectRotationsLoc = gl.getUniformLocation(program, "u_objectRotations");
  const objectFalloffsLoc = gl.getUniformLocation(program, "u_objectFalloffs");
  const objectOrdersLoc = gl.getUniformLocation(program, "u_objectOrders");
  const objectCountLoc = gl.getUniformLocation(program, "u_objectCount");
  const objectShapesLoc = gl.getUniformLocation(program, "u_objectShapes");
  const objectShapeRowsLoc = gl.getUniformLocation(program, "u_objectShapeRows");
  const objectShapeMaxDepthLoc = gl.getUniformLocation(program, "u_objectShapeMaxDepth");
  const lightShapesLoc = gl.getUniformLocation(program, "u_lightShapes");
  const lightShapeRowsLoc = gl.getUniformLocation(program, "u_lightShapeRows");
  const lightShapeMaxDepthLoc = gl.getUniformLocation(program, "u_lightShapeMaxDepth");
  const objectFillsLoc = gl.getUniformLocation(program, "u_objectFills");
  const objectLiftsLoc = gl.getUniformLocation(program, "u_objectLifts");
  const textureMixLoc = gl.getUniformLocation(program, "u_textureMix");
  const textureLoc = gl.getUniformLocation(program, "u_texture");
  const hasTextureLoc = gl.getUniformLocation(program, "u_hasTexture");
  const maskLoc = gl.getUniformLocation(program, "u_mask");
  const maskActiveLoc = gl.getUniformLocation(program, "u_maskActive");
  const glowColorLoc = gl.getUniformLocation(program, "u_glowColor");
  const backingGreyLoc = gl.getUniformLocation(program, "u_backingGrey");
  if (
    positionLoc < 0 ||
    colorLoc < 0 ||
    barycentricLoc < 0 ||
    uvLoc < 0 ||
    centroidLoc < 0 ||
    highlightLoc < 0 ||
    fillOverlayLoc < 0 ||
    !resolutionLoc ||
    !lightSourceCentersLoc ||
    !lightSourceRadiiLoc ||
    !lightTransformsLoc ||
    !lightSourceFalloffsLoc ||
    !lightSourceIntensitiesLoc ||
    !lightSourceDarknessesLoc ||
    !lightSourceCountLoc ||
    !objectsLoc ||
    !objectRotationsLoc ||
    !objectFalloffsLoc ||
    !objectOrdersLoc ||
    !objectCountLoc ||
    !objectShapesLoc ||
    !objectShapeRowsLoc ||
    !objectShapeMaxDepthLoc ||
    !lightShapesLoc ||
    !lightShapeRowsLoc ||
    !lightShapeMaxDepthLoc ||
    !objectFillsLoc ||
    !objectLiftsLoc ||
    !textureMixLoc ||
    !textureLoc ||
    !hasTextureLoc ||
    !maskLoc ||
    !maskActiveLoc ||
    !glowColorLoc ||
    !backingGreyLoc
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
    fillOverlayBuffer,
    positionLoc,
    colorLoc,
    barycentricLoc,
    uvLoc,
    centroidLoc,
    highlightLoc,
    fillOverlayLoc,
    resolutionLoc,
    lightSourceCentersLoc,
    lightSourceRadiiLoc,
    lightTransformsLoc,
    lightSourceFalloffsLoc,
    lightSourceIntensitiesLoc,
    lightSourceDarknessesLoc,
    lightSourceCountLoc,
    objectsLoc,
    objectRotationsLoc,
    objectFalloffsLoc,
    objectOrdersLoc,
    objectCountLoc,
    objectShapesLoc,
    objectShapeRowsLoc,
    objectShapeMaxDepthLoc,
    objectFillsLoc,
    objectLiftsLoc,
    objectShapeTexture,
    objectShapeSignature: "",
    lightShapesLoc,
    lightShapeRowsLoc,
    lightShapeMaxDepthLoc,
    lightShapeTexture,
    lightShapeSignature: "",
    supportsVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0,
    textureMixLoc,
    textureLoc,
    hasTextureLoc,
    maskLoc,
    maskActiveLoc,
    glowColorLoc,
    backingGreyLoc,
  };
}

export interface MaskLightSource {
  x: number;
  y: number;
  radius: number;
  falloff: number;
  intensity: number;
  darkness: number;
  shape?: ObjectShape;
  transform?: ObjectRotation;
}

export interface DrawMaskMeshOptions {
  vertexCount: number;
  lightSources: MaskLightSource[];
  objects: ObjectGeometryInput[];
  textureMix: number;
  texture: WebGLTexture | undefined;
  maskTexture: WebGLTexture | undefined;
  glowColor: [number, number, number];
  backingVertexCount?: number;
  backingGrey?: number;
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

  const lightTransforms = new Float32Array(MAX_MASK_LIGHT_SOURCES * 4);
  for (let i = 0; i < MAX_MASK_LIGHT_SOURCES; i++) {
    const transform = activeLights[i]?.transform?.inverse ?? OBJECT_ROTATION_NONE.inverse;
    lightTransforms[i * 4] = transform[0];
    lightTransforms[i * 4 + 1] = transform[1];
    lightTransforms[i * 4 + 2] = transform[2];
    lightTransforms[i * 4 + 3] = transform[3];
  }
  gl.uniform4fv(state.lightTransformsLoc, lightTransforms);

  const lightShapeRows = new Float32Array(MAX_MASK_LIGHT_SOURCES).fill(-1);
  const lightShapeMaxDepth = new Float32Array(MAX_MASK_LIGHT_SOURCES).fill(1);
  const lightShapes = activeLights.map((light) => light.shape);
  if (lightShapes.some((shape) => shape !== undefined)) {
    lightShapes.forEach((shape, i) => {
      if (!shape) return;
      lightShapeRows[i] = i;
      lightShapeMaxDepth[i] = shape.maxDepth;
    });
    const signature = lightShapes.map((shape) => shape?.path ?? "").join("|");
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, state.lightShapeTexture);
    if (signature !== state.lightShapeSignature) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        LIGHT_SDF_ATLAS,
        LIGHT_SDF_ATLAS,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        encodeObjectSdfAtlas(lightShapes, LIGHT_SDF_GRID),
      );
      state.lightShapeSignature = signature;
    }
    gl.uniform1i(state.lightShapesLoc, 3);
  }
  gl.uniform1fv(state.lightShapeRowsLoc, lightShapeRows);
  gl.uniform1fv(state.lightShapeMaxDepthLoc, lightShapeMaxDepth);

  const activeObjects = drawnMaskObjects(options.objects);
  gl.uniform1i(state.objectCountLoc, activeObjects.length);
  if (activeObjects.length > 0) {
    const objects = new Float32Array(activeObjects.length * 4);
    const falloffs = new Float32Array(activeObjects.length);
    const orders = new Float32Array(activeObjects.length);
    const fills = new Float32Array(activeObjects.length * 4);
    const lifts = new Float32Array(activeObjects.length * 4);
    const rotations = new Float32Array(activeObjects.length * 4);
    activeObjects.forEach((object, i) => {
      objects[i * 4] = object.cx;
      objects[i * 4 + 1] = object.cy;
      objects[i * 4 + 2] = Math.max(object.radius, 1);
      objects[i * 4 + 3] = object.elevation;
      falloffs[i] = Math.max(object.falloff, MIN_MASK_OBJECT_FALLOFF);
      orders[i] = object.order;
      fills[i * 4] = object.fill?.r ?? 0;
      fills[i * 4 + 1] = object.fill?.g ?? 0;
      fills[i * 4 + 2] = object.fill?.b ?? 0;
      fills[i * 4 + 3] = object.fill?.a ?? 0;
      lifts[i * 4] = object.lift?.cx ?? object.cx;
      lifts[i * 4 + 1] = object.lift?.cy ?? object.cy;
      lifts[i * 4 + 2] = Math.max(object.lift?.radius ?? object.radius, 1);
      lifts[i * 4 + 3] = object.lift ? 1 : 0;
      const rotation = object.rotation?.inverse ?? OBJECT_ROTATION_NONE.inverse;
      rotations[i * 4] = rotation[0];
      rotations[i * 4 + 1] = rotation[1];
      rotations[i * 4 + 2] = rotation[2];
      rotations[i * 4 + 3] = rotation[3];
    });
    gl.uniform4fv(state.objectsLoc, objects);
    gl.uniform4fv(state.objectRotationsLoc, rotations);
    gl.uniform1fv(state.objectFalloffsLoc, falloffs);
    gl.uniform1fv(state.objectOrdersLoc, orders);
    gl.uniform4fv(state.objectFillsLoc, fills);
    gl.uniform4fv(state.objectLiftsLoc, lifts);
  }

  const shapeRows = new Float32Array(MAX_MASK_OBJECTS).fill(-1);
  const shapeMaxDepth = new Float32Array(MAX_MASK_OBJECTS).fill(1);
  const shapes = activeObjects.map((object) => object.shape);
  const usableShapes = state.supportsVertexTextures ? shapes : shapes.map(() => undefined);
  if (usableShapes.some((shape) => shape !== undefined)) {
    usableShapes.forEach((shape, i) => {
      if (!shape) return;
      shapeRows[i] = i;
      shapeMaxDepth[i] = shape.maxDepth;
    });
    const signature = usableShapes.map((shape) => shape?.path ?? "").join("|");
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.objectShapeTexture);
    if (signature !== state.objectShapeSignature) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        OBJECT_SDF_ATLAS,
        OBJECT_SDF_ATLAS,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        encodeObjectSdfAtlas(usableShapes),
      );
      state.objectShapeSignature = signature;
    }
    gl.uniform1i(state.objectShapesLoc, 2);
  }
  gl.uniform1fv(state.objectShapeRowsLoc, shapeRows);
  gl.uniform1fv(state.objectShapeMaxDepthLoc, shapeMaxDepth);

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

  gl.bindBuffer(gl.ARRAY_BUFFER, state.fillOverlayBuffer);
  gl.enableVertexAttribArray(state.fillOverlayLoc);
  gl.vertexAttribPointer(state.fillOverlayLoc, 4, gl.FLOAT, false, 0, 0);

  const backingGrey = options.backingGrey ?? 0;
  const backingCount = Math.min(options.backingVertexCount ?? 0, options.vertexCount);
  if (backingGrey <= 0 || backingCount === 0) {
    gl.uniform1f(state.backingGreyLoc, 0);
    gl.drawArrays(gl.TRIANGLES, 0, options.vertexCount);
    return;
  }

  gl.uniform1f(state.backingGreyLoc, backingGrey);
  gl.drawArrays(gl.TRIANGLES, 0, backingCount);
  gl.uniform1f(state.backingGreyLoc, 0);
  gl.drawArrays(gl.TRIANGLES, backingCount, options.vertexCount - backingCount);
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

const warmedImages = new Map<string, HTMLImageElement>();
const WARMED_IMAGE_LIMIT = 4;

function warmedImage(src: string): HTMLImageElement {
  const held = warmedImages.get(src);
  if (held) return held;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  warmedImages.set(src, image);
  while (warmedImages.size > WARMED_IMAGE_LIMIT) {
    const oldest = warmedImages.keys().next();
    if (oldest.done || oldest.value === src) break;
    warmedImages.delete(oldest.value);
  }
  return image;
}

export function warmImageTexture(src: string | undefined): void {
  if (!src) return;
  warmedImage(src);
}

export function loadImageTexture(
  gl: WebGLRenderingContext,
  src: string,
  onLoaded: (texture: WebGLTexture) => void,
  onError?: (error: unknown) => void,
): void {
  let image = warmedImage(src);
  if (image.complete && image.naturalWidth === 0) {
    warmedImages.delete(src);
    image = warmedImage(src);
  }
  const upload = () => {
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
  if (image.complete && image.naturalWidth > 0) {
    upload();
    return;
  }
  const onImageLoad = () => {
    image.removeEventListener("error", onImageError);
    upload();
  };
  const onImageError = (error: unknown) => {
    image.removeEventListener("load", onImageLoad);
    warmedImages.delete(src);
    onError?.(error);
  };
  image.addEventListener("load", onImageLoad, { once: true });
  image.addEventListener("error", onImageError, { once: true });
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

export type ObjectOutline = Pick<ObjectGeometryInput, "cx" | "cy" | "radius" | "shape" | "rotation">;

export interface ObjectGeometryInput {
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  order: number;
  shape?: ObjectShape;
  fill?: ObjectFill_V1_0;
  lift?: { cx: number; cy: number; radius: number };
  rotation?: ObjectRotation;
}

export interface ObjectRotation {
  inverse: [number, number, number, number];
  visible: boolean;
}

export const OBJECT_ROTATION_NONE: ObjectRotation = { inverse: [1, 0, 0, 1], visible: true };

const OBJECT_ROTATION_EDGE_ON = 1e-4;

export function objectRotation(x: number, y: number, z: number, angleDegrees: number): ObjectRotation | undefined {
  return objectTransform({ x, y, z, angleDegrees }, undefined);
}

type Matrix2 = [number, number, number, number];

function multiply2(outer: Matrix2, inner: Matrix2): Matrix2 {
  return [
    outer[0] * inner[0] + outer[1] * inner[2],
    outer[0] * inner[1] + outer[1] * inner[3],
    outer[2] * inner[0] + outer[3] * inner[2],
    outer[2] * inner[1] + outer[3] * inner[3],
  ];
}

function invert2(forward: Matrix2): ObjectRotation {
  const determinant = forward[0] * forward[3] - forward[1] * forward[2];
  if (Math.abs(determinant) < OBJECT_ROTATION_EDGE_ON) return { inverse: [1, 0, 0, 1], visible: false };
  return {
    inverse: [forward[3] / determinant, -forward[1] / determinant, -forward[2] / determinant, forward[0] / determinant],
    visible: true,
  };
}

function rotationForward(x: number, y: number, z: number, angleDegrees: number): Matrix2 | undefined {
  const length = Math.hypot(x, y, z);
  if (length === 0 || angleDegrees % 360 === 0) return undefined;
  const angle = (angleDegrees * Math.PI) / 180;
  const [ax, ay, az] = [x / length, y / length, z / length];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;
  return [t * ax * ax + cos, t * ax * ay - sin * az, t * ax * ay + sin * az, t * ay * ay + cos];
}

function skewForward(ax: number, ay: number): Matrix2 | undefined {
  if (ax === 0 && ay === 0) return undefined;
  const tanAx = Math.tan((toCssSkewAngle(ax) * Math.PI) / 180);
  const tanAy = Math.tan((toCssSkewAngle(ay) * Math.PI) / 180);
  return [1, tanAx, tanAy, 1];
}

export function objectTransform(
  rotate: { x: number; y: number; z: number; angleDegrees: number } | undefined,
  skew: { ax: number; ay: number } | undefined,
): ObjectRotation | undefined {
  const rotation = rotate ? rotationForward(rotate.x, rotate.y, rotate.z, rotate.angleDegrees) : undefined;
  const skewed = skew ? skewForward(skew.ax, skew.ay) : undefined;
  if (!rotation && !skewed) return undefined;
  const forward = rotation && skewed ? multiply2(rotation, skewed) : (rotation ?? skewed)!;
  return invert2(forward);
}

export function objectToShape(rotation: ObjectRotation | undefined, x: number, y: number): [number, number] {
  if (!rotation) return [x, y];
  const [a, b, c, d] = rotation.inverse;
  return [a * x + b * y, c * x + d * y];
}

export function isActiveObject(object: ObjectGeometryInput): boolean {
  if (isBehindMask(object)) return false;
  return object.radius > 0 && object.elevation !== 0 && (object.rotation?.visible ?? true);
}

export function isDrawnObject(object: ObjectGeometryInput): boolean {
  if (object.radius <= 0 || !(object.rotation?.visible ?? true)) return false;
  if (isBehindMask(object)) return (object.fill?.a ?? 0) > 0 || object.lift !== undefined;
  return object.elevation !== 0 || (object.fill?.a ?? 0) > 0 || object.lift !== undefined;
}

function cappedByElevation<T extends ObjectGeometryInput>(objects: T[]): T[] {
  return objects.sort((a, b) => Math.abs(b.elevation) - Math.abs(a.elevation)).slice(0, MAX_MASK_OBJECTS);
}

export function activeMaskObjects<T extends ObjectGeometryInput>(objects: T[]): T[] {
  return cappedByElevation(objects.filter(isActiveObject));
}

export function drawnMaskObjects<T extends ObjectGeometryInput>(objects: T[]): T[] {
  return cappedByElevation(objects.filter(isDrawnObject));
}

export function objectProfileK(u: number, falloff: number): number {
  const s = Math.max(1 - u * u, 0);
  return Math.pow(Math.max(s, 1e-4), falloff);
}

export function objectProfileUAt(object: ObjectOutline, point: [number, number]): number {
  const [nx, ny] = objectToShape(
    object.rotation,
    (point[0] - object.cx) / object.radius,
    (point[1] - object.cy) / object.radius,
  );
  if (!object.shape) return Math.hypot(nx, ny);
  return objectShapeProfileU(object.shape, nx, ny);
}

export function objectSwellAt(point: [number, number], objects: ObjectGeometryInput[]): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const object of objects) {
    const toPointX = point[0] - object.cx;
    const toPointY = point[1] - object.cy;
    const u = objectProfileUAt(object, point);
    if (u >= 1) continue;
    const height = object.elevation * objectProfileK(u, Math.max(object.falloff, MIN_MASK_OBJECT_FALLOFF));
    const coefficient = Math.min(
      Math.max((MASK_OBJECT_SWELL * height) / object.radius, -MASK_OBJECT_SWELL_LIMIT),
      MASK_OBJECT_SWELL_LIMIT,
    );
    dx += coefficient * toPointX;
    dy += coefficient * toPointY;
  }
  return [dx, dy];
}

const MAX_EDGE_SUBDIVISION_POINTS = 6;

function edgeSwellSag(a: [number, number], b: [number, number], objects: ObjectGeometryInput[]): number {
  const swellA = objectSwellAt(a, objects);
  const swellB = objectSwellAt(b, objects);
  let worst = 0;
  for (const t of [0.25, 0.5, 0.75]) {
    const at: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const swellAt = objectSwellAt(at, objects);
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

function edgeSubdivisionCount(a: [number, number], b: [number, number], objects: ObjectGeometryInput[]): number {
  const sag = edgeSwellSag(a, b, objects);
  if (!(sag > OBJECT_SUBDIVISION_TOLERANCE_PX)) return 0;
  return Math.min(Math.ceil(Math.sqrt(sag / OBJECT_SUBDIVISION_TOLERANCE_PX)) - 1, MAX_EDGE_SUBDIVISION_POINTS);
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
  objects: ObjectGeometryInput[],
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
      if (!counts.has(key)) counts.set(key, edgeSubdivisionCount(a, b, objects));
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
  objects: ObjectGeometryInput[],
): [number, number][][] {
  if (loop.length === 3) return [[loop[0], loop[1], loop[2]]];

  let anchor: [number, number] | undefined;
  let bestElevation = 0;
  for (const object of objects) {
    const epicenter: [number, number] = [object.cx, object.cy];
    if (Math.abs(object.elevation) <= bestElevation) continue;
    if (!isStrictlyInsideTriangle(epicenter, tri)) continue;
    anchor = epicenter;
    bestElevation = Math.abs(object.elevation);
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

function subdivideForObjects(
  triangles: [number, number][][],
  objects: ObjectGeometryInput[],
): { outputTriangles: [number, number][][]; outputCounts: number[] } {
  const { ids, counts } = computeEdgeSubdivisionCounts(triangles, objects);
  const outputTriangles: [number, number][][] = [];
  const outputCounts: number[] = [];
  for (const tri of triangles) {
    const fanned = fanTriangulate(boundaryLoopForTriangle(tri, ids, counts), tri, objects);
    outputTriangles.push(...fanned);
    outputCounts.push(fanned.length);
  }
  return { outputTriangles, outputCounts };
}

export function subdivideMeshForObjects(
  corners: [number, number][],
  polygonPointSets: [number, number][][],
  objects: ObjectGeometryInput[],
): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
  polygonOutputCounts: number[];
} {
  const active = objects.filter(isActiveObject);
  if (active.length === 0) {
    return { corners, polygonPointSets, polygonOutputCounts: polygonPointSets.map(() => 1) };
  }

  const cornerTriangles: [number, number][][] = [];
  for (let i = 0; i + 3 <= corners.length; i += 3) cornerTriangles.push(corners.slice(i, i + 3));

  const { outputTriangles, outputCounts } = subdivideForObjects([...cornerTriangles, ...polygonPointSets], active);

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
    objects: ObjectGeometryInput[];
  },
  colorCtx: CanvasRenderingContext2D,
  precomputed?: { corners: [number, number][]; polygonPointSets: [number, number][][] },
  precomputedColors?: [number, number, number][],
): {
  positions: number[];
  colors: number[];
  barycentrics: number[];
  uvs: number[];
  centroids: number[];
  vertexCount: number;
  vertexRanges: [number, number][];
} {
  const built = precomputed ?? buildWeldedMaskPointGroups(maskData);
  let corners = built.corners;
  let polygonPointSets = built.polygonPointSets;
  let polygonOutputCounts = polygonPointSets.map(() => 1);

  if (maskData.objects.some(isActiveObject)) {
    const subdivided = subdivideMeshForObjects(corners, polygonPointSets, maskData.objects);
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
    const [r, g, b] = precomputedColors?.[i] ?? colorToRGB01(colorCtx, polygon.fill);
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
  backingVertexCountRef: React.RefObject<number>;
};
