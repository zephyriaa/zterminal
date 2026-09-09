"use client";

import { useMemo, useState } from "react";
import {
  CandlestickChart,
  ChevronLeft,
  FileCode2,
  FolderOpen,
  Layers3,
  ListOrdered,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useLayout, type LeftTabId } from "@/stores/layout";
import { useWorkspace } from "@/stores/workspace";
import { useStrategy } from "@/stores/strategy";
import { listContracts, getContract } from "@/lib/market/contracts";
import { IndicatorsBrowser, type IndicatorToggleId } from "../indicators-browser";
import type { ChartStudy } from "../terminal-chart";
import { cn } from "@/lib/utils";

const STRATEGY_PRESETS = [
  {
    id: "ema_cross",
    filename: "ema_crossover.py",
    name: "Dual EMA Trend Cross",
    description: "Systematic trend-following rule tracking fast & slow exponential moving average crossings.",
    tags: ["Trend", "Multi-Timeframe", "Low-Lag"],
    source: `from zterminal_research import strategy, inputs, ta

@strategy(name="Dual EMA Trend Cross")
def ema_cross(
    ctx,
    fast=inputs.int(9, min=2, max=100),
    slow=inputs.int(21, min=5, max=300),
):
    fast_ema = ta.ema(ctx.close, fast)
    slow_ema = ta.ema(ctx.close, slow)

    # Deterministic signals evaluated at bar close
    if ta.crossover(fast_ema, slow_ema)[ctx.index]:
        ctx.enter_long(quantity=1, reason="fast_cross_slow_up")
    elif ta.crossunder(fast_ema, slow_ema)[ctx.index]:
        ctx.close_position(reason="fast_cross_slow_down")
`,
  },
  {
    id: "vwap_bands",
    filename: "vwap_mean_reversion.py",
    name: "Intraday VWAP Bands",
    description: "Session volume-weighted average price with standard deviation mean reversion bands.",
    tags: ["Mean Reversion", "Order Flow", "Intraday"],
    source: `from zterminal_research import strategy, inputs, ta

@strategy(name="Intraday VWAP Bands")
def vwap_reversion(
    ctx,
    std_mult=inputs.float(2.0, min=1.0, max=4.0),
    stop_ticks=inputs.int(40, min=10, max=200),
):
    vwap = ctx.vwap
    dev = ctx.vwap_std * std_mult

    upper_band = vwap + dev
    lower_band = vwap - dev

    # Long when price dips below lower band and returns
    if ctx.close[ctx.index] < lower_band and not ctx.has_position:
        ctx.enter_long(quantity=1, stop_loss_ticks=stop_ticks, reason="vwap_lower_band_dip")
    elif ctx.close[ctx.index] >= vwap and ctx.has_long_position:
        ctx.close_position(reason="vwap_mean_reached")
`,
  },
  {
    id: "donchian_breakout",
    filename: "donchian_breakout.py",
    name: "Donchian Channel Breakout",
    description: "Classic turtle-style breakout entry at 20-period highest high with ATR-scaled position risk.",
    tags: ["Breakout", "Momentum", "Volatility"],
    source: `from zterminal_research import strategy, inputs, ta

@strategy(name="Donchian Channel Breakout")
def donchian_breakout(
    ctx,
    lookback=inputs.int(20, min=5, max=100),
    exit_lookback=inputs.int(10, min=3, max=50),
):
    highest_high = ta.highest(ctx.high, lookback)
    lowest_low = ta.lowest(ctx.low, exit_lookback)

    if ctx.close[ctx.index] > highest_high[ctx.index - 1] and not ctx.has_position:
        ctx.enter_long(quantity=1, reason="channel_high_break")
    elif ctx.close[ctx.index] < lowest_low[ctx.index - 1] and ctx.has_long_position:
        ctx.close_position(reason="channel_low_exit")
`,
  },
  {
    id: "rsi_reversal",
    filename: "rsi_oversold_reversal.py",
    name: "RSI Dynamic Oversold",
    description: "Relative Strength Index oversold filter with candlestick momentum confirmation.",
    tags: ["Oscillator", "Counter-Trend", "Momentum"],
    source: `from zterminal_research import strategy, inputs, ta

@strategy(name="RSI Dynamic Oversold")
def rsi_reversal(
    ctx,
    period=inputs.int(14, min=5, max=50),
    oversold=inputs.int(30, min=10, max=45),
    exit_level=inputs.int(55, min=45, max=75),
):
    rsi_val = ta.rsi(ctx.close, period)

    if rsi_val[ctx.index] < oversold and not ctx.has_position:
        ctx.enter_long(quantity=1, reason="rsi_oversold")
    elif rsi_val[ctx.index] >= exit_level and ctx.has_long_position:
        ctx.close_position(reason="rsi_target_hit")
`,
  },
];

