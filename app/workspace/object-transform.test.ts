import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { objectRotation, objectToShape, objectTransform } from "./mask-gl.ts";

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
