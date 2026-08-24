export const CURVE_SEGMENTS = 48;

// The side length of one object's signed-distance tile. Sixteen of these tile
// a 4x4 atlas (see encodeObjectSdfAtlas in mask-gl.ts), so this is also a
// quarter of that texture's dimension.
export const OBJECT_SDF_TILE = 128;
// What a tile covers, in the shape's own normalized units, measured from the
// centre outward. The outline's furthest point sits at exactly 1 by
// construction (see normalizeRings), so anything above 1 is margin: the band
// where the field is still negative-but-finite rather than clamped. Without
// it the gradient at the rim would be read off the tile edge, where there is
// nothing outside to point away from.
export const OBJECT_SDF_MARGIN = 1.1;
// A smaller tile for the shape editor's live drag preview -- the same field at
// a quarter of the texels, which the relief cannot show the difference in
// while it is moving.
export const OBJECT_SDF_DRAFT_TILE = 64;
// How far the rasterized outline may drift from the authored one, as a
// fraction of a texel. Simplifying to a quarter of a texel cannot move a
// sampled distance by more than that, and it is what keeps the per-texel
// nearest-segment search over hundreds of segments rather than thousands: a
// detected outline arrives as ~20 cubics flattened at CURVE_SEGMENTS each.
const SDF_SIMPLIFY_TEXEL_FRACTION = 0.25;

export interface ObjectShape {
  /** The authored outline, normalized and closed -- exactly what is stored. */
  path: string;
  /** Side length of the sdf/grad grids below. */
  tile: number;
  /**
   * Signed distance to the outline at each texel, in normalized units,
   * positive inside. Row-major, `tile * tile` entries.
   */
  sdf: Float32Array;
  /**
   * The unit gradient of `sdf`, two components per texel, quantized to the
   * same 8 bits per component the atlas ships to the GPU so that the CPU and
   * the shader read the identical value. Exact rather than differenced: the
   * distance pass already knows each texel's nearest point on the outline, and
   * the direction away from it *is* the gradient.
   */
  grad: Int8Array;
  /**
   * The largest value in `sdf` -- how deep the shape's deepest interior point
   * is. This is what normalizes depth into the profile's `u`, and for a circle
   * it is exactly the radius, which is what makes an empty shape and a
   * circular one the same case rather than two.
   */
  maxDepth: number;
  /**
   * The furthest the outline reaches from the centre, in normalized units. 1
   * by construction, carried explicitly because the swell reach reads it and
   * should not have to assume the normalization held.
   */
  maxExtent: number;
}

export type ObjectShapeResult = { ok: true; shape: ObjectShape } | { ok: false; reason: string };

interface Cursor {
  d: string;
  i: number;
}

function isSeparator(ch: string): boolean {
  return ch === "," || ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

function skipSeparators(c: Cursor): void {
  while (c.i < c.d.length && isSeparator(c.d[c.i])) c.i++;
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function readNumber(c: Cursor): number | undefined {
  skipSeparators(c);
  const start = c.i;
  if (c.d[c.i] === "+" || c.d[c.i] === "-") c.i++;
  while (isDigit(c.d[c.i])) c.i++;
  if (c.d[c.i] === ".") {
    c.i++;
    while (isDigit(c.d[c.i])) c.i++;
  }

  if (c.d[c.i] === "e" || c.d[c.i] === "E") {
    const exponentStart = c.i;
    c.i++;
    if (c.d[c.i] === "+" || c.d[c.i] === "-") c.i++;
    if (isDigit(c.d[c.i])) {
      while (isDigit(c.d[c.i])) c.i++;
    } else {
      c.i = exponentStart;
    }
  }
  if (c.i === start) return undefined;
  const value = parseFloat(c.d.slice(start, c.i));
  return Number.isFinite(value) ? value : undefined;
}

function readFlag(c: Cursor): number | undefined {
  skipSeparators(c);
  const ch = c.d[c.i];
  if (ch !== "0" && ch !== "1") return undefined;
  c.i++;
  return ch === "1" ? 1 : 0;
}

function cubicPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const cc = 3 * mt * t * t;
  const dd = t * t * t;
  return [a * p0[0] + b * p1[0] + cc * p2[0] + dd * p3[0], a * p0[1] + b * p1[1] + cc * p2[1] + dd * p3[1]];
}

function quadraticPoint(p0: [number, number], p1: [number, number], p2: [number, number], t: number): [number, number] {
  const mt = 1 - t;
  return [mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]];
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return sign * Math.acos(Math.min(1, Math.max(-1, dot)));
}

