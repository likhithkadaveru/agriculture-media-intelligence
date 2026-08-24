import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (embedded dev database) loads its WASM bundle relative to its own
  // module path; bundling breaks that resolution, so keep it external.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
