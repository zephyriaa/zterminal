import WebSocket from "ws";
import { normalizeBinanceUsdmAggregateTrade, normalizeBybitLinearPublicTrades, normalizeCoinbaseExchangeMatch, normalizeUsdtPerpetualSymbol, type MultiExchangeProvider, type MultiExchangeTrade } from "@shared/market/multiExchangeContracts";
import { orderPublicTrades } from "@shared/market/orderFlowContracts";

const BINANCE_USDM_WS = "wss://fstream.binance.com/ws";
const BYBIT_LINEAR_WS = "wss://stream.bybit.com/v5/public/linear";
const COINBASE_EXCHANGE_WS = "wss://ws-feed.exchange.coinbase.com";
const STALE_AFTER_MS = 15_000;
const IDLE_CLOSE_AFTER_MS = 90_000;
const MAX_TRADES_PER_SYMBOL = 2_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export type MultiExchangeStreamState = "CONNECTING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";
export type MultiExchangeTradeSnapshot = {
  provider: MultiExchangeProvider;
  symbol: string;
  state: MultiExchangeStreamState;
  dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";
  fetchedAt: number;
  lastTradeAt: number | null;
  lastMessageAt: number | null;
  reconnectAttempts: number;
  reason: string | null;
  trades: MultiExchangeTrade[];
};

export type MultiExchangeSocketFactory = (address: string, options?: WebSocket.ClientOptions) => WebSocket;
type Stream = {
  provider: MultiExchangeProvider;
  symbol: string;
  socket: WebSocket | null;
  reconnect: ReturnType<typeof setTimeout> | null;
  idleExpiry: ReturnType<typeof setTimeout> | null;
  trades: MultiExchangeTrade[];
  lastTradeAt: number | null;
  lastMessageAt: number | null;
  lastRequestedAt: number;
  reconnectAttempts: number;
  state: MultiExchangeStreamState;
  reason: string | null;
  lastCoinbaseTradeId: number | null;
};

function dataStatus(state: MultiExchangeStreamState): MultiExchangeTradeSnapshot["dataStatus"] {
  if (state === "LIVE") return "LIVE";
  if (state === "STALE") return "STALE";
  if (state === "UNAVAILABLE") return "UNAVAILABLE";
  return "DEGRADED";
}

function payloadText(data: WebSocket.RawData) {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return data.toString();
}

function nativeSymbol(provider: MultiExchangeProvider, symbol: string) {
  if (provider === "binance_usdm") return symbol.replace("_", "").toLowerCase();
  if (provider === "coinbase_exchange") return symbol.replace("_", "-");
  return symbol.replace("_", "");
}

function canonicalSymbol(provider: MultiExchangeProvider, requested: string) {
  if (provider === "coinbase_exchange") {
    const candidate = requested.trim().toUpperCase().replace("-", "_");
    return /^([A-Z0-9]+)_USD$/.test(candidate) ? candidate : null;
  }
  return normalizeUsdtPerpetualSymbol(requested.replace("_", ""));
}

/**
 * Starts streams only for a currently requested public chart. It never accepts credentials,
 * never subscribes to private channels, and reports an unusable data state instead of replaying
 * an old tape as live when a public transport stops producing current trades.
 */
export class MultiExchangeTradeStreamManager {
  private readonly streams = new Map<string, Stream>();

  constructor(private readonly socketFactory: MultiExchangeSocketFactory = (address, options) => new WebSocket(address, options)) {}

  getSnapshot(provider: MultiExchangeProvider, requestedSymbol: string, now = Date.now()): MultiExchangeTradeSnapshot {
    const symbol = canonicalSymbol(provider, requestedSymbol);
    if (!symbol) return {
      provider, symbol: requestedSymbol, state: "UNAVAILABLE", dataStatus: "UNAVAILABLE", fetchedAt: now,
      lastTradeAt: null, lastMessageAt: null, reconnectAttempts: 0,
      reason: provider === "coinbase_exchange" ? "The requested instrument is not a supported Coinbase Exchange USD spot symbol for this public provider." : "The requested instrument is not a supported USDT perpetual symbol for this public provider.", trades: [],
    };
    const stream = this.ensure(provider, symbol, now);
    this.touch(stream, now);
    this.refreshState(stream, now);
    return { provider, symbol, state: stream.state, dataStatus: dataStatus(stream.state), fetchedAt: now, lastTradeAt: stream.lastTradeAt, lastMessageAt: stream.lastMessageAt, reconnectAttempts: stream.reconnectAttempts, reason: stream.reason, trades: [...stream.trades] };
  }

  clear() {
    for (const stream of Array.from(this.streams.values())) this.stop(stream);
    this.streams.clear();
  }

  private ensure(provider: MultiExchangeProvider, symbol: string, now: number) {
    const key = `${provider}:${symbol}`;
    const existing = this.streams.get(key);
    if (existing) return existing;
    const stream: Stream = { provider, symbol, socket: null, reconnect: null, idleExpiry: null, trades: [], lastTradeAt: null, lastMessageAt: null, lastRequestedAt: now, reconnectAttempts: 0, state: "CONNECTING", reason: null, lastCoinbaseTradeId: null };
    this.streams.set(key, stream);
    this.connect(stream);
    return stream;
  }

