"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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
  Minus,
  Play,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DEFAULT_CHART_SETTINGS,
  TerminalChart,
  type ChartIndicators,
  type ChartSettings,
  type ChartStudy,
  type ChartType,
} from "@/components/terminal/terminal-chart";
import { BottomDock } from "@/components/terminal/workstation-dock";
import { StudiesPanel, type BuiltInStudyId } from "@/components/terminal/studies-panel";
import { useWorkspace } from "@/stores/workspace";
import { useStrategy } from "@/stores/strategy";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Bar, Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { buildFootprint, calculateCVD } from "@/lib/market/order-flow";

const LAYERS = [
  { id: "vwap", label: "Session VWAP", short: "VWAP", tone: "warn" },
  { id: "ema20", label: "EMA 20", short: "EMA 20", tone: "mdata" },
  { id: "ema50", label: "EMA 50", short: "EMA 50", tone: "research" },
  { id: "volume", label: "Volume", short: "Volume", tone: "muted" },
  { id: "profile", label: "Volume profile", short: "Profile", tone: "muted" },
  { id: "structure", label: "Market structure", short: "Structure", tone: "muted" },
] as const;

type LayerId = typeof LAYERS[number]["id"];
type WindowMode = "normal" | "maximized" | "minimized";
type WindowBounds = { x: number; y: number; width: number; height: number };
type MarketRow = { symbol: string; description?: string; price: number; change: number; changePct: number; exchange: string; product: string; supportsDepth: boolean };

