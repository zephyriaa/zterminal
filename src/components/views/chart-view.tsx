"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CandlestickChart,
  ChevronDown,
  Crosshair,
  Layers3,
  LineChart,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DEFAULT_CHART_SETTINGS,
  TerminalChart,
  type ChartIndicators,
  type ChartSettings,
  type ChartType,
} from "@/components/terminal/terminal-chart";
import { BottomDock } from "@/components/terminal/workstation-dock";
import { useWorkspace } from "@/stores/workspace";
import { useStrategy } from "@/stores/strategy";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Bar, Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const LAYERS = [
  { id: "vwap", label: "Session VWAP", short: "VWAP", tone: "warn" },
  { id: "ema20", label: "EMA 20", short: "EMA 20", tone: "mdata" },
  { id: "ema50", label: "EMA 50", short: "EMA 50", tone: "research" },
  { id: "volume", label: "Volume", short: "Volume", tone: "muted" },
  { id: "profile", label: "Volume profile", short: "Profile", tone: "muted" },
  { id: "structure", label: "Market structure", short: "Structure", tone: "muted" },
] as const;

type LayerId = typeof LAYERS[number]["id"];

type MarketRow = { symbol: string; description?: string; price: number; change: number; changePct: number; exchange: string; product: string; supportsDepth: boolean };

