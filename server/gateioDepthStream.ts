import axios from "axios";
import WebSocket from "ws";
import {
  normalizeGateOrderBookSnapshot,
  normalizeGateOrderBookUpdate,
  reconcileGateOrderBook,
  type DepthLevel,
  type GateOrderBookSnapshot,
  type GateOrderBookUpdate,
} from "@shared/market/orderFlowContracts";

const GATE_FUTURES_WS_URL = "wss://fx-ws.gateio.ws/v4/ws/usdt";
const GATE_ORDER_BOOK_URL = "https://api.gateio.ws/api/v4/futures/usdt/order_book";
const BOOK_LEVELS = 50;
const HEARTBEAT_MS = 10_000;
const STALE_AFTER_MS = 30_000;
const IDLE_CLOSE_AFTER_MS = 90_000;
const MAX_BUFFERED_UPDATES = 500;
const MAX_RECONNECT_DELAY_MS = 15_000;

export type DepthStreamState = "CONNECTING" | "SYNCING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";
export type GateioDepthSocketFactory = (address: string, options: WebSocket.ClientOptions) => WebSocket;
export type GateioDepthSnapshotFetcher = (symbol: string) => Promise<GateOrderBookSnapshot | null>;

export type GateDepthStreamSnapshot = {
  provider: "gateio";
  symbol: string;
  state: DepthStreamState;
  dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";
  fetchedAt: number;
  lastDepthAt: number | null;
  lastMessageAt: number | null;
  lastUpdateId: number | null;
  reconnectAttempts: number;
  reason: string | null;
  bids: DepthLevel[];
  asks: DepthLevel[];
};

type SymbolDepthStream = {
  symbol: string;
  socket: WebSocket | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  reconnect: ReturnType<typeof setTimeout> | null;
  idleExpiry: ReturnType<typeof setTimeout> | null;
  bootstrap: Promise<void> | null;
  updates: GateOrderBookUpdate[];
  book: { bids: DepthLevel[]; asks: DepthLevel[]; lastUpdateId: number } | null;
  lastDepthAt: number | null;
  lastMessageAt: number | null;
  lastRequestedAt: number;
  reconnectAttempts: number;
  state: DepthStreamState;
  reason: string | null;
};

function cleanSymbol(value: string): string | null {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]+_USDT$/.test(symbol) ? symbol : null;
}

function dataStatus(state: DepthStreamState): GateDepthStreamSnapshot["dataStatus"] {
  if (state === "LIVE") return "LIVE";
  if (state === "STALE") return "STALE";
  if (state === "CONNECTING" || state === "SYNCING" || state === "DEGRADED") return "DEGRADED";
  return "UNAVAILABLE";
}

function payloadText(data: WebSocket.RawData): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return data.toString();
}

async function fetchGateioDepthSnapshot(symbol: string): Promise<GateOrderBookSnapshot | null> {
  const response = await axios.get<unknown>(GATE_ORDER_BOOK_URL, {
    params: { contract: symbol, limit: BOOK_LEVELS, with_id: true },
    headers: { Accept: "application/json", "X-Gate-Size-Decimal": "1" },
    timeout: 8_000,
    responseType: "json",
  });
  return normalizeGateOrderBookSnapshot(response.data, symbol);
}

/**
 * A bounded public depth manager. It starts with a REST snapshot, buffers public
 * deltas while that snapshot loads, and refuses to expose a local book unless
 * the documented update-ID successor can be reconciled. No private market or
 * trading operation is present.
 */
export class GateioDepthStreamManager {
  private readonly streams = new Map<string, SymbolDepthStream>();

  constructor(
    private readonly socketFactory: GateioDepthSocketFactory = (address, options) => new WebSocket(address, options),
    private readonly snapshotFetcher: GateioDepthSnapshotFetcher = fetchGateioDepthSnapshot,
  ) {}

