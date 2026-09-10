import assert from "node:assert/strict";
import test from "node:test";
import { authOptions, googleSignInConfigured } from "../src/lib/auth";
import { INSTITUTIONAL_AVATAR_PRESETS } from "../src/components/terminal/account-panel";
import { db } from "../src/lib/db";

test("Google sign-in is enabled as the exclusive workspace identity provider", () => {
  assert.equal(googleSignInConfigured, true);
  assert.ok(Array.isArray(authOptions.providers));
  assert.ok(authOptions.providers.length >= 1);

  const googleProvider = authOptions.providers.find((p) => p.id === "google");
  assert.ok(googleProvider, "Google provider must be registered");
  assert.equal(googleProvider.name, "Google");

  // Verify only Google provider is exposed (no secondary/credentials provider options in list)
  const nonGoogle = authOptions.providers.filter((p) => p.id !== "google");
  assert.equal(nonGoogle.length, 0, "No non-Google provider should be present");
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
