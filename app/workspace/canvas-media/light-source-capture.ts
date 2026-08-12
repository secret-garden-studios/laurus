import { parsePathPoints } from "../mask-gl";
import { LaurusPeak, LaurusPolygonPath } from "../workspace.server";

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
  return indicesInCircleFromCentroids(polygonCentroids(polygons), circle);
}

/** Every polygon's own centroid, in polygons order -- the expensive half of
 * captureTriangleIndicesInCircle, split out so a caller that tests many circles against one unchanged
 * mesh can pay for the parse once instead of once per test.
 *
 * "Expensive" is the operative word: this runs parsePathPoints, a regex, over every triangle in the
 * mesh, and a mask carries thousands. That was fine while the only callers were rare commits, but a
 * peak's parameters are now live-previewable, so the highlight recolor that depends on this can be
 * asked to run on every animation frame of a slider drag (see recolorHighlight in
 * project-mask-item.tsx, which caches the result of this for exactly that reason). An entry is
 * [NaN, NaN] for a polygon whose `d` yielded no points, so indices line up with polygons either way.
 */
export function polygonCentroids(polygons: LaurusPolygonPath[]): [number, number][] {
  return polygons.map((polygon) => {
    const points = parsePathPoints(polygon.d);
    return points.length === 0 ? ([NaN, NaN] as [number, number]) : centroidOf(points);
  });
}

/** The cheap half of captureTriangleIndicesInCircle: which of the already-computed centroids fall
 * inside `circle`. A NaN centroid (a polygon whose `d` had no points, see polygonCentroids) fails the
 * comparison and so is excluded, matching the original behavior of skipping such a polygon. */
export function indicesInCircleFromCentroids(
  centroids: [number, number][],
  circle: { cx: number; cy: number; radius: number },
): Set<number> {
  const indices = new Set<number>();
  centroids.forEach(([x, y], i) => {
    const dx = x - circle.cx;
    const dy = y - circle.cy;
    if (dx * dx + dy * dy <= circle.radius * circle.radius) indices.add(i);
  });
  return indices;
}

/** Where a capture's own light hangs: the centroid of its member polygons' centroids, in the same
 * mask-local mesh space the polygons' `d` strings are in. The same center capturedRegionCircle
 * reconstructs, but taken off the already-parsed centroid cache (see polygonCentroids) and off a
 * membership Set rather than off `capture_id`, so it's cheap enough for ProjectMaskItem's own
 * resolveRestingLightSources to call on every frame and current enough to follow a relocate drag
 * that hasn't round-tripped to the server yet.
 *
 * undefined when no member polygon yielded a usable centroid -- a capture whose triangles are all
 * degenerate has no position to light from, and inventing one (the mesh's center, say) would put a
 * light somewhere the document never asked for. */
export function captureCenterFromCentroids(
  centroids: [number, number][],
  indices: Set<number>,
): [number, number] | undefined {
  const members: [number, number][] = [];
  indices.forEach((index) => {
    const centroid = centroids[index];
    // NaN marks a polygon whose `d` yielded no points (see polygonCentroids) -- averaging one in
    // would poison the whole capture's center, not just drop that triangle's contribution.
    if (centroid && !Number.isNaN(centroid[0]) && !Number.isNaN(centroid[1])) members.push(centroid);
  });
  if (members.length === 0) return undefined;
  return centroidOf(members);
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

/** Which peak (by id) `point` (mask-local mesh space, same as the polygons' own `d` strings) falls
 * within, if any -- used the same way captureIdAtPoint is, to tell "a topology drag starting on an
 * existing peak's epicenter" apart from everywhere else on the mesh. Simpler than captureIdAtPoint:
 * a peak's own geometry already *is* its center + radius, so this is a direct point-in-circle test
 * rather than a bounding-box reconstruction from member triangles.
 *
 * Where several peaks contain the point, the smallest-radius one wins rather than whichever comes
 * first in mask.peaks order. Unlike overlapping captures (which are genuinely an edge case, since
 * they're distinct light sources that sit apart), overlapping peaks are an ordinary way to build
 * relief -- a small sharp peak placed on the shoulder of a broad one is exactly what a height field
 * is for -- and first-wins would make the small one ungrabbable whenever it happened to be created
 * second. Smallest-first is also the intuitive reading of a click: the tightest thing under the
 * cursor is the thing being pointed at.
 *
 * Tested against the mesh's *undisplaced* space while the user clicks displaced pixels. That's exact
 * at the epicenter, where the swell is identically zero (see peakSwell, mask-gl.ts), and off by at
 * most 0.385 * MASK_PEAK_SWELL * |elevation| px out on the flanks -- a few pixels at ordinary
 * elevations, and always in the direction of the peak's own center, so a click that lands inside the
 * drawn dome lands inside this test too. */
export function peakIdAtPoint(peaks: LaurusPeak[], point: [number, number]): number | undefined {
  const [px, py] = point;
  let bestId: number | undefined;
  let bestRadius = Infinity;
  for (const peak of peaks) {
    const dx = px - peak.cx;
    const dy = py - peak.cy;
    if (dx * dx + dy * dy > peak.radius * peak.radius) continue;
    if (peak.radius >= bestRadius) continue;
    bestId = peak.id;
    bestRadius = peak.radius;
  }
  return bestId;
}
