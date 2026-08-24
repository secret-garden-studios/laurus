import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shapeOutline, polygonArea2, insideRings, type Point } from "./object-clip.ts";
import {
  boundaryParam,
  clipSegmentToConvex,
  earClip,
  outlineChains,
  retouchDelta,
  retouchMesh,
  retouchTriangle,
  splitCell,
} from "./object-retouch.ts";
import type { LaurusPolygonPath } from "../workspace.server";

/** A square from -1 to 1, as a closed path in normalized shape units. */
const SQUARE = "M -1,-1 L 1,-1 L 1,1 L -1,1 Z";
/** A square with a square hole in the middle of it. */
const ANNULUS = `${SQUARE} M -0.4,-0.4 L -0.4,0.4 L 0.4,0.4 L 0.4,-0.4 Z`;

const tri = (a: Point, b: Point, c: Point): Point[] => [a, b, c];

function area(points: Point[]): number {
  return Math.abs(polygonArea2(points));
}

function pointsOf(d: string): Point[] {
  return [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m): Point => [parseFloat(m[1]), parseFloat(m[2])]);
}

function polygon(d: string): LaurusPolygonPath {
  return { d, fill: "#808080", stroke: "none", stroke_width: 0, capture_id: 0, object_id: 0 };
}

describe("clipSegmentToConvex", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("passes a segment that lies wholly inside", () => {
    assert.deepEqual(clipSegmentToConvex([2, 2], [8, 8], square), [0, 1]);
  });

  it("rejects a segment that misses entirely", () => {
    assert.equal(clipSegmentToConvex([20, 20], [30, 30], square), undefined);
  });

  it("reports where a segment enters and leaves", () => {
    const range = clipSegmentToConvex([-10, 5], [10, 5], square)!;
    assert.ok(Math.abs(range[0] - 0.5) < 1e-9, `entered at ${range[0]}`);
    assert.equal(range[1], 1);
  });

  it("clips both ends of a chord that crosses right through", () => {
    const range = clipSegmentToConvex([-5, 5], [15, 5], square)!;
    assert.ok(Math.abs(range[0] - 0.25) < 1e-9, `entered at ${range[0]}`);
    assert.ok(Math.abs(range[1] - 0.75) < 1e-9, `left at ${range[1]}`);
  });
});

describe("outlineChains", () => {
  const triangle = tri([0, 0], [10, 0], [0, 10]);

  it("finds nothing when the outline misses the triangle", () => {
    const outline = shapeOutline(SQUARE, { cx: 100, cy: 100, radius: 1 })!;
    assert.deepEqual(outlineChains(triangle, outline.all), []);
  });

  it("walks a chain from one edge to another", () => {
    // a big square whose corner cuts across the triangle
    const outline = shapeOutline(SQUARE, { cx: -3, cy: -3, radius: 8 })!;
    const chains = outlineChains(triangle, outline.all)!;
    assert.equal(chains.length, 1);
    // both feet on the triangle's boundary
    assert.notEqual(boundaryParam(triangle, chains[0][0]), undefined);
    assert.notEqual(boundaryParam(triangle, chains[0][chains[0].length - 1]), undefined);
  });

  it("refuses a ring that sits wholly inside, which is a hole rather than a cut", () => {
    const outline = shapeOutline(SQUARE, { cx: 2, cy: 2, radius: 1 })!;
    assert.equal(outlineChains(triangle, outline.all), undefined);
  });

  it("thins a densely flattened curve down to the triangle's own scale", () => {
    // a circle traced at a hundred points, far denser than a 10px triangle
    // could ever need
    const ring: Point[] = [];
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      ring.push([5 + 20 * Math.cos(angle), 5 + 20 * Math.sin(angle)]);
    }
    const chains = outlineChains(triangle, [ring])!;
    const total = chains.reduce((sum, chain) => sum + chain.length, 0);
    assert.ok(total < 12, `kept ${total} points for a 10px triangle`);
  });
});

