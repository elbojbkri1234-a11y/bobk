import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The preview host is not localhost. Without this, Next blocks dev assets.
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev"],
  // Keep the product surface clear of the dev badge.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
