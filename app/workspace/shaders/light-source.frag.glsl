
#extension GL_OES_standard_derivatives : enable
precision mediump float;

#include <constants>
#include "object-field.glsl"
#include "light-field.glsl"
varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying vec4 v_highlight;
varying vec4 v_fillOverlay;
varying vec2 v_meshPos;

uniform vec2 u_resolution;

uniform vec2 u_lightSourceCenters[MAX_LIGHT_SOURCES];
uniform float u_lightSourceRadii[MAX_LIGHT_SOURCES];
uniform float u_lightSourceSpreads[MAX_LIGHT_SOURCES];
uniform float u_lightSourceIntensities[MAX_LIGHT_SOURCES];
uniform float u_lightSourceShadows[MAX_LIGHT_SOURCES];
uniform float u_lightSourceCasts[MAX_LIGHT_SOURCES];
uniform mediump vec4 u_lightTransforms[MAX_LIGHT_SOURCES];
uniform float u_lightGridlines[MAX_LIGHT_SOURCES];
uniform float u_lightLowpoly[MAX_LIGHT_SOURCES];
uniform int u_lightSourceCount;

uniform float u_textureMix;
uniform sampler2D u_texture;
uniform float u_hasTexture;

uniform sampler2D u_mask;
uniform float u_maskActive;
uniform vec3 u_glowColor;

uniform float u_backingGrey;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

uniform vec4 u_objectFills[MAX_MASK_OBJECTS];

#include "object-lift.glsl"

struct ObjectFill {
  vec4 color;
  float order;
  float nearest;
};

ObjectFill objectFill(vec2 p, bool behind) {
  ObjectFill fill = ObjectFill(vec4(0.0), -1e9, 1.0);
  for (int i = 0; i < MAX_MASK_OBJECTS; i++) {
    if (i >= u_objectCount) break;
    if (u_objectFills[i].a <= 0.0) continue;
    float order = u_objectOrders[i];
    if (behindMask(order) != behind) continue;
    vec2 toPoint = p - u_objects[i].xy;
    float u = objectU(
      u_objectShapeRows[i], u_objectShapeMaxDepth[i], toPoint, u_objects[i].z, u_objectRotations[i]).x;
    if (u >= 1.0) continue;
    if (!objectOutranks(order, fill.order, u, fill.nearest)) continue;
    fill.order = order;
    fill.nearest = u;
    fill.color = u_objectFills[i];
  }
  return fill;
}

