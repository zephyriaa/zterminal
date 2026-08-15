import { FormEvent, useMemo, useState } from "react";
import {
  Bell,
  CandlestickChart,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Maximize2,
  Microscope,
  NotebookPen,
  Play,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  TerminalSquare,
  Waves,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { deriveChartMetrics, rangeToTimeframe, summarizeDataset, toProviderInterval, type TerminalBar, type Timeframe } from "@/lib/terminalWorkspace";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663159529167/hrJwjiFAGWcrxDpw.png";
const NAVIGATION = [
  { label: "Chart", icon: CandlestickChart },
  { label: "Order Flow", icon: Waves },
  { label: "Strategy Builder", icon: TerminalSquare },
  { label: "Backtester", icon: FlaskConical },
  { label: "Research Lab", icon: Microscope },
  { label: "Alerts", icon: Bell },
  { label: "Journal", icon: NotebookPen },
] as const;
const RAIL_ITEMS = [CandlestickChart, LayoutDashboard, SlidersHorizontal, LineChart, TerminalSquare, CircleHelp, Radio];
const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"];
const RANGE_OPTIONS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "All"];
const WORKSPACE_COPY = {
  "Order Flow": ["Order-flow research", "A verified public trade tape is not connected. Candle-derived studies remain clearly separated from true tape analytics."],
  "Strategy Builder": ["Strategy builder", "Draft a research preset from the currently verified public candle interval. No execution instructions are created."],
  Backtester: ["Backtester", "Review the actual selected dataset before evaluating a model. Results remain research-only and are not order instructions."],
  "Research Lab": ["Research lab", "Refresh the connected public Gate.io snapshot and verified historical candles on demand."],
  Alerts: ["Alert drafts", "Create browser-session research notes only. ZTerminal does not send live trading alerts from this workspace."],
  Journal: ["Research journal", "Keep transient session notes about the public research view. Entries remain in this browser session."],
} as const;
type Workspace = (typeof NAVIGATION)[number]["label"];
type Snapshot = { price: number | null; changePercent: number | null; dayHigh: number | null; dayLow: number | null; quoteVolume: number | null; bid: number | null; ask: number | null; at: number; dataStatus: "LIVE" | "UNAVAILABLE"; reason?: string };
type Historical = { interval: string; bars: TerminalBar[]; fetchedAt: number; sourceTimestamp: number | null; dataStatus: "HISTORICAL" | "UNAVAILABLE"; reason?: string };

function formatQuote(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : "—";
}

function formatVolume(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatUtc(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp).toISOString().replace("T", " ").replace(".000Z", " UTC") : "—";
}

function Metric({ label, value, tone = "muted" }: { label: string; value: string; tone?: "teal" | "blue" | "amber" | "muted" }) {
  return <div className={`overlay-metric ${tone}`}><span>{label}</span><b>{value}</b></div>;
}