  private connect(stream: Stream) {
    this.stopSocket(stream);
    stream.state = "CONNECTING";
    stream.reason = null;
    const socket = this.socketFactory(stream.provider === "binance_usdm" ? `${BINANCE_USDM_WS}/${nativeSymbol(stream.provider, stream.symbol)}@aggTrade` : stream.provider === "bybit_linear" ? BYBIT_LINEAR_WS : COINBASE_EXCHANGE_WS);
    stream.socket = socket;
    socket.on("open", () => {
      stream.reconnectAttempts = 0;
      stream.lastMessageAt = Date.now();
      if (stream.provider === "bybit_linear") socket.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${nativeSymbol(stream.provider, stream.symbol)}`] }));
      if (stream.provider === "coinbase_exchange") socket.send(JSON.stringify({ type: "subscribe", product_ids: [nativeSymbol(stream.provider, stream.symbol)], channels: ["matches", "heartbeat"] }));
    });
    socket.on("message", (data: WebSocket.RawData) => this.consume(stream, payloadText(data)));
    socket.on("error", () => {
      stream.state = "DEGRADED";
      stream.reason = `${this.label(stream.provider)} public trade stream reported a connection error.`;
    });
    socket.on("close", () => {
      if (stream.socket !== socket) return;
      this.stopSocket(stream);
      if (Date.now() - stream.lastRequestedAt >= IDLE_CLOSE_AFTER_MS) {
        stream.state = "UNAVAILABLE";
        stream.reason = "The public trade stream closed after no active chart requested the symbol.";
        return;
      }
      stream.state = "DEGRADED";
      stream.reason = `${this.label(stream.provider)} public trade stream disconnected; reconnecting.`;
      this.scheduleReconnect(stream);
    });
  }

  private consume(stream: Stream, payload: string) {
    let message: unknown;
    try { message = JSON.parse(payload); } catch { return; }
    if (stream.provider === "coinbase_exchange" && message && typeof message === "object") {
      const record = message as Record<string, unknown>;
      if (record.type === "heartbeat") {
        const heartbeatId = typeof record.last_trade_id === "number" ? record.last_trade_id : Number(record.last_trade_id);
        stream.lastMessageAt = Date.now();
        if (Number.isFinite(heartbeatId) && stream.lastCoinbaseTradeId !== null && heartbeatId > stream.lastCoinbaseTradeId) this.resetCoinbaseTape(stream, "Coinbase heartbeat detected a public match gap; the bounded live tape was reset and is withheld until a fresh contiguous window is observed.");
        return;
      }
    }
    let normalized: MultiExchangeTrade[] = [];
    if (stream.provider === "binance_usdm") {
      const trade = normalizeBinanceUsdmAggregateTrade(message);
      if (trade) normalized = [trade];
    } else if (stream.provider === "bybit_linear") normalized = normalizeBybitLinearPublicTrades(message);
    else {
      const trade = normalizeCoinbaseExchangeMatch(message);
      if (trade) {
        const numericId = Number(trade.id);
        if (Number.isFinite(numericId) && stream.lastCoinbaseTradeId !== null && numericId !== stream.lastCoinbaseTradeId + 1) {
          stream.lastCoinbaseTradeId = numericId;
          this.resetCoinbaseTape(stream, "Coinbase public match sequence was not contiguous; the bounded live tape was reset and is withheld until a fresh contiguous window is observed.");
          return;
        }
        if (Number.isFinite(numericId)) stream.lastCoinbaseTradeId = numericId;
        normalized = [trade];
      }
    }
    const relevant = normalized.filter(trade => trade.symbol === stream.symbol);
    if (!relevant.length) return;
    stream.trades = orderPublicTrades([...stream.trades, ...relevant]).slice(-MAX_TRADES_PER_SYMBOL);
    stream.lastTradeAt = stream.trades.at(-1)?.timestamp ?? stream.lastTradeAt;
    stream.lastMessageAt = Date.now();
    stream.state = "LIVE";
    stream.reason = null;
  }

  private resetCoinbaseTape(stream: Stream, reason: string) {
    stream.trades = [];
    stream.lastTradeAt = null;
    stream.state = "DEGRADED";
    stream.reason = reason;
  }

  private refreshState(stream: Stream, now: number) {
    if (stream.state === "LIVE" && (stream.lastTradeAt === null || now - stream.lastTradeAt > STALE_AFTER_MS)) {
      stream.state = "STALE";
      stream.reason = "No current public trade event was received within the configured staleness window; live order flow is withheld.";
    }
  }

  private touch(stream: Stream, now: number) {
    stream.lastRequestedAt = now;
    if (stream.idleExpiry) clearTimeout(stream.idleExpiry);
    stream.idleExpiry = setTimeout(() => {
      if (Date.now() - stream.lastRequestedAt < IDLE_CLOSE_AFTER_MS) return;
      this.stop(stream);
      this.streams.delete(`${stream.provider}:${stream.symbol}`);
    }, IDLE_CLOSE_AFTER_MS + 25);
  }

  private scheduleReconnect(stream: Stream) {
    if (stream.reconnect) return;
    stream.reconnectAttempts += 1;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** Math.min(stream.reconnectAttempts - 1, 4));
    stream.reconnect = setTimeout(() => {
      stream.reconnect = null;
      if (Date.now() - stream.lastRequestedAt < IDLE_CLOSE_AFTER_MS) this.connect(stream);
    }, delay);
  }

  private stopSocket(stream: Stream) {
    if (!stream.socket) return;
    stream.socket.removeAllListeners();
    stream.socket.close();
    stream.socket = null;
  }

  private stop(stream: Stream) {
    if (stream.reconnect) clearTimeout(stream.reconnect);
    if (stream.idleExpiry) clearTimeout(stream.idleExpiry);
    stream.reconnect = null;
    stream.idleExpiry = null;
    this.stopSocket(stream);
  }

  private label(provider: MultiExchangeProvider) {
    if (provider === "binance_usdm") return "Binance USDⓈ-M";
    if (provider === "coinbase_exchange") return "Coinbase Exchange";
    return "Bybit linear";
  }
}

export const multiExchangeTradeStream = new MultiExchangeTradeStreamManager();
