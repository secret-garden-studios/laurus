import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  objectForwardTransform,
  objectRotation,
  objectToShape,
  objectTransform,
  placeShape,
  placedShapeMap,
  restingShapeMap,
} from "./mask-gl.ts";

const near = (a: number, b: number, why: string) => assert.ok(Math.abs(a - b) < 1e-9, `${why}: ${a} !== ${b}`);

const shapeOf = (t: ReturnType<typeof objectTransform>, x: number, y: number) => objectToShape(t, x, y);

describe("objectTransform -- rotate and skew in the one matrix the shader samples through", () => {
  it("is undefined when neither effect has anything to say", () => {
    assert.equal(objectTransform(undefined, undefined), undefined);
    assert.equal(objectTransform({ x: 0, y: 0, z: 0, angleDegrees: 0 }, { ax: 0, ay: 0 }), undefined);
    assert.equal(objectTransform({ x: 0, y: 0, z: 1, angleDegrees: 360 }, undefined), undefined);
  });

  it("reproduces objectRotation exactly when nothing is skewed", () => {
    for (const [x, y, z, a] of [
      [0, 0, 1, 90],
      [1, 0, 0, 45],
      [0, 1, 0, 30],
      [1, 1, 1, 200],
    ]) {
      const was = objectRotation(x, y, z, a);
      const now = objectTransform({ x, y, z, angleDegrees: a }, undefined);
      assert.deepEqual(now, was, `rotate3d(${x},${y},${z},${a}deg)`);
    }
  });

  it("inverts a pure skew, so sampling undoes what the DOM applies", () => {
    const t = objectTransform(undefined, { ax: 45, ay: 0 })!;
    assert.equal(t.visible, true);
    const [sx, sy] = shapeOf(t, 1, 1);
    near(sx, 0, "x");
    near(sy, 1, "y");
  });

  it("skews the other axis independently", () => {
    const t = objectTransform(undefined, { ax: 0, ay: 45 })!;
    const [sx, sy] = shapeOf(t, 1, 1);
    near(sx, 1, "x");
    near(sy, 0, "y");
  });

  it("composes rotate then skew the way CSS does -- rotate3d(...) skew(...)", () => {
    const rotate = { x: 0, y: 0, z: 1, angleDegrees: 90 };
    const skew = { ax: 45, ay: 0 };
    const composed = objectTransform(rotate, skew)!;

    const r = objectTransform(rotate, undefined)!;
    const s = objectTransform(undefined, skew)!;
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [3, -2],
    ]) {
      const viaHalves = shapeOf(s, ...(shapeOf(r, x, y) as [number, number]));
      const viaComposed = shapeOf(composed, x, y);
      near(viaComposed[0], viaHalves[0], `x at (${x},${y})`);
      near(viaComposed[1], viaHalves[1], `y at (${x},${y})`);
    }
  });

  it("calls a skew that collapses the outline edge-on rather than inverting it", () => {
    const t = objectTransform(undefined, { ax: 45, ay: 45 })!;
    assert.equal(t.visible, false);
    assert.deepEqual(t.inverse, [1, 0, 0, 1]);
  });

  it("survives the poles of tan instead of producing an unusable matrix", () => {
    for (const ax of [90, 270, -90]) {
      const t = objectTransform(undefined, { ax, ay: 0 })!;
      assert.ok(t.visible, `${ax}deg should still be drawable`);
      for (const v of t.inverse) assert.ok(Number.isFinite(v), `${ax}deg produced ${v}`);
    }
  });

  it("leaves a shapeless object alone at zero and turns it at nonzero", () => {
    assert.deepEqual(objectToShape(undefined, 2, 3), [2, 3]);
    const t = objectTransform(undefined, { ax: 10, ay: 10 })!;
    assert.notDeepEqual(objectToShape(t, 2, 3), [2, 3]);
  });
});