function VerifiedChart({ bars, interval, showIndicators, replay }: { bars: TerminalBar[]; interval: string; showIndicators: boolean; replay: boolean }) {
  const renderedBars = replay ? bars.slice(0, Math.max(2, Math.floor(bars.length * 0.62))) : bars;
  const geometry = useMemo(() => {
    if (renderedBars.length < 2) return null;
    const high = Math.max(...renderedBars.map((bar) => bar.h));
    const low = Math.min(...renderedBars.map((bar) => bar.l));
    const range = Math.max(high - low, Math.max(high * 0.0005, 0.01));
    const maxVolume = Math.max(...renderedBars.map((bar) => bar.v), 1);
    const left = 38;
    const right = 992;
    const chartTop = 25;
    const chartHeight = 346;
    const volumeBase = 442;
    const step = (right - left) / Math.max(renderedBars.length - 1, 1);
    const width = Math.max(1.25, Math.min(7, step * 0.62));
    const y = (value: number) => chartTop + ((high - value) / range) * chartHeight;
    return {
      high,
      low,
      candles: renderedBars.map((bar, index) => ({ x: left + index * step, open: y(bar.o), close: y(bar.c), high: y(bar.h), low: y(bar.l), volume: (bar.v / maxVolume) * 39, up: bar.c >= bar.o })),
      width,
      volumeBase,
    };
  }, [renderedBars]);
  const metrics = useMemo(() => deriveChartMetrics(renderedBars), [renderedBars]);

  return (
    <div className="research-chart" aria-label={geometry ? `Verified Gate.io ${interval} historical chart` : "Historical bars are unavailable"}>
      <div className="chart-overlay chart-overlay-left">
        {showIndicators ? <>
          <Metric label="VWAP · loaded window" value={formatQuote(metrics.windowVwap)} tone="teal" />
          <Metric label="EMA 20" value={formatQuote(metrics.ema20)} tone="blue" />
          <Metric label="EMA 50" value={formatQuote(metrics.ema50)} tone="blue" />
          <Metric label="Loaded range" value={metrics.range ? `${formatQuote(metrics.range.high)} — ${formatQuote(metrics.range.low)}` : "—"} tone="muted" />
        </> : <Metric label="Studies hidden" value="Indicators off" tone="muted" />}
      </div>
      {replay && <div className="replay-tag"><Play size={12} /> Replay preview · {renderedBars.length} verified bars</div>}
      {!geometry && <div className="chart-awaiting"><Radio size={15} /><span>Awaiting verified historical bars</span></div>}
      <svg viewBox="0 0 1030 470" preserveAspectRatio="none" role="img" aria-label="Verified public-market research chart">
        {[65, 130, 195, 260, 325, 390].map((y) => <line key={`h-${y}`} x1="0" x2="1030" y1={y} y2={y} className="chart-grid" />)}
        {[120, 300, 480, 660, 840].map((x) => <line key={`v-${x}`} x1={x} x2={x} y1="0" y2="470" className="chart-grid" />)}
        {geometry?.candles.map((candle, index) => <g key={index} className={candle.up ? "candle candle-up" : "candle candle-down"}><line x1={candle.x} x2={candle.x} y1={candle.high} y2={candle.low} /><rect x={candle.x - geometry.width / 2} y={Math.min(candle.open, candle.close)} width={geometry.width} height={Math.max(4, Math.abs(candle.open - candle.close))} rx="1" /></g>)}
        {geometry?.candles.map((candle, index) => <rect key={`volume-${index}`} className={candle.up ? "volume-bar up" : "volume-bar down"} x={candle.x - geometry.width / 2} y={geometry.volumeBase - candle.volume} width={geometry.width} height={candle.volume} rx="1" />)}
        {geometry && <line x1="0" x2="1030" y1={geometry.candles.at(-1)?.close ?? 0} y2={geometry.candles.at(-1)?.close ?? 0} className="reference-line" />}
      </svg>
      <div className="chart-price-axis" aria-hidden="true"><span>{geometry ? formatQuote(geometry.high) : "—"}</span><span>—</span><span>—</span><span>{geometry ? formatQuote(geometry.low) : "—"}</span></div>
    </div>
  );
}

function ContextPanel({ snapshot, historical }: { snapshot: Snapshot | null; historical: Historical | null }) {
  const bid = snapshot?.bid ?? null;
  const ask = snapshot?.ask ?? null;
  return <aside className="context-panel">
    <div className="context-title"><span>Market context</span><b>PUBLIC</b></div>
    <ContextRow label="Bid" value={formatQuote(bid)} /><ContextRow label="Ask" value={formatQuote(ask)} /><ContextRow label="Spread" value={typeof bid === "number" && typeof ask === "number" ? formatQuote(ask - bid) : "—"} />
    <div className="context-divider" /><ContextRow label="Venue" value="Gate.io" /><ContextRow label="Depth" value="Not connected" warn /><ContextRow label="Bars" value={historical ? `Gate.io · ${historical.interval}` : "Unavailable"} warn={!historical} /><ContextRow label="Execution" value="Disabled" warn />
    <div className="context-divider" /><div className="context-title small"><span>Time & sales</span></div><div className="tape-empty">{snapshot?.dataStatus === "LIVE" ? "Ticker snapshot is live; a verified public tape is not connected." : snapshot?.reason ?? "No verified public tape is available for this session."}</div>
  </aside>;
}

function ContextRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div className="context-row"><span>{label}</span><b className={warn ? "warn-text" : ""}>{value}</b></div>;
}

