import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIGHT_CAST_ENDLESS } from "../mask-constants.ts";

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface Light {
  spread: number;
  intensity: number;
  shadow: number;
  cast: number;
}

interface Sample {
  beyond: number;
  hidden: number;
}

function legacyShade(lights: Light[], samples: Sample[]): number {
  let leastShadow = 0;
  lights.forEach((light, i) => {
    const unlit = smoothstep(0, light.spread, samples[i].beyond);
    const contribution = (unlit + samples[i].hidden * (1 - unlit)) * light.shadow;
    leastShadow = i === 0 ? contribution : Math.min(leastShadow, contribution);
  });
  return leastShadow;
}

function shade(lights: Light[], samples: Sample[]): number {
  let darkest = 0;
  let brightest = 0;
  lights.forEach((light, i) => {
    const unlit = smoothstep(0, light.spread, samples[i].beyond);
    const reachable = 1 - samples[i].hidden;

    const tail = light.spread * light.cast * (1 + light.intensity);
    const beyond = Math.max(samples[i].beyond - light.spread, 0);
    const carry = tail > 0 ? 1 - smoothstep(0, tail, beyond) : 1;

    darkest = Math.max(darkest, light.shadow * carry);
    brightest = Math.max(brightest, (1 - unlit) * reachable);
  });
  return darkest * (1 - brightest);
}

const endless = (shadow: number, spread = 350, intensity = 0.05): Light => ({
  spread,
  intensity,
  shadow,
  cast: LIGHT_CAST_ENDLESS,
});

describe("one light on an endless cast darkens exactly as it always did", () => {
  it("matches the old min() form at every distance, occlusion and shadow", () => {
    for (const spread of [1, 20, 350, 1000]) {
      for (const shadow of [0, 0.2, 0.5, 1]) {
        const light = endless(shadow, spread);
        for (const beyond of [0, 1, spread * 0.25, spread * 0.5, spread, spread * 4]) {
          for (const hidden of [0, 0.25, 0.5, 0.75, 1]) {
            const samples = [{ beyond, hidden }];
            assert.ok(
              Math.abs(shade([light], samples) - legacyShade([light], samples)) < 1e-9,
              `differs at spread ${spread}, shadow ${shadow}, beyond ${beyond}, hidden ${hidden}`,
            );
          }
        }
      }
    }
  });
});

describe("a light no longer spends its neighbours' shadow", () => {
  const far = 4000;

  it("keeps the first light's darkening when the second is set to no shadow", () => {
    const lit = endless(0.5);
    const none = endless(0);
    const samples = [
      { beyond: 350, hidden: 0 },
      { beyond: far, hidden: 0 },
    ];

    assert.equal(legacyShade([lit, none], samples), 0, "the bug: the min() form gave the mask away to shadow 0");
    assert.ok(Math.abs(shade([lit, none], samples) - 0.5) < 1e-9);
  });

  it("hands the point to the darkest light asking for it", () => {
    const samples = [
      { beyond: far, hidden: 0 },
      { beyond: far, hidden: 0 },
    ];
    assert.ok(Math.abs(shade([endless(0.2), endless(0.7)], samples) - 0.7) < 1e-9);
  });

  it("still clears darkening inside any light's core", () => {
    const samples = [
      { beyond: 0, hidden: 0 },
      { beyond: far, hidden: 0 },
    ];
    assert.equal(shade([endless(0), endless(1)], samples), 0);
  });

  it("does not clear darkening where a light is occluded from the point", () => {
    const samples = [
      { beyond: 0, hidden: 1 },
      { beyond: far, hidden: 0 },
    ];
    assert.ok(Math.abs(shade([endless(0), endless(0.6)], samples) - 0.6) < 1e-9);
  });
});

describe("a bounded cast carries only as far as the light does", () => {
  const bounded = (cast: number, intensity = 0): Light => ({
    spread: 100,
    intensity,
    shadow: 0.5,
    cast,
  });

  it("reaches full darkness at the far edge of the spread", () => {
    assert.ok(Math.abs(shade([bounded(1)], [{ beyond: 100, hidden: 0 }]) - 0.5) < 1e-9);
  });

  it("fades to nothing by the end of the tail", () => {
    assert.equal(shade([bounded(1)], [{ beyond: 200, hidden: 0 }]), 0);
    assert.equal(shade([bounded(1)], [{ beyond: 4000, hidden: 0 }]), 0);
  });

  it("decays across the tail rather than stepping off at its end", () => {
    const near = shade([bounded(1)], [{ beyond: 130, hidden: 0 }]);
    const mid = shade([bounded(1)], [{ beyond: 150, hidden: 0 }]);
    const late = shade([bounded(1)], [{ beyond: 180, hidden: 0 }]);
    assert.ok(near > mid && mid > late && late > 0, `expected a falling tail, got ${near}, ${mid}, ${late}`);
    assert.ok(Math.abs(mid - 0.25) < 1e-9, "the halfway point of a smoothstep is half the darkness");
  });

  it("carries twice as far on 2x as on 1x", () => {
    assert.equal(shade([bounded(1)], [{ beyond: 250, hidden: 0 }]), 0);
    assert.ok(shade([bounded(2)], [{ beyond: 250, hidden: 0 }]) > 0);
    assert.equal(shade([bounded(2)], [{ beyond: 300, hidden: 0 }]), 0);
  });

  it("carries further the more intense the light", () => {
    const dim = shade([bounded(1, 0)], [{ beyond: 190, hidden: 0 }]);
    const bright = shade([bounded(1, 1)], [{ beyond: 190, hidden: 0 }]);
    assert.ok(bright > dim && dim > 0, `expected the brighter light to carry darker, got ${dim} and ${bright}`);

    assert.equal(shade([bounded(1, 0)], [{ beyond: 210, hidden: 0 }]), 0);
    assert.ok(shade([bounded(1, 1)], [{ beyond: 210, hidden: 0 }]) > 0);
  });

  it("leaves a light in the far corner untouched by a bounded neighbour", () => {
    const near = { beyond: 350, hidden: 0 };
    const away = { beyond: 4000, hidden: 0 };
    const neighbour: Light = { spread: 350, intensity: 0.05, shadow: 1, cast: 2 };
    assert.ok(Math.abs(shade([endless(0.5), neighbour], [near, away]) - 0.5) < 1e-9);
  });
});
