import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run next to `npm run dev` without overwriting its files.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Policy PDFs / photos are uploaded through server actions (10 MB limit enforced in the action).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
