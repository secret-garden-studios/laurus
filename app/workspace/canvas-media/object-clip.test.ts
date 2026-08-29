import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clipToConvex, clipTriangle, insideRings, polygonArea2, shapeOutline, type Point } from "./object-clip.ts";

const UNIT: { cx: number; cy: number; radius: number } = { cx: 0, cy: 0, radius: 1 };
const SQUARE = "M-1,-1L1,-1L1,1L-1,1Z";
// a disc with a bite out of the +x side
const CRESCENT = "M0,-1L0.6,-0.8L0.25,-0.45L0.1,0L0.25,0.45L0.6,0.8L0,1L-0.71,0.71L-1,0L-0.71,-0.71Z";
const ANNULUS = "M-1,-1L1,-1L1,1L-1,1ZM-0.4,-0.4L0.4,-0.4L0.4,0.4L-0.4,0.4Z";

function tri(a: Point, b: Point, c: Point): Point[] {
  return [a, b, c];
}

/** Share of a triangle's area that lies inside the rings, by dense sampling. */
function insideFraction(triangle: Point[], rings: Point[][], steps = 40): number {
  let inside = 0;
  let total = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps - i; j++) {
      const a = (i + 0.33) / steps;
      const b = (j + 0.33) / steps;
      const c = 1 - a - b;
      if (c < 0) continue;
      const point: Point = [
        a * triangle[0][0] + b * triangle[1][0] + c * triangle[2][0],
        a * triangle[0][1] + b * triangle[1][1] + c * triangle[2][1],
      ];
      total++;
      if (insideRings(rings, point)) inside++;
    }
  }
  return total === 0 ? 0 : inside / total;
}

describe("clipToConvex -- Sutherland-Hodgman with the triangle as the clip", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("returns the subject untouched when it is wholly inside", () => {
    const small: Point[] = [
      [2, 2],
      [4, 2],
      [4, 4],
    ];
    const clipped = clipToConvex(small, square);
    assert.equal(clipped.length, 3);
    assert.ok(Math.abs(Math.abs(polygonArea2(clipped)) - 2) < 1e-9);
  });

  it("returns nothing when subject and clip are disjoint", () => {
    const away: Point[] = [
      [20, 20],
      [22, 20],
      [22, 22],
    ];
    assert.equal(clipToConvex(away, square).length, 0);
  });

  it("cuts a subject that straddles the clip's edge", () => {
    const straddling: Point[] = [
      [5, 5],
      [15, 5],
      [15, 8],
      [5, 8],
    ];
    const clipped = clipToConvex(straddling, square);
    // half of a 10x3 rectangle survives
    assert.ok(Math.abs(Math.abs(polygonArea2(clipped)) - 15) < 1e-6, `${Math.abs(polygonArea2(clipped))}`);
    for (const [x] of clipped) assert.ok(x <= 10 + 1e-9, `${x} escaped the clip`);
  });

  it("does not care which way round the clip was wound", () => {
    const straddling: Point[] = [
      [5, 5],
      [15, 5],
      [15, 8],
      [5, 8],
    ];
    const forward = clipToConvex(straddling, square);
    const backward = clipToConvex(straddling, [...square].reverse());
    assert.ok(Math.abs(Math.abs(polygonArea2(forward)) - Math.abs(polygonArea2(backward))) < 1e-9);
  });

  it("keeps a concave subject's concavity", () => {
    // an L, entirely inside the clip -- Sutherland-Hodgman allows this and it
    // is why the triangle is the clip rather than the subject
    const ell: Point[] = [
      [1, 1],
      [7, 1],
      [7, 3],
      [3, 3],
      [3, 7],
      [1, 7],
    ];
    const clipped = clipToConvex(ell, square);
    assert.ok(Math.abs(Math.abs(polygonArea2(clipped)) - Math.abs(polygonArea2(ell))) < 1e-9);
  });
});

describe("shapeOutline", () => {
  it("puts the shape into mesh coordinates", () => {
    const outline = shapeOutline(SQUARE, { cx: 100, cy: 50, radius: 10 });
    assert.ok(outline);
    for (const [x, y] of outline.outer) {
      assert.ok(Math.abs(Math.abs(x - 100) - 10) < 1e-9, `x ${x}`);
      assert.ok(Math.abs(Math.abs(y - 50) - 10) < 1e-9, `y ${y}`);
    }
  });

  it("picks the largest ring as the outer one, however it was wound", () => {
    const outline = shapeOutline(ANNULUS, UNIT);
    assert.ok(outline);
    assert.equal(outline.holes.length, 1);
    assert.ok(Math.abs(polygonArea2(outline.outer)) > Math.abs(polygonArea2(outline.holes[0])));
  });

  it("refuses a path with no closed ring", () => {
    assert.equal(shapeOutline("", UNIT), undefined);
  });
});

