import { MASK_OBJECT_COLLISION_BUFFER_PX, activeMaskObjects, objectProfileUAt, objectSwellAt } from "../mask-gl.ts";
import type { ObjectGeometryInput } from "../mask-gl.ts";
import type { LaurusLight, LaurusMaskResult, LaurusObject, LaurusPolygonPath } from "../workspace.server";
import { cachedObjectShape } from "./object-shape.ts";
import { centroidOf, maskGeometry, polygonIndicesForLight, polygonIndicesForObject } from "./mask-geometry.ts";

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

function maxSwellReach(object: ObjectGeometryInput): number {
  return object.radius * (object.shape?.maxExtent ?? 1);
}

interface MeshSwell {
  objects: ObjectGeometryInput[];
  reachSquares: number[];
}

function meshSwell(objects: ObjectGeometryInput[]): MeshSwell | undefined {
  const swelling = activeMaskObjects(objects);
  if (swelling.length === 0) return undefined;
  return { objects: swelling, reachSquares: swelling.map((object) => maxSwellReach(object) ** 2) };
}

function swelled(swell: MeshSwell | undefined, point: [number, number]): [number, number] {
  if (!swell) return point;
  const [x, y] = point;
  const moves = swell.objects.some(({ cx, cy }, i) => (x - cx) ** 2 + (y - cy) ** 2 < swell.reachSquares[i]);
  if (!moves) return point;
  const [dx, dy] = objectSwellAt(point, swell.objects);
  return [x + dx, y + dy];
}

