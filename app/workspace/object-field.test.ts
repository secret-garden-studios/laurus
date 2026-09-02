import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIGHT_SOURCE_SHADER,
  OBJECT_ROTATION_NONE,
  objectRotation,
  objectToShape,
  MASK_OBJECT_SWELL,
  MASK_OBJECT_SWELL_LIMIT,
  MAX_MASK_OBJECT_ELEVATION,
  MIN_MASK_OBJECT_FALLOFF,
  isActiveObject,
  isDrawnObject,
  MAX_MASK_OBJECTS,
  objectProfileK,
  objectSwellAt,
  OBJECT_SDF_ATLAS,
  OBJECT_SDF_GRID,
  OBJECT_SDF_RANGE,
  activeMaskObjects,
  drawnMaskObjects,
  liftSourceAt,
  encodeObjectSdfAtlas,
  objectShapeAtlasSignature,
  objectProfileUAt,
} from "./mask-gl.ts";
import type { ObjectGeometryInput } from "./mask-gl.ts";
import { OBJECT_SDF_DRAFT_TILE, OBJECT_SDF_TILE, buildObjectShapeFromRings } from "./canvas-media/object-shape.ts";
import { MASK_ORDER_UNRANKED } from "./canvas-media/mask-order.ts";

const FALLOFFS = [1, 2, 4, 6];

function object(over: Partial<ObjectGeometryInput> = {}): ObjectGeometryInput {
  return { cx: 100, cy: 100, radius: 50, elevation: 80, falloff: 2, order: 1, ...over };
}

const opaqueRed = { r: 1, g: 0, b: 0, a: 1, h: 0, s: 1 };
const restPose = { cx: 100, cy: 100, radius: 50 };

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
    for (const name of ["u_objects", "u_objectFalloffs", "u_objectRotations"]) {
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
    const slot = OBJECT_SDF_GRID + 2;
    const data = encodeObjectSdfAtlas([...Array(slot).fill(undefined), shape]);
    const middle = OBJECT_SDF_TILE / 2;
    assert.ok(decodeDistance(data, at(slot, middle, middle)) > 0);
  });

  it("scales a draft-resolution tile up rather than refusing it", () => {
    const built = buildObjectShapeFromRings([square(1)], 64);
    assert.ok(built.ok);
    assert.equal(built.shape.tile, 64);
    const data = encodeObjectSdfAtlas([built.shape]);
    const middle = OBJECT_SDF_TILE / 2;
    assert.ok(decodeDistance(data, at(0, middle, middle)) > 0, "a 64-tile shape still fills its 128 slot");
  });
});

describe("objectShapeAtlasSignature -- what makes the atlas upload again", () => {
  const rings = (half: number): [number, number][][] => [
    [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ],
  ];

  const shapeOf = (half: number, tile?: number) => {
    const built = buildObjectShapeFromRings(rings(half), tile);
    assert.ok(built.ok);
    return built.shape;
  };

  it("holds still for the same shapes, so an unchanged frame costs no upload", () => {
    assert.equal(objectShapeAtlasSignature([shapeOf(1)]), objectShapeAtlasSignature([shapeOf(1)]));
  });

  it("separates the draft a drag leaves behind from the shape committed after it", () => {
    const draft = shapeOf(1, OBJECT_SDF_DRAFT_TILE);
    const committed = shapeOf(1);
    assert.equal(draft.path, committed.path, "the commit re-renders the very same rings");
    assert.notEqual(
      objectShapeAtlasSignature([draft]),
      objectShapeAtlasSignature([committed]),
      "the full-resolution field has to reach the atlas, or the edge stays stair-stepped",
    );
  });

  it("still separates two different outlines at the same resolution", () => {
    const wide = buildObjectShapeFromRings([
      [
        [-1, -0.4],
        [1, -0.4],
        [1, 0.4],
        [-1, 0.4],
      ],
    ]);
    assert.ok(wide.ok);
    assert.notEqual(objectShapeAtlasSignature([shapeOf(1)]), objectShapeAtlasSignature([wide.shape]));
  });

  it("keeps a circle slot distinct from a shaped one, and tracks its position", () => {
    const shape = shapeOf(1);
    assert.notEqual(objectShapeAtlasSignature([undefined]), objectShapeAtlasSignature([shape]));
    assert.notEqual(objectShapeAtlasSignature([shape, undefined]), objectShapeAtlasSignature([undefined, shape]));
  });
});

