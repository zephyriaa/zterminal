import WebSocket from "ws";
import type { ContractMetadata, DepthLevel, FeedHealth, QuoteEvent, TradeEvent } from "../../src/lib/market/types";
import { BinanceOrderBook, type BinanceBookDelta, type BinanceBookSnapshot } from "./binance-order-book";
import type { ProviderStatus } from "./gateio-provider";

const BINANCE_REST_URL = process.env.BINANCE_FUTURES_REST_URL ?? "https://fapi.binance.com";
const BINANCE_WS_URL = process.env.BINANCE_FUTURES_WS_URL ?? "wss://fstream.binance.com/public/stream";
const BOOK_DEPTH = Math.max(50, Math.min(1_000, Number(process.env.BINANCE_BOOK_DEPTH ?? 500) || 500));
const STALE_AFTER_MS = Math.max(5_000, Number(process.env.BINANCE_STALE_AFTER_MS ?? 15_000) || 15_000);
const DERIVATIVES_REFRESH_MS = Math.max(5_000, Number(process.env.BINANCE_DERIVATIVES_REFRESH_MS ?? 10_000) || 10_000);

export const BINANCE_DEFAULT_SYMBOL = "BTCUSDT";

export type BinanceDerivativeEvent = {
  type: "derivatives";
  provider: "binance";
  environment: "live";
  symbol: string;
  exchange: "BINANCE";
  timestamp: number;
  markPrice?: number;
  indexPrice?: number;
  fundingRate?: number;
  nextFundingTime?: number;
  openInterest?: number;
  openInterestTimestamp?: number;
  openInterestStatus?: "live" | "unavailable";
  openInterestReason?: string;
};

export type BinanceLiquidationEvent = {
  type: "liquidation";
  provider: "binance";
  environment: "live";
  symbol: string;
  exchange: "BINANCE";
  timestamp: number;
  sequence: number;
  side: "buy" | "sell";
  orderType?: string;
  status?: string;
  quantity: number;
  filledQuantity?: number;
  averagePrice?: number;
  lastFilledPrice?: number;
};

export type BinanceEvent =
  | { type: "trade"; data: TradeEvent }
  | { type: "quote"; data: QuoteEvent }
  | { type: "depth"; symbol: string; sequence: number; timestamp: number; levels: DepthLevel[] }
  | { type: "derivatives"; data: BinanceDerivativeEvent }
  | { type: "liquidation"; data: BinanceLiquidationEvent }
  | { type: "status"; symbol?: string; state: ProviderStatus; reason?: string; updatedAt: number }
  | { type: "contracts"; contracts: ContractMetadata[] };

type Listener = (event: BinanceEvent) => void;
type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawRecord : null;
}

