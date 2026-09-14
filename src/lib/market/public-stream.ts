"use client";

import { BinanceDepthSynchronizer, type BinanceDepth, type BinanceSnapshot } from "./public-stream/binance-depth";
import { LocalOrderBook } from "./public-stream/local-book";
import type { DepthEvent, DepthLevel, DerivativesEvent, FeedHealth, LiquidationEvent, QuoteEvent, TradeEvent } from "./types";

export type StreamEvent = TradeEvent | QuoteEvent | DepthEvent | DerivativesEvent | LiquidationEvent;
export type StreamProvider = "binance" | "gateio" | "bybit" | "coinbase";

export interface StreamState {
  state: string;
  provider: StreamProvider;
  environment: "live";
  dataStatus: "LIVE" | "STALE" | "UNAVAILABLE" | "DISCONNECTED";
  reason?: string;
  at: number;
}

export type StreamListener = (event: StreamEvent | FeedHealth) => void;

const DEFAULT_PROVIDER: StreamProvider =
  (process.env.NEXT_PUBLIC_MARKET_PROVIDER as StreamProvider) || "binance";

const ENDPOINTS: Record<StreamProvider, string> = {
  binance: "wss://fstream.binance.com/ws",
  gateio: "wss://fx-ws.gateio.ws/v4/ws/usdt",
  bybit: "wss://stream.bybit.com/v5/public/linear",
  coinbase: "wss://advanced-trade-ws.coinbase.com",
};

