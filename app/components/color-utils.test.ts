import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUE_CEILING,
  hsvToRgb,
  normalizeHue,
  resolveHsv,
  rgbToHex,
  rgbToHsv,
  rgbaEquals,
  rgbaToCss,
  toLaurusColor,
} from "./color-utils.ts";

const CHANNELS = [0, 0.03, 0.25, 0.5, 0.77, 1];

describe("rgbToHsv", () => {
  it("reports no hue for greys", () => {
    for (const level of CHANNELS) {
      const hsv = rgbToHsv(level, level, level);
      assert.equal(hsv.h, 0);
      assert.equal(hsv.s, 0);
      assert.equal(hsv.v, level);
    }
  });

  it("places the primaries on their hue sectors", () => {
    assert.deepEqual(rgbToHsv(1, 0, 0), { h: 0, s: 1, v: 1 });
    assert.deepEqual(rgbToHsv(0, 1, 0), { h: 120, s: 1, v: 1 });
    assert.deepEqual(rgbToHsv(0, 0, 1), { h: 240, s: 1, v: 1 });
  });

  it("clamps channels outside 0..1", () => {
    assert.deepEqual(rgbToHsv(2, -1, 0), { h: 0, s: 1, v: 1 });
  });
});

describe("hsvToRgb", () => {
  it("round-trips every rgb combination back through hsv", () => {
    for (const r of CHANNELS) {
      for (const g of CHANNELS) {
        for (const b of CHANNELS) {
          const hsv = rgbToHsv(r, g, b);
          const back = hsvToRgb(hsv.h, hsv.s, hsv.v);
          assert.ok(
            rgbaEquals({ ...back, a: 1 }, { r, g, b, a: 1 }),
            `expected ${JSON.stringify(back)} to round-trip from ${r},${g},${b}`,
          );
        }
      }
    }
  });

  it("keeps a hue that saturation and value cannot express", () => {
    // dragging value to zero must not silently rewrite the hue the caller is holding
    const black = hsvToRgb(200, 1, 0);
    assert.deepEqual(black, { r: 0, g: 0, b: 0 });
    assert.equal(rgbToHsv(black.r, black.g, black.b).h, 0);
  });

  it("wraps hues outside 0..360", () => {
    assert.deepEqual(hsvToRgb(360, 1, 1), hsvToRgb(0, 1, 1));
    assert.deepEqual(hsvToRgb(-120, 1, 1), hsvToRgb(240, 1, 1));
  });
});

describe("normalizeHue", () => {
  it("wraps into 0..360", () => {
    assert.equal(normalizeHue(0), 0);
    assert.equal(normalizeHue(360), 0);
    assert.equal(normalizeHue(-90), 270);
    assert.equal(normalizeHue(450), 90);
  });
});

describe("css formatting", () => {
  it("scales unit channels to bytes", () => {
    assert.equal(rgbaToCss({ r: 0, g: 0.5, b: 1, a: 0.25 }), "rgba(0, 128, 255, 0.250)");
    assert.equal(rgbToHex(0, 0.5, 1), "#0080ff");
  });

  it("pads single digit hex channels", () => {
    assert.equal(rgbToHex(0.01, 0, 0), "#030000");
  });
});

describe("resolveHsv", () => {
  it("prefers what rgb can prove", () => {
    const stored = { r: 0, g: 0, b: 1, a: 1, h: 99, s: 0.1 };
    assert.deepEqual(resolveHsv(stored), { h: 240, s: 1, v: 1 });
  });

  it("falls back to the stored hue for grey, keeping saturation at zero", () => {
    const grey = { r: 0.5, g: 0.5, b: 0.5, a: 1, h: 200, s: 0.8 };
    assert.deepEqual(resolveHsv(grey), { h: 200, s: 0, v: 0.5 });
  });

  it("falls back to both for black, which reports neither", () => {
    const black = { r: 0, g: 0, b: 0, a: 1, h: 200, s: 0.8 };
    assert.deepEqual(resolveHsv(black), { h: 200, s: 0.8, v: 0 });
  });

  it("wraps and clamps what it was handed", () => {
    const black = { r: 0, g: 0, b: 0, a: 1, h: -90, s: 5 };
    assert.deepEqual(resolveHsv(black), { h: 270, s: 1, v: 0 });
  });
});

describe("toLaurusColor", () => {
  it("round-trips through resolveHsv for a colour rgb can describe", () => {
    const color = toLaurusColor({ h: 240, s: 1, v: 1 }, 0.5);
    assert.deepEqual(color, { r: 0, g: 0, b: 1, a: 0.5, h: 240, s: 1 });
    assert.deepEqual(resolveHsv(color), { h: 240, s: 1, v: 1 });
  });

  it("keeps a hue that black cannot carry in its channels", () => {
    // the whole point of storing h/s: value at zero must not lose the choice
    const color = toLaurusColor({ h: 240, s: 1, v: 0 }, 1);
    assert.deepEqual(color, { r: 0, g: 0, b: 0, a: 1, h: 240, s: 1 });
    assert.deepEqual(resolveHsv(color), { h: 240, s: 1, v: 0 });
  });
});

describe("HUE_CEILING", () => {
  it("is the same red as 0 but stays put when stored", () => {
    // a track reaching exactly 360 normalises to 0, which sits a full track-width
    // away, so the cap would jump the whole strip on release
    assert.equal(normalizeHue(360), 0);
    assert.equal(normalizeHue(HUE_CEILING), HUE_CEILING);
  });

  it("round-trips through rgb without drifting off the end of the track", () => {
    const rgb = hsvToRgb(HUE_CEILING, 1, 1);
    const back = rgbToHsv(rgb.r, rgb.g, rgb.b);
    assert.ok(Math.abs(back.h - HUE_CEILING) < 0.001, `expected ${back.h} to come back as ${HUE_CEILING}`);
    assert.ok(back.h > 359, "must stay at the far end of the wheel, not wrap to 0");
  });

  it("reads as red, the way 360 would have", () => {
    const rgb = hsvToRgb(HUE_CEILING, 1, 1);
    assert.equal(rgb.r, 1);
    assert.equal(rgb.g, 0);
    assert.ok(rgb.b < 0.001, "a trace of blue, invisible next to full red");
  });
});
