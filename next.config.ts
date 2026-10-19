import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Optional sub-path deploys (e.g. GitHub Pages project sites: /recipe-logs).
// Empty for Vercel, Netlify, a custom domain, or local preview.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Fully static, client-only app: every route is an HTML file in `out/`,
  // all data lives on the device (IndexedDB), so any static host works.
  output: "export",
  // `/recipe/` → `recipe/index.html`, which every static host resolves without rewrites.
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_APP_VERSION: pkg.version },
  // The floating dev badge sits on top of the bottom tab bar on phones.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
