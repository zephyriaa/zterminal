"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { PublicMarketDataProvider, type StreamEvent } from "@/lib/market/public-stream";
import type { DataStatus, DepthEvent, DepthLevel, DerivativesEvent, FeedHealth, LiquidationEvent, ProviderId, QuoteEvent, TradeEvent } from "@/lib/market/types";
import { acceptsStreamEvent, freshFeedHealth, gatewayMatches, streamSymbol, type GatewayState } from "@/lib/market/provenance";
import { CONTRACTS } from "@/lib/market/contracts";
import { useWorkspace } from "@/stores/workspace";
import { acquireOrderFlowSession, type OrderFlowSession } from "@/lib/market/order-flow-session";

type StreamState = "connected" | "connecting" | "reconnecting" | "stale" | "degraded" | "unavailable" | "disconnected";
const streamTypes = ["trade", "quote", "depth", "derivatives", "liquidation"] as const;
let socket: Socket | null = null;
let directFeed: PublicMarketDataProvider | null = null;
let stopDirectState: (() => void) | null = null;
const directSubscriptions = new Map<string, () => void>();
const subscribedKeys = new Set<string>();
let removeNetworkWatch: (() => void) | null = null;
let stopSelectionWatch: (() => void) | null = null;
let generation = 0;
let selectionSince = 0;
const tradeSubscribers = new Map<string, Set<(trade: TradeEvent) => void>>();
const quoteSubscribers = new Map<string, Set<(quote: QuoteEvent) => void>>();
const depthSubscribers = new Map<string, Set<(event: DepthEvent) => void>>();
const derivativesSubscribers = new Map<string, Set<(event: DerivativesEvent) => void>>();
const liquidationSubscribers = new Map<string, Set<(event: LiquidationEvent) => void>>();
const healthSubscribers = new Map<string, Set<(health: FeedHealth) => void>>();
const stateSubscribers = new Set<(state: GatewayState) => void>();
let latestGatewayState: GatewayState = { state: "connecting", dataStatus: "DISCONNECTED" };
const emptyTrades: TradeEvent[] = [];
const emptyObservation = { revision: 0, trades: emptyTrades as readonly TradeEvent[], depth: null as DepthEvent | null, frames: [] as readonly DepthEvent[], health: null as FeedHealth | null, now: 0 };
const emptySubscribe = () => () => {};
const emptySnapshot = () => emptyObservation;

function allSymbols() {
  return new Set([...tradeSubscribers.keys(), ...quoteSubscribers.keys(), ...depthSubscribers.keys(), ...derivativesSubscribers.keys(), ...liquidationSubscribers.keys(), ...healthSubscribers.keys()]);
}

function gatewayView(gateway: GatewayState, provider: ProviderId): { state: StreamState; dataStatus: DataStatus; reason?: string } {
  if (!gateway.provider) return { state: gateway.state === "unavailable" ? "unavailable" : "connecting", dataStatus: gateway.dataStatus ?? "DISCONNECTED", reason: gateway.reason ?? "Waiting for transport venue identity" };
  if (!gatewayMatches(provider, gateway)) return { state: "unavailable", dataStatus: "UNAVAILABLE", reason: `Selected ${provider}; transport serves ${gateway.provider} (${gateway.environment ?? "unknown"}). No other venue or simulation is substituted.` };
  const state = gateway.state === "live" || gateway.state === "connected" || (provider === "mock" && gateway.state === "simulated") ? "connected" : ["connecting", "reconnecting", "stale", "degraded", "unavailable"].includes(gateway.state ?? "") ? gateway.state as StreamState : "disconnected";
  return { state, dataStatus: gateway.dataStatus ?? "DISCONNECTED", reason: gateway.reason };
}

