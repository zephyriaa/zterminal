"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CandlestickChart,
  LineChart as LineIcon,
  BarChart3,
  AreaChart,
  Maximize2,
  Minimize2,
  Play,
  Ruler,
  Settings2,
  TrendingUp,
} from "lucide-react";
import {
  DEFAULT_CHART_SETTINGS,
  TerminalChart,
  type ChartSettings,
  type ChartType,
  type ChartIndicators,
} from "../terminal/terminal-chart";
import { useWorkspace } from "@/stores/workspace";
import { Panel, Pill } from "../terminal/primitives";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

function fmtPrice(p: number, tick: number) {
  const decimals = tick >= 1 ? 2 : Math.max(2, Math.round(-Math.log10(tick)));
  return p.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function ChartView() {
  const { symbol, setSymbol, timeframe, setTimeframe, setCommandOpen } = useWorkspace();
  const contract = getContract(symbol);

  const [chartType, setChartType] = useState<ChartType>("candles");
  const [indicators, setIndicators] = useState<ChartIndicators>({
    vwap: true,
    ema20: true,
    ema50: false,
    volume: true,
  });
  const [rightOpen, setRightOpen] = useState(true);
  const [replay, setReplay] = useState(false);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_CHART_SETTINGS;
    try {
      const saved = window.localStorage.getItem("zterminal.chart-settings.v1");
      return saved ? { ...DEFAULT_CHART_SETTINGS, ...JSON.parse(saved) } : DEFAULT_CHART_SETTINGS;
    } catch {
      return DEFAULT_CHART_SETTINGS;
    }
  });

  useEffect(() => {
    window.localStorage.setItem("zterminal.chart-settings.v1", JSON.stringify(chartSettings));
  }, [chartSettings]);

  const updateChartSettings = (patch: Partial<ChartSettings>) => {
    setChartSettings((current) => ({ ...current, ...patch }));
  };

  // live quote for the header
  const { quote, lastTrade, trades, dataStatus, provider } = useMarketStream(symbol, { trades: 40, depth: false });

  const dayChange = useMemo(() => {
    if (!lastTrade) return null;
    // Approximate change versus the configured reference price.
    const ch = lastTrade.price - contract.basePrice;
    return { ch, pct: (ch / contract.basePrice) * 100 };
  }, [lastTrade, contract.basePrice]);

  const toggleFull = () => setFull((f) => !f);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar — compact, single row */}
      <div className="h-10 shrink-0 border-b hairline bg-panel flex items-center gap-1.5 px-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setCommandOpen(true)}
          className="h-7 px-2.5 rounded-[5px] border hairline bg-surface hover:bg-hover flex items-center gap-2 transition-colors"
        >
          <span className="font-mono-num text-[12.5px] font-semibold">{symbol}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{contract.exchange}</span>
        </button>

        {/* live price */}
        <div className="hidden sm:flex items-baseline gap-2 px-2">
          <span className={cn("text-[15px] tnum font-semibold", dayChange && (dayChange.ch >= 0 ? "text-pos" : "text-neg"))}>
            {lastTrade ? fmtPrice(lastTrade.price, contract.tickSize) : "—"}
          </span>
          {dayChange && (
            <span className={cn("text-[11px] tnum", dayChange.ch >= 0 ? "text-pos" : "text-neg")}>
              {dayChange.ch >= 0 ? "+" : ""}
              {fmtPrice(dayChange.ch, contract.tickSize)} ({dayChange.pct >= 0 ? "+" : ""}
              {dayChange.pct.toFixed(2)}%)
            </span>
          )}
        </div>

        <div className="w-px h-5 bg-border/60 mx-1" />

        {/* Timeframes */}
        <div className="flex items-center gap-0.5 bg-surface border hairline rounded-[5px] p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "h-6 px-2 rounded-[3px] text-[11px] tnum font-medium transition-colors",
                timeframe === tf ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart type */}
        <div className="flex items-center gap-0.5 bg-surface border hairline rounded-[5px] p-0.5">
          <Seg active={chartType === "candles"} onClick={() => setChartType("candles")} label="Candles"><CandlestickChart className="w-3.5 h-3.5" /></Seg>
          <Seg active={chartType === "bars"} onClick={() => setChartType("bars")} label="Bars"><BarChart3 className="w-3.5 h-3.5" /></Seg>
          <Seg active={chartType === "line"} onClick={() => setChartType("line")} label="Line"><LineIcon className="w-3.5 h-3.5" /></Seg>
          <Seg active={chartType === "area"} onClick={() => setChartType("area")} label="Area"><AreaChart className="w-3.5 h-3.5" /></Seg>
        </div>

        {/* Indicators */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-7 px-2 rounded-[5px] border hairline bg-surface hover:bg-hover text-[11px] text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Indicators</span>
              <span className="text-[9px] text-mdata">
                {[indicators.vwap && "VWAP", indicators.ema20 && "EMA20", indicators.ema50 && "EMA50", indicators.volume && "VOL"].filter(Boolean).length}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-1.5 bg-popover border hairline">
            <IndToggle label="Session VWAP" tone="warn" on={indicators.vwap} set={(v) => setIndicators((s) => ({ ...s, vwap: v }))} />
            <IndToggle label="EMA 20" tone="mdata" on={indicators.ema20} set={(v) => setIndicators((s) => ({ ...s, ema20: v }))} />
            <IndToggle label="EMA 50" tone="research" on={indicators.ema50} set={(v) => setIndicators((s) => ({ ...s, ema50: v }))} />
            <IndToggle label="Volume" tone="muted" on={indicators.volume} set={(v) => setIndicators((s) => ({ ...s, volume: v }))} />
          </PopoverContent>
        </Popover>

        <ToolBtn label="Draw"><Ruler className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn label="Replay" active={replay} onClick={() => setReplay((r) => !r)}><Play className="w-3.5 h-3.5" /></ToolBtn>
        <ChartSettingsPopover settings={chartSettings} update={updateChartSettings} reset={() => setChartSettings(DEFAULT_CHART_SETTINGS)} />

        <div className="ml-auto flex items-center gap-1">
          <Pill tone={dataStatus === "LIVE" ? "pos" : dataStatus === "STALE" || dataStatus === "DEGRADED" ? "warn" : "default"}>
            {(provider ?? "gateio").toUpperCase()} · {dataStatus}
          </Pill>
          <ToolBtn label={full ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFull}>
            {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </ToolBtn>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 relative">
          <TerminalChart
            symbol={symbol}
            timeframe={timeframe as Timeframe}
            chartType={chartType}
            indicators={indicators}
            settings={chartSettings}
            replayIndex={replay ? replayIdx : null}
          />
          {replay && (
            <div className="absolute left-2 bottom-2 right-2 h-9 rounded-[5px] border hairline bg-panel/95 backdrop-blur px-3 flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Replay</span>
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={100}
                onChange={(e) => setReplayIdx(Math.round((Number(e.target.value) / 100) * 500))}
                className="flex-1 accent-[var(--mdata)] h-1"
              />
              <span className="text-[10px] tnum text-muted-foreground">Historical replay</span>
            </div>
          )}
        </div>

        {/* Right context column */}
        {!full && rightOpen && (
          <div className="w-[230px] shrink-0 border-l hairline bg-panel flex flex-col">
            <div className="h-8 border-b hairline flex items-center px-2.5 gap-2">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Market</span>
              <Pill tone="mdata" className="ml-auto">{contract.exchange}</Pill>
            </div>
            <div className="p-2.5 border-b hairline space-y-1">
              <Row label="Bid" value={quote ? fmtPrice(quote.bid, contract.tickSize) : "—"} tone="neg" />
              <Row label="Ask" value={quote ? fmtPrice(quote.ask, contract.tickSize) : "—"} tone="pos" />
              <Row label="Spread" value={quote ? fmtPrice(quote.ask - quote.bid, contract.tickSize) : "—"} />
              <Row label="Bid sz" value={quote?.bidSize ?? "—"} />
              <Row label="Ask sz" value={quote?.askSize ?? "—"} />
            </div>
            <div className="p-2.5 border-b hairline space-y-1">
              <Row label="Tick" value={`${contract.tickSize}`} />
              <Row label="Tick val" value={`$${contract.tickValue}`} />
              <Row label="Multiplier" value={`${contract.multiplier}x`} />
              <Row label="Product" value={contract.product} />
              <Row label="Depth" value={contract.supportsDepth ? "Yes" : "No"} tone={contract.supportsDepth ? "pos" : "muted"} />
            </div>

            <div className="h-8 border-b hairline flex items-center px-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Time & Sales</span>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin">
              <table className="w-full text-[10.5px] tnum">
                <tbody>
                  {trades.slice().reverse().map((t) => (
                    <tr key={`${t.timestamp}-${t.sequence}`} className="border-b hairline/50">
                      <td className="px-2 py-1 text-muted-foreground">
                        {new Date(t.timestamp).toISOString().slice(11, 19)}
                      </td>
                      <td className={cn("px-2 py-1", t.side === "buy" ? "text-pos" : "text-neg")}>
                        {fmtPrice(t.price, contract.tickSize)}
                      </td>
                      <td className="px-2 py-1 text-right text-muted-foreground">{t.quantity}</td>
                    </tr>
                  ))}
                  {!trades.length && (
                    <tr><td className="px-2 py-3 text-muted-foreground text-[10px]">Awaiting {provider ?? "provider"} market data…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartSettingsPopover({
  settings,
  update,
  reset,
}: {
  settings: ChartSettings;
  update: (patch: Partial<ChartSettings>) => void;
  reset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolBtn label="Chart settings"><Settings2 className="w-3.5 h-3.5" /></ToolBtn>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 bg-popover p-3 text-popover-foreground border hairline">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold">Chart settings</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Saved for this browser</p>
          </div>
          <button onClick={reset} className="text-[10px] text-mdata hover:underline">Reset defaults</button>
        </div>

        <RangeSetting
          label="Future space"
          value={settings.futureBars}
          min={0}
          max={80}
          suffix=" bars"
          onChange={(futureBars) => update({ futureBars })}
        />
        <RangeSetting
          label="Grid intensity"
          value={Math.round(settings.gridOpacity * 100)}
          min={0}
          max={18}
          suffix="%"
          onChange={(value) => update({ gridOpacity: value / 100 })}
        />

        <div className="grid grid-cols-3 gap-2">
          <ColorSetting label="Up" value={settings.candleUpColor} onChange={(candleUpColor) => update({ candleUpColor })} />
          <ColorSetting label="Down" value={settings.candleDownColor} onChange={(candleDownColor) => update({ candleDownColor })} />
          <ColorSetting label="Canvas" value={settings.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
        </div>

        <div className="space-y-1 rounded-[5px] border hairline bg-surface/50 p-1.5">
          <SettingsToggle label="Grid" checked={settings.showGrid} onChange={(showGrid) => update({ showGrid })} />
          <SettingsToggle label="Last price line" checked={settings.showPriceLine} onChange={(showPriceLine) => update({ showPriceLine })} />
          <SettingsToggle label="Crosshair" checked={settings.showCrosshair} onChange={(showCrosshair) => update({ showCrosshair })} />
        </div>
        <p className="text-[10px] leading-4 text-muted-foreground">Drag the plot to pan time. Drag or scroll the right price scale to stretch or compress candle height. Double-click a scale to reset it.</p>
      </PopoverContent>
    </Popover>
  );
}

function RangeSetting({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-[11px] text-muted-foreground"><span>{label}</span><span className="tnum text-foreground">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full accent-[var(--mdata)]" />
    </label>
  );
}

function ColorSetting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span className="flex h-7 items-center gap-1.5 rounded-[4px] border hairline bg-surface px-1.5">
        <input aria-label={`${label} color`} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" />
        <span className="font-mono text-[9px] uppercase text-foreground">{value.slice(1)}</span>
      </span>
    </label>
  );
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-1 py-0.5">
      <span className="text-[11px]">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="h-4 w-7" />
    </div>
  );
}

function Seg({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "h-6 w-6 grid place-items-center rounded-[3px] transition-colors",
        active ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ToolBtn({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "h-7 w-7 grid place-items-center rounded-[5px] border hairline bg-surface text-muted-foreground hover:text-foreground hover:bg-hover transition-colors",
        active && "border-mdata/40 bg-mdata/10 text-mdata"
      )}
    >
      {children}
    </button>
  );
}

function IndToggle({ label, tone, on, set }: { label: string; tone: "warn" | "mdata" | "research" | "muted"; on: boolean; set: (v: boolean) => void }) {
  const toneCls = tone === "warn" ? "bg-warn" : tone === "mdata" ? "bg-mdata" : tone === "research" ? "bg-research" : "bg-muted-foreground";
  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded-[3px] hover:bg-hover/60">
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full", toneCls)} />
        <span className="text-[12px]">{label}</span>
      </div>
      <Switch checked={on} onCheckedChange={set} className="h-4 w-7" />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "pos" | "neg" | "muted" }) {
  const cls = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-[12px] tnum font-medium", cls)}>{value}</span>
    </div>
  );
}

export { Button };
