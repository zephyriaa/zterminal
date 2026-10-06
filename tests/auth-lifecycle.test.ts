import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authOptions } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { safeAuthRedirect, isSameOriginMutation, authErrorMessage } from "../src/lib/auth-policy";
import { resolveAuthRuntime } from "../src/lib/auth-runtime";
import { readVerifiedSession, sessionAvailabilityProbe } from "../src/lib/auth-session";

test("auth redirects reject external origins, scheme-relative URLs and credentials", () => {
  for (const input of ["https://evil.test", "//evil.test", "javascript:alert(1)", "https://user:pass@zterminal.test/terminal"]) assert.equal(safeAuthRedirect(input, "https://zterminal.test"), "https://zterminal.test/terminal");
  assert.equal(safeAuthRedirect("/terminal?account=profile", "https://zterminal.test"), "https://zterminal.test/terminal?account=profile");
});

test("auth runtime accepts Worker secret alias and refuses malformed development origins", () => {
  const base = { AUTH_SECRET: "a-test-only-secret", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };
  assert.equal(resolveAuthRuntime(base).authConfigured, true);
  assert.equal(resolveAuthRuntime({ ...base, NEXTAUTH_URL: "http://127.0.0.1:3000" }).authConfigured, true);
  assert.equal(resolveAuthRuntime({ ...base, NEXTAUTH_URL: "http://untrusted.test" }).authConfigured, false);
});

test("cookie mutations reject absent and foreign origins; user errors omit raw data", () => {
  const request = (origin?: string) => new Request("https://zterminal.test/api/user/profile", { method: "PATCH", headers: origin ? { origin } : {} });
  assert.equal(isSameOriginMutation(request()), false);
  assert.equal(isSameOriginMutation(request("https://evil.test")), false);
  assert.equal(isSameOriginMutation(request("https://zterminal.test")), true);
  assert.equal(authErrorMessage("secret=private-stack-trace"), authErrorMessage("unknown"));
});

test("session parsing distinguishes anonymous, expired and unavailable sessions, stripping extra fields", async () => {
  assert.equal(await readVerifiedSession(Response.json({})), null);
  await assert.rejects(() => readVerifiedSession(Response.json({ code: "SESSION_UNAVAILABLE" }, { status: 503 })));
  await assert.rejects(() => readVerifiedSession(Response.json({ user: { id: "user" } })));
  const session = { user: { id: "user", email: "user@example.test", access_token: "must-not-reach-client" }, expires: new Date(Date.now() + 60000).toISOString(), access_token: "must-not-reach-client" };
  const result = await readVerifiedSession(Response.json(session));
  assert.ok(result); assert.equal("access_token" in result, false); assert.equal("access_token" in result.user!, false);
  assert.equal(await readVerifiedSession(Response.json({ ...session, expires: new Date(0).toISOString() })), null);
});

test("session availability is request-scoped and never disguises adapter failure as logout", async () => {
  const unavailable = sessionAvailabilityProbe({ providers: [], adapter: { getSessionAndUser: async () => { throw new Error("private database details"); } } });
  const available = sessionAvailabilityProbe({ providers: [], adapter: { getSessionAndUser: async () => null } });
  await assert.rejects(async () => await unavailable.options.adapter!.getSessionAndUser!("token"), /Session storage unavailable/);
  assert.equal(unavailable.failed(), true); assert.equal(available.failed(), false);
  assert.equal(await available.options.adapter!.getSessionAndUser!("token"), null);
});

test("adapter reuses immutable Google identity, discards provider credentials and revokes sessions", async () => {
  const adapter = authOptions.adapter!, subject = randomUUID();
  const user = await adapter.createUser!({ email: `${subject}@zterminal.test`, emailVerified: null, name: "Analyst", image: null });
  try {
    await adapter.linkAccount!({ userId: user.id, provider: "google", providerAccountId: subject, type: "oauth", access_token: "test-access", refresh_token: "test-refresh", id_token: "test-id" });
    const account = await db.account.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: subject } } });
    assert.equal(account?.access_token, null); assert.equal(account?.refresh_token, null); assert.equal(account?.id_token, null);
    assert.equal((await adapter.getUserByAccount!({ provider: "google", providerAccountId: subject }))?.id, user.id);
    await adapter.updateUser!({ id: user.id, email: `${randomUUID()}@zterminal.test` });
    assert.equal((await adapter.getUserByAccount!({ provider: "google", providerAccountId: subject }))?.id, user.id);
    await assert.rejects(() => adapter.linkAccount!({ userId: user.id, provider: "google", providerAccountId: subject, type: "oauth" }));
    const sessionToken = randomUUID(), expires = new Date(Date.now() + 60_000);
    await adapter.createSession!({ userId: user.id, sessionToken, expires });
    assert.equal((await adapter.getSessionAndUser!(sessionToken))?.user.id, user.id);
    await adapter.updateSession!({ sessionToken, expires: new Date(Date.now() - 1000) });
    assert.ok((await adapter.getSessionAndUser!(sessionToken))!.session.expires < new Date());
    await adapter.deleteSession!(sessionToken);
    await adapter.deleteSession!(sessionToken); // A concurrent observer must see an idempotent revocation.
    assert.equal(await adapter.getSessionAndUser!(sessionToken), null);
    assert.equal(await adapter.getSessionAndUser!(randomUUID()), null);
  } finally { await db.user.delete({ where: { id: user.id } }); }
});
