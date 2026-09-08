import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anchoredMenuPlacement, maskSubElementCenter, type AnchoredMenuPlacement } from "./menu-anchor.ts";
import type { LaurusLight, LaurusMaskResult, LaurusObject } from "../workspace.server.ts";
import type { LaurusProjectMask } from "../../projects/projects.server";

const MENU = { width: 300, height: 400, caretHeight: 30 };
const WRAPPER = { top: 0, left: 0, width: 200 };

function caretY(placed: AnchoredMenuPlacement): number {
  return placed.bottomSide ? placed.top + MENU.height - MENU.caretHeight / 2 : placed.top + MENU.caretHeight / 2;
}

function placement(
  overrides: {
    center?: { x: number; y: number };
    wrapper?: { top: number; left: number; width: number };
    item?: { top: number; left: number };
    canvas?: { width: number; height: number };
    preferredLeft?: boolean;
  } = {},
) {
  return anchoredMenuPlacement({
    center: overrides.center ?? { x: 100, y: 200 },
    wrapper: overrides.wrapper ?? WRAPPER,
    item: overrides.item ?? { top: 100, left: 400 },
    canvas: overrides.canvas ?? { width: 2000, height: 2000 },
    menu: MENU,
    preferredLeft: overrides.preferredLeft ?? false,
  });
}

describe("anchoredMenuPlacement", () => {
  it("points the caret at the element", () => {
    const placed = placement();
    assert.equal(placed.bottomSide, false);
    assert.equal(caretY(placed), 200);
  });

  it("measures from the mask's own origin, not the canvas", () => {
    const placed = placement({ wrapper: { ...WRAPPER, top: -20 } });
    assert.equal(caretY(placed), 200 + 20);
  });

  it("takes the edge the element sits nearest when the menu fits either way", () => {
    assert.equal(placement({ center: { x: 40, y: 200 } }).leftSide, true);
    assert.equal(placement({ center: { x: 160, y: 200 } }).leftSide, false);
  });

  it("reads nearness inside the mask, not against the canvas", () => {
    assert.equal(placement({ center: { x: 40, y: 200 }, item: { top: 100, left: 1200 } }).leftSide, true);
  });

  it("gives up the nearer edge when the menu would leave the canvas there", () => {
    const cramped = { top: 100, left: 200 };
    assert.equal(placement({ center: { x: 40, y: 200 }, item: cramped }).leftSide, false);
    assert.equal(
      placement({ center: { x: 160, y: 200 }, item: { top: 100, left: 400 }, canvas: { width: 800, height: 2000 } })
        .leftSide,
      true,
    );
  });

  it("keeps the stored side when neither side has room", () => {
    const squeezed = { center: { x: 40, y: 200 }, item: { top: 0, left: 100 }, canvas: { width: 560, height: 2000 } };
    assert.equal(placement({ ...squeezed, preferredLeft: true }).leftSide, true);
    assert.equal(placement({ ...squeezed, preferredLeft: false }).leftSide, false);
  });

  it("rises from the anchor when the menu would run off the bottom", () => {
    const placed = placement({ item: { top: 400, left: 400 }, canvas: { width: 2000, height: 700 } });
    assert.equal(placed.bottomSide, true);
    assert.equal(caretY(placed), 200);
  });

  it("clamps rather than flipping when there is no room above either", () => {
    const placed = placement({
      center: { x: 100, y: 100 },
      item: { top: 0, left: 400 },
      canvas: { width: 2000, height: 420 },
    });
    assert.equal(placed.bottomSide, false);
    assert.equal(placed.top, 20);
  });

  it("never places the menu above the canvas top", () => {
    const placed = placement({ center: { x: 100, y: 5 }, item: { top: 10, left: 400 } });
    assert.equal(10 + placed.top, 0);
  });
});

function light(overrides: Partial<LaurusLight> = {}): LaurusLight {
  return {
    id: 1,
    name: "light",
    size: 0,
    intensity: 1,
    spread: 0,
    shadow: 0,
    cx: 200,
    cy: 100,
    radius: 40,
    shape: "",
    description: "",
    order: 1,
    lowpoly: false,
    cast: 0,
    ...overrides,
  };
}

function object(overrides: Partial<LaurusObject> = {}): LaurusObject {
  return {
    id: 1,
    name: "object",
    cx: 200,
    cy: 100,
    radius: 40,
    elevation: 0,
    falloff: 0,
    shape: "",
    fill_r: 0,
    fill_g: 0,
    fill_b: 0,
    fill_a: 0,
    fill_h: 0,
    fill_s: 0,
    description: "",
    reviewed: false,
    lift: false,
    order: 1,
    ...overrides,
  };
}

function maskResult(overrides: Partial<LaurusMaskResult> = {}): LaurusMaskResult {
  return {
    timestamp: "",
    last_active: "",
    mask_media_id: "mask",
    source_img_media_id: "img",
    width: 400,
    height: 200,
    order: 1,
    description: "",
    categories: [],
    polygons: [],
    curves: [],
    lights: [light()],
    objects: [object()],
    has_object_review: false,
    creator: "",
    last_editor: "",
    ...overrides,
  };
}

function maskMeta(overrides: Partial<LaurusProjectMask> = {}): LaurusProjectMask {
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

describe("maskSubElementCenter", () => {
  it("carries a light from mask pixels into the mask's own box", () => {
    assert.deepEqual(maskSubElementCenter(maskMeta(), maskResult(), { kind: "light", id: 1 }), { x: 100, y: 50 });
  });

  it("reads an object the same way", () => {
    assert.deepEqual(maskSubElementCenter(maskMeta(), maskResult(), { kind: "object", id: 1 }), { x: 100, y: 50 });
  });

  it("stretches with the mask's scale", () => {
    assert.deepEqual(maskSubElementCenter(maskMeta({ scale_x: 2 }), maskResult(), { kind: "light", id: 1 }), {
      x: 200,
      y: 50,
    });
  });

  it("turns with the mask", () => {
    const turned = maskMeta({ rotate_z: 1, rotate_angle: 90 });
    const center = maskSubElementCenter(turned, maskResult(), { kind: "light", id: 1 });
    assert.ok(center);
    assert.ok(Math.abs(center.x - -50) < 1e-9);
    assert.ok(Math.abs(center.y - 100) < 1e-9);
  });

  it("falls back to the light's own size when it has no shaped radius", () => {
    const sized = maskResult({ lights: [light({ radius: 0, size: 80 })] });
    assert.deepEqual(maskSubElementCenter(maskMeta(), sized, { kind: "light", id: 1 }), { x: 100, y: 50 });
  });

  it("has nothing to anchor to when the element is gone", () => {
    assert.equal(maskSubElementCenter(maskMeta(), maskResult(), { kind: "light", id: 7 }), undefined);
    assert.equal(maskSubElementCenter(maskMeta(), undefined, { kind: "light", id: 1 }), undefined);
  });
});