describe("clipTriangle -- what becomes of one mesh triangle", () => {
  const outline = shapeOutline(SQUARE, UNIT)!;

  it("keeps a triangle wholly inside", () => {
    assert.equal(clipTriangle(tri([-0.5, -0.5], [0.5, -0.5], [0, 0.5]), outline).kind, "keep");
  });

  it("drops a triangle wholly outside", () => {
    assert.equal(clipTriangle(tri([2, 2], [3, 2], [2, 3]), outline).kind, "drop");
  });

  it("cuts a triangle that crosses the outline", () => {
    const verdict = clipTriangle(tri([0.5, 0], [1.5, 0], [0.5, 1]), outline);
    assert.equal(verdict.kind, "cut");
  });

  it("keeps nothing outside the outline once cut", () => {
    // the requirement, stated directly: no part of a kept polygon may sit
    // outside the curve
    const verdict = clipTriangle(tri([0.5, 0], [1.5, 0], [0.5, 1]), outline);
    assert.equal(verdict.kind, "cut");
    if (verdict.kind !== "cut") return;
    for (const fragment of verdict.triangles) {
      assert.ok(insideFraction(fragment, outline.all) > 0.98, "a fragment escaped the outline");
    }
  });

  it("covers everything the triangle had inside the outline", () => {
    const triangle = tri([0.5, 0], [1.5, 0], [0.5, 1]);
    const verdict = clipTriangle(triangle, outline);
    assert.equal(verdict.kind, "cut");
    if (verdict.kind !== "cut") return;

    const before = Math.abs(polygonArea2(triangle)) * insideFraction(triangle, outline.all);
    const after = verdict.triangles.reduce((sum, f) => sum + Math.abs(polygonArea2(f)), 0);
    assert.ok(Math.abs(after - before) / before < 0.05, `kept ${after} of ${before}`);
  });

  it("leaves fragments smaller than the triangle they came from", () => {
    const triangle = tri([0.5, 0], [1.5, 0], [0.5, 1]);
    const whole = Math.abs(polygonArea2(triangle));
    const verdict = clipTriangle(triangle, outline);
    assert.equal(verdict.kind, "cut");
    if (verdict.kind !== "cut") return;
    for (const fragment of verdict.triangles) {
      assert.ok(Math.abs(polygonArea2(fragment)) < whole, "a fragment was not smaller than its parent");
    }
  });

  it("drops a sliver rather than emitting a degenerate polygon", () => {
    // the curve grazing a corner leaves an unrenderable splinter
    assert.equal(clipTriangle(tri([1 - 1e-7, 0], [3, 0], [3, 2]), outline).kind, "drop");
  });

  it("handles a concave outline, which is the whole point", () => {
    const crescent = shapeOutline(CRESCENT, UNIT)!;
    // straight through the bite: the kept part must avoid the notch
    const verdict = clipTriangle(tri([0, -0.2], [0.9, 0], [0, 0.2]), crescent);
    if (verdict.kind === "cut") {
      for (const fragment of verdict.triangles) {
        assert.ok(insideFraction(fragment, crescent.all) > 0.95, "a fragment sat in the bite");
      }
    } else {
      assert.equal(verdict.kind, "drop");
    }
  });
});

describe("clipTriangle -- holes", () => {
  const outline = shapeOutline(ANNULUS, UNIT)!;

  it("keeps a triangle in the solid part", () => {
    assert.equal(clipTriangle(tri([-0.9, -0.9], [-0.6, -0.9], [-0.9, -0.6]), outline).kind, "keep");
  });

  it("drops a triangle sitting in the hole", () => {
    assert.equal(clipTriangle(tri([-0.2, -0.2], [0.2, -0.2], [0, 0.2]), outline).kind, "drop");
  });

  it("drops rather than covers a triangle on the hole's rim", () => {
    // documented conservative choice: subtracting a hole is a different
    // operation from clipping to a convex region, and never spilling matters
    // more here than the thin band it costs
    const verdict = clipTriangle(tri([0.2, 0.2], [0.7, 0.2], [0.2, 0.7]), outline);
    assert.equal(verdict.kind, "drop");
  });
});

describe("the cut is watertight", () => {
  it("two triangles sharing an edge agree about where the curve crosses it", () => {
    // no coordination between neighbours: they cut the same edge against the
    // same curve, so the crossing points must come out identical
    const outline = shapeOutline(CRESCENT, { cx: 0, cy: 0, radius: 10 })!;
    const shared: [Point, Point] = [
      [2, -6],
      [6, 4],
    ];
    const left = clipTriangle([shared[0], shared[1], [-4, 0]], outline);
    const right = clipTriangle([shared[1], shared[0], [9, -2]], outline);

    const onShared = (verdict: ReturnType<typeof clipTriangle>): Point[] => {
      if (verdict.kind !== "cut") return [];
      const [ax, ay] = shared[0];
      const [bx, by] = shared[1];
      const out: Point[] = [];
      for (const fragment of verdict.triangles) {
        for (const p of fragment) {
          const cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
          const along = ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
          if (Math.abs(cross) < 1e-6 && along > 1e-6 && along < 1 - 1e-6) out.push(p);
        }
      }
      return out;
    };

    for (const point of onShared(left)) {
      const match = onShared(right).some((q) => Math.hypot(q[0] - point[0], q[1] - point[1]) < 1e-9);
      assert.ok(match, `${point} on the shared edge has no counterpart -- a crack`);
    }
  });
});