function arcPoints(
  from: [number, number],
  rx: number,
  ry: number,
  rotationDeg: number,
  largeArc: number,
  sweep: number,
  to: [number, number],
): [number, number][] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [to];

  let absRx = Math.abs(rx);
  let absRy = Math.abs(ry);
  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (absRx * absRx) + (y1p * y1p) / (absRy * absRy);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    absRx *= scale;
    absRy *= scale;
  }

  const numerator = absRx * absRx * absRy * absRy - absRx * absRx * y1p * y1p - absRy * absRy * x1p * x1p;
  const denominator = absRx * absRx * y1p * y1p + absRy * absRy * x1p * x1p;
  const coefficient = (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coefficient * absRx * y1p) / absRy;
  const cyp = (-coefficient * absRy * x1p) / absRx;

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const startAngle = vectorAngle(1, 0, (x1p - cxp) / absRx, (y1p - cyp) / absRy);
  let sweepAngle = vectorAngle((x1p - cxp) / absRx, (y1p - cyp) / absRy, (-x1p - cxp) / absRx, (-y1p - cyp) / absRy);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;

  const points: [number, number][] = [];
  for (let step = 1; step <= CURVE_SEGMENTS; step++) {
    const angle = startAngle + (sweepAngle * step) / CURVE_SEGMENTS;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    points.push([
      cosPhi * absRx * cosAngle - sinPhi * absRy * sinAngle + cx,
      sinPhi * absRx * cosAngle + cosPhi * absRy * sinAngle + cy,
    ]);
  }
  return points;
}

