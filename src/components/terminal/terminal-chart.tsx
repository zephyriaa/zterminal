"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useMarketContract } from "@/hooks/use-market-contract";
import { pricePrecision } from "@/lib/market/contracts";
import type { Bar, BarsResult, ContractMetadata } from "@/lib/market/types";
import { useMarketStream } from "@/hooks/use-market-stream";
import { alignToTimeframe } from "@/lib/market/session";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";
import { prependChartHistory } from "@/lib/market/chart-data";
import { fetchBarsDeduplicated } from "@/lib/market/bars-dedup";
import { buildVolumeProfile, calculateVolatility, classifyRegime, computeOpeningRange, type VolumeProfile } from "@/domain/analytics/market";
import type { ChartTimezone } from "@/stores/workspace";
import { DEFAULT_CHART_SETTINGS, type ChartSettingsV2, type ChartType } from "@/lib/chart/contracts";
import { applyVolumePaneLayout, lightweightChartOptions } from "@/lib/chart/lightweight-adapter";
import { createDrawingCoordinates } from "@/lib/chart/lightweight-adapter";
import { intervalMs } from "@/lib/local-research/dataset";
import type { DrawingCoordinates } from "@/lib/chart/drawings/coordinates";
import type { DrawingAnchor, DrawingObject, DrawingType } from "@/lib/chart/contracts";
import type { ChartOverlayInstance } from "@/lib/chart/overlays/contracts";
import { bigTradesSettings } from "@/lib/chart/overlays/contracts";
import { type BigTradeCluster } from "@/lib/chart/overlays/big-trades";
import { BigTradesPrimitive } from "@/lib/chart/overlays/big-trades-primitive";
import { VolumeProfilePrimitive } from "@/lib/chart/overlays/volume-profile-primitive";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";
import { isDrawingVisible } from "@/lib/chart/drawings/geometry";
import { DrawingPrimitive } from "@/lib/chart/drawings/primitive";
import { DrawingInteractionLayer } from "./drawing-interaction-layer";
import type { IndicatorInstance } from "@/lib/indicator-library";
import { createStudy, migrateStudy } from "@/lib/indicator-library";
import { evaluateIndicator } from "@/lib/chart/indicators/evaluators";
import type { IndicatorEvaluationResult } from "@/lib/local-research/contracts";
import { matchesPythonEvaluation } from "@/lib/local-research/indicator-evaluation";
import {
  createChart,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  Time,
  CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries, createSeriesMarkers, LineStyle
} from "lightweight-charts";

export type { ChartType } from "@/lib/chart/contracts";

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
  profile?: boolean;
  customStudies?: ChartStudy[];
}

export interface TradeMarker {
  t: number;
  side: "buy" | "sell";
  price: number;
  qty: number;
  label?: string;
}

export type ChartSettings = ChartSettingsV2;
export { DEFAULT_CHART_SETTINGS } from "@/lib/chart/contracts";
const EMPTY_BARS: Bar[] = [];
const EMPTY_PYTHON_EVALUATIONS: Record<string, IndicatorEvaluationResult> = {};

interface ChartProps {
  drawingScopeKey?: string;
  captureActive?: boolean;
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
  indicators: ChartIndicators;
  indicatorInstances?: IndicatorInstance[];
  pythonEvaluations?: Record<string, IndicatorEvaluationResult>;
  replayIndex?: number | null;
  replayEnabled?: boolean;
  markers?: TradeMarker[];
  snapshot?: Bar[];
  snapshotContract?: ContractMetadata;
  focusRange?: { from: number; to: number } | null;
  settings?: ChartSettings;
  volumePaneHeight?: number;
  markPrice?: number | null;
  timezone?: ChartTimezone;
  onCrosshair?: (b: Bar | null) => void;
  onLatestBar?: (b: Bar | null) => void;
  drawings?: DrawingObject[];
  selectedDrawingId?: string | null;
  drawingTool?: DrawingTool;
  persistentDrawing?: boolean;
  magnetMode?: MagnetMode;
  onDrawingTool?: (tool: DrawingTool) => void;
  onSelectDrawing?: (id: string | null) => void;
  onCreateDrawing?: (type: DrawingType, anchors: DrawingAnchor[]) => string | null;
  onUpdateDrawing?: (id: string, patch: Partial<DrawingObject>) => void;
  onDeleteDrawing?: (id: string) => void;
  onDuplicateDrawing?: (id: string) => void;
  overlays?: ChartOverlayInstance[];
}

function themeVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
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
  drawingScopeKey = "chart",
  captureActive = true,
  symbol,
  timeframe,
  chartType,
  indicators,
  indicatorInstances,
  pythonEvaluations = EMPTY_PYTHON_EVALUATIONS,
  replayIndex,
  replayEnabled = false,
  markers,
  snapshot,
  snapshotContract,
  focusRange,
  settings = DEFAULT_CHART_SETTINGS,
  markPrice,
  timezone = "America/New_York",
  onCrosshair,
  onLatestBar,
  volumePaneHeight = 0.22,
  drawings = [], selectedDrawingId = null, drawingTool = "crosshair", magnetMode = "off", persistentDrawing = false,
  onDrawingTool, onSelectDrawing, onCreateDrawing, onUpdateDrawing, onDeleteDrawing, onDuplicateDrawing,
  overlays = [],
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const markPriceLineRef = useRef<IPriceLine | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const drawingPrimitiveRef = useRef<DrawingPrimitive | null>(null);
  const drawingCoordinatesRef = useRef<DrawingCoordinates | null>(null);
  const bigTradesPrimitiveRef = useRef<BigTradesPrimitive | null>(null);
  const volumeProfilePrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const [studyWarnings, setStudyWarnings] = useState<string[]>([]);
  const visibleDrawingsRef = useRef<DrawingObject[]>([]);
  const drawingPreviewRef = useRef<DrawingObject | null>(null);
  const settingsRef = useRef(settings);

  const [liveBars, setBars] = useState<Bar[]>([]);
  const [history, setHistory] = useState<BarsResult | null>(null);
  const [historyIdentity, setHistoryIdentity] = useState<string | null>(null);
  const markerPlugin = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [historyEnd, setHistoryEnd] = useState(false);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const loadOlderRef = useRef<(() => void) | null>(null);
  const pageViewRef = useRef<{ from: Time; to: Time } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [internalReplayIndex, setInternalReplayIndex] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [hoveredBigTrade, setHoveredBigTrade] = useState<BigTradeCluster | null>(null);

  const { lastTrade, provider, dataStatus, tradeStatus, trades: observedTrades, observations, observation } = useMarketStream(symbol, { trades: 2000, depth: false });
  const liveContract = useMarketContract(symbol, provider);
  const contract = snapshotContract ?? liveContract;
  const flowReady = provider === "mock" ? dataStatus === "SIMULATED" : (tradeStatus ?? dataStatus) === "LIVE" && contract.verified === true;
  const historyKey = `${provider}:${symbol}:${timeframe}`;
  const bars = snapshot ?? (historyIdentity === historyKey ? liveBars : EMPTY_BARS);
  const activeHistory = !snapshot && historyIdentity === historyKey ? history : null;
  const tfSec = TIMEFRAME_SECONDS[timeframe];
  const effectiveReplayIndex = replayIndex ?? (replayEnabled ? Math.min(Math.max(0, bars.length - 1), internalReplayIndex ?? Math.max(0, bars.length - Math.min(120, bars.length))) : null);
  const activeBigTradesSettings = useMemo(() => bigTradesSettings(overlays), [overlays]);

  useEffect(() => { barsRef.current = bars; }, [bars]);

  const availableBars = useMemo(() => {
    if (!bars.length) return [];
    const uniqueBars = new Map<number, Bar>();
    for (const b of bars) uniqueBars.set(b.t, b);
    const sorted = Array.from(uniqueBars.values()).sort((a, b) => a.t - b.t);
    return effectiveReplayIndex == null ? sorted : sorted.slice(0, effectiveReplayIndex + 1);
  }, [bars, effectiveReplayIndex]);

  const pythonProvider = snapshot ? snapshotContract?.exchange.toLowerCase() : activeHistory?.effectiveProvider;
  const pythonSymbol = snapshot ? snapshotContract?.symbol ?? symbol : activeHistory?.nativeSymbol ?? contract.symbol;
  const captureRef = useRef({ active: captureActive, ready: false, symbol, timeframe, provider: "unknown", status: "unavailable" });
  useEffect(() => { captureRef.current = { active: captureActive, ready: availableBars.length > 0 && !loading && !err, symbol: pythonSymbol, timeframe, provider: pythonProvider ?? "unknown", status: effectiveReplayIndex != null ? "candle replay" : snapshot ? "archived" : activeHistory?.dataStatus ?? "unavailable" }; }, [captureActive, availableBars.length, loading, err, pythonSymbol, timeframe, pythonProvider, effectiveReplayIndex, snapshot, activeHistory?.dataStatus]);
  const pythonBindings = useMemo(() => (indicatorInstances ?? []).filter(study => study.kind === "python" && study.enabled && (study.visibility.timeframes === "all" || study.visibility.timeframes.includes(timeframe))).map(study => {
    const evaluation = study.artifactId ? pythonEvaluations[study.artifactId] : undefined;
    return { study, evaluation, valid: matchesPythonEvaluation(evaluation, study, { provider: pythonProvider, symbol: pythonSymbol, product: contract.product, timeframe }, availableBars) };
  }), [indicatorInstances, pythonEvaluations, pythonProvider, pythonSymbol, contract.product, timeframe, availableBars]);

  const volumeProfile = useMemo<VolumeProfile | null>(() => {
    if (!indicators.profile || availableBars.length < 2) return null;
    try { return buildVolumeProfile(availableBars, contract.tickSize); } catch { return null; }
  }, [availableBars, contract.tickSize, indicators.profile]);

  const marketContext = useMemo(() => {
    if (availableBars.length < 3) return null;
    const volatility = calculateVolatility(availableBars, Math.min(50, availableBars.length));
    const regime = classifyRegime(availableBars, { lookback: Math.min(50, availableBars.length), trendThreshold: 0.01, compressionThreshold: 0.002 });
    const latest = availableBars.at(-1)!;
    const utcDayStart = Date.UTC(new Date(latest.t).getUTCFullYear(), new Date(latest.t).getUTCMonth(), new Date(latest.t).getUTCDate());
    const openingRange = computeOpeningRange(availableBars, utcDayStart, utcDayStart + 30 * 60 * 1_000);
    return { volatility, regime, openingRange };
  }, [availableBars]);



  // Archived data is immutable; live history belongs to the current provider and instrument.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // These states mirror the lifecycle of the external historical-data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(!snapshot);
    setErr(null); setPaging(false); setHistoryEnd(false); setPageMessage(null); pageViewRef.current = null;
    if (snapshot) return;
    setBars([]);
    setHistory(null); setHistoryIdentity(null);
    (async () => {
      try {
        const to = Date.now();
        const barsCount = 600;
        const historicalProvider = provider ?? "gateio";
        const result = await fetchBarsDeduplicated(historicalProvider, symbol, timeframe, to, barsCount, controller.signal, true);
        if (cancelled) return;
        setHistory(result); setHistoryIdentity(historyKey);
        setBars(result.bars);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setErr(String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true; controller.abort();
    };
  }, [provider, symbol, timeframe, tfSec, snapshot, historyKey]);

  // Handle live trade update
  useEffect(() => {
    if (snapshot || !lastTrade || !bars.length) return;
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
          o: price,
          h: price,
          l: price,
          c: price,
          v: lastTrade.quantity,
        });
        if (next.length > 12000) next.shift();
      }
      return next;
    });
  }, [lastTrade, timeframe, snapshot]);

  useEffect(() => {
    onLatestBar?.(availableBars.at(-1) ?? null);
  }, [availableBars, onLatestBar]);

  useEffect(() => { onCrosshair?.(null); }, [historyKey, effectiveReplayIndex, onCrosshair]);

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

    const chart = createChart(chartContainerRef.current, lightweightChartOptions(settings, themeColors().axisText));
    
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
            v: barsRef.current.find(bar => bar.t === timestamp)?.v ?? 0,
          });
        }
      });
    }

    let resizeRaf: number | null = null;
    const handleResize = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (chartContainerRef.current) {
          const width = chartContainerRef.current.clientWidth;
          const height = chartContainerRef.current.clientHeight;
          if (width > 0 && height > 0) {
            chart.resize(width, height);
            chart.applyOptions({ timeScale: { rightOffset: width < 640 ? Math.min(5, settingsRef.current.futureBars) : settingsRef.current.futureBars } });
          }
        }
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

