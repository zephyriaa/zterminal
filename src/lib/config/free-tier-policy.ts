/**
 * ZTerminal Free-Tier Resource & Cost Control Policy.
 *
 * Centralizes all quotas, timeouts, cache TTLs, and concurrency limits across
 * Cloudflare Workers, Supabase PostgreSQL, OCI Always Free compute, and Cloudflare R2.
 *
 * Designed to sustain 100% free-tier operation under production workloads.
 */

export const FREE_TIER_CONFIG = {
  // Provider: Cloudflare Workers Free (100,000 req/day, 10ms CPU/req)
  cloudflare: {
    maxDailyWorkerRequests: 100_000,
    edgeCacheTtlSeconds: {
      contracts: 3_600, // 1 hour edge cache for catalog
      marketBars: 30,    // 30 seconds edge cache for kline bars
      staticHtml: 3_600, // 1 hour edge cache for prerendered landing
      immutableAssets: 31_536_000, // 1 year immutable for _next/static
    },
  },

  // Client-Side In-Memory & IndexedDB Caching (runs 100% on user's hardware)
  client: {
    contractsCacheTtlMs: 5 * 60 * 1_000, // 5 minutes memory cache
    barsMemoryCacheTtlMs: 30 * 1_000,    // 30 seconds memory cache for active bars
    inFlightDeduplication: true,          // Coalesce simultaneous identical requests
    pauseOnHiddenTab: true,               // Throttle/pause background rendering
  },

  // Provider: Supabase Free (500 MB DB, 5 GB egress, 50,000 MAU)
  supabase: {
    maxWorkspacesPerUser: 10,
    workspaceDebounceMs: 2_000,          // Debounce auto-sync to avoid query spam
    sessionCacheTtlMs: 60 * 60 * 1_000,  // Session cache
    storeRawMarketTicks: false,          // STRICT: NEVER store raw tick data in Postgres
  },

  // Provider: OCI Always Free A1 VM (1 OCPU, 6 GB RAM)
  oci: {
    maxConcurrentQuantJobs: 1,           // Strict: 1 heavy quant backtest at a time
    maxQueuedJobsPerUser: 3,
    maxBacktestBars: 50_000,             // Cap history length to prevent memory blowup
    maxParameterCombinations: 100,
    maxExecutionTimeSeconds: 120,        // Kill jobs exceeding 2 minutes
    maxMemoryMb: 2_048,                  // 2GB worker ceiling out of 6GB total RAM
    redisTtlSeconds: 3_600,              // Evict completed job states after 1 hour
  },

  // Provider: Cloudflare R2 (10 GB-month, 1M Class A ops, 10M Class B ops)
  r2: {
    maxDirectObjectUploadMb: 25,
    largeArtifactThresholdBytes: 50 * 1024, // Store in R2 only if > 50KB; smaller in DB/memory
    retentionDays: 30,
  },
} as const;

export type FreeTierConfig = typeof FREE_TIER_CONFIG;
