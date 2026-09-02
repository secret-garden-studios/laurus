
#include <constants>
#include "object-field.glsl"

uniform mediump vec4 u_objectLifts[MAX_MASK_OBJECTS];

struct ObjectLift {
  vec2 uv;
  float body;
  float order;
  float cover;
  vec2 underUv;
  float under;
  float underOrder;
  float underCover;
  float hole;
  float over;
  float overCover;
};

float objectCoverage(float u, float radius) {
  float width = 1.0 / max(radius, 1.0);
  return 1.0 - smoothstep(1.0 - width, 1.0, u);
}

float objectDistance(float row, vec2 toPoint, float radius, vec4 rotation) {
  vec2 n = objectToShape(rotation, toPoint / radius);
  float reach = length(n);
  if (row < 0.0) return (reach - 1.0) * radius;
  float overshoot = max(reach - OBJECT_SDF_MARGIN, 0.0);
  vec2 sampled = n * min(1.0, OBJECT_SDF_MARGIN / max(reach, 1e-6));
  return (overshoot - objectDepthAt(row, sampled).x) * radius;
}

float objectReach(float radius, vec4 rotation) {
  float determinant = abs(rotation.x * rotation.w - rotation.y * rotation.z);
  return radius * OBJECT_SDF_MARGIN * length(rotation) / max(determinant, 1e-3);
}

float objectShadow(
  float row, vec2 center, float radius, vec4 rotation,
  vec2 p, vec2 towards, float span, float spread
) {
  float bound = objectReach(radius, rotation);
  float along = clamp(dot(center - p, towards), 0.0, span);
  float aside = distance(p + towards * along, center);
  if (aside > bound + spread) return 1.0;

  float flare = spread / span;
  float taper = 1.0 - flare * flare;
  float widest = bound + along * flare;
  float entry = max(along - bound, 0.0);
  float leave = min(along + bound, span);
  if (taper > 0.0) {
    float bracket = widest * widest - taper * aside * aside;
    if (bracket <= 0.0) return 1.0;
    float root = sqrt(bracket);
    entry = clamp(along + (flare * widest - root) / taper, 0.0, span);
    leave = clamp(along + (flare * widest + root) / taper, 0.0, span);
  }

  float stride = (leave - entry) / float(MASK_SHADOW_STEPS - 1);
  float sharpness = span / spread;

  float reach = 1.0;
  for (int s = 0; s < MASK_SHADOW_STEPS; s++) {
    float t = entry + stride * float(s);
    float h = objectDistance(row, p + towards * t - center, radius, rotation);

    reach = min(reach, 0.5 + 0.5 * sharpness * h / max(t, MASK_SHADOW_NEAR));
    if (reach <= 0.0) return 0.0;
  }
  reach = clamp(reach, 0.0, 1.0);

  return reach * reach * (3.0 - 2.0 * reach);
}

float lightReach(vec2 p, vec2 lightPos, float lightRadius, float lightOrder) {
  if (abs(lightOrder) < OBJECT_ORDER_EPSILON) return 1.0;

  vec2 towards = lightPos - p;
  float span = max(length(towards), MASK_SHADOW_NEAR);
  towards /= span;
  float spread = max(lightRadius, 1.0);

  float reach = 1.0;
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    if (u_objectOrders[i] < lightOrder + OBJECT_ORDER_EPSILON) continue;
    reach = min(reach, objectShadow(
      u_objectShapeRows[i], u_objects[i].xy, u_objects[i].z, u_objectRotations[i],
      p, towards, span, spread));

    if (reach <= 0.0) return 0.0;
  }
  return reach;
}

ObjectLift objectLift(vec2 meshPos) {
  vec2 own = gl_FragCoord.xy / u_resolution;
  ObjectLift lift = ObjectLift(own, 0.0, -1e9, 0.0, own, 0.0, -1e9, 0.0, 0.0, -1e9, 0.0);
  float nearest = 1.0;
  float underNearest = 1.0;
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;

    vec2 center = u_objects[i].xy;
    float radius = u_objects[i].z;
    float row = u_objectShapeRows[i];
    float maxDepth = u_objectShapeMaxDepth[i];
    float order = u_objectOrders[i];

    float body = objectU(row, maxDepth, meshPos - center, radius, u_objectRotations[i]).x;
    float coverage = objectCoverage(body, radius);
    bool inside = body < 1.0;

    if (inside && order > lift.over) {
      lift.over = order;
      lift.overCover = coverage;
    }

    if (u_objectLifts[i].w < 0.5) continue;

    vec2 restCenter = u_objectLifts[i].xy;
    float restRadius = max(u_objectLifts[i].z, 1.0);
    float rest = objectU(row, maxDepth, meshPos - restCenter, restRadius, OBJECT_ROTATION_NONE).x;
    lift.hole = max(lift.hole, objectCoverage(rest, restRadius));

    float scale = radius / restRadius;
    vec2 here = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 there = restCenter + objectToShape(u_objectRotations[i], here - center) / scale;
    vec2 sampled = vec2(there.x, u_resolution.y - there.y) / u_resolution;
    if (behindMask(order)) {
      lift.under = max(lift.under, coverage);
      if (inside && objectOutranks(order, lift.underOrder, body, underNearest)) {
        lift.underOrder = order;
        underNearest = body;
        lift.underCover = coverage;
        lift.underUv = sampled;
      }
    } else {
      lift.body = max(lift.body, coverage);
      if (inside && objectOutranks(order, lift.order, body, nearest)) {
        lift.order = order;
        nearest = body;
        lift.cover = coverage;
        lift.uv = sampled;
      }
    }
  }
  return lift;
}
