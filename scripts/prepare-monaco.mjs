import { cp, mkdir, stat, readdir } from "node:fs/promises";
import { resolve } from "node:path";
// Reproducible local editor assets; no CDN dependency and no generated files in Git.
const destination = resolve("public/vendor/monaco-0.57.0");
await mkdir(destination, { recursive: true });
await cp(resolve("node_modules/monaco-editor/min/vs"), resolve(destination, "vs"), { recursive: true });
await cp(resolve("node_modules/monaco-editor/LICENSE"), resolve(destination, "LICENSE"));
for (const asset of ["loader.js", "editor/editor.main.js", "editor/editor.main.css"]) {
  if (!(await stat(resolve(destination, "vs", asset))).size) throw new Error(`Missing Monaco asset: ${asset}`);
}
const files = await readdir(resolve(destination, "vs"));
const workers = await readdir(resolve(destination, "vs/assets"));
if (!files.some(name => /^python-.*\.js$/.test(name)) || !workers.some(name => /^editor\.worker-.*\.js$/.test(name))) throw new Error("Missing Monaco Python language or editor worker bundle");
