import type { MaskCurve_V1_0, ObjectBlackPoint_V1_0 } from "./workspace.server";
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
export const OBJECT_ELEVATION_DEFAULT = 80;
export const MAX_MASK_OBJECT_ELEVATION = 300;
export const MIN_MASK_OBJECT_FALLOFF = 1.0;
export const MAX_MASK_OBJECT_FALLOFF = 6.0;
export const MIN_MASK_OBJECT_RADIUS_PX = 8;
export const MASK_OBJECT_SWELL = 0.5;
export const MASK_OBJECT_SWELL_LIMIT = 0.9;
export const OBJECT_SDF_GRID = 4;
export const OBJECT_SDF_ATLAS = OBJECT_SDF_GRID * OBJECT_SDF_TILE;
// 3x3 holds the eight lights a mask can have, in the same tiles at the same
// resolution as an object's -- the shapes come off the same builder, so only
// how many of them there are differs.
export const LIGHT_SDF_GRID = 3;
export const LIGHT_SDF_ATLAS = LIGHT_SDF_GRID * OBJECT_SDF_TILE;
export const OBJECT_SDF_RANGE = OBJECT_SDF_MARGIN * Math.SQRT2;
export const OBJECT_GRADIENT_LIMIT = 32.0;
export const OBJECT_BLACK_POINT_RELIEF_K = 1e-3;
export const OBJECT_BLACK_POINT_HALO_MAX = 0.2;
export const OBJECT_BLACK_POINT_HALO_EASE = 0.35;
export const OBJECT_BLACK_POINT_HALO_FADE = 1.5;
export const MASK_BUMP_STRENGTH = 0.85;
export const MASK_LIGHT_HEIGHT_SCALE = 1.0;
export const OBJECT_SUBDIVISION_TOLERANCE_PX = 0.75;
export const MASK_STROKE_WIDTH_PX = 1.0;
export const MASK_HIGHLIGHT_STROKE_WIDTH_PX = 3.0;
export const MASK_STROKE_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 0.2];
export const HIGHLIGHT_SELECTED_COLOR: [number, number, number, number] = [0.258824, 0.521569, 0.956863, 1.0];
export const HIGHLIGHT_SIBLING_COLOR: [number, number, number, number] = [0.258824, 0.521569, 0.956863, 0.35];
export const HIGHLIGHT_MOVING_COLOR: [number, number, number, number] = [1, 1, 1, 0.15];
export const HIGHLIGHT_OBJECT_REVIEW_ADDED_COLOR: [number, number, number, number] = [0.984314, 0.65098, 0.152941, 1.0];

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

uniform mediump sampler2D u_objectShapes;
uniform mediump float u_objectShapeRows[MAX_MASK_OBJECTS];
uniform mediump float u_objectShapeMaxDepth[MAX_MASK_OBJECTS];

float decodeObjectShape16(vec2 bytes) {
  return bytes.x + bytes.y * (1.0 / 255.0);
}

// One texel of one object's tile, as vec3(signed distance, gradient.xy).
//
// The tile index is unpacked into a grid cell here rather than passed in as a
// cell, so the CPU only ever has to know which slot an object took.
vec3 objectShapeTexel(float row, vec2 texel) {
  float col = mod(row, OBJECT_SDF_GRID);
  float band = floor(row / OBJECT_SDF_GRID);
  vec2 held = clamp(texel, vec2(0.0), vec2(OBJECT_SDF_TILE - 1.0));
  vec2 uv = (vec2(col, band) * OBJECT_SDF_TILE + held + 0.5) / OBJECT_SDF_ATLAS;
  // not "packed": that is a reserved word in GLSL ES and will not compile
  vec4 stored = texture2D(u_objectShapes, uv);
  return vec3(
    (decodeObjectShape16(stored.rg) - 0.5) * 2.0 * OBJECT_SDF_RANGE,
    stored.ba * 2.0 - 1.0);
}

