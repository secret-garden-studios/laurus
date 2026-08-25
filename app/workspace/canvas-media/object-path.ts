/**
 * Object shapes as editable cubic rings.
 *
 * object-shape.ts reads a path the way the renderer needs it -- flattened to
 * points, then rasterized into a distance field -- which throws away exactly
 * what a pen has to grab hold of. This is the other reading: the same path as
 * anchors with their control points still attached, so dragging one means
 * something.
 *
 * The round trip runs the other way too. Whatever the editor produces goes
 * back out as an M/C/Z path in the same format detection emits and the same
 * format `RedisObject.shape` stores, so an edited shape and a detected one are
 * indistinguishable downstream.
 */

import { CURVE_SEGMENTS, flattenPathData, formatPathNumber, simplifyRing } from "./object-shape.ts";
import { insideRings } from "./object-clip.ts";

/**
 * The most anchors a ring is re-fitted to when the editor opens on it.
 *
 * **Must be at least OBJECT_SHAPE_MAX_ANCHORS in the server's object_math.py.**
 * Anything the server is willing to emit has to open here untouched, or every
 * detected shape gets quietly re-fitted the first time someone looks at it --
 * redrawing an outline nobody asked to change, and making "open the editor and
 * close it again" a destructive act.
 */
export const EDITABLE_MAX_ANCHORS = 24;
const SIMPLIFY_START_FRACTION = 0.006;
const SIMPLIFY_GROWTH = 1.3;
const MAX_SIMPLIFY_PASSES = 24;
/** Centripetal. See fitCubicRing -- the same alpha the server fits with. */
const CENTRIPETAL_ALPHA = 0.5;

export type Point = [number, number];

/**
 * One anchor of a closed cubic ring: the point the curve passes through, and
 * the two control points either side of it -- `inControl` governing the
 * segment arriving at it, `outControl` the segment leaving.
 */
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

/**
 * Read a stored path into editable rings, or undefined if it is not one.
 *
 * `L` is accepted as well as `C` because a shape stored before detection
 * emitted curves is a polyline, and it has to open in the editor like anything
 * else. A straight segment becomes a cubic with its controls at the thirds,
 * which is the same curve -- so reading a polyline and writing it straight
 * back changes its shape not at all.
 */
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
    // the final segment lands back on the first anchor; its trailing control
    // belongs to that anchor, not to a duplicate of it
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

/** Write editable rings back out as the M/C/Z path a shape is stored as. */
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

/**
 * Fit a closed cubic through every anchor, in order.
 *
 * Centripetal Catmull-Rom -- the TypeScript twin of fit_cubic_ring in the
 * server's object_math.py, down to the alpha. Uniform weighting overshoots
 * wherever anchor spacing is uneven, and simplification deliberately makes it
 * uneven; an overshoot at a tight corner is a loop crossing the outline it was
 * fitted to.
 */
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

    // the non-uniform Catmull-Rom tangents at either end of this span
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

/**
 * Thin a flattened ring down to at most `maxAnchors`, coarsening until it
 * fits.
 *
 * This is what lets the editor open on anything. A shape stored before
 * detection emitted curves is a 128-gon; an svg someone uploaded may be
 * thousands of points; a freshly detected one is already about twenty. All
 * three arrive here and leave with a handful of anchors a pen can work.
 */
export function anchorsForRing(ring: Point[], maxAnchors = EDITABLE_MAX_ANCHORS): Point[] {
  let tolerance = SIMPLIFY_START_FRACTION;
  let anchors = simplifyRing(ring, tolerance);
  for (let pass = 0; pass < MAX_SIMPLIFY_PASSES && anchors.length > maxAnchors; pass++) {
    tolerance *= SIMPLIFY_GROWTH;
    anchors = simplifyRing(ring, tolerance);
  }
  return anchors;
}

/**
 * Open a stored path as editable rings, re-fitting when it carries more
 * anchors than a pen can work with.
 *
 * A detected shape already sits within the cap, so it opens with its own
 * anchors and control points untouched -- which matters, because re-fitting a
 * shape merely to look at it would quietly redraw work someone had already
 * approved. Anything larger is flattened and re-fitted.
 */
export function editableRings(path: string, maxAnchors = EDITABLE_MAX_ANCHORS): CubicRing[] {
  const parsed = parseCubicRings(path);
  if (parsed && parsed.every((ring) => ring.length <= maxAnchors)) return parsed;
  return flattenPathData(path)
    .map((ring) => anchorsForRing(ring, maxAnchors))
    .filter((anchors) => anchors.length >= 3)
    .map((anchors) => fitCubicRing(anchors));
}

/**
 * Where the segment leaving `from` and arriving at `to` is, `t` of the way
 * along it.
 *
 * The one place the cubic is evaluated. Flattening, hit-testing the outline
 * and splitting a segment all have to agree about where the curve is, or the
 * anchor a click puts down lands somewhere off the line it was clicked on.
 */
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

