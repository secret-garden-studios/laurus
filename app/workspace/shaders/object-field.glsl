
#include <constants>
#define OBJECT_FIELD_PI 3.141592653589793

uniform mediump vec4 u_objects[MAX_MASK_OBJECTS];
uniform mediump float u_objectFalloffs[MAX_MASK_OBJECTS];
uniform mediump int u_objectCount;

uniform mediump float u_objectOrders[MAX_MASK_OBJECTS];

bool behindMask(float order) {
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
    if (behindMask(u_objectOrders[i])) continue;
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
    if (behindMask(u_objectOrders[i])) continue;
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