const BINANCE_REST_DEPTH_URL =
  process.env.NEXT_PUBLIC_BINANCE_FUTURES_REST_URL || "https://fapi.binance.com";

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric value in stream: ${String(value)}`);
  return parsed;
}

export function normalizeSymbolForProvider(symbol: string, provider: StreamProvider): string {
  const clean = symbol.replace(/[^a-zA-Z0-9_]/g, "").toUpperCase();
  switch (provider) {
    case "gateio":
      return clean.includes("_") ? clean : `${clean.replace(/USDT$/, "")}_USDT`;
    case "bybit":
      return clean.replace("_", "");
    case "coinbase":
      return clean.includes("-") ? clean : `${clean.replace(/USD[T]?$/, "")}-USD`;
    case "binance":
    default:
      return clean.replace("_", "");
  }
}

/**
 * High-performance, client-first public market data connection manager.
 * Connects directly from the browser to public exchange WebSockets without
 * routing high-frequency tick data through intermediate servers.
 */
export class PublicMarketDataProvider {
  private provider: StreamProvider = DEFAULT_PROVIDER;
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<StreamListener>>();
  private stateListeners = new Set<(state: StreamState) => void>();
  private binanceSyncs = new Map<string, BinanceDepthSynchronizer>();
  private fetchingSnapshots = new Set<string>();
  private snapshotRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private snapshotNextAllowedAt = new Map<string, number>();
  private snapshotFailures = new Map<string, number>();
  private snapshotCache = new Map<string, { snapshot: BinanceSnapshot; at: number }>();

  // Gate.io local books
  private gateBooks = new Map<string, { bids: Map<number, number>; asks: Map<number, number>; sequence: number; valid: boolean }>();
  private bybitBooks = new Map<string, { book: LocalOrderBook; sequence: number; valid: boolean }>();
  private coinbaseBooks = new Map<string, { book: LocalOrderBook; sequence: number; valid: boolean }>();

  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private watchdogTimer: ReturnType<typeof setInterval> | undefined;
  private retries = 0;
  private lastMessageAt = 0;
  private symbolLastActivity = new Map<string, number>();

  constructor(provider: StreamProvider = DEFAULT_PROVIDER) {
    this.provider = provider;
  }

  setProvider(provider: StreamProvider) {
    if (this.provider === provider) return;
    this.provider = provider;
    this.cleanupSocket();
    this.binanceSyncs.clear();
    this.gateBooks.clear();
    this.bybitBooks.clear();
    this.coinbaseBooks.clear();
    this.fetchingSnapshots.clear();
    for (const timer of this.snapshotRetryTimers.values()) clearTimeout(timer);
    this.snapshotRetryTimers.clear();
    this.snapshotNextAllowedAt.clear();
    this.snapshotFailures.clear();
    this.snapshotCache.clear();
    if (this.listeners.size > 0) {
      this.connect();
    }
  }

  getProvider(): StreamProvider {
    return this.provider;
  }

  /**
   * Subscribes a listener to updates for a specific symbol.
   * Reference-counted: multiple UI components requesting BTC share 1 stream.
   */
  subscribe(symbol: string, listener: StreamListener): () => void {
    const normalized = normalizeSymbolForProvider(symbol, this.provider);
    const set = this.listeners.get(normalized) ?? new Set<StreamListener>();
    const isFirstSubscription = set.size === 0;

    set.add(listener);
    this.listeners.set(normalized, set);

    this.connect();

    if (isFirstSubscription) {
      this.sendSubscription(normalized, "SUBSCRIBE");
      if (this.provider === "binance") {
        this.initBinanceDepth(normalized);
      }
    }

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(normalized);
        this.binanceSyncs.delete(normalized);
        this.gateBooks.delete(normalized);
        this.bybitBooks.delete(normalized);
        this.coinbaseBooks.delete(normalized);
        this.symbolLastActivity.delete(normalized);
        this.sendSubscription(normalized, "UNSUBSCRIBE");

        if (this.listeners.size === 0) {
          this.cleanupSocket();
        }
      }
    };
  }

  onState(listener: (state: StreamState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.createState("connecting", "DISCONNECTED"));
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private createState(state: string, dataStatus: StreamState["dataStatus"], reason?: string): StreamState {
    return {
      state,
      provider: this.provider,
      environment: "live",
      dataStatus,
      reason,
      at: Date.now(),
    };
  }

  private announce(state: string, dataStatus: StreamState["dataStatus"], reason?: string) {
    const s = this.createState(state, dataStatus, reason);
    for (const listener of this.stateListeners) {
      try {
        listener(s);
      } catch (err) {
        console.error("State listener error:", err);
      }
    }
  }

  private connect() {
    if (this.socket || this.listeners.size === 0) return;

    const endpoint = ENDPOINTS[this.provider];
    this.announce(this.retries > 0 ? "reconnecting" : "connecting", "DISCONNECTED");

    try {
      const socket = (this.socket = new WebSocket(endpoint));

      socket.onopen = () => {
        this.retries = 0;
        this.lastMessageAt = Date.now();
        this.announce("connected", "LIVE");

        // Resubscribe all active symbols
        for (const symbol of this.listeners.keys()) {
          this.sendSubscription(symbol, "SUBSCRIBE");
          if (this.provider === "binance") {
            this.initBinanceDepth(symbol);
          }
        }

        this.startWatchdog();
      };

      socket.onmessage = ({ data }) => {
        this.lastMessageAt = Date.now();
        try {
          const parsed = JSON.parse(String(data));
          this.handleMessage(parsed);
        } catch (error) {
          this.announce(
            "degraded",
            "UNAVAILABLE",
            error instanceof Error ? error.message : "Malformed exchange frame"
          );
        }
      };

      socket.onerror = () => {
        this.announce("degraded", "UNAVAILABLE", `${this.provider} WebSocket error`);
      };

      socket.onclose = () => {
        this.socket = null;
        this.stopWatchdog();
        this.snapshotCache.clear();
        this.bybitBooks.clear();
        this.coinbaseBooks.clear();

        if (this.listeners.size === 0) return;

        this.retries += 1;
        // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s, max 30s + [0..500ms] jitter
        const baseDelay = Math.min(30_000, 1_000 * Math.pow(2, Math.min(this.retries, 5)));
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;

        this.announce("reconnecting", "DISCONNECTED", `Retrying in ${delay}ms`);

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = undefined;
          this.connect();
        }, delay);
      };
    } catch (err) {
      this.socket = null;
      this.announce("degraded", "UNAVAILABLE", `Failed to instantiate WebSocket: ${String(err)}`);
    }
  }

  private cleanupSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.stopWatchdog();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
    for (const timer of this.snapshotRetryTimers.values()) clearTimeout(timer);
    this.snapshotRetryTimers.clear();
    this.snapshotNextAllowedAt.clear();
    this.snapshotFailures.clear();
    this.snapshotCache.clear();
  }

  private startWatchdog() {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.listeners.size > 0) {
        if (now - this.lastMessageAt > 20_000) {
          this.announce("stale", "STALE", "No market frames received for 20s; triggering resync");
          this.socket.close();
        }
      }
    }, 5_000);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }

  private sendSubscription(symbol: string, action: "SUBSCRIBE" | "UNSUBSCRIBE") {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    if (this.provider === "binance") {
      const name = symbol.toLowerCase();
      this.socket.send(
        JSON.stringify({
          method: action,
          params: [
            `${name}@aggTrade`,
            `${name}@bookTicker`,
            `${name}@depth@100ms`,
            `${name}@markPrice@1s`,
            `${name}@forceOrder`,
          ],
          id: Date.now(),
        })
      );
    } else if (this.provider === "gateio") {
      const event = action === "SUBSCRIBE" ? "subscribe" : "unsubscribe";
      const channels = [
        ["futures.trades", [symbol]],
        ["futures.book_ticker", [symbol]],
        ["futures.order_book_update", [symbol, "100ms", "100"]],
      ] as const;
      for (const [channel, payload] of channels) {
        this.socket.send(
          JSON.stringify({
            time: Math.floor(Date.now() / 1000),
            channel,
            event,
            payload,
          })
        );
      }
    } else if (this.provider === "bybit") {
      const op = action === "SUBSCRIBE" ? "subscribe" : "unsubscribe";
      this.socket.send(
        JSON.stringify({
          op,
          args: [`publicTrade.${symbol}`, `tickers.${symbol}`, `orderbook.50.${symbol}`],
        })
      );
    } else if (this.provider === "coinbase") {
      const type = action === "SUBSCRIBE" ? "subscribe" : "unsubscribe";
      for (const channel of ["ticker", "level2"]) {
        this.socket.send(JSON.stringify({ type, product_ids: [symbol], channel }));
      }
    }
  }

  private emit(symbol: string, event: StreamEvent) {
    this.symbolLastActivity.set(symbol, Date.now());
    const targetListeners = this.listeners.get(symbol);
    if (!targetListeners || targetListeners.size === 0) return;

    for (const listener of targetListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Stream subscriber listener error:", err);
      }
    }
  }

  private static binanceGlobalNextAllowedAt = 0;
  private static binanceInFlight = new Map<string, Promise<BinanceSnapshot>>();

  // --- Binance Depth Synchronization ---

  private initBinanceDepth(symbol: string) {
    let sync = this.binanceSyncs.get(symbol);
    if (!sync || sync.status === "ERROR") {
      sync = new BinanceDepthSynchronizer();
      this.binanceSyncs.set(symbol, sync);
    }
    this.fetchBinanceSnapshot(symbol);
  }

  private scheduleBinanceSnapshot(symbol: string, delayMs: number) {
    if (!this.listeners.has(symbol) || this.snapshotRetryTimers.has(symbol)) return;
    const timer = setTimeout(() => {
      this.snapshotRetryTimers.delete(symbol);
      if (this.listeners.has(symbol)) this.fetchBinanceSnapshot(symbol);
    }, Math.max(250, delayMs));
    this.snapshotRetryTimers.set(symbol, timer);
  }

  private snapshotRetryDelay(symbol: string, status?: number, retryAfterMs?: number) {
    const failures = (this.snapshotFailures.get(symbol) ?? 0) + 1;
    this.snapshotFailures.set(symbol, failures);
    if (retryAfterMs !== undefined) return Math.min(120_000, Math.max(1_000, retryAfterMs));
    const cap = status === 418 ? 120_000 : status === 429 ? 60_000 : 30_000;
    const base = status === 418 ? 30_000 : status === 429 ? 5_000 : 1_000;
    return Math.min(cap, base * 2 ** Math.min(failures - 1, 5)) + Math.floor(Math.random() * 500);
  }

  private async fetchBinanceSnapshot(symbol: string) {
    if (this.fetchingSnapshots.has(symbol)) return;

    const cached = this.snapshotCache.get(symbol);
    if (cached && Date.now() - cached.at < 15_000) {
      this.bridgeBinanceSnapshot(symbol, cached.snapshot);
      return;
    }

    const now = Date.now();
    const globalWait = Math.max(0, PublicMarketDataProvider.binanceGlobalNextAllowedAt - now);
    const symbolWait = Math.max(0, (this.snapshotNextAllowedAt.get(symbol) ?? 0) - now);
    const wait = Math.max(globalWait, symbolWait);
    if (wait > 0) {
      this.scheduleBinanceSnapshot(symbol, wait);
      return;
    }

    // Reuse in-flight promise if another component already requested this symbol
    const existingPromise = PublicMarketDataProvider.binanceInFlight.get(symbol);
    if (existingPromise) {
      try {
        const data = await existingPromise;
        this.bridgeBinanceSnapshot(symbol, data);
      } catch {
        // Handled by original caller
      }
      return;
    }

    this.fetchingSnapshots.add(symbol);
    // Pace snapshots globally: at least 1,000ms between REST requests across all symbols
    PublicMarketDataProvider.binanceGlobalNextAllowedAt = Date.now() + 1_000;

    const fetchPromise = (async () => {
      // Use limit=100 (weight 5 vs weight 20 for limit=1000)
      const url = `${BINANCE_REST_DEPTH_URL}/fapi/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=100`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : undefined;
        const delay = this.snapshotRetryDelay(symbol, response.status, retryAfterMs);
        const globalBlock = response.status === 418 ? 120_000 : response.status === 429 ? 30_000 : 0;
        if (globalBlock > 0) {
          PublicMarketDataProvider.binanceGlobalNextAllowedAt = Math.max(
            PublicMarketDataProvider.binanceGlobalNextAllowedAt,
            Date.now() + (retryAfterMs ?? globalBlock),
          );
        }
        this.snapshotNextAllowedAt.set(symbol, Date.now() + delay);
        throw new Error(`Binance depth snapshot HTTP ${response.status}; retrying in ${delay}ms`);
      }
      return (await response.json()) as BinanceSnapshot;
    })();

    PublicMarketDataProvider.binanceInFlight.set(symbol, fetchPromise);

    try {
      const data = await fetchPromise;
      this.snapshotFailures.delete(symbol);
      this.snapshotNextAllowedAt.delete(symbol);
      this.snapshotCache.set(symbol, { snapshot: data, at: Date.now() });
      this.bridgeBinanceSnapshot(symbol, data);
    } catch (err) {
      const delay = this.snapshotNextAllowedAt.get(symbol) ?? Date.now() + this.snapshotRetryDelay(symbol);
      if (!this.snapshotNextAllowedAt.has(symbol)) this.snapshotNextAllowedAt.set(symbol, delay);
      this.announce("syncing", "STALE", `Binance ${symbol} snapshot fetch failed: ${String(err)}`);
      this.scheduleBinanceSnapshot(symbol, Math.max(0, delay - Date.now()));
    } finally {
      this.fetchingSnapshots.delete(symbol);
      PublicMarketDataProvider.binanceInFlight.delete(symbol);
    }
  }

  private bridgeBinanceSnapshot(symbol: string, data: BinanceSnapshot) {
    const sync = this.binanceSyncs.get(symbol);
    if (!sync) return;
    const bridged = sync.bridge(data);
    if (bridged && sync.status === "LIVE") {
      this.emitBinanceDepth(symbol, sync);
      return;
    }
    // If status is still SYNCING, the snapshot is pending while buffered deltas catch up
    if (sync.status === "SYNCING") {
      return;
    }
    this.announce("syncing", "STALE", `Binance ${symbol} snapshot bridging failed; waiting for a safe resync`);
    this.binanceSyncs.delete(symbol);
    const delay = this.snapshotRetryDelay(symbol);
    this.snapshotNextAllowedAt.set(symbol, Date.now() + delay);
    this.scheduleBinanceSnapshot(symbol, delay);
  }

  private emitBinanceDepth(symbol: string, sync: BinanceDepthSynchronizer) {
    const bids = sync.book.top("buy", 100);
    const asks = sync.book.top("sell", 100);
    const levels: DepthLevel[] = [...bids, ...asks];

    this.emit(symbol, {
      type: "depth",
      provider: "binance",
      environment: "live",
      symbol,
      exchange: "BINANCE",
      timestamp: Date.now(),
      sequence: Date.now(),
      levels,
    });
  }

  // --- Message Handling ---

  private handleMessage(message: Record<string, unknown>) {
    try {
      if (this.provider === "binance") {
        this.handleBinanceMessage(message);
      } else if (this.provider === "gateio") {
        this.handleGateioMessage(message);
      } else if (this.provider === "bybit") {
        this.handleBybitMessage(message);
      } else if (this.provider === "coinbase") {
        this.handleCoinbaseMessage(message);
      }
    } catch (error) {
      // Exchanges occasionally send control/error frames with missing numeric fields.
      // Ignore only those malformed frames; a valid stream must remain connected.
      if (!String(error).includes("Invalid numeric value")) throw error;
    }
  }

  private handleBinanceMessage(raw: Record<string, unknown>) {
    const eventType = String(raw.e ?? "");
    const symbol = String(raw.s ?? raw.S ?? "").toUpperCase();
    if (!symbol) return;

    if (eventType === "aggTrade") {
      this.emit(symbol, {
        type: "trade",
        provider: "binance",
        environment: "live",
        symbol,
        exchange: "BINANCE",
        timestamp: safeNumber(raw.T),
        sequence: safeNumber(raw.a),
        price: safeNumber(raw.p),
        quantity: safeNumber(raw.q),
        side: raw.m === true ? "sell" : "buy",
      });
    } else if (eventType === "bookTicker") {
      this.emit(symbol, {
        type: "quote",
        provider: "binance",
        environment: "live",
        symbol,
        exchange: "BINANCE",
        timestamp: safeNumber(raw.E),
        sequence: safeNumber(raw.u),
        bid: safeNumber(raw.b),
        ask: safeNumber(raw.a),
        bidSize: safeNumber(raw.B),
        askSize: safeNumber(raw.A),
      });
    } else if (eventType === "depthUpdate") {
      let sync = this.binanceSyncs.get(symbol);
      if (!sync) {
        sync = new BinanceDepthSynchronizer();
        this.binanceSyncs.set(symbol, sync);
        this.fetchBinanceSnapshot(symbol);
      }

      const delta: BinanceDepth = {
        U: safeNumber(raw.U),
        u: safeNumber(raw.u),
        pu: raw.pu !== undefined ? safeNumber(raw.pu) : undefined,
        b: Array.isArray(raw.b) ? (raw.b as [string, string][]) : [],
        a: Array.isArray(raw.a) ? (raw.a as [string, string][]) : [],
      };

      sync.push(delta);

      if (sync.status === "LIVE") {
        this.emitBinanceDepth(symbol, sync);
      } else if (sync.status === "ERROR") {
        this.announce("syncing", "STALE", `Binance ${symbol} depth sequence gap detected; resyncing`);
        this.binanceSyncs.delete(symbol);
        const delay = this.snapshotRetryDelay(symbol);
        this.snapshotNextAllowedAt.set(symbol, Date.now() + delay);
        this.scheduleBinanceSnapshot(symbol, delay);
      }
    } else if (eventType === "forceOrder") {
      const order = raw.o as Record<string, unknown> | undefined;
      if (order) {
        this.emit(symbol, {
          type: "liquidation",
          provider: "binance",
          environment: "live",
          symbol,
          exchange: "BINANCE",
          timestamp: safeNumber(order.T),
          sequence: safeNumber(order.T),
          averagePrice: safeNumber(order.ap ?? order.p),
          lastFilledPrice: safeNumber(order.p),
          quantity: safeNumber(order.q),
          side: String(order.S).toLowerCase() === "buy" ? "buy" : "sell",
        });
      }
    }
  }

  private handleGateioMessage(message: Record<string, unknown>) {
    const channel = message.channel;
    const result = message.result;

    if (channel === "futures.trades" && Array.isArray(result)) {
      for (const value of result) {
        const trade = value as Record<string, unknown>;
        if (
          trade.size == null ||
          trade.price == null ||
          trade.contract == null ||
          trade.id == null ||
          (trade.create_time_ms == null && trade.create_time == null)
        ) continue;
        const size = safeNumber(trade.size);
        const symbol = String(trade.contract);
        this.emit(symbol, {
          type: "trade",
          provider: "gateio",
          environment: "live",
          symbol,
          exchange: "GATEIO",
          timestamp:
            safeNumber(trade.create_time_ms ?? trade.create_time) *
            (trade.create_time_ms ? 1 : 1000),
          sequence: safeNumber(trade.id),
          price: safeNumber(trade.price),
          quantity: Math.abs(size),
          side: size >= 0 ? "buy" : "sell",
        });
      }
    } else if (channel === "futures.book_ticker") {
      if (!result || typeof result !== "object") return;
      const quote = result as Record<string, unknown>;
      if (quote.s == null || quote.b == null || quote.a == null || quote.B == null || quote.A == null) return;
      const symbol = String(quote.s);
      this.emit(symbol, {
        type: "quote",
        provider: "gateio",
        environment: "live",
        symbol,
        exchange: "GATEIO",
        timestamp: safeNumber(quote.t ?? Date.now()),
        sequence: safeNumber(quote.id ?? Date.now()),
        bid: safeNumber(quote.b),
        ask: safeNumber(quote.a),
        bidSize: Math.abs(safeNumber(quote.B)),
        askSize: Math.abs(safeNumber(quote.A)),
      });
    } else if (channel === "futures.order_book_update") {
      this.handleGateioDepth(result as Record<string, unknown>);
    }
  }

  private handleGateioDepth(raw: Record<string, unknown>) {
    if (!raw || typeof raw !== "object" || raw.s == null) return;
    const symbol = String(raw.s);
    const book = this.gateBooks.get(symbol) ?? {
      bids: new Map<number, number>(),
      asks: new Map<number, number>(),
      sequence: 0,
      valid: false,
    };

    const apply = (levels: unknown, target: Map<number, number>) => {
      for (const level of Array.isArray(levels) ? levels : []) {
        const entry = level as Record<string, unknown>;
        if (entry.p == null || entry.s == null) continue;
        const price = safeNumber(entry.p);
        const size = Math.abs(safeNumber(entry.s));
        if (size > 0) target.set(price, size);
        else target.delete(price);
      }
    };

    if (raw.full === true) {
      book.bids.clear();
      book.asks.clear();
      book.valid = true;
    }

    apply(raw.b, book.bids);
    apply(raw.a, book.asks);
    book.sequence = safeNumber(raw.u);
    this.gateBooks.set(symbol, book);

    if (book.valid) {
      const levels: DepthLevel[] = [
        ...[...book.bids.entries()]
          .sort(([a], [b]) => b - a)
          .slice(0, 100)
          .map(([price, size]) => ({ price, size, side: "buy" as const })),
        ...[...book.asks.entries()]
          .sort(([a], [b]) => a - b)
          .slice(0, 100)
          .map(([price, size]) => ({ price, size, side: "sell" as const })),
      ];

      this.emit(symbol, {
        type: "depth",
        provider: "gateio",
        environment: "live",
        symbol,
        exchange: "GATEIO",
        timestamp: Date.now(),
        sequence: book.sequence,
        levels,
      });
    }
  }

  private handleBybitMessage(message: Record<string, unknown>) {
    const topic = String(message.topic ?? "");
    const data = message.data;
    if (!topic || !data) return;

    if (topic.startsWith("orderbook.")) {
      const payload = data as Record<string, unknown>;
      const symbol = String(payload.s ?? topic.split(".").at(-1) ?? "");
      const updateId = safeNumber(payload.u);
      const current = this.bybitBooks.get(symbol) ?? { book: new LocalOrderBook(), sequence: 0, valid: false };
      const type = String(message.type ?? "");
      if (type === "snapshot") {
        current.book.clear();
        current.sequence = updateId;
        current.valid = true;
      } else if (!current.valid || updateId <= current.sequence || updateId > current.sequence + 1) {
        current.valid = false;
        this.bybitBooks.set(symbol, current);
        this.announce("syncing", "STALE", `Bybit ${symbol} order-book sequence gap; resync required`);
        return;
      }
      const apply = (rows: unknown, side: "buy" | "sell") => {
        for (const row of Array.isArray(rows) ? rows : []) {
          if (!Array.isArray(row) || row.length < 2) continue;
          current.book.apply(side, String(row[0]), String(row[1]));
        }
      };
      apply(payload.b, "buy"); apply(payload.a, "sell");
      current.sequence = updateId;
      this.bybitBooks.set(symbol, current);
      if (current.valid) this.emitDepth(symbol, "bybit", "BYBIT", current.book, current.sequence);
      return;
    }

    if (topic.startsWith("publicTrade.")) {
      const trades = Array.isArray(data) ? data : [data];
      for (const t of trades) {
        const trade = t as Record<string, unknown>;
        const symbol = String(trade.s);
        this.emit(symbol, {
          type: "trade",
          provider: "bybit",
          environment: "live",
          symbol,
          exchange: "BYBIT",
          timestamp: safeNumber(trade.T),
          sequence: safeNumber(trade.i ?? Date.now()),
          price: safeNumber(trade.p),
          quantity: safeNumber(trade.v),
          side: String(trade.S).toLowerCase() === "buy" ? "buy" : "sell",
        });
      }
    } else if (topic.startsWith("tickers.")) {
      const ticker = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
      if (ticker) {
        const symbol = String(ticker.symbol);
        this.emit(symbol, {
          type: "quote",
          provider: "bybit",
          environment: "live",
          symbol,
          exchange: "BYBIT",
          timestamp: safeNumber(message.ts ?? Date.now()),
          sequence: safeNumber(message.ts ?? Date.now()),
          bid: safeNumber(ticker.bid1Price ?? ticker.lastPrice),
          ask: safeNumber(ticker.ask1Price ?? ticker.lastPrice),
          bidSize: safeNumber(ticker.bid1Size ?? 1),
          askSize: safeNumber(ticker.ask1Size ?? 1),
        });
      }
    }
  }

  private handleCoinbaseMessage(message: Record<string, unknown>) {
    if (message.channel === "l2_data" && Array.isArray(message.events)) {
      const sequence = safeNumber(message.sequence_num);
      for (const event of message.events as Record<string, unknown>[]) {
        const symbol = String(event.product_id);
        const updates = Array.isArray(event.updates) ? event.updates : [];
        const current = this.coinbaseBooks.get(symbol) ?? { book: new LocalOrderBook(), sequence: -1, valid: false };
        if (event.type === "snapshot") {
          current.book.clear(); current.valid = true;
        } else if (!current.valid || sequence <= current.sequence || sequence > current.sequence + 1) {
          current.valid = false;
          this.coinbaseBooks.set(symbol, current);
          this.announce("syncing", "STALE", `Coinbase ${symbol} level2 sequence gap; resync required`);
          continue;
        }
        for (const update of updates as Record<string, unknown>[]) {
          const side = update.side === "bid" ? "buy" : update.side === "offer" ? "sell" : undefined;
          if (!side || update.price_level == null || update.new_quantity == null) continue;
          current.book.apply(side, String(update.price_level), String(update.new_quantity));
        }
        current.sequence = sequence;
        this.coinbaseBooks.set(symbol, current);
        if (current.valid) this.emitDepth(symbol, "coinbase", "COINBASE", current.book, current.sequence);
      }
      return;
    }
    if (message.channel === "ticker" && Array.isArray(message.events)) {
      for (const event of message.events as Record<string, unknown>[]) {
        if (Array.isArray(event.tickers)) {
          for (const t of event.tickers as Record<string, unknown>[]) {
            const symbol = String(t.product_id);
            this.emit(symbol, {
              type: "quote",
              provider: "coinbase",
              environment: "live",
              symbol,
              exchange: "COINBASE",
              timestamp: Date.now(),
              sequence: Date.now(),
              bid: safeNumber(t.best_bid),
              ask: safeNumber(t.best_ask),
              bidSize: safeNumber(t.best_bid_quantity ?? 1),
              askSize: safeNumber(t.best_ask_quantity ?? 1),
            });
          }
        }
      }
    }
  }

  private emitDepth(symbol: string, provider: "bybit" | "coinbase", exchange: "BYBIT" | "COINBASE", book: LocalOrderBook, sequence: number) {
    this.emit(symbol, {
      type: "depth", provider, environment: "live", symbol, exchange,
      timestamp: Date.now(), sequence,
      levels: [...book.top("buy", 100), ...book.top("sell", 100)],
    });
  }
}

export const publicMarketData = new PublicMarketDataProvider();
