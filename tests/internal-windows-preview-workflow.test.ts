import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const dryWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/internal-windows-preview.yml"),
  "utf8",
);

const dryGuide = readFileSync(
  resolve(process.cwd(), "docs/windows/INTERNAL_PREVIEW_DRY_BUILD.md"),
  "utf8",
);

const testSigningWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/internal-windows-test-signing.yml"),
  "utf8",
);

const testSigningGuide = readFileSync(
  resolve(process.cwd(), "docs/windows/INTERNAL_TEST_SIGNING.md"),
  "utf8",
);

function assertManualOnly(workflow: string) {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.doesNotMatch(workflow, /\npull_request:/);
}

test("internal Windows preview remains a manually dispatched dry build", () => {
  assertManualOnly(dryWorkflow);
  assert.match(dryWorkflow, /npm run tauri build -- --bundles nsis/);
  assert.match(dryWorkflow, /Expected exactly one NSIS setup executable/);
});

test("internal Windows preview never signs or publishes the installer", () => {
  assert.match(dryWorkflow, /status = "not-requested"/);
  assert.match(dryWorkflow, /public_release_eligible = \$false/);
  assert.match(dryWorkflow, /internal_only = \$true/);
  assert.doesNotMatch(dryWorkflow, /signtool\s+sign/i);
  assert.doesNotMatch(dryWorkflow, /WINDOWS_RELEASE_PUBLISH_ENABLED/);
  assert.doesNotMatch(dryWorkflow, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(dryWorkflow, /render\.com/i);
});

test("tester documentation preserves the private unsigned safety boundary", () => {
  assert.match(dryGuide, /private, unsigned Tauri\/NSIS installer artifact/i);
  assert.match(dryGuide, /does not read or create a PFX certificate/i);
  assert.match(dryGuide, /must not be forwarded, mirrored, attached to the public website/i);
});

test("test-signing workflow is manual, main-only, and protected", () => {
  assertManualOnly(testSigningWorkflow);
  assert.match(testSigningWorkflow, /confirm_internal_test_signing/);
  assert.match(testSigningWorkflow, /inputs\.confirm_internal_test_signing && inputs\.ref == 'main'/);
  assert.match(testSigningWorkflow, /name: internal-test-signing/);
  assert.match(testSigningWorkflow, /ZTERMINAL_TEST_SIGNING_PFX_BASE64/);
  assert.match(testSigningWorkflow, /ZTERMINAL_TEST_SIGNING_PFX_PASSWORD/);
});

test("test-signing workflow is limited to a private self-signed artifact", () => {
  assert.match(testSigningWorkflow, /sign \/fd SHA256/i);
  assert.match(testSigningWorkflow, /Get-AuthenticodeSignature/);
  assert.match(testSigningWorkflow, /status = "self-signed-test-only"/);
  assert.match(testSigningWorkflow, /public_release_eligible = \$false/);
  assert.match(testSigningWorkflow, /timestamp = "not-requested"/);
  assert.match(testSigningWorkflow, /Remove-Item -Path "Cert:\\CurrentUser\\Root/);
  assert.match(testSigningWorkflow, /Remove-Item -Path "Cert:\\CurrentUser\\My/);
  assert.doesNotMatch(testSigningWorkflow, /WINDOWS_RELEASE_PUBLISH_ENABLED/);
  assert.doesNotMatch(testSigningWorkflow, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(testSigningWorkflow, /render\.com/i);
  assert.doesNotMatch(testSigningWorkflow, /gh\s+release/i);
  assert.doesNotMatch(testSigningWorkflow, /releases\/windows/i);
  assert.doesNotMatch(testSigningWorkflow, /\s\/tr\s/i);
});

test("test-signing guide requires protected environment secrets and rejects public distribution", () => {
  assert.match(testSigningGuide, /`internal-test-signing`/);
  assert.match(testSigningGuide, /`ZTERMINAL_TEST_SIGNING_PFX_BASE64`/);
  assert.match(testSigningGuide, /`ZTERMINAL_TEST_SIGNING_PFX_PASSWORD`/);
  assert.match(testSigningGuide, /self-signed certificate is not a public software-signing identity/i);
  assert.match(testSigningGuide, /must never be described as an official ZTerminal installer/i);
  assert.match(testSigningGuide, /no GitHub Release, website route, Render configuration, CDN\/object storage, or updater/i);
});
