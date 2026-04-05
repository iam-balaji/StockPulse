import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Native `pg` bindings; keep external for reliable serverless bundles (Vercel). */
  serverExternalPackages: ["pg"]
};

export default nextConfig;
