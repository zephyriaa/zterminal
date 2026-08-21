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

  it("persists workspace modes and restores Focus from a prior saved workspace", () => {
    const storage = memoryStorage();
    expect(writeLocalTerminalWorkspace({ ...DEFAULT_LOCAL_WORKSPACE, workspaceMode: "research" }, storage, 1_700_000_000_002)).toBe(true);
    expect(readLocalTerminalWorkspace(storage)).toEqual(expect.objectContaining({ workspaceMode: "research" }));
    storage.setItem(LOCAL_TERMINAL_WORKSPACE_KEY, JSON.stringify({ ...DEFAULT_LOCAL_WORKSPACE, updatedAt: 1_700_000_000_003, workspaceMode: undefined }));
    expect(readLocalTerminalWorkspace(storage)).toEqual(expect.objectContaining({ workspaceMode: "focus" }));
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
