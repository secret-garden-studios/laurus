import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { carryGeometryForward, maskGeometry } from "./mask-geometry.ts";
import { applyObjectDelta, applyCaptureDelta } from "./mask-delta.ts";
import type { LaurusMaskResult, LaurusPolygonPath } from "../workspace.server.ts";

function polygon(d: string, extra: Partial<LaurusPolygonPath> = {}): LaurusPolygonPath {
  return { d, fill: "#ffffff", stroke: "none", stroke_width: 0, capture_id: 0, object_id: 0, ...extra };
}

function maskWith(polygons: LaurusPolygonPath[]): LaurusMaskResult {
  return {
    timestamp: "t",
    last_active: "t",
    mask_media_id: "mask-1",
    source_img_media_id: "img-1",
    width: 100,
    height: 100,
    order: 1,
    categories: [],
    polygons,
    curves: [],
    captures: [],
    objects: [],
    creator: "stef",
    last_editor: "stef",
  };
}

const TRIANGLES = [
  polygon("M 0,0 L 10,0 L 0,10 Z"),
  polygon("M 20,20 L 30,20 L 20,30 Z"),
  polygon("M 40,40 L 50,40 L 40,50 Z"),
];

describe("maskGeometry -- the one place polygon paths get parsed", () => {
  it("parses each polygon's vertices and centroid", () => {
    const geometry = maskGeometry(maskWith(TRIANGLES));

    assert.equal(geometry.points.length, 3);
    assert.deepEqual(geometry.points[0], [
      [0, 0],
      [10, 0],
      [0, 10],
    ]);
    const [cx, cy] = geometry.centroids[0];
    assert.ok(Math.abs(cx - 10 / 3) < 1e-9);
    assert.ok(Math.abs(cy - 10 / 3) < 1e-9);
  });

  it("returns the very same object for the same polygons array", () => {
    const mask = maskWith(TRIANGLES);
    assert.equal(maskGeometry(mask), maskGeometry(mask));
  });

  it("reparses when the polygons array is a different one", () => {
    const first = maskGeometry(maskWith(TRIANGLES));
    const second = maskGeometry(maskWith([...TRIANGLES]));
    assert.notEqual(first, second);
    assert.deepEqual(first.points, second.points);
  });

  it("carries a parsed geometry onto a new array whose paths are unchanged", () => {
    const mask = maskWith(TRIANGLES);
    const geometry = maskGeometry(mask);
    const retagged = mask.polygons.map((p) => ({ ...p, object_id: 4 }));

    carryGeometryForward(mask.polygons, retagged);

    assert.equal(maskGeometry(maskWith(retagged)), geometry);
  });
});

describe("mask deltas -- patching only what an edit touched", () => {
  it("tags and clears exactly the polygons the delta names", () => {
    const mask = maskWith(TRIANGLES);
    mask.polygons[2] = polygon(TRIANGLES[2].d, { object_id: 7 });

    const patched = applyObjectDelta(mask, {
      object_id: 7,
      object: {
        id: 7,
        name: "object 7",
        cx: 5,
        cy: 5,
        radius: 10,
        elevation: 80,
        falloff: 2,
        shape: "",
        black_point_r: 0,
        black_point_g: 0,
        black_point_b: 0,
        black_point_a: 0,
        description: "a thing",
      },
      removed: false,
      tagged_polygon_indices: [0, 1],
      cleared_polygon_indices: [2],
      last_active: "later",
      last_editor: "stef",
    });

    assert.deepEqual(
      patched.polygons.map((p) => p.object_id),
      [7, 7, 0],
    );
    assert.equal(patched.objects.length, 1);
    assert.equal(patched.objects[0].description, "a thing");
    assert.equal(patched.last_active, "later");
  });

  it("drops the object when the delta says it was removed", () => {
    const mask = maskWith(TRIANGLES.map((p) => polygon(p.d, { object_id: 3 })));
    mask.objects = [
      {
        id: 3,
        name: "object 3",
        cx: 0,
        cy: 0,
        radius: 1,
        elevation: 1,
        falloff: 2,
        shape: "",
        black_point_r: 0,
        black_point_g: 0,
        black_point_b: 0,
        black_point_a: 0,
        description: "",
      },
    ];

    const patched = applyObjectDelta(mask, {
      object_id: 3,
      object: null,
      removed: true,
      tagged_polygon_indices: [],
      cleared_polygon_indices: [0, 1, 2],
      last_active: "later",
      last_editor: "stef",
    });

    assert.deepEqual(
      patched.polygons.map((p) => p.object_id),
      [0, 0, 0],
    );
    assert.equal(patched.objects.length, 0);
  });

  it("keeps every untouched polygon's identity, and the parsed geometry with it", () => {
    const mask = maskWith(TRIANGLES);
    const geometry = maskGeometry(mask);

    const patched = applyObjectDelta(mask, {
      object_id: 1,
      object: null,
      removed: true,
      tagged_polygon_indices: [0],
      cleared_polygon_indices: [],
      last_active: "later",
      last_editor: "stef",
    });

    assert.notEqual(patched.polygons[0], mask.polygons[0]);
    assert.equal(patched.polygons[1], mask.polygons[1]);
    assert.equal(patched.polygons[2], mask.polygons[2]);
    assert.equal(maskGeometry(patched), geometry);
  });

  it("leaves the polygons array alone when a delta retags nothing", () => {
    const mask = maskWith(TRIANGLES);

    const patched = applyCaptureDelta(mask, {
      capture_id: 2,
      capture: { id: 2, name: "light 2", size: 10, intensity: 1, falloff: 1, darkness: 0 },
      removed: false,
      tagged_polygon_indices: [],
      cleared_polygon_indices: [],
      last_active: "later",
      last_editor: "stef",
    });

    assert.equal(patched.polygons, mask.polygons);
    assert.equal(patched.captures.length, 1);
  });
});