function fmtPrice(value: number | null | undefined, tickSize: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const decimals = tickSize >= 1 ? 2 : Math.max(2, Math.round(-Math.log10(tickSize)));
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const DEFAULT_BOUNDS: WindowBounds = { x: 14, y: 14, width: 920, height: 520 };
const subscribeToBrowserPreference = () => () => {};
let cachedBoundsRaw: string | null | undefined;
let cachedBounds: WindowBounds = DEFAULT_BOUNDS;
let cachedSettingsRaw: string | null | undefined;
let cachedSettings: ChartSettings = DEFAULT_CHART_SETTINGS;
let cachedStudiesRaw: string | null | undefined;
let cachedStudies: ChartStudy[] = [];

function defaultBounds(): WindowBounds {
  return DEFAULT_BOUNDS;
}

function getStoredBounds() {
  const raw = window.localStorage.getItem("zterminal.chart-window.v1");
  if (raw === cachedBoundsRaw) return cachedBounds;
  cachedBoundsRaw = raw;
  try { cachedBounds = clampBounds({ ...DEFAULT_BOUNDS, ...JSON.parse(raw ?? "{}") }); } catch { cachedBounds = DEFAULT_BOUNDS; }
  return cachedBounds;
}

function getStoredChartSettings() {
  const raw = window.localStorage.getItem("zterminal.chart-settings.v1");
  if (raw === cachedSettingsRaw) return cachedSettings;
  cachedSettingsRaw = raw;
  try { cachedSettings = { ...DEFAULT_CHART_SETTINGS, ...JSON.parse(raw ?? "{}") } as ChartSettings; } catch { cachedSettings = DEFAULT_CHART_SETTINGS; }
  return cachedSettings;
}

function getStoredStudies() {
  const raw = window.localStorage.getItem("zterminal.custom-studies.v1");
  if (raw === cachedStudiesRaw) return cachedStudies;
  cachedStudiesRaw = raw;
  try {
    const candidate = JSON.parse(raw ?? "[]");
    cachedStudies = Array.isArray(candidate) ? candidate.filter((study): study is ChartStudy => study && typeof study.id === "string" && typeof study.name === "string" && ["ema", "sma", "vwap"].includes(study.kind)).map((study) => ({ ...study, visible: Boolean(study.visible), color: typeof study.color === "string" ? study.color : "#38bdf8" })) : [];
  } catch { cachedStudies = []; }
  return cachedStudies;
}

function clampBounds(next: WindowBounds): WindowBounds {
  return {
    x: Math.max(0, next.x),
    y: Math.max(0, next.y),
    width: Math.max(560, next.width),
    height: Math.max(320, next.height),
  };
}

export function ChartView() {
  const { symbol, timeframe, setCommandOpen } = useWorkspace();
  const { lastResult } = useStrategy();
  const contract = getContract(symbol);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ vwap: true, ema20: true, ema50: false, volume: true, profile: false, structure: false });
  const [studiesOpen, setStudiesOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [flowOpen, setFlowOpen] = useState(true);
  const [replay, setReplay] = useState(false);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [orderFlowPane, setOrderFlowPane] = useState<"cvd" | "footprint" | null>(null);
  const [windowMode, setWindowMode] = useState<WindowMode>("normal");
  const persistedBounds = useSyncExternalStore(
    subscribeToBrowserPreference,
    getStoredBounds,
    defaultBounds,
  );
  const [manualBounds, setBounds] = useState<WindowBounds | null>(null);
  const bounds = manualBounds ?? persistedBounds;
  const interaction = useRef<{ kind: "move" | "resize"; startX: number; startY: number; origin: WindowBounds } | null>(null);
  const [crosshairBar, setCrosshairBar] = useState<Bar | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const persistedChartSettings = useSyncExternalStore(
    subscribeToBrowserPreference,
    getStoredChartSettings,
    () => DEFAULT_CHART_SETTINGS,
  );
  const [manualChartSettings, setChartSettings] = useState<ChartSettings | null>(null);
  const chartSettings = manualChartSettings ?? persistedChartSettings;
  const persistedStudies = useSyncExternalStore(subscribeToBrowserPreference, getStoredStudies, () => [] as ChartStudy[]);
  const [manualStudies, setManualStudies] = useState<ChartStudy[] | null>(null);
  const customStudies = manualStudies ?? persistedStudies;
  const { quote, lastTrade, trades, dataStatus, provider, derivatives } = useMarketStream(symbol, { trades: 600, depth: false });

  useEffect(() => { if (!manualChartSettings) return; try { window.localStorage.setItem("zterminal.chart-settings.v1", JSON.stringify(manualChartSettings)); } catch { /* ignore */ } }, [manualChartSettings]);
  useEffect(() => { if (!manualBounds) return; try { window.localStorage.setItem("zterminal.chart-window.v1", JSON.stringify(manualBounds)); } catch { /* ignore */ } }, [manualBounds]);
  useEffect(() => { if (!manualStudies) return; try { window.localStorage.setItem("zterminal.custom-studies.v1", JSON.stringify(manualStudies)); } catch { /* ignore */ } }, [manualStudies]);
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
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!interaction.current) return;
      const { kind, startX, startY, origin } = interaction.current;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      setBounds(clampBounds(kind === "move" ? { ...origin, x: origin.x + dx, y: origin.y + dy } : { ...origin, width: origin.width + dx, height: origin.height + dy }));
    };
    const stop = () => { interaction.current = null; document.body.style.removeProperty("user-select"); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);

  const indicators: ChartIndicators = { vwap: layers.vwap, ema20: layers.ema20, ema50: layers.ema50, volume: layers.volume, customStudies };
  const livePrice = lastTrade?.price ?? markets.find((row) => row.symbol === symbol)?.price ?? null;
  const reference = markets.find((row) => row.symbol === symbol);
  const change = reference && livePrice != null ? livePrice - (reference.price - reference.change) : null;
  const changePct = reference && livePrice != null ? (change! / (reference.price - reference.change)) * 100 : null;
  const cvd = useMemo(() => calculateCVD(trades, 1_000), [trades]);
  const footprint = useMemo(() => buildFootprint(trades, contract.tickSize, 60_000).at(-1), [trades, contract.tickSize]);
  const markers = useMemo(() => {
    if (!lastResult || lastResult.config.symbol !== symbol || lastResult.config.timeframe !== timeframe) return [];
    return lastResult.trades.flatMap((trade) => [
      { t: trade.entryTime, side: trade.side === "long" ? "buy" as const : "sell" as const, price: trade.entryPrice, qty: trade.qty, label: trade.side === "long" ? "L" : "S" },
      { t: trade.exitTime, side: trade.side === "long" ? "sell" as const : "buy" as const, price: trade.exitPrice, qty: trade.qty, label: "X" },
    ]);
  }, [lastResult, symbol, timeframe]);
  const windowStyle: CSSProperties = windowMode === "maximized"
    ? { inset: 0 }
    : { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height };

  const beginInteraction = (kind: "move" | "resize", event: ReactPointerEvent) => {
    if (windowMode !== "normal") return;
    event.preventDefault();
    interaction.current = { kind, startX: event.clientX, startY: event.clientY, origin: bounds };
    document.body.style.userSelect = "none";
  };
  const toggleLayer = (id: LayerId) => setLayers((current) => ({ ...current, [id]: !current[id] }));
  const toggleBuiltInStudy = (id: BuiltInStudyId) => toggleLayer(id as LayerId);
  const changeStudies = (change: (current: ChartStudy[]) => ChartStudy[]) => setManualStudies((current) => change(current ?? persistedStudies));
  const updateSettings = (patch: Partial<ChartSettings>) => setChartSettings((current) => ({ ...(current ?? persistedChartSettings), ...patch }));

  return <div className="zt-floating-workspace floating-research-canvas relative h-full overflow-hidden bg-background p-0 sm:p-3" aria-label="Floating research canvas">
    {windowMode !== "minimized" && <section
      className={cn("zt-floating-window zt-chart-window floating-chart-window absolute z-20 relative flex min-h-0 flex-col overflow-hidden border hairline bg-panel shadow-[0_18px_45px_rgba(0,0,0,0.26)]", windowMode === "maximized" ? "rounded-none" : "rounded-[6px]")}
      style={windowStyle}
      onPointerDown={() => windowMode === "normal" && undefined}
      aria-label="Floating chart window"
    >
      <header onPointerDown={(event) => beginInteraction("move", event)} className={cn("flex h-9 shrink-0 items-center gap-2 border-b hairline bg-surface/80 px-2.5", windowMode === "normal" && "cursor-move")}>
        <div className="floating-chart-window-title flex items-center gap-2 min-w-0"><span className="hidden sm:grid h-4 w-4 place-items-center rounded-sm border border-mdata/40 text-[9px] text-mdata">⋮⋮</span><div className="min-w-0"><div className="hidden sm:block text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">Verified market canvas</div><div className="truncate text-[10.5px] font-mono-num text-foreground">{symbol.replace("_", " / ")} · {timeframe.toUpperCase()}</div></div></div>
        <div className="ml-auto flex items-center gap-1"><span className={cn("hidden sm:flex items-center gap-1 px-1.5 text-[9px] uppercase tracking-[0.12em]", dataStatus === "LIVE" ? "text-pos" : "text-warn")}><span className="h-1.5 w-1.5 rounded-full bg-current" />{provider ?? "gateio"} · {dataStatus}</span><WindowButton label="Replay" onClick={() => setReplay((value) => !value)} active={replay}><Play /></WindowButton><WindowButton label="Refresh viewport" onClick={() => setReplayIdx(null)}><RotateCcw /></WindowButton><WindowButton label={windowMode === "maximized" ? "Restore chart window" : "Maximize chart window"} onClick={() => setWindowMode((mode) => mode === "maximized" ? "normal" : "maximized")}>{windowMode === "maximized" ? <Minimize2 /> : <Maximize2 />}</WindowButton><WindowButton label="Minimize chart window" onClick={() => setWindowMode("minimized")}><Minus /></WindowButton></div>
      </header>

      <div className="mobile-chart-toolbar h-9 shrink-0 border-b hairline bg-panel flex items-center gap-1.5 px-2.5 overflow-x-auto no-scrollbar">
        <button onClick={() => setCommandOpen(true)} className="h-7 px-2 flex items-center gap-1.5 rounded-[4px] hover:bg-hover text-foreground" aria-label="Change instrument"><span className="font-mono-num text-[10.5px] font-semibold">{symbol}</span><ChevronDown className="w-3 h-3 text-muted-foreground" /></button>
        <div className="h-4 w-px bg-foreground/10" />
        <div className="flex items-center gap-1 text-[10px] font-mono-num"><span className={cn("font-semibold", change == null ? "text-foreground" : change >= 0 ? "text-pos" : "text-neg")}>{fmtPrice(livePrice, contract.tickSize)}</span>{changePct != null && <span className={changePct >= 0 ? "text-pos" : "text-neg"}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</span>}</div>
        <div className="h-4 w-px bg-foreground/10" />
        <button onClick={() => setStudiesOpen((value) => !value)} className={cn("flex h-7 items-center gap-1.5 rounded-[3px] px-2 text-[10px]", studiesOpen ? "bg-mdata/12 text-mdata" : "text-muted-foreground hover:bg-hover hover:text-foreground")} aria-pressed={studiesOpen}><Layers3 className="h-3.5 w-3.5" />Studies<span className="font-mono-num text-[9px] opacity-70">{LAYERS.filter((layer) => layers[layer.id]).length + customStudies.filter((study) => study.visible).length}</span></button><button onClick={() => setOrderFlowPane((current) => current === "cvd" ? null : "cvd")} className={cn("h-7 px-2 rounded-[3px] text-[9.5px] font-mono-num", orderFlowPane === "cvd" ? "bg-mdata/12 text-mdata" : "text-muted-foreground hover:bg-hover")} title="Toggle CVD chart pane">CVD</button><button onClick={() => setOrderFlowPane((current) => current === "footprint" ? null : "footprint")} className={cn("h-7 px-2 rounded-[3px] text-[9.5px] font-mono-num", orderFlowPane === "footprint" ? "bg-mdata/12 text-mdata" : "text-muted-foreground hover:bg-hover")} title="Toggle footprint chart pane">FP</button><button onClick={() => setFlowOpen((value) => !value)} className={cn("grid h-7 w-7 place-items-center rounded-[3px]", flowOpen ? "bg-research/15 text-research" : "text-muted-foreground hover:bg-hover hover:text-foreground")} aria-label="Toggle order-flow window" title="Toggle order-flow window"><Activity className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-0.5 shrink-0"><ChartTypeButton active={chartType === "candles"} label="Candles" onClick={() => setChartType("candles")}><CandlestickChart /></ChartTypeButton><ChartTypeButton active={chartType === "bars"} label="Bars" onClick={() => setChartType("bars")}><BarChart3 /></ChartTypeButton><ChartTypeButton active={chartType === "line"} label="Line" onClick={() => setChartType("line")}><LineChart /></ChartTypeButton><button onClick={() => setRightOpen((value) => !value)} className={cn("grid place-items-center h-7 w-7 rounded-[4px]", rightOpen ? "text-mdata bg-mdata/10" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-label="Toggle market context"><SlidersHorizontal className="w-3.5 h-3.5" /></button><details className="relative group"><summary className="list-none grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover cursor-pointer" aria-label="Chart settings"><Settings2 className="w-3.5 h-3.5" /></summary><div className="absolute right-0 top-8 z-30 w-64 p-3 bg-popover border hairline shadow-xl"><div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold">Chart settings</div><div className="text-[9px] text-muted-foreground">Saved in this browser</div></div><button className="text-[9px] text-mdata" onClick={() => setChartSettings(DEFAULT_CHART_SETTINGS)}>Reset</button></div><SettingRange label="Future space" value={chartSettings.futureBars} min={0} max={80} suffix=" bars" onChange={(futureBars) => updateSettings({ futureBars })} /><SettingRange label="Grid intensity" value={Math.round(chartSettings.gridOpacity * 100)} min={0} max={18} suffix="%" onChange={(value) => updateSettings({ gridOpacity: value / 100 })} /><label className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">Show crosshair<input type="checkbox" checked={chartSettings.showCrosshair} onChange={(event) => updateSettings({ showCrosshair: event.target.checked })} /></label></div></details></div>
      </div>

      <div className="min-h-0 flex-1 flex">
        <div className="min-w-0 flex-1 bg-background flex flex-col">
          <div className="relative min-h-0 flex-1">
          <div className="absolute z-10 left-3 top-2.5 pointer-events-none"><div className="flex items-center gap-2 text-[10px] font-mono-num"><span className="text-muted-foreground">O <b className="text-foreground/90">{fmtPrice(crosshairBar?.o ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">H <b className="text-foreground/90">{fmtPrice(crosshairBar?.h ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">L <b className="text-foreground/90">{fmtPrice(crosshairBar?.l ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">C <b className="text-foreground/90">{fmtPrice(crosshairBar?.c ?? lastTrade?.price, contract.tickSize)}</b></span><span className="text-muted-foreground">V <b className="text-foreground/90">{crosshairBar?.v?.toLocaleString() ?? "—"}</b></span></div><div className="mt-1.5 flex items-center gap-2">{LAYERS.filter((layer) => layers[layer.id]).map((layer) => <span key={layer.id} className={cn("text-[9px] font-mono-num", layer.tone === "warn" ? "text-warn" : layer.tone === "mdata" ? "text-mdata" : layer.tone === "research" ? "text-research" : "text-muted-foreground")}>{layer.short}</span>)}</div></div>
          <TerminalChart key={`${windowMode}-${bounds.width}-${bounds.height}`} symbol={symbol} timeframe={timeframe as Timeframe} chartType={chartType} indicators={indicators} settings={chartSettings} replayIndex={replay ? replayIdx : null} markers={markers} markPrice={derivatives?.markPrice} onCrosshair={setCrosshairBar} />
          {(derivatives?.markPrice || derivatives?.fundingRate !== undefined) && <div className="absolute right-[70px] top-2 z-10 flex items-center gap-2 rounded-[3px] border hairline bg-panel/85 px-1.5 py-1 text-[8.5px] font-mono-num pointer-events-none"><span className="text-mdata">MARK {fmtPrice(derivatives?.markPrice, contract.tickSize)}</span><span className="text-muted-foreground">FUND {derivatives?.fundingRate === undefined ? "—" : `${(derivatives.fundingRate * 100).toFixed(4)}%`}</span></div>}
          {replay && <div className="absolute left-3 right-3 bottom-8 z-10 h-8 flex items-center gap-2 px-2.5 border hairline bg-panel/95"><span className="text-[9px] uppercase tracking-[0.14em] text-warn">Replay</span><input type="range" min={0} max={100} defaultValue={100} onChange={(event) => setReplayIdx(Math.round((Number(event.target.value) / 100) * 500))} className="flex-1 h-1 accent-[var(--warn)]" /><span className="text-[9px] text-muted-foreground font-mono-num">historical window</span></div>}
          </div>
          {orderFlowPane && <ChartOrderFlowPane kind={orderFlowPane} cvd={cvd} footprint={footprint} tickSize={contract.tickSize} />}
        </div>
      </div>
      {studiesOpen && <StudiesPanel builtIns={LAYERS.map((study) => ({ id: study.id, name: study.label, category: study.id === "volume" || study.id === "profile" ? "Volume" as const : study.id === "structure" ? "Structure" as const : "Trend" as const, description: study.id === "vwap" ? "Session-anchored price-volume reference" : study.id === "ema20" ? "Fast exponential average · 20" : study.id === "ema50" ? "Slow exponential average · 50" : study.id === "volume" ? "Volume histogram pane" : study.id === "profile" ? "Distribution context (planned canvas layer)" : "Market-structure annotation context", color: study.tone === "warn" ? "#f59e0b" : study.tone === "mdata" ? "#38bdf8" : study.tone === "research" ? "#a78bfa" : "#94a3b8", active: layers[study.id] }))} customStudies={customStudies} onToggleBuiltIn={toggleBuiltInStudy} onCreate={(study) => changeStudies((current) => [...current, study])} onUpdate={(study) => changeStudies((current) => current.map((item) => item.id === study.id ? study : item))} onRemove={(id) => changeStudies((current) => current.filter((item) => item.id !== id))} />}
      {windowMode === "normal" && <button onPointerDown={(event) => beginInteraction("resize", event)} className="absolute bottom-0 right-0 z-40 hidden sm:grid h-5 w-5 cursor-nwse-resize place-items-center text-muted-foreground/60 hover:text-mdata" aria-label="Resize chart window"><span className="block h-2.5 w-2.5 border-b border-r border-current" /></button>}
    </section>}

    {windowMode !== "maximized" && rightOpen && <section className="zt-floating-window zt-market-window absolute z-30 hidden min-h-0 flex-col overflow-hidden sm:flex" aria-label="Floating market context"><ContextPanel symbol={symbol} contract={contract} quote={quote} trades={trades} markets={markets} onClose={() => setRightOpen(false)} /></section>}
    {windowMode !== "maximized" && flowOpen && <FloatingFlowWindow symbol={symbol} trades={trades} cvd={cvd} tickSize={contract.tickSize} onClose={() => setFlowOpen(false)} />}
    {windowMode !== "maximized" && <div className="mobile-workspace-dock absolute inset-x-0 bottom-0 sm:inset-x-3 sm:bottom-3 z-10"><BottomDock /></div>}
    {windowMode === "minimized" && <button onClick={() => setWindowMode("normal")} className="absolute left-3 top-3 z-30 flex h-8 items-center gap-2 rounded-[5px] border hairline bg-panel px-2.5 text-[10px] shadow-lg hover:bg-hover"><CandlestickChart className="h-3.5 w-3.5 text-mdata" /><span className="font-mono-num">{symbol} · {timeframe.toUpperCase()}</span><span className="text-muted-foreground">Chart minimized</span><Maximize2 className="h-3 w-3 text-muted-foreground" /></button>}
  </div>;
}

function layerToneClass(tone: "warn" | "mdata" | "research" | "muted") {
  if (tone === "warn") return "text-warn bg-warn/10";
  if (tone === "mdata") return "text-mdata bg-mdata/10";
  if (tone === "research") return "text-research bg-research/10";
  return "text-muted-foreground bg-foreground/5";
}

function WindowButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return <button onPointerDown={(event) => event.stopPropagation()} onClick={onClick} className={cn("grid h-6 w-6 place-items-center rounded-[3px] text-muted-foreground hover:bg-hover hover:text-foreground", active && "bg-warn/10 text-warn")} aria-label={label} title={label}>{children}</button>;
}

function ChartTypeButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("grid place-items-center h-7 w-7 rounded-[4px]", active ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-label={label} title={label}>{children}</button>;
}

function SettingRange({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="mt-3 block text-[10px] text-muted-foreground"><span className="flex justify-between"><span>{label}</span><span className="font-mono-num text-foreground">{value}{suffix}</span></span><input type="range" className="w-full mt-1 h-1 accent-[var(--mdata)]" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FloatingFlowWindow({ symbol, trades, cvd, tickSize, onClose }: { symbol: string; trades: { timestamp: number; price: number; quantity: number; side: string; sequence: number }[]; cvd: ReturnType<typeof calculateCVD>; tickSize: number; onClose: () => void }) {
  const prints = trades.slice(-6).reverse();
  const buyVolume = prints.filter((trade) => trade.side === "buy").reduce((total, trade) => total + trade.quantity, 0);
  const sellVolume = prints.filter((trade) => trade.side === "sell").reduce((total, trade) => total + trade.quantity, 0);
  const totalVolume = Math.max(1, buyVolume + sellVolume);
  const latestCvd = cvd.at(-1)?.value ?? 0;

  return <section className="zt-floating-window zt-flow-window absolute z-30 hidden overflow-hidden sm:flex sm:flex-col" aria-label="Floating order flow window">
    <header className="zt-window-header"><div><span>ORDER FLOW</span><b>{symbol.replace("_", " / ")} pulse</b></div><button onClick={onClose} aria-label="Close order-flow window"><X className="h-3.5 w-3.5" /></button></header>
    <div className="zt-window-content">
      <div className="zt-flow-metrics"><div><span>Window CVD</span><b className={latestCvd >= 0 ? "text-pos" : "text-neg"}>{latestCvd >= 0 ? "+" : ""}{latestCvd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b></div><div><span>Prints</span><b>{prints.length}</b></div></div>
      <div className="zt-flow-balance" aria-label="Recent buy and sell volume"><span className="zt-flow-buy" style={{ width: `${(buyVolume / totalVolume) * 100}%` }} /><span className="zt-flow-sell" style={{ width: `${(sellVolume / totalVolume) * 100}%` }} /></div>
      <div className="zt-flow-labels"><span className="text-pos">BUY {buyVolume.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span><span className="text-neg">SELL {sellVolume.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span></div>
      <div className="zt-print-list">{prints.length ? prints.map((trade) => <div key={`${trade.timestamp}-${trade.sequence}`}><span>{new Date(trade.timestamp).toISOString().slice(11, 19)}</span><b className={trade.side === "buy" ? "text-pos" : "text-neg"}>{fmtPrice(trade.price, tickSize)}</b><em>{trade.side === "buy" ? "+" : "−"}{trade.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}</em></div>) : <p>Awaiting observed public prints.</p>}</div>
      <footer>Observed public tape · read only</footer>
    </div>
  </section>;
}

function ContextPanel({ symbol, contract, quote, trades, markets, onClose }: { symbol: string; contract: ReturnType<typeof getContract>; quote: { bid: number; ask: number; bidSize: number; askSize: number } | null; trades: { timestamp: number; price: number; quantity: number; side: string; sequence: number }[]; markets: MarketRow[]; onClose: () => void }) {
  return <aside className="context-panel-optional w-[248px] shrink-0 border-l hairline bg-panel flex flex-col min-h-0" aria-label="Market context"><div className="h-8 shrink-0 px-2.5 border-b hairline flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-mdata" /><span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Market context</span><button onClick={onClose} className="ml-auto grid place-items-center h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-hover" aria-label="Close market context"><X className="w-3.5 h-3.5" /></button></div><div className="p-2.5 border-b hairline grid grid-cols-2 gap-x-4 gap-y-2"><ContextStat label="Bid" value={quote ? quote.bid.toLocaleString() : "—"} tone="text-neg" /><ContextStat label="Ask" value={quote ? quote.ask.toLocaleString() : "—"} tone="text-pos" /><ContextStat label="Spread" value={quote ? (quote.ask - quote.bid).toFixed(2) : "—"} /><ContextStat label="Bid size" value={quote ? String(quote.bidSize) : "—"} /><ContextStat label="Ask size" value={quote ? String(quote.askSize) : "—"} /><ContextStat label="Tick" value={String(contract.tickSize)} /></div><div className="px-2.5 py-2 border-b hairline"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Watchlist</span><span className="text-[9px] font-mono-num text-mdata">{markets.length || 1} verified</span></div><div className="mt-2">{markets.length ? markets.map((market) => <div key={market.symbol} className="flex items-center justify-between py-1 text-[10px]"><div><div className="font-mono-num">{market.symbol.replace("_", " / ")}</div><div className="text-[9px] text-muted-foreground">{market.exchange} · {market.product}</div></div><div className="text-right font-mono-num"><div>{market.price.toLocaleString()}</div><div className={market.changePct >= 0 ? "text-pos" : "text-neg"}>{market.changePct >= 0 ? "+" : ""}{market.changePct.toFixed(2)}%</div></div></div>) : <div className="py-1 text-[10px] text-muted-foreground">{symbol.replace("_", " / ")} · awaiting verified snapshot</div>}</div></div><div className="h-8 shrink-0 px-2.5 border-b hairline flex items-center"><span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Time &amp; sales</span></div><div className="min-h-0 flex-1 overflow-y-auto scroll-thin"><table className="w-full text-[10px] font-mono-num"><tbody>{trades.slice().reverse().map((trade) => <tr key={`${trade.timestamp}-${trade.sequence}`} className="border-b hairline/60"><td className="px-2 py-1 text-muted-foreground">{new Date(trade.timestamp).toISOString().slice(11, 19)}</td><td className={cn("px-2 py-1", trade.side === "buy" ? "text-pos" : "text-neg")}>{trade.price.toLocaleString()}</td><td className="px-2 py-1 text-right text-muted-foreground">{trade.quantity}</td></tr>)}{!trades.length && <tr><td className="px-2.5 py-3 text-muted-foreground">Awaiting venue tape…</td></tr>}</tbody></table></div><div className="shrink-0 border-t hairline p-2.5"><div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Data contract</div><div className="mt-1.5 space-y-1 text-[10px]"><div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span>Gate.io public</span></div><div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{contract.product}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Execution</span><span className="text-warn">Disabled</span></div></div></div></aside>;
}

function ContextStat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return <div><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={cn("mt-0.5 text-[11px] font-mono-num", tone)}>{value}</div></div>;
}

function ChartOrderFlowPane({ kind, cvd, footprint, tickSize }: { kind: "cvd" | "footprint"; cvd: ReturnType<typeof calculateCVD>; footprint: ReturnType<typeof buildFootprint>[number] | undefined; tickSize: number }) {
  if (kind === "cvd") {
    const last = cvd.at(-1)?.value ?? 0;
    return <section className="h-40 shrink-0 border-t hairline bg-panel/65" aria-label="CVD chart sub-panel"><div className="h-7 flex items-center gap-2 px-2.5 border-b hairline"><span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">CVD · client observation window</span><span className={cn("ml-auto text-[10px] font-mono-num", last >= 0 ? "text-pos" : "text-neg")}>{last >= 0 ? "+" : ""}{last.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span></div><div className="h-[calc(100%-28px)] px-2 py-1"><ChartCvdSparkline cvd={cvd} /></div></section>;
  }

  const levels = footprint?.levels.slice(0, 16) ?? [];
  const maximum = Math.max(1, ...levels.map((level) => level.totalVolume));
  return <section className="h-40 shrink-0 border-t hairline bg-panel/65 overflow-hidden" aria-label="Footprint chart sub-panel"><div className="h-7 flex items-center gap-2 px-2.5 border-b hairline"><span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Footprint · latest 60-second bucket</span><span className={cn("ml-auto text-[10px] font-mono-num", (footprint?.delta ?? 0) >= 0 ? "text-pos" : "text-neg")}>Δ {footprint ? `${footprint.delta >= 0 ? "+" : ""}${footprint.delta.toLocaleString("en-US", { maximumFractionDigits: 4 })}` : "Awaiting prints"}</span></div><div className="h-[calc(100%-28px)] overflow-y-auto scroll-thin px-2 py-1">{!levels.length && <p className="grid h-full place-items-center text-[10px] text-muted-foreground">Awaiting observed public trades; no footprint is synthesized.</p>}{levels.map((level) => { const buyHeavy = level.buyVolume >= Math.max(1, level.sellVolume) * 3; const sellHeavy = level.sellVolume >= Math.max(1, level.buyVolume) * 3; return <div key={level.price} className={cn("grid grid-cols-[1fr_92px_1fr_72px] gap-2 items-center h-5 text-[9.5px] font-mono-num", buyHeavy && "bg-pos/5", sellHeavy && "bg-neg/5")}><div className="flex justify-end items-center gap-1 text-neg"><span>{level.sellVolume.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span><span className="h-1.5 bg-neg/35" style={{ width: `${(level.sellVolume / maximum) * 64}px` }} /></div><span className="text-center text-muted-foreground">{fmtPrice(level.price, tickSize)}</span><div className="flex items-center gap-1 text-pos"><span className="h-1.5 bg-pos/35" style={{ width: `${(level.buyVolume / maximum) * 64}px` }} /><span>{level.buyVolume.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span></div><span className={cn("text-right", level.delta >= 0 ? "text-pos" : "text-neg")}>{level.delta >= 0 ? "+" : ""}{level.delta.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span></div>;})}</div></section>;
}

function ChartCvdSparkline({ cvd }: { cvd: ReturnType<typeof calculateCVD> }) {
  const width = 900;
  const height = 120;
  const values = cvd.map((point) => point.value);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const y = (value: number) => height - ((value - low) / range) * height;
  const zero = y(0);
  const path = cvd.map((point, index) => `${index === 0 ? "M" : "L"} ${(index / Math.max(1, cvd.length - 1)) * width} ${y(point.value)}`).join(" ");
  const area = path ? `${path} L ${width} ${zero} L 0 ${zero} Z` : "";
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full"><line x1="0" y1={zero} x2={width} y2={zero} stroke="var(--border)" strokeDasharray="3 4" /><path d={area} fill="var(--mdata)" opacity="0.12" /><path d={path} fill="none" stroke="var(--mdata)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />{!cvd.length && <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="16">Awaiting observed trade flow</text>}</svg>;
}
