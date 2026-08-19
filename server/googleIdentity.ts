import { OAuth2Client } from "google-auth-library";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { MINIMUM_SESSION_SECRET_LENGTH } from "./_core/sessionSecret";

export const GOOGLE_OPEN_ID_PREFIX = "google:";
export const GOOGLE_CSRF_COOKIE = "zterminal_google_csrf";
export const GOOGLE_CSRF_TTL_MS = 10 * 60 * 1000;

export type GoogleIdentityEnvironment = {
  clientId: string;
  databaseUrl: string;
  sessionSecret: string;
};

export type VerifiedGoogleIdentity = {
  sub: string;
  openId: string;
  name: string | null;
  email: string | null;
};

type GoogleTicketPayload = {
  sub?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
};

type GoogleTicket = {
  getPayload(): GoogleTicketPayload | undefined;
};

export type GoogleTokenVerifier = {
  verifyIdToken(input: { idToken: string; audience: string }): Promise<GoogleTicket>;
};

const googleClient = new OAuth2Client();

function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

export function isGoogleIdentityEnabled(environment: GoogleIdentityEnvironment): boolean {
  const sessionSecret = environment.sessionSecret.trim();
  return Boolean(
    asTrimmedString(environment.clientId, 512) &&
      asTrimmedString(environment.databaseUrl, 4_096) &&
      sessionSecret.length >= MINIMUM_SESSION_SECRET_LENGTH
  );
}

export function createGoogleCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Compare the client-visible double-submit value without leaking prefix matches. */
export function hasMatchingGoogleCsrf(expected: unknown, received: unknown): boolean {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const expectedValue = Buffer.from(expected, "utf8");
  const receivedValue = Buffer.from(received, "utf8");
  if (expectedValue.length === 0 || expectedValue.length !== receivedValue.length) return false;
  return timingSafeEqual(expectedValue, receivedValue);
}

export function toGoogleOpenId(subject: string): string {
  const normalized = asTrimmedString(subject, 255);
  if (!normalized) throw new Error("Google token did not contain a subject");
  return `${GOOGLE_OPEN_ID_PREFIX}${normalized}`;
}

export async function verifyGoogleCredential(
  credential: string,
  clientId: string,
  verifier: GoogleTokenVerifier = googleClient
): Promise<VerifiedGoogleIdentity> {
  const idToken = asTrimmedString(credential, 16_384);
  const audience = asTrimmedString(clientId, 512);
  if (!idToken || !audience) throw new Error("Google sign-in is not configured");

  const ticket = await verifier.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  const subject = asTrimmedString(payload?.sub, 255);
  if (!subject) throw new Error("Google token did not contain a subject");

  return {
    sub: subject,
    openId: toGoogleOpenId(subject),
    name: asTrimmedString(payload?.name, 320),
    // Email remains optional display data; Google subject is the account key.
    email: payload?.email_verified ? asTrimmedString(payload.email, 320) : null,
  };
}
