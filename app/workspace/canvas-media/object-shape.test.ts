import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OBJECT_SDF_MARGIN,
  sdfTexelCoordinate,
  signedDistanceField,
  buildObjectShapeFromRings,
  flattenPathData,
  normalizeRings,
  objectShapeDepthAt,
  objectShapeProfileU,
  polygonArea,
  polygonCentroid,
  sampleObjectShapePath,
  cachedObjectShape,
} from "./object-shape.ts";

function circleRing(radius: number, center: [number, number] = [0, 0], points = 720): [number, number][] {
  return Array.from({ length: points }, (_, i) => {
    const angle = (2 * Math.PI * i) / points;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)] as [number, number];
  });
}

function squareRing(half: number): [number, number][] {
  return [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
}

function starRing(outer: number, inner: number, points = 5): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points;
    ring.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return ring;
}

function horseshoeRing(outer: number, inner: number, gapDegrees = 60): [number, number][] {
  const start = (gapDegrees / 2) * (Math.PI / 180);
  const end = 2 * Math.PI - start;
  const steps = 120;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + ((end - start) * i) / steps;
    ring.push([outer * Math.cos(angle), outer * Math.sin(angle)]);
  }
  for (let i = steps; i >= 0; i--) {
    const angle = start + ((end - start) * i) / steps;
    ring.push([inner * Math.cos(angle), inner * Math.sin(angle)]);
  }
  return ring;
}

function distances(points: [number, number][], center: [number, number] = [0, 0]): number[] {
  return points.map(([x, y]) => Math.hypot(x - center[0], y - center[1]));
}

