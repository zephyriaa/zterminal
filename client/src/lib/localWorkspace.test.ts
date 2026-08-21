import { describe, expect, it } from "vitest";
import { addToLocalWatchlist, DEFAULT_LOCAL_WORKSPACE, LOCAL_TERMINAL_WORKSPACE_KEY, readLocalTerminalWorkspace, writeLocalTerminalWorkspace } from "./localWorkspace";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("local terminal workspace", () => {
  it("persists only versioned interface preferences and a normalized watchlist", () => {
    const storage = memoryStorage();
    const saved = writeLocalTerminalWorkspace({ ...DEFAULT_LOCAL_WORKSPACE, symbol: "btc_usdt", watchlist: ["btc_usdt", "ETH_USDT", "BTC_USDT", "invalid"] }, storage, 1_700_000_000_000);
    expect(saved).toBe(true);
    expect(readLocalTerminalWorkspace(storage)).toEqual(expect.objectContaining({ symbol: "BTC_USDT", updatedAt: 1_700_000_000_000, watchlist: ["BTC_USDT", "ETH_USDT"] }));
  });

  it("persists bounded floating panel geometry without retaining market data or credentials", () => {
    const storage = memoryStorage();
    const panelLayout = { ...DEFAULT_LOCAL_WORKSPACE.panelLayout, chart: { ...DEFAULT_LOCAL_WORKSPACE.panelLayout.chart, x: 10, y: 12, width: 60, height: 70, z: 9 } };
    expect(writeLocalTerminalWorkspace({ ...DEFAULT_LOCAL_WORKSPACE, panelLayout }, storage, 1_700_000_000_001)).toBe(true);
    expect(readLocalTerminalWorkspace(storage)?.panelLayout.chart).toMatchObject({ x: 10, y: 12, width: 60, height: 70, z: 9 });
  });

  it("falls back to the default floating layout when legacy local preferences have no panel geometry", () => {
    const storage = memoryStorage({ [LOCAL_TERMINAL_WORKSPACE_KEY]: JSON.stringify({ version: 1, symbol: "BTC_USDT", timeframe: "15m", rangePreset: "1D", activeTapeProvider: "gateio", activeLayers: [], watchlist: ["BTC_USDT"], updatedAt: 1 }) });
    expect(readLocalTerminalWorkspace(storage)?.panelLayout).toEqual(DEFAULT_LOCAL_WORKSPACE.panelLayout);
  });

  it("persists a Coinbase Exchange tape preference without retaining market data or credentials", () => {
    const storage = memoryStorage();
    expect(writeLocalTerminalWorkspace({ ...DEFAULT_LOCAL_WORKSPACE, activeTapeProvider: "coinbase_exchange" }, storage, 1_700_000_000_001)).toBe(true);
    expect(readLocalTerminalWorkspace(storage)).toEqual(expect.objectContaining({ activeTapeProvider: "coinbase_exchange" }));
  });

  it("rejects malformed or unsupported stored data instead of restoring an ambiguous workspace", () => {
    const storage = memoryStorage({ [LOCAL_TERMINAL_WORKSPACE_KEY]: JSON.stringify({ version: 1, symbol: "BTC_USDT", activeTapeProvider: "private_exchange", activeLayers: [], watchlist: ["BTC_USDT"], updatedAt: 1 }) });
    expect(readLocalTerminalWorkspace(storage)).toBeNull();
  });

  it("adds a current market without duplicating watchlist symbols", () => {
    expect(addToLocalWatchlist(["ETH_USDT", "BTC_USDT"], "btc_usdt")).toEqual(["BTC_USDT", "ETH_USDT"]);
  });
});
