import assert from "node:assert/strict";
import test from "node:test";

import { publicWindowsRelease, resolveWindowsRelease } from "../src/lib/releases/windows-release";

const keys = [
  "WINDOWS_RELEASE_PUBLISH_ENABLED",
  "WINDOWS_RELEASE_MANIFEST_JSON",
  "WINDOWS_RELEASE_ALLOWED_HOSTS",
] as const;

type ReleaseEnvironment = Record<(typeof keys)[number], string | undefined>;

function withReleaseEnvironment(values: ReleaseEnvironment, run: () => void) {
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as ReleaseEnvironment;
  try {
    for (const key of keys) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const key of keys) {
      const value = prior[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function validManifest(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema_version: 1,
    state: "published",
    platform: "windows",
    architecture: "x64",
    channel: "stable",
    version: "1.0.0",
    package_url: "https://downloads.zterminal.test/ZTerminal-Setup-1.0.0.msix",
    appinstaller_url: "https://downloads.zterminal.test/stable.appinstaller",
    sha256: "a".repeat(64),
    size_bytes: 123456,
    published_at: "2026-08-23T00:00:00.000Z",
    minimum_supported_version: "1.0.0",
    release_notes_url: "https://zterminal.onrender.com/docs/windows/releases/1.0.0",
    publisher: "ZTerminal",
    signature_verified: true,
    ...overrides,
  });
}

test("Windows release publishing is disabled by default", () => {
  withReleaseEnvironment(
    {
      WINDOWS_RELEASE_PUBLISH_ENABLED: undefined,
      WINDOWS_RELEASE_MANIFEST_JSON: validManifest(),
      WINDOWS_RELEASE_ALLOWED_HOSTS: "downloads.zterminal.test",
    },
    () => {
      assert.deepEqual(resolveWindowsRelease(), {
        available: false,
        reason: "WINDOWS_RELEASE_PUBLISHING_DISABLED",
      });
    },
  );
});

test("a malformed or unapproved Windows release cannot become a download", () => {
  withReleaseEnvironment(
    {
      WINDOWS_RELEASE_PUBLISH_ENABLED: "true",
      WINDOWS_RELEASE_MANIFEST_JSON: validManifest({ package_url: "https://untrusted.example/ZTerminal.msix" }),
      WINDOWS_RELEASE_ALLOWED_HOSTS: "downloads.zterminal.test",
    },
    () => {
      assert.deepEqual(resolveWindowsRelease(), {
        available: false,
        reason: "WINDOWS_RELEASE_CONFIGURATION_INVALID",
      });
    },
  );
});

test("a validated signed release projects only safe public download metadata", () => {
  withReleaseEnvironment(
    {
      WINDOWS_RELEASE_PUBLISH_ENABLED: "true",
      WINDOWS_RELEASE_MANIFEST_JSON: validManifest(),
      WINDOWS_RELEASE_ALLOWED_HOSTS: "downloads.zterminal.test",
    },
    () => {
      const release = publicWindowsRelease();
      assert.equal(release.available, true);
      if (!release.available) return;
      assert.equal(release.version, "1.0.0");
      assert.equal(release.download_url, "https://downloads.zterminal.test/ZTerminal-Setup-1.0.0.msix");
      assert.equal("signature_verified" in release, false);
    },
  );
});
