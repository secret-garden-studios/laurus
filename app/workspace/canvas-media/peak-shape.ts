/**
 * Turns an svg's silhouette into the angular radius table a topology peak's height field reads, so a
 * peak can take a custom shape instead of a circle (see PEAK_FIELD_GLSL in mask-gl.ts).
 *
 * The whole feature rests on one generalization: the field's `u = |p - c| / radius` becomes
 *
 *     u = |p - c| / (radius * rho(theta)),   theta = atan2(p.y - cy, p.x - cx),   rho in (0, 1]
 *
 * A circle is rho identically 1, which is why shaped peaks are additive rather than a second code
 * path -- every peak that exists today lands on the constant case, and `radius` keeps its exact
 * current meaning as the shape's *maximum* extent. Everything built on the profile k(u) survives
 * untouched: u = 1 still marks the rim, so h is still 0 there for every falloff (the C1 join that
 * lets a peak sit mid-mesh with no crease ring), and peakSwell's pixel bound still collapses to the
 * same u*k(u) <= 0.385 because the local radius cancels out of it exactly.
 *
 * ## Why this module parses svg paths by hand
 *
 * The obvious implementation is `new Path2D(d)` plus an offscreen canvas, and it is not available
 * here: the peak field's math is covered by peak-field.test.ts, which runs under
 * `node --experimental-strip-types --test` with no bundler and no DOM, and works only because
 * mask-gl.ts has no runtime imports. A sampler that reached for Path2D would be the one piece of
 * this feature that could not be tested at all -- and it is the piece most worth testing, since a
 * silently mis-sampled silhouette produces a peak that is merely the *wrong shape* rather than
 * visibly broken. So the flattener below is pure TypeScript, this module imports nothing at runtime,
 * and peak-shape.test.ts exercises it the same way.
 *
 * ## Coordinate conventions
 *
 * theta is atan2(y, x) in the mask's own y-down mesh space -- the same space the polygons' `d`
 * strings and a_position are in, and the same atan2 the shader will compute. Visually that runs
 * clockwise rather than counter-clockwise, which is irrelevant as long as sampling and shading agree,
 * and they agree by construction because neither ever converts.
 */

/** How many angular samples a shape is stored and uploaded at -- one row of the shape texture, so
 * this is also that texture's width. Power-of-two because WebGL1 only offers REPEAT wrapping on
 * power-of-two textures, and REPEAT across the theta axis is what makes the +/-pi seam interpolate
 * correctly instead of clamping to a flat spot. 128 samples is 2.8 degrees per texel, and the
 * fragment stage reads it with LINEAR filtering on top of that. */
export const PEAK_SHAPE_SAMPLES = 128;

/** The star-shaped check (see sampleAngularRadii) sweeps at 4x the stored resolution rather than at
 * PEAK_SHAPE_SAMPLES. Storage resolution is a rendering budget -- detail finer than a texel is
 * discarded anyway -- but validation is a correctness gate, and a shape can easily have a violating
 * notch narrower than 2.8 degrees while looking perfectly reasonable. Author-time only, so the extra
 * sweep costs nothing that matters. */
export const PEAK_SHAPE_VALIDATION_SAMPLES = PEAK_SHAPE_SAMPLES * 4;

/** Points emitted per curve segment when flattening. Fixed rather than adaptive because at flatten
 * time there is no center to measure an angular span against yet -- that only exists once the
 * silhouette has been picked and its centroid taken, several steps later.
 *
 * 48 comes from the worst case the value actually has to cover, which is not a fussy one: a full
 * circle drawn as two half-circle arcs, which is how most icon sets emit a round silhouette. Each
 * chord then spans pi/48, so the flattened outline cuts inside the true curve by at most
 * 1 - cos(pi/96) = 0.054% of the radius. That is what makes a circular svg reproduce an unshaped
 * peak's own field rather than a subtly rippled one -- the property that keeps "shaped peaks are
 * additive" true in practice and not just in principle. Raising it further costs persisted characters
 * (the flattened ring is what gets stored, see PeakShape.path) and buys precision the 128-sample
 * table cannot represent anyway. */
const CURVE_SEGMENTS = 48;

/** A subpath is ignored as a stray artifact (a stray dot, a rounding sliver left by an exporter)
 * below this fraction of the main silhouette's area, and treated as a genuine second region --
 * a hole, or a multi-part shape, neither of which rho(theta) can represent -- at or above it. */
