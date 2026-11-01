/** Opt-in local synthetic transport measurement, not an exchange latency benchmark. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cpus, platform } from "node:os";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { BybitFuturesProvider } from "../mini-services/market-data/bybit-provider";
import { OrderFlowSession } from "../src/lib/market/order-flow-session";

async function main() {
  const originalFetch = globalThis.fetch, originalUrl = process.env.BYBIT_WS_URL;
  const http = createServer(), upstream = new WebSocketServer({ server: http });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  process.env.BYBIT_WS_URL = `ws://127.0.0.1:${(http.address() as { port: number }).port}`;
  globalThis.fetch = async () => Response.json({ retCode: 0, result: { category: "linear", list: [{ symbol: "BTCUSDT", baseCoin: "BTC", quoteCoin: "USDT", settleCoin: "USDT", contractType: "LinearPerpetual", status: "Trading", priceFilter: { tickSize: "0.1" }, lotSizeFilter: { qtyStep: "0.001" } }] } });
  const provider = new BybitFuturesProvider(), session = new OrderFlowSession("bybit", "BTCUSDT", "live");
  let sent = 0, received = 0, depth = 0, batches = 0, pendingPeak = 0, bufferedPeak = 0;
  let producer: ReturnType<typeof setInterval> | undefined;
  const lags: number[] = [], initial = process.memoryUsage();
  let heapPeak = initial.heapUsed, rssPeak = initial.rss;
  provider.on(event => {
    if (event.type === "trade") { received++; lags.push(Date.now() - event.data.timestamp); session.pushTrade(event.data); }
    if (event.type === "depth") { depth++; session.pushDepth(event.data); }
  });
  upstream.on("connection", socket => socket.on("message", bytes => {
    const request = JSON.parse(String(bytes));
    socket.send(JSON.stringify({ op: request.op, req_id: request.req_id, success: true }));
    if (request.op !== "subscribe" || producer) return;
    producer = setInterval(() => {
      const ts = Date.now(), batch = batches++;
      const data = Array.from({ length: 250 }, (_, index) => ({ s: "BTCUSDT", i: `synthetic-${batch}-${index}`, T: ts, seq: batch, S: index % 2 ? "Sell" : "Buy", p: "100", v: "0.001" }));
      sent += data.length;
      socket.send(JSON.stringify({ topic: "publicTrade.BTCUSDT", type: "snapshot", ts, data }));
      for (let index = 0; index < 2; index++) {
        const u = batch * 2 + index + 1;
        socket.send(JSON.stringify({ topic: "orderbook.50.BTCUSDT", type: u === 1 ? "snapshot" : "delta", ts, data: { s: "BTCUSDT", u, seq: u, b: [["99", String(u)]], a: [["101", "2"]] } }));
      }
      pendingPeak = Math.max(pendingPeak, sent - received); bufferedPeak = Math.max(bufferedPeak, socket.bufferedAmount);
      const memory = process.memoryUsage(); heapPeak = Math.max(heapPeak, memory.heapUsed); rssPeak = Math.max(rssPeak, memory.rss);
      if (batches === 100) clearInterval(producer);
    }, 100);
  }));
  const started = performance.now();
  try {
    await provider.discoverContracts(); await provider.subscribe("BTCUSDT");
    const until = Date.now() + 20_000;
    while (Date.now() < until && (batches < 100 || received !== sent || depth < 200)) await new Promise(resolve => setTimeout(resolve, 20));
    const elapsedMs = performance.now() - started;
    assert.equal(received, 25000); assert.equal(sent, received); assert.equal(depth, 200);
    assert.equal(session.trades.length, 2000); assert.equal(session.frames.length, 120);
    const end = process.memoryUsage(); lags.sort((a, b) => a - b);
    console.log(JSON.stringify({ scope: "synthetic loopback WebSocket + Bybit adapter + OrderFlowSession; no vendor latency claim", machine: { platform: platform(), cpu: cpus()[0].model, logicalCpus: cpus().length, node: process.version }, workload: { batches, tradesPerBatch: 250, intervalMs: 100, bookUpdatesPerBatch: 2 }, elapsedMs, sent, received, depth, averageTradesPerSecond: received / (elapsedMs / 1000), localTimestampToHandlerMs: { p50: lags[Math.floor(lags.length * 0.5)], p95: lags[Math.floor(lags.length * 0.95)], max: lags.at(-1) }, peakProducerBacklogTrades: pendingPeak, peakWebSocketBufferedBytes: bufferedPeak, retainedTrades: session.trades.length, retainedDepthFrames: session.frames.length, memoryBytes: { initialHeap: initial.heapUsed, peakHeap: heapPeak, finalHeap: end.heapUsed, initialRss: initial.rss, peakRss: rssPeak, finalRss: end.rss } }));
  } finally {
    if (producer) clearInterval(producer);
    provider.close(); session.dispose(); globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.BYBIT_WS_URL; else process.env.BYBIT_WS_URL = originalUrl;
    for (const socket of upstream.clients) socket.terminate();
    const closed = once(http, "close"); upstream.close(); http.close(); await closed;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
