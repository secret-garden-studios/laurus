
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

#include "object-field.glsl"

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
