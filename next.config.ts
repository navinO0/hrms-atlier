import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `sequelize` MUST be external — if bundled, Next.js creates multiple copies
  // which makes `TimesheetEntry extends Model` resolve a different `Model` class
  // than Sequelize's own `instanceof Model` check, causing hasMany() to throw.
  // `pg` is NOT listed here — it's explicitly imported via `dialectModule` in
  // sequelize.ts so the bundler includes it for Vercel's serverless runtime.
  // `sqlite3` stays external because it has optional native binaries.
  serverExternalPackages: ["sequelize", "sqlite3"],
};

export default nextConfig;
