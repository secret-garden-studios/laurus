// Lets `node --test` import .glsl files as source text, the way Turbopack does for the app
// via the `type: "raw"` rule in next.config.ts. Preloaded from the "test" script.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || !url.endsWith(".glsl")) return nextLoad(url, context);
    const source = readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(source)};` };
  },
});
