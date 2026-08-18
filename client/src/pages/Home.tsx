import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  deriveChartMetrics,
  getResearchLayerCapability,
  summarizeDataset,
  toProviderInterval,
  type ResearchLayerId,
  type TerminalBar,
  type Timeframe,
} from "@/lib/terminalWorkspace";
import { RANGE_PRESETS, resolveHistoricalWindow, type RangePreset } from "@/lib/marketWindow";
import { clearLocalResearchDraft, createResearchDraftId, readLocalResearchDraft, writeLocalResearchDraft } from "@/lib/researchDraft";
import { calculateEmaSeries, calculateVolumeProfile, calculateVwapSeries, evaluateFeatures, FEATURE_REGISTRY } from "@shared/features/registry";
import { DEFAULT_BACKTEST_CONFIG, runBacktest, STRATEGY_TEMPLATES } from "@shared/backtest/engine";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663159529167/hrJwjiFAGWcrxDpw.png";
const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"];
const MODES = ["Focus", "Canvas", "Research"] as const;
const LAYER_ORDER: ResearchLayerId[] = ["vwap", "ema", "profile", "sessions", "structure", "cvd", "gex"];
type Mode = (typeof MODES)[number];
type MarketState = "CONNECTED" | "DEGRADED" | "UNAVAILABLE";
type Coverage = { requestedFrom: number | null; requestedTo: number | null; effectiveFrom: number | null; effectiveTo: number | null; returnedBars: number; complete: boolean; granularity: string };
type Snapshot = { symbol: string | null; price: number | null; changePercent: number | null; dayHigh: number | null; dayLow: number | null; quoteVolume: number | null; bid: number | null; ask: number | null; at: number; dataStatus: "LIVE" | "UNAVAILABLE"; state: MarketState; reason?: string; retryable?: boolean };
type Historical = { symbol: string; interval: string; bars: TerminalBar[]; fetchedAt: number; sourceTimestamp: number | null; dataStatus: "HISTORICAL" | "UNAVAILABLE"; state: MarketState; coverage: Coverage; reason?: string; retryable?: boolean };

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

function linePath(values: number[], left: number, step: number, scaleY: (value: number) => number) {
  return values.map((value, index) => `${index ? "L" : "M"}${(left + index * step).toFixed(1)},${scaleY(value).toFixed(1)}`).join(" ");
}

