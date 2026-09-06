import { CURVE_SEGMENTS, flattenPathData, formatPathNumber, simplifyRing } from "./object-shape.ts";
import { insideRings } from "./object-clip.ts";

export const FITTED_MAX_ANCHORS = 24;
export const EDITABLE_MAX_ANCHORS = 240;
const SIMPLIFY_START_FRACTION = 0.006;
const SIMPLIFY_GROWTH = 1.3;
const MAX_SIMPLIFY_PASSES = 24;
const CENTRIPETAL_ALPHA = 0.5;

export type Point = [number, number];

export interface CubicAnchor {
  point: Point;
  inControl: Point;
  outControl: Point;
}

export type CubicRing = CubicAnchor[];

function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function near(a: Point, b: Point, epsilon = 1e-6): boolean {
  return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;
}

export function parseCubicRings(d: string): CubicRing[] | undefined {
  const rings: CubicRing[] = [];
  let current: CubicRing = [];
  let start: Point | undefined;

  const tokens = d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!tokens) return undefined;

  let i = 0;
  const number = (): number | undefined => {
    const value = tokens[i];
    if (value === undefined || /[MLCZmlcz]/.test(value)) return undefined;
    i++;
    return parseFloat(value);
  };
  const point = (): Point | undefined => {
    const x = number();
    const y = number();
    return x === undefined || y === undefined ? undefined : [x, y];
  };

  const closeRing = (): void => {
    if (current.length < 2 || !start) {
      current = [];
      return;
    }
    const last = current[current.length - 1];
    if (near(last.point, start)) {
      current[0].inControl = last.inControl;
      current.pop();
    }
    if (current.length >= 2) rings.push(current);
    current = [];
  };

  while (i < tokens.length) {
    const command = tokens[i];
    if (!/[MLCZmlcz]/.test(command)) return undefined;
    i++;

    if (command === "Z" || command === "z") {
      closeRing();
      start = undefined;
      continue;
    }
    if (command === "M" || command === "m") {
      closeRing();
      const moved = point();
      if (!moved) return undefined;
      start = moved;
      current = [{ point: moved, inControl: moved, outControl: moved }];
      continue;
    }
    if (current.length === 0) return undefined;
    const from = current[current.length - 1];

    if (command === "L" || command === "l") {
      const end = point();
      if (!end) return undefined;
      from.outControl = lerp(from.point, end, 1 / 3);
      current.push({ point: end, inControl: lerp(from.point, end, 2 / 3), outControl: end });
    } else {
      const control1 = point();
      const control2 = point();
      const end = point();
      if (!control1 || !control2 || !end) return undefined;
      from.outControl = control1;
      current.push({ point: end, inControl: control2, outControl: end });
    }
  }
  closeRing();
  return rings.length > 0 ? rings : undefined;
}

export function cubicRingsToPathData(rings: CubicRing[]): string {
  const pair = (p: Point): string => `${formatPathNumber(p[0])},${formatPathNumber(p[1])}`;
  return rings
    .filter((ring) => ring.length >= 2)
    .map((ring) => {
      const body = [`M${pair(ring[0].point)}`];
      for (let i = 0; i < ring.length; i++) {
        const from = ring[i];
        const to = ring[(i + 1) % ring.length];
        body.push(`C${pair(from.outControl)} ${pair(to.inControl)} ${pair(to.point)}`);
      }
      return body.join("") + "Z";
    })
    .join("");
}

const CIRCLE_KAPPA = (4 / 3) * (Math.SQRT2 - 1);

const CIRCLE_BOW = (() => {
  const k = CIRCLE_KAPPA;
  const raw: CubicRing = [
    { point: [1, 0], inControl: [1, -k], outControl: [1, k] },
    { point: [0, 1], inControl: [k, 1], outControl: [-k, 1] },
    { point: [-1, 0], inControl: [-1, k], outControl: [-1, -k] },
    { point: [0, -1], inControl: [-k, -1], outControl: [k, -1] },
  ];
  return Math.max(...flattenCubicRing(raw).map((p) => Math.hypot(p[0], p[1])));
})();

