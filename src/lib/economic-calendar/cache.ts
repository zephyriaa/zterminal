import type { EconomicCalendarResponse } from "./types";

interface CacheEntry {
  response: EconomicCalendarResponse;
  expiresAt: number;
  staleUntil: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_GRACE_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 50;

class EconomicCalendarCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string, allowStale: boolean = true): { data: EconomicCalendarResponse; isStale: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now <= entry.expiresAt) {
      return { data: { ...entry.response, isStale: false }, isStale: false };
    }

    if (allowStale && now <= entry.staleUntil) {
      return { data: { ...entry.response, isStale: true }, isStale: true };
    }

    // Expired beyond grace period
    this.cache.delete(key);
    return null;
  }

  set(key: string, response: EconomicCalendarResponse, ttlMs: number = DEFAULT_TTL_MS): void {
    const now = Date.now();
    // Prune oldest if at capacity
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response: { ...response, cachedAt: new Date(now).toISOString() },
      expiresAt: now + ttlMs,
      staleUntil: now + ttlMs + STALE_GRACE_MS,
    });
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const calendarCache = new EconomicCalendarCache();

