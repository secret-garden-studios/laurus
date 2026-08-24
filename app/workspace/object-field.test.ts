import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIGHT_SOURCE_SHADER,
  MASK_OBJECT_SWELL,
  MASK_OBJECT_SWELL_LIMIT,
  MAX_MASK_OBJECT_ELEVATION,
  MIN_MASK_OBJECT_FALLOFF,
  isActiveObject,
  objectProfileK,
  objectSwellAt,
  OBJECT_SDF_ATLAS,
  OBJECT_SDF_GRID,
  OBJECT_SDF_RANGE,
  encodeObjectSdfAtlas,
  objectProfileUAt,
} from "./mask-gl.ts";
import type { ObjectGeometryInput } from "./mask-gl.ts";
import { OBJECT_SDF_TILE, buildObjectShapeFromRings } from "./canvas-media/object-shape.ts";

const FALLOFFS = [1, 2, 4, 6];

function object(over: Partial<ObjectGeometryInput> = {}): ObjectGeometryInput {
  return { cx: 100, cy: 100, radius: 50, elevation: 80, falloff: 2, ...over };
}

function maxSwellAlongRadius(p: ObjectGeometryInput, step = 0.001): number {
  let worst = 0;
  for (let d = 0; d <= p.radius; d += step) {
    const [dx, dy] = objectSwellAt([p.cx + d, p.cy], [p]);
    worst = Math.max(worst, Math.hypot(dx, dy));
  }
  return worst;
}

describe("objectProfileK -- the radial profile k(u) = (1 - u^2)^falloff", () => {
  it("is 1 at the epicenter and 0 at the rim, for every falloff", () => {
    for (const falloff of FALLOFFS) {
      assert.equal(objectProfileK(0, falloff), 1, `k(0) at falloff ${falloff}`);
      assert.ok(objectProfileK(1, falloff) <= Math.pow(1e-4, falloff) + 1e-12, `k(1) at falloff ${falloff}`);
    }
  });

  it("decreases monotonically from epicenter to rim", () => {
    for (const falloff of FALLOFFS) {
      let previous = Infinity;
      for (let u = 0; u <= 1; u += 0.01) {
        const k = objectProfileK(u, falloff);
        assert.ok(k <= previous + 1e-12, `k rose at u=${u}, falloff ${falloff}`);
        previous = k;
      }
    }
  });

  it("matches the analytic gradient the fragment shader lights with", () => {
    for (const falloff of FALLOFFS) {
      for (let u = 0.02; u < 0.98; u += 0.01) {
        const h = 1e-6;
        const numeric = (objectProfileK(u + h, falloff) - objectProfileK(u - h, falloff)) / (2 * h);
        const analytic = -2 * falloff * u * Math.pow(Math.max(1 - u * u, 1e-4), falloff - 1);
        assert.ok(
          Math.abs(numeric - analytic) < 1e-4,
          `gradient mismatch at u=${u.toFixed(2)}, falloff ${falloff}: ${numeric} vs ${analytic}`,
        );
      }
    }
  });

  it("reduces to the promised -4u(1-u^2) at the default falloff of 2", () => {
    for (let u = 0.05; u < 0.95; u += 0.05) {
      const analytic = -2 * 2 * u * Math.pow(1 - u * u, 1);
      assert.ok(Math.abs(analytic - -4 * u * (1 - u * u)) < 1e-9, `at u=${u}`);
    }
  });
});

