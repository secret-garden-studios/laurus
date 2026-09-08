import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTransformedBounds, projectLocalPoint } from "./geometry.ts";
import type { LaurusProjectMask } from "../../projects/projects.server";

function mask(overrides: Partial<LaurusProjectMask> = {}): LaurusProjectMask {
  return {
    media_id: "mask",
    media_group_id: "group",
    width: 200,
    height: 100,
    top: 0,
    left: 0,
    order: 0,
    scale_x: 1,
    scale_y: 1,
    rotate_x: 0,
    rotate_y: 0,
    rotate_z: 0,
    rotate_angle: 0,
    skew_ax: 0,
    skew_ay: 0,
    light_preview_size: 0,
    light_preview_intensity: 0,
    light_preview_spread: 0,
    light_preview_shadow: 0,
    light_preview_cast: 0,
    texture: 0,
    description: "",
    ...overrides,
  };
}

function close(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

describe("projectLocalPoint", () => {
  it("leaves an untransformed mask alone", () => {
    const point = projectLocalPoint(mask(), { x: 50, y: 25 });
    close(point.x, 50);
    close(point.y, 25);
  });

  it("turns a point about the top left corner", () => {
    const point = projectLocalPoint(mask({ rotate_z: 1, rotate_angle: 90 }), { x: 100, y: 0 });
    close(point.x, 0);
    close(point.y, 100);
  });

  it("slides a point sideways with the skew of its rows", () => {
    const skewed = mask({ skew_ax: 45 });
    const point = projectLocalPoint(skewed, { x: 100, y: 50 });
    close(point.x, 100 + 50 * Math.tan((45 * Math.PI) / 180), 1e-6);
    close(point.y, 50);
  });

  it("does not re-apply scale, which the local space already carries", () => {
    const point = projectLocalPoint(mask({ scale_x: 2, scale_y: 2 }), { x: 100, y: 50 });
    close(point.x, 100);
    close(point.y, 50);
  });

  it("keeps the corners inside the bounds the same transform reports", () => {
    const meta = mask({ rotate_x: 1, rotate_y: 2, rotate_z: 3, rotate_angle: 40, skew_ax: 10, skew_ay: -5 });
    const bounds = calculateTransformedBounds(meta);
    const scaledW = meta.width * meta.scale_x;
    const scaledH = meta.height * meta.scale_y;
    const corners: [number, number][] = [
      [0, 0],
      [scaledW, 0],
      [0, scaledH],
      [scaledW, scaledH],
    ];
    for (const [x, y] of corners) {
      const point = projectLocalPoint(meta, { x, y });
      assert.ok(point.x >= bounds.deltas.left - 1e-9);
      assert.ok(point.x <= meta.width + bounds.deltas.right + 1e-9);
      assert.ok(point.y >= bounds.deltas.top - 1e-9);
      assert.ok(point.y <= meta.height + bounds.deltas.bottom + 1e-9);
    }
  });
});
