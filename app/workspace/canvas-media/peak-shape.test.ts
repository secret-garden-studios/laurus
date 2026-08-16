/**
 * Unit tests for a topology peak's custom-shape sampler (see peak-shape.ts).
 *
 *     node --experimental-strip-types --test app/workspace/canvas-media/peak-shape.test.ts
 *
 * Same harness as peak-field.test.ts, for the same reason and with the same constraint: no framework,
 * no bundler, and no DOM. peak-shape.ts has no runtime imports precisely so this file can exist, which
 * is also why its svg path flattener is hand-rolled rather than delegated to Path2D.
 *
 * Unlike peak-field.test.ts, nothing here is a twin of GLSL -- this module *is* the implementation,
 * and the sampled table it produces is uploaded verbatim. So these are ordinary correctness tests,
 * and the two things they mostly pin are the two that fail quietly: that a shape's outline distances
 * come out as the analytic answer for silhouettes whose answer is known by hand, and that the
 * star-shaped gate actually refuses the silhouettes rho(theta) cannot represent, rather than
 * accepting them and producing a plausible-looking blob.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PEAK_SHAPE_SAMPLES,
  buildPeakShapeFromMarkup,
  buildPeakShapeFromRings,
  extractPathData,
  flattenPathData,
  polygonArea,
  polygonCentroid,
  sampleAngle,
  samplePeakShapePath,
  cachedPeakShape,
} from "./peak-shape.ts";

/** A regular polygon approximation of a circle, fine enough that its inradius/circumradius gap
 * (1 - cos(pi/n)) is below the tolerances asserted against it. */
function circleRing(radius: number, center: [number, number] = [0, 0], points = 720): [number, number][] {
  return Array.from({ length: points }, (_, i) => {
    const angle = (2 * Math.PI * i) / points;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)] as [number, number];
  });
}

/** An axis-aligned square centered on the origin, whose outline distance at angle theta is the
 * closed form `half / max(|cos|, |sin|)` -- the simplest non-constant rho with an answer by hand. */
function squareRing(half: number): [number, number][] {
  return [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
}

/** A five-pointed star, as the classic alternating outer/inner radius ring. Star-shaped about its
 * own centroid (the origin, by symmetry), so it is the acceptance case with genuinely varying rho. */
function starRing(outer: number, inner: number, points = 5): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points;
    ring.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return ring;
}

/** A horseshoe: an annular sector open to the right. Its centroid falls in the hole, so a ray cast
 * leftward crosses the inner wall and then the outer one -- the canonical silhouette rho(theta)
 * cannot describe. */
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
    // Per the grammar, and emitted by essentially every optimiser -- read as a second moveto instead,
    // a whole silhouette collapses into a chain of one-point subpaths that are all discarded.
    const rings = flattenPathData("M0,0 10,0 10,10 0,10Z");
    assert.equal(rings.length, 1);
    assert.equal(rings[0].length, 4);
  });

  it("separates numbers packed without delimiters", () => {
    // "1.5.5" is two numbers and "1-2" is two numbers; a naive split on whitespace/comma reads the
    // first as one number and drops the second coordinate entirely.
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
    // readNumber has to reject a bare trailing "e" -- "1e" followed by a command would otherwise
    // consume the letter and then fail to parse.
    const [ring] = flattenPathData("M0,0L1e2,0Z");
    assert.deepEqual(ring, [
      [0, 0],
      [100, 0],
    ]);
  });

  it("flattens cubic and smooth-cubic curves through their endpoints", () => {
    const [ring] = flattenPathData("M0,0 C0,10 10,10 10,0 S20,-10 20,0 Z");
    assert.deepEqual(ring[0], [0, 0]);
    // Each curve's own endpoint must land exactly, since that is what the next segment starts from.
    const atFirstEnd = ring.find(([x, y]) => Math.abs(x - 10) < 1e-9 && Math.abs(y) < 1e-9);
    assert.ok(atFirstEnd, "the first cubic should pass exactly through (10, 0)");
    assert.ok(Math.abs(ring[ring.length - 1][0] - 20) < 1e-9, "the smooth cubic should end at x = 20");
  });

  it("flattens quadratic and smooth-quadratic curves through their endpoints", () => {
    const [ring] = flattenPathData("M0,0 Q5,10 10,0 T20,0 Z");
    assert.ok(Math.abs(ring[ring.length - 1][0] - 20) < 1e-9);
    // The apex of the first quadratic is at t = 0.5, i.e. (5, 5) for these control points.
    const apex = ring.find(([x, y]) => Math.abs(x - 5) < 1e-9 && Math.abs(y - 5) < 1e-9);
    assert.ok(apex, "the quadratic should pass through its own apex at (5, 5)");
  });

  it("flattens arcs onto the ellipse they describe", () => {
    // The load-bearing arc test: two half-circle arcs closing into a full circle of radius 10. Icon
    // sets lean on arcs for rounded silhouettes, and an arc quietly dropped to its chord produces a
    // shape that is wrong but entirely plausible-looking.
    const [ring] = flattenPathData("M10,0 A10,10 0 1 1 -10,0 A10,10 0 1 1 10,0 Z");
    for (const distance of distances(ring)) {
      assert.ok(Math.abs(distance - 10) < 1e-6, `arc point off the circle at r=${distance}`);
    }
  });

  it("reads arc flags packed against the following number", () => {
    // "1150" after the rotation is largeArc=1, sweep=1, x=50 -- flags are the one place the grammar
    // allows a bare digit with no separator, so they cannot go through the number scanner.
    const [ring] = flattenPathData("M0,0A50,50 0 1150,0Z");
    assert.ok(Math.abs(ring[ring.length - 1][0] - 50) < 1e-6, "the arc should end at x = 50");
    // Misread flags do not fail loudly -- they produce a different but perfectly valid arc, or a
    // straight chord. Checking that the outline actually bulges away from the chord is what tells
    // those apart, and it does not hardcode the flattener's segment count the way a length check does.
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
    // Every branch that consumes nothing has to break the loop -- an unrecognised letter, and a
    // recognised command whose arguments are missing, are both infinite loops otherwise.
    assert.doesNotThrow(() => flattenPathData("M0,0 L10,0 X99 L20,20"));
    assert.doesNotThrow(() => flattenPathData("M0,0 L"));
    assert.doesNotThrow(() => flattenPathData("garbage"));
    assert.doesNotThrow(() => flattenPathData(""));
  });
});

