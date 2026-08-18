import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CandlestickChart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  FlaskConical,
  Focus,
  Layers3,
  LayoutPanelTop,
  LineChart,
  Maximize2,
  Menu,
  Play,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getResearchLayerCapability,
  summarizeDataset,
  toProviderInterval,
  type ResearchLayerId,
  type TerminalBar,
  type Timeframe,
} from "@/lib/terminalWorkspace";
import { RANGE_PRESETS, resolveHistoricalWindow, type RangePreset } from "@/lib/marketWindow";
import { clearLocalResearchDraft, createResearchDraftId, readLocalResearchDraft, writeLocalResearchDraft } from "@/lib/researchDraft";
import { evaluateFeatures, FEATURE_REGISTRY } from "@shared/features/registry";
import { DEFAULT_BACKTEST_CONFIG, runBacktest, STRATEGY_TEMPLATES } from "@shared/backtest/engine";
import { ProfessionalChart } from "@/components/terminal/ProfessionalChart";

const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"];
const LAYER_ORDER: ResearchLayerId[] = ["vwap", "ema", "profile", "sessions", "structure", "cvd", "gex"];
const STARTING_MARKETS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "QQQX_USDT"];

type MarketState = "CONNECTED" | "DEGRADED" | "UNAVAILABLE";
type Coverage = { requestedFrom: number | null; requestedTo: number | null; effectiveFrom: number | null; effectiveTo: number | null; returnedBars: number; complete: boolean; granularity: string };
type Snapshot = { symbol: string | null; price: number | null; changePercent: number | null; dayHigh: number | null; dayLow: number | null; quoteVolume: number | null; bid: number | null; ask: number | null; at: number; dataStatus: "LIVE" | "UNAVAILABLE"; state: MarketState; reason?: string; retryable?: boolean };
type Historical = { symbol: string; interval: string; bars: TerminalBar[]; fetchedAt: number; sourceTimestamp: number | null; dataStatus: "HISTORICAL" | "UNAVAILABLE"; state: MarketState; coverage: Coverage; reason?: string; retryable?: boolean };
type Feedback = { kind: "info" | "success" | "warning"; message: string } | null;

