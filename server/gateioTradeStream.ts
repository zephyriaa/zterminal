import WebSocket from "ws";
import { normalizeGatePublicTrades, orderGatePublicTrades, type GatePublicTrade } from "@shared/market/orderFlowContracts";

const GATE_FUTURES_WS_URL = "wss://fx-ws.gateio.ws/v4/ws/usdt";
const HEARTBEAT_MS = 10_000;
const STALE_AFTER_MS = 30_000;
const IDLE_CLOSE_AFTER_MS = 90_000;
const MAX_TRADES_PER_SYMBOL = 2_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export type TradeStreamState = "CONNECTING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";

export type GateTradeStreamSnapshot = {
  provider: "gateio";
  symbol: string;
  state: TradeStreamState;
  dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";
  fetchedAt: number;
  lastTradeAt: number | null;
  lastMessageAt: number | null;
  reconnectAttempts: number;
  reason: string | null;
  trades: GatePublicTrade[];
};

export type GateioSocketFactory = (address: string, options: WebSocket.ClientOptions) => WebSocket;

type SymbolStream = {
  symbol: string;
  socket: WebSocket | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  reconnect: ReturnType<typeof setTimeout> | null;
  idleExpiry: ReturnType<typeof setTimeout> | null;
  trades: GatePublicTrade[];
  lastTradeAt: number | null;
  lastMessageAt: number | null;
  lastRequestedAt: number;
  reconnectAttempts: number;
  state: TradeStreamState;
  reason: string | null;
};

function cleanSymbol(value: string): string | null {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]+_USDT$/.test(symbol) ? symbol : null;
}

function dataStatus(state: TradeStreamState): GateTradeStreamSnapshot["dataStatus"] {
  if (state === "LIVE") return "LIVE";
  if (state === "STALE") return "STALE";
  if (state === "DEGRADED" || state === "CONNECTING") return "DEGRADED";
  return "UNAVAILABLE";
}

function websocketPayload(data: WebSocket.RawData): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return data.toString();
}

/**
 * Keeps a bounded, read-only public trade window for symbols actively requested
 * by the canonical client. It deliberately does not accept private credentials,
 * does not place orders, and expires idle streams to avoid background activity
 * when no chart is consuming the data.
 */
export class GateioTradeStreamManager {
  private readonly streams = new Map<string, SymbolStream>();

  constructor(private readonly socketFactory: GateioSocketFactory = (address, options) => new WebSocket(address, options)) {}

  getSnapshot(requestedSymbol: string, now = Date.now()): GateTradeStreamSnapshot {
    const symbol = cleanSymbol(requestedSymbol);
    if (!symbol) {
      return {
        provider: "gateio",
        symbol: requestedSymbol,
        state: "UNAVAILABLE",
        dataStatus: "UNAVAILABLE",
        fetchedAt: now,
        lastTradeAt: null,
        lastMessageAt: null,
        reconnectAttempts: 0,
        reason: "The requested instrument is not a Gate.io USDT perpetual symbol.",
        trades: [],
      };
    }
    const stream = this.ensure(symbol, now);
    this.touch(stream, now);
    this.refreshState(stream, now);
    return {
      provider: "gateio",
      symbol,
      state: stream.state,
      dataStatus: dataStatus(stream.state),
      fetchedAt: now,
      lastTradeAt: stream.lastTradeAt,
      lastMessageAt: stream.lastMessageAt,
      reconnectAttempts: stream.reconnectAttempts,
      reason: stream.reason,
      trades: [...stream.trades],
    };
  }

  clear() {
    for (const stream of Array.from(this.streams.values())) this.stop(stream);
    this.streams.clear();
  }

  private ensure(symbol: string, now: number): SymbolStream {
    const existing = this.streams.get(symbol);
    if (existing) return existing;
    const stream: SymbolStream = {
      symbol,
      socket: null,
      heartbeat: null,
      reconnect: null,
      idleExpiry: null,
      trades: [],
      lastTradeAt: null,
      lastMessageAt: null,
      lastRequestedAt: now,
      reconnectAttempts: 0,
      state: "CONNECTING",
      reason: null,
    };
    this.streams.set(symbol, stream);
    this.connect(stream);
    return stream;
  }