export function flattenPathData(d: string): [number, number][][] {
  const subpaths: [number, number][][] = [];
  let current: [number, number][] = [];
  let point: [number, number] = [0, 0];
  let subpathStart: [number, number] = [0, 0];
  let lastControl: [number, number] | undefined;
  let lastWasCubic = false;
  let lastWasQuadratic = false;

  const flush = (): void => {
    if (current.length >= 2) subpaths.push(current);
    current = [];
  };

  const cursor: Cursor = { d, i: 0 };
  let command = "";

  while (cursor.i < d.length) {
    skipSeparators(cursor);
    if (cursor.i >= d.length) break;
    const ch = cursor.d[cursor.i];
    if (/[a-zA-Z]/.test(ch)) {
      command = ch;
      cursor.i++;
    } else if (command === "") {
      break;
    } else if (command === "M") {
      command = "L";
    } else if (command === "m") {
      command = "l";
    }

    const relative = command >= "a" && command <= "z";
    const upper = command.toUpperCase();

    if (upper === "Z") {
      flush();
      point = subpathStart;
      lastControl = undefined;
      lastWasCubic = false;
      lastWasQuadratic = false;
      continue;
    }

    const startedAt = cursor.i;

    if (upper === "M") {
      const x = readNumber(cursor);
      const y = readNumber(cursor);
      if (x === undefined || y === undefined) break;
      flush();
      point = relative ? [point[0] + x, point[1] + y] : [x, y];
      subpathStart = point;
      current = [point];
      lastWasCubic = false;
      lastWasQuadratic = false;
    } else if (upper === "L") {
      const x = readNumber(cursor);
      const y = readNumber(cursor);
      if (x === undefined || y === undefined) break;
      point = relative ? [point[0] + x, point[1] + y] : [x, y];
      current.push(point);
      lastWasCubic = false;
      lastWasQuadratic = false;
    } else if (upper === "H") {
      const x = readNumber(cursor);
      if (x === undefined) break;
      point = relative ? [point[0] + x, point[1]] : [x, point[1]];
      current.push(point);
      lastWasCubic = false;
      lastWasQuadratic = false;
    } else if (upper === "V") {
      const y = readNumber(cursor);
      if (y === undefined) break;
      point = relative ? [point[0], point[1] + y] : [point[0], y];
      current.push(point);
      lastWasCubic = false;
      lastWasQuadratic = false;
    } else if (upper === "C" || upper === "S") {
      let control1: [number, number];
      if (upper === "S") {
        control1 =
          lastWasCubic && lastControl
            ? [2 * point[0] - lastControl[0], 2 * point[1] - lastControl[1]]
            : [point[0], point[1]];
      } else {
        const x = readNumber(cursor);
        const y = readNumber(cursor);
        if (x === undefined || y === undefined) break;
        control1 = relative ? [point[0] + x, point[1] + y] : [x, y];
      }
      const c2x = readNumber(cursor);
      const c2y = readNumber(cursor);
      const ex = readNumber(cursor);
      const ey = readNumber(cursor);
      if (c2x === undefined || c2y === undefined || ex === undefined || ey === undefined) break;
      const control2: [number, number] = relative ? [point[0] + c2x, point[1] + c2y] : [c2x, c2y];
      const end: [number, number] = relative ? [point[0] + ex, point[1] + ey] : [ex, ey];
      for (let step = 1; step <= CURVE_SEGMENTS; step++) {
        current.push(cubicPoint(point, control1, control2, end, step / CURVE_SEGMENTS));
      }
      point = end;
      lastControl = control2;
      lastWasCubic = true;
      lastWasQuadratic = false;
    } else if (upper === "Q" || upper === "T") {
      let control: [number, number];
      if (upper === "T") {
        control =
          lastWasQuadratic && lastControl
            ? [2 * point[0] - lastControl[0], 2 * point[1] - lastControl[1]]
            : [point[0], point[1]];
      } else {
        const x = readNumber(cursor);
        const y = readNumber(cursor);
        if (x === undefined || y === undefined) break;
        control = relative ? [point[0] + x, point[1] + y] : [x, y];
      }
      const ex = readNumber(cursor);
      const ey = readNumber(cursor);
      if (ex === undefined || ey === undefined) break;
      const end: [number, number] = relative ? [point[0] + ex, point[1] + ey] : [ex, ey];
      for (let step = 1; step <= CURVE_SEGMENTS; step++) {
        current.push(quadraticPoint(point, control, end, step / CURVE_SEGMENTS));
      }
      point = end;
      lastControl = control;
      lastWasCubic = false;
      lastWasQuadratic = true;
    } else if (upper === "A") {
      const rx = readNumber(cursor);
      const ry = readNumber(cursor);
      const rotation = readNumber(cursor);
      const largeArc = readFlag(cursor);
      const sweep = readFlag(cursor);
      const ex = readNumber(cursor);
      const ey = readNumber(cursor);
      if (
        rx === undefined ||
        ry === undefined ||
        rotation === undefined ||
        largeArc === undefined ||
        sweep === undefined ||
        ex === undefined ||
        ey === undefined
      ) {
        break;
      }
      const end: [number, number] = relative ? [point[0] + ex, point[1] + ey] : [ex, ey];
      current.push(...arcPoints(point, rx, ry, rotation, largeArc, sweep, end));
      point = end;
      lastControl = undefined;
      lastWasCubic = false;
      lastWasQuadratic = false;
    } else {
      break;
    }

    if (cursor.i === startedAt) break;
  }

  flush();
  return subpaths;
}

export function extractPathData(markup: string): string[] {
  const paths: string[] = [];
  const re = /<path\b[^>]*?\bd\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markup))) {
    const d = match[1] ?? match[2];
    if (d && d.trim()) paths.push(d);
  }
  return paths;
}
export function polygonArea(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function polygonCentroid(points: [number, number][]): [number, number] {
  let doubleArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    doubleArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(doubleArea) < 1e-12) {
    return [
      points.reduce((sum, [x]) => sum + x, 0) / points.length,
      points.reduce((sum, [, y]) => sum + y, 0) / points.length,
    ];
  }
  return [cx / (3 * doubleArea), cy / (3 * doubleArea)];
}