describe("extractPathData", () => {
  it("finds every path's d, in document order, under either quote style", () => {
    const markup = `<g><path fill="red" d="M0,0L1,0Z"/><path d='M2,2L3,2Z' /></g>`;
    assert.deepEqual(extractPathData(markup), ["M0,0L1,0Z", "M2,2L3,2Z"]);
  });

  it("ignores elements that are not paths, and paths with no d", () => {
    const markup = `<rect d="M9,9Z"/><path class="x"/><path d="M0,0L1,0Z"/>`;
    assert.deepEqual(extractPathData(markup), ["M0,0L1,0Z"]);
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
    // A zero-area ring divides by zero in the shoelace centroid; it is rejected downstream anyway,
    // but it must not reach that rejection as NaN.
    const [cx, cy] = polygonCentroid([
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    assert.ok(Number.isFinite(cx) && Number.isFinite(cy));
  });
});

describe("buildPeakShapeFromRings -- sampling rho(theta)", () => {
  it("samples a circle as rho identically 1", () => {
    // The constant case, which is what makes a shaped peak additive rather than a second code path:
    // a circular silhouette has to reproduce exactly the field an unshaped peak already has.
    const result = buildPeakShapeFromRings([circleRing(37, [12, -5])]);
    assert.ok(result.ok);
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      assert.ok(Math.abs(result.shape.rho[i] - 1) < 1e-4, `rho[${i}] = ${result.shape.rho[i]}`);
      assert.ok(Math.abs(result.shape.rhoPrime[i]) < 1e-2, `rhoPrime[${i}] = ${result.shape.rhoPrime[i]}`);
    }
  });

  it("samples a square as its closed form", () => {
    // distance(theta) = half / max(|cos|, |sin|), maximised at the corners (half * sqrt(2)), so
    // rho(theta) = 1 / (sqrt(2) * max(|cos|, |sin|)).
    const result = buildPeakShapeFromRings([squareRing(20)]);
    assert.ok(result.ok);
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      const theta = sampleAngle(i, PEAK_SHAPE_SAMPLES);
      const expected = 1 / (Math.SQRT2 * Math.max(Math.abs(Math.cos(theta)), Math.abs(Math.sin(theta))));
      assert.ok(
        Math.abs(result.shape.rho[i] - expected) < 1e-5,
        `at theta=${theta.toFixed(3)}: got ${result.shape.rho[i]}, expected ${expected}`,
      );
    }
  });

  it("normalizes so the maximum is exactly 1 and nothing exceeds it", () => {
    // Load-bearing rather than cosmetic: `radius` is the shape's maximum extent, and the vertex
    // stage's no-tearing guarantee is that a peak cannot disturb a vertex outside its own radius. A
    // rho above 1 anywhere would put part of the silhouette outside that radius and break it.
    for (const ring of [squareRing(3), starRing(10, 4), circleRing(7)]) {
      const result = buildPeakShapeFromRings([ring]);
      assert.ok(result.ok);
      const max = Math.max(...result.shape.rho);
      assert.ok(max <= 1 + 1e-6, `rho exceeded 1 (${max})`);
      assert.ok(max > 0.99, `rho never approached its own maximum (${max})`);
      assert.ok(Math.min(...result.shape.rho) > 0, "rho must stay strictly positive -- the field divides by it");
    }
  });

  it("keeps a star's lobes", () => {
    const result = buildPeakShapeFromRings([starRing(10, 4)]);
    assert.ok(result.ok);
    // Five outer points means exactly five local maxima around the sweep -- the property that
    // distinguishes "sampled the star" from "sampled something star-sized".
    let maxima = 0;
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      const previous = result.shape.rho[(i - 1 + PEAK_SHAPE_SAMPLES) % PEAK_SHAPE_SAMPLES];
      const next = result.shape.rho[(i + 1) % PEAK_SHAPE_SAMPLES];
      if (result.shape.rho[i] > previous && result.shape.rho[i] >= next) maxima++;
    }
    assert.equal(maxima, 5, "a five-pointed star should sample to five lobes");
    assert.ok(Math.min(...result.shape.rho) < 0.5, "the notches between lobes should reach well below the tips");
  });

  it("differentiates rho by central difference across the wrap", () => {
    // rhoPrime feeds the gradient's tangential term, which is what leans the surface normal sideways
    // near a non-circular boundary. Checked including at index 0, where the wrap is.
    const result = buildPeakShapeFromRings([starRing(10, 4)]);
    assert.ok(result.ok);
    const step = (2 * Math.PI) / PEAK_SHAPE_SAMPLES;
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      const next = result.shape.rho[(i + 1) % PEAK_SHAPE_SAMPLES];
      const previous = result.shape.rho[(i - 1 + PEAK_SHAPE_SAMPLES) % PEAK_SHAPE_SAMPLES];
      assert.ok(Math.abs(result.shape.rhoPrime[i] - (next - previous) / (2 * step)) < 1e-4, `at index ${i}`);
    }
  });

  it("picks the largest region as the silhouette regardless of document order", () => {
    // Exporters routinely emit the visible shape after an invisible full-bleed rect, so first-wins
    // would take the background as the shape.
    const result = buildPeakShapeFromRings([squareRing(1), circleRing(50)]);
    assert.ok(result.ok);
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      assert.ok(Math.abs(result.shape.rho[i] - 1) < 1e-4, "should have sampled the circle, not the tiny square");
    }
  });
});