// The signed distance and its gradient at a point in the shape's own
// normalized space, as vec3(distance, gradient.xy).
//
// Filtered by hand out of four NEAREST fetches, for the same reason
// objectShapeAt used to mix two: this runs in the vertex stage, and WebGL1
// makes no promise that a vertex texture fetch filters at all. Clamping
// happens per-texel inside the tile, so a sample at a tile's edge cannot
// bleed into the neighbouring object's.
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
  // Along the medial axis the gradient flips, so filtering across it averages
  // two opposing directions toward nothing. Renormalizing restores a usable
  // direction; the guard is for the exact centre of a symmetric shape, where
  // there genuinely is no downhill and a normalize would be a divide by zero.
  float reach = length(sampled.yz);
  return vec3(sampled.x, reach > 1e-4 ? sampled.yz / reach : vec2(0.0));
}

// How far along its falloff a point sits, plus the gradient of that, in mesh
// units: vec3(u, gradU.xy). u is 0 at the shape's deepest interior point and
// 1 at its outline.
//
// The two branches agree exactly where they overlap. For a circle of radius R
// the field is d = R - dist with its deepest point at R, so
// u = 1 - (R - dist)/R = dist/R -- which is the shapeless branch verbatim.
// An object with no shape and one shaped like a circle are the same object.
vec3 objectU(float row, float maxDepth, vec2 toPoint, float radius) {
  if (row < 0.0) {
    float dist = length(toPoint);
    return vec3(dist / radius, dist > 1e-4 ? toPoint / (dist * radius) : vec2(0.0));
  }
  vec3 depth = objectDepthAt(row, toPoint / radius);
  // d is measured in normalized units, so its gradient converts to mesh units
  // by dividing through by the same radius that normalized the position
  return vec3(1.0 - depth.x / maxDepth, -depth.yz / (maxDepth * radius));
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
    vec2 toPoint = p - u_objects[i].xy;
    float elevation = u_objects[i].w;
    vec3 profileU = objectU(u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, u_objects[i].z);
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
    vec2 toPoint = p - u_objects[i].xy;
    float radius = u_objects[i].z;
    float u = objectU(u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, radius).x;
    if (u >= 1.0) continue;
    float height = u_objects[i].w * objectProfile(u, u_objectFalloffs[i]).x;
    float coefficient = clamp(
      MASK_OBJECT_SWELL * height / radius, -MASK_OBJECT_SWELL_LIMIT, MASK_OBJECT_SWELL_LIMIT);
    swell += coefficient * toPoint;
  }
  return swell;
}
`;

/**
 * Sampling a light's silhouette, in the fragment stage only.
 *
 * A near-copy of the object block's tile reader rather than a shared one,
 * because the two differ in the constant that decides where a slot lives --
 * the atlas is 3x3 here and 4x4 there -- and GLSL ES 1.0 gives no way to
 * parameterize that without passing the grid down through every call. Two
 * short readers over one encoder is the cheaper of the two duplications.
 *
 * Fragment-only is the other difference, and it is why there is no
 * supportsVertexTextures gate on any of this: an object's shape is read in the
 * vertex stage to displace geometry, where WebGL1 does not promise a texture
 * unit exists at all. A light only ever shades.
 */
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

// The signed distance at a point in the shape's own normalized space, positive
// inside. Only the distance: nothing here lights from the gradient, so the two
// components the object block renormalizes are left where they are.
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

/**
 * How far along its falloff a point sits relative to one light, as
 * vec2(u, beyond).
 *
 * The first is 0 at the silhouette's deepest interior point and 1 on the
 * outline -- the same quantity objectU produces, and what the highlight ramps
 * over. The second is how far past the outline the point is in mesh units, 0
 * anywhere inside, and is what the shadow ramps over.
 *
 * Two numbers rather than one because the shadow reaches much further than the
 * shape does. A light's falloff routinely runs several radii out, while the
 * distance tile only covers OBJECT_SDF_MARGIN of one -- so past that edge the
 * field has nothing left to say and a shadow ramped straight off it would
 * flatten out early, at a hard ring the shape of the tile.
 *
 * What happens past the edge is therefore an extrapolation, and *which* one
 * matters more than it looks. The sample is taken where the ray leaves the
 * tile and then carried outward: stepping directly away from a shape increases
 * the distance to it at a rate of one, so the overshoot is simply subtracted.
 * That is exact along the ray the nearest point actually lies on, conservative
 * elsewhere, and continuous at the boundary -- the overshoot is zero there, so
 * there is no seam to see.
 *
 * It also keeps the shape's *direction*, which is the whole point. This used
 * to fade over to the distance from the bounding circle instead, on the
 * reasoning that far away any shape is roughly its own circle. That is true of
 * a blob and badly false of anything with a bite out of it: for a crescent it
 * lit the notch as though the shape filled it, put a bright ring around the
 * bounding circle where the fade pulled the shadow back off, and left a dark
 * band inside it where the real distance still showed through. A crescent
 * lights like a crescent all the way out, or the shape may as well not be
 * there.
 *
 * The shapeless branch is not an approximation of the shaped one, it is the
 * same thing written out: a normalized circle has depth 1 - |n| with a maximum
 * of 1, so u = |n| = dist/radius and beyond = dist - radius, which is what the
 * lighting did before a light could be shaped at all. The extrapolation
 * preserves that identity exactly rather than approximately -- carrying
 * 1 - OBJECT_SDF_MARGIN outward by the overshoot lands back on 1 - |n| -- so a
 * circular light and a shapeless one agree everywhere, not merely inside the
 * tile. Both branches also agree with the two ramps the old code wrote
 * directly in distance -- see drawMaskMesh -- so an unshaped light lights
 * exactly as it always has.
 */
vec2 lightProfile(float row, float maxDepth, vec2 toPoint, float radius) {
  float dist = length(toPoint);
  if (row < 0.0) return vec2(dist / radius, max(dist - radius, 0.0));

  vec2 n = toPoint / radius;
  float reach = length(n);
  float overshoot = max(reach - OBJECT_SDF_MARGIN, 0.0);
  // Scaled rather than branched, and guarded rather than divided blind: the
  // ratio is 1 anywhere inside the tile, and the reach is 0 at the exact
  // centre of the shape, which is a point every light has.
  vec2 sampled = n * min(1.0, OBJECT_SDF_MARGIN / max(reach, 1e-6));
  float depth = lightDepthAt(row, sampled) - overshoot;

  return vec2(1.0 - depth / maxDepth, max(-depth * radius, 0.0));
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
uniform int u_lightSourceCount;

uniform float u_textureMix;
uniform sampler2D u_texture;
uniform float u_hasTexture;

uniform sampler2D u_mask;
uniform float u_maskActive;
uniform vec3 u_glowColor;

uniform vec4 u_objectBlackPoints[MAX_MASK_OBJECTS];

#define BLACK_POINT_HALO_MAX ${glFloat(OBJECT_BLACK_POINT_HALO_MAX)}
#define BLACK_POINT_HALO_EASE ${glFloat(OBJECT_BLACK_POINT_HALO_EASE)}
#define BLACK_POINT_HALO_FADE ${glFloat(OBJECT_BLACK_POINT_HALO_FADE)}
#define BLACK_POINT_RELIEF_K ${glFloat(OBJECT_BLACK_POINT_RELIEF_K)}
#define OBJECT_FALLOFF_MIN ${glFloat(MIN_MASK_OBJECT_FALLOFF)}
#define OBJECT_FALLOFF_MAX ${glFloat(MAX_MASK_OBJECT_FALLOFF)}

vec4 objectBlackPoint(vec2 p) {
  vec3 color = vec3(0.0);
  float total = 0.0;
  float weight = 0.0;
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    vec2 toPoint = p - u_objects[i].xy;
    float u = objectU(u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, u_objects[i].z).x;
    float falloff = max(u_objectFalloffs[i], OBJECT_FALLOFF_MIN);
    float reliefEnd = sqrt(max(1.0 - pow(BLACK_POINT_RELIEF_K, 1.0 / falloff), 0.0));
    float haloT = clamp((falloff - OBJECT_FALLOFF_MIN) / (OBJECT_FALLOFF_MAX - OBJECT_FALLOFF_MIN), 0.0, 1.0);
    float halo = BLACK_POINT_HALO_MAX * pow(haloT, BLACK_POINT_HALO_EASE);
    if (u >= reliefEnd + halo) continue;
    float t = clamp((u - reliefEnd) / max(halo, 1e-4), 0.0, 1.0);
    float w = pow(1.0 - t, BLACK_POINT_HALO_FADE) * u_objectBlackPoints[i].a;
    color += u_objectBlackPoints[i].rgb * w;
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

  vec3 field = objectField(v_meshPos);
  vec3 normal = normalize(vec3(-field.xy, 1.0));
  vec3 surface = vec3(v_meshPos, field.z);
  float bumpLit = 0.0;
  float bumpShade = 0.0;

  float bestHighlight = 0.0;
  float leastShadow = 0.0;
  for (int i = 0; i < MAX_LIGHT_SOURCES; i++) {
    if (i >= u_lightSourceCount) break;
    // Into the mesh's own orientation before the silhouette is asked anything.
    // Centres and centroids are both held flipped for the bump light below,
    // and flipping is y -> H - y, so the difference between two of them is the
    // mesh-space offset with its y negated -- and a stored outline is measured
    // in mesh space. Sampling with the flipped offset would mirror every
    // asymmetric light about its own centre.
    vec2 offset = v_lightSourcePos - u_lightSourceCenters[i];
    vec2 profile = lightProfile(
      u_lightShapeRows[i], u_lightShapeMaxDepth[i], vec2(offset.x, -offset.y), u_lightSourceRadii[i]);
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
  vec4 blackPoint = objectBlackPoint(v_meshPos);
  vec3 shaded = liftToBlackPoint(lit - leastShadow - bumpShade, blackPoint);
  vec3 strokeColor = liftToBlackPoint(STROKE_COLOR - leastShadow - bumpShade, blackPoint);
  vec3 withEdge = mix(shaded, strokeColor, edge * u_textureMix * STROKE_ALPHA);

  vec4 mask = texture2D(u_mask, v_uv);
  vec3 withGlow = mix(withEdge, u_glowColor, mask.r * u_maskActive);

  float lightEdge = highlightEdge * v_highlight.a;
  vec3 withLightStroke = mix(withGlow, v_highlight.rgb, lightEdge);

  gl_FragColor = vec4(withLightStroke, mix(1.0, mask.a, u_maskActive));
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
  objectsLoc: WebGLUniformLocation;
  objectFalloffsLoc: WebGLUniformLocation;
  objectCountLoc: WebGLUniformLocation;
  objectShapesLoc: WebGLUniformLocation;
  objectShapeRowsLoc: WebGLUniformLocation;
  objectShapeMaxDepthLoc: WebGLUniformLocation;
  objectBlackPointsLoc: WebGLUniformLocation;
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
}

/**
 * Pack distance tiles into one atlas, laid out as a `grid` x `grid` grid of
 * tiles in reading order, so a slot index is its tile index.
 *
 * `grid` is a parameter because objects and lights have different numbers of
 * slots (16 and 8) and so different atlases, but identical tiles: the shapes
 * come off the same builder at the same resolution, and only how many of them
 * fit differs. The two shader-side readers take the grid as a constant each --
 * see LIGHT_FIELD_GLSL.
 *
 * Per texel: the signed distance as a 16-bit big-endian-ish byte pair in
 * red/green -- the same trick the angular table used, and read back by the
 * same decodeObjectShape16 -- and the gradient's two components biased into
 * blue/alpha a byte each. Eight bits of a unit vector component is about a
 * third of a degree of direction, which the lighting cannot show.
 *
 * A shape whose own tile is smaller than OBJECT_SDF_TILE (the editor's draft
 * resolution) is point-sampled up rather than rejected, so a drag preview
 * uploads without a full-resolution rebuild first.
 */
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
  if (!positionBuffer || !colorBuffer || !barycentricBuffer || !uvBuffer || !centroidBuffer || !highlightBuffer)
    return undefined;

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const colorLoc = gl.getAttribLocation(program, "a_color");
  const barycentricLoc = gl.getAttribLocation(program, "a_barycentric");
  const uvLoc = gl.getAttribLocation(program, "a_uv");
  const centroidLoc = gl.getAttribLocation(program, "a_centroid");
  const highlightLoc = gl.getAttribLocation(program, "a_highlight");
  const objectShapeTexture = gl.createTexture();
  const lightShapeTexture = gl.createTexture();
  if (!objectShapeTexture || !lightShapeTexture) return undefined;
  // NEAREST on both: the readers filter by hand out of four fetches, because
  // WebGL1 makes no promise a vertex texture fetch filters at all and the two
  // stages must not disagree about where a tile's edge is.
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
  const lightSourceFalloffsLoc = gl.getUniformLocation(program, "u_lightSourceFalloffs");
  const lightSourceIntensitiesLoc = gl.getUniformLocation(program, "u_lightSourceIntensities");
  const lightSourceDarknessesLoc = gl.getUniformLocation(program, "u_lightSourceDarknesses");
  const lightSourceCountLoc = gl.getUniformLocation(program, "u_lightSourceCount");
  const objectsLoc = gl.getUniformLocation(program, "u_objects");
  const objectFalloffsLoc = gl.getUniformLocation(program, "u_objectFalloffs");
  const objectCountLoc = gl.getUniformLocation(program, "u_objectCount");
  const objectShapesLoc = gl.getUniformLocation(program, "u_objectShapes");
  const objectShapeRowsLoc = gl.getUniformLocation(program, "u_objectShapeRows");
  const objectShapeMaxDepthLoc = gl.getUniformLocation(program, "u_objectShapeMaxDepth");
  const lightShapesLoc = gl.getUniformLocation(program, "u_lightShapes");
  const lightShapeRowsLoc = gl.getUniformLocation(program, "u_lightShapeRows");
  const lightShapeMaxDepthLoc = gl.getUniformLocation(program, "u_lightShapeMaxDepth");
  const objectBlackPointsLoc = gl.getUniformLocation(program, "u_objectBlackPoints");
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
    !objectsLoc ||
    !objectFalloffsLoc ||
    !objectCountLoc ||
    !objectShapesLoc ||
    !objectShapeRowsLoc ||
    !objectShapeMaxDepthLoc ||
    !lightShapesLoc ||
    !lightShapeRowsLoc ||
    !lightShapeMaxDepthLoc ||
    !objectBlackPointsLoc ||
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
    objectsLoc,
    objectFalloffsLoc,
    objectCountLoc,
    objectShapesLoc,
    objectShapeRowsLoc,
    objectShapeMaxDepthLoc,
    objectBlackPointsLoc,
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
  };
}

export interface MaskLightSource {
  /**
   * The light's centre, in the flipped screen space the centroids are compared
   * in. Kept flipped rather than in mesh space because it is also the light's
   * position for the relief's own bump lighting, which works in that space --
   * the silhouette flips back to mesh orientation at the point of sampling.
   */
  x: number;
  y: number;
  radius: number;
  falloff: number;
  intensity: number;
  darkness: number;
  /**
   * The outline the light falls within, sampled as a distance tile, or
   * undefined for one that has never been shaped. Undefined lights exactly as
   * a disc of `radius` -- see lightProfile, where the two branches are the
   * same formula.
   */
  shape?: ObjectShape;
}

export interface DrawMaskMeshOptions {
  vertexCount: number;
  lightSources: MaskLightSource[];
  objects: ObjectGeometryInput[];
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

  // -1 is "no silhouette", which lightProfile reads as the disc every light was
  // before one could be drawn. Filled for the whole array rather than for the
  // lights in play, so a slot a light has just vacated cannot go on being
  // sampled against the tile that light left behind.
  const lightShapeRows = new Float32Array(MAX_MASK_LIGHT_SOURCES).fill(-1);
  const lightShapeMaxDepth = new Float32Array(MAX_MASK_LIGHT_SOURCES).fill(1);
  const lightShapes = activeLights.map((light) => light.shape);
  if (lightShapes.some((shape) => shape !== undefined)) {
    lightShapes.forEach((shape, i) => {
      if (!shape) return;
      lightShapeRows[i] = i;
      lightShapeMaxDepth[i] = shape.maxDepth;
    });
    // Rebuilt only when the set of outlines actually changes: encoding eight
    // tiles is real work, and the common frame changes nothing about them.
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

  const activeObjects = activeMaskObjects(options.objects);
  gl.uniform1i(state.objectCountLoc, activeObjects.length);
  if (activeObjects.length > 0) {
    const objects = new Float32Array(activeObjects.length * 4);
    const falloffs = new Float32Array(activeObjects.length);
    const blackPoints = new Float32Array(activeObjects.length * 4);
    activeObjects.forEach((object, i) => {
      objects[i * 4] = object.cx;
      objects[i * 4 + 1] = object.cy;
      objects[i * 4 + 2] = Math.max(object.radius, 1);
      objects[i * 4 + 3] = object.elevation;
      falloffs[i] = Math.max(object.falloff, MIN_MASK_OBJECT_FALLOFF);
      blackPoints[i * 4] = object.blackPoint?.r ?? 0;
      blackPoints[i * 4 + 1] = object.blackPoint?.g ?? 0;
      blackPoints[i * 4 + 2] = object.blackPoint?.b ?? 0;
      blackPoints[i * 4 + 3] = object.blackPoint?.a ?? 0;
    });
    gl.uniform4fv(state.objectsLoc, objects);
    gl.uniform1fv(state.objectFalloffsLoc, falloffs);
    gl.uniform4fv(state.objectBlackPointsLoc, blackPoints);
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

export interface ObjectGeometryInput {
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  shape?: ObjectShape;
  blackPoint?: ObjectBlackPoint_V1_0;
}

export function isActiveObject(object: ObjectGeometryInput): boolean {
  return object.radius > 0 && object.elevation !== 0;
}

export function activeMaskObjects<T extends ObjectGeometryInput>(objects: T[]): T[] {
  return objects
    .filter(isActiveObject)
    .sort((a, b) => Math.abs(b.elevation) - Math.abs(a.elevation))
    .slice(0, MAX_MASK_OBJECTS);
}

export function objectProfileK(u: number, falloff: number): number {
  const s = Math.max(1 - u * u, 0);
  return Math.pow(Math.max(s, 1e-4), falloff);
}

/**
 * How far along its falloff a mesh-space point sits within one object -- the
 * TypeScript twin of the shader's objectU, minus the gradient no CPU caller
 * needs.
 *
 * 0 at the object's deepest interior point, 1 at its outline, above 1 outside
 * it. Callers asking "is this point in the object" want `u < 1`, which is the
 * same test the shader's early-out makes.
 */
export function objectProfileUAt(object: ObjectGeometryInput, point: [number, number]): number {
  const toPointX = point[0] - object.cx;
  const toPointY = point[1] - object.cy;
  if (!object.shape) return Math.hypot(toPointX, toPointY) / object.radius;
  return objectShapeProfileU(object.shape, toPointX / object.radius, toPointY / object.radius);
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
};
