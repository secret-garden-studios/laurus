/**
 * `.glsl` files are imported as source text: Turbopack serves them via the `type: "raw"` rule
 * in next.config.ts, and the test runner via the loader hook in scripts/glsl-node-hook.mjs.
 */
declare module "*.glsl" {
  const source: string;
  export default source;
}