function CanvasChart({ bars, interval, activeLayers, replay }: { bars: TerminalBar[]; interval: string; activeLayers: ResearchLayerId[]; replay: boolean }) {
  const renderedBars = replay ? bars.slice(0, Math.max(2, Math.floor(bars.length * 0.62))) : bars;
  const geometry = useMemo(() => {
    if (renderedBars.length < 2) return null;
    const high = Math.max(...renderedBars.map((bar) => bar.h));
    const low = Math.min(...renderedBars.map((bar) => bar.l));
    const range = Math.max(high - low, Math.max(high * 0.0005, 0.01));
    const maxVolume = Math.max(...renderedBars.map((bar) => bar.v), 1);
    const left = 40;
    const right = 984;
    const chartTop = 25;
    const chartHeight = 340;
    const volumeBase = 438;
    const step = (right - left) / Math.max(renderedBars.length - 1, 1);
    const width = Math.max(1.2, Math.min(7, step * 0.58));
    const y = (value: number) => chartTop + ((high - value) / range) * chartHeight;
    const ema20Series = calculateEmaSeries(renderedBars, 20);
    const ema50Series = calculateEmaSeries(renderedBars, 50);
    const vwapSeries = calculateVwapSeries(renderedBars);
    const evaluatedProfile = calculateVolumeProfile(renderedBars, 12);
    const profile = evaluatedProfile?.bins ?? [];
    const profileMax = Math.max(...profile.map((bin) => bin.volume), 1);
    return {
      high,
      low,
      midpoint: (high + low) / 2,
      y,
      left,
      step,
      width,
      volumeBase,
      candles: renderedBars.map((bar, index) => ({ x: left + index * step, open: y(bar.o), close: y(bar.c), high: y(bar.h), low: y(bar.l), volume: (bar.v / maxVolume) * 38, up: bar.c >= bar.o })),
      ema20: linePath(ema20Series, left, step, y),
      ema50: linePath(ema50Series, left, step, y),
      vwap: linePath(vwapSeries, left, step, y),
      profile: profile.map((bin) => ({ y: y(bin.midpoint) - 10, width: (bin.volume / profileMax) * 78 })),
    };
  }, [renderedBars]);
  const metrics = useMemo(() => deriveChartMetrics(renderedBars), [renderedBars]);
  const has = (layer: ResearchLayerId) => activeLayers.includes(layer);

  return <div className="research-chart" aria-label={geometry ? `Verified Gate.io ${interval} historical chart` : "Historical bars are unavailable"}>
    <div className="chart-overlay chart-overlay-left">
      {has("vwap") && <Metric label="VWAP · loaded window" value={formatQuote(metrics.windowVwap)} tone="teal" />}
      {has("ema") && <Metric label="EMA 20 / 50" value={`${formatQuote(metrics.ema20)} / ${formatQuote(metrics.ema50)}`} tone="violet" />}
      {has("structure") && <Metric label="Loaded range" value={metrics.range ? `${formatQuote(metrics.range.high)} — ${formatQuote(metrics.range.low)}` : "—"} tone="muted" />}
    </div>
    {replay && <div className="replay-tag"><Play size={12} /> Replay preview · {renderedBars.length} verified bars</div>}
    {!geometry && <div className="chart-awaiting"><Radio size={15} /><span>Awaiting verified historical bars</span></div>}
    <svg viewBox="0 0 1030 470" preserveAspectRatio="none" role="img" aria-label="Verified public-market research chart">
      {has("sessions") && Array.from({ length: 8 }, (_, index) => <rect key={`session-${index}`} x={index * 128} y="0" width="64" height="470" className="session-zone" />)}
      {[65, 130, 195, 260, 325, 390].map((y) => <line key={`h-${y}`} x1="0" x2="1030" y1={y} y2={y} className="chart-grid" />)}
      {[120, 300, 480, 660, 840].map((x) => <line key={`v-${x}`} x1={x} x2={x} y1="0" y2="470" className="chart-grid" />)}
      {geometry && has("structure") && <>
        <line x1="0" x2="1030" y1={geometry.y(geometry.high)} y2={geometry.y(geometry.high)} className="structure-line high" />
        <line x1="0" x2="1030" y1={geometry.y(geometry.low)} y2={geometry.y(geometry.low)} className="structure-line low" />
        <line x1="0" x2="1030" y1={geometry.y(geometry.midpoint)} y2={geometry.y(geometry.midpoint)} className="structure-line mid" />
      </>}
      {geometry?.candles.map((candle, index) => <g key={index} className={candle.up ? "candle candle-up" : "candle candle-down"}><line x1={candle.x} x2={candle.x} y1={candle.high} y2={candle.low} /><rect x={candle.x - geometry.width / 2} y={Math.min(candle.open, candle.close)} width={geometry.width} height={Math.max(4, Math.abs(candle.open - candle.close))} rx="1" /></g>)}
      {geometry && has("vwap") && <path d={geometry.vwap} className="study-line vwap-line" />}
      {geometry && has("ema") && <><path d={geometry.ema20} className="study-line ema20-line" /><path d={geometry.ema50} className="study-line ema50-line" /></>}
      {geometry?.candles.map((candle, index) => <rect key={`volume-${index}`} className={candle.up ? "volume-bar up" : "volume-bar down"} x={candle.x - geometry.width / 2} y={geometry.volumeBase - candle.volume} width={geometry.width} height={candle.volume} rx="1" />)}
      {geometry && has("profile") && geometry.profile.map((bin, index) => <rect key={`profile-${index}`} className="profile-bar" x={914} y={bin.y} width={bin.width} height={18} rx="2" />)}
      {geometry && <line x1="0" x2="1030" y1={geometry.candles.at(-1)?.close ?? 0} y2={geometry.candles.at(-1)?.close ?? 0} className="reference-line" />}
    </svg>
    <div className="chart-price-axis" aria-hidden="true"><span>{geometry ? formatQuote(geometry.high) : "—"}</span><span>—</span><span>—</span><span>{geometry ? formatQuote(geometry.low) : "—"}</span></div>
  </div>;
}

