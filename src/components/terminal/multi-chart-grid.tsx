"use client";

import React, { useMemo } from "react";
import {
  Columns2,
  Grid2X2,
  Maximize2,
  Minimize2,
  Rows2,
} from "lucide-react";
import {
  useMultiChart,
  type MultiChartLayout,
  type ChartPaneConfig,
} from "@/stores/multi-chart";
import {
  TerminalChart,
  type ChartIndicators,
  type ChartSettings,
  type TradeMarker,
} from "./terminal-chart";
import { DrawingToolbar } from "./drawing-toolbar";
import { DrawingInspector } from "./drawing-inspector";
import type { Bar, Timeframe } from "@/lib/market/types";
import type { DrawingAnchor, DrawingObject, DrawingType } from "@/lib/chart/contracts";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";
import type { IndicatorInstance } from "@/lib/indicator-library";
import type { IndicatorEvaluationResult } from "@/lib/local-research/contracts";
import type { ChartTimezone } from "@/stores/workspace";
import { formatSymbol } from "@/lib/market/contracts";
import { cn } from "@/lib/utils";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
];

const POPULAR_TICKERS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "NEARUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "SPY",
  "QQQ",
  "NVDA",
  "AAPL",
  "GLD",
];

interface MultiChartGridProps {
  primarySymbol: string;
  primaryTimeframe: Timeframe;
  indicators: ChartIndicators;
  indicatorInstances: IndicatorInstance[];
  pythonEvaluations: Record<string, IndicatorEvaluationResult>;
  settings: ChartSettings;
  volumePaneHeight: number;
  replayEnabled: boolean;
  timezone: ChartTimezone;
  markPrice?: number;
  crosshairBar: Bar | null;
  latestBar: Bar | null;
  onCrosshair: (bar: Bar | null) => void;
  onLatestBar: (bar: Bar | null) => void;
  drawings: DrawingObject[];
  selectedDrawingId: string | null;
  drawingTool: DrawingTool;
  magnetMode: MagnetMode;
  onDrawingTool: (tool: DrawingTool) => void;
  onMagnetMode: (magnet: MagnetMode) => void;
  onSelectDrawing: (id: string | null) => void;
  onCreateDrawing?: (type: DrawingType, anchors: DrawingAnchor[]) => string | null;
  onUpdateDrawing?: (id: string, patch: Partial<DrawingObject>) => void;
  onDeleteDrawing?: (id: string) => void;
  onDuplicateDrawing?: (id: string) => void;
  onClearDrawings?: () => void;
  selectedDrawing: DrawingObject | null;
  markers?: TradeMarker[];
  focusRange?: { from: number; to: number } | null;
  archivedBars?: Bar[];
}