describe("objectSwellAt -- the in-plane displacement", () => {
  it("is exactly zero at the epicenter", () => {
    for (const falloff of FALLOFFS) {
      assert.deepEqual(objectSwellAt([100, 100], [object({ falloff })]), [0, 0], `falloff ${falloff}`);
    }
  });

  it("is exactly zero at and beyond the rim", () => {
    for (const falloff of FALLOFFS) {
      const p = object({ falloff });
      assert.deepEqual(objectSwellAt([150, 100], [p]), [0, 0], `at rim, falloff ${falloff}`);
      assert.deepEqual(objectSwellAt([200, 100], [p]), [0, 0], `beyond rim, falloff ${falloff}`);
      assert.deepEqual(objectSwellAt([100, 151], [p]), [0, 0], `beyond rim on y, falloff ${falloff}`);
    }
  });

  it("matches the closed-form maximum wherever the fold guard is idle", () => {
    for (const falloff of FALLOFFS) {
      const p = object({ falloff });
      assert.ok(
        (MASK_OBJECT_SWELL * Math.abs(p.elevation)) / p.radius <= MASK_OBJECT_SWELL_LIMIT,
        `the fold guard should be idle for an ordinary object (falloff ${falloff})`,
      );
      const uStar = Math.pow(1 + 2 * falloff, -0.5);
      const expected = MASK_OBJECT_SWELL * p.elevation * uStar * Math.pow((2 * falloff) / (1 + 2 * falloff), falloff);
      assert.ok(
        Math.abs(maxSwellAlongRadius(p) - expected) < 1e-2,
        `falloff ${falloff}: got ${maxSwellAlongRadius(p)}, expected ${expected}`,
      );
    }
  });

  it("stays within 0.385 * MASK_OBJECT_SWELL * |elevation| px even for a clamped needle", () => {
    for (const elevation of [MAX_MASK_OBJECT_ELEVATION, -MAX_MASK_OBJECT_ELEVATION]) {
      for (const falloff of FALLOFFS) {
        const p = object({ radius: 10, elevation, falloff });
        assert.ok(
          (MASK_OBJECT_SWELL * Math.abs(elevation)) / p.radius > MASK_OBJECT_SWELL_LIMIT,
          "this case is meant to engage the fold guard",
        );
        assert.ok(
          maxSwellAlongRadius(p, 0.001) <= 0.385 * MASK_OBJECT_SWELL * Math.abs(elevation) + 1e-9,
          `bound exceeded at elevation ${elevation}, falloff ${falloff}`,
        );
        assert.deepEqual(objectSwellAt([p.cx, p.cy], [p]), [0, 0]);
        assert.deepEqual(objectSwellAt([p.cx + p.radius, p.cy], [p]), [0, 0]);
      }
    }
  });

  it("never folds a point through its own epicenter", () => {
    const crater = object({ radius: 10, elevation: -MAX_MASK_OBJECT_ELEVATION, falloff: MIN_MASK_OBJECT_FALLOFF });
    for (let d = 0.01; d < crater.radius; d += 0.01) {
      const [dx] = objectSwellAt([crater.cx + d, crater.cy], [crater]);
      assert.ok((d + dx) / d > 0, `folded through the epicenter at d=${d}`);
    }
  });

  it("sums linearly, so an overlapping bump and dent cancel exactly", () => {
    const bump = object({ elevation: 80 });
    const dent = object({ elevation: -80 });
    for (let d = 0; d < 50; d += 0.5) {
      const [dx, dy] = objectSwellAt([100 + d, 100 + d * 0.3], [bump, dent]);
      assert.equal(dx, 0, `x at d=${d}`);
      assert.equal(dy, 0, `y at d=${d}`);
    }
  });

  it("treats a dent as the mirror of the bump it inverts", () => {
    for (const falloff of FALLOFFS) {
      for (let d = 1; d < 50; d += 1) {
        const up = objectSwellAt([100 + d, 100], [object({ elevation: 80, falloff })]);
        const down = objectSwellAt([100 + d, 100], [object({ elevation: -80, falloff })]);
        assert.ok(Math.abs(up[0] + down[0]) < 1e-12, `falloff ${falloff} at d=${d}`);
      }
    }
  });
});

