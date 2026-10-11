import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve(__dirname), base: "./",
  css: { postcss: { plugins: [] } },
  resolve: { alias: { "@": resolve(__dirname, "../../src") } },
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  build: { outDir: resolve(__dirname, "../../out/workstation"), emptyOutDir: true },
});
