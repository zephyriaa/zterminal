import assert from "node:assert/strict";
import test from "node:test";
import { authOptions, googleSignInConfigured } from "../src/lib/auth";
import { requireProductionAuthRuntime, resolveAuthRuntime } from "../src/lib/auth-runtime";
import { INSTITUTIONAL_AVATAR_PRESETS } from "../src/components/terminal/account-panel";
import { db } from "../src/lib/db";

test("Google identity is exposed only when the full production boundary is configured", () => {
  const incomplete = resolveAuthRuntime({ NODE_ENV: "production" });
  assert.equal(incomplete.authConfigured, false);
  assert.equal(incomplete.cloudSyncConfigured, false);
  assert.deepEqual(incomplete.missing, ["NEXTAUTH_SECRET (or JWT_SECRET)", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "a PostgreSQL DATABASE_URL"]);
  assert.throws(() => requireProductionAuthRuntime(incomplete), /authentication is not configured/i);

  const complete = resolveAuthRuntime({
    NODE_ENV: "production",
    NEXTAUTH_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    DATABASE_URL: "postgresql://user:password@localhost:5432/zterminal",
  });
  assert.equal(complete.authConfigured, true);
  assert.equal(complete.googleOAuthConfigured, true);
  assert.equal(complete.cloudSyncConfigured, true);
  assert.doesNotThrow(() => requireProductionAuthRuntime(complete));
});

test("the current deployment never fabricates a Google or shared analyst identity", () => {
  assert.ok(Array.isArray(authOptions.providers));
  const nonGoogle = authOptions.providers.filter((p) => p.id !== "google");
  assert.equal(nonGoogle.length, 0, "No credentials/shared-development provider may be present");
  if (googleSignInConfigured) {
    assert.equal(authOptions.providers.filter((p) => p.id === "google").length, 1);
  } else {
    assert.equal(authOptions.providers.length, 0, "An incomplete deployment must advertise no sign-in provider");
  }
});

test("Institutional avatar presets are well-formed SVG data URIs", () => {
  assert.ok(INSTITUTIONAL_AVATAR_PRESETS.length >= 4);
  for (const preset of INSTITUTIONAL_AVATAR_PRESETS) {
    assert.ok(preset.id.length > 0, "Preset must have an id");
    assert.ok(preset.label.length > 0, "Preset must have a human-readable label");
    assert.ok(preset.url.startsWith("data:image/svg+xml,"), "Preset must be an SVG data URI");
  }
});

test("User database records support updating name and profile avatar", async () => {
  const testEmail = `quant-test-${Date.now()}@zterminal.test`;
  
  // 1. Initial user creation
  const created = await db.user.create({
    data: {
      email: testEmail,
      name: "Initial Analyst",
      image: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    },
  });
  assert.equal(created.email, testEmail);
  assert.equal(created.name, "Initial Analyst");

  // 2. Profile update (change display name and set custom institutional avatar)
  const updatedAvatar = INSTITUTIONAL_AVATAR_PRESETS[0].url;
  const updated = await db.user.update({
    where: { email: testEmail },
    data: {
      name: "Senior Quant Strategist",
      image: updatedAvatar,
    },
  });
  assert.equal(updated.name, "Senior Quant Strategist");
  assert.equal(updated.image, updatedAvatar);

  // 3. Clean up test record
  await db.user.delete({ where: { email: testEmail } });
});
