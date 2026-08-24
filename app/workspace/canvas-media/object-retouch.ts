/**
 * Retouch: recutting a mask's mesh against an object's outline.
 *
 * The mesh a mask arrives with was triangulated against the source image, not
 * against any one object, so an object's rim triangles only ever *mostly*
 * belong to it -- see object-clip, which works out what becomes of a single
 * triangle. This is the operation that applies that to the whole mesh and
 * hands back a mesh the outline runs along the edges of.
 *
 * Where object-clip keeps only the inside of a rim triangle, this keeps both
 * halves. The mesh is the mask's whole surface, not the object's: drop the
 * outside of a cut triangle and a thin unlit band opens along the curve where
 * there is now no geometry at all. So a cut triangle becomes several, some
 * tagged to the object and some tagged to nothing, and the surface stays
 * closed.
 *
 * Retouch earns its keep after a stitch. Stitching drags an outline across
 * ground the mesh was never triangulated for -- an island cut loose, a
 * peninsula pulled off -- and leaves the curve running through the middle of
 * triangles far too big to follow it. Recutting there is the difference
 * between an object that covers its own area and one that approximates it.
 *
 * ## Index stability
 *
 * Polygon indices are positional and are held all over the place: every other
 * object's and capture's membership, every review candidate, every recorded
 * decision. Inserting or removing entries would silently renumber all of them.
 *
 * So the recut is append-only. A triangle that gets cut keeps its own slot,
 * which now holds the first of its fragments, and the rest go on the end.
 * Nothing moves, nothing is deleted, and every index anyone else is holding
 * still means what it meant. A triangle nobody cut is left strictly alone --
 * the same array entry, not a copy -- so the mesh caches keyed off it survive.
 */

import { insideRings, polygonArea2, type Point, type ShapeOutline } from "./object-clip.ts";
import type { LaurusPolygonPath } from "../workspace.server";

/**
 * How close two points must be to count as the same one, in mesh units. The
 * mesh's own vertex welding works at 0.1px (WELD_EPSILON_PX in mask-gl), so
 * anything below that is already a single point as far as the renderer is
 * concerned.
 */
const EPSILON = 1e-6;

/**
 * The shortest step the outline is allowed to take inside one triangle, as a
 * fraction of that triangle's own diameter.
 *
 * A detected outline is flattened at 48 segments per cubic, so a couple of
 * dozen of its vertices can land inside a single mesh triangle -- and each one
 * would become a triangle of its own. That is not coverage, it is shrapnel:
 * the fragments end up far below the texel the relief is sampled at, and the
 * count runs into the tens of thousands. Stepping along the chain at a tenth
 * of the triangle's own size keeps the recut proportionate to the mesh it is
 * cutting, so a small triangle still gets a faithful curve and a large one
 * does not get a hundred slivers.
 */
const MIN_CHAIN_STEP_FRACTION = 0.1;

/**
 * Fragments below this share of their parent's area are dropped, matching
 * object-clip's own threshold. A cut that grazes a corner leaves slivers that
 * are degenerate to render and worthless as area, and they would be baked into
 * the mask as polygons of their own.
 */
const MIN_FRAGMENT_FRACTION = 1e-3;

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

/** The longest edge of a polygon's bounding box -- its scale, roughly. */
function diameter(points: Point[]): number {
  const [minX, minY, maxX, maxY] = bounds(points);
  return Math.max(maxX - minX, maxY - minY);
}

/**
 * The stretch of the segment a->b that lies inside a convex polygon, as the
 * parameter range [enter, exit] along it, or undefined if none of it does.
 *
 * Cyrus-Beck: the inside of a convex polygon is the intersection of its edges'
 * half-planes, each of which cuts the segment's parameter line at one point,
 * so the whole clip is a running max of entries against a running min of
 * exits. Parameters rather than points because the caller needs to know
 * *where* on the segment the crossings fell -- a clip ending before 1 means
 * the outline left the triangle there, and the chain has to end with it.
 */
