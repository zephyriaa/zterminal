import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
// Test the installed Auth.js protocol, not a substitute session implementation.
import { AuthHandler, type RequestInternal } from "../node_modules/next-auth/core/index";
import { authOptions } from "../src/lib/auth";
import { db } from "../src/lib/db";
import type { NextAuthOptions } from "next-auth";
import { sessionAvailabilityProbe } from "../src/lib/auth-session";

test("Auth.js session initialization, restoration, invalid/expired sessions and CSRF-protected logout", async () => {
  const user = await db.user.create({ data: { email: `${randomUUID()}@zterminal.test` } });
  const token = randomUUID(), cookie = 'next-auth.session-token';
  const options = { ...authOptions, secret: "test-only-session-secret", useSecureCookies: false, providers: [] };
  const run = (req: RequestInternal) => AuthHandler({ options, req: { headers: {}, method: "GET", cookies: {}, ...req } });
  try {
    await db.session.create({ data: { userId: user.id, sessionToken: token, expires: new Date(Date.now() + 60000) } });
    for (let i = 0; i < 2; i++) {
      const result = await run({ action: "session", cookies: { [cookie]: token } });
      assert.equal((result.body as { user: { id: string } }).user.id, user.id);
      assert.ok(result.cookies?.some(c => c.name === cookie && c.options.httpOnly && c.options.sameSite === "lax"));
    }
    assert.deepEqual((await run({ action: "session", cookies: { [cookie]: "invalid" } })).body, {});
    const rejected = await run({ action: "signout", method: "POST", cookies: { [cookie]: token }, body: { csrfToken: "wrong" } });
    assert.ok(rejected.redirect?.includes("csrf=true")); assert.ok(await db.session.findUnique({ where: { sessionToken: token } }));
    const csrf = await run({ action: "csrf" });
    const csrfToken = (csrf.body as { csrfToken: string }).csrfToken;
    const cookies = Object.fromEntries(csrf.cookies!.map(c => [c.name, c.value]));
    await run({ action: "signout", method: "POST", cookies: { ...cookies, [cookie]: token }, body: { csrfToken, callbackUrl: "/terminal" } });
    assert.equal(await db.session.findUnique({ where: { sessionToken: token } }), null);
    await db.session.create({ data: { userId: user.id, sessionToken: token, expires: new Date(Date.now() - 1000) } });
    const expired = await Promise.all(Array.from({ length: 3 }, async () => {
      const probe = sessionAvailabilityProbe(options);
      const result = await AuthHandler({ options: probe.options, req: { headers: {}, method: "GET", action: "session", cookies: { [cookie]: token } } });
      assert.equal(probe.failed(), false, "Concurrent expiry is not a session-storage outage");
      return result;
    }));
    for (const result of expired) assert.deepEqual(result.body, {});
    assert.equal(await db.session.findUnique({ where: { sessionToken: token } }), null);
  } finally { await db.user.delete({ where: { id: user.id } }); }
});

