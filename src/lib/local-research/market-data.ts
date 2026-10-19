import { GATEIO_REST_URL, normalizeGateioSymbol, fetchGateioHistoricalBars, isGateioTimeframe } from "@/lib/market/gateio";
import { BINANCE_FUTURES_REST_URL, normalizeBinanceSymbol, fetchBinanceHistoricalBars } from "@/lib/market/binance";
import { intervalMs, validateDataset, sha256 } from "./dataset";
import type { Dataset, ResearchConfig, ResearchInstrument, ResearchProvider } from "./contracts";

export function nativeResearchSymbol(provider: ResearchProvider, symbol: string): string {
  const native = provider === "gateio" ? normalizeGateioSymbol(symbol) : normalizeBinanceSymbol(symbol);
  if (!native) throw new Error("Enter a provider-native USDT perpetual symbol.");
  return native;
}

/** Public REST fallback for existing Helpers; no gateway or guessed market units. */
export async function publicResearchInstrument(provider: ResearchProvider, input: string, signal?: AbortSignal): Promise<ResearchInstrument> {
  const symbol = nativeResearchSymbol(provider, input);
  const response = await fetch(provider === "gateio" ? `${GATEIO_REST_URL}/futures/usdt/contracts/${symbol}` : `${BINANCE_FUTURES_REST_URL}/fapi/v1/exchangeInfo`, { cache: "no-store", signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]) });
  if (!response.ok) throw new Error(`Instrument metadata unavailable from ${provider} (HTTP ${response.status}). Retry or explicitly choose another venue.`);
  const raw = await response.json();
  let multiplier: number, quantityStep: number, tickSize: number, minimumQuantity: number, minimumNotional: number;
  let makerFeeBps: number | undefined, takerFeeBps: number | undefined;
  if (provider === "gateio") {
    if (raw.name !== symbol || raw.in_delisting !== false || raw.enable_decimal !== false) throw new Error("This Gate contract is delisting or its size precision is unsupported.");
    multiplier = Number(raw.quanto_multiplier); quantityStep = 1; tickSize = Number(raw.order_price_round); minimumQuantity = Number(raw.order_size_min); minimumNotional = 0;
    makerFeeBps = Number(raw.maker_fee_rate) * 10000; takerFeeBps = Number(raw.taker_fee_rate) * 10000;
  } else {
    const contract = raw.symbols?.find((s: { symbol: string }) => s.symbol === symbol);
    if (contract?.contractType !== "PERPETUAL" || contract?.quoteAsset !== "USDT" || contract?.status !== "TRADING") throw new Error("Select an active Binance USDT perpetual.");
    const filters = contract.filters;
    const lot = filters.find((f: { filterType: string }) => f.filterType === "MARKET_LOT_SIZE") ?? filters.find((f: { filterType: string }) => f.filterType === "LOT_SIZE");
    multiplier = 1; quantityStep = Number(lot?.stepSize); minimumQuantity = Number(lot?.minQty);
    tickSize = Number(filters.find((f: { filterType: string }) => f.filterType === "PRICE_FILTER")?.tickSize);
    const minimum = filters.find((f: { filterType: string }) => ["MIN_NOTIONAL", "NOTIONAL"].includes(f.filterType));
    minimumNotional = Number(minimum?.notional ?? minimum?.minNotional ?? 0);
  }
  if (![multiplier, quantityStep, tickSize, minimumQuantity].every(v => Number.isFinite(v) && v > 0) || !Number.isFinite(minimumNotional) || minimumNotional < 0) throw new Error("Provider returned invalid instrument precision.");
  return { provider, symbol, multiplier, quantityStep, tickSize, minimumQuantity, minimumNotional, verifiedAt: Date.now(), source: "browser_public_rest", ...(Number.isFinite(makerFeeBps) ? { makerFeeBps } : {}), ...(Number.isFinite(takerFeeBps) ? { takerFeeBps } : {}) };
}

export function researchRangeIssue(config: Pick<ResearchConfig, "provider" | "timeframe" | "from" | "to">, warmup = 0, now = Date.now()): string | null {
  const interval = intervalMs(config.timeframe), count = (config.to-config.from)/interval + warmup;
  const maximum = config.provider === "gateio" ? 10000 : 100000;
  if (!Number.isInteger(count) || count < 2) return "Choose aligned start/end dates with at least two closed candles.";
  if (count > maximum) return `${count.toLocaleString()} candles including warm-up exceed ${config.provider}'s ${maximum.toLocaleString()}-candle research limit. Shorten the range or choose a larger timeframe.`;
  if (config.provider === "gateio" && config.from-warmup*interval < Math.floor(now/interval)*interval-10000*interval) return "Gate retains only the most recent 10,000 candles at this timeframe. Choose recent dates or explicitly select Binance.";
  return null;
}

export async function publicResearchHistory(config: ResearchConfig, signal: AbortSignal): Promise<Dataset> {
  const symbol = nativeResearchSymbol(config.provider, config.symbol), interval = intervalMs(config.timeframe);
  const timeframe = config.timeframe;
  if (!isGateioTimeframe(timeframe)) throw new Error("Unsupported research timeframe.");
  const issue = researchRangeIssue(config);
  if (issue) throw new Error(issue);
  const fetcher = (url: string | URL, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
  const raw = config.provider === "gateio" ? await fetchGateioHistoricalBars(symbol, timeframe, config.from, config.to-interval, fetcher) : await fetchBinanceHistoricalBars(symbol, timeframe, config.from, config.to-interval, fetcher);
  const bars = validateDataset(raw, config);
  return { version: 1, provider: config.provider, product: "perpetual", symbol, timeframe: config.timeframe, from: config.from, to: config.to, bars, retrievedAt: Date.now(), hash: await sha256(JSON.stringify(bars.map(b => [b.t, b.o, b.h, b.l, b.c, b.v]))) };
}
