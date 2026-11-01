import test from "node:test";
import assert from "node:assert/strict";
import { BybitFuturesProvider } from "../mini-services/market-data/bybit-provider";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocketServer, type WebSocket } from "ws";
import { OrderFlowSession } from "../src/lib/market/order-flow-session";

const contract = (symbol = "BTCUSDT", extra = {}) => ({ symbol, baseCoin: symbol.replace(/USDT$/, ""), quoteCoin: "USDT", settleCoin: "USDT", contractType: "LinearPerpetual", status: "Trading", priceFilter: { tickSize: "0.1" }, lotSizeFilter: { qtyStep: "0.001" }, ...extra });

test("Bybit discovery follows cursors and admits only verified trading USDT linear perpetuals", async () => {
  const original = globalThis.fetch;
  const requested: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input)); requested.push(url);
    return Response.json({ retCode: 0, result: { category: "linear", list: url.searchParams.has("cursor") ? [contract("ETHUSDT")] : [contract(), contract("USDCUSDT", { settleCoin: "USDC" }), contract("FUTUSDT", { contractType: "LinearFutures" }), contract("OLDUSDT", { status: "Delivering" })], nextPageCursor: url.searchParams.has("cursor") ? "" : "next page" } });
  };
  const provider = new BybitFuturesProvider();
  try {
    const contracts = await provider.discoverContracts();
    assert.deepEqual(contracts.map(c => c.symbol), ["BTCUSDT", "ETHUSDT"]);
    assert.equal(requested[1].searchParams.get("cursor"), "next page");
    assert.ok(requested.every(url => url.searchParams.get("category") === "linear"));
    assert.deepEqual(contracts[0], { root: "BTC", symbol: "BTCUSDT", description: "Bybit BTC/USDT Perpetual", exchange: "BYBIT", product: "perpetual", tickSize: 0.1, tickValue: 0.1, multiplier: 1, quantityStep: 0.001, currency: "USDT", session: "crypto", supportsDepth: true, supportsMBO: false, verified: true });
  } finally { provider.close(); globalThis.fetch = original; }
});

test("Bybit discovery does not publish a partial catalogue after a failed page or malformed precision", async () => {
  const original = globalThis.fetch;
  const provider = new BybitFuturesProvider();
  let published = 0;
  provider.on(event => { if (event.type === "contracts") published++; });
  try {
    globalThis.fetch = async input => Response.json(new URL(String(input)).searchParams.has("cursor") ? { retCode: 10006 } : { retCode: 0, result: { category: "linear", list: [contract()], nextPageCursor: "next" } });
    await assert.rejects(provider.discoverContracts(), /Bybit/);
    assert.equal(published, 0);
    assert.deepEqual(provider.contracts(), []);
    globalThis.fetch = async () => Response.json({ retCode: 0, result: { category: "linear", list: [contract("BTCUSDT", { priceFilter: { tickSize: "0" } })] } });
    await assert.rejects(provider.discoverContracts(), /precision|tick/i);
    assert.equal(published, 0);
  } finally { provider.close(); globalThis.fetch = original; }
});

async function waitFor(check: () => boolean, timeoutMs = 4000) {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= until) throw new Error("Timed out waiting for Bybit fixture");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test("Bybit rejects malformed trade identity before retaining it in bounded deduplication", () => {
  const provider = new BybitFuturesProvider();
  const receive = (provider as unknown as { receiveTrades(symbol: string, data: unknown): void }).receiveTrades.bind(provider);
  const trade = { s: "BTCUSDT", i: "valid", seq: 1, T: Date.now(), S: "Buy", p: "100", v: "1" };
  try {
    for (const invalid of [{ i: "x".repeat(129) }, { S: "Unknown" }, { v: "0" }, { p: "NaN" }, { seq: Number.MAX_SAFE_INTEGER + 1 }]) assert.throws(() => receive("BTCUSDT", [{ ...trade, ...invalid }]), /Bybit/);
  } finally { provider.close(); }
});

