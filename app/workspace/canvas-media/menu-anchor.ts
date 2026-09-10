import type { LaurusProjectMask } from "../../projects/projects.server";
import type { LaurusMaskResult } from "../workspace.server";
import { lightOutline, objectOutline } from "./light-geometry.ts";
import { projectLocalPoint, type Point2D } from "./geometry.ts";

const ANCHOR_GUTTER = 8;

export type MaskSubElement = { kind: "light"; id: number } | { kind: "object"; id: number };

export function maskSubElementCenter(
  meta: LaurusProjectMask,
  maskData: LaurusMaskResult | undefined,
  subject: MaskSubElement,
  offset?: { dx: number; dy: number },
): Point2D | undefined {
  if (!maskData || maskData.width <= 0 || maskData.height <= 0) return undefined;
  let outline: { cx: number; cy: number } | undefined;
  if (subject.kind === "light") {
    const light = maskData.lights.find((l) => l.id === subject.id);
    outline = light && lightOutline(maskData, light);
  } else {
    const object = maskData.objects.find((o) => o.id === subject.id);
    outline = object && objectOutline(maskData, object);
  }
  if (!outline) return undefined;
  const cx = outline.cx + (offset?.dx ?? 0);
  const cy = outline.cy + (offset?.dy ?? 0);
  return projectLocalPoint(meta, {
    x: (cx / maskData.width) * meta.width * meta.scale_x,
    y: (cy / maskData.height) * meta.height * meta.scale_y,
  });
}

export interface AnchoredMenuPlacement {
  top: number;
  leftSide: boolean;
  bottomSide: boolean;
}

export function anchoredMenuPlacement(input: {
  center: Point2D;
  wrapper: { top: number; left: number; width: number };
  item: { top: number; left: number };
  canvas: { width: number; height: number };
  menu: { width: number; height: number; caretHeight: number };
  preferredLeft: boolean;
}): AnchoredMenuPlacement {
  const { center, wrapper, item, canvas, menu, preferredLeft } = input;
  const canvasTop = item.top + wrapper.top;
  const canvasLeft = item.left + wrapper.left;

  const caretAtTop = center.y - wrapper.top - menu.caretHeight / 2;
  const caretAtBottom = center.y - wrapper.top - menu.height + menu.caretHeight / 2;
  const bottomSide = canvasTop + caretAtTop + menu.height > canvas.height && canvasTop + caretAtBottom >= 0;
  const topLimit = -canvasTop;
  const bottomLimit = Math.max(topLimit, canvas.height - menu.height - canvasTop);

  const fitsLeft = canvasLeft - ANCHOR_GUTTER - menu.width >= 0;
  const fitsRight = canvasLeft + wrapper.width + ANCHOR_GUTTER + menu.width <= canvas.width;
  const towardLeft = center.x - wrapper.left <= wrapper.width / 2;

  return {
    bottomSide,
    leftSide: fitsLeft === fitsRight ? (fitsLeft ? towardLeft : preferredLeft) : fitsLeft,
    top: Math.min(Math.max(bottomSide ? caretAtBottom : caretAtTop, topLimit), bottomLimit),
  };
}
