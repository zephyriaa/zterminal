/**
 * Z TERMINAL — Market-Data streaming mini-service (socket.io, port 3003).
 *
 * Streams SIMULATED trades / quotes / depth for subscribed symbols.
 * All data is clearly SIMULATED — the frontend surfaces DataStatus="SIMULATED".
 *
 * Connection: frontend uses io("/?XTransformPort=3003") — never a direct port.
 *
 * Lifecycle implemented: heartbeat (socket.io ping), reconnect (client-side
 * exponential backoff), subscription restoration (client re-subscribes on
 * reconnect), sequence validation (per-symbol monotonic seq).
 *
 * No real Rithmic connection — see RITHMIC_INTEGRATION.md.
 */
import { createServer } from "http";
import { Server } from "socket.io";
import { mulberry32, gaussian, hashString } from "../../src/lib/market/rng.js";
import {
  getContract,
  listContracts,
} from "../../src/lib/market/contracts.js";
import {
  classifySession,
  sessionVolMultiplier,
} from "../../src/lib/market/session.js";

const PORT = 3003;
const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

interface LiveState {
  symbol: string;
  price: number;
  seq: number;
  tickInterval: ReturnType<typeof setInterval> | null;
}

const live = new Map<string, LiveState>();
const subscribers = new Map<string, Set<string>>(); // symbol -> socket ids

function roundTick(p: number, tick: number) {
  return Math.round(p / tick) * tick;
}

function startSymbol(symbol: string) {
  if (live.has(symbol)) return;
  const c = getContract(symbol);
  const state: LiveState = {
    symbol,
    price: c.basePrice,
    seq: 0,
    tickInterval: null,
  };
  live.set(symbol, state);

  // Emit ~6 ticks/sec, bursty.
  state.tickInterval = setInterval(() => {
    const subs = subscribers.get(symbol);
    if (!subs || subs.size === 0) return;
    const now = Date.now();
    const rng = mulberry32(hashString(`${symbol}|${now}|${state.seq}`));
    const sess = classifySession(c.session, now);
    const volMul = sessionVolMultiplier(now);
    const step =
      state.price * c.dailyVolPct * 0.05 * volMul * (sess.label === "closed" ? 0.15 : 1);
    const delta = gaussian(rng) * step;
    state.price = roundTick(Math.max(state.price + delta, c.tickSize), c.tickSize);
    const side = delta >= 0 ? "buy" : "sell";
    const qty = Math.max(
      1,
      Math.floor((c.product === "equity" ? 80 : 6) * (0.3 + rng() * 2))
    );
    state.seq++;
    const spread = c.tickSize;
    const bid = roundTick(state.price - spread / 2, c.tickSize);
    const ask = roundTick(state.price + spread / 2, c.tickSize);

    const trade = {
      type: "trade",
      provider: "mock",
      environment: "simulation",
      symbol,
      exchange: c.exchange,
      timestamp: now,
      sequence: state.seq,
      price: state.price,
      quantity: qty,
      side,
    };
    const quote = {
      type: "quote",
      provider: "mock",
      environment: "simulation",
      symbol,
      exchange: c.exchange,
      timestamp: now,
      sequence: state.seq,
      bid,
      ask,
      bidSize: Math.max(1, Math.floor(8 + rng() * 40)),
      askSize: Math.max(1, Math.floor(8 + rng() * 40)),
    };
    // depth ladder
    const levels = 10;
    const depthLevels = [];
    for (let i = 1; i <= levels; i++) {
      depthLevels.push({
        price: roundTick(state.price - i * c.tickSize, c.tickSize),
        size: Math.max(1, Math.floor((c.product === "equity" ? 200 : 12) * (0.5 + rng() * 2))),
        side: "buy",
      });
      depthLevels.push({
        price: roundTick(state.price + i * c.tickSize, c.tickSize),
        size: Math.max(1, Math.floor((c.product === "equity" ? 200 : 12) * (0.5 + rng() * 2))),
        side: "sell",
      });
    }
    const depth = {
      type: "depth",
      provider: "mock",
      environment: "simulation",
      symbol,
      exchange: c.exchange,
      timestamp: now,
      sequence: state.seq,
      levels: depthLevels,
    };

    for (const sid of subs) {
      const s = io.sockets.sockets.get(sid);
      if (s) {
        s.emit("trade", trade);
        s.emit("quote", quote);
        s.emit("depth", depth);
      }
    }
  }, 160);
}

function stopSymbol(symbol: string) {
  const s = live.get(symbol);
  if (s && s.tickInterval) clearInterval(s.tickInterval);
  live.delete(symbol);
}

io.on("connection", (socket) => {
  // initial contract list
  socket.emit("contracts", listContracts().map((c) => ({ ...c })));
  socket.emit("state", { state: "connected", at: Date.now() });

  socket.on("subscribe", (msg: { symbol: string; types?: string[] }) => {
    const symbol = (msg?.symbol || "").toUpperCase();
    if (!getContract(symbol)) return;
    let set = subscribers.get(symbol);
    if (!set) {
      set = new Set();
      subscribers.set(symbol, set);
    }
    set.add(socket.id);
    startSymbol(symbol);
    socket.emit("subscribed", { symbol });
  });

  socket.on("unsubscribe", (msg: { symbol: string }) => {
    const symbol = (msg?.symbol || "").toUpperCase();
    const set = subscribers.get(symbol);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        subscribers.delete(symbol);
        stopSymbol(symbol);
      }
    }
  });

  socket.on("ping-symbol", (msg: { symbol: string }, ack?: (v: unknown) => void) => {
    const s = live.get((msg?.symbol || "").toUpperCase());
    ack?.({ symbol: msg?.symbol, price: s?.price ?? null, seq: s?.seq ?? 0, at: Date.now() });
  });

  socket.on("disconnect", () => {
    for (const [symbol, set] of subscribers) {
      set.delete(socket.id);
      if (set.size === 0) {
        subscribers.delete(symbol);
        stopSymbol(symbol);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[market-data] socket.io listening on ${PORT} (SIMULATED)`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
