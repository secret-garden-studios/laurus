import { NextConfig } from "next/types";

const mediaHostname = process.env.MEDIA_HOSTNAME ?? "**.amazonaws.com";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: mediaHostname }],
  },
  turbopack: {
    rules: {
      "*.glsl": { loaders: ["./scripts/glsl-raw-loader.cjs"], as: "*.js" },
    },
  },
};

export default nextConfig;
