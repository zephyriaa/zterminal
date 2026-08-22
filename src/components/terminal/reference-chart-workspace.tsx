"use client";

import { useEffect, useMemo, useState } from "react";
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
import { StudiesPanel, type BuiltInStudyId } from "./studies-panel";
import { useWorkspace } from "@/stores/workspace";
import { StrategyView } from "@/components/views/strategy-view";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import { buildFootprint, calculateCVD } from "@/lib/market/order-flow";
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

type LayerId = "vwap" | "ema20" | "ema50" | "volume";
const BUILT_INS: Array<{ id: LayerId; name: string; category: "Trend" | "Volume"; description: string; color: string }> = [
  { id: "vwap", name: "Session VWAP", category: "Trend", description: "Session-anchored price-volume reference", color: "#f59e0b" },
  { id: "ema20", name: "EMA 20", category: "Trend", description: "Fast exponential moving average", color: "#38bdf8" },
  { id: "ema50", name: "EMA 50", category: "Trend", description: "Slow exponential moving average", color: "#a78bfa" },
  { id: "volume", name: "Volume", category: "Volume", description: "Observed trade-volume pane", color: "#94a3b8" },
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
  const { symbol, timeframe, setTimeframe, setView } = useWorkspace();
  const contract = getContract(symbol);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [replay, setReplay] = useState(false);
  const [studiesOpen, setStudiesOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ vwap: true, ema20: true, ema50: false, volume: true });
  const [customStudies, setCustomStudies] = useState<ChartStudy[]>([]);
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
  const { quote, trades, lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(symbol, { trades: 600, depth: false });
  const cvd = useMemo(() => calculateCVD(trades, 1_000), [trades]);
  const footprint = useMemo(() => buildFootprint(trades, contract.tickSize, 60_000).at(-1), [trades, contract.tickSize]);
  const indicators: ChartIndicators = {
    vwap: layers.vwap,
    ema20: layers.ema20,
    ema50: layers.ema50,
    volume: layers.volume,
    customStudies,
  };
  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;

  const toggleBuiltIn = (id: BuiltInStudyId) => {
    if (id in layers) setLayers((current) => ({ ...current, [id as LayerId]: !current[id as LayerId] }));
  };

  useEffect(() => {
    const openStudies = () => setStudiesOpen(true);
    const openStrategy = () => setStrategyOpen(true);
    const openSettings = () => setSettingsOpen(true);
    const openContext = () => setContextOpen(true);
    const openFlow = () => setFlowOpen(true);
    window.addEventListener("zterminal:open-studies", openStudies);
    window.addEventListener("zterminal:open-strategy", openStrategy);
    window.addEventListener("zterminal:open-settings", openSettings);
    window.addEventListener("zterminal:open-context", openContext);
    window.addEventListener("zterminal:open-flow", openFlow);
    return () => {
      window.removeEventListener("zterminal:open-studies", openStudies);
      window.removeEventListener("zterminal:open-strategy", openStrategy);
      window.removeEventListener("zterminal:open-settings", openSettings);
      window.removeEventListener("zterminal:open-context", openContext);
      window.removeEventListener("zterminal:open-flow", openFlow);
    };
  }, []);

  return (
    <div className="zt-reference-canvas" aria-label="Floating research workstation">
      <div className="zt-workstation-strip">
        <span className="zt-strip-contract">{formatSymbol(symbol)} <small>PERPETUAL</small></span>
        <span className="zt-strip-divider" aria-hidden="true" />
        <div className="zt-timeframes" aria-label="Chart timeframe">
          {TIMEFRAMES.map((item) => <button key={item.value} type="button" onClick={() => setTimeframe(item.value)} className={cn(timeframe === item.value && "is-active")} aria-pressed={timeframe === item.value}>{item.label}</button>)}
        </div>
        <span className="zt-strip-divider hidden sm:block" aria-hidden="true" />
        <button type="button" className="zt-strip-tool hidden sm:inline-flex" onClick={() => setContextOpen(true)}><SlidersHorizontal />Market</button>
        <button type="button" className="zt-strip-tool hidden sm:inline-flex" onClick={() => setFlowOpen(true)}><Activity />Order flow</button>
        <div className="ml-auto flex items-center gap-2">
          <span className={cn("zt-feed-indicator", dataStatus === "LIVE" && "is-live")} title={reason ?? health?.reason ?? "Research feed status"}><i />{dataStatus === "LIVE" ? "LIVE" : "RESEARCH"}</span>
          <button type="button" className="zt-strip-icon" onClick={() => setView("settings")} aria-label="Terminal settings"><SlidersHorizontal /></button>
        </div>
      </div>

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
          <div className="zt-chart-toolbar">
            <div className="zt-chart-price"><b>{formatPrice(livePrice, contract.tickSize)}</b><span className={dataStatus === "LIVE" ? "text-pos" : "text-muted-foreground"}>{provider?.toUpperCase() ?? "BINANCE"} · {dataStatus}</span></div>
            <span className="zt-toolbar-divider" />
            <button type="button" className={cn("zt-chart-toolbar-button", studiesOpen && "is-active")} onClick={() => setStudiesOpen(true)}><Layers3 />Studies</button>
            <button type="button" className={cn("zt-chart-toolbar-button", flowOpen && "is-active")} onClick={() => setFlowOpen(true)}><ChartNoAxesCombined />Flow</button>
            <div className="ml-auto flex items-center gap-1">
              <ChartTypeButton active={chartType === "candles"} label="Candles" onClick={() => setChartType("candles")}><CandlestickChart /></ChartTypeButton>
              <ChartTypeButton active={chartType === "bars"} label="Bars" onClick={() => setChartType("bars")}><BarChart3 /></ChartTypeButton>
              <ChartTypeButton active={chartType === "line"} label="Line" onClick={() => setChartType("line")}><LineChart /></ChartTypeButton>
              <button type="button" className="zt-chart-toolbar-button is-icon" onClick={() => setContextOpen(true)} aria-label="Open market context"><SlidersHorizontal /></button>
            </div>
          </div>
          <div className="zt-chart-stage">
            <div className="zt-chart-readout"><span>O <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>H <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>L <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>C <b>{formatPrice(lastTrade?.price, contract.tickSize)}</b></span><span>V <b>—</b></span></div>
            <div className="zt-chart-overlays"><span className={layers.vwap ? "text-warn" : "hidden"}>VWAP</span><span className={layers.ema20 ? "text-mdata" : "hidden"}>EMA 20</span><span className={layers.volume ? "text-muted-foreground" : "hidden"}>Volume</span></div>
            <TerminalChart symbol={symbol} timeframe={timeframe as Timeframe} chartType={chartType} indicators={indicators} settings={settings} replayIndex={replay ? Math.max(0, trades.length - 120) : null} markPrice={derivatives?.markPrice} />
          </div>
        </div>
      </DesktopWindow>

      {studiesOpen && <DesktopWindow id="studies" title="Studies" subtitle="CHART RESEARCH" initialBounds={{ x: 968, y: 30, width: 360, height: 520 }} minWidth={320} minHeight={360} icon={<Layers3 className="h-3.5 w-3.5" />} onClose={() => setStudiesOpen(false)}><StudiesPanel builtIns={BUILT_INS.map((study) => ({ ...study, active: layers[study.id] }))} customStudies={customStudies} onToggleBuiltIn={toggleBuiltIn} onCreate={(study) => setCustomStudies((current) => [...current, study])} onUpdate={(study) => setCustomStudies((current) => current.map((item) => item.id === study.id ? study : item))} onRemove={(id) => setCustomStudies((current) => current.filter((item) => item.id !== id))} /></DesktopWindow>}

      {strategyOpen && <DesktopWindow id="strategy" title="Strategy developer" subtitle="RESEARCH RULES" initialBounds={{ x: 260, y: 105, width: 720, height: 540 }} minWidth={480} minHeight={360} icon={<ChartNoAxesCombined className="h-3.5 w-3.5" />} onClose={() => setStrategyOpen(false)}><div className="h-full overflow-auto scroll-thin"><StrategyView /></div></DesktopWindow>}

      {settingsOpen && <DesktopWindow id="settings" title="Chart preferences" subtitle="WORKSPACE" initialBounds={{ x: 840, y: 170, width: 330, height: 330 }} minWidth={300} minHeight={260} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} onClose={() => setSettingsOpen(false)}><div className="p-3 text-[10px]"><p className="text-muted-foreground">Preferences are stored only in this browser.</p><PreferenceRange label="Future chart space" value={settings.futureBars} min={0} max={80} suffix=" bars" onChange={(futureBars) => setSettings((current) => ({ ...current, futureBars }))} /><PreferenceRange label="Grid intensity" value={Math.round(settings.gridOpacity * 100)} min={0} max={18} suffix="%" onChange={(value) => setSettings((current) => ({ ...current, gridOpacity: value / 100 }))} /><label className="mt-4 flex items-center justify-between border-t hairline pt-3 text-muted-foreground">Show crosshair<input type="checkbox" checked={settings.showCrosshair} onChange={(event) => setSettings((current) => ({ ...current, showCrosshair: event.target.checked }))} /></label><button type="button" className="mt-4 text-[9px] uppercase tracking-[.12em] text-mdata hover:text-foreground" onClick={() => setSettings(DEFAULT_CHART_SETTINGS)}>Reset preferences</button></div></DesktopWindow>}

      {contextOpen && <DesktopWindow id="context" title="Market context" subtitle="VERIFIED RESEARCH" initialBounds={{ x: 972, y: 50, width: 330, height: 420 }} minWidth={300} minHeight={280} icon={<Activity className="h-3.5 w-3.5" />} onClose={() => setContextOpen(false)}><ContextWindow symbol={symbol} tickSize={contract.tickSize} quote={quote} lastPrice={livePrice} derivatives={derivatives} dataStatus={dataStatus} provider={provider} healthReason={health?.reason ?? reason} /></DesktopWindow>}

      {flowOpen && <DesktopWindow id="flow" title="Order flow" subtitle="OBSERVED PUBLIC TAPE" initialBounds={{ x: 610, y: 365, width: 410, height: 330 }} minWidth={340} minHeight={240} icon={<ChartNoAxesCombined className="h-3.5 w-3.5" />} onClose={() => setFlowOpen(false)}><FlowWindow cvd={cvd} footprint={footprint} tickSize={contract.tickSize} /></DesktopWindow>}
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

function FlowWindow({ cvd, footprint, tickSize }: { cvd: ReturnType<typeof calculateCVD>; footprint: ReturnType<typeof buildFootprint>[number] | undefined; tickSize: number }) {
  const value = cvd.at(-1)?.value;
  return <div className="zt-flow-window-content"><div className="zt-flow-summary"><span>Rolling CVD</span><b className={(value ?? 0) >= 0 ? "text-pos" : "text-neg"}>{value === undefined ? "Awaiting prints" : `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`}</b></div><div className="zt-flow-grid"><span>Price</span><span>Buy</span><span>Sell</span>{(footprint?.levels.slice(0, 7) ?? []).map((level) => <><b key={`p-${level.price}`}>{formatPrice(level.price, tickSize)}</b><span key={`b-${level.price}`} className="text-pos">{level.buyVolume.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span><span key={`s-${level.price}`} className="text-neg">{level.sellVolume.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span></>)}</div>{!footprint && <p className="zt-context-footnote">Awaiting observed public trades; no footprint is synthesized.</p>}</div>;
}
