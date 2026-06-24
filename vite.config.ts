import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

/** Local monorepo checkout; on Vercel use the git dependency from node_modules. */
const localGrudgeControl = path.resolve(import.meta.dirname, "..", "grudgecontrol", "src", "index.ts");

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      ...(fs.existsSync(localGrudgeControl) ? { "grudge-control": localGrudgeControl } : {}),
    },
    dedupe: ["three", "@types/three"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          cannon: ["cannon-es"],
          vendor: ["react", "react-dom", "wouter", "@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
