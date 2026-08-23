import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/internal-windows-preview.yml"),
  "utf8",
);

const guide = readFileSync(
  resolve(process.cwd(), "docs/windows/INTERNAL_PREVIEW_DRY_BUILD.md"),
  "utf8",
);

test("internal Windows preview remains a manually dispatched dry build", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.doesNotMatch(workflow, /\npull_request:/);
  assert.match(workflow, /npm run tauri build -- --bundles nsis/);
  assert.match(workflow, /Expected exactly one NSIS setup executable/);
});

test("internal Windows preview never signs or publishes the installer", () => {
  assert.match(workflow, /status = "not-requested"/);
  assert.match(workflow, /public_release_eligible = \$false/);
  assert.match(workflow, /internal_only = \$true/);
  assert.doesNotMatch(workflow, /signtool\s+sign/i);
  assert.doesNotMatch(workflow, /WINDOWS_RELEASE_PUBLISH_ENABLED/);
  assert.doesNotMatch(workflow, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(workflow, /render\.com/i);
});

test("tester documentation preserves the private unsigned safety boundary", () => {
  assert.match(guide, /private, unsigned Tauri\/NSIS installer artifact/i);
  assert.match(guide, /does not read or create a PFX certificate/i);
  assert.match(guide, /must not be forwarded, mirrored, attached to the public website/i);
});
