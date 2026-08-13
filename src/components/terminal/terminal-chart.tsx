"use client";

/* Canvas rendering intentionally coordinates refs and browser observers outside React render state. */
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/immutability */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getContract } from "@/lib/market/contracts";
import type { Bar } from "@/lib/market/types";
import { useMarketStream } from "@/hooks/use-market-stream";
import { alignToTimeframe } from "@/lib/market/session";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";

export type ChartType = "candles" | "bars" | "line" | "area";

export interface ChartIndicators {
  vwap: boolean;
  ema20: boolean;
  ema50: boolean;
  volume: boolean;
}

export interface TradeMarker {
  t: number;     // bar time
  side: "buy" | "sell";
  price: number;
  qty: number;
  label?: string;
}

interface ChartProps {
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
  indicators: ChartIndicators;
  replayIndex?: number | null; // when in replay, show bars up to this index
  markers?: TradeMarker[];
  onCrosshair?: (b: Bar | null) => void;
}

const PRICE_AXIS_W = 64;
const TIME_AXIS_H = 22;
const VOL_PANE_H = 64;

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (!values.length) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Session-anchored VWAP, reset each ET trading day (approx via UTC day). */
function sessionVWAP(bars: Bar[]): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  let dayKey = "";
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const d = new Date(b.t);
    // ET-ish day key (subtract 5h)
    const et = new Date(d.getTime() - 5 * 3600_000);
    const key = et.toISOString().slice(0, 10);
    if (key !== dayKey) {
      dayKey = key;
      cumPV = 0;
      cumV = 0;
    }
    const tp = (b.h + b.l + b.c) / 3;
    cumPV += tp * b.v;
    cumV += b.v;
    out[i] = cumV > 0 ? cumPV / cumV : b.c;
  }
  return out;
}

function themeVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function themeColors() {
  return {
    bg: themeVar("--background", "#0a0a0a"),
    panel: themeVar("--panel", "#111111"),
    grid: "rgba(255,255,255,0.045)",
    axisText: themeVar("--muted-foreground", "#888"),
    pos: themeVar("--pos", "#34d399"),
    neg: themeVar("--neg", "#ef4444"),
    warn: themeVar("--warn", "#e0a526"),
    mdata: themeVar("--mdata", "#3fa9c9"),
    research: themeVar("--research", "#8e7bd8"),
    cross: "rgba(255,255,255,0.45)",
    fg: themeVar("--foreground", "#e8e6e1"),
  };
}