/**
 * The normalized coordinate a texel index sits at, along one axis.
 *
 * Texel centres rather than corners, so the field is sampled where the shader
 * will read it. This is the single definition of how a tile maps onto the
 * shape, and the shader's own tile lookup is its mirror -- get them out of
 * step and every shape renders offset by half a texel.
 */
export function sdfTexelCoordinate(index: number, tile: number): number {
  return ((index + 0.5) / tile) * 2 * OBJECT_SDF_MARGIN - OBJECT_SDF_MARGIN;
}

/**
 * Distance from a point to a line segment, writing the closest point on the
 * segment into `out`.
 *
 * The closest point is the reason this returns it rather than just the
 * distance: the direction away from it is exactly the gradient of the distance
 * field, so measuring the distance and knowing which way it increases are one
 * computation, not two.
 */
function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: [number, number],
): number {
  const ex = bx - ax;
  const ey = by - ay;
  const lengthSquared = ex * ex + ey * ey;
  let t = lengthSquared > 0 ? ((px - ax) * ex + (py - ay) * ey) / lengthSquared : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  out[0] = ax + ex * t;
  out[1] = ay + ey * t;
  return Math.hypot(px - out[0], py - out[1]);
}

/**
 * Douglas-Peucker simplification of a closed ring.
 *
 * Purely a speed measure for the rasterization below, run after the shape has
 * already been normalized so it cannot move the centre or the extent that
 * `cx`/`cy`/`radius` were derived from. A detected outline arrives as ~20
 * cubics flattened at CURVE_SEGMENTS apiece -- a thousand points describing a
 * curve that a 128-texel grid cannot resolve past a couple of hundred, and the
 * per-texel search below is linear in that count.
 *
 * The ring is walked as an open chain from its first point back around to it,
 * so the only place simplification can misjudge is that seam, and it can
 * misjudge it by at most `tolerance`.
 */
export function simplifyRing(ring: [number, number][], tolerance: number): [number, number][] {
  if (ring.length <= 3) return ring;
  const chain = [...ring, ring[0]];
  const keep = new Uint8Array(chain.length);
  keep[0] = 1;
  keep[chain.length - 1] = 1;

  const stack: [number, number][] = [[0, chain.length - 1]];
  const closest: [number, number] = [0, 0];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last <= first + 1) continue;
    let worst = -1;
    let worstAt = -1;
    for (let i = first + 1; i < last; i++) {
      const deviation = segmentDistance(
        chain[i][0],
        chain[i][1],
        chain[first][0],
        chain[first][1],
        chain[last][0],
        chain[last][1],
        closest,
      );
      if (deviation > worst) {
        worst = deviation;
        worstAt = i;
      }
    }
    if (worst > tolerance && worstAt > first) {
      keep[worstAt] = 1;
      stack.push([first, worstAt], [worstAt, last]);
    }
  }

  const simplified: [number, number][] = [];
  for (let i = 0; i < chain.length - 1; i++) if (keep[i]) simplified.push(chain[i]);
  return simplified.length >= 3 ? simplified : ring;
}

/**
 * Which texels fall inside the outline, as a 0/1 grid, by the even-odd rule.
 *
 * Even-odd rather than nonzero winding because it is what makes a hole a hole
 * regardless of which direction its ring was traced in. A region's holes come
 * from cv2.findContours on the server and an arbitrary illustrator's export on
 * the svg path, and neither guarantees a consistent orientation -- under
 * nonzero winding a hole traced the same way round as its outer ring silently
 * fills in.
 *
 * Scanline rather than a per-texel containment test: one pass over the
 * segments per row, instead of one per texel.
 */
function insideMask(rings: [number, number][][], tile: number): Uint8Array {
  const inside = new Uint8Array(tile * tile);
  const crossings: number[] = [];
  for (let row = 0; row < tile; row++) {
    const y = sdfTexelCoordinate(row, tile);
    crossings.length = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[(i + 1) % ring.length];
        if (y0 <= y === y1 <= y) continue;
        crossings.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);
    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = crossings[pair];
      const to = crossings[pair + 1];
      for (let col = 0; col < tile; col++) {
        const x = sdfTexelCoordinate(col, tile);
        if (x >= from && x <= to) inside[row * tile + col] = 1;
      }
    }
  }
  return inside;
}

