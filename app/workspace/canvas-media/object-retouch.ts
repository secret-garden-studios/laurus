import { insideRings, polygonArea2, type Point, type ShapeOutline } from "./object-clip.ts";
import type { LaurusPolygonPath } from "../workspace.server";

const EPSILON = 1e-6;
const MIN_CHAIN_STEP_FRACTION = 0.1;
const MIN_FRAGMENT_FRACTION = 1e-3;
const MIN_FRAGMENT_AREA = 1e-2;

function samepoint(a: Point, b: Point): boolean {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;
}

function centroidOf(points: Point[]): Point {
  return [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length,
  ];
}

type Box = [number, number, number, number];

function bounds(points: Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function overlaps(a: Box, b: Box): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

function diameter(points: Point[]): number {
  const [minX, minY, maxX, maxY] = bounds(points);
  return Math.max(maxX - minX, maxY - minY);
}

export function clipSegmentToConvex(a: Point, b: Point, convex: Point[]): [number, number] | undefined {
  const oriented = polygonArea2(convex) < 0 ? [...convex].reverse() : convex;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let enter = 0;
  let exit = 1;

  for (let i = 0; i < oriented.length; i++) {
    const from = oriented[i];
    const to = oriented[(i + 1) % oriented.length];
    const nx = -(to[1] - from[1]);
    const ny = to[0] - from[0];
    const distance = nx * (a[0] - from[0]) + ny * (a[1] - from[1]);
    const rate = nx * dx + ny * dy;

    if (Math.abs(rate) < EPSILON) {
      if (distance < 0) return undefined;
      continue;
    }
    const t = -distance / rate;
    if (rate > 0) {
      if (t > enter) enter = t;
    } else if (t < exit) {
      exit = t;
    }
    if (enter > exit) return undefined;
  }
  return [enter, exit];
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function thinChain(chain: Point[], step: number): Point[] {
  if (chain.length <= 2) return chain;
  const out: Point[] = [chain[0]];
  for (let i = 1; i < chain.length - 1; i++) {
    const last = out[out.length - 1];
    const dx = chain[i][0] - last[0];
    const dy = chain[i][1] - last[1];
    if (dx * dx + dy * dy >= step * step) out.push(chain[i]);
  }
  const end = chain[chain.length - 1];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.hypot(end[0] - last[0], end[1] - last[1]) < step) out.pop();
  out.push(end);
  return out;
}

export function outlineChains(convex: Point[], rings: Point[][]): Point[][] | undefined {
  const chains: Point[][] = [];
  const step = diameter(convex) * MIN_CHAIN_STEP_FRACTION;

  for (const ring of rings) {
    const found: Point[][] = [];
    let current: Point[] | undefined;
    let startedAtSeam = false;
    let endedAtSeam = false;

    for (let i = 0; i < ring.length; i++) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      const range = clipSegmentToConvex(from, to, convex);
      if (!range) {
        current = undefined;
        continue;
      }
      const [enter, exit] = range;
      const at = lerp(from, to, enter);
      const leaves = lerp(from, to, exit);

      if (current && samepoint(current[current.length - 1], at)) {
        current.push(leaves);
      } else {
        current = [at, leaves];
        found.push(current);
        if (i === 0 && enter < EPSILON) startedAtSeam = true;
      }
      endedAtSeam = i === ring.length - 1 && exit > 1 - EPSILON;
      if (exit < 1 - EPSILON) current = undefined;
    }

    if (startedAtSeam && endedAtSeam && found.length > 1) {
      const first = found.shift()!;
      found[found.length - 1].push(...first.slice(1));
    }

    if (found.length === 1 && samepoint(found[0][0], found[0][found[0].length - 1])) return undefined;
    chains.push(...found);
  }

  return chains.map((chain) => thinChain(chain, step)).filter((chain) => chain.length >= 2);
}

export function boundaryParam(polygon: Point[], point: Point): number | undefined {
  let best: number | undefined;
  let bestDistance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const from = polygon[i];
    const to = polygon[(i + 1) % polygon.length];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < EPSILON * EPSILON) continue;
    const t = Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSq));
    const distance = Math.hypot(point[0] - (from[0] + dx * t), point[1] - (from[1] + dy * t));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i + t;
    }
  }
  return bestDistance < 1e-4 ? best : undefined;
}

function verticesBetween(polygon: Point[], from: number, to: number): Point[] {
  const count = polygon.length;
  const ahead = (param: number): number => (((param - from) % count) + count) % count;
  const span = ahead(to);
  return polygon
    .map((point, index) => ({ point, at: ahead(index) }))
    .filter(({ at }) => at > EPSILON && at < span - EPSILON)
    .sort((a, b) => a.at - b.at)
    .map(({ point }) => point);
}

export function splitCell(cell: Point[], chain: Point[]): [Point[], Point[]] | undefined {
  const head = chain[0];
  const tail = chain[chain.length - 1];
  const from = boundaryParam(cell, head);
  const to = boundaryParam(cell, tail);
  if (from === undefined || to === undefined) return undefined;
  if (Math.abs(from - to) < EPSILON) return undefined;

  const interior = chain.slice(1, -1);
  const forward = [head, ...verticesBetween(cell, from, to), tail, ...interior.slice().reverse()];
  const backward = [tail, ...verticesBetween(cell, to, from), head, ...interior];
  if (forward.length < 3 || backward.length < 3) return undefined;
  return [forward, backward];
}

