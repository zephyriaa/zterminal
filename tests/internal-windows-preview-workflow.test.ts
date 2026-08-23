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

const hostedPreviewConfig = readFileSync(
  resolve(process.cwd(), "src-tauri/tauri.internal-hosted-preview.conf.json"),
  "utf8",
);

const packageManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { scripts: Record<string, string> };

const localFirstBoundary = readFileSync(
  resolve(process.cwd(), "docs/windows/LOCAL_FIRST_PRODUCT_BOUNDARY.md"),
  "utf8",
);

function assertManualOnly(workflow: string) {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.doesNotMatch(workflow, /\npull_request:/);
}

function assertHostedWorkstationPreview(workflow: string) {
  assert.match(workflow, /https:\/\/zterminal\.onrender\.com\/terminal/);
  assert.match(workflow, /zt-reference-terminal/);
  assert.match(workflow, /npm run desktop:hosted-preview:build/);
  assert.match(workflow, /Remote-hosted wrapper for the verified ZTerminal \/terminal workstation/);
  assert.match(workflow, /online_connection_required = \$true/);
  assert.doesNotMatch(workflow, /npm run desktop:build/);
  assert.doesNotMatch(workflow, /npm run tauri build -- --bundles nsis/);
}

test("local-first product boundary excludes the hosted wrapper as a desktop runtime", () => {
  assert.match(localFirstBoundary, /native local-first terminal/i);
  assert.match(localFirstBoundary, /must not receive new terminal capabilities/i);
  assert.match(localFirstBoundary, /No rendering, visual streaming, or browser-WebView product runtime/i);
  assert.match(localFirstBoundary, /No feature work should be added to the hosted wrapper/i);
});

test("internal ZTerminal workstation preview remains manually dispatched and requires the live workstation", () => {
  assertManualOnly(dryWorkflow);
  assertHostedWorkstationPreview(dryWorkflow);
  assert.match(dryWorkflow, /Hosted ZTerminal terminal response did not contain the workstation marker/);
  assert.match(dryWorkflow, /Expected exactly one NSIS setup executable/);
});

test("internal hosted workstation preview remains unsigned and private", () => {
  assert.match(dryWorkflow, /status = "not-requested"/);
  assert.match(dryWorkflow, /public_release_eligible = \$false/);
  assert.match(dryWorkflow, /internal_only = \$true/);
  assert.doesNotMatch(dryWorkflow, /signtool\s+sign/i);
  assert.doesNotMatch(dryWorkflow, /WINDOWS_RELEASE_PUBLISH_ENABLED/);
  assert.doesNotMatch(dryWorkflow, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(dryWorkflow, /render\.com(?!\/terminal)/i);
});

test("hosted preview configuration points only at the actual ZTerminal terminal route", () => {
  const config = JSON.parse(hostedPreviewConfig) as {
    productName: string;
    identifier: string;
    build: { devUrl: string; frontendDist: string; beforeBuildCommand: null };
  };
  assert.equal(config.productName, "ZTerminal Terminal Preview (Internal)");
  assert.equal(config.identifier, "com.zterminal.internalhostedpreview");
  assert.equal(config.build.devUrl, "https://zterminal.onrender.com/terminal");
  assert.equal(config.build.frontendDist, "https://zterminal.onrender.com/terminal");
  assert.equal(config.build.beforeBuildCommand, null);
  assert.equal(
    packageManifest.scripts["desktop:hosted-preview:build"],
    "tauri build --config src-tauri/tauri.internal-hosted-preview.conf.json --bundles nsis",
  );
});

test("tester documentation discloses the hosted preview limitation and rejects shell-only feedback", () => {
  assert.match(dryGuide, /opens the deployed ZTerminal `\/terminal` workstation/i);
  assert.match(dryGuide, /not offline-capable/i);
  assert.match(dryGuide, /not the future local-first native Win32\/Direct3D \+ Rust Track B client/i);
  assert.match(dryGuide, /prior shell-only artifact should no longer be used for feature feedback/i);
  assert.match(dryGuide, /must not be forwarded, mirrored, attached to the public website/i);
});

test("test-signing workflow is manual, main-only, protected, and signs only the hosted workstation preview", () => {
  assertManualOnly(testSigningWorkflow);
  assertHostedWorkstationPreview(testSigningWorkflow);
  assert.match(testSigningWorkflow, /confirm_internal_test_signing/);
  assert.match(testSigningWorkflow, /inputs\.confirm_internal_test_signing && inputs\.ref == 'main'/);
  assert.match(testSigningWorkflow, /name: internal-test-signing/);
  assert.match(testSigningWorkflow, /ZTERMINAL_TEST_SIGNING_PFX_BASE64/);
  assert.match(testSigningWorkflow, /ZTERMINAL_TEST_SIGNING_PFX_PASSWORD/);
});

test("test-signing workflow remains a private self-signed artifact with no public-release capability", () => {
  assert.match(testSigningWorkflow, /sign \/fd SHA256/i);
  assert.match(testSigningWorkflow, /Get-AuthenticodeSignature/);
  assert.match(testSigningWorkflow, /status = "self-signed-test-only"/);
  assert.match(testSigningWorkflow, /public_release_eligible = \$false/);
  assert.match(testSigningWorkflow, /timestamp = "not-requested"/);
  assert.match(testSigningWorkflow, /Remove-Item -Path "Cert:\\CurrentUser\\Root/);
  assert.match(testSigningWorkflow, /Remove-Item -Path "Cert:\\CurrentUser\\My/);
  assert.doesNotMatch(testSigningWorkflow, /WINDOWS_RELEASE_PUBLISH_ENABLED/);
  assert.doesNotMatch(testSigningWorkflow, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(testSigningWorkflow, /gh\s+release/i);
  assert.doesNotMatch(testSigningWorkflow, /releases\/windows/i);
  assert.doesNotMatch(testSigningWorkflow, /\s\/tr\s/i);
});

test("test-signing guide keeps the hosted preview and public-release boundaries explicit", () => {
  assert.match(testSigningGuide, /`internal-test-signing`/);
  assert.match(testSigningGuide, /`ZTERMINAL_TEST_SIGNING_PFX_BASE64`/);
  assert.match(testSigningGuide, /`ZTERMINAL_TEST_SIGNING_PFX_PASSWORD`/);
  assert.match(testSigningGuide, /hosted ZTerminal workstation preview/i);
  assert.match(testSigningGuide, /requires an online connection/i);
  assert.match(testSigningGuide, /self-signed certificate is not a public software-signing identity/i);
  assert.match(testSigningGuide, /must never be described as an official ZTerminal installer/i);
  assert.match(testSigningGuide, /no GitHub Release, website route, Render configuration, CDN\/object storage, or updater/i);
});