const STRAY_SUBPATH_AREA_FRACTION = 0.01;

/** One sampled silhouette, ready to become a row of the shape texture.
 *
 * `path` is the normalized polygon that produced the samples, and is what gets *persisted* on the
 * peak (see Peak_V1_0.shape) -- deliberately the flattened polygon rather than the author's original
 * `d`. Three reasons: it is already centered on the origin and scaled to a maximum radius of exactly
 * 1, so cx/cy/radius keep meaning precisely what they mean for a circle; it is M/L/Z, the same
 * convention every other `d` in this codebase uses (parsePathPoints in mask-gl.ts reads it as-is);
 * and re-sampling it on load needs none of the curve/arc machinery below, so the load path cannot
 * drift from the authoring path. */
export interface PeakShape {
  path: string;
  /** rho(theta) at PEAK_SHAPE_SAMPLES evenly spaced angles starting at theta = -pi. Max is exactly 1. */
  rho: Float32Array;
  /** d(rho)/d(theta) at the same angles, by central difference across the wrap. The fragment stage
   * needs it for the gradient's tangential term -- grad u = (1/R) * radial - (R'/R^2) * tangential --
   * which is what leans the surface normal sideways near a non-circular boundary and so what makes a
   * shaped peak read as its shape rather than as a circle with a shaped edge. */
  rhoPrime: Float32Array;
}

export type PeakShapeResult = { ok: true; shape: PeakShape } | { ok: false; reason: string };

/* -------------------------------------------------------------------------- */
/* svg path parsing                                                            */
/* -------------------------------------------------------------------------- */

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

/** Reads one number, advancing the cursor past it. Hand-rolled rather than regex-driven because svg
 * path data is allowed to pack numbers with no separator at all when the sign or decimal point makes
 * the boundary unambiguous -- "1.5.5" is two numbers, "1-2" is two numbers -- and a scanner that
 * consumes exactly one number at a time gets that right by construction. */
function readNumber(c: Cursor): number | undefined {
  skipSeparators(c);
  const start = c.i;
  if (c.d[c.i] === "+" || c.d[c.i] === "-") c.i++;
  while (isDigit(c.d[c.i])) c.i++;
  if (c.d[c.i] === ".") {
    c.i++;
    while (isDigit(c.d[c.i])) c.i++;
  }
  // Only consume an exponent that actually has digits behind it -- otherwise the "e" of a following
  // command letter would be swallowed into the number.
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

/** Reads an arc's large-arc/sweep flag. These are the one place the grammar allows a bare "0"/"1"
 * with no separator after it ("a5 5 0 1150 5" is valid), so they cannot go through readNumber, which
 * would eat "1150" whole. */
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

/** Signed angle from u to v, the `angle` helper of the svg spec's endpoint-to-center arc conversion. */
function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return sign * Math.acos(Math.min(1, Math.max(-1, dot)));
}

/** Endpoint parameterization -> center parameterization -> sampled points, per svg 1.1 appendix
 * F.6.5. Arcs earn the ~40 lines because icon sets lean on them heavily for rounded silhouettes, and
 * an arc silently dropped to a straight chord is exactly the kind of "wrong but plausible" shape this
 * module exists to avoid. Returns points *after* `from`, so a caller appends them directly. */
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
  // A zero radius (or a degenerate arc to the same point) is defined to be a straight line.
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

  // Radii too small to span the endpoints are scaled up until they exactly do, per F.6.6.
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

/**
 * Flattens one `d` string into polylines, one per subpath. Every command in the svg 1.1 grammar is
 * handled (M/L/H/V/C/S/Q/T/A/Z, absolute and relative), because the input here is whatever file the
 * user picked out of their own library rather than something this codebase emitted -- unlike
 * parsePathPoints in mask-gl.ts, whose bare number-pair regex is sound only because the mesh
 * triangles it reads are always M/L/Z written by this application.
 *
 * Subpaths come back as point lists with no repeated closing point, whether or not they were closed
 * with Z: the consumer treats every subpath as a closed region regardless (an unclosed silhouette is
 * not a meaningful peak shape), so carrying the distinction would only invite a caller to forget it.
 */