test("OAuth protocol round-trip enforces state/PKCE, reuses users and rejects replayed callbacks", async () => {
  const subject = randomUUID(), email = `${subject}@zterminal.test`;
  let currentEmail = email;
  let currentSubject = subject;
  const grants = new Map<string, string>();
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/token") {
      let body = ""; for await (const chunk of request) body += chunk;
      const params = new URLSearchParams(body), code = params.get("code")!, verifier = params.get("code_verifier")!;
      const expected = grants.get(code); grants.delete(code);
      if (!expected || createHash("sha256").update(verifier || "").digest("base64url") !== expected) { response.statusCode = 400; response.end(JSON.stringify({ error: "invalid_grant" })); return; }
      response.end(JSON.stringify({ access_token: "test-only-access", token_type: "Bearer", expires_in: 60 })); return;
    }
    if (request.url === "/userinfo" && request.headers.authorization === "Bearer test-only-access") {
      response.end(JSON.stringify({ sub: currentSubject, email: currentEmail, email_verified: true, name: "Protocol test" })); return;
    }
    // A different Google identity with the same email must not silently acquire the existing user.
    currentSubject = randomUUID();
    const csrf = await run({ action: "csrf" });
    const jar = Object.fromEntries(csrf.cookies!.map(c => [c.name, c.value]));
    const start = await run({ action: "signin", providerId: "google", method: "POST", cookies: jar, body: { csrfToken: (csrf.body as { csrfToken: string }).csrfToken } });
    const authorize = new URL(start.redirect!), code = randomUUID();
    grants.set(code, authorize.searchParams.get("code_challenge")!);
    const collision = await run({ action: "callback", providerId: "google", cookies: { ...jar, ...Object.fromEntries(start.cookies!.map(c => [c.name, c.value])) }, query: { code, state: authorize.searchParams.get("state")! } });
    assert.ok(collision.redirect?.includes("OAuthAccountNotLinked"));
    assert.equal(await db.account.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: currentSubject } } }), null);
    response.statusCode = 404; response.end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const options: NextAuthOptions = { ...authOptions, secret: "test-only-session-secret", useSecureCookies: false, providers: [{
    id: "google", name: "Simulated Google", type: "oauth", clientId: "test-client", clientSecret: "test-secret",
    authorization: `${origin}/authorize`, token: `${origin}/token`, userinfo: `${origin}/userinfo`, checks: ["state", "pkce"],
    profile: claims => ({ id: claims.sub, email: claims.email, name: claims.name, image: null }),
  }] };
  const run = (req: RequestInternal) => AuthHandler({ options, req: { headers: {}, method: "GET", cookies: {}, ...req } });
  try {
    let userId: string | undefined;
    for (let login = 0; login < 2; login++) {
      if (login) currentEmail = `${subject}-updated@zterminal.test`;
      const csrf = await run({ action: "csrf" }), csrfToken = (csrf.body as { csrfToken: string }).csrfToken;
      const jar = Object.fromEntries(csrf.cookies!.map(c => [c.name, c.value]));
      const start = await run({ action: "signin", providerId: "google", method: "POST", cookies: jar, body: { csrfToken, callbackUrl: "/terminal" } });
      const authorize = new URL(start.redirect!);
      assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
      const state = authorize.searchParams.get("state")!, code = randomUUID();
      assert.ok(state); grants.set(code, authorize.searchParams.get("code_challenge")!);
      const cookies = { ...jar, ...Object.fromEntries(start.cookies!.map(c => [c.name, c.value])) };
      if (login === 0) {
        const blockedCookies = await run({ action: "callback", providerId: "google", query: { code, state } });
        assert.ok(blockedCookies.redirect?.includes("OAuthCallback"));
        const invalid = await run({ action: "callback", providerId: "google", cookies, query: { code, state: "wrong-state" } });
        assert.ok(invalid.redirect?.includes("OAuthCallback")); assert.equal(await db.user.findUnique({ where: { email } }), null);
      }
      const callback = await run({ action: "callback", providerId: "google", cookies, query: { code, state } });
      assert.ok(callback.redirect?.endsWith("/terminal"), callback.redirect ?? "Missing callback redirect");
      const user = await db.user.findUnique({ where: { email: currentEmail } }); assert.ok(user);
      if (userId) assert.equal(user.id, userId); else userId = user.id;
      const sessionCookie = callback.cookies!.find(c => c.name === "next-auth.session-token"); assert.ok(sessionCookie?.value);
      const restored = await run({ action: "session", cookies: { [sessionCookie.name]: sessionCookie.value } });
      assert.equal((restored.body as { user: { id: string } }).user.id, userId);
      const replay = await run({ action: "callback", providerId: "google", cookies, query: { code, state } });
      assert.ok(replay.redirect?.includes("OAuthCallback"));
    }
    const denied = await run({ action: "callback", providerId: "google", query: { error: "access_denied" } });
    assert.ok(denied.redirect?.includes("error="), denied.redirect ?? "Missing provider error redirect");
  } finally {
    await db.user.deleteMany({ where: { email: { in: [email, currentEmail] } } });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
