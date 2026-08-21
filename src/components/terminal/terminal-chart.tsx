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

export interface ChartStudy {
  id: string;
  name: string;
  kind: "ema" | "sma" | "vwap";
  period?: number;
  color: string;
  visible: boolean;
  source?: "native" | "migration";
}

export interface ChartIndicators {
  vwap: boolean;
  ema20: boolean;
  ema50: boolean;
  volume: boolean;
  customStudies?: ChartStudy[];
}

export interface TradeMarker {
  t: number;     // bar time
  side: "buy" | "sell";
  price: number;
  qty: number;
  label?: string;
}

export interface ChartSettings {
  futureBars: number;
  gridOpacity: number;
  candleUpColor: string;
  candleDownColor: string;
  backgroundColor: string;
  showGrid: boolean;
  showPriceLine: boolean;
  showCrosshair: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  futureBars: 24,
  gridOpacity: 0.075,
  candleUpColor: "#34d399",
  candleDownColor: "#ef4444",
  backgroundColor: "#0a0a0a",
  showGrid: true,
  showPriceLine: true,
  showCrosshair: true,
};

interface ChartProps {
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
  indicators: ChartIndicators;
  replayIndex?: number | null; // when in replay, show bars up to this index
  markers?: TradeMarker[];
  settings?: ChartSettings;
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

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
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
  settings = DEFAULT_CHART_SETTINGS,
  onCrosshair,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewVersion, setViewVersion] = useState(0);

  // right is the number of time slots reserved after the latest candle.
  // Keeping it in a ref gives pointer events immediate feedback, while the
  // version state invalidates the derived viewport after every interaction.
  const view = useRef({ right: settings.futureBars, count: 120 }); // right = index past the right edge
  const priceView = useRef({ offset: 0, zoom: 1 });
  const priceMetrics = useRef({ autoCenter: 0, autoRange: 1, priceHeight: 1 });
  const cross = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef<{ mode: "time" | "price"; x: number; y: number; right: number; priceZoom: number } | null>(null);
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
        if (b.length) {
          view.current.right = settings.futureBars;
          setViewVersion((version) => version + 1);
        }
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
  }, [symbol, timeframe, tfSec, settings.futureBars]);

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
  }, [bars, chartType, indicators, replayIndex, markers, settings, viewVersion]);

  // redraw when data/view changes
  useEffect(() => {
    scheduleDraw();
  }, [bars, chartType, indicators, replayIndex, markers, settings, viewVersion, scheduleDraw]);

  const viewport = useMemo(() => {
    const count = view.current.count;
    const availableBars = replayIndex == null ? bars.length : Math.min(bars.length, replayIndex + 1);
    // A positive right offset intentionally projects the timeline beyond the
    // latest market candle. A negative offset pans backward through history.
    const virtualEnd = availableBars + view.current.right;
    const virtualStart = virtualEnd - count;
    const start = Math.max(0, Math.ceil(virtualStart));
    const end = Math.max(start, Math.min(availableBars, Math.floor(virtualEnd)));
    return { bars: bars.slice(start, end), count, start, virtualStart, availableBars };
  }, [bars, replayIndex, viewVersion]);

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
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    const plotW = w - PRICE_AXIS_W;
    const priceH = h - TIME_AXIS_H - (indicators.volume ? VOL_PANE_H + 6 : 0);
    const volTop = priceH + 6;
    const volH = indicators.volume ? VOL_PANE_H : 0;

    const vb = viewport.bars;
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
    // include overlays in range (vwap/ema/custom native studies)
    const closes = vb.map((b) => b.c);
    const ema20 = indicators.ema20 ? ema(closes, 20) : [];
    const ema50 = indicators.ema50 ? ema(closes, 50) : [];
    const vwap = indicators.vwap ? sessionVWAP(vb) : [];
    const customLines = (indicators.customStudies ?? []).filter((study) => study.visible).map((study) => ({
      study,
      values: study.kind === "ema" ? ema(closes, Math.max(1, study.period ?? 20)) : study.kind === "sma" ? sma(closes, Math.max(1, study.period ?? 20)) : sessionVWAP(vb),
    }));
    for (const v of [...ema20, ...ema50, ...vwap, ...customLines.flatMap((line) => line.values)]) if (typeof v === "number") { hi = Math.max(hi, v); lo = Math.min(lo, v); }
    const pad = (hi - lo) * 0.08 || hi * 0.01;
    hi += pad; lo -= pad;
    const autoRange = hi - lo || 1;
    const manualRange = autoRange / priceView.current.zoom;
    const autoCenter = (hi + lo) / 2;
    priceMetrics.current = { autoCenter, autoRange, priceHeight: Math.max(1, priceH) };
    const manualCenter = autoCenter + priceView.current.offset * autoRange;
    hi = manualCenter + manualRange / 2;
    lo = manualCenter - manualRange / 2;
    const range = hi - lo || 1;

    const slotW = plotW / viewport.count;
    // Map bars into a virtual timeline. When the viewport extends beyond the
    // newest candle, the unused right-hand slots stay deliberately blank.
    const xFor = (i: number) => (i + viewport.start - viewport.virtualStart + 0.5) * slotW;
    const candleW = Math.max(1, Math.min(14, slotW * 0.7));
    const gridColor = `rgba(255,255,255,${settings.showGrid ? settings.gridOpacity : 0})`;
    const yFor = (p: number) => priceH - ((p - lo) / range) * priceH;

    // grid (horizontal price lines, ~6)
    ctx.strokeStyle = gridColor;
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
      ctx.strokeStyle = gridColor;
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
        ctx.fillStyle = b.c >= b.o ? `${settings.candleUpColor}48` : `${settings.candleDownColor}48`;
        ctx.fillRect(x, volTop + (volH - vh), candleW, vh);
      }
      ctx.strokeStyle = gridColor;
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
      const col = up ? settings.candleUpColor : settings.candleDownColor;
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
    for (const line of customLines) drawLine(line.values, line.study.color, line.study.kind === "vwap" ? [4, 3] : []);

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
    if (settings.showPriceLine) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(0, lastY);
      ctx.lineTo(plotW, lastY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = last.c >= last.o ? settings.candleUpColor : settings.candleDownColor;
    ctx.fillRect(plotW, lastY - 8, PRICE_AXIS_W, 16);
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold 10.5px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(fmtPrice(last.c, contract.tickSize), plotW + 6, lastY + 3);

    // crosshair
    if (settings.showCrosshair && cross.current) {
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
        const virtualIndex = Math.floor(x / slotW + viewport.virtualStart);
        const localIndex = virtualIndex - viewport.start;
        const b = vb[localIndex];
        if (b && onCrosshair) onCrosshair(b);
        if (!b) return;
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
  }, [viewport, chartType, indicators, contract.tickSize, markers, timeframe, onCrosshair, settings]);

  // pointer handlers
  const maxFutureBars = Math.max(settings.futureBars * 5, 160);
  const minRightOffset = -Math.max(0, bars.length - 1);
  const clampRight = (right: number) => Math.max(minRightOffset, Math.min(maxFutureBars, right));
  const invalidateViewport = () => setViewVersion((version) => version + 1);
  const resetViewport = () => {
    view.current.right = settings.futureBars;
    view.current.count = 120;
    priceView.current = { offset: 0, zoom: 1 };
    invalidateViewport();
  };
  const resetPriceScale = () => {
    priceView.current = { offset: 0, zoom: 1 };
    invalidateViewport();
  };
  const zoomPriceScaleAtPointer = (nextZoom: number, clientY: number, rect: DOMRect) => {
    const metrics = priceMetrics.current;
    const zoom = Math.max(0.35, Math.min(8, nextZoom));
    const fractionFromCenter = 0.5 - Math.max(0, Math.min(1, (clientY - rect.top) / metrics.priceHeight));
    const currentCenter = metrics.autoCenter + priceView.current.offset * metrics.autoRange;
    const currentRange = metrics.autoRange / priceView.current.zoom;
    const anchoredPrice = currentCenter + fractionFromCenter * currentRange;
    const nextRange = metrics.autoRange / zoom;
    const nextCenter = anchoredPrice - fractionFromCenter * nextRange;
    priceView.current = {
      zoom,
      offset: Math.max(-3, Math.min(3, (nextCenter - metrics.autoCenter) / metrics.autoRange)),
    };
    invalidateViewport();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragging.current) {
      if (dragging.current.mode === "price") {
        // TradingView-style: dragging the price scale stretches or compresses
        // candle height around the pointer rather than panning the time series.
        const deltaY = e.clientY - dragging.current.y;
        const nextZoom = dragging.current.priceZoom * Math.exp(-deltaY * 0.01);
        zoomPriceScaleAtPointer(nextZoom, e.clientY, rect);
      } else {
        const dx = e.clientX - dragging.current.x;
        const plotWidth = Math.max(1, rect.width - PRICE_AXIS_W);
        const shifted = Math.round(dx * (view.current.count / plotWidth));
        const nextRight = clampRight(dragging.current.right - shifted);
        if (nextRight !== view.current.right) {
          view.current.right = nextRight;
          invalidateViewport();
        }
      }
    }
    cross.current = { x, y };
    scheduleDraw();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.focus();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const x = e.clientX - canvasRef.current!.getBoundingClientRect().left;
    dragging.current = {
      mode: x >= canvasRef.current!.getBoundingClientRect().width - PRICE_AXIS_W ? "price" : "time",
      x: e.clientX,
      y: e.clientY,
      right: view.current.right,
      priceZoom: priceView.current.zoom,
    };
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
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const isPriceAxis = e.clientX - rect.left >= rect.width - PRICE_AXIS_W;
    if (isPriceAxis) {
      const factor = e.deltaY > 0 ? 0.87 : 1.15;
      zoomPriceScaleAtPointer(priceView.current.zoom * factor, e.clientY, rect);
      return;
    }
    const pivot = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width - PRICE_AXIS_W)));
    const previousCount = view.current.count;
    const delta = e.deltaY > 0 ? 1.15 : 0.87;
    const nextCount = Math.max(30, Math.min(400, Math.round(previousCount * delta)));
    // Preserve the candle under the cursor while zooming, matching the
    // expected charting-terminal behaviour rather than jumping to the edge.
    view.current.right = clampRight(view.current.right + (nextCount - previousCount) * (1 - pivot));
    view.current.count = nextCount;
    invalidateViewport();
  };

  // keyboard pan/zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "+" || e.key === "=") {
        view.current.count = Math.max(30, Math.round(view.current.count * 0.87));
        invalidateViewport();
      } else if (e.key === "-" || e.key === "_") {
        view.current.count = Math.min(400, Math.round(view.current.count * 1.15));
        invalidateViewport();
      } else if (e.key === "ArrowLeft") {
        view.current.right = clampRight(view.current.right - Math.max(1, Math.round(view.current.count * 0.1)));
        invalidateViewport();
      } else if (e.key === "ArrowRight") {
        view.current.right = clampRight(view.current.right + Math.max(1, Math.round(view.current.count * 0.1)));
        invalidateViewport();
      } else if (e.key === "Home" || e.key === "Escape") {
        resetViewport();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bars.length, settings.futureBars]);

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
        onDoubleClick={(event) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          if (event.clientX - rect.left >= rect.width - PRICE_AXIS_W) {
            resetPriceScale();
          } else {
            resetViewport();
          }
        }}
        tabIndex={0}
        aria-label={`${symbol} ${timeframe} chart; drag the plot to pan time, drag or scroll the price scale to vertically stretch or compress candles, double click to reset`}
      />
      <div className="pointer-events-none absolute bottom-7 left-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={resetViewport}
          className="pointer-events-auto rounded-[4px] border hairline bg-panel/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-hover hover:text-foreground"
          title="Reset chart viewport (double click, Home, or Escape)"
        >
          Reset view
        </button>
        {view.current.right < settings.futureBars - 1 && (
          <button
            type="button"
            onClick={() => { view.current.right = settings.futureBars; invalidateViewport(); }}
            className="pointer-events-auto rounded-[4px] border border-mdata/30 bg-mdata/10 px-2 py-1 text-[10px] font-medium text-mdata shadow-sm backdrop-blur transition-colors hover:bg-mdata/20"
          >
            Go to realtime
          </button>
        )}
      </div>
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
