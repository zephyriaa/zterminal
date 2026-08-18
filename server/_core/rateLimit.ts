export type RateLimitDecision = { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

type WindowEntry = { startedAt: number; count: number; touchedAt: number };

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, WindowEntry>();

  constructor(private readonly limit: number, private readonly windowMs: number, private readonly maxEntries = 10_000) {}

  consume(key: string, now = Date.now()): RateLimitDecision {
    this.evict(now);
    const existing = this.entries.get(key);
    if (!existing || now - existing.startedAt >= this.windowMs) {
      this.entries.set(key, { startedAt: now, count: 1, touchedAt: now });
      return { allowed: true, remaining: this.limit - 1 };
    }
    existing.touchedAt = now;
    if (existing.count >= this.limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((this.windowMs - (now - existing.startedAt)) / 1_000)) };
    existing.count += 1;
    return { allowed: true, remaining: this.limit - existing.count };
  }

  private evict(now: number) {
    for (const [key, entry] of Array.from(this.entries.entries())) {
      if (now - entry.touchedAt >= this.windowMs) this.entries.delete(key);
    }
    if (this.entries.size <= this.maxEntries) return;
    const overflow = this.entries.size - this.maxEntries;
    Array.from(this.entries.entries()).sort((left, right) => left[1].touchedAt - right[1].touchedAt).slice(0, overflow).forEach(([key]) => this.entries.delete(key));
  }
}

export function publicRequestIdentity(request: { ip?: string; socket?: { remoteAddress?: string | undefined } }) {
  return request.ip?.trim() || request.socket?.remoteAddress?.trim() || "anonymous";
}
