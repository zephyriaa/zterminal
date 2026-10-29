"use client";

import { BinanceDepthSynchronizer, type BinanceDepth, type BinanceSnapshot } from "./public-stream/binance-depth";
import { LocalOrderBook } from "./public-stream/local-book";
import { OKXDepthSynchronizer, type OKXBookPayload } from "./adapters/okx-l2-adapter";
import { normalizeOkxInstrument } from "./okx";
import { GateOrderBook, type GateBookDelta, type GateBookSnapshot } from "./gate-order-book";
import { GATEIO_REST_URL } from "./gateio";
import { getContract } from "./contracts";
import { publicFetch } from "./public-data";
import type { DataStatus, DepthEvent, DepthLevel, DerivativesEvent, FeedHealth, LiquidationEvent, QuoteEvent, TradeEvent } from "./types";

export type StreamEvent = TradeEvent | QuoteEvent | DepthEvent | DerivativesEvent | LiquidationEvent;
export type StreamProvider = "binance" | "gateio" | "bybit" | "coinbase" | "okx";

export interface StreamState {
  state: string;
  provider: StreamProvider;
  environment: "live";
  dataStatus: "LIVE" | "STALE" | "UNAVAILABLE" | "DISCONNECTED" | "DEGRADED";
  reason?: string;
  at: number;
}

export type StreamListener = (event: StreamEvent | FeedHealth) => void;

const DEFAULT_PROVIDER: StreamProvider =
  (process.env.NEXT_PUBLIC_MARKET_PROVIDER as StreamProvider) || "binance";