export interface SignedDistanceField {
  sdf: Float32Array;
  grad: Int8Array;
  maxDepth: number;
}

/**
 * Rasterize already-normalized rings into a signed distance field: distance to
 * the nearest point of the outline, positive inside, with the unit gradient
 * alongside it.
 *
 * Exact distance to the outline rather than a grid distance transform. A
 * transform is cheaper but quantizes the boundary to texel centres, and the
 * gradient is the part that cannot survive that: it feeds the lighting normal
 * directly, so a staircased distance shades as a faceted one. Measuring
 * against the segments themselves costs a nearest-segment search per texel and
 * gives both an exact distance and an exact gradient, which is why the rings
 * are simplified first.
 *
 * Returns undefined when nothing landed inside -- a shape thinner than a texel
 * everywhere has no interior to raise relief over.
 */
export function signedDistanceField(
  rings: [number, number][][],
  tile: number = OBJECT_SDF_TILE,
): SignedDistanceField | undefined {
  const texelSize = (2 * OBJECT_SDF_MARGIN) / tile;
  const simplified = rings.map((ring) => simplifyRing(ring, texelSize * SDF_SIMPLIFY_TEXEL_FRACTION));
  const inside = insideMask(simplified, tile);

  let segmentCount = 0;
  for (const ring of simplified) segmentCount += ring.length;
  if (segmentCount === 0) return undefined;

  const originX = new Float64Array(segmentCount);
  const originY = new Float64Array(segmentCount);
  const edgeX = new Float64Array(segmentCount);
  const edgeY = new Float64Array(segmentCount);
  const lengthSquared = new Float64Array(segmentCount);
  let at = 0;
  for (const ring of simplified) {
    for (let i = 0; i < ring.length; i++) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      const ex = to[0] - from[0];
      const ey = to[1] - from[1];
      originX[at] = from[0];
      originY[at] = from[1];
      edgeX[at] = ex;
      edgeY[at] = ey;
      lengthSquared[at] = ex * ex + ey * ey;
      at++;
    }
  }

  const columnX = new Float64Array(tile);
  for (let col = 0; col < tile; col++) columnX[col] = sdfTexelCoordinate(col, tile);

  const sdf = new Float32Array(tile * tile);
  const grad = new Int8Array(tile * tile * 2);
  let maxDepth = 0;

  for (let row = 0; row < tile; row++) {
    const y = sdfTexelCoordinate(row, tile);
    for (let col = 0; col < tile; col++) {
      const x = columnX[col];
      let best = Infinity;
      let bestX = 0;
      let bestY = 0;
      for (let s = 0; s < segmentCount; s++) {
        const ex = edgeX[s];
        const ey = edgeY[s];
        const l2 = lengthSquared[s];
        let t = l2 > 0 ? ((x - originX[s]) * ex + (y - originY[s]) * ey) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const closestX = originX[s] + ex * t;
        const closestY = originY[s] + ey * t;
        const dx = x - closestX;
        const dy = y - closestY;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < best) {
          best = distanceSquared;
          bestX = closestX;
          bestY = closestY;
        }
      }
      if (!Number.isFinite(best)) return undefined;
      const distance = Math.hypot(x - bestX, y - bestY);

      const texel = row * tile + col;
      const isInside = inside[texel] === 1;
      sdf[texel] = isInside ? distance : -distance;
      if (isInside && distance > maxDepth) maxDepth = distance;

      const sign = isInside ? 1 : -1;
      const dx = (x - bestX) * sign;
      const dy = (y - bestY) * sign;
      const length = Math.hypot(dx, dy);
      if (length > 1e-12) {
        grad[texel * 2] = Math.max(-127, Math.min(127, Math.round((dx / length) * 127)));
        grad[texel * 2 + 1] = Math.max(-127, Math.min(127, Math.round((dy / length) * 127)));
      }
    }
  }

  if (!(maxDepth > 0)) return undefined;
  return { sdf, grad, maxDepth };
}

