// Turbopack/webpack loader: turns a .glsl file into a module exporting its source text.
// scripts/glsl-node-hook.mjs does the same job for the test runner.
module.exports = function glslRawLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
