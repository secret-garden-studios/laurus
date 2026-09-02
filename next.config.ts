import { NextConfig } from "next/types";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  turbopack: {
    rules: {
      "*.glsl": { loaders: ["./scripts/glsl-raw-loader.cjs"], as: "*.js" },
    },
  },
};

export default nextConfig;