export function flattenPathData(d: string): [number, number][][] {
  const subpaths: [number, number][][] = [];
  let current: [number, number][] = [];
  let point: [number, number] = [0, 0];
  let subpathStart: [number, number] = [0, 0];
  // The reflected control point S and T mirror, and which command produced it -- a smooth command
  // following anything else reflects nothing and uses the current point instead.
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
      // Junk before any command at all -- nothing sane to do but stop.
      break;
    } else if (command === "M") {
      // A repeated coordinate pair after M/m is an implicit L/l, per the grammar.
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
      // An unrecognised command letter would otherwise spin forever, since nothing consumed input.
      break;
    }

    // Same guard for a recognised command whose arguments were all rejected.
    if (cursor.i === startedAt) break;
  }

  flush();
  return subpaths;
}

/** Every `<path>` element's `d`, in document order. Regex rather than DOMParser for the same
 * no-DOM-in-tests reason the flattener is hand-rolled (see this module's own header). */
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

/* -------------------------------------------------------------------------- */
/* polygon geometry                                                            */
/* -------------------------------------------------------------------------- */

/** Signed shoelace area. Sign is winding direction, which nothing here cares about -- only |area|
 * is ever compared -- but it falls out of the same sum the centroid needs. */
export function polygonArea(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** The polygon's area centroid, which is where a shaped peak's epicenter sits.
 *
 * Not the bounding-box center, and the difference is load-bearing rather than cosmetic: rho(theta)
 * can only describe a silhouette that is star-shaped *about this specific point*, so the choice of
 * center decides which shapes are representable at all. The area centroid lies in the kernel of every
 * convex shape and of essentially every "one blob with lobes" icon, while a bbox center can sit
 * outside a perfectly reasonable crescent-adjacent shape and reject it needlessly. It is also the
 * point a user reads as the middle of the shape, which matters because it is what the epicenter
 * drag-handle will grab.
 *
 * Falls back to the vertex average for a degenerate (zero-area) ring, where the shoelace centroid
 * divides by zero. */
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

/** Whether `point` is inside `polygon`, by even-odd crossing count.
 *
 * Used only to tell a *hole* apart from a *detached piece* when refusing a multi-region svg. Both are
 * refused either way -- a peak's shape must be one solid outline -- so this never changes the verdict,
 * only which sentence the author is given. That distinction is worth its own function because the two
 * are different problems with different fixes: a hole means reaching for a filled variant of the same
 * icon, while detached pieces mean the icon was never a single silhouette to begin with. A strict gate
 * that cannot say which is the frustrating combination. */
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distances from `origin` to every crossing of the ray in direction (dx, dy) with the polygon's
 * boundary. The star-shaped test is entirely "is this array length exactly 1, for every angle".
 *
 * Edge membership is half-open in the segment parameter -- so a ray passing exactly through a vertex
 * crosses the two edges meeting there once in total rather than twice, which would otherwise report a
 * perfectly convex shape as non-star-shaped whenever a sample angle happened to line up with a corner.
 *
 * The half-open window is [-EDGE_EPSILON, 1 - EDGE_EPSILON) rather than a literal [0, 1), and the
 * tolerance is doing real work rather than being defensive garnish. A ray aimed exactly at a corner
 * is the *common* case here, not a pathological one: an axis-aligned square sampled at 128 evenly
 * spaced angles aims straight at all four of its corners, and its diagonal ray lands on s = -1e-16
 * because Math.cos(pi/4) and Math.sin(pi/4) differ by one ulp. Under a literal s >= 0 that corner
 * reports *zero* crossings and a plain square is rejected as not enclosing its own center. Shifting
 * both ends by the same epsilon preserves the counted-exactly-once property: a hit within epsilon of
 * an edge's end is excluded there and picked up as the next edge's start. */
const EDGE_EPSILON = 1e-9;

function rayCrossings(polygon: [number, number][], origin: [number, number], dx: number, dy: number): number[] {
  const hits: number[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const [px, py] = polygon[i];
    const [qx, qy] = polygon[(i + 1) % polygon.length];
    const ex = qx - px;
    const ey = qy - py;
    const denominator = dx * ey - dy * ex;
    // Parallel to the ray: either no crossing, or a collinear overlap whose endpoints are already
    // reported by the two edges either side of it.
    if (Math.abs(denominator) < 1e-12) continue;
    const wx = px - origin[0];
    const wy = py - origin[1];
    const t = (wx * ey - wy * ex) / denominator;
    const s = (wx * dy - wy * dx) / denominator;
    if (t > 1e-9 && s >= -EDGE_EPSILON && s < 1 - EDGE_EPSILON) hits.push(t);
  }
  return hits;
}

/* -------------------------------------------------------------------------- */
/* sampling                                                                    */
/* -------------------------------------------------------------------------- */

/** The angle of sample `index` of `samples`, sweeping [-pi, pi). Shared by the sampler and the tests
 * so neither can drift from the texel layout the shader will assume. */
export function sampleAngle(index: number, samples: number): number {
  return -Math.PI + (2 * Math.PI * index) / samples;
}

/** Casts `samples` rays from the polygon's centroid and returns the distance to the boundary at
 * each, or an error naming why the silhouette cannot be a peak shape.
 *
 * The "exactly one crossing" requirement *is* the star-shaped test, and rejecting rather than
 * coercing is deliberate: a crescent, a spiral, or an annulus has no rho(theta) at all, and the
 * plausible coercions (take the farthest crossing, take the nearest) both produce a solid blob that
 * is not the shape the user picked out of their library. Since the peak is authored by pointing at an
 * svg and seeing relief appear, a silently substituted shape reads as the feature being broken --
 * whereas a refusal at authoring time is a fact the user can act on. */
function sampleAngularRadii(
  polygon: [number, number][],
  samples: number,
): { ok: true; radii: number[]; center: [number, number] } | { ok: false; reason: string } {
  const center = polygonCentroid(polygon);
  const radii: number[] = [];
  for (let i = 0; i < samples; i++) {
    const angle = sampleAngle(i, samples);
    const hits = rayCrossings(polygon, center, Math.cos(angle), Math.sin(angle));
    if (hits.length === 0) {
      return {
        ok: false,
        reason: "the shape does not enclose its own center -- it may be open, or curl away from the middle",
      };
    }
    if (hits.length > 1) {
      return {
        ok: false,
        reason:
          "the shape is not star-shaped: a straight line from its center crosses the outline more " +
          "than once, so it has no single outline distance per direction (a crescent or spiral does this)",
      };
    }
    radii.push(hits[0]);
  }
  return { ok: true, radii, center };
}

/** Serializes a normalized ring as an M/L/Z `d`. Five decimals against a maximum radius of exactly 1
 * is ~1e-5 relative precision, far below one texel of the 128-sample table this is re-sampled into,
 * and keeps the persisted string small enough to sit comfortably on the peak document. */
function toPathData(points: [number, number][]): string {
  const format = (n: number): string => {
    const fixed = n.toFixed(5);
    // Trim trailing zeros, and a trailing "." or "-0" left behind by trimming them.
    const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
    return trimmed === "-0" ? "0" : trimmed;
  };
  const body = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${format(x)},${format(y)}`).join("");
  return `${body}Z`;
}

/** Derivative of a wrapped sample table by central difference. */
function differentiateWrapped(values: Float32Array): Float32Array {
  const n = values.length;
  const step = (2 * Math.PI) / n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (values[(i + 1) % n] - values[(i - 1 + n) % n]) / (2 * step);
  }
  return out;
}

/**
 * The whole authoring pipeline: raw silhouette rings -> validated, normalized, sampled PeakShape.
 *
 * `rings` is every subpath of every `<path>` in the source, pooled -- which of them is *the*
 * silhouette is decided here, by area, rather than by document order, because exporters routinely
 * emit the visible shape after a full-bleed background rect or an invisible bounding rect.
 *
 * A second ring with real area is rejected rather than ignored, for the same reason a non-star-shaped
 * outline is: it means the file depicts a hole or several separate pieces, and rho(theta) would
 * silently fill the hole in or drop the other pieces.
 */
export function buildPeakShapeFromRings(rings: [number, number][][], samples = PEAK_SHAPE_SAMPLES): PeakShapeResult {
  const usable = rings.filter((ring) => ring.length >= 3 && Math.abs(polygonArea(ring)) > 0);
  if (usable.length === 0) {
    return { ok: false, reason: "no closed region found in the svg -- a peak shape needs a filled outline" };
  }

  const byArea = [...usable].sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  const silhouette = byArea[0];
  const silhouetteArea = Math.abs(polygonArea(silhouette));
  const competing = byArea
    .slice(1)
    .filter((r) => Math.abs(polygonArea(r)) >= silhouetteArea * STRAY_SUBPATH_AREA_FRACTION);
  if (competing.length > 0) {
    // Refused either way (see this function's own doc comment), but named precisely -- a hole and a
    // detached piece send the author to different fixes.
    const allInside = competing.every((ring) => ring.every((point) => pointInPolygon(point, silhouette)));
    return {
      ok: false,
      reason: allInside
        ? `the svg's outline has ${competing.length === 1 ? "a hole" : `${competing.length} holes`} cut out of ` +
          "it -- a peak shape must be one solid outline, so try a filled version of the same shape"
        : `the svg is ${competing.length + 1} separate pieces -- a peak shape must be a single solid outline`,
    };
  }

  // Validated at a finer sweep than it is stored at -- see PEAK_SHAPE_VALIDATION_SAMPLES.
  const validation = sampleAngularRadii(silhouette, PEAK_SHAPE_VALIDATION_SAMPLES);
  if (!validation.ok) return validation;

  const sampled = sampleAngularRadii(silhouette, samples);
  if (!sampled.ok) return sampled;

  // Normalized against the true maximum over the *fine* sweep, so the stored table's own maximum can
  // only ever come in at or below 1 -- never above, which would put part of the shape outside the
  // peak's own `radius` and break the "a peak cannot disturb a vertex outside its radius" guarantee
  // that peakSwell's no-tearing argument rests on.
  const maxRadius = Math.max(...validation.radii);
  if (!(maxRadius > 0)) {
    return { ok: false, reason: "the shape has no measurable extent" };
  }

  const rho = new Float32Array(samples);
  for (let i = 0; i < samples; i++) rho[i] = sampled.radii[i] / maxRadius;

  const [cx, cy] = sampled.center;
  const normalized: [number, number][] = silhouette.map(([x, y]) => [(x - cx) / maxRadius, (y - cy) / maxRadius]);

  return { ok: true, shape: { path: toPathData(normalized), rho, rhoPrime: differentiateWrapped(rho) } };
}

