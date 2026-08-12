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
import { TerminalChart, type ChartType, type ChartIndicators } from "../terminal/terminal-chart";
import { useWorkspace } from "@/stores/workspace";
import { Panel, Pill, SimulatedTag } from "../terminal/primitives";
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

  // live quote for the header
  const { quote, lastTrade, trades } = useMarketStream(symbol, { trades: 40, depth: false });

  const dayChange = useMemo(() => {
    if (!lastTrade) return null;
    // approximate vs basePrice (SIMULATED)
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
        <ToolBtn label="Settings"><Settings2 className="w-3.5 h-3.5" /></ToolBtn>

        <div className="ml-auto flex items-center gap-1">
          <SimulatedTag />
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
              <span className="text-[10px] tnum text-muted-foreground">SIMULATED</span>
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
                    <tr><td className="px-2 py-3 text-muted-foreground text-[10px]">Awaiting simulated feed…</td></tr>
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
