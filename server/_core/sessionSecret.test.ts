import { describe, expect, it } from "vitest";
import { MINIMUM_SESSION_SECRET_LENGTH, requireSessionSecret, sessionSecretError } from "./sessionSecret";

describe("session secret guard", () => {
  it("rejects missing and weak secrets with an actionable non-secret message", () => {
    expect(sessionSecretError("")).toContain("JWT_SECRET is required");
    expect(sessionSecretError("short")).toContain(String(MINIMUM_SESSION_SECRET_LENGTH));
    expect(() => requireSessionSecret("short")).toThrow("JWT_SECRET must be at least");
  });

  it("accepts a sufficiently long secret as key material", () => {
    const secret = "a".repeat(MINIMUM_SESSION_SECRET_LENGTH);
    expect(sessionSecretError(secret)).toBeNull();
    expect(new TextDecoder().decode(requireSessionSecret(secret))).toBe(secret);
  });
});
