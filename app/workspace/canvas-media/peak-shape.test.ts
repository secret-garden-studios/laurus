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
    const result = buildPeakShapeFromRings([circleRing(37, [12, -5])]);
    assert.ok(result.ok);
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      assert.ok(Math.abs(result.shape.rho[i] - 1) < 1e-4, `rho[${i}] = ${result.shape.rho[i]}`);
      assert.ok(Math.abs(result.shape.rhoPrime[i]) < 1e-2, `rhoPrime[${i}] = ${result.shape.rhoPrime[i]}`);
    }
  });

  it("samples a square as its closed form", () => {
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
    const authored = buildPeakShapeFromRings([starRing(80, 30)]);
    assert.ok(authored.ok);
    const points = flattenPathData(authored.shape.path)[0];
    const [cx, cy] = polygonCentroid(points);
    assert.ok(Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4, `centroid should be the origin, got ${cx},${cy}`);
    assert.ok(Math.abs(Math.max(...distances(points)) - 1) < 1e-4, "maximum radius should be 1");
  });

  it("survives the full markup path", () => {
    const worstFlatteningDip = 1 - Math.cos(Math.PI / 96);
    const markup = `<path d="M50,0 A50,50 0 1 1 -50,0 A50,50 0 1 1 50,0 Z"/>`;
    const result = buildPeakShapeFromMarkup(markup);
    assert.ok(result.ok, result.ok ? "" : result.reason);
    assert.ok(worstFlatteningDip < 1e-3, "a half-circle arc should flatten to well under 0.1% radius error");
    const float32Slack = 1e-6;
    for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
      assert.ok(
        result.shape.rho[i] >= 1 - worstFlatteningDip - float32Slack && result.shape.rho[i] <= 1 + float32Slack,
        `a circular svg should sample flat, got ${result.shape.rho[i]} at index ${i}`,
      );
    }
  });
});

describe("a peak shape authored by the server", () => {
  /** The exact format the server emits Peak.shape in for a detected region:
   *  the region's outer extent measured in PEAK_SHAPE_SAMPLES directions and
   *  emitted as a closed M/L/Z polygon, already centred on its own centroid
   *  and scaled so its furthest point sits at 1. See peak_shape_path and
   *  region_peak_geometry in the server's peak_math.py.
   *
   *  Reproduced here rather than fixtured because what is under test is the
   *  contract, not any one image: a shape built this way has to be one this
   *  module accepts, or the peak silently renders as a plain circle and
   *  nothing anywhere reports why. */
  function serverStyleShapePath(rho: number[]): string {
    const format = (n: number): string => {
      const trimmed = n.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
      return trimmed === "-0" ? "0" : trimmed;
    };
    return (
      rho
        .map((r, i) => {
          const angle = sampleAngle(i, rho.length);
          return `${i === 0 ? "M" : "L"}${format(r * Math.cos(angle))},${format(r * Math.sin(angle))}`;
        })
        .join("") + "Z"
    );
  }

  /** `centred` marks a profile whose polygon has its centroid at the origin
   *  it was built around. Only those can have their table compared entry by
   *  entry: this module re-derives rho about the polygon's own centroid, so
   *  for a lopsided outline the reconstructed table is measured from a
   *  different point and simply is not the same table -- it still describes
   *  the same region, which is what renders. */
  const profiles: [string, (theta: number) => number, boolean][] = [
    ["a round region", () => 1, true],
    ["a lobed blob", (t) => 0.7 + 0.3 * Math.cos(4 * t), true],
    ["an elongated region", (t) => 1 / Math.hypot(Math.cos(t), 2.5 * Math.sin(t)), true],
    ["a region with one long spur", (t) => (Math.abs(t) < 0.3 ? 1 : 0.35), false],
  ];

  for (const [name, profile, centred] of profiles) {
    it(`is accepted and re-sampled for ${name}`, () => {
      const raw = Array.from({ length: PEAK_SHAPE_SAMPLES }, (_, i) => profile(sampleAngle(i, PEAK_SHAPE_SAMPLES)));
      const peak = Math.max(...raw);
      const rho = raw.map((r) => r / peak);

      const shape = samplePeakShapePath(serverStyleShapePath(rho));
      assert.ok(shape, `${name} must survive the parser -- the peak renders as a circle otherwise`);
      assert.equal(shape.rho.length, PEAK_SHAPE_SAMPLES);

      // rho topping out at 1 is what keeps Peak.radius meaning "the peak's
      // furthest reach". Not exactly 1: the maximum is taken over
      // PEAK_SHAPE_VALIDATION_SAMPLES rays but stored at PEAK_SHAPE_SAMPLES
      // of them, so a shape whose extreme falls between two stored
      // directions normalizes a fraction of a percent short.
      assert.ok(Math.abs(Math.max(...shape.rho) - 1) < 5e-3, `max rho was ${Math.max(...shape.rho)}`);
      assert.ok(Math.min(...shape.rho) > 0, "rho must stay positive");

      if (centred) {
        for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
          assert.ok(Math.abs(shape.rho[i] - rho[i]) < 0.02, `rho drifted at ${i}: ${rho[i]} vs ${shape.rho[i]}`);
        }
        return;
      }
      // lopsided: check the region survived rather than the table.
      // Re-normalizing an already-normalized path must be a no-op.
      const reloaded = samplePeakShapePath(shape.path);
      assert.ok(reloaded);
      for (let i = 0; i < PEAK_SHAPE_SAMPLES; i++) {
        assert.ok(Math.abs(shape.rho[i] - reloaded.rho[i]) < 1e-3, `unstable at ${i}`);
      }
    });
  }

  it("reads an empty shape as the plain circle the server means by it", () => {
    assert.equal(cachedPeakShape(""), undefined);
  });
});

describe("cachedPeakShape -- the render path's entry point", () => {
  it("treats the empty path as a circle without consulting the cache", () => {
    assert.equal(cachedPeakShape(""), undefined);
  });

  it("returns the identical object on repeated calls", () => {
    const authored = buildPeakShapeFromRings([starRing(10, 4)]);
    assert.ok(authored.ok);
    const first = cachedPeakShape(authored.shape.path);
    assert.ok(first, "a shape this module just authored must re-sample");
    assert.equal(cachedPeakShape(authored.shape.path), first);
  });

  it("caches a shape that fails to re-sample, rather than retrying forever", () => {
    const unusable = "M0,0L1,0L2,0Z";
    assert.equal(cachedPeakShape(unusable), undefined);
    assert.equal(cachedPeakShape(unusable), undefined);
  });

  it("shares one table between peaks wearing the same silhouette", () => {
    const first = buildPeakShapeFromRings([squareRing(20)]);
    const second = buildPeakShapeFromRings([squareRing(5)]);
    assert.ok(first.ok);
    assert.ok(second.ok);
    assert.equal(second.shape.path, first.shape.path, "normalization should erase the size difference");
    assert.equal(cachedPeakShape(second.shape.path), cachedPeakShape(first.shape.path));
  });
});
