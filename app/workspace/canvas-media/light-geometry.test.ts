import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { objectSwellAt } from "../mask-gl.ts";
import { centroidOf } from "./mask-geometry.ts";
import {
  dropIndicesClaimedByObjects,
  indicesInObjectFromCentroids,
  elementAtPoint,
  lightIdAtPoint,
  polygonIndexAtPoint,
  swelledPolygonIndexAtPoint,
} from "./light-geometry.ts";
import type { LaurusPolygonPath } from "../workspace.server.ts";
import type { MaskHitScene } from "./light-geometry.ts";
import { frontToBackElements, maskStack } from "./mask-order.ts";
import { cachedObjectShape, objectShapeDepthAt } from "./object-shape.ts";

const CELL = 10;
const COLS = 12;
const ROWS = 12;

function grid(): { points: [number, number][][]; centroids: [number, number][] } {
  const points: [number, number][][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * CELL;
      const y = row * CELL;
      points.push([
        [x, y],
        [x + CELL, y],
        [x, y + CELL],
      ]);
      points.push([
        [x + CELL, y],
        [x + CELL, y + CELL],
        [x, y + CELL],
      ]);
    }
  }
  return { points, centroids: points.map(centroidOf) };
}

describe("swelledPolygonIndexAtPoint -- picking the triangle the shader actually drew", () => {
  const flat = { cx: 60, cy: 60, radius: 40, elevation: 0, falloff: 2, order: 1, shape: undefined, fill: undefined };
  const raised = { ...flat, elevation: 50 };

  it("falls back to the plain scan when nothing on the mesh is swollen", () => {
    const { points, centroids } = grid();

    centroids.forEach((centroid) => {
      assert.equal(
        swelledPolygonIndexAtPoint(points, [flat], centroid),
        polygonIndexAtPoint(points, centroid),
        `centroid ${centroid}`,
      );
    });
  });

  it("picks the triangle whose swollen corners surround the click, not its stored ones", () => {
    const { points, centroids } = grid();
    let disagreements = 0;

    points.forEach((triangle, i) => {
      const drawn = centroidOf(triangle.map((p) => swelled(p, raised)));
      const picked = swelledPolygonIndexAtPoint(points, [raised], drawn);
      assert.equal(picked, i, `triangle ${i} drawn at ${drawn}`);
      if (polygonIndexAtPoint(points, drawn) !== i) disagreements++;
    });

    assert.ok(disagreements > 0, "the plain scan should have been wrong somewhere, or this proves nothing");
    assert.equal(centroids.length, points.length);
  });

  it("still reports nothing for a point off the mesh", () => {
    const { points } = grid();

    assert.equal(swelledPolygonIndexAtPoint(points, [raised], [-5, -5]), undefined);
    assert.equal(swelledPolygonIndexAtPoint(points, [raised], [COLS * CELL + 5, 5]), undefined);
  });
});

function swelled(point: [number, number], object: Parameters<typeof objectSwellAt>[1][number]): [number, number] {
  const [dx, dy] = objectSwellAt(point, [object]);
  return [point[0] + dx, point[1] + dy];
}

function scene(parts: Partial<MaskHitScene>): MaskHitScene {
  return { objects: [], lights: [], ...parts };
}

const CRESCENT = "M0,-1L0.6,-0.8L0.25,-0.45L0.1,0L0.25,0.45L0.6,0.8L0,1L-0.71,0.71L-1,0L-0.71,-0.71Z";

function litObject(parts: {
  id: number;
  order: number;
  cx?: number;
  cy?: number;
  radius?: number;
  elevation?: number;
}) {
  return {
    cx: 30,
    cy: 60,
    radius: 10,
    elevation: 0,
    falloff: 2,
    shape: undefined,
    fill: undefined,
    ...parts,
  };
}

function litLight(parts: {
  id: number;
  order: number;
  cx?: number;
  cy?: number;
  radius?: number;
  shape?: string;
  transform?: [number, number, number, number];
}) {
  return { cx: 50, cy: 50, radius: 20, shape: "", ...parts };
}

