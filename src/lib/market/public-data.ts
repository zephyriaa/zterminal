import { fetchInstrument } from "./instrument";
import { fetchGateioHistoricalBars, normalizeGateioSymbol, GATEIO_REST_URL, GateContractSchema, gateContractToMetadata } from "./gateio";
import { fetchBinanceHistoricalBars } from "./binance";
import { chartHistoryRange, normalizeChartBars } from "./chart-data";
import { alignToTimeframe } from "./session";
import { TIMEFRAME_SECONDS, type BarsResult, type ContractMetadata, type Timeframe } from "./types";

const pending = new Map<string, Promise<Response>>();
const cooldowns = new Map<string, number>();
const instruments = new Map<string, { at: number; value: Promise<ContractMetadata> }>();

export async function fetchPublicCatalogue(provider: "gateio" | "binance"): Promise<ContractMetadata[]> {
  const response = await publicFetch(provider === "gateio" ? `${GATEIO_REST_URL}/futures/usdt/contracts` : "https://fapi.binance.com/fapi/v1/exchangeInfo");
  const data = await response.json();
  if (provider === "gateio") {
    if (!Array.isArray(data)) throw new Error("Invalid Gate.io catalogue");
    return data.flatMap(item => {
      const parsed = GateContractSchema.safeParse(item);
      if (!parsed.success || parsed.data.in_delisting) return [];
      const contract = gateContractToMetadata(parsed.data);
      return contract.verified && contract.tickSize > 0 && contract.multiplier > 0 ? [contract] : [];
    });
  }
  if (!Array.isArray(data.symbols)) throw new Error("Invalid Binance catalogue");
  return data.symbols.flatMap((item: { symbol: string; baseAsset: string; quoteAsset: string; contractType: string; status: string; filters: { filterType: string; tickSize?: string; stepSize?: string }[] }) => {
    if (item.contractType !== "PERPETUAL" || item.quoteAsset !== "USDT" || item.status !== "TRADING" || !/^[A-Z0-9]+USDT$/.test(item.symbol)) return [];
    const tickSize = Number(item.filters?.find(f => f.filterType === "PRICE_FILTER")?.tickSize), quantityStep = Number(item.filters?.find(f => f.filterType === "LOT_SIZE")?.stepSize);
    if (![tickSize, quantityStep].every(value => Number.isFinite(value) && value > 0)) return [];
    return [{ root: item.baseAsset, symbol: item.symbol, description: `${item.baseAsset}/USDT perpetual`, exchange: "BINANCE", product: "perpetual", tickSize, tickValue: tickSize, multiplier: 1, quantityStep, currency: "USDT", session: "crypto", supportsDepth: true, supportsMBO: false, verified: true } satisfies ContractMetadata];
  });
}

/** Shared public requests have bounded timeouts and respect venue rate limits. */
export async function publicFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input), key = url.href, until = cooldowns.get(url.origin) ?? 0;
  if (until > Date.now()) throw new Error(`${url.hostname} is rate-limited or unavailable; retry in ${Math.ceil((until - Date.now()) / 1000)} seconds`);
  let request = pending.get(key);
  if (!request) {
    request = fetch(url, { ...init, signal: AbortSignal.timeout(20000) }).then(response => {
      if (response.ok) return response;
      const retry = response.headers.get("retry-after");
      const delay = retry ? Math.max(1000, Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : response.status === 429 ? 30000 : response.status === 418 ? 120000 : 3000;
      cooldowns.set(url.origin, Date.now() + (Number.isFinite(delay) ? delay : 30000));
      void response.body?.cancel();
      throw new Error(`${url.hostname} ${response.status === 429 || response.status === 418 ? "rate-limited" : response.status === 403 || response.status === 451 ? "access restricted" : "request failed"} (HTTP ${response.status}). Retry later or explicitly choose another venue.`);
    }).finally(() => pending.delete(key));
    pending.set(key, request);
  }
  const response = await request;
  init?.signal?.throwIfAborted();
  return response.clone();
}

export async function fetchPublicInstrument(provider: "gateio" | "binance", symbol: string) {
  const normalized = normalizeGateioSymbol(symbol);
  if (!normalized) throw new Error("Unsupported USDT perpetual instrument");
  const key = `${provider}:${normalized}`;
  let entry = instruments.get(key);
  if (!entry || Date.now() - entry.at > 300000) {
    const value = fetchInstrument(provider, symbol, undefined, publicFetch).catch(error => { instruments.delete(key); throw error; });
    entry = { at: Date.now(), value }; instruments.set(key, entry);
    if (instruments.size > 200) instruments.delete(instruments.keys().next().value!);
  }
  return entry.value;
}

/** Public chart history retains the same envelope and exclusive cutoff as /api/bars. */
export async function fetchPublicBars(provider: "gateio" | "binance", symbol: string, timeframe: Timeframe, to: number, count: number): Promise<BarsResult> {
  if (to > Date.now()) throw new Error("Invalid future historical cutoff");
  const range = chartHistoryRange(to, count, timeframe), contract = await fetchPublicInstrument(provider, symbol);
  const fetcher = provider === "gateio" ? fetchGateioHistoricalBars : fetchBinanceHistoricalBars;
  const bars = normalizeChartBars(await fetcher(contract.symbol, timeframe, range.from, range.lastOpen, publicFetch)).filter(bar => bar.t >= range.from && bar.t < to);
  if (!bars.length || bars.some(bar => alignToTimeframe(bar.t, timeframe) !== bar.t)) throw new Error("Selected venue returned no valid aligned history");
  const retrievedAt = Date.now();
  return { symbol, canonicalSymbol: `${contract.root}${contract.currency}`, nativeSymbol: contract.symbol, timeframe, selectedProvider: provider, effectiveProvider: provider,
    environment: "live", dataStatus: "HISTORICAL", contract, retrievedAt, sourceTimestamp: bars.at(-1)?.t ?? null, timestampUnit: "ms", integrity: "provider-ohlcv", cache: "network",
    requestedFrom: range.from, requestedTo: to, requestedCount: count, gapCount: range.expected - bars.length,
    hasOpenCandle: bars.some(bar => bar.t + TIMEFRAME_SECONDS[timeframe] * 1000 > retrievedAt), volumeUnit: provider === "gateio" ? "contracts" : "base", bars };
}
