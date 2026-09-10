import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OBJECT_SDF_MARGIN, objectShapeDepthAt, sampleObjectShapePath, type ObjectShape } from "./object-shape.ts";
import { unitCirclePath } from "./object-path.ts";

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
    assert.ok(Math.abs(circle.maxDepth - 1) < 0.02, `maxDepth was ${circle.maxDepth}`);
  });

  it("agrees with the shapeless branch across the interior and just past the rim", () => {
    assert.ok(circle);
    const radius = 120;
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

describe("lightProfile -- a crescent lights like a crescent, not like its bounding circle", () => {
  const crescent = sampleObjectShapePath(
    "M0,-1L0.6,-0.8L0.25,-0.45L0.1,0L0.25,0.45L0.6,0.8L0,1L-0.71,0.71L-1,0L-0.71,-0.71Z",
  );
  const radius = 100;

  it("puts the notch outside the light even though it is inside the circle", () => {
    assert.ok(crescent);
    const [u, beyond] = lightProfile(crescent, [0.55 * radius, 0], radius);
    assert.ok(u > 1, `the notch should be past the outline, u was ${u}`);
    assert.ok(beyond > 0.2 * radius, `the notch should be shadowed, beyond was ${beyond}`);
  });

  it("does not brighten again at the bounding circle", () => {
    assert.ok(crescent);
    let previous = -Infinity;
    for (let offset = 0.5; offset <= 3; offset += 0.05) {
      const [, beyond] = lightProfile(crescent, [offset * radius, 0], radius);
      assert.ok(beyond >= previous - 1e-6, `beyond dipped at offset ${offset.toFixed(2)}: ${beyond} < ${previous}`);
      previous = beyond;
    }
  });

  it("stays further from the shape through the bite than out the back", () => {
    assert.ok(crescent);
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