describe("lightIdAtPoint -- the outline is the hit zone", () => {
  it("answers inside the outline and nowhere else", () => {
    const light = litLight({ id: 1, order: 1, cx: 50, cy: 50, radius: 20 });

    assert.equal(lightIdAtPoint(scene({ lights: [light] }), [50, 50]), 1);
    assert.equal(lightIdAtPoint(scene({ lights: [light] }), [65, 50]), 1);
    assert.equal(lightIdAtPoint(scene({ lights: [light] }), [75, 50]), undefined);
    assert.equal(
      lightIdAtPoint(scene({ lights: [light] }), [66, 66]),
      undefined,
      "the corner of the outline's bounding box is outside the outline itself",
    );
  });

  it("leaves the bite out of a shaped light, which its bounds would swallow", () => {
    const shaped = litLight({ id: 1, order: 1, cx: 100, cy: 100, radius: 60, shape: CRESCENT });
    const round = { ...shaped, shape: "" };
    const inTheBite: [number, number] = [140, 100];

    assert.equal(lightIdAtPoint(scene({ lights: [round] }), inTheBite), 1);
    assert.equal(lightIdAtPoint(scene({ lights: [shaped] }), inTheBite), undefined);
    assert.equal(lightIdAtPoint(scene({ lights: [shaped] }), [70, 100]), 1);
  });

  it("answers where the playhead put the outline, not where it rests", () => {
    const resting = litLight({ id: 1, order: 1, cx: 50, cy: 50, radius: 20 });
    const carried = { ...resting, cx: 110 };
    const grown = { ...resting, radius: 60 };

    assert.equal(lightIdAtPoint(scene({ lights: [resting] }), [110, 50]), undefined);
    assert.equal(lightIdAtPoint(scene({ lights: [carried] }), [110, 50]), 1);
    assert.equal(lightIdAtPoint(scene({ lights: [carried] }), [50, 50]), undefined);
    assert.equal(lightIdAtPoint(scene({ lights: [grown] }), [100, 50]), 1);
  });

  it("shears the hit zone through the same matrix the outline is drawn with", () => {
    const skewed = litLight({ id: 1, order: 1, cx: 50, cy: 50, radius: 20, transform: [1, 1, 0, 1] });
    const upright = { ...skewed, transform: undefined };
    const sheared: [number, number] = [34, 32];

    assert.equal(lightIdAtPoint(scene({ lights: [upright] }), sheared), undefined);
    assert.equal(lightIdAtPoint(scene({ lights: [skewed] }), sheared), 1);
  });

  it("is unhittable where it is not drawn", () => {
    const collapsed = litLight({ id: 1, order: 1, radius: 0 });
    const edgeOn = litLight({ id: 1, order: 1, transform: [1, 0, 0, 0] });

    assert.equal(lightIdAtPoint(scene({ lights: [collapsed] }), [50, 50]), undefined);
    assert.equal(lightIdAtPoint(scene({ lights: [edgeOn] }), [50, 50]), undefined);
  });
});

