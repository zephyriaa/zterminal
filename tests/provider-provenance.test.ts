import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/bars/route";
import { fetchBarsDeduplicated } from "../src/lib/market/bars-dedup";
import { useWorkspace } from "../src/stores/workspace";
import { acceptsStreamEvent, gatewayMatches } from "../src/lib/market/provenance";
import { GET as contractsRoute } from "../src/app/api/contracts/route";

test("explicit simulation retains its full provenance through the history cache", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return GET(new NextRequest("http://localhost/api/bars?provider=mock&symbol=SPY&tf=1m&bars=2&to=1792300000000")); };
  try {
    const first = await fetchBarsDeduplicated("mock", "SPY", "1m", 1792300000000, 2);
    assert.equal(first.environment, "simulation");
    assert.equal(first.dataStatus, "SIMULATED");
    assert.equal(first.selectedProvider, "mock");
    assert.equal(first.effectiveProvider, "mock");
    assert.equal(first.nativeSymbol, "SPY");
    const cached = await fetchBarsDeduplicated("mock", "SPY", "1m", 1792300000000, 2);
    assert.equal(cached.cache, "memory");
    assert.equal(cached.retrievedAt, first.retrievedAt);
    assert.equal(cached.sourceTimestamp, first.sourceTimestamp);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("history A -> B -> A rejects a cancelled A response and retains B venue/status", async () => {
  const original = globalThis.fetch;
  let finishA!: (response: Response) => void;
  const payload = (provider: string) => ({ symbol: "BTCUSDT", canonicalSymbol: "BTCUSDT", nativeSymbol: provider === "gateio" ? "BTC_USDT" : "BTCUSDT", timeframe: "5m", provider, requestedProvider: provider, selectedProvider: provider, effectiveProvider: provider, environment: "live", dataStatus: "HISTORICAL", timestampUnit: "ms", retrievedAt: 2000000, sourceTimestamp: 900000, requestedFrom: 0, requestedTo: 1500000, requestedCount: 8, gapCount: 4, hasOpenCandle: false, volumeUnit: provider === "gateio" ? "contracts" : "base", integrity: "provider-ohlcv", contract: { symbol: provider === "gateio" ? "BTC_USDT" : "BTCUSDT", root: "BTC", exchange: provider.toUpperCase(), product: "perpetual", tickSize: 0.1, multiplier: 1, currency: "USDT", verified: true }, bars: [{t:900000,o:10,h:11,l:9,c:10,v:1}] });
  globalThis.fetch = async input => String(input).includes("provider=gateio") ? new Promise<Response>(resolve => { finishA = resolve; }) : Response.json(payload("binance"));
  try {
    const abort = new AbortController();
    const first = fetchBarsDeduplicated("gateio", "BTCUSDT", "5m", 1500000, 8, abort.signal);
    abort.abort();
    const b = await fetchBarsDeduplicated("binance", "BTCUSDT", "5m", 1500000, 8);
    finishA(Response.json(payload("gateio")));
    await assert.rejects(first, /abort/i);
    assert.equal(b.effectiveProvider, "binance");
    assert.equal(b.dataStatus, "HISTORICAL");
    const again = await fetchBarsDeduplicated("gateio", "BTCUSDT", "5m", 1500000, 8);
    assert.equal(again.effectiveProvider, "gateio");
    assert.equal(again.retrievedAt, 2000000);
  } finally { globalThis.fetch = original; }
});

test("actual shared gateway subscription filters venues, normalizes aliases and disposes on A -> B -> A", async () => {
  const socketIo = createRequire(import.meta.url)("socket.io-client");
  const original = socketIo.io;
  const handlers = new Map<string, (value?: unknown) => void>();
  const emitted: { name: string; value?: unknown }[] = [];
  let disconnected = 0;
  const socket = { on(name: string, fn: (value?: unknown) => void) { handlers.set(name, fn); return socket; }, emit(name: string, value?: unknown) { emitted.push({name,value}); }, removeAllListeners() { handlers.clear(); }, disconnect() { disconnected++; } };
  socketIo.io = () => socket;
  try {
    const { subscribeMarketTrades } = await import("../src/hooks/use-market-stream");
    useWorkspace.getState().setMarketProvider("gateio");
    const seen: number[] = [];
    const remove = subscribeMarketTrades("BTCUSDT", trade => seen.push(trade.price));
    handlers.get("state")?.({ provider: "gateio", environment: "live", state: "live", dataStatus: "LIVE" });
    const trade = (provider: string, price: number, timestamp = Date.now() + 100) => ({ provider, environment:"live", symbol: provider === "gateio" ? "BTC_USDT" : "BTCUSDT", timestamp, price });
    handlers.get("trade")?.(trade("gateio", 10));
    assert.deepEqual(seen, [10]);
    useWorkspace.getState().setMarketProvider("binance");
    handlers.get("trade")?.(trade("gateio", 20));
    assert.deepEqual(seen, [10]);
    useWorkspace.getState().setMarketProvider("gateio");
    handlers.get("trade")?.(trade("gateio", 30, 1));
    handlers.get("trade")?.(trade("gateio", 40));
    assert.deepEqual(seen, [10,40]);
    for (let i = 0; i < 10; i++) { useWorkspace.getState().setMarketProvider("binance"); useWorkspace.getState().setMarketProvider("gateio"); }
    remove(); remove();
    assert.equal(disconnected, 1);
    assert.equal(handlers.size, 0);
    const count = emitted.length;
    useWorkspace.getState().setMarketProvider("okx");
    assert.equal(emitted.length, count);
    assert.ok(emitted.some(event => event.name === "unsubscribe"));
  } finally { socketIo.io = original; }
});

test("every exposed venue routes history to its selected native market or explains unsupported access", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith("/api/bars")) return GET(new NextRequest(`http://localhost${url}`));
    if (url.includes("gateio.ws") && url.includes("/contracts/")) return Response.json({ name: "BTC_USDT", quanto_multiplier: "0.0001", order_price_round: "0.1", enable_decimal: false });
    if (url.includes("gateio.ws")) return Response.json([{t:"900",o:"10",h:"11",l:"9",c:"10",v:"1"}]);
    if (url.includes("exchangeInfo")) return Response.json({symbols:[{symbol:"BTCUSDT",contractType:"PERPETUAL",quoteAsset:"USDT",status:"TRADING",filters:[{filterType:"PRICE_FILTER",tickSize:"0.1"},{filterType:"LOT_SIZE",stepSize:"0.001"}]}]});
    if (url.includes("binance")) return Response.json([[900000,"10","11","9","10","1"]]);
    if (url.includes("instruments-info")) return Response.json({retCode:0,result:{list:[{symbol:"BTCUSDT",contractType:"LinearPerpetual",quoteCoin:"USDT",status:"Trading",priceFilter:{tickSize:"0.1"},lotSizeFilter:{qtyStep:"0.001"}}]}});
    if (url.includes("bybit")) return Response.json({retCode:0,result:{list:[["900000","10","11","9","10","1"]]}});
    if (url.includes("public/instruments")) return Response.json({code:"0",data:[{instId:"BTC-USDT-SWAP",instType:"SWAP",ctType:"linear",settleCcy:"USDT",state:"live",ctValCcy:"BTC",ctVal:"0.01",tickSz:"0.1",lotSz:"1"}]});
    if (url.includes("okx")) { assert.ok(url.includes("instId=BTC-USDT-SWAP")); return Response.json({code:"0",data:[["900000","10","11","9","10","1"]]}); }
    throw new Error(`Unexpected venue: ${url}`);
  };
  try {
    for (const provider of ["gateio","binance","bybit","okx","coinbase"] as const) {
      useWorkspace.getState().setMarketProvider(provider);
      const selected = useWorkspace.getState().marketProvider;
      if (provider === "coinbase") await assert.rejects(fetchBarsDeduplicated(selected,"BTCUSDT","5m",2000000,11),/No verified/);
      else {
        const history = await fetchBarsDeduplicated(selected,"BTCUSDT","5m",2000000,11);
        assert.equal(history.selectedProvider, provider);
        assert.equal(history.effectiveProvider, provider);
        assert.equal(history.dataStatus, "HISTORICAL");
        assert.equal(history.environment, "live");
        assert.ok(history.retrievedAt > 0);
      }
      assert.ok(requests.some(url => url.startsWith(`/api/bars?provider=${provider}&`)));
    }
    const cached = await GET(new NextRequest("http://localhost/api/bars?provider=gateio&symbol=BTCUSDT&tf=5m&to=2000000&bars=11"));
    assert.equal((await cached.json()).cache, "server");
    globalThis.fetch = async () => Response.json({provider:"gateio",environment:"live",contracts:[{symbol:"BTC_USDT",verified:true}]});
    const foreign = await contractsRoute(new Request("http://localhost/api/contracts?provider=okx"));
    const catalogue = await foreign.json();
    assert.equal(catalogue.provider,"okx");
    assert.equal(catalogue.verified,false);
    assert.equal(catalogue.state,"unavailable");
  } finally { globalThis.fetch = original; }
});

test("gateway provenance refuses implicit simulation and missing or foreign event identity", () => {
  const simulated = {provider:"mock",environment:"simulation",dataStatus:"SIMULATED"} as const;
  const gate = {provider:"gateio",environment:"live",dataStatus:"LIVE"} as const;
  assert.equal(gatewayMatches("gateio", simulated),false);
  assert.equal(gatewayMatches("mock", simulated),true);
  assert.equal(gatewayMatches("okx",gate),false);
  assert.equal(acceptsStreamEvent("gateio",gate,{timestamp:100},50),false);
  assert.equal(acceptsStreamEvent("gateio",gate,{provider:"gateio",environment:"simulation",timestamp:100},50),false);
  assert.equal(acceptsStreamEvent("gateio",gate,{provider:"gateio",environment:"live",timestamp:1},50),false);
  assert.equal(acceptsStreamEvent("gateio",gate,{provider:"gateio",environment:"live",timestamp:100},50),true);
});