function Metric({ label, value, tone = "muted" }: { label: string; value: string; tone?: "teal" | "violet" | "muted" }) {
  return <div className={`overlay-metric ${tone}`}><span>{label}</span><b>{value}</b></div>;
}

function LayerPalette({ activeLayers, selectedLayer, onToggle, onInspect }: { activeLayers: ResearchLayerId[]; selectedLayer: ResearchLayerId | null; onToggle: (id: ResearchLayerId) => void; onInspect: (id: ResearchLayerId) => void }) {
  return <aside className="layer-palette" aria-label="Research layers">
    <div className="palette-heading"><LayersMark /><span>Layers</span></div>
    {LAYER_ORDER.map((id) => {
      const layer = getResearchLayerCapability(id)!;
      const active = activeLayers.includes(id);
      return <button key={id} className={`${active ? "active" : ""} ${selectedLayer === id ? "inspected" : ""} ${layer.availability === "unavailable" ? "unavailable" : ""}`} onClick={() => { onInspect(id); onToggle(id); }}>
        <span className="layer-symbol">{layer.category === "flow" ? <Waves size={15} /> : layer.category === "positioning" ? <CircleHelp size={15} /> : layer.category === "context" ? <LayoutDashboard size={15} /> : <LineChart size={15} />}</span>
        <span className="layer-label">{layer.label}</span>
        <span className={`capability-dot ${layer.availability}`} />
      </button>;
    })}
  </aside>;
}

function LayersMark() {
  return <span className="layers-mark"><span /><span /><span /></span>;
}

function LayerInspector({ id, bars }: { id: ResearchLayerId | null; bars: TerminalBar[] }) {
  const features = useMemo(() => evaluateFeatures(bars), [bars]);
  const layer = id ? getResearchLayerCapability(id) : null;
  if (!layer) return null;
  const summary = summarizeDataset(bars);
  const featureId = id === "vwap" ? "vwap" : id === "ema" ? "ema20" : id === "profile" ? "volumeProfile" : id === "structure" ? "structure" : null;
  const definition = featureId ? FEATURE_REGISTRY[featureId] : null;
  const profile = id === "profile" ? features.volumeProfile : null;
  return <aside className="layer-inspector" aria-live="polite">
    <div className="inspector-kicker"><span className={`capability-dot ${layer.availability}`} /> {layer.availability === "available" ? "Verified study" : "Capability gate"}</div>
    <h2>{layer.label}</h2>
    <p>{layer.detail}</p>
    <dl><div><dt>Source</dt><dd>{layer.source}</dd></div><div><dt>Coverage</dt><dd>{summary.barCount ? `${summary.barCount} loaded bars` : "Awaiting bars"}</dd></div>{definition && <><div><dt>Feature version</dt><dd>{definition.id} · v{definition.version}</dd></div><div><dt>Dataset fingerprint</dt><dd>{features.fingerprint ?? "Awaiting bars"}</dd></div></>}{profile && <><div><dt>Profile POC</dt><dd>{formatQuote(profile.pointOfControl)}</dd></div><div><dt>Value area</dt><dd>{formatQuote(profile.valueAreaLow)} — {formatQuote(profile.valueAreaHigh)} · {(profile.valueAreaVolumePct * 100).toFixed(0)}%</dd></div></>}<div><dt>Mode</dt><dd>{layer.availability === "available" ? "Chart layer" : "Unavailable"}</dd></div></dl>
  </aside>;
}