export function swelledPolygonIndexAtPoint(
  points: [number, number][][],
  objects: ObjectGeometryInput[],
  point: [number, number],
): number | undefined {
  const swell = meshSwell(objects);
  if (!swell) return polygonIndexAtPoint(points, point);
  const [px, py] = point;
  for (let i = 0; i < points.length; i++) {
    const triangle = points[i];
    if (triangle.length !== 3) continue;
    const [a, b, c] = triangle;
    if (pointInTriangle(px, py, swelled(swell, a), swelled(swell, b), swelled(swell, c))) return i;
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

export function indicesInObjectFromCentroids(
  centroids: [number, number][],
  object: ObjectRegion,
  tile?: number,
): Set<number> {
  const shape = object.shape ? cachedObjectShape(object.shape, tile) : undefined;
  if (!shape) return indicesInCircleFromCentroids(centroids, object);
  const indices = new Set<number>();
  const geometry = { cx: object.cx, cy: object.cy, radius: object.radius, elevation: 0, falloff: 0, shape };
  centroids.forEach((centroid, i) => {
    if (objectProfileUAt(geometry, centroid) < 1) indices.add(i);
  });
  return indices;
}

function pointToSegmentDistanceSq(
  px: number,
  py: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return dx * dx + dy * dy;
}

function pointToTriangleDistanceSq(px: number, py: number, triangle: [number, number][]): number {
  const [a, b, c] = triangle;
  if (pointInTriangle(px, py, a, b, c)) return 0;
  return Math.min(
    pointToSegmentDistanceSq(px, py, a, b),
    pointToSegmentDistanceSq(px, py, b, c),
    pointToSegmentDistanceSq(px, py, c, a),
  );
}

interface ClaimedTriangle {
  points: [number, number][];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function dropIndicesClaimedByObjects(
  candidates: Set<number>,
  geometry: { points: [number, number][][]; centroids: [number, number][] },
  polygons: LaurusPolygonPath[],
  options?: { objectId?: number; buffer?: number },
): Set<number> {
  const buffer = Math.max(0, options?.buffer ?? MASK_OBJECT_COLLISION_BUFFER_PX);
  const claimed: ClaimedTriangle[] = [];
  let reachMinX = Infinity;
  let reachMaxX = -Infinity;
  let reachMinY = Infinity;
  let reachMaxY = -Infinity;
  polygons.forEach((polygon, index) => {
    if (polygon.object_id === 0 || polygon.object_id === options?.objectId) return;
    const points = geometry.points[index];
    if (!points || points.length !== 3) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    claimed.push({ points, minX: minX - buffer, maxX: maxX + buffer, minY: minY - buffer, maxY: maxY + buffer });
    reachMinX = Math.min(reachMinX, minX - buffer);
    reachMaxX = Math.max(reachMaxX, maxX + buffer);
    reachMinY = Math.min(reachMinY, minY - buffer);
    reachMaxY = Math.max(reachMaxY, maxY + buffer);
  });
  if (claimed.length === 0) return candidates;

  const bufferSq = buffer * buffer;
  const kept = new Set<number>();
  candidates.forEach((index) => {
    const centroid = geometry.centroids[index];
    if (!centroid) return;
    const [px, py] = centroid;
    if (px < reachMinX || px > reachMaxX || py < reachMinY || py > reachMaxY) {
      kept.add(index);
      return;
    }
    for (const triangle of claimed) {
      if (px < triangle.minX || px > triangle.maxX || py < triangle.minY || py > triangle.maxY) continue;
      if (pointToTriangleDistanceSq(px, py, triangle.points) <= bufferSq) return;
    }
    kept.add(index);
  });
  return kept;
}

export function lightCenterFromCentroids(
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

export function lightOutline(
  maskData: LaurusMaskResult,
  light: LaurusLight,
): { cx: number; cy: number; radius: number; shape: string } {
  if (light.radius > 0) return { cx: light.cx, cy: light.cy, radius: light.radius, shape: light.shape };
  const held = new Set(polygonIndicesForLight(maskData.polygons, light.id));
  const center = lightCenterFromCentroids(maskGeometry(maskData).centroids, held);
  return {
    cx: center?.[0] ?? light.cx,
    cy: center?.[1] ?? light.cy,
    radius: light.size / 2,
    shape: light.shape,
  };
}

export function lightsStrippedBy(
  polygons: LaurusPolygonPath[] | undefined,
  lights: LaurusLight[],
  taken: Set<number>,
): LaurusLight[] {
  if (!polygons || taken.size === 0) return [];
  const held = new Map<number, { total: number; lost: number }>();
  polygons.forEach((polygon, index) => {
    const lightId = polygon.light_id;
    if (!lightId) return;
    const entry = held.get(lightId) ?? { total: 0, lost: 0 };
    entry.total += 1;
    if (taken.has(index)) entry.lost += 1;
    held.set(lightId, entry);
  });
  return lights.filter((light) => {
    const entry = held.get(light.id);
    return entry !== undefined && entry.total > 0 && entry.lost === entry.total;
  });
}

export function objectOutline(
  maskData: LaurusMaskResult,
  object: LaurusObject,
): { cx: number; cy: number; radius: number; shape: string } {
  if (object.radius > 0) return { cx: object.cx, cy: object.cy, radius: object.radius, shape: object.shape };
  const centroids = maskGeometry(maskData).centroids;
  const members: [number, number][] = [];
  for (const index of polygonIndicesForObject(maskData.polygons, object.id)) {
    const centroid = centroids[index];
    if (centroid && !Number.isNaN(centroid[0]) && !Number.isNaN(centroid[1])) members.push(centroid);
  }
  if (members.length === 0) return { cx: object.cx, cy: object.cy, radius: object.radius, shape: object.shape };
  const [cx, cy] = centroidOf(members);
  return { cx, cy, radius: Math.max(...members.map(([x, y]) => Math.hypot(x - cx, y - cy))), shape: object.shape };
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

export function litRegionCircle(
  polygons: LaurusPolygonPath[],
  centroids: [number, number][],
  lightId: number,
): { cx: number; cy: number; radius: number } | undefined {
  const members: [number, number][] = [];
  polygons.forEach((p, i) => {
    if (p.light_id !== lightId) return;
    const centroid = centroids[i];
    if (centroid && !Number.isNaN(centroid[0]) && !Number.isNaN(centroid[1])) members.push(centroid);
  });
  if (members.length === 0) return undefined;
  const [cx, cy] = centroidOf(members);
  const radius = Math.max(...members.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { cx, cy, radius };
}

export function lightIdAtPoint(
  polygons: LaurusPolygonPath[],
  points: [number, number][][],
  objects: ObjectGeometryInput[],
  point: [number, number],
): number | undefined {
  const [px, py] = point;
  const swell = meshSwell(objects);
  const orderedLightIds: number[] = [];
  const boundsByLight = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>();
  polygons.forEach((p, i) => {
    if (p.light_id === 0) return;
    const triangle = points[i];
    if (!triangle || triangle.length === 0) return;
    let bounds = boundsByLight.get(p.light_id);
    if (!bounds) {
      orderedLightIds.push(p.light_id);
      bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      boundsByLight.set(p.light_id, bounds);
    }
    for (const corner of triangle) {
      const [x, y] = swelled(swell, corner);
      if (x < bounds.minX) bounds.minX = x;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (y > bounds.maxY) bounds.maxY = y;
    }
  });
  for (const lightId of orderedLightIds) {
    const bounds = boundsByLight.get(lightId);
    if (!bounds) continue;
    if (px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY) {
      return lightId;
    }
  }
  return undefined;
}

export function objectIdAtPoint(objects: LaurusObject[], point: [number, number]): number | undefined {
  let bestId: number | undefined;
  let bestReach = Infinity;
  for (const object of objects) {
    const shape = object.shape ? cachedObjectShape(object.shape) : undefined;
    const geometry = { cx: object.cx, cy: object.cy, radius: object.radius, elevation: 0, falloff: 0, shape };
    if (objectProfileUAt(geometry, point) >= 1) continue;
    const reach = object.radius * (shape?.maxExtent ?? 1);
    if (reach >= bestReach) continue;
    bestId = object.id;
    bestReach = reach;
  }
  return bestId;
}
