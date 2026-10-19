import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as bars } from "../src/app/api/bars/route";
import { GET as catalogue } from "../src/app/api/contracts/route";
import { getContract, listContracts, pricePrecision } from "../src/lib/market/contracts";
import { fetchBarsDeduplicated } from "../src/lib/market/bars-dedup";
import { fetchInstrument } from "../src/lib/market/instrument";
import { migratePersistedWorkspace } from "../src/stores/workspace";
import { useChartDocuments } from "../src/stores/chart-documents";
import { GET as researchInstrument } from "../src/app/api/research-instrument/route";

test("all static equity/future selections fail closed on every public crypto provider", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No upstream request expected"); };
  try {
    const unsupported = listContracts().filter(c => c.product === "equity" || c.product === "future");
    assert.equal(unsupported.length, 11);
    for (const contract of unsupported) for (const provider of ["gateio", "binance", "bybit", "okx", "coinbase"]) {
      const response = await bars(new NextRequest(`http://localhost/api/bars?provider=${provider}&symbol=${contract.symbol}&tf=5m&bars=2`));
      assert.equal(response.status, 422, `${provider}:${contract.symbol}`);
      const body = await response.json();
      assert.equal(body.dataStatus, "UNAVAILABLE");
      assert.equal(body.bars, undefined);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("venue metadata rejects foreign products and history never retries another venue or simulation", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => { requests.push(String(input)); return Response.json({ name: "ETH_USDT", quanto_multiplier: "1", order_price_round: "0.1" }); };
  try {
    const response = await bars(new NextRequest("http://localhost/api/bars?provider=gateio&symbol=BTCUSDT&bars=7"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).dataStatus, "UNAVAILABLE");
    assert.equal(requests.length, 1);
    assert.ok(requests[0].includes("gateio.ws"));
  } finally { globalThis.fetch = original; }
});

test("chart loader rejects legacy or foreign identity payloads and explicit mock remains usable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ bars: [{ t: 1, o: 10, h: 11, l: 9, c: 10, v: 1 }] });
  try {
    await assert.rejects(fetchBarsDeduplicated("gateio", "ETHUSDT", "1m", 100, 3), /identity/);
    globalThis.fetch = async () => bars(new NextRequest("http://localhost/api/bars?provider=mock&symbol=SPY&tf=1m&bars=3&to=1792300000000"));
    assert.ok((await fetchBarsDeduplicated("mock", "SPY", "1m", 1792300000000, 3)).bars.length > 0);
  } finally { globalThis.fetch = original; }
});

test("unknown and malformed aliases never resolve to Bitcoin", () => {
  for (const symbol of ["", "UNKNOWN", "SPYUSDT", "BTC/USDT", "BTC!USDT", "BINANCE:SPY", "BTCUSDT;DROP"]) {
    assert.throws(() => getContract(symbol), /unsupported|unknown/i, symbol);
  }
  assert.equal(getContract("BTC_USDT").root, "BTC");
  assert.equal(getContract("ETH-USDT").root, "ETH");
});

test("provider ticks preserve non-power-of-ten and scientific decimal precision", () => {
  assert.equal(pricePrecision(0.0025), 4);
  assert.equal(pricePrecision(0.25), 2);
  assert.equal(pricePrecision(1.25e-7), 9);
  assert.equal(pricePrecision(10), 0);
});

test("missing symbols and malformed aliases are rejected before requesting history", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No upstream request expected"); };
  try {
    for (const symbol of ["", "BTC!USDT", "BTC/USDT", "BINANCE:BTCUSDT", "GATEIO:SPY"]) {
      const response = await bars(new NextRequest(`http://localhost/api/bars?provider=gateio&symbol=${encodeURIComponent(symbol)}`));
      assert.equal(response.status, 422);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("research instrument verification rejects all static equities/futures without substituting a crypto market", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No upstream request expected"); };
  try {
    for (const contract of listContracts().filter(c => c.product === "equity" || c.product === "future")) for (const provider of ["gateio", "binance"]) {
      const response = await researchInstrument(new NextRequest(`http://localhost/api/research-instrument?provider=${provider}&symbol=${contract.symbol}`));
      assert.equal(response.status, 422);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("offline catalogue retains all reference markets without claiming verification or connection", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Gateway offline"); };
  try {
    const response = await catalogue();
    const body = await response.json();
    assert.equal(body.state, "unavailable");
    assert.equal(body.verified, false);
    assert.equal(body.contracts.length, 34);
    assert.ok(body.contracts.every((c: { verified?: boolean }) => c.verified === false));
  } finally { globalThis.fetch = original; }
});

test("all original crypto history selections carry matching native contract metadata", async () => {
  const original = globalThis.fetch;
  const contracts = listContracts().filter(c => c.product === "perpetual");
  assert.equal(contracts.length, 23);
  const seen: string[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.includes("/contracts/")) {
      const name = url.pathname.split("/").at(-1)!;
      seen.push(name);
      return Response.json({ name, quanto_multiplier: "0.0001", order_price_round: "0.1", order_size_min: "1", enable_decimal: false });
    }
    assert.equal(url.searchParams.get("contract"), seen.at(-1));
    return Response.json([{ t: url.searchParams.get("from")!, o: "100", h: "102", l: "99", c: "101", v: "3" }]);
  };
  try {
    for (const contract of contracts) {
      const response = await bars(new NextRequest(`http://localhost/api/bars?provider=gateio&symbol=${contract.symbol}&tf=5m&bars=2`));
      assert.equal(response.status, 200, contract.symbol);
      const body = await response.json();
      assert.equal(body.contract.symbol, seen.at(-1));
      assert.equal(body.contract.root, contract.root);
      assert.equal(body.contract.exchange, "GATEIO");
      assert.equal(body.contract.product, "perpetual");
      assert.equal(body.contract.multiplier, 0.0001);
      assert.equal(body.contract.quantityStep, 1);
      assert.equal(body.timestampUnit, "ms");
    }
  } finally { globalThis.fetch = original; }
});

test("every static crypto maps to verified perpetual metadata on Binance, Bybit and OKX", async () => {
  const original = globalThis.fetch;
  const contracts = listContracts().filter(c => c.product === "perpetual");
  try {
    for (const contract of contracts) for (const provider of ["binance", "bybit", "okx"]) {
      const canonical = contract.symbol.replace("_", "");
      const native = `${contract.root}-USDT-SWAP`;
      globalThis.fetch = async input => {
        const url = String(input);
        if (provider === "binance") return Response.json({ symbols: [{ symbol: canonical, contractType: "PERPETUAL", quoteAsset: "USDT", status: "TRADING", filters: [{ filterType: "PRICE_FILTER", tickSize: "0.01" }, { filterType: "LOT_SIZE", stepSize: "0.001" }] }] });
        if (provider === "bybit") {
          assert.ok(url.endsWith(`symbol=${canonical}`));
          return Response.json({ retCode: 0, result: { list: [{ symbol: canonical, contractType: "LinearPerpetual", quoteCoin: "USDT", status: "Trading", priceFilter: { tickSize: "0.01" }, lotSizeFilter: { qtyStep: "0.001" } }] } });
        }
        assert.ok(url.endsWith(`instId=${native}`));
        return Response.json({ code: "0", data: [{ instId: native, instType: "SWAP", ctType: "linear", settleCcy: "USDT", state: "live", ctValCcy: contract.root, ctVal: "0.1", ctMult: "1", tickSz: "0.01", lotSz: "0.001" }] });
      };
      const result = await fetchInstrument(provider, contract.symbol);
      assert.equal(result.root, contract.root);
      assert.equal(result.product, "perpetual");
      assert.equal(result.exchange.toLowerCase(), provider);
      assert.equal(result.symbol, provider === "okx" ? native : canonical);
      assert.equal(result.quantityStep, 0.001);
    }
    globalThis.fetch = async () => Response.json({ code: "0", data: [{ instId: "BTC-USDT-SWAP", instType: "SPOT" }] });
    await assert.rejects(fetchInstrument("okx", "BTCUSDT"), /Unavailable/);
  } finally { globalThis.fetch = original; }
});

test("decimal Gate contracts retain verified history identity without inventing a quantity increment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ name: "ETH_USDT", quanto_multiplier: "0.01", order_price_round: "0.01", order_size_min: "0.1", enable_decimal: true });
  try {
    const contract = await fetchInstrument("gateio", "ETHUSDT");
    assert.equal(contract.verified, true);
    assert.equal(contract.multiplier, 0.01);
    assert.equal(contract.quantityStep, undefined);
  } finally { globalThis.fetch = original; }
});

test("persisted market selections and older drawing documents survive identity correction", async () => {
  const migrated = migratePersistedWorkspace({ symbol: "SPY", workspaces: [{ id: "saved-spy", name: "My market", symbol: "SPY", view: "chart", timeframe: "5m" }] });
  assert.equal(migrated.symbol, "SPY");
  assert.equal(migrated.workspaces?.[0].symbol, "SPY");
  const store = useChartDocuments.getState();
  const oldId = store.ensure({ workspaceId: "identity-fixture", instrument: { provider: "gateio", exchange: "BINANCE", product: "perpetual", nativeSymbol: "BTCUSDT" }, timeframe: "5m" });
  store.createDrawing(oldId, "horizontal-line", [{ time: 1792300000000, price: 100 }]);
  const oldDocument = structuredClone(useChartDocuments.getState().documents[oldId]);
  const correctId = store.ensure({ workspaceId: "identity-fixture", instrument: { provider: "gateio", exchange: "GATEIO", product: "perpetual", nativeSymbol: "BTC_USDT" }, timeframe: "5m" });
  assert.notEqual(oldId, correctId);
  assert.deepEqual(useChartDocuments.getState().documents[oldId], oldDocument);
  assert.equal(useChartDocuments.getState().documents[correctId].drawings.length, 0);
});