function ResearchCanvas({ bars, historical, symbol, onNotice }: { bars: TerminalBar[]; historical: Historical | null; symbol: string; onNotice: (message: string) => void }) {
  const [hypothesis, setHypothesis] = useState("VWAP acceptance after opening-range expansion");
  const [condition, setCondition] = useState("Price remains above loaded-window VWAP");
  const [draftState, setDraftState] = useState<"idle" | "local" | "syncing" | "synced" | "sync-failed">("idle");
  const [backtest, setBacktest] = useState<ReturnType<typeof runBacktest> | null>(null);
  const { user, loading: authLoading } = useAuth();
  const migratedUserId = useRef<number | null>(null);
  const dataset = summarizeDataset(bars);
  const saveDraft = trpc.research.saveDraft.useMutation();

  const toDraft = () => {
    if (!historical) return null;
    return {
      id: createResearchDraftId(),
      workspaceName: `${symbol.replace("_", " / ")} research workspace`,
      title: hypothesis.slice(0, 180),
      hypothesis,
      condition,
      dataset: {
        provider: "gateio" as const,
        symbol,
        interval: historical.interval,
        requestedFrom: historical.coverage.requestedFrom,
        requestedTo: historical.coverage.requestedTo,
        effectiveFrom: historical.coverage.effectiveFrom,
        effectiveTo: historical.coverage.effectiveTo,
        returnedBars: historical.coverage.returnedBars,
        complete: historical.coverage.complete,
        sourceTimestamp: historical.sourceTimestamp,
        fetchedAt: historical.fetchedAt,
      },
      savedAt: Date.now(),
    };
  };

  useEffect(() => {
    if (!user || migratedUserId.current === user.id) return;
    migratedUserId.current = user.id;
    const pending = readLocalResearchDraft();
    if (!pending) return;
    setDraftState("syncing");
    saveDraft.mutate(pending, {
      onSuccess: () => {
        clearLocalResearchDraft();
        setDraftState("synced");
        onNotice("Your browser-local research draft was migrated to your authenticated workspace.");
      },
      onError: () => {
        setDraftState("sync-failed");
        onNotice("Workspace synchronization is unavailable. Your browser-local draft remains preserved for retry.");
      },
    });
  }, [user, saveDraft, onNotice]);

  const runLoadedBacktest = () => {
    if (!historical) {
      onNotice("A reproducible evaluation requires the same verified historical dataset shown on the chart.");
      return;
    }
    const result = runBacktest("ema20_50_vwap_long", bars, DEFAULT_BACKTEST_CONFIG);
    setBacktest(result);
    onNotice(result.status === "COMPLETED" ? `Reproducible evaluation ${result.runId} completed with next-bar-open fills and explicit zero-cost defaults.` : "The loaded range does not contain enough verified bars for an EMA 50 evaluation.");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const draft = toDraft();
    if (!draft) {
      onNotice("Research drafts require a verified historical dataset. Load a valid range before saving.");
      return;
    }
    if (!user) {
      const saved = writeLocalResearchDraft(draft);
      setDraftState(saved ? "local" : "sync-failed");
      onNotice(saved ? "Research draft saved locally in this browser. Sign in to migrate it to a durable workspace." : "This browser could not retain the draft. Copy your research text before leaving this page.");
      return;
    }
    setDraftState("syncing");
    saveDraft.mutate(draft, {
      onSuccess: () => {
        clearLocalResearchDraft();
        setDraftState("synced");
        onNotice("Research draft synchronized to your authenticated workspace with its verified dataset reference.");
      },
      onError: () => {
        writeLocalResearchDraft(draft);
        setDraftState("sync-failed");
        onNotice("Workspace storage is unavailable. The draft remains preserved locally and is not presented as synchronized.");
      },
    });
  };

  const statusLabel = authLoading ? "Checking workspace" : user ? draftState === "synced" ? "Workspace synced" : draftState === "syncing" ? "Syncing" : "Workspace draft" : "Local draft";
  return <aside className="research-canvas" aria-label="Research canvas">
    <div className="research-canvas-title"><span>Research canvas</span><b>{statusLabel}</b></div>
    <div className="research-flow"><span className="flow-active">1</span><span /> <span>2</span><span /> <span>3</span><span /> <span>4</span></div>
    <form onSubmit={submit} className="research-form">
      <label>Hypothesis<textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} maxLength={180} /></label>
      <label>Validation condition<textarea value={condition} onChange={(event) => setCondition(event.target.value)} maxLength={180} /></label>
      <div className="data-contract"><span>Data contract</span><b>{historical ? `Gate.io · ${historical.symbol} · ${historical.interval}` : "Awaiting verified bars"}</b><small>{dataset.barCount ? `${dataset.barCount} bars · ${formatUtc(historical?.coverage.effectiveFrom)} → ${formatUtc(historical?.coverage.effectiveTo)}` : "No dataset available"}</small></div>
      <button className="primary-action" type="submit" disabled={saveDraft.isPending}><FlaskConical size={15} /> {user ? "Sync research definition" : "Save local research draft"}</button>
    </form>
    <section className="backtest-panel" aria-label="Reproducible research evaluation"><div className="backtest-heading"><span>Reproducible evaluation</span><b>Research only</b></div><p>{STRATEGY_TEMPLATES.ema20_50_vwap_long.label} · signals at bar close, fills at next bar open.</p><div className="backtest-config"><span>Capital ${DEFAULT_BACKTEST_CONFIG.initialCapital.toLocaleString("en-US")}</span><span>Size {DEFAULT_BACKTEST_CONFIG.positionSize}</span><span>Costs explicit</span></div><button className="secondary-action" type="button" onClick={runLoadedBacktest}>Run loaded window</button>{backtest && <div className="backtest-result"><b>{backtest.status === "COMPLETED" ? `Run ${backtest.runId}` : "Evaluation unavailable"}</b>{backtest.metrics ? <><small>{backtest.data.barCount} bars · {backtest.hash}</small><dl><div><dt>Net P&amp;L</dt><dd>{backtest.metrics.netPnl >= 0 ? "+" : ""}{backtest.metrics.netPnl.toFixed(2)}</dd></div><div><dt>Return</dt><dd>{backtest.metrics.returnPct >= 0 ? "+" : ""}{backtest.metrics.returnPct.toFixed(2)}%</dd></div><div><dt>Trades</dt><dd>{backtest.metrics.tradeCount}</dd></div><div><dt>Max drawdown</dt><dd>{backtest.metrics.maxDrawdown.toFixed(2)}</dd></div></dl></> : <small>{backtest.limitations.at(-1)}</small>}<em>Not investment advice. No broker route, forecast, optimization, or intrabar-fill claim.</em></div>}</section>
    <div className="evidence-stack"><span>Evidence requirements</span><p>Configuration fingerprint, effective coverage, source timestamp, and limitations are captured before any backtest is considered.</p>{!user && <button className="secondary-action" type="button" onClick={() => startLogin()}>Sign in to sync this draft</button>}{draftState === "local" && <div className="research-saved">Local-only draft · sign in to migrate</div>}{draftState === "synced" && <div className="research-saved">Workspace draft synced · user review required</div>}{draftState === "sync-failed" && <div className="research-saved warning">Workspace sync failed · local draft retained</div>}</div>
  </aside>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("Canvas");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [rangePreset, setRangePreset] = useState<RangePreset>("1D");
  const [symbol, setSymbol] = useState("QQQX_USDT");
  const [symbolDraft, setSymbolDraft] = useState("QQQX_USDT");
  const [showPalette, setShowPalette] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<ResearchLayerId | null>("vwap");
  const [activeLayers, setActiveLayers] = useState<ResearchLayerId[]>(["vwap", "ema", "profile", "sessions", "structure"]);
  const [replay, setReplay] = useState(false);
  const [notice, setNotice] = useState("Canvas mode is active. Select a layer to inspect its source and method.");
  const providerInterval = toProviderInterval(timeframe);
  const historicalWindow = useMemo(() => resolveHistoricalWindow(rangePreset, providerInterval), [rangePreset, providerInterval]);
  const snapshotQuery = trpc.market.snapshot.useQuery({ symbol }, { refetchInterval: 15_000, staleTime: 10_000, retry: 1 });
  const historicalQuery = trpc.market.bars.useQuery({ interval: providerInterval, symbol, from: historicalWindow.from, to: historicalWindow.to, limit: historicalWindow.requestedBars }, { refetchInterval: 45_000, staleTime: 30_000, retry: 1 });
  const snapshot = snapshotQuery.data as Snapshot | undefined;
  const historical = historicalQuery.data as Historical | undefined;
  const verifiedBars = historical?.dataStatus === "HISTORICAL" ? historical : null;
  const liveSnapshot = snapshot?.dataStatus === "LIVE" ? snapshot : null;
  const statusLabel = liveSnapshot ? "Public snapshot live" : snapshot ? "Public snapshot unavailable" : "Connecting public data";
  const selectedCapability = selectedLayer ? getResearchLayerCapability(selectedLayer) : null;
  const coverageLabel = verifiedBars?.coverage.effectiveFrom && verifiedBars.coverage.effectiveTo
    ? `${formatUtc(verifiedBars.coverage.effectiveFrom)} → ${formatUtc(verifiedBars.coverage.effectiveTo)} · ${verifiedBars.coverage.returnedBars} bars${verifiedBars.coverage.complete ? "" : " · partial coverage"}`
    : `Requested ${rangePreset} window · awaiting verified coverage`;

  const selectTimeframe = (next: Timeframe, source = "Canvas") => {
    setTimeframe(next);
    setNotice(`${source}: loading a verified ${rangePreset} Gate.io window at ${toProviderInterval(next)} granularity.`);
  };
  const selectRange = (next: RangePreset) => {
    setRangePreset(next);
    setNotice(`Loading the requested ${next} historical window. MAX is bounded to the provider request limit; coverage will be shown after validation.`);
  };
  const submitSymbol = (event: FormEvent) => {
    event.preventDefault();
    const next = symbolDraft.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
    setNotice(`Loading verified Gate.io public-market data for ${next}. Unsupported symbols remain unavailable and are not substituted.`);
  };
  const toggleLayer = (id: ResearchLayerId) => {
    const layer = getResearchLayerCapability(id)!;
    if (layer.availability === "unavailable") {
      setNotice(`${layer.label} is unavailable: ${layer.detail}`);
      return;
    }
    setActiveLayers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setNotice(`${layer.label} ${activeLayers.includes(id) ? "hidden" : "shown"}. ${layer.source}.`);
  };
  const refreshResearch = async () => {
    await Promise.all([snapshotQuery.refetch(), historicalQuery.refetch()]);
    setNotice("Public Gate.io snapshot and historical-bar requests were refreshed.");
  };
  const setWorkspaceMode = (next: Mode) => {
    setMode(next);
    if (next === "Focus") setNotice("Focus mode removes persistent inspection surfaces. The chart remains the workspace.");
    if (next === "Canvas") setNotice("Canvas mode is active. Build your chart from verified public-data layers.");
    if (next === "Research") setNotice("Research mode opens a hypothesis-to-evidence canvas beside the same chart.");
  };

  return <main className={`terminal-shell mode-${mode.toLowerCase()}`}>
    <header className="terminal-topbar">
      <div className="brand-lockup"><span className="brand-mark"><img src={LOGO_URL} alt="ZTerminal" /></span><span className="brand-name">ZTERMINAL</span><span className="brand-subtitle">research terminal</span></div>
      <nav className="mode-switcher" aria-label="Research modes">{MODES.map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setWorkspaceMode(item)}>{item === "Focus" ? <Maximize2 size={14} /> : item === "Canvas" ? <CandlestickChart size={14} /> : <TerminalSquare size={14} />}<span>{item}</span></button>)}</nav>
      <div className="top-actions"><button className="icon-button" aria-label="Open research canvas" onClick={() => setWorkspaceMode("Research")}><Search size={17} /></button><button className="icon-button" aria-label="Show layer palette" onClick={() => setShowPalette((visible) => !visible)}><SlidersHorizontal size={17} /></button><span className="user-token"><img src={LOGO_URL} alt="" /></span></div>
    </header>
    <section className="instrument-strip">
      <div className="symbol-block"><div><h1>{(liveSnapshot?.symbol ?? symbol).replace("_", " / ")} <span>★</span></h1><p>Public-market research canvas</p><form className="symbol-search" onSubmit={submitSymbol}><label className="sr-only" htmlFor="market-symbol">Gate.io USDT perpetual symbol</label><input id="market-symbol" value={symbolDraft} onChange={(event) => setSymbolDraft(event.target.value)} placeholder="BTC_USDT" spellCheck="false" /><button type="submit">Load</button></form></div><div className="price-readout"><strong>{formatQuote(liveSnapshot?.price)}</strong><span>{liveSnapshot?.changePercent === null || liveSnapshot?.changePercent === undefined ? "Waiting for verified snapshot" : `${liveSnapshot.changePercent >= 0 ? "+" : ""}${liveSnapshot.changePercent.toFixed(2)}% · 24h`}</span></div></div>
      <div className="instrument-metrics"><InstrumentMetric label="24h high" value={formatQuote(liveSnapshot?.dayHigh)} /><InstrumentMetric label="24h low" value={formatQuote(liveSnapshot?.dayLow)} /><InstrumentMetric label="24h volume" value={formatVolume(liveSnapshot?.quoteVolume)} /></div>
      <div className="instrument-status"><span className={`status-dot ${liveSnapshot ? "live" : ""}`} /> {statusLabel}</div>
      <button className="venue-button" onClick={() => setNotice("Gate.io is the connected public-data venue for this research terminal.")}>Gate.io <ChevronDown size={14} /></button>
    </section>
    <section className="terminal-workspace">
      {showPalette && mode !== "Focus" && <LayerPalette activeLayers={activeLayers} selectedLayer={selectedLayer} onToggle={toggleLayer} onInspect={setSelectedLayer} />}
      <section className="research-stage">
        <div className="chart-toolbar">
          <div className="timeframe-controls" aria-label="Chart timeframes">{TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "selected" : ""} onClick={() => selectTimeframe(item)}>{item}</button>)}</div>
          <div className="toolbar-divider" />
          <button onClick={() => setShowPalette((visible) => !visible)}><LayoutDashboard size={15} /> Layers</button>
          <button onClick={() => setWorkspaceMode("Research")}><TerminalSquare size={15} /> Research</button>
          <button onClick={() => { setReplay((current) => !current); setNotice(replay ? "Replay preview stopped; full verified data is visible." : "Replay preview uses an earlier slice of the same verified dataset."); }}><Play size={15} /> {replay ? "Stop replay" : "Replay"}</button>
          <div className="toolbar-spacer" />
          <button className="tool-icon" aria-label="Refresh research data" onClick={refreshResearch}><RefreshCw size={16} /></button>
          <button className="tool-icon" aria-label="Toggle focus mode" onClick={() => setWorkspaceMode(mode === "Focus" ? "Canvas" : "Focus")}><Maximize2 size={16} /></button>
        </div>
        <div className="terminal-notice" role="status">{notice}</div>
        <div className={`coverage-indicator ${verifiedBars?.state === "DEGRADED" ? "degraded" : ""}`}><Radio size={12} /><span><b>{verifiedBars ? "Verified coverage" : "Requested coverage"}</b><small>{coverageLabel}</small></span></div>
        <div className="analysis-canvas">
          <CanvasChart bars={verifiedBars?.bars ?? []} interval={providerInterval} activeLayers={activeLayers} replay={replay} />
          {mode === "Research" ? <ResearchCanvas bars={verifiedBars?.bars ?? []} historical={verifiedBars} symbol={verifiedBars?.symbol ?? symbol} onNotice={setNotice} /> : mode !== "Focus" && <LayerInspector id={selectedLayer} bars={verifiedBars?.bars ?? []} />}
        </div>
        {mode !== "Focus" && selectedCapability?.availability === "unavailable" && <div className="capability-note"><CircleHelp size={14} /><span><b>{selectedCapability.label} is not displayed.</b> {selectedCapability.detail}</span></div>}
      </section>
    </section>
    <footer className="terminal-dock">
      <div className="dock-ranges">{RANGE_PRESETS.map((range) => <button key={range} className={rangePreset === range ? "selected" : ""} onClick={() => selectRange(range)}>{range}</button>)}</div>
      <div className="dock-provenance"><Radio size={16} /><span><b>Public data contract</b><small>{liveSnapshot ? `Gate.io · ${(liveSnapshot.symbol ?? symbol).replace("_", " / ")} · ${rangePreset} requested` : "Public source reconnecting"}</small></span></div>
      <div className="dock-provenance"><Microscope size={16} /><span><b>Research boundary</b><small>Execution disabled · no broker route</small></span></div>
      <div className="dock-time">UTC · {new Date().toISOString().slice(11, 16)}</div>
    </footer>
  </main>;
}

function InstrumentMetric({ label, value }: { label: string; value: string }) {
  return <div className="instrument-metric"><span>{label}</span><b>{value}</b></div>;
}
