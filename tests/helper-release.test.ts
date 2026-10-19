import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHelperRelease, resolveResearchHelperRelease } from "../src/lib/releases/helper-release";
import { supportsCurrentResearch } from "../src/lib/local-research/compatibility";
import { GET as downloadHelper } from "../src/app/download/helper/route";
import { GET as releaseMetadata } from "../src/app/api/releases/helper/route";

const manifest = { version: "1.0.0-preview.4", format: "portable-zip", download_url: "https://releases.example.com/helper-1.0.0-preview.4.zip", sha256: "a".repeat(64), bytes: 123456 };
function resolve(changes = {}) {
  return resolveHelperRelease({ NODE_ENV: "test", ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS: "releases.example.com", ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON: JSON.stringify({ ...manifest, ...changes }) });
}
test("Helper accepts complete portable ZIP metadata and fails closed at trust boundaries", () => {
  assert.equal(resolve().available, true);
  for (const changes of [
    { download_url: "http://releases.example.com/helper.zip" },
    { download_url: "https://evil.example.com/helper.zip" },
    { download_url: "https://user:pass@releases.example.com/helper.zip" },
    { download_url: "https://releases.example.com/helper.exe" },
    { download_url: "https://releases.example.com:444/helper.zip" },
    { format: "installer" }, { sha256: "bad" }, { bytes: 0 }, { version: "latest" },
  ]) assert.equal(resolve(changes).available, false, JSON.stringify(changes));
  assert.equal(resolve({ format: "installer", download_url: "https://releases.example.com/helper.exe" }).available, true);
  assert.equal(resolveHelperRelease({ NODE_ENV: "test" }).available, false);
});

test("current download and metadata agree: legacy is actionable 503, compatible is a no-store redirect", async () => {
  const oldManifest = process.env.ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON;
  const oldHosts = process.env.ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS;
  try {
    process.env.ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS = "releases.example.com";
    process.env.ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON = JSON.stringify(manifest);
    for (const response of [downloadHelper(), releaseMetadata()]) {
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).reason, "HELPER_RELEASE_INCOMPATIBLE");
    }
    process.env.ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON = JSON.stringify({ ...manifest, protocol: 1, researchSchemas: [1, 2], features: ["synthetic_next_open_v2", "research_analyses_v1", "indicator_dataset_v2"] });
    const response = downloadHelper();
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), manifest.download_url);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await releaseMetadata().json()).available, true);
  } finally {
    if (oldManifest === undefined) delete process.env.ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON;
    else process.env.ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON = oldManifest;
    if (oldHosts === undefined) delete process.env.ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS;
    else process.env.ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS = oldHosts;
  }
});

test("current research requires advertised schemas and features without retiring legacy manifests", () => {
  const capabilities = { protocol: 1, researchSchemas: [1, 2], features: ["synthetic_next_open_v2", "research_analyses_v1", "indicator_dataset_v2"] };
  const current = (changes = {}) => resolveResearchHelperRelease({ NODE_ENV: "test", ZTERMINAL_HELPER_RELEASE_ALLOWED_HOSTS: "releases.example.com", ZTERMINAL_HELPER_RELEASE_MANIFEST_JSON: JSON.stringify({ ...manifest, ...capabilities, ...changes }) });
  assert.equal(resolve().available, true); // Existing clients can still resolve their legacy package.
  assert.equal(current().available, true); // Capability compatibility, not version-string ordering.
  for (const patch of [{ protocol: 2 }, { researchSchemas: [1] }, { features: ["research_analyses_v1"] }, { features: ["synthetic_next_open_v2"] }, { features: ["synthetic_next_open_v2", "research_analyses_v1"] }, { features: undefined }]) {
    assert.equal(supportsCurrentResearch({ ...capabilities, ...patch }), false);
    assert.deepEqual(current(patch), { available: false, reason: "HELPER_RELEASE_INCOMPATIBLE" });
  }
  assert.equal(supportsCurrentResearch(null), false);
  assert.equal(supportsCurrentResearch({ ...capabilities, features: "synthetic_next_open_v2" }), false);
});
