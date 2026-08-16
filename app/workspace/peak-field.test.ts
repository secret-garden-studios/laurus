/**
 * Unit tests for the topology peak height field's math (see PEAK_FIELD_GLSL in mask-gl.ts).
 *
 *     node --experimental-strip-types --test app/workspace/peak-field.test.ts
 *
 * No test framework and no bundler: node:test plus Node's own type stripping, which works here only
 * because mask-gl.ts has no runtime imports (see its `import type` on line 1).
 *
 * What these can and cannot check is worth being precise about, because the functions under test are
 * TypeScript *twins* of GLSL that runs on the GPU -- there is no headless GL here to compare against.
 * So this pins two things: that the twins satisfy the mathematical properties the design argument
 * rests on (which is what makes the GLSL correct, since it's the same formulas), and that the twins
 * agree with the closed forms quoted in the comments. Drift between these and the actual GLSL would
 * still be invisible to this file -- which is exactly why peakSwellAt is never used to move a point,
 * only to budget triangles, so such drift can cost a slightly wrong triangle count and nothing worse.
 */

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
// Separately, and as `import type`: type stripping erases the annotation but leaves a value import
// in place, and a type imported as a value is a runtime resolution error.
import type { PeakGeometryInput } from "./mask-gl.ts";

// The falloffs worth checking: the authorable floor (a paraboloid, whose rim slope is deliberately
// nonzero), the default dome, and two progressively needlier profiles.
const FALLOFFS = [1, 2, 4, 6];

function peak(over: Partial<PeakGeometryInput> = {}): PeakGeometryInput {
  return { cx: 100, cy: 100, radius: 50, elevation: 80, falloff: 2, ...over };
}

/** max |swell| along a radial sweep out to the rim, sampled finely enough to find the true peak of a
 * smooth function to ~1e-3. */
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
      // Not exactly 0: peakProfile floors its base at 1e-4 to keep the derivative branch finite for a
      // falloff below 1 (which a document stored before MIN_MASK_PEAK_FALLOFF existed can carry), so
      // the rim value is that floor raised to the falloff -- indistinguishable from 0 in the field.
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
    // The load-bearing check for the whole bump map: the fragment stage builds its normal from
    // dk/du while the vertex stage displaces by k, so if the one is not the derivative of the other,
    // the surface being lit is not the surface being drawn. Verified by central difference.
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
    // The specific dome the default was chosen for, quoted in MIN/MAX_MASK_PEAK_FALLOFF's comment.
    for (let u = 0.05; u < 0.95; u += 0.05) {
      const analytic = -2 * 2 * u * Math.pow(1 - u * u, 1);
      assert.ok(Math.abs(analytic - -4 * u * (1 - u * u)) < 1e-9, `at u=${u}`);
    }
  });
});

