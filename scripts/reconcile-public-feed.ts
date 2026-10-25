import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { PublicMarketDataProvider } from "../src/lib/market/public-stream";
import { fetchPublicInstrument } from "../src/lib/market/public-data";
import { registerRuntimeContracts } from "../src/lib/market/contracts";
import { OrderFlowSession } from "../src/lib/market/order-flow-session";
import { DEFAULT_ORDER_FLOW_SETTINGS } from "../src/lib/market/order-flow-context";
import { GateOrderBook, type GateBookDelta, type GateBookSnapshot } from "../src/lib/market/gate-order-book";
import { BinanceDepthSynchronizer, type BinanceDepth, type BinanceSnapshot } from "../src/lib/market/public-stream/binance-depth";
import type { DepthEvent, TradeEvent } from "../src/lib/market/types";

// Bounded public-data acceptance check. No account, credentials or orders.
async function main() {
const venue = process.argv[2];
assert.ok(venue === "gateio" || venue === "binance", "Usage: node --import tsx scripts/reconcile-public-feed.ts gateio|binance");
const symbol = venue === "gateio" ? "BTC_USDT" : "BTCUSDT";
const replayFile = process.argv[3];
const directory = resolve("artifacts/feed-reconciliation", `${venue}-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const raw: { receivedAt: number; url: string; body: Record<string, unknown> }[] = [];
const responses: { url: string; body: Record<string, unknown> }[] = [];
if (replayFile) {
  const saved = JSON.parse(readFileSync(replayFile, "utf8"));
  raw.push(...saved.frames); responses.push(...saved.responses);
}
const errors: string[] = [];
let liveAccepted = false;
const nativeSocket = globalThis.WebSocket, nativeFetch = globalThis.fetch;
let capped = false;
globalThis.WebSocket = class extends nativeSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    this.addEventListener("message", event => {
      if (raw.length >= 20000) { capped = true; return; }
      try { raw.push({ receivedAt: Date.now(), url: String(url), body: JSON.parse(String(event.data)) }); }
      catch { /* Non-JSON control frames contain no observations. */ }
    });
  }
};
globalThis.fetch = async (input, init) => {
  if (replayFile) {
    const saved = responses.find(item => item.url === String(input));
    assert.ok(saved, `Missing captured REST response: ${input}`);
    return Response.json(saved.body);
  }
  const response = await nativeFetch(input, init);
  if (response.ok) responses.push({ url: String(input), body: await response.clone().json() });
  return response;
};
const provider = new PublicMarketDataProvider(venue);
const session = new OrderFlowSession(venue, symbol, "live");
const emitted: TradeEvent[] = [];
let depth: DepthEvent | null = null;
let release: (() => void) | undefined;
try {
  const instrument = await fetchPublicInstrument(venue, symbol);
  registerRuntimeContracts([instrument]);
  if (!replayFile) {
  release = provider.subscribe(symbol, event => {
    try {
      if (!("type" in event)) return;
      if (event.type === "trade") { emitted.push(event); session.pushTrade(event); }
      if (event.type === "depth") { depth = event; session.pushDepth(event); }
    } catch (error) { errors.push(String(error)); }
  });
  await setTimeout(30000);
  release(); release = undefined;
  liveAccepted = emitted.length > 0 && depth !== null;
  }
  assert.equal(capped, false, "Capture exceeded its raw-frame bound");
  assert.deepEqual(errors, [], "Ingestion must accept the observed trade/book ledger");
  const snapshots = responses.filter(item => item.url.includes(venue === "gateio" ? "/order_book?" : "/depth?"));
  const snapshot = snapshots.at(-1)?.body;
  assert.ok(snapshot, "Raw bootstrap snapshot must be retained");
  if (!liveAccepted) {
    // Offline replay uses a controlled clock to exercise the parser, while
    // preserving every original exchange timestamp. This is NOT live acceptance.
    emitted.length = 0; session.reset();
    const internal = provider as unknown as { listeners: Map<string, Set<(event: { type?: string } & Partial<TradeEvent>) => void>>; handleMessage(value: unknown): void };
    internal.listeners.set(symbol, new Set([event => { if (event.type === "trade") { emitted.push(event as TradeEvent); session.pushTrade(event as TradeEvent); } }]));
    const wallClock = Date.now;
    const replayClock = Math.max(...raw.map(frame => Math.max(frame.receivedAt, Number(frame.body.E) || 0, Number(frame.body.time_ms) || 0))) + 10000;
    Date.now = () => replayClock;
    try {
      for (const { body } of raw) if (body.e === "aggTrade" || body.channel === "futures.trades") internal.handleMessage(body);
    } finally { Date.now = wallClock; }
    if (venue === "gateio") {
      const book = new GateOrderBook();
      book.bootstrap({ ...snapshot, bids: (snapshot.bids as { p: string; s: string }[]).map(row => [row.p, String(row.s)]), asks: (snapshot.asks as { p: string; s: string }[]).map(row => [row.p, String(row.s)]) } as GateBookSnapshot);
      for (const { body } of raw) if (body.channel === "futures.order_book_update" && body.event === "update") book.apply(body.result as GateBookDelta);
      assert.ok(book.isReady());
      depth = { type: "depth", provider: venue, environment: "live", exchange: "GATEIO", symbol, timestamp: Math.max(...emitted.map(trade => trade.timestamp)), sequence: book.lastSequence(), levels: book.levels(100) };
    } else {
      const sync = new BinanceDepthSynchronizer(); sync.bridge(snapshot as BinanceSnapshot);
      for (const { body } of raw) if (body.e === "depthUpdate") sync.push(body as BinanceDepth);
      assert.equal(sync.status, "LIVE");
      depth = { type: "depth", provider: venue, environment: "live", exchange: "BINANCE", symbol, timestamp: Math.max(...emitted.map(trade => trade.timestamp)), sequence: sync.lastSequence(), levels: [...sync.book.top("buy", 100), ...sync.book.top("sell", 100)] };
    }
    session.pushDepth(depth);
  }
  assert.ok(emitted.length > 0, "No public trades captured");
  assert.ok(depth, "No synchronized two-sided book reconstructed");

  // Independently decode raw wire fields, then reconcile every emitted print.
  const expected = new Map<number, { price: number; quantity: number; side: string; timestamp: number }>();
  for (const { body } of raw) {
    if (venue === "binance" && body.e === "aggTrade") expected.set(Number(body.a), { price: Number(body.p), quantity: Number(body.q), side: body.m === true ? "sell" : "buy", timestamp: Number(body.T) });
    if (venue === "gateio" && body.channel === "futures.trades" && Array.isArray(body.result)) for (const trade of body.result) {
      expected.set(Number(trade.id), { price: Number(trade.price), quantity: Math.abs(Number(trade.size)), side: Number(trade.size) > 0 ? "buy" : "sell", timestamp: trade.create_time_ms == null ? Number(trade.create_time) * 1000 : Number(trade.create_time_ms) });
    }
  }
  for (const trade of emitted) assert.deepEqual({ price: trade.price, quantity: trade.quantity, side: trade.side, timestamp: trade.timestamp }, expected.get(trade.sequence));
  const ordered = [...expected].sort(([a], [b]) => a - b).slice(-2000);
  assert.deepEqual(session.trades.map(trade => trade.sequence), ordered.map(([id]) => id), "No raw trade may disappear from the retained observed window");
  const now = Math.max(depth.timestamp, ...ordered.map(([, trade]) => trade.timestamp));
  const model = session.context({ ...DEFAULT_ORDER_FLOW_SETTINGS, layers: ["cvd", "footprint", "trade-profile", "imbalance", "microprice"], windowSeconds: 900 }, instrument.tickSize, true, true, now);
  const near = (actual: number | undefined | null, wanted: number) => assert.ok(actual != null && Math.abs(actual - wanted) <= 1e-9 * Math.max(1, Math.abs(wanted)), `${actual} != ${wanted}`);
  const buy = ordered.filter(([, trade]) => trade.side === "buy").reduce((sum, [, trade]) => sum + trade.quantity, 0);
  const sell = ordered.filter(([, trade]) => trade.side === "sell").reduce((sum, [, trade]) => sum + trade.quantity, 0);
  near(model.cvd.at(-1)?.value, buy - sell);
  near(model.footprint.reduce((sum, bucket) => sum + bucket.buyVolume, 0), buy);
  near(model.tradeProfile.reduce((sum, level) => sum + level.sellVolume, 0), sell);

  // Reconstruct the final book from its raw REST snapshot and raw absolute updates.
  const finalBook = depth as DepthEvent;
  let sequence = Number(venue === "gateio" ? snapshot.id : snapshot.lastUpdateId);
  const bids = new Map<number, number>(), asks = new Map<number, number>();
  const apply = (target: Map<number, number>, rows: unknown[]) => {
    for (const row of rows) {
      const [price, size] = Array.isArray(row) ? row : [(row as { p: string }).p, (row as { s: string }).s];
      if (Number(size) === 0) target.delete(Number(price)); else target.set(Number(price), Number(size));
    }
  };
  apply(bids, snapshot.bids as unknown[]); apply(asks, snapshot.asks as unknown[]);
  let bridged = false;
  for (const { body } of raw) {
    const update = venue === "gateio" ? body.channel === "futures.order_book_update" ? body.result as Record<string, unknown> : null : body.e === "depthUpdate" ? body : null;
    if (!update || Number(update.u) > finalBook.sequence || Number(update.u) < sequence) continue;
    if (venue === "gateio" && update.full === true) { bids.clear(); asks.clear(); bridged = true; }
    else if (!bridged) {
      const target = sequence + (venue === "gateio" ? 1 : 0);
      if (!(Number(update.U) <= target && Number(update.u) >= target)) continue;
      bridged = true;
    } else {
      if (Number(update.u) <= sequence) continue;
      assert.ok(venue === "gateio" ? Number(update.U) <= sequence + 1 : Number(update.pu) === sequence, "Independent book sequence gap");
    }
    apply(bids, update.b as unknown[]); apply(asks, update.a as unknown[]); sequence = Number(update.u);
  }
  assert.ok(bridged); assert.equal(sequence, finalBook.sequence);
  const sortedBids = [...bids].sort(([a], [b]) => b - a), sortedAsks = [...asks].sort(([a], [b]) => a - b);
  assert.deepEqual(finalBook.levels, [...sortedBids.slice(0, 100).map(([price, size]) => ({ price, size, side: "buy" })), ...sortedAsks.slice(0, 100).map(([price, size]) => ({ price, size, side: "sell" }))]);
  const bidSize = sortedBids.slice(0, 5).reduce((sum, [, size]) => sum + size, 0), askSize = sortedAsks.slice(0, 5).reduce((sum, [, size]) => sum + size, 0);
  near(model.imbalance?.value, (bidSize - askSize) / (bidSize + askSize));
  near(model.microprice?.value, (sortedAsks[0][0] * sortedBids[0][1] + sortedBids[0][0] * sortedAsks[0][1]) / (sortedBids[0][1] + sortedAsks[0][1]));
  writeFileSync(resolve(directory, "summary.json"), JSON.stringify({ status: liveAccepted ? "PASS" : "PARTIAL", liveAccepted, offlineLedgerReconciliation: "PASS", venue, symbol, rawFrames: raw.length, emittedTrades: emitted.length, retainedTrades: ordered.length, bookSequence: sequence, rawFramesSha256: createHash("sha256").update(JSON.stringify(raw)).digest("hex"), scope: "Bounded local capture/replay; not browser, uptime or authoritative historical replay acceptance" }, null, 2));
  console.log(`${liveAccepted ? "PASS" : "PARTIAL (offline only)"} ${venue}: ${emitted.length} trades, ${raw.length} frames, book ${sequence}; ${directory}`);
  if (!liveAccepted) process.exitCode = 1;
} finally {
  release?.(); provider.disconnect(); session.dispose();
  globalThis.WebSocket = nativeSocket; globalThis.fetch = nativeFetch;
  writeFileSync(resolve(directory, "raw.json"), JSON.stringify({ responses, frames: raw }));
}
}

main().catch(error => { console.error(error); process.exitCode = 1; });