/** A cubic ring as points, subdividing each segment the way the renderer does. */
export function flattenCubicRing(ring: CubicRing, segments = CURVE_SEGMENTS): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const from = ring[i];
    const to = ring[(i + 1) % ring.length];
    for (let step = 0; step < segments; step++) points.push(cubicPointAt(from, to, step / segments));
  }
  return points;
}

/**
 * Put edited rings back into the space a shape is stored in, and say what the
 * object's own geometry has to become for the result to sit where it was drawn.
 *
 * This is not bookkeeping -- without it the editor barely works. A stored
 * shape is normalized to unit extent and scaled by `radius` at render time,
 * and buildObjectShapeFromRings re-normalizes whatever it is handed. So
 * dragging an anchor outward and saving the path as-is would have the renderer
 * scale the whole outline back down to unit extent again: the shape would
 * shrink instead of growing, and dragging it would appear to do nothing.
 *
 * Moving the difference into cx/cy/radius is what makes the edit stick. It
 * mirrors renormalize_curves in the server's object_math.py, including
 * measuring the *flattened* curve rather than the anchors -- a curve bows past
 * the points it is fitted through, and the renderer measures the bow.
 */
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

/**
 * Move one anchor's point, carrying its control points with it so the curve
 * translates rather than deforming around a pinned handle.
 */
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

/**
 * Move one control handle. Unless `breakSymmetry`, the opposite handle is
 * mirrored through the anchor so the curve stays smooth across it -- which is
 * what a handle is usually for. Alt-dragging breaks that to make a corner.
 */
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

/**
 * A place on a shape's outline: which ring it is on, which segment of that
 * ring, and how far along that segment.
 *
 * `segment` is the span leaving anchor `segment` and arriving at the next one
 * round, so a ring of n anchors has n of them -- the last closing back onto
 * the first.
 */
export interface RingPlace {
  ring: number;
  segment: number;
  t: number;
  point: Point;
  distance: number;
}

/** How far the ternary search below narrows the bracket before giving up. */
const NEAREST_REFINE_PASSES = 24;
const NEAREST_REFINE_EPSILON = 1e-9;

/**
 * The point on these rings' outlines closest to `at`.
 *
 * A cubic has no closed form for this, so it is found the way the outline is
 * drawn: sample each segment at the same subdivision the renderer uses, take
 * the nearest sample, then narrow in on the span either side of it. The coarse
 * pass is what keeps the search honest -- distance along a cubic is not
 * unimodal, and a search started anywhere else can settle into the wrong dip
 * on a segment that doubles back. The refinement only ever has one dip to find
 * because it never leaves a single drawn step.
 *
 * Distances are in whatever space the rings are given in; the caller decides
 * whether the nearest point is near enough to mean anything.
 */
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

      // the refinement cannot do worse than the sample it started from, but
      // a segment collapsed to a point makes every t equally near, and taking
      // the midpoint of a bracket over one of those is no better than taking
      // the sample -- so keep whichever actually is nearer
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

/**
 * How close to an end of a segment a split is allowed to land.
 *
 * A split at 0 or 1 produces an anchor sitting on top of the one already
 * there, with a segment of no length between them -- an anchor that cannot be
 * seen, cannot be picked apart from its twin, and leaves a degenerate span in
 * the path. Clamping rather than refusing is the kinder reading of a click
 * near an existing anchor: the reviewer still gets an anchor where they asked
 * for one, just not one welded to its neighbour.
 */
const MIN_SPLIT_T = 1e-3;

/**
 * Put a new anchor on a segment, `t` of the way along it, without moving the
 * outline at all.
 *
 * de Casteljau: the same repeated-lerp construction that evaluates a cubic at
 * `t` also hands back, along the way, the control points of the two cubics
 * that trace exactly the two halves of it. So the curve through the new anchor
 * is the curve that was already there, to the last bit -- which is the whole
 * point. Adding an anchor is asking for somewhere to take hold, not for a
 * different shape, and an outline that shifted the moment you gave yourself a
 * handle on it would be worse than no handle.
 *
 * The anchor lands at `segment + 1`, so the ring stays in the order it draws.
 * Returns undefined when there is no segment to split.
 */
