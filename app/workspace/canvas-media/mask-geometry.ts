// Explicit .ts specifier (allowImportingTsExtensions is on): this module is
// reached at runtime by the node test runner, which does not resolve
// extensionless relative paths.
import { buildWeldedMaskPointGroups, colorToRGB01 } from "../mask-gl.ts";
import type { LaurusPolygonPath } from "../workspace.server";

/** A mask's parsed triangle geometry: the one place polygon path strings are
 *  turned into numbers.
 *
 *  Every mask interaction used to re-derive this from `polygons[].d` --
 *  hit tests, capture/object membership queries, the light source's rest
 *  position, and the mesh build itself, each parsing the same strings again.
 *  On a dense mesh that is thousands of regex passes per click or per drag
 *  commit, and it grew a copy every time a new interaction was added.
 *
 *  The points are welded (see weldPoints in mask-gl), which is what the mesh
 *  is built from, so hit tests measure exactly the triangles that were drawn
 *  rather than a separately-parsed near-copy of them. */
export interface MaskGeometry {
  /** Frame corners, welded alongside the polygons -- the mesh's own backing
   *  quad. Empty when the mask has no silhouette curves. */
  corners: [number, number][];
  /** Welded vertices per polygon, indexed like `polygons`. */
  points: [number, number][][];
  /** Centroid per polygon, indexed like `polygons`. `[NaN, NaN]` for a
   *  polygon whose path parsed to nothing, matching what the centroid
   *  consumers already skip on. */
  centroids: [number, number][];
}

export interface MaskGeometrySource {
  width: number;
  height: number;
  polygons: LaurusPolygonPath[];
  curves: { d: string }[];
}

/** Keyed by the `polygons` array itself rather than by mask id: a mask's
 *  geometry is a pure function of that array, so identity is exactly the
 *  right invalidation signal, and a WeakMap means an unmounted mask's
 *  geometry is collected without anyone having to remember to evict it. */
const cache = new WeakMap<LaurusPolygonPath[], MaskGeometry>();

export function centroidOf(points: [number, number][]): [number, number] {
  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ];
}

export function maskGeometry(maskData: MaskGeometrySource): MaskGeometry {
  const cached = cache.get(maskData.polygons);
  if (cached) return cached;

  const { corners, polygonPointSets } = buildWeldedMaskPointGroups(maskData);
  const geometry: MaskGeometry = {
    corners,
    points: polygonPointSets,
    centroids: polygonPointSets.map((points) =>
      points.length === 0 ? ([NaN, NaN] as [number, number]) : centroidOf(points),
    ),
  };
  cache.set(maskData.polygons, geometry);
  return geometry;
}

/** Hand an already-parsed geometry to a new polygons array.
 *
 *  An object or capture edit rewrites `polygons` only to change `object_id` /
 *  `capture_id` tags -- every `d` is byte-identical -- so the new array is a
 *  cache miss that would re-parse geometry we already have. Delta application
 *  calls this instead. Only safe when the caller knows no path data changed,
 *  which is why it is a deliberate call rather than something inferred. */
export function carryGeometryForward(from: LaurusPolygonPath[], to: LaurusPolygonPath[]): void {
  if (from === to) return;
  const cached = cache.get(from);
  if (cached) cache.set(to, cached);
  const cachedColors = colorCache.get(from);
  if (cachedColors) colorCache.set(to, cachedColors);
}

const colorCache = new WeakMap<LaurusPolygonPath[], [number, number, number][]>();

/** Each polygon's fill resolved to RGB01, cached like the geometry above and
 *  carried across edits by the same call.
 *
 *  Worth caching for the same reason parsing is: colorToRGB01 sets a canvas
 *  fillStyle and reads it back, so resolving fills for a dense mask is
 *  thousands of canvas round-trips -- and a fill, like a path, is untouched by
 *  every object and capture edit. */
export function maskPolygonColors(
  polygons: LaurusPolygonPath[],
  colorCtx: CanvasRenderingContext2D,
): [number, number, number][] {
  const cached = colorCache.get(polygons);
  if (cached) return cached;
  const colors = polygons.map((polygon) => colorToRGB01(colorCtx, polygon.fill));
  colorCache.set(polygons, colors);
  return colors;
}
