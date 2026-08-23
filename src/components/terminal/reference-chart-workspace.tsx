"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CandlestickChart,
  ChartNoAxesCombined,
  Layers3,
  LineChart,
  Play,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { DesktopWindow } from "./desktop-window";
import {
  DEFAULT_CHART_SETTINGS,
  TerminalChart,
  type ChartIndicators,
  type ChartSettings,
  type ChartStudy,
  type ChartType,
} from "./terminal-chart";
import { IndicatorsBrowser, type IndicatorToggleId } from "./indicators-browser";
import { useWorkspace } from "@/stores/workspace";
import { StrategyView } from "@/components/views/strategy-view";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Timeframe } from "@/lib/market/types";
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

function formatSymbol(symbol: string) {
  return symbol.endsWith("USDT") ? `${symbol.slice(0, -4)} / USDT` : symbol.replace("_", " / ");
}

function formatPrice(value: number | undefined | null, tick: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.max(2, Math.min(8, Math.round(-Math.log10(tick))));
  return value.toLocaleString("en-US", { minimumFractionDigits: tick >= 1 ? 2 : digits, maximumFractionDigits: tick >= 1 ? 2 : digits });
}

export function ReferenceChartWorkspace() {
  const { symbol, timeframe, setTimeframe } = useWorkspace();
  const contract = getContract(symbol);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [replay, setReplay] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [layers, setLayers] = useState<Record<IndicatorToggleId, boolean>>({ vwap: true, ema20: true, ema50: false, volume: true });
  const [customStudies, setCustomStudies] = useState<ChartStudy[]>([]);
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
  const { quote, trades, lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(symbol, { trades: 600, depth: false });
  const indicators: ChartIndicators = {
    vwap: layers.vwap,
    ema20: layers.ema20,
    ema50: layers.ema50,
    volume: layers.volume,
    customStudies,
  };
  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;

  const toggleBuiltIn = (id: IndicatorToggleId) => {
    setLayers((current) => ({ ...current, [id]: !current[id] }));
  };

  useEffect(() => {
    const openIndicators = () => setIndicatorsOpen(true);
    const openStrategy = () => setStrategyOpen(true);
    const openSettings = () => setSettingsOpen(true);
    const openContext = () => setContextOpen(true);
    window.addEventListener("zterminal:open-indicators", openIndicators);
    window.addEventListener("zterminal:open-strategy", openStrategy);
    window.addEventListener("zterminal:open-settings", openSettings);
    window.addEventListener("zterminal:open-context", openContext);
    return () => {
      window.removeEventListener("zterminal:open-indicators", openIndicators);
      window.removeEventListener("zterminal:open-strategy", openStrategy);
      window.removeEventListener("zterminal:open-settings", openSettings);
      window.removeEventListener("zterminal:open-context", openContext);
    };
  }, []);

  return (
    <div className="zt-reference-canvas" aria-label="Floating research workstation">
      <DesktopWindow
        id="chart"
        title={`${formatSymbol(symbol)} · ${timeframe.toUpperCase()}`}
        subtitle="VERIFIED MARKET CANVAS"
        initialBounds={{ x: 12, y: 10, width: 940, height: 610 }}
        minWidth={560}
        minHeight={360}
        icon={<CandlestickChart className="h-3.5 w-3.5" />}
        className="zt-reference-chart-window"
        headerActions={
          <>
            <button type="button" className={cn("zt-window-action", replay && "is-active")} onClick={() => setReplay((value) => !value)} aria-label="Toggle replay" title="Replay"><Play /></button>
            <button type="button" className="zt-window-action" onClick={() => window.dispatchEvent(new Event("zterminal:refresh-chart"))} aria-label="Refresh chart viewport" title="Refresh chart"><RefreshCw /></button>
          </>
        }
      >
        <div className="zt-chart-content">
          <div className="zt-chart-toolbar" aria-label="Chart controls">
            <span className="zt-chart-contract">{formatSymbol(symbol)} <small>PERPETUAL</small></span>
            <span className="zt-toolbar-divider" aria-hidden="true" />
            <div className="zt-chart-timeframes" aria-label="Chart timeframe">
              {TIMEFRAMES.map((item) => <button key={item.value} type="button" onClick={() => setTimeframe(item.value)} className={cn(timeframe === item.value && "is-active")} aria-pressed={timeframe === item.value}>{item.label}</button>)}
            </div>
            <span className="zt-toolbar-divider" aria-hidden="true" />
            <button type="button" className="zt-chart-toolbar-button hidden sm:inline-flex" onClick={() => setContextOpen(true)}><Activity />Market</button>
            <button type="button" className={cn("zt-chart-toolbar-button", indicatorsOpen && "is-active")} onClick={() => setIndicatorsOpen(true)}><Layers3 />Indicators</button>
            <span className="zt-toolbar-divider hidden md:block" aria-hidden="true" />
            <div className="zt-chart-price"><b>{formatPrice(livePrice, contract.tickSize)}</b><span className={dataStatus === "LIVE" ? "text-pos" : "text-muted-foreground"}>{provider?.toUpperCase() ?? "BINANCE"} · {dataStatus}</span></div>
            <span className={cn("zt-chart-feed-indicator", dataStatus === "LIVE" && "is-live")} title={reason ?? health?.reason ?? "Research feed status"}><i />{dataStatus === "LIVE" ? "LIVE" : "RESEARCH"}</span>
            <div className="ml-auto flex items-center gap-1">
              <ChartTypeButton active={chartType === "candles"} label="Candles" onClick={() => setChartType("candles")}><CandlestickChart /></ChartTypeButton>
              <ChartTypeButton active={chartType === "bars"} label="Bars" onClick={() => setChartType("bars")}><BarChart3 /></ChartTypeButton>
              <ChartTypeButton active={chartType === "line"} label="Line" onClick={() => setChartType("line")}><LineChart /></ChartTypeButton>
              <button type="button" className="zt-chart-toolbar-button is-icon" onClick={() => setContextOpen(true)} aria-label="Open market context" title="Market context"><Activity /></button>
              <button type="button" className="zt-chart-toolbar-button is-icon" onClick={() => setSettingsOpen(true)} aria-label="Open chart preferences" title="Chart preferences"><SlidersHorizontal /></button>
            </div>
          </div>
          <div className="zt-chart-stage">
            <div className="zt-chart-readout"><span>O <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>H <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>L <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>C <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>V <b>—</b></span></div>
            <div className="zt-chart-overlays"><span className={layers.vwap ? "text-warn" : "hidden"}>VWAP</span><span className={layers.ema20 ? "text-mdata" : "hidden"}>EMA 20</span><span className={layers.volume ? "text-muted-foreground" : "hidden"}>Volume</span></div>
            <TerminalChart symbol={symbol} timeframe={timeframe as Timeframe} chartType={chartType} indicators={indicators} settings={settings} replayIndex={replay ? Math.max(0, trades.length - 120) : null} markPrice={derivatives?.markPrice} />
          </div>
        </div>
      </DesktopWindow>

      {indicatorsOpen && <DesktopWindow id="indicators" title="Indicators" subtitle="CHART TOOLS" initialBounds={{ x: 950, y: 30, width: 410, height: 590 }} minWidth={350} minHeight={420} icon={<Layers3 className="h-3.5 w-3.5" />} onClose={() => setIndicatorsOpen(false)}><IndicatorsBrowser layers={layers} customStudies={customStudies} onToggleLayer={toggleBuiltIn} onCreate={(study) => setCustomStudies((current) => [...current, study])} onUpdate={(study) => setCustomStudies((current) => current.map((item) => item.id === study.id ? study : item))} onRemove={(id) => setCustomStudies((current) => current.filter((item) => item.id !== id))} /></DesktopWindow>}

      {strategyOpen && <DesktopWindow id="strategy" title="Strategy developer" subtitle="RESEARCH RULES" initialBounds={{ x: 260, y: 105, width: 720, height: 540 }} minWidth={480} minHeight={360} icon={<ChartNoAxesCombined className="h-3.5 w-3.5" />} onClose={() => setStrategyOpen(false)}><div className="h-full overflow-auto scroll-thin"><StrategyView /></div></DesktopWindow>}

      {settingsOpen && <DesktopWindow id="settings" title="Chart preferences" subtitle="WORKSPACE" initialBounds={{ x: 840, y: 170, width: 330, height: 330 }} minWidth={300} minHeight={260} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} onClose={() => setSettingsOpen(false)}><div className="p-3 text-[10px]"><p className="text-muted-foreground">Preferences are stored only in this browser.</p><PreferenceRange label="Future chart space" value={settings.futureBars} min={0} max={80} suffix=" bars" onChange={(futureBars) => setSettings((current) => ({ ...current, futureBars }))} /><PreferenceRange label="Grid intensity" value={Math.round(settings.gridOpacity * 100)} min={0} max={18} suffix="%" onChange={(value) => setSettings((current) => ({ ...current, gridOpacity: value / 100 }))} /><label className="mt-4 flex items-center justify-between border-t hairline pt-3 text-muted-foreground">Show crosshair<input type="checkbox" checked={settings.showCrosshair} onChange={(event) => setSettings((current) => ({ ...current, showCrosshair: event.target.checked }))} /></label><button type="button" className="mt-4 text-[9px] uppercase tracking-[.12em] text-mdata hover:text-foreground" onClick={() => setSettings(DEFAULT_CHART_SETTINGS)}>Reset preferences</button></div></DesktopWindow>}

      {contextOpen && <DesktopWindow id="context" title="Market context" subtitle="VERIFIED RESEARCH" initialBounds={{ x: 972, y: 50, width: 330, height: 420 }} minWidth={300} minHeight={280} icon={<Activity className="h-3.5 w-3.5" />} onClose={() => setContextOpen(false)}><ContextWindow symbol={symbol} tickSize={contract.tickSize} quote={quote} lastPrice={livePrice} derivatives={derivatives} dataStatus={dataStatus} provider={provider} healthReason={health?.reason ?? reason} /></DesktopWindow>}

    </div>
  );
}

