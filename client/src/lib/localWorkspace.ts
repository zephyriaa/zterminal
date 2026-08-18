export const LOCAL_TERMINAL_WORKSPACE_KEY = "zterminal-local-workspace-v1";

export type LocalTapeProvider = "gateio" | "binance_usdm" | "bybit_linear" | "coinbase_exchange";
export type LocalTerminalWorkspace = {
  version: 1;
  updatedAt: number;
  symbol: string;
  timeframe: string;
  rangePreset: string;
  activeTapeProvider: LocalTapeProvider;
  activeLayers: string[];
  watchlist: string[];
};

export const DEFAULT_LOCAL_WORKSPACE: Omit<LocalTerminalWorkspace, "updatedAt"> = {
  version: 1,
  symbol: "QQQX_USDT",
  timeframe: "15m",
  rangePreset: "1D",
  activeTapeProvider: "gateio",
  activeLayers: ["vwap", "ema", "profile", "structure"],
  watchlist: ["BTC_USDT", "ETH_USDT", "SOL_USDT", "QQQX_USDT"],
};

function uniqueSymbols(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const symbol = raw.trim().toUpperCase();
    if (/^[A-Z0-9]+_USDT$/.test(symbol)) unique.add(symbol);
    if (unique.size >= 20) break;
  }
  return Array.from(unique);
}

function validProvider(value: unknown): value is LocalTapeProvider {
  return value === "gateio" || value === "binance_usdm" || value === "bybit_linear" || value === "coinbase_exchange";
}

/** Reads only non-sensitive interface preferences from this browser; a malformed value is ignored. */
export function readLocalTerminalWorkspace(storage: Storage | null = typeof window === "undefined" ? null : window.localStorage): LocalTerminalWorkspace | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOCAL_TERMINAL_WORKSPACE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<LocalTerminalWorkspace>;
    const watchlist = uniqueSymbols(candidate.watchlist);
    if (candidate.version !== 1 || typeof candidate.symbol !== "string" || !/^[A-Z0-9]+_USDT$/.test(candidate.symbol) || typeof candidate.timeframe !== "string" || typeof candidate.rangePreset !== "string" || !validProvider(candidate.activeTapeProvider) || !Array.isArray(candidate.activeLayers) || !watchlist.length || typeof candidate.updatedAt !== "number") return null;
    return { version: 1, updatedAt: candidate.updatedAt, symbol: candidate.symbol, timeframe: candidate.timeframe, rangePreset: candidate.rangePreset, activeTapeProvider: candidate.activeTapeProvider, activeLayers: candidate.activeLayers.filter((item): item is string => typeof item === "string").slice(0, 16), watchlist };
  } catch {
    return null;
  }
}

/** Persists only local layout and research-view preferences; market data and account credentials are never written. */
export function writeLocalTerminalWorkspace(value: Omit<LocalTerminalWorkspace, "version" | "updatedAt">, storage: Storage | null = typeof window === "undefined" ? null : window.localStorage, now = Date.now()) {
  if (!storage) return false;
  const symbol = value.symbol.trim().toUpperCase();
  const watchlist = uniqueSymbols(value.watchlist);
  if (!/^[A-Z0-9]+_USDT$/.test(symbol) || !validProvider(value.activeTapeProvider) || !watchlist.length) return false;
  try {
    storage.setItem(LOCAL_TERMINAL_WORKSPACE_KEY, JSON.stringify({ version: 1, updatedAt: now, symbol, timeframe: value.timeframe, rangePreset: value.rangePreset, activeTapeProvider: value.activeTapeProvider, activeLayers: value.activeLayers.slice(0, 16), watchlist } satisfies LocalTerminalWorkspace));
    return true;
  } catch {
    return false;
  }
}

export function addToLocalWatchlist(watchlist: string[], symbol: string) {
  return uniqueSymbols([symbol, ...watchlist]);
}