export function unitCircleRing(): CubicRing {
  const r = 1 / CIRCLE_BOW;
  const k = CIRCLE_KAPPA * r;
  return [
    { point: [r, 0], inControl: [r, -k], outControl: [r, k] },
    { point: [0, r], inControl: [k, r], outControl: [-k, r] },
    { point: [-r, 0], inControl: [-r, k], outControl: [-r, -k] },
    { point: [0, -r], inControl: [-k, -r], outControl: [k, -r] },
  ];
}

export function unitCirclePath(): string {
  return cubicRingsToPathData([unitCircleRing()]);
}

export function fitCubicRing(anchors: Point[], alpha = CENTRIPETAL_ALPHA): CubicRing {
  const count = anchors.length;
  const spacing = anchors.map((point, i) => {
    const next = anchors[(i + 1) % count];
    return Math.max(Math.hypot(next[0] - point[0], next[1] - point[1]), 1e-12) ** alpha;
  });

  const ring: CubicRing = anchors.map((point) => ({ point, inControl: point, outControl: point }));
  for (let i = 0; i < count; i++) {
    const p0 = anchors[(i - 1 + count) % count];
    const p1 = anchors[i];
    const p2 = anchors[(i + 1) % count];
    const p3 = anchors[(i + 2) % count];
    const d0 = spacing[(i - 1 + count) % count];
    const d1 = spacing[i];
    const d2 = spacing[(i + 1) % count];

    const tangent = (a: Point, b: Point, c: Point, first: number, second: number): Point => [
      (b[0] - a[0]) / first - (c[0] - a[0]) / (first + second) + (c[0] - b[0]) / second,
      (b[1] - a[1]) / first - (c[1] - a[1]) / (first + second) + (c[1] - b[1]) / second,
    ];
    const m1 = tangent(p0, p1, p2, d0, d1);
    const m2 = tangent(p1, p2, p3, d1, d2);

    ring[i].outControl = add(p1, [(m1[0] * d1) / 3, (m1[1] * d1) / 3]);
    ring[(i + 1) % count].inControl = add(p2, [(-m2[0] * d1) / 3, (-m2[1] * d1) / 3]);
  }
  return ring;
}

export function anchorsForRing(ring: Point[], maxAnchors = FITTED_MAX_ANCHORS): Point[] {
  let tolerance = SIMPLIFY_START_FRACTION;
  let anchors = simplifyRing(ring, tolerance);
  for (let pass = 0; pass < MAX_SIMPLIFY_PASSES && anchors.length > maxAnchors; pass++) {
    tolerance *= SIMPLIFY_GROWTH;
    anchors = simplifyRing(ring, tolerance);
  }
  return anchors;
}

function authoredAsCurves(d: string): boolean {
  return /[Cc]/.test(d);
}

export function editableRings(path: string, maxAnchors = EDITABLE_MAX_ANCHORS): CubicRing[] {
  const parsed = parseCubicRings(path);
  const cap = authoredAsCurves(path) ? maxAnchors : FITTED_MAX_ANCHORS;
  if (parsed && parsed.every((ring) => ring.length <= cap)) return parsed;
  return flattenPathData(path)
    .map((ring) => anchorsForRing(ring, FITTED_MAX_ANCHORS))
    .filter((anchors) => anchors.length >= 3)
    .map((anchors) => fitCubicRing(anchors));
}

export function cubicPointAt(from: CubicAnchor, to: CubicAnchor, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * from.point[0] + b * from.outControl[0] + c * to.inControl[0] + d * to.point[0],
    a * from.point[1] + b * from.outControl[1] + c * to.inControl[1] + d * to.point[1],
  ];
}

export function flattenCubicRing(ring: CubicRing, segments = CURVE_SEGMENTS): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const from = ring[i];
    const to = ring[(i + 1) % ring.length];
    for (let step = 0; step < segments; step++) points.push(cubicPointAt(from, to, step / segments));
  }
  return points;
}

