import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
// Reproducible local editor assets; no CDN dependency and no generated files in Git.
const destination = resolve("public/vendor/monaco-0.55.1");
await mkdir(destination, { recursive: true });
await cp(resolve("node_modules/monaco-editor/min/vs"), resolve(destination, "vs"), { recursive: true });
await cp(resolve("node_modules/monaco-editor/LICENSE"), resolve(destination, "LICENSE"));
