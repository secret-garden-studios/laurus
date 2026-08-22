export const OBJECT_SHAPE_SAMPLES = 128;
export const OBJECT_SHAPE_VALIDATION_SAMPLES = OBJECT_SHAPE_SAMPLES * 4;
const CURVE_SEGMENTS = 48;
const STRAY_SUBPATH_AREA_FRACTION = 0.01;

export interface ObjectShape {
  path: string;
  rho: Float32Array;
  rhoPrime: Float32Array;
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

const EDGE_EPSILON = 1e-9;

function rayCrossings(polygon: [number, number][], origin: [number, number], dx: number, dy: number): number[] {
  const hits: number[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const [px, py] = polygon[i];
    const [qx, qy] = polygon[(i + 1) % polygon.length];
    const ex = qx - px;
    const ey = qy - py;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const wx = px - origin[0];
    const wy = py - origin[1];
    const t = (wx * ey - wy * ex) / denominator;
    const s = (wx * dy - wy * dx) / denominator;
    if (t > 1e-9 && s >= -EDGE_EPSILON && s < 1 - EDGE_EPSILON) hits.push(t);
  }
  return hits;
}

export function sampleAngle(index: number, samples: number): number {
  return -Math.PI + (2 * Math.PI * index) / samples;
}

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

function toPathData(points: [number, number][]): string {
  const format = (n: number): string => {
    const fixed = n.toFixed(5);
    const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
    return trimmed === "-0" ? "0" : trimmed;
  };
  const body = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${format(x)},${format(y)}`).join("");
  return `${body}Z`;
}

function differentiateWrapped(values: Float32Array): Float32Array {
  const n = values.length;
  const step = (2 * Math.PI) / n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (values[(i + 1) % n] - values[(i - 1 + n) % n]) / (2 * step);
  }
  return out;
}

export function buildObjectShapeFromRings(
  rings: [number, number][][],
  samples = OBJECT_SHAPE_SAMPLES,
): ObjectShapeResult {
  const usable = rings.filter((ring) => ring.length >= 3 && Math.abs(polygonArea(ring)) > 0);
  if (usable.length === 0) {
    return { ok: false, reason: "no closed region found in the svg -- an object shape needs a filled outline" };
  }

  const byArea = [...usable].sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  const silhouette = byArea[0];
  const silhouetteArea = Math.abs(polygonArea(silhouette));
  const competing = byArea
    .slice(1)
    .filter((r) => Math.abs(polygonArea(r)) >= silhouetteArea * STRAY_SUBPATH_AREA_FRACTION);
  if (competing.length > 0) {
    const allInside = competing.every((ring) => ring.every((point) => pointInPolygon(point, silhouette)));
    return {
      ok: false,
      reason: allInside
        ? `the svg's outline has ${competing.length === 1 ? "a hole" : `${competing.length} holes`} cut out of ` +
          "it -- an object shape must be one solid outline, so try a filled version of the same shape"
        : `the svg is ${competing.length + 1} separate pieces -- an object shape must be a single solid outline`,
    };
  }

  const validation = sampleAngularRadii(silhouette, OBJECT_SHAPE_VALIDATION_SAMPLES);
  if (!validation.ok) return validation;

  const sampled = sampleAngularRadii(silhouette, samples);
  if (!sampled.ok) return sampled;

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

export function buildObjectShapeFromMarkup(markup: string, samples = OBJECT_SHAPE_SAMPLES): ObjectShapeResult {
  const paths = extractPathData(markup);
  if (paths.length === 0) {
    return { ok: false, reason: "the svg has no <path> element to take a shape from" };
  }
  return buildObjectShapeFromRings(
    paths.flatMap((d) => flattenPathData(d)),
    samples,
  );
}

export function sampleObjectShapePath(path: string, samples = OBJECT_SHAPE_SAMPLES): ObjectShape | undefined {
  const result = buildObjectShapeFromRings(flattenPathData(path), samples);
  return result.ok ? result.shape : undefined;
}

const shapeCache = new Map<string, ObjectShape | undefined>();

export function cachedObjectShape(path: string): ObjectShape | undefined {
  if (!path) return undefined;
  if (shapeCache.has(path)) return shapeCache.get(path);
  const shape = sampleObjectShapePath(path);
  shapeCache.set(path, shape);
  return shape;
}
