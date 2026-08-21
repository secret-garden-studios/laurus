import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIGHT_SOURCE_SHADER,
  MASK_PEAK_SWELL,
  MASK_PEAK_SWELL_LIMIT,
  MAX_MASK_PEAK_ELEVATION,
  MIN_MASK_PEAK_FALLOFF,
  isActivePeak,
  peakProfileK,
  peakSwellAt,
  PEAK_SHAPE_SLOPE_RANGE,
  encodePeakShapeTexture,
  peakShapeRhoAt,
} from "./mask-gl.ts";
import type { PeakGeometryInput } from "./mask-gl.ts";

const FALLOFFS = [1, 2, 4, 6];

function peak(over: Partial<PeakGeometryInput> = {}): PeakGeometryInput {
  return { cx: 100, cy: 100, radius: 50, elevation: 80, falloff: 2, ...over };
}

function maxSwellAlongRadius(p: PeakGeometryInput, step = 0.001): number {
  let worst = 0;
  for (let d = 0; d <= p.radius; d += step) {
    const [dx, dy] = peakSwellAt([p.cx + d, p.cy], [p]);
    worst = Math.max(worst, Math.hypot(dx, dy));
  }
  return worst;
}

describe("peakProfileK -- the radial profile k(u) = (1 - u^2)^falloff", () => {
  it("is 1 at the epicenter and 0 at the rim, for every falloff", () => {
    for (const falloff of FALLOFFS) {
      assert.equal(peakProfileK(0, falloff), 1, `k(0) at falloff ${falloff}`);
      assert.ok(peakProfileK(1, falloff) <= Math.pow(1e-4, falloff) + 1e-12, `k(1) at falloff ${falloff}`);
    }
  });

  it("decreases monotonically from epicenter to rim", () => {
    for (const falloff of FALLOFFS) {
      let previous = Infinity;
      for (let u = 0; u <= 1; u += 0.01) {
        const k = peakProfileK(u, falloff);
        assert.ok(k <= previous + 1e-12, `k rose at u=${u}, falloff ${falloff}`);
        previous = k;
      }
    }
  });

  it("matches the analytic gradient the fragment shader lights with", () => {
    for (const falloff of FALLOFFS) {
      for (let u = 0.02; u < 0.98; u += 0.01) {
        const h = 1e-6;
        const numeric = (peakProfileK(u + h, falloff) - peakProfileK(u - h, falloff)) / (2 * h);
        const analytic = -2 * falloff * u * Math.pow(Math.max(1 - u * u, 1e-4), falloff - 1);
        assert.ok(
          Math.abs(numeric - analytic) < 1e-4,
          `gradient mismatch at u=${u.toFixed(2)}, falloff ${falloff}: ${numeric} vs ${analytic}`,
        );
      }
    }
  });

  it("reduces to the promised -4u(1-u^2) at the default falloff of 2", () => {
    for (let u = 0.05; u < 0.95; u += 0.05) {
      const analytic = -2 * 2 * u * Math.pow(1 - u * u, 1);
      assert.ok(Math.abs(analytic - -4 * u * (1 - u * u)) < 1e-9, `at u=${u}`);
    }
  });
});

