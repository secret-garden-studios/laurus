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
 * Returns indices rather than the triangle points themselves so a capture can be held as a
 * pending, not-yet-persisted candidate (see PendingLightSourceCapture, core-state.ts) -- the user
 * can redraw as many times as they like with zero server calls, and the indices only get sent to
 * the server once they actually confirm (workspace.client.tsx's confirmLightSourceCapture), where
 * they're written directly onto the mask's own polygons as a `captured` flag.
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

/** Reconstructs the circle a mesh's current capture was (or could have been) drawn with --
 * centroid of the captured polygons' own centroids as cx/cy, radius the farthest of them from
 * that center. Every capture that has ever existed through this UI was itself authored via
 * captureTriangleIndicesInCircle, so this is a faithful reconstruction rather than an
 * approximation of some arbitrary shape -- used to re-run that same circle test from a new
 * center point while dragging an existing capture to relocate it (project-mask-item.tsx). */
export function capturedRegionCircle(polygons: LaurusPolygonPath[]): { cx: number; cy: number; radius: number } | undefined {
  const centroids = polygons
    .filter((p) => p.captured)
    .map((p) => parsePathPoints(p.d))
    .filter((points) => points.length > 0)
    .map(centroidOf);
  if (centroids.length === 0) return undefined;
  const [cx, cy] = centroidOf(centroids);
  const radius = Math.max(...centroids.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { cx, cy, radius };
}

/** Whether `point` (mask-local mesh space, same as the polygons' own `d` strings) falls within
 * the captured region -- used to tell "meta-click on the capture" apart from "meta-click on the
 * mesh in general" (project-mask-item.tsx). Bounding-box over every captured triangle's points,
 * not exact per-triangle hit-testing: individual mesh triangles are typically small relative to
 * how a mask is actually displayed on screen (especially zoomed out), so requiring a click to land
 * inside one specific tiny triangle made this effectively unusable in practice. The bounding box
 * is the same shape unit-display.tsx's reconstructed-capture thumbnail already uses for its
 * viewBox, so "the area the click needs to land in" matches "the area the thumbnail shows". */
export function isPointInCapturedPolygon(polygons: LaurusPolygonPath[], point: [number, number]): boolean {
  const capturedPoints = polygons.filter((p) => p.captured).flatMap((p) => parsePathPoints(p.d));
  if (capturedPoints.length === 0) return false;
  const [px, py] = point;
  const xs = capturedPoints.map(([x]) => x);
  const ys = capturedPoints.map(([, y]) => y);
  return px >= Math.min(...xs) && px <= Math.max(...xs) && py >= Math.min(...ys) && py <= Math.max(...ys);
}
