import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CandlestickChart,
  Command,
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
import { calculateUtcSessionVolumeProfile, evaluateFeatures, FEATURE_REGISTRY } from "@shared/features/registry";
import { DEFAULT_BACKTEST_CONFIG, runBacktest, STRATEGY_TEMPLATES, type BacktestMarker } from "@shared/backtest/engine";
import { ProfessionalChart } from "@/components/terminal/ProfessionalChart";
import { CommandPalette } from "@/components/terminal/CommandPalette";
import { isHelpShortcut, isMarketShortcut, isPaletteShortcut, type TerminalCommandId } from "@/lib/terminalCommands";
import { ProtocolResearchDrawer } from "@/components/research/ProtocolResearchDrawer";
import { calculateLiveTapeBuckets, calculateLiveTapeFootprint, findLargeTapePrints, summarizeDepthImbalance, toTimeAndSales, type DepthLevel, type SignedPublicTrade } from "@shared/market/orderFlowContracts";
import { DEFAULT_LOCAL_WORKSPACE, addToLocalWatchlist, readLocalTerminalWorkspace, writeLocalTerminalWorkspace } from "@/lib/localWorkspace";
import zterminalMark from "@/assets/zterminal-mark.png";

const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"];
const LAYER_ORDER: ResearchLayerId[] = ["vwap", "ema", "profile", "sessionProfile", "sessions", "structure", "cvd", "dom", "tape", "largePrints", "footprint", "flowPulse", "gex"];
const STARTING_MARKETS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "QQQX_USDT"];