function decimal(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid Binance ${label}`);
  return parsed;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value) throw new Error(`invalid Binance ${label}`);
  return value;
}

/**
 * Public, read-only Binance USDⓈ-M futures adapter. It owns no account state and
 * never sends authenticated or execution commands. All exchange payloads are
 * normalized before they leave this module.
 */
export class BinanceFuturesProvider {
  readonly id = "binance" as const;
  readonly environment = "live" as const;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private symbols = new Set<string>();
  private books = new Map<string, BinanceOrderBook>();
  private contractsBySymbol = new Map<string, ContractMetadata>();
  private lastEventAt = new Map<string, number>();
  private lastTradeSequence = new Map<string, number>();
  private lastDerivative = new Map<string, BinanceDerivativeEvent>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private derivativesTimer: ReturnType<typeof setInterval> | null = null;
  private bookRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private bookRetryAttempts = new Map<string, number>();
  private rebuildingBooks = new Set<string>();
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private lastStatus: ProviderStatus = "unavailable";
  private lastReason: string | undefined;
  private requestId = 0;

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  contracts() {
    return [...this.contractsBySymbol.values()];
  }

  /** A read-only, per-symbol provenance snapshot for downstream UI and health checks. */
  health(symbol: string): FeedHealth {
    const normalized = symbol.toUpperCase();
    const book = this.books.get(normalized);
    const lastMessageAt = this.lastEventAt.get(normalized);
    const state = this.lastStatus === "unavailable"
      ? "UNAVAILABLE"
      : this.lastStatus === "degraded"
        ? "DEGRADED"
        : this.lastStatus === "stale"
          ? "STALE"
          : this.lastStatus === "reconnecting"
            ? "RESYNCING"
            : book && !book.isReady()
              ? "SYNCING"
              : this.lastStatus === "live"
                ? "LIVE"
                : "DISCONNECTED";
    return {
      provider: "binance",
      symbol: normalized,
      state,
      updatedAt: Date.now(),
      lastMessageAt,
      latencyMs: lastMessageAt ? Math.max(0, Date.now() - lastMessageAt) : undefined,
      sequence: book?.lastSequence() ?? this.lastTradeSequence.get(normalized),
      reconnectCount: this.reconnectAttempt,
      reason: this.lastReason,
    };
  }

  async discoverContracts() {
    const response = await fetch(`${BINANCE_REST_URL}/fapi/v1/exchangeInfo`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Binance exchange information failed (${response.status})`);
    const payload = asRecord(await response.json());
    const symbols = Array.isArray(payload?.symbols) ? payload.symbols : null;
    if (!symbols) throw new Error("invalid Binance exchange information response");

    this.contractsBySymbol.clear();
    for (const raw of symbols) {
      const item = asRecord(raw);
      if (!item || item.contractType !== "PERPETUAL" || item.status !== "TRADING") continue;
      const symbol = typeof item.symbol === "string" ? item.symbol : null;
      const baseAsset = typeof item.baseAsset === "string" ? item.baseAsset : "";
      const quoteAsset = typeof item.quoteAsset === "string" ? item.quoteAsset : "USDT";
      const filters = Array.isArray(item.filters) ? item.filters.map(asRecord) : [];
      const priceFilter = filters.find((filter) => filter?.filterType === "PRICE_FILTER");
      const lotFilter = filters.find((filter) => filter?.filterType === "LOT_SIZE");
      if (!symbol || !baseAsset || !priceFilter) continue;
      const tickSize = decimal(priceFilter.tickSize, "tick size");
      const lotSize = lotFilter ? decimal(lotFilter.stepSize, "lot size") : 1;
      this.contractsBySymbol.set(symbol, {
        root: baseAsset,
        symbol,
        description: `Binance USDⓈ-M ${baseAsset}/${quoteAsset} Perpetual`,
        exchange: "BINANCE",
        product: "perpetual",
        tickSize,
        tickValue: tickSize,
        multiplier: 1,
        currency: quoteAsset === "USDT" ? "USDT" : "USD",
        session: "crypto",
        supportsDepth: true,
        supportsMBO: false,
      });
      void lotSize; // retained as documented adapter metadata when canonical contract gains lot size.
    }
    const contracts = this.contracts();
    this.emit({ type: "contracts", contracts });
    return contracts;
  }

  async subscribe(symbol: string) {
    const normalized = symbol.toUpperCase();
    if (!this.contractsBySymbol.size) await this.discoverContracts();
    if (!this.contractsBySymbol.has(normalized)) throw new Error(`unsupported or unavailable Binance perpetual: ${normalized}`);
    this.symbols.add(normalized);
    if (!this.books.has(normalized)) this.books.set(normalized, new BinanceOrderBook());
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) this.connect();
    else this.subscribeSymbol(normalized);
    void this.refreshDerivatives(normalized);
  }

  unsubscribe(symbol: string) {
    const normalized = symbol.toUpperCase();
    this.symbols.delete(normalized);
    this.books.delete(normalized);
    this.lastEventAt.delete(normalized);
    this.lastTradeSequence.delete(normalized);
    this.lastDerivative.delete(normalized);
    const retryTimer = this.bookRetryTimers.get(normalized);
    if (retryTimer) clearTimeout(retryTimer);
    this.bookRetryTimers.delete(normalized);
    this.bookRetryAttempts.delete(normalized);
    this.rebuildingBooks.delete(normalized);
    if (!this.symbols.size) this.disconnect();
  }

  close() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.derivativesTimer) clearInterval(this.derivativesTimer);
    for (const retryTimer of this.bookRetryTimers.values()) clearTimeout(retryTimer);
    this.bookRetryTimers.clear();
    this.rebuildingBooks.clear();
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.manuallyClosed || this.ws) return;
    this.setStatus(this.reconnectAttempt ? "reconnecting" : "connecting");
    this.ws = new WebSocket(BINANCE_WS_URL);
    this.ws.on("open", () => {
      this.reconnectAttempt = 0;
      for (const symbol of this.symbols) this.subscribeSymbol(symbol);
      this.ensureTimers();
    });
    this.ws.on("message", (data) => {
      try {
        this.handleMessage(JSON.parse(data.toString()) as RawRecord);
      } catch (error) {
        this.setStatus("degraded", error instanceof Error ? error.message : "invalid Binance upstream message");
      }
    });
    this.ws.on("error", () => this.setStatus("degraded", "Binance WebSocket error"));
    this.ws.on("close", () => {
      this.ws = null;
      if (!this.manuallyClosed && this.symbols.size) this.scheduleReconnect();
    });
  }

  private disconnect() {
    this.ws?.close();
    this.ws = null;
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.derivativesTimer) clearInterval(this.derivativesTimer);
    this.staleTimer = null;
    this.derivativesTimer = null;
    this.setStatus("unavailable", "no active symbol subscriptions");
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.manuallyClosed || !this.symbols.size) return;
    this.reconnectAttempt += 1;
    const capped = Math.min(30_000, 1_000 * 2 ** Math.min(this.reconnectAttempt, 5));
    const delay = Math.round(capped * (0.75 + Math.random() * 0.5));
    this.setStatus("reconnecting", `retrying in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private subscribeSymbol(symbol: string) {
    const stream = symbol.toLowerCase();
    this.send({ method: "SUBSCRIBE", params: [
      `${stream}@depth@100ms`,
      `${stream}@trade`,
      `${stream}@bookTicker`,
      `${stream}@markPrice@1s`,
      `${stream}@forceOrder`,
    ], id: ++this.requestId });
    void this.rebuildBook(symbol);
  }

  private send(payload: RawRecord) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(message: RawRecord) {
    if (message.code !== undefined && message.msg !== undefined) {
      this.setStatus("degraded", `Binance subscription error: ${String(message.msg)}`);
      return;
    }
    // The documented combined endpoint wraps each stream payload in { stream, data }.
    // Accept an unwrapped payload too so a configured raw-stream endpoint remains valid.
    const payload = asRecord(message.data) ?? message;
    const eventType = typeof payload.e === "string" ? payload.e : "";
    if (eventType === "depthUpdate") this.handleDepth(payload);
    else if (eventType === "trade") this.handleTrade(payload);
    else if (eventType === "bookTicker") this.handleBookTicker(payload);
    else if (eventType === "markPriceUpdate") this.handleMarkPrice(payload);
    else if (eventType === "forceOrder") this.handleLiquidation(payload);
  }

  private handleDepth(message: RawRecord) {
    const symbol = text(message.s, "depth symbol").toUpperCase();
    if (!this.symbols.has(symbol)) return;
    const delta: BinanceBookDelta = {
      U: decimal(message.U, "depth first update id"),
      u: decimal(message.u, "depth final update id"),
      pu: decimal(message.pu, "depth previous update id"),
      E: decimal(message.E, "depth event time"),
      b: Array.isArray(message.b) ? message.b as [string, string][] : [],
      a: Array.isArray(message.a) ? message.a as [string, string][] : [],
    };
    const book = this.books.get(symbol);
    if (!book) return;
    const applied = book.apply(delta);
    if (!applied) {
      this.setStatus("stale", "Binance order-book sequence gap; resynchronizing", symbol);
      void this.rebuildBook(symbol);
      return;
    }
    this.touch(symbol);
    if (book.isReady()) this.publishBook(symbol, book, delta.E);
  }

  private handleTrade(message: RawRecord) {
    const symbol = text(message.s, "trade symbol").toUpperCase();
    if (!this.symbols.has(symbol)) return;
    const sequence = decimal(message.t ?? message.a, "trade id");
    if (sequence <= (this.lastTradeSequence.get(symbol) ?? -1)) return;
    this.lastTradeSequence.set(symbol, sequence);
    const buyerIsMaker = message.m === true;
    const trade: TradeEvent = {
      type: "trade",
      provider: "binance",
      environment: "live",
      symbol,
      exchange: "BINANCE",
      timestamp: decimal(message.T ?? message.E, "trade time"),
      sequence,
      price: decimal(message.p, "trade price"),
      quantity: decimal(message.q, "trade quantity"),
      // Binance's `m` is buyer-is-maker; when true the seller initiated the market trade.
      side: buyerIsMaker ? "sell" : "buy",
      conditions: ["raw-trade", buyerIsMaker ? "buyer-maker" : "seller-maker"],
    };
    this.touch(symbol);
    this.emit({ type: "trade", data: trade });
    // Trade-tape availability cannot certify the L2 feed. Keep the provider
    // degraded or synchronizing until the sequence-safe snapshot bridge is ready.
    if (this.books.get(symbol)?.isReady()) this.setStatus("live");
  }

  private handleBookTicker(message: RawRecord) {
    const symbol = text(message.s, "book ticker symbol").toUpperCase();
    if (!this.symbols.has(symbol)) return;
    const quote: QuoteEvent = {
      type: "quote",
      provider: "binance",
      environment: "live",
      symbol,
      exchange: "BINANCE",
      timestamp: decimal(message.T ?? message.E, "book ticker time"),
      sequence: decimal(message.u, "book ticker update id"),
      bid: decimal(message.b, "best bid"),
      ask: decimal(message.a, "best ask"),
      bidSize: decimal(message.B, "best bid quantity"),
      askSize: decimal(message.A, "best ask quantity"),
    };
    this.touch(symbol);
    this.emit({ type: "quote", data: quote });
  }

  private handleMarkPrice(message: RawRecord) {
    const symbol = text(message.s, "mark price symbol").toUpperCase();
    if (!this.symbols.has(symbol)) return;
    const previous = this.lastDerivative.get(symbol);
    const next: BinanceDerivativeEvent = {
      type: "derivatives",
      provider: "binance",
      environment: "live",
      symbol,
      exchange: "BINANCE",
      timestamp: decimal(message.E, "mark price time"),
      markPrice: decimal(message.p, "mark price"),
      indexPrice: decimal(message.i, "index price"),
      fundingRate: decimal(message.r, "funding rate"),
      nextFundingTime: decimal(message.T, "next funding time"),
      openInterest: previous?.openInterest,
      openInterestTimestamp: previous?.openInterestTimestamp,
      openInterestStatus: previous?.openInterestStatus,
      openInterestReason: previous?.openInterestReason,
    };
    this.lastDerivative.set(symbol, next);
    this.touch(symbol);
    this.emit({ type: "derivatives", data: next });
  }

  private handleLiquidation(message: RawRecord) {
    const forceOrder = asRecord(message.o);
    if (!forceOrder) return;
    const symbol = text(forceOrder.s, "liquidation symbol").toUpperCase();
    if (!this.symbols.has(symbol)) return;
    const event: BinanceLiquidationEvent = {
      type: "liquidation",
      provider: "binance",
      environment: "live",
      symbol,
      exchange: "BINANCE",
      timestamp: decimal(forceOrder.T ?? message.E, "liquidation time"),
      sequence: Number(message.E ?? Date.now()),
      side: forceOrder.S === "SELL" ? "sell" : "buy",
      orderType: typeof forceOrder.o === "string" ? forceOrder.o : undefined,
      status: typeof forceOrder.X === "string" ? forceOrder.X : undefined,
      quantity: decimal(forceOrder.q, "liquidation quantity"),
      filledQuantity: forceOrder.z === undefined ? undefined : decimal(forceOrder.z, "liquidation filled quantity"),
      averagePrice: forceOrder.ap === undefined ? undefined : decimal(forceOrder.ap, "liquidation average price"),
      lastFilledPrice: forceOrder.L === undefined ? undefined : decimal(forceOrder.L, "liquidation fill price"),
    };
    this.touch(symbol);
    this.emit({ type: "liquidation", data: event });
  }

  private scheduleBookRebuild(symbol: string) {
    if (!this.symbols.has(symbol) || this.bookRetryTimers.has(symbol)) return;
    const attempt = (this.bookRetryAttempts.get(symbol) ?? 0) + 1;
    this.bookRetryAttempts.set(symbol, attempt);
    const capped = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5));
    const delay = Math.round(capped * (0.75 + Math.random() * 0.5));
    const timer = setTimeout(() => {
      this.bookRetryTimers.delete(symbol);
      void this.rebuildBook(symbol);
    }, delay);
    this.bookRetryTimers.set(symbol, timer);
  }

  private async rebuildBook(symbol: string) {
    const book = this.books.get(symbol);
    if (!book || this.rebuildingBooks.has(symbol)) return;
    this.rebuildingBooks.add(symbol);
    try {
      const url = new URL(`${BINANCE_REST_URL}/fapi/v1/depth`);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("limit", String(BOOK_DEPTH));
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Binance order-book snapshot failed (${response.status})`);
      const raw = asRecord(await response.json());
      const snapshot: BinanceBookSnapshot = {
        lastUpdateId: decimal(raw?.lastUpdateId, "snapshot update id"),
        bids: Array.isArray(raw?.bids) ? raw.bids as [string, string][] : [],
        asks: Array.isArray(raw?.asks) ? raw.asks as [string, string][] : [],
      };
      if (!book.bootstrap(snapshot)) {
        // Diffs may not yet cover snapshot + 1; retain the buffered stream and retry.
        this.scheduleBookRebuild(symbol);
        return;
      }
      this.bookRetryAttempts.delete(symbol);
      this.touch(symbol);
      this.publishBook(symbol, book, Date.now());
      this.setStatus("live");
    } catch (error) {
      this.setStatus("degraded", error instanceof Error ? error.message : "Binance order-book recovery failed", symbol);
      this.scheduleBookRebuild(symbol);
    } finally {
      this.rebuildingBooks.delete(symbol);
    }
  }

  private async refreshDerivatives(symbol: string) {
    try {
      const url = new URL(`${BINANCE_REST_URL}/fapi/v1/openInterest`);
      url.searchParams.set("symbol", symbol);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Binance open interest failed (${response.status})`);
      const payload = asRecord(await response.json());
      const previous = this.lastDerivative.get(symbol);
      const now = Date.now();
      const next: BinanceDerivativeEvent = {
        type: "derivatives",
        provider: "binance",
        environment: "live",
        symbol,
        exchange: "BINANCE",
        timestamp: previous?.timestamp ?? now,
        markPrice: previous?.markPrice,
        indexPrice: previous?.indexPrice,
        fundingRate: previous?.fundingRate,
        nextFundingTime: previous?.nextFundingTime,
        openInterest: decimal(payload?.openInterest, "open interest"),
        openInterestTimestamp: decimal(payload?.time ?? now, "open interest time"),
        openInterestStatus: "live",
      };
      this.lastDerivative.set(symbol, next);
      this.emit({ type: "derivatives", data: next });
    } catch (error) {
      const previous = this.lastDerivative.get(symbol);
      const next: BinanceDerivativeEvent = {
        type: "derivatives",
        provider: "binance",
        environment: "live",
        symbol,
        exchange: "BINANCE",
        timestamp: previous?.timestamp ?? Date.now(),
        markPrice: previous?.markPrice,
        indexPrice: previous?.indexPrice,
        fundingRate: previous?.fundingRate,
        nextFundingTime: previous?.nextFundingTime,
        openInterestStatus: "unavailable",
        openInterestReason: error instanceof Error ? error.message : "Binance open interest unavailable",
      };
      this.lastDerivative.set(symbol, next);
      this.emit({ type: "derivatives", data: next });
    }
  }

  private publishBook(symbol: string, book: BinanceOrderBook, timestamp: number) {
    const levels = book.levels(BOOK_DEPTH) as DepthLevel[];
    this.emit({ type: "depth", symbol, sequence: book.lastSequence(), timestamp, levels });
    const top = book.bestQuote();
    if (top) {
      this.emit({
        type: "quote",
        data: { type: "quote", provider: "binance", environment: "live", symbol, exchange: "BINANCE", timestamp, sequence: book.lastSequence(), ...top },
      });
    }
  }

  private ensureTimers() {
    if (!this.staleTimer) {
      this.staleTimer = setInterval(() => {
        for (const symbol of this.symbols) {
          const last = this.lastEventAt.get(symbol) ?? 0;
          if (!last || Date.now() - last > STALE_AFTER_MS) this.setStatus("stale", `no ${symbol} event for ${STALE_AFTER_MS / 1000}s`, symbol);
        }
      }, 5_000);
    }
    if (!this.derivativesTimer) {
      this.derivativesTimer = setInterval(() => {
        for (const symbol of this.symbols) void this.refreshDerivatives(symbol);
      }, DERIVATIVES_REFRESH_MS);
    }
  }

  private touch(symbol: string) {
    this.lastEventAt.set(symbol, Date.now());
  }

  private setStatus(state: ProviderStatus, reason?: string, symbol?: string) {
    if (state === this.lastStatus && reason === this.lastReason) return;
    this.lastStatus = state;
    this.lastReason = reason;
    this.emit({ type: "status", state, symbol, reason, updatedAt: Date.now() });
  }

  private emit(event: BinanceEvent) {
    for (const listener of this.listeners) listener(event);
  }
}