describe("boundaryParam", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("reads a point halfway along the first edge", () => {
    assert.ok(Math.abs(boundaryParam(square, [5, 0])! - 0.5) < 1e-6);
  });

  it("reads a vertex as the start of its own edge", () => {
    assert.ok(Math.abs(boundaryParam(square, [10, 10])! - 2) < 1e-6);
  });

  it("refuses a point off the boundary", () => {
    assert.equal(boundaryParam(square, [5, 5]), undefined);
  });
});

describe("splitCell", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("halves a square along a straight chord, losing no area", () => {
    const [left, right] = splitCell(square, [
      [5, 0],
      [5, 10],
    ])!;
    assert.ok(Math.abs(area(left) - 50) < 1e-6, `left was ${area(left)}`);
    assert.ok(Math.abs(area(right) - 50) < 1e-6, `right was ${area(right)}`);
  });

  it("keeps the whole area when the chain wanders", () => {
    const [a, b] = splitCell(square, [
      [0, 5],
      [3, 7],
      [7, 2],
      [10, 5],
    ])!;
    assert.ok(Math.abs(area(a) + area(b) - 100) < 1e-6, `${area(a)} + ${area(b)}`);
  });

  it("cuts a cap off a single edge when both feet land on it", () => {
    const [a, b] = splitCell(square, [
      [2, 0],
      [5, 3],
      [8, 0],
    ])!;
    const [cap, rest] = [area(a), area(b)].sort((x, y) => x - y);
    assert.ok(Math.abs(cap - 9) < 1e-6, `cap was ${cap}`);
    assert.ok(Math.abs(cap + rest - 100) < 1e-6);
  });

  it("refuses a chain whose feet are not on the boundary", () => {
    assert.equal(
      splitCell(square, [
        [3, 3],
        [6, 6],
      ]),
      undefined,
    );
  });
});