function WorkspaceHeader({ activeView }: { activeView: Exclude<Workspace, "Chart"> }) {
  const [title, copy] = WORKSPACE_COPY[activeView];
  return <div className="workspace-heading"><span>Research workspace</span><h2>{title}</h2><p>{copy}</p></div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<Workspace>("Chart");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [railOpen, setRailOpen] = useState(false);
  const [showIndicators, setShowIndicators] = useState(true);
  const [replay, setReplay] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [notice, setNotice] = useState("Public-data research mode is active. No order routing is available.");
  const [strategyName, setStrategyName] = useState("Public momentum study");
  const [strategyStyle, setStrategyStyle] = useState("Trend continuation");
  const [alertDraft, setAlertDraft] = useState("");
  const [savedAlert, setSavedAlert] = useState("");
  const [journalDraft, setJournalDraft] = useState("");
  const [journalEntries, setJournalEntries] = useState<string[]>([]);
  const providerInterval = toProviderInterval(timeframe);
  const snapshotQuery = trpc.market.snapshot.useQuery(undefined, { refetchInterval: 15_000, staleTime: 10_000, retry: 1 });
  const historicalQuery = trpc.market.bars.useQuery({ interval: providerInterval }, { refetchInterval: 45_000, staleTime: 30_000, retry: 1 });
  const snapshot = snapshotQuery.data as Snapshot | undefined;
  const historical = historicalQuery.data as Historical | undefined;
  const verifiedBars = historical?.dataStatus === "HISTORICAL" ? historical : null;
  const liveSnapshot = snapshot?.dataStatus === "LIVE" ? snapshot : null;
  const dataset = summarizeDataset(verifiedBars?.bars ?? []);
  const datasetMove = dataset.changePercent === null
    ? "—"
    : `${dataset.changePercent >= 0 ? "+" : ""}${dataset.changePercent.toFixed(2)}%`;
  const statusLabel = liveSnapshot ? "Public snapshot live" : snapshot ? "Public snapshot unavailable" : "Connecting public data";

  const selectTimeframe = (next: Timeframe, source = "Chart") => { setTimeframe(next); setActiveView("Chart"); setNotice(`${source}: loading verified Gate.io ${toProviderInterval(next)} bars.`); };
  const refreshResearch = async () => { await Promise.all([snapshotQuery.refetch(), historicalQuery.refetch()]); setNotice("Public Gate.io snapshot and historical-bar requests were refreshed."); };
  const submitAlert = (event: FormEvent) => { event.preventDefault(); const next = alertDraft.trim(); if (!next) return setNotice("Write an alert research note before saving a draft."); setSavedAlert(next); setAlertDraft(""); setNotice("Alert research draft saved for this browser session. No notification or order was sent."); };
  const submitJournal = (event: FormEvent) => { event.preventDefault(); const next = journalDraft.trim(); if (!next) return setNotice("Write a journal note before saving it."); setJournalEntries((entries) => [next, ...entries]); setJournalDraft(""); setNotice("Research journal note saved for this browser session."); };

  const renderWorkspace = () => {
    if (activeView === "Chart") return <>
      <div className="analysis-canvas"><VerifiedChart bars={verifiedBars?.bars ?? []} interval={providerInterval} showIndicators={showIndicators} replay={replay} /><ContextPanel snapshot={liveSnapshot ?? null} historical={verifiedBars} /></div>
      <section className="cvd-panel"><div className="subpanel-heading"><span>CVD (session)</span><b>Unavailable until verified public tape is connected</b></div><div className="cvd-empty">Cumulative volume delta is not calculated from candle bars. Connect a verified trade tape before enabling this analytical series.</div></section>
    </>;
    if (activeView === "Order Flow") return <section className="workspace-panel"><WorkspaceHeader activeView="Order Flow" /><div className="workspace-grid"><InfoCard label="Connected tape" value="Not connected" detail="No fabricated order-flow or trade-tape metrics are displayed." /><InfoCard label="Verified bars" value={verifiedBars ? `${verifiedBars.bars.length} ${verifiedBars.interval} bars` : "Unavailable"} detail="Use candle context only; it is not a substitute for a trade tape." /><InfoCard label="Research status" value="Candle-derived only" detail="CVD remains disabled until a verified tape source is connected." /></div></section>;
    if (activeView === "Strategy Builder") return <section className="workspace-panel"><WorkspaceHeader activeView="Strategy Builder" /><form className="workspace-form" onSubmit={(event) => { event.preventDefault(); setNotice(`Research preset “${strategyName || "Untitled"}” staged with ${strategyStyle}. No live execution route exists.`); }}><label>Preset name<input value={strategyName} onChange={(event) => setStrategyName(event.target.value)} maxLength={64} /></label><label>Research model<select value={strategyStyle} onChange={(event) => setStrategyStyle(event.target.value)}><option>Trend continuation</option><option>Mean reversion</option><option>Breakout observation</option></select></label><div className="form-status"><span>Dataset</span><b>{verifiedBars ? `Gate.io ${verifiedBars.interval} · ${verifiedBars.bars.length} verified bars` : "Waiting for verified bars"}</b></div><button className="primary-action" type="submit">Stage research preset</button></form></section>;
    if (activeView === "Backtester") return <section className="workspace-panel"><WorkspaceHeader activeView="Backtester" /><div className="workspace-grid"><InfoCard label="Selected dataset" value={verifiedBars ? `Gate.io · ${verifiedBars.interval}` : "Unavailable"} detail={verifiedBars ? `Fetched ${formatUtc(verifiedBars.fetchedAt)}.` : "Historical public bars are unavailable."} /><InfoCard label="Dataset move" value={datasetMove} detail="Close-to-close movement across the loaded public dataset; not a backtest result." /><InfoCard label="Loaded range" value={dataset.high === null || dataset.low === null ? "—" : `${formatQuote(dataset.high)} — ${formatQuote(dataset.low)}`} detail={`${dataset.barCount} verified bars. Execution remains disabled.`} /></div><button className="secondary-action" onClick={() => setNotice("Backtester dataset refreshed from the currently selected verified candle interval. Strategy performance is not inferred automatically.")}>Load selected dataset</button></section>;
    if (activeView === "Research Lab") return <section className="workspace-panel"><WorkspaceHeader activeView="Research Lab" /><div className="workspace-grid"><InfoCard label="Snapshot" value={liveSnapshot ? formatQuote(liveSnapshot.price) : "Unavailable"} detail={liveSnapshot ? `Gate.io public snapshot at ${formatUtc(liveSnapshot.at)}.` : snapshot?.reason ?? "Waiting for source."} /><InfoCard label="Historical bars" value={verifiedBars ? `${verifiedBars.bars.length} bars` : "Unavailable"} detail={verifiedBars ? `Source timestamp ${formatUtc(verifiedBars.sourceTimestamp)}.` : historical?.reason ?? "Waiting for source."} /><InfoCard label="Provider boundary" value="Public read-only" detail="This terminal does not place orders or connect a broker gateway." /></div><button className="primary-action" onClick={refreshResearch} disabled={snapshotQuery.isFetching || historicalQuery.isFetching}>{snapshotQuery.isFetching || historicalQuery.isFetching ? "Refreshing public data…" : "Refresh verified public data"}</button></section>;
    if (activeView === "Alerts") return <section className="workspace-panel"><WorkspaceHeader activeView="Alerts" /><form className="workspace-form" onSubmit={submitAlert}><label>Research-alert draft<textarea value={alertDraft} onChange={(event) => setAlertDraft(event.target.value)} placeholder="Example: review QQQX public 1h range after next data refresh" maxLength={280} /></label><div className="form-status"><span>Delivery</span><b>Browser session only · no notification sent</b></div><button className="primary-action" type="submit">Save draft</button>{savedAlert && <div className="saved-draft"><span>Latest local draft</span><p>{savedAlert}</p></div>}</form></section>;
    return <section className="workspace-panel"><WorkspaceHeader activeView="Journal" /><form className="workspace-form" onSubmit={submitJournal}><label>Session research note<textarea value={journalDraft} onChange={(event) => setJournalDraft(event.target.value)} placeholder="Capture an observation about the verified public dataset" maxLength={500} /></label><button className="primary-action" type="submit">Save session note</button></form><div className="journal-list">{journalEntries.length ? journalEntries.map((entry, index) => <article key={`${entry}-${index}`}><span>Session note {journalEntries.length - index}</span><p>{entry}</p></article>) : <div className="empty-note">No notes yet. Entries stay only in this browser session.</div>}</div></section>;
  };

  return <main className={`terminal-shell ${focusMode ? "focus-mode" : ""}`}>
    <header className="terminal-topbar"><div className="brand-lockup"><span className="brand-mark"><img src={LOGO_URL} alt="ZTerminal" /></span><span className="brand-name">ZTERMINAL</span></div><nav className="terminal-nav" aria-label="Primary research navigation">{NAVIGATION.map(({ label, icon: Icon }) => <button key={label} className={activeView === label ? "active" : ""} onClick={() => { setActiveView(label); setNotice(`${label} workspace opened.`); }}><Icon size={14} /><span>{label}</span></button>)}</nav><div className="top-actions"><button className="icon-button" aria-label="Open research lab" onClick={() => setActiveView("Research Lab")}><Search size={17} /></button><button className="icon-button" aria-label="Open alert drafts" onClick={() => setActiveView("Alerts")}><Bell size={17} /></button><span className="user-token"><img src={LOGO_URL} alt="" /></span></div></header>
    <section className="instrument-strip"><div className="symbol-block"><div><h1>QQQX / USDT <span>★</span></h1><p>Perpetual · public-data research view</p></div><div className="price-readout"><strong>{formatQuote(liveSnapshot?.price)}</strong><span>{liveSnapshot?.changePercent === null || liveSnapshot?.changePercent === undefined ? "Waiting for verified snapshot" : `${liveSnapshot.changePercent >= 0 ? "+" : ""}${liveSnapshot.changePercent.toFixed(2)}% · 24h`}</span></div></div><div className="instrument-metrics"><InstrumentMetric label="24h high" value={formatQuote(liveSnapshot?.dayHigh)} /><InstrumentMetric label="24h low" value={formatQuote(liveSnapshot?.dayLow)} /><InstrumentMetric label="24h volume" value={formatVolume(liveSnapshot?.quoteVolume)} /><InstrumentMetric label="Open interest" value="Unavailable" unavailable /></div><div className="instrument-status"><span className={`status-dot ${liveSnapshot ? "live" : ""}`} /> {statusLabel}</div><button className="venue-button" onClick={() => setNotice("Gate.io is the connected public-data venue for this research terminal.")}>Gate.io <ChevronDown size={14} /></button><button className="connect-button" onClick={() => setActiveView("Research Lab")}>Research</button></section>
    <div className="terminal-workspace"><aside className={`utility-rail ${railOpen ? "open" : ""}`}><button className="rail-toggle" onClick={() => setRailOpen((open) => !open)} aria-label="Toggle utility rail"><SlidersHorizontal size={18} /></button>{RAIL_ITEMS.map((Icon, index) => <button className={index === 0 && activeView === "Chart" ? "rail-active" : ""} key={index} aria-label={`Research tool ${index + 1}`} onClick={() => { const target = NAVIGATION[index]?.label ?? "Research Lab"; setActiveView(target); setNotice(`${target} workspace opened from the utility rail.`); }}><Icon size={18} /></button>)}<button className="rail-bottom" aria-label="Workspace settings" onClick={() => { setFocusMode((current) => !current); setNotice(focusMode ? "Standard terminal layout restored." : "Focus layout enabled; the utility rail is hidden."); }}><Settings2 size={18} /></button></aside><section className="research-stage"><div className="chart-toolbar"><div className="timeframe-controls" aria-label="Chart timeframes">{TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "selected" : ""} onClick={() => selectTimeframe(item)}>{item}</button>)}</div><div className="toolbar-divider" /><button onClick={() => { setShowIndicators((current) => !current); setNotice(showIndicators ? "Candle-derived studies hidden." : "Candle-derived VWAP and EMA studies shown."); }}><LineChart size={15} /> Indicators</button><button onClick={() => setNotice("Research templates use the Strategy Builder workspace; no trade orders are created.")}><LayoutDashboard size={15} /> Templates</button><button onClick={() => setActiveView("Alerts")}><Bell size={15} /> Alert draft</button><button onClick={() => { setReplay((current) => !current); setNotice(replay ? "Replay preview stopped; the full verified dataset is visible." : "Replay preview started with an earlier slice of the verified dataset."); }}><Play size={15} /> {replay ? "Stop replay" : "Replay"}</button><div className="toolbar-spacer" /><button className="tool-icon" aria-label="Refresh research data" onClick={refreshResearch}><RefreshCw size={16} /></button><button className="tool-icon" aria-label="Toggle focus layout" onClick={() => setFocusMode((current) => !current)}><Maximize2 size={16} /></button></div><div className="terminal-notice" role="status">{notice}</div>{renderWorkspace()}</section></div>
    <footer className="terminal-dock"><div className="dock-ranges">{RANGE_OPTIONS.map((range) => <button key={range} onClick={() => selectTimeframe(rangeToTimeframe(range), range)}>{range}</button>)}</div><div className="dock-card"><Radio size={17} /><span><b>Data source</b><small>{liveSnapshot ? "Gate.io · public" : "Snapshot unavailable"}</small></span></div><div className="dock-card"><Bell size={17} /><span><b>Alerts</b><small>Drafts only</small></span></div><div className="dock-card wide"><Microscope size={17} /><span><b>Research mode</b><small>Execution disabled</small></span></div><div className="dock-time">UTC · {new Date().toISOString().slice(11, 16)}</div></footer>
  </main>;
}

function InstrumentMetric({ label, value, unavailable = false }: { label: string; value: string; unavailable?: boolean }) {
  return <div className="instrument-metric"><span>{label}</span><b className={unavailable ? "unavailable" : ""}>{value}</b></div>;
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="info-card"><span>{label}</span><b>{value}</b><p>{detail}</p></article>;
}