function publishState(next: GatewayState) {
  latestGatewayState = { ...latestGatewayState, ...next };
  const provider = useWorkspace.getState().marketProvider;
  const view = gatewayView(latestGatewayState, provider);
  useWorkspace.getState().setConnection({ ...view, dataStatus: view.dataStatus === "LIVE" ? "DISCONNECTED" : view.dataStatus, provider, environment: provider === "mock" ? "simulation" : "live" });
  for (const listener of stateSubscribers) listener(latestGatewayState);
}

function subscribeSymbol(key: string) {
  const provider = useWorkspace.getState().marketProvider;
  if (!subscribedKeys.has(key) && key.startsWith(`${provider}:`) && gatewayMatches(provider, latestGatewayState)) {
    subscribedKeys.add(key);
    const symbol = key.slice(key.indexOf(":") + 1);
    if (directFeed) {
      directSubscriptions.set(key, directFeed.subscribe(symbol, event => {
        if (useWorkspace.getState().marketProvider !== provider || event.provider !== provider) return;
        if (!("type" in event)) { for (const listener of healthSubscribers.get(key) ?? []) listener(event); return; }
        if (!acceptsStreamEvent(provider, latestGatewayState, event, selectionSince)) return;
        const dispatch = (value: StreamEvent) => {
          switch (value.type) {
            case "trade": for (const listener of tradeSubscribers.get(key) ?? []) listener(value); break;
            case "quote": for (const listener of quoteSubscribers.get(key) ?? []) listener(value); break;
            case "depth": for (const listener of depthSubscribers.get(key) ?? []) listener(value); break;
            case "derivatives": for (const listener of derivativesSubscribers.get(key) ?? []) listener(value); break;
            case "liquidation": for (const listener of liquidationSubscribers.get(key) ?? []) listener(value); break;
          }
        };
        dispatch(event);
      }));
    } else socket?.emit("subscribe", { symbol, provider, types: streamTypes });
  }
}

function releaseSocket() {
  if (allSymbols().size || stateSubscribers.size) return;
  stopSelectionWatch?.(); stopSelectionWatch = null;
  removeNetworkWatch?.(); removeNetworkWatch = null; subscribedKeys.clear();
  for (const remove of directSubscriptions.values()) remove(); directSubscriptions.clear();
  stopDirectState?.(); stopDirectState = null; directFeed = null;
  socket?.removeAllListeners(); socket?.disconnect(); socket = null;
  generation++;
  useWorkspace.getState().setConnection({ state: "disconnected", dataStatus: "DISCONNECTED" });
  latestGatewayState = { state: "connecting", dataStatus: "DISCONNECTED" };
}

