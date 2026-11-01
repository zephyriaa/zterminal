import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { io } from "socket.io-client";
import { GET as catalogue } from "../src/app/api/contracts/route";
import { BUILTIN_CONNECTORS } from "../src/lib/market/connectors";
import { getProviderCatalogEntry } from "../src/lib/market/capabilities";

test("Bybit catalogue and capability presentation agree with the serving adapter", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ provider: "bybit", environment: "live", contracts: [{ symbol: "BTCUSDT", exchange: "BYBIT", verified: true }] });
  try {
    const response = await catalogue(new Request("http://localhost/api/contracts?provider=bybit"));
    const body = await response.json();
    assert.equal(body.verified, true);
    assert.equal(body.contracts[0].verified, true);
    assert.equal(getProviderCatalogEntry("bybit")?.streamIntegration, "active");
    assert.deepEqual(getProviderCatalogEntry("bybit")?.capabilities, ["candles", "ticker", "best_bid_offer", "depth", "trades"]);
    assert.deepEqual(BUILTIN_CONNECTORS.find(c => c.id === "bybit")?.capabilities, ["live_trades", "ohlcv", "depth"]);
  } finally { globalThis.fetch = original; }
});

test("actual Bybit gateway discovers, streams matching data and refuses foreign venues", { timeout: 15000 }, async () => {
  let releaseDiscovery: (() => void) | undefined;
  const upstream = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    releaseDiscovery = () => response.end(JSON.stringify({ retCode: 0, result: { category: "linear", list: [{ symbol: "BTCUSDT", baseCoin: "BTC", quoteCoin: "USDT", settleCoin: "USDT", status: "Trading", contractType: "LinearPerpetual", priceFilter: { tickSize: "0.1" }, lotSizeFilter: { qtyStep: "0.001" } }] } }));
  });
  const ws = new WebSocketServer({ server: upstream });
  let upstreamConnections = 0;
  ws.on("connection", socket => {
    const connection = ++upstreamConnections;
    socket.on("message", bytes => {
    const request = JSON.parse(String(bytes));
    socket.send(JSON.stringify({ op: request.op, req_id: request.req_id, success: true }));
    if (request.op !== "subscribe") return;
    socket.send(JSON.stringify({ topic: "orderbook.50.BTCUSDT", type: "snapshot", ts: Date.now(), data: { s: "BTCUSDT", u: 20, seq: 100, b: [["99", "2"]], a: [["101", "3"]] } }));
    socket.send(JSON.stringify({ topic: "publicTrade.BTCUSDT", type: "snapshot", ts: Date.now(), data: [{ s: "BTCUSDT", i: connection === 1 ? "gateway-trade" : `gateway-trade-${connection}`, seq: 200, T: Date.now(), S: "Sell", p: "99", v: "0.1" }] }));
    });
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const port = (upstream.address() as { port: number }).port;
  const child = spawn(process.execPath, ["--import", "tsx", "mini-services/market-data/index.ts"], { env: { ...process.env, MARKET_PROVIDER: "bybit", MARKET_DATA_PORT: "0", BYBIT_REST_URL: `http://127.0.0.1:${port}`, BYBIT_WS_URL: `ws://127.0.0.1:${port}`, NODE_ENV: "test" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const origin = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gateway did not start: ${output}`)), 5000);
    child.stdout.on("data", bytes => { output += String(bytes); const match = output.match(/listening on (\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Gateway exited ${code}`)); });
  });
  const socket = io(origin, { path: "/socket.io", addTrailingSlash: false, transports: ["websocket"], reconnection: false, autoConnect: false });
  const next = (event: string) => new Promise<Record<string, unknown>>(resolve => socket.once(event, resolve));
  try {
    const firstState = next("state"), connected = next("connect");
    socket.connect(); await connected;
    assert.equal((await firstState).provider, undefined, "Do not expose a subscribable provider before discovery finishes");
    const discoveryDeadline = Date.now() + 2000;
    while (!releaseDiscovery && Date.now() < discoveryDeadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(releaseDiscovery);
    const readyState = next("state");
    releaseDiscovery();
    assert.equal((await readyState).provider, "bybit", "Publish provider identity after catalogue initialization");
    const until = Date.now() + 4000;
    let body;
    do { body = await (await fetch(`${origin}/contracts`)).json(); if (body.contracts?.length) break; await new Promise(resolve => setTimeout(resolve, 20)); } while (Date.now() < until);
    assert.equal(body.provider, "bybit"); assert.equal(body.contracts[0].verified, true);
    const wrong = await socket.timeout(2000).emitWithAck("subscribe", { provider: "binance", symbol: "BTCUSDT", types: ["trade"] });
    assert.equal(wrong.ok, false);
    const trade = next("trade"), depth = next("depth"), quote = next("quote");
    const accepted = await socket.timeout(2000).emitWithAck("subscribe", { provider: "bybit", symbol: "BTCUSDT", types: ["trade", "quote", "depth"] });
    assert.equal(accepted.ok, true);
    const [print, book, bbo] = await Promise.all([trade, depth, quote]);
    assert.equal(print.provider, "bybit"); assert.equal(print.eventId, "gateway-trade"); assert.equal(print.quantityUnit, "base");
    assert.equal(book.provider, "bybit"); assert.equal(book.symbol, "BTCUSDT"); assert.equal((book.levels as unknown[]).length, 2);
    assert.equal(bbo.askSize, 3);
    const health = await socket.timeout(2000).emitWithAck("health", { symbol: "BTCUSDT" });
    assert.equal(health.health.state, "LIVE");
    socket.disconnect();
    const releasedBy = Date.now() + 2000;
    while ((await (await fetch(`${origin}/healthz`)).json()).activeSymbols.length && Date.now() < releasedBy) await new Promise(resolve => setTimeout(resolve, 10));

    // Exercise the terminal's actual shared subscription export, not a parallel client abstraction.
    const { useWorkspace } = await import("../src/stores/workspace");
    const { subscribeMarketTrades } = await import("../src/hooks/use-market-stream");
    const previousProvider = useWorkspace.getState().marketProvider, previousOrigin = process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL;
    const observed: string[] = [];
    process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL = origin;
    useWorkspace.getState().setMarketProvider("bybit");
    const remove = subscribeMarketTrades("BTCUSDT", trade => { assert.equal(trade.provider, "bybit"); observed.push(trade.eventId!); });
    try {
      const firstBy = Date.now() + 3000;
      while (!observed.length && Date.now() < firstBy) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(observed.length, 1);
      for (const upstreamSocket of ws.clients) upstreamSocket.close();
      const recoveredBy = Date.now() + 4000;
      while (observed.length < 2 && Date.now() < recoveredBy) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(observed.length, 2);
      assert.notEqual(observed[0], observed[1]);
    } finally {
      remove(); useWorkspace.getState().setMarketProvider(previousProvider);
      if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL; else process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL = previousOrigin;
    }
  } finally {
    socket.disconnect(); child.kill(); await once(child, "exit");
    for (const socket of ws.clients) socket.terminate();
    ws.close(); upstream.close();
  }
});