/** Authoring entry point: an svg's markup (as decoded from LaurusSvgResult.markup) to a PeakShape. */
export function buildPeakShapeFromMarkup(markup: string, samples = PEAK_SHAPE_SAMPLES): PeakShapeResult {
  const paths = extractPathData(markup);
  if (paths.length === 0) {
    return { ok: false, reason: "the svg has no <path> element to take a shape from" };
  }
  return buildPeakShapeFromRings(
    paths.flatMap((d) => flattenPathData(d)),
    samples,
  );
}

/** Load-time entry point: re-samples an already-normalized, already-validated shape straight off the
 * persisted `d` (see PeakShape.path). Goes through the identical pipeline rather than a shortcut, so
 * a shape loaded from the server and a shape just authored cannot disagree -- the normalization is
 * idempotent (the stored ring's own centroid is the origin and its own maximum radius is 1), so this
 * is a re-derivation rather than a second, parallel implementation. */
export function samplePeakShapePath(path: string, samples = PEAK_SHAPE_SAMPLES): PeakShape | undefined {
  const result = buildPeakShapeFromRings(flattenPathData(path), samples);
  return result.ok ? result.shape : undefined;
}

const shapeCache = new Map<string, PeakShape | undefined>();

/**
 * samplePeakShapePath, memoized on the path itself -- the entry point the render path uses.
 *
 * The memo is not an optimization to reach for later; without it this feature is unusable. The
 * uniform assembly that consumes these runs on every animation frame (see resolvePeakUniforms in
 * project-mask-item.tsx), and sampling is emphatically not per-frame work: it flattens the outline,
 * then casts PEAK_SHAPE_VALIDATION_SAMPLES rays against every one of its edges, twice. Doing that
 * 60 times a second per peak would stall a drag outright.
 *
 * Keyed on the path because that string *is* the shape's identity -- it is normalized, so two peaks
 * wearing the same silhouette produce byte-identical keys and share one sampled table no matter which
 * mask or project they belong to. Undefined results are cached too, so a stored shape that somehow
 * fails to re-sample costs one attempt rather than one per frame forever.
 *
 * Unbounded on purpose. An entry is a couple of kilobytes, entries are only ever created by a peak
 * that actually exists in a loaded project, and a session's distinct shapes number in the tens -- so
 * an eviction policy would add a failure mode (re-sampling mid-drag) to solve nothing.
 */
export function cachedPeakShape(path: string): PeakShape | undefined {
  // The overwhelmingly common case, and it must not reach the Map at all: "" is a circle, which is
  // the absence of a shape rather than a shape that happens to be round.
  if (!path) return undefined;
  if (shapeCache.has(path)) return shapeCache.get(path);
  const shape = samplePeakShapePath(path);
  shapeCache.set(path, shape);
  return shape;
}
