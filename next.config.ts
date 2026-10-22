import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  distDir: process.env.NEXT_BUILD_DIR ?? '.next',
  ...(process.env.NEXT_BUILD_DIR ? { experimental: { cpus: 1 } } : {}),
};

export default nextConfig;
