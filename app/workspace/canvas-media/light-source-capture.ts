import { parsePathPoints } from "../mask-gl";
import { LaurusPolygonPath } from "../workspace.server";

// A lightweight, self-documenting marker embedded in a captured light source's own markup (as a
// `<metadata>` element -- an ordinary, non-rendering SVG element meant for exactly this). Not
// currently read back by anything (light sources are placed directly on capture, see canvas.tsx's
// placeLightSourceOnMask -- there's no drop-time detection to distinguish them from an ordinary
// svg anymore), but it costs nothing to keep and documents a captured svg's origin if that's ever
// useful again (e.g. distinguishing light sources in the svg browser).
const LIGHT_SOURCE_MARKER = "__light_source__";

/**
 * Decodes `SvgMediaResult.markup` (base64 of percent-escaped bytes) back into the raw inner
 * markup string -- the same atob -> percent-decode -> decodeURIComponent dance already used by
 * every render site (svg-browser.tsx, project-svg.tsx, camera.tsx, frame-browser.tsx).
 */
function decodeSvgMarkup(markup: string): string {
  try {
    return decodeURIComponent(
      atob(markup)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    return "";
  }
}

/**
 * Recovers a light source svg's captured triangles from its own saved markup -- the inverse of
 * trianglesToSvgMarkup's `<polygon points="x,y x,y x,y"/>` output. The coordinates are the
 * mask's own mesh-space numbers, untranslated (trianglesToSvgMarkup only crops the viewBox, it
 * never shifts the points themselves), so they line up directly with `parsePathPoints` output on
 * the source mask's own polygons -- see findHighlightedPolygonIndices.
 */
export function parseLightSourceTriangles(markup: string): [number, number][][] {
  const decoded = decodeSvgMarkup(markup);
  const triangles: [number, number][][] = [];
  const polygonRe = /<polygon\s+points="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = polygonRe.exec(decoded))) {
    const points = match[1]
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return [x, y] as [number, number];
      });
    if (points.length > 0) triangles.push(points);
  }
  return triangles;
}

function centroidOf(points: [number, number][]): [number, number] {
  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ];
}

/**
 * Which indices of `polygons` (a mask's own triangle mesh, in maskData.polygons order) a saved
 * light source svg's captured triangles correspond to -- matched by centroid, not exact point
 * equality, since the coordinates round-tripped through string serialization (still exact for
 * virtually all real values, but centroid-matching with a small epsilon is cheap insurance
 * against any edge-case float formatting difference). Used to highlight a mesh's covered
 * triangles when its wired light source becomes the active element -- see project-mask-item.tsx.
 */
export function findHighlightedPolygonIndices(polygons: LaurusPolygonPath[], lightSourceMarkup: string): Set<number> {
  const lightSourceCentroids = parseLightSourceTriangles(lightSourceMarkup).map(centroidOf);
  const EPSILON = 0.01;
  const indices = new Set<number>();
  polygons.forEach((polygon, i) => {
    const points = parsePathPoints(polygon.d);
    if (points.length === 0) return;
    const centroid = centroidOf(points);
    const matches = lightSourceCentroids.some(
      ([sx, sy]) => Math.abs(sx - centroid[0]) < EPSILON && Math.abs(sy - centroid[1]) < EPSILON,
    );
    if (matches) indices.add(i);
  });
  return indices;
}

/**
 * Which indices of a mesh's own polygons fall inside a capture circle -- centroid-in-circle,
 * matching the single "first/only match" hit-testing style already used elsewhere in this
 * codebase (e.g. the marquee's own select-mode test in canvas.tsx). `circle` is in the same
 * coordinate space as the polygons' own `d` strings (a mask's local mesh space, 0..width/0..height).
 *
 * Returns indices rather than the triangle points themselves so a capture can be held as a
 * pending, not-yet-uploaded candidate (see PendingLightSourceCapture, core-state.ts) -- the user
 * can redraw as many times as they like with zero server calls, and only trianglesFromIndices +
 * trianglesToSvgMarkup get called once they actually confirm one (workspace.client.tsx's
 * confirmLightSourceCapture).
 */
export function captureTriangleIndicesInCircle(
  polygons: LaurusPolygonPath[],
  circle: { cx: number; cy: number; radius: number },
): Set<number> {
  const indices = new Set<number>();
  polygons.forEach((polygon, i) => {
    const points = parsePathPoints(polygon.d);
    if (points.length === 0) return;
    const centroid = centroidOf(points);
    const dx = centroid[0] - circle.cx;
    const dy = centroid[1] - circle.cy;
    if (dx * dx + dy * dy <= circle.radius * circle.radius) indices.add(i);
  });
  return indices;
}

/** The inverse lookup: recovers actual triangle point arrays for a set of polygon indices. */
export function trianglesFromIndices(polygons: LaurusPolygonPath[], indices: Iterable<number>): [number, number][][] {
  const triangles: [number, number][][] = [];
  for (const i of indices) {
    const polygon = polygons[i];
    if (!polygon) continue;
    const points = parsePathPoints(polygon.d);
    if (points.length > 0) triangles.push(points);
  }
  return triangles;
}

/**
 * Builds a standalone svg document (root `<svg>` tag and all) out of a set of captured
 * triangles -- one flat-white `<polygon>` per triangle, cropped tight to their combined bounding
 * box via the viewBox rather than the source mesh's full canvas size. Sent to createSvg exactly
 * like a real dropped .svg file -- the server strips the root tag and derives
 * viewbox/fill/stroke on the way back (see createAndRegisterSvg, svg-upload-utils.ts).
 */
export function trianglesToSvgMarkup(triangles: [number, number][][]): {
  markup: string;
  width: number;
  height: number;
} {
  const allPoints = triangles.flat();
  const xs = allPoints.map(([x]) => x);
  const ys = allPoints.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const polygons = triangles
    .map((points) => `<polygon points="${points.map(([x, y]) => `${x},${y}`).join(" ")}" fill="#ffffff"/>`)
    .join("");

  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}"><metadata>${LIGHT_SOURCE_MARKER}</metadata>${polygons}</svg>`;

  return { markup, width, height };
}