type MarketState = "CONNECTED" | "DEGRADED" | "UNAVAILABLE";
type Coverage = { requestedFrom: number | null; requestedTo: number | null; effectiveFrom: number | null; effectiveTo: number | null; returnedBars: number; complete: boolean; granularity: string };
type Snapshot = { symbol: string | null; price: number | null; changePercent: number | null; dayHigh: number | null; dayLow: number | null; quoteVolume: number | null; bid: number | null; ask: number | null; at: number; dataStatus: "LIVE" | "UNAVAILABLE"; state: MarketState; reason?: string; retryable?: boolean };
type Historical = { symbol: string; interval: string; bars: TerminalBar[]; fetchedAt: number; sourceTimestamp: number | null; dataStatus: "HISTORICAL" | "UNAVAILABLE"; state: MarketState; coverage: Coverage; reason?: string; retryable?: boolean };
type TradeTape = { provider: "gateio" | "binance_usdm" | "bybit_linear"; symbol: string; state: "CONNECTING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; lastTradeAt: number | null; lastMessageAt: number | null; reason: string | null; trades: SignedPublicTrade[] };
type FeedHealth = { symbol: string; checkedAt: number; feeds: TradeTape[] };
type DepthBook = { symbol: string; state: "CONNECTING" | "SYNCING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; lastDepthAt: number | null; lastUpdateId: number | null; reason: string | null; bids: DepthLevel[]; asks: DepthLevel[] };
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

const FEED_LABEL: Record<TradeTape["provider"], string> = {
  gateio: "Gate.io",
  binance_usdm: "Binance USDⓈ-M",
  bybit_linear: "Bybit Linear",
};

function ExchangeHealthStrip({ health, selectedProvider, onSelect }: { health: FeedHealth | undefined; selectedProvider: TradeTape["provider"]; onSelect: (provider: TradeTape["provider"]) => void }) {
  const feeds = health?.feeds ?? [];
  return <section className="exchange-health-strip" aria-label="Public market connection health">
    <span className="feed-health-label"><Radio size={13} /> Public feeds</span>
    {(["gateio", "binance_usdm", "bybit_linear"] as const).map((provider) => {
      const feed = feeds.find((item) => item.provider === provider);
      const state = feed?.dataStatus ?? "UNAVAILABLE";
      const selected = selectedProvider === provider;
      return <button key={provider} className={`feed-health-chip ${state.toLowerCase()} ${selected ? "selected" : ""}`} onClick={() => onSelect(provider)} aria-pressed={selected} title={feed?.reason ?? `${FEED_LABEL[provider]} public trade tape`}>
        <i aria-hidden="true" /><span>{FEED_LABEL[provider]}</span><b>{state}</b>
      </button>;
    })}
    <small>{feeds.some((feed) => feed.dataStatus !== "LIVE") ? "Non-live tape is withheld from live order-flow studies." : "All requested public tapes are current."}</small>
  </section>;
}

function LiveDepthPanel({ depth }: { depth: DepthBook | undefined }) {
  const isLive = depth?.dataStatus === "LIVE";
  const maximumSize = Math.max(1, ...(depth?.bids ?? []).map(level => level.size), ...(depth?.asks ?? []).map(level => level.size));
  const mid = isLive && depth?.bids[0] && depth.asks[0] ? (depth.bids[0].price + depth.asks[0].price) / 2 : null;
  const renderLevel = (level: DepthLevel, side: "bid" | "ask") => <div className={`depth-row ${side}`} key={`${side}-${level.price}`}><span className="depth-fill"><i style={{ width: `${Math.max(3, (level.size / maximumSize) * 100)}%` }} /></span><b>{formatQuote(level.price)}</b><span>{formatVolume(level.size)}</span></div>;
  return <section className={`live-depth-panel order-flow-panel ${isLive ? "is-live" : "is-pending"}`} aria-label="Live depth of market">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Live DOM</h2></div><span className={`depth-state ${depth?.dataStatus?.toLowerCase() ?? "unavailable"}`}>{depth?.dataStatus ?? "UNAVAILABLE"}</span></header>
    <p>Gate.io public depth · snapshot + sequenced deltas · live-only</p>
    {!isLive ? <div className="depth-notice"><b>{depth?.state === "SYNCING" ? "Reconciling public book" : "Depth not rendered"}</b><span>{depth?.reason ?? "Awaiting an exchange snapshot and compatible depth update."}</span></div> : <><div className="depth-columns"><span>Price</span><span>Size</span></div><div className="depth-levels asks">{depth.asks.slice().reverse().map(level => renderLevel(level, "ask"))}</div><div className="depth-mid"><span>Mid</span><b>{formatQuote(mid)}</b><small>{formatAge(depth.lastDepthAt)}</small></div><div className="depth-levels bids">{depth.bids.map(level => renderLevel(level, "bid"))}</div><footer><span>Update ID {depth.lastUpdateId ?? "—"}</span><span>No historical depth</span></footer></>}
  </section>;
}

function LiveTapePanel({ tape }: { tape: TradeTape | undefined }) {
  const isLive = tape?.dataStatus === "LIVE";
  const rows = isLive ? toTimeAndSales(tape?.trades ?? []).slice(-12).reverse() : [];
  return <section className={`time-sales-panel order-flow-panel ${isLive ? "is-live" : "is-pending"}`} aria-label="Live Time and Sales">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Time &amp; Sales</h2></div><span className={`depth-state ${tape?.dataStatus?.toLowerCase() ?? "unavailable"}`}>{tape?.dataStatus ?? "UNAVAILABLE"}</span></header>
    <p>{FEED_LABEL[tape?.provider ?? "gateio"]} public taker-signed trades · bounded live tape</p>
    {!isLive ? <div className="depth-notice"><b>Tape not rendered</b><span>{tape?.reason ?? "Awaiting a current public trade-tape window."}</span></div> : <><div className="tape-columns"><span>Time</span><span>Price</span><span>Size</span></div><div className="tape-rows">{rows.map(row => <div className={`tape-row ${row.side.toLowerCase()}`} key={row.tradeId}><span>{new Date(row.timestamp).toISOString().slice(11, 19)}</span><b>{formatQuote(row.price)}</b><span>{row.side === "BUY" ? "+" : "−"}{formatVolume(row.size)}</span></div>)}</div><footer><span>{rows.length} shown</span><span>No historical ticks</span></footer></>}
  </section>;
}

function LiveFootprintPanel({ tape }: { tape: TradeTape | undefined }) {
  const isLive = tape?.dataStatus === "LIVE";
  const levels = isLive ? calculateLiveTapeFootprint(tape?.trades ?? []).slice(0, 12) : [];
  return <section className={`footprint-panel order-flow-panel ${isLive ? "is-live" : "is-pending"}`} aria-label="Live trade-tape footprint">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Live footprint</h2></div><span className={`depth-state ${tape?.dataStatus?.toLowerCase() ?? "unavailable"}`}>{tape?.dataStatus ?? "UNAVAILABLE"}</span></header>
    <p>{FEED_LABEL[tape?.provider ?? "gateio"]} exact-price public tape aggregation · current bounded window</p>
    {!isLive ? <div className="depth-notice"><b>Footprint not rendered</b><span>{tape?.reason ?? "Awaiting a current public trade-tape window."}</span></div> : <><div className="footprint-columns"><span>Price</span><span>Buy</span><span>Sell</span><span>Δ</span></div><div className="footprint-rows">{levels.map(level => <div className="footprint-row" key={level.price}><b>{formatQuote(level.price)}</b><span>{formatVolume(level.buySize)}</span><span>{formatVolume(level.sellSize)}</span><em className={level.delta >= 0 ? "positive" : "negative"}>{level.delta >= 0 ? "+" : "−"}{formatVolume(Math.abs(level.delta))}</em></div>)}</div><footer><span>{levels.length} prices</span><span>Not candle volume</span></footer></>}
  </section>;
}

function LiveFlowPulsePanel({ tape, depth }: { tape: TradeTape | undefined; depth: DepthBook | undefined }) {
  const tapeLive = tape?.dataStatus === "LIVE";
  const depthLive = depth?.dataStatus === "LIVE";
  const bucket = tapeLive ? calculateLiveTapeBuckets(tape.trades).at(-1) ?? null : null;
  const depthSummary = depthLive ? summarizeDepthImbalance(depth.bids, depth.asks) : null;
  const tapeMagnitude = bucket ? Math.max(bucket.buySize, bucket.sellSize, 1) : 1;
  const tapeLabel = !bucket ? "Tape pending" : bucket.delta > 0 ? "Taker buys heavier" : bucket.delta < 0 ? "Taker sells heavier" : "Taker flow balanced";
  return <section className={`flow-pulse-panel order-flow-panel ${tapeLive || depthLive ? "is-live" : "is-pending"}`} aria-label="Current flow evidence">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Flow pulse</h2></div><span className={`depth-state ${tapeLive || depthLive ? "live" : "unavailable"}`}>{tapeLive || depthLive ? "CURRENT" : "WITHHELD"}</span></header>
    <p>Current evidence only · no automated alert, prediction, or execution action</p>
    {!tapeLive && !depthLive ? <div className="depth-notice"><b>Flow pulse withheld</b><span>{tape?.reason ?? depth?.reason ?? "Awaiting a current public tape or reconciled Gate.io depth book."}</span></div> : <div className="flow-pulse-grid">
      <article className={tapeLive ? "pulse-evidence live" : "pulse-evidence"}><span>30s tape delta</span>{bucket ? <><b className={bucket.delta >= 0 ? "positive" : "negative"}>{bucket.delta >= 0 ? "+" : "−"}{formatVolume(Math.abs(bucket.delta))}</b><small>{FEED_LABEL[tape!.provider]} · {bucket.tradeCount} reported trades</small><div className="pulse-meter"><i className="buy" style={{ width: `${Math.max(4, (bucket.buySize / tapeMagnitude) * 100)}%` }} /><i className="sell" style={{ width: `${Math.max(4, (bucket.sellSize / tapeMagnitude) * 100)}%` }} /></div><em>{tapeLabel}</em></> : <small>{tape?.reason ?? "Selected public tape is not current."}</small>}</article>
      <article className={depthLive ? "pulse-evidence live" : "pulse-evidence"}><span>Depth imbalance</span>{depthSummary ? <><b className={depthSummary.net >= 0 ? "positive" : "negative"}>{depthSummary.ratio === null ? "—" : `${depthSummary.net >= 0 ? "+" : "−"}${Math.round(Math.abs(depthSummary.ratio) * 100)}%`}</b><small>Gate.io top levels · {depthSummary.state.replace("_", " ").toLowerCase()}</small><div className="depth-balance"><i className="bid" style={{ width: `${Math.max(4, (((depthSummary.ratio ?? 0) + 1) / 2) * 100)}%` }} /><i className="ask" style={{ width: `${Math.max(4, ((1 - (depthSummary.ratio ?? 0)) / 2) * 100)}%` }} /></div><em>Not executable liquidity</em></> : <small>{depth?.reason ?? "Gate.io depth is not current."}</small>}</article>
    </div>}
    <footer><span>Venue-labelled evidence</span><span>Not a trade recommendation</span></footer>
  </section>;
}

function SessionVolumePanel({ bars }: { bars: TerminalBar[] }) {
  const profile = useMemo(() => calculateUtcSessionVolumeProfile(bars, 24), [bars]);
  return <section className={`session-volume-panel order-flow-panel ${profile ? "is-live" : "is-pending"}`} aria-label="UTC session candle-volume context">
    <header><div><span className="drawer-kicker">Candle context</span><h2>UTC session volume</h2></div><span className={`depth-state ${profile ? "live" : "unavailable"}`}>{profile ? "VERIFIED" : "WITHHELD"}</span></header>
    <p>Latest UTC day · candle-close volume bins · not tick volume-at-price</p>
    {!profile ? <div className="depth-notice"><b>Session context withheld</b><span>Awaiting a non-flat latest UTC session from verified historical candles.</span></div> : <><div className="session-volume-metrics"><div><span>POC</span><b>{formatQuote(profile.pointOfControl)}</b></div><div><span>VAH</span><b>{formatQuote(profile.valueAreaHigh)}</b></div><div><span>VAL</span><b>{formatQuote(profile.valueAreaLow)}</b></div></div><div className="session-volume-histogram">{profile.bins.map((bin) => <i key={bin.midpoint} style={{ height: `${Math.max(5, Math.round((bin.volume / Math.max(...profile.bins.map(item => item.volume), 1)) * 100))}%` }} title={`${formatQuote(bin.midpoint)} · ${formatVolume(bin.volume)} candle volume`} />)}</div><footer><span>{profile.candleCount} verified candles · 70% value area</span><span>UTC day only</span></footer></>}
  </section>;
}

function LiveLargePrintsPanel({ tape }: { tape: TradeTape | undefined }) {
  const [minimumReportedSize, setMinimumReportedSize] = useState(10);
  const isLive = tape?.dataStatus === "LIVE";
  const prints = isLive ? findLargeTapePrints(tape?.trades ?? [], minimumReportedSize).slice(-8).reverse() : [];
  return <section className={`large-prints-panel order-flow-panel ${isLive ? "is-live" : "is-pending"}`} aria-label="Selected venue large tape prints">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Large tape prints</h2></div><span className={`depth-state ${tape?.dataStatus?.toLowerCase() ?? "unavailable"}`}>{tape?.dataStatus ?? "UNAVAILABLE"}</span></header>
    <p>{FEED_LABEL[tape?.provider ?? "gateio"]} current bounded tape · reported size, not USD notional</p>
    <label className="large-print-threshold"><span>Minimum reported size</span><input type="number" min="0.000001" step="any" value={minimumReportedSize} onChange={(event) => setMinimumReportedSize(Math.max(0.000001, Number(event.target.value) || 0.000001))} /><small>Selected venue contract units</small></label>
    {!isLive ? <div className="depth-notice"><b>Large prints withheld</b><span>{tape?.reason ?? "Awaiting a current selected public trade-tape window."}</span></div> : <>{prints.length ? <div className="large-print-rows">{prints.map((print) => <div className={`large-print-row ${print.side.toLowerCase()}`} key={print.tradeId}><span>{new Date(print.timestamp).toISOString().slice(11, 19)}</span><b>{formatQuote(print.price)}</b><em>{print.side === "BUY" ? "+" : "−"}{formatVolume(print.size)}</em></div>)}</div> : <div className="depth-notice"><b>No current print meets the threshold</b><span>Threshold applies only to the retained live tape window; it does not query historical ticks.</span></div>}<footer><span>{prints.length} current rows · threshold {formatVolume(minimumReportedSize)}</span><span>Not a trade signal</span></footer></>}
  </section>;
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

function StudiesDrawer({ activeLayers, selectedLayer, bars, cvdState, domState, onSelect, onToggle, onClose }: { activeLayers: ResearchLayerId[]; selectedLayer: ResearchLayerId | null; bars: TerminalBar[]; cvdState: TradeTape["dataStatus"]; domState: DepthBook["dataStatus"] | "UNAVAILABLE"; onSelect: (id: ResearchLayerId) => void; onToggle: (id: ResearchLayerId) => void; onClose: () => void }) {
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
    {selected && <section className="study-detail"><span className={`detail-state ${selected.availability === "available" ? "available" : "locked"}`}>{selected.availability === "available" ? "Verified study" : "Capability gate"}</span><h3>{selected.label}</h3><p>{selected.detail}</p><dl><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Loaded window</dt><dd>{selectedLayer === "cvd" || selectedLayer === "tape" || selectedLayer === "largePrints" || selectedLayer === "footprint" || selectedLayer === "flowPulse" ? "Current selected bounded public tape" : selectedLayer === "dom" ? "Current reconciled public book" : selectedLayer === "sessionProfile" ? "Latest UTC-day segment of verified candles" : dataset.barCount ? `${dataset.barCount.toLocaleString("en-US")} bars` : "Awaiting verified bars"}</dd></div>{definition && <><div><dt>Feature version</dt><dd>{definition.id} · v{definition.version}</dd></div><div><dt>Dataset fingerprint</dt><dd>{features.fingerprint ?? "Awaiting bars"}</dd></div></>}{profile && <><div><dt>Profile POC</dt><dd>{formatQuote(profile.pointOfControl)}</dd></div><div><dt>Value area</dt><dd>{formatQuote(profile.valueAreaLow)} — {formatQuote(profile.valueAreaHigh)}</dd></div></>}<div><dt>Status</dt><dd>{selectedLayer === "cvd" || selectedLayer === "tape" || selectedLayer === "largePrints" || selectedLayer === "footprint" || selectedLayer === "flowPulse" ? cvdState === "LIVE" ? "Rendered from live selected public tape" : `Not rendered while selected live tape is ${cvdState.toLowerCase()}` : selectedLayer === "dom" ? domState === "LIVE" ? "Rendered from reconciled live public depth" : `Not rendered while public depth is ${domState.toLowerCase()}` : selected.availability === "available" ? "Rendered from verified candle data" : "Not rendered without its required dataset"}</dd></div></dl></section>}
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
  const [restoredWorkspace] = useState(() => readLocalTerminalWorkspace());
  const initialSymbol = restoredWorkspace?.symbol ?? DEFAULT_LOCAL_WORKSPACE.symbol;
  const initialTimeframe = TIMEFRAMES.includes(restoredWorkspace?.timeframe as Timeframe) ? restoredWorkspace!.timeframe as Timeframe : DEFAULT_LOCAL_WORKSPACE.timeframe as Timeframe;
  const initialRange = RANGE_PRESETS.includes(restoredWorkspace?.rangePreset as RangePreset) ? restoredWorkspace!.rangePreset as RangePreset : DEFAULT_LOCAL_WORKSPACE.rangePreset as RangePreset;
  const initialLayers = (restoredWorkspace?.activeLayers ?? DEFAULT_LOCAL_WORKSPACE.activeLayers).filter((item): item is ResearchLayerId => LAYER_ORDER.includes(item as ResearchLayerId));
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [rangePreset, setRangePreset] = useState<RangePreset>(initialRange);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [symbolDraft, setSymbolDraft] = useState(initialSymbol);
  const [activeTapeProvider, setActiveTapeProvider] = useState<TradeTape["provider"]>(restoredWorkspace?.activeTapeProvider ?? DEFAULT_LOCAL_WORKSPACE.activeTapeProvider);
  const [watchlist, setWatchlist] = useState(restoredWorkspace?.watchlist ?? DEFAULT_LOCAL_WORKSPACE.watchlist);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);
  const [showStudies, setShowStudies] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<ResearchLayerId | null>("vwap");
  const [activeLayers, setActiveLayers] = useState<ResearchLayerId[]>(initialLayers.length ? initialLayers : ["vwap", "ema", "profile", "structure"]);
  const [replay, setReplay] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [backtestMarkers, setBacktestMarkers] = useState<BacktestMarker[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [accessibilityStatus, setAccessibilityStatus] = useState("");
  const marketInputRef = useRef<HTMLInputElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const [lastVerifiedHistorical, setLastVerifiedHistorical] = useState<Historical | null>(null);
  const [lastVerifiedSnapshot, setLastVerifiedSnapshot] = useState<Snapshot | null>(null);
  const providerInterval = toProviderInterval(timeframe);
  const historicalWindow = useMemo(() => resolveHistoricalWindow(rangePreset, providerInterval), [rangePreset, providerInterval]);
  const snapshotQuery = trpc.market.snapshot.useQuery({ symbol }, { refetchInterval: 15_000, staleTime: 10_000, retry: 1, placeholderData: (previous) => previous });
  const historicalQuery = trpc.market.bars.useQuery({ interval: providerInterval, symbol, from: historicalWindow.from, to: historicalWindow.to, limit: historicalWindow.requestedBars }, { refetchInterval: 45_000, staleTime: 30_000, retry: 1, placeholderData: (previous) => previous });
  const cvdEnabled = activeLayers.includes("cvd");
  const flowPulseEnabled = activeLayers.includes("flowPulse");
  const domEnabled = activeLayers.includes("dom") || flowPulseEnabled;
  const tapeEnabled = activeLayers.some((layer) => layer === "cvd" || layer === "tape" || layer === "largePrints" || layer === "footprint" || layer === "flowPulse");
  const needsGateTradeTape = activeLayers.includes("cvd") || (tapeEnabled && activeTapeProvider === "gateio");
  const gateTradeTapeQuery = trpc.market.tradeTape.useQuery({ symbol, limit: 500 }, { enabled: needsGateTradeTape, refetchInterval: needsGateTradeTape ? 2_500 : false, staleTime: 1_500, retry: 1, placeholderData: (previous) => previous });
  const multiTradeTapeQuery = trpc.market.multiTradeTape.useQuery({ provider: activeTapeProvider === "gateio" ? "binance_usdm" : activeTapeProvider, symbol, limit: 500 }, { enabled: tapeEnabled && activeTapeProvider !== "gateio", refetchInterval: tapeEnabled && activeTapeProvider !== "gateio" ? 2_500 : false, staleTime: 1_500, retry: 1, placeholderData: (previous) => previous });
  const feedHealthQuery = trpc.market.feedHealth.useQuery({ symbol }, { refetchInterval: 4_000, staleTime: 2_500, retry: 1, placeholderData: (previous) => previous });
  const depthQuery = trpc.market.depth.useQuery({ symbol, limit: 12 }, { enabled: domEnabled, refetchInterval: domEnabled ? 1_500 : false, staleTime: 750, retry: 1, placeholderData: (previous) => previous });
  const incomingSnapshot = snapshotQuery.data as Snapshot | undefined;
  const incomingHistorical = historicalQuery.data as Historical | undefined;
  const currentSnapshot = incomingSnapshot?.dataStatus === "LIVE" && incomingSnapshot.symbol === symbol ? incomingSnapshot : null;
  const currentHistorical = incomingHistorical?.dataStatus === "HISTORICAL" && incomingHistorical.symbol === symbol ? incomingHistorical : null;
  const gateTradeTape = gateTradeTapeQuery.data as TradeTape | undefined;
  const multiTradeTape = multiTradeTapeQuery.data as TradeTape | undefined;
  const feedHealth = feedHealthQuery.data as FeedHealth | undefined;
  const depthBook = depthQuery.data as DepthBook | undefined;

  useEffect(() => { if (currentSnapshot) setLastVerifiedSnapshot(currentSnapshot); }, [currentSnapshot]);
  useEffect(() => { if (currentHistorical) setLastVerifiedHistorical(currentHistorical); }, [currentHistorical]);
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null), 5_500); return () => window.clearTimeout(timer); }, [feedback]);
  useEffect(() => {
    setWorkspaceSaved(writeLocalTerminalWorkspace({ symbol, timeframe, rangePreset, activeTapeProvider, activeLayers, watchlist }));
  }, [symbol, timeframe, rangePreset, activeTapeProvider, activeLayers, watchlist]);

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
  const cvdState = gateTradeTape?.symbol === verifiedSymbol ? gateTradeTape.dataStatus : "UNAVAILABLE";
  const gateTapeForVerifiedSymbol = gateTradeTape?.symbol === verifiedSymbol ? gateTradeTape : undefined;
  const selectedTape = activeTapeProvider === "gateio" ? gateTapeForVerifiedSymbol : multiTradeTape?.symbol === verifiedSymbol ? multiTradeTape : undefined;
  const cvdTrades = cvdState === "LIVE" ? gateTapeForVerifiedSymbol?.trades ?? [] : [];
  const domState = depthBook?.symbol === verifiedSymbol ? depthBook.dataStatus : "UNAVAILABLE";
  const orderFlowDockOpen = activeLayers.includes("sessionProfile") || domEnabled || activeLayers.includes("tape") || activeLayers.includes("largePrints") || activeLayers.includes("footprint") || flowPulseEnabled;
  const researchDataset = useMemo(() => {
    if (!displayHistorical) return null;
    return {
      provider: "gateio",
      symbol: displayHistorical.symbol,
      interval: displayHistorical.interval,
      coverageComplete: displayHistorical.coverage.complete,
      returnedBars: displayHistorical.coverage.returnedBars,
      sourceTimestamp: displayHistorical.sourceTimestamp,
      fingerprint: evaluateFeatures(displayHistorical.bars).fingerprint,
    };
  }, [displayHistorical]);
  const backtestDataContext = useMemo(() => {
    if (!displayHistorical) return undefined;
    return {
      provider: "gateio",
      symbol: displayHistorical.symbol,
      interval: displayHistorical.interval,
      requestedFrom: displayHistorical.coverage.requestedFrom,
      requestedTo: displayHistorical.coverage.requestedTo,
      effectiveFrom: displayHistorical.coverage.effectiveFrom,
      effectiveTo: displayHistorical.coverage.effectiveTo,
      sourceTimestamp: displayHistorical.sourceTimestamp,
      fetchedAt: displayHistorical.fetchedAt,
      coverageComplete: displayHistorical.coverage.complete,
      dataStatus: "HISTORICAL" as const,
    };
  }, [displayHistorical]);

  const captureFocusReturn = () => { const active = document.activeElement; focusReturnRef.current = active instanceof HTMLElement ? active : null; };
  const restoreFocus = () => { window.requestAnimationFrame(() => { if (focusReturnRef.current?.isConnected) focusReturnRef.current.focus(); }); };
  const openCommandPalette = () => { captureFocusReturn(); setShortcutHelpOpen(false); setCommandPaletteOpen(true); };
  const closeCommandPalette = () => { setCommandPaletteOpen(false); restoreFocus(); };
  const openShortcutHelp = () => { captureFocusReturn(); setCommandPaletteOpen(false); setShortcutHelpOpen(true); };
  const closeShortcutHelp = () => { setShortcutHelpOpen(false); restoreFocus(); };
  const openStudiesDrawer = () => { captureFocusReturn(); setShowStudies(true); setShowResearch(false); };
  const closeStudiesDrawer = () => { setShowStudies(false); restoreFocus(); };
  const openResearchDrawer = () => { captureFocusReturn(); setShowResearch(true); setShowStudies(false); };
  const closeResearchDrawer = () => { setShowResearch(false); restoreFocus(); };
  const setFocusWorkspace = (next: boolean) => { setFocusMode(next); setAccessibilityStatus(next ? "Focus mode enabled. Chart workspace only. Press Escape to exit." : "Focus mode exited. Full research workstation restored."); };
  const toggleFocusWorkspace = () => setFocusWorkspace(!focusMode);

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
  const retry = () => { void Promise.all([snapshotQuery.refetch(), historicalQuery.refetch(), feedHealthQuery.refetch(), ...(needsGateTradeTape ? [gateTradeTapeQuery.refetch()] : []), ...(activeTapeProvider !== "gateio" && tapeEnabled ? [multiTradeTapeQuery.refetch()] : []), ...(domEnabled ? [depthQuery.refetch()] : [])]); setFeedback({ kind: "info", message: domEnabled ? "Retrying verified Gate.io chart data, selected public tape, connection health, and reconciled Gate.io depth." : tapeEnabled ? "Retrying verified chart data, selected public tape, and connection health." : "Retrying verified chart data and public connection health." }); };
  const runCommand = (id: TerminalCommandId) => {
    closeCommandPalette();
    if (id === "open-research") { openResearchDrawer(); return; }
    if (id === "open-studies") { openStudiesDrawer(); return; }
    if (id === "focus-mode") { setFocusWorkspace(true); return; }
    if (id === "exit-focus") { setFocusWorkspace(false); return; }
    if (id === "open-shortcuts") { openShortcutHelp(); return; }
    if (id === "focus-market") { marketInputRef.current?.focus(); return; }
    if (id === "refresh-market") { retry(); return; }
    if (id === "open-settings") { setFeedback({ kind: "info", message: "Settings status: current theme and chart defaults are session-local; durable account preferences are not configured." }); return; }
    if (id === "open-alerts") { setFeedback({ kind: "info", message: "Alert status: no connected alert provider is configured. No market alerts are active." }); return; }
    setFeedback({ kind: "info", message: "Risk status: sizing is not yet configured. No order, broker, or execution route exists." });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isPaletteShortcut(event) && !focusMode) { event.preventDefault(); openCommandPalette(); return; }
      if (event.key === "Escape") { if (shortcutHelpOpen) { closeShortcutHelp(); return; } if (commandPaletteOpen) { closeCommandPalette(); return; } if (focusMode) { setFocusWorkspace(false); return; } }
      if (editable || commandPaletteOpen || shortcutHelpOpen || focusMode) return;
      if (isHelpShortcut(event)) { event.preventDefault(); openShortcutHelp(); return; }
      if (isMarketShortcut(event)) { event.preventDefault(); marketInputRef.current?.focus(); return; }
      if (event.key.toLowerCase() === "r" && !event.shiftKey) runCommand("open-research");
      if (event.key.toLowerCase() === "s" && !event.shiftKey) runCommand("open-studies");
      if (event.key.toLowerCase() === "f" && !event.shiftKey) runCommand("focus-mode");
      if (event.key.toLowerCase() === "r" && event.shiftKey) runCommand("refresh-market");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, focusMode, retry, shortcutHelpOpen]);
  const resetViewport = () => { setReplay(false); setFeedback({ kind: "info", message: "Chart viewport reset to the latest verified window." }); };
  const shownBars = replay && displayHistorical ? displayHistorical.bars.slice(0, Math.max(60, Math.floor(displayHistorical.bars.length * 0.68))) : displayHistorical?.bars ?? [];

  return <main className={`premium-terminal ${focusMode ? "is-focus" : ""}`}><span className="sr-only" role="status" aria-live="polite">{accessibilityStatus}</span>
    <header className="premium-topbar">
      <button className="brand-lockup" onClick={() => setMarket("BTC_USDT")} aria-label="Load BTC USDT"><img src={zterminalMark} className="brand-mark" alt="" /><span><b>ZTERMINAL</b><small>crypto order-flow research</small></span></button>
      <nav className="top-navigation" aria-label="Workspace navigation"><button className="active"><CandlestickChart size={16} /><span>Chart</span></button><button onClick={openResearchDrawer} className={showResearch ? "active" : ""}><FlaskConical size={16} /><span>Research</span></button><button onClick={openStudiesDrawer} className={showStudies ? "active" : ""}><Layers3 size={16} /><span>Studies</span></button></nav>
      <div className="topbar-actions"><button onClick={openCommandPalette} aria-label="Open command palette"><Command size={16} /></button><button onClick={toggleFocusWorkspace} aria-label="Toggle focus mode" aria-pressed={focusMode}><Focus size={16} /></button><button aria-label="Terminal settings" onClick={() => setFeedback({ kind: "info", message: "Terminal settings and entitlements are planned for the next workspace release." })}><Settings2 size={16} /></button><button aria-label="Notifications" onClick={() => setFeedback({ kind: "info", message: "No research alerts are configured. Alerts remain a future connected-data capability." })}><Bell size={16} /></button><span className="account-orb"><Sparkles size={13} /></span></div>
    </header>

    <section className="instrument-command-bar">
      <div className="market-command-cluster"><form className="market-command" onSubmit={(event) => { event.preventDefault(); setMarket(symbolDraft); }}><Search size={16} /><input ref={marketInputRef} value={symbolDraft} onChange={(event) => setSymbolDraft(event.target.value)} placeholder="Search Gate.io perpetual" aria-label="Gate.io perpetual market" spellCheck="false" /><button type="submit">Load market</button></form><div className="quick-markets" aria-label="Local watchlist">{watchlist.map((item) => <button key={item} className={symbol === item ? "selected" : ""} onClick={() => setMarket(item)}>{item.replace("_", " / ")}</button>)}</div><button className="watchlist-add" onClick={() => { setWatchlist((current) => addToLocalWatchlist(current, symbol)); setFeedback({ kind: "success", message: `${symbol.replace("_", " / ")} saved to this browser’s local watchlist. No market data or account credentials are stored.` }); }} aria-label="Add current market to local watchlist">+ Watch</button></div>
      <div className="market-context-cluster"><ExchangeHealthStrip health={feedHealth} selectedProvider={activeTapeProvider} onSelect={(provider) => { setActiveTapeProvider(provider); setFeedback({ kind: "info", message: provider === "gateio" ? "Gate.io tape selected. CVD, DOM, and chart history share verified Gate.io provenance." : `${FEED_LABEL[provider]} public tape selected. Chart history and DOM remain explicitly Gate.io-only until a cross-venue history/depth contract is released.` }); }} /><div className={`market-state ${requestedMarketIsValid ? "live" : isUpdating ? "updating" : "unavailable"}`}><span /><b>{requestedMarketIsValid ? "Verified chart data" : isUpdating ? "Verifying market" : "Market unavailable"}</b><small>{formatAge(displaySnapshot?.at)}</small></div></div>
    </section>

    <section className="instrument-summary">
      <div className="instrument-headline"><div className="instrument-identity"><span className="venue-tag">GATE.IO <ChevronDown size={12} /></span><h1>{verifiedSymbol.replace("_", " / ")}</h1><span className={requestedMarketIsValid ? "verified-tag" : "pending-tag"}>{requestedMarketIsValid ? "PUBLIC VERIFIED" : isShowingLastVerifiedMarket ? "LAST VERIFIED" : "REQUESTED"}</span>{isShowingLastVerifiedMarket && <small className="requested-instrument">Requested: {symbol.replace("_", " / ")}</small>}</div><div className="main-price"><strong>{formatQuote(displaySnapshot?.price)}</strong><span className={typeof displaySnapshot?.changePercent === "number" && displaySnapshot.changePercent >= 0 ? "positive" : "negative"}>{typeof displaySnapshot?.changePercent === "number" ? `${displaySnapshot.changePercent >= 0 ? "+" : ""}${displaySnapshot.changePercent.toFixed(2)}% · 24h` : "Awaiting verified quote"}</span></div></div>
      <div className="summary-metrics"><InstrumentMetric label="24h high" value={formatQuote(displaySnapshot?.dayHigh)} /><InstrumentMetric label="24h low" value={formatQuote(displaySnapshot?.dayLow)} /><InstrumentMetric label="24h volume" value={formatVolume(displaySnapshot?.quoteVolume)} /><InstrumentMetric label="Bid / ask" value={displaySnapshot?.bid && displaySnapshot?.ask ? `${formatQuote(displaySnapshot.bid)} / ${formatQuote(displaySnapshot.ask)}` : "—"} /></div>
      <div className="terminal-context-cluster"><div className="data-contract-chip"><Radio size={14} /><span><b>{coverage?.complete ? "Verified coverage" : coverage ? "Partial coverage" : "Coverage pending"}</b><small>{coverage ? `${coverage.returnedBars.toLocaleString("en-US")} bars · ${coverage.granularity}` : "No effective historical window"}</small></span></div><div className={`local-workspace-chip ${workspaceSaved ? "saved" : "unsaved"}`} title="Interface preferences and watchlist are stored only in this browser. No market data, credentials, or orders are persisted."><BookOpen size={13} /><span><b>{workspaceSaved ? "Local workspace saved" : "Local workspace unavailable"}</b><small>This browser only</small></span></div></div>
    </section>

    <section className="terminal-main-layout">
      <IconRail showLayers={showStudies} showResearch={showResearch} focusMode={focusMode} onLayers={() => showStudies ? closeStudiesDrawer() : openStudiesDrawer()} onResearch={() => showResearch ? closeResearchDrawer() : openResearchDrawer()} onFocus={toggleFocusWorkspace} onReset={resetViewport} />
      <section className="chart-workspace">
        <div className="chart-command-toolbar"><div className="timeframe-switcher">{TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "selected" : ""} onClick={() => selectTimeframe(item)}>{item}</button>)}</div><span className="toolbar-separator" /><button onClick={openStudiesDrawer}><Layers3 size={14} /> Studies</button><button onClick={openResearchDrawer}><FlaskConical size={14} /> Research</button><button className={replay ? "selected-action" : ""} onClick={() => { setReplay((value) => !value); setFeedback({ kind: "info", message: replay ? "Replay preview stopped. Full verified window restored." : "Replay preview is showing an earlier slice of the same verified dataset." }); }}><Play size={14} /> {replay ? "Stop replay" : "Replay"}</button><span className="toolbar-grow" /><button className="toolbar-icon" onClick={retry} aria-label="Refresh public market data"><RefreshCw size={16} /></button><button className="toolbar-icon" onClick={toggleFocusWorkspace} aria-label="Toggle focus mode" aria-pressed={focusMode}><Maximize2 size={16} /></button></div>
        {feedback && <div className={`terminal-feedback ${feedback.kind}`} role="status"><span>{feedback.kind === "warning" ? <CircleHelp size={14} /> : feedback.kind === "success" ? <Target size={14} /> : <Clock3 size={14} />}</span>{feedback.message}<button onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={13} /></button></div>}
        <ProfessionalChart bars={shownBars} interval={providerInterval} symbol={verifiedSymbol} activeLayers={activeLayers} isLoading={isInitialLoading} isRefreshing={isUpdating && Boolean(displayHistorical)} errorMessage={marketError} coverageLabel={coverageLabel} onRetry={retry} cvdTrades={cvdTrades} cvdState={cvdState} tradeMarkers={backtestMarkers} />
        {orderFlowDockOpen && <aside className="order-flow-dock" aria-label="Opt-in order-flow and candle-context panels">{activeLayers.includes("sessionProfile") && <SessionVolumePanel bars={displayHistorical?.bars ?? []} />}{activeLayers.includes("dom") && <LiveDepthPanel depth={depthBook?.symbol === verifiedSymbol ? depthBook : undefined} />}{activeLayers.includes("tape") && <LiveTapePanel tape={selectedTape} />}{activeLayers.includes("largePrints") && <LiveLargePrintsPanel tape={selectedTape} />}{activeLayers.includes("footprint") && <LiveFootprintPanel tape={selectedTape} />}{flowPulseEnabled && <LiveFlowPulsePanel tape={selectedTape} depth={depthBook?.symbol === verifiedSymbol ? depthBook : undefined} />}</aside>}
        <div className="chart-range-dock"><span className="range-label">History</span>{RANGE_PRESETS.map((range) => <button key={range} className={rangePreset === range ? "selected" : ""} onClick={() => selectRange(range)}>{range}</button>)}<span className="range-dock-divider" /><span className="range-provenance"><Radio size={13} /> {coverageLabel}</span></div>
      </section>
      {showStudies && !focusMode && <StudiesDrawer activeLayers={activeLayers} selectedLayer={selectedLayer} bars={displayHistorical?.bars ?? []} cvdState={cvdState} domState={domState} onSelect={setSelectedLayer} onToggle={toggleLayer} onClose={closeStudiesDrawer} />}
      {showResearch && !focusMode && <ProtocolResearchDrawer dataset={researchDataset} bars={displayHistorical?.bars ?? []} dataContext={backtestDataContext} onBacktestMarkers={setBacktestMarkers} onFeedback={setFeedback} onClose={closeResearchDrawer} />}
    </section>

    {shortcutHelpOpen && !focusMode && <section className="keyboard-shortcuts-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><header><div><span className="drawer-kicker">Workspace controls</span><h2>Keyboard shortcuts</h2></div><button onClick={closeShortcutHelp} aria-label="Close keyboard shortcuts"><X size={16} /></button></header><p>Shortcuts are inactive while typing in a field. They open research controls only; no shortcut creates an order or execution route.</p><dl><div><dt><kbd>⌘</kbd><kbd>Ctrl</kbd> + <kbd>K</kbd></dt><dd>Open command palette</dd></div><div><dt><kbd>/</kbd></dt><dd>Focus market search</dd></div><div><dt><kbd>R</kbd> / <kbd>S</kbd></dt><dd>Open Research / Studies</dd></div><div><dt><kbd>F</kbd> / <kbd>Esc</kbd></dt><dd>Enter Focus mode / exit it</dd></div><div><dt><kbd>Shift</kbd> + <kbd>R</kbd></dt><dd>Refresh verified public data</dd></div><div><dt><kbd>?</kbd></dt><dd>Open this reference</dd></div></dl><footer><span>Use <kbd>↑</kbd><kbd>↓</kbd> and <kbd>Enter</kbd> in the command palette.</span></footer></section>}
    {commandPaletteOpen && !focusMode && <CommandPalette onRun={runCommand} onClose={closeCommandPalette} />}
    <footer className="premium-terminal-footer"><span><Radio size={13} /> Public-market research only</span><span><Target size={13} /> Execution disabled · no broker route</span><a className="chart-engine-attribution" href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™ Copyright (c) 2025 TradingView, Inc.</a><span><Clock3 size={13} /> UTC · {new Date().toISOString().slice(11, 16)}</span></footer>
  </main>;
}