test("Bybit stream retains distinct trade IDs at one cross sequence and rebuilds L2 through resets/reconnect", { timeout: 20000 }, async context => {
  const original = globalThis.fetch, previousUrl = process.env.BYBIT_WS_URL;
  const http = createServer(); const upstream = new WebSocketServer({ server: http });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  process.env.BYBIT_WS_URL = `ws://127.0.0.1:${(http.address() as { port: number }).port}`;
  globalThis.fetch = async () => Response.json({ retCode: 0, result: { category: "linear", list: [contract()] } });
  const sockets: WebSocket[] = [], requests: { op: string; args?: string[] }[] = [];
  upstream.on("connection", socket => {
    sockets.push(socket);
    socket.on("message", bytes => { const message = JSON.parse(String(bytes)); requests.push(message); socket.send(JSON.stringify({ op: message.op, success: true, req_id: message.req_id })); });
  });
  const provider = new BybitFuturesProvider();
  const session = new OrderFlowSession("bybit", "BTCUSDT", "live");
  const trades: { eventId?: string; sourceSequence?: string; sequence: number; quantity: number; quantityUnit?: string }[] = [];
  const depths: { sequence: number; levels: { price: number; size: number }[] }[] = [];
  provider.on(event => {
    if (event.type === "trade") { trades.push(event.data); session.pushTrade(event.data); }
    if (event.type === "depth") { depths.push(event.data); session.pushDepth(event.data); }
  });
  const send = (payload: unknown) => sockets.at(-1)!.send(JSON.stringify(payload));
  const book = (type: string, u: number, seq: number, b = [["99", "2"]], a = [["101", "3"]]) => ({ topic: "orderbook.50.BTCUSDT", type, ts: Date.now(), data: { s: "BTCUSDT", u, seq, b, a } });
  try {
    await provider.discoverContracts();
    await assert.rejects(provider.subscribe("ETHUSDT"), /unavailable|unsupported/);
    await provider.subscribe("BTCUSDT");
    await waitFor(() => requests.some(request => request.op === "subscribe"));
    assert.deepEqual(requests[0].args, ["orderbook.50.BTCUSDT", "publicTrade.BTCUSDT"]);
    assert.equal(provider.health("BTCUSDT").depthReady, false);
    send(book("delta", 10, 100));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(depths.length, 0);
    send(book("snapshot", 20, 200));
    await waitFor(() => depths.length === 1);
    send(book("delta", 25, 250, [["99", "0"], ["100", "4"]], []));
    await waitFor(() => depths.length === 2);
    assert.deepEqual(depths[1].levels, [{ price: 100, size: 4, side: "buy" }, { price: 101, size: 3, side: "sell" }]);
    const data = ["trade-A", "trade-B"].map(i => ({ i, s: "BTCUSDT", T: Date.now(), S: "Buy", p: "100", v: "0.01", seq: 300, BT: false }));
    send({ topic: "publicTrade.BTCUSDT", type: "snapshot", ts: Date.now(), data });
    await waitFor(() => trades.length === 2);
    send({ topic: "publicTrade.BTCUSDT", type: "snapshot", ts: Date.now(), data });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.deepEqual(trades.map(trade => trade.eventId), ["trade-A", "trade-B"]);
    assert.ok(trades.every(trade => trade.sourceSequence === "300" && trade.quantityUnit === "base"));
    assert.equal(session.trades.length, 2);
    assert.equal(provider.health("BTCUSDT").state, "LIVE");
    context.mock.timers.enable({ apis: ["Date"], now: Date.now() + 16_000 });
    assert.equal(provider.health("BTCUSDT").streams?.trades.state, "STALE");
    assert.equal(provider.health("BTCUSDT").depthReady, false);
    context.mock.timers.reset();
    send(book("snapshot", 1, 1, [["98", "5"]], [["102", "6"]]));
    await waitFor(() => depths.length === 3);
    assert.ok(depths[2].sequence > depths[1].sequence);
    assert.equal(depths[2].levels[0].price, 98);
    sockets.at(-1)!.close();
    await waitFor(() => provider.health("BTCUSDT").depthReady === false);
    await waitFor(() => sockets.length === 2 && requests.filter(request => request.op === "subscribe").length === 2);
    assert.notEqual(provider.health("BTCUSDT").state, "LIVE");
    send(book("snapshot", 2, 2));
    await waitFor(() => depths.length === 4);
    assert.notEqual(provider.health("BTCUSDT").streams?.trades.state, "LIVE");
    send(book("delta", 1, 1));
    await waitFor(() => provider.health("BTCUSDT").depthReady === false);
    await waitFor(() => sockets.length === 3 && requests.filter(request => request.op === "subscribe").length === 3);
    send(book("snapshot", 2, 2, [["98", "2"], ["99", "3"]]));
    await waitFor(() => depths.length === 5);
    send(book("delta", 3, 3, [["99", ""]], []));
    await waitFor(() => provider.health("BTCUSDT").depthReady === false);
    // The third reconnect deliberately backs off 4s; allow acknowledgement time too.
    await waitFor(() => sockets.length === 4 && requests.filter(request => request.op === "subscribe").length === 4, 6000);
    send(book("snapshot", 2, 2));
    await waitFor(() => depths.length === 6);
    send({ topic: "publicTrade.BTCUSDT", data: [{ ...data[0], i: "invalid-size", v: "0" }] });
    await waitFor(() => provider.health("BTCUSDT").depthReady === false);
    assert.equal(trades.length, 2);
    provider.unsubscribe("BTCUSDT");
    assert.equal(provider.health("BTCUSDT").state, "DISCONNECTED");
  } finally {
    provider.close(); session.dispose(); globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.BYBIT_WS_URL; else process.env.BYBIT_WS_URL = previousUrl;
    for (const socket of upstream.clients) socket.terminate();
    const closed = once(http, "close"); upstream.close(); http.close(); await closed;
  }
});
