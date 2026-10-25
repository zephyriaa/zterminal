import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

export const monacoDirectory = "vendor/monaco-0.57.0-dompurify-3.4.17";

// Build from module sources so an npm override really replaces the embedded sanitizer.
// Keep the existing AMD loader contract used by @monaco-editor/react.
export async function buildMonaco() {
  const source = resolve("node_modules/monaco-editor");
  const require = createRequire(resolve(source, "package.json"));
  const purifier = resolve(dirname(require.resolve("dompurify")), "purify.es.mjs");
  const monacoPackage = JSON.parse(await readFile(resolve(source, "package.json"), "utf8"));
  const purifierPackage = JSON.parse(await readFile(resolve(purifier, "../../package.json"), "utf8"));
  assert.equal(monacoPackage.version, "0.57.0", "Review editor asset compatibility before upgrading Monaco");
  assert.equal(purifierPackage.version, "3.4.17", "The shipped sanitizer must match the reviewed version");
  const output = resolve("public", monacoDirectory, "vs/editor");
  const options = { bundle: true, minify: true, write: false, platform: "browser", target: "es2022", format: "iife", loader: { ".ttf": "file" }, assetNames: "[name]-[hash]", metafile: true, logLevel: "silent" };
  const editor = await build({
    ...options,
    stdin: { contents: `export * from ${JSON.stringify(resolve(source, "esm/vs/editor/editor.main.js"))};`, resolveDir: process.cwd(), sourcefile: "zterminal-monaco.js" },
    outfile: resolve(output, "editor.main.js"), globalName: "zterminalMonaco",
    plugins: [{ name: "patched-dompurify", setup(builder) {
      builder.onResolve({ filter: /\/dompurify\/dompurify\.js$/ }, () => ({ path: purifier }));
    } }],
  });
  const inputs = Object.keys(editor.metafile.inputs).map(path => path.replaceAll("\\", "/"));
  assert.ok(inputs.some(path => path.endsWith("dompurify/dist/purify.es.mjs")), "Patched DOMPurify was not bundled");
  assert.ok(!inputs.some(path => path.endsWith("base/browser/dompurify/dompurify.js")), "Vulnerable vendored DOMPurify was bundled");
  const worker = await build({ ...options, entryPoints: [resolve(source, "esm/vs/editor/editor.worker.js")], outfile: resolve(output, "editor.worker.js") });
  const files = new Map();
  for (const file of [...editor.outputFiles, ...worker.outputFiles]) {
    const name = "vs/editor/" + file.path.slice(output.length + 1).replaceAll("\\", "/");
    files.set(name, file.contents);
  }
  const main = files.get("vs/editor/editor.main.js");
  files.set("vs/editor/editor.main.js", Buffer.from(`define("vs/editor/editor.main",["require"],function(require){
    self.MonacoEnvironment={getWorker:()=>new Worker(require.toUrl("vs/editor/editor.worker.js"))};
    const css=document.createElement("link");css.rel="stylesheet";css.href=require.toUrl("vs/editor/editor.main.css");document.head.appendChild(css);
    ${Buffer.from(main).toString()}
    return zterminalMonaco;
  });`));
  files.set("vs/loader.js", await readFile(resolve(source, "min/vs/loader.js")));
  files.set("LICENSE", await readFile(resolve(source, "LICENSE")));
  files.set("DOMPurify-LICENSE", await readFile(resolve(purifier, "../../LICENSE")));
  return files;
}
