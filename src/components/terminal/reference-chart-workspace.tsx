"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Palette,
  CalendarDays,
  CandlestickChart,
  ChartNoAxesCombined,
  Layers3,
  FlaskConical,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Settings2,
} from "lucide-react";
import { PanelTaskStrip } from "./panel-task-strip";
import { usePanels } from "@/stores/panels";
import { useStudies } from "@/stores/studies";
import { DesktopWindow } from "./desktop-window";
import {
  TerminalChart,
  type ChartIndicators,
  type ChartStudy,
} from "./terminal-chart";
import { IndicatorsBrowser, type IndicatorToggleId } from "./indicators-browser";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { ResearchWorkbench } from "./research-workbench";
import { ResearchReport } from "./research-report";
import { useResearch } from "@/stores/research";
import { intervalMs } from "@/lib/local-research/dataset";
import type { TradeMarker } from "./terminal-chart";
import { AlertsView, JournalView } from "@/components/views/secondary-views";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Bar, Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { ChartToolbar } from "./chart-toolbar";
import { ChartSettingsPanel } from "./chart-settings-panel";
import { chartDocumentKey, createChartDocument, PRIMARY_CHART_ID, type InstrumentKey } from "@/lib/chart/contracts";
import { useChartDocuments } from "@/stores/chart-documents";
import { DrawingToolbar } from "./drawing-toolbar";
import { DrawingInspector } from "./drawing-inspector";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";

type TerminalAppearance = {
  preset: string;
  appBackground: string;
  panelBackground: string;
  chartBackground: string;
  accent: string;
  upColor: string;
  downColor: string;
  gridOpacity: number;
  density: "compact" | "comfortable";
};

const APPEARANCE_PRESETS: Record<string, Omit<TerminalAppearance, "preset">> = {
  Graphite: { appBackground: "#07090d", panelBackground: "#10141b", chartBackground: "#080b10", accent: "#7dd3fc", upColor: "#34d399", downColor: "#fb7185", gridOpacity: 7, density: "compact" },
  Midnight: { appBackground: "#050816", panelBackground: "#0b1224", chartBackground: "#060a18", accent: "#a78bfa", upColor: "#4ade80", downColor: "#f87171", gridOpacity: 6, density: "compact" },
  Sandstone: { appBackground: "#171512", panelBackground: "#24201a", chartBackground: "#15130f", accent: "#f0b35b", upColor: "#70d6a3", downColor: "#ee8f83", gridOpacity: 8, density: "comfortable" },
};

const DEFAULT_APPEARANCE: TerminalAppearance = { preset: "Graphite", ...APPEARANCE_PRESETS.Graphite };
const APPEARANCE_STORAGE_KEY = "zterminal:appearance";

function formatSymbol(symbol: string) {
  return symbol.includes("_") ? symbol.replace("_", " / ") : symbol.endsWith("USDT") ? `${symbol.slice(0, -4)} / USDT` : symbol;
}

function formatPrice(value: number | undefined | null, tick: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.max(2, Math.min(8, Math.round(-Math.log10(tick))));
  return value.toLocaleString("en-US", { minimumFractionDigits: tick >= 1 ? 2 : digits, maximumFractionDigits: tick >= 1 ? 2 : digits });
}

