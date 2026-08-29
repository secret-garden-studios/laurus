import { MASK_OBJECT_COLLISION_BUFFER_PX, activeMaskObjects, objectProfileUAt, objectSwellAt } from "../mask-gl.ts";
import type { ObjectGeometryInput } from "../mask-gl.ts";
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

function maxSwellReach(object: ObjectGeometryInput): number {
  // maxExtent is 1 for every shape the normalization produced, so this is
  // almost always just the radius -- read rather than assumed so a shape
  // normalized some other way still reports its true reach.
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

/**
 * `tile` is the shape editor's, for the same reason cachedObjectShape takes one:
 * a drag mints a new path every frame, so asking at full resolution is a ~58ms
 * rebuild per frame. Passing the draft tile a live gesture is already
 * rasterizing at makes this share that build rather than starting its own.
 */
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

/** Zero when the point is inside the triangle, else the distance to its rim. */
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

/**
 * Drop the candidates that run into an object already on the mesh.
 *
 * A triangle belongs to exactly one object -- `object_id` is a single field --
 * so two overlapping outlines are not two claims on a triangle, they are the
 * second one silently taking it from the first. Raising an object over a
 * neighbour therefore used to hollow the neighbour out: its own triangles were
 * retagged out from under it, and its fill and highlight went with them.
 *
 * The object already there wins, because it is the one somebody has already
 * placed and reviewed; the new one gives up whatever it cannot have. That is a
 * subtraction from the newcomer's membership only -- nothing about the older
 * object changes, and no triangle is left tagged to something that no longer
 * covers it.
 *
 * `buffer` widens each existing claim by that many mesh pixels before the
 * subtraction, so the two objects end up separated by a lane of unclaimed mesh
 * rather than flush against each other. It is measured to the nearest point of
 * a claimed triangle rather than between centroids, which is what lets zero
 * mean "only drop the actual overlap" instead of "drop nothing".
 *
 * `objectId` exempts one object's own triangles -- pass it when recomputing
 * membership for an object that already exists, so it does not collide with
 * itself and shrink a little on every edit.
 */
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

/**
 * Which object a point lands in, preferring the smallest when several overlap
 * -- so an object nested inside a larger one stays clickable rather than being
 * shadowed by whatever encloses it.
 *
 * "Smallest" is the object's whole extent rather than its outline distance in
 * the point's own direction, which is what this measured while a shape was one
 * radius per direction. A shape is no longer obliged to have such a distance,
 * and total extent ranks the same way for the nesting case this exists for.
 */
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
