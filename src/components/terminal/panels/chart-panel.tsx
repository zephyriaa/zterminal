"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CandlestickChart,
  Layers3,
  LineChart,
  Play,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import {
  DEFAULT_CHART_SETTINGS,
  TerminalChart,
  type ChartIndicators,
  type ChartSettings,
  type ChartStudy,
  type ChartType,
  type TradeMarker,
} from "../terminal-chart";
import { useWorkspace } from "@/stores/workspace";
import { useLayout } from "@/stores/layout";
import { useStrategy } from "@/stores/strategy";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Timeframe } from "@/lib/market/types";
import type { IndicatorToggleId } from "../indicators-browser";
import { cn } from "@/lib/utils";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "D" },
];

function formatPrice(value: number | undefined | null, tick: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.max(2, Math.min(8, Math.round(-Math.log10(tick))));
  return value.toLocaleString("en-US", {
    minimumFractionDigits: tick >= 1 ? 2 : digits,
    maximumFractionDigits: tick >= 1 ? 2 : digits,
  });
}

interface ChartPanelProps {
  layers: Record<IndicatorToggleId, boolean>;
  customStudies: ChartStudy[];
  onToggleLayer: (id: IndicatorToggleId) => void;
}

export function ChartPanel({ layers, customStudies, onToggleLayer }: ChartPanelProps) {
  const { symbol, timeframe, setTimeframe, timezone } = useWorkspace();
  const { appearance, setLeftTab, setRightTab } = useLayout();
  const { lastResult } = useStrategy();
  const contract = getContract(symbol);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [replay, setReplay] = useState(false);
  const [showTrades, setShowTrades] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute on-chart execution markers from strategy backtest trades
  const tradeMarkers: TradeMarker[] = useMemo(() => {
    if (!showTrades || !lastResult?.trades || lastResult.trades.length === 0) return [];
    const markers: TradeMarker[] = [];
    for (const t of lastResult.trades) {
      // Entry marker
      markers.push({
        t: t.entryTime,
        side: t.side === "long" ? "buy" : "sell",
        price: t.entryPrice,
        qty: t.qty,
        label: `${t.side === "long" ? "BUY" : "SELL"} @ $${t.entryPrice.toLocaleString()}`,
      });
      // Exit marker
      const isWin = t.pnl >= 0;
      markers.push({
        t: t.exitTime,
        side: t.side === "long" ? "sell" : "buy",
        price: t.exitPrice,
        qty: t.qty,
        label: `EXIT ${isWin ? "+" : ""}$${t.pnl.toFixed(0)}`,
      });
    }
    return markers;
  }, [showTrades, lastResult?.trades]);

  const { lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(
    symbol,
    { trades: 100, depth: false }
  );

  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;

  const indicators: ChartIndicators = useMemo(
    () => ({
      vwap: layers.vwap,
      ema20: layers.ema20,
      ema50: layers.ema50,
      volume: layers.volume,
      customStudies,
    }),
    [layers, customStudies]
  );

  const chartSettings: ChartSettings = useMemo(
    () => ({
      ...DEFAULT_CHART_SETTINGS,
      backgroundColor: appearance.chartBackground,
      candleUpColor: appearance.upColor,
      candleDownColor: appearance.downColor,
      gridOpacity: appearance.gridOpacity / 100,
    }),
    [appearance]
  );

  return (
    <div className="flex h-full flex-col bg-background relative select-none overflow-hidden">
      {/* Dense Chart Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b hairline px-3 bg-panel/70 backdrop-blur-sm z-10">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs font-bold text-foreground">{symbol}</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-surface font-mono text-muted-foreground">
              {contract.exchange} · {contract.product.toUpperCase()}
            </span>
          </div>

          <span className="h-3.5 w-px bg-border/60 mx-1" aria-hidden="true" />

          {/* Timeframe Buttons */}
          <div className="flex items-center gap-0.5" role="group" aria-label="Timeframe">
            {TIMEFRAMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTimeframe(item.value)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10.5px] font-mono transition-colors",
                  timeframe === item.value
                    ? "bg-accent/20 text-accent font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                )}
                aria-pressed={timeframe === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>

          <span className="h-3.5 w-px bg-border/60 mx-1" aria-hidden="true" />

          {/* Quick Indicators Pills */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleLayer("vwap")}
              className={cn(
                "text-[9.5px] px-1.5 py-0.5 rounded font-mono transition-colors",
                layers.vwap
                  ? "bg-warn/20 text-warn font-semibold border border-warn/30"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground"
              )}
            >
              VWAP
            </button>
            <button
              type="button"
              onClick={() => onToggleLayer("ema20")}
              className={cn(
                "text-[9.5px] px-1.5 py-0.5 rounded font-mono transition-colors",
                layers.ema20
                  ? "bg-accent/20 text-accent font-semibold border border-accent/30"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground"
              )}
            >
              EMA 20
            </button>
            <button
              type="button"
              onClick={() => onToggleLayer("volume")}
              className={cn(
                "text-[9.5px] px-1.5 py-0.5 rounded font-mono transition-colors",
                layers.volume
                  ? "bg-muted text-foreground font-semibold border border-border"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground"
              )}
            >
              VOL
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("indicators")}
              className="text-[9.5px] px-1 py-0.5 text-muted-foreground hover:text-foreground ml-0.5"
              title="Open full indicator library"
            >
              <Layers3 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Right side of toolbar */}
        <div className="flex items-center gap-2">
          {/* Live Price Readout */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="font-bold text-foreground">
              ${formatPrice(livePrice, contract.tickSize)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                dataStatus === "LIVE"
                  ? "bg-pos/15 text-pos"
                  : "bg-surface text-muted-foreground"
              )}
              title={reason ?? health?.reason ?? "Market data feed"}
            >
              {dataStatus === "LIVE" && <span className="h-1.5 w-1.5 rounded-full bg-pos animate-pulse" />}
              {dataStatus}
            </span>
          </div>

          <span className="h-3.5 w-px bg-border/60 mx-0.5" aria-hidden="true" />

          {/* Replay & Trades Controls */}
          <button
            type="button"
            onClick={() => setReplay(!replay)}
            className={cn(
              "px-2 py-0.5 rounded text-[10.5px] font-mono font-medium transition-colors flex items-center gap-1",
              replay
                ? "bg-accent text-accent-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
            )}
            title="Toggle Historical Bar Replay Scrubber"
          >
            <Play className="h-3 w-3" />
            <span>Replay</span>
          </button>

          {lastResult?.trades && lastResult.trades.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTrades(!showTrades)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-1",
                showTrades
                  ? "bg-pos/20 text-pos font-bold border border-pos/30"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Strategy Trade Execution Markers on Candlesticks"
            >
              <span>Trades ({lastResult.trades.length})</span>
            </button>
          )}

          <span className="h-3.5 w-px bg-border/60 mx-0.5" aria-hidden="true" />

          {/* Chart Types */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setChartType("candles")}
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded transition-colors",
                chartType === "candles" ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Candlestick Chart"
            >
              <CandlestickChart className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType("bars")}
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded transition-colors",
                chartType === "bars" ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="OHLC Bar Chart"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded transition-colors",
                chartType === "line" ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Line Chart"
            >
              <LineChart className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Refresh & Settings */}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title="Refresh Chart Viewport"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRightTab("settings")}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title="Chart & Appearance Settings"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="flex-1 min-h-0 relative">
        {/* Floating Readout Overlay */}
        <div className="absolute top-2 left-3 z-10 flex items-center gap-3 font-mono text-[10px] text-muted-foreground pointer-events-none bg-background/60 backdrop-blur-xs px-2 py-0.5 rounded border hairline">
          <span>O: <b className="text-foreground">{formatPrice(lastTrade?.price, contract.tickSize)}</b></span>
          <span>H: <b className="text-foreground">{formatPrice(lastTrade?.price, contract.tickSize)}</b></span>
          <span>L: <b className="text-foreground">{formatPrice(lastTrade?.price, contract.tickSize)}</b></span>
          <span>C: <b className="text-foreground">{formatPrice(lastTrade?.price, contract.tickSize)}</b></span>
          <span>V: <b className="text-foreground">—</b></span>
        </div>

        <TerminalChart
          key={refreshKey}
          symbol={symbol}
          timeframe={timeframe as Timeframe}
          chartType={chartType}
          indicators={indicators}
          settings={chartSettings}
          replayEnabled={replay}
          markers={tradeMarkers}
          timezone={timezone}
          markPrice={derivatives?.markPrice}
        />
      </div>
    </div>
  );
}