function applyZTerminalWatermark(
  sourceCanvas: HTMLCanvasElement,
  symbolText?: string,
  timeframeText?: string
): HTMLCanvasElement {
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) return sourceCanvas;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const scale = Math.max(1, Math.min(width, height) / 900);

  ctx.save();

  // 1. Sleek Branded Watermark Pill in Bottom-Left
  const badgeX = Math.round(18 * scale);
  const badgeHeight = Math.round(28 * scale);
  const badgeY = height - badgeHeight - Math.round(16 * scale);
  const badgeRadius = Math.round(4 * scale);

  const brand = "ZTERMINAL";
  const instrument = symbolText ? (timeframeText ? `${symbolText} · ${timeframeText}` : symbolText) : "RESEARCH WORKSTATION";

  ctx.font = `bold ${Math.round(11 * scale)}px "Geist Mono", "JetBrains Mono", monospace, sans-serif`;
  const brandWidth = ctx.measureText(brand).width;

  ctx.font = `600 ${Math.round(10.5 * scale)}px "Geist Mono", monospace, sans-serif`;
  const instWidth = ctx.measureText(instrument).width;

  const totalWidth = brandWidth + instWidth + Math.round(36 * scale);

  // Background pill with dark terminal styling
  ctx.fillStyle = "rgba(8, 12, 22, 0.88)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(badgeX, badgeY, totalWidth, badgeHeight, badgeRadius);
  } else {
    ctx.rect(badgeX, badgeY, totalWidth, badgeHeight);
  }
  ctx.fill();

  // Accent hairline border
  ctx.strokeStyle = "rgba(142, 114, 232, 0.45)";
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.stroke();

  // Draw Brand Name
  ctx.fillStyle = "#a78bfa";
  ctx.font = `bold ${Math.round(11 * scale)}px "Geist Mono", "JetBrains Mono", monospace, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(brand, badgeX + Math.round(10 * scale), badgeY + badgeHeight / 2);

  // Dot separator
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillText("·", badgeX + Math.round(10 * scale) + brandWidth + Math.round(6 * scale), badgeY + badgeHeight / 2);

  // Instrument / Timeframe
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 ${Math.round(10.5 * scale)}px "Geist Mono", monospace, sans-serif`;
  ctx.fillText(instrument, badgeX + Math.round(10 * scale) + brandWidth + Math.round(16 * scale), badgeY + badgeHeight / 2);

  // 2. Subtle Timestamp & Domain Pill in Bottom-Right
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const footerText = `${timestamp}  ·  zterminal.app`;
  ctx.font = `500 ${Math.round(9.5 * scale)}px "Geist Mono", monospace, sans-serif`;
  const footerWidth = ctx.measureText(footerText).width;
  const footerHeight = Math.round(20 * scale);
  const footerX = width - footerWidth - Math.round(28 * scale);
  const footerY = height - footerHeight - Math.round(16 * scale);

  ctx.fillStyle = "rgba(8, 12, 22, 0.75)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(footerX - Math.round(6 * scale), footerY, footerWidth + Math.round(12 * scale), footerHeight, Math.round(3 * scale));
  } else {
    ctx.rect(footerX - Math.round(6 * scale), footerY, footerWidth + Math.round(12 * scale), footerHeight);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(135, 152, 190, 0.2)";
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.stroke();

  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  ctx.textBaseline = "middle";
  ctx.fillText(footerText, footerX, footerY + footerHeight / 2);

  ctx.restore();
  return sourceCanvas;
}

    const onCapture = (event: Event) => {
      const customEvent = event as CustomEvent<{
        mode: "download" | "copy";
        filename: string;
        symbol?: string;
        timeframe?: string;
        onComplete?: (success: boolean, message?: string) => void;
      }>;
      const captured = captureRef.current;
      if (!captured.active) return;
      if (!chartRef.current || !captured.ready) {
        customEvent.detail?.onComplete?.(false, "Chart is not ready for capture");
        return;
      }
      try {
        const rawCanvas = chartRef.current.takeScreenshot();
        const canvas = applyZTerminalWatermark(
          rawCanvas,
          `${captured.symbol} · ${captured.provider} · ${captured.status}`,
          captured.timeframe
        );
        if (customEvent.detail.mode === "download") {
          const dataUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `zterminal-${captured.provider}-${captured.symbol}-${captured.timeframe}-${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          customEvent.detail.onComplete?.(true, "Chart downloaded as PNG");
        } else if (customEvent.detail.mode === "copy") {
          canvas.toBlob(async (blob) => {
            if (!blob) {
              customEvent.detail.onComplete?.(false, "Failed to render chart image blob");
              return;
            }
            try {
              if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                  new ClipboardItem({ "image/png": blob })
                ]);
                customEvent.detail.onComplete?.(true, "Chart copied to clipboard");
              } else {
                customEvent.detail.onComplete?.(false, "Clipboard copy not supported in this browser");
              }
            } catch (err: any) {
              customEvent.detail.onComplete?.(false, err?.message || "Failed to copy image to clipboard");
            }
          }, "image/png");
        }
      } catch (err: any) {
        customEvent.detail.onComplete?.(false, err?.message || "Failed to take chart screenshot");
      }
    };
    window.addEventListener("zterminal:capture-chart", onCapture);

    return () => {
      window.removeEventListener("zterminal:capture-chart", onCapture);
      resizeObserver.disconnect();
      markerPlugin.current?.detach(); markerPlugin.current = null;
      chart.remove(); chartRef.current = null; seriesRef.current = null; volumeSeriesRef.current = null; drawingPrimitiveRef.current = null; bigTradesPrimitiveRef.current = null; indicatorSeriesRef.current.clear();
    };
  }, []);

  // Pan left near the loaded boundary, or explicitly request one older page.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || snapshot || historyIdentity !== historyKey) return;
    const controller = new AbortController();
    let active = true, pending = false, ended = false;
    let pages = 0, failedCutoff: number | null = null;
    let previousFrom: number | null = null;
    const loadOlder = async (manual = false) => {
      const current = barsRef.current;
      if (!active || pending || ended || !current.length) return;
      if (current.length >= 12000 || pages >= 20) { ended = true; setHistoryEnd(true); setPageMessage("Chart session limit: 12,000 candles or 20 older pages. Reload to start a new window."); return; }
      const cutoff = current[0].t;
      if (cutoff <= 0) { ended = true; setHistoryEnd(true); setPageMessage("Reached the beginning of supported UTC history."); return; }
      if (!manual && failedCutoff === cutoff) return;
      pending = true; pages++; setPaging(true); setPageMessage(null);
      try {
        const result = await fetchBarsDeduplicated(provider, symbol, timeframe, cutoff, Math.min(600, 12000 - current.length), controller.signal);
        if (!active) return;
        if (!result.bars.length) { ended = true; setHistoryEnd(true); setPageMessage("No earlier candles available from this venue."); return; }
        const latest = barsRef.current;
        if (!latest.length || latest[0].t !== cutoff) return;
        pageViewRef.current = chart.timeScale().getVisibleRange();
        setBars(previous => previous[0]?.t === cutoff ? prependChartHistory(previous, result.bars).slice(-12000) : previous);
        setPageMessage(result.gapCount ? `Earlier page has ${result.gapCount} missing candles; no padding applied.` : null);
      } catch (error) {
        failedCutoff = cutoff;
        if (active) setPageMessage(`Earlier history unavailable: ${error instanceof Error ? error.message : "request failed"}`);
      } finally { pending = false; if (active) setPaging(false); }
    };
    loadOlderRef.current = () => { void loadOlder(true); };
    const onRange = (range: { from: number; to: number } | null) => {
      if (!range) return;
      const movedLeft = previousFrom !== null && range.from < previousFrom;
      previousFrom = range.from;
      if (movedLeft && range.from < 40 && !pageViewRef.current) void loadOlder();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    return () => { active = false; controller.abort(); loadOlderRef.current = null; chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); };
  }, [historyIdentity, historyKey, provider, symbol, timeframe, snapshot]);

  // Sync settings when they change
  useEffect(() => {
    settingsRef.current = settings;
    if (chartRef.current) {
      chartRef.current.applyOptions(lightweightChartOptions(settings, themeColors().axisText));
      const width = chartContainerRef.current?.clientWidth ?? 0;
      chartRef.current.applyOptions({ timeScale: { rightOffset: width < 640 ? Math.min(5, settings.futureBars) : settings.futureBars } });
    }
  }, [settings]);

  // Apply main series type
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    if (seriesRef.current) {
      if (markPriceLineRef.current) {
        seriesRef.current.removePriceLine(markPriceLineRef.current);
        markPriceLineRef.current = null;
      }
      markerPlugin.current?.detach();
      markerPlugin.current = null;
      chart.removeSeries(seriesRef.current);
    }

    if (chartType === "candles") {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: settings.candleUpColor, downColor: settings.candleDownColor,
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
    const mainSeries = seriesRef.current;
    if (!mainSeries) return;
    const drawingPrimitive = new DrawingPrimitive();
    mainSeries.attachPrimitive(drawingPrimitive);
    drawingPrimitiveRef.current = drawingPrimitive;
    const bigTradesPrimitive = new BigTradesPrimitive(setHoveredBigTrade);
    mainSeries.attachPrimitive(bigTradesPrimitive);
    bigTradesPrimitiveRef.current = bigTradesPrimitive;
    const volumeProfilePrimitive = new VolumeProfilePrimitive();
    mainSeries.attachPrimitive(volumeProfilePrimitive);
    volumeProfilePrimitiveRef.current = volumeProfilePrimitive;
  }, [chartType]);

  useEffect(() => { volumeProfilePrimitiveRef.current?.setProfile(volumeProfile, contract.tickSize); }, [volumeProfile, contract.tickSize, chartType]);

  useEffect(() => {
    if (Number.isFinite(contract.tickSize) && contract.tickSize > 0) seriesRef.current?.applyOptions({ priceFormat: { type: "price", minMove: contract.tickSize } });
    else seriesRef.current?.applyOptions({ priceFormat: { type: "custom", formatter: value => String(value) } });
  }, [chartType, contract.tickSize]);

  useEffect(() => {
    const primitive = bigTradesPrimitiveRef.current;
    if (!primitive) return;
    primitive.setClusters(
      activeBigTradesSettings && flowReady && effectiveReplayIndex == null && !snapshot && observations
        ? observations.bigTrades(contract.tickSize, activeBigTradesSettings, observation).clusters
        : [],
      activeBigTradesSettings,
      timeframe,
    );
  }, [activeBigTradesSettings, chartType, contract.tickSize, effectiveReplayIndex, snapshot, flowReady, observations, observation, observedTrades, timeframe]);

  useEffect(() => { setHoveredBigTrade(null); }, [flowReady, provider, symbol, activeBigTradesSettings]);

  useEffect(() => {
    const sorted = [...bars].sort((a, b) => a.t - b.t);
    const replayCursor = effectiveReplayIndex == null ? undefined : sorted[effectiveReplayIndex]?.t;
    const visible = drawings.filter(drawing => isDrawingVisible(drawing, timeframe, replayCursor));
    visibleDrawingsRef.current = visible;
    const drawingPreview = drawingPreviewRef.current;
    if (chartRef.current && seriesRef.current) {
      drawingCoordinatesRef.current = createDrawingCoordinates(chartRef.current, seriesRef.current, availableBars.map(bar => bar.t), intervalMs(timeframe));
      drawingPrimitiveRef.current?.setCoordinates(drawingCoordinatesRef.current);
    }
    drawingPrimitiveRef.current?.setDrawings(drawingPreview ? [...visible.filter(drawing => drawing.id !== drawingPreview.id), drawingPreview] : visible, selectedDrawingId);
  }, [availableBars, bars, chartType, drawings, effectiveReplayIndex, selectedDrawingId, timeframe]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (chartType === "candles") seriesRef.current.applyOptions({ upColor: settings.candleUpColor, downColor: settings.candleDownColor, borderVisible: settings.showCandleBorders, borderUpColor: settings.candleBorderUpColor, borderDownColor: settings.candleBorderDownColor, wickVisible: settings.showCandleWicks, wickUpColor: settings.candleWickUpColor, wickDownColor: settings.candleWickDownColor, priceLineVisible: settings.showPriceLine });
    else if (chartType === "bars") seriesRef.current.applyOptions({ upColor: settings.candleUpColor, downColor: settings.candleDownColor, priceLineVisible: settings.showPriceLine });
    else if (chartType === "line") seriesRef.current.applyOptions({ color: themeColors().mdata, priceLineVisible: settings.showPriceLine });
    else seriesRef.current.applyOptions({ lineColor: themeColors().mdata, priceLineVisible: settings.showPriceLine });
  }, [chartType, settings]);

  // Setup Volume series
  useEffect(() => {
    if (!chartRef.current) return;
    
    if (indicators.volume) {
      if (!volumeSeriesRef.current) {
        volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
          color: "#26a69a",
          priceFormat: { type: "volume" },
          priceScaleId: "right",
          priceLineVisible: false,
          lastValueVisible: false,
        }, 1);
      }
    } else if (volumeSeriesRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
  }, [indicators.volume]);

  useEffect(() => {
    if (!chartRef.current) return;
    applyVolumePaneLayout(chartRef.current, volumePaneHeight);
  }, [indicators.volume, volumePaneHeight]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (markPriceLineRef.current) {
      seriesRef.current.removePriceLine(markPriceLineRef.current);
      markPriceLineRef.current = null;
    }
    if (effectiveReplayIndex != null || snapshot || !availableBars.length || markPrice == null || !Number.isFinite(markPrice)) return;
    markPriceLineRef.current = seriesRef.current.createPriceLine({ price: markPrice, color: themeColors().mdata, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "MARK" });
    return () => {
      if (seriesRef.current && markPriceLineRef.current) seriesRef.current.removePriceLine(markPriceLineRef.current);
      markPriceLineRef.current = null;
    };
  }, [chartType, markPrice, effectiveReplayIndex, snapshot, availableBars.length]);

  // Feed data to chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !seriesRef.current) return;
    if (!availableBars.length) {
      seriesRef.current.setData([]);
      volumeSeriesRef.current?.setData([]);
      for (const series of indicatorSeriesRef.current.values()) series.setData([]);
      setStudyWarnings(current => current.length ? [] : current);
      return;
    }
    
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
    
    // Indicator calculations are pure and series are keyed by instance/output.
    const legacy = [
      ...(indicators.vwap ? [createStudy("vwap", "legacy-vwap")] : []),
      ...(indicators.ema20 ? [createStudy("ema20", "legacy-ema20")] : []),
      ...(indicators.ema50 ? [createStudy("ema50", "legacy-ema50")] : []),
      ...(indicators.customStudies ?? []).map(study => migrateStudy({ ...study, presetId: study.kind === "ema" && study.period === 50 ? "ema50" : study.kind === "ema" ? "ema20" : study.kind === "sma" ? "sma20" : study.kind === "wma" ? "wma20" : study.kind === "vwma" ? "vwma20" : study.kind === "bollinger" ? "bollinger20" : study.kind === "donchian" ? "donchian20" : "vwap" })).filter((study): study is IndicatorInstance => study !== null),
    ];
    const activeOutputs = new Set<string>();
    const warnings: string[] = [];
    for (const study of indicatorInstances ?? legacy) {
      const timeframeVisible = study.visibility.timeframes === "all" || study.visibility.timeframes.includes(timeframe);
      if (!study.enabled || !timeframeVisible || study.kind === "volume" || study.kind === "profile") continue;
      const binding = study.kind === "python" ? pythonBindings.find(item => item.study.id === study.id) : undefined;
      if (study.kind === "python" && !binding?.valid) continue;
      const evaluation = binding?.evaluation;
      let evaluated;
      try { evaluated = evaluation ? Object.entries(evaluation.outputs).map(([id, output]) => { const byTime = new Map(output.points.map(point => [point.time, point.value])); return { id, values: availableBars.map(bar => byTime.get(bar.t) ?? null) }; }) : evaluateIndicator(study, availableBars, timezone); }
      catch (error) { warnings.push(`${study.name}: ${(error as Error).message}`); continue; }
      for (const output of study.outputs) {
        const values = evaluated.find(item => item.id === output.id)?.values;
        if (!output.visible || !values) continue;
        const key = `${study.id}:${output.id}`;
        let series = indicatorSeriesRef.current.get(key);
        const paneIndex = study.paneId === "price" ? 0 : indicators.volume ? 2 : 1;
        const common = { color: output.color, lineWidth: output.width as 1 | 2 | 3 | 4, lineStyle: output.lineStyle === "dashed" ? LineStyle.Dashed : output.lineStyle === "dotted" ? LineStyle.Dotted : LineStyle.Solid, priceScaleId: study.priceScaleId === "indicator" ? key : study.priceScaleId, priceLineVisible: false, lastValueVisible: true };
        if (!series) {
          series = output.plot === "histogram" ? chart.addSeries(HistogramSeries, common, paneIndex) : output.plot === "area" ? chart.addSeries(AreaSeries, { ...common, lineColor: output.color, topColor: `${output.color}55`, bottomColor: `${output.color}05` }, paneIndex) : chart.addSeries(LineSeries, { ...common, crosshairMarkerVisible: false }, paneIndex);
          indicatorSeriesRef.current.set(key, series);
        } else { series.applyOptions(common); series.moveToPane(paneIndex); }
        series.setData(values.map((value, index) => ({ time: timeData[index], value: value ?? undefined })).filter(item => item.value !== undefined) as any);
        activeOutputs.add(key);
      }
    }
    for (const [key, series] of indicatorSeriesRef.current) if (!activeOutputs.has(key)) { chart.removeSeries(series); indicatorSeriesRef.current.delete(key); }
    setStudyWarnings(current => current.length === warnings.length && current.every((value, index) => value === warnings[index]) ? current : warnings);
    if (pageViewRef.current) { chart.timeScale().setVisibleRange(pageViewRef.current); pageViewRef.current = null; }
    
  }, [availableBars, chartType, indicatorInstances, indicators, pythonBindings, settings.candleUpColor, settings.candleDownColor, timeframe, timezone]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (!markerPlugin.current) markerPlugin.current = createSeriesMarkers(seriesRef.current, []);
    const tvMarkers = [...(markers ?? [])].filter(marker => availableBars.length && marker.t >= availableBars[0].t && marker.t <= availableBars[availableBars.length - 1].t).sort((a, b) => a.t - b.t).map(m => ({
        time: (m.t / 1000) as Time,
        position: m.side === "buy" ? "belowBar" : "aboveBar",
        color: m.side === "buy" ? themeColors().pos : themeColors().neg,
        shape: m.side === "buy" ? "arrowUp" : "arrowDown",
        text: m.label || "",
      })) as any;
    markerPlugin.current.setMarkers(tvMarkers);
  }, [markers, availableBars, chartType, settings.candleUpColor, settings.candleDownColor]);

  useEffect(() => {
    if (!chartRef.current || !snapshot?.length) return;
    if (focusRange) chartRef.current.timeScale().setVisibleRange({ from: (focusRange.from / 1000) as Time, to: (focusRange.to / 1000) as Time });
    else chartRef.current.timeScale().fitContent();
  }, [snapshot, focusRange]);

  return (
    <div className="relative h-full w-full bg-background" onDoubleClick={() => chartRef.current?.timeScale().fitContent()}>
      <div ref={chartContainerRef} className="absolute inset-0 z-10" />
      {hoveredBigTrade && (
        <div className="pointer-events-none absolute left-3 top-3 z-50 min-w-56 border hairline bg-panel/95 px-3 py-2 font-mono text-[10px] shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-4 text-foreground">
            <span>BIG TRADES</span>
            <span className={hoveredBigTrade.side === "buy" ? "text-pos" : "text-neg"}>{hoveredBigTrade.side.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
            <span>Provider</span><span className="text-right text-foreground">{hoveredBigTrade.provider}</span>
            <span>Symbol</span><span className="text-right text-foreground">{hoveredBigTrade.symbol}</span>
            <span>Price</span><span className="text-right text-foreground">{hoveredBigTrade.price.toLocaleString()}</span>
            <span>Quantity</span><span className="text-right text-foreground">{hoveredBigTrade.quantity.toLocaleString()} {hoveredBigTrade.quantityUnit ?? "native units"}</span>
            <span>Quote notional</span><span className="text-right text-foreground">{hoveredBigTrade.notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span>Prints</span><span className="text-right text-foreground">{hoveredBigTrade.count}</span>
            <span>First / last</span><span className="text-right text-foreground">{new Date(hoveredBigTrade.firstTimestamp).toLocaleTimeString()} / {new Date(hoveredBigTrade.lastTimestamp).toLocaleTimeString()}</span>
            <span>Chart anchor</span><span className="text-right text-foreground">Containing {timeframe} candle</span>
            <span>Granularity</span><span className="text-right text-foreground">{hoveredBigTrade.granularity}</span>
          </div>
        </div>
      )}
      {onDrawingTool && onSelectDrawing && onCreateDrawing && onUpdateDrawing && onDeleteDrawing && onDuplicateDrawing && (
        <DrawingInteractionLayer
          key={`${symbol}:${timeframe}`}
          tool={drawingTool}
          persistent={persistentDrawing}
          magnet={magnetMode}
          bars={availableBars}
          drawings={drawings}
          scopeKey={`${drawingScopeKey}:${historyKey}`}
          selectedId={selectedDrawingId}
          coordinates={() => drawingCoordinatesRef.current}
          viewport={() => ({ width: chartRef.current?.timeScale().width() ?? 0, height: chartRef.current?.panes()[0]?.getHeight() ?? 0 })}
          projected={() => drawingPrimitiveRef.current?.getProjected() ?? []}
          onTool={onDrawingTool}
          onSelect={onSelectDrawing}
          onCreate={onCreateDrawing}
          onUpdate={onUpdateDrawing}
          onDelete={onDeleteDrawing}
          onDuplicate={onDuplicateDrawing}
          onSnap={point => drawingPrimitiveRef.current?.setSnapTarget(point)}
          onPreview={drawing => {
            drawingPreviewRef.current = drawing;
            const visible = visibleDrawingsRef.current;
            drawingPrimitiveRef.current?.setDrawings(drawing ? [...visible.filter(item => item.id !== drawing.id), drawing] : visible, selectedDrawingId);
          }}
        />
      )}
      {pythonBindings.length > 0 && <div role="status" className="absolute left-2 top-2 z-20 max-w-[60%] bg-panel/95 px-2 py-1 text-[9px]">{pythonBindings.map(({ study, evaluation, valid }) => <p key={study.id}>{valid && evaluation?.dataset ? `${study.name}: saved ${evaluation.dataset.provider}/${evaluation.dataset.symbol}/${evaluation.dataset.timeframe}, revision ${evaluation.artifact.revision}, ${new Date(evaluation.dataset.from).toISOString()} → ${new Date(evaluation.dataset.to).toISOString()}. Matching captured candles only.` : `${study.name}: no matching saved evaluation. Update Helper if needed and re-run Preview for this market, parameters and data range.`}</p>)}</div>}
      {volumeProfile && <div className="absolute bottom-8 left-2 z-20 bg-panel px-2 py-1 text-[9px]">OHLCV profile estimate · all loaded {effectiveReplayIndex == null ? "candles" : "replay-prefix candles"} · 70% value area · volume {activeHistory?.volumeUnit ?? "captured dataset units"}</div>}
      {studyWarnings.length > 0 && <div role="status" className="absolute left-2 top-12 z-20 bg-panel px-2 py-1 text-[9px]">{studyWarnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
      {activeBigTradesSettings && (effectiveReplayIndex != null || snapshot) && <div role="status" className="absolute bottom-14 left-2 z-20 bg-panel px-2 py-1 text-[9px]">Big Trades unavailable: this candle dataset has no recorded trade events.</div>}
      {marketContext && <MarketContextOverlay context={marketContext} tickSize={contract.tickSize} />}
      
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
      
      {activeHistory && <div className="absolute right-2 top-2 z-20 bg-panel px-2 py-1 text-[9px]" aria-label="History provenance">{activeHistory.selectedProvider} / {activeHistory.effectiveProvider} · {activeHistory.nativeSymbol} · {activeHistory.contract.product} · {activeHistory.environment} · {activeHistory.dataStatus} · {activeHistory.cache} · retrieved {new Date(activeHistory.retrievedAt).toLocaleString()} · source {activeHistory.sourceTimestamp == null ? "unknown" : new Date(activeHistory.sourceTimestamp).toLocaleString()} · {activeHistory.integrity} · volume {activeHistory.volumeUnit} · missing {activeHistory.gapCount} · {activeHistory.hasOpenCandle ? "includes unfinished candle" : "closed candles"}</div>}
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
      {!snapshot && !loading && bars.length > 0 && <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2 bg-panel px-2 py-1 text-[10px]">
        <button type="button" disabled={paging || historyEnd} onClick={() => loadOlderRef.current?.()}>{paging ? "Loading earlier history…" : "Load earlier history"}</button>
        {pageMessage && <span role="status">{pageMessage}</span>}
      </div>}
      {!loading && !err && !bars.length && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/80 text-center text-[11px] text-muted-foreground backdrop-blur-sm">
          No historical candles available for this market and timeframe.
        </div>
      )}
    </div>
  );
}


function MarketContextOverlay({ context, tickSize }: { context: { volatility: ReturnType<typeof calculateVolatility>; regime: ReturnType<typeof classifyRegime>; openingRange: ReturnType<typeof computeOpeningRange> }; tickSize: number }) {
  const price = (value: number) => Number.isFinite(tickSize) ? value.toLocaleString(undefined, { maximumFractionDigits: Math.max(2, pricePrecision(tickSize)) }) : String(value);
  const range = context.openingRange.complete && Number.isFinite(context.openingRange.high) ? `${price(context.openingRange.low)}–${price(context.openingRange.high)}` : "Awaiting range";
  return <aside className="zt-market-context-strip" aria-label="Market intelligence context"><span><b>REGIME</b>{context.regime.kind.replaceAll("_", " ")} · {(context.regime.confidence * 100).toFixed(0)}%</span><span><b>ATR</b>{context.volatility.atr == null ? "—" : price(context.volatility.atr)}</span><span><b>RV</b>{context.volatility.realizedVolatility == null ? "—" : `${(context.volatility.realizedVolatility * 100).toFixed(3)}%`}</span><span><b>OR 00:00–00:30 UTC</b>{range}</span></aside>;
}
