import { objectShapeRhoAt } from "../mask-gl.ts";
import type { LaurusObject, LaurusPolygonPath } from "../workspace.server";
import { cachedObjectShape } from "./object-shape.ts";
import { centroidOf } from "./mask-geometry.ts";

function pointInTriangle(
  px: number,
  py: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [cx, cy]: [number, number],
): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

export function polygonIndexAtPoint(points: [number, number][][], point: [number, number]): number | undefined {
  const [px, py] = point;
  for (let i = 0; i < points.length; i++) {
    const triangle = points[i];
    if (triangle.length !== 3) continue;
    if (pointInTriangle(px, py, triangle[0], triangle[1], triangle[2])) return i;
  }
  return undefined;
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

export interface ObjectRegion {
  cx: number;
  cy: number;
  radius: number;
  shape: string;
}

export function indicesInObjectFromCentroids(centroids: [number, number][], object: ObjectRegion): Set<number> {
  const shape = object.shape ? cachedObjectShape(object.shape) : undefined;
  if (!shape) return indicesInCircleFromCentroids(centroids, object);
  const indices = new Set<number>();
  centroids.forEach(([x, y], i) => {
    const dx = x - object.cx;
    const dy = y - object.cy;
    const distance = Math.hypot(dx, dy);
    if (distance <= object.radius * objectShapeRhoAt(shape, distance > 1e-4 ? Math.atan2(dy, dx) : 0)) {
      indices.add(i);
    }
  });
  return indices;
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

export function centerOfIndices(
  points: [number, number][][],
  indices: Set<number>,
): { x: number; y: number } | undefined {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  indices.forEach((index) => {
    const triangle = points[index];
    if (!triangle) return;
    for (const [px, py] of triangle) {
      sumX += px;
      sumY += py;
      count++;
    }
  });
  if (count === 0) return undefined;
  return { x: sumX / count, y: sumY / count };
}

export function capturedRegionCircle(
  polygons: LaurusPolygonPath[],
  centroids: [number, number][],
  captureId: number,
): { cx: number; cy: number; radius: number } | undefined {
  const members: [number, number][] = [];
  polygons.forEach((p, i) => {
    if (p.capture_id !== captureId) return;
    const centroid = centroids[i];
    if (centroid && !Number.isNaN(centroid[0]) && !Number.isNaN(centroid[1])) members.push(centroid);
  });
  if (members.length === 0) return undefined;
  const [cx, cy] = centroidOf(members);
  const radius = Math.max(...members.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { cx, cy, radius };
}

export function captureIdAtPoint(
  polygons: LaurusPolygonPath[],
  points: [number, number][][],
  point: [number, number],
): number | undefined {
  const [px, py] = point;
  const orderedCaptureIds: number[] = [];
  const boundsByCapture = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>();
  polygons.forEach((p, i) => {
    if (p.capture_id === 0) return;
    const triangle = points[i];
    if (!triangle || triangle.length === 0) return;
    let bounds = boundsByCapture.get(p.capture_id);
    if (!bounds) {
      orderedCaptureIds.push(p.capture_id);
      bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      boundsByCapture.set(p.capture_id, bounds);
    }
    for (const [x, y] of triangle) {
      if (x < bounds.minX) bounds.minX = x;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (y > bounds.maxY) bounds.maxY = y;
    }
  });
  for (const captureId of orderedCaptureIds) {
    const bounds = boundsByCapture.get(captureId);
    if (!bounds) continue;
    if (px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY) {
      return captureId;
    }
  }
  return undefined;
}

export function objectIdAtPoint(objects: LaurusObject[], point: [number, number]): number | undefined {
  const [px, py] = point;
  let bestId: number | undefined;
  let bestReach = Infinity;
  for (const object of objects) {
    const dx = px - object.cx;
    const dy = py - object.cy;
    const distance = Math.hypot(dx, dy);
    const shape = object.shape ? cachedObjectShape(object.shape) : undefined;
    const reach = shape
      ? object.radius * objectShapeRhoAt(shape, distance > 1e-4 ? Math.atan2(dy, dx) : 0)
      : object.radius;
    if (distance > reach) continue;
    if (reach >= bestReach) continue;
    bestId = object.id;
    bestReach = reach;
  }
  return bestId;
}

interface TriangleIndex {
  minX: number;
  minY: number;
  cellSize: number;
  cols: number;
  rows: number;
  cells: number[][];
}

const triangleIndexCache = new WeakMap<[number, number][][], TriangleIndex>();

function buildTriangleIndex(points: [number, number][][]): TriangleIndex {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let counted = 0;
  for (const triangle of points) {
    if (triangle.length !== 3) continue;
    counted++;
    for (const [x, y] of triangle) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (counted === 0) {
    return { minX: 0, minY: 0, cellSize: 1, cols: 1, rows: 1, cells: [[]] };
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const divisions = Math.max(1, Math.ceil(Math.sqrt(counted)));
  const cellSize = span / divisions;
  const cols = Math.max(1, Math.floor((maxX - minX) / cellSize) + 1);
  const rows = Math.max(1, Math.floor((maxY - minY) / cellSize) + 1);
  const cells: number[][] = Array.from({ length: cols * rows }, () => []);
  points.forEach((triangle, i) => {
    if (triangle.length !== 3) return;
    let tMinX = Infinity;
    let tMinY = Infinity;
    let tMaxX = -Infinity;
    let tMaxY = -Infinity;
    for (const [x, y] of triangle) {
      if (x < tMinX) tMinX = x;
      if (x > tMaxX) tMaxX = x;
      if (y < tMinY) tMinY = y;
      if (y > tMaxY) tMaxY = y;
    }
    const colStart = Math.max(0, Math.min(cols - 1, Math.floor((tMinX - minX) / cellSize)));
    const colEnd = Math.max(0, Math.min(cols - 1, Math.floor((tMaxX - minX) / cellSize)));
    const rowStart = Math.max(0, Math.min(rows - 1, Math.floor((tMinY - minY) / cellSize)));
    const rowEnd = Math.max(0, Math.min(rows - 1, Math.floor((tMaxY - minY) / cellSize)));
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) cells[row * cols + col].push(i);
    }
  });
  return { minX, minY, cellSize, cols, rows, cells };
}

function triangleIndexFor(points: [number, number][][]): TriangleIndex {
  const cached = triangleIndexCache.get(points);
  if (cached) return cached;
  const index = buildTriangleIndex(points);
  triangleIndexCache.set(points, index);
  return index;
}

export function indexedPolygonIndexAtPoint(points: [number, number][][], point: [number, number]): number | undefined {
  const [px, py] = point;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return undefined;
  const index = triangleIndexFor(points);
  const col = Math.floor((px - index.minX) / index.cellSize);
  const row = Math.floor((py - index.minY) / index.cellSize);
  if (col < 0 || col >= index.cols || row < 0 || row >= index.rows) return undefined;
  let best: number | undefined;
  for (const i of index.cells[row * index.cols + col]) {
    if (best !== undefined && i > best) continue;
    const triangle = points[i];
    if (pointInTriangle(px, py, triangle[0], triangle[1], triangle[2])) best = i;
  }
  return best;
}

export function translateIndices(
  points: [number, number][][],
  centroids: [number, number][],
  indices: Set<number>,
  dx: number,
  dy: number,
): Set<number> {
  if (dx === 0 && dy === 0) return new Set(indices);
  const translated = new Set<number>();
  indices.forEach((i) => {
    const centroid = centroids[i];
    if (!centroid || Number.isNaN(centroid[0]) || Number.isNaN(centroid[1])) return;
    const landed = indexedPolygonIndexAtPoint(points, [centroid[0] + dx, centroid[1] + dy]);
    if (landed !== undefined) translated.add(landed);
  });
  return translated;
}
