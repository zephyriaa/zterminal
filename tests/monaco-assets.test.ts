import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import test from "node:test";
import { buildMonaco, monacoDirectory } from "../scripts/build-monaco.mjs";

test("Monaco packaging uses patched module sources and rejects altered or legacy assets", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "zt-monaco-"));
  try {
    const files = await buildMonaco();
    const main = Buffer.from(files.get("vs/editor/editor.main.js")!).toString();
    assert.match(main, /3\.4\.17/);
    assert.doesNotMatch(main, /3\.4\.15/);
    assert.match(await readFile("src/components/terminal/research-editor.tsx", "utf8"), new RegExp(monacoDirectory));
    for (const [name, contents] of files) {
      const path = resolve(root, monacoDirectory, name);
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, contents);
    }
    const verify = () => execFileSync(process.execPath, ["scripts/verify-monaco.mjs", root], { stdio: "pipe" });
    assert.match(verify().toString(), /Verified/);
    const path = resolve(root, monacoDirectory, "vs/editor/editor.main.js");
    await writeFile(path, main + "\n// altered");
    assert.throws(verify, /Packaged Monaco asset mismatch/);
    await writeFile(path, main);
    await mkdir(resolve(root, "vendor/monaco-0.57.0"));
    assert.throws(verify, /Vulnerable legacy Monaco assets/);
  } finally {
    assert.ok(root.startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true });
  }
});
