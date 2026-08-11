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
        .filter((line) => /^#define (MASK_PEAK|BUMP|LIGHT_HEIGHT)/.test(line) && !/\d\.\d/.test(line));
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