describe("earClip", () => {
  it("leaves a triangle alone", () => {
    assert.equal(earClip(tri([0, 0], [1, 0], [0, 1])).length, 1);
  });

  it("triangulates a concave polygon without spilling outside it", () => {
    // an arrowhead: the notch at [5,5] is what a centroid fan gets wrong
    const arrow: Point[] = [
      [0, 0],
      [10, 0],
      [5, 5],
      [10, 10],
      [0, 10],
    ];
    const triangles = earClip(arrow);
    const total = triangles.reduce((sum, t) => sum + area(t), 0);
    assert.ok(Math.abs(total - area(arrow)) < 1e-6, `${total} vs ${area(arrow)}`);
    // every piece's own middle has to be inside the polygon it came from
    for (const triangle of triangles) {
      const middle: Point = [
        (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3,
        (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3,
      ];
      assert.ok(insideRings([arrow], middle), `a fragment centred at ${middle} fell outside the arrowhead`);
    }
  });
});

describe("retouchTriangle", () => {
  it("leaves a triangle the outline does not reach", () => {
    const outline = shapeOutline(SQUARE, { cx: 100, cy: 100, radius: 1 })!;
    assert.equal(retouchTriangle(tri([0, 0], [10, 0], [0, 10]), outline), undefined);
  });

  it("leaves a triangle wholly inside the outline", () => {
    const outline = shapeOutline(SQUARE, { cx: 0, cy: 0, radius: 100 })!;
    assert.equal(retouchTriangle(tri([0, 0], [10, 0], [0, 10]), outline), undefined);
  });

  it("cuts a straddling triangle into inside and outside fragments", () => {
    const outline = shapeOutline(SQUARE, { cx: 0, cy: 0, radius: 5 })!;
    const triangle = tri([0, 0], [10, 0], [0, 10]);
    const fragments = retouchTriangle(triangle, outline)!;
    assert.ok(
      fragments.some((f) => f.inside),
      "nothing came out inside",
    );
    assert.ok(
      fragments.some((f) => !f.inside),
      "nothing came out outside -- the cut-away half was dropped",
    );
  });

  it("conserves the triangle's area across the cut", () => {
    const outline = shapeOutline(SQUARE, { cx: 0, cy: 0, radius: 5 })!;
    const triangle = tri([0, 0], [10, 0], [0, 10]);
    const fragments = retouchTriangle(triangle, outline)!;
    const total = fragments.reduce((sum, f) => sum + area(f.points), 0);
    assert.ok(Math.abs(total - area(triangle)) < 1e-3, `${total} vs ${area(triangle)}`);
  });

  it("puts the fragments on the right sides of the curve", () => {
    const outline = shapeOutline(SQUARE, { cx: 0, cy: 0, radius: 5 })!;
    const fragments = retouchTriangle(tri([0, 0], [10, 0], [0, 10]), outline)!;
    for (const fragment of fragments) {
      const middle: Point = [
        (fragment.points[0][0] + fragment.points[1][0] + fragment.points[2][0]) / 3,
        (fragment.points[0][1] + fragment.points[1][1] + fragment.points[2][1]) / 3,
      ];
      assert.equal(insideRings(outline.all, middle), fragment.inside, `fragment centred at ${middle} was mislabelled`);
    }
  });

  it("is watertight: neighbours agree about where the curve crosses their shared edge", () => {
    const outline = shapeOutline(SQUARE, { cx: 0, cy: 0, radius: 5 })!;
    const shared: [Point, Point] = [
      [-8, 2],
      [8, 2],
    ];
    const above = retouchTriangle([shared[0], shared[1], [0, -9]], outline)!;
    const below = retouchTriangle([shared[1], shared[0], [0, 9]], outline)!;

    // every fragment vertex that lies on the shared edge, from either side
    const onEdge = (fragments: typeof above): number[] =>
      [
        ...new Set(
          fragments
            .flatMap((f) => f.points)
            .filter((p) => Math.abs(p[1] - 2) < 1e-6 && p[0] > shared[0][0] && p[0] < shared[1][0])
            .map((p) => Math.round(p[0] * 1e6) / 1e6),
        ),
      ].sort((a, b) => a - b);

    assert.deepEqual(onEdge(above), onEdge(below));
  });

  it("cuts against a hole's rim as readily as the outer boundary", () => {
    const outline = shapeOutline(ANNULUS, { cx: 0, cy: 0, radius: 10 })!;
    // straddles the hole's left wall at x = -4
    const fragments = retouchTriangle(tri([-6, -1], [-1, -1], [-6, 3]), outline)!;
    assert.ok(
      fragments.some((f) => f.inside) && fragments.some((f) => !f.inside),
      "the hole's rim did not cut the triangle in two",
    );
  });
});

describe("retouchMesh", () => {
  // a two-by-two grid of 10px cells, each split into two triangles
  const mesh: { polygons: LaurusPolygonPath[]; points: Point[][] } = (() => {
    const points: Point[][] = [];
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 2; column++) {
        const x = column * 10;
        const y = row * 10;
        points.push([
          [x, y],
          [x + 10, y],
          [x, y + 10],
        ]);
        points.push([
          [x + 10, y],
          [x + 10, y + 10],
          [x, y + 10],
        ]);
      }
    }
    return {
      points,
      polygons: points.map((triangle) => polygon(`M ${triangle.map(([px, py]) => `${px},${py}`).join(" L ")} Z`)),
    };
  })();

  // spans [2,8] in both axes, so it straddles the two triangles of the first
  // cell and comes nowhere near the other three cells
  const outline = shapeOutline(SQUARE, { cx: 5, cy: 5, radius: 3 })!;

  it("keeps every original index pointing at the same place", () => {
    const before = mesh.polygons.length;
    const result = retouchMesh(mesh.polygons, mesh.points, outline);
    assert.equal(result.polygons.length, before + result.added);
    assert.ok(result.added > 0, "nothing was cut");
  });

  it("leaves untouched polygons as the very same object", () => {
    const result = retouchMesh(mesh.polygons, mesh.points, outline);
    // everything past the first cell is clear of an outline spanning [2,8]
    for (let index = 2; index < mesh.polygons.length; index++) {
      assert.equal(result.polygons[index], mesh.polygons[index], `polygon ${index} was rebuilt for nothing`);
    }
  });

  it("never mutates the mesh it was handed", () => {
    const snapshot = mesh.polygons.map((p) => p.d);
    retouchMesh(mesh.polygons, mesh.points, outline);
    assert.deepEqual(
      mesh.polygons.map((p) => p.d),
      snapshot,
    );
  });

  it("reports membership that matches the outline it cut against", () => {
    const result = retouchMesh(mesh.polygons, mesh.points, outline);
    assert.ok(result.indices.size > 0, "the outline enclosed nothing");
    for (const index of result.indices) {
      const numbers = pointsOf(result.polygons[index].d);
      const middle: Point = [
        numbers.reduce((sum, p) => sum + p[0], 0) / numbers.length,
        numbers.reduce((sum, p) => sum + p[1], 0) / numbers.length,
      ];
      assert.ok(insideRings(outline.all, middle), `polygon ${index}, centred at ${middle}, is not inside the outline`);
    }
  });

  it("carries a neighbouring object's tag onto the fragments it cut from it", () => {
    // polygon 0 straddles the outline, so it is one the recut takes apart --
    // and it belongs to an object accepted long before this review started
    const tagged = mesh.polygons.map((p, i) => (i === 0 ? { ...p, object_id: 7 } : p));
    const before = tagged.filter((p) => p.object_id === 7).length;
    const result = retouchMesh(tagged, mesh.points, outline);
    const after = result.polygons.filter((p) => p.object_id === 7);
    assert.ok(after.length > before, "polygon 0 was not cut, so this proves nothing -- pick another fixture");
    const area = after.reduce((sum, p) => sum + Math.abs(polygonArea2(pointsOf(p.d))), 0);
    assert.ok(
      Math.abs(area - Math.abs(polygonArea2(mesh.points[0]))) < 1e-3,
      "an accepted neighbour lost area to the recut",
    );
  });
});