  private connect(stream: SymbolStream) {
    this.stopSocket(stream);
    stream.state = "CONNECTING";
    stream.reason = null;
    const socket = this.socketFactory(GATE_FUTURES_WS_URL, {
      headers: { "X-Gate-Size-Decimal": "1" },
    });
    stream.socket = socket;

    socket.on("open", () => {
      stream.reconnectAttempts = 0;
      stream.lastMessageAt = Date.now();
      socket.send(JSON.stringify({
        time: Math.floor(Date.now() / 1_000),
        channel: "futures.trades",
        event: "subscribe",
        payload: [stream.symbol],
      }));
      stream.heartbeat = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ time: Math.floor(Date.now() / 1_000), channel: "futures.ping" }));
      }, HEARTBEAT_MS);
    });

    socket.on("message", (data: WebSocket.RawData) => this.consume(stream, websocketPayload(data)));
    socket.on("error", () => {
      stream.state = "DEGRADED";
      stream.reason = "The public Gate.io trade stream reported a connection error.";
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
      stream.reason = "The public Gate.io trade stream disconnected; reconnecting.";
      this.scheduleReconnect(stream);
    });
  }

  private consume(stream: SymbolStream, payload: string) {
    let message: unknown;
    try {
      message = JSON.parse(payload);
    } catch {
      return;
    }
    if (!message || typeof message !== "object") return;
    const record = message as Record<string, unknown>;
    const channel = record.channel;
    const event = record.event;
    if (channel === "futures.pong") {
      stream.lastMessageAt = Date.now();
      return;
    }
    if (channel !== "futures.trades") return;
    if (event === "subscribe") {
      if (record.error) {
        stream.state = "UNAVAILABLE";
        stream.reason = "Gate.io rejected the public trade-stream subscription.";
      }
      return;
    }
    if (event !== "update" || !Array.isArray(record.result)) return;
    const normalized = normalizeGatePublicTrades(record.result);
    const relevant = normalized.filter(trade => trade.symbol === stream.symbol);
    if (!relevant.length) return;
    stream.trades = orderGatePublicTrades([...stream.trades, ...relevant]).slice(-MAX_TRADES_PER_SYMBOL);
    stream.lastTradeAt = stream.trades.at(-1)?.timestamp ?? stream.lastTradeAt;
    stream.lastMessageAt = Date.now();
    stream.state = "LIVE";
    stream.reason = null;
  }

  private refreshState(stream: SymbolStream, now: number) {
    if (stream.state === "LIVE" && (stream.lastTradeAt === null || now - stream.lastTradeAt > STALE_AFTER_MS)) {
      stream.state = "STALE";
      stream.reason = "No recent public trade event was received within the configured staleness window.";
    }
  }

  private touch(stream: SymbolStream, now: number) {
    stream.lastRequestedAt = now;
    if (stream.idleExpiry) clearTimeout(stream.idleExpiry);
    stream.idleExpiry = setTimeout(() => {
      if (Date.now() - stream.lastRequestedAt < IDLE_CLOSE_AFTER_MS) return;
      this.stop(stream);
      this.streams.delete(stream.symbol);
    }, IDLE_CLOSE_AFTER_MS + 25);
  }

  private scheduleReconnect(stream: SymbolStream) {
    if (stream.reconnect) return;
    stream.reconnectAttempts += 1;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** Math.min(stream.reconnectAttempts - 1, 4));
    stream.reconnect = setTimeout(() => {
      stream.reconnect = null;
      if (Date.now() - stream.lastRequestedAt < IDLE_CLOSE_AFTER_MS) this.connect(stream);
    }, delay);
  }

  private stopSocket(stream: SymbolStream) {
    if (stream.heartbeat) clearInterval(stream.heartbeat);
    stream.heartbeat = null;
    if (stream.socket) {
      stream.socket.removeAllListeners();
      stream.socket.close();
    }
    stream.socket = null;
  }

  private stop(stream: SymbolStream) {
    if (stream.reconnect) clearTimeout(stream.reconnect);
    stream.reconnect = null;
    if (stream.idleExpiry) clearTimeout(stream.idleExpiry);
    stream.idleExpiry = null;
    this.stopSocket(stream);
  }
}

export const gateioTradeStream = new GateioTradeStreamManager();