describe("objectForwardTransform -- the matrix an outline draws through", () => {
  it("has nothing to say when neither effect does", () => {
    assert.equal(objectForwardTransform(undefined, undefined), undefined);
    assert.equal(objectForwardTransform({ x: 0, y: 0, z: 0, angleDegrees: 0 }, { ax: 0, ay: 0 }), undefined);
  });

  it("undoes the matrix the shader samples through", () => {
    const cases: [
      { x: number; y: number; z: number; angleDegrees: number } | undefined,
      { ax: number; ay: number } | undefined,
    ][] = [
      [{ x: 0, y: 0, z: 1, angleDegrees: 90 }, undefined],
      [{ x: 1, y: 0, z: 0, angleDegrees: 45 }, undefined],
      [
        { x: 0, y: 0, z: 1, angleDegrees: 30 },
        { ax: 20, ay: 0 },
      ],
      [undefined, { ax: 0, ay: 15 }],
    ];
    for (const [rotate, skew] of cases) {
      const forward = objectForwardTransform(rotate, skew)!;
      const sampled = objectTransform(rotate, skew)!;
      for (const [x, y] of [
        [1, 0],
        [0, 1],
        [3, -2],
      ]) {
        const drawn: [number, number] = [forward[0] * x + forward[1] * y, forward[2] * x + forward[3] * y];
        const back = objectToShape(sampled, ...drawn);
        near(back[0], x, `x at (${x},${y})`);
        near(back[1], y, `y at (${x},${y})`);
      }
    }
  });

  it("keeps a plain turn area-preserving, so an outline stroke holds its weight", () => {
    const forward = objectForwardTransform({ x: 0, y: 0, z: 1, angleDegrees: 37 }, undefined)!;
    near(forward[0] * forward[3] - forward[1] * forward[2], 1, "determinant");
  });

  it("collapses to a zero determinant exactly where the shader calls an object edge-on", () => {
    const forward = objectForwardTransform(undefined, { ax: 45, ay: 45 })!;
    near(forward[0] * forward[3] - forward[1] * forward[2], 0, "determinant");
    assert.equal(objectTransform(undefined, { ax: 45, ay: 45 })!.visible, false);
  });
});

describe("placeShape -- where a resting region sits once its object is animated", () => {
  const rest = { cx: 300, cy: 200, radius: 50 };
  const offsets = [
    { dx: 0, dy: 0, scale: 1, transform: undefined },
    { dx: 120, dy: -45, scale: 1, transform: undefined },
    { dx: 0, dy: 0, scale: 2.5, transform: undefined },
    {
      dx: -30,
      dy: 80,
      scale: 0.4,
      transform: objectForwardTransform({ x: 0, y: 0, z: 1, angleDegrees: 35 }, undefined),
    },
    { dx: 15, dy: 15, scale: 1.3, transform: objectForwardTransform(undefined, { ax: 20, ay: -10 }) },
  ];

  it("leaves the region alone when nothing is animating it", () => {
    const place = placeShape(rest, rest, { dx: 0, dy: 0, scale: 1, transform: undefined });
    assert.deepEqual([place.cx, place.cy, place.radius], [rest.cx, rest.cy, rest.radius]);
  });

  it("carries a region that is off the object's own centre along with it", () => {
    const region = { cx: rest.cx + 20, cy: rest.cy, radius: 10 };
    const place = placeShape(region, rest, { dx: 100, dy: 0, scale: 1, transform: undefined });
    near(place.cx, region.cx + 100, "an offset centre moves by the same delta");
    near(place.cy, region.cy, "and not at all across it");
    near(place.radius, region.radius, "an unscaled region keeps its reach");
  });

  it("scales a region's distance from the object's centre, not just its own radius", () => {
    const region = { cx: rest.cx + 20, cy: rest.cy, radius: 10 };
    const place = placeShape(region, rest, { dx: 0, dy: 0, scale: 3, transform: undefined });
    near(place.cx, rest.cx + 60, "the arm from the pivot grows with the object");
    near(place.radius, 30, "and so does the region itself");
  });

  it("reduces to a plain offset when the region is the whole subject, as a light's silhouette is", () => {
    const region = { cx: 140, cy: 90, radius: 24 };
    for (const offset of offsets) {
      const place = placeShape(region, region, offset);
      near(place.cx, region.cx + offset.dx, "a light moves by its own delta");
      near(place.cy, region.cy + offset.dy, "on both axes");
      near(place.radius, region.radius * offset.scale, "and scales about its own centre");
      assert.equal(place.transform, offset.transform, "carrying the same skew the shader samples through");
    }
  });

  it("round-trips every offset, so an edit made in place stores its resting shape", () => {
    const region = { cx: rest.cx + 12, cy: rest.cy - 7, radius: 30 };
    for (const offset of offsets) {
      const place = placeShape(region, rest, offset);
      const out = placedShapeMap(place);
      const back = restingShapeMap(place, region);
      for (const [nx, ny] of [
        [0, 0],
        [1, 0],
        [0, -1],
        [-0.6, 0.8],
        [0.35, 0.35],
      ]) {
        const [x, y] = out(nx, ny);
        const [rx, ry] = back(x, y);
        near(rx, region.cx + nx * region.radius, `x for n=(${nx},${ny}) at ${JSON.stringify(offset)}`);
        near(ry, region.cy + ny * region.radius, `y for n=(${nx},${ny}) at ${JSON.stringify(offset)}`);
      }
    }
  });

  it("puts a normalized point exactly where the outline transform would draw it", () => {
    const place = placeShape(rest, rest, offsets[3]);
    const [x, y] = placedShapeMap(place)(1, 0);
    const [fx, fy] = objectToShape({ inverse: place.transform!, visible: true }, 1, 0);
    near(x, place.cx + fx * place.radius, "the forward matrix is applied before the radius");
    near(y, place.cy + fy * place.radius, "on both axes");
  });
});