describe("flattenPathData -- the svg path grammar", () => {
  it("reads an absolute M/L/Z polygon", () => {
    const [ring] = flattenPathData("M0,0 L10,0 L10,10 L0,10 Z");
    assert.deepEqual(ring, [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
  });

  it("reads relative commands against the running point", () => {
    const [ring] = flattenPathData("m1,1 l10,0 l0,10 l-10,0 z");
    assert.deepEqual(ring, [
      [1, 1],
      [11, 1],
      [11, 11],
      [1, 11],
    ]);
  });

  it("treats a repeated coordinate pair after M as an implicit lineto", () => {
    const rings = flattenPathData("M0,0 10,0 10,10 0,10Z");
    assert.equal(rings.length, 1);
    assert.equal(rings[0].length, 4);
  });

  it("separates numbers packed without delimiters", () => {
    assert.deepEqual(flattenPathData("M0,0L1.5.5Z")[0], [
      [0, 0],
      [1.5, 0.5],
    ]);
    assert.deepEqual(flattenPathData("M0,0L1-2Z")[0], [
      [0, 0],
      [1, -2],
    ]);
  });

  it("reads H and V as axis-locked linetos", () => {
    const [ring] = flattenPathData("M2,3 H8 V9 H2 Z");
    assert.deepEqual(ring, [
      [2, 3],
      [8, 3],
      [8, 9],
      [2, 9],
    ]);
  });

  it("does not mistake a command letter for an exponent", () => {
    const [ring] = flattenPathData("M0,0L1e2,0Z");
    assert.deepEqual(ring, [
      [0, 0],
      [100, 0],
    ]);
  });

  it("flattens cubic and smooth-cubic curves through their endpoints", () => {
    const [ring] = flattenPathData("M0,0 C0,10 10,10 10,0 S20,-10 20,0 Z");
    assert.deepEqual(ring[0], [0, 0]);
    const atFirstEnd = ring.find(([x, y]) => Math.abs(x - 10) < 1e-9 && Math.abs(y) < 1e-9);
    assert.ok(atFirstEnd, "the first cubic should pass exactly through (10, 0)");
    assert.ok(Math.abs(ring[ring.length - 1][0] - 20) < 1e-9, "the smooth cubic should end at x = 20");
  });

  it("flattens quadratic and smooth-quadratic curves through their endpoints", () => {
    const [ring] = flattenPathData("M0,0 Q5,10 10,0 T20,0 Z");
    assert.ok(Math.abs(ring[ring.length - 1][0] - 20) < 1e-9);
    const apex = ring.find(([x, y]) => Math.abs(x - 5) < 1e-9 && Math.abs(y - 5) < 1e-9);
    assert.ok(apex, "the quadratic should pass through its own apex at (5, 5)");
  });

  it("flattens arcs onto the ellipse they describe", () => {
    const [ring] = flattenPathData("M10,0 A10,10 0 1 1 -10,0 A10,10 0 1 1 10,0 Z");
    for (const distance of distances(ring)) {
      assert.ok(Math.abs(distance - 10) < 1e-6, `arc point off the circle at r=${distance}`);
    }
  });

  it("reads arc flags packed against the following number", () => {
    const [ring] = flattenPathData("M0,0A50,50 0 1150,0Z");
    assert.ok(Math.abs(ring[ring.length - 1][0] - 50) < 1e-6, "the arc should end at x = 50");
    assert.ok(
      ring.some(([, y]) => Math.abs(y) > 10),
      "largeArc=1 sweep=1 should bow well off the straight line between the endpoints",
    );
  });

  it("splits subpaths and drops degenerate ones", () => {
    const rings = flattenPathData("M0,0 L10,0 L10,10 Z M50,50 M60,60 L70,60 L70,70 Z");
    assert.equal(rings.length, 2, "the lone moveto should not become a subpath");
    assert.equal(rings[0].length, 3);
    assert.equal(rings[1].length, 3);
  });

  it("terminates on malformed input instead of spinning", () => {
    assert.doesNotThrow(() => flattenPathData("M0,0 L10,0 X99 L20,20"));
    assert.doesNotThrow(() => flattenPathData("M0,0 L"));
    assert.doesNotThrow(() => flattenPathData("garbage"));
    assert.doesNotThrow(() => flattenPathData(""));
  });
});

describe("polygonArea / polygonCentroid", () => {
  it("measures a square", () => {
    assert.equal(Math.abs(polygonArea(squareRing(5))), 100);
    assert.deepEqual(polygonCentroid(squareRing(5)), [0, 0]);
  });

  it("puts a triangle's centroid at the average of its vertices", () => {
    const triangle: [number, number][] = [
      [0, 0],
      [9, 0],
      [0, 9],
    ];
    const [cx, cy] = polygonCentroid(triangle);
    assert.ok(Math.abs(cx - 3) < 1e-9 && Math.abs(cy - 3) < 1e-9);
  });

  it("falls back to the vertex average for a degenerate ring", () => {
    const [cx, cy] = polygonCentroid([
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    assert.ok(Number.isFinite(cx) && Number.isFinite(cy));
  });
});

describe("buildObjectShapeFromRings -- the distance field", () => {
  it("reads a circle as depth = radius - distance, which is the shapeless case", () => {
    const result = buildObjectShapeFromRings([circleRing(37, [12, -5])]);
    assert.ok(result.ok);
    // normalized to unit extent, so the deepest point is 1 away from the rim
    assert.ok(Math.abs(result.shape.maxDepth - 1) < 0.02, `maxDepth = ${result.shape.maxDepth}`);
    for (const at of [0, 0.25, 0.5, 0.75]) {
      for (const angle of [0, 1.1, 2.4, -2.9]) {
        const u = objectShapeProfileU(result.shape, at * Math.cos(angle), at * Math.sin(angle));
        assert.ok(Math.abs(u - at) < 0.03, `u at ${at} along ${angle.toFixed(1)} = ${u.toFixed(4)}`);
      }
    }
  });

  it("puts u at 0 in the middle and 1 on the outline", () => {
    const result = buildObjectShapeFromRings([squareRing(20)]);
    assert.ok(result.ok);
    assert.ok(Math.abs(objectShapeProfileU(result.shape, 0, 0)) < 0.02);
    // a square normalizes so its corners sit at 1; the edge midpoint is nearer
    const edge = objectShapeProfileU(result.shape, 1 / Math.SQRT2, 0);
    assert.ok(Math.abs(edge - 1) < 0.05, `at the edge midpoint u = ${edge}`);
  });

  it("reports depth as positive inside and negative outside", () => {
    const result = buildObjectShapeFromRings([circleRing(10)]);
    assert.ok(result.ok);
    assert.ok(objectShapeDepthAt(result.shape, 0, 0) > 0, "the centre is inside");
    assert.ok(objectShapeDepthAt(result.shape, 0.99, 0) > 0, "just within the rim is inside");
    assert.ok(objectShapeDepthAt(result.shape, 1.05, 0) < 0, "just past the rim is outside");
  });

  it("keeps a star's lobes rather than filling them in", () => {
    // six points rather than five so the bounding box centres on the origin
    // and the normalized geometry is the star's own -- an odd-pointed star
    // normalizes about a centre offset toward its flat side
    const result = buildObjectShapeFromRings([starRing(10, 4, 6)]);
    assert.ok(result.ok);
    // a point out along a lobe is inside; the same distance round into a notch is not
    const lobe = objectShapeDepthAt(result.shape, 0.85, 0);
    const notch = objectShapeDepthAt(result.shape, 0.85 * Math.cos(Math.PI / 6), 0.85 * Math.sin(Math.PI / 6));
    assert.ok(lobe > 0, `along a lobe depth = ${lobe}`);
    assert.ok(notch < 0, `into a notch depth = ${notch}`);
  });
});

describe("buildObjectShapeFromRings -- shapes the angular table used to refuse", () => {
  it("accepts a horseshoe, which is not star-shaped", () => {
    const result = buildObjectShapeFromRings([horseshoeRing(10, 6)]);
    assert.ok(result.ok, result.ok ? "" : result.reason);
    // the gap really is a gap: the field is negative straight out through it
    assert.ok(objectShapeDepthAt(result.shape, 0.8, 0) < 0, "the mouth of the horseshoe is outside");
    assert.ok(objectShapeDepthAt(result.shape, -0.8, 0) > 0, "the closed end is inside");
  });

  it("accepts an annulus and keeps the hole empty", () => {
    const result = buildObjectShapeFromRings([circleRing(20), circleRing(9)]);
    assert.ok(result.ok, result.ok ? "" : result.reason);
    assert.ok(objectShapeDepthAt(result.shape, 0, 0) < 0, "the hole is outside");
    assert.ok(objectShapeDepthAt(result.shape, 0.7, 0) > 0, "the ring itself is inside");
  });

  it("accepts a hole traced the same way round as its outer ring", () => {
    // even-odd rather than nonzero winding: the server's contours and an
    // illustrator's export make no promise about orientation
    const outer = circleRing(20);
    const innerSameWinding = circleRing(9);
    const innerReversed = [...circleRing(9)].reverse();
    const same = buildObjectShapeFromRings([outer, innerSameWinding]);
    const reversed = buildObjectShapeFromRings([outer, innerReversed]);
    assert.ok(same.ok && reversed.ok);
    assert.ok(objectShapeDepthAt(same.shape, 0, 0) < 0);
    assert.ok(objectShapeDepthAt(reversed.shape, 0, 0) < 0);
  });

  it("accepts several detached pieces", () => {
    const result = buildObjectShapeFromRings([circleRing(10, [-30, 0]), circleRing(10, [30, 0])]);
    assert.ok(result.ok, result.ok ? "" : result.reason);
    // normalized extent 1 spans both, so each piece sits either side of centre
    assert.ok(objectShapeDepthAt(result.shape, -0.75, 0) > 0, "the left piece is inside");
    assert.ok(objectShapeDepthAt(result.shape, 0.75, 0) > 0, "the right piece is inside");
    assert.ok(objectShapeDepthAt(result.shape, 0, 0) < 0, "the space between them is not");
  });

  it("still refuses an outline with no enclosed area", () => {
    const result = buildObjectShapeFromRings([
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
    ]);
    assert.ok(!result.ok);
    assert.match(result.reason, /no closed region/);
  });
});

describe("normalizeRings -- the convention the server mirrors", () => {
  it("centres on the bounding box and scales the furthest point to exactly 1", () => {
    const normalized = normalizeRings([circleRing(37, [12, -5])]);
    assert.ok(Math.abs(normalized.center[0] - 12) < 1e-6);
    assert.ok(Math.abs(normalized.center[1] + 5) < 1e-6);
    const reach = Math.max(...distances(normalized.rings[0]));
    assert.ok(Math.abs(reach - 1) < 1e-9, `furthest point at ${reach}`);
  });

  it("uses a centre the shape need not contain", () => {
    // the whole reason it is the bounding box and not the area centroid
    const normalized = normalizeRings([circleRing(10, [-30, 0]), circleRing(10, [30, 0])]);
    assert.ok(Math.abs(normalized.center[0]) < 1e-6, "between the two pieces");
    assert.ok(Math.max(...normalized.rings.flatMap((r) => distances(r))) <= 1 + 1e-9);
  });

  it("counts every ring, holes included, when measuring the extent", () => {
    const normalized = normalizeRings([squareRing(20), squareRing(5)]);
    assert.ok(Math.max(...normalized.rings.flatMap((r) => distances(r))) <= 1 + 1e-9);
  });
});

describe("the persisted shape round-trips", () => {
  it("re-reads from its own normalized path to the same field", () => {
    // A path persists at five decimals and is re-simplified on the way back
    // in. Simplification is greedy, so a coordinate moving in the last decimal
    // can flip which vertex it keeps and shift the outline by up to its own
    // tolerance -- a quarter of a texel. That is the real bound here, and it is
    // well under what relief can show; anything beyond it would mean reloading
    // a mask moved geometry nobody edited.
    const texel = (2 * OBJECT_SDF_MARGIN) / 128;
    const tolerance = texel * 0.4;
    for (const ring of [circleRing(30), squareRing(12), starRing(20, 8), horseshoeRing(15, 9)]) {
      const authored = buildObjectShapeFromRings([ring]);
      assert.ok(authored.ok);
      const reloaded = sampleObjectShapePath(authored.shape.path);
      assert.ok(reloaded, "the persisted path re-reads");
      assert.ok(
        Math.abs(reloaded.maxDepth - authored.shape.maxDepth) < tolerance,
        `maxDepth drifted: ${authored.shape.maxDepth} -> ${reloaded.maxDepth}`,
      );
      for (let i = 0; i < authored.shape.sdf.length; i += 97) {
        assert.ok(
          Math.abs(reloaded.sdf[i] - authored.shape.sdf[i]) < tolerance,
          `texel ${i} drifted by ${Math.abs(reloaded.sdf[i] - authored.shape.sdf[i])}`,
        );
      }
    }
  });

  it("centers the persisted path on the origin at unit maximum radius", () => {
    const authored = buildObjectShapeFromRings([starRing(80, 30)]);
    assert.ok(authored.ok);
    const rings = flattenPathData(authored.shape.path);
    const reach = Math.max(...rings.flatMap((r) => distances(r)));
    assert.ok(Math.abs(reach - 1) < 1e-4, `furthest point at ${reach}`);
  });

  it("keeps every subpath through the round trip, so a hole survives", () => {
    const authored = buildObjectShapeFromRings([circleRing(20), circleRing(9)]);
    assert.ok(authored.ok);
    assert.equal(flattenPathData(authored.shape.path).length, 2, "two subpaths persisted");
    const reloaded = sampleObjectShapePath(authored.shape.path);
    assert.ok(reloaded);
    assert.ok(objectShapeDepthAt(reloaded, 0, 0) < 0, "the hole is still a hole");
  });
});

describe("an object shape authored by the server", () => {
  it("reads an empty shape as the plain circle the server means by it", () => {
    assert.equal(cachedObjectShape(""), undefined);
  });

  it("reads a multi-subpath M/C/Z path the way detection emits it", () => {
    // an outline and its hole, as curves rather than the polyline the angular
    // table was limited to
    const outer = "M0,-1C0.55,-1 1,-0.55 1,0C1,0.55 0.55,1 0,1C-0.55,1 -1,0.55 -1,0C-1,-0.55 -0.55,-1 0,-1Z";
    const hole =
      "M0,-0.4C0.22,-0.4 0.4,-0.22 0.4,0C0.4,0.22 0.22,0.4 0,0.4C-0.22,0.4 -0.4,0.22 -0.4,0C-0.4,-0.22 -0.22,-0.4 0,-0.4Z";
    const shape = sampleObjectShapePath(outer + hole);
    assert.ok(shape, "a curved, holed outline reads");
    assert.ok(objectShapeDepthAt(shape, 0, 0) < 0, "the hole is empty");
    assert.ok(objectShapeDepthAt(shape, 0.7, 0) > 0, "the ring is solid");
  });
});

describe("a shape authored by this project's server", () => {
  // Verbatim output of region_object_geometry on a traced crescent -- the
  // exact shape the previous encoding could not represent at all, since a ray
  // from its centroid crosses the outline twice. Kept as a fixture because it
  // is the only thing that catches the two implementations' normalization
  // conventions drifting apart, which neither suite can see on its own.
  const SERVER_CRESCENT =
    "M0.11351,-0.90902C0.0071,-0.9105 -0.09727,-0.89095 -0.19557,-0.85448" +
    "C-0.29763,-0.81662 -0.40138,-0.75954 -0.48647,-0.68176C-0.57942,-0.59679 -0.67136,-0.47166 -0.72283,-0.3545" +
    "C-0.77156,-0.24356 -0.79397,-0.11423 -0.79555,0.00004C-0.79702,0.10645 -0.77748,0.21082 -0.74101,0.30912" +
    "C-0.70315,0.41118 -0.64607,0.51492 -0.56829,0.60002C-0.48332,0.69297 -0.35819,0.78491 -0.24102,0.83637" +
    "C-0.13009,0.88511 -0.00467,0.9091 0.11351,0.9091C0.23169,0.9091 0.35711,0.88511 0.46804,0.83637" +
    "C0.58521,0.78491 0.80516,0.6226 0.79531,0.60002C0.78784,0.5829 0.64589,0.646 0.56804,0.64547" +
    "C0.48554,0.64491 0.39482,0.62929 0.3135,0.59093C0.22106,0.54732 0.10694,0.44827 0.04988,0.38184" +
    "C0.01221,0.338 -0.00428,0.30998 -0.02285,0.25457C-0.05184,0.16806 -0.08316,0.0096 -0.0683,-0.09996" +
    "C-0.05456,-0.20126 0.00055,-0.3083 0.04988,-0.38177C0.08906,-0.44013 0.13286,-0.47966 0.18624,-0.51813" +
    "C0.24371,-0.55955 0.31947,-0.59702 0.38623,-0.61812C0.44676,-0.63727 0.5042,-0.64694 0.56804,-0.6454" +
    "C0.63972,-0.64366 0.78784,-0.58283 0.79531,-0.59994C0.80516,-0.62253 0.58521,-0.78483 0.46804,-0.8363" +
    "C0.35711,-0.88503 0.22778,-0.90744 0.11351,-0.90902Z";
  const SERVER_RADIUS = 110.003537;

  it("re-normalizes to the identity, so the server's radius is the real reach", () => {
    const rings = flattenPathData(SERVER_CRESCENT);
    assert.equal(rings.length, 1);
    const { center, scale } = normalizeRings(rings);
    // the server measures on the flattened curve for exactly this reason: it
    // fits anchors at 1 but the curve bows past them, and if it normalized the
    // traced ring instead the object would render a fraction larger than the
    // reach it records
    assert.ok(Math.hypot(...center) < 1e-4, `centre drifted to ${center}`);
    assert.ok(Math.abs(scale - 1) < 1e-4, `scale drifted to ${scale}`);
  });

  it("reads as the crescent it is, bite and all", () => {
    const shape = sampleObjectShapePath(SERVER_CRESCENT);
    assert.ok(shape, "the client refused a shape its own server emitted");
    assert.ok(objectShapeDepthAt(shape, -0.55, 0) > 0, "the solid side is inside");
    assert.ok(objectShapeDepthAt(shape, 0.55, 0) < 0, "the bite is outside");
    // a crescent is thin: its deepest point is nowhere near its extent
    assert.ok(shape.maxDepth > 0.2 && shape.maxDepth < 0.5, `maxDepth ${shape.maxDepth}`);
  });

  it("agrees with the server about where the outline reaches in mesh units", () => {
    const shape = sampleObjectShapePath(SERVER_CRESCENT);
    assert.ok(shape);
    // maxExtent is 1, so the furthest the outline reaches from (cx, cy) is
    // exactly the stored radius -- what every hit test and swell bound assumes
    assert.equal(shape.maxExtent, 1);
    const reach = Math.max(...flattenPathData(shape.path).flatMap((r) => distances(r)));
    assert.ok(Math.abs(reach * SERVER_RADIUS - SERVER_RADIUS) < 0.05, `reach ${reach}`);
  });
});

describe("cachedObjectShape -- the render path's entry point", () => {
  it("treats the empty path as a circle without consulting the cache", () => {
    assert.equal(cachedObjectShape(""), undefined);
  });

  it("returns the identical object on repeated calls", () => {
    const authored = buildObjectShapeFromRings([starRing(10, 4)]);
    assert.ok(authored.ok);
    const first = cachedObjectShape(authored.shape.path);
    const second = cachedObjectShape(authored.shape.path);
    assert.ok(first);
    assert.equal(first, second);
  });

  it("caches a shape that fails to re-read, rather than retrying forever", () => {
    assert.equal(cachedObjectShape("M0,0Z"), undefined);
    assert.equal(cachedObjectShape("M0,0Z"), undefined);
  });

  it("shares one field between objects wearing the same silhouette", () => {
    const first = buildObjectShapeFromRings([squareRing(20)]);
    const second = buildObjectShapeFromRings([squareRing(5)]);
    assert.ok(first.ok && second.ok);
    // same silhouette at different sizes normalizes to the same path
    assert.equal(first.shape.path, second.shape.path);
    assert.equal(cachedObjectShape(first.shape.path), cachedObjectShape(second.shape.path));
  });

  it("keeps a draft and a full-resolution build apart", () => {
    // the shape editor rasterizes at draft resolution while a handle is being
    // dragged; the draft it leaves behind must not be served afterwards as the
    // real thing
    const built = buildObjectShapeFromRings([starRing(10, 4, 6)]);
    assert.ok(built.ok);
    const draft = cachedObjectShape(built.shape.path, 64);
    const full = cachedObjectShape(built.shape.path);
    assert.ok(draft && full);
    assert.equal(draft.tile, 64);
    assert.equal(full.tile, 128);
    assert.notEqual(draft, full);
    // and each is still cached in its own right
    assert.equal(cachedObjectShape(built.shape.path, 64), draft);
    assert.equal(cachedObjectShape(built.shape.path), full);
  });

  it("agrees between resolutions about what is inside", () => {
    // a draft is coarser, not different -- otherwise the relief would jump
    // when the pointer is released
    const built = buildObjectShapeFromRings([circleRing(20)]);
    assert.ok(built.ok);
    const draft = cachedObjectShape(built.shape.path, 64);
    const full = cachedObjectShape(built.shape.path);
    assert.ok(draft && full);
    assert.ok(Math.abs(draft.maxDepth - full.maxDepth) < 0.05, `${draft.maxDepth} vs ${full.maxDepth}`);
    for (const at of [
      [0, 0],
      [0.5, 0],
      [0, -0.6],
      [1.4, 0],
    ] as [number, number][]) {
      assert.equal(
        objectShapeDepthAt(draft, ...at) > 0,
        objectShapeDepthAt(full, ...at) > 0,
        `resolutions disagree about ${at}`,
      );
    }
  });

  it("evicts rather than growing without bound", () => {
    // each entry now carries a tile-sized field, and the shape editor mints a
    // new path per pointermove
    const held = buildObjectShapeFromRings([squareRing(3)]);
    assert.ok(held.ok);
    const first = cachedObjectShape(held.shape.path);
    for (let i = 0; i < 40; i++) {
      cachedObjectShape(`M${-1 - i / 100},-1L1,-1L1,1L-1,1Z`);
    }
    assert.notEqual(cachedObjectShape(held.shape.path), first, "the untouched entry was evicted");
  });
});

describe("the signed distance field's rasterizer", () => {
  it("measures true distance to the outline, not a texel-grid approximation", () => {
    // A square of half-extent 0.5 leaves a wide flat interior whose distance to
    // the nearest edge is exactly `0.5 - |x|` along the x axis.
    const field = signedDistanceField([squareRing(0.5)], 64);
    assert.ok(field);
    const tile = 64;
    // walk the middle row outward from the centre and check every texel
    const row = tile / 2;
    for (let col = tile / 2; col < tile; col++) {
      const x = sdfTexelCoordinate(col, tile);
      const y = sdfTexelCoordinate(row, tile);
      // inside the flat band the nearest edge is the right one, until the
      // corner's diagonal takes over -- so only assert where |y| < the x-edge
      if (Math.abs(y) > 0.5) continue;
      const expected = 0.5 - Math.abs(x);
      const actual = field.sdf[row * tile + col];
      assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `texel (${col}, ${row}): distance ${actual} where ${expected} was exact`,
      );
    }
  });

  it("points the gradient the way the distance increases, on both sides of the outline", () => {
    const tile = 64;
    const field = signedDistanceField([circleRing(0.5)], tile);
    assert.ok(field);
    for (let row = 0; row < tile; row++) {
      for (let col = 0; col < tile; col++) {
        const at = row * tile + col;
        const x = sdfTexelCoordinate(col, tile);
        const y = sdfTexelCoordinate(row, tile);
        const reach = Math.hypot(x, y);
        // skip the centre, where the gradient is genuinely undefined -- every
        // direction is equally far from a circle's rim
        if (reach < 0.05) continue;
        const gx = field.grad[at * 2] / 127;
        const gy = field.grad[at * 2 + 1] / 127;
        // inside a circle the distance grows toward the centre, outside it
        // grows toward the rim: either way the gradient points inward
        const inward = -(gx * x + gy * y) / reach;
        assert.ok(inward > 0.9, `texel (${col}, ${row}) gradient (${gx}, ${gy}) does not point inward`);
        assert.ok(Math.abs(Math.hypot(gx, gy) - 1) < 0.02, "the gradient is a unit vector");
      }
    }
  });

  it("signs the inside of a hole negative however its ring was wound", () => {
    // even-odd, so a hole traced the same way round as its outer ring is still
    // a hole -- the property insideMask exists for
    const reversed = circleRing(0.4).slice().reverse();
    for (const hole of [circleRing(0.4), reversed]) {
      const field = signedDistanceField([circleRing(1), hole], 64);
      assert.ok(field);
      const centre = 32 * 64 + 32;
      assert.ok(field.sdf[centre] < 0, "the hole's middle is outside the shape");
    }
  });

  it("refuses an outline with nothing inside it", () => {
    assert.equal(signedDistanceField([], 64), undefined, "no rings at all");
    assert.equal(
      signedDistanceField(
        [
          [
            [-1, 0],
            [0, 0],
            [1, 0],
          ],
        ],
        64,
      ),
      undefined,
      "a collinear ring encloses no area",
    );
  });

  it("keeps maxDepth as the deepest interior distance", () => {
    const field = signedDistanceField([circleRing(0.5)], 128);
    assert.ok(field);
    let deepest = 0;
    for (const d of field.sdf) if (d > deepest) deepest = d;
    assert.ok(Math.abs(field.maxDepth - deepest) < 1e-6, "maxDepth is the largest distance in the field");
    // the deepest point of a circle of radius 0.5 is its centre, half a unit in
    assert.ok(Math.abs(field.maxDepth - 0.5) < 0.02, `a 0.5 circle is 0.5 deep, got ${field.maxDepth}`);
  });
});
