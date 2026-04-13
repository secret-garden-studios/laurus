import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://amazonaws.com*',
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
