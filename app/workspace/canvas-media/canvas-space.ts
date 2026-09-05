import type { LaurusProjectMask } from "@/app/projects/projects.server";
import type { LaurusMaskResult } from "../workspace.server";

export interface ProjectCircle {
  cx: number;
  cy: number;
  radius: number;
}

export interface MaskSpace {
  left: number;
  top: number;
  meshPerCanvasX: number;
  meshPerCanvasY: number;
}

export function maskSpace(
  meta: Pick<LaurusProjectMask, "left" | "top" | "width" | "height" | "scale_x" | "scale_y"> | undefined,
  maskData: Pick<LaurusMaskResult, "width" | "height"> | undefined,
): MaskSpace | undefined {
  if (!meta || !maskData) return undefined;
  const onCanvasWidth = meta.width * meta.scale_x;
  const onCanvasHeight = meta.height * meta.scale_y;
  if (onCanvasWidth <= 0 || onCanvasHeight <= 0) return undefined;
  if (maskData.width <= 0 || maskData.height <= 0) return undefined;
  return {
    left: meta.left,
    top: meta.top,
    meshPerCanvasX: maskData.width / onCanvasWidth,
    meshPerCanvasY: maskData.height / onCanvasHeight,
  };
}

export function canvasCircleToMesh(space: MaskSpace, circle: ProjectCircle): ProjectCircle {
  return {
    cx: (circle.cx - space.left) * space.meshPerCanvasX,
    cy: (circle.cy - space.top) * space.meshPerCanvasY,
    radius: circle.radius * space.meshPerCanvasX,
  };
}

export function meshCircleToCanvas(space: MaskSpace, circle: ProjectCircle): ProjectCircle {
  return {
    cx: space.left + circle.cx / space.meshPerCanvasX,
    cy: space.top + circle.cy / space.meshPerCanvasY,
    radius: circle.radius / space.meshPerCanvasX,
  };
}
