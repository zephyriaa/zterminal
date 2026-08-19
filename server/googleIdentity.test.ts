import { describe, expect, it } from "vitest";
import {
  GOOGLE_OPEN_ID_PREFIX,
  hasMatchingGoogleCsrf,
  isGoogleIdentityEnabled,
  toGoogleOpenId,
  verifyGoogleCredential,
} from "./googleIdentity";

describe("direct Google identity contract", () => {
  it("enables only when client identity, session signing, and durable storage are all configured", () => {
    expect(isGoogleIdentityEnabled({ clientId: "client", databaseUrl: "mysql://db", sessionSecret: "x".repeat(64) })).toBe(true);
    expect(isGoogleIdentityEnabled({ clientId: "", databaseUrl: "mysql://db", sessionSecret: "x".repeat(64) })).toBe(false);
    expect(isGoogleIdentityEnabled({ clientId: "client", databaseUrl: "", sessionSecret: "x".repeat(64) })).toBe(false);
    expect(isGoogleIdentityEnabled({ clientId: "client", databaseUrl: "mysql://db", sessionSecret: "short" })).toBe(false);
  });

  it("accepts only an equal non-empty double-submit CSRF value", () => {
    expect(hasMatchingGoogleCsrf("csrf-value", "csrf-value")).toBe(true);
    expect(hasMatchingGoogleCsrf("csrf-value", "csrf-other")).toBe(false);
    expect(hasMatchingGoogleCsrf("", "")).toBe(false);
    expect(hasMatchingGoogleCsrf(undefined, "csrf-value")).toBe(false);
  });

  it("namespaces the immutable Google subject rather than using email as an account key", () => {
    expect(toGoogleOpenId("  109876543210  ")).toBe(`${GOOGLE_OPEN_ID_PREFIX}109876543210`);
    expect(() => toGoogleOpenId(" ")).toThrow("subject");
  });

  it("normalizes optional display fields only after verifier acceptance", async () => {
    const calls: Array<{ idToken: string; audience: string }> = [];
    const verifier = {
      verifyIdToken: async ({ idToken, audience }: { idToken: string; audience: string }) => {
        calls.push({ idToken, audience });
        return {
          getPayload: () => ({
            sub: "subject-1",
            name: "  Research User  ",
            email: "user@example.test",
            email_verified: true,
          }),
        };
      },
    };

    await expect(verifyGoogleCredential("credential", "client-id", verifier)).resolves.toEqual({
      sub: "subject-1",
      openId: `${GOOGLE_OPEN_ID_PREFIX}subject-1`,
      name: "Research User",
      email: "user@example.test",
    });
    expect(calls).toEqual([{ idToken: "credential", audience: "client-id" }]);
  });

  it("does not persist an unverified email and rejects a verifier response without a subject", async () => {
    const noVerifiedEmail = {
      verifyIdToken: async () => ({ getPayload: () => ({ sub: "subject-2", email: "unverified@example.test", email_verified: false }) }),
    };
    await expect(verifyGoogleCredential("credential", "client-id", noVerifiedEmail)).resolves.toMatchObject({
      openId: `${GOOGLE_OPEN_ID_PREFIX}subject-2`,
      email: null,
    });

    const noSubject = { verifyIdToken: async () => ({ getPayload: () => ({ email: "x@example.test", email_verified: true }) }) };
    await expect(verifyGoogleCredential("credential", "client-id", noSubject)).rejects.toThrow("subject");
  });
});
