import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIGHT_SOURCE_SHADER } from "./mask-gl.ts";

/**
 * The one GLSL ES 1.00 restriction this shader keeps tripping over, checked on
 * the source rather than by compiling it.
 *
 * Appendix A of the spec limits what may index a uniform array to a
 * "constant-index-expression": a literal, a constant, or a loop index. A
 * function parameter is none of those, however plainly every call site passes a
 * loop index into it -- the restriction is on the expression written inside the
 * function, and it does not look through the call.
 *
 * It is worth a test rather than a note because compiling the shader offline
 * does not catch it. headless-gl's ANGLE build accepts the illegal form
 * silently; browsers reject it, and the whole mask then fails to draw with
 * nothing but a console line to say why. So the only place this can be caught
 * before a browser sees it is here.
 *
 * The rule enforced is narrower than the spec and deliberately so: a uniform
 * array may not be indexed by a name that is a parameter of the function doing
 * the indexing. That is exactly the shape the mistake takes -- a helper written
 * to take a slot, because taking a slot reads more naturally than taking the
 * six values that live in it -- and a narrow rule that never misfires is worth
 * more here than a general one that needs a GLSL parser behind it.
 */

/** Every `name(params) {` in one source, paired with the body's byte range. */
function functions(source: string): { params: string[]; body: string }[] {
  const found: { params: string[]; body: string }[] = [];
  // a return type, a name, a parenthesized parameter list, then an open brace
  const signature = /\b(?:void|bool|int|float|vec[234]|mat[234]|[A-Z]\w*)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = signature.exec(source)) !== null) {
    const params = match[2]
      .split(",")
      .map((p) => p.trim().split(/\s+/).pop() ?? "")
      .filter((p) => p.length > 0 && p !== "void");
    // walk to the matching close brace, so a nested block cannot end the body early
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

/** Uniform arrays indexed by one of the enclosing function's own parameters. */
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
