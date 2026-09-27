import assert from "node:assert/strict";
import test from "node:test";
import { authOptions, googleSignInConfigured } from "../src/lib/auth";
import { requireProductionAuthRuntime, resolveAuthRuntime } from "../src/lib/auth-runtime";
import { INSTITUTIONAL_AVATAR_PRESETS } from "../src/components/terminal/account-panel";
import { db } from "../src/lib/db";
import { randomUUID } from "node:crypto";
import { deleteWorkspace, listWorkspaces, saveWorkspace } from "../src/server/workspaces/dal";
import { useWorkspace } from "../src/stores/workspace";
import { GET as getAuthRoute } from "../src/app/api/auth/[...nextauth]/route";
import { NextRequest } from "next/server";
import { GET as getResearchRoute } from "../src/app/api/research/[...path]/route";

test("Google identity is exposed only when the full production boundary is configured", () => {
  const incomplete = resolveAuthRuntime({ NODE_ENV: "production" });
  assert.equal(incomplete.authConfigured, false);
  assert.equal(incomplete.cloudSyncConfigured, false);
  assert.deepEqual(incomplete.missing, ["NEXTAUTH_SECRET (or JWT_SECRET)", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXTAUTH_URL (public HTTPS origin)", "a PostgreSQL DATABASE_URL"]);
  assert.throws(() => requireProductionAuthRuntime(incomplete), /authentication is not configured/i);

  const complete = resolveAuthRuntime({
    NODE_ENV: "production",
    NEXTAUTH_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    NEXTAUTH_URL: "https://zterminal.example",
    DATABASE_URL: "postgresql://user:password@localhost:5432/zterminal",
  });
  assert.equal(complete.authConfigured, true);
  assert.equal(complete.googleOAuthConfigured, true);
  assert.equal(complete.cloudSyncConfigured, true);
  assert.doesNotThrow(() => requireProductionAuthRuntime(complete));

  // Prisma Accelerate proxy URLs are also valid durable storage for edge deployments
  const accelerate = resolveAuthRuntime({
    NODE_ENV: "production",
    NEXTAUTH_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    NEXTAUTH_URL: "https://zterminal.example",
    DATABASE_URL: "prisma://accelerate.prisma-data.net/?api_key=test_key",
  });
  assert.equal(accelerate.authConfigured, true);
  assert.equal(accelerate.durableDatabaseConfigured, true);
  assert.equal(accelerate.cloudSyncConfigured, true);

  const invalidOrigin = resolveAuthRuntime({
    NODE_ENV: "production", NEXTAUTH_SECRET: "test-secret", GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret", DATABASE_URL: "postgresql://host/database",
    NEXTAUTH_URL: "http://localhost:3000",
  });
  assert.equal(invalidOrigin.authConfigured, false);
  assert.ok(invalidOrigin.missing.includes("NEXTAUTH_URL (public HTTPS origin)"));
});

test("the current deployment never fabricates a Google or shared analyst identity", () => {
  assert.equal(authOptions.session?.strategy, "database", "Sign-out must revoke a server-side session");
  assert.ok(Array.isArray(authOptions.providers));
  const nonGoogle = authOptions.providers.filter((p) => p.id !== "google");
  assert.equal(nonGoogle.length, 0, "No credentials/shared-development provider may be present");
  if (googleSignInConfigured) {
    assert.equal(authOptions.providers.filter((p) => p.id === "google").length, 1);
  } else {
    assert.equal(authOptions.providers.length, 0, "An incomplete deployment must advertise no sign-in provider");
  }
});

test("unconfigured auth endpoints return a controlled session and provider response", async () => {
  if (googleSignInConfigured) return;
  const context = (action: string) => ({ params: Promise.resolve({ nextauth: [action] }) });
  const providers = await getAuthRoute(new NextRequest("http://localhost:3000/api/auth/providers"), context("providers"));
  assert.equal(providers.status, 200);
  assert.deepEqual(await providers.json(), {});
  const session = await getAuthRoute(new NextRequest("http://localhost:3000/api/auth/session"), context("session"));
  assert.equal(session.status, 200);
  assert.equal(await session.json(), null);
});

test("Google callback accepts only a verified email and immutable provider identity", async () => {
  const callback = authOptions.callbacks?.signIn;
  assert.ok(callback);
  const base = { account: { provider: "google" }, user: { id: "google-subject" }, profile: { email: "person@example.test", email_verified: true } };
  const input = (value: unknown) => value as Parameters<typeof callback>[0];
  assert.equal(await callback(input(base)), true);
  assert.equal(await callback(input({ ...base, profile: { ...base.profile, email_verified: false } })), false);
  assert.equal(await callback(input({ ...base, user: { id: "" } })), false);
});

test("public research proxy does not expose persisted jobs by ID", async () => {
  const response = await getResearchRoute(
    new NextRequest("http://localhost:3000/api/research/jobs/another-users-job"),
    { params: Promise.resolve({ path: ["jobs", "another-users-job"] }) },
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "RESEARCH_JOBS_UNAVAILABLE");
});

test("cloud workspace reads, writes and deletes are scoped to the authenticated user ID", async () => {
  const first = await db.user.create({ data: { email: `${randomUUID()}@zterminal.test` } });
  const second = await db.user.create({ data: { email: `${randomUUID()}@zterminal.test` } });
  const id = randomUUID();
  const payload = { id, name: "Private research", view: "chart" as const, symbol: "BTCUSDT", timeframe: "1h" as const, timezone: "UTC" as const, createdAt: Date.now() };
  try {
    await saveWorkspace(first.id, payload);
    assert.equal((await listWorkspaces(first.id)).some((item) => item.id === id), true);
    assert.equal((await listWorkspaces(second.id)).some((item) => item.id === id), false);
    await assert.rejects(() => saveWorkspace(second.id, payload), /another account/);
    await assert.rejects(() => deleteWorkspace(second.id, id), /not found or unauthorized/);
    assert.equal((await listWorkspaces(first.id)).some((item) => item.id === id), true);
  } finally {
    await deleteWorkspace(first.id, id).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  }
});

test("sign-out clears fetched cloud workspaces while keeping local research", () => {
  const local = { id: randomUUID(), name: "Local", view: "chart" as const, symbol: "BTCUSDT", timeframe: "1h", timezone: "UTC" as const, createdAt: Date.now() };
  const cloud = { ...local, id: randomUUID(), name: "Cloud" };
  useWorkspace.setState({ workspaces: [local] });
  useWorkspace.getState().setCloudAuthenticated(true);
  useWorkspace.getState().mergeCloudWorkspaces([cloud]);
  assert.equal(useWorkspace.getState().cloudWorkspaces.length, 1);
  useWorkspace.getState().setCloudAuthenticated(false);
  assert.deepEqual(useWorkspace.getState().workspaces, [local]);
  assert.deepEqual(useWorkspace.getState().cloudWorkspaces, []);
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
