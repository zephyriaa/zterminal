import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.argv[2] ?? ".open-next/assets", "vendor/monaco-0.57.0");
const source = resolve("node_modules/monaco-editor/min/vs");
const digest = data => createHash("sha256").update(data).digest("hex");
let count = 0;
for (const entry of await readdir(source, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const path = resolve(entry.parentPath, entry.name);
  const relative = path.slice(source.length + 1);
  const [original, packaged] = await Promise.all([readFile(path), readFile(resolve(output, "vs", relative))]);
  if (digest(original) !== digest(packaged)) throw new Error(`Packaged Monaco asset mismatch: ${relative}`);
  count++;
}
if (digest(await readFile(resolve(output, "LICENSE"))) !== digest(await readFile("node_modules/monaco-editor/LICENSE"))) throw new Error("Missing or mismatched Monaco license");
console.log(`Verified ${count} packaged Monaco assets and license in ${output}`);
