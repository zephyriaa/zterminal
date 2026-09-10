import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBybitSymbol, BYBIT_TIMEFRAME_MAP } from "../src/lib/market/bybit";
import { normalizeCoinbaseProduct, COINBASE_GRANULARITY_MAP } from "../src/lib/market/coinbase";
import { normalizeOkxInstrument, OKX_BAR_MAP } from "../src/lib/market/okx";
import { getContract, listContracts } from "../src/lib/market/contracts";
import { useMultiChart } from "../src/stores/multi-chart";

test("Bybit provider normalizes symbols and maps timeframes cleanly", () => {
  assert.equal(normalizeBybitSymbol("BTC_USDT"), "BTCUSDT");
  assert.equal(normalizeBybitSymbol("ETH"), "ETHUSDT");
  assert.equal(normalizeBybitSymbol("SOL-USDT"), "SOLUSDT");
  assert.equal(BYBIT_TIMEFRAME_MAP["1m"], "1");
  assert.equal(BYBIT_TIMEFRAME_MAP["5m"], "5");
  assert.equal(BYBIT_TIMEFRAME_MAP["1h"], "60");
  assert.equal(BYBIT_TIMEFRAME_MAP["1d"], "D");
});

test("Coinbase provider normalizes symbols and maps granularities", () => {
  assert.equal(normalizeCoinbaseProduct("BTCUSDT"), "BTC-USDT");
  assert.equal(normalizeCoinbaseProduct("ETH"), "ETH-USDT");
  assert.equal(normalizeCoinbaseProduct("BTC-USD"), "BTC-USD");
  assert.equal(COINBASE_GRANULARITY_MAP["1m"], 60);
  assert.equal(COINBASE_GRANULARITY_MAP["5m"], 300);
  assert.equal(COINBASE_GRANULARITY_MAP["1h"], 3600);
  assert.equal(COINBASE_GRANULARITY_MAP["1d"], 86400);
});

test("OKX provider normalizes symbols and maps bars", () => {
  assert.equal(normalizeOkxInstrument("BTCUSDT"), "BTC-USDT");
  assert.equal(normalizeOkxInstrument("ETH_USDT"), "ETH-USDT");
  assert.equal(OKX_BAR_MAP["1m"], "1m");
  assert.equal(OKX_BAR_MAP["5m"], "5m");
  assert.equal(OKX_BAR_MAP["1h"], "1H");
  assert.equal(OKX_BAR_MAP["1d"], "1D");
});

test("Contracts catalog includes expanded crypto, equities, and commodities with alias matching", () => {
  const contracts = listContracts();
  assert.ok(contracts.length >= 25, `Expected >= 25 contracts, got ${contracts.length}`);

  // Check top cryptos
  assert.ok(getContract("BTCUSDT"));
  assert.ok(getContract("ETHUSDT"));
  assert.ok(getContract("SOLUSDT"));
  assert.ok(getContract("XRPUSDT"));
  assert.ok(getContract("DOGEUSDT"));
  assert.ok(getContract("SUIUSDT"));
  assert.ok(getContract("PEPEUSDT"));

  // Check equities & commodities
  assert.ok(getContract("SPY"));
  assert.ok(getContract("QQQ"));
  assert.ok(getContract("NVDA"));
  assert.ok(getContract("AAPL"));
  assert.ok(getContract("GLD"));
  assert.ok(getContract("USO"));

  // Check alias normalization
  const btcAlias = getContract("BTC_USDT");
  assert.ok(btcAlias);
  assert.equal(btcAlias.symbol, "BTCUSDT");

  const ethAlias = getContract("ETH-USDT");
  assert.ok(ethAlias);
  assert.equal(ethAlias.symbol, "ETHUSDT");
});

test("Multi-chart store manages layouts, active panes, and symbol linking", () => {
  const store = useMultiChart.getState();
  assert.equal(store.layout, "1");

  // Switch to 4-grid
  store.setLayout("4");
  assert.equal(useMultiChart.getState().layout, "4");

  // Set active pane
  store.setActivePaneIndex(2);
  assert.equal(useMultiChart.getState().activePaneIndex, 2);

  // Update pane symbol
  store.setPaneSymbol(2, "SOLUSDT");
  assert.equal(useMultiChart.getState().panes[2].symbol, "SOLUSDT");

  // Test sync symbol
  if (!useMultiChart.getState().syncSymbol) {
    store.toggleSyncSymbol();
  }
  assert.equal(useMultiChart.getState().syncSymbol, true);

  store.setPaneSymbol(0, "XRPUSDT");
  for (const pane of useMultiChart.getState().panes) {
    assert.equal(pane.symbol, "XRPUSDT");
  }

  // Restore defaults
  store.toggleSyncSymbol();
  store.setLayout("1");
  store.setActivePaneIndex(0);
});