/**
 * Bilinear sample of a shape's signed distance at a point in the shape's own
 * normalized space -- the CPU twin of the shader's objectDepthAt.
 *
 * Reads outside the tile return a large negative distance rather than clamping
 * to the edge value, because clamping would report the rim's distance
 * arbitrarily far away and make everything beyond the tile look like it was
 * just outside the shape.
 */
export function objectShapeDepthAt(shape: ObjectShape, nx: number, ny: number): number {
  const { tile, sdf } = shape;
  const u = ((nx + OBJECT_SDF_MARGIN) / (2 * OBJECT_SDF_MARGIN)) * tile - 0.5;
  const v = ((ny + OBJECT_SDF_MARGIN) / (2 * OBJECT_SDF_MARGIN)) * tile - 0.5;
  if (u < -1 || v < -1 || u > tile || v > tile) return -OBJECT_SDF_MARGIN;

  const col = Math.floor(u);
  const row = Math.floor(v);
  const fx = u - col;
  const fy = v - row;
  const clamp = (i: number): number => (i < 0 ? 0 : i > tile - 1 ? tile - 1 : i);
  const c0 = clamp(col);
  const c1 = clamp(col + 1);
  const r0 = clamp(row);
  const r1 = clamp(row + 1);

  const top = sdf[r0 * tile + c0] + (sdf[r0 * tile + c1] - sdf[r0 * tile + c0]) * fx;
  const bottom = sdf[r1 * tile + c0] + (sdf[r1 * tile + c1] - sdf[r1 * tile + c0]) * fx;
  return top + (bottom - top) * fy;
}

/**
 * How far along its falloff a point sits, 0 at the shape's deepest interior
 * point and 1 at its outline -- the CPU twin of the shader's `u`.
 *
 * For a circle this is exactly `distance / radius`, which is what makes an
 * object with no custom shape and one shaped like a circle the same case.
 */
export function objectShapeProfileU(shape: ObjectShape, nx: number, ny: number): number {
  return 1 - objectShapeDepthAt(shape, nx, ny) / shape.maxDepth;
}

export function formatPathNumber(n: number): string {
  const fixed = n.toFixed(5);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return trimmed === "-0" ? "0" : trimmed;
}