function PreferenceRange({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="mt-4 block text-muted-foreground"><span className="flex justify-between"><span>{label}</span><b className="font-mono-num text-foreground">{value}{suffix}</b></span><input className="mt-2 w-full accent-[var(--zt-accent)]" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ChartTypeButton({ active, label, children, onClick }: { active: boolean; label: string; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("zt-chart-type-button", active && "is-active")} aria-label={label} title={label}>{children}</button>;
}

function ContextWindow({ symbol, tickSize, quote, lastPrice, derivatives, dataStatus, provider, healthReason }: { symbol: string; tickSize: number; quote: { bid: number; ask: number; bidSize: number; askSize: number } | null; lastPrice: number | null; derivatives: { markPrice?: number; fundingRate?: number } | null; dataStatus: string; provider?: string; healthReason?: string }) {
  const rows = [
    ["Last", formatPrice(lastPrice, tickSize)],
    ["Bid", quote ? formatPrice(quote.bid, tickSize) : "—"],
    ["Ask", quote ? formatPrice(quote.ask, tickSize) : "—"],
    ["Spread", quote ? formatPrice(quote.ask - quote.bid, tickSize) : "Awaiting quote"],
    ["Mark", formatPrice(derivatives?.markPrice, tickSize)],
    ["Funding", derivatives?.fundingRate === undefined ? "Unavailable" : `${(derivatives.fundingRate * 100).toFixed(4)}%`],
  ];
  return <div className="zt-context-window"><div className="zt-context-contract"><span>{formatSymbol(symbol)}</span><b>{provider?.toUpperCase() ?? "BINANCE"} · PERPETUAL</b></div><div className="zt-context-stats">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><div className={cn("zt-context-status", dataStatus === "LIVE" && "is-live")}><i />{dataStatus === "LIVE" ? "Observed public stream" : "Research feed not live"}</div>{healthReason && <p className="zt-context-warning">{healthReason}</p>}<p className="zt-context-footnote">Depth, footprint, and open-interest research remain withheld until their source data is independently available and verified.</p></div>;
}