describe("elementAtPoint -- the stack decides who the click belongs to", () => {
  const inBoth: [number, number] = [50, 50];

  it("leaves a nearby light alone when the click lands on the object", () => {
    const object = litObject({ id: 7, order: 1, cx: 50, cy: 50, radius: 15 });
    const light = litLight({ id: 1, order: 9, cx: 140, cy: 50, radius: 30 });
    const both = scene({ objects: [object], lights: [light] });

    assert.deepEqual(elementAtPoint(both, inBoth), { kind: "object", id: 7 });
    assert.deepEqual(elementAtPoint(both, [140, 50]), { kind: "light", id: 1 });
    assert.equal(elementAtPoint(both, [95, 50]), undefined, "the gap between them belongs to neither");
  });

  it("hands two overlapping lights to whichever is stacked in front", () => {
    const front = (a: number, b: number) =>
      elementAtPoint(
        scene({
          lights: [litLight({ id: 1, order: a }), litLight({ id: 2, order: b, cx: 60 })],
        }),
        inBoth,
      );

    assert.deepEqual(front(1, 2), { kind: "light", id: 2 });
    assert.deepEqual(front(2, 1), { kind: "light", id: 1 });
  });

  it("hands two overlapping objects to whichever is stacked in front", () => {
    const near = litObject({ id: 7, order: 1, cx: 50, cy: 50, radius: 12 });
    const wide = litObject({ id: 8, order: 2, cx: 50, cy: 50, radius: 40 });

    assert.deepEqual(elementAtPoint(scene({ objects: [near, wide] }), inBoth), { kind: "object", id: 8 });
    assert.deepEqual(
      elementAtPoint(scene({ objects: [{ ...near, order: 3 }, wide] }), inBoth),
      { kind: "object", id: 7 },
      "the tighter object no longer wins on size alone -- the stack decides",
    );
  });

  it("settles an object over a light the same way", () => {
    const object = litObject({ id: 7, order: 1, cx: 50, cy: 50, radius: 20 });
    const lit = (order: number) => scene({ objects: [object], lights: [litLight({ id: 1, order })] });

    assert.deepEqual(elementAtPoint(lit(2), inBoth), { kind: "light", id: 1 });
    assert.deepEqual(elementAtPoint(lit(-1), inBoth), { kind: "object", id: 7 });
  });

  it("picks the row the media group browser lists first", () => {
    const objects = [
      litObject({ id: 7, order: 1, cx: 50, cy: 50, radius: 20 }),
      litObject({ id: 8, order: 4, cx: 50, cy: 50, radius: 30 }),
    ];
    const lights = [litLight({ id: 1, order: 3 }), litLight({ id: 2, order: 2 })];
    const [top] = frontToBackElements(maskStack({ objects, lights }));

    assert.deepEqual(elementAtPoint(scene({ objects, lights }), inBoth), { kind: top.kind, id: top.id });
  });

  it("finds nothing where neither a light nor an object was drawn", () => {
    assert.equal(elementAtPoint(scene({ lights: [litLight({ id: 1, order: 1 })] }), [200, 200]), undefined);
  });
});

describe("indicesInObjectFromCentroids -- the outline decides membership", () => {
  const centroids: [number, number][] = [];
  for (let y = 0; y <= 200; y += 4) for (let x = 0; x <= 200; x += 4) centroids.push([x, y]);

  it("takes every triangle the outline encloses and no other", () => {
    const object = { cx: 100, cy: 100, radius: 60, shape: CRESCENT };
    const inside = indicesInObjectFromCentroids(centroids, object);

    const shape = cachedObjectShape(CRESCENT);
    assert.ok(shape);
    centroids.forEach((centroid, i) => {
      const depth = objectShapeDepthAt(
        shape,
        (centroid[0] - object.cx) / object.radius,
        (centroid[1] - object.cy) / object.radius,
      );

      if (Math.abs(depth) < 0.02) return;
      assert.equal(inside.has(i), depth > 0, `centroid ${centroid} at depth ${depth.toFixed(4)}`);
    });
  });

  it("leaves the bite out, which a circle of the same radius would swallow", () => {
    const object = { cx: 100, cy: 100, radius: 60, shape: CRESCENT };
    const shaped = indicesInObjectFromCentroids(centroids, object);
    const round = indicesInObjectFromCentroids(centroids, { ...object, shape: "" });
    assert.ok(shaped.size < round.size * 0.85, `crescent ${shaped.size} vs circle ${round.size}`);
  });

  it("follows the outline when it is reshaped, rather than staying put", () => {
    const before = indicesInObjectFromCentroids(centroids, {
      cx: 100,
      cy: 100,
      radius: 60,
      shape: CRESCENT,
    });
    const after = indicesInObjectFromCentroids(centroids, {
      cx: 100,
      cy: 100,
      radius: 60,
      shape: "M0,-1L1,-1L1,1L0,1L-0.4,0Z",
    });
    assert.notDeepEqual([...before].sort(), [...after].sort());
    assert.ok(after.size > 0 && before.size > 0);
  });
});

