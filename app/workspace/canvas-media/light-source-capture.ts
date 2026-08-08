import { parsePathPoints } from "../mask-gl";
import { LaurusPolygonPath } from "../workspace.server";

function centroidOf(points: [number, number][]): [number, number] {
  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ];
}

/**
 * Which indices of a mesh's own polygons fall inside a capture circle -- centroid-in-circle,
 * matching the single "first/only match" hit-testing style already used elsewhere in this
 * codebase (e.g. the marquee's own select-mode test in canvas.tsx). `circle` is in the same
 * coordinate space as the polygons' own `d` strings (a mask's local mesh space, 0..width/0..height).
 *
 * Returns indices rather than the triangle points themselves so a capture can be shown
 * optimistically while it's in flight (see PendingLightSourceCapture, core-state.ts) -- drawing a
 * circle immediately sends its indices to the server (workspace.client.tsx's captureMeshSection),
 * where they're written directly onto the mask's own polygons as a `capture_id`. Membership isn't
 * exclusive to whichever capture used to own a triangle: a later circle can freely claim triangles
 * an earlier capture had, since capture_id only ever feeds a UI anchor/highlight, never rendering.
 */
export function captureTriangleIndicesInCircle(
  polygons: LaurusPolygonPath[],
  circle: { cx: number; cy: number; radius: number },
): Set<number> {
  const indices = new Set<number>();
  polygons.forEach((polygon, i) => {
    const points = parsePathPoints(polygon.d);
    if (points.length === 0) return;
    const centroid = centroidOf(points);
    const dx = centroid[0] - circle.cx;
    const dy = centroid[1] - circle.cy;
    if (dx * dx + dy * dy <= circle.radius * circle.radius) indices.add(i);
  });
  return indices;
}

/** Reconstructs the circle a given capture was (or could have been) drawn with -- centroid of its
 * own polygons' centroids as cx/cy, radius the farthest of them from that center. Every capture
 * that has ever existed through this UI was itself authored via captureTriangleIndicesInCircle,
 * so this is a faithful reconstruction rather than an approximation of some arbitrary shape --
 * used to re-run that same circle test from a new center point while dragging an existing capture
 * to relocate it (project-mask-item.tsx). */
export function capturedRegionCircle(
  polygons: LaurusPolygonPath[],
  captureId: number,
): { cx: number; cy: number; radius: number } | undefined {
  const centroids = polygons
    .filter((p) => p.capture_id === captureId)
    .map((p) => parsePathPoints(p.d))
    .filter((points) => points.length > 0)
    .map(centroidOf);
  if (centroids.length === 0) return undefined;
  const [cx, cy] = centroidOf(centroids);
  const radius = Math.max(...centroids.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { cx, cy, radius };
}

/** Which capture (by id) `point` (mask-local mesh space, same as the polygons' own `d` strings)
 * falls within, if any -- used to tell "meta-click on a capture" apart from "meta-click on the
 * mesh in general", and which capture specifically, for both the context menu (project-mask-item.tsx)
 * and starting a relocate drag. Bounding-box per capture, not exact per-triangle hit-testing:
 * individual mesh triangles are typically small relative to how a mask is actually displayed on
 * screen (especially zoomed out), so requiring a click to land inside one specific tiny triangle
 * made this effectively unusable in practice. If two captures' bounding boxes overlap at the
 * clicked point, the first one found (mask.polygons order) wins -- capture regions are expected to
 * sit apart from each other in practice (they're distinct light sources), so this is an edge case,
 * not the common path. Each capture's bounding box is the same shape unit-display.tsx's
 * reconstructed-capture thumbnail already uses for its viewBox, so "the area a click needs to land
 * in" matches "the area the thumbnail shows". */
export function captureIdAtPoint(polygons: LaurusPolygonPath[], point: [number, number]): number | undefined {
  const [px, py] = point;
  const orderedCaptureIds: number[] = [];
  const pointsByCapture = new Map<number, [number, number][]>();
  polygons.forEach((p) => {
    if (p.capture_id === 0) return;
    if (!pointsByCapture.has(p.capture_id)) orderedCaptureIds.push(p.capture_id);
    const points = pointsByCapture.get(p.capture_id) ?? [];
    points.push(...parsePathPoints(p.d));
    pointsByCapture.set(p.capture_id, points);
  });
  for (const captureId of orderedCaptureIds) {
    const points = pointsByCapture.get(captureId) ?? [];
    if (points.length === 0) continue;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    if (px >= Math.min(...xs) && px <= Math.max(...xs) && py >= Math.min(...ys) && py <= Math.max(...ys)) {
      return captureId;
    }
  }
  return undefined;
}
