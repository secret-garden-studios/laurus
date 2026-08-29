import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OBJECT_SDF_MARGIN, objectShapeDepthAt, sampleObjectShapePath, type ObjectShape } from "./object-shape.ts";
import { unitCirclePath } from "./object-path.ts";

/**
 * The two ramps the mask shader used to write directly in distance, before a
 * light could be shaped -- transcribed exactly as they were.
 *
 *     highlight = 1 - smoothstep(radius * 0.35, radius, dist)
 *     shadow    = smoothstep(radius, radius + falloff, dist)
 *
 * Kept here rather than imported because the point of the tests below is that
 * the new formulation still computes these; importing the thing under test's
 * own idea of the old behaviour would prove nothing.
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function legacyHighlight(dist: number, radius: number): number {
  return 1 - smoothstep(radius * 0.35, radius, dist);
}

function legacyShadow(dist: number, radius: number, falloff: number): number {
  return smoothstep(radius, radius + falloff, dist);
}

/**
 * lightProfile, by hand, from LIGHT_FIELD_GLSL in mask-gl.ts.
 *
 * A transcription rather than a shared implementation, because the original is
 * GLSL and cannot be run here. That makes this test a guard on the *algebra*
 * and on the tile data feeding it -- not on the shader compiling, which
 * nothing in this suite can reach. Keep the two in step by hand: if the GLSL
 * changes, this changes with it, and the assertions below say what the change
 * has to preserve.
 *
 * Returns [u, beyond] -- see the GLSL's own doc comment.
 */
function lightProfile(shape: ObjectShape | undefined, toPoint: [number, number], radius: number): [number, number] {
  const dist = Math.hypot(toPoint[0], toPoint[1]);
  if (!shape) return [dist / radius, Math.max(dist - radius, 0)];

  const n: [number, number] = [toPoint[0] / radius, toPoint[1] / radius];
  const reach = Math.hypot(n[0], n[1]);
  const overshoot = Math.max(reach - OBJECT_SDF_MARGIN, 0);
  const scale = Math.min(1, OBJECT_SDF_MARGIN / Math.max(reach, 1e-6));
  const depth = objectShapeDepthAt(shape, n[0] * scale, n[1] * scale) - overshoot;

  return [1 - depth / shape.maxDepth, Math.max(-depth * radius, 0)];
}

const shapedHighlight = (u: number): number => 1 - smoothstep(0.35, 1, u);
const shapedShadow = (beyond: number, falloff: number): number => smoothstep(0, falloff, beyond);

describe("lightProfile -- an unshaped light lights exactly as it always did", () => {
  // Deliberately spans well past the outline: a light's falloff routinely runs
  // several radii out, which is the whole reason `beyond` is measured in mesh
  // units rather than read off a distance tile that stops at the margin.
  const radii = [1, 8, 75, 150];
  const falloffs = [1, 20, 350, 1000];
  const offsets = [0, 0.01, 0.35, 0.9, 1, 1.05, 1.1, 1.5, 3, 6];

  it("reproduces the old highlight ramp for every radius and distance", () => {
    for (const radius of radii) {
      for (const offset of offsets) {
        const dist = offset * radius;
        const [u] = lightProfile(undefined, [dist, 0], radius);
        assert.ok(
          Math.abs(shapedHighlight(u) - legacyHighlight(dist, radius)) < 1e-12,
          `highlight differs at radius ${radius}, dist ${dist}`,
        );
      }
    }
  });

  it("reproduces the old shadow ramp for every radius, falloff and distance", () => {
    for (const radius of radii) {
      for (const falloff of falloffs) {
        for (const offset of offsets) {
          const dist = offset * radius;
          const [, beyond] = lightProfile(undefined, [dist, 0], radius);
          assert.ok(
            Math.abs(shapedShadow(beyond, falloff) - legacyShadow(dist, radius, falloff)) < 1e-12,
            `shadow differs at radius ${radius}, falloff ${falloff}, dist ${dist}`,
          );
        }
      }
    }
  });

  it("does not depend on which direction the offset points", () => {
    const straight = lightProfile(undefined, [30, 0], 40);
    for (const angle of [0.3, 1.1, 2.7, 4.4, 6.0]) {
      const turned = lightProfile(undefined, [30 * Math.cos(angle), 30 * Math.sin(angle)], 40);
      assert.ok(Math.abs(turned[0] - straight[0]) < 1e-12);
      assert.ok(Math.abs(turned[1] - straight[1]) < 1e-12);
    }
  });
});