function formatQuote(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(value) >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
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

function formatAge(timestamp: number | null | undefined) {
  if (!timestamp) return "Awaiting source";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)}m ago`;
}

function InstrumentMetric({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  return <div className="instrument-metric"><span>{label}</span><b className={accent}>{value}</b></div>;
}

function IconRail({ showLayers, showResearch, focusMode, onLayers, onResearch, onFocus, onReset }: { showLayers: boolean; showResearch: boolean; focusMode: boolean; onLayers: () => void; onResearch: () => void; onFocus: () => void; onReset: () => void }) {
  return <aside className="terminal-icon-rail" aria-label="Terminal tools">
    <button className={showLayers ? "active" : ""} onClick={onLayers} aria-label="Open studies"><Layers3 size={18} /></button>
    <button className={showResearch ? "active" : ""} onClick={onResearch} aria-label="Open research workspace"><FlaskConical size={18} /></button>
    <span className="rail-divider" />
    <button onClick={onReset} aria-label="Reset chart viewport"><Undo2 size={17} /></button>
    <button className={focusMode ? "active" : ""} onClick={onFocus} aria-label="Toggle focus mode"><Maximize2 size={17} /></button>
  </aside>;
}

function StudiesDrawer({ activeLayers, selectedLayer, bars, onSelect, onToggle, onClose }: { activeLayers: ResearchLayerId[]; selectedLayer: ResearchLayerId | null; bars: TerminalBar[]; onSelect: (id: ResearchLayerId) => void; onToggle: (id: ResearchLayerId) => void; onClose: () => void }) {
  const selected = selectedLayer ? getResearchLayerCapability(selectedLayer) : null;
  const features = useMemo(() => evaluateFeatures(bars), [bars]);
  const dataset = summarizeDataset(bars);
  const profile = selectedLayer === "profile" ? features.volumeProfile : null;
  const definitionId = selectedLayer === "vwap" ? "vwap" : selectedLayer === "ema" ? "ema20" : selectedLayer === "profile" ? "volumeProfile" : null;
  const definition = definitionId ? FEATURE_REGISTRY[definitionId] : null;

  return <aside className="studies-drawer" aria-label="Chart studies">
    <div className="drawer-heading"><div><span className="drawer-kicker">Chart studies</span><h2>Analysis stack</h2></div><button onClick={onClose} aria-label="Close chart studies"><X size={16} /></button></div>
    <div className="study-list">{LAYER_ORDER.map((id) => {
      const layer = getResearchLayerCapability(id)!;
      const active = activeLayers.includes(id);
      const unavailable = layer.availability === "unavailable";
      return <div className={`study-row ${selectedLayer === id ? "selected" : ""} ${unavailable ? "locked" : ""}`} key={id}>
        <button className="study-select" onClick={() => onSelect(id)}><span className="study-icon">{layer.category === "flow" ? <Waves size={15} /> : layer.category === "positioning" ? <CircleHelp size={15} /> : layer.category === "context" ? <LayoutPanelTop size={15} /> : <LineChart size={15} />}</span><span><b>{layer.label}</b><small>{unavailable ? "Data provider required" : layer.category}</small></span></button>
        <button className={`study-toggle ${active ? "enabled" : ""}`} disabled={unavailable} onClick={() => onToggle(id)} aria-label={`${active ? "Hide" : "Show"} ${layer.label}`}><span /></button>
      </div>;
    })}</div>
    {selected && <section className="study-detail"><span className={`detail-state ${selected.availability === "available" ? "available" : "locked"}`}>{selected.availability === "available" ? "Verified study" : "Capability gate"}</span><h3>{selected.label}</h3><p>{selected.detail}</p><dl><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Loaded window</dt><dd>{dataset.barCount ? `${dataset.barCount.toLocaleString("en-US")} bars` : "Awaiting verified bars"}</dd></div>{definition && <><div><dt>Feature version</dt><dd>{definition.id} · v{definition.version}</dd></div><div><dt>Dataset fingerprint</dt><dd>{features.fingerprint ?? "Awaiting bars"}</dd></div></>}{profile && <><div><dt>Profile POC</dt><dd>{formatQuote(profile.pointOfControl)}</dd></div><div><dt>Value area</dt><dd>{formatQuote(profile.valueAreaLow)} — {formatQuote(profile.valueAreaHigh)}</dd></div></>}<div><dt>Status</dt><dd>{selected.availability === "available" ? "Rendered from verified candle data" : "Not rendered without its required dataset"}</dd></div></dl></section>}
  </aside>;
}

function ResearchDrawer({ bars, historical, symbol, onFeedback, onClose }: { bars: TerminalBar[]; historical: Historical | null; symbol: string; onFeedback: (feedback: Feedback) => void; onClose: () => void }) {
  const [hypothesis, setHypothesis] = useState("VWAP acceptance after opening-range expansion");
  const [condition, setCondition] = useState("Price remains above loaded-window VWAP");
  const [draftState, setDraftState] = useState<"idle" | "local" | "syncing" | "synced" | "sync-failed">("idle");
  const [backtest, setBacktest] = useState<ReturnType<typeof runBacktest> | null>(null);
  const { user, loading: authLoading } = useAuth();
  const migratedUserId = useRef<number | null>(null);
  const saveDraft = trpc.research.saveDraft.useMutation();
  const dataset = summarizeDataset(bars);

  const toDraft = () => {
    if (!historical) return null;
    return { id: createResearchDraftId(), workspaceName: `${symbol.replace("_", " / ")} research workspace`, title: hypothesis.slice(0, 180), hypothesis, condition, dataset: { provider: "gateio" as const, symbol, interval: historical.interval, requestedFrom: historical.coverage.requestedFrom, requestedTo: historical.coverage.requestedTo, effectiveFrom: historical.coverage.effectiveFrom, effectiveTo: historical.coverage.effectiveTo, returnedBars: historical.coverage.returnedBars, complete: historical.coverage.complete, sourceTimestamp: historical.sourceTimestamp, fetchedAt: historical.fetchedAt }, savedAt: Date.now() };
  };

  useEffect(() => {
    if (!user || migratedUserId.current === user.id) return;
    migratedUserId.current = user.id;
    const pending = readLocalResearchDraft();
    if (!pending) return;
    setDraftState("syncing");
    saveDraft.mutate(pending, {
      onSuccess: () => { clearLocalResearchDraft(); setDraftState("synced"); onFeedback({ kind: "success", message: "Browser-local research draft migrated to your authenticated workspace." }); },
      onError: () => { setDraftState("sync-failed"); onFeedback({ kind: "warning", message: "Workspace storage is unavailable. The browser-local draft is preserved for retry." }); },
    });
  }, [user, saveDraft, onFeedback]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const draft = toDraft();
    if (!draft) { onFeedback({ kind: "warning", message: "A research draft requires a verified historical dataset." }); return; }
    if (!user) {
      const stored = writeLocalResearchDraft(draft);
      setDraftState(stored ? "local" : "sync-failed");
      onFeedback(stored ? { kind: "success", message: "Research definition saved locally in this browser." } : { kind: "warning", message: "This browser could not retain the draft. Copy the research text before leaving." });
      return;
    }
    setDraftState("syncing");
    saveDraft.mutate(draft, {
      onSuccess: () => { clearLocalResearchDraft(); setDraftState("synced"); onFeedback({ kind: "success", message: "Research definition synced with its verified dataset reference." }); },
      onError: () => { writeLocalResearchDraft(draft); setDraftState("sync-failed"); onFeedback({ kind: "warning", message: "Workspace storage is unavailable; the draft remains stored locally." }); },
    });
  };

  const evaluate = () => {
    if (!historical) { onFeedback({ kind: "warning", message: "Load a verified historical window before evaluation." }); return; }
    const result = runBacktest("ema20_50_vwap_long", bars, DEFAULT_BACKTEST_CONFIG);
    setBacktest(result);
    onFeedback(result.status === "COMPLETED" ? { kind: "success", message: `Reproducible evaluation ${result.runId} completed with next-bar-open fills.` } : { kind: "warning", message: "The current range does not contain enough verified bars for EMA 50 evaluation." });
  };

  const status = authLoading ? "Checking workspace" : user ? draftState === "synced" ? "Workspace synced" : draftState === "syncing" ? "Syncing" : "Workspace draft" : "Local draft";
  return <aside className="research-drawer" aria-label="Research workspace">
    <div className="drawer-heading"><div><span className="drawer-kicker">Research workspace</span><h2>Hypothesis lab</h2></div><button onClick={onClose} aria-label="Close research workspace"><X size={16} /></button></div>
    <div className="research-status"><FlaskConical size={14} /><span>{status}</span><b>Research only</b></div>
    <form onSubmit={save} className="research-form"><label>Hypothesis<textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} maxLength={180} /></label><label>Validation condition<textarea value={condition} onChange={(event) => setCondition(event.target.value)} maxLength={180} /></label><div className="research-data-contract"><span>Verified data contract</span><b>{historical ? `Gate.io · ${historical.symbol} · ${historical.interval}` : "Awaiting verified window"}</b><small>{dataset.barCount ? `${dataset.barCount.toLocaleString("en-US")} bars · ${formatUtc(historical?.coverage.effectiveFrom)} → ${formatUtc(historical?.coverage.effectiveTo)}` : "No verified bars loaded"}</small></div><button className="terminal-primary-button" type="submit" disabled={saveDraft.isPending}><BookOpen size={14} /> {user ? "Sync research definition" : "Save local research draft"}</button></form>
    <section className="evaluation-card"><div><span>Reproducible evaluation</span><b>Historical only</b></div><p>{STRATEGY_TEMPLATES.ema20_50_vwap_long.label}. Signals at close; fills at next-bar open.</p><div className="evaluation-config"><span>Capital ${DEFAULT_BACKTEST_CONFIG.initialCapital.toLocaleString("en-US")}</span><span>Size {DEFAULT_BACKTEST_CONFIG.positionSize}</span><span>Costs explicit</span></div><button className="terminal-secondary-button" onClick={evaluate}>Run loaded window</button>{backtest && <div className="evaluation-result"><b>{backtest.status === "COMPLETED" ? `Run ${backtest.runId}` : "Evaluation unavailable"}</b>{backtest.metrics ? <><small>{backtest.data.barCount.toLocaleString("en-US")} bars · {backtest.hash}</small><dl><div><dt>Net P&amp;L</dt><dd>{backtest.metrics.netPnl >= 0 ? "+" : ""}{backtest.metrics.netPnl.toFixed(2)}</dd></div><div><dt>Return</dt><dd>{backtest.metrics.returnPct >= 0 ? "+" : ""}{backtest.metrics.returnPct.toFixed(2)}%</dd></div><div><dt>Trades</dt><dd>{backtest.metrics.tradeCount}</dd></div><div><dt>Max drawdown</dt><dd>{backtest.metrics.maxDrawdown.toFixed(2)}</dd></div></dl></> : <small>{backtest.limitations.at(-1)}</small>}<em>Not investment advice. No broker route, forecast, optimization, or intrabar-fill claim.</em></div>}</section>
    <section className="research-evidence"><span>Evidence rule</span><p>Configuration fingerprint, effective coverage, source timestamp, and limitations are retained before a backtest is considered.</p>{!user && <button className="terminal-secondary-button" onClick={() => startLogin()}>Sign in to sync this draft</button>}{draftState === "local" && <div>Local-only draft · sign in to migrate</div>}{draftState === "synced" && <div>Workspace draft synced · user review required</div>}{draftState === "sync-failed" && <div className="warning">Workspace sync unavailable · local draft retained</div>}</section>
  </aside>;
}

export default function Home() {
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [rangePreset, setRangePreset] = useState<RangePreset>("1D");
  const [symbol, setSymbol] = useState("QQQX_USDT");
  const [symbolDraft, setSymbolDraft] = useState("QQQX_USDT");
  const [showStudies, setShowStudies] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<ResearchLayerId | null>("vwap");
  const [activeLayers, setActiveLayers] = useState<ResearchLayerId[]>(["vwap", "ema", "profile", "structure"]);
  const [replay, setReplay] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [lastVerifiedHistorical, setLastVerifiedHistorical] = useState<Historical | null>(null);
  const [lastVerifiedSnapshot, setLastVerifiedSnapshot] = useState<Snapshot | null>(null);
  const providerInterval = toProviderInterval(timeframe);
  const historicalWindow = useMemo(() => resolveHistoricalWindow(rangePreset, providerInterval), [rangePreset, providerInterval]);
  const snapshotQuery = trpc.market.snapshot.useQuery({ symbol }, { refetchInterval: 15_000, staleTime: 10_000, retry: 1, placeholderData: (previous) => previous });
  const historicalQuery = trpc.market.bars.useQuery({ interval: providerInterval, symbol, from: historicalWindow.from, to: historicalWindow.to, limit: historicalWindow.requestedBars }, { refetchInterval: 45_000, staleTime: 30_000, retry: 1, placeholderData: (previous) => previous });
  const incomingSnapshot = snapshotQuery.data as Snapshot | undefined;
  const incomingHistorical = historicalQuery.data as Historical | undefined;
  const currentSnapshot = incomingSnapshot?.dataStatus === "LIVE" && incomingSnapshot.symbol === symbol ? incomingSnapshot : null;
  const currentHistorical = incomingHistorical?.dataStatus === "HISTORICAL" && incomingHistorical.symbol === symbol ? incomingHistorical : null;

  useEffect(() => { if (currentSnapshot) setLastVerifiedSnapshot(currentSnapshot); }, [currentSnapshot]);
  useEffect(() => { if (currentHistorical) setLastVerifiedHistorical(currentHistorical); }, [currentHistorical]);
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null), 5_500); return () => window.clearTimeout(timer); }, [feedback]);

  const displaySnapshot = currentSnapshot ?? lastVerifiedSnapshot;
  const displayHistorical = currentHistorical ?? lastVerifiedHistorical;
  const isUpdating = snapshotQuery.isFetching || historicalQuery.isFetching;
  const isInitialLoading = isUpdating && !displayHistorical;
  const marketError = currentHistorical ? null : incomingHistorical?.dataStatus === "UNAVAILABLE" ? incomingHistorical.reason ?? "The selected market could not return verified historical data." : incomingSnapshot?.dataStatus === "UNAVAILABLE" ? incomingSnapshot.reason ?? "The selected market could not return a verified public snapshot." : null;
  const coverage = currentHistorical?.coverage ?? displayHistorical?.coverage ?? null;
  const coverageLabel = coverage?.effectiveFrom && coverage.effectiveTo ? `${coverage.complete ? "Verified" : "Partial"} · ${formatUtc(coverage.effectiveFrom)} → ${formatUtc(coverage.effectiveTo)} · ${coverage.returnedBars.toLocaleString("en-US")} bars` : "Awaiting verified coverage";
  const requestedMarketIsValid = Boolean(currentHistorical && currentSnapshot);
  const verifiedSymbol = displayHistorical?.symbol ?? displaySnapshot?.symbol ?? symbol;
  const isShowingLastVerifiedMarket = !requestedMarketIsValid && verifiedSymbol !== symbol;

  const setMarket = (next: string) => {
    const normalized = next.trim().toUpperCase();
    if (!normalized) return;
    setSymbolDraft(normalized);
    setSymbol(normalized);
    setReplay(false);
    setFeedback({ kind: "info", message: `Requesting verified Gate.io data for ${normalized}. The current chart remains visible until the new window is confirmed.` });
  };
  const selectTimeframe = (next: Timeframe) => {
    setTimeframe(next);
    setReplay(false);
    setFeedback({ kind: "info", message: `Loading ${rangePreset} at ${toProviderInterval(next)} granularity.` });
  };
  const selectRange = (next: RangePreset) => {
    setRangePreset(next);
    setReplay(false);
    setFeedback({ kind: "info", message: `Requesting the ${next} verified history window. Effective coverage will be shown once confirmed.` });
  };
  const toggleLayer = (id: ResearchLayerId) => {
    const layer = getResearchLayerCapability(id)!;
    if (layer.availability === "unavailable") { setFeedback({ kind: "warning", message: `${layer.label} is gated: ${layer.detail}` }); return; }
    setActiveLayers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const retry = () => { void Promise.all([snapshotQuery.refetch(), historicalQuery.refetch()]); setFeedback({ kind: "info", message: "Retrying the public snapshot and historical data requests." }); };
  const resetViewport = () => { setReplay(false); setFeedback({ kind: "info", message: "Chart viewport reset to the latest verified window." }); };
  const shownBars = replay && displayHistorical ? displayHistorical.bars.slice(0, Math.max(60, Math.floor(displayHistorical.bars.length * 0.68))) : displayHistorical?.bars ?? [];

  return <main className={`premium-terminal ${focusMode ? "is-focus" : ""}`}>
    <header className="premium-topbar">
      <button className="brand-lockup" onClick={() => setMarket("BTC_USDT")} aria-label="Load BTC USDT"><span className="brand-glyph"><span /><span /></span><span><b>ZTERMINAL</b><small>deep research workstation</small></span></button>
      <nav className="top-navigation" aria-label="Workspace navigation"><button className="active"><CandlestickChart size={16} /><span>Chart</span></button><button onClick={() => { setShowResearch(true); setShowStudies(false); }} className={showResearch ? "active" : ""}><FlaskConical size={16} /><span>Research</span></button><button onClick={() => { setShowStudies(true); setShowResearch(false); }} className={showStudies ? "active" : ""}><Layers3 size={16} /><span>Studies</span></button></nav>
      <div className="topbar-actions"><button onClick={() => setFocusMode((value) => !value)} aria-label="Toggle focus mode"><Focus size={16} /></button><button aria-label="Terminal settings" onClick={() => setFeedback({ kind: "info", message: "Terminal settings and entitlements are planned for the next workspace release." })}><Settings2 size={16} /></button><button aria-label="Notifications" onClick={() => setFeedback({ kind: "info", message: "No research alerts are configured. Alerts remain a future connected-data capability." })}><Bell size={16} /></button><span className="account-orb"><Sparkles size={13} /></span></div>
    </header>

    <section className="instrument-command-bar">
      <form className="market-command" onSubmit={(event) => { event.preventDefault(); setMarket(symbolDraft); }}><Search size={16} /><input value={symbolDraft} onChange={(event) => setSymbolDraft(event.target.value)} placeholder="Search Gate.io perpetual" aria-label="Gate.io perpetual market" spellCheck="false" /><button type="submit">Load market</button></form>
      <div className="quick-markets" aria-label="Suggested markets">{STARTING_MARKETS.map((item) => <button key={item} className={symbol === item ? "selected" : ""} onClick={() => setMarket(item)}>{item.replace("_", " / ")}</button>)}</div>
      <div className={`market-state ${requestedMarketIsValid ? "live" : isUpdating ? "updating" : "unavailable"}`}><span /><b>{requestedMarketIsValid ? "Verified live data" : isUpdating ? "Verifying market" : "Market unavailable"}</b><small>{formatAge(displaySnapshot?.at)}</small></div>
    </section>

    <section className="instrument-summary">
      <div className="instrument-identity"><span className="venue-tag">GATE.IO <ChevronDown size={12} /></span><h1>{verifiedSymbol.replace("_", " / ")}</h1><span className={requestedMarketIsValid ? "verified-tag" : "pending-tag"}>{requestedMarketIsValid ? "PUBLIC VERIFIED" : isShowingLastVerifiedMarket ? "LAST VERIFIED" : "REQUESTED"}</span>{isShowingLastVerifiedMarket && <small className="requested-instrument">Requested: {symbol.replace("_", " / ")}</small>}</div>
      <div className="main-price"><strong>{formatQuote(displaySnapshot?.price)}</strong><span className={typeof displaySnapshot?.changePercent === "number" && displaySnapshot.changePercent >= 0 ? "positive" : "negative"}>{typeof displaySnapshot?.changePercent === "number" ? `${displaySnapshot.changePercent >= 0 ? "+" : ""}${displaySnapshot.changePercent.toFixed(2)}% · 24h` : "Awaiting verified quote"}</span></div>
      <div className="summary-metrics"><InstrumentMetric label="24h high" value={formatQuote(displaySnapshot?.dayHigh)} /><InstrumentMetric label="24h low" value={formatQuote(displaySnapshot?.dayLow)} /><InstrumentMetric label="24h volume" value={formatVolume(displaySnapshot?.quoteVolume)} /><InstrumentMetric label="Bid / ask" value={displaySnapshot?.bid && displaySnapshot?.ask ? `${formatQuote(displaySnapshot.bid)} / ${formatQuote(displaySnapshot.ask)}` : "—"} /></div>
      <div className="data-contract-chip"><Radio size={14} /><span><b>{coverage?.complete ? "Verified coverage" : coverage ? "Partial coverage" : "Coverage pending"}</b><small>{coverage ? `${coverage.returnedBars.toLocaleString("en-US")} bars · ${coverage.granularity}` : "No effective historical window"}</small></span></div>
    </section>

    <section className="terminal-main-layout">
      <IconRail showLayers={showStudies} showResearch={showResearch} focusMode={focusMode} onLayers={() => { setShowStudies((visible) => !visible); setShowResearch(false); }} onResearch={() => { setShowResearch((visible) => !visible); setShowStudies(false); }} onFocus={() => setFocusMode((value) => !value)} onReset={resetViewport} />
      <section className="chart-workspace">
        <div className="chart-command-toolbar"><div className="timeframe-switcher">{TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "selected" : ""} onClick={() => selectTimeframe(item)}>{item}</button>)}</div><span className="toolbar-separator" /><button onClick={() => { setShowStudies(true); setShowResearch(false); }}><Layers3 size={14} /> Studies</button><button onClick={() => { setShowResearch(true); setShowStudies(false); }}><FlaskConical size={14} /> Research</button><button className={replay ? "selected-action" : ""} onClick={() => { setReplay((value) => !value); setFeedback({ kind: "info", message: replay ? "Replay preview stopped. Full verified window restored." : "Replay preview is showing an earlier slice of the same verified dataset." }); }}><Play size={14} /> {replay ? "Stop replay" : "Replay"}</button><span className="toolbar-grow" /><button className="toolbar-icon" onClick={retry} aria-label="Refresh public market data"><RefreshCw size={16} /></button><button className="toolbar-icon" onClick={() => setFocusMode((value) => !value)} aria-label="Toggle focus mode"><Maximize2 size={16} /></button></div>
        {feedback && <div className={`terminal-feedback ${feedback.kind}`} role="status"><span>{feedback.kind === "warning" ? <CircleHelp size={14} /> : feedback.kind === "success" ? <Target size={14} /> : <Clock3 size={14} />}</span>{feedback.message}<button onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={13} /></button></div>}
        <ProfessionalChart bars={shownBars} interval={providerInterval} symbol={verifiedSymbol} activeLayers={activeLayers} isLoading={isInitialLoading} isRefreshing={isUpdating && Boolean(displayHistorical)} errorMessage={marketError} coverageLabel={coverageLabel} onRetry={retry} />
        <div className="chart-range-dock"><span className="range-label">History</span>{RANGE_PRESETS.map((range) => <button key={range} className={rangePreset === range ? "selected" : ""} onClick={() => selectRange(range)}>{range}</button>)}<span className="range-dock-divider" /><span className="range-provenance"><Radio size={13} /> {coverageLabel}</span></div>
      </section>
      {showStudies && !focusMode && <StudiesDrawer activeLayers={activeLayers} selectedLayer={selectedLayer} bars={displayHistorical?.bars ?? []} onSelect={setSelectedLayer} onToggle={toggleLayer} onClose={() => setShowStudies(false)} />}
      {showResearch && !focusMode && <ResearchDrawer bars={displayHistorical?.bars ?? []} historical={displayHistorical} symbol={displayHistorical?.symbol ?? symbol} onFeedback={setFeedback} onClose={() => setShowResearch(false)} />}
    </section>

    <footer className="premium-terminal-footer"><span><Radio size={13} /> Public-market research only</span><span><Target size={13} /> Execution disabled · no broker route</span><a className="chart-engine-attribution" href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™ Copyright (c) 2025 TradingView, Inc.</a><span><Clock3 size={13} /> UTC · {new Date().toISOString().slice(11, 16)}</span></footer>
  </main>;
}
