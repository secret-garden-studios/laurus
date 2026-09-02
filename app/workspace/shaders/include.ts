/**
 * The `#include` directive the shader sources use. GLSL ES 1.00 has none of its own, so the
 * chunks are spliced together here before the source reaches the driver.
 *
 * `#include "name.glsl"` pulls in a sibling shader file; `#include <constants>` pulls in the
 * macro block generated from the TypeScript constants. Includes resolve recursively and each
 * chunk is emitted at most once per stage, so a chunk can name everything it depends on
 * without callers having to order the includes themselves.
 */
const INCLUDE = /^[ \t]*#include[ \t]+(?:"([^"]+)"|<([^>]+)>)[ \t]*$/gm;

export function resolveIncludes(source: string, chunks: Readonly<Record<string, string>>): string {
  const emitted = new Set<string>();

  function expand(text: string, from: string): string {
    return text.replace(INCLUDE, (line, quoted?: string, angled?: string) => {
      const name = quoted ?? angled ?? "";
      const chunk = chunks[name];
      if (chunk === undefined) throw new Error(`${from} includes unknown shader chunk "${name}"`);
      if (emitted.has(name)) return `// (${name} already included)`;
      emitted.add(name);
      return expand(chunk, name);
    });
  }

  return expand(source, "shader");
}