function ensureSocket(): Socket | null {
  if (socket || directFeed) return socket;
  stopSelectionWatch ??= useWorkspace.subscribe((state, previous) => {
    if (state.marketProvider === previous.marketProvider) return;
    selectionSince = Date.now(); generation++;
    if (socket && (process.env.NEXT_PUBLIC_MARKET_TRANSPORT === "gateway" || !["gateio", "binance"].includes(state.marketProvider))) {
      for (const key of allSymbols()) socket.emit("unsubscribe", { symbol: key.slice(key.indexOf(":") + 1) });
      subscribedKeys.clear(); publishState(latestGatewayState);
      return;
    }
    for (const remove of directSubscriptions.values()) remove(); directSubscriptions.clear();
    stopDirectState?.(); stopDirectState = null; directFeed = null;
    removeNetworkWatch?.(); removeNetworkWatch = null;
    socket?.removeAllListeners(); socket?.disconnect(); socket = null;
    subscribedKeys.clear();
    latestGatewayState = { state: "connecting", dataStatus: "DISCONNECTED" };
    ensureSocket();
    for (const key of allSymbols()) subscribeSymbol(key);
  });
  const provider = useWorkspace.getState().marketProvider;
  if (process.env.NEXT_PUBLIC_MARKET_TRANSPORT !== "gateway" && (provider === "gateio" || provider === "binance")) {
    selectionSince = Date.now();
    directFeed = new PublicMarketDataProvider(provider);
    stopDirectState = directFeed.onState(state => publishState(state));
    if (typeof window !== "undefined") {
      const online = () => directFeed?.reconnect(), offline = () => directFeed?.disconnect();
      const visible = () => { if (!document.hidden && navigator.onLine) online(); };
      window.addEventListener("online", online); window.addEventListener("offline", offline); document.addEventListener("visibilitychange", visible);
      removeNetworkWatch = () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", visible); };
    }
    return null;
  }
  const local = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  socket = io(process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL || (local ? `${window.location.protocol}//${window.location.hostname}:3003` : undefined), { path: "/socket.io", addTrailingSlash: false, transports: ["websocket"], timeout: 8000, reconnection: true, reconnectionAttempts: 8, reconnectionDelay: 1000, reconnectionDelayMax: 30000 });
  socket.on("connect", () => {
    subscribedKeys.clear(); selectionSince = Date.now();
    publishState({ state: "connecting", provider: undefined, environment: undefined, dataStatus: "DISCONNECTED", reason: undefined });
  });
  socket.on("disconnect", () => { subscribedKeys.clear(); publishState({ state: "disconnected", dataStatus: "DISCONNECTED" }); });
  socket.on("connect_error", () => publishState({ state: "unavailable", dataStatus: "UNAVAILABLE", reason: "Market gateway connection unavailable" }));
  socket.on("state", (state: GatewayState) => {
    const provider = useWorkspace.getState().marketProvider;
    publishState(state);
    if (gatewayMatches(provider, latestGatewayState)) for (const key of allSymbols()) subscribeSymbol(key);
  });
  const eventKey = (event: { symbol: string; provider?: ProviderId; environment?: "simulation" | "paper" | "live"; timestamp?: number }) => {
    if (!event || typeof event.symbol !== "string") return null;
    const provider = useWorkspace.getState().marketProvider;
    const view = gatewayView(latestGatewayState, provider);
    if (["disconnected", "unavailable", "reconnecting"].includes(view.state) || !acceptsStreamEvent(provider, latestGatewayState, event, selectionSince)) return null;
    const native = streamSymbol(event.symbol, provider);
    return native ? `${provider}:${native}` : null;
  };
  socket.on("trade", (event: TradeEvent) => { if (event.conditions?.includes("rest-bootstrap")) return; const key = eventKey(event); if (key) for (const listener of tradeSubscribers.get(key) ?? []) listener(event); });
  socket.on("quote", (event: QuoteEvent) => { const key = eventKey(event); if (key) for (const listener of quoteSubscribers.get(key) ?? []) listener(event); });
  socket.on("depth", (event: DepthEvent) => { const key = eventKey(event); if (key && Array.isArray(event.levels) && Number.isSafeInteger(event.sequence)) for (const listener of depthSubscribers.get(key) ?? []) listener(event); });
  socket.on("derivatives", (event: DerivativesEvent) => { const key = eventKey(event); if (key) for (const listener of derivativesSubscribers.get(key) ?? []) listener(event); });
  socket.on("liquidation", (event: LiquidationEvent) => { const key = eventKey(event); if (key) for (const listener of liquidationSubscribers.get(key) ?? []) listener(event); });
  socket.on("health", (health: FeedHealth) => {
    const provider = useWorkspace.getState().marketProvider;
    if (!health || !gatewayMatches(provider, latestGatewayState) || health.provider !== provider || !Number.isFinite(health.updatedAt) || health.updatedAt < selectionSince) return;
    const native = typeof health.symbol === "string" && streamSymbol(health.symbol, provider);
    if (native) for (const listener of healthSubscribers.get(`${provider}:${native}`) ?? []) listener(health);
  });
  if (typeof window !== "undefined") {
    const online = () => { if (socket && !socket.connected && navigator.onLine) socket.connect(); };
    const offline = () => { socket?.disconnect(); publishState({ state: "disconnected", dataStatus: "DISCONNECTED", reason: "Browser offline" }); };
    const visible = () => { if (!document.hidden) online(); };
    window.addEventListener("online", online); window.addEventListener("offline", offline); document.addEventListener("visibilitychange", visible);
    removeNetworkWatch = () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", visible); };
  }
  return socket;
}

