import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSha256,
  isValidVersionProgression,
  generateReleaseManifest,
} from "../src/lib/releases/release-manager";

test("computeSha256 computes accurate SHA-256 hex string", () => {
  const buf = Buffer.from("ZTerminal-Institutional-Workstation");
  const hash = computeSha256(buf);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test("isValidVersionProgression verifies semantic version ordering", () => {
  assert.equal(isValidVersionProgression("0.2.1", "0.2.2"), true);
  assert.equal(isValidVersionProgression("0.2.1", "0.3.0"), true);
  assert.equal(isValidVersionProgression("0.2.1", "1.0.0"), true);
  assert.equal(isValidVersionProgression("0.2.2", "0.2.1"), false);
  assert.equal(isValidVersionProgression("0.2.2", "0.2.2"), false);
});

test("generateReleaseManifest constructs conforming WindowsRelease record", () => {
  const dummyBinary = Buffer.from("MOCK-PE-BINARY-PAYLOAD");
  const bundle = generateReleaseManifest({
    filePath: "dist/ZTerminal_0.2.2_x64-setup.exe",
    buffer: dummyBinary,
    version: "0.2.2",
    channel: "stable",
    publisher: "ZTerminal Systems",
    baseUrl: "https://github.com/aykhank/zterminal/releases/download/v0.2.2",
    releaseNotesUrl: "https://zterminal.onrender.com/download",
  });

  assert.equal(bundle.manifest.version, "0.2.2");
  assert.equal(bundle.manifest.platform, "windows");
  assert.equal(bundle.manifest.size_bytes, dummyBinary.length);
  assert.equal(bundle.manifest.sha256, bundle.sha256);
  assert.equal(bundle.manifest.signature_verified, true);
  assert.ok(bundle.manifest.package_url.endsWith("ZTerminal_0.2.2_x64-setup.exe"));
});
