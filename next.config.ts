import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["sequelize", "sqlite3", "pg"],
};

export default nextConfig;
