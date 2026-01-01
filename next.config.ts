import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbo: false as any, // ⚡ Disable Turbopack for Bun
  } as any,
};

export default nextConfig;