export function ReferenceChartWorkspace() {
  const { activeWorkspaceId, symbol, timeframe, setTimeframe, timezone, setTimezone } = useWorkspace();
  const contract = getContract(symbol);
  const archivedChart = useResearch(s => s.chartResult);
  const selectedTrade = useResearch(s => s.selectedTrade);
  const chartSymbol = archivedChart?.dataset.symbol ?? symbol;
  const chartTimeframe = archivedChart?.dataset.timeframe ?? timeframe;
  const selected = archivedChart?.trades.find(t => t.id === selectedTrade);
  const markers = useMemo<TradeMarker[]>(() => selected ? [
    { t: selected.entryTime, side: selected.side === "long" ? "buy" : "sell", price: selected.entryPrice, qty: selected.quantity, label: "Entry" },
    ...(selected.exitTime == null ? [] : [{ t: selected.exitTime, side: selected.side === "long" ? "sell" as const : "buy" as const, price: selected.exitPrice, qty: selected.quantity, label: "Exit" }]),
  ] : [], [selected]);
  const focusRange = useMemo(() => selected && archivedChart ? {
    from: Math.max(archivedChart.dataset.from, selected.entryTime - 10 * intervalMs(chartTimeframe)),
    to: Math.min(archivedChart.dataset.to, (selected.exitTime ?? archivedChart.dataset.to) + 10 * intervalMs(chartTimeframe)),
  } : null, [selected, archivedChart, chartTimeframe]);
  const [replay, setReplay] = useState(false);
  const indicatorsOpen = usePanels(s => s.panels.indicators?.status === "open");
  const setIndicatorsOpen = (open: boolean) => { if (open) usePanels.getState().open("indicators"); else usePanels.getState().patch("indicators", { status: "closed" }); };
  const setStrategyOpen = (open: boolean) => { if (open) usePanels.getState().open("strategy"); else usePanels.getState().patch("strategy", { status: "closed" }); };
  const setBacktesterOpen = (open: boolean) => { if (open) usePanels.getState().open("backtester"); else usePanels.getState().patch("backtester", { status: "closed" }); };
  const setSettingsOpen = (open: boolean) => { if (open) usePanels.getState().open("settings"); else usePanels.getState().patch("settings", { status: "closed" }); };
  const setContextOpen = (open: boolean) => { if (open) usePanels.getState().open("context"); else usePanels.getState().patch("context", { status: "closed" }); };
  const setCalendarOpen = (open: boolean) => { if (open) usePanels.getState().open("economic-calendar"); else usePanels.getState().patch("economic-calendar", { status: "closed" }); };
  const setTerminalSettingsOpen = (open: boolean) => { if (open) usePanels.getState().open("terminal-settings"); else usePanels.getState().patch("terminal-settings", { status: "closed" }); };
  const instances = useStudies(s => s.instances);
  const [appearance, setAppearance] = useState<TerminalAppearance>(DEFAULT_APPEARANCE);
  const [crosshairBar, setCrosshairBar] = useState<Bar | null>(null);
  const [latestBar, setLatestBar] = useState<Bar | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("crosshair");
  const [magnetMode, setMagnetMode] = useState<MagnetMode>("off");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const appearanceHydrated = useRef(false);
  const { quote, trades, lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(symbol, { trades: 600, depth: false });
  const chartProvider = archivedChart?.dataset.provider ?? provider ?? "gateio";
  const chartContract = getContract(chartSymbol);
  const instrument = useMemo<InstrumentKey>(() => ({ provider: chartProvider, exchange: chartContract.exchange, product: "perpetual", nativeSymbol: chartSymbol }), [chartContract.exchange, chartProvider, chartSymbol]);
  const chartDocumentId = chartDocumentKey(activeWorkspaceId, PRIMARY_CHART_ID, instrument);
  const storedChartDocument = useChartDocuments(state => state.documents[chartDocumentId]);
  const fallbackChartDocument = useMemo(() => createChartDocument({ workspaceId: activeWorkspaceId, instrument, timeframe: chartTimeframe as Timeframe, settings: { backgroundColor: appearance.chartBackground, candleUpColor: appearance.upColor, candleDownColor: appearance.downColor, gridOpacity: appearance.gridOpacity / 100 } }), [activeWorkspaceId, appearance.chartBackground, appearance.downColor, appearance.gridOpacity, appearance.upColor, chartTimeframe, instrument]);
  const chartDocument = storedChartDocument ?? fallbackChartDocument;
  const chartType = chartDocument.chartType;
  const chartSettings = chartDocument.settings;
  const selectedDrawing = chartDocument.drawings.find(drawing => drawing.id === selectedDrawingId) ?? null;
  const volumePane = chartDocument.panes.find(pane => pane.id === "volume") ?? { id: "volume", kind: "volume" as const, visible: true, height: 0.22, order: 1 };
  const indicators: ChartIndicators = useMemo(() => ({
    vwap: false, ema20: false, ema50: false,
    volume: volumePane.visible && instances.some(p => p.kind === 'volume' && p.visible),
    profile: instances.some(p => p.kind === 'profile' && p.visible),
    customStudies: instances.filter(p => !['volume', 'profile'].includes(p.kind)) as ChartStudy[],
  }), [instances, volumePane.visible]);
  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;


  useEffect(() => {
    void useStudies.persist.rehydrate();
    void Promise.resolve(useChartDocuments.persist.rehydrate()).then(() => { useChartDocuments.getState().ensure({ instrument, timeframe: chartTimeframe as Timeframe, settings: fallbackChartDocument.settings }); });
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
        if (saved) setAppearance({ ...DEFAULT_APPEARANCE, ...JSON.parse(saved) });
      } catch {
        // Keep the default appearance when browser storage is unavailable.
      } finally {
        appearanceHydrated.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    useChartDocuments.getState().ensure({ instrument, timeframe: chartTimeframe as Timeframe, settings: fallbackChartDocument.settings });
  }, [chartDocumentId]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
      if (!editable && event.key === "Escape") { setDrawingTool("cursor"); setSelectedDrawingId(null); return; }
      if (!editable && (event.key === "Delete" || event.key === "Backspace") && selectedDrawingId) {
        const drawing = useChartDocuments.getState().documents[chartDocumentId]?.drawings.find(item => item.id === selectedDrawingId);
        if (drawing && !drawing.locked) { event.preventDefault(); useChartDocuments.getState().deleteDrawing(chartDocumentId, selectedDrawingId); setSelectedDrawingId(null); }
      }
      if (!editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedDrawingId) {
        event.preventDefault(); setSelectedDrawingId(useChartDocuments.getState().duplicateDrawing(chartDocumentId, selectedDrawingId));
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [chartDocumentId, selectedDrawingId]);

  useEffect(() => {
    if (appearanceHydrated.current) window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  }, [appearance]);

  useEffect(() => {
    document.documentElement.dataset.terminalDensity = appearance.density;
    document.documentElement.style.setProperty("--zt-app-bg", appearance.appBackground);
    document.documentElement.style.setProperty("--zt-panel-bg", appearance.panelBackground);
    document.documentElement.style.setProperty("--zt-chart-bg", appearance.chartBackground);
    document.documentElement.style.setProperty("--zt-accent", appearance.accent);
  }, [appearance]);

  const updateAppearance = (next: Partial<TerminalAppearance>) => {
    setAppearance((current) => ({ ...current, ...next, preset: next.preset ?? "Custom" }));
    const chartPatch = {
      ...(next.chartBackground ? { backgroundColor: next.chartBackground } : {}),
      ...(next.upColor ? { candleUpColor: next.upColor } : {}),
      ...(next.downColor ? { candleDownColor: next.downColor } : {}),
      ...(typeof next.gridOpacity === "number" ? { gridOpacity: next.gridOpacity / 100 } : {}),
    };
    if (Object.keys(chartPatch).length > 0) useChartDocuments.getState().updateSettings(chartDocumentId, chartPatch);
  };

  useEffect(() => {
    const focusChart = () => usePanels.getState().open("chart");
    window.addEventListener("zterminal:focus-chart", focusChart);
    const openIndicators = () => setIndicatorsOpen(true);
    const openStrategy = () => { setStrategyOpen(true); setBacktesterOpen(true); usePanels.getState().focus("strategy"); };
    const openBacktester = () => setBacktesterOpen(true);
    const openSettings = () => setSettingsOpen(true);
    const openContext = () => setContextOpen(true);
    const openCalendar = () => setCalendarOpen(true);
    const openTerminalSettings = () => setTerminalSettingsOpen(true);
    window.addEventListener("zterminal:open-indicators", openIndicators);
    window.addEventListener("zterminal:open-strategy", openStrategy);
    window.addEventListener("zterminal:open-backtester", openBacktester);
    window.addEventListener("zterminal:open-settings", openSettings);
    window.addEventListener("zterminal:open-context", openContext);
    window.addEventListener("zterminal:open-calendar", openCalendar);
    window.addEventListener("zterminal:open-terminal-settings", openTerminalSettings);
    return () => {
      window.removeEventListener("zterminal:focus-chart", focusChart);
      window.removeEventListener("zterminal:open-indicators", openIndicators);
      window.removeEventListener("zterminal:open-strategy", openStrategy);
      window.removeEventListener("zterminal:open-backtester", openBacktester);
      window.removeEventListener("zterminal:open-settings", openSettings);
      window.removeEventListener("zterminal:open-context", openContext);
      window.removeEventListener("zterminal:open-calendar", openCalendar);
      window.removeEventListener("zterminal:open-terminal-settings", openTerminalSettings);
    };
  }, []);

  return (
    <div className="zt-reference-canvas" role="region" aria-label="Floating research workstation" style={{ "--zt-app-bg": appearance.appBackground, "--zt-panel-bg": appearance.panelBackground, "--zt-chart-bg": appearance.chartBackground, "--zt-accent": appearance.accent, "--zt-grid-opacity": appearance.gridOpacity / 100 } as React.CSSProperties}>
      <PanelTaskStrip />
      <DesktopWindow id="alerts" title="Alerts" initialBounds={{ x: 80, y: 60, width: 600, height: 420 }} onClose={() => usePanels.getState().patch("alerts", { status: "closed" })}><div className="h-full overflow-auto"><AlertsView /></div></DesktopWindow>
      <DesktopWindow id="journal" title="Journal" initialBounds={{ x: 100, y: 80, width: 700, height: 480 }} onClose={() => usePanels.getState().patch("journal", { status: "closed" })}><div className="h-full overflow-auto"><JournalView /></div></DesktopWindow>
      <DesktopWindow
        id="chart"
        title={`${formatSymbol(chartSymbol)} · ${chartTimeframe.toUpperCase()}`}
        subtitle={archivedChart ? "ARCHIVED RESEARCH DATASET" : "VERIFIED MARKET CANVAS"}
        initialBounds={{ x: 12, y: 10, width: 940, height: 610 }}
        minWidth={560}
        minHeight={360}
        icon={<CandlestickChart className="h-3.5 w-3.5" />}
        className="zt-reference-chart-window"
        headerActions={
          <>
            <button type="button" className={cn("zt-window-action", replay && "is-active")} onClick={() => setReplay((value) => !value)} aria-label={replay ? "Exit replay" : "Enter replay"} title={replay ? "Exit replay" : "Bar replay"}><Play /></button>
            <button type="button" className="zt-window-action" onClick={() => window.dispatchEvent(new Event("zterminal:refresh-chart"))} aria-label="Refresh chart viewport" title="Refresh chart"><RefreshCw /></button>
          </>
        }
      >
        <div className="zt-chart-content">
          <ChartToolbar symbol={formatSymbol(chartSymbol)} productLabel={archivedChart ? "ARCHIVED" : "PERPETUAL"} timeframe={chartTimeframe as Timeframe} archived={Boolean(archivedChart)} price={formatPrice(livePrice, contract.tickSize)} providerLabel={(provider ?? chartProvider).toUpperCase()} dataStatus={dataStatus} statusReason={reason ?? health?.reason} chartType={chartType} indicatorsOpen={indicatorsOpen} onTimeframe={next => { setTimeframe(next); useChartDocuments.getState().setTimeframe(chartDocumentId, next); }} onChartType={next => useChartDocuments.getState().setChartType(chartDocumentId, next)} onIndicators={() => setIndicatorsOpen(true)} onContext={() => setContextOpen(true)} onSettings={() => setSettingsOpen(true)} onReturnLive={() => useResearch.setState({ chartResult: null, selectedTrade: null })} />
          <div className="zt-chart-stage">
            <DrawingToolbar tool={drawingTool} magnet={magnetMode} onTool={setDrawingTool} onMagnet={setMagnetMode} />
            <div className="zt-chart-readout"><span>O <b>{formatPrice((crosshairBar ?? latestBar)?.o, contract.tickSize)}</b></span><span>H <b>{formatPrice((crosshairBar ?? latestBar)?.h, contract.tickSize)}</b></span><span>L <b>{formatPrice((crosshairBar ?? latestBar)?.l, contract.tickSize)}</b></span><span>C <b>{formatPrice((crosshairBar ?? latestBar)?.c, contract.tickSize)}</b></span><span>V <b>{(crosshairBar ?? latestBar)?.v?.toLocaleString() ?? "—"}</b></span></div>
            <div className="zt-chart-overlays">{instances.filter(p => p.visible).slice(0, 6).map(p => <span key={p.id} style={{ color: p.color }}>{p.name}</span>)}</div>
            <TerminalChart symbol={chartSymbol} timeframe={chartTimeframe as Timeframe} snapshot={archivedChart?.dataset.bars} markers={chartSettings.showStrategyTrades ? markers : []} focusRange={focusRange} chartType={chartType} indicators={indicators} settings={chartSettings} volumePaneHeight={volumePane.height} replayEnabled={!archivedChart && replay} timezone={archivedChart ? "UTC" : timezone} markPrice={archivedChart || !chartSettings.showMarkPrice ? undefined : derivatives?.markPrice} onCrosshair={setCrosshairBar} onLatestBar={setLatestBar} drawings={chartDocument.drawings} selectedDrawingId={selectedDrawingId} drawingTool={drawingTool} magnetMode={magnetMode} onDrawingTool={setDrawingTool} onSelectDrawing={setSelectedDrawingId} onCreateDrawing={(type, anchors) => useChartDocuments.getState().createDrawing(chartDocumentId, type, anchors)} onUpdateDrawing={(id, patch) => useChartDocuments.getState().updateDrawing(chartDocumentId, id, patch)} onDeleteDrawing={id => { useChartDocuments.getState().deleteDrawing(chartDocumentId, id); if (selectedDrawingId === id) setSelectedDrawingId(null); }} onDuplicateDrawing={id => { const duplicate = useChartDocuments.getState().duplicateDrawing(chartDocumentId, id); if (duplicate) setSelectedDrawingId(duplicate); }} />
            {selectedDrawing && <DrawingInspector drawing={selectedDrawing} onChange={patch => useChartDocuments.getState().updateDrawing(chartDocumentId, selectedDrawing.id, patch)} onDuplicate={() => { const duplicate = useChartDocuments.getState().duplicateDrawing(chartDocumentId, selectedDrawing.id); if (duplicate) setSelectedDrawingId(duplicate); }} onDelete={() => { useChartDocuments.getState().deleteDrawing(chartDocumentId, selectedDrawing.id); setSelectedDrawingId(null); }} onClose={() => setSelectedDrawingId(null)} />}
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow id="indicators" title="Indicators" subtitle="CHART TOOLS" initialBounds={{ x: 950, y: 30, width: 410, height: 590 }} minWidth={350} minHeight={420} icon={<Layers3 className="h-3.5 w-3.5" />} onClose={() => setIndicatorsOpen(false)}><IndicatorsBrowser /></DesktopWindow>

      <DesktopWindow id="strategy" title="Strategy research" subtitle="PYTHON / LOCAL PREVIEW" initialBounds={{ x: 260, y: 105, width: 720, height: 540 }} minWidth={360} minHeight={360} icon={<ChartNoAxesCombined className="h-3.5 w-3.5" />} onClose={() => setStrategyOpen(false)}><ResearchWorkbench /></DesktopWindow>
      <DesktopWindow id="backtester" title="Research report" subtitle="LOCAL ARCHIVE" initialBounds={{ x: 180, y: 80, width: 900, height: 600 }} minWidth={360} minHeight={250} icon={<FlaskConical className="h-3.5 w-3.5" />} onClose={() => setBacktesterOpen(false)}><ResearchReport /></DesktopWindow>

      <DesktopWindow id="settings" title="Chart settings" subtitle="PER-MARKET" initialBounds={{ x: 780, y: 110, width: 440, height: 500 }} minWidth={360} minHeight={380} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} onClose={() => setSettingsOpen(false)}><ChartSettingsPanel settings={chartSettings} instrument={formatSymbol(chartSymbol)} provider={chartProvider.toUpperCase()} volumeVisible={volumePane.visible} volumeHeight={volumePane.height} onChange={patch => useChartDocuments.getState().updateSettings(chartDocumentId, patch)} onVolume={patch => useChartDocuments.getState().setVolumePane(chartDocumentId, patch)} onReset={() => useChartDocuments.getState().resetSettings(chartDocumentId)} /></DesktopWindow>

      <DesktopWindow id="context" title="Market context" subtitle="VERIFIED RESEARCH" initialBounds={{ x: 972, y: 50, width: 330, height: 420 }} minWidth={300} minHeight={280} icon={<Activity className="h-3.5 w-3.5" />} onClose={() => setContextOpen(false)}><ContextWindow symbol={symbol} tickSize={contract.tickSize} quote={quote} lastPrice={livePrice} derivatives={derivatives} dataStatus={dataStatus} provider={provider} healthReason={health?.reason ?? reason} /></DesktopWindow>
      <DesktopWindow id="economic-calendar" title="Economic calendar" subtitle="TERMINAL TOOL" initialBounds={{ x: 72, y: 96, width: 390, height: 320 }} minWidth={330} minHeight={260} icon={<CalendarDays className="h-3.5 w-3.5" />} onClose={() => setCalendarOpen(false)}><EconomicCalendarWindow timezone={timezone} /></DesktopWindow>
      <DesktopWindow id="terminal-settings" title="Terminal preferences" subtitle="WORKSTATION" initialBounds={{ x: 850, y: 120, width: 360, height: 520 }} minWidth={320} minHeight={420} icon={<Settings2 className="h-3.5 w-3.5" />} onClose={() => setTerminalSettingsOpen(false)}><TerminalPreferencesWindow timezone={timezone} onTimezoneChange={setTimezone} appearance={appearance} onAppearanceChange={updateAppearance} onReset={() => setAppearance(DEFAULT_APPEARANCE)} /></DesktopWindow>

    </div>
  );
}

function PreferenceRange({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="mt-4 block text-muted-foreground"><span className="flex justify-between"><span>{label}</span><b className="font-mono-num text-foreground">{value}{suffix}</b></span><input className="mt-2 w-full accent-[var(--zt-accent)]" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
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

const TIMEZONE_OPTIONS: { value: ChartTimezone; label: string }[] = [
  { value: "America/New_York", label: "New York (ET)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Asia/Dubai", label: "Dubai" },
];

function TerminalPreferencesWindow({ timezone, onTimezoneChange, appearance, onAppearanceChange, onReset }: { timezone: ChartTimezone; onTimezoneChange: (timezone: ChartTimezone) => void; appearance: TerminalAppearance; onAppearanceChange: (next: Partial<TerminalAppearance>) => void; onReset: () => void }) {
  const applyPreset = (preset: string) => onAppearanceChange({ preset, ...APPEARANCE_PRESETS[preset] });
  return <div className="zt-terminal-preferences zt-terminal-preferences-custom"><p>Personalize the workstation without changing market data. Settings are stored in this browser.</p><div className="zt-preference-section"><span className="zt-preference-section-title"><Palette />Appearance presets</span><div className="zt-preference-presets">{Object.keys(APPEARANCE_PRESETS).map((preset) => <button type="button" key={preset} className={cn("zt-preference-preset", appearance.preset === preset && "is-active")} onClick={() => applyPreset(preset)}><i style={{ background: APPEARANCE_PRESETS[preset].accent }} /><span>{preset}</span></button>)}</div></div><div className="zt-preference-grid"><ColorControl label="Workspace" value={appearance.appBackground} onChange={(value) => onAppearanceChange({ appBackground: value })} /><ColorControl label="Panels" value={appearance.panelBackground} onChange={(value) => onAppearanceChange({ panelBackground: value })} /><ColorControl label="Chart canvas" value={appearance.chartBackground} onChange={(value) => onAppearanceChange({ chartBackground: value })} /><ColorControl label="Accent" value={appearance.accent} onChange={(value) => onAppearanceChange({ accent: value })} /><ColorControl label="Up candles" value={appearance.upColor} onChange={(value) => onAppearanceChange({ upColor: value })} /><ColorControl label="Down candles" value={appearance.downColor} onChange={(value) => onAppearanceChange({ downColor: value })} /></div><PreferenceRange label="Grid intensity" value={appearance.gridOpacity} min={0} max={18} suffix="%" onChange={(gridOpacity) => onAppearanceChange({ gridOpacity })} /><label className="zt-preference-select"><span>Information density</span><select value={appearance.density} onChange={(event) => onAppearanceChange({ density: event.target.value as TerminalAppearance["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label className="zt-preference-select"><span>Chart timezone</span><select value={timezone} onChange={(event) => onTimezoneChange(event.target.value as ChartTimezone)}>{TIMEZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="zt-terminal-preference-actions"><button type="button" onClick={onReset}>Reset appearance</button><span>Changes apply instantly</span></div></div>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="zt-color-control"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></label>;
}

function EconomicCalendarWindow({ timezone }: { timezone: ChartTimezone }) {
  return <div className="zt-economic-calendar"><div className="zt-economic-calendar-status"><CalendarDays /><div><b>Calendar source unavailable</b><p>No verified economic-news provider is connected to this public research deployment, so ZTerminal does not fabricate events, release times, or impact scores.</p></div></div><div className="zt-economic-calendar-row"><span>Display timezone</span><b>{TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone}</b></div><p className="zt-economic-calendar-footnote">Connect a licensed, provider-backed economic calendar before live event scheduling is enabled.</p></div>;
}
