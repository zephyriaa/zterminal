import { defineConfig } from "vite";

/**
 * Desktop assets are built locally and bundled by Tauri. They are intentionally
 * separate from the deployed Next.js host so the desktop application never becomes
 * a remote-webview wrapper.
 */
export default defineConfig({
  root: "desktop",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
