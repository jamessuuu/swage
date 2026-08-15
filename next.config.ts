import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright.config.ts drives the dev server via 127.0.0.1 (explicit,
  // deterministic — avoids relying on however a given runner resolves
  // "localhost"). Next.js 16 treats that as cross-origin from its own dev
  // server by default and silently drops the JS chunk/HMR requests, which
  // otherwise leaves the page looking rendered while no client code ever
  // actually runs. See docs/app/api-reference/config/next-config-js/allowedDevOrigins.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