export function toPathData(rings: [number, number][][]): string {
  return rings
    .map(
      (points) =>
        points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${formatPathNumber(x)},${formatPathNumber(y)}`).join("") + "Z",
    )
    .join("");
}

/**
 * Where a shape's own coordinates sit relative to its outline: the centre a
 * tile is built around and the scale that puts the outline's furthest point at
 * exactly 1.
 *
 * The bounding box's centre rather than the area centroid, because a centroid
 * is only a sensible origin for a shape that contains it. A crescent's
 * centroid falls in the gap, a ring's in the hole, and a pair of disjoint
 * pieces puts it in the space between them -- all shapes this now has to
 * normalize. The bounding box's centre is defined for every one of them, and
 * for the round blobs that used to be the only allowed case it lands in
 * practically the same place.
 *
 * **The server mirrors this exactly** (see normalize_rings in object_math.py).
 * It is what makes an object's `cx`/`cy`/`radius` agree with the tile its
 * shape is rasterized into; drift between the two implementations shows up as
 * relief offset from the outline it was drawn for.
 */
export function normalizeRings(rings: [number, number][][]): {
  rings: [number, number][][];
  center: [number, number];
  scale: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const center: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];

  let scale = 0;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      const reach = Math.hypot(x - center[0], y - center[1]);
      if (reach > scale) scale = reach;
    }
  }
  if (!(scale > 0)) return { rings, center, scale: 0 };

  return {
    rings: rings.map((ring) =>
      ring.map(([x, y]): [number, number] => [(x - center[0]) / scale, (y - center[1]) / scale]),
    ),
    center,
    scale,
  };
}

/**
 * Build an object shape from one or more closed rings.
 *
 * Every ring is kept. What used to be three rejections -- a hole, several
 * separate pieces, an outline that is not star-shaped -- are all just shapes
 * now: the field is sampled by position, so a crescent, an annulus and a pair
 * of disjoint blobs each rasterize as readily as a circle. The only remaining
 * failure is an outline that encloses nothing measurable at all.
 */
export function buildObjectShapeFromRings(rings: [number, number][][], tile = OBJECT_SDF_TILE): ObjectShapeResult {
  const usable = rings.filter((ring) => ring.length >= 3 && Math.abs(polygonArea(ring)) > 0);
  if (usable.length === 0) {
    return { ok: false, reason: "no closed region found in the svg -- an object shape needs a filled outline" };
  }

  const normalized = normalizeRings(usable);
  if (!(normalized.scale > 0)) {
    return { ok: false, reason: "the shape has no measurable extent" };
  }

  const field = signedDistanceField(normalized.rings, tile);
  if (!field) {
    return {
      ok: false,
      reason: "the shape encloses no area to raise relief over -- it may be a hairline, or all outline and no inside",
    };
  }

  return {
    ok: true,
    shape: {
      path: toPathData(normalized.rings),
      tile,
      sdf: field.sdf,
      grad: field.grad,
      maxDepth: field.maxDepth,
      maxExtent: 1,
    },
  };
}

export function decodeSvgMarkup(markup: string): string {
  try {
    return decodeURIComponent(
      atob(markup)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch (error) {
    console.log("Failed to decode svg markup", { error });
    return "";
  }
}

export function buildObjectShapeFromMarkup(markup: string, tile = OBJECT_SDF_TILE): ObjectShapeResult {
  const paths = extractPathData(markup);
  if (paths.length === 0) {
    return { ok: false, reason: "the svg has no <path> element to take a shape from" };
  }
  return buildObjectShapeFromRings(
    paths.flatMap((d) => flattenPathData(d)),
    tile,
  );
}

export function sampleObjectShapePath(path: string, tile = OBJECT_SDF_TILE): ObjectShape | undefined {
  const result = buildObjectShapeFromRings(flattenPathData(path), tile);
  return result.ok ? result.shape : undefined;
}

/**
 * How many built shapes to keep. Each holds a tile-sized field rather than the
 * two small arrays the angular table used, and the shape editor mints a fresh
 * path string on every frame of a drag -- so this being a plain unbounded Map,
 * as it was, would grow by ~96KB per pointermove for as long as the session
 * lasts.
 */
const SHAPE_CACHE_LIMIT = 24;

const shapeCache = new Map<string, ObjectShape | undefined>();

/**
 * The rendered shape for a stored path, built once and kept.
 *
 * `tile` exists for the shape editor. Rasterizing is quadratic in the tile
 * side -- measured at 58ms for a traced outline at OBJECT_SDF_TILE against
 * 10ms at OBJECT_SDF_DRAFT_TILE -- and a drag mints a new path every frame, so
 * every frame is a cache miss and a full rebuild. At full resolution that is
 * about eight frames a second; at draft resolution the relief keeps up with
 * the pen. The tile is part of the key, so the draft a drag leaves behind
 * cannot be mistaken for the real one once it is committed.
 */
export function cachedObjectShape(path: string, tile: number = OBJECT_SDF_TILE): ObjectShape | undefined {
  if (!path) return undefined;
  const key = tile === OBJECT_SDF_TILE ? path : `${tile} ${path}`;
  if (shapeCache.has(key)) {
    // re-insert so the most recently used entry is always last, which is what
    // makes the eviction below least-recently-used rather than arbitrary
    const cached = shapeCache.get(key);
    shapeCache.delete(key);
    shapeCache.set(key, cached);
    return cached;
  }
  const shape = sampleObjectShapePath(path, tile);
  shapeCache.set(key, shape);
  if (shapeCache.size > SHAPE_CACHE_LIMIT) {
    const oldest = shapeCache.keys().next();
    if (!oldest.done) shapeCache.delete(oldest.value);
  }
  return shape;
}