float fillOver(float liftOrder, float liftCover, ObjectFill fill) {
  if (fill.color.a <= 0.0) return 1.0;
  if (liftOrder < fill.order + OBJECT_ORDER_EPSILON) return 1.0;
  return 1.0 - liftCover;
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

  ObjectFill behindFill = objectFill(v_meshPos, true);
  float behindOver = fillOver(lift.underOrder, lift.underCover, behindFill);
  float under = lift.under * underTexel.a;
  vec3 underRgb = mix(underTexel.rgb, behindFill.color.rgb, behindFill.color.a * behindOver);

  float lowerAlpha = restingAlpha + under * (1.0 - restingAlpha);
  float safeLower = max(lowerAlpha, 1e-4);
  vec3 lowerRgb =
    (restingTexel.rgb * restingAlpha + underRgb * under * (1.0 - restingAlpha)) / safeLower;

  ObjectFill fill = objectFill(v_meshPos, false);
  float over = fillOver(lift.order, lift.cover, fill);
  vec3 lowerShown = mix(lowerRgb, fill.color.rgb, fill.color.a * (1.0 - over));

  float alpha = carried + lowerAlpha * (1.0 - carried);
  float safeAlpha = max(alpha, 1e-4);
  vec3 textured = (carriedTexel.rgb * carried + lowerShown * lowerAlpha * (1.0 - carried)) / safeAlpha;

  float beneath = restingAlpha * (1.0 - carried) / safeAlpha;

  vec3 base = mix(textured, fill.color.rgb, fill.color.a * over);
  base = mix(base, v_fillOverlay.rgb, v_fillOverlay.a * beneath);

  vec3 field = objectField(v_meshPos);
  vec3 normal = normalize(vec3(-field.xy, 1.0));
  vec3 surface = vec3(v_meshPos, field.z);
  float bumpLit = 0.0;
  float bumpShade = 0.0;

  float bestHighlight = 0.0;
  float darkest = 0.0;
  float brightest = 0.0;
  float gridlinesMix = 0.0;
  for (int i = 0; i < MAX_LIGHT_SOURCES; i++) {
    if (i >= u_lightSourceCount) break;
    vec2 sampledAt = mix(gl_FragCoord.xy, v_lightSourcePos, u_lightLowpoly[i]);
    vec2 offset = sampledAt - u_lightSourceCenters[i];
    vec2 shaped = objectToShape(u_lightTransforms[i], vec2(offset.x, -offset.y));
    vec2 profile = lightProfile(
      u_lightShapeRows[i], u_lightShapeMaxDepth[i], shaped, u_lightSourceRadii[i]);

    gridlinesMix = max(gridlinesMix, u_lightGridlines[i] * (1.0 - step(1.0, profile.x)));

    float highlight = 1.0 - smoothstep(0.35, 1.0, profile.x);
    float unlit = smoothstep(0.0, u_lightSourceSpreads[i], profile.y);

    float rank = u_lightOrders[i];
    vec3 lightPos = vec3(u_lightSourceCenters[i].x,
                         u_resolution.y - u_lightSourceCenters[i].y,
                         u_lightSourceRadii[i] * LIGHT_HEIGHT_SCALE);
    float sheet = behindMask(rank) ? restingAlpha : 0.0;
    float covered = max(lift.overCover * step(rank + OBJECT_ORDER_EPSILON, lift.over), sheet);

    float hidden = covered;
    if (covered < 1.0 && unlit < 1.0) {
      hidden = max(
        hidden, 1.0 - lightReach(v_meshPos, lightPos.xy, u_lightSourceRadii[i], rank));
    }
    float reachable = 1.0 - hidden;

    float tail =
      u_lightSourceSpreads[i] * u_lightSourceCasts[i] * (1.0 + u_lightSourceIntensities[i]);
    float beyond = max(profile.y - u_lightSourceSpreads[i], 0.0);
    float carry = tail > 0.0 ? 1.0 - smoothstep(0.0, tail, beyond) : 1.0;

    bestHighlight = max(bestHighlight, highlight * u_lightSourceIntensities[i] * (1.0 - covered));
    darkest = max(darkest, u_lightSourceShadows[i] * carry);
    brightest = max(brightest, (1.0 - unlit) * reachable);

    vec3 lightDir = normalize(lightPos - surface);
    float bump = dot(normal, lightDir) - lightDir.z;
    float reach = (1.0 - unlit) * reachable;
    bumpLit = max(bumpLit, max(bump, 0.0) * reach * BUMP_STRENGTH);
    bumpShade = max(bumpShade, max(-bump, 0.0) * reach * BUMP_STRENGTH);
  }

  float shade = darkest * (1.0 - brightest);

  vec3 lit = mix(base, vec3(1.0), min(bestHighlight + bumpLit, 1.0));
  vec3 shaded = lit - shade - bumpShade;
  vec3 strokeColor = STROKE_COLOR - shade - bumpShade;
  float strokeMix = max(u_textureMix, gridlinesMix);
  vec3 withEdge = mix(shaded, strokeColor, edge * strokeMix * STROKE_ALPHA * beneath);

  float glowMix = mask.r * u_maskActive * beneath * (u_hasTexture > 0.5 ? 0.0 : 1.0);
  vec3 withGlow = mix(withEdge, u_glowColor, glowMix);

  float lightEdge = highlightEdge * v_highlight.a;
  vec3 withLightStroke = mix(withGlow, v_highlight.rgb, lightEdge);

  float luma = dot(withLightStroke, LUMA);
  vec3 greyed = mix(withLightStroke, vec3(luma * BACKING_GREY_LEVEL), u_backingGrey);

  gl_FragColor = vec4(greyed, alpha);
}