function insideConvex(convex: Point[], point: Point): boolean {
  let sign = 0;
  for (let i = 0; i < convex.length; i++) {
    const from = convex[i];
    const to = convex[(i + 1) % convex.length];
    const cross = (to[0] - from[0]) * (point[1] - from[1]) - (to[1] - from[1]) * (point[0] - from[0]);
    if (Math.abs(cross) < EPSILON) continue;
    const at = cross > 0 ? 1 : -1;
    if (sign === 0) sign = at;
    else if (sign !== at) return false;
  }
  return true;
}

export function earClip(polygon: Point[]): Point[][] {
  const points = polygon.slice();
  if (polygonArea2(points) < 0) points.reverse();

  const triangles: Point[][] = [];
  let guard = points.length * points.length;
  while (points.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length];
      const at = points[i];
      const next = points[(i + 1) % points.length];
      const cross = (at[0] - previous[0]) * (next[1] - at[1]) - (at[1] - previous[1]) * (next[0] - at[0]);
      if (cross <= EPSILON) continue;

      const ear = [previous, at, next];
      const contains = points.some(
        (other, j) =>
          j !== i &&
          j !== (i + points.length - 1) % points.length &&
          j !== (i + 1) % points.length &&
          insideConvex(ear, other),
      );
      if (contains) continue;

      triangles.push(ear);
      points.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (points.length === 3) triangles.push(points);
  else if (points.length > 3) {
    const middle = centroidOf(points);
    for (let i = 0; i < points.length; i++) triangles.push([middle, points[i], points[(i + 1) % points.length]]);
  }
  return triangles;
}

export interface RetouchedTriangle {
  points: Point[];
  inside: boolean;
}

export function retouchTriangle(triangle: Point[], outline: ShapeOutline): RetouchedTriangle[] | undefined {
  const chains = outlineChains(triangle, outline.all);
  if (!chains || chains.length === 0) return undefined;

  let cells = [triangle];
  for (const chain of chains) {
    const probe = chain.length > 2 ? chain[1] : centroidOf([chain[0], chain[chain.length - 1]]);
    const candidates = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => boundaryParam(cell, chain[0]) !== undefined)
      .filter(({ cell }) => boundaryParam(cell, chain[chain.length - 1]) !== undefined);
    const target = candidates.find(({ cell }) => insideRings([cell], probe)) ?? candidates[0];
    if (!target) continue;
    const split = splitCell(target.cell, chain);
    if (!split) continue;
    cells = [...cells.slice(0, target.index), ...split, ...cells.slice(target.index + 1)];
  }
  if (cells.length < 2) return undefined;

  const floor = Math.max(Math.abs(polygonArea2(triangle)) * MIN_FRAGMENT_FRACTION, MIN_FRAGMENT_AREA);
  const out: RetouchedTriangle[] = [];
  for (const cell of cells) {
    if (Math.abs(polygonArea2(cell)) <= floor) continue;
    for (const fragment of earClip(cell)) {
      if (Math.abs(polygonArea2(fragment)) <= floor) continue;
      out.push({ points: fragment, inside: insideRings(outline.all, centroidOf(fragment)) });
    }
  }
  return out.length > 1 ? out : undefined;
}

function toPathData(points: Point[]): string {
  const at = (p: Point): string => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  return `M ${at(points[0])} ${points
    .slice(1)
    .map((p) => `L ${at(p)}`)
    .join(" ")} Z`;
}

export interface RetouchResult {
  polygons: LaurusPolygonPath[];
  indices: Set<number>;
  added: number;
}

export function retouchMesh(polygons: LaurusPolygonPath[], points: Point[][], outline: ShapeOutline): RetouchResult {
  const next = polygons.slice();
  const indices = new Set<number>();
  let added = 0;

  const outlineBox = bounds(outline.all.flat());

  polygons.forEach((polygon, index) => {
    const triangle = points[index];
    if (!triangle || triangle.length !== 3) return;
    if (!overlaps(bounds(triangle), outlineBox)) return;

    const fragments = retouchTriangle(triangle, outline);
    if (!fragments) {
      if (insideRings(outline.all, centroidOf(triangle))) indices.add(index);
      return;
    }

    fragments.forEach((fragment, at) => {
      const cut: LaurusPolygonPath = { ...polygon, d: toPathData(fragment.points) };
      let slot: number;
      if (at === 0) {
        slot = index;
        next[slot] = cut;
      } else {
        slot = next.length;
        next.push(cut);
        added++;
      }
      if (fragment.inside) indices.add(slot);
    });
  });

  return { polygons: next, indices, added };
}

export function retouchDelta(retouch: { polygons: LaurusPolygonPath[]; restore: LaurusPolygonPath[]; added: number }): {
  replaced: { index: number; d: string }[];
  added: LaurusPolygonPath[];
} {
  const kept = retouch.polygons.length - retouch.added;
  const replaced: { index: number; d: string }[] = [];
  for (let index = 0; index < kept; index++) {
    if (retouch.polygons[index] !== retouch.restore[index]) {
      replaced.push({ index, d: retouch.polygons[index].d });
    }
  }
  return { replaced, added: retouch.polygons.slice(kept) };
}