describe("peakSwellAt -- the in-plane displacement", () => {
  it("is exactly zero at the epicenter", () => {
    for (const falloff of FALLOFFS) {
      assert.deepEqual(peakSwellAt([100, 100], [peak({ falloff })]), [0, 0], `falloff ${falloff}`);
    }
  });

  it("is exactly zero at and beyond the rim", () => {
    for (const falloff of FALLOFFS) {
      const p = peak({ falloff });
      assert.deepEqual(peakSwellAt([150, 100], [p]), [0, 0], `at rim, falloff ${falloff}`);
      assert.deepEqual(peakSwellAt([200, 100], [p]), [0, 0], `beyond rim, falloff ${falloff}`);
      assert.deepEqual(peakSwellAt([100, 151], [p]), [0, 0], `beyond rim on y, falloff ${falloff}`);
    }
  });

  it("matches the closed-form maximum wherever the fold guard is idle", () => {
    for (const falloff of FALLOFFS) {
      const p = peak({ falloff });
      assert.ok(
        (MASK_PEAK_SWELL * Math.abs(p.elevation)) / p.radius <= MASK_PEAK_SWELL_LIMIT,
        `the fold guard should be idle for an ordinary peak (falloff ${falloff})`,
      );
      const uStar = Math.pow(1 + 2 * falloff, -0.5);
      const expected = MASK_PEAK_SWELL * p.elevation * uStar * Math.pow((2 * falloff) / (1 + 2 * falloff), falloff);
      assert.ok(
        Math.abs(maxSwellAlongRadius(p) - expected) < 1e-2,
        `falloff ${falloff}: got ${maxSwellAlongRadius(p)}, expected ${expected}`,
      );
    }
  });

  it("stays within 0.385 * MASK_PEAK_SWELL * |elevation| px even for a clamped needle", () => {
    for (const elevation of [MAX_MASK_PEAK_ELEVATION, -MAX_MASK_PEAK_ELEVATION]) {
      for (const falloff of FALLOFFS) {
        const p = peak({ radius: 10, elevation, falloff });
        assert.ok(
          (MASK_PEAK_SWELL * Math.abs(elevation)) / p.radius > MASK_PEAK_SWELL_LIMIT,
          "this case is meant to engage the fold guard",
        );
        assert.ok(
          maxSwellAlongRadius(p, 0.001) <= 0.385 * MASK_PEAK_SWELL * Math.abs(elevation) + 1e-9,
          `bound exceeded at elevation ${elevation}, falloff ${falloff}`,
        );
        assert.deepEqual(peakSwellAt([p.cx, p.cy], [p]), [0, 0]);
        assert.deepEqual(peakSwellAt([p.cx + p.radius, p.cy], [p]), [0, 0]);
      }
    }
  });

  it("never folds a point through its own epicenter", () => {
    const crater = peak({ radius: 10, elevation: -MAX_MASK_PEAK_ELEVATION, falloff: MIN_MASK_PEAK_FALLOFF });
    for (let d = 0.01; d < crater.radius; d += 0.01) {
      const [dx] = peakSwellAt([crater.cx + d, crater.cy], [crater]);
      assert.ok((d + dx) / d > 0, `folded through the epicenter at d=${d}`);
    }
  });

  it("sums linearly, so an overlapping bump and dent cancel exactly", () => {
    const bump = peak({ elevation: 80 });
    const dent = peak({ elevation: -80 });
    for (let d = 0; d < 50; d += 0.5) {
      const [dx, dy] = peakSwellAt([100 + d, 100 + d * 0.3], [bump, dent]);
      assert.equal(dx, 0, `x at d=${d}`);
      assert.equal(dy, 0, `y at d=${d}`);
    }
  });

  it("treats a dent as the mirror of the bump it inverts", () => {
    for (const falloff of FALLOFFS) {
      for (let d = 1; d < 50; d += 1) {
        const up = peakSwellAt([100 + d, 100], [peak({ elevation: 80, falloff })]);
        const down = peakSwellAt([100 + d, 100], [peak({ elevation: -80, falloff })]);
        assert.ok(Math.abs(up[0] + down[0]) < 1e-12, `falloff ${falloff} at d=${d}`);
      }
    }
  });
});

