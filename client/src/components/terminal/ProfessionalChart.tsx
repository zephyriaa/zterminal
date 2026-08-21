import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Activity, AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { getResearchLayerCapability, type ResearchLayerId, type TerminalBar } from "@/lib/terminalWorkspace";
import { calculateEmaSeries, calculateVolumeProfile, calculateVwapSeries } from "@shared/features/registry";
import { calculateCvd, type SignedPublicTrade } from "@shared/market/orderFlowContracts";
import { evaluateIndicator, type CompiledIndicator } from "@shared/indicators/indicatorRuntime";
import { evaluateNativeStudy, type NativeStudyConfig } from "@shared/indicators/nativeStudies";
import type { BacktestMarker } from "@shared/backtest/engine";

type HoveredBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
} | null;

type ProfessionalChartProps = {
  bars: TerminalBar[];
  interval: string;
  symbol: string;
  activeLayers: ResearchLayerId[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  errorMessage?: string | null;
  coverageLabel: string;
  onRetry?: () => void;
  showMomentum?: boolean;
  cvdTrades?: SignedPublicTrade[];
  cvdState?: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE";
  tradeMarkers?: BacktestMarker[];
  customIndicators?: CompiledIndicator[];
  nativeStudies?: NativeStudyConfig[];
  intrabarDelta?: { intrabarInterval: string | null; method: "INTRABAR_CANDLE_DIRECTION_ESTIMATE"; points: Array<{ t: number; delta: number; cumulativeDelta: number; intrabarCount: number }> } | null;
};

const chartColors = {
  background: "#131722",
  grid: "rgba(42, 46, 57, 0.9)",
  text: "#787b86",
  up: "#26a69a",
  down: "#ef5350",
  vwap: "#22c7c3",
  ema20: "#9f7aea",
  ema50: "#5d8cff",
  structure: "rgba(159, 122, 234, 0.52)",
  profile: "rgba(34, 199, 195, 0.48)",
  cvd: "#f3b35c",
};

function priceFormatter(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(value) >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function volumeFormatter(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function timeFormatter(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function calculateRsi(bars: TerminalBar[], period = 14) {
  if (!bars.length) return [] as Array<{ time: UTCTimestamp; value: number }>;
  return bars.map((bar, index) => {
    if (index < period) return { time: Math.floor(bar.t / 1000) as UTCTimestamp, value: 50 };
    let gains = 0;
    let losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const change = bars[cursor].c - bars[cursor - 1].c;
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }
    const relativeStrength = losses === 0 ? 100 : gains / losses;
    const value = 100 - 100 / (1 + relativeStrength);
    return { time: Math.floor(bar.t / 1000) as UTCTimestamp, value };
  });
}

function toCvdSeries(trades: SignedPublicTrade[]) {
  const points = new Map<number, number>();
  for (const point of calculateCvd(trades)) points.set(Math.floor(point.timestamp / 1_000), point.value);
  return Array.from(points.entries())
    .sort(([left], [right]) => left - right)
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

function useLastVerifiedBars(bars: TerminalBar[]) {
  const lastGood = useRef<TerminalBar[]>([]);
  if (bars.length) lastGood.current = bars;
  return bars.length ? bars : lastGood.current;
}

export function ProfessionalChart({
  bars,
  interval,
  symbol,
  activeLayers,
  isLoading = false,
  isRefreshing = false,
  errorMessage,
  coverageLabel,
  onRetry,
  showMomentum = true,
  cvdTrades = [],
  cvdState = "UNAVAILABLE",
  tradeMarkers = [],
  customIndicators = [],
  nativeStudies = [],
  intrabarDelta = null,
}: ProfessionalChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredBar, setHoveredBar] = useState<HoveredBar>(null);
  const visibleBars = useLastVerifiedBars(bars);
  const has = (layer: ResearchLayerId) => activeLayers.includes(layer);
  const lastBar = visibleBars.at(-1) ?? null;
  const previousBar = visibleBars.at(-2) ?? null;
  const barChange = lastBar && previousBar && previousBar.c !== 0 ? ((lastBar.c - previousBar.c) / previousBar.c) * 100 : null;
  const activeLayerLegend = activeLayers.map((layer) => getResearchLayerCapability(layer)).filter((layer): layer is NonNullable<typeof layer> => Boolean(layer));

  const cvdSeriesData = useMemo(() => toCvdSeries(cvdTrades), [cvdTrades]);
  const customIndicatorSeries = useMemo(() => customIndicators.flatMap((indicator) => {
    const evaluation = evaluateIndicator(indicator, visibleBars);
    return evaluation.status === "COMPLETED" ? [{ indicator, points: evaluation.points.map(point => ({ time: Math.floor(point.t / 1_000) as UTCTimestamp, value: point.value })) }] : [];
  }), [customIndicators, visibleBars]);
  const nativeStudyResults = useMemo(() => nativeStudies.flatMap((study) => {
    const evaluation = evaluateNativeStudy(study, visibleBars);
    return evaluation.status === "COMPLETED" ? [evaluation] : [];
  }), [nativeStudies, visibleBars]);
  const intrabarStudySeries = useMemo<Array<{ id: string; label: string; kind: "line" | "histogram"; points: Array<{ t: number; value: number; color?: string }> }>>(() => {
    if (!intrabarDelta) return [];
    const series: Array<{ id: string; label: string; kind: "line" | "histogram"; points: Array<{ t: number; value: number; color?: string }> }> = [];
    for (const study of nativeStudies) {
      if (study.id === "volume_delta") series.push({ id: "volume-delta", label: `Volume Delta · ${intrabarDelta.intrabarInterval ?? "intrabar"} estimate`, kind: "histogram", points: intrabarDelta.points.map((point) => ({ t: point.t, value: point.delta, color: point.delta >= 0 ? "rgba(38,166,154,.72)" : "rgba(239,83,80,.72)" })) });
      if (study.id === "cumulative_volume_delta") series.push({ id: "cumulative-volume-delta", label: `CVD · ${intrabarDelta.intrabarInterval ?? "intrabar"} estimate`, kind: "line", points: intrabarDelta.points.map((point) => ({ t: point.t, value: point.cumulativeDelta })) });
    }
    return series;
  }, [intrabarDelta, nativeStudies]);

  const studies = useMemo(() => {
    const ema20 = calculateEmaSeries(visibleBars, 20);
    const ema50 = calculateEmaSeries(visibleBars, 50);
    const vwap = calculateVwapSeries(visibleBars);
    const profile = calculateVolumeProfile(visibleBars, 24);
    const high = visibleBars.length ? Math.max(...visibleBars.map((bar) => bar.h)) : null;
    const low = visibleBars.length ? Math.min(...visibleBars.map((bar) => bar.l)) : null;
    return { ema20, ema50, vwap, profile, high, low, midpoint: high !== null && low !== null ? (high + low) / 2 : null };
  }, [visibleBars]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visibleBars.length) return undefined;

    let chart: IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const barByTime = new Map(visibleBars.map((bar) => [Math.floor(bar.t / 1000), bar]));

    const create = () => {
      const width = Math.max(container.clientWidth, 320);
      const height = Math.max(container.clientHeight, 440);
      chart = createChart(container, {
        width,
        height,
        autoSize: false,
        layout: {
          background: { type: ColorType.Solid, color: chartColors.background },
          textColor: chartColors.text,
          fontSize: 11,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          attributionLogo: false,
          panes: { enableResize: true, separatorColor: "rgba(129,118,157,0.2)", separatorHoverColor: "rgba(150,103,238,0.38)" },
        },
        grid: {
          vertLines: { color: chartColors.grid, style: LineStyle.Solid },
          horzLines: { color: chartColors.grid, style: LineStyle.Solid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(189, 178, 222, 0.38)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#5d36aa" },
          horzLine: { color: "rgba(61, 224, 207, 0.34)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#137d77" },
        },
        rightPriceScale: { borderColor: "rgba(129,118,157,0.28)", scaleMargins: { top: 0.10, bottom: 0.08 }, minimumWidth: 76 },
        leftPriceScale: { visible: false },
        timeScale: { borderColor: "rgba(129,118,157,0.28)", timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 1 },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: chartColors.up,
        downColor: chartColors.down,
        borderVisible: false,
        wickUpColor: chartColors.up,
        wickDownColor: chartColors.down,
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineColor: "rgba(55, 213, 199, 0.62)",
        priceLineStyle: LineStyle.Dashed,
        priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
      });
      candleSeries.setData(visibleBars.map((bar) => ({ time: Math.floor(bar.t / 1000) as UTCTimestamp, open: bar.o, high: bar.h, low: bar.l, close: bar.c })));
      if (tradeMarkers.length) {
        createSeriesMarkers(candleSeries, tradeMarkers.map(marker => ({
          time: Math.floor(marker.time / 1000) as UTCTimestamp,
          position: marker.position,
          shape: marker.shape,
          color: marker.color,
          text: marker.text,
        })));
      }

      let volumeSeries: ISeriesApi<"Histogram"> | null = null;
      try {
        volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
          base: 0,
        });
        volumeSeries.moveToPane(1);
        volumeSeries.setData(visibleBars.map((bar) => ({
          time: Math.floor(bar.t / 1000) as UTCTimestamp,
          value: bar.v,
          color: bar.c >= bar.o ? "rgba(28, 199, 195, 0.55)" : "rgba(159, 85, 239, 0.55)",
        })));
        volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.26, bottom: 0 }, borderColor: "rgba(129,118,157,0.18)" });
      } catch {
        volumeSeries = null;
      }

      if (showMomentum) {
        const rsiSeries = chart.addSeries(LineSeries, {
          color: "#9d6bff",
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        rsiSeries.moveToPane(2);
        rsiSeries.setData(calculateRsi(visibleBars));
        rsiSeries.createPriceLine({ price: 70, color: "rgba(159,85,239,0.32)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
        rsiSeries.createPriceLine({ price: 30, color: "rgba(28,199,195,0.25)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
        rsiSeries.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0.18 }, borderColor: "rgba(129,118,157,0.18)" });
      }

      if (has("ema")) {
        const ema20 = chart.addSeries(LineSeries, { color: chartColors.ema20, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        const ema50 = chart.addSeries(LineSeries, { color: chartColors.ema50, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        ema20.setData(visibleBars.map((bar, index) => ({ time: Math.floor(bar.t / 1000) as UTCTimestamp, value: studies.ema20[index] ?? bar.c })));
        ema50.setData(visibleBars.map((bar, index) => ({ time: Math.floor(bar.t / 1000) as UTCTimestamp, value: studies.ema50[index] ?? bar.c })));
      }

      if (has("vwap")) {
        const vwap = chart.addSeries(LineSeries, { color: chartColors.vwap, lineWidth: 2, lineStyle: LineStyle.Solid, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        vwap.setData(visibleBars.map((bar, index) => ({ time: Math.floor(bar.t / 1000) as UTCTimestamp, value: studies.vwap[index] ?? bar.c })));
      }

      if (has("cvd") && cvdSeriesData.length) {
        const cvdSeries = chart.addSeries(LineSeries, {
          color: chartColors.cvd,
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        cvdSeries.moveToPane(showMomentum ? 3 : 2);
        cvdSeries.setData(cvdSeriesData);
        cvdSeries.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0.18 }, borderColor: "rgba(255,180,84,0.18)" });
      }

      for (const custom of customIndicatorSeries) {
        const customSeries = chart.addSeries(LineSeries, {
          color: custom.indicator.definition.output.color,
          lineWidth: custom.indicator.definition.output.lineWidth as 1 | 2 | 3 | 4,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        if (custom.indicator.definition.output.pane === "pane") {
          customSeries.moveToPane(chart.panes().length);
          customSeries.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0.18 }, borderColor: "rgba(42,46,57,0.82)" });
        }
        customSeries.setData(custom.points);
      }

      for (const result of nativeStudyResults) {
        for (const native of result.series) {
          if (native.id === "volume") continue;
          const series = native.kind === "histogram"
            ? chart.addSeries(HistogramSeries, { color: native.color, lastValueVisible: false, priceLineVisible: false, base: 0 })
            : chart.addSeries(LineSeries, { color: native.color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
          if (native.pane === "pane") {
            series.moveToPane(chart.panes().length);
            series.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0.18 }, borderColor: "rgba(42,46,57,0.82)" });
          } else if (native.pane === "volume") {
            series.moveToPane(1);
            series.priceScale().applyOptions({ scaleMargins: { top: 0.26, bottom: 0 }, borderColor: "rgba(42,46,57,0.82)" });
          }
          series.setData(native.points.map((point) => ({ time: Math.floor(point.t / 1_000) as UTCTimestamp, value: point.value, ...(native.kind === "histogram" && point.color ? { color: point.color } : {}) })));
        }
      }

      for (const intrabar of intrabarStudySeries) {
        const series = intrabar.kind === "histogram"
          ? chart.addSeries(HistogramSeries, { color: "#f3b35c", lastValueVisible: false, priceLineVisible: false, base: 0 })
          : chart.addSeries(LineSeries, { color: "#f3b35c", lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        series.moveToPane(chart.panes().length);
        series.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0.18 }, borderColor: "rgba(42,46,57,0.82)" });
        series.setData(intrabar.points.map((point) => ({ time: Math.floor(point.t / 1_000) as UTCTimestamp, value: point.value, ...(intrabar.kind === "histogram" && point.color ? { color: point.color } : {}) })));
      }

      if (has("structure") && studies.high !== null && studies.low !== null && studies.midpoint !== null) {
        candleSeries.createPriceLine({ price: studies.high, color: "rgba(29,207,195,0.52)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Window high" });
        candleSeries.createPriceLine({ price: studies.midpoint, color: chartColors.structure, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Mid" });
        candleSeries.createPriceLine({ price: studies.low, color: "rgba(159,85,239,0.52)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Window low" });
      }

      const profile = studies.profile;
      if (has("profile") && profile && profile.pointOfControl !== null && profile.valueAreaHigh !== null && profile.valueAreaLow !== null) {
        candleSeries.createPriceLine({ price: profile.pointOfControl, color: chartColors.profile, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "POC" });
        candleSeries.createPriceLine({ price: profile.valueAreaHigh, color: "rgba(86,138,255,0.52)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "VAH" });
        candleSeries.createPriceLine({ price: profile.valueAreaLow, color: "rgba(159,85,239,0.52)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "VAL" });
      }

      candleSeries.getPane().setStretchFactor(has("cvd") && cvdSeriesData.length ? 5.2 : showMomentum ? 6 : 7);
      volumeSeries?.getPane().setStretchFactor(1.35);
      if (showMomentum) chart.panes()[2]?.setStretchFactor(has("cvd") && cvdSeriesData.length ? 1.35 : 1.65);
      if (has("cvd") && cvdSeriesData.length) chart.panes()[showMomentum ? 3 : 2]?.setStretchFactor(1.45);

      const initialBars = Math.min(visibleBars.length, Math.max(110, Math.round(width / 7.5)));
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, visibleBars.length - initialBars), to: visibleBars.length + 4 });
      chart.subscribeCrosshairMove((parameter) => {
        if (!parameter.time || typeof parameter.time !== "number") {
          setHoveredBar(null);
          return;
        }
        const bar = barByTime.get(parameter.time);
        setHoveredBar(bar ? { time: bar.t, open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v } : null);
      });

      resizeObserver = new ResizeObserver(() => {
        if (!chart || !container) return;
        chart.resize(Math.max(container.clientWidth, 320), Math.max(container.clientHeight, 440));
      });
      resizeObserver.observe(container);
    };

    create();
    return () => {
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [visibleBars, activeLayers, has, showMomentum, studies, cvdSeriesData, customIndicatorSeries, nativeStudyResults, intrabarStudySeries, tradeMarkers]);

  const quote = hoveredBar ?? (lastBar ? { time: lastBar.t, open: lastBar.o, high: lastBar.h, low: lastBar.l, close: lastBar.c, volume: lastBar.v } : null);
  const showingPrevious = !bars.length && visibleBars.length > 0;

  return <section className="professional-chart" aria-label={`${symbol.replace("_", " / ")} verified professional chart`}>
    <div className="chart-meta-bar">
      <div className="chart-ohlc" aria-live="polite">
        <span className="chart-symbol">{symbol.replace("_", " / ")}</span>
        <span className="chart-interval">{interval}</span>
        {quote && <><span>O <b>{priceFormatter(quote.open)}</b></span><span>H <b>{priceFormatter(quote.high)}</b></span><span>L <b>{priceFormatter(quote.low)}</b></span><span>C <b className={quote.close >= quote.open ? "positive" : "negative"}>{priceFormatter(quote.close)}</b></span><span>Vol <b>{volumeFormatter(quote.volume)}</b></span></>}
      </div>
      <div className="chart-meta-status"><Activity size={13} /><span>{showingPrevious ? "Showing last verified window" : coverageLabel}</span>{has("cvd") && <span className={`chart-flow-status ${cvdState.toLowerCase()}`}>CVD · {cvdState === "LIVE" ? `${cvdTrades.length.toLocaleString("en-US")} live tape trades` : cvdState.toLowerCase()}</span>}</div>
    </div>
    {(activeLayerLegend.length > 0 || customIndicators.length > 0 || nativeStudyResults.length > 0) && <div className="chart-layer-legend" aria-label="Active chart layers"><span>Studies</span>{activeLayerLegend.map((layer) => <b key={layer.id}>{layer.label}</b>)}{nativeStudyResults.map((result) => <b className="native" key={result.study.id}>{result.study.shortLabel}</b>)}{intrabarStudySeries.map((study) => <b className="native intrabar" key={study.id}>{study.label}</b>)}{customIndicators.map((indicator) => <b className="custom" key={indicator.definition.name}>{indicator.definition.name}</b>)}</div>}
    <div className="chart-stage" ref={containerRef}>
      {visibleBars.length === 0 && !isLoading && <div className="chart-empty-state"><AlertTriangle size={20} /><strong>No verified chart window</strong><p>{errorMessage ?? "Load a supported Gate.io USDT perpetual symbol to begin."}</p>{onRetry && <button onClick={onRetry}><RefreshCw size={14} /> Retry market data</button>}</div>}
      {(isLoading || isRefreshing) && <div className="chart-loading-state"><LoaderCircle size={17} /><span>{isLoading ? (showingPrevious ? "Updating verified market window" : "Loading verified market window") : "Refreshing verified market window"}</span></div>}
      {errorMessage && visibleBars.length > 0 && <div className="chart-recovery-state"><AlertTriangle size={14} /><span>{errorMessage}</span>{onRetry && <button onClick={onRetry} aria-label="Retry market request"><RefreshCw size={13} /></button>}</div>}
    </div>
    <div className="chart-footer-context">
      <span>{quote ? timeFormatter(quote.time) : "Awaiting time context"}</span>
      {lastBar && <span className={barChange !== null && barChange >= 0 ? "positive" : "negative"}>{barChange === null ? "—" : `${barChange >= 0 ? "+" : ""}${barChange.toFixed(2)}% last bar`}</span>}
      <span>Pan / zoom enabled</span>
    </div>
  </section>;
}
