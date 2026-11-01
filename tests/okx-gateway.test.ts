import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { io } from "socket.io-client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { FeedInspector } from "../src/components/terminal/feed-inspector";
import { GET as catalogue } from "../src/app/api/contracts/route";
import { GET as getBars } from "../src/app/api/bars/route";
import { getProviderCatalogEntry } from "../src/lib/market/capabilities";
import { BUILTIN_CONNECTORS } from "../src/lib/market/connectors";
import { fetchInstrument } from "../src/lib/market/instrument";

test("OKX catalogue and UI advertise the implemented aggregate stream", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/v5/public/instruments")) {
      return Response.json({
        code: "0",
        data: [{ instId: "BTC-USDT-SWAP", instType: "SWAP", ctType: "linear", settleCcy: "USDT", state: "live", ctValCcy: "BTC", ctVal: "0.01", ctMult: "1", tickSz: "0.1", lotSz: "0.01" }],
      });
    }
    if (url.includes("/api/v5/market/history-candles")) {
      return Response.json({
        code: "0",
        data: [["1700000040000", "35000", "35100", "34900", "35050", "120", "1.2", "42060", "1"]],
      });
    }
    return Response.json({ provider: "okx", environment: "live", contracts: [{ symbol: "BTC-USDT-SWAP", verified: true }] });
  };
  try {
    const result = await (await catalogue(new Request("http://localhost/api/contracts?provider=okx"))).json();
    assert.equal(result.verified, true);
    assert.equal(getProviderCatalogEntry("okx")?.streamIntegration, "active");
    assert.deepEqual(getProviderCatalogEntry("okx")?.capabilities, ["candles", "ticker", "best_bid_offer", "depth", "trades", "aggregate_trades"]);
    assert.ok(BUILTIN_CONNECTORS.some(connector => connector.id === "okx"));
    assert.match(renderToStaticMarkup(createElement(FeedInspector, { provider: "okx", dataStatus: "LIVE", health: null })), /Aggregate public trades/);
    const instrument = await fetchInstrument("okx", "BTC-USDT-SWAP");
    assert.equal(instrument.symbol, "BTC-USDT-SWAP");
    assert.equal(instrument.multiplier, 0.01);
    const barsResponse = await getBars(new NextRequest("http://localhost/api/bars?provider=okx&symbol=BTC-USDT-SWAP&tf=1m&bars=1&to=1700000100000"));
    assert.equal(barsResponse.status, 200);
    const barsPayload = await barsResponse.json();
    assert.equal(barsPayload.bars.length, 1);
  } finally { globalThis.fetch = original; }
});

test("actual OKX gateway serves validated swap metadata and canonical aggregate contract events", { timeout: 15000 }, async () => {
  const upstream = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ code: "0", data: [{ instId: "BTC-USDT-SWAP", instType: "SWAP", ctType: "linear", settleCcy: "USDT", state: "live", ctValCcy: "BTC", ctVal: "0.01", ctMult: "1", tickSz: "0.1", lotSz: "0.01" }] }));
  });
  const ws = new WebSocketServer({ server: upstream });
  ws.on("connection", socket => socket.on("message", bytes => {
    const request = JSON.parse(String(bytes));
    for (const arg of request.args) socket.send(JSON.stringify({ event: request.op, arg }));
    if (request.op !== "subscribe") return;
    socket.send(JSON.stringify({ action: "snapshot", arg: { channel: "books", instId: "BTC-USDT-SWAP" }, data: [{ bids: [["99", "2", "0", "1"]], asks: [["101", "3", "0", "1"]], seqId: 10, prevSeqId: -1, checksum: 0, ts: String(Date.now()) }] }));
    socket.send(JSON.stringify({ arg: { channel: "trades", instId: "BTC-USDT-SWAP" }, data: [{ instId: "BTC-USDT-SWAP", tradeId: "90071992547409930", px: "100", sz: "2", side: "buy", count: "2", seqId: 20, ts: String(Date.now()) }] }));
  }));
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const port = (upstream.address() as { port: number }).port;
  const child = spawn(process.execPath, ["--import", "tsx", "mini-services/market-data/index.ts"], { env: { ...process.env, MARKET_PROVIDER: "okx", MARKET_DATA_PORT: "0", OKX_PUBLIC_REST_URL: `http://127.0.0.1:${port}`, OKX_WS_URL: `ws://127.0.0.1:${port}`, NODE_ENV: "test" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let socket: ReturnType<typeof io> | undefined;
  try {
    const origin = await new Promise<string>((resolve, reject) => {
      let output = ""; const timer = setTimeout(() => reject(Error("OKX gateway startup timed out")), 5000);
      child.stdout.on("data", bytes => { output += String(bytes); const match = output.match(/listening on (\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } });
      child.once("exit", code => { clearTimeout(timer); reject(Error(`OKX gateway exited ${code}`)); });
    });
    const until = Date.now() + 3000;
    let body;
    do { body = await (await fetch(`${origin}/contracts`)).json(); if (body.contracts?.length) break; await new Promise(resolve => setTimeout(resolve, 10)); } while (Date.now() < until);
    assert.equal(body.provider, "okx"); assert.equal(body.contracts[0].multiplier, 0.01);
    socket = io(origin, { path: "/socket.io", addTrailingSlash: false, transports: ["websocket"], autoConnect: false, reconnection: false });
    const next = (event: string) => new Promise<Record<string, unknown>>(resolve => socket!.once(event, resolve));
    const connected = next("connect"); socket.connect(); await connected;
    assert.equal((await socket.timeout(2000).emitWithAck("subscribe", { provider: "bybit", symbol: "BTCUSDT" })).ok, false);
    const print = next("trade"), book = next("depth"), quote = next("quote");
    assert.equal((await socket.timeout(2000).emitWithAck("subscribe", { provider: "okx", symbol: "BTC-USDT-SWAP", types: ["trade", "depth", "quote"] })).ok, true);
    const [trade, depth, bbo] = await Promise.all([print, book, quote]);
    assert.equal(trade.eventId, "90071992547409930"); assert.equal(trade.quantityUnit, "contracts"); assert.equal(trade.contractMultiplier, 0.01);
    assert.deepEqual(trade.conditions, ["aggregate-trade", "aggregate-count:2"]);
    assert.equal(depth.provider, "okx"); assert.equal(bbo.askSize, 3);
    assert.equal((await socket.timeout(2000).emitWithAck("health", { symbol: "BTC-USDT-SWAP" })).health.state, "LIVE");
  } finally {
    socket?.disconnect(); const exited = once(child, "exit"); child.kill(); await exited;
    for (const socket of ws.clients) socket.terminate(); ws.close(); upstream.close();
  }
});
