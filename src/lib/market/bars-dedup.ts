"use client";

import { TIMEFRAME_SECONDS, type BarsResult, type ContractMetadata, type Timeframe } from "./types";
import { registerRuntimeContracts } from "./contracts";
import { normalizeGateioSymbol } from "./gateio";
import { chartHistoryRange, normalizeChartBars } from "./chart-data";
import { alignToTimeframe } from "./session";
import { FREE_TIER_CONFIG } from "../config/free-tier-policy";

const memoryCache = new Map<string, { expiresAt: number; result: BarsResult }>();
const inFlightRequests = new Map<string, Promise<BarsResult>>();

/** Coalesce network work while retaining the original identity and retrieval observation. */
export async function fetchBarsDeduplicated(
  provider: string,
  symbol: string,
  timeframe: Timeframe,
  toMs: number,
  barsCount = 600,
  signal?: AbortSignal,
): Promise<BarsResult> {
  signal?.throwIfAborted();
  const key = `history-range-v3:${provider}:${symbol.toUpperCase()}:${timeframe}:${barsCount}:${toMs}`;
  const cached = memoryCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    registerRuntimeContracts([cached.result.contract]);
    return { ...cached.result, cache: "memory" };
  }
  let pending = inFlightRequests.get(key);
  if (!pending) {
    pending = (async (): Promise<BarsResult> => {
      try {
        const url = `/api/bars?provider=${encodeURIComponent(provider)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&to=${toMs}&bars=${barsCount}`;
        // A caller cancelling must not cancel another consumer of this shared request.
        const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? `Failed to fetch bars: ${response.status}`);
        const contract = json.contract as ContractMetadata | undefined;
        const simulated = provider === "mock" && json.environment === "simulation" && json.dataStatus === "SIMULATED" && json.integrity === "simulated" && contract?.symbol === symbol.toUpperCase();
        const real = json.environment === "live" && ["HISTORICAL", "DELAYED", "STALE", "DEGRADED"].includes(json.dataStatus) && json.integrity === "provider-ohlcv";
        if (json.provider !== provider || json.selectedProvider !== provider || json.effectiveProvider !== provider || json.timeframe !== timeframe || json.timestampUnit !== "ms" || !Number.isFinite(json.retrievedAt) || json.retrievedAt <= 0 || !contract || json.nativeSymbol !== contract.symbol || (!simulated && (!real || !normalizeGateioSymbol(symbol) || contract.product !== "perpetual" || contract.exchange.toLowerCase() !== provider || normalizeGateioSymbol(contract.symbol.replace(/-SWAP$/, "")) !== normalizeGateioSymbol(symbol) || !contract.verified))) throw new Error("Historical instrument identity or provenance is unverified or mismatched. Saved workspaces are unchanged.");
        const bars = normalizeChartBars(json.bars);
        const range = chartHistoryRange(toMs, barsCount, timeframe);
        if (json.requestedFrom !== range.from || json.requestedTo !== toMs || json.requestedCount !== barsCount || bars.some(bar => bar.t < range.from || bar.t >= toMs || alignToTimeframe(bar.t, timeframe) !== bar.t)) throw new Error("Historical range identity or alignment is mismatched");
        if (json.gapCount !== range.expected - bars.length || json.hasOpenCandle !== bars.some(bar => bar.t + TIMEFRAME_SECONDS[timeframe] * 1000 > json.retrievedAt) || json.volumeUnit !== (provider === "mock" ? "simulated" : ["gateio", "okx"].includes(provider) ? "contracts" : "base")) throw new Error("Historical coverage or volume provenance is mismatched");
        if (json.sourceTimestamp !== (bars.at(-1)?.t ?? null)) throw new Error("Historical source timestamp is mismatched");
        const canonicalSymbol = contract.product === "perpetual" ? `${contract.root}${contract.currency}` : contract.symbol;
        if (json.canonicalSymbol !== canonicalSymbol) throw new Error("Historical canonical instrument is mismatched");
        const result: BarsResult = { symbol, canonicalSymbol, nativeSymbol: contract.symbol, timeframe, selectedProvider: provider, effectiveProvider: json.effectiveProvider, environment: json.environment, dataStatus: json.dataStatus, contract, retrievedAt: json.retrievedAt, sourceTimestamp: json.sourceTimestamp, timestampUnit: "ms", integrity: json.integrity, reason: json.reason, cache: json.cache === "server" ? "server" : "network", requestedFrom: json.requestedFrom, requestedTo: json.requestedTo, requestedCount: json.requestedCount, gapCount: json.gapCount, hasOpenCandle: json.hasOpenCandle, volumeUnit: json.volumeUnit, bars };
        if (bars.length) {
          memoryCache.set(key, { expiresAt: Date.now() + FREE_TIER_CONFIG.client.barsMemoryCacheTtlMs, result });
          if (memoryCache.size > 50) memoryCache.delete(memoryCache.keys().next().value!);
        }
        return result;
      } finally { inFlightRequests.delete(key); }
    })();
    inFlightRequests.set(key, pending);
  }
  const result = await pending;
  signal?.throwIfAborted();
  registerRuntimeContracts([result.contract]);
  return result;
}
