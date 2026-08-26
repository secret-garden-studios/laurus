import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { objectSwellAt } from "../mask-gl.ts";
import { centroidOf } from "./mask-geometry.ts";
import {
  indicesInObjectFromCentroids,
  lightIdAtPoint,
  polygonIndexAtPoint,
  swelledPolygonIndexAtPoint,
} from "./light-geometry.ts";
import { cachedObjectShape, objectShapeDepthAt } from "./object-shape.ts";

const CELL = 10;
const COLS = 12;
const ROWS = 12;

function grid(): { points: [number, number][][]; centroids: [number, number][] } {
  const points: [number, number][][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * CELL;
      const y = row * CELL;
      points.push([
        [x, y],
        [x + CELL, y],
        [x, y + CELL],
      ]);
      points.push([
        [x + CELL, y],
        [x + CELL, y + CELL],
        [x, y + CELL],
      ]);
    }
  }
  return { points, centroids: points.map(centroidOf) };
}

describe("swelledPolygonIndexAtPoint -- picking the triangle the shader actually drew", () => {
  const flat = { cx: 60, cy: 60, radius: 40, elevation: 0, falloff: 2, shape: undefined, fill: undefined };
  const raised = { ...flat, elevation: 50 };

  it("falls back to the plain scan when nothing on the mesh is swollen", () => {
    const { points, centroids } = grid();

    centroids.forEach((centroid) => {
      assert.equal(
        swelledPolygonIndexAtPoint(points, [flat], centroid),
        polygonIndexAtPoint(points, centroid),
        `centroid ${centroid}`,
      );
    });
  });

  it("picks the triangle whose swollen corners surround the click, not its stored ones", () => {
    const { points, centroids } = grid();
    let disagreements = 0;

    points.forEach((triangle, i) => {
      const drawn = centroidOf(triangle.map((p) => swelled(p, raised)));
      const picked = swelledPolygonIndexAtPoint(points, [raised], drawn);
      assert.equal(picked, i, `triangle ${i} drawn at ${drawn}`);
      if (polygonIndexAtPoint(points, drawn) !== i) disagreements++;
    });

    assert.ok(disagreements > 0, "the plain scan should have been wrong somewhere, or this proves nothing");
    assert.equal(centroids.length, points.length);
  });

  it("still reports nothing for a point off the mesh", () => {
    const { points } = grid();

    assert.equal(swelledPolygonIndexAtPoint(points, [raised], [-5, -5]), undefined);
    assert.equal(swelledPolygonIndexAtPoint(points, [raised], [COLS * CELL + 5, 5]), undefined);
  });
});

function swelled(point: [number, number], object: Parameters<typeof objectSwellAt>[1][number]): [number, number] {
  const [dx, dy] = objectSwellAt(point, [object]);
  return [point[0] + dx, point[1] + dy];
}

describe("lightIdAtPoint -- reading the light off the mesh as drawn", () => {
  function halved(): { polygons: { light_id: number }[]; points: [number, number][][] } {
    const { points } = grid();
    const polygons = points.map((triangle) => ({
      light_id: triangle.every(([x]) => x <= (COLS * CELL) / 2) ? 1 : 0,
    }));
    return { polygons, points };
  }

  it("leaves the answer alone when no object bends the mesh", () => {
    const { polygons, points } = halved();
    const flat = { cx: 60, cy: 60, radius: 40, elevation: 0, falloff: 2, shape: undefined, fill: undefined };

    assert.equal(lightIdAtPoint(polygons as never, points, [flat], [10, 60]), 1);
    assert.equal(lightIdAtPoint(polygons as never, points, [], [10, 60]), 1);
    assert.equal(lightIdAtPoint(polygons as never, points, [], [COLS * CELL - 5, 60]), undefined);
  });

  it("stretches the light's bounds the way the shader stretched its triangles", () => {
    const { polygons, points } = halved();
    const raised = { cx: 30, cy: 60, radius: 50, elevation: 60, falloff: 2, shape: undefined, fill: undefined };

    const flatEdge = Math.max(
      ...points.flatMap((triangle, i) => (polygons[i].light_id === 1 ? triangle.map(([x]) => x) : [])),
    );
    const drawnEdge = Math.max(
      ...points.flatMap((triangle, i) =>
        polygons[i].light_id === 1 ? triangle.map((corner) => corner[0] + objectSwellAt(corner, [raised])[0]) : [],
      ),
    );
    assert.ok(drawnEdge > flatEdge, "the swell should have pushed the light's edge outwards");

    const justPastFlatEdge: [number, number] = [(flatEdge + drawnEdge) / 2, 60];
    assert.equal(lightIdAtPoint(polygons as never, points, [], justPastFlatEdge), undefined);
    assert.equal(lightIdAtPoint(polygons as never, points, [raised], justPastFlatEdge), 1);
  });
});

describe("indicesInObjectFromCentroids -- the outline decides membership", () => {
  const centroids: [number, number][] = [];
  for (let y = 0; y <= 200; y += 4) for (let x = 0; x <= 200; x += 4) centroids.push([x, y]);

  // a crescent: a disc with a bite taken out of the +x side, normalized the
  // way a stored shape is
  const CRESCENT = "M0,-1L0.6,-0.8L0.25,-0.45L0.1,0L0.25,0.45L0.6,0.8L0,1" + "L-0.71,0.71L-1,0L-0.71,-0.71Z";

  it("takes every triangle the outline encloses and no other", () => {
    const object = { cx: 100, cy: 100, radius: 60, shape: CRESCENT };
    const inside = indicesInObjectFromCentroids(centroids, object);

    // the invariant that makes the shape editor's snap meaningful: membership
    // is a function of the outline, so it must agree with the outline
    const shape = cachedObjectShape(CRESCENT);
    assert.ok(shape);
    centroids.forEach((centroid, i) => {
      const depth = objectShapeDepthAt(
        shape,
        (centroid[0] - object.cx) / object.radius,
        (centroid[1] - object.cy) / object.radius,
      );
      // a texel of slack either side of the boundary, where the rasterized
      // field and the bilinear read of it can legitimately disagree
      if (Math.abs(depth) < 0.02) return;
      assert.equal(inside.has(i), depth > 0, `centroid ${centroid} at depth ${depth.toFixed(4)}`);
    });
  });

  it("leaves the bite out, which a circle of the same radius would swallow", () => {
    const object = { cx: 100, cy: 100, radius: 60, shape: CRESCENT };
    const shaped = indicesInObjectFromCentroids(centroids, object);
    const round = indicesInObjectFromCentroids(centroids, { ...object, shape: "" });
    assert.ok(shaped.size < round.size * 0.85, `crescent ${shaped.size} vs circle ${round.size}`);
  });

  it("follows the outline when it is reshaped, rather than staying put", () => {
    // what the shape editor relies on: a different outline is a different set
    const before = indicesInObjectFromCentroids(centroids, {
      cx: 100,
      cy: 100,
      radius: 60,
      shape: CRESCENT,
    });
    const after = indicesInObjectFromCentroids(centroids, {
      cx: 100,
      cy: 100,
      radius: 60,
      shape: "M0,-1L1,-1L1,1L0,1L-0.4,0Z",
    });
    assert.notDeepEqual([...before].sort(), [...after].sort());
    assert.ok(after.size > 0 && before.size > 0);
  });
});
