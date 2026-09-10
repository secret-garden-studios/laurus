import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIGHT_SOURCE_SHADER } from "./mask-gl.ts";
import {
  HIGHLIGHT_MOVING_COLOR,
  HIGHLIGHT_SELECTED_COLOR,
  HIGHLIGHT_SHADOW_COLOR,
  HIGHLIGHT_SIBLING_COLOR,
  highlightObjectReviewAddedColor,
  gridlinesHighlightColor,
} from "./mask-constants.ts";

function functions(source: string): { params: string[]; body: string }[] {
  const found: { params: string[]; body: string }[] = [];
  const signature = /\b(?:void|bool|int|float|vec[234]|mat[234]|[A-Z]\w*)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = signature.exec(source)) !== null) {
    const params = match[2]
      .split(",")
      .map((p) => p.trim().split(/\s+/).pop() ?? "")
      .filter((p) => p.length > 0 && p !== "void");
    let depth = 1;
    let i = signature.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    found.push({ params, body: source.slice(signature.lastIndex, i - 1) });
  }
  return found;
}

function illegalUniformIndexing(source: string): string[] {
  const offences: string[] = [];
  for (const { params, body } of functions(source)) {
    if (params.length === 0) continue;
    const indexing = /\b(u_\w+)\s*\[\s*(\w+)\s*\]/g;
    let match: RegExpExecArray | null;
    while ((match = indexing.exec(body)) !== null) {
      if (params.includes(match[2])) offences.push(`${match[1]}[${match[2]}]`);
    }
  }
  return offences;
}

describe("the mask shader's uniform array indexing", () => {
  for (const [stage, source] of [
    ["vertex", LIGHT_SOURCE_SHADER.vertex],
    ["fragment", LIGHT_SOURCE_SHADER.fragment],
  ] as const) {
    it(`never indexes a uniform array by a function parameter, in the ${stage} stage`, () => {
      assert.deepEqual(
        illegalUniformIndexing(source),
        [],
        "GLSL ES 1.00 allows only a loop index or a constant here -- read the array in " +
          "the loop and pass the value in, the way objectBehindMask and objectOutranks do",
      );
    });
  }

  it("catches the form it is here to catch", () => {
    const bad = `
bool pick(int i) { return u_objectOrders[i] < 0.0; }
void main() { for (int i = 0; i < 4; i++) { pick(i); } }`;
    assert.deepEqual(illegalUniformIndexing(bad), ["u_objectOrders[i]"]);
  });

  it("leaves indexing by a loop index alone, inside a function that has parameters", () => {
    const fine = `
vec3 objectField(vec2 p) {
  for (int i = 0; i < 4; i++) { float order = u_objectOrders[i]; }
  return vec3(0.0);
}`;
    assert.deepEqual(illegalUniformIndexing(fine), []);
  });

  it("reads a parameter list with qualifiers, so a qualified slot is still caught", () => {
    const bad = `bool pick(const in int slot) { return u_objects[slot].x < 0.0; }`;
    assert.deepEqual(illegalUniformIndexing(bad), ["u_objects[slot]"]);
  });
});

const RESERVED = new Set([
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
]);

const TYPES = /\b(?:void|bool|int|float|vec[234]|ivec[234]|bvec[234]|mat[234]|sampler2D|samplerCube)\b/;

function reservedDeclarations(source: string): string[] {
  const found: string[] = [];
  const declaration = new RegExp(`${TYPES.source}\\s+(\\w+)`, "g");
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source)) !== null) {
    if (RESERVED.has(match[1])) found.push(match[1]);
  }
  return found;
}

