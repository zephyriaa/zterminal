import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { buildMonaco, monacoDirectory } from "./build-monaco.mjs";

const files = await buildMonaco();
const legacy = resolve("public/vendor/monaco-0.57.0");
assert.ok(legacy.startsWith(resolve("public/vendor") + sep));
await rm(legacy, { recursive: true, force: true });
for (const [name, contents] of files) {
  const path = resolve("public", monacoDirectory, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}
console.log(`Prepared ${monacoDirectory} from module sources with DOMPurify 3.4.17`);
