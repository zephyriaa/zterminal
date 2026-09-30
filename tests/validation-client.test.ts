import test from "node:test";
import assert from "node:assert/strict";
import { defaultValidationConfig, VALIDATION_SCHEMA_VERSION } from "../src/domain/validation/contracts";
import { helper, HelperError } from "../src/lib/local-research/client";

test("validation submits only configuration to the parent Helper endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const config = defaultValidationConfig();
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "http://127.0.0.1:47321/v1/results/parent%20id/validate");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), { config });
      return Response.json({ id: "job", stage: "validating" }, { status: 202 });
    };
    assert.deepEqual(await helper.validate("parent id", config), { id: "job", stage: "validating" });
    assert.equal(config.version, 1);
    assert.equal(VALIDATION_SCHEMA_VERSION, 4);
  } finally { globalThis.fetch = originalFetch; }
});

test("validation admission failures expose the Helper diagnostic", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ error: "Invalid rolling windows" }, { status: 400 });
    await assert.rejects(helper.validate("run", defaultValidationConfig()), (error: unknown) => error instanceof HelperError && error.message === "Invalid rolling windows");
  } finally { globalThis.fetch = originalFetch; }
});