function callsBeforeDeclaration(source: string): string[] {
  const declaredAt = new Map<string, number>();
  const signature = new RegExp(`${TYPES.source}\\s+(\\w+)\\s*\\([^)]*\\)\\s*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = signature.exec(source)) !== null) {
    if (!declaredAt.has(match[1])) declaredAt.set(match[1], match.index);
  }
  const offences: string[] = [];
  for (const [name, declaration] of declaredAt) {
    const call = new RegExp(`\\b${name}\\s*\\(`, "g");
    let site: RegExpExecArray | null;
    while ((site = call.exec(source)) !== null) {
      if (site.index < declaration) offences.push(name);
    }
  }
  return [...new Set(offences)];
}

describe("the mask shader's identifiers and declaration order", () => {
  for (const [stage, source] of [
    ["vertex", LIGHT_SOURCE_SHADER.vertex],
    ["fragment", LIGHT_SOURCE_SHADER.fragment],
  ] as const) {
    it(`declares nothing by a reserved word, in the ${stage} stage`, () => {
      assert.deepEqual(reservedDeclarations(source), [], "GLSL ES 1.00 reserves these against a later revision");
    });

    it(`calls no function above its definition, in the ${stage} stage`, () => {
      assert.deepEqual(callsBeforeDeclaration(source), [], "GLSL has no implicit declarations");
    });
  }

  it("catches a reserved word used as a local", () => {
    assert.deepEqual(reservedDeclarations("void main() { float cast = 1.0; }"), ["cast"]);
  });

  it("catches a call written above its definition", () => {
    const bad = "void main() { helper(); }\nvoid helper() { }";
    assert.deepEqual(callsBeforeDeclaration(bad), ["helper"]);
  });

  it("leaves a call below its definition alone", () => {
    const fine = "float helper() { return 1.0; }\nvoid main() { helper(); }";
    assert.deepEqual(callsBeforeDeclaration(fine), []);
  });
});

describe("the highlight drop shadow", () => {
  const source = LIGHT_SOURCE_SHADER.fragment;
  const match = Number(/HIGHLIGHT_SHADOW_MATCH = ([\d.]+)/.exec(source)?.[1]);
  const offRgb = (color: readonly number[]) =>
    Math.hypot(...HIGHLIGHT_SELECTED_COLOR.slice(0, 3).map((c, i) => c - color[i]));

  it("reads its appearance from the mask constants", () => {
    assert.ok(Number.isFinite(match), "the shader should carry a match tolerance to read");
    assert.match(source, /#define HIGHLIGHT_SHADOW_COLOR vec3\(/);
    assert.match(source, new RegExp(`#define HIGHLIGHT_SHADOW_ALPHA ${HIGHLIGHT_SHADOW_COLOR[3].toFixed(6)}`));
    assert.match(source, /#define HIGHLIGHT_SHADOW_OFFSET_X_PX /);
    assert.match(source, /#define HIGHLIGHT_SHADOW_OFFSET_Y_PX /);
    assert.match(source, /#define HIGHLIGHT_SHADOW_BLUR_PX /);
  });

  it("sits behind the highlight rather than over it", () => {
    assert.match(source, /mix\(withGlow, HIGHLIGHT_SHADOW_COLOR, lightShadow\)/);
    assert.match(source, /mix\(withHighlightShadow, v_highlight\.rgb, lightEdge\)/);
  });

  it("gates on an rgb the selected and sibling colors share", () => {
    assert.deepEqual(
      HIGHLIGHT_SIBLING_COLOR.slice(0, 3),
      HIGHLIGHT_SELECTED_COLOR.slice(0, 3),
      "the shader asks for a shadow by rgb -- the two highlight colors have to agree on one",
    );
    assert.ok(offRgb(HIGHLIGHT_SIBLING_COLOR) <= match, "the sibling colour should pass the shader's gate");
  });

  it("leaves every other highlight colour unshadowed", () => {
    const others = {
      moving: HIGHLIGHT_MOVING_COLOR,
      shapeEdit: gridlinesHighlightColor(1),
      reviewAdded: highlightObjectReviewAddedColor(1),
    };
    for (const [name, color] of Object.entries(others)) {
      assert.ok(offRgb(color) > match, `${name} would slip through the shader's shadow gate`);
    }
  });
});
