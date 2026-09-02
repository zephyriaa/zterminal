"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { getContract } from "@/lib/market/contracts";
import type { Bar } from "@/lib/market/types";
import { useMarketStream } from "@/hooks/use-market-stream";
import { alignToTimeframe } from "@/lib/market/session";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";
import { normalizeChartBars } from "@/lib/market/chart-data";
import type { ChartTimezone } from "@/stores/workspace";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries, createSeriesMarkers, LineStyle
} from "lightweight-charts";

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
  t: number;
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
  replayIndex?: number | null;
  replayEnabled?: boolean;
  markers?: TradeMarker[];
  settings?: ChartSettings;
  markPrice?: number | null;
  timezone?: ChartTimezone;
  onCrosshair?: (b: Bar | null) => void;
  onLatestBar?: (b: Bar | null) => void;
}

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
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Lightweight Charts does not parse newer CSS Color 4 formats such as
  // lab()/oklch(), while the app's Tailwind tokens may resolve to them.
  return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|transparent$)/i.test(value) ? value : fallback;
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
  onLatestBar,
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());

  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [internalReplayIndex, setInternalReplayIndex] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);

  const contract = getContract(symbol);
  const tfSec = TIMEFRAME_SECONDS[timeframe];
  const effectiveReplayIndex = replayIndex ?? (replayEnabled ? internalReplayIndex : null);

  const { lastTrade, provider } = useMarketStream(symbol, { trades: 1, depth: false });

  // Fetch historical bars
  useEffect(() => {
    let cancelled = false;
    // These states mirror the lifecycle of the external historical-data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const to = Date.now();
        const barsCount = 600;
        const from = to - barsCount * tfSec * 1000;
        const historicalProvider = provider === "binance" ? "binance" : "gateio";
        const r = await fetch(`/api/bars?provider=${historicalProvider}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&to=${to}&bars=${barsCount}`);
        if (!r.ok) throw new Error("fetch failed");
        const json = await r.json();
        if (cancelled) return;
        setBars(normalizeChartBars(json.bars));
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
  }, [provider, symbol, timeframe, tfSec]);

  // Handle live trade update
  useEffect(() => {
    if (!lastTrade || !bars.length) return;
    const t = lastTrade.timestamp;
    const price = lastTrade.price;
    const bucket = alignToTimeframe(t, timeframe);
    // A live provider event is an external subscription callback, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBars((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (!last || !Number.isFinite(price) || price <= 0) return prev;

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

  useEffect(() => {
    onLatestBar?.(bars.at(-1) ?? null);
  }, [bars, onLatestBar]);

  // Handle replay
  useEffect(() => {
    if (!replayEnabled) {
      // Reset local playback state when the externally controlled replay mode closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: settings.backgroundColor },
        textColor: themeColors().axisText,
      },
      grid: {
        vertLines: { color: `rgba(255,255,255,${settings.showGrid ? settings.gridOpacity : 0})` },
        horzLines: { color: `rgba(255,255,255,${settings.showGrid ? settings.gridOpacity : 0})` },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    chartRef.current = chart;

    if (onCrosshair) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData || !seriesRef.current) {
          onCrosshair(null);
          return;
        }
        const data = param.seriesData.get(seriesRef.current) as any;
        if (data) {
          const timestamp = (param.time as number) * 1000;
          onCrosshair({
            t: timestamp,
            o: data.open ?? data.value,
            h: data.high ?? data.value,
            l: data.low ?? data.value,
            c: data.close ?? data.value,
            v: 0,
          });
        }
      });
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        if (width > 0 && height > 0) chart.resize(width, height);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Sync settings when they change
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: settings.backgroundColor },
        },
        grid: {
          vertLines: { color: `rgba(255,255,255,${settings.showGrid ? settings.gridOpacity : 0})` },
          horzLines: { color: `rgba(255,255,255,${settings.showGrid ? settings.gridOpacity : 0})` },
        },
      });
    }
  }, [settings.backgroundColor, settings.gridOpacity, settings.showGrid]);

  // Apply main series type
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
    }

    if (chartType === "candles") {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: settings.candleUpColor,
        downColor: settings.candleDownColor,
        borderVisible: false,
        wickUpColor: settings.candleUpColor,
        wickDownColor: settings.candleDownColor,
      });
    } else if (chartType === "bars") {
      seriesRef.current = chart.addSeries(BarSeries, {
        upColor: settings.candleUpColor,
        downColor: settings.candleDownColor,
      });
    } else if (chartType === "line") {
      seriesRef.current = chart.addSeries(LineSeries, {
        color: themeColors().mdata,
        lineWidth: 2,
      });
    } else if (chartType === "area") {
      seriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: themeColors().mdata,
        topColor: "rgba(63,169,201,0.4)",
        bottomColor: "rgba(63,169,201,0.0)",
        lineWidth: 2,
      });
    }
  }, [chartType, settings.candleUpColor, settings.candleDownColor]);

  // Setup Volume series
  useEffect(() => {
    if (!chartRef.current) return;
    
    if (indicators.volume) {
      if (!volumeSeriesRef.current) {
        volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
          color: "#26a69a",
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });
        chartRef.current.priceScale("").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
      }
    } else if (volumeSeriesRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
  }, [indicators.volume]);

  // Feed data to chart
  useEffect(() => {
    if (!seriesRef.current || !bars.length) return;
    
    // Sort and deduplicate bars for lightweight-charts
    const uniqueBars = new Map<number, Bar>();
    for (const b of bars) uniqueBars.set(b.t, b);
    const sortedBars = Array.from(uniqueBars.values()).sort((a, b) => a.t - b.t);
    
    const availableBars = effectiveReplayIndex == null ? sortedBars : sortedBars.slice(0, effectiveReplayIndex + 1);
    
    const timeData = availableBars.map(b => (b.t / 1000) as Time);
    
    // Main series
    if (chartType === "candles" || chartType === "bars") {
      seriesRef.current.setData(availableBars.map(b => ({
        time: (b.t / 1000) as Time,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      })));
    } else {
      seriesRef.current.setData(availableBars.map(b => ({
        time: (b.t / 1000) as Time,
        value: b.c,
      })));
    }

    // Volume
    if (volumeSeriesRef.current && indicators.volume) {
      volumeSeriesRef.current.setData(availableBars.map(b => ({
        time: (b.t / 1000) as Time,
        value: b.v,
        color: b.c >= b.o ? `${settings.candleUpColor}48` : `${settings.candleDownColor}48`,
      })));
    }
    
    // Indicators
    const c = themeColors();
    const closes = availableBars.map(b => b.c);
    
    const drawLine = (id: string, vals: (number | null)[], color: string, lineStyle?: number) => {
      if (!chartRef.current) return;
      let series = indicatorSeriesRef.current.get(id);
      if (!series) {
        series = chartRef.current.addSeries(LineSeries, { color, lineWidth: 2, crosshairMarkerVisible: false, lineStyle: lineStyle ?? 0 });
        indicatorSeriesRef.current.set(id, series);
      } else {
        series.applyOptions({ color, lineStyle: lineStyle ?? 0 });
      }
      
      const lineData = vals.map((v, i) => ({
        time: timeData[i],
        value: v ?? undefined,
      })).filter(d => d.value !== undefined) as any;
      
      series.setData(lineData);
    };

    if (indicators.vwap) drawLine("vwap", sessionVWAP(availableBars, timezone), c.warn, 2 /* Dashed */);
    else if (indicatorSeriesRef.current.has("vwap")) {
      chartRef.current?.removeSeries(indicatorSeriesRef.current.get("vwap")!);
      indicatorSeriesRef.current.delete("vwap");
    }

    if (indicators.ema20) drawLine("ema20", ema(closes, 20), c.mdata);
    else if (indicatorSeriesRef.current.has("ema20")) {
      chartRef.current?.removeSeries(indicatorSeriesRef.current.get("ema20")!);
      indicatorSeriesRef.current.delete("ema20");
    }

    if (indicators.ema50) drawLine("ema50", ema(closes, 50), c.research);
    else if (indicatorSeriesRef.current.has("ema50")) {
      chartRef.current?.removeSeries(indicatorSeriesRef.current.get("ema50")!);
      indicatorSeriesRef.current.delete("ema50");
    }
    
    // Draw Custom Studies
    const activeStudies = new Set<string>();
    if (indicators.customStudies) {
      for (const study of indicators.customStudies) {
        if (!study.visible) continue;
        const period = Math.max(1, study.period ?? 20);
        
        if (study.kind === "ema") {
          drawLine(study.id, ema(closes, period), study.color);
          activeStudies.add(study.id);
        } else if (study.kind === "sma") {
          drawLine(study.id, sma(closes, period), study.color);
          activeStudies.add(study.id);
        } else if (study.kind === "wma") {
          drawLine(study.id, wma(closes, period), study.color);
          activeStudies.add(study.id);
        } else if (study.kind === "vwma") {
          drawLine(study.id, vwma(availableBars, period), study.color);
          activeStudies.add(study.id);
        } else if (study.kind === "vwap") {
          drawLine(study.id, sessionVWAP(availableBars, timezone), study.color, 2);
          activeStudies.add(study.id);
        } else if (study.kind === "bollinger") {
          const middle = sma(closes, period);
          const deviation = standardDeviation(closes, period, middle);
          const multiplier = Math.max(0.1, study.multiplier ?? 2);
          const upper = middle.map((val, idx) => val == null || deviation[idx] == null ? null : val + deviation[idx]! * multiplier);
          const lower = middle.map((val, idx) => val == null || deviation[idx] == null ? null : val - deviation[idx]! * multiplier);
          
          drawLine(study.id + "_mid", middle, study.color);
          drawLine(study.id + "_upper", upper, study.color, 1 /* Dotted */);
          drawLine(study.id + "_lower", lower, study.color, 1 /* Dotted */);
          activeStudies.add(study.id + "_mid");
          activeStudies.add(study.id + "_upper");
          activeStudies.add(study.id + "_lower");
        } else if (study.kind === "donchian") {
          const highs = availableBars.map(b => b.h);
          const lows = availableBars.map(b => b.l);
          const upper = rollingExtrema(highs, period, "max");
          const lower = rollingExtrema(lows, period, "min");
          drawLine(study.id + "_upper", upper, study.color, 2);
          drawLine(study.id + "_lower", lower, study.color, 2);
          activeStudies.add(study.id + "_upper");
          activeStudies.add(study.id + "_lower");
        }
      }
    }
    
    // Cleanup removed custom studies
    for (const key of indicatorSeriesRef.current.keys()) {
      if (key !== "vwap" && key !== "ema20" && key !== "ema50" && !activeStudies.has(key)) {
        chartRef.current?.removeSeries(indicatorSeriesRef.current.get(key)!);
        indicatorSeriesRef.current.delete(key);
      }
    }
    
    // Markers
    if (markers?.length && seriesRef.current) {
      const tvMarkers = markers.map(m => ({
        time: (m.t / 1000) as Time,
        position: m.side === "buy" ? "belowBar" : "aboveBar",
        color: m.side === "buy" ? c.pos : c.neg,
        shape: m.side === "buy" ? "arrowUp" : "arrowDown",
        text: m.label || "",
      })) as any;
      createSeriesMarkers(seriesRef.current, tvMarkers);
    } else {
      createSeriesMarkers(seriesRef.current, []);
    }
  }, [bars, chartType, indicators, effectiveReplayIndex, settings, markers, timezone]);

  return (
    <div className="relative h-full w-full bg-background" onDoubleClick={() => chartRef.current?.timeScale().fitContent()}>
      <div ref={chartContainerRef} className="absolute inset-0 z-10" />
      
      {replayEnabled && internalReplayIndex != null && (
        <div className="absolute bottom-7 right-2 z-50 flex items-center gap-1 border hairline bg-panel/95 p-1 shadow-sm backdrop-blur">
          <button type="button" onClick={() => { setReplayPlaying(false); setInternalReplayIndex((current) => Math.max(0, (current ?? 0) - 1)); }} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-hover hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setReplayPlaying((playing) => !playing)} className="grid h-6 w-6 place-items-center rounded bg-research/15 text-research hover:bg-research/25">
            {replayPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => { setReplayPlaying(false); setInternalReplayIndex((current) => Math.min(Math.max(0, bars.length - 1), (current ?? 0) + 1)); }} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-hover hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="px-1 font-mono-num text-[9px] text-muted-foreground">Replay {internalReplayIndex + 1}/{bars.length}</span>
        </div>
      )}
      
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/50 text-[11px] text-muted-foreground uppercase tracking-wider backdrop-blur-sm">
          loading…
        </div>
      )}
      {err && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/80 text-[11px] text-neg backdrop-blur-sm">
          {err}
        </div>
      )}
      {!loading && !err && !bars.length && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/80 text-center text-[11px] text-muted-foreground backdrop-blur-sm">
          No historical candles available for this market and timeframe.
        </div>
      )}
    </div>
  );
}