describe("buildPeakShapeFromRings -- the gates", () => {
  it("refuses a silhouette that is not star-shaped", () => {
    const result = buildPeakShapeFromRings([horseshoeRing(10, 6)]);
    assert.ok(!result.ok);
    assert.match(result.reason, /star-shaped|enclose/);
  });

  it("refuses a shape with a hole", () => {
    // Outer ring plus inner ring: rho(theta) would silently fill the hole in. Named as a hole rather
    // than as separate pieces, because the fix is different -- see pointInPolygon.
    const result = buildPeakShapeFromRings([circleRing(20), circleRing(9)]);
    assert.ok(!result.ok);
    assert.match(result.reason, /a hole/);
  });

  it("refuses several detached pieces", () => {
    const result = buildPeakShapeFromRings([circleRing(10, [-30, 0]), circleRing(10, [30, 0])]);
    assert.ok(!result.ok);
    assert.match(result.reason, /separate pieces/);
  });

  it("ignores a stray speck rather than refusing over it", () => {
    // The mirror of the test above: a rounding sliver left behind by an exporter is not a second
    // region in any meaningful sense, and refusing over one would make the feature feel arbitrary.
    const result = buildPeakShapeFromRings([circleRing(100), squareRing(0.3)]);
    assert.ok(result.ok, result.ok ? "" : result.reason);
  });

  it("refuses an svg with no path at all", () => {
    const result = buildPeakShapeFromMarkup(`<circle cx="5" cy="5" r="4"/>`);
    assert.ok(!result.ok);
    assert.match(result.reason, /no <path>/);
  });

  it("refuses an outline with no enclosed area", () => {
    const result = buildPeakShapeFromRings([
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

describe("the persisted shape round-trips", () => {
  it("re-samples from its own normalized path to the same table", () => {
    // The claim samplePeakShapePath rests on: normalization is idempotent, so a shape loaded from the
    // server and a shape just authored produce the same field. If this drifts, a peak changes shape
    // on reload -- the kind of bug that only shows up a session later.
    for (const ring of [squareRing(20), starRing(10, 4), circleRing(13, [40, 40])]) {
      const authored = buildPeakShapeFromRings([ring]);
      assert.ok(authored.ok);
      const reloaded = samplePeakShapePath(authored.shape.path);
      assert.ok(reloaded, "a shape this module just authored must re-sample");
      for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
        assert.ok(
          Math.abs(authored.shape.rho[i] - reloaded.rho[i]) < 1e-4,
          `rho drifted at ${i}: ${authored.shape.rho[i]} vs ${reloaded.rho[i]}`,
        );
      }
      assert.equal(reloaded.path, authored.shape.path, "re-normalizing should be a no-op");
    }
  });

  it("centers the persisted path on the origin at unit maximum radius", () => {
    // What lets cx/cy/radius keep meaning exactly what they mean for a circle.
    const authored = buildPeakShapeFromRings([starRing(80, 30)]);
    assert.ok(authored.ok);
    const points = flattenPathData(authored.shape.path)[0];
    const [cx, cy] = polygonCentroid(points);
    assert.ok(Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4, `centroid should be the origin, got ${cx},${cy}`);
    assert.ok(Math.abs(Math.max(...distances(points)) - 1) < 1e-4, "maximum radius should be 1");
  });

  it("survives the full markup path", () => {
    // A circle written the way icon sets actually write one: two half-circle arcs. It has to come out
    // flat, because that is what makes a shaped peak additive rather than a second code path -- a
    // circular svg must reproduce the field an unshaped peak already has.
    //
    // "Flat" here is bounded by the flattener, not by the sampler: CURVE_SEGMENTS chords across a
    // half-circle cut inside the true curve by 1 - cos(pi / (2 * CURVE_SEGMENTS)). Asserting that
    // analytic figure rather than a round number means this test tightens automatically if
    // CURVE_SEGMENTS is ever raised, and fails loudly if it is lowered without the tradeoff being
    // considered.
    const worstFlatteningDip = 1 - Math.cos(Math.PI / 96);
    const markup = `<path d="M50,0 A50,50 0 1 1 -50,0 A50,50 0 1 1 50,0 Z"/>`;
    const result = buildPeakShapeFromMarkup(markup);
    assert.ok(result.ok, result.ok ? "" : result.reason);
    assert.ok(worstFlatteningDip < 1e-3, "a half-circle arc should flatten to well under 0.1% radius error");
    // The slack is Float32, not arbitrary: rho is a Float32Array because it is uploaded as texture
    // data, so a bound derived in double precision can only be met to ~1e-7 relative.
    const float32Slack = 1e-6;
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      assert.ok(
        result.shape.rho[i] >= 1 - worstFlatteningDip - float32Slack && result.shape.rho[i] <= 1 + float32Slack,
        `a circular svg should sample flat, got ${result.shape.rho[i]} at index ${i}`,
      );
    }
  });
});

describe("cachedPeakShape -- the render path's entry point", () => {
  it("treats the empty path as a circle without consulting the cache", () => {
    // "" is the absence of a shape, not a round one. Every peak that exists today carries it, and the
    // whole "shaped peaks are additive" claim rests on that case costing nothing.
    assert.equal(cachedPeakShape(""), undefined);
  });

  it("returns the identical object on repeated calls", () => {
    // Identity rather than equality, because that is the property the render path actually needs:
    // resolvePeakUniforms runs every animation frame, and re-sampling there would mean casting 512
    // rays against every edge of the outline sixty times a second. A deep-equal-but-fresh result
    // would pass a value check and still stall a drag.
    const authored = buildPeakShapeFromRings([starRing(10, 4)]);
    assert.ok(authored.ok);
    const first = cachedPeakShape(authored.shape.path);
    assert.ok(first, "a shape this module just authored must re-sample");
    assert.equal(cachedPeakShape(authored.shape.path), first);
  });

  it("caches a shape that fails to re-sample, rather than retrying forever", () => {
    // A stored shape can be unusable -- hand-edited, or written by a future version. Returning
    // undefined is right; doing so by re-running the whole sampler on every frame is not.
    const unusable = "M0,0L1,0L2,0Z";
    assert.equal(cachedPeakShape(unusable), undefined);
    assert.equal(cachedPeakShape(unusable), undefined);
  });

  it("shares one table between peaks wearing the same silhouette", () => {
    // What makes the key the normalized path rather than a peak id: the same svg armed twice produces
    // byte-identical strings, so two peaks (in any mask, in any project) resolve to one table.
    const first = buildPeakShapeFromRings([squareRing(20)]);
    const second = buildPeakShapeFromRings([squareRing(5)]);
    assert.ok(first.ok);
    assert.ok(second.ok);
    assert.equal(second.shape.path, first.shape.path, "normalization should erase the size difference");
    assert.equal(cachedPeakShape(second.shape.path), cachedPeakShape(first.shape.path));
  });
});
