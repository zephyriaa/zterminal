"use client";
import { useMemo } from "react";
import { DEFAULT_CHART_SETTINGS, TerminalChart } from "./terminal-chart";
import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from "@/lib/market/types";

const indicators = { vwap: false, ema20: false, ema50: false, volume: false };

/** Desktop adapter to ZTerminal's web chart engine; Rust supplies verified history. */
export function LocalHistoryChart({ bars, symbol, intervalMs, from, to, onRange, gridPercent = 7 }: {
  bars: Bar[]; symbol: string; intervalMs: number; from: number | null; to: number | null;
  onRange: (from: number, to: number) => void; gridPercent?: number;
}) {
  const timeframe = Object.entries(TIMEFRAME_SECONDS).find(([, seconds]) => seconds * 1000 === intervalMs)?.[0] as Timeframe | undefined;
  const focusRange = useMemo(() => from != null && to != null ? { from, to } : null, [from, to]);
  const settings = useMemo(() => ({ ...DEFAULT_CHART_SETTINGS, futureBars: 0, gridOpacity: gridPercent / 100, backgroundColor: "#0b0a10", candleUpColor: "#34d399", candleDownColor: "#fb7185", candleWickUpColor: "#34d399", candleWickDownColor: "#fb7185", showCandleBorders: false }), [gridPercent]);
  const appearance = useMemo(() => ({ fontFamily: "Geist Mono", fontSize: 10, axisText: "#a8a2b5", gridColor: `rgba(181,162,232,${gridPercent / 100})` }), [gridPercent]);
  if (!timeframe) return <p role="alert">Unsupported stored chart interval. No timeframe substitution performed.</p>;
  return <div className="local-chart" role="img" aria-label="Imported historical candlestick chart. Drag to pan; mouse wheel to zoom.">
    <TerminalChart dataMode="local" symbol={symbol} timeframe={timeframe} chartType="candles" snapshot={bars} focusRange={focusRange} settings={settings} appearance={appearance} indicators={indicators} timezone="UTC" onVisibleRangeChange={onRange} />
  </div>;
}
