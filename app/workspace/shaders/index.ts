import { CONSTANTS_GLSL } from "./constants.ts";
import { resolveIncludes } from "./include.ts";
import lightField from "./light-field.glsl";
import fragmentSource from "./light-source.frag.glsl";
import vertexSource from "./light-source.vert.glsl";
import objectField from "./object-field.glsl";
import objectLift from "./object-lift.glsl";

export interface Shader {
  vertex: string;
  fragment: string;
}

const CHUNKS: Readonly<Record<string, string>> = {
  constants: CONSTANTS_GLSL,
  "object-field.glsl": objectField,
  "light-field.glsl": lightField,
  "object-lift.glsl": objectLift,
};

export const LIGHT_SOURCE_SHADER: Shader = {
  vertex: resolveIncludes(vertexSource, CHUNKS),
  fragment: resolveIncludes(fragmentSource, CHUNKS),
};
