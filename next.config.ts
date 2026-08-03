import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sqlite3 has optional native binaries — keep it external so the bundler
  // doesn't try to compile it. pg and sequelize must be bundled so Vercel
  // serverless functions can find them at runtime (they are NOT pre-installed).
  serverExternalPackages: ["sqlite3"],
};

export default nextConfig;