describe("retouchDelta", () => {
  const polygon = (d: string): LaurusPolygonPath => ({
    d,
    fill: "#808080",
    stroke: "none",
    stroke_width: 0,
    capture_id: 0,
    object_id: 0,
  });

  it("names the slots whose geometry moved, and nothing else", () => {
    const restore = [polygon("a"), polygon("b"), polygon("c")];
    const polygons = [restore[0], polygon("b-cut"), restore[2], polygon("new")];
    const delta = retouchDelta({ polygons, restore, added: 1 });

    assert.deepEqual(delta.replaced, [{ index: 1, d: "b-cut" }]);
    assert.deepEqual(
      delta.added.map((p) => p.d),
      ["new"],
    );
  });

  it("reads the appended entries off the tail", () => {
    const restore = [polygon("a"), polygon("b")];
    const polygons = [...restore, polygon("x"), polygon("y")];
    const delta = retouchDelta({ polygons, restore, added: 2 });

    assert.equal(delta.replaced.length, 0);
    assert.deepEqual(
      delta.added.map((p) => p.d),
      ["x", "y"],
    );
  });

  it("measures a second recut from the mesh the mask was found with", () => {
    // what the reducer composes: `restore` stays the original and `added` is
    // the running total, so the boundary between replaced and appended lands
    // where the server's own copy still ends
    const original = [polygon("a"), polygon("b")];
    const first = [original[0], polygon("b1"), polygon("x")];
    const second = [original[0], polygon("b2"), polygon("x2"), polygon("y")];

    const delta = retouchDelta({ polygons: second, restore: original, added: 1 + 1 });

    // only slots the server actually has may be named as replacements
    for (const { index } of delta.replaced) {
      assert.ok(index < original.length, `named slot ${index}, but the server's mesh ends at ${original.length}`);
    }
    assert.deepEqual(delta.replaced, [{ index: 1, d: "b2" }]);
    assert.deepEqual(
      delta.added.map((p) => p.d),
      ["x2", "y"],
    );
    assert.equal(first.length, 3, "the intermediate mesh is what the second recut was measured against");
  });
});
