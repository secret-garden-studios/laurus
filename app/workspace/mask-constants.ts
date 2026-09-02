import { OBJECT_SDF_MARGIN, OBJECT_SDF_TILE } from "./canvas-media/object-shape.ts";

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
export const MASK_SHADOW_STEPS = 16;
export const MASK_SHADOW_NEAR = 0.5;
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
