"use client";

import { Activity, AreaChart, BarChart3, CandlestickChart, Layers3, LineChart, SlidersHorizontal } from "lucide-react";
import type { ChartType } from "@/lib/chart/contracts";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" }, { value: "5m", label: "5m" }, { value: "15m", label: "15m" },
  { value: "30m", label: "30m" }, { value: "1h", label: "1h" }, { value: "4h", label: "4h" }, { value: "1d", label: "D" },
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
  onTimeframe: (timeframe: Timeframe) => void;
  onChartType: (chartType: ChartType) => void;
  onIndicators: () => void;
  onContext: () => void;
  onSettings: () => void;
  onReturnLive: () => void;
};

export function ChartToolbar(props: Props) {
  return <div className="zt-chart-toolbar" aria-label="Chart controls">
    <span className="zt-chart-contract">{props.symbol} <small>{props.productLabel}</small></span>
    {props.archived && <button className="zt-chart-toolbar-button" onClick={props.onReturnLive}>Return to live →</button>}
    <span className="zt-toolbar-divider" aria-hidden="true" />
    <div className="zt-chart-timeframes" aria-label="Chart timeframe">{TIMEFRAMES.map(item => <button key={item.value} type="button" disabled={props.archived} onClick={() => props.onTimeframe(item.value)} className={cn(props.timeframe === item.value && "is-active")} aria-pressed={props.timeframe === item.value}>{item.label}</button>)}</div>
    <span className="zt-toolbar-divider" aria-hidden="true" />
    <button type="button" className="zt-chart-toolbar-button hidden sm:inline-flex" onClick={props.onContext}><Activity />Market</button>
    <button type="button" className={cn("zt-chart-toolbar-button", props.indicatorsOpen && "is-active")} onClick={props.onIndicators}><Layers3 />Indicators</button>
    <span className="zt-toolbar-divider hidden md:block" aria-hidden="true" />
    {!props.archived && <><div className="zt-chart-price"><b>{props.price}</b><span className={props.dataStatus === "LIVE" ? "text-pos" : "text-muted-foreground"}>{props.providerLabel} · PERPETUAL</span></div><span className={cn("zt-chart-feed-indicator", props.dataStatus === "LIVE" && "is-live")} title={props.statusReason ?? "Research feed status"}><i />{props.dataStatus}</span></>}
    <div className="ml-auto flex items-center gap-1">
      <ChartTypeButton active={props.chartType === "candles"} label="Candles" onClick={() => props.onChartType("candles")}><CandlestickChart /></ChartTypeButton>
      <ChartTypeButton active={props.chartType === "bars"} label="Bars" onClick={() => props.onChartType("bars")}><BarChart3 /></ChartTypeButton>
      <ChartTypeButton active={props.chartType === "line"} label="Line" onClick={() => props.onChartType("line")}><LineChart /></ChartTypeButton>
      <ChartTypeButton active={props.chartType === "area"} label="Area" onClick={() => props.onChartType("area")}><AreaChart /></ChartTypeButton>
      <button type="button" className="zt-chart-toolbar-button is-icon" onClick={props.onContext} aria-label="Open market context" title="Market context"><Activity /></button>
      <button type="button" className="zt-chart-toolbar-button is-icon" onClick={props.onSettings} aria-label="Open chart settings" title="Chart settings"><SlidersHorizontal /></button>
    </div>
  </div>;
}

function ChartTypeButton({ active, label, children, onClick }: { active: boolean; label: string; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("zt-chart-type-button", active && "is-active")} aria-label={label} title={label}>{children}</button>;
}