function subscribeSet<T>(map: Map<string, Set<(value: T) => void>>, key: string, listener: (value: T) => void) {
  const already = allSymbols().has(key);
  const epoch = generation;
  const guarded = (value: T) => { if (epoch === generation) listener(value); };
  const current = map.get(key) ?? new Set<(value: T) => void>();
  current.add(guarded); map.set(key, current);
  if (!already) subscribeSymbol(key);
  let removed = false;
  return () => {
    if (removed) return; removed = true;
    current.delete(guarded); if (!current.size) map.delete(key);
    if (!allSymbols().has(key)) { directSubscriptions.get(key)?.(); directSubscriptions.delete(key); subscribedKeys.delete(key); socket?.emit("unsubscribe", { symbol: key.slice(key.indexOf(":") + 1) }); }
  };
}

/** Overlays share the selected transport and canonical workspace venue. */
export function subscribeMarketTrades(symbol: string, listener: (trade: TradeEvent) => void) {
  const bind = () => {
    ensureSocket();
    const provider = useWorkspace.getState().marketProvider;
    const native = streamSymbol(symbol, provider);
    return native ? subscribeSet(tradeSubscribers, `${provider}:${native}`, listener) : () => undefined;
  };
  let remove = bind();
  const watch = useWorkspace.subscribe((state, previous) => { if (state.marketProvider !== previous.marketProvider) { remove(); remove = bind(); } });
  let removed = false;
  return () => { if (removed) return; removed = true; watch(); remove(); releaseSocket(); };
}

export interface MarketStream {
  trades: TradeEvent[]; lastTrade: TradeEvent | null; quote: QuoteEvent | null; depth: DepthLevel[];
  depthSnapshot: DepthEvent | null;
  tradeStatus?: DataStatus; depthStatus?: DataStatus; observations?: OrderFlowSession | null;
  observation?: ReturnType<OrderFlowSession["getSnapshot"]>;
  derivatives: DerivativesEvent | null; derivativesHistory: DerivativesEvent[]; liquidations: LiquidationEvent[];
  health: FeedHealth | null; state: StreamState; dataStatus: DataStatus; provider: ProviderId;
  transport?: "direct" | "gateway"; effectiveProvider?: ProviderId; gatewayProvider?: ProviderId; environment: "live" | "simulation";
  nativeSymbol: string | null; canonicalSymbol: string | null; product: "future" | "perpetual" | "equity" | "index" | null; integrity: "simulated" | "provider-stream" | "unavailable"; sourceTimestamp?: number; retrievedAt?: number; reason?: string;
}