describe("dropIndicesClaimedByObjects -- the object already there wins", () => {
  const geometry = grid();

  function tagged(indices: Iterable<number>, objectId: number): LaurusPolygonPath[] {
    const owned = new Set(indices);
    return geometry.points.map((_, i) => ({
      d: "",
      fill: "#808080",
      stroke: "none",
      stroke_width: 0,
      light_id: 0,
      object_id: owned.has(i) ? objectId : 0,
    }));
  }

  const left = indicesInObjectFromCentroids(geometry.centroids, { cx: 40, cy: 60, radius: 30, shape: "" });
  const right = indicesInObjectFromCentroids(geometry.centroids, { cx: 75, cy: 60, radius: 30, shape: "" });

  it("leaves an untagged mesh exactly as it found it", () => {
    const kept = dropIndicesClaimedByObjects(right, geometry, tagged([], 1));
    assert.deepEqual([...kept].sort(), [...right].sort());
  });

  it("drops every triangle the existing object already owns", () => {
    const overlap = [...right].filter((i) => left.has(i));
    assert.ok(overlap.length > 0, "the fixture must actually overlap");
    const kept = dropIndicesClaimedByObjects(right, geometry, tagged(left, 1), { buffer: 0 });
    assert.ok(overlap.every((i) => !kept.has(i)));
    assert.ok(kept.size > 0, "the non-colliding part survives");
  });

  it("never touches the existing object's own membership", () => {
    const polygons = tagged(left, 1);
    const kept = dropIndicesClaimedByObjects(right, geometry, polygons);
    left.forEach((i) => assert.ok(!kept.has(i), `triangle ${i} stayed with object 1`));
  });

  it("opens a wider lane as the buffer grows", () => {
    const polygons = tagged(left, 1);
    const flush = dropIndicesClaimedByObjects(right, geometry, polygons, { buffer: 0 });
    const spaced = dropIndicesClaimedByObjects(right, geometry, polygons, { buffer: CELL * 2 });
    assert.ok(spaced.size < flush.size, `buffered ${spaced.size} vs flush ${flush.size}`);
    spaced.forEach((i) => assert.ok(flush.has(i), "a buffer only ever removes"));
  });

  it("exempts the object being recomputed, so an edit does not eat itself", () => {
    const polygons = tagged(left, 1);
    const kept = dropIndicesClaimedByObjects(left, geometry, polygons, { objectId: 1 });
    assert.deepEqual([...kept].sort(), [...left].sort());
  });

  it("keeps a reshaped object's own triangles while it loses the neighbour's", () => {
    const ownedByTwo = new Set([...right].filter((i) => !left.has(i)));
    assert.ok(ownedByTwo.size > 0 && left.size > 0, "the fixture must tag both");
    const polygons = geometry.points.map((_, i) => ({
      d: "",
      fill: "#808080",
      stroke: "none",
      stroke_width: 0,
      light_id: 0,
      object_id: left.has(i) ? 1 : ownedByTwo.has(i) ? 2 : 0,
    }));
    const reshaped = indicesInObjectFromCentroids(geometry.centroids, { cx: 60, cy: 60, radius: 45, shape: "" });
    const kept = dropIndicesClaimedByObjects(reshaped, geometry, polygons, { objectId: 2, buffer: 0 });
    [...reshaped].filter((i) => ownedByTwo.has(i)).forEach((i) => assert.ok(kept.has(i), `kept its own ${i}`));
    [...reshaped].filter((i) => left.has(i)).forEach((i) => assert.ok(!kept.has(i), `gave up ${i}`));
  });
});
