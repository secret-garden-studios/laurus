
#include <constants>
#include "object-field.glsl"

uniform mediump sampler2D u_lightShapes;
uniform mediump float u_lightShapeRows[MAX_LIGHT_SOURCES];
uniform mediump float u_lightShapeMaxDepth[MAX_LIGHT_SOURCES];
uniform mediump float u_lightOrders[MAX_LIGHT_SOURCES];

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
