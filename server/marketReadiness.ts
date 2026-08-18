import axios from "axios";
import { classifyProviderFailure } from "./marketContracts";

const GATE_TICKERS_URL = "https://api.gateio.ws/api/v4/futures/usdt/tickers";
const READINESS_SYMBOL = "QQQX_USDT";
const CACHE_MS = 15_000;

export type MarketReadiness = {
  status: "READY" | "NOT_READY";
  checkedAt: number;
  provider: "gateio";
  dependency: "public-market-snapshot";
  symbol: string;
  reasonCode: string | null;
  reason: string | null;
};

let cached: { expiresAt: number; value: MarketReadiness } | null = null;

function validTickerPayload(value: unknown): boolean {
  const ticker = Array.isArray(value) ? value[0] : value;
  if (!ticker || typeof ticker !== "object") return false;
  const last = (ticker as Record<string, unknown>).last;
  const parsed = typeof last === "number" ? last : typeof last === "string" ? Number(last) : NaN;
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Readiness is intentionally stricter than process health: the service is only
 * ready for its public market-data role when a bounded Gate.io snapshot probe
 * succeeds. Results are short-lived cached to avoid amplifying dependency load.
 */
export async function getMarketReadiness(now = Date.now()): Promise<MarketReadiness> {
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const response = await axios.get<unknown>(GATE_TICKERS_URL, {
      params: { contract: READINESS_SYMBOL },
      headers: { Accept: "application/json" },
      timeout: 5_000,
      responseType: "json",
    });
    if (!validTickerPayload(response.data)) throw new Error("Gate.io readiness probe returned an invalid ticker payload");
    const value: MarketReadiness = {
      status: "READY",
      checkedAt: now,
      provider: "gateio",
      dependency: "public-market-snapshot",
      symbol: READINESS_SYMBOL,
      reasonCode: null,
      reason: null,
    };
    cached = { expiresAt: now + CACHE_MS, value };
    return value;
  } catch (error) {
    const failure = classifyProviderFailure(error);
    const value: MarketReadiness = {
      status: "NOT_READY",
      checkedAt: now,
      provider: "gateio",
      dependency: "public-market-snapshot",
      symbol: READINESS_SYMBOL,
      reasonCode: failure.reasonCode,
      reason: failure.message,
    };
    cached = { expiresAt: now + CACHE_MS, value };
    return value;
  }
}

export function clearMarketReadinessCache() {
  cached = null;
}