export function insertAnchor(
  rings: CubicRing[],
  ringIndex: number,
  segment: number,
  t: number,
): CubicRing[] | undefined {
  const ring = rings[ringIndex];
  if (!ring || ring.length < 2) return undefined;
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

/**
 * The run of anchors lying between two selected ones, and which way round the
 * ring it runs.
 *
 * A ring is a cycle, so two anchors always have two runs between them and
 * "in between" only means something once one is chosen. The shorter run by
 * anchor count is the one taken, which is how anyone picking two anchors a
 * short way apart already reads the word -- nobody clicking two neighbours on
 * a twenty-anchor outline means the eighteen the long way round. Equal counts
 * fall to the run leaving the first-clicked anchor, so the click order still
 * decides the one case the count cannot.
 */
function betweenRun(count: number, a: number, b: number): { to: number; between: number[] } {
  const forward = ((b - a + count) % count) - 1;
  const backward = ((a - b + count) % count) - 1;
  const [from, to] = forward <= backward ? [a, b] : [b, a];
  const span = ((to - from + count) % count) - 1;
  const between: number[] = [];
  for (let step = 1; step <= span; step++) between.push((from + step) % count);
  // `from` is not returned: it is whatever the kept run ends on once `between`
  // is taken out, and the caller walks round from `to` to find it anyway
  return { to, between };
}

/** A ring whose closing segment -- last anchor back to first -- is a straight line. */
function closedStraight(anchors: CubicAnchor[]): CubicRing {
  const ring = anchors.map((anchor) => ({ ...anchor }));
  const last = ring[ring.length - 1];
  const first = ring[0];
  last.outControl = lerp(last.point, first.point, 1 / 3);
  first.inControl = lerp(last.point, first.point, 2 / 3);
  return ring;
}

/**
 * Stitch a ring shut between two of its anchors.
 *
 * The two selected anchors are joined by the shortest curve there is -- a
 * straight chord -- and whatever lay between them comes off the outline. What
 * happens to that run depends only on how much of it there is:
 *
 * - two anchors or more, and the run branches off as an island of its own,
 *   closed the same way it was cut: a straight chord from its last anchor back
 *   to its first. An island is a ring like any other and rasterizes as a
 *   separate filled piece, because the field is sampled even-odd by position
 *   and a ring outside every other ring is simply more inside.
 * - exactly one, and there is no island to make -- a single anchor closed
 *   against itself encloses nothing -- so it is deleted.
 * - none, and the two anchors were already neighbours; the chord just pulls
 *   the segment already between them straight.
 *
 * The selected anchors themselves stay on the outline and are not copied into
 * the island, so the island sits in the bay the chord cut across rather than
 * meeting it along the chord.
 *
 * Returns undefined when there is no stitch to make: the same anchor twice, an
 * anchor that is not there, or a ring that is not.
 */
export function stitchRing(rings: CubicRing[], ringIndex: number, a: number, b: number): CubicRing[] | undefined {
  const ring = rings[ringIndex];
  if (!ring || ring.length < 2) return undefined;
  const count = ring.length;
  if (a === b || a < 0 || b < 0 || a >= count || b >= count) return undefined;

  const { to, between } = betweenRun(count, a, b);
  const dropped = new Set(between);

  // walked from `to` round to `from`, so the run that was cut away is the gap
  // the ring closes over -- and the closing segment is the new chord
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

/**
 * How the rings of a shape group into the pieces they actually draw.
 *
 * Ring count says nothing about piece count. Three rings might be one blob
 * with two holes, three separate blobs, or a blob with a hole with an island
 * sitting in the hole. What separates them is containment, read the same
 * even-odd way the rasterizer reads it: a ring inside an odd number of others
 * is cut out of the piece around it, and a ring inside none of them starts a
 * piece of its own.
 *
 * Both things the pen needs come off the same walk -- which rings to draw in
 * the hole color, and which pieces the reviewer is being asked to choose
 * between once stitching has left more than one.
 */
export interface RingPieces {
  /** How many other rings enclose each ring: 0 for a piece, 1 for a hole in one. */
  depth: number[];
  /** Ring indices grouped by the piece they belong to, each group outermost first. */
  pieces: number[][];
}

/**
 * Group already-flattened rings into pieces.
 *
 * Flattened rather than cubic because every caller has flattened them already
 * -- the editor to measure area, the review panel to hand them to the
 * rasterizer -- and a curve bows past the anchors it was fitted through, so
 * containment read off the anchors would disagree with containment read off
 * the shape.
 */
export function ringPieces(flat: Point[][]): RingPieces {
  // containedBy[i][j] -- whether ring j encloses ring i. Any one point of i
  // settles it: the rings of a shape nest or lie apart, they never straddle.
  const containedBy = flat.map((ring, i) =>
    flat.map((other, j) => j !== i && ring.length > 0 && insideRings([other], ring[0])),
  );
  const depth = containedBy.map((row) => row.filter(Boolean).length);

  // The innermost ring enclosing this one is its parent, and walking parents
  // up from anywhere lands on the depth-zero ring that starts the piece. The
  // step count is bounded by the ring count so a shape whose containment does
  // not form a tree -- two rings tracing the same path, say -- cannot spin
  // here; it just lands somewhere and gets grouped with whatever else did.
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
  // shallowest first, so a piece leads with the ring that bounds it whatever
  // order the rings arrived in
  for (const piece of pieces) piece.sort((x, y) => depth[x] - depth[y]);

  return { depth, pieces };
}
