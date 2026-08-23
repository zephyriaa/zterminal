"use client";

/* Canvas rendering intentionally coordinates refs and browser observers outside React render state. */
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/immutability */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { getContract } from "@/lib/market/contracts";
import type { Bar } from "@/lib/market/types";
import { useMarketStream } from "@/hooks/use-market-stream";
import { alignToTimeframe } from "@/lib/market/session";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";
import type { ChartTimezone } from "@/stores/workspace";

export type ChartType = "candles" | "bars" | "line" | "area";

export interface ChartStudy {
  id: string;
  name: string;
  kind: "ema" | "sma" | "wma" | "vwma" | "vwap" | "bollinger" | "donchian";
  period?: number;
  multiplier?: number;
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
  replayIndex?: number | null; // optional externally controlled replay cutoff
  replayEnabled?: boolean;
  markers?: TradeMarker[];
  settings?: ChartSettings;
  /** Provider-normalized mark price. Omit it when the venue does not supply one. */
  markPrice?: number | null;
  timezone?: ChartTimezone;
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

function wma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const denominator = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let offset = 0; offset < period; offset++) sum += values[i - period + 1 + offset] * (offset + 1);
    out[i] = sum / denominator;
  }
  return out;
}

function vwma(bars: Bar[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let priceVolume = 0;
  let volume = 0;
  for (let i = 0; i < bars.length; i++) {
    priceVolume += bars[i].c * bars[i].v;
    volume += bars[i].v;
    if (i >= period) {
      priceVolume -= bars[i - period].c * bars[i - period].v;
      volume -= bars[i - period].v;
    }
    if (i >= period - 1) out[i] = volume > 0 ? priceVolume / volume : null;
  }
  return out;
}

function standardDeviation(values: number[], period: number, average: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const mean = average[i];
    if (mean == null) continue;
    let squared = 0;
    for (let offset = 0; offset < period; offset++) squared += (values[i - offset] - mean) ** 2;
    out[i] = Math.sqrt(squared / period);
  }
  return out;
}

function rollingExtrema(values: number[], period: number, mode: "max" | "min"): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let result = values[i - period + 1];
    for (let offset = 1; offset < period; offset++) result = mode === "max" ? Math.max(result, values[i - period + 1 + offset]) : Math.min(result, values[i - period + 1 + offset]);
    out[i] = result;
  }
  return out;
}

/** Session-anchored VWAP, reset at the selected chart-timezone day boundary. */
function sessionVWAP(bars: Bar[], timezone: ChartTimezone): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  let dayKey = "";
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(b.t));
    const key = `${parts.find((part) => part.type === "year")?.value ?? "0000"}-${parts.find((part) => part.type === "month")?.value ?? "00"}-${parts.find((part) => part.type === "day")?.value ?? "00"}`;
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

function fmtTime(t: number, tf: Timeframe, timezone: ChartTimezone): string {
  const daily = tf === "1d" || tf === "1w";
  return new Intl.DateTimeFormat("en-GB", daily
    ? { timeZone: timezone, month: "2-digit", day: "2-digit" }
    : { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }
  ).format(new Date(t));
}

