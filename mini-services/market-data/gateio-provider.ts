import {
  GATEIO_DEFAULT_SYMBOL,
  GATEIO_REST_URL,
  GATEIO_WS_URL,
  GateContractSchema,
  gateContractToMetadata,
  parseGateDecimal,
  type GateContract,
} from "../../src/lib/market/gateio.js";
import WebSocket from "ws";
import type { ContractMetadata, DepthLevel, QuoteEvent, TradeEvent } from "../../src/lib/market/types.js";
import { GateOrderBook, type GateBookDelta, type GateBookSnapshot } from "./order-book.js";

const BOOK_DEPTH = 100;
const BOOK_FREQUENCY = "100ms";
const STALE_AFTER_MS = 15_000;

export type ProviderStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "stale"
  | "degraded"
  | "unavailable";

export type GateEvent =
  | { type: "trade"; data: TradeEvent }
  | { type: "quote"; data: QuoteEvent }
  | { type: "depth"; symbol: string; sequence: number; timestamp: number; levels: DepthLevel[] }
  | { type: "status"; symbol?: string; state: ProviderStatus; reason?: string; updatedAt: number }
  | { type: "contracts"; contracts: ContractMetadata[] };

type Listener = (event: GateEvent) => void;

interface GateMessage {
  channel?: string;
  event?: string;
  error?: { code?: number; message?: string } | null;
  result?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Read-only public Gate.io USDT perpetual client. It intentionally exposes no
 * account, order, position, or authenticated exchange operation.
 */
export class GateioFuturesProvider {
  readonly id = "gateio" as const;
  readonly environment = "live" as const;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private symbols = new Set<string>();
  private books = new Map<string, GateOrderBook>();
  private contractsBySymbol = new Map<string, ContractMetadata>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private lastEventAt = new Map<string, number>();
  private lastTradeSequence = new Map<string, number>();
  private lastStatus: ProviderStatus = "unavailable";

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  contracts() {
    return [...this.contractsBySymbol.values()];
  }

  async discoverContracts(): Promise<ContractMetadata[]> {
    const response = await fetch(`${GATEIO_REST_URL}/futures/usdt/contracts`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Gate.io contract discovery failed (${response.status})`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("invalid Gate.io contract catalogue");
    this.contractsBySymbol.clear();
    for (const item of raw) {
      const parsed = GateContractSchema.safeParse(item);
      if (!parsed.success || parsed.data.in_delisting) continue;
      const metadata = gateContractToMetadata(parsed.data);
      this.contractsBySymbol.set(metadata.symbol, metadata);
    }
    const contracts = this.contracts();
    this.emit({ type: "contracts", contracts });
    return contracts;
  }

  async subscribe(symbol: string) {
    if (!this.contractsBySymbol.size) await this.discoverContracts();
    if (!this.contractsBySymbol.has(symbol)) {
      throw new Error(`unsupported or unavailable Gate.io contract: ${symbol}`);
    }
    this.symbols.add(symbol);
    if (!this.books.has(symbol)) this.books.set(symbol, new GateOrderBook());
    // Seed time & sales from the public REST endpoint. This is still exchange
    // data, not simulated data, and avoids an empty order-flow panel during a
    // naturally quiet interval before the next WebSocket trade arrives.
    void this.bootstrapTrades(symbol);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) this.connect();
    else this.subscribeSymbol(symbol);
  }

  unsubscribe(symbol: string) {
    this.symbols.delete(symbol);
    this.books.delete(symbol);
    this.lastEventAt.delete(symbol);
    if (!this.symbols.size) this.disconnect();
  }

  getFreshness(symbol: string) {
    const updatedAt = this.lastEventAt.get(symbol) ?? 0;
    return { updatedAt, ageMs: updatedAt ? Date.now() - updatedAt : Number.POSITIVE_INFINITY };
  }

  async getCandles(symbol: string, interval: string, limit = 500) {
    const safeLimit = Math.max(1, Math.min(1_000, Math.floor(limit)));
    const url = new URL(`${GATEIO_REST_URL}/futures/usdt/candlesticks`);
    url.searchParams.set("contract", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(safeLimit));
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Gate.io candles failed (${response.status})`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("invalid Gate.io candles response");
    return raw;
  }

  close() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.manuallyClosed) return;
    this.setStatus(this.reconnectAttempt ? "reconnecting" : "connecting");
    try {
      this.ws = new WebSocket(GATEIO_WS_URL, { headers: { "X-Gate-Size-Decimal": "1" } });
      this.ws.on("open", () => {
        this.reconnectAttempt = 0;
        this.setStatus("connecting");
        for (const symbol of this.symbols) this.subscribeSymbol(symbol);
        this.ensureStaleMonitor();
      });
      this.ws.on("message", (data) => {
        try {
          this.handleMessage(JSON.parse(data.toString()) as GateMessage);
        } catch (error) {
          this.setStatus("degraded", error instanceof Error ? error.message : "invalid upstream message");
        }
      });
      this.ws.on("error", () => this.setStatus("degraded", "Gate.io WebSocket error"));
      this.ws.on("close", () => {
        this.ws = null;
        if (!this.manuallyClosed && this.symbols.size) this.scheduleReconnect();
      });
    } catch (error) {
      this.setStatus("unavailable", error instanceof Error ? error.message : "Gate.io connection failed");
      this.scheduleReconnect();
    }
  }

