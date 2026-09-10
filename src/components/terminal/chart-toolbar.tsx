"use client";

import { useState } from "react";
import {
  Activity,
  AreaChart,
  BarChart3,
  CandlestickChart,
  Columns2,
  Grid2X2,
  Layers3,
  LineChart,
  Maximize2,
  Rows2,
  SlidersHorizontal,
  Waves,
  Zap,
} from "lucide-react";
import type { ChartType } from "@/lib/chart/contracts";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import type { MultiChartLayout } from "@/stores/multi-chart";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "D" },
];

const PROVIDERS = [
  { id: "gateio", label: "Gate.io" },
  { id: "bybit", label: "Bybit (Free)" },
  { id: "binance", label: "Binance (Free)" },
  { id: "coinbase", label: "Coinbase" },
  { id: "okx", label: "OKX" },
];

type Props = {
  symbol: string;
  productLabel: string;
  timeframe: Timeframe;
  archived: boolean;
  price: string;
  providerLabel: string;
  dataStatus: string;
  statusReason?: string;
  chartType: ChartType;
  indicatorsOpen: boolean;
  layout?: MultiChartLayout;
  onTimeframe: (timeframe: Timeframe) => void;
  onChartType: (chartType: ChartType) => void;
  onIndicators: () => void;
  onContext: () => void;
  onSettings: () => void;
  onReturnLive: () => void;
  onLayoutChange?: (layout: MultiChartLayout) => void;
  onOpenOrderFlow?: () => void;
  onOpenGex?: () => void;
  onProviderChange?: (provider: string) => void;
};

