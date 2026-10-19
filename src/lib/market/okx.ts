import { type Bar, type Timeframe } from "./types";
import { normalizeBars } from "./gateio";

export const OKX_REST_URL = "https://www.okx.com/api/v5/market/history-candles";

export const OKX_BAR_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1Dutc",
  "1w": "1Wutc",
};

export function normalizeOkxInstrument(raw: string): string {
  if (/^[A-Z0-9]+-USDT-SWAP$/.test(raw)) return raw;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.endsWith("USDT")) {
    return `${cleaned.slice(0, -4)}-USDT`;
  }
  if (cleaned.endsWith("USD")) {
    return `${cleaned.slice(0, -3)}-USD`;
  }
  return `${cleaned}-USDT`;
}

/** OKX after/before bound candle opens; daily/weekly intervals use UTC. */
export async function fetchOkxHistoricalBars(
  symbolInput: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number,
  fetcher: (input: string | URL, init?: RequestInit) => Promise<Response> = fetch
): Promise<Bar[]> {
  if (!Number.isSafeInteger(fromMs) || !Number.isSafeInteger(toMs) || fromMs > toMs) throw new Error("invalid OKX candle range");
  const instId = normalizeOkxInstrument(symbolInput), bar = OKX_BAR_MAP[timeframe];
  if (!bar) throw new Error("unsupported OKX timeframe");
  const output: Bar[] = [];
  let after = toMs + 1, pages = 0;
  while (after > fromMs) {
    if (++pages > 48) throw new Error("OKX history exceeds 48 pages; reduce the range");
    const url = new URL(OKX_REST_URL);
    for (const [key, value] of Object.entries({ instId, bar, limit: "300", after: String(after), before: String(fromMs - 1) })) url.searchParams.set(key, value);
    const response = await fetcher(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`OKX API returned status ${response.status}`);
    const json = await response.json();
    if (json.code !== "0" || !Array.isArray(json.data)) throw new Error("Invalid OKX history response");
    const page = normalizeBars(json.data.map((item: unknown) => {
      if (!Array.isArray(item) || item.length < 6) throw new Error("invalid OKX candle");
      const [t, o, h, l, c, v] = item.slice(0, 6).map(Number);
      return { t, o, h, l, c, v };
    }));
    if (!page.length) break;
    if (page[0].t >= after) throw new Error("OKX history cursor did not advance");
    output.push(...page);
    after = page[0].t;
    if (page.length < 300) break;
  }
  return normalizeBars(output).filter(bar => bar.t >= fromMs && bar.t <= toMs);
}
