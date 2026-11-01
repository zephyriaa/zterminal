import WebSocket from "ws";
import type { ContractMetadata, DepthEvent, FeedHealth, QuoteEvent, TradeEvent } from "../../src/lib/market/types";
import { OKXDepthSynchronizer, type OKXBookPayload } from "../../src/lib/market/adapters/okx-l2-adapter";
import type { ProviderStatus } from "./gateio-provider";

export type OKXEvent =
  | { type: "contracts"; contracts: ContractMetadata[] }
  | { type: "status"; symbol?: string; state: ProviderStatus; reason?: string; updatedAt: number }
  | { type: "trade"; data: TradeEvent }
  | { type: "quote"; data: QuoteEvent }
  | { type: "depth"; data: DepthEvent };

function positive(value: unknown, label: string) {
  const parsed = (typeof value === "string" && value.trim()) || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid OKX ${label}`);
  return parsed;
}

/** Public JSON books/trades only; quantities remain native swap contracts. */
export class OKXFuturesProvider {
  readonly id = "okx" as const;
  readonly environment = "live" as const;
  private contractsBySymbol = new Map<string, ContractMetadata>();
  private listeners = new Set<(event: OKXEvent) => void>();
  private symbols = new Set<string>();
  private books = new Map<string, OKXDepthSynchronizer>();
  private lastTradeAt = new Map<string, number>();
  private lastDepthAt = new Map<string, number>();
  private tradeIds = new Map<string, Set<string>>();
  private healthStates = new Map<string, string>();
  private pending = new Map<string, number>();
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private retries = 0;
  private sequence = 0;
  private lastMessageAt = 0;

  on(listener: (event: OKXEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  contracts() { return [...this.contractsBySymbol.values()]; }
  private emit(event: OKXEvent) { for (const listener of this.listeners) listener(event); }

  health(symbol: string): FeedHealth {
    const now = Date.now(), connected = this.ws?.readyState === WebSocket.OPEN && this.symbols.has(symbol);
    const tradeAt = this.lastTradeAt.get(symbol), depthAt = this.lastDepthAt.get(symbol);
    const tradeState = !connected ? "DISCONNECTED" : !tradeAt ? "SYNCING" : now - tradeAt > 15_000 ? "STALE" : "LIVE";
    const depthReady = connected && this.books.get(symbol)?.status === "LIVE" && Boolean(depthAt && now - depthAt <= 15_000);
    const depthState = !connected ? "DISCONNECTED" : this.books.get(symbol)?.status !== "LIVE" ? "SYNCING" : !depthReady ? "STALE" : "LIVE";
    const state = !connected ? "DISCONNECTED" : tradeState === "LIVE" && depthState === "LIVE" ? "LIVE" : tradeState === "STALE" || depthState === "STALE" ? "STALE" : "SYNCING";
    return { provider: "okx", symbol, state, updatedAt: now, lastMessageAt: Math.max(tradeAt ?? 0, depthAt ?? 0) || undefined, lastDepthAt: depthAt, depthReady, reconnectCount: this.retries, streams: { trades: { state: tradeState, lastMessageAt: tradeAt }, depth: { state: depthState, lastMessageAt: depthAt } }, reason: state === "LIVE" ? undefined : "Waiting for fresh OKX aggregate trades and a valid L2 snapshot" };
  }

  private notifyHealth(symbol: string) {
    const health = this.health(symbol), key = `${health.streams!.trades.state}:${health.streams!.depth.state}`;
    if (this.healthStates.get(symbol) === key) return;
    this.healthStates.set(symbol, key);
    const state: ProviderStatus = health.state === "LIVE" ? "live" : health.state === "STALE" ? "stale" : this.ws?.readyState === WebSocket.OPEN ? "degraded" : "reconnecting";
    this.emit({ type: "status", symbol, state, reason: health.reason, updatedAt: Date.now() });
  }

  async discoverContracts() {
    const url = new URL("/api/v5/public/instruments?instType=SWAP", process.env.OKX_PUBLIC_REST_URL ?? "https://www.okx.com");
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`OKX instrument discovery failed (${response.status})`);
    const payload = await response.json();
    if (payload?.code !== "0" || !Array.isArray(payload.data) || payload.data.length > 10000) throw new Error("Invalid OKX instrument response");
    const contracts = new Map<string, ContractMetadata>();
    for (const item of payload.data) {
      if (item?.instType !== "SWAP" || item.ctType !== "linear" || item.settleCcy !== "USDT" || item.state !== "live") continue;
      if (typeof item.instId !== "string" || !/^[A-Z0-9]+-USDT-SWAP$/.test(item.instId) || item.ctValCcy !== item.instId.split("-")[0]) throw new Error("Invalid OKX swap identity");
      const root = item.ctValCcy, tickSize = positive(item.tickSz, "tick precision"), quantityStep = positive(item.lotSz, "quantity precision");
      const multiplier = positive(item.ctVal, "contract value") * positive(item.ctMult || "1", "contract multiplier");
      if (!Number.isFinite(multiplier) || contracts.has(item.instId)) throw new Error("Invalid or duplicate OKX contract");
      contracts.set(item.instId, { root, symbol: item.instId, description: `OKX ${root}/USDT Swap`, exchange: "OKX", product: "perpetual", tickSize, tickValue: tickSize * multiplier, multiplier, quantityStep, currency: "USDT", session: "crypto", supportsDepth: true, supportsMBO: false, verified: true });
    }
    if (!contracts.size) throw new Error("No eligible OKX USDT swaps");
    this.contractsBySymbol = contracts;
    const result = this.contracts(); this.emit({ type: "contracts", contracts: result }); return result;
  }

  async subscribe(symbol: string) {
    if (this.closed || !this.contractsBySymbol.has(symbol)) throw new Error(`Unsupported or unavailable OKX swap: ${symbol}`);
    if (this.symbols.has(symbol)) return;
    this.symbols.add(symbol);
    if (!this.ws) this.connect(); else if (this.ws.readyState === WebSocket.OPEN) this.sendSubscription("subscribe", symbol);
  }

  unsubscribe(symbol: string) {
    this.sendSubscription("unsubscribe", symbol);
    this.symbols.delete(symbol); this.books.delete(symbol); this.lastTradeAt.delete(symbol); this.lastDepthAt.delete(symbol); this.tradeIds.delete(symbol); this.healthStates.delete(symbol);
    if (!this.symbols.size) this.disconnect();
  }

  close() { this.closed = true; this.disconnect(); this.symbols.clear(); this.listeners.clear(); }

  private disconnect() {
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.timer = null; this.reconnectTimer = null;
    const socket = this.ws; this.ws = null; socket?.terminate();
    this.books.clear(); this.lastDepthAt.clear(); this.lastTradeAt.clear(); this.pending.clear(); this.healthStates.clear();
  }

  private sendSubscription(op: "subscribe" | "unsubscribe", symbol: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const args = ["books", "trades"].map(channel => ({ channel, instId: symbol }));
    for (const arg of args) this.pending.set(`${op}:${arg.channel}:${symbol}`, Date.now());
    this.ws.send(JSON.stringify({ op, args }));
  }

  private connect() {
    if (this.closed || !this.symbols.size || this.ws || this.reconnectTimer) return;
    const socket = this.ws = new WebSocket(process.env.OKX_WS_URL ?? "wss://ws.okx.com/ws/v5/public", { handshakeTimeout: 10_000, maxPayload: 2 * 1024 * 1024 });
    socket.on("open", () => {
      if (this.ws !== socket) return;
      this.lastMessageAt = Date.now(); let pingAt = Date.now();
      for (const symbol of this.symbols) this.sendSubscription("subscribe", symbol);
      this.timer = setInterval(() => {
        if (this.ws !== socket) return;
        const now = Date.now();
        if (now - this.lastMessageAt > 30_000 || [...this.pending.values()].some(at => now - at > 10_000)) { socket.terminate(); return; }
        if (now - pingAt >= 20_000) { socket.send("ping"); pingAt = now; }
        for (const symbol of this.symbols) this.notifyHealth(symbol);
      }, 1000);
    });
    socket.on("message", bytes => {
      if (this.ws !== socket) return;
      this.lastMessageAt = Date.now();
      try { if (String(bytes) !== "pong") this.receive(JSON.parse(String(bytes))); }
      catch { this.books.clear(); this.lastDepthAt.clear(); for (const symbol of this.symbols) this.notifyHealth(symbol); socket.terminate(); }
    });
    socket.on("error", () => { if (this.ws === socket) socket.terminate(); });
    socket.on("close", () => {
      if (this.ws !== socket) return;
      this.disconnect(); for (const symbol of this.symbols) this.notifyHealth(symbol);
      if (!this.closed && this.symbols.size) {
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.retries++, 5));
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, delay);
      }
    });
  }

  private receive(message: Record<string, unknown>) {
    if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("Invalid OKX message");
    const arg = message.arg as { channel: string; instId: string } | undefined;
    if (message.event) {
      if (message.event === "error" || (message.event === "notice" && message.code === "64008")) throw new Error("OKX subscription unavailable");
      if (arg) this.pending.delete(`${message.event}:${arg.channel}:${arg.instId}`);
      return;
    }
    if (!arg || !this.symbols.has(arg.instId)) return;
    if (arg.channel === "trades") this.receiveTrades(arg.instId, message.data);
    else if (arg.channel === "books") this.receiveBook(arg.instId, message as unknown as OKXBookPayload);
  }

  private receiveTrades(symbol: string, data: unknown) {
    if (!Array.isArray(data) || data.length > 1024) throw new Error("Invalid OKX trades");
    const ids = this.tradeIds.get(symbol) ?? new Set<string>();
    for (const trade of data) {
      if (!trade || trade.instId !== symbol || typeof trade.tradeId !== "string" || !/^\d{1,128}$/.test(trade.tradeId) || !["buy", "sell"].includes(trade.side)) throw new Error("Invalid OKX trade identity");
      const timestamp = positive(trade.ts, "trade timestamp"), price = positive(trade.px, "trade price"), quantity = positive(trade.sz, "trade quantity");
      if (!Number.isSafeInteger(timestamp) || timestamp > Date.now() + 60_000 || (trade.seqId !== undefined && (!Number.isSafeInteger(trade.seqId) || trade.seqId < 0)) || (trade.count !== undefined && (!Number.isSafeInteger(Number(trade.count)) || Number(trade.count) < 1))) throw new Error("Invalid OKX trade time, sequence or count");
      if (ids.has(trade.tradeId)) continue;
      // ponytail: bounded live deduplication; persistent replay needs a durable identity store.
      ids.add(trade.tradeId); if (ids.size > 4096) ids.delete(ids.values().next().value!);
      this.tradeIds.set(symbol, ids); this.lastTradeAt.set(symbol, timestamp); this.notifyHealth(symbol);
      // Public trades can aggregate matches; swap sizes are contracts, not base assets.
      // https://www.okx.com/docs-v5/en/#order-book-trading-market-data-ws-trades-channel
      this.emit({ type: "trade", data: { type: "trade", provider: "okx", environment: "live", exchange: "OKX", symbol, timestamp, sequence: ++this.sequence, eventId: trade.tradeId, sourceSequence: trade.seqId === undefined ? undefined : String(trade.seqId), price, quantity, side: trade.side, quantityUnit: "contracts", contractMultiplier: this.contractsBySymbol.get(symbol)!.multiplier, conditions: ["aggregate-trade", ...(trade.count === undefined ? [] : [`aggregate-count:${trade.count}`])] } });
    }
  }

  private receiveBook(symbol: string, payload: OKXBookPayload) {
    if (!Array.isArray(payload.data) || payload.data.length !== 1 || !["snapshot", "update"].includes(payload.action)) throw new Error("Invalid OKX book payload");
    const data = payload.data[0], timestamp = positive(data.ts, "book timestamp");
    if (!Number.isSafeInteger(timestamp) || timestamp > Date.now() + 60_000 || !Number.isSafeInteger(data.seqId) || data.seqId! < 0 || !Number.isSafeInteger(data.prevSeqId) || (payload.action === "snapshot" ? data.prevSeqId !== -1 : data.prevSeqId! < 0)) throw new Error("Invalid OKX book sequence or time");
    for (const levels of [data.bids, data.asks]) {
      if (!Array.isArray(levels) || levels.length > 400) throw new Error("Invalid OKX book depth");
      for (const level of levels) if (!Array.isArray(level) || level.length < 2 || typeof level[0] !== "string" || !level[0].trim() || typeof level[1] !== "string" || !level[1].trim()) throw new Error("Invalid OKX book level");
    }
    const sync = this.books.get(symbol) ?? new OKXDepthSynchronizer(symbol);
    if (!sync.handleMessage(payload)) { if (sync.status === "ERROR") throw new Error("OKX book continuity failed"); return; }
    const bids = sync.book.top("buy", 400), asks = sync.book.top("sell", 400);
    if (!bids.length || !asks.length) throw new Error("Unavailable OKX book");
    sync.book.clear(); for (const level of [...bids, ...asks]) sync.book.apply(level.side, String(level.price), level.size);
    this.books.set(symbol, sync); this.lastDepthAt.set(symbol, timestamp); this.notifyHealth(symbol);
    const sequence = ++this.sequence;
    this.emit({ type: "depth", data: { type: "depth", provider: "okx", environment: "live", exchange: "OKX", symbol, timestamp, sequence, sourceSequence: String(data.seqId), levels: [...bids, ...asks] } });
    this.emit({ type: "quote", data: { type: "quote", provider: "okx", environment: "live", exchange: "OKX", symbol, timestamp, sequence, bid: bids[0].price, bidSize: bids[0].size, ask: asks[0].price, askSize: asks[0].size } });
  }
}