export function ChartToolbar(props: Props) {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const currentLayout = props.layout ?? "1";

  return (
    <div className="zt-chart-toolbar" aria-label="Chart controls">
      <span className="zt-chart-contract">
        {props.symbol} <small>{props.productLabel}</small>
      </span>

      {props.archived && (
        <button className="zt-chart-toolbar-button" onClick={props.onReturnLive}>
          Return to live →
        </button>
      )}

      <span className="zt-toolbar-divider" aria-hidden="true" />

      {/* Timeframes */}
      <div className="zt-chart-timeframes" aria-label="Chart timeframe">
        {TIMEFRAMES.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={props.archived}
            onClick={() => props.onTimeframe(item.value)}
            className={cn(props.timeframe === item.value && "is-active")}
            aria-pressed={props.timeframe === item.value}
          >
            {item.label}
          </button>
        ))}
      </div>

      <span className="zt-toolbar-divider" aria-hidden="true" />

      {/* Analytics Shortcuts */}
      <button
        type="button"
        className={cn("zt-chart-toolbar-button", props.indicatorsOpen && "is-active")}
        onClick={props.onIndicators}
      >
        <Layers3 className="h-3 w-3" />
        Indicators
      </button>

      {props.onOpenOrderFlow && (
        <button
          type="button"
          className="zt-chart-toolbar-button hidden sm:inline-flex"
          onClick={props.onOpenOrderFlow}
          title="Open Order Flow & Tape Workbench"
        >
          <Waves className="h-3 w-3 text-cyan-400" />
          <span>Order Flow</span>
        </button>
      )}

      {props.onOpenGex && (
        <button
          type="button"
          className="zt-chart-toolbar-button hidden sm:inline-flex"
          onClick={props.onOpenGex}
          title="Open Crypto Gamma Exposure (GEX) Workbench"
        >
          <Zap className="h-3 w-3 text-amber-400" />
          <span>Crypto GEX</span>
        </button>
      )}

      <span className="zt-toolbar-divider hidden md:block" aria-hidden="true" />

      {/* Price & Provider Feed */}
      {!props.archived && (
        <>
          <div className="zt-chart-price relative">
            <b>{props.price}</b>
            <button
              type="button"
              onClick={() => setShowProviderMenu((v) => !v)}
              className={cn(
                "hover:underline cursor-pointer flex items-center gap-1",
                props.dataStatus === "LIVE" ? "text-pos" : "text-muted-foreground"
              )}
              title="Click to switch market data provider"
            >
              <span>{props.providerLabel}</span>
              <span className="text-[8px] opacity-70">▼</span>
            </button>

            {showProviderMenu && (
              <div
                className="absolute top-full left-0 mt-1 z-50 bg-[#0d1117] border border-[#30363d] rounded shadow-xl py-1 min-w-[130px]"
                onMouseLeave={() => setShowProviderMenu(false)}
              >
                <div className="px-2 py-0.5 text-[9px] text-[#8b949e] border-b border-[#21262d] uppercase tracking-wider font-semibold">
                  Free Providers
                </div>
                {PROVIDERS.map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      props.onProviderChange?.(prov.id);
                      setShowProviderMenu(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1 text-xs hover:bg-[#161b22] flex items-center justify-between",
                      props.providerLabel.toLowerCase().includes(prov.id)
                        ? "text-[#38bdf8] font-bold"
                        : "text-[#c9d1d9]"
                    )}
                  >
                    <span>{prov.label}</span>
                    {props.providerLabel.toLowerCase().includes(prov.id) && (
                      <span className="text-[10px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span
            className={cn("zt-chart-feed-indicator", props.dataStatus === "LIVE" && "is-live")}
            title={props.statusReason ?? "Research feed status"}
          >
            <i />
            {props.dataStatus}
          </span>
        </>
      )}

      {/* Right Tool Group */}
      <div className="ml-auto flex items-center gap-1">
        {/* Multi-Chart Grid Switcher */}
        {props.onLayoutChange && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLayoutMenu((v) => !v)}
              className={cn(
                "zt-chart-toolbar-button flex items-center gap-1 px-1.5",
                currentLayout !== "1" && "is-active font-bold text-[#38bdf8]"
              )}
              title="Multi-Chart Layout Grid"
            >
              {currentLayout === "1" && <Maximize2 className="h-3 w-3" />}
              {currentLayout === "2h" && <Columns2 className="h-3 w-3" />}
              {currentLayout === "2v" && <Rows2 className="h-3 w-3" />}
              {currentLayout === "3" && <Grid2X2 className="h-3 w-3" />}
              {currentLayout === "4" && <Grid2X2 className="h-3 w-3" />}
              <span className="text-[9px] uppercase font-mono">{currentLayout}</span>
            </button>

            {showLayoutMenu && (
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-[#0d1117] border border-[#30363d] rounded shadow-xl py-1 min-w-[140px]"
                onMouseLeave={() => setShowLayoutMenu(false)}
              >
                <div className="px-2 py-0.5 text-[9px] text-[#8b949e] border-b border-[#21262d] uppercase tracking-wider font-semibold">
                  Multi-Chart Grid
                </div>
                <button
                  type="button"
                  onClick={() => {
                    props.onLayoutChange?.("1");
                    setShowLayoutMenu(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs hover:bg-[#161b22] flex items-center gap-2",
                    currentLayout === "1" ? "text-[#38bdf8] font-bold" : "text-[#c9d1d9]"
                  )}
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Single (1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onLayoutChange?.("2h");
                    setShowLayoutMenu(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs hover:bg-[#161b22] flex items-center gap-2",
                    currentLayout === "2h" ? "text-[#38bdf8] font-bold" : "text-[#c9d1d9]"
                  )}
                >
                  <Columns2 className="h-3 w-3" />
                  <span>2 Split (Side-by-Side)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onLayoutChange?.("2v");
                    setShowLayoutMenu(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs hover:bg-[#161b22] flex items-center gap-2",
                    currentLayout === "2v" ? "text-[#38bdf8] font-bold" : "text-[#c9d1d9]"
                  )}
                >
                  <Rows2 className="h-3 w-3" />
                  <span>2 Split (Stacked)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onLayoutChange?.("3");
                    setShowLayoutMenu(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs hover:bg-[#161b22] flex items-center gap-2",
                    currentLayout === "3" ? "text-[#38bdf8] font-bold" : "text-[#c9d1d9]"
                  )}
                >
                  <Grid2X2 className="h-3 w-3" />
                  <span>3 Charts (1 Left + 2 Right)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onLayoutChange?.("4");
                    setShowLayoutMenu(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs hover:bg-[#161b22] flex items-center gap-2",
                    currentLayout === "4" ? "text-[#38bdf8] font-bold" : "text-[#c9d1d9]"
                  )}
                >
                  <Grid2X2 className="h-3 w-3" />
                  <span>4 Charts (2x2 Quad)</span>
                </button>
              </div>
            )}
          </div>
        )}

        <ChartTypeButton
          active={props.chartType === "candles"}
          label="Candles"
          onClick={() => props.onChartType("candles")}
        >
          <CandlestickChart className="h-3.5 w-3.5" />
        </ChartTypeButton>
        <ChartTypeButton
          active={props.chartType === "bars"}
          label="Bars"
          onClick={() => props.onChartType("bars")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </ChartTypeButton>
        <ChartTypeButton
          active={props.chartType === "line"}
          label="Line"
          onClick={() => props.onChartType("line")}
        >
          <LineChart className="h-3.5 w-3.5" />
        </ChartTypeButton>
        <ChartTypeButton
          active={props.chartType === "area"}
          label="Area"
          onClick={() => props.onChartType("area")}
        >
          <AreaChart className="h-3.5 w-3.5" />
        </ChartTypeButton>

        <button
          type="button"
          className="zt-chart-toolbar-button is-icon"
          onClick={props.onContext}
          aria-label="Open market context"
          title="Market context"
        >
          <Activity className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="zt-chart-toolbar-button is-icon"
          onClick={props.onSettings}
          aria-label="Open chart settings"
          title="Chart settings"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ChartTypeButton({
  active,
  label,
  children,
  onClick,
}: {
  active: boolean;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("zt-chart-type-button", active && "is-active")}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
