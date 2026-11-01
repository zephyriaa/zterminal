import test from "node:test";
import assert from "node:assert/strict";
import { OKXDepthSynchronizer } from "../src/lib/market/adapters/okx-l2-adapter";
import { OKXFuturesProvider } from "../mini-services/market-data/okx-provider";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocketServer, type WebSocket } from "ws";
import { tradeGranularity, tradeNotional } from "../src/lib/market/trade-units";
import type { DepthEvent, TradeEvent } from "../src/lib/market/types";

const instrument = (extra = {}) => ({ instId: "BTC-USDT-SWAP", instType: "SWAP", ctType: "linear", settleCcy: "USDT", state: "live", ctValCcy: "BTC", ctVal: "0.01", ctMult: "1", tickSz: "0.1", lotSz: "0.01", ...extra });

test("OKX discovery preserves swap contract units and excludes foreign/inactive products", async () => {
  const original = globalThis.fetch, provider = new OKXFuturesProvider();
  globalThis.fetch = async () => Response.json({ code: "0", data: [instrument(), instrument({ instId: "ETH-USDT-SWAP", ctValCcy: "ETH", state: "suspend" }), instrument({ ctType: "inverse" }), instrument({ settleCcy: "USDC" })] });
  try {
    const contracts = await provider.discoverContracts();
    assert.equal(contracts.length, 1);
    assert.equal(contracts[0].symbol, "BTC-USDT-SWAP");
    assert.equal(contracts[0].multiplier, 0.01);
    assert.equal(contracts[0].tickValue, 0.001);
    assert.equal(contracts[0].quantityStep, 0.01);
    globalThis.fetch = async () => Response.json({ code: "0", data: [instrument({ ctVal: "0" })] });
    await assert.rejects(provider.discoverContracts(), /OKX/);
  } finally { provider.close(); globalThis.fetch = original; }
});

test("OKX transport reconstructs modern books, labels aggregate contract trades and recovers on a gap", { timeout: 12000 }, async () => {
  const original = globalThis.fetch, previousUrl = process.env.OKX_WS_URL;
  const http = createServer(), upstream = new WebSocketServer({ server: http });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  process.env.OKX_WS_URL = `ws://127.0.0.1:${(http.address() as { port: number }).port}`;
  globalThis.fetch = async () => Response.json({ code: "0", data: [instrument()] });
  const sockets: WebSocket[] = [], requested: unknown[] = [];
  upstream.on("connection", socket => {
    sockets.push(socket);
    socket.send(JSON.stringify({ event: "notice", code: "64010", msg: "Port retirement notice; connection remains open" }));
    socket.on("message", bytes => { const request = JSON.parse(String(bytes)); for (const arg of request.args) { requested.push(arg); socket.send(JSON.stringify({ event: request.op, arg })); } });
  });
  const provider = new OKXFuturesProvider(), trades: TradeEvent[] = [], books: DepthEvent[] = [];
  provider.on(event => { if (event.type === "trade") trades.push(event.data); if (event.type === "depth") books.push(event.data); });
  const wait = async (check: () => boolean) => { const until = Date.now() + 4000; while (!check()) { if (Date.now() > until) throw Error("OKX fixture timeout"); await new Promise(resolve => setTimeout(resolve, 10)); } };
  const send = (message: unknown) => sockets.at(-1)!.send(JSON.stringify(message));
  const book = (action: string, seqId: number, prevSeqId: number, bids = [["99", "2", "0", "1"]], asks = [["101", "3", "0", "1"]]) => ({ action, arg: { channel: "books", instId: "BTC-USDT-SWAP" }, data: [{ bids, asks, seqId, prevSeqId, checksum: 0, ts: String(Date.now()) }] });
  try {
    await provider.discoverContracts(); await provider.subscribe("BTC-USDT-SWAP");
    await wait(() => requested.length === 2);
    assert.deepEqual(requested, [{ channel: "books", instId: "BTC-USDT-SWAP" }, { channel: "trades", instId: "BTC-USDT-SWAP" }]);
    send(book("snapshot", 100, -1)); await wait(() => books.length === 1);
    send(book("update", 110, 100, [["99", "0", "0", "0"], ["100", "4", "0", "1"]], [])); await wait(() => books.length === 2);
    assert.equal(books[1].levels[0].price, 100);
    send(book("update", 3, 110, [], [])); await wait(() => books.length === 3);
    assert.ok(books[2].sequence > books[1].sequence);
    const print = { instId: "BTC-USDT-SWAP", tradeId: "90071992547409930", seqId: 500, count: "3", px: "100", sz: "2", side: "sell", ts: String(Date.now()) };
    send({ arg: { channel: "trades", instId: print.instId }, data: [print, { ...print, tradeId: "90071992547409931" }] });
    await wait(() => trades.length === 2);
    assert.equal(trades[0].eventId, print.tradeId);
    assert.equal(trades[0].quantityUnit, "contracts");
    assert.equal(trades[0].quantity, 2);
    assert.equal(tradeGranularity(trades[0]), "aggregate");
    assert.equal(tradeNotional(trades[0]), 2);
    assert.equal(provider.health(print.instId).state, "LIVE");
    send({ arg: { channel: "trades", instId: print.instId }, data: [print] });
    send(book("update", 5, 2));
    await wait(() => provider.health(print.instId).depthReady === false);
    await wait(() => sockets.length === 2 && requested.length === 4);
    assert.equal(trades.length, 2);
    assert.equal(provider.health(print.instId).depthReady, false);
    send(book("snapshot", 200, -1)); await wait(() => books.length === 4);
    provider.unsubscribe(print.instId);
    assert.equal(provider.health(print.instId).state, "DISCONNECTED");
  } finally {
    provider.close(); globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.OKX_WS_URL; else process.env.OKX_WS_URL = previousUrl;
    for (const socket of upstream.clients) socket.terminate();
    const closed = once(http, "close"); upstream.close(); http.close(); await closed;
  }
});

test("OKX modern books ignore deprecated zero checksum and enforce sequence links including resets", () => {
  const sync = new OKXDepthSynchronizer("BTC-USDT-SWAP");
  const snapshot = { action: "snapshot" as const, arg: { channel: "books", instId: "BTC-USDT-SWAP" }, data: [{ bids: [["99.0", "2.0"] as [string, string]], asks: [["101.0", "3.0"] as [string, string]], ts: String(Date.now()), prevSeqId: -1, seqId: 100, checksum: 0 }] };
  assert.equal(sync.handleMessage(snapshot), true);
  const update = { ...snapshot, action: "update" as const, data: [{ ...snapshot.data[0], bids: [["99.0", "4.0"] as [string, string]], asks: [], prevSeqId: 100, seqId: 110 }] };
  assert.equal(sync.handleMessage(update), true);
  assert.equal(sync.handleMessage({ ...update, data: [{ ...update.data[0], bids: [], prevSeqId: 110, seqId: 110 }] }), true);
  assert.equal(sync.handleMessage({ ...update, data: [{ ...update.data[0], bids: [], prevSeqId: 110, seqId: 3 }] }), true);
  assert.equal(sync.book.bestBid()?.size, 4);
  assert.equal(sync.handleMessage({ ...update, data: [{ ...update.data[0], prevSeqId: 2, seqId: 4 }] }), false);
  assert.equal(sync.status, "ERROR");
  assert.equal(sync.book.bestBid(), undefined);
  assert.equal(new OKXDepthSynchronizer("BTC-USDT-SWAP").handleMessage({ ...snapshot, data: [{ ...snapshot.data[0], seqId: undefined }] }), false);
});
