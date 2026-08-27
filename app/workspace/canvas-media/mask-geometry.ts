import { buildWeldedMaskPointGroups, colorToRGB01 } from "../mask-gl.ts";
import type { LaurusPolygonPath } from "../workspace.server";

export interface MaskGeometry {
  corners: [number, number][];
  points: [number, number][][];
  centroids: [number, number][];
}

export interface MaskGeometrySource {
  width: number;
  height: number;
  polygons: LaurusPolygonPath[];
  curves: { d: string }[];
}

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

/**
 * The triangles a light or an object currently claims.
 *
 * Membership is recorded the other way round -- every polygon carries the id
 * of whatever tagged it -- so anything wanting one region's own triangles has
 * to sweep the mesh for them. Enough things do, and in enough different
 * corners (every way into the pen, the revert, a recorded decision), that the
 * sweep is worth having in one place rather than rewritten wherever it is
 * needed.
 */
export function polygonIndicesForObject(polygons: LaurusPolygonPath[] | undefined, objectId: number): number[] {
  return polygonIndicesWhere(polygons, (p) => p.object_id === objectId);
}

export function polygonIndicesForLight(polygons: LaurusPolygonPath[] | undefined, lightId: number): number[] {
  return polygonIndicesWhere(polygons, (p) => p.light_id === lightId);
}

function polygonIndicesWhere(
  polygons: LaurusPolygonPath[] | undefined,
  claimed: (polygon: LaurusPolygonPath) => boolean,
): number[] {
  const indices: number[] = [];
  polygons?.forEach((polygon, index) => {
    if (claimed(polygon)) indices.push(index);
  });
  return indices;
}

export function carryGeometryForward(from: LaurusPolygonPath[], to: LaurusPolygonPath[]): void {
  if (from === to) return;
  const cached = cache.get(from);
  if (cached) cache.set(to, cached);
  const cachedColors = colorCache.get(from);
  if (cachedColors) colorCache.set(to, cachedColors);
}

const colorCache = new WeakMap<LaurusPolygonPath[], [number, number, number][]>();

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