describe("LIGHT_SOURCE_SHADER -- structural checks on the generated GLSL", () => {
  const stages = Object.entries(LIGHT_SOURCE_SHADER) as [string, string][];

  it("splices the shared object kernel into both stages exactly once", () => {
    for (const [stage, src] of stages) {
      for (const signature of ["vec2 objectProfile(", "vec3 objectField(", "vec2 objectSwell("]) {
        assert.equal(src.split(signature).length - 1, 1, `${stage}: ${signature}`);
      }
    }
  });

  it("leaves no unspliced template placeholder or non-finite constant in either stage", () => {
    for (const [stage, src] of stages) {
      const code = src.replace(/\/\/[^\n]*/g, "");
      assert.ok(!/\$\{/.test(code), `${stage}: unspliced \${...}`);
      assert.ok(!/NaN|undefined/.test(code), `${stage}: non-finite constant`);
    }
  });

  it("gives every spliced float constant a decimal point", () => {
    for (const [stage, src] of stages) {
      const offenders = src
        .split("\n")
        .filter((line) => /^#define (MASK_OBJECT|BUMP|LIGHT_HEIGHT|OBJECT_)/.test(line) && !/\d\.\d/.test(line));
      assert.deepEqual(offenders, [], `${stage}`);
    }
    for (const [stage, src] of stages) {
      const match = src.match(/#define MAX_MASK_OBJECTS (\S+)/);
      assert.ok(match && /^\d+$/.test(match[1]), `${stage}: MAX_MASK_OBJECTS = ${match?.[1]}`);
    }
  });

  it("bounds every loop by a compile-time constant rather than a uniform", () => {
    for (const [stage, src] of stages) {
      const bounds = [...src.matchAll(/for \(int i = 0; i < (\w+); i\+\+\)/g)].map((m) => m[1]);
      assert.ok(bounds.length > 0, `${stage}: no loops found`);
      for (const bound of bounds) assert.match(bound, /^MAX_/, `${stage}: loop bound`);
    }
  });

  it("declares the object uniforms at the same precision in both stages", () => {
    for (const name of ["u_objects", "u_objectFalloffs"]) {
      const qualifierOf = (src: string) => (src.match(new RegExp(`uniform (\\w+) \\w+ ${name}\\[`)) ?? [])[1];
      const vertex = qualifierOf(LIGHT_SOURCE_SHADER.vertex);
      assert.ok(vertex, `${name}: not declared in the vertex stage`);
      assert.equal(qualifierOf(LIGHT_SOURCE_SHADER.fragment), vertex, `${name}: precision mismatch`);
    }
  });

  it("keeps the fragment stage's #extension directive ahead of everything else", () => {
    const first = LIGHT_SOURCE_SHADER.fragment.split("\n").find((line) => line.trim().length > 0);
    assert.match(first ?? "", /^#extension/);
    const precision = LIGHT_SOURCE_SHADER.fragment.indexOf("precision mediump float;");
    assert.ok(precision >= 0 && precision < LIGHT_SOURCE_SHADER.fragment.indexOf("vec2 objectProfile("));
  });

  it("declares v_meshPos in both stages", () => {
    for (const [stage, src] of stages) {
      assert.match(src, /varying vec2 v_meshPos;/, `${stage}`);
    }
  });

  it("declares the shape sampler mediump rather than letting it default", () => {
    for (const [stage, src] of stages) {
      assert.match(src, /uniform mediump sampler2D u_objectShapes;/, `${stage}`);
    }
  });

  it("keeps the shape lookup's overflow guards in place", () => {
    for (const [stage, src] of stages) {
      assert.match(src, /clamp\(texel, vec2\(0\.0\), vec2\(OBJECT_SDF_TILE - 1\.0\)\)/, `${stage}: tile clamp`);
      assert.match(src, /reach > 1e-4 \? sampled\.yz \/ reach : vec2\(0\.0\)/, `${stage}: medial-axis guard`);
      assert.match(
        src,
        /clamp\(profileU\.yz, -OBJECT_GRADIENT_LIMIT, OBJECT_GRADIENT_LIMIT\)/,
        `${stage}: gradient clamp`,
      );
      assert.match(
        src,
        /field\.xy \+ \(elevation \* profile\.y\) \* gradU, -OBJECT_GRADIENT_LIMIT, OBJECT_GRADIENT_LIMIT\)/,
        `${stage}: accumulation clamp`,
      );
    }
  });

  it("splices the shape lookup into both stages exactly once", () => {
    for (const [stage, src] of stages) {
      for (const signature of [
        "vec3 objectDepthAt(",
        "vec3 objectShapeTexel(",
        "vec3 objectU(",
        "float decodeObjectShape16(",
      ]) {
        assert.equal(src.split(signature).length - 1, 1, `${stage}: ${signature}`);
      }
    }
  });

  it("uses no GLSL ES reserved word as an identifier", () => {
    // The whole list from the GLSL ES 1.00 spec, because this is the one class
    // of shader bug no other test here can reach: everything else in this
    // suite reads the generated source as text, and text is perfectly happy
    // with `vec4 packed = ...` right up until a driver refuses to compile it.
    const RESERVED = [
      "asm",
      "class",
      "union",
      "enum",
      "typedef",
      "template",
      "this",
      "packed",
      "goto",
      "switch",
      "default",
      "inline",
      "noinline",
      "volatile",
      "public",
      "static",
      "extern",
      "external",
      "interface",
      "flat",
      "long",
      "short",
      "double",
      "half",
      "fixed",
      "unsigned",
      "superp",
      "input",
      "output",
      "hvec2",
      "hvec3",
      "hvec4",
      "dvec2",
      "dvec3",
      "dvec4",
      "fvec2",
      "fvec3",
      "fvec4",
      "sampler1D",
      "sampler3D",
      "sampler1DShadow",
      "sampler2DShadow",
      "sampler2DRect",
      "sampler3DRect",
      "sampler2DRectShadow",
      "sizeof",
      "cast",
      "namespace",
      "using",
    ];
    for (const [stage, src] of stages) {
      // strip comments first -- prose is allowed to say "packed"
      const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      for (const word of RESERVED) {
        assert.doesNotMatch(
          code,
          new RegExp(`\\b${word}\\b`),
          `${stage}: "${word}" is reserved in GLSL ES and will not compile`,
        );
      }
    }
  });

  it("filters the tile by hand, because a vertex texture fetch may not", () => {
    for (const [stage, src] of stages) {
      // four corner fetches and two mixes -- hardware filtering is not
      // promised in the vertex stage this runs in
      assert.equal(src.split("objectShapeTexel(row,").length - 1, 4, `${stage}: corner fetches`);
    }
  });
});

describe("objectProfileUAt -- the shape lookup's TypeScript twin", () => {
  const circle = () => {
    const built = buildObjectShapeFromRings([
      Array.from({ length: 512 }, (_, i) => {
        const angle = (2 * Math.PI * i) / 512;
        return [Math.cos(angle), Math.sin(angle)] as [number, number];
      }),
    ]);
    assert.ok(built.ok);
    return built.shape;
  };

  it("agrees with the shapeless case for a circular shape, at every angle", () => {
    // the claim the whole encoding rests on: an object with no shape and one
    // shaped like a circle are the same object
    const shape = circle();
    const shaped = object({ shape });
    const plain = object();
    for (let i = 0; i < 24; i++) {
      const angle = (2 * Math.PI * i) / 24;
      for (const at of [0, 0.3, 0.6, 0.9]) {
        const point: [number, number] = [
          plain.cx + at * plain.radius * Math.cos(angle),
          plain.cy + at * plain.radius * Math.sin(angle),
        ];
        const difference = Math.abs(objectProfileUAt(shaped, point) - objectProfileUAt(plain, point));
        assert.ok(difference < 0.03, `at ${at} along ${angle.toFixed(2)}: differs by ${difference}`);
      }
    }
  });

  it("is 0 at the epicenter and 1 at the rim", () => {
    const shaped = object({ shape: circle() });
    assert.ok(Math.abs(objectProfileUAt(shaped, [shaped.cx, shaped.cy])) < 0.03);
    assert.ok(Math.abs(objectProfileUAt(shaped, [shaped.cx + shaped.radius, shaped.cy]) - 1) < 0.05);
  });

  it("reports above 1 outside the shape, which is what the early-out reads", () => {
    const shaped = object({ shape: circle() });
    assert.ok(objectProfileUAt(shaped, [shaped.cx + shaped.radius * 1.2, shaped.cy]) > 1);
  });

  it("scales with the object's own radius rather than the tile's", () => {
    const shape = circle();
    for (const radius of [10, 50, 300]) {
      const shaped = object({ radius, shape });
      const halfway = objectProfileUAt(shaped, [shaped.cx + radius * 0.5, shaped.cy]);
      assert.ok(Math.abs(halfway - 0.5) < 0.03, `radius ${radius}: u = ${halfway}`);
    }
  });
});

describe("objectSwellAt -- with a custom shape", () => {
  const squareShape = () => {
    const built = buildObjectShapeFromRings([
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
    ]);
    assert.ok(built.ok);
    return built.shape;
  };

  it("is still exactly zero at the epicenter", () => {
    const shaped = object({ shape: squareShape() });
    assert.deepEqual(objectSwellAt([shaped.cx, shaped.cy], [shaped]), [0, 0]);
  });

  it("is still exactly zero beyond the object's maximum reach, in every direction", () => {
    const shaped = object({ shape: squareShape() });
    for (let i = 0; i < 32; i++) {
      const angle = (2 * Math.PI * i) / 32;
      const beyond: [number, number] = [
        shaped.cx + shaped.radius * 1.05 * Math.cos(angle),
        shaped.cy + shaped.radius * 1.05 * Math.sin(angle),
      ];
      assert.deepEqual(objectSwellAt(beyond, [shaped]), [0, 0], `at ${angle.toFixed(2)}`);
    }
  });

  it("keeps the 0.385 * MASK_OBJECT_SWELL * |elevation| pixel bound", () => {
    const shaped = object({ shape: squareShape(), elevation: MAX_MASK_OBJECT_ELEVATION });
    const bound = 0.385 * MASK_OBJECT_SWELL * Math.abs(shaped.elevation) + 1e-6;
    for (let i = 0; i < 64; i++) {
      const angle = (2 * Math.PI * i) / 64;
      for (let at = 0; at <= 1; at += 0.02) {
        const point: [number, number] = [
          shaped.cx + at * shaped.radius * Math.cos(angle),
          shaped.cy + at * shaped.radius * Math.sin(angle),
        ];
        const [dx, dy] = objectSwellAt(point, [shaped]);
        assert.ok(Math.hypot(dx, dy) <= bound, `at ${at.toFixed(2)}/${angle.toFixed(2)}: ${Math.hypot(dx, dy)}`);
      }
    }
  });

  it("never folds a point through its own epicenter", () => {
    const shaped = object({ shape: squareShape(), elevation: -MAX_MASK_OBJECT_ELEVATION });
    for (let at = 0.01; at <= 1; at += 0.01) {
      const point: [number, number] = [shaped.cx + at * shaped.radius, shaped.cy];
      const [dx] = objectSwellAt(point, [shaped]);
      assert.ok(at * shaped.radius + dx > 0, `at ${at.toFixed(2)} the point crossed its epicenter`);
    }
  });
});

describe("encodeObjectSdfAtlas -- the tile packing", () => {
  const decode16 = (high: number, low: number) => high / 255 + low / (255 * 255);
  const decodeDistance = (data: Uint8Array, offset: number) =>
    (decode16(data[offset], data[offset + 1]) - 0.5) * 2 * OBJECT_SDF_RANGE;

  const shapeOf = (rings: [number, number][][]) => {
    const built = buildObjectShapeFromRings(rings);
    assert.ok(built.ok);
    return built.shape;
  };

  const square = (half: number): [number, number][] => [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];

  // where slot `s`'s texel (col, row) lands in the atlas
  const at = (slot: number, col: number, row: number) => {
    const x = (slot % OBJECT_SDF_GRID) * OBJECT_SDF_TILE + col;
    const y = Math.floor(slot / OBJECT_SDF_GRID) * OBJECT_SDF_TILE + row;
    return (y * OBJECT_SDF_ATLAS + x) * 4;
  };

  it("fills exactly one atlas of the declared size", () => {
    const data = encodeObjectSdfAtlas([shapeOf([square(1)])]);
    assert.equal(data.length, OBJECT_SDF_ATLAS * OBJECT_SDF_ATLAS * 4);
  });

  it("round-trips a signed distance to better than one part in 20000", () => {
    const shape = shapeOf([square(1)]);
    const data = encodeObjectSdfAtlas([shape]);
    for (let i = 0; i < shape.sdf.length; i += 313) {
      const col = i % OBJECT_SDF_TILE;
      const row = Math.floor(i / OBJECT_SDF_TILE);
      const decoded = decodeDistance(data, at(0, col, row));
      assert.ok(
        Math.abs(decoded - shape.sdf[i]) < (2 * OBJECT_SDF_RANGE) / 20000,
        `texel ${i}: ${decoded} vs ${shape.sdf[i]}`,
      );
    }
  });

  it("keeps the sign, so inside decodes positive and outside negative", () => {
    const shape = shapeOf([square(1)]);
    const data = encodeObjectSdfAtlas([shape]);
    const middle = OBJECT_SDF_TILE / 2;
    assert.ok(decodeDistance(data, at(0, middle, middle)) > 0, "the centre is inside");
    assert.ok(decodeDistance(data, at(0, 1, 1)) < 0, "the tile's corner is outside");
  });

  it("round-trips the gradient direction through the bias", () => {
    const shape = shapeOf([square(1)]);
    const data = encodeObjectSdfAtlas([shape]);
    for (let i = 0; i < shape.sdf.length; i += 313) {
      const col = i % OBJECT_SDF_TILE;
      const row = Math.floor(i / OBJECT_SDF_TILE);
      const offset = at(0, col, row);
      const gx = (data[offset + 2] / 255) * 2 - 1;
      const gy = (data[offset + 3] / 255) * 2 - 1;
      assert.ok(Math.abs(gx - shape.grad[i * 2] / 127) < 0.01, `texel ${i} gradient x`);
      assert.ok(Math.abs(gy - shape.grad[i * 2 + 1] / 127) < 0.01, `texel ${i} gradient y`);
    }
  });

  it("writes each shape into its own tile and leaves circle slots untouched", () => {
    const shape = shapeOf([square(1)]);
    const data = encodeObjectSdfAtlas([undefined, shape, undefined]);
    const middle = OBJECT_SDF_TILE / 2;
    assert.ok(decodeDistance(data, at(1, middle, middle)) > 0, "slot 1 carries the shape");
    for (const slot of [0, 2]) {
      const offset = at(slot, middle, middle);
      assert.equal(data[offset], 0, `slot ${slot} left as zero`);
      assert.equal(data[offset + 1], 0, `slot ${slot} left as zero`);
    }
  });

  it("lays tiles out in reading order across the grid", () => {
    const shape = shapeOf([square(1)]);
    const slot = OBJECT_SDF_GRID + 2; // second band, third column
    const data = encodeObjectSdfAtlas([...Array(slot).fill(undefined), shape]);
    const middle = OBJECT_SDF_TILE / 2;
    assert.ok(decodeDistance(data, at(slot, middle, middle)) > 0);
  });

  it("scales a draft-resolution tile up rather than refusing it", () => {
    // the editor rasterizes at a smaller tile while a handle is being dragged
    const built = buildObjectShapeFromRings([square(1)], 64);
    assert.ok(built.ok);
    assert.equal(built.shape.tile, 64);
    const data = encodeObjectSdfAtlas([built.shape]);
    const middle = OBJECT_SDF_TILE / 2;
    assert.ok(decodeDistance(data, at(0, middle, middle)) > 0, "a 64-tile shape still fills its 128 slot");
  });
});

describe("isActiveObject -- the shared 'worth uploading / worth subdividing for' predicate", () => {
  it("rejects objects that cannot contribute to the field", () => {
    assert.equal(isActiveObject(object({ elevation: 0 })), false, "zero elevation");
    assert.equal(isActiveObject(object({ radius: 0 })), false, "zero radius");
    assert.equal(isActiveObject(object({ radius: -5 })), false, "negative radius");
    assert.equal(isActiveObject(object()), true, "an ordinary object");
    assert.equal(isActiveObject(object({ elevation: -80 })), true, "a dent is active");
  });

  it("agrees with objectSwellAt about a zero-elevation object doing nothing", () => {
    const flat = object({ elevation: 0 });
    assert.equal(isActiveObject(flat), false);
    for (let d = 0; d < flat.radius; d += 1) {
      assert.deepEqual(objectSwellAt([flat.cx + d, flat.cy], [flat]), [0, 0], `at d=${d}`);
    }
  });
});