interface LeftPanelProps {
  layers: Record<IndicatorToggleId, boolean>;
  customStudies: ChartStudy[];
  onToggleLayer: (id: IndicatorToggleId) => void;
  onCreateStudy: (study: ChartStudy) => void;
  onUpdateStudy: (study: ChartStudy) => void;
  onRemoveStudy: (id: string) => void;
}

export function LeftPanel({
  layers,
  customStudies,
  onToggleLayer,
  onCreateStudy,
  onUpdateStudy,
  onRemoveStudy,
}: LeftPanelProps) {
  const { leftTab, setLeftTab, toggleLeftPanel, setBottomTab } = useLayout();
  const { symbol, setSymbol } = useWorkspace();
  const { setSource } = useStrategy();
  const [marketSearch, setMarketSearch] = useState("");
  const contracts = useMemo(() => listContracts(), []);

  const filteredContracts = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.exchange.toLowerCase().includes(q) ||
        c.root.toLowerCase().includes(q)
    );
  }, [contracts, marketSearch]);

  const loadStrategyPreset = (preset: (typeof STRATEGY_PRESETS)[0]) => {
    setSource(preset.source);
    setBottomTab("editor");
  };

  return (
    <div className="flex h-full flex-col bg-panel border-r hairline select-none overflow-hidden">
      {/* Panel Header & Tabs */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b hairline px-2 bg-panel/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <TabButton
            active={leftTab === "watchlist"}
            onClick={() => setLeftTab("watchlist")}
            title="Markets & Watchlist"
          >
            <ListOrdered className="h-3.5 w-3.5" />
            <span>Markets</span>
          </TabButton>
          <TabButton
            active={leftTab === "indicators"}
            onClick={() => setLeftTab("indicators")}
            title="Chart Indicators"
          >
            <Layers3 className="h-3.5 w-3.5" />
            <span>Indicators</span>
          </TabButton>
          <TabButton
            active={leftTab === "files"}
            onClick={() => setLeftTab("files")}
            title="Strategy Files"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Strategies</span>
          </TabButton>
        </div>
        <button
          type="button"
          onClick={toggleLeftPanel}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
          title="Collapse Panel"
          aria-label="Collapse Left Panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        {leftTab === "watchlist" && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b hairline">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  placeholder="Filter contracts (BTC, NQ, ETH)..."
                  className="w-full rounded bg-surface/60 pl-8 pr-2 py-1 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent border hairline"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y hairline divide-border/40">
              <div className="grid grid-cols-[1fr_auto_auto] items-center px-3 py-1 text-[9px] uppercase tracking-wider text-muted-foreground bg-surface/20">
                <span>Contract</span>
                <span className="px-2">Tick</span>
                <span className="text-right">Product</span>
              </div>
              {filteredContracts.map((c) => {
                const isSelected = c.symbol === symbol;
                return (
                  <button
                    key={c.symbol}
                    type="button"
                    onClick={() => setSymbol(c.symbol)}
                    className={cn(
                      "w-full text-left grid grid-cols-[1fr_auto_auto] items-center px-3 py-2 text-[11px] transition-colors",
                      isSelected
                        ? "bg-accent/15 border-l-2 border-accent font-medium text-foreground"
                        : "hover:bg-surface/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-foreground">{c.symbol}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-surface text-muted-foreground">
                          {c.exchange}
                        </span>
                      </div>
                      <div className="truncate text-[9.5px] text-muted-foreground mt-0.5">
                        {c.description}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground px-2">
                      {c.tickSize}
                    </div>
                    <div className="text-[9px] text-right uppercase tracking-wider text-muted-foreground font-mono">
                      {c.product}
                    </div>
                  </button>
                );
              })}
              {filteredContracts.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No contracts matched &ldquo;{marketSearch}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {leftTab === "indicators" && (
          <div className="p-1 h-full">
            <IndicatorsBrowser
              layers={layers}
              customStudies={customStudies}
              onToggleLayer={onToggleLayer}
              onCreate={onCreateStudy}
              onUpdate={onUpdateStudy}
              onRemove={onRemoveStudy}
            />
          </div>
        )}

        {leftTab === "files" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b hairline">
              <div>
                <h4 className="text-[11px] font-semibold tracking-wide uppercase text-foreground">
                  Strategy Library
                </h4>
                <p className="text-[9.5px] text-muted-foreground">
                  Deterministic Python strategies ready for WASM backtesting
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {STRATEGY_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="rounded border hairline bg-surface/30 p-2.5 hover:border-accent/40 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileCode2 className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="font-mono text-[11px] font-medium text-foreground truncate">
                        {preset.filename}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadStrategyPreset(preset)}
                      className="text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent hover:bg-accent hover:text-accent-foreground font-medium transition-colors"
                      title="Load into Editor"
                    >
                      Load
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                    {preset.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {preset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[8.5px] px-1.5 py-0.5 rounded bg-surface text-muted-foreground border hairline"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors",
        active
          ? "bg-surface text-foreground font-medium shadow-xs"
          : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
      )}
    >
      {children}
    </button>
  );
}
