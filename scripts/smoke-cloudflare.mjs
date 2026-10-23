import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

// Exercise the deployed Worker entry point, including Next's runtime manifests.
const port = 8788;
const worker = spawn(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--port", String(port),
], {
  detached: process.platform !== "win32",
  env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
for (const stream of [worker.stdout, worker.stderr]) {
  stream.on("data", chunk => { output = (output + chunk).slice(-16000); });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (worker.exitCode !== null) throw new Error(`Worker exited with ${worker.exitCode}`);
    let response;
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/auth/config`, { signal: AbortSignal.timeout(2000) });
    } catch { /* Wait for workerd to start. */ }
    if (response) {
      assert.equal(response.status, 200, "Worker must serve the auth capability endpoint");
      assert.equal(typeof (await response.json()).enabled, "boolean");
      ready = true;
      break;
    }
    await setTimeout(1000);
  }
  assert.ok(ready, "Worker did not serve the auth capability endpoint");
  for (const [path, expected] of [
    ["/workspaces", "Workspaces"],
    ["/workspaces/9297353c-a6de-485c-a0bc-81528c6a9a4d", "ZTerminal"],
    ["/research/example", "Explore a research report"],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `${path} must render in workerd`);
    assert.ok((await response.text()).includes(expected), `${path} must contain its page content`);
    console.log(`PASS ${path}`);
  }
  const anonymous = await fetch(`http://127.0.0.1:${port}/api/cloud/workspaces`, { signal: AbortSignal.timeout(15000) });
  assert.ok([401, 503].includes(anonymous.status), "Anonymous Worker requests must not list cloud workspaces");
  for (const method of ["POST", "DELETE"]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/cloud/workspaces`, {
      method, headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 403, `${method} must reject foreign origins before accessing storage`);
  }
  console.log("PASS anonymous cloud access and cross-origin mutation boundaries");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (process.platform === "win32") worker.kill();
  else {
    try { process.kill(-worker.pid, "SIGTERM"); } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