export function MultiChartGrid(props: MultiChartGridProps) {
  const {
    layout,
    setLayout,
    activePaneIndex,
    setActivePaneIndex,
    panes,
    setPaneSymbol,
    setPaneTimeframe,
  } = useMultiChart();

  // Secondary indicators (clean view without heavy python studies)
  const secondaryIndicators: ChartIndicators = useMemo(
    () => ({
      vwap: false,
      ema20: false,
      ema50: false,
      volume: true,
      profile: false,
      customStudies: [],
    }),
    []
  );

  const selectedDrawing = props.selectedDrawing;

  // Single chart layout (standard mode)
  if (layout === "1") {
    return (
      <div className="zt-chart-stage h-full w-full relative">
        <DrawingToolbar
          tool={props.drawingTool}
          magnet={props.magnetMode}
          onTool={props.onDrawingTool}
          onMagnet={props.onMagnetMode}
          onClear={props.onClearDrawings}
        />
        <div className="zt-chart-readout">
          <span>
            O <b>{(props.crosshairBar ?? props.latestBar)?.o?.toLocaleString() ?? "—"}</b>
          </span>
          <span>
            H <b>{(props.crosshairBar ?? props.latestBar)?.h?.toLocaleString() ?? "—"}</b>
          </span>
          <span>
            L <b>{(props.crosshairBar ?? props.latestBar)?.l?.toLocaleString() ?? "—"}</b>
          </span>
          <span>
            C <b>{(props.crosshairBar ?? props.latestBar)?.c?.toLocaleString() ?? "—"}</b>
          </span>
          <span>
            V <b>{(props.crosshairBar ?? props.latestBar)?.v?.toLocaleString() ?? "—"}</b>
          </span>
        </div>
        <div className="zt-chart-overlays">
          {props.indicatorInstances
            .filter((item) => item.enabled)
            .slice(0, 6)
            .map((item) => (
              <span key={item.id} style={{ color: item.outputs[0]?.color }}>
                {item.name}
              </span>
            ))}
        </div>
        <TerminalChart
          symbol={props.primarySymbol}
          timeframe={props.primaryTimeframe}
          snapshot={props.archivedBars}
          markers={props.markers}
          focusRange={props.focusRange}
          chartType="candles"
          indicators={props.indicators}
          indicatorInstances={props.indicatorInstances}
          pythonEvaluations={props.pythonEvaluations}
          settings={props.settings}
          volumePaneHeight={props.volumePaneHeight}
          replayEnabled={props.replayEnabled}
          timezone={props.timezone}
          markPrice={props.markPrice}
          onCrosshair={props.onCrosshair}
          onLatestBar={props.onLatestBar}
          drawings={props.drawings}
          selectedDrawingId={props.selectedDrawingId}
          drawingTool={props.drawingTool}
          magnetMode={props.magnetMode}
          onDrawingTool={props.onDrawingTool}
          onSelectDrawing={props.onSelectDrawing}
          onCreateDrawing={props.onCreateDrawing}
          onUpdateDrawing={props.onUpdateDrawing}
          onDeleteDrawing={props.onDeleteDrawing}
          onDuplicateDrawing={props.onDuplicateDrawing}
        />
        {selectedDrawing && (
          <DrawingInspector
            drawing={selectedDrawing}
            onChange={(patch) => props.onUpdateDrawing?.(selectedDrawing.id, patch)}
            onDuplicate={() => props.onDuplicateDrawing?.(selectedDrawing.id)}
            onDelete={() => props.onDeleteDrawing?.(selectedDrawing.id)}
            onClose={() => props.onSelectDrawing(null)}
          />
        )}
      </div>
    );
  }

  // Helper to render individual pane header
  const renderPaneHeader = (index: number, pane: ChartPaneConfig) => {
    const isPrimary = index === 0;
    const currentSymbol = isPrimary ? props.primarySymbol : pane.symbol;
    const currentTimeframe = isPrimary ? props.primaryTimeframe : pane.timeframe;

    return (
      <div
        className={cn(
          "flex items-center justify-between px-2 py-1 bg-[#0d1117] border-b border-[#21262d] text-[11px] font-mono select-none z-10",
          activePaneIndex === index && "bg-[#161b22] border-[#38bdf8]/40"
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
          {/* Symbol selector */}
          <select
            value={currentSymbol}
            onChange={(e) => setPaneSymbol(index, e.target.value)}
            className="bg-[#1f2937] text-white rounded px-1.5 py-0.5 text-[10px] font-bold border border-[#374151] focus:outline-none focus:border-[#38bdf8]"
          >
            {POPULAR_TICKERS.map((sym) => (
              <option key={sym} value={sym}>
                {formatSymbol(sym)}
              </option>
            ))}
          </select>

          {/* Timeframe pills */}
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.slice(1, 6).map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setPaneTimeframe(index, tf.value)}
                className={cn(
                  "px-1 py-0.2 rounded text-[9.5px]",
                  currentTimeframe === tf.value
                    ? "bg-[#38bdf8]/20 text-[#38bdf8] font-bold"
                    : "text-[#8b949e] hover:text-white"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLayout("1")}
            className="p-1 text-[#8b949e] hover:text-white rounded hover:bg-[#21262d]"
            title="Maximize single chart"
          >
            <Maximize2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    );
  };

  // Helper to render individual pane body
  const renderPaneBody = (index: number) => {
    const isPrimary = index === 0;
    const pane = panes[index] || panes[0];
    const paneSymbol = isPrimary ? props.primarySymbol : pane.symbol;
    const paneTimeframe = isPrimary ? props.primaryTimeframe : pane.timeframe;

    return (
      <div
        key={pane.id}
        onClick={() => setActivePaneIndex(index)}
        className={cn(
          "flex flex-col h-full w-full overflow-hidden relative border border-[#21262d] transition-colors",
          activePaneIndex === index && "ring-1 ring-[#38bdf8]/60 border-[#38bdf8]/40"
        )}
      >
        {renderPaneHeader(index, pane)}
        <div className="flex-1 min-h-0 relative">
          {isPrimary ? (
            <div className="h-full w-full relative">
              <TerminalChart
                symbol={props.primarySymbol}
                timeframe={props.primaryTimeframe}
                snapshot={props.archivedBars}
                markers={props.markers}
                focusRange={props.focusRange}
                chartType="candles"
                indicators={props.indicators}
                indicatorInstances={props.indicatorInstances}
                pythonEvaluations={props.pythonEvaluations}
                settings={props.settings}
                volumePaneHeight={props.volumePaneHeight}
                replayEnabled={props.replayEnabled}
                timezone={props.timezone}
                markPrice={props.markPrice}
                onCrosshair={props.onCrosshair}
                onLatestBar={props.onLatestBar}
                drawings={props.drawings}
                selectedDrawingId={props.selectedDrawingId}
                drawingTool={props.drawingTool}
                magnetMode={props.magnetMode}
                onDrawingTool={props.onDrawingTool}
                onSelectDrawing={props.onSelectDrawing}
                onCreateDrawing={props.onCreateDrawing}
                onUpdateDrawing={props.onUpdateDrawing}
                onDeleteDrawing={props.onDeleteDrawing}
                onDuplicateDrawing={props.onDuplicateDrawing}
              />
            </div>
          ) : (
            <TerminalChart
              symbol={paneSymbol}
              timeframe={paneTimeframe}
              chartType={pane.chartType || "candles"}
              indicators={secondaryIndicators}
              settings={props.settings}
              volumePaneHeight={0.18}
              timezone={props.timezone}
            />
          )}
        </div>
      </div>
    );
  };

  // Render multi-pane layouts
  return (
    <div className="h-full w-full overflow-hidden bg-[#07090d] p-1">
      {layout === "2h" && (
        <div className="grid grid-cols-2 h-full w-full gap-1">
          {renderPaneBody(0)}
          {renderPaneBody(1)}
        </div>
      )}

      {layout === "2v" && (
        <div className="grid grid-rows-2 h-full w-full gap-1">
          {renderPaneBody(0)}
          {renderPaneBody(1)}
        </div>
      )}

      {layout === "3" && (
        <div className="grid grid-cols-12 h-full w-full gap-1">
          <div className="col-span-7 h-full">{renderPaneBody(0)}</div>
          <div className="col-span-5 grid grid-rows-2 h-full gap-1">
            {renderPaneBody(1)}
            {renderPaneBody(2)}
          </div>
        </div>
      )}

      {layout === "4" && (
        <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-1">
          {renderPaneBody(0)}
          {renderPaneBody(1)}
          {renderPaneBody(2)}
          {renderPaneBody(3)}
        </div>
      )}
    </div>
  );
}