describe("LIGHT_SOURCE_SHADER -- structural checks on the generated GLSL", () => {
  const stages = Object.entries(LIGHT_SOURCE_SHADER) as [string, string][];

  it("splices the shared peak kernel into both stages exactly once", () => {
    for (const [stage, src] of stages) {
      for (const signature of ["vec2 peakProfile(", "vec3 peakField(", "vec2 peakSwell("]) {
        assert.equal(src.split(signature).length - 1, 1, `${stage}: ${signature}`);
      }
    }
  });

  it("leaves no unspliced template placeholder or non-finite constant in either stage", () => {
    for (const [stage, src] of stages) {
      const code = src.replace(/\/\/[^\n]*/g, "");
      assert.ok(!/\$\{/.test(code), `${stage}: unspliced \${...}`);
      assert.ok(!/NaN|undefined/.test(code), `${stage}: non-finite constant`);
    }
  });

  it("gives every spliced float constant a decimal point", () => {
    for (const [stage, src] of stages) {
      const offenders = src
        .split("\n")
        .filter((line) => /^#define (MASK_PEAK|BUMP|LIGHT_HEIGHT|PEAK_)/.test(line) && !/\d\.\d/.test(line));
      assert.deepEqual(offenders, [], `${stage}`);
    }
    for (const [stage, src] of stages) {
      const match = src.match(/#define MAX_MASK_PEAKS (\S+)/);
      assert.ok(match && /^\d+$/.test(match[1]), `${stage}: MAX_MASK_PEAKS = ${match?.[1]}`);
    }
  });

  it("bounds every loop by a compile-time constant rather than a uniform", () => {
    for (const [stage, src] of stages) {
      const bounds = [...src.matchAll(/for \(int i = 0; i < (\w+); i\+\+\)/g)].map((m) => m[1]);
      assert.ok(bounds.length > 0, `${stage}: no loops found`);
      for (const bound of bounds) assert.match(bound, /^MAX_/, `${stage}: loop bound`);
    }
  });

  it("declares the peak uniforms at the same precision in both stages", () => {
    for (const name of ["u_peaks", "u_peakFalloffs"]) {
      const qualifierOf = (src: string) => (src.match(new RegExp(`uniform (\\w+) \\w+ ${name}\\[`)) ?? [])[1];
      const vertex = qualifierOf(LIGHT_SOURCE_SHADER.vertex);
      assert.ok(vertex, `${name}: not declared in the vertex stage`);
      assert.equal(qualifierOf(LIGHT_SOURCE_SHADER.fragment), vertex, `${name}: precision mismatch`);
    }
  });

  it("keeps the fragment stage's #extension directive ahead of everything else", () => {
    const first = LIGHT_SOURCE_SHADER.fragment.split("\n").find((line) => line.trim().length > 0);
    assert.match(first ?? "", /^#extension/);
    const precision = LIGHT_SOURCE_SHADER.fragment.indexOf("precision mediump float;");
    assert.ok(precision >= 0 && precision < LIGHT_SOURCE_SHADER.fragment.indexOf("vec2 peakProfile("));
  });

  it("declares v_meshPos in both stages", () => {
    for (const [stage, src] of stages) {
      assert.match(src, /varying vec2 v_meshPos;/, `${stage}`);
    }
  });

  it("declares the shape sampler mediump rather than letting it default", () => {
    for (const [stage, src] of stages) {
      assert.match(src, /uniform mediump sampler2D u_peakShapes;/, `${stage}`);
    }
  });

  it("keeps the shape lookup's overflow guards in place", () => {
    for (const [stage, src] of stages) {
      assert.match(src, /max\(pair\.x, PEAK_SHAPE_MIN_RHO\)/, `${stage}: rho floor`);
      assert.match(src, /clamp\(gradU, -PEAK_GRADIENT_LIMIT, PEAK_GRADIENT_LIMIT\)/, `${stage}: gradient clamp`);
    }
  });

  it("splices the shape lookup into both stages exactly once", () => {
    for (const [stage, src] of stages) {
      for (const signature of ["vec2 peakShapeAt(", "float decodePeakShape16("]) {
        assert.equal(src.split(signature).length - 1, 1, `${stage}: ${signature}`);
      }
    }
  });
});

describe("peakShapeRhoAt -- the shape lookup's TypeScript twin", () => {
  const ramp = (samples: number) => ({
    path: "",
    rho: Float32Array.from({ length: samples }, (_, i) => i + 1),
    rhoPrime: new Float32Array(samples),
  });

  it("is exactly 1 for a circle, at every angle", () => {
    for (let theta = -Math.PI; theta < Math.PI; theta += 0.1) {
      assert.equal(peakShapeRhoAt(undefined, theta), 1, `at theta=${theta.toFixed(2)}`);
    }
  });

  it("reads sample i at that sample's own angle", () => {
    const shape = ramp(8);
    for (let i = 0; i < 8; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / 8;
      assert.ok(Math.abs(peakShapeRhoAt(shape, theta) - (i + 1)) < 1e-6, `sample ${i}`);
    }
  });

  it("interpolates linearly between samples", () => {
    const shape = ramp(8);
    const theta = -Math.PI + (2 * Math.PI * 2.5) / 8;
    assert.ok(Math.abs(peakShapeRhoAt(shape, theta) - 3.5) < 1e-6, `got ${peakShapeRhoAt(shape, theta)}`);
  });

  it("wraps across the +/-pi seam instead of clamping", () => {
    const shape = ramp(8);
    const theta = Math.PI - (2 * Math.PI) / 16;
    assert.ok(Math.abs(peakShapeRhoAt(shape, theta) - 4.5) < 1e-6, `got ${peakShapeRhoAt(shape, theta)}`);
  });
});

describe("peakSwellAt -- with a custom shape", () => {
  const lopsided = (samples = 128) => {
    const rho = Float32Array.from({ length: samples }, (_, i) => {
      const theta = -Math.PI + (2 * Math.PI * i) / samples;
      return 0.75 + 0.25 * Math.cos(theta);
    });
    const step = (2 * Math.PI) / samples;
    const rhoPrime = Float32Array.from({ length: samples }, (_, i) => {
      const next = rho[(i + 1) % samples];
      const previous = rho[(i - 1 + samples) % samples];
      return (next - previous) / (2 * step);
    });
    return { path: "lopsided", rho, rhoPrime };
  };

  it("is still exactly zero at the epicenter", () => {
    for (const falloff of FALLOFFS) {
      assert.deepEqual(peakSwellAt([100, 100], [peak({ falloff, shape: lopsided() })]), [0, 0], `falloff ${falloff}`);
    }
  });

  it("is still exactly zero at and beyond the peak's maximum reach, in every direction", () => {
    const shape = lopsided();
    const p = peak({ shape });
    for (let i = 0; i < 64; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / 64;
      for (const distance of [p.radius, p.radius + 1, p.radius * 2]) {
        const [dx, dy] = peakSwellAt([p.cx + distance * Math.cos(theta), p.cy + distance * Math.sin(theta)], [p]);
        assert.deepEqual([dx, dy], [0, 0], `at theta=${theta.toFixed(2)}, distance ${distance.toFixed(2)}`);
      }
    }
  });

  it("falls continuously to zero across the local rim", () => {
    const shape = lopsided();
    const p = peak({ shape });
    for (let i = 0; i < 64; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / 64;
      const localRadius = p.radius * peakShapeRhoAt(shape, theta);
      const [insideX, insideY] = peakSwellAt(
        [p.cx + localRadius * (1 - 1e-6) * Math.cos(theta), p.cy + localRadius * (1 - 1e-6) * Math.sin(theta)],
        [p],
      );
      assert.ok(Math.hypot(insideX, insideY) < 1e-3, `just inside the rim at theta=${theta.toFixed(2)}`);
      const outside = localRadius * (1 + 1e-6);
      assert.deepEqual(
        peakSwellAt([p.cx + outside * Math.cos(theta), p.cy + outside * Math.sin(theta)], [p]),
        [0, 0],
        `just outside the rim at theta=${theta.toFixed(2)}`,
      );
    }
  });

  it("keeps the 0.385 * MASK_PEAK_SWELL * |elevation| pixel bound", () => {
    const shape = lopsided();
    for (const elevation of [MAX_MASK_PEAK_ELEVATION, -MAX_MASK_PEAK_ELEVATION, 80]) {
      for (const falloff of FALLOFFS) {
        const p = peak({ radius: 50, elevation, falloff, shape });
        let worst = 0;
        for (let i = 0; i < 64; i++) {
          const theta = -Math.PI + (2 * Math.PI * i) / 64;
          for (let d = 0; d < p.radius; d += 0.05) {
            const [dx, dy] = peakSwellAt([p.cx + d * Math.cos(theta), p.cy + d * Math.sin(theta)], [p]);
            worst = Math.max(worst, Math.hypot(dx, dy));
          }
        }
        assert.ok(
          worst <= 0.385 * MASK_PEAK_SWELL * Math.abs(elevation) + 1e-9,
          `bound exceeded at elevation ${elevation}, falloff ${falloff}: ${worst}`,
        );
      }
    }
  });

  it("reduces to the unshaped result when the shape is flat", () => {
    const flat = { path: "flat", rho: new Float32Array(128).fill(1), rhoPrime: new Float32Array(128) };
    for (let i = 0; i < 32; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / 32;
      for (const d of [1, 10, 25, 49]) {
        const at: [number, number] = [100 + d * Math.cos(theta), 100 + d * Math.sin(theta)];
        assert.deepEqual(peakSwellAt(at, [peak({ shape: flat })]), peakSwellAt(at, [peak()]), `theta ${theta}, d ${d}`);
      }
    }
  });
});

describe("encodePeakShapeTexture -- the 16-bit byte-pair packing", () => {
  const decode16 = (high: number, low: number) => high / 255 + low / 255 / 255;

  const shapeOf = (rho: number[], rhoPrime: number[]) => ({
    path: "t",
    rho: new Float32Array(rho),
    rhoPrime: new Float32Array(rhoPrime),
  });

  it("round-trips rho to better than one part in 30000", () => {
    const values = [0.001, 0.1, 0.25, 0.5, 0.7071, 0.9, 0.999, 1];
    const data = encodePeakShapeTexture(
      [
        shapeOf(
          values,
          values.map(() => 0),
        ),
      ],
      values.length,
      4,
    );
    values.forEach((expected, i) => {
      const decoded = decode16(data[i * 4], data[i * 4 + 1]);
      assert.ok(Math.abs(decoded - expected) < 3e-5, `rho ${expected} decoded as ${decoded}`);
    });
  });

  it("round-trips a signed slope through the bias", () => {
    const slopes = [0, 1, -1, 3.5, -3.5, PEAK_SHAPE_SLOPE_RANGE, -PEAK_SHAPE_SLOPE_RANGE];
    const data = encodePeakShapeTexture(
      [
        shapeOf(
          slopes.map(() => 1),
          slopes,
        ),
      ],
      slopes.length,
      4,
    );
    slopes.forEach((expected, i) => {
      const decoded = (decode16(data[i * 4 + 2], data[i * 4 + 3]) * 2 - 1) * PEAK_SHAPE_SLOPE_RANGE;
      assert.ok(Math.abs(decoded - expected) < 1e-3, `slope ${expected} decoded as ${decoded}`);
    });
  });

  it("clamps a slope past the encodable range rather than wrapping it", () => {
    const slopes = [PEAK_SHAPE_SLOPE_RANGE * 3, -PEAK_SHAPE_SLOPE_RANGE * 3];
    const data = encodePeakShapeTexture([shapeOf([1, 1], slopes)], 2, 4);
    const decoded = slopes.map((_, i) => (decode16(data[i * 4 + 2], data[i * 4 + 3]) * 2 - 1) * PEAK_SHAPE_SLOPE_RANGE);
    assert.ok(Math.abs(decoded[0] - PEAK_SHAPE_SLOPE_RANGE) < 1e-3, `got ${decoded[0]}`);
    assert.ok(Math.abs(decoded[1] + PEAK_SHAPE_SLOPE_RANGE) < 1e-3, `got ${decoded[1]}`);
  });

  it("writes each shape into its own row and leaves circle rows untouched", () => {
    const data = encodePeakShapeTexture([undefined, shapeOf([1, 1], [0, 0]), undefined], 2, 4);
    assert.deepEqual([...data.slice(0, 8)], new Array(8).fill(0), "row 0 is a circle and stays zeroed");
    assert.equal(data[8], 255, "row 1 carries the shape");
    assert.deepEqual([...data.slice(16, 32)], new Array(16).fill(0), "rows 2 and 3 stay zeroed");
  });

  it("never lets a full-reach direction decode above 1", () => {
    const data = encodePeakShapeTexture([shapeOf([1, 1, 1], [0, 0, 0])], 3, 1);
    for (let i = 0; i < 3; i++) {
      assert.ok(decode16(data[i * 4], data[i * 4 + 1]) <= 1, `texel ${i}`);
    }
  });
});

describe("isActivePeak -- the shared 'worth uploading / worth subdividing for' predicate", () => {
  it("rejects peaks that cannot contribute to the field", () => {
    assert.equal(isActivePeak(peak({ elevation: 0 })), false, "zero elevation");
    assert.equal(isActivePeak(peak({ radius: 0 })), false, "zero radius");
    assert.equal(isActivePeak(peak({ radius: -5 })), false, "negative radius");
    assert.equal(isActivePeak(peak()), true, "an ordinary peak");
    assert.equal(isActivePeak(peak({ elevation: -80 })), true, "a dent is active");
  });

  it("agrees with peakSwellAt about a zero-elevation peak doing nothing", () => {
    const flat = peak({ elevation: 0 });
    assert.equal(isActivePeak(flat), false);
    for (let d = 0; d < flat.radius; d += 1) {
      assert.deepEqual(peakSwellAt([flat.cx + d, flat.cy], [flat]), [0, 0], `at d=${d}`);
    }
  });
});
