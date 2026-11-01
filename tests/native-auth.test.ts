import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { authorizeNative, exchangeNative, nativeAuthorization, nativeConsent, nativeHash, nativeIdentity, nativeTokenRequest, revokeNative, revokeNativeDevices, verifyNativeConsent } from "../src/lib/native-auth";

test("native identity boundaries use real isolated database transactions; no real login", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "zt-native-auth-test-"));
  const url = `file:${path.join(root, "identity.db").replaceAll("\\", "/")}`;
  const db = new PrismaClient({ datasources: { db: { url } } });
  const now = new Date(), verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const request = nativeAuthorization.parse({ client_id: "zterminal-windows", code_challenge_method: "S256", code_challenge: nativeHash(verifier), state: "s".repeat(43), redirect_uri: "http://127.0.0.1:51000/native/callback" });
  const redeem = (code: string) => ({ grant_type: "authorization_code" as const, client_id: "zterminal-windows" as const, code, code_verifier: verifier, redirect_uri: request.redirect_uri });
  const refresh = (token: string) => ({ grant_type: "refresh_token" as const, client_id: "zterminal-windows" as const, refresh_token: token });
  try {
    await db.$executeRawUnsafe('CREATE TABLE "User" ("id" TEXT PRIMARY KEY,"email" TEXT UNIQUE,"name" TEXT,"image" TEXT,"emailVerified" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)');
    await db.$executeRawUnsafe('CREATE TABLE "Session" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL,"sessionToken" TEXT UNIQUE NOT NULL,"expires" DATETIME NOT NULL)');
    const migration = await readFile("prisma/migrations/20261028140000_native_identity/migration.sql", "utf-8");
    for (const statement of migration.split(";").filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    await db.user.createMany({ data: [{ id: "TEST-native-a", name: "TEST ONLY A" }, { id: "TEST-native-b", name: "TEST ONLY B" }] });
    await t.test("exact loopback allowlist, S256 and signed identity-bound consent", () => {
      assert.equal(nativeHash(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
      for (const redirect_uri of ["http://localhost:51000/native/callback", "http://127.0.0.1:80/native/callback", "https://hostile.invalid/callback", "http://127.0.0.1:51000/other", "http://127.0.0.1:51000/native/callback?next=evil", "http://2130706433:51000/native/callback", "zterminal://callback"]) assert.throws(() => nativeAuthorization.parse({ ...request, redirect_uri }));
      assert.throws(() => nativeAuthorization.parse({ ...request, code_challenge_method: "plain" }));
      const consent = nativeConsent(request, "TEST-native-a", "TEST ONLY key", now.getTime() + 60_000);
      assert(verifyNativeConsent(consent, request, "TEST-native-a", "TEST ONLY key", now.getTime()));
      assert(!verifyNativeConsent(consent, request, "TEST-native-b", "TEST ONLY key", now.getTime()));
      assert(!verifyNativeConsent(consent, { ...request, state: "x".repeat(43) }, "TEST-native-a", "TEST ONLY key", now.getTime()));
      assert(!verifyNativeConsent(consent, request, "TEST-native-a", "TEST ONLY key", now.getTime() + 60_001));
      assert.throws(() => nativeTokenRequest.parse({ ...redeem("x".repeat(43)), scope: "workspace:write" }));
    });
    await t.test("wrong verifier/callback, expiry and code replay fail closed; hashes only", async () => {
      const code = await authorizeNative(db, "TEST-native-a", request, now);
      const stored = await db.nativeAuthorizationCode.findUniqueOrThrow({ where: { codeHash: nativeHash(code) } });
      assert.notEqual(stored.codeHash, code);
      await assert.rejects(exchangeNative(db, { ...redeem(code), code_verifier: "wrong".repeat(10) }, now));
      await assert.rejects(exchangeNative(db, { ...redeem(code), redirect_uri: "http://127.0.0.1:51001/native/callback" }, now));
      const session = await exchangeNative(db, redeem(code), now);
      assert.equal((await nativeIdentity(db, session.access_token, now)).user.id, "TEST-native-a");
      await assert.rejects(exchangeNative(db, redeem(code), now));
      await assert.rejects(nativeIdentity(db, session.access_token, new Date(now.getTime() + 300_001)));
      const expired = await authorizeNative(db, "TEST-native-a", request, now);
      await assert.rejects(exchangeNative(db, redeem(expired), new Date(now.getTime() + 60_001)));
      assert.equal((await db.nativeDeviceSession.findUniqueOrThrow({ where: { id: session.session_id } })).scope, "native:identity");
      assert.notEqual((await db.nativeRefreshToken.findFirstOrThrow({ where: { sessionId: session.session_id } })).tokenHash, session.refresh_token);
    });
    await t.test("simultaneous exchange consumes a grant at most once", async () => {
      const code = await authorizeNative(db, "TEST-native-b", request, now);
      const results = await Promise.allSettled([exchangeNative(db, redeem(code), now), exchangeNative(db, redeem(code), now)]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    });
    await t.test("refresh rotates both credentials; reuse revokes whole family", async () => {
      const code = await authorizeNative(db, "TEST-native-b", request, now), first = await exchangeNative(db, redeem(code), now);
      const second = await exchangeNative(db, refresh(first.refresh_token), new Date(now.getTime() + 1000));
      assert.notEqual(first.refresh_token, second.refresh_token); assert.notEqual(first.access_token, second.access_token);
      await assert.rejects(nativeIdentity(db, first.access_token, now));
      assert.equal((await nativeIdentity(db, second.access_token, new Date(now.getTime() + 1000))).user.id, "TEST-native-b");
      await assert.rejects(exchangeNative(db, refresh(first.refresh_token), now));
      await assert.rejects(nativeIdentity(db, second.access_token, now));
      assert((await db.nativeDeviceSession.findUniqueOrThrow({ where: { id: first.session_id } })).revokedAt);
    });
    await t.test("device removal is owner-isolated; all-account removal invalidates pending grants", async () => {
      const code = await authorizeNative(db, "TEST-native-b", request, now), session = await exchangeNative(db, redeem(code), now);
      await revokeNativeDevices(db, "TEST-native-a", session.session_id, now);
      assert.equal((await nativeIdentity(db, session.access_token, now)).user.id, "TEST-native-b");
      const pending = await authorizeNative(db, "TEST-native-b", request, now);
      await db.session.create({ data: { id: "TEST-browser-session", userId: "TEST-native-b", sessionToken: "TEST ONLY browser token", expires: new Date(now.getTime() + 3600_000) } });
      await revokeNativeDevices(db, "TEST-native-b", "all", now);
      await assert.rejects(nativeIdentity(db, session.access_token, now));
      await assert.rejects(exchangeNative(db, redeem(pending), now));
      assert.equal(await db.session.count({ where: { userId: "TEST-native-b" } }), 0);
      await assert.rejects(exchangeNative(db, refresh(session.refresh_token), now));
    });
    await t.test("native logout and absolute session expiry retain no usable credentials", async () => {
      const code = await authorizeNative(db, "TEST-native-a", request, new Date(now.getTime() + 120_000));
      const session = await exchangeNative(db, redeem(code), new Date(now.getTime() + 120_000));
      await assert.rejects(exchangeNative(db, refresh(session.refresh_token), new Date(Date.parse(session.expires_at) + 1)));
      await revokeNative(db, session.refresh_token, now);
      await assert.rejects(nativeIdentity(db, session.access_token, new Date(now.getTime() + 120_000)));
    });
    await t.test("HTTP endpoints reject browser cookies/origins and oversized bodies; scoped native exchange works", async () => {
      const environment = { DATABASE_URL: url, NEXTAUTH_URL: "https://zterminal.test", NEXTAUTH_SECRET: "TEST ONLY native endpoint signing key",
        GOOGLE_CLIENT_ID: "TEST ONLY", GOOGLE_CLIENT_SECRET: "TEST ONLY", ZTERMINAL_NATIVE_AUTH_ENABLED: "1" };
      const previous = Object.fromEntries(Object.keys(environment).map(k => [k, process.env[k]]));
      Object.assign(process.env, environment);
      const { db: endpointDb } = await import("../src/lib/db");
      try {
        const { POST: token } = await import("../src/app/api/native/auth/token/route");
        const { GET: identity } = await import("../src/app/api/native/auth/session/route");
        const { GET: config } = await import("../src/app/api/native/auth/route");
        const { POST: revoke } = await import("../src/app/api/native/auth/revoke/route");
        const { POST: approve } = await import("../src/app/api/native/auth/authorize/route");
        const origin = "https://zterminal.test/api/native/auth";
        assert.equal((await config(new Request(origin))).status, 200);
        const grant = await authorizeNative(db, "TEST-native-a", request);
        for (const headers of [{ origin: "https://zterminal.test" }, { cookie: "TEST ONLY browser cookie" }, { origin: "https://hostile.invalid" }] as Record<string, string>[]) {
          assert.equal((await token(new Request(origin + "/token", { method: "POST", headers, body: JSON.stringify(redeem(grant)) }))).status, 400);
        }
        assert.equal((await token(new Request(origin + "/token", { method: "POST", body: "x".repeat(4097) }))).status, 400);
        assert.equal((await approve(new Request(origin + "/authorize?" + new URLSearchParams(request), { method: "POST", headers: { origin: "https://hostile.invalid" }, body: "decision=approve" }))).status, 400);
        const response = await token(new Request(origin + "/token", { method: "POST", body: JSON.stringify(redeem(grant)) }));
        assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
        const session = await response.json();
        const identityRequest = () => new Request(origin + "/session", { headers: { authorization: `Bearer ${session.access_token}` } });
        const info = await identity(identityRequest()); assert.equal(info.status, 200); assert.equal((await info.json()).scope, "native:identity");
        assert.equal((await revoke(new Request(origin + "/revoke", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) }))).status, 200);
        assert.equal((await identity(identityRequest())).status, 401);
        process.env.ZTERMINAL_NATIVE_AUTH_ENABLED = "0";
        assert.equal((await config(new Request(origin))).status, 503);
      } finally {
        await endpointDb.$disconnect();
        for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      }
    });
  } finally { await db.$disconnect(); await rm(root, { recursive: true, force: true }); }
});