  getSnapshot(requestedSymbol: string, now = Date.now()): GateDepthStreamSnapshot {
    const symbol = cleanSymbol(requestedSymbol);
    if (!symbol) return {
      provider: "gateio", symbol: requestedSymbol, state: "UNAVAILABLE", dataStatus: "UNAVAILABLE", fetchedAt: now,
      lastDepthAt: null, lastMessageAt: null, lastUpdateId: null, reconnectAttempts: 0,
      reason: "The requested instrument is not a Gate.io USDT perpetual symbol.", bids: [], asks: [],
    };
    const stream = this.ensure(symbol, now);
    this.touch(stream, now);
    this.refreshState(stream, now);
    return {
      provider: "gateio", symbol, state: stream.state, dataStatus: dataStatus(stream.state), fetchedAt: now,
      lastDepthAt: stream.lastDepthAt, lastMessageAt: stream.lastMessageAt, lastUpdateId: stream.book?.lastUpdateId ?? null,
      reconnectAttempts: stream.reconnectAttempts, reason: stream.reason,
      bids: stream.book?.bids ?? [], asks: stream.book?.asks ?? [],
    };
  }

  clear() {
    for (const stream of Array.from(this.streams.values())) this.stop(stream);
    this.streams.clear();
  }

  private ensure(symbol: string, now: number): SymbolDepthStream {
    const existing = this.streams.get(symbol);
    if (existing) return existing;
    const stream: SymbolDepthStream = {
      symbol, socket: null, heartbeat: null, reconnect: null, idleExpiry: null, bootstrap: null, updates: [], book: null,
      lastDepthAt: null, lastMessageAt: null, lastRequestedAt: now, reconnectAttempts: 0, state: "CONNECTING", reason: null,
    };
    this.streams.set(symbol, stream);
    this.connect(stream);
    return stream;
  }

