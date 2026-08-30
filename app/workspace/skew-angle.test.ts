import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCssSkewAngle } from "./skew-angle.ts";

const tanOf = (deg: number) => Math.tan((deg * Math.PI) / 180);

describe("toCssSkewAngle -- stepping over the poles of tan", () => {
  it("leaves every angle clear of a pole exactly where it is", () => {
    for (const deg of [0, 15, 45, 89, 91, 135, 180, 200, 269, 271, 359, 360, -45, -135]) {
      assert.equal(toCssSkewAngle(deg), deg, `${deg}deg should pass through untouched`);
    }
  });

  it("never lets a pole reach CSS, on either side of zero", () => {
    for (const pole of [90, 270, 450, -90, -270]) {
      const out = toCssSkewAngle(pole);
      assert.notEqual(out, pole, `${pole}deg should be nudged off the pole`);
      assert.ok(Number.isFinite(tanOf(out)), `tan(${out}) should be finite`);
      assert.ok(Math.abs(tanOf(out)) < 100, `tan(${out}) should stay bounded`);
    }
  });

  it("lands on the side the dial approached from", () => {
    assert.equal(toCssSkewAngle(89.5), 89);
    assert.equal(toCssSkewAngle(90.5), 91);
    assert.equal(toCssSkewAngle(269.5), 269);
    assert.equal(toCssSkewAngle(270.5), 271);
  });

  it("keeps a full turn live -- every angle renders, and only the pole band repeats", () => {
    const nudged = (deg: number) => toCssSkewAngle(deg) !== deg;
    for (let deg = 1; deg <= 360; deg++) {
      const current = tanOf(toCssSkewAngle(deg));
      assert.ok(Number.isFinite(current), `tan finite at ${deg}deg`);
      if (!nudged(deg) && !nudged(deg - 1)) {
        assert.notEqual(current, tanOf(toCssSkewAngle(deg - 1)), `${deg}deg should differ from ${deg - 1}deg`);
      }
    }
  });

  it("costs exactly one degree per pole across a full turn", () => {
    const nudged = [];
    for (let deg = 0; deg <= 360; deg++) {
      if (toCssSkewAngle(deg) !== deg) nudged.push(deg);
    }
    assert.deepEqual(nudged, [90, 270]);
  });
});
