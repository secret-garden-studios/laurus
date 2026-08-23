import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centroidOf } from "./mask-geometry.ts";
import {
  indexedPolygonIndexAtPoint,
  indicesInObjectFromCentroids,
  polygonIndexAtPoint,
  translateIndices,
} from "./light-source-capture.ts";

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

describe("indexedPolygonIndexAtPoint -- the bucketed form of the linear scan", () => {
  it("finds the same triangle the linear scan does, everywhere on the mesh", () => {
    const { points, centroids } = grid();

    centroids.forEach((centroid) => {
      assert.equal(indexedPolygonIndexAtPoint(points, centroid), polygonIndexAtPoint(points, centroid));
    });
  });

  it("reports nothing for a point off the mesh", () => {
    const { points } = grid();

    assert.equal(indexedPolygonIndexAtPoint(points, [-50, -50]), undefined);
    assert.equal(indexedPolygonIndexAtPoint(points, [1000, 5]), undefined);
    assert.equal(indexedPolygonIndexAtPoint(points, [NaN, 5]), undefined);
  });
});

describe("translateIndices -- moving an object carries its own footprint", () => {
  it("shifts a footprint by whole cells without changing its size or arrangement", () => {
    const { points, centroids } = grid();
    const footprint = new Set([0, 1, 2, 3, 24, 25]);

    const moved = translateIndices(points, centroids, footprint, CELL, 0);

    assert.equal(moved.size, footprint.size);
    assert.deepEqual(
      [...moved].sort((a, b) => a - b),
      [...footprint].map((i) => i + 2).sort((a, b) => a - b),
    );
  });

  it("leaves a footprint alone when nothing moved", () => {
    const { points, centroids } = grid();
    const footprint = new Set([5, 9, 40]);

    assert.deepEqual(translateIndices(points, centroids, footprint, 0, 0), footprint);
  });

  it("keeps a hand-curated footprint that the object's own circle would not re-derive", () => {
    const { points, centroids } = grid();
    // A scattered set, the shape of what survives a manual review: nothing
    // about it is recoverable from a cx/cy/radius, which is the whole reason
    // a move has to carry it rather than recompute it.
    const curated = new Set([0, 3, 26, 27, 50, 51, 100]);
    const circle = { cx: 60, cy: 60, radius: 45, shape: "" };
    assert.notDeepEqual(indicesInObjectFromCentroids(centroids, circle), curated);

    const moved = translateIndices(points, centroids, curated, CELL * 2, CELL);

    assert.equal(moved.size, curated.size);
    const before = [...curated].map((i) => centroids[i]);
    const after = [...moved].map((i) => centroids[i]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const expected = before
      .map(([x, y]): [number, number] => [x + CELL * 2, y + CELL])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    after.forEach(([x, y], i) => {
      assert.ok(Math.abs(x - expected[i][0]) < 1e-6);
      assert.ok(Math.abs(y - expected[i][1]) < 1e-6);
    });
  });

  it("drops the triangles a move pushes off the mesh, and only those", () => {
    const { points, centroids } = grid();
    const alongTheRightEdge = new Set([0, 1, points.length - 2, points.length - 1]);

    const moved = translateIndices(points, centroids, alongTheRightEdge, CELL * (COLS - 1), 0);

    assert.equal(moved.size, 2);
  });
});
