import { describe, expect, it } from "vitest";
import { DEFAULT_TERMINAL_WORKSPACE_PREFERENCES, parseTerminalWorkspacePreferences } from "./terminalPreferences";

describe("terminal cloud workspace preferences", () => {
  it("accepts only the compact non-sensitive terminal preference contract", () => {
    const parsed = parseTerminalWorkspacePreferences({
      ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES,
      symbol: " btc_usdt ",
      watchlist: ["BTC_USDT", "BTC_USDT", "ETH_USDT"],
      activeLayers: ["ema", "ema", "vwap"],
    });

    expect(parsed).toEqual({
      ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES,
      symbol: "BTC_USDT",
      watchlist: ["BTC_USDT", "ETH_USDT"],
      activeLayers: ["ema", "vwap"],
    });
  });

  it("rejects market payloads, credentials, unsupported providers, and malformed symbols", () => {
    expect(parseTerminalWorkspacePreferences({
      ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES,
      symbol: "BTC-USD",
    })).toBeNull();
    expect(parseTerminalWorkspacePreferences({
      ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES,
      activeTapeProvider: "unknown-provider",
    })).toBeNull();
    expect(parseTerminalWorkspacePreferences({
      ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES,
      accessToken: "must-not-persist",
    })).toBeNull();
    expect(parseTerminalWorkspacePreferences({
      ...DEFAULT_TERMINAL_WORKSPACE_PREFERENCES,
      candles: [{ t: 1, c: 1 }],
    })).toBeNull();
  });
});
