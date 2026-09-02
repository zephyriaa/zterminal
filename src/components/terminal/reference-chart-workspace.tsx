"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Palette,
  CalendarDays,
  CandlestickChart,
  ChartNoAxesCombined,
  Layers3,
  LineChart,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Settings2,
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
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { StrategyView } from "@/components/views/strategy-view";
import { getContract } from "@/lib/market/contracts";
import { useMarketStream } from "@/hooks/use-market-stream";
import type { Bar, Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";

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
  const { symbol, timeframe, setTimeframe, timezone, setTimezone } = useWorkspace();
  const contract = getContract(symbol);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [replay, setReplay] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [terminalSettingsOpen, setTerminalSettingsOpen] = useState(false);
  const [layers, setLayers] = useState<Record<IndicatorToggleId, boolean>>({ vwap: true, ema20: true, ema50: false, volume: true });
  const [customStudies, setCustomStudies] = useState<ChartStudy[]>([]);
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
  const [appearance, setAppearance] = useState<TerminalAppearance>(DEFAULT_APPEARANCE);
  const [crosshairBar, setCrosshairBar] = useState<Bar | null>(null);
  const [latestBar, setLatestBar] = useState<Bar | null>(null);
  const appearanceHydrated = useRef(false);
  const { quote, trades, lastTrade, derivatives, dataStatus, provider, health, reason } = useMarketStream(symbol, { trades: 600, depth: false });
  const indicators: ChartIndicators = {
    vwap: layers.vwap,
    ema20: layers.ema20,
    ema50: layers.ema50,
    volume: layers.volume,
    customStudies,
  };
  const livePrice = lastTrade?.price ?? derivatives?.markPrice ?? null;


  useEffect(() => {
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
    if (appearanceHydrated.current) window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  }, [appearance]);

  useEffect(() => {
    document.documentElement.dataset.terminalDensity = appearance.density;
    document.documentElement.style.setProperty("--zt-app-bg", appearance.appBackground);
    document.documentElement.style.setProperty("--zt-panel-bg", appearance.panelBackground);
    document.documentElement.style.setProperty("--zt-chart-bg", appearance.chartBackground);
    document.documentElement.style.setProperty("--zt-accent", appearance.accent);
  }, [appearance]);

  const updateAppearance = (next: Partial<TerminalAppearance>) => setAppearance((current) => ({ ...current, ...next, preset: next.preset ?? "Custom" }));

  const chartSettings: ChartSettings = { ...settings, backgroundColor: appearance.chartBackground, candleUpColor: appearance.upColor, candleDownColor: appearance.downColor, gridOpacity: appearance.gridOpacity / 100 };

  const toggleBuiltIn = (id: IndicatorToggleId) => {
    setLayers((current) => ({ ...current, [id]: !current[id] }));
  };

  useEffect(() => {
    const openIndicators = () => setIndicatorsOpen(true);
    const openStrategy = () => setStrategyOpen(true);
    const openSettings = () => setSettingsOpen(true);
    const openContext = () => setContextOpen(true);
    const openCalendar = () => setCalendarOpen(true);
    const openTerminalSettings = () => setTerminalSettingsOpen(true);
    window.addEventListener("zterminal:open-indicators", openIndicators);
    window.addEventListener("zterminal:open-strategy", openStrategy);
    window.addEventListener("zterminal:open-settings", openSettings);
    window.addEventListener("zterminal:open-context", openContext);
    window.addEventListener("zterminal:open-calendar", openCalendar);
    window.addEventListener("zterminal:open-terminal-settings", openTerminalSettings);
    return () => {
      window.removeEventListener("zterminal:open-indicators", openIndicators);
      window.removeEventListener("zterminal:open-strategy", openStrategy);
      window.removeEventListener("zterminal:open-settings", openSettings);
      window.removeEventListener("zterminal:open-context", openContext);
      window.removeEventListener("zterminal:open-calendar", openCalendar);
      window.removeEventListener("zterminal:open-terminal-settings", openTerminalSettings);
    };
  }, []);

  return (
    <div className="zt-reference-canvas" aria-label="Floating research workstation" style={{ "--zt-app-bg": appearance.appBackground, "--zt-panel-bg": appearance.panelBackground, "--zt-chart-bg": appearance.chartBackground, "--zt-accent": appearance.accent, "--zt-grid-opacity": appearance.gridOpacity / 100 } as React.CSSProperties}>
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
            <button type="button" className={cn("zt-window-action", replay && "is-active")} onClick={() => setReplay((value) => !value)} aria-label={replay ? "Exit replay" : "Enter replay"} title={replay ? "Exit replay" : "Bar replay"}><Play /></button>
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
            <div className="zt-chart-readout"><span>O <b>{formatPrice((crosshairBar ?? latestBar)?.o, contract.tickSize)}</b></span><span>H <b>{formatPrice((crosshairBar ?? latestBar)?.h, contract.tickSize)}</b></span><span>L <b>{formatPrice((crosshairBar ?? latestBar)?.l, contract.tickSize)}</b></span><span>C <b>{formatPrice((crosshairBar ?? latestBar)?.c, contract.tickSize)}</b></span><span>V <b>{(crosshairBar ?? latestBar)?.v?.toLocaleString() ?? "—"}</b></span></div>
            <div className="zt-chart-overlays"><span className={layers.vwap ? "text-warn" : "hidden"}>VWAP</span><span className={layers.ema20 ? "text-mdata" : "hidden"}>EMA 20</span><span className={layers.volume ? "text-muted-foreground" : "hidden"}>Volume</span></div>
            <TerminalChart symbol={symbol} timeframe={timeframe as Timeframe} chartType={chartType} indicators={indicators} settings={chartSettings} replayEnabled={replay} timezone={timezone} markPrice={derivatives?.markPrice} onCrosshair={setCrosshairBar} onLatestBar={setLatestBar} />
          </div>
        </div>
      </DesktopWindow>

      {indicatorsOpen && <DesktopWindow id="indicators" title="Indicators" subtitle="CHART TOOLS" initialBounds={{ x: 950, y: 30, width: 410, height: 590 }} minWidth={350} minHeight={420} icon={<Layers3 className="h-3.5 w-3.5" />} onClose={() => setIndicatorsOpen(false)}><IndicatorsBrowser layers={layers} customStudies={customStudies} onToggleLayer={toggleBuiltIn} onCreate={(study) => setCustomStudies((current) => [...current, study])} onUpdate={(study) => setCustomStudies((current) => current.map((item) => item.id === study.id ? study : item))} onRemove={(id) => setCustomStudies((current) => current.filter((item) => item.id !== id))} /></DesktopWindow>}

      {strategyOpen && <DesktopWindow id="strategy" title="Strategy developer" subtitle="RESEARCH RULES" initialBounds={{ x: 260, y: 105, width: 720, height: 540 }} minWidth={480} minHeight={360} icon={<ChartNoAxesCombined className="h-3.5 w-3.5" />} onClose={() => setStrategyOpen(false)}><div className="h-full overflow-auto scroll-thin"><StrategyView /></div></DesktopWindow>}

      {settingsOpen && <DesktopWindow id="settings" title="Chart preferences" subtitle="WORKSPACE" initialBounds={{ x: 840, y: 170, width: 330, height: 330 }} minWidth={300} minHeight={260} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} onClose={() => setSettingsOpen(false)}><div className="p-3 text-[10px]"><p className="text-muted-foreground">Preferences are stored only in this browser.</p><PreferenceRange label="Future chart space" value={settings.futureBars} min={0} max={80} suffix=" bars" onChange={(futureBars) => setSettings((current) => ({ ...current, futureBars }))} /><PreferenceRange label="Grid intensity" value={appearance.gridOpacity} min={0} max={18} suffix="%" onChange={(gridOpacity) => updateAppearance({ gridOpacity })} /><label className="mt-4 flex items-center justify-between border-t hairline pt-3 text-muted-foreground">Show crosshair<input type="checkbox" checked={settings.showCrosshair} onChange={(event) => setSettings((current) => ({ ...current, showCrosshair: event.target.checked }))} /></label><button type="button" className="mt-4 text-[9px] uppercase tracking-[.12em] text-mdata hover:text-foreground" onClick={() => setSettings(DEFAULT_CHART_SETTINGS)}>Reset preferences</button></div></DesktopWindow>}

      {contextOpen && <DesktopWindow id="context" title="Market context" subtitle="VERIFIED RESEARCH" initialBounds={{ x: 972, y: 50, width: 330, height: 420 }} minWidth={300} minHeight={280} icon={<Activity className="h-3.5 w-3.5" />} onClose={() => setContextOpen(false)}><ContextWindow symbol={symbol} tickSize={contract.tickSize} quote={quote} lastPrice={livePrice} derivatives={derivatives} dataStatus={dataStatus} provider={provider} healthReason={health?.reason ?? reason} /></DesktopWindow>}
      {calendarOpen && <DesktopWindow id="economic-calendar" title="Economic calendar" subtitle="TERMINAL TOOL" initialBounds={{ x: 72, y: 96, width: 390, height: 320 }} minWidth={330} minHeight={260} icon={<CalendarDays className="h-3.5 w-3.5" />} onClose={() => setCalendarOpen(false)}><EconomicCalendarWindow timezone={timezone} /></DesktopWindow>}
      {terminalSettingsOpen && <DesktopWindow id="terminal-settings" title="Terminal preferences" subtitle="WORKSTATION" initialBounds={{ x: 850, y: 120, width: 360, height: 520 }} minWidth={320} minHeight={420} icon={<Settings2 className="h-3.5 w-3.5" />} onClose={() => setTerminalSettingsOpen(false)}><TerminalPreferencesWindow timezone={timezone} onTimezoneChange={setTimezone} appearance={appearance} onAppearanceChange={updateAppearance} onReset={() => setAppearance(DEFAULT_APPEARANCE)} /></DesktopWindow>}

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