  private disconnect() {
    this.ws?.close();
    this.ws = null;
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = null;
    this.setStatus("unavailable", "no active symbol subscriptions");
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.manuallyClosed || !this.symbols.size) return;
    this.reconnectAttempt += 1;
    const cap = Math.min(30_000, 1_000 * 2 ** Math.min(this.reconnectAttempt, 5));
    const delay = Math.round(cap * (0.75 + Math.random() * 0.5));
    this.setStatus("reconnecting", `retrying in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private subscribeSymbol(symbol: string) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    this.send({ channel: "futures.trades", event: "subscribe", payload: [symbol] });
    this.send({ channel: "futures.candlesticks", event: "subscribe", payload: ["1m", symbol] });
    this.send({ channel: "futures.order_book_update", event: "subscribe", payload: [symbol, BOOK_FREQUENCY, String(BOOK_DEPTH)] });
    this.send({ channel: "futures.book_ticker", event: "subscribe", payload: [symbol] });
    void this.rebuildBook(symbol);
  }

  private send(message: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ time: nowSeconds(), ...message }));
  }

  private handleMessage(message: GateMessage) {
    if (message.error) {
      this.setStatus("degraded", message.error.message ?? "Gate.io subscription error");
      return;
    }
    if (message.event === "subscribe") return;
    if (message.channel === "futures.trades" && message.event === "update") this.handleTrades(message.result);
    if (message.channel === "futures.order_book_update" && message.event === "update") this.handleBookDelta(message.result);
    if (message.channel === "futures.book_ticker" && message.event === "update") this.handleBookTicker(message.result);
    if (message.channel === "futures.pong") this.setStatus("live");
  }

  private handleTrades(result: unknown) {
    if (!Array.isArray(result)) throw new Error("invalid Gate.io trade payload");
    for (const raw of result) {
      const normalized = this.normalizeTrade(raw);
      if (normalized && this.symbols.has(normalized.symbol)) this.publishTrade(normalized);
    }
  }

  private async bootstrapTrades(symbol: string) {
    try {
      const url = new URL(`${GATEIO_REST_URL}/futures/usdt/trades`);
      url.searchParams.set("contract", symbol);
      url.searchParams.set("limit", "100");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Gate.io trade bootstrap failed (${response.status})`);
      const raw = await response.json();
      if (!Array.isArray(raw)) throw new Error("invalid Gate.io trade bootstrap response");
      // Gate returns newest-first history; emit chronological order for CVD.
      for (const value of raw.slice().reverse()) {
        const normalized = this.normalizeTrade(value);
        if (normalized && this.symbols.has(normalized.symbol)) this.publishTrade(normalized);
      }
    } catch (error) {
      this.setStatus("degraded", error instanceof Error ? error.message : "trade bootstrap failed");
    }
  }

  private normalizeTrade(raw: unknown): TradeEvent | null {
    const trade = asRecord(raw);
    if (!trade || typeof trade.contract !== "string") return null;
    const signedSize = parseGateDecimal(trade.size, "trade size");
    const id = Number(trade.id);
    const upstreamTime = Number(trade.create_time_ms ?? trade.create_time ?? 0);
    // Some REST deployments label the field create_time_ms but return seconds;
    // normalize defensively without changing genuine millisecond timestamps.
    const timestamp = upstreamTime < 10_000_000_000 ? upstreamTime * 1_000 : upstreamTime;
    if (!Number.isFinite(timestamp) || !Number.isFinite(id)) throw new Error("invalid Gate.io trade timestamp or id");
    return {
      type: "trade",
      provider: "gateio",
      environment: "live",
      symbol: trade.contract,
      exchange: "GATEIO",
      timestamp,
      sequence: id,
      price: parseGateDecimal(trade.price, "trade price"),
      quantity: Math.abs(signedSize),
      // Gate documents positive size as a buyer-initiated trade and negative as seller-initiated.
      side: signedSize >= 0 ? "buy" : "sell",
      conditions: trade.is_internal ? ["internal"] : undefined,
    };
  }

  private publishTrade(trade: TradeEvent) {
    const previous = this.lastTradeSequence.get(trade.symbol) ?? -1;
    if (trade.sequence <= previous) return;
    this.lastTradeSequence.set(trade.symbol, trade.sequence);
    this.touch(trade.symbol);
    this.emit({ type: "trade", data: trade });
    this.setStatus("live");
  }

  private handleBookTicker(result: unknown) {
    const data = asRecord(result);
    if (!data || typeof data.s !== "string" || !this.symbols.has(data.s)) return;
    const quote: QuoteEvent = {
      type: "quote",
      provider: "gateio",
      environment: "live",
      symbol: data.s,
      exchange: "GATEIO",
      timestamp: Number(data.t ?? Date.now()),
      sequence: Number(data.id ?? Date.now()),
      bid: parseGateDecimal(data.b, "best bid"),
      ask: parseGateDecimal(data.a, "best ask"),
      bidSize: Math.abs(parseGateDecimal(data.B, "best bid size")),
      askSize: Math.abs(parseGateDecimal(data.A, "best ask size")),
    };
    this.touch(quote.symbol);
    this.emit({ type: "quote", data: quote });
  }

  private handleBookDelta(result: unknown) {
    const raw = asRecord(result);
    if (!raw || typeof raw.s !== "string" || !this.symbols.has(raw.s)) return;
    const delta: GateBookDelta = {
      U: Number(raw.U),
      u: Number(raw.u),
      t: Number(raw.t ?? Date.now()),
      b: Array.isArray(raw.b) ? (raw.b as GateBookDelta["b"]) : [],
      a: Array.isArray(raw.a) ? (raw.a as GateBookDelta["a"]) : [],
      full: raw.full === true,
    };
    const book = this.books.get(raw.s);
    if (!book) return;
    const applied = book.apply(delta);
    if (!applied) {
      this.setStatus("stale", "order-book sequence gap; resynchronizing");
      void this.rebuildBook(raw.s);
      return;
    }
    this.touch(raw.s);
    if (book.isReady()) this.publishBook(raw.s, book, delta.t);
  }

  private async rebuildBook(symbol: string) {
    const book = this.books.get(symbol);
    if (!book) return;
    try {
      const url = new URL(`${GATEIO_REST_URL}/futures/usdt/order_book`);
      url.searchParams.set("contract", symbol);
      url.searchParams.set("limit", String(BOOK_DEPTH));
      url.searchParams.set("with_id", "true");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Gate.io order-book snapshot failed (${response.status})`);
      const snapshot = (await response.json()) as GateBookSnapshot;
      if (!Number.isInteger(snapshot.id) || !Array.isArray(snapshot.bids) || !Array.isArray(snapshot.asks)) {
        throw new Error("invalid Gate.io order-book snapshot");
      }
      if (!book.bootstrap(snapshot)) {
        // A snapshot that cannot bridge buffered deltas is unsafe; retry once asynchronously.
        setTimeout(() => void this.rebuildBook(symbol), 250);
        return;
      }
      this.touch(symbol);
      this.publishBook(symbol, book, Date.now());
      this.setStatus("live");
    } catch (error) {
      this.setStatus("degraded", error instanceof Error ? error.message : "order-book recovery failed");
    }
  }

  private publishBook(symbol: string, book: GateOrderBook, timestamp: number) {
    const levels = book.levels(BOOK_DEPTH);
    this.emit({ type: "depth", symbol, sequence: book.lastSequence(), timestamp, levels });
    const top = book.bestQuote();
    if (top) {
      this.emit({
        type: "quote",
        data: {
          type: "quote",
          provider: "gateio",
          environment: "live",
          symbol,
          exchange: "GATEIO",
          timestamp,
          sequence: book.lastSequence(),
          ...top,
        },
      });
    }
  }

  private touch(symbol: string) {
    this.lastEventAt.set(symbol, Date.now());
  }

  private ensureStaleMonitor() {
    if (this.staleTimer) return;
    this.staleTimer = setInterval(() => {
      for (const symbol of this.symbols) {
        const last = this.lastEventAt.get(symbol) ?? 0;
        if (!last || Date.now() - last > STALE_AFTER_MS) {
          this.setStatus("stale", `no ${symbol} event for ${STALE_AFTER_MS / 1000}s`, symbol);
        }
      }
      this.send({ channel: "futures.ping", event: "", payload: [] });
    }, 5_000);
  }

  private setStatus(state: ProviderStatus, reason?: string, symbol?: string) {
    if (state === this.lastStatus && !reason) return;
    this.lastStatus = state;
    this.emit({ type: "status", state, symbol, reason, updatedAt: Date.now() });
  }

  private emit(event: GateEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const gateioDefaultSymbol = GATEIO_DEFAULT_SYMBOL;