export function useMarketStream(symbol: string, options?: { trades?: number; depth?: boolean; liquidations?: number }) {
  const provider = useWorkspace(state => state.marketProvider);
  const workspaceId = useWorkspace(state => state.activeWorkspaceId);
  const tradeCap = options?.trades ?? 60, wantDepth = options?.depth ?? true, liquidationCap = options?.liquidations ?? 60;
  const native = streamSymbol(symbol, provider), key = `${provider}:${native}`;
  const [identity, setIdentity] = useState<string | null>(null);
  const [observations, setObservations] = useState<OrderFlowSession | null>(null);
  const observation = useSyncExternalStore(observations?.subscribe ?? emptySubscribe, observations?.getSnapshot ?? emptySnapshot, emptySnapshot);
  const observedTrades = useMemo(() => observation.trades.slice(-tradeCap), [observation.trades, tradeCap]);
  const [quote, setQuote] = useState<QuoteEvent | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativesEvent | null>(null);
  const [derivativesHistory, setDerivativesHistory] = useState<DerivativesEvent[]>([]);
  const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);
  const [rawHealth, setHealth] = useState<FeedHealth | null>(null);
  const [now, setNow] = useState(Date.now);
  const sharedHealth = observations ? observation.health : rawHealth;
  const health = provider === "mock" ? sharedHealth : freshFeedHealth(sharedHealth, Math.max(now, observation.now));
  const [gateway, setGateway] = useState(latestGatewayState);
  const acceptingTrades = useRef(false);
  useEffect(() => { stateSubscribers.add(setGateway); setGateway(latestGatewayState); return () => { stateSubscribers.delete(setGateway); releaseSocket(); }; }, []);
  useEffect(() => {
    const activeSocket = ensureSocket(), epoch = generation;
    acceptingTrades.current = provider === "mock";
    setIdentity(`${workspaceId}:${key}`); setQuote(null); setDerivatives(null); setDerivativesHistory([]); setLiquidations([]); setHealth(null);
    if (!native) { setObservations(null); return; }
    const owner = acquireOrderFlowSession(provider, native, provider === "mock" ? "simulation" : "live", workspaceId);
    const session = owner.session;
    setObservations(session);
    let active = true;
    let lastQuote: QuoteEvent | null = null;
    const visible = () => { if (active && epoch === generation && !document.hidden) { setNow(Date.now()); requestHealth(); if (lastQuote) setQuote(lastQuote); } };
    document.addEventListener("visibilitychange", visible);
    const receiveHealth = (raw: FeedHealth) => {
      const h = freshFeedHealth(raw, Date.now())!;
      session.updateHealth(h);
      if (session.health !== h) return;
      setHealth(h);
      acceptingTrades.current = provider === "mock" || (h.streams?.trades.state ?? h.state) === "LIVE";
    };
    const invalidate = (next: GatewayState) => {
      if (!gatewayMatches(provider, next) || ["connecting", "reconnecting", "disconnected", "unavailable"].includes(next.state ?? "")) {
        session.reset();
        acceptingTrades.current = false;
        lastQuote = null;
        setQuote(null); setDerivatives(null); setDerivativesHistory([]); setLiquidations([]); setHealth(null);
      }
    };
    stateSubscribers.add(invalidate);
    const removers = [
      subscribeSet(tradeSubscribers, key, (trade) => {
        if (!acceptingTrades.current) return;
        try { session.pushTrade(trade); } catch { session.clearTrades(); }
      }),
      subscribeSet(quoteSubscribers, key, event => { lastQuote = event; if (!document.hidden) setQuote(event); }),
      ...(wantDepth ? [subscribeSet(depthSubscribers, key, event => {
        try { session.pushDepth(event); } catch { session.clearDepth(); }
      })] : []),
      subscribeSet(derivativesSubscribers, key, event => { setDerivatives(event); setDerivativesHistory(previous => previous.concat(event).slice(-120)); }),
      subscribeSet(liquidationSubscribers, key, event => setLiquidations(previous => previous.concat(event).slice(-liquidationCap))),
      subscribeSet(healthSubscribers, key, receiveHealth),
    ];
    const requestHealth = () => {
      setNow(Date.now());
      if (!active || epoch !== generation || !gatewayMatches(provider, latestGatewayState)) return;
      if (directFeed) { receiveHealth(directFeed.health(native)); return; }
      activeSocket?.timeout(3000).emit("health", { symbol: native }, (error: Error | null, result: { ok?: boolean; health?: FeedHealth }) => {
        if (error) return;
        const h = result?.health;
        if (active && epoch === generation && result?.ok && h?.provider === provider && typeof h.symbol === "string" && streamSymbol(h.symbol, provider) === native && Number.isFinite(h.updatedAt) && h.updatedAt >= selectionSince) receiveHealth(h);
      });
    };
    requestHealth(); const timer = window.setInterval(requestHealth, 2000);
    return () => { active = false; stateSubscribers.delete(invalidate); document.removeEventListener("visibilitychange", visible); window.clearInterval(timer); for (const remove of removers) remove(); owner.release(); releaseSocket(); };
  }, [key, native, provider, workspaceId, tradeCap, wantDepth, liquidationCap]);
  const view = gatewayView(gateway, provider);
  const current = identity === `${workspaceId}:${key}` && gatewayMatches(provider, gateway);
  const connected = current && !["reconnecting", "disconnected", "unavailable"].includes(view.state);
  const tradesReady = connected && (provider === "mock" || (health?.streams?.trades.state ?? health?.state) === "LIVE");
  const depthReady = connected && (provider === "mock" || (health?.streams?.depth.state ?? health?.state) === "LIVE");
  const ready = tradesReady && depthReady;
  useEffect(() => { acceptingTrades.current = tradesReady; }, [tradesReady]);
  const dataStatus = !native ? "UNAVAILABLE" : tradesReady || depthReady ? provider === "mock" ? "SIMULATED" : ready ? "LIVE" : "DEGRADED" : view.dataStatus === "LIVE" && !ready ? health?.state === "STALE" ? "STALE" : health?.state === "UNAVAILABLE" ? "UNAVAILABLE" : health?.state === "DEGRADED" || health?.state === "GAP_DETECTED" ? "DEGRADED" : "DISCONNECTED" : view.dataStatus;
  const state: StreamState = !native ? "unavailable" : tradesReady || depthReady ? "connected" : dataStatus === "STALE" ? "stale" : dataStatus === "DEGRADED" ? "degraded" : view.state === "connected" && !ready ? "connecting" : view.state;
  useEffect(() => {
    const workspace = useWorkspace.getState();
    if (native && streamSymbol(workspace.symbol, provider) === native) workspace.setConnection({ state, dataStatus, provider, environment: provider === "mock" ? "simulation" : "live" });
  }, [native, provider, state, dataStatus]);
  return {
    trades: tradesReady ? observedTrades : emptyTrades, lastTrade: tradesReady ? observedTrades.at(-1) ?? null : null, quote: tradesReady || depthReady ? quote : null, depth: depthReady ? observation.depth?.levels ?? [] : [], depthSnapshot: depthReady ? observation.depth : null,
    tradeStatus: tradesReady ? provider === "mock" ? "SIMULATED" : "LIVE" : "UNAVAILABLE", depthStatus: depthReady ? provider === "mock" ? "SIMULATED" : "LIVE" : "UNAVAILABLE", observations: current ? observations : null, observation: current && observations ? observation : undefined,
    derivatives: ready ? derivatives : null, derivativesHistory: ready ? derivativesHistory : [], liquidations: ready ? liquidations : [],
    health: current ? health : null, state, dataStatus, provider,
    transport: directFeed ? "direct" : "gateway", effectiveProvider: tradesReady || depthReady ? gateway.provider : undefined, gatewayProvider: directFeed ? undefined : gateway.provider, environment: provider === "mock" ? "simulation" : "live",
    product: provider === "mock" ? CONTRACTS[symbol.toUpperCase()]?.product ?? null : native ? "perpetual" : null, nativeSymbol: native, canonicalSymbol: native?.replace(/-SWAP$/, "").replace(/[_-]/g, "") ?? null, integrity: ready ? provider === "mock" ? "simulated" : "provider-stream" : "unavailable", sourceTimestamp: ready ? Math.max(observedTrades.at(-1)?.timestamp ?? 0, quote?.timestamp ?? 0) || undefined : undefined, retrievedAt: current ? health?.updatedAt : undefined,
    reason: !native ? "No supported native instrument mapping" : ready ? health?.reason : health?.reason ?? view.reason ?? (!ready ? "Waiting for matching instrument data and health" : undefined),
  } satisfies MarketStream;
}
