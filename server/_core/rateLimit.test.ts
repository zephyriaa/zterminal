import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, publicRequestIdentity } from "./rateLimit";

describe("fixed public API rate limiter", () => {
  it("allows a bounded request window, returns a retry period, and resets after the window", () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);
    expect(limiter.consume("client-a", 1_000)).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.consume("client-a", 2_000)).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.consume("client-a", 3_000)).toEqual({ allowed: false, retryAfterSeconds: 58 });
    expect(limiter.consume("client-a", 61_000)).toEqual({ allowed: true, remaining: 1 });
  });

  it("isolates request identities and falls back without retaining forwarded-header data", () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    expect(limiter.consume("client-a", 1_000).allowed).toBe(true);
    expect(limiter.consume("client-b", 1_000).allowed).toBe(true);
    expect(publicRequestIdentity({ ip: " 203.0.113.5 ", socket: { remoteAddress: "127.0.0.1" } })).toBe("203.0.113.5");
    expect(publicRequestIdentity({ socket: { remoteAddress: "127.0.0.1" } })).toBe("127.0.0.1");
    expect(publicRequestIdentity({})).toBe("anonymous");
  });
});