export function normalizeEditedRings(
  rings: CubicRing[],
  object: { cx: number; cy: number; radius: number },
): { path: string; cx: number; cy: number; radius: number } | undefined {
  const flat = rings.flatMap((ring) => flattenCubicRing(ring));
  if (flat.length === 0) return undefined;

  const xs = flat.map((p) => p[0]);
  const ys = flat.map((p) => p[1]);
  const center: Point = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const scale = Math.max(...flat.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1])));
  if (!(scale > 0)) return undefined;

  const put = (p: Point): Point => [(p[0] - center[0]) / scale, (p[1] - center[1]) / scale];
  const moved = rings.map((ring) =>
    ring.map((anchor) => ({
      point: put(anchor.point),
      inControl: put(anchor.inControl),
      outControl: put(anchor.outControl),
    })),
  );

  return {
    path: cubicRingsToPathData(moved),
    cx: object.cx + center[0] * object.radius,
    cy: object.cy + center[1] * object.radius,
    radius: object.radius * scale,
  };
}

export function moveAnchor(ring: CubicRing, index: number, to: Point): CubicRing {
  return ring.map((anchor, i) => {
    if (i !== index) return anchor;
    const shift: Point = [to[0] - anchor.point[0], to[1] - anchor.point[1]];
    return {
      point: to,
      inControl: add(anchor.inControl, shift),
      outControl: add(anchor.outControl, shift),
    };
  });
}

export function moveControl(
  ring: CubicRing,
  index: number,
  side: "in" | "out",
  to: Point,
  breakSymmetry = false,
): CubicRing {
  return ring.map((anchor, i) => {
    if (i !== index) return anchor;
    const moved = side === "in" ? { ...anchor, inControl: to } : { ...anchor, outControl: to };
    if (breakSymmetry) return moved;

    const opposite: Point = [2 * anchor.point[0] - to[0], 2 * anchor.point[1] - to[1]];
    return side === "in" ? { ...moved, outControl: opposite } : { ...moved, inControl: opposite };
  });
}

export interface RingPlace {
  ring: number;
  segment: number;
  t: number;
  point: Point;
  distance: number;
}

const NEAREST_REFINE_PASSES = 24;
const NEAREST_REFINE_EPSILON = 1e-9;

export function nearestOnRings(rings: CubicRing[], at: Point, segments = CURVE_SEGMENTS): RingPlace | undefined {
  let best: RingPlace | undefined;

  rings.forEach((ring, ringIndex) => {
    if (ring.length < 2) return;
    for (let i = 0; i < ring.length; i++) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      const away = (t: number): number => {
        const p = cubicPointAt(from, to, t);
        return Math.hypot(p[0] - at[0], p[1] - at[1]);
      };

      let coarseT = 0;
      let coarse = Infinity;
      for (let step = 0; step <= segments; step++) {
        const t = step / segments;
        const d = away(t);
        if (d < coarse) {
          coarse = d;
          coarseT = t;
        }
      }

      let lo = Math.max(0, coarseT - 1 / segments);
      let hi = Math.min(1, coarseT + 1 / segments);
      for (let pass = 0; pass < NEAREST_REFINE_PASSES && hi - lo > NEAREST_REFINE_EPSILON; pass++) {
        const third = (hi - lo) / 3;
        if (away(lo + third) <= away(hi - third)) hi -= third;
        else lo += third;
      }

      const refinedT = (lo + hi) / 2;
      const refined = away(refinedT);
      const t = refined <= coarse ? refinedT : coarseT;
      const distance = Math.min(refined, coarse);
      if (!best || distance < best.distance) {
        best = { ring: ringIndex, segment: i, t, point: cubicPointAt(from, to, t), distance };
      }
    }
  });

  return best;
}

const MIN_SPLIT_T = 1e-3;

