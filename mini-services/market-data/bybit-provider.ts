import WebSocket from "ws";
import type { ContractMetadata, DepthEvent, FeedHealth, QuoteEvent, TradeEvent } from "../../src/lib/market/types";
import { LocalOrderBook } from "../../src/lib/market/public-stream/local-book";
import type { ProviderStatus } from "./gateio-provider";

export type BybitEvent =
  | { type: "contracts"; contracts: ContractMetadata[] }
  | { type: "status"; symbol?: string; state: ProviderStatus; reason?: string; updatedAt: number }
  | { type: "trade"; data: TradeEvent }
  | { type: "quote"; data: QuoteEvent }
  | { type: "depth"; data: DepthEvent };

function positive(value: unknown, label: string) {
  const parsed = (typeof value === "string" && value.trim()) || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid Bybit ${label}`);
  return parsed;
}

/** Public, read-only linear perpetual data; no account or execution endpoints. */
export class BybitFuturesProvider {
  readonly id = "bybit" as const;
  readonly environment = "live" as const;
  private contractsBySymbol = new Map<string, ContractMetadata>();
  private listeners = new Set<(event: BybitEvent) => void>();
  private symbols = new Set<string>();
  private books = new Map<string, { book: LocalOrderBook; update: number; cross: number; fingerprint: string }>();
  private lastTradeAt = new Map<string, number>();
  private lastDepthAt = new Map<string, number>();
  private tradeIds = new Map<string, Set<string>>();
  private healthStates = new Map<string, string>();
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private retries = 0;
  private sequence = 0;
  private requestId = 0;
  private lastMessageAt = 0;
  private pending = new Map<string, number>();

  on(listener: (event: BybitEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  contracts() { return [...this.contractsBySymbol.values()]; }
  private emit(event: BybitEvent) { for (const listener of this.listeners) listener(event); }

  health(symbol: string): FeedHealth {
    const now = Date.now(), connected = this.ws?.readyState === WebSocket.OPEN && this.symbols.has(symbol);
    const tradeAt = this.lastTradeAt.get(symbol), depthAt = this.lastDepthAt.get(symbol);
    const tradeState = !connected ? "DISCONNECTED" : !tradeAt ? "SYNCING" : now - tradeAt > 15_000 ? "STALE" : "LIVE";
    const depthReady = connected && this.books.has(symbol) && Boolean(depthAt && now - depthAt <= 15_000);
    const depthState = !connected ? "DISCONNECTED" : !this.books.has(symbol) ? "SYNCING" : !depthReady ? "STALE" : "LIVE";
    const state = !connected ? "DISCONNECTED" : tradeState === "LIVE" && depthState === "LIVE" ? "LIVE" : tradeState === "STALE" || depthState === "STALE" ? "STALE" : "SYNCING";
    return { provider: "bybit", symbol, state, updatedAt: now, lastMessageAt: Math.max(tradeAt ?? 0, depthAt ?? 0) || undefined, lastDepthAt: depthAt, depthReady, reconnectCount: this.retries, streams: { trades: { state: tradeState, lastMessageAt: tradeAt }, depth: { state: depthState, lastMessageAt: depthAt } }, reason: state === "LIVE" ? undefined : "Waiting for fresh Bybit trades and a valid L2 snapshot" };
  }

  private notifyHealth(symbol: string) {
    const health = this.health(symbol), key = `${health.streams!.trades.state}:${health.streams!.depth.state}`;
    if (this.healthStates.get(symbol) === key) return;
    this.healthStates.set(symbol, key);
    const state: ProviderStatus = health.state === "LIVE" ? "live" : health.state === "STALE" ? "stale" : this.ws?.readyState === WebSocket.OPEN ? "degraded" : "reconnecting";
    this.emit({ type: "status", symbol, state, reason: health.reason, updatedAt: Date.now() });
  }

  async subscribe(symbol: string) {
    if (this.closed) throw new Error("Bybit provider is closed");
    if (!this.contractsBySymbol.has(symbol)) throw new Error(`Unsupported or unavailable Bybit perpetual: ${symbol}`);
    if (this.symbols.has(symbol)) return;
    this.symbols.add(symbol);
    if (!this.ws) this.connect();
    else if (this.ws.readyState === WebSocket.OPEN) this.sendSubscription("subscribe", symbol);
  }

  unsubscribe(symbol: string) {
    this.sendSubscription("unsubscribe", symbol);
    this.symbols.delete(symbol); this.books.delete(symbol); this.lastTradeAt.delete(symbol); this.lastDepthAt.delete(symbol); this.tradeIds.delete(symbol); this.healthStates.delete(symbol);
    if (!this.symbols.size) this.disconnect();
  }

  close() { this.closed = true; this.disconnect(); this.symbols.clear(); this.listeners.clear(); }

  private disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.timer) clearInterval(this.timer);
    this.reconnectTimer = null; this.timer = null;
    const socket = this.ws; this.ws = null;
    socket?.terminate();
    this.books.clear(); this.lastTradeAt.clear(); this.lastDepthAt.clear(); this.pending.clear(); this.healthStates.clear();
  }

  private sendSubscription(op: "subscribe" | "unsubscribe", symbol: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const req_id = String(++this.requestId);
    this.pending.set(req_id, Date.now());
    this.ws.send(JSON.stringify({ op, req_id, args: [`orderbook.50.${symbol}`, `publicTrade.${symbol}`] }));
  }

  private connect() {
    if (this.closed || !this.symbols.size || this.ws || this.reconnectTimer) return;
    // https://bybit-exchange.github.io/docs/v5/ws/connect
    const socket = this.ws = new WebSocket(process.env.BYBIT_WS_URL ?? "wss://stream.bybit.com/v5/public/linear", { handshakeTimeout: 10_000, maxPayload: 2 * 1024 * 1024 });
    socket.on("open", () => {
      if (this.ws !== socket) return;
      this.lastMessageAt = Date.now();
      for (const symbol of this.symbols) this.sendSubscription("subscribe", symbol);
      let pingAt = Date.now();
      this.timer = setInterval(() => {
        if (this.ws !== socket) return;
        const now = Date.now();
        if (now - this.lastMessageAt > 45_000 || [...this.pending.values()].some(at => now - at > 10_000)) { socket.terminate(); return; }
        if (now - pingAt >= 20_000) { socket.send(JSON.stringify({ op: "ping" })); pingAt = now; }
        for (const symbol of this.symbols) this.notifyHealth(symbol);
      }, 1000);
    });
    socket.on("message", bytes => {
      if (this.ws !== socket) return;
      this.lastMessageAt = Date.now();
      try { this.receive(JSON.parse(String(bytes))); }
      catch { this.books.clear(); this.lastDepthAt.clear(); for (const symbol of this.symbols) this.notifyHealth(symbol); socket.terminate(); }
    });
    socket.on("error", () => { if (this.ws === socket) socket.terminate(); });
    socket.on("close", () => {
      if (this.ws !== socket) return;
      this.disconnect();
      for (const symbol of this.symbols) this.notifyHealth(symbol);
      if (!this.closed && this.symbols.size) {
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.retries++, 5));
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, delay);
      }
    });
  }

  private receive(message: Record<string, unknown>) {
    if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("Invalid Bybit message");
    if (message.op) {
      if (message.success === false) throw new Error("Bybit subscription rejected");
      if (typeof message.req_id === "string") this.pending.delete(message.req_id);
      return;
    }
    if (typeof message.topic !== "string") return;
    const [channel, ...parts] = message.topic.split(".");
    const symbol = parts.at(-1)!;
    if (!this.symbols.has(symbol)) return;
    if (channel === "publicTrade") this.receiveTrades(symbol, message.data);
    else if (message.topic === `orderbook.50.${symbol}`) this.receiveBook(symbol, message);
  }

  private receiveTrades(symbol: string, data: unknown) {
    if (!Array.isArray(data) || data.length > 1024) throw new Error("Invalid Bybit trades");
    const ids = this.tradeIds.get(symbol) ?? new Set<string>();
    for (const trade of data) {
      if (!trade || trade.s !== symbol || typeof trade.i !== "string" || !trade.i || trade.i.length > 128 || !["Buy", "Sell"].includes(trade.S)) throw new Error("Invalid Bybit trade identity");
      const price = positive(trade.p, "trade price"), quantity = positive(trade.v, "trade size"), timestamp = positive(trade.T, "trade timestamp");
      if (!Number.isSafeInteger(timestamp) || timestamp > Date.now() + 60_000 || !Number.isSafeInteger(trade.seq) || trade.seq < 0) throw new Error("Invalid Bybit trade sequence or time");
      if (ids.has(trade.i)) continue;
      // ponytail: retain 4,096 IDs per symbol; durable replay needs persistent identity storage.
      ids.add(trade.i); if (ids.size > 4096) ids.delete(ids.values().next().value!);
      this.tradeIds.set(symbol, ids);
      this.lastTradeAt.set(symbol, timestamp); this.notifyHealth(symbol);
      // Delivery sequence is local; preserve UUID and cross-sequence separately.
      this.emit({ type: "trade", data: { type: "trade", provider: "bybit", environment: "live", exchange: "BYBIT", symbol, timestamp, sequence: ++this.sequence, eventId: trade.i, sourceSequence: String(trade.seq), price, quantity, side: trade.S === "Buy" ? "buy" : "sell", quantityUnit: "base", contractMultiplier: 1, conditions: ["raw-trade", ...(trade.BT ? ["block-trade"] : []), ...(trade.RPI ? ["rpi-trade"] : [])] } });
    }
  }

  private receiveBook(symbol: string, message: Record<string, unknown>) {
    // Standard depth semantics, not the separate full-depth bootstrap protocol:
    // https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook
    const data = message.data as { s: string; u: number; seq: number; b: unknown[]; a: unknown[] };
    if (!data || data.s !== symbol || !Number.isSafeInteger(data.u) || data.u < 1 || !Number.isSafeInteger(data.seq) || data.seq < 0 || !Array.isArray(data.b) || !Array.isArray(data.a) || data.b.length > 1000 || data.a.length > 1000) throw new Error("Invalid Bybit book");
    const timestamp = positive(message.ts, "book timestamp");
    if (!Number.isSafeInteger(timestamp) || timestamp > Date.now() + 60_000) throw new Error("Invalid Bybit book timestamp");
    const previous = this.books.get(symbol), fingerprint = JSON.stringify(data);
    if (message.type !== "snapshot" && message.type !== "delta") throw new Error("Invalid Bybit book type");
    if (message.type === "delta" && !previous) return;
    if (previous && message.type === "delta") {
      if (data.u === 1) throw new Error("Bybit reset requires snapshot");
      if (data.u < previous.update || data.seq < previous.cross) return;
      if (data.u === previous.update) {
        if (fingerprint !== previous.fingerprint) throw new Error("Conflicting Bybit update");
        return;
      }
    }
    const book = message.type === "snapshot" ? new LocalOrderBook() : previous!.book;
    for (const [side, levels] of [["buy", data.b], ["sell", data.a]] as const) for (const level of levels) {
      if (!Array.isArray(level) || level.length !== 2 || typeof level[0] !== "string" || typeof level[1] !== "string" || !level[0].trim() || !level[1].trim()) throw new Error("Invalid Bybit book level");
      book.apply(side, level[0], level[1]);
    }
    if (!book.bestBid() || !book.bestAsk() || book.isCrossed()) throw new Error("Unavailable Bybit book");
    const bids = book.top("buy", 50), asks = book.top("sell", 50), bounded = new LocalOrderBook();
    for (const level of [...bids, ...asks]) bounded.apply(level.side, String(level.price), level.size);
    this.books.set(symbol, { book: bounded, update: data.u, cross: data.seq, fingerprint });
    this.lastDepthAt.set(symbol, timestamp); this.notifyHealth(symbol);
    const sequence = ++this.sequence;
    this.emit({ type: "depth", data: { type: "depth", provider: "bybit", environment: "live", exchange: "BYBIT", symbol, timestamp, sequence, sourceSequence: String(data.u), levels: [...bids, ...asks] } });
    this.emit({ type: "quote", data: { type: "quote", provider: "bybit", environment: "live", exchange: "BYBIT", symbol, timestamp, sequence, bid: bids[0].price, bidSize: bids[0].size, ask: asks[0].price, askSize: asks[0].size } });
  }

  async discoverContracts() {
    const contracts = new Map<string, ContractMetadata>();
    const cursors = new Set<string>();
    let cursor = "";
    // Official pagination: https://bybit-exchange.github.io/docs/v5/market/instrument
    do {
      if (cursors.has(cursor) || cursors.size >= 100) throw new Error("Invalid Bybit catalogue pagination");
      cursors.add(cursor);
      const url = new URL("/v5/market/instruments-info", process.env.BYBIT_REST_URL ?? "https://api.bybit.com");
      url.searchParams.set("category", "linear"); url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Bybit instrument discovery failed (${response.status})`);
      const payload = await response.json();
      if (payload?.retCode !== 0 || payload.result?.category !== "linear" || !Array.isArray(payload.result.list)) throw new Error("Invalid Bybit instrument response");
      for (const item of payload.result.list) {
        if (item?.status !== "Trading" || item.contractType !== "LinearPerpetual" || item.quoteCoin !== "USDT" || item.settleCoin !== "USDT") continue;
        if (typeof item.baseCoin !== "string" || !/^[A-Z0-9]+$/.test(item.baseCoin) || item.symbol !== `${item.baseCoin}USDT`) throw new Error("Invalid Bybit instrument identity");
        const tickSize = positive(item.priceFilter?.tickSize, "tick precision");
        const quantityStep = positive(item.lotSizeFilter?.qtyStep, "quantity precision");
        const contract: ContractMetadata = { root: item.baseCoin, symbol: item.symbol, description: `Bybit ${item.baseCoin}/USDT Perpetual`, exchange: "BYBIT", product: "perpetual", tickSize, tickValue: tickSize, multiplier: 1, quantityStep, currency: "USDT", session: "crypto", supportsDepth: true, supportsMBO: false, verified: true };
        if (contracts.has(contract.symbol)) throw new Error("Duplicate Bybit instrument");
        contracts.set(contract.symbol, contract);
      }
      cursor = payload.result.nextPageCursor ?? "";
      if (typeof cursor !== "string") throw new Error("Invalid Bybit catalogue cursor");
    } while (cursor);
    if (!contracts.size) throw new Error("No eligible Bybit USDT perpetuals");
    this.contractsBySymbol = contracts;
    const result = this.contracts();
    this.emit({ type: "contracts", contracts: result });
    return result;
  }
}
