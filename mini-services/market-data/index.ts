import { createServer } from "http";
import { Server } from "socket.io";
import { normalizeGateioSymbol } from "../../src/lib/market/gateio";
import { listContracts } from "../../src/lib/market/contracts";
import { MockLiveMarket } from "../../src/lib/market/mock-provider";
import type { ContractMetadata, DepthLevel, QuoteEvent, TradeEvent } from "../../src/lib/market/types";
import { GateioFuturesProvider, type GateEvent, type ProviderStatus } from "./gateio-provider";
import { resolveGatewayOrigins, validateSubscriptionRequest } from "../../src/lib/market/gateway-policy";

const PORT = Number(process.env.MARKET_DATA_PORT ?? 3003);
const PROVIDER_MODE = process.env.MARKET_PROVIDER === "mock" ? "mock" : "gateio";
const ALLOWED_ORIGINS = resolveGatewayOrigins(process.env.NODE_ENV, process.env.ALLOWED_ORIGIN);
const MAX_SUBSCRIPTIONS_PER_CLIENT = Math.min(20, Math.max(1, Number(process.env.MAX_SUBSCRIPTIONS_PER_CLIENT ?? 8) || 8));

interface ClientSubscription {
  symbol: string;
  types: Set<string>;
}

interface MockState {
  market: MockLiveMarket;
  interval: ReturnType<typeof setInterval>;
}

let providerStatus: ProviderStatus | "simulated" = PROVIDER_MODE === "mock" ? "simulated" : "connecting";
let providerReason: string | undefined;
let providerInitialized = PROVIDER_MODE === "mock";
let liveContracts: ContractMetadata[] = PROVIDER_MODE === "mock" ? listContracts() : [];
const subscriptions = new Map<string, Set<string>>();
const clientSubscriptions = new Map<string, Map<string, ClientSubscription>>();
const mockStates = new Map<string, MockState>();
let bootRetryTimer: ReturnType<typeof setTimeout> | null = null;
let bootRetryAttempt = 0;