describe("isActiveObject -- the 'worth subdividing for / worth swelling against' predicate", () => {
  it("rejects objects that cannot deform the mesh", () => {
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

  it("stays blind to the things that draw without deforming", () => {
    assert.equal(isActiveObject(object({ elevation: 0, fill: opaqueRed })), false, "a flat tint");
    assert.equal(isActiveObject(object({ elevation: 0, lift: restPose })), false, "a flat lift");
  });
});

describe("isDrawnObject -- the 'worth uploading' predicate", () => {
  it("uploads a flat object that still has something to draw", () => {
    assert.equal(isDrawnObject(object({ elevation: 0 })), false, "flat, uncoloured and unlifted");
    assert.equal(isDrawnObject(object({ elevation: 0, fill: opaqueRed })), true, "a flat tint");
    assert.equal(isDrawnObject(object({ elevation: 0, lift: restPose })), true, "a flat lift");
  });

  it("reads the fill's alpha rather than its color", () => {
    const invisible = { r: 1, g: 0, b: 0, a: 0, h: 0, s: 1 };
    assert.equal(isDrawnObject(object({ elevation: 0, fill: invisible })), false, "fully transparent");
    assert.equal(
      isDrawnObject(object({ elevation: 0, fill: { ...invisible, a: 0.01 } })),
      true,
      "barely there is still there",
    );
  });

  it("still rejects what no amount of color can rescue", () => {
    assert.equal(isDrawnObject(object({ radius: 0, fill: opaqueRed })), false, "zero radius");
    assert.equal(isDrawnObject(object({ radius: -5, fill: opaqueRed })), false, "negative radius");
    assert.equal(
      isDrawnObject(object({ fill: opaqueRed, rotation: { inverse: [1, 0, 0, 1], visible: false } })),
      false,
      "turned edge-on",
    );
  });

  it("uploads a silhouette that draws nothing but stands in a light's way", () => {
    const silhouette = object({ elevation: 0, order: 2 });
    assert.equal(isDrawnObject(silhouette), false, "nothing to draw and no light to block");
    assert.equal(isDrawnObject(silhouette, [{ order: 1 }]), true, "outranks the light, so it blocks it");
    assert.equal(isDrawnObject(silhouette, [{ order: 3 }]), false, "the light is in front of it");
    assert.equal(isDrawnObject(silhouette, [{ order: 0 }]), false, "an unranked light is never blocked");
  });

  it("blocks light from behind the mask too, where a light ranks further back still", () => {
    const behind = object({ elevation: 0, order: -1 });
    assert.equal(isDrawnObject(behind, [{ order: -2 }]), true, "in front of the light, both behind the sheet");
    assert.equal(isDrawnObject(behind, [{ order: 1 }]), false, "the light is in front of the sheet");
  });

  it("is a strict superset of isActiveObject, so nothing that deforms goes unuploaded", () => {
    const candidates = [
      object(),
      object({ elevation: -80 }),
      object({ elevation: 0 }),
      object({ elevation: 0, fill: opaqueRed }),
      object({ elevation: 0, lift: restPose }),
      object({ radius: 0 }),
      object({ rotation: { inverse: [1, 0, 0, 1], visible: false } }),
    ];
    for (const candidate of candidates) {
      if (isActiveObject(candidate)) assert.ok(isDrawnObject(candidate), JSON.stringify(candidate));
    }
  });
});

describe("drawnMaskObjects -- the uploaded set", () => {
  it("carries a flat tinted object into the uniforms alongside the raised ones", () => {
    const flat = object({ cx: 10, elevation: 0, fill: opaqueRed });
    const raised = object({ cx: 20 });
    const inert = object({ cx: 30, elevation: 0 });

    assert.deepEqual(activeMaskObjects([flat, raised, inert]), [raised], "only the raised one deforms");
    assert.deepEqual(drawnMaskObjects([flat, raised, inert]), [raised, flat], "the flat tint is uploaded too");
  });

  it("carries a mask's pure occluders, which are otherwise dropped entirely", () => {
    const mountains = object({ cx: 10, elevation: 0, order: 2 });
    const boat = object({ cx: 20, elevation: 0, order: 3 });
    const sun = { order: 1 };

    assert.deepEqual(drawnMaskObjects([mountains, boat]), [], "nothing drawn is nothing uploaded");
    assert.deepEqual(
      drawnMaskObjects([mountains, boat], [sun]).map((o) => o.cx),
      [10, 20],
      "both outrank the sun, so both reach the shader to block it",
    );
  });

  it("never exceeds the shader's slot count", () => {
    const many = Array.from({ length: MAX_MASK_OBJECTS * 2 }, (_, i) =>
      object({ cx: i, elevation: 0, fill: opaqueRed }),
    );
    assert.equal(drawnMaskObjects(many).length, MAX_MASK_OBJECTS);
  });
});

describe("liftSourceAt -- whose content a point draws", () => {
  const lifted = (over: Partial<ObjectGeometryInput> = {}) => object({ lift: restPose, ...over });

  it("gives a point to the object it is inside, not to the mask's highest-ranked one", () => {
    const near = lifted({ cx: 100, order: 1 });
    const far = lifted({ cx: 300, order: 5 });
    assert.equal(liftSourceAt([near, far], [300, 100]), far, "inside the ranked-up one");
    assert.equal(
      liftSourceAt([near, far], [100, 100]),
      near,
      "inside the ranked-down one -- rank must not reach across empty canvas and take it",
    );
  });

  it("lets rank settle a point both objects cover", () => {
    const under = lifted({ cx: 100, order: 1 });
    const over = lifted({ cx: 130, order: 5 });
    assert.equal(liftSourceAt([under, over], [115, 100]), over, "the front one takes the overlap");
    assert.equal(liftSourceAt([over, under], [115, 100]), over, "and the list order does not matter");
  });

  it("leaves a point no object covers to the mask itself", () => {
    assert.equal(liftSourceAt([lifted({ cx: 100 }), lifted({ cx: 300 })], [200, 100]), undefined);
  });

  it("ignores objects that are not lifted, however they rank", () => {
    const still = object({ cx: 100, order: 9 });
    const moving = lifted({ cx: 100, order: 1 });
    assert.equal(liftSourceAt([still, moving], [100, 100]), moving);
    assert.equal(liftSourceAt([still], [100, 100]), undefined, "nothing lifted, nothing carried");
  });

  it("keeps the two sides of the sheet as separate stacks", () => {
    const front = lifted({ cx: 100, order: 2 });
    const back = lifted({ cx: 100, order: -2 });
    assert.equal(liftSourceAt([front, back], [100, 100], false), front, "in front of the mask");
    assert.equal(liftSourceAt([front, back], [100, 100], true), back, "behind it");
  });

  it("breaks a shared rank by which object the point sits deeper inside", () => {
    const left = lifted({ cx: 100, order: MASK_ORDER_UNRANKED });
    const right = lifted({ cx: 130, order: MASK_ORDER_UNRANKED });
    assert.equal(liftSourceAt([left, right], [105, 100]), left);
    assert.equal(liftSourceAt([left, right], [125, 100]), right);
  });
});

describe("objectRotation -- rotate3d, projected onto the plane a relief lives in", () => {
  const rotationOf = (x: number, y: number, z: number, angle: number) => {
    const rotation = objectRotation(x, y, z, angle);
    assert.ok(rotation, `no rotation for (${x},${y},${z}) at ${angle}deg`);
    return rotation;
  };

  it("has nothing to say about a zero axis or a zero angle", () => {
    assert.equal(objectRotation(0, 0, 0, 90), undefined, "zero axis");
    assert.equal(objectRotation(0, 0, 1, 0), undefined, "zero angle");
    assert.equal(objectRotation(0, 0, 1, 360), undefined, "a full turn");
    assert.equal(objectRotation(0, 0, 1, -720), undefined, "two full turns the other way");
  });

  it("turns a point about z by exactly the angle asked for", () => {
    for (const angle of [30, 45, 120, 200, 330]) {
      const radians = (angle * Math.PI) / 180;
      const [nx, ny] = objectToShape(rotationOf(0, 0, 1, angle), 1, 0);
      assert.ok(Math.abs(nx - Math.cos(radians)) < 1e-9, `x at ${angle}deg: ${nx}`);
      assert.ok(Math.abs(ny + Math.sin(radians)) < 1e-9, `y at ${angle}deg: ${ny}`);
    }
  });

  it("foreshortens by the cosine when the turn is about x or y, as CSS does", () => {
    for (const angle of [30, 45, 60]) {
      const cos = Math.cos((angle * Math.PI) / 180);
      const [, aboutX] = objectToShape(rotationOf(1, 0, 0, angle), 0, 1);
      assert.ok(Math.abs(aboutX - 1 / cos) < 1e-9, `about x at ${angle}deg: ${aboutX}`);
      const [aboutY] = objectToShape(rotationOf(0, 1, 0, angle), 1, 0);
      assert.ok(Math.abs(aboutY - 1 / cos) < 1e-9, `about y at ${angle}deg: ${aboutY}`);
      const [alongX] = objectToShape(rotationOf(1, 0, 0, angle), 1, 0);
      assert.ok(Math.abs(alongX - 1) < 1e-9, `along x at ${angle}deg: ${alongX}`);
    }
  });

  it("goes edge-on at a quarter turn about an in-plane axis, and comes back", () => {
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      assert.equal(objectRotation(x, y, 0, 90)?.visible, false, `(${x},${y}) at 90deg`);
      assert.equal(objectRotation(x, y, 0, 270)?.visible, false, `(${x},${y}) at 270deg`);
      assert.equal(objectRotation(x, y, 0, 180)?.visible, true, `(${x},${y}) at 180deg`);
    }
    assert.equal(objectRotation(0, 0, 1, 90)?.visible, true, "a quarter turn in the plane stays visible");
  });

  it("mirrors rather than vanishes once the shape is past edge-on", () => {
    const [nx, ny] = objectToShape(rotationOf(1, 0, 0, 180), 1, 1);
    assert.ok(Math.abs(nx - 1) < 1e-9, `x: ${nx}`);
    assert.ok(Math.abs(ny + 1) < 1e-9, `y: ${ny}`);
  });

  it("is a no-op on the offset when there is no rotation to apply", () => {
    assert.deepEqual(objectToShape(undefined, 3, -7), [3, -7]);
    assert.deepEqual(objectToShape(OBJECT_ROTATION_NONE, 3, -7), [3, -7]);
  });
});

describe("a rotated object's field", () => {
  it("leaves a shapeless object's profile alone when the turn is in the plane", () => {
    const spun = object({ rotation: objectRotation(0, 0, 1, 37) });
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      for (const d of [10, 25, 49]) {
        const point: [number, number] = [100 + d * Math.cos(angle), 100 + d * Math.sin(angle)];
        assert.ok(
          Math.abs(objectProfileUAt(spun, point) - objectProfileUAt(object(), point)) < 1e-9,
          `at ${angle.toFixed(2)}, d=${d}`,
        );
      }
    }
  });

  it("pulls a shapeless object's rim in along the foreshortened axis", () => {
    const tilted = object({ rotation: objectRotation(1, 0, 0, 60) });
    assert.ok(Math.abs(objectProfileUAt(tilted, [tilted.cx + tilted.radius, tilted.cy]) - 1) < 1e-9, "across");
    assert.ok(Math.abs(objectProfileUAt(tilted, [tilted.cx, tilted.cy + tilted.radius / 2]) - 1) < 1e-9, "up");
    assert.ok(objectProfileUAt(tilted, [tilted.cx, tilted.cy + tilted.radius]) > 1.9, "beyond the squashed rim");
  });

  it("stops swelling the mesh once the turn has taken it edge-on", () => {
    const edgeOn = object({ rotation: objectRotation(1, 0, 0, 90) });
    assert.equal(isActiveObject(edgeOn), false);
    assert.equal(activeMaskObjects([edgeOn]).length, 0);
  });

  it("turns a drawn shape with it", () => {
    const built = buildObjectShapeFromRings([
      [
        [-1, -0.25],
        [1, -0.25],
        [1, 0.25],
        [-1, 0.25],
      ],
    ]);
    assert.ok(built.ok);
    const upright = object({ shape: built.shape });
    const turned = object({ shape: built.shape, rotation: objectRotation(0, 0, 1, 90) });
    const across: [number, number] = [upright.cx + upright.radius * 0.6, upright.cy];
    const up: [number, number] = [upright.cx, upright.cy + upright.radius * 0.6];

    assert.ok(objectProfileUAt(upright, across) < 1, "upright: inside across the long way");
    assert.ok(objectProfileUAt(upright, up) > 1, "upright: outside up the short way");
    assert.ok(objectProfileUAt(turned, up) < 1, "turned: now inside up");
    assert.ok(objectProfileUAt(turned, across) > 1, "turned: now outside across");
  });
});