const ENDPOINTS: Record<StreamProvider, string> = {
  binance: "wss://fstream.binance.com/public/ws",
  gateio: "wss://fx-ws.gateio.ws/v4/ws/usdt",
  bybit: "wss://stream.bybit.com/v5/public/linear",
  coinbase: "wss://advanced-trade-ws.coinbase.com",
  okx: "wss://ws.okx.com:8443/ws/v5/public",
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
    case "okx":
      return normalizeOkxInstrument(clean);
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
  private marketSocket: WebSocket | null = null;
  private marketRetry: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Map<string, Set<StreamListener>>();
  private stateListeners = new Set<(state: StreamState) => void>();
  private binanceSyncs = new Map<string, BinanceDepthSynchronizer>();
  private okxSyncs = new Map<string, OKXDepthSynchronizer>();
  private fetchingSnapshots = new Set<string>();
  private snapshotRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private snapshotNextAllowedAt = new Map<string, number>();
  private snapshotFailures = new Map<string, number>();
  private snapshotCache = new Map<string, { snapshot: BinanceSnapshot; at: number }>();

  // Gate.io local books
  private gateBooks = new Map<string, GateOrderBook>();
  private gateSnapshots = new Map<string, AbortController>();
  private feedHealth = new Map<string, FeedHealth>();
  private epoch = 0;
  private bybitBooks = new Map<string, { book: LocalOrderBook; sequence: number; valid: boolean }>();
  private coinbaseBooks = new Map<string, { book: LocalOrderBook; sequence: number; valid: boolean }>();

  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private watchdogTimer: ReturnType<typeof setInterval> | undefined;
  private handshakeTimer: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private lastMessageAt = 0;
  private symbolLastActivity = new Map<string, number>();

  constructor(provider: StreamProvider = DEFAULT_PROVIDER) {
    this.provider = provider;
  }

  setProvider(provider: StreamProvider) {
    if (this.provider === provider) return;
    this.cleanupSocket();
    this.provider = provider;
    this.retries = 0;
    this.feedHealth.clear();
    this.binanceSyncs.clear();
    this.okxSyncs.clear();
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

  reconnect(force = false) { if (!force && this.socket?.readyState === WebSocket.OPEN) return; this.cleanupSocket(); this.retries = 0; this.connect(); }
  disconnect() { this.cleanupSocket(); this.announce("disconnected", "DISCONNECTED"); }

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

    if (isFirstSubscription && this.socket?.readyState === WebSocket.OPEN) {
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
        this.okxSyncs.delete(normalized);
        this.gateBooks.delete(normalized);
        this.bybitBooks.delete(normalized);
        this.coinbaseBooks.delete(normalized);
        this.symbolLastActivity.delete(normalized);
        this.feedHealth.delete(normalized);
        this.gateSnapshots.get(normalized)?.abort();
        this.gateSnapshots.delete(normalized);
        const retry = this.snapshotRetryTimers.get(normalized);
        if (retry) clearTimeout(retry);
        this.snapshotRetryTimers.delete(normalized);
        this.snapshotCache.delete(normalized); this.fetchingSnapshots.delete(normalized);
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
    const epoch = this.epoch;
    this.announce(this.retries > 0 ? "reconnecting" : "connecting", "DISCONNECTED");

    try {
      const socket = (this.socket = new WebSocket(endpoint));

      this.handshakeTimer = setTimeout(() => {
        if (socket && socket.readyState !== WebSocket.OPEN) {
          this.announce("degraded", "UNAVAILABLE", `${this.provider} WebSocket handshake timeout (5000ms)`);
          // Forcibly close the stalled socket, triggering onclose and reconnect logic
          socket.close();
        }
      }, 5_000);

      socket.onopen = () => {
        if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
        this.retries = 0;
        this.lastMessageAt = Date.now();
        this.announce("connected", "DISCONNECTED", "Waiting for verified instrument observations");
        if (this.provider === "binance") this.connectBinanceMarket();

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
        if (epoch !== this.epoch || socket !== this.socket) return;
        this.lastMessageAt = Date.now();
        const text = String(data).trim();
        if (text === "pong" || text === "PONG") {
          return;
        }
        try {
          const parsed = JSON.parse(text);
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
        this.epoch++; this.cleanupBinanceMarket();
        this.binanceSyncs.clear(); this.fetchingSnapshots.clear(); this.gateBooks.clear();
        for (const request of this.gateSnapshots.values()) request.abort();
        this.gateSnapshots.clear(); this.feedHealth.clear();
        for (const timer of this.snapshotRetryTimers.values()) clearTimeout(timer);
        this.snapshotRetryTimers.clear();
        this.snapshotCache.clear();
        this.okxSyncs.clear();
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
    this.epoch++; this.cleanupBinanceMarket();
    this.binanceSyncs.clear(); this.fetchingSnapshots.clear(); this.gateBooks.clear(); this.feedHealth.clear();
    for (const request of this.gateSnapshots.values()) request.abort();
    this.gateSnapshots.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = undefined;
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
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        if (this.provider === "okx") {
          try {
            this.socket.send("ping");
          } catch {}
        }
        if (this.listeners.size > 0 && now - this.lastMessageAt > 20_000) {
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

  private sendBinanceMarket(symbol: string, method: "SUBSCRIBE" | "UNSUBSCRIBE") {
    if (this.marketSocket?.readyState !== WebSocket.OPEN) return;
    const name = symbol.toLowerCase();
    this.marketSocket.send(JSON.stringify({ method, params: [`${name}@aggTrade`, `${name}@markPrice@1s`, `${name}@forceOrder`], id: Date.now() }));
  }

  private cleanupBinanceMarket() {
    if (this.marketRetry) clearTimeout(this.marketRetry);
    this.marketRetry = undefined;
    if (!this.marketSocket) return;
    const previous = this.marketSocket; this.marketSocket = null;
    previous.onopen = previous.onmessage = previous.onerror = previous.onclose = null;
    previous.close();
  }

  private connectBinanceMarket() {
    if (this.marketSocket || this.provider !== "binance" || !this.listeners.size) return;
    const socket = this.marketSocket = new WebSocket("wss://fstream.binance.com/market/ws"), epoch = this.epoch;
    socket.onopen = () => { if (socket === this.marketSocket) for (const symbol of this.listeners.keys()) this.sendBinanceMarket(symbol, "SUBSCRIBE"); };
    socket.onmessage = ({ data }) => {
      if (epoch !== this.epoch || socket !== this.marketSocket) return;
      try { this.handleMessage(JSON.parse(String(data))); } catch { /* The affected stream's health expires without fabricated data. */ }
    };
    socket.onclose = () => {
      if (socket !== this.marketSocket || epoch !== this.epoch) return;
      this.marketSocket = null;
      for (const symbol of this.listeners.keys()) {
        const previous = this.health(symbol);
        const next: FeedHealth = { ...previous, state: "DEGRADED", lastMessageAt: undefined, reason: "Binance trade stream disconnected; reconnecting", streams: { trades: { state: "UNAVAILABLE" }, depth: previous.streams!.depth } };
        this.feedHealth.set(symbol, next);
        for (const listener of this.listeners.get(symbol) ?? []) listener(next);
      }
      if (this.listeners.size) this.marketRetry = setTimeout(() => { this.marketRetry = undefined; this.connectBinanceMarket(); }, 5000);
    };
    socket.onerror = () => socket.close();
  }

  private sendSubscription(symbol: string, action: "SUBSCRIBE" | "UNSUBSCRIBE") {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    if (this.provider === "binance") {
      const name = symbol.toLowerCase();
      this.socket.send(
        JSON.stringify({
          method: action,
          params: [
            `${name}@bookTicker`,
            `${name}@depth@100ms`,
          ],
          id: Date.now(),
        })
      );
      this.sendBinanceMarket(symbol, action);
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
      if (action === "SUBSCRIBE") this.initGateDepth(symbol);
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
    } else if (this.provider === "okx") {
      const op = action === "SUBSCRIBE" ? "subscribe" : "unsubscribe";
      this.socket.send(
        JSON.stringify({
          op,
          args: [
            { channel: "trades", instId: symbol },
            { channel: "tickers", instId: symbol },
            { channel: "books", instId: symbol },
          ],
        })
      );
    }
  }

  health(symbol: string): FeedHealth {
    const now = Date.now(), old = this.feedHealth.get(symbol);
    const lastTrade = old?.streams?.trades.lastMessageAt;
    const lastDepth = old?.lastDepthAt;
    const trades = lastTrade && now - lastTrade <= 15000 && lastTrade <= now ? "LIVE" : lastTrade ? "STALE" : "SYNCING";
    const depth = old?.depthReady && lastDepth && now - lastDepth <= 15000 && lastDepth <= now ? "LIVE" : old?.depthReady ? "STALE" : old?.streams?.depth.state ?? "SYNCING";
    return { provider: this.provider, symbol, state: trades === "LIVE" && depth === "LIVE" ? "LIVE" : trades === "STALE" || depth === "STALE" ? "STALE" : "DEGRADED", updatedAt: now, lastMessageAt: lastTrade, lastDepthAt: lastDepth, depthReady: depth === "LIVE", sequence: old?.sequence, reason: old?.reason,
      streams: { trades: { state: trades, lastMessageAt: lastTrade }, depth: { state: depth, lastMessageAt: lastDepth, reason: old?.reason } } };
  }

  private invalidateDepth(symbol: string, state: "GAP_DETECTED" | "UNAVAILABLE", reason: string) {
    const previous = this.health(symbol);
    const next: FeedHealth = { ...previous, state: "DEGRADED", depthReady: false, reason, streams: { trades: previous.streams!.trades, depth: { state, reason } } };
    this.feedHealth.set(symbol, next);
    for (const listener of this.listeners.get(symbol) ?? []) listener(next);
  }

  private emit(symbol: string, event: StreamEvent) {
    if (event.provider !== this.provider || event.environment !== "live") return;
    if (event.type === "trade" && (!Number.isSafeInteger(event.sequence) || event.sequence < 0 || !Number.isFinite(event.price) || event.price <= 0 || !Number.isFinite(event.quantity) || event.quantity <= 0)) return;
    if (event.type === "depth") {
      const bids = event.levels.filter(level => level.side === "buy"), asks = event.levels.filter(level => level.side === "sell");
      if (!Number.isSafeInteger(event.sequence) || !bids.length || !asks.length || event.levels.some(level => !Number.isFinite(level.price) || level.price <= 0 || !Number.isFinite(level.size) || level.size <= 0) || Math.max(...bids.map(level => level.price)) >= Math.min(...asks.map(level => level.price))) {
        this.invalidateDepth(symbol, "GAP_DETECTED", "Invalid or incomplete order book"); return;
      }
    }
    if (event.type === "quote" && (!(event.bid > 0) || !(event.ask > event.bid) || !Number.isFinite(event.bidSize) || event.bidSize < 0 || !Number.isFinite(event.askSize) || event.askSize < 0)) return;
    if (!Number.isFinite(event.timestamp) || event.timestamp <= 0) return;
    if (event.timestamp > Date.now() + 5000) {
      this.announce("degraded", "UNAVAILABLE", `Exchange timestamp is ${((event.timestamp - Date.now()) / 1000).toFixed(1)}s ahead of this device clock. Synchronize Windows date/time, then reconnect the feed.`);
      return;
    }
    const now = Date.now();
    this.symbolLastActivity.set(symbol, now);
    const targetListeners = this.listeners.get(symbol);
    if (!targetListeners?.size) return;
    if (event.type === "trade" || event.type === "depth") {
      const previous = this.health(symbol);
      this.feedHealth.set(symbol, { ...previous, reason: event.type === "depth" ? undefined : previous.reason, depthReady: event.type === "depth" || previous.depthReady,
        lastMessageAt: event.type === "trade" ? now : previous.lastMessageAt, lastDepthAt: event.type === "depth" ? now : previous.lastDepthAt,
        sequence: event.type === "depth" ? event.sequence : previous.sequence,
        streams: { trades: event.type === "trade" ? { state: "LIVE", lastMessageAt: now } : previous.streams!.trades, depth: event.type === "depth" ? { state: "LIVE", lastMessageAt: now } : previous.streams!.depth } });
      const health = this.health(symbol);
      for (const listener of targetListeners) listener(health);
    }
    for (const listener of targetListeners) {
      try { listener(event); } catch (err) { console.error("Stream subscriber listener error:", err); }
    }
  }

  private async initGateDepth(symbol: string) {
    if (this.gateSnapshots.has(symbol)) return;
    const book = this.gateBooks.get(symbol) ?? new GateOrderBook();
    this.gateBooks.set(symbol, book);
    const controller = new AbortController(), epoch = this.epoch;
    this.gateSnapshots.set(symbol, controller);
    try {
      const response = await publicFetch(`${GATEIO_REST_URL}/futures/usdt/order_book?contract=${encodeURIComponent(symbol)}&limit=100&with_id=true`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (!response.ok) throw new Error(`Gate.io depth snapshot HTTP ${response.status}`);
      const raw = await response.json();
      if (epoch !== this.epoch || this.provider !== "gateio" || !this.listeners.has(symbol) || this.gateBooks.get(symbol) !== book) return;
      const snapshot: GateBookSnapshot = { id: Number(raw.id), current: raw.current, update: raw.update, bids: raw.bids.map((row: { p: string; s: string }) => [row.p, String(row.s)]), asks: raw.asks.map((row: { p: string; s: string }) => [row.p, String(row.s)]) };
      if (book.bootstrap(snapshot)) this.emitGateDepth(symbol, book, Number(raw.update) * 1000);
    } catch (error) {
      if (epoch !== this.epoch || controller.signal.aborted || !this.listeners.has(symbol)) return;
      book.reset();
      this.invalidateDepth(symbol, "UNAVAILABLE", String(error));
      this.scheduleGateSnapshot(symbol, 30000);
    } finally { if (this.gateSnapshots.get(symbol) === controller) this.gateSnapshots.delete(symbol); }
  }

  private scheduleGateSnapshot(symbol: string, delay = 1000) {
    if (!this.socket || !this.listeners.has(symbol) || this.snapshotRetryTimers.has(symbol)) return;
    this.snapshotRetryTimers.set(symbol, setTimeout(() => {
      this.snapshotRetryTimers.delete(symbol);
      if (this.provider === "gateio" && this.listeners.has(symbol)) void this.initGateDepth(symbol);
    }, delay));
  }

  private emitGateDepth(symbol: string, book: GateOrderBook, timestamp: number) {
    if (!book.isReady() || !book.bestQuote()) return;
    this.emit(symbol, { type: "depth", provider: "gateio", environment: "live", symbol, exchange: "GATEIO", timestamp: timestamp > 0 ? timestamp : Date.now(), sequence: book.lastSequence(), levels: book.levels(100) });
  }

  private static binanceGlobalNextAllowedAt = 0;

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

    if (!this.binanceSyncs.has(symbol)) this.binanceSyncs.set(symbol, new BinanceDepthSynchronizer());
    const cached = this.snapshotCache.get(symbol);
    if (cached && Date.now() - cached.at < 15_000) {
      this.bridgeBinanceSnapshot(symbol, cached.snapshot);
      return;
    }

    const epoch = this.epoch, expectedSync = this.binanceSyncs.get(symbol);
    const now = Date.now();
    const globalWait = Math.max(0, PublicMarketDataProvider.binanceGlobalNextAllowedAt - now);
    const symbolWait = Math.max(0, (this.snapshotNextAllowedAt.get(symbol) ?? 0) - now);
    const wait = Math.max(globalWait, symbolWait);
    if (wait > 0) {
      this.scheduleBinanceSnapshot(symbol, wait);
      return;
    }

    this.fetchingSnapshots.add(symbol);
    // Pace snapshots globally: at least 1,000ms between REST requests across all symbols
    PublicMarketDataProvider.binanceGlobalNextAllowedAt = Date.now() + 1_000;

    const fetchPromise = (async () => {
      // Use limit=100 (weight 5 vs weight 20 for limit=1000)
      const url = `${BINANCE_REST_DEPTH_URL}/fapi/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=100`;
      const response = await publicFetch(url, { cache: "no-store" });
      return (await response.json()) as BinanceSnapshot;
    })();

    try {
      const data = await fetchPromise;
      if (epoch !== this.epoch || this.provider !== "binance" || !this.listeners.has(symbol) || this.binanceSyncs.get(symbol) !== expectedSync) return;
      this.snapshotFailures.delete(symbol);
      this.snapshotNextAllowedAt.delete(symbol);
      this.snapshotCache.set(symbol, { snapshot: data, at: Date.now() });
      this.bridgeBinanceSnapshot(symbol, data);
    } catch (err) {
      if (epoch !== this.epoch || !this.listeners.has(symbol) || this.binanceSyncs.get(symbol) !== expectedSync) return;
      this.invalidateDepth(symbol, "UNAVAILABLE", String(err));
      const delay = this.snapshotNextAllowedAt.get(symbol) ?? Date.now() + this.snapshotRetryDelay(symbol);
      if (!this.snapshotNextAllowedAt.has(symbol)) this.snapshotNextAllowedAt.set(symbol, delay);
      this.announce("syncing", "STALE", `Binance ${symbol} snapshot fetch failed: ${String(err)}`);
      this.scheduleBinanceSnapshot(symbol, Math.max(0, delay - Date.now()));
    } finally {
      if (this.binanceSyncs.get(symbol) === expectedSync) this.fetchingSnapshots.delete(symbol);
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
    this.fetchingSnapshots.delete(symbol);
    this.snapshotCache.delete(symbol);
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
      sequence: sync.lastSequence(),
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
      } else if (this.provider === "okx") {
        this.handleOkxMessage(message);
      }
    } catch (error) {
      // Exchanges occasionally send control/error frames with missing numeric fields.
      // Ignore only those malformed frames; a valid stream must remain connected.
      if (!String(error).includes("Invalid numeric value")) throw error;
    }
  }

  private handleBinanceMessage(raw: Record<string, unknown>) {
    const eventType = String(raw.e ?? "");
    const symbol = String(raw.s ?? raw.S ?? (raw.o as Record<string, unknown> | undefined)?.s ?? "").toUpperCase();
    if (!symbol) return;

    if (eventType === "aggTrade") {
      if (typeof raw.m !== "boolean") return;
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
        conditions: ["aggregate-trade"],
        quantityUnit: "base",
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

      try {
        if (!Array.isArray(raw.b) || !Array.isArray(raw.a)) throw new Error("Missing Binance depth levels");
        const delta: BinanceDepth = {
          U: safeNumber(raw.U), u: safeNumber(raw.u),
          pu: raw.pu !== undefined ? safeNumber(raw.pu) : undefined,
          b: raw.b as [string, string][], a: raw.a as [string, string][],
        };
        sync.push(delta);
        if (sync.status === "ERROR") throw new Error("Binance depth sequence or level validation failed");
        if (sync.status === "LIVE") this.emitBinanceDepth(symbol, sync);
      } catch (error) {
        this.invalidateDepth(symbol, "GAP_DETECTED", `Binance ${symbol}: ${String(error)}; resynchronizing`);
        this.binanceSyncs.delete(symbol);
        this.fetchingSnapshots.delete(symbol);
        this.snapshotCache.delete(symbol);
        const delay = this.snapshotRetryDelay(symbol);
        this.snapshotNextAllowedAt.set(symbol, Date.now() + delay);
        this.scheduleBinanceSnapshot(symbol, delay);
      }
    } else if (eventType === "markPriceUpdate") {
      this.emit(symbol, { type: "derivatives", provider: "binance", environment: "live", symbol, exchange: "BINANCE", timestamp: safeNumber(raw.E), markPrice: safeNumber(raw.p), indexPrice: safeNumber(raw.i), fundingRate: safeNumber(raw.r), nextFundingTime: safeNumber(raw.T) });
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
        let multiplier: number | undefined;
        try { const contract = getContract(symbol, "gateio"); if (contract.verified && contract.exchange === "GATEIO") multiplier = contract.multiplier; } catch { /* Unknown metadata keeps quote notional unavailable. */ }
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
          quantityUnit: "contracts",
          contractMultiplier: multiplier,
          conditions: ["raw-trade"],
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
    if (!raw || typeof raw !== "object" || typeof raw.s !== "string") return;
    const symbol = raw.s;
    const book = this.gateBooks.get(symbol) ?? new GateOrderBook();
    this.gateBooks.set(symbol, book);
    try {
      const delta = { U: Number(raw.U), u: Number(raw.u), t: Number(raw.t), b: raw.b, a: raw.a, full: raw.full === true } as GateBookDelta;
      if (!book.apply(delta)) {
        this.invalidateDepth(symbol, "GAP_DETECTED", "Gate.io book sequence gap; resynchronizing");
        this.scheduleGateSnapshot(symbol);
        return;
      }
      this.emitGateDepth(symbol, book, delta.t);
    } catch (error) { book.reset(); this.invalidateDepth(symbol, "GAP_DETECTED", String(error)); this.scheduleGateSnapshot(symbol); }
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

  private handleOkxMessage(message: Record<string, unknown>) {
    if (message.event === "error") {
      this.announce("degraded", "UNAVAILABLE", `OKX error: ${String(message.msg ?? "unknown error")}`);
      return;
    }

    const arg = message.arg as Record<string, unknown> | undefined;
    const channel = String(arg?.channel ?? "");
    const symbol = String(arg?.instId ?? "");
    const data = Array.isArray(message.data) ? (message.data as Record<string, unknown>[]) : [];

    if (channel === "trades" && data.length > 0) {
      for (const t of data) {
        const px = safeNumber(t.px);
        const sz = safeNumber(t.sz);
        this.emit(symbol, {
          type: "trade",
          provider: "okx",
          environment: "live",
          symbol,
          exchange: "OKX",
          timestamp: safeNumber(t.ts),
          sequence: safeNumber(t.tradeId ?? Date.now()),
          price: px,
          quantity: Math.abs(sz),
          side: String(t.side).toLowerCase() === "buy" ? "buy" : "sell",
        });
      }
      return;
    }

    if (channel === "tickers" && data.length > 0) {
      const ticker = data[0];
      this.emit(symbol, {
        type: "quote",
        provider: "okx",
        environment: "live",
        symbol,
        exchange: "OKX",
        timestamp: safeNumber(ticker.ts ?? Date.now()),
        sequence: safeNumber(ticker.ts ?? Date.now()),
        bid: safeNumber(ticker.bidPx),
        ask: safeNumber(ticker.askPx),
        bidSize: safeNumber(ticker.bidSz ?? 1),
        askSize: safeNumber(ticker.askSz ?? 1),
      });
      return;
    }

    if (channel === "books" || channel === "books5") {
      let sync = this.okxSyncs.get(symbol);
      if (!sync) {
        sync = new OKXDepthSynchronizer(symbol);
        this.okxSyncs.set(symbol, sync);
      }

      const ok = sync.handleMessage(message as unknown as OKXBookPayload);
      if (ok && sync.status === "LIVE") {
        this.emit(symbol, {
          type: "depth",
          provider: "okx",
          environment: "live",
          symbol,
          exchange: "OKX",
          timestamp: Date.now(),
          sequence: Number(data[0]?.seqId ?? Date.now()),
          levels: [...sync.book.top("buy", 100), ...sync.book.top("sell", 100)],
        });
      } else if (sync.status === "ERROR") {
        this.announce("syncing", "DEGRADED", `OKX ${symbol} checksum or sequence gap detected; resyncing`);
        this.okxSyncs.delete(symbol);
        this.sendSubscription(symbol, "UNSUBSCRIBE");
        setTimeout(() => {
          if (this.listeners.has(symbol)) {
            this.sendSubscription(symbol, "SUBSCRIBE");
          }
        }, 1000);
      }
      return;
    }
  }

  private emitDepth(symbol: string, provider: "bybit" | "coinbase" | "okx", exchange: "BYBIT" | "COINBASE" | "OKX", book: LocalOrderBook, sequence: number) {
    this.emit(symbol, {
      type: "depth", provider, environment: "live", symbol, exchange,
      timestamp: Date.now(), sequence,
      levels: [...book.top("buy", 100), ...book.top("sell", 100)],
    });
  }
}

export const publicMarketData = new PublicMarketDataProvider();
