import { parsePathPoints, peakShapeRhoAt } from "../mask-gl";
import { LaurusPeak, LaurusPolygonPath } from "../workspace.server";
import { cachedPeakShape } from "./peak-shape";

function centroidOf(points: [number, number][]): [number, number] {
  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ];
}

export function captureTriangleIndicesInCircle(
  polygons: LaurusPolygonPath[],
  circle: { cx: number; cy: number; radius: number },
): Set<number> {
  return indicesInCircleFromCentroids(polygonCentroids(polygons), circle);
}

export function polygonCentroids(polygons: LaurusPolygonPath[]): [number, number][] {
  return polygons.map((polygon) => {
    const points = parsePathPoints(polygon.d);
    return points.length === 0 ? ([NaN, NaN] as [number, number]) : centroidOf(points);
  });
}

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

export interface PeakRegion {
  cx: number;
  cy: number;
  radius: number;
  shape: string;
}

export function indicesInPeakFromCentroids(centroids: [number, number][], peak: PeakRegion): Set<number> {
  const shape = peak.shape ? cachedPeakShape(peak.shape) : undefined;
  if (!shape) return indicesInCircleFromCentroids(centroids, peak);
  const indices = new Set<number>();
  centroids.forEach(([x, y], i) => {
    const dx = x - peak.cx;
    const dy = y - peak.cy;
    const distance = Math.hypot(dx, dy);
    if (distance <= peak.radius * peakShapeRhoAt(shape, distance > 1e-4 ? Math.atan2(dy, dx) : 0)) {
      indices.add(i);
    }
  });
  return indices;
}

export function peakTriangleIndices(polygons: LaurusPolygonPath[], peak: PeakRegion): Set<number> {
  return indicesInPeakFromCentroids(polygonCentroids(polygons), peak);
}

export function captureCenterFromCentroids(
  centroids: [number, number][],
  indices: Set<number>,
): [number, number] | undefined {
  const members: [number, number][] = [];
  indices.forEach((index) => {
    const centroid = centroids[index];
    if (centroid && !Number.isNaN(centroid[0]) && !Number.isNaN(centroid[1])) members.push(centroid);
  });
  if (members.length === 0) return undefined;
  return centroidOf(members);
}

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

export function peakIdAtPoint(peaks: LaurusPeak[], point: [number, number]): number | undefined {
  const [px, py] = point;
  let bestId: number | undefined;
  let bestReach = Infinity;
  for (const peak of peaks) {
    const dx = px - peak.cx;
    const dy = py - peak.cy;
    const distance = Math.hypot(dx, dy);
    const shape = peak.shape ? cachedPeakShape(peak.shape) : undefined;
    const reach = shape ? peak.radius * peakShapeRhoAt(shape, distance > 1e-4 ? Math.atan2(dy, dx) : 0) : peak.radius;
    if (distance > reach) continue;
    if (reach >= bestReach) continue;
    bestId = peak.id;
    bestReach = reach;
  }
  return bestId;
}
