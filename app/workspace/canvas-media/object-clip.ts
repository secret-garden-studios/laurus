import { flattenPathData } from "./object-shape.ts";

export type Point = [number, number];

const MIN_FRAGMENT_FRACTION = 1e-3;

export function polygonArea2(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function clipToHalfPlane(subject: Point[], from: Point, to: Point): Point[] {
  const side = (p: Point): number => (to[0] - from[0]) * (p[1] - from[1]) - (to[1] - from[1]) * (p[0] - from[0]);
  const out: Point[] = [];
  for (let i = 0; i < subject.length; i++) {
    const current = subject[i];
    const previous = subject[(i + subject.length - 1) % subject.length];
    const currentSide = side(current);
    const previousSide = side(previous);

    if (currentSide >= 0) {
      if (previousSide < 0) {
        const t = previousSide / (previousSide - currentSide);
        out.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t]);
      }
      out.push(current);
    } else if (previousSide >= 0) {
      const t = previousSide / (previousSide - currentSide);
      out.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t]);
    }
  }
  return out;
}

export function clipToConvex(subject: Point[], clip: Point[]): Point[] {
  const oriented = polygonArea2(clip) < 0 ? [...clip].reverse() : clip;
  let result = subject;
  for (let i = 0; i < oriented.length && result.length > 0; i++) {
    result = clipToHalfPlane(result, oriented[i], oriented[(i + 1) % oriented.length]);
  }
  return result;
}

function centroid(points: Point[]): Point {
  return [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length,
  ];
}

function fan(points: Point[]): Point[][] {
  if (points.length < 3) return [];
  if (points.length === 3) return [points];
  const middle = centroid(points);
  const out: Point[][] = [];
  for (let i = 0; i < points.length; i++) {
    out.push([middle, points[i], points[(i + 1) % points.length]]);
  }
  return out;
}

function windingCrossings(rings: Point[][], p: Point): number {
  let crossings = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % ring.length];
      if (y0 <= p[1] === y1 <= p[1]) continue;
      const x = x0 + ((p[1] - y0) / (y1 - y0)) * (x1 - x0);
      if (x > p[0]) crossings++;
    }
  }
  return crossings;
}

export function insideRings(rings: Point[][], p: Point): boolean {
  return windingCrossings(rings, p) % 2 === 1;
}

function boundingBox(points: Point[]): [number, number, number, number] {
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

function overlaps(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

export interface ShapeOutline {
  outer: Point[];
  holes: Point[][];
  all: Point[][];
}

export function shapeOutline(
  path: string,
  object: { cx: number; cy: number; radius: number },
): ShapeOutline | undefined {
  const rings = flattenPathData(path)
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.map(([x, y]): Point => [object.cx + x * object.radius, object.cy + y * object.radius]));
  if (rings.length === 0) return undefined;

  let outerAt = 0;
  for (let i = 1; i < rings.length; i++) {
    if (Math.abs(polygonArea2(rings[i])) > Math.abs(polygonArea2(rings[outerAt]))) outerAt = i;
  }
  return {
    outer: rings[outerAt],
    holes: rings.filter((_, i) => i !== outerAt),
    all: rings,
  };
}

export type ClipVerdict = { kind: "keep" } | { kind: "drop" } | { kind: "cut"; triangles: Point[][] };

export function clipTriangle(triangle: Point[], outline: ShapeOutline): ClipVerdict {
  const box = boundingBox(triangle);

  if (outline.holes.some((hole) => overlaps(box, boundingBox(hole)))) {
    const touchesHole = outline.holes.some(
      (hole) =>
        hole.some((point) => insideRings([triangle], point)) || triangle.some((point) => insideRings([hole], point)),
    );
    if (touchesHole) return { kind: "drop" };
  }

  if (!overlaps(box, boundingBox(outline.outer))) return { kind: "drop" };

  const clipped = clipToConvex(outline.outer, triangle);
  if (clipped.length < 3) return { kind: "drop" };

  const whole = Math.abs(polygonArea2(triangle));
  const kept = Math.abs(polygonArea2(clipped));
  if (kept <= whole * MIN_FRAGMENT_FRACTION) return { kind: "drop" };
  if (kept >= whole * (1 - MIN_FRAGMENT_FRACTION)) return { kind: "keep" };

  return { kind: "cut", triangles: fan(clipped) };
}
