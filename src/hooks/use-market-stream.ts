"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { DataStatus, DepthLevel, QuoteEvent, TradeEvent } from "@/lib/market/types";
import { useWorkspace } from "@/stores/workspace";

type StreamState = "connected" | "connecting" | "reconnecting" | "stale" | "degraded" | "unavailable" | "disconnected";
type GatewayState = {
  state?: string;
  provider?: "mock" | "gateio" | "rithmic-test" | "rithmic-prod";
  environment?: "simulation" | "paper" | "live";
  dataStatus?: DataStatus;
  reason?: string;
  at?: number;
};

let socket: Socket | null = null;
const tradeSubscribers = new Map<string, Set<(trade: TradeEvent) => void>>();
const quoteSubscribers = new Map<string, Set<(quote: QuoteEvent) => void>>();
const depthSubscribers = new Map<string, Set<(levels: DepthLevel[]) => void>>();
const stateSubscribers = new Set<(state: GatewayState) => void>();
let latestGatewayState: GatewayState = { state: "connecting", provider: "gateio", environment: "live", dataStatus: "DISCONNECTED" };

function allSymbols() {
  return new Set([...tradeSubscribers.keys(), ...quoteSubscribers.keys(), ...depthSubscribers.keys()]);
}

function normalizeStreamState(state?: string): StreamState {
  if (state === "live" || state === "connected") return "connected";
  if (state === "reconnecting") return "reconnecting";
  if (state === "stale") return "stale";
  if (state === "degraded") return "degraded";
  if (state === "unavailable") return "unavailable";
  if (state === "connecting") return "connecting";
  return "disconnected";
}

function publishState(next: GatewayState) {
  latestGatewayState = { ...latestGatewayState, ...next };
  for (const listener of stateSubscribers) listener(latestGatewayState);
}

function ensureSocket(): Socket {
  if (socket) return socket;
  const isLocalGateway = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const gatewayUrl = isLocalGateway ? `${window.location.protocol}//${window.location.hostname}:3003` : "/?XTransformPort=3003";
  socket = io(gatewayUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
  });
  socket.on("connect", () => {
    publishState({ state: "connecting", dataStatus: "DISCONNECTED" });
    for (const symbol of allSymbols()) socket!.emit("subscribe", { symbol, types: ["trade", "quote", "depth"] });
  });
  socket.on("disconnect", () => publishState({ state: "disconnected", dataStatus: "DISCONNECTED" }));
  socket.on("reconnect_attempt", () => publishState({ state: "reconnecting", dataStatus: "DISCONNECTED" }));
  socket.on("reconnect_failed", () => publishState({ state: "unavailable", dataStatus: "UNAVAILABLE" }));
  socket.on("state", (state: GatewayState) => publishState(state));
  socket.on("trade", (trade: TradeEvent) => {
    for (const listener of tradeSubscribers.get(trade.symbol) ?? []) listener(trade);
  });
  socket.on("quote", (quote: QuoteEvent) => {
    for (const listener of quoteSubscribers.get(quote.symbol) ?? []) listener(quote);
  });
  socket.on("depth", (depth: { symbol: string; levels: DepthLevel[] }) => {
    for (const listener of depthSubscribers.get(depth.symbol) ?? []) listener(depth.levels);
  });
  return socket;
}

function subscribeSet<T>(map: Map<string, Set<(value: T) => void>>, symbol: string, listener: (value: T) => void) {
  const current = map.get(symbol) ?? new Set<(value: T) => void>();
  current.add(listener);
  map.set(symbol, current);
  return () => {
    current.delete(listener);
    if (!current.size) map.delete(symbol);
  };
}

export interface MarketStream {
  trades: TradeEvent[];
  lastTrade: TradeEvent | null;
  quote: QuoteEvent | null;
  depth: DepthLevel[];
  state: StreamState;
  dataStatus: DataStatus;
  provider: GatewayState["provider"];
  reason?: string;
}

/**
 * Subscribe to read-only market data from the server-side gateway. The UI
 * preserves an explicit SIMULATED state only when the server is configured
 * with MARKET_PROVIDER=mock; it never silently manufactures live values.
 */
export function useMarketStream(symbol: string, options?: { trades?: number; depth?: boolean }) {
  const tradeCap = options?.trades ?? 60;
  const wantDepth = options?.depth ?? true;
  const setConnection = useWorkspace((state) => state.setConnection);
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [quote, setQuote] = useState<QuoteEvent | null>(null);
  const [depth, setDepth] = useState<DepthLevel[]>([]);
  const [gatewayState, setGatewayState] = useState<GatewayState>(latestGatewayState);
  const rafRef = useRef<number>(0);
  const pendingTrades = useRef<TradeEvent[]>([]);

  useEffect(() => {
    const onState = (next: GatewayState) => {
      setGatewayState(next);
      const normalized = normalizeStreamState(next.state);
      setConnection({
        state: normalized,
        provider: next.provider ?? "gateio",
        environment: next.environment ?? "live",
        dataStatus: next.dataStatus ?? "DISCONNECTED",
      });
    };
    stateSubscribers.add(onState);
    onState(latestGatewayState);
    return () => {
      stateSubscribers.delete(onState);
    };
  }, [setConnection]);

  useEffect(() => {
    const sym = symbol.toUpperCase();
    const activeSocket = ensureSocket();
    const removeTrade = subscribeSet(tradeSubscribers, sym, (trade) => {
      pendingTrades.current.push(trade);
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const batch = pendingTrades.current;
          pendingTrades.current = [];
          setTrades((previous) => {
            const next = previous.concat(batch);
            return next.length > tradeCap ? next.slice(-tradeCap) : next;
          });
        });
      }
    });
    const removeQuote = subscribeSet(quoteSubscribers, sym, setQuote);
    const removeDepth = wantDepth ? subscribeSet(depthSubscribers, sym, setDepth) : () => undefined;

    activeSocket.emit("subscribe", { symbol: sym, types: ["trade", "quote", "depth"] });
    return () => {
      removeTrade();
      removeQuote();
      removeDepth();
      if (!allSymbols().has(sym)) activeSocket.emit("unsubscribe", { symbol: sym });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [symbol, tradeCap, wantDepth]);

  return {
    trades,
    lastTrade: trades.at(-1) ?? null,
    quote,
    depth,
    state: normalizeStreamState(gatewayState.state),
    dataStatus: gatewayState.dataStatus ?? "DISCONNECTED",
    provider: gatewayState.provider,
    reason: gatewayState.reason,
  } satisfies MarketStream;
}