const httpServer = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, provider: PROVIDER_MODE, state: providerStatus, at: Date.now() }));
    return;
  }
  if (url.pathname === "/readyz") {
    // Readiness means the service has discovered the provider contract catalogue
    // and can accept a new subscription. Live freshness remains per-symbol and
    // is emitted over Socket.IO once a client subscribes.
    const ready = providerInitialized && liveContracts.length > 0;
    response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({ ready, provider: PROVIDER_MODE, state: providerStatus, reason: providerReason, at: Date.now() }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

const gateio = PROVIDER_MODE === "gateio" ? new GateioFuturesProvider() : null;

function emitStatus(socket?: Parameters<typeof io.to>[0]) {
  const payload = {
    state: providerStatus,
    provider: PROVIDER_MODE,
    environment: PROVIDER_MODE === "gateio" ? "live" : "simulation",
    dataStatus:
      PROVIDER_MODE === "mock"
        ? "SIMULATED"
        : providerStatus === "live"
          ? "LIVE"
          : providerStatus === "stale"
            ? "STALE"
            : providerStatus === "degraded"
              ? "DEGRADED"
              : providerStatus === "unavailable"
                ? "UNAVAILABLE"
                : "DISCONNECTED",
    reason: providerReason,
    at: Date.now(),
  };
  if (socket) io.to(socket).emit("state", payload);
  else io.emit("state", payload);
}

function subscribersFor(symbol: string) {
  return subscriptions.get(symbol) ?? new Set<string>();
}

function publishToSubscribers(symbol: string, event: "trade" | "quote" | "depth", payload: unknown) {
  for (const socketId of subscribersFor(symbol)) {
    const subscription = clientSubscriptions.get(socketId)?.get(symbol);
    if (subscription?.types.has(event)) io.to(socketId).emit(event, payload);
  }
}

function handleGateEvent(event: GateEvent) {
  if (event.type === "contracts") {
    liveContracts = event.contracts;
    io.emit("contracts", liveContracts);
    return;
  }
  if (event.type === "status") {
    providerStatus = event.state;
    providerReason = event.reason;
    emitStatus();
    return;
  }
  if (event.type === "trade") publishToSubscribers(event.data.symbol, "trade", event.data);
  if (event.type === "quote") publishToSubscribers(event.data.symbol, "quote", event.data);
  if (event.type === "depth") publishToSubscribers(event.symbol, "depth", event);
}

gateio?.on(handleGateEvent);

async function bootGateio() {
  if (!gateio || bootRetryTimer) return;
  try {
    liveContracts = await gateio.discoverContracts();
    providerInitialized = true;
    providerStatus = "connecting";
    providerReason = undefined;
    bootRetryAttempt = 0;
  } catch (error) {
    providerInitialized = false;
    providerStatus = "unavailable";
    providerReason = error instanceof Error ? error.message : "Gate.io contract discovery failed";
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(bootRetryAttempt, 5));
    bootRetryAttempt += 1;
    console.warn(`[market-data] ${providerReason}; retrying contract discovery in ${delay}ms`);
    bootRetryTimer = setTimeout(() => {
      bootRetryTimer = null;
      void bootGateio();
    }, delay);
  }
}

function startMockSymbol(symbol: string) {
  if (mockStates.has(symbol)) return;
  const market = new MockLiveMarket(symbol);
  const interval = setInterval(() => {
    const interested = subscribersFor(symbol);
    if (!interested.size) return;
    const now = Date.now();
    const { trade, quote } = market.tick(now);
    const depth = {
      type: "depth" as const,
      provider: "mock" as const,
      environment: "simulation" as const,
      symbol,
      exchange: market.contract.exchange,
      timestamp: now,
      sequence: trade.sequence,
      levels: market.depth(now) as DepthLevel[],
    };
    publishToSubscribers(symbol, "trade", trade);
    publishToSubscribers(symbol, "quote", quote);
    publishToSubscribers(symbol, "depth", depth);
  }, 160);
  mockStates.set(symbol, { market, interval });
}

function stopMockSymbol(symbol: string) {
  const state = mockStates.get(symbol);
  if (state) clearInterval(state.interval);
  mockStates.delete(symbol);
}

function normalizeSymbol(input: string) {
  const candidate = input.trim().toUpperCase();
  if (PROVIDER_MODE === "gateio") return normalizeGateioSymbol(candidate);
  return liveContracts.some((contract) => contract.symbol === candidate) ? candidate : null;
}

async function startSymbol(symbol: string) {
  if (PROVIDER_MODE === "gateio") await gateio?.subscribe(symbol);
  else startMockSymbol(symbol);
}

function stopSymbol(symbol: string) {
  if (PROVIDER_MODE === "gateio") gateio?.unsubscribe(symbol);
  else stopMockSymbol(symbol);
}

io.on("connection", (socket) => {
  clientSubscriptions.set(socket.id, new Map());
  socket.emit("contracts", liveContracts);
  emitStatus(socket.id);

  socket.on("subscribe", async (message: { symbol?: string; types?: string[] }, acknowledge?: (result: unknown) => void) => {
    const client = clientSubscriptions.get(socket.id);
    const request = validateSubscriptionRequest(message ?? {}, {
      activeSubscriptionCount: client?.size ?? 0,
      maximumSubscriptions: MAX_SUBSCRIPTIONS_PER_CLIENT,
    });
    if (!request.ok) {
      acknowledge?.({ ok: false, error: request.error });
      return;
    }
    const symbol = normalizeSymbol(message?.symbol ?? "");
    if (!symbol) {
      acknowledge?.({ ok: false, error: "unsupported symbol" });
      return;
    }
    const types = request.types;
    client?.set(symbol, { symbol, types });
    let interested = subscriptions.get(symbol);
    const firstSubscriber = !interested || interested.size === 0;
    if (!interested) {
      interested = new Set();
      subscriptions.set(symbol, interested);
    }
    interested.add(socket.id);
    try {
      if (firstSubscriber) await startSymbol(symbol);
      socket.emit("subscribed", { ok: true, symbol, provider: PROVIDER_MODE });
      acknowledge?.({ ok: true, symbol, provider: PROVIDER_MODE });
    } catch (error) {
      providerStatus = "degraded";
      providerReason = error instanceof Error ? error.message : "provider subscription failed";
      emitStatus();
      acknowledge?.({ ok: false, error: providerReason });
    }
  });

  socket.on("unsubscribe", (message: { symbol?: string }) => {
    const symbol = normalizeSymbol(message?.symbol ?? "");
    if (!symbol) return;
    clientSubscriptions.get(socket.id)?.delete(symbol);
    const interested = subscriptions.get(symbol);
    interested?.delete(socket.id);
    if (!interested || interested.size === 0) {
      subscriptions.delete(symbol);
      stopSymbol(symbol);
    }
  });

  socket.on("disconnect", () => {
    const client = clientSubscriptions.get(socket.id);
    for (const symbol of client?.keys() ?? []) {
      const interested = subscriptions.get(symbol);
      interested?.delete(socket.id);
      if (!interested || interested.size === 0) {
        subscriptions.delete(symbol);
        stopSymbol(symbol);
      }
    }
    clientSubscriptions.delete(socket.id);
  });
});

void bootGateio().finally(() => {
  httpServer.listen(PORT, () => {
    console.log(`[market-data] socket.io listening on ${PORT} (${PROVIDER_MODE.toUpperCase()})`);
    emitStatus();
  });
});

function shutdown() {
  if (bootRetryTimer) clearTimeout(bootRetryTimer);
  for (const symbol of mockStates.keys()) stopMockSymbol(symbol);
  gateio?.close();
  httpServer.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