export function clipSegmentToConvex(a: Point, b: Point, convex: Point[]): [number, number] | undefined {
  const oriented = polygonArea2(convex) < 0 ? [...convex].reverse() : convex;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let enter = 0;
  let exit = 1;

  for (let i = 0; i < oriented.length; i++) {
    const from = oriented[i];
    const to = oriented[(i + 1) % oriented.length];
    // inward normal of a counter-clockwise edge
    const nx = -(to[1] - from[1]);
    const ny = to[0] - from[0];
    const distance = nx * (a[0] - from[0]) + ny * (a[1] - from[1]);
    const rate = nx * dx + ny * dy;

    if (Math.abs(rate) < EPSILON) {
      // parallel to this edge: wholly in or wholly out, and no crossing to find
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

/**
 * Thin a chain so no two consecutive points are closer than `step`, keeping
 * both ends exactly where they are.
 *
 * The ends are what make the cut watertight -- they sit on the triangle's
 * edge, and the neighbour across that edge computes the identical crossing
 * from the identical curve -- so they are never candidates for thinning. Only
 * the interior gives.
 */
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
  // a kept interior point sitting on top of the end is worse than none: it
  // makes a zero-length final step, and every fragment built off it degenerate
  const last = out[out.length - 1];
  if (out.length > 1 && Math.hypot(end[0] - last[0], end[1] - last[1]) < step) out.pop();
  out.push(end);
  return out;
}

/**
 * The outline's paths across one convex cell, each running from a point on its
 * boundary to another point on its boundary.
 *
 * A ring is closed, so it can only get in by crossing out, and every chain has
 * both feet on the boundary. The one exception is a ring lying wholly inside
 * the cell, which never touches the boundary at all and would leave a hole
 * rather than a cut -- that is reported by returning undefined, and the caller
 * leaves the triangle alone rather than pretending it can express it.
 */
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

    // the ring's first vertex fell inside the cell, so what the walk saw as
    // two chains -- one closing the loop, one opening it -- is one path
    if (startedAtSeam && endedAtSeam && found.length > 1) {
      const first = found.shift()!;
      found[found.length - 1].push(...first.slice(1));
    }
    // a ring that never touched the boundary encloses part of the cell rather
    // than crossing it, and splitting cannot express that
    if (found.length === 1 && samepoint(found[0][0], found[0][found[0].length - 1])) return undefined;
    chains.push(...found);
  }

  return chains.map((chain) => thinChain(chain, step)).filter((chain) => chain.length >= 2);
}

/**
 * Where a point sits on a polygon's boundary, as a single number: edge index
 * plus how far along that edge it lies. Undefined if it is not on the boundary
 * at all.
 *
 * One number rather than an (edge, fraction) pair because the only thing
 * anyone does with it is walk forward from one to another, and a lone
 * increasing parameter makes the wraparound arithmetic rather than cases.
 */
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
  // a hair's breadth off is rounding in the crossing arithmetic; anything more
  // is a point that genuinely is not on this boundary
  return bestDistance < 1e-4 ? best : undefined;
}

/** The polygon's own vertices strictly between two boundary parameters, walking forward. */
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

/**
 * Cut a cell in two along a chain that crosses it.
 *
 * Each piece is one side of the chain plus the stretch of the cell's own
 * boundary that closes it, so the two share the chain exactly -- the same
 * points in the same order -- and no gap can open between them however the
 * curve wanders.
 */
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

/** Whether a point is inside a triangle, edges counting as inside. */
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

/**
 * Chop a simple polygon into triangles by ear clipping.
 *
 * Fanning about a centroid would be shorter, and is what object-clip does with
 * the convex fragment it keeps. It cannot be used here: cutting a triangle
 * along a curve routinely leaves a concave piece, and a fan about the centroid
 * of a concave polygon throws triangles outside it and inverts others. Ear
 * clipping only ever emits triangles the polygon actually contains.
 */
export function earClip(polygon: Point[]): Point[][] {
  const points = polygon.slice();
  // work counter-clockwise, so a convex corner is a left turn and the sign
  // tests below do not each need a copy for the other winding
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
    // no ear found: the polygon self-intersects, or is degenerate enough that
    // the tests cannot tell. Better a coarse fan than nothing at all
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
  /** Whether this fragment lies inside the outline, and so belongs to the object. */
  inside: boolean;
}

/**
 * Recut one mesh triangle against the outline.
 *
 * Undefined means leave it alone -- the outline does not cross it, or crosses
 * it in a way splitting cannot express -- which is the answer for almost every
 * triangle in a mask and is why this is cheap enough to run over the whole
 * mesh.
 */