export function insertAnchor(
  rings: CubicRing[],
  ringIndex: number,
  segment: number,
  t: number,
  maxAnchors = EDITABLE_MAX_ANCHORS,
): CubicRing[] | undefined {
  const ring = rings[ringIndex];
  if (!ring || ring.length < 2) return undefined;
  if (ring.length >= maxAnchors) return undefined;
  if (!Number.isInteger(segment) || segment < 0 || segment >= ring.length) return undefined;
  if (!Number.isFinite(t)) return undefined;

  const at = Math.min(1 - MIN_SPLIT_T, Math.max(MIN_SPLIT_T, t));
  const from = ring[segment];
  const after = (segment + 1) % ring.length;
  const to = ring[after];

  const a = lerp(from.point, from.outControl, at);
  const b = lerp(from.outControl, to.inControl, at);
  const c = lerp(to.inControl, to.point, at);
  const leaving = lerp(a, b, at);
  const arriving = lerp(b, c, at);
  const point = lerp(leaving, arriving, at);

  const next = ring.slice();
  next[segment] = { ...from, outControl: a };
  next[after] = { ...to, inControl: c };
  next.splice(segment + 1, 0, { point, inControl: leaving, outControl: arriving });

  return rings.map((other, index) => (index === ringIndex ? next : other));
}

function betweenRun(count: number, a: number, b: number): { to: number; between: number[] } {
  const forward = ((b - a + count) % count) - 1;
  const backward = ((a - b + count) % count) - 1;
  const [from, to] = forward <= backward ? [a, b] : [b, a];
  const span = ((to - from + count) % count) - 1;
  const between: number[] = [];
  for (let step = 1; step <= span; step++) between.push((from + step) % count);
  return { to, between };
}

function closedStraight(anchors: CubicAnchor[]): CubicRing {
  const ring = anchors.map((anchor) => ({ ...anchor }));
  const last = ring[ring.length - 1];
  const first = ring[0];
  last.outControl = lerp(last.point, first.point, 1 / 3);
  first.inControl = lerp(last.point, first.point, 2 / 3);
  return ring;
}

export function stitchRing(rings: CubicRing[], ringIndex: number, a: number, b: number): CubicRing[] | undefined {
  const ring = rings[ringIndex];
  if (!ring || ring.length < 2) return undefined;
  const count = ring.length;
  if (a === b || a < 0 || b < 0 || a >= count || b >= count) return undefined;

  const { to, between } = betweenRun(count, a, b);
  const dropped = new Set(between);

  const kept: CubicAnchor[] = [];
  for (let step = 0; step < count; step++) {
    const at = (to + step) % count;
    if (!dropped.has(at)) kept.push(ring[at]);
  }
  if (kept.length < 2) return undefined;

  const next = rings.map((other, index) => (index === ringIndex ? closedStraight(kept) : other));
  if (between.length >= 2) next.push(closedStraight(between.map((at) => ring[at])));
  return next;
}

export interface RingPieces {
  depth: number[];
  pieces: number[][];
}

export function ringPieces(flat: Point[][]): RingPieces {
  const containedBy = flat.map((ring, i) =>
    flat.map((other, j) => j !== i && ring.length > 0 && insideRings([other], ring[0])),
  );
  const depth = containedBy.map((row) => row.filter(Boolean).length);

  const rootOf = (start: number): number => {
    let at = start;
    for (let step = 0; step < flat.length && depth[at] > 0; step++) {
      const parent = containedBy[at].findIndex((encloses, j) => encloses && depth[j] === depth[at] - 1);
      if (parent < 0) break;
      at = parent;
    }
    return at;
  };

  const pieces: number[][] = [];
  const pieceOfRoot = new Map<number, number>();
  flat.forEach((_, i) => {
    const root = rootOf(i);
    let piece = pieceOfRoot.get(root);
    if (piece === undefined) {
      piece = pieces.length;
      pieceOfRoot.set(root, piece);
      pieces.push([]);
    }
    pieces[piece].push(i);
  });

  for (const piece of pieces) piece.sort((x, y) => depth[x] - depth[y]);

  return { depth, pieces };
}