function fmtPrice(p: number, tick: number): string {
  const decimals = tick >= 1 ? 2 : tick >= 0.1 ? 2 : Math.max(2, Math.round(-Math.log10(tick)));
  return p.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtTime(t: number, tf: Timeframe): string {
  const d = new Date(t);
  const et = new Date(t - 5 * 3600_000);
  if (tf === "1d" || tf === "1w") return et.toISOString().slice(5, 10);
  return et.toISOString().slice(11, 16);
}

export function TerminalChart({
  symbol,
  timeframe,
  chartType,
  indicators,
  replayIndex,
  markers,
  onCrosshair,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // view state
  const view = useRef({ right: 0, count: 120 }); // right = index past the right edge
  const cross = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef<{ x: number; right: number } | null>(null);
  const raf = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const contract = getContract(symbol);
  const tfSec = TIMEFRAME_SECONDS[timeframe];

  // live trade stream -> update last candle
  const { lastTrade } = useMarketStream(symbol, { trades: 1, depth: false });

  // fetch historical bars
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const to = Date.now();
        const barsCount = 600;
        const from = to - barsCount * tfSec * 1000;
        const r = await fetch(`/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&to=${to}&bars=${barsCount}`);
        if (!r.ok) throw new Error("fetch failed");
        const json = await r.json();
        if (cancelled) return;
        const b: Bar[] = json.bars;
        if (b.length) view.current.right = Math.min(20, b.length);
        setBars(b);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setErr(String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, tfSec]);

  // live update last candle from trade stream
  useEffect(() => {
    if (!lastTrade || !bars.length) return;
    const t = lastTrade.timestamp;
    const bucket = alignToTimeframe(t, timeframe);
    setBars((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (!last) return prev;
      if (bucket === last.t) {
        next[next.length - 1] = {
          ...last,
          c: lastTrade.price,
          h: Math.max(last.h, lastTrade.price),
          l: Math.min(last.l, lastTrade.price),
          v: last.v + lastTrade.quantity,
        };
      } else if (bucket > last.t) {
        next.push({
          t: bucket,
          o: last.c,
          h: Math.max(last.c, lastTrade.price),
          l: Math.min(last.c, lastTrade.price),
          c: lastTrade.price,
          v: lastTrade.quantity,
        });
        if (next.length > 2000) next.shift();
        view.current.right = Math.min(view.current.right + 1, 20);
      }
      return next;
    });
  }, [lastTrade, timeframe]);

  // resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const w = Math.floor(e.contentRect.width);
      const h = Math.floor(e.contentRect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w, h, dpr };
      scheduleDraw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scheduleDraw = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, [bars, chartType, indicators, replayIndex, markers]);

  // redraw when data/view changes
  useEffect(() => {
    scheduleDraw();
  }, [bars, chartType, indicators, replayIndex, markers, scheduleDraw]);

  const visibleBars = useMemo(() => {
    let end = bars.length - view.current.right;
    if (replayIndex != null) end = Math.min(end, replayIndex + 1);
    end = Math.max(1, Math.min(end, bars.length));
    const count = view.current.count;
    let start = end - count;
    if (start < 0) {
      end = Math.min(bars.length, end - start);
      start = 0;
    }
    return bars.slice(start, end);
  }, [bars, replayIndex]);

  // ----- drawing -----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = themeColors();
    ctx.clearRect(0, 0, w, h);

    const plotW = w - PRICE_AXIS_W;
    const priceH = h - TIME_AXIS_H - (indicators.volume ? VOL_PANE_H + 6 : 0);
    const volTop = priceH + 6;
    const volH = indicators.volume ? VOL_PANE_H : 0;

    const vb = visibleBars;
    if (!vb.length) {
      ctx.fillStyle = c.axisText;
      ctx.font = "11px var(--font-geist-mono), monospace";
      ctx.textAlign = "center";
      ctx.fillText("No data", w / 2, h / 2);
      return;
    }

    // price range
    let hi = -Infinity, lo = Infinity, maxVol = 0;
    for (const b of vb) {
      if (b.h > hi) hi = b.h;
      if (b.l < lo) lo = b.l;
      if (b.v > maxVol) maxVol = b.v;
    }
    // include overlays in range (vwap/ema)
    const ema20 = indicators.ema20 ? ema(vb.map((b) => b.c), 20) : [];
    const ema50 = indicators.ema50 ? ema(vb.map((b) => b.c), 50) : [];
    const vwap = indicators.vwap ? sessionVWAP(vb) : [];
    for (const v of [...ema20, ...ema50, ...vwap]) if (typeof v === "number") { hi = Math.max(hi, v); lo = Math.min(lo, v); }
    const pad = (hi - lo) * 0.08 || hi * 0.01;
    hi += pad; lo -= pad;
    const range = hi - lo || 1;

    const xFor = (i: number) => (i + 0.5) * (plotW / vb.length);
    const candleW = Math.max(1, Math.min(14, (plotW / vb.length) * 0.7));
    const yFor = (p: number) => priceH - ((p - lo) / range) * priceH;

    // grid (horizontal price lines, ~6)
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = c.axisText;
    ctx.textAlign = "left";
    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const p = lo + (range * i) / gridSteps;
      const y = yFor(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.fillText(fmtPrice(p, contract.tickSize), plotW + 6, y + 3);
    }
    // vertical time grid
    const timeStep = Math.max(1, Math.floor(vb.length / 6));
    ctx.textAlign = "center";
    for (let i = 0; i < vb.length; i += timeStep) {
      const x = xFor(i);
      ctx.strokeStyle = c.grid;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, priceH);
      ctx.stroke();
      ctx.fillStyle = c.axisText;
      ctx.fillText(fmtTime(vb[i].t, timeframe), x, h - 6);
    }

    // volume pane
    if (indicators.volume) {
      for (let i = 0; i < vb.length; i++) {
        const b = vb[i];
        const vh = (b.v / maxVol) * (volH - 4);
        const x = xFor(i) - candleW / 2;
        ctx.fillStyle = b.c >= b.o ? "rgba(52,211,153,0.28)" : "rgba(239,68,68,0.28)";
        ctx.fillRect(x, volTop + (volH - vh), candleW, vh);
      }
      ctx.strokeStyle = c.grid;
      ctx.beginPath();
      ctx.moveTo(0, volTop + volH);
      ctx.lineTo(plotW, volTop + volH);
      ctx.stroke();
    }

    // candles / bars / line / area
    ctx.lineWidth = 1;
    for (let i = 0; i < vb.length; i++) {
      const b = vb[i];
      const x = xFor(i);
      const up = b.c >= b.o;
      const col = up ? c.pos : c.neg;
      if (chartType === "candles" || chartType === "bars") {
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        // wick
        ctx.beginPath();
        ctx.moveTo(x, yFor(b.h));
        ctx.lineTo(x, yFor(b.l));
        ctx.stroke();
        if (chartType === "candles") {
          const yo = yFor(b.o), yc = yFor(b.c);
          const top = Math.min(yo, yc);
          const bh = Math.max(1, Math.abs(yc - yo));
          ctx.fillRect(x - candleW / 2, top, candleW, bh);
        } else {
          // OHLC bars
          ctx.beginPath();
          ctx.moveTo(x - candleW / 2, yFor(b.o));
          ctx.lineTo(x, yFor(b.o));
          ctx.moveTo(x, yFor(b.h));
          ctx.lineTo(x, yFor(b.l));
          ctx.moveTo(x, yFor(b.c));
          ctx.lineTo(x + candleW / 2, yFor(b.c));
          ctx.stroke();
        }
      }
    }
    if (chartType === "line" || chartType === "area") {
      ctx.strokeStyle = c.mdata;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      vb.forEach((b, i) => {
        const x = xFor(i), y = yFor(b.c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      if (chartType === "area") {
        ctx.lineTo(xFor(vb.length - 1), priceH);
        ctx.lineTo(xFor(0), priceH);
        ctx.closePath();
        ctx.fillStyle = "rgba(63,169,201,0.10)";
        ctx.fill();
      }
    }

    // overlays
    const drawLine = (vals: (number | null)[], color: string, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v == null) continue;
        const x = xFor(i), y = yFor(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (indicators.vwap) drawLine(vwap, c.warn, [4, 3]);
    if (indicators.ema20) drawLine(ema20, c.mdata);
    if (indicators.ema50) drawLine(ema50, c.research);

    // trade markers
    if (markers?.length) {
      for (const m of markers) {
        const idx = vb.findIndex((b) => b.t === m.t || (b.t <= m.t && m.t < b.t + tfSec * 1000));
        if (idx < 0) continue;
        const x = xFor(idx);
        const y = yFor(m.price);
        ctx.strokeStyle = m.side === "buy" ? c.pos : c.neg;
        ctx.fillStyle = m.side === "buy" ? c.pos : c.neg;
        const ay = m.side === "buy" ? y + 10 : y - 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, ay);
        ctx.lineTo(x + 3, ay);
        ctx.closePath();
        ctx.fill();
        if (m.label) {
          ctx.font = "9px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(m.label, x, ay + (m.side === "buy" ? 9 : -3));
        }
      }
    }

    // last price line + label
    const last = vb[vb.length - 1];
    const lastY = yFor(last.c);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, lastY);
    ctx.lineTo(plotW, lastY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = last.c >= last.o ? c.pos : c.neg;
    ctx.fillRect(plotW, lastY - 8, PRICE_AXIS_W, 16);
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold 10.5px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(fmtPrice(last.c, contract.tickSize), plotW + 6, lastY + 3);

    // crosshair
    if (cross.current) {
      const { x, y } = cross.current;
      if (x < plotW && y < priceH) {
        ctx.strokeStyle = c.cross;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, priceH);
        ctx.moveTo(0, y); ctx.lineTo(plotW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // price label
        const p = lo + (1 - y / priceH) * range;
        ctx.fillStyle = c.panel;
        ctx.fillRect(plotW, y - 8, PRICE_AXIS_W, 16);
        ctx.fillStyle = c.fg;
        ctx.font = "10.5px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.fillText(fmtPrice(p, contract.tickSize), plotW + 6, y + 3);

        // OHLC tooltip
        const i = Math.floor((x / plotW) * vb.length);
        const b = vb[Math.max(0, Math.min(vb.length - 1, i))];
        if (b && onCrosshair) onCrosshair(b);
        const up = b.c >= b.o;
        const lines = [
          ["O", fmtPrice(b.o, contract.tickSize)],
          ["H", fmtPrice(b.h, contract.tickSize)],
          ["L", fmtPrice(b.l, contract.tickSize)],
          ["C", fmtPrice(b.c, contract.tickSize)],
          ["V", b.v.toLocaleString()],
        ];
        let ty = 8;
        ctx.font = "10.5px ui-monospace, monospace";
        for (const [k, v] of lines) {
          ctx.fillStyle = c.axisText;
          ctx.textAlign = "left";
          ctx.fillText(k, 8, ty);
          ctx.fillStyle = up ? c.pos : c.neg;
          ctx.fillText(v, 24, ty);
          ty += 13;
        }
      } else if (onCrosshair) {
        onCrosshair(null);
      }
    }
  }, [visibleBars, chartType, indicators, contract.tickSize, markers, timeframe, onCrosshair]);

  // pointer handlers
  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragging.current) {
      const dx = e.clientX - dragging.current.x;
      const barsPerPx = view.current.count / (rect.width - PRICE_AXIS_W);
      const shifted = Math.round(dx * barsPerPx);
      view.current.right = Math.max(0, Math.min(bars.length - view.current.count, dragging.current.right - shifted));
      scheduleDraw();
    }
    cross.current = { x, y };
    scheduleDraw();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = { x: e.clientX, right: view.current.right };
  };
  const onPointerUp = () => {
    dragging.current = null;
  };
  const onPointerLeave = () => {
    cross.current = null;
    onCrosshair?.(null);
    scheduleDraw();
  };
  const onWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 1.15 : 0.87;
    view.current.count = Math.max(30, Math.min(400, Math.round(view.current.count * delta)));
    scheduleDraw();
  };

  // keyboard pan/zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "+" || e.key === "=") { view.current.count = Math.max(30, Math.round(view.current.count * 0.87)); scheduleDraw(); }
      else if (e.key === "-" || e.key === "_") { view.current.count = Math.min(400, Math.round(view.current.count * 1.15)); scheduleDraw(); }
      else if (e.key === "ArrowLeft") { view.current.right = Math.min(bars.length - view.current.count, view.current.right + Math.round(view.current.count * 0.1)); scheduleDraw(); }
      else if (e.key === "ArrowRight") { view.current.right = Math.max(0, view.current.right - Math.round(view.current.count * 0.1)); scheduleDraw(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bars.length, scheduleDraw]);

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-background">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-crosshair"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        aria-label={`${symbol} ${timeframe} chart`}
      />
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground uppercase tracking-wider">
          loading…
        </div>
      )}
      {err && (
        <div className="absolute inset-0 grid place-items-center text-[11px] text-neg">
          {err}
        </div>
      )}
    </div>
  );
}
