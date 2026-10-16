import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHelperRelease } from "../src/lib/releases/helper-release";

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