  private connect(stream: SymbolDepthStream) {
    this.stopSocket(stream);
    stream.state = "CONNECTING";
    stream.reason = null;
    const socket = this.socketFactory(GATE_FUTURES_WS_URL, { headers: { "X-Gate-Size-Decimal": "1" } });
    stream.socket = socket;
    socket.on("open", () => {
      stream.reconnectAttempts = 0;
      stream.lastMessageAt = Date.now();
      socket.send(JSON.stringify({
        time: Math.floor(Date.now() / 1_000), channel: "futures.order_book_update", event: "subscribe",
        payload: [stream.symbol, "100ms", String(BOOK_LEVELS)],
      }));
      stream.heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ time: Math.floor(Date.now() / 1_000), channel: "futures.ping" }));
      }, HEARTBEAT_MS);
    });
    socket.on("message", (data: WebSocket.RawData) => this.consume(stream, payloadText(data)));
    socket.on("error", () => {
      stream.state = "DEGRADED";
      stream.reason = "The public Gate.io depth stream reported a connection error.";
    });
    socket.on("close", () => {
      if (stream.socket !== socket) return;
      this.stopSocket(stream);
      if (Date.now() - stream.lastRequestedAt >= IDLE_CLOSE_AFTER_MS) {
        stream.state = "UNAVAILABLE";
        stream.reason = "The public depth stream closed after no active chart requested the symbol.";
        return;
      }
      stream.state = "DEGRADED";
      stream.reason = "The public Gate.io depth stream disconnected; reconnecting.";
      this.scheduleReconnect(stream);
    });
  }

  private consume(stream: SymbolDepthStream, payload: string) {
    let message: unknown;
    try { message = JSON.parse(payload); } catch { return; }
    if (!message || typeof message !== "object") return;
    const record = message as Record<string, unknown>;
    if (record.channel === "futures.pong") {
      stream.lastMessageAt = Date.now();
      return;
    }
    if (record.channel !== "futures.order_book_update") return;
    if (record.event === "subscribe" && record.error) {
      stream.state = "UNAVAILABLE";
      stream.reason = "Gate.io rejected the public depth-stream subscription.";
      return;
    }
    if (record.event !== "update") return;
    const update = normalizeGateOrderBookUpdate(record.result, stream.symbol);
    if (!update || update.symbol !== stream.symbol) return;
    stream.lastMessageAt = Date.now();
    stream.updates.push(update);
    if (stream.updates.length > MAX_BUFFERED_UPDATES) stream.updates = stream.updates.slice(-MAX_BUFFERED_UPDATES);
    if (!stream.book) {
      stream.state = "SYNCING";
      stream.reason = "Reconciling public depth snapshot with sequenced updates.";
      if (!stream.bootstrap) stream.bootstrap = this.bootstrap(stream);
      return;
    }
    const syntheticSnapshot: GateOrderBookSnapshot = {
      provider: "gateio", symbol: stream.symbol, id: stream.book.lastUpdateId, timestamp: stream.lastDepthAt,
      bids: stream.book.bids, asks: stream.book.asks,
    };
    const next = reconcileGateOrderBook(syntheticSnapshot, [update]);
    if (!next) {
      stream.book = null;
      stream.updates = [update];
      stream.state = "DEGRADED";
      stream.reason = "A public depth update gap was detected; resynchronizing from an exchange snapshot.";
      if (!stream.bootstrap) stream.bootstrap = this.bootstrap(stream);
      return;
    }
    stream.book = next;
    stream.lastDepthAt = update.timestamp ?? Date.now();
    stream.state = "LIVE";
    stream.reason = null;
  }

  private async bootstrap(stream: SymbolDepthStream) {
    try {
      const snapshot = await this.snapshotFetcher(stream.symbol);
      if (!snapshot) {
        stream.state = "DEGRADED";
        stream.reason = "The exchange did not return a reconcilable public depth snapshot.";
        return;
      }
      const reconciled = reconcileGateOrderBook(snapshot, stream.updates);
      if (!reconciled) {
        stream.state = "DEGRADED";
        stream.reason = "Awaiting a public depth update that reconciles with the exchange snapshot.";
        return;
      }
      stream.book = reconciled;
      stream.lastDepthAt = stream.updates.at(-1)?.timestamp ?? snapshot.timestamp ?? Date.now();
      stream.updates = [];
      stream.state = "LIVE";
      stream.reason = null;
    } catch {
      stream.state = "DEGRADED";
      stream.reason = "The exchange depth snapshot request failed; retrying when the public stream reconnects.";
    } finally {
      stream.bootstrap = null;
    }
  }

  private refreshState(stream: SymbolDepthStream, now: number) {
    if (stream.state === "LIVE" && (stream.lastDepthAt === null || now - stream.lastDepthAt > STALE_AFTER_MS)) {
      stream.state = "STALE";
      stream.reason = "No reconciled public depth update was received within the configured staleness window.";
    }
  }

  private touch(stream: SymbolDepthStream, now: number) {
    stream.lastRequestedAt = now;
    if (stream.idleExpiry) clearTimeout(stream.idleExpiry);
    stream.idleExpiry = setTimeout(() => {
      if (Date.now() - stream.lastRequestedAt < IDLE_CLOSE_AFTER_MS) return;
      this.stop(stream);
      this.streams.delete(stream.symbol);
    }, IDLE_CLOSE_AFTER_MS + 25);
  }

  private scheduleReconnect(stream: SymbolDepthStream) {
    if (stream.reconnect) return;
    stream.reconnectAttempts += 1;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** Math.min(stream.reconnectAttempts - 1, 4));
    stream.reconnect = setTimeout(() => {
      stream.reconnect = null;
      if (Date.now() - stream.lastRequestedAt < IDLE_CLOSE_AFTER_MS) this.connect(stream);
    }, delay);
  }

  private stopSocket(stream: SymbolDepthStream) {
    if (stream.heartbeat) clearInterval(stream.heartbeat);
    stream.heartbeat = null;
    if (stream.socket) {
      stream.socket.removeAllListeners();
      stream.socket.close();
    }
    stream.socket = null;
  }

  private stop(stream: SymbolDepthStream) {
    if (stream.reconnect) clearTimeout(stream.reconnect);
    stream.reconnect = null;
    if (stream.idleExpiry) clearTimeout(stream.idleExpiry);
    stream.idleExpiry = null;
    this.stopSocket(stream);
  }
}

export const gateioDepthStream = new GateioDepthStreamManager();