function fmtPrice(value: number | null | undefined, tickSize: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const decimals = tickSize >= 1 ? 2 : Math.max(2, Math.round(-Math.log10(tickSize)));
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function ChartView() {
  const { symbol, timeframe, setCommandOpen } = useWorkspace();
  const { lastResult } = useStrategy();
  const contract = getContract(symbol);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ vwap: true, ema20: true, ema50: false, volume: true, profile: false, structure: false });
  const [rightOpen, setRightOpen] = useState(true);
  const [replay, setReplay] = useState(false);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [crosshairBar, setCrosshairBar] = useState<Bar | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_CHART_SETTINGS;
    try { return { ...DEFAULT_CHART_SETTINGS, ...JSON.parse(window.localStorage.getItem("zterminal.chart-settings.v1") ?? "{}")} as ChartSettings; } catch { return DEFAULT_CHART_SETTINGS; }
  });
  const { quote, lastTrade, trades, dataStatus, provider } = useMarketStream(symbol, { trades: 28, depth: false });

  useEffect(() => { try { window.localStorage.setItem("zterminal.chart-settings.v1", JSON.stringify(chartSettings)); } catch { /* ignore */ } }, [chartSettings]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await fetch("/api/markets", { cache: "no-store" }); const body = await response.json(); if (active) setMarkets(body.rows ?? []); } catch { if (active) setMarkets([]); }
    };
    void load();
    const id = window.setInterval(load, 15_000);
    return () => { active = false; window.clearInterval(id); };
  }, []);
  useEffect(() => {
    const toggle = () => setRightOpen((value) => !value);
    const replayEvent = () => setReplay((value) => !value);
    window.addEventListener("zterminal:context", toggle);
    window.addEventListener("zterminal:replay", replayEvent);
    return () => { window.removeEventListener("zterminal:context", toggle); window.removeEventListener("zterminal:replay", replayEvent); };
  }, []);

  const indicators: ChartIndicators = { vwap: layers.vwap, ema20: layers.ema20, ema50: layers.ema50, volume: layers.volume };
  const livePrice = lastTrade?.price ?? markets.find((row) => row.symbol === symbol)?.price ?? null;
  const reference = markets.find((row) => row.symbol === symbol);
  const change = reference && livePrice != null ? livePrice - (reference.price - reference.change) : null;
  const changePct = reference && livePrice != null ? (change! / (reference.price - reference.change)) * 100 : null;
  const activeLayerCount = Object.values(layers).filter(Boolean).length;
  const markers = useMemo(() => {
    if (!lastResult || lastResult.config.symbol !== symbol || lastResult.config.timeframe !== timeframe) return [];
    return lastResult.trades.flatMap((trade) => [
      { t: trade.entryTime, side: trade.side === "long" ? "buy" as const : "sell" as const, price: trade.entryPrice, qty: trade.qty, label: trade.side === "long" ? "L" : "S" },
      { t: trade.exitTime, side: trade.side === "long" ? "sell" as const : "buy" as const, price: trade.exitPrice, qty: trade.qty, label: "X" },
    ]);
  }, [lastResult, symbol, timeframe]);

  const toggleLayer = (id: LayerId) => setLayers((current) => ({ ...current, [id]: !current[id] }));
  const updateSettings = (patch: Partial<ChartSettings>) => setChartSettings((current) => ({ ...current, ...patch }));

  return <div className={cn("h-full flex flex-col bg-background", full && "fixed inset-0 z-50")}>
    <div className="h-9 shrink-0 border-b hairline bg-panel flex items-center gap-1.5 px-2.5 overflow-x-auto no-scrollbar">
      <button onClick={() => setCommandOpen(true)} className="h-7 px-2 flex items-center gap-2 rounded-[4px] hover:bg-hover text-foreground" aria-label="Change instrument"><span className="font-mono-num text-[11px] font-semibold">{symbol}</span><span className="text-[9px] text-muted-foreground uppercase">{contract.exchange}</span><ChevronDown className="w-3 h-3 text-muted-foreground" /></button>
      <div className="h-4 w-px bg-foreground/10" />
      <div className="flex items-center gap-1 text-[10px] font-mono-num"><span className={cn("text-[15px] font-semibold", change == null ? "text-foreground" : change >= 0 ? "text-pos" : "text-neg")}>{fmtPrice(livePrice, contract.tickSize)}</span>{changePct != null && <span className={changePct >= 0 ? "text-pos" : "text-neg"}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</span>}</div>
      <div className="h-4 w-px bg-foreground/10" />
      <div className="flex items-center gap-1.5">
        <Layers3 className="w-3.5 h-3.5 text-muted-foreground" />
        {LAYERS.map((layer) => <button key={layer.id} onClick={() => toggleLayer(layer.id)} className={cn("h-6 px-1.5 rounded-[3px] text-[9.5px] whitespace-nowrap", layers[layer.id] ? layerToneClass(layer.tone) : "text-muted-foreground/60 hover:text-foreground hover:bg-hover")} aria-pressed={layers[layer.id]} title={layer.label}>{layer.short}</button>)}
      </div>
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <ChartTypeButton active={chartType === "candles"} label="Candles" onClick={() => setChartType("candles")}><CandlestickChart /></ChartTypeButton>
        <ChartTypeButton active={chartType === "bars"} label="Bars" onClick={() => setChartType("bars")}><BarChart3 /></ChartTypeButton>
        <ChartTypeButton active={chartType === "line"} label="Line" onClick={() => setChartType("line")}><LineChart /></ChartTypeButton>
        <button onClick={() => setReplay((value) => !value)} className={cn("h-7 px-2 rounded-[4px] flex items-center gap-1.5 text-[10px]", replay ? "bg-warn/10 text-warn" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-pressed={replay}><Play className="w-3 h-3" />Replay</button>
        <button onClick={() => setRightOpen((value) => !value)} className={cn("grid place-items-center h-7 w-7 rounded-[4px]", rightOpen ? "text-mdata bg-mdata/10" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-label="Toggle market context" title="Toggle market context"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
        <details className="relative group">
          <summary className="list-none grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover cursor-pointer" aria-label="Chart settings"><Settings2 className="w-3.5 h-3.5" /></summary>
          <div className="absolute right-0 top-8 z-20 w-64 p-3 bg-popover border hairline shadow-xl"><div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold">Chart settings</div><div className="text-[9px] text-muted-foreground">Saved in this browser</div></div><button className="text-[9px] text-mdata" onClick={() => setChartSettings(DEFAULT_CHART_SETTINGS)}>Reset</button></div><SettingRange label="Future space" value={chartSettings.futureBars} min={0} max={80} suffix=" bars" onChange={(futureBars) => updateSettings({ futureBars })} /><SettingRange label="Grid intensity" value={Math.round(chartSettings.gridOpacity * 100)} min={0} max={18} suffix="%" onChange={(value) => updateSettings({ gridOpacity: value / 100 })} /><label className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">Show crosshair<input type="checkbox" checked={chartSettings.showCrosshair} onChange={(event) => updateSettings({ showCrosshair: event.target.checked })} /></label></div>
        </details>
        <button onClick={() => setFull((value) => !value)} className="grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label={full ? "Exit fullscreen" : "Fullscreen"} title={full ? "Exit fullscreen" : "Fullscreen"}>{full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
      </div>
    </div>

    <div className="flex-1 min-h-0 flex">
      <div className="flex-1 min-w-0 relative bg-background">
        <div className="absolute z-10 left-3 top-2.5 pointer-events-none">
          <div className="flex items-center gap-1.5 text-[11px] font-mono-num"><span className="font-semibold">{symbol.replace("_", " / ")}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{timeframe}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{contract.exchange}</span></div>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-mono-num"><span className="text-muted-foreground">O <b className="text-foreground/90">{fmtPrice(crosshairBar?.o ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">H <b className="text-foreground/90">{fmtPrice(crosshairBar?.h ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">L <b className="text-foreground/90">{fmtPrice(crosshairBar?.l ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">C <b className="text-foreground/90">{fmtPrice(crosshairBar?.c ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">V <b className="text-foreground/90">{crosshairBar?.v?.toLocaleString() ?? "—"}</b></span></div>
          <div className="mt-1.5 flex items-center gap-2">{LAYERS.filter((layer) => layers[layer.id]).map((layer) => <span key={layer.id} className={cn("text-[9px] font-mono-num", layer.tone === "warn" ? "text-warn" : layer.tone === "mdata" ? "text-mdata" : layer.tone === "research" ? "text-research" : "text-muted-foreground")}>{layer.short}</span>)}</div>
        </div>
        <div className="absolute right-3 top-2.5 z-10 flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", dataStatus === "LIVE" ? "bg-pos" : "bg-warn")} />{provider ?? "gateio"} · {dataStatus}</div>
        <TerminalChart symbol={symbol} timeframe={timeframe as Timeframe} chartType={chartType} indicators={indicators} settings={chartSettings} replayIndex={replay ? replayIdx : null} markers={markers} onCrosshair={setCrosshairBar} />
        {replay && <div className="absolute left-3 right-3 bottom-8 z-10 h-8 flex items-center gap-2 px-2.5 border hairline bg-panel/95"><span className="text-[9px] uppercase tracking-[0.14em] text-warn">Replay</span><input type="range" min={0} max={100} defaultValue={100} onChange={(event) => setReplayIdx(Math.round((Number(event.target.value) / 100) * 500))} className="flex-1 h-1 accent-[var(--warn)]" /><span className="text-[9px] text-muted-foreground font-mono-num">historical window</span></div>}
      </div>

      {rightOpen && !full && <ContextPanel symbol={symbol} contract={contract} quote={quote} trades={trades} markets={markets} onClose={() => setRightOpen(false)} />}
    </div>
    {!full && <BottomDock />}
  </div>;
}

function layerToneClass(tone: "warn" | "mdata" | "research" | "muted") {
  if (tone === "warn") return "text-warn bg-warn/10";
  if (tone === "mdata") return "text-mdata bg-mdata/10";
  if (tone === "research") return "text-research bg-research/10";
  return "text-muted-foreground bg-foreground/5";
}

function ChartTypeButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("grid place-items-center h-7 w-7 rounded-[4px]", active ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-label={label} title={label}>{children}</button>;
}

function SettingRange({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="mt-3 block text-[10px] text-muted-foreground"><span className="flex justify-between"><span>{label}</span><span className="font-mono-num text-foreground">{value}{suffix}</span></span><input type="range" className="w-full mt-1 h-1 accent-[var(--mdata)]" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ContextPanel({ symbol, contract, quote, trades, markets, onClose }: { symbol: string; contract: ReturnType<typeof getContract>; quote: { bid: number; ask: number; bidSize: number; askSize: number } | null; trades: { timestamp: number; price: number; quantity: number; side: string; sequence: number }[]; markets: MarketRow[]; onClose: () => void }) {
  return <aside className="context-panel-optional w-[248px] shrink-0 border-l hairline bg-panel flex flex-col min-h-0" aria-label="Market context">
    <div className="h-8 shrink-0 px-2.5 border-b hairline flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-mdata" /><span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Market context</span><button onClick={onClose} className="ml-auto grid place-items-center h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-hover" aria-label="Close market context"><X className="w-3.5 h-3.5" /></button></div>
    <div className="p-2.5 border-b hairline grid grid-cols-2 gap-x-4 gap-y-2"><ContextStat label="Bid" value={quote ? quote.bid.toLocaleString() : "—"} tone="text-neg" /><ContextStat label="Ask" value={quote ? quote.ask.toLocaleString() : "—"} tone="text-pos" /><ContextStat label="Spread" value={quote ? (quote.ask - quote.bid).toFixed(2) : "—"} /><ContextStat label="Bid size" value={quote ? String(quote.bidSize) : "—"} /><ContextStat label="Ask size" value={quote ? String(quote.askSize) : "—"} /><ContextStat label="Tick" value={String(contract.tickSize)} /></div>
    <div className="px-2.5 py-2 border-b hairline"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Watchlist</span><span className="text-[9px] font-mono-num text-mdata">{markets.length || 1} verified</span></div><div className="mt-2">{markets.length ? markets.map((market) => <div key={market.symbol} className="flex items-center justify-between py-1 text-[10px]"><div><div className="font-mono-num">{market.symbol.replace("_", " / ")}</div><div className="text-[9px] text-muted-foreground">{market.exchange} · {market.product}</div></div><div className="text-right font-mono-num"><div>{market.price.toLocaleString()}</div><div className={market.changePct >= 0 ? "text-pos" : "text-neg"}>{market.changePct >= 0 ? "+" : ""}{market.changePct.toFixed(2)}%</div></div></div>) : <div className="py-1 text-[10px] text-muted-foreground">{symbol.replace("_", " / ")} · awaiting verified snapshot</div>}</div></div>
    <div className="h-8 shrink-0 px-2.5 border-b hairline flex items-center"><span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Time &amp; sales</span></div>
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin"><table className="w-full text-[10px] font-mono-num"><tbody>{trades.slice().reverse().map((trade) => <tr key={`${trade.timestamp}-${trade.sequence}`} className="border-b hairline/60"><td className="px-2 py-1 text-muted-foreground">{new Date(trade.timestamp).toISOString().slice(11, 19)}</td><td className={cn("px-2 py-1", trade.side === "buy" ? "text-pos" : "text-neg")}>{trade.price.toLocaleString()}</td><td className="px-2 py-1 text-right text-muted-foreground">{trade.quantity}</td></tr>)}{!trades.length && <tr><td className="px-2.5 py-3 text-muted-foreground">Awaiting venue tape…</td></tr>}</tbody></table></div>
    <div className="shrink-0 border-t hairline p-2.5"><div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Data contract</div><div className="mt-1.5 space-y-1 text-[10px]"><div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span>Gate.io public</span></div><div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{contract.product}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Execution</span><span className="text-warn">Disabled</span></div></div></div>
  </aside>;
}

function ContextStat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return <div><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={cn("mt-0.5 text-[11px] font-mono-num", tone)}>{value}</div></div>;
}