export function TerminalChart({
  symbol,
  timeframe,
  chartType,
  indicators,
  replayIndex,
  replayEnabled = false,
  markers,
  settings = DEFAULT_CHART_SETTINGS,
  markPrice,
  timezone = "America/New_York",
  onCrosshair,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewVersion, setViewVersion] = useState(0);
  const [internalReplayIndex, setInternalReplayIndex] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);

  // right is the number of time slots reserved after the latest candle.
  // Keeping it in a ref gives pointer events immediate feedback, while the
  // version state invalidates the derived viewport after every interaction.
  const view = useRef({ right: settings.futureBars, count: 120 }); // right = index past the right edge
  const priceView = useRef({ offset: 0, zoom: 1 });
  const priceMetrics = useRef({ autoCenter: 0, autoRange: 1, priceHeight: 1 });
  const cross = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef<{ mode: "time" | "time-zoom" | "price-zoom" | "price-pan"; x: number; y: number; right: number; count: number; priceZoom: number; priceOffset: number } | null>(null);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ mode: "time" | "price"; distance: number; count: number; right: number; priceZoom: number; clientY: number } | null>(null);
  const raf = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const contract = getContract(symbol);
  const tfSec = TIMEFRAME_SECONDS[timeframe];
  const effectiveReplayIndex = replayIndex ?? (replayEnabled ? internalReplayIndex : null);

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

  useEffect(() => {
    if (!replayEnabled) {
      setInternalReplayIndex(null);
      setReplayPlaying(false);
      return;
    }
    if (bars.length) {
      setInternalReplayIndex((current) => Math.min(bars.length - 1, current ?? Math.max(0, bars.length - Math.min(120, bars.length))));
    }
  }, [bars.length, replayEnabled]);

  useEffect(() => {
    if (!replayEnabled || !replayPlaying || internalReplayIndex == null || internalReplayIndex >= bars.length - 1) return;
    const timer = window.setInterval(() => {
      setInternalReplayIndex((current) => {
        if (current == null || current >= bars.length - 1) {
          setReplayPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 350);
    return () => window.clearInterval(timer);
  }, [bars.length, internalReplayIndex, replayEnabled, replayPlaying]);

  // live update last candle from trade stream
  useEffect(() => {
    if (!lastTrade || !bars.length) return;
    const t = lastTrade.timestamp;
    const price = lastTrade.price;
    const bucket = alignToTimeframe(t, timeframe);
    setBars((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (!last || !Number.isFinite(price) || price <= 0) return prev;

      // A reconnecting or degraded venue can emit a placeholder price. Preserve
      // verified historical structure until the next stream print is plausible.
      const ratio = last.c > 0 ? price / last.c : 1;
      if (ratio < 0.5 || ratio > 1.5) return prev;

      if (bucket === last.t) {
        next[next.length - 1] = {
          ...last,
          c: price,
          h: Math.max(last.h, price),
          l: Math.min(last.l, price),
          v: last.v + lastTrade.quantity,
        };
      } else if (bucket > last.t) {
        next.push({
          t: bucket,
          o: last.c,
          h: Math.max(last.c, price),
          l: Math.min(last.c, price),
          c: price,
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
  }, [bars, chartType, indicators, effectiveReplayIndex, markers, settings, markPrice, viewVersion]);

  // redraw when data/view changes
  useEffect(() => {
    scheduleDraw();
  }, [bars, chartType, indicators, effectiveReplayIndex, markers, settings, viewVersion, scheduleDraw]);

  const viewport = useMemo(() => {
    const count = view.current.count;
    const availableBars = effectiveReplayIndex == null ? bars.length : Math.min(bars.length, effectiveReplayIndex + 1);
    // A positive right offset intentionally projects the timeline beyond the
    // latest market candle. A negative offset pans backward through history.
    const virtualEnd = availableBars + view.current.right;
    const virtualStart = virtualEnd - count;
    const start = Math.max(0, Math.ceil(virtualStart));
    const end = Math.max(start, Math.min(availableBars, Math.floor(virtualEnd)));
    return { bars: bars.slice(start, end), count, start, virtualStart, availableBars };
  }, [bars, effectiveReplayIndex, viewVersion]);

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
    const vwap = indicators.vwap ? sessionVWAP(vb, timezone) : [];
    const customLines = (indicators.customStudies ?? []).filter((study) => study.visible).flatMap((study) => {
      const period = Math.max(1, study.period ?? 20);
      if (study.kind === "ema") return [{ study, values: ema(closes, period), color: study.color, dash: [] as number[] }];
      if (study.kind === "sma") return [{ study, values: sma(closes, period), color: study.color, dash: [] as number[] }];
      if (study.kind === "wma") return [{ study, values: wma(closes, period), color: study.color, dash: [] as number[] }];
      if (study.kind === "vwma") return [{ study, values: vwma(vb, period), color: study.color, dash: [] as number[] }];
      if (study.kind === "vwap") return [{ study, values: sessionVWAP(vb, timezone), color: study.color, dash: [4, 3] }];
      if (study.kind === "bollinger") {
        const middle = sma(closes, period);
        const deviation = standardDeviation(closes, period, middle);
        const multiplier = Math.max(0.1, study.multiplier ?? 2);
        return [
          { study, values: middle, color: study.color, dash: [] as number[] },
          { study, values: middle.map((value, index) => value == null || deviation[index] == null ? null : value + deviation[index]! * multiplier), color: study.color, dash: [3, 3] },
          { study, values: middle.map((value, index) => value == null || deviation[index] == null ? null : value - deviation[index]! * multiplier), color: study.color, dash: [3, 3] },
        ];
      }
      return [
        { study, values: rollingExtrema(vb.map((bar) => bar.h), period, "max"), color: study.color, dash: [5, 3] },
        { study, values: rollingExtrema(vb.map((bar) => bar.l), period, "min"), color: study.color, dash: [5, 3] },
      ];
    });
    for (const v of [...ema20, ...ema50, ...vwap, ...customLines.flatMap((line) => line.values)]) if (typeof v === "number") { hi = Math.max(hi, v); lo = Math.min(lo, v); }
    if (typeof markPrice === "number" && Number.isFinite(markPrice)) { hi = Math.max(hi, markPrice); lo = Math.min(lo, markPrice); }
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
      ctx.fillText(fmtTime(vb[i].t, timeframe, timezone), x, h - 6);
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
    for (const line of customLines) drawLine(line.values, line.color, line.dash);

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

    // Provider-normalized derivatives mark price; only rendered when supplied.
    if (typeof markPrice === "number" && Number.isFinite(markPrice)) {
      const markY = yFor(markPrice);
      ctx.strokeStyle = c.mdata;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(0, markY);
      ctx.lineTo(plotW, markY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.mdata;
      ctx.fillRect(plotW, markY - 8, PRICE_AXIS_W, 16);
      ctx.fillStyle = "#0a0a0a";
      ctx.font = "bold 9px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`M ${fmtPrice(markPrice, contract.tickSize)}`, plotW + 3, markY + 3);
    }

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
  }, [viewport, chartType, indicators, contract.tickSize, markers, timeframe, markPrice, onCrosshair, settings, timezone]);

  // pointer handlers
  const maxFutureBars = Math.max(settings.futureBars * 5, 160);
  // Retain at least a small visible history rather than allowing an all-empty
  // canvas at the oldest boundary. The value is still derived only from loaded
  // provider candles, never from padded or manufactured bars.
  const minRightOffset = -Math.max(0, bars.length - Math.min(view.current.count, 24));
  const clampRight = (right: number) => Math.max(minRightOffset, Math.min(maxFutureBars, right));
  const invalidateViewport = () => setViewVersion((version) => version + 1);
  const clampPriceOffset = (offset: number) => Math.max(-3, Math.min(3, offset));
  const panTimeByPixels = (pixels: number, plotWidth: number, originRight: number) => {
    const slotShift = pixels * (view.current.count / Math.max(1, plotWidth));
    view.current.right = clampRight(originRight - slotShift);
    invalidateViewport();
  };
  const panPriceByPixels = (pixels: number, originOffset: number) => {
    const height = Math.max(1, priceMetrics.current.priceHeight);
    priceView.current = { ...priceView.current, offset: clampPriceOffset(originOffset - pixels / height) };
    invalidateViewport();
  };
  const zoomTimeScaleAtPointer = (nextCount: number, clientX: number, rect: DOMRect, originRight = view.current.right, originCount = view.current.count) => {
    const boundedCount = Math.max(30, Math.min(400, Math.round(nextCount)));
    const plotWidth = Math.max(1, rect.width - PRICE_AXIS_W);
    const pivot = Math.max(0, Math.min(1, (clientX - rect.left) / plotWidth));
    view.current.right = clampRight(originRight + (boundedCount - originCount) * (1 - pivot));
    view.current.count = boundedCount;
    invalidateViewport();
  };
  const resetTimeScale = () => {
    view.current.right = settings.futureBars;
    view.current.count = 120;
    invalidateViewport();
  };
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

  const beginPinch = (rect: DOMRect) => {
    const points = Array.from(touchPoints.current.values());
    if (points.length < 2) return;
    const [first, second] = points;
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    const onPriceAxis = first.x - rect.left >= rect.width - PRICE_AXIS_W && second.x - rect.left >= rect.width - PRICE_AXIS_W;
    pinch.current = {
      mode: onPriceAxis ? "price" : "time",
      distance: Math.max(1, distance),
      count: view.current.count,
      right: view.current.right,
      priceZoom: priceView.current.zoom,
      clientY: (first.y + second.y) / 2,
    };
    dragging.current = null;
  };
  const beginSingleTouchDrag = (point: { x: number; y: number }, rect: DOMRect, mode?: "time" | "time-zoom" | "price-pan") => {
    const inPriceAxis = point.x - rect.left >= rect.width - PRICE_AXIS_W;
    const inTimeAxis = point.y - rect.top >= rect.height - TIME_AXIS_H;
    dragging.current = {
      mode: mode ?? (inPriceAxis ? "price-zoom" : inTimeAxis ? "time-zoom" : "time"),
      x: point.x,
      y: point.y,
      right: view.current.right,
      count: view.current.count,
      priceZoom: priceView.current.zoom,
      priceOffset: priceView.current.offset,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.pointerType === "touch" && touchPoints.current.has(e.pointerId)) {
      touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.current.size >= 2) {
        if (!pinch.current) beginPinch(rect);
        const gesture = pinch.current;
        const points = Array.from(touchPoints.current.values());
        if (gesture && points.length >= 2) {
          const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
          if (gesture.mode === "price") {
            // Pinch over the price scale controls candle height, mirroring desktop wheel zoom on that axis.
            zoomPriceScaleAtPointer(gesture.priceZoom * (distance / gesture.distance), (points[0].y + points[1].y) / 2, rect);
          } else {
            // Pinch in the plot controls candle density while keeping the pinch midpoint stable in time.
            const nextCount = Math.max(30, Math.min(400, Math.round(gesture.count * (gesture.distance / distance))));
            const midpointX = (points[0].x + points[1].x) / 2;
            const pivot = Math.max(0, Math.min(1, (midpointX - rect.left) / Math.max(1, rect.width - PRICE_AXIS_W)));
            view.current.right = clampRight(gesture.right + (nextCount - gesture.count) * (1 - pivot));
            view.current.count = nextCount;
            invalidateViewport();
          }
        }
        cross.current = { x, y };
        scheduleDraw();
        return;
      }
    }
    if (dragging.current) {
      if (dragging.current.mode === "price-zoom") {
        // Dragging the price scale stretches or compresses candle height around the pointer.
        const deltaY = e.clientY - dragging.current.y;
        const nextZoom = dragging.current.priceZoom * Math.exp(-deltaY * 0.01);
        zoomPriceScaleAtPointer(nextZoom, e.clientY, rect);
      } else if (dragging.current.mode === "time-zoom") {
        // Dragging across the lower time scale expands or contracts candle spacing around the pointer.
        const deltaX = e.clientX - dragging.current.x;
        const nextCount = dragging.current.count * Math.exp(-deltaX * 0.01);
        zoomTimeScaleAtPointer(nextCount, e.clientX, rect, dragging.current.right, dragging.current.count);
      } else if (dragging.current.mode === "price-pan") {
        panPriceByPixels(e.clientY - dragging.current.y, dragging.current.priceOffset);
      } else {
        // Fractional slot movement avoids the inert feeling caused by rounding
        // small pointer deltas before the canvas has visibly shifted.
        panTimeByPixels(e.clientX - dragging.current.x, rect.width - PRICE_AXIS_W, dragging.current.right);
      }
    }
    cross.current = { x, y };
    scheduleDraw();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    // The chart body always owns a plot gesture. Floating-window movement is
    // reserved for its title bar and resize handles.
    e.preventDefault();
    e.stopPropagation();
    canvasRef.current?.focus();
    canvasRef.current?.setPointerCapture?.(e.pointerId);
    const rect = canvasRef.current!.getBoundingClientRect();
    if (e.pointerType === "touch") {
      touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.current.size >= 2) beginPinch(rect);
      else beginSingleTouchDrag({ x: e.clientX, y: e.clientY }, rect);
      return;
    }
    const plotMode = e.button === 1 || e.altKey ? "price-pan" : undefined;
    beginSingleTouchDrag({ x: e.clientX, y: e.clientY }, rect, plotMode);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    if (e.pointerType !== "touch") {
      dragging.current = null;
      return;
    }
    touchPoints.current.delete(e.pointerId);
    const rect = canvasRef.current!.getBoundingClientRect();
    const remaining = Array.from(touchPoints.current.values());
    if (remaining.length >= 2) beginPinch(rect);
    else if (remaining.length === 1) {
      pinch.current = null;
      beginSingleTouchDrag(remaining[0], rect);
    } else {
      pinch.current = null;
      dragging.current = null;
    }
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    cross.current = null;
    onCrosshair?.(null);
    scheduleDraw();
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    const isPriceAxis = e.clientX - rect.left >= rect.width - PRICE_AXIS_W;
    // Normalize line/page wheel devices and high-resolution trackpads into one
    // bounded exponential curve so both feel responsive without sudden jumps.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
    const normalized = Math.max(-180, Math.min(180, e.deltaY * unit));
    const factor = Math.exp(-normalized * 0.0016);
    if (isPriceAxis) {
      zoomPriceScaleAtPointer(priceView.current.zoom * factor, e.clientY, rect);
      return;
    }
    const previousCount = view.current.count;
    // Wheel over the chart plot changes density; wheel over the time scale has the same
    // horizontal result while keeping the rest of the chart gesture model explicit.
    zoomTimeScaleAtPointer(previousCount / factor, e.clientX, rect);
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
        className="block h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        onDoubleClick={(event) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const inPriceAxis = event.clientX - rect.left >= rect.width - PRICE_AXIS_W;
          const inTimeAxis = event.clientY - rect.top >= rect.height - TIME_AXIS_H;
          if (inPriceAxis) resetPriceScale();
          else if (inTimeAxis) resetTimeScale();
          else resetViewport();
        }}
        tabIndex={0}
        aria-label={`${symbol} ${timeframe} chart; drag the plot to pan time, use middle mouse or Alt-drag to pan the price range, use the lower time scale to widen or narrow candles, use the right price scale to stretch or compress candle height, and double click an axis to reset that axis`}
      />
      <div className="mobile-chart-gesture-hint pointer-events-none absolute right-2 top-2 rounded-[3px] border hairline bg-panel/80 px-1.5 py-1 text-[8px] text-muted-foreground backdrop-blur">Drag to pan · Alt-drag price · pinch to scale</div>
      {replayEnabled && internalReplayIndex != null && <div className="absolute bottom-7 right-2 flex items-center gap-1 border hairline bg-panel/95 p-1 shadow-sm backdrop-blur"><button type="button" onClick={() => { setReplayPlaying(false); setInternalReplayIndex((current) => Math.max(0, (current ?? 0) - 1)); }} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-hover hover:text-foreground" aria-label="Previous replay bar" title="Previous bar"><ChevronLeft className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setReplayPlaying((playing) => !playing)} className="grid h-6 w-6 place-items-center rounded bg-research/15 text-research hover:bg-research/25" aria-label={replayPlaying ? "Pause replay" : "Play replay"} title={replayPlaying ? "Pause replay" : "Play replay"}>{replayPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button><button type="button" onClick={() => { setReplayPlaying(false); setInternalReplayIndex((current) => Math.min(Math.max(0, bars.length - 1), (current ?? 0) + 1)); }} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-hover hover:text-foreground" aria-label="Next replay bar" title="Next bar"><ChevronRight className="h-3.5 w-3.5" /></button><span className="px-1 font-mono-num text-[9px] text-muted-foreground">Replay {internalReplayIndex + 1}/{bars.length}</span></div>}
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
