import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import cityConfigPlugin, { REPO_ROOT } from "./plugins/cityConfigPlugin.ts";

const DATA_DIR = path.join(REPO_ROOT, "config", "data") + path.sep;

export default defineConfig({
  plugins: [react(), tailwindcss(), cityConfigPlugin()],
  base: process.env.BASE_PATH ?? "/austin-health-pulse/",
  server: {
    // Data files live in <repo>/config/data, outside the app/ root.
    fs: { allow: [REPO_ROOT] },
  },
  build: {
    outDir: "dist",
    // Small data files (e.g. county-summary.json) must stay real, fingerprinted
    // assets rather than data: URIs, so every deployment serves them the same way.
    assetsInlineLimit: (file) => (file.startsWith(DATA_DIR) ? false : undefined),
  },
});