export function retouchTriangle(triangle: Point[], outline: ShapeOutline): RetouchedTriangle[] | undefined {
  const chains = outlineChains(triangle, outline.all);
  if (!chains || chains.length === 0) return undefined;

  let cells = [triangle];
  for (const chain of chains) {
    // the cell this chain actually runs through: both feet on its boundary,
    // and -- where the chain's ends sit on a cut two chains share -- the one
    // the chain's own interior heads into
    const probe = chain.length > 2 ? chain[1] : centroidOf([chain[0], chain[chain.length - 1]]);
    const candidates = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => boundaryParam(cell, chain[0]) !== undefined)
      .filter(({ cell }) => boundaryParam(cell, chain[chain.length - 1]) !== undefined);
    // a chain's feet can land on a cut two cells already share, so having both
    // feet on a cell's boundary is not enough to say the chain runs through
    // it. Where the chain's own next step goes settles it. Cells are no longer
    // convex once one has been split, so this is a ring test, not a half-plane
    // one
    const target = candidates.find(({ cell }) => insideRings([cell], probe)) ?? candidates[0];
    if (!target) continue;
    const split = splitCell(target.cell, chain);
    if (!split) continue;
    cells = [...cells.slice(0, target.index), ...split, ...cells.slice(target.index + 1)];
  }
  if (cells.length < 2) return undefined;

  const whole = Math.abs(polygonArea2(triangle));
  const out: RetouchedTriangle[] = [];
  for (const cell of cells) {
    if (Math.abs(polygonArea2(cell)) <= whole * MIN_FRAGMENT_FRACTION) continue;
    for (const fragment of earClip(cell)) {
      if (Math.abs(polygonArea2(fragment)) <= whole * MIN_FRAGMENT_FRACTION) continue;
      // Asked of each triangle rather than once of the cell it came out of.
      // A cell cut along a curve is routinely concave, and the centroid of a
      // concave polygon is not reliably inside it -- a triangle clipped
      // against a square corner has its centroid sitting squarely in the
      // corner that was cut away, which read as inside and labelled every
      // fragment of the outside piece as the object's. A triangle is convex,
      // so its own centroid is always in it, and a cell never straddles the
      // curve, so any point in it answers for all of it.
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
  /** The mesh after the recut -- index-stable against the one that went in. */
  polygons: LaurusPolygonPath[];
  /** The polygons the outline now encloses: the object's membership, recut. */
  indices: Set<number>;
  /** How many polygons the recut added. Zero means nothing was worth cutting. */
  added: number;
}

/**
 * Recut a whole mesh against one object's outline.
 *
 * `points` is the mesh's welded geometry, indexed alongside `polygons` -- the
 * same arrays maskGeometry already holds, so this does not re-parse a path
 * string per triangle.
 *
 * Membership comes back with it rather than being left to the usual
 * centroid-in-object test, because after a recut that test is no longer
 * telling anyone anything they did not already know: every fragment is now
 * wholly on one side of the curve, and which side is exactly what the cut
 * decided. Running the test again would only be a chance to disagree with it.
 */
export function retouchMesh(polygons: LaurusPolygonPath[], points: Point[][], outline: ShapeOutline): RetouchResult {
  const next = polygons.slice();
  const indices = new Set<number>();
  let added = 0;

  // What makes this affordable at all. Cutting asks whether the outline
  // crosses a triangle by walking every segment of every ring against it, and
  // a detected outline flattens to something like a thousand segments -- so
  // over a mesh of several thousand triangles that is millions of segment
  // clips, nearly all of them for triangles nowhere near the curve. One box
  // test throws those out first, and what is left is the rim, which is the
  // only part a recut was ever about. Same reject clipTriangle opens with.
  const outlineBox = bounds(outline.all.flat());

  polygons.forEach((polygon, index) => {
    const triangle = points[index];
    if (!triangle || triangle.length !== 3) return;
    // nothing further to ask: the outline lies inside its own box, so a
    // triangle clear of that box is neither cut by the curve nor inside it
    if (!overlaps(bounds(triangle), outlineBox)) return;

    const fragments = retouchTriangle(triangle, outline);
    if (!fragments) {
      // left as the very same array entry, not a copy, so the mesh caches
      // keyed on identity can see it has not moved
      if (insideRings(outline.all, centroidOf(triangle))) indices.add(index);
      return;
    }

    fragments.forEach((fragment, at) => {
      // the tags ride along unchanged. A fragment outside the curve is
      // untagged in the ordinary case, because a candidate under review has
      // not been tagged to anything yet -- but a rim triangle can belong to a
      // neighbouring object that was accepted long ago, and zeroing it here
      // would quietly take that area away from an object nobody was editing.
      // What the candidate itself covers is `indices`, and the accept applies
      // that; nothing else about membership is this operation's business.
      const cut: LaurusPolygonPath = { ...polygon, d: toPathData(fragment.points) };
      // the parent keeps its own slot and the rest go on the end, so no index
      // anyone else is holding moves
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

/**
 * The recut as a change to send, rather than as the mesh it produced.
 *
 * Sending the whole mesh would be sending thousands of triangles to say that a
 * few dozen of them moved -- the same reason the server answers an edit with a
 * MaskEditDelta rather than a fresh mask. And it is derivable rather than
 * recorded: the recut is append-only and never reorders, so the appended
 * entries are exactly the tail, and the rest are the slots that no longer hold
 * the entry they held before. Identity is the test, because a triangle the
 * recut left alone is left as the very same object.
 */
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
