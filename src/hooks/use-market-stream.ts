"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  DepthLevel,
  QuoteEvent,
  TradeEvent,
} from "@/lib/market/types";
import { useWorkspace } from "@/stores/workspace";

/**
 * Singleton socket to the market-data mini-service.
 *
 * Connection per the gateway rules: io("/?XTransformPort=3003").
 * Reconnection + subscription restoration are handled here and in the
 * server (heartbeats via socket.io ping/pong).
 */
let socket: Socket | null = null;
const subscribers = new Map<string, Set<(t: TradeEvent) => void>>();
const quoteSubs = new Map<string, Set<(q: QuoteEvent) => void>>();
const depthSubs = new Map<string, Set<(d: DepthLevel[]) => void>>();
let backoff = 1000;

function ensureSocket(onState: (s: string) => void): Socket {
  if (socket) return socket;
  socket = io("/?XTransformPort=3003", {
    path: "/",
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  socket.on("connect", () => {
    backoff = 1000;
    onState("connected");
    // restore subscriptions
    for (const symbol of subscribers.keys()) {
      socket!.emit("subscribe", { symbol });
    }
  });
  socket.on("disconnect", () => onState("disconnected"));
  socket.on("reconnect_attempt", () => onState("reconnecting"));
  socket.on("reconnect_failed", () => onState("disconnected"));

  socket.on("trade", (t: TradeEvent) => {
    const set = subscribers.get(t.symbol);
    if (set) for (const fn of set) fn(t);
  });
  socket.on("quote", (q: QuoteEvent) => {
    const set = quoteSubs.get(q.symbol);
    if (set) for (const fn of set) fn(q);
  });
  socket.on("depth", (d: { symbol: string; levels: DepthLevel[] }) => {
    const set = depthSubs.get(d.symbol);
    if (set) for (const fn of set) fn(d.levels);
  });
  return socket;
}

function refSymbol(symbol: string) {
  let s = subscribers.get(symbol);
  if (!s) {
    s = new Set();
    subscribers.set(symbol, s);
  }
  return s;
}

export interface MarketStream {
  trades: TradeEvent[];
  lastTrade: TradeEvent | null;
  quote: QuoteEvent | null;
  depth: DepthLevel[];
  state: "connected" | "connecting" | "reconnecting" | "disconnected";
}

/**
 * Subscribe to live (SIMULATED) trades/quotes/depth for a symbol.
 * Keeps a bounded buffer of recent trades for the UI.
 */
export function useMarketStream(symbol: string, opts?: { trades?: number; depth?: boolean }) {
  const tradeCap = opts?.trades ?? 60;
  const wantDepth = opts?.depth ?? true;
  const setConnection = useWorkspace((s) => s.setConnection);
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [quote, setQuote] = useState<QuoteEvent | null>(null);
  const [depth, setDepth] = useState<DepthLevel[]>([]);
  const [state, setState] = useState<MarketStream["state"]>("connecting");
  const rafRef = useRef<number>(0);
  const pendingTrades = useRef<TradeEvent[]>([]);

  useEffect(() => {
    const sym = symbol.toUpperCase();
    const s = ensureSocket((st) => {
      setState(st as MarketStream["state"]);
      setConnection({ state: st as never, dataStatus: st === "connected" ? "SIMULATED" : "DISCONNECTED" });
    });

    const tHandler = (t: TradeEvent) => {
      pendingTrades.current.push(t);
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const batch = pendingTrades.current;
          pendingTrades.current = [];
          setTrades((prev) => {
            const next = prev.concat(batch);
            return next.length > tradeCap ? next.slice(next.length - tradeCap) : next;
          });
        });
      }
    };
    const qHandler = (q: QuoteEvent) => setQuote(q);
    const dHandler = (lv: DepthLevel[]) => setDepth(lv);

    refSymbol(sym).add(tHandler);
    let qs = quoteSubs.get(sym);
    if (!qs) {
      qs = new Set();
      quoteSubs.set(sym, qs);
    }
    qs.add(qHandler);
    if (wantDepth) {
      let ds = depthSubs.get(sym);
      if (!ds) {
        ds = new Set();
        depthSubs.set(sym, ds);
      }
      ds.add(dHandler);
    }

    if (s.connected) {
      // already connected — sync state without a synchronous effect setState
      queueMicrotask(() => setState("connected"));
    }
    s.emit("subscribe", { symbol: sym });

    return () => {
      subscribers.get(sym)?.delete(tHandler);
      quoteSubs.get(sym)?.delete(qHandler);
      depthSubs.get(sym)?.delete(dHandler);
      s.emit("unsubscribe", { symbol: sym });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [symbol, tradeCap, wantDepth]);

  return { trades, lastTrade: trades[trades.length - 1] ?? null, quote, depth, state };
}