describe("peakSwellAt -- the in-plane displacement", () => {
  it("is exactly zero at the epicenter", () => {
    // The apex sits on its own projection axis, so there is nothing to push it toward. Exactly zero
    // rather than nearly so, which is also what makes peakIdAtPoint's undisplaced hit test exact
    // right at the epicenter.
    for (const falloff of FALLOFFS) {
      assert.deepEqual(peakSwellAt([100, 100], [peak({ falloff })]), [0, 0], `falloff ${falloff}`);
    }
  });

  it("is exactly zero at and beyond the rim", () => {
    // Half of the no-tearing argument: a peak cannot disturb a vertex outside its own radius, so a
    // subdivided triangle can never pull away from an unsubdivided neighbour. Must hold for EVERY
    // falloff -- it's the property that ruled out displacing along the gradient instead, whose weight
    // stays nonzero at the rim for falloff < 2.
    for (const falloff of FALLOFFS) {
      const p = peak({ falloff });
      assert.deepEqual(peakSwellAt([150, 100], [p]), [0, 0], `at rim, falloff ${falloff}`);
      assert.deepEqual(peakSwellAt([200, 100], [p]), [0, 0], `beyond rim, falloff ${falloff}`);
      assert.deepEqual(peakSwellAt([100, 151], [p]), [0, 0], `beyond rim on y, falloff ${falloff}`);
    }
  });

  it("matches the closed-form maximum wherever the fold guard is idle", () => {
    // u*k(u) maximises at u* = (1 + 2f)^-1/2 with value u* * (2f/(1+2f))^f -- the bound quoted in
    // peakSwell's own comment, and what makes the displacement's magnitude independent of radius.
    // Only tight while the clamp isn't engaged, so that precondition is asserted rather than assumed:
    // if MASK_PEAK_SWELL is ever raised past the point where an ordinary peak clamps, this fails
    // loudly instead of the bound quietly becoming a lie.
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
    // The pixel bound is the one thing that must survive the fold guard engaging, since it's what
    // makes the worst case predictable rather than radius-dependent. A tall peak on a tiny radius is
    // the case that engages it.
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
        // ...and the no-tearing endpoints still hold while clamped.
        assert.deepEqual(peakSwellAt([p.cx, p.cy], [p]), [0, 0]);
        assert.deepEqual(peakSwellAt([p.cx + p.radius, p.cy], [p]), [0, 0]);
      }
    }
  });

  it("never folds a point through its own epicenter", () => {
    // What MASK_PEAK_SWELL_LIMIT exists for. One peak maps p -> c + (1 + coeff)(p - c), so the mesh
    // inverts if 1 + coeff ever reaches 0 -- which an extreme crater on a small radius would do
    // unclamped. The scale factor must stay positive all the way in.
    const crater = peak({ radius: 10, elevation: -MAX_MASK_PEAK_ELEVATION, falloff: MIN_MASK_PEAK_FALLOFF });
    for (let d = 0.01; d < crater.radius; d += 0.01) {
      const [dx] = peakSwellAt([crater.cx + d, crater.cy], [crater]);
      assert.ok((d + dx) / d > 0, `folded through the epicenter at d=${d}`);
    }
  });

  it("sums linearly, so an overlapping bump and dent cancel exactly", () => {
    // The field is a plain sum, which is what lets a dent be used to carve into a bump rather than
    // fight it. Exact cancellation (not merely small) is the check that nothing in the accumulation
    // is order-dependent or clamped per-peak in a way that breaks superposition at ordinary values.
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
  // There is no GLSL compiler in this project's toolchain, so a genuine shader error surfaces only as
  // a console message and a blank mask canvas in a browser. These checks cover the mistakes that are
  // both statically detectable and specific to how this shader is *assembled* -- a template spliced
  // into two stages from JS constants -- rather than to what it computes.
  const stages = Object.entries(LIGHT_SOURCE_SHADER) as [string, string][];

  it("splices the shared peak kernel into both stages exactly once", () => {
    // Both stages need it (the vertex stage to displace, the fragment stage to take the gradient) and
    // neither may get it twice, which a redeclaration error would reject.
    for (const [stage, src] of stages) {
      for (const signature of ["vec2 peakProfile(", "vec3 peakField(", "vec2 peakSwell("]) {
        assert.equal(src.split(signature).length - 1, 1, `${stage}: ${signature}`);
      }
    }
  });

  it("leaves no unspliced template placeholder or non-finite constant in either stage", () => {
    // Every numeric constant in the kernel arrives from a JS value through glFloat. A typo'd or
    // undefined export would splice the string "undefined"/"NaN" straight into the source, which is a
    // compile error with a famously unhelpful message. Comments are stripped first, since the prose
    // legitimately uses the word "undefined" to describe the radial direction at an epicenter.
    for (const [stage, src] of stages) {
      const code = src.replace(/\/\/[^\n]*/g, "");
      assert.ok(!/\$\{/.test(code), `${stage}: unspliced \${...}`);
      assert.ok(!/NaN|undefined/.test(code), `${stage}: non-finite constant`);
    }
  });

  it("gives every spliced float constant a decimal point", () => {
    // GLSL ES 1.00 has no implicit int->float conversion, so `#define X 2` used in a float expression
    // is a compile error where `2.0` is fine. glFloat exists to guarantee this; this checks it held.
    for (const [stage, src] of stages) {
      const offenders = src
        .split("\n")
        .filter((line) => /^#define (MASK_PEAK|BUMP|LIGHT_HEIGHT|PEAK_)/.test(line) && !/\d\.\d/.test(line));
      assert.deepEqual(offenders, [], `${stage}`);
    }
    // ...while the array bound must be an integer literal, since it both sizes an array and bounds a
    // loop, neither of which accepts a float.
    for (const [stage, src] of stages) {
      const match = src.match(/#define MAX_MASK_PEAKS (\S+)/);
      assert.ok(match && /^\d+$/.test(match[1]), `${stage}: MAX_MASK_PEAKS = ${match?.[1]}`);
    }
  });

  it("bounds every loop by a compile-time constant rather than a uniform", () => {
    // GLSL ES 1.00 only guarantees loops whose iteration count is known at compile time, which is why
    // the kernel's loops run to MAX_MASK_PEAKS and break on the uniform count inside, mirroring the
    // light loop that already worked this way. A loop written directly against u_peakCount would
    // compile on a permissive desktop driver and fail on a strict one.
    for (const [stage, src] of stages) {
      const bounds = [...src.matchAll(/for \(int i = 0; i < (\w+); i\+\+\)/g)].map((m) => m[1]);
      assert.ok(bounds.length > 0, `${stage}: no loops found`);
      for (const bound of bounds) assert.match(bound, /^MAX_/, `${stage}: loop bound`);
    }
  });

  it("declares the peak uniforms at the same precision in both stages", () => {
    // The one failure here that is a *link* error rather than a compile error, and so the least obvious
    // to diagnose: a uniform declared in both stages must agree on precision, and the two stages have
    // different defaults (highp in the vertex stage, mediump in the fragment stage). Hence the explicit
    // mediump in the kernel -- this pins that it survives.
    for (const name of ["u_peaks", "u_peakFalloffs"]) {
      const qualifierOf = (src: string) => (src.match(new RegExp(`uniform (\\w+) \\w+ ${name}\\[`)) ?? [])[1];
      const vertex = qualifierOf(LIGHT_SOURCE_SHADER.vertex);
      assert.ok(vertex, `${name}: not declared in the vertex stage`);
      assert.equal(qualifierOf(LIGHT_SOURCE_SHADER.fragment), vertex, `${name}: precision mismatch`);
    }
  });

  it("keeps the fragment stage's #extension directive ahead of everything else", () => {
    // GLSL requires #extension before any non-preprocessor token, so splicing the kernel in must not
    // have landed above it.
    const first = LIGHT_SOURCE_SHADER.fragment.split("\n").find((line) => line.trim().length > 0);
    assert.match(first ?? "", /^#extension/);
    // ...and the default float precision must be established before the kernel's own float locals.
    const precision = LIGHT_SOURCE_SHADER.fragment.indexOf("precision mediump float;");
    assert.ok(precision >= 0 && precision < LIGHT_SOURCE_SHADER.fragment.indexOf("vec2 peakProfile("));
  });

  it("declares v_meshPos in both stages", () => {
    // A varying written by one stage and read by the other; a mismatch is a link error.
    for (const [stage, src] of stages) {
      assert.match(src, /varying vec2 v_meshPos;/, `${stage}`);
    }
  });

  it("declares the shape sampler mediump rather than letting it default", () => {
    // The subtlest of the precision traps here, because it produces no diagnostic at all. GLSL ES
    // 1.00 defaults sampler2D to *lowp* in both stages, and texture2D returns values at its sampler's
    // precision -- so under the default, the low byte of every pair decodePeakShape16 reassembles is
    // rounded away and the 16-bit table silently becomes an 8-bit one. It compiles, it links, it
    // renders, and a shaped peak's outline just quietly stair-steps.
    for (const [stage, src] of stages) {
      assert.match(src, /uniform mediump sampler2D u_peakShapes;/, `${stage}`);
    }
  });

  it("keeps the shape lookup's overflow guards in place", () => {
    // Neither guard changes what any real shape renders as (see PEAK_SHAPE_MIN_RHO and
    // PEAK_GRADIENT_LIMIT), which is exactly why they are easy to delete as dead weight. What they
    // actually prevent is the gradient's 1/rho^2 running away on a needle-thin lobe until it
    // overflows mediump, at which point normalize() turns inf into NaN and the peak renders with
    // black fragments scattered over it -- a symptom with no obvious connection to its cause.
    for (const [stage, src] of stages) {
      assert.match(src, /max\(pair\.x, PEAK_SHAPE_MIN_RHO\)/, `${stage}: rho floor`);
      assert.match(src, /clamp\(gradU, -PEAK_GRADIENT_LIMIT, PEAK_GRADIENT_LIMIT\)/, `${stage}: gradient clamp`);
    }
  });

  it("splices the shape lookup into both stages exactly once", () => {
    // Same reasoning as the kernel check above: the vertex stage reads a shape to displace by it and
    // the fragment stage to light it, so both need it and neither may redeclare it.
    for (const [stage, src] of stages) {
      for (const signature of ["vec2 peakShapeAt(", "float decodePeakShape16("]) {
        assert.equal(src.split(signature).length - 1, 1, `${stage}: ${signature}`);
      }
    }
  });
});

describe("peakShapeRhoAt -- the shape lookup's TypeScript twin", () => {
  /** A table whose value at sample i is i + 1, so an interpolated read is trivially predictable.
   * Starting at 1 rather than 0 keeps every entry a legal rho -- 0 is not a reach any shape can have,
   * and peakShapeRhoAt floors it, which would make sample 0 read as the floor instead of the table. */
  const ramp = (samples: number) => ({
    path: "",
    rho: Float32Array.from({ length: samples }, (_, i) => i + 1),
    rhoPrime: new Float32Array(samples),
  });

  it("is exactly 1 for a circle, at every angle", () => {
    // The constant case the whole design rests on: an unshaped peak must take the identical path
    // through every formula rather than a parallel one, so this has to be exactly 1, not nearly.
    for (let theta = -Math.PI; theta < Math.PI; theta += 0.1) {
      assert.equal(peakShapeRhoAt(undefined, theta), 1, `at theta=${theta.toFixed(2)}`);
    }
  });

  it("reads sample i at that sample's own angle", () => {
    // Pins the index convention shared with the shader: sample 0 sits at theta = -pi, and the sweep
    // runs to +pi. An off-by-half-a-texel here rotates every shaped peak slightly.
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
    // The seam is the one place a table can be read out of bounds, and clamping there would flatten a
    // shaped peak along a single radial line -- a visible crease with no obvious cause.
    const shape = ramp(8);
    // Just shy of +pi is halfway between the last sample (8) and the first (1), i.e. 4.5 -- reached
    // only by wrapping the upper index back to 0. Clamping would give 8 instead.
    const theta = Math.PI - (2 * Math.PI) / 16;
    assert.ok(Math.abs(peakShapeRhoAt(shape, theta) - 4.5) < 1e-6, `got ${peakShapeRhoAt(shape, theta)}`);
  });
});

describe("peakSwellAt -- with a custom shape", () => {
  /** A shape reaching its full radius along +x and half of it along -x, varying smoothly between --
   * enough asymmetry that a formula still using the peak's maximum radius would visibly disagree. */
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
    // The no-tearing guarantee, restated for a radius that varies with direction. It is deliberately
    // pinned against the peak's MAXIMUM reach rather than its local rim, and that is the honest form
    // of the claim rather than a weaker one: rho is at most 1 everywhere, so `radius` bounds the
    // shape in every direction, and a vertex outside it cannot be disturbed by any shape whatsoever.
    // That is precisely what the subdivision pass and the "a subdivided triangle can never pull away
    // from an unsubdivided neighbour" argument need.
    //
    // Exactness at the *local* rim is a different matter and is checked separately below, because it
    // cannot be bit-exact: reconstructing a point at that distance and taking atan2 of it returns a
    // theta a few ulps from the one it was built with, so the interpolated rho differs microscopically
    // and u lands at 0.9999999 rather than 1.
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
    // The other half of no-tearing, and the half a varying radius actually puts at risk: inside a
    // pinched direction the rim arrives early, and if the displacement were still finite there the
    // mesh would tear along the silhouette's own outline. Just inside must be negligible and just
    // outside must be exactly nothing -- checked all the way round, since a formula still dividing by
    // the maximum radius passes on the one axis where rho happens to be 1 and fails everywhere else.
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
    // The bound peakSwell's own comment argues survives the substitution, because the local radius
    // cancels out of h * u * radial entirely. Worth checking rather than trusting: it is the single
    // claim that lets one constant keep tuning the whole feature no matter what shape is authored.
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
    // A rho of all 1s is a circle written the long way round, so it must produce bit-identical output
    // to no shape at all -- the check that the shaped path really is a generalization rather than a
    // parallel implementation that happens to look similar.
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
  /** decodePeakShape16 from the kernel, transcribed. The encoder and the shader are the two halves of
   * one format and are written in different languages, so this pins that they agree -- a mismatch
   * would produce a wrong shape rather than an error. */
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
    // Wrapping would turn the needliest part of a spike into a slope pointing the wrong way, which
    // reads as the lighting inverting on that one lobe. Clamping merely lights it a little flat.
    const slopes = [PEAK_SHAPE_SLOPE_RANGE * 3, -PEAK_SHAPE_SLOPE_RANGE * 3];
    const data = encodePeakShapeTexture([shapeOf([1, 1], slopes)], 2, 4);
    const decoded = slopes.map((_, i) => (decode16(data[i * 4 + 2], data[i * 4 + 3]) * 2 - 1) * PEAK_SHAPE_SLOPE_RANGE);
    assert.ok(Math.abs(decoded[0] - PEAK_SHAPE_SLOPE_RANGE) < 1e-3, `got ${decoded[0]}`);
    assert.ok(Math.abs(decoded[1] + PEAK_SHAPE_SLOPE_RANGE) < 1e-3, `got ${decoded[1]}`);
  });

  it("writes each shape into its own row and leaves circle rows untouched", () => {
    // Row i belongs to peak i, and peakShapeAt indexes by row -- a shape written to the wrong row is
    // a peak silently wearing another peak's outline.
    const data = encodePeakShapeTexture([undefined, shapeOf([1, 1], [0, 0]), undefined], 2, 4);
    assert.deepEqual([...data.slice(0, 8)], new Array(8).fill(0), "row 0 is a circle and stays zeroed");
    assert.equal(data[8], 255, "row 1 carries the shape");
    assert.deepEqual([...data.slice(16, 32)], new Array(16).fill(0), "rows 2 and 3 stay zeroed");
  });

  it("never lets a full-reach direction decode above 1", () => {
    // rho = 1 is the maximum by construction, and peakShapeAt multiplies the peak's radius by it. A
    // decode landing at 1.0000038 would put geometry fractionally outside the radius that peakSwell's
    // no-tearing argument is stated against.
    const data = encodePeakShapeTexture([shapeOf([1, 1, 1], [0, 0, 0])], 3, 1);
    for (let i = 0; i < 3; i++) {
      assert.ok(decode16(data[i * 4], data[i * 4 + 1]) <= 1, `texel ${i}`);
    }
  });
});

describe("isActivePeak -- the shared 'worth uploading / worth subdividing for' predicate", () => {
  it("rejects peaks that cannot contribute to the field", () => {
    // Both branches are load-bearing: a zero elevation has no dome to show, and a non-positive radius
    // is degenerate rather than small (the field divides by it). The shader's loop bound and the CPU's
    // triangle budget both read this, so they cannot disagree about which peaks count.
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
