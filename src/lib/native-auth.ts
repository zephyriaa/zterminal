import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const NATIVE_CLIENT = "zterminal-windows";
export const NATIVE_SCOPE = "native:identity";
const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const nativeHash = (value: string) => createHash("sha256").update(value).digest("base64url");
const secret = () => randomBytes(32).toString("base64url");
const equal = (a: string, b: string) => { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };

export const nativeAuthorization = z.object({
  client_id: z.literal(NATIVE_CLIENT), code_challenge_method: z.literal("S256"),
  code_challenge: opaque, state: opaque,
  redirect_uri: z.string().max(100).refine(value => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" && u.hostname === "127.0.0.1" && Number(u.port) >= 1024 && Number(u.port) <= 65535 &&
        u.pathname === "/native/callback" && !u.search && !u.hash && !u.username && !u.password && u.href === value;
    } catch { return false; }
  }),
}).strict();
export type NativeAuthorization = z.infer<typeof nativeAuthorization>;
export const nativeTokenRequest = z.discriminatedUnion("grant_type", [
  z.object({ grant_type: z.literal("authorization_code"), client_id: z.literal(NATIVE_CLIENT), code: opaque,
    code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/), redirect_uri: z.string().max(100) }).strict(),
  z.object({ grant_type: z.literal("refresh_token"), client_id: z.literal(NATIVE_CLIENT), refresh_token: opaque }).strict(),
]);

/** Consent binds the verified browser identity to the exact public-client request. */
export function nativeConsent(request: NativeAuthorization, userId: string, signingKey: string, expires: number) {
  return `${expires}.${createHmac("sha256", signingKey).update(JSON.stringify([request, userId, expires])).digest("base64url")}`;
}
export function verifyNativeConsent(value: string, request: NativeAuthorization, userId: string, key: string, now = Date.now()) {
  const expires = Number(value.split(".")[0]);
  return Number.isSafeInteger(expires) && expires > now && expires <= now + 300_000 && equal(value, nativeConsent(request, userId, key, expires));
}

export class NativeGrantError extends Error {
  constructor() { super("Native authorization is invalid, expired or revoked. Start sign-in again."); }
}

export async function authorizeNative(db: PrismaClient, userId: string, request: NativeAuthorization, now = new Date()) {
  const code = secret();
  await db.$transaction(async tx => {
    await tx.nativeAuthorizationCode.deleteMany({ where: { expiresAt: { lte: now } } });
    // Bound active grants per verified identity without a per-process rate-limit map.
    if (await tx.nativeAuthorizationCode.count({ where: { userId } }) >= 5) throw new NativeGrantError();
    await tx.nativeAuthorizationCode.create({ data: { codeHash: nativeHash(code), userId, challenge: request.code_challenge,
      redirectUri: request.redirect_uri, expiresAt: new Date(now.getTime() + 60_000) } });
  }, { isolationLevel: "Serializable" });
  return code;
}

/** Only opaque hashes are persisted. Device credentials authorize identity, never web workspace APIs. */
export async function exchangeNative(db: PrismaClient, input: z.infer<typeof nativeTokenRequest>, now = new Date()) {
  const access = secret(), refresh = secret(), accessExpiresAt = new Date(now.getTime() + 300_000);
  const result = await db.$transaction(async tx => {
    if (input.grant_type === "authorization_code") {
      const grant = await tx.nativeAuthorizationCode.findUnique({ where: { codeHash: nativeHash(input.code) } });
      if (!grant || grant.consumedAt || grant.expiresAt <= now || grant.redirectUri !== input.redirect_uri ||
          !equal(grant.challenge, nativeHash(input.code_verifier))) return null;
      const consumed = await tx.nativeAuthorizationCode.updateMany({ where: { codeHash: grant.codeHash, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) return null;
      await tx.nativeDeviceSession.deleteMany({ where: { userId: grant.userId, OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] } });
      if (await tx.nativeDeviceSession.count({ where: { userId: grant.userId, revokedAt: null } }) >= 20) return null;
      return tx.nativeDeviceSession.create({ data: { userId: grant.userId, name: "ZTerminal for Windows", accessHash: nativeHash(access), accessExpiresAt,
        expiresAt: new Date(now.getTime() + 30 * 86400_000), refreshTokens: { create: { tokenHash: nativeHash(refresh) } } }, include: { user: true } });
    }
    const previous = await tx.nativeRefreshToken.findUnique({ where: { tokenHash: nativeHash(input.refresh_token) }, include: { session: true } });
    if (!previous || previous.session.revokedAt || previous.session.expiresAt <= now) return null;
    if (previous.usedAt || (await tx.nativeRefreshToken.updateMany({ where: { tokenHash: previous.tokenHash, usedAt: null }, data: { usedAt: now } })).count !== 1) {
      // Return the error after committing revocation; throwing here would roll it back.
      await tx.nativeDeviceSession.update({ where: { id: previous.sessionId }, data: { revokedAt: now } });
      return null;
    }
    // Absolute session expiry and bounded token-family size prevent indefinite growth.
    if (await tx.nativeRefreshToken.count({ where: { sessionId: previous.sessionId } }) >= 10_000) {
      await tx.nativeDeviceSession.update({ where: { id: previous.sessionId }, data: { revokedAt: now } });
      return null;
    }
    return tx.nativeDeviceSession.update({ where: { id: previous.sessionId }, data: {
      accessHash: nativeHash(access), accessExpiresAt: accessExpiresAt < previous.session.expiresAt ? accessExpiresAt : previous.session.expiresAt,
      refreshTokens: { create: { tokenHash: nativeHash(refresh) } },
    }, include: { user: true } });
  }, { isolationLevel: "Serializable" });
  if (!result) throw new NativeGrantError();
  return { token_type: "Bearer", scope: NATIVE_SCOPE, access_token: access, refresh_token: refresh,
    access_expires_at: result.accessExpiresAt.toISOString(), expires_at: result.expiresAt.toISOString(),
    session_id: result.id, user: { id: result.user.id, name: result.user.name ?? "ZTerminal account" } };
}

export async function nativeIdentity(db: PrismaClient, token: string, now = new Date()) {
  opaque.parse(token);
  const session = await db.nativeDeviceSession.findFirst({ where: { accessHash: nativeHash(token), revokedAt: null,
    accessExpiresAt: { gt: now }, expiresAt: { gt: now }, scope: NATIVE_SCOPE }, include: { user: true } });
  if (!session) throw new NativeGrantError();
  return { session_id: session.id, scope: session.scope, user: { id: session.user.id, name: session.user.name ?? "ZTerminal account" } };
}

export async function revokeNative(db: PrismaClient, refresh: string, now = new Date()) {
  opaque.parse(refresh);
  const token = await db.nativeRefreshToken.findUnique({ where: { tokenHash: nativeHash(refresh) } });
  if (token) await db.nativeDeviceSession.updateMany({ where: { id: token.sessionId, revokedAt: null }, data: { revokedAt: now } });
}

export async function revokeNativeDevices(db: PrismaClient, userId: string, id: string, now = new Date()) {
  await db.$transaction(async tx => {
    await tx.nativeDeviceSession.updateMany({ where: { userId, ...(id === "all" ? {} : { id }), revokedAt: null }, data: { revokedAt: now } });
    if (id === "all") {
      await tx.nativeAuthorizationCode.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
    }
  }, { isolationLevel: "Serializable" });
}
