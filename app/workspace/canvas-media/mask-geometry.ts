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
