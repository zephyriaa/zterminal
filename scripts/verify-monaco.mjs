import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMonaco, monacoDirectory } from "./build-monaco.mjs";

const output = resolve(process.argv[2] ?? ".open-next/assets", monacoDirectory);
const vendor = await readdir(resolve(output, ".."));
assert.ok(!vendor.includes("monaco-0.57.0"), "Vulnerable legacy Monaco assets must not be shipped");
const digest = data => createHash("sha256").update(data).digest("hex");
const expectedFiles = await buildMonaco();
const actualFiles = (await readdir(output, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile());
assert.equal(actualFiles.length, expectedFiles.size, "Unexpected files in the Monaco asset bundle");
let count = 0;
for (const [name, expected] of expectedFiles) {
  const packaged = await readFile(resolve(output, name));
  if (digest(expected) !== digest(packaged)) throw new Error(`Packaged Monaco asset mismatch: ${name}`);
  count++;
}
console.log(`Verified ${count} rebuilt Monaco assets and licenses against patched module sources in ${output}`);