describe("lightProfile -- a light shaped like a circle is the unshaped light", () => {
  const circle = sampleObjectShapePath(unitCirclePath());

  it("builds a unit circle whose deepest point is its centre", () => {
    assert.ok(circle);
    // The identity the whole shapeless branch rests on: for a circle of radius
    // R the depth is R - dist and its maximum is R, so u = dist / R exactly.
    assert.ok(Math.abs(circle.maxDepth - 1) < 0.02, `maxDepth was ${circle.maxDepth}`);
  });

  it("agrees with the shapeless branch across the interior and just past the rim", () => {
    assert.ok(circle);
    const radius = 120;
    // Tolerance is sampling, not algebra: the outline is rasterized into a
    // 128-texel tile spanning 2.2 normalized units, so a texel is ~0.017 of a
    // radius and a bilinear read lands within about one of them.
    for (const offset of [0, 0.1, 0.35, 0.6, 0.9, 1, 1.05]) {
      for (const angle of [0, 0.7, 1.9, 3.3, 5.1]) {
        const point: [number, number] = [offset * radius * Math.cos(angle), offset * radius * Math.sin(angle)];
        const [u, beyond] = lightProfile(circle, point, radius);
        const [plainU, plainBeyond] = lightProfile(undefined, point, radius);
        assert.ok(Math.abs(u - plainU) < 0.05, `u ${u} vs ${plainU} at offset ${offset}, angle ${angle}`);
        assert.ok(
          Math.abs(beyond - plainBeyond) < 0.05 * radius,
          `beyond ${beyond} vs ${plainBeyond} at offset ${offset}, angle ${angle}`,
        );
      }
    }
  });

  it("keeps growing past the tile, where the distance field has run out", () => {
    assert.ok(circle);
    const radius = 100;
    // Past OBJECT_SDF_MARGIN the tile cannot say how far away anything is, so
    // the sample is carried outward from its edge. Without that the shadow
    // would flatten at a hard ring the shape of the tile, well inside a
    // falloff that routinely reaches several radii out.
    let previous = -Infinity;
    for (const offset of [1.1, 1.5, 2, 3, 5, 8]) {
      const [, beyond] = lightProfile(circle, [offset * radius, 0], radius);
      assert.ok(beyond > previous, `beyond stopped growing at offset ${offset}`);
      assert.ok(
        Math.abs(beyond - (offset - 1) * radius) < 0.05 * radius,
        `beyond ${beyond} should track the true distance at offset ${offset}`,
      );
      previous = beyond;
    }
  });
});

/**
 * The shape the far field used to be wrong for, and the reason it is not a
 * bounding circle any more.
 *
 * A crescent's notch is inside its bounding circle but outside the crescent,
 * so any extrapolation that forgets which direction the shape lies in will
 * light the notch as though the shape filled it.
 */
describe("lightProfile -- a crescent lights like a crescent, not like its bounding circle", () => {
  // The bite opens toward +x: the outline runs out to -1 on the left and is
  // pinched in to about 0.1 on the right.
  const crescent = sampleObjectShapePath(
    "M0,-1L0.6,-0.8L0.25,-0.45L0.1,0L0.25,0.45L0.6,0.8L0,1L-0.71,0.71L-1,0L-0.71,-0.71Z",
  );
  const radius = 100;

  it("puts the notch outside the light even though it is inside the circle", () => {
    assert.ok(crescent);
    // Well within the bounding circle, and well outside the shape.
    const [u, beyond] = lightProfile(crescent, [0.55 * radius, 0], radius);
    assert.ok(u > 1, `the notch should be past the outline, u was ${u}`);
    assert.ok(beyond > 0.2 * radius, `the notch should be shadowed, beyond was ${beyond}`);
  });

  it("does not brighten again at the bounding circle", () => {
    assert.ok(crescent);
    // Straight out through the bite, across the radius the old handover faded
    // in over. The distance from the shape only grows along this ray, so the
    // shadow must only deepen -- a dip here is the bright ring that made the
    // circle visible.
    let previous = -Infinity;
    for (let offset = 0.5; offset <= 3; offset += 0.05) {
      const [, beyond] = lightProfile(crescent, [offset * radius, 0], radius);
      assert.ok(beyond >= previous - 1e-6, `beyond dipped at offset ${offset.toFixed(2)}: ${beyond} < ${previous}`);
      previous = beyond;
    }
  });

  it("stays further from the shape through the bite than out the back", () => {
    assert.ok(crescent);
    // Same distance from the centre, opposite directions. The outline reaches
    // 1 on the left and is pinched to about 0.1 on the right, so a point out
    // through the bite is much further from the shape than its mirror image.
    // A bounding-circle far field would call these two equal, which is exactly
    // what made the shading circular.
    for (const offset of [1.5, 2.5, 4]) {
      const [, throughBite] = lightProfile(crescent, [offset * radius, 0], radius);
      const [, outTheBack] = lightProfile(crescent, [-offset * radius, 0], radius);
      assert.ok(
        throughBite > outTheBack + 0.3 * radius,
        `at offset ${offset} the bite (${throughBite}) should be much further out than the back (${outTheBack})`,
      );
    }
  });
});
