import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Command,
  CircleHelp,
  Clock3,
  Code2,
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
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getResearchLayerCapability,
  rangeToTimeframe,
  summarizeDataset,
  toProviderInterval,
  type ResearchLayerId,
  type TerminalBar,
  type Timeframe,
} from "@/lib/terminalWorkspace";
import { MAX_VERIFIED_HISTORY_BARS, RANGE_PRESETS, resolveHistoricalWindow, type RangePreset } from "@/lib/marketWindow";
import { clearLocalResearchDraft, createResearchDraftId, readLocalResearchDraft, writeLocalResearchDraft } from "@/lib/researchDraft";
import { calculateUtcSessionVolumeProfile, evaluateFeatures, FEATURE_REGISTRY } from "@shared/features/registry";
import { type BacktestMarker } from "@shared/backtest/engine";
import { ProfessionalChart } from "@/components/terminal/ProfessionalChart";
import { IndicatorLabDrawer } from "@/components/terminal/IndicatorLabDrawer";
import { IndicatorsDialog } from "@/components/terminal/IndicatorsDialog";
import { SettingsDrawer } from "@/components/terminal/SettingsDrawer";
import { TerminalAccountControl, type TerminalWorkspaceState } from "@/components/auth/TerminalAccountControl";
import { CommandPalette } from "@/components/terminal/CommandPalette";
import { isHelpShortcut, isMarketShortcut, isPaletteShortcut, type TerminalCommandId } from "@/lib/terminalCommands";
import { ProtocolResearchDrawer } from "@/components/research/ProtocolResearchDrawer";
import { calculateLiveTapeBuckets, calculateLiveTapeFootprint, findLargeTapePrints, summarizeDepthImbalance, toTimeAndSales, type DepthLevel, type SignedPublicTrade } from "@shared/market/orderFlowContracts";
import { DEFAULT_LOCAL_WORKSPACE, LOCAL_TERMINAL_WORKSPACE_KEY, addToLocalWatchlist, readLocalTerminalWorkspace, writeLocalTerminalWorkspace } from "@/lib/localWorkspace";
import { parseTerminalWorkspacePreferences, type TerminalWorkspacePreferences } from "@shared/workspace/terminalPreferences";
import type { CompiledIndicator } from "@shared/indicators/indicatorRuntime";
import { getNativeStudy, NATIVE_STUDY_IDS, type NativeStudyConfig, type NativeStudyId } from "@shared/indicators/nativeStudies";
import zterminalMark from "@/assets/zterminal-mark.png";

const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"];
const LAYER_ORDER: ResearchLayerId[] = ["vwap", "ema", "profile", "sessionProfile", "sessions", "structure", "cvd", "dom", "tape", "largePrints", "footprint", "flowPulse", "gex"];
const STARTING_MARKETS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "QQQX_USDT"];

type MarketState = "CONNECTED" | "DEGRADED" | "UNAVAILABLE";
type WorkspaceMode = "focus" | "canvas" | "research";
type Coverage = { requestedFrom: number | null; requestedTo: number | null; effectiveFrom: number | null; effectiveTo: number | null; returnedBars: number; complete: boolean; granularity: string };
type Snapshot = { symbol: string | null; price: number | null; changePercent: number | null; dayHigh: number | null; dayLow: number | null; quoteVolume: number | null; bid: number | null; ask: number | null; at: number; dataStatus: "LIVE" | "UNAVAILABLE"; state: MarketState; reason?: string; retryable?: boolean };
type Historical = { symbol: string; interval: string; bars: TerminalBar[]; fetchedAt: number; sourceTimestamp: number | null; dataStatus: "HISTORICAL" | "UNAVAILABLE"; state: MarketState; coverage: Coverage; reason?: string; retryable?: boolean };
type IntrabarDelta = { symbol: string | null; interval: string; intrabarInterval: string | null; dataStatus: "HISTORICAL" | "UNAVAILABLE"; state: MarketState; method: "INTRABAR_CANDLE_DIRECTION_ESTIMATE"; points: Array<{ t: number; delta: number; cumulativeDelta: number; intrabarCount: number }>; coverage: Coverage; reason?: string; fetchedAt: number };
type TradeTape = { provider: "gateio" | "binance_usdm" | "bybit_linear" | "coinbase_exchange"; symbol: string; state: "CONNECTING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; lastTradeAt: number | null; lastMessageAt: number | null; reason: string | null; trades: SignedPublicTrade[] };
type FeedHealth = { symbol: string; checkedAt: number; feeds: TradeTape[] };
type DepthBook = { symbol: string; state: "CONNECTING" | "SYNCING" | "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE"; lastDepthAt: number | null; lastUpdateId: number | null; reason: string | null; bids: DepthLevel[]; asks: DepthLevel[] };
type Feedback = { kind: "info" | "success" | "warning"; message: string } | null;

type CloudPreferenceSnapshot = {
  preferences: TerminalWorkspacePreferences;
  revision: number | null;
  updatedAt: Date | string | null;
};

function toCloudPreferences(value: { symbol: string; timeframe: string; rangePreset: string; activeTapeProvider: string; workspaceMode: WorkspaceMode; activeLayers: string[]; watchlist: string[]; nativeStudies: NativeStudyConfig[]; indicatorFavorites: NativeStudyId[] }): TerminalWorkspacePreferences | null {
  return parseTerminalWorkspacePreferences({ version: 1, ...value });
}

function preferenceFingerprint(value: TerminalWorkspacePreferences) {
  return JSON.stringify(value);
}

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

const FEED_LABEL: Record<TradeTape["provider"], string> = {
  gateio: "Gate.io",
  binance_usdm: "Binance USDⓈ-M",
  bybit_linear: "Bybit Linear",
  coinbase_exchange: "Coinbase Exchange USD Spot",
};

function ExchangeHealthStrip({ health, selectedProvider, onSelect }: { health: FeedHealth | undefined; selectedProvider: TradeTape["provider"]; onSelect: (provider: TradeTape["provider"]) => void }) {
  const feeds = health?.feeds ?? [];
  return <section className="exchange-health-strip" aria-label="Public market connection health">
    <span className="feed-health-label"><Radio size={13} /> Public feeds</span>
    {(["gateio", "binance_usdm", "bybit_linear", "coinbase_exchange"] as const).map((provider) => {
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
    <p>{FEED_LABEL[tape?.provider ?? "gateio"]} {tape?.provider === "coinbase_exchange" ? "public matches · maker side inverted to derived taker side" : "public taker-signed trades"} · bounded live tape</p>
    {!isLive ? <div className="depth-notice"><b>Tape not rendered</b><span>{tape?.reason ?? "Awaiting a current public trade-tape window."}</span></div> : <><div className="tape-columns"><span>Time</span><span>Price</span><span>Size</span></div><div className="tape-rows">{rows.map(row => <div className={`tape-row ${row.side.toLowerCase()}`} key={row.tradeId}><span>{new Date(row.timestamp).toISOString().slice(11, 19)}</span><b>{formatQuote(row.price)}</b><span>{row.side === "BUY" ? "+" : "−"}{formatVolume(row.size)}</span></div>)}</div><footer><span>{rows.length} shown</span><span>No historical ticks</span></footer></>}
  </section>;
}

function LiveFootprintPanel({ tape }: { tape: TradeTape | undefined }) {
  const isLive = tape?.dataStatus === "LIVE";
  const levels = isLive ? calculateLiveTapeFootprint(tape?.trades ?? []).slice(0, 12) : [];
  return <section className={`footprint-panel order-flow-panel ${isLive ? "is-live" : "is-pending"}`} aria-label="Live trade-tape footprint">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Live footprint</h2></div><span className={`depth-state ${tape?.dataStatus?.toLowerCase() ?? "unavailable"}`}>{tape?.dataStatus ?? "UNAVAILABLE"}</span></header>
    <p>{FEED_LABEL[tape?.provider ?? "gateio"]} exact-price public tape aggregation · current bounded window{tape?.provider === "coinbase_exchange" ? " · derived taker side" : ""}</p>
    {!isLive ? <div className="depth-notice"><b>Footprint not rendered</b><span>{tape?.reason ?? "Awaiting a current public trade-tape window."}</span></div> : <><div className="footprint-columns"><span>Price</span><span>Buy</span><span>Sell</span><span>Δ</span></div><div className="footprint-rows">{levels.map(level => <div className="footprint-row" key={level.price}><b>{formatQuote(level.price)}</b><span>{formatVolume(level.buySize)}</span><span>{formatVolume(level.sellSize)}</span><em className={level.delta >= 0 ? "positive" : "negative"}>{level.delta >= 0 ? "+" : "−"}{formatVolume(Math.abs(level.delta))}</em></div>)}</div><footer><span>{levels.length} prices</span><span>Not candle volume</span></footer></>}
  </section>;
}

function LiveFlowPulsePanel({ tape, depth, tapeWithheldReason }: { tape: TradeTape | undefined; depth: DepthBook | undefined; tapeWithheldReason?: string }) {
  const tapeLive = tape?.dataStatus === "LIVE";
  const depthLive = depth?.dataStatus === "LIVE";
  const pulseStatus = tapeLive && depthLive ? "CURRENT" : tapeLive ? "TAPE ONLY" : depthLive ? "DEPTH ONLY" : "WITHHELD";
  const bucket = tapeLive ? calculateLiveTapeBuckets(tape.trades).at(-1) ?? null : null;
  const depthSummary = depthLive ? summarizeDepthImbalance(depth.bids, depth.asks) : null;
  const tapeMagnitude = bucket ? Math.max(bucket.buySize, bucket.sellSize, 1) : 1;
  const tapeLabel = !bucket ? "Tape pending" : bucket.delta > 0 ? "Taker buys heavier" : bucket.delta < 0 ? "Taker sells heavier" : "Taker flow balanced";
  return <section className={`flow-pulse-panel order-flow-panel ${tapeLive || depthLive ? "is-live" : "is-pending"}`} aria-label="Current flow evidence">
    <header><div><span className="drawer-kicker">Order flow</span><h2>Flow pulse</h2></div><span className={`depth-state ${tapeLive || depthLive ? "live" : "unavailable"}`}>{pulseStatus}</span></header>
    <p>{tapeWithheldReason ?? "Current evidence only · no automated alert, prediction, or execution action"}</p>
    {!tapeLive && !depthLive ? <div className="depth-notice"><b>Flow pulse withheld</b><span>{tapeWithheldReason ?? tape?.reason ?? depth?.reason ?? "Awaiting a current public tape or reconciled Gate.io depth book."}</span></div> : <div className="flow-pulse-grid">
      <article className={tapeLive ? "pulse-evidence live" : "pulse-evidence"}><span>30s tape delta</span>{bucket ? <><b className={bucket.delta >= 0 ? "positive" : "negative"}>{bucket.delta >= 0 ? "+" : "−"}{formatVolume(Math.abs(bucket.delta))}</b><small>{FEED_LABEL[tape!.provider]} · {bucket.tradeCount} reported trades</small><div className="pulse-meter"><i className="buy" style={{ width: `${Math.max(4, (bucket.buySize / tapeMagnitude) * 100)}%` }} /><i className="sell" style={{ width: `${Math.max(4, (bucket.sellSize / tapeMagnitude) * 100)}%` }} /></div><em>{tapeLabel}</em></> : <small>{tapeWithheldReason ?? tape?.reason ?? "Selected public tape is not current."}</small>}</article>
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
    <p>{FEED_LABEL[tape?.provider ?? "gateio"]} current bounded tape · reported size, not USD notional{tape?.provider === "coinbase_exchange" ? " · derived taker side" : ""}</p>
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

function StudiesDrawer({ activeLayers, selectedLayer, bars, cvdState, domState, customIndicators, nativeStudies, onSelect, onToggle, onOpenIndicators, onOpenIndicatorLab, onClose }: { activeLayers: ResearchLayerId[]; selectedLayer: ResearchLayerId | null; bars: TerminalBar[]; cvdState: TradeTape["dataStatus"]; domState: DepthBook["dataStatus"] | "UNAVAILABLE"; customIndicators: CompiledIndicator[]; nativeStudies: NativeStudyConfig[]; onSelect: (id: ResearchLayerId) => void; onToggle: (id: ResearchLayerId) => void; onOpenIndicators: () => void; onOpenIndicatorLab: () => void; onClose: () => void }) {
  const selected = selectedLayer ? getResearchLayerCapability(selectedLayer) : null;
  const features = useMemo(() => evaluateFeatures(bars), [bars]);
  const dataset = summarizeDataset(bars);
  const profile = selectedLayer === "profile" ? features.volumeProfile : null;
  const definitionId = selectedLayer === "vwap" ? "vwap" : selectedLayer === "ema" ? "ema20" : selectedLayer === "profile" ? "volumeProfile" : null;
  const definition = definitionId ? FEATURE_REGISTRY[definitionId] : null;

  const groups: Array<{ label: string; layers: ResearchLayerId[] }> = [
    { label: "Price", layers: ["vwap", "ema", "sessions"] },
    { label: "Structure", layers: ["structure"] },
    { label: "Flow", layers: ["cvd", "dom", "tape", "largePrints", "footprint", "flowPulse"] },
    { label: "Value", layers: ["profile", "sessionProfile"] },
    { label: "Positioning", layers: ["gex"] },
  ];
  const renderLayer = (id: ResearchLayerId) => {
    const layer = getResearchLayerCapability(id)!;
    const active = activeLayers.includes(id);
    const unavailable = layer.availability === "unavailable";
    const Icon = layer.category === "flow" ? Waves : layer.category === "positioning" ? CircleHelp : layer.category === "context" ? LayoutPanelTop : LineChart;
    return <div className={`study-row ${selectedLayer === id ? "selected" : ""} ${unavailable ? "locked" : ""}`} key={id}>
      <button className="study-select" onClick={() => onSelect(id)}><span className="study-icon"><Icon size={14} /></span><span><b>{layer.label}</b><small>{unavailable ? "Data provider required" : layer.category}</small></span></button>
      <button className={`study-toggle ${active ? "enabled" : ""}`} disabled={unavailable} onClick={() => onToggle(id)} aria-label={`${active ? "Hide" : "Show"} ${layer.label}`}><span /></button>
    </div>;
  };
  return <aside className="studies-drawer layered-studies-panel" aria-label="Analysis layers">
    <div className="drawer-heading"><div><span className="drawer-kicker">Canvas workspace</span><h2>Layers</h2></div><button onClick={onClose} aria-label="Close analysis layers"><X size={16} /></button></div>
    <div className="layer-panel-actions"><span>Verified studies only</span><div><button className="terminal-secondary-button" onClick={onOpenIndicators}>Browse indicators</button><button className="terminal-secondary-button" onClick={onOpenIndicatorLab}>Create indicator</button></div></div>
    <div className="study-list">{groups.map((group) => <section className="study-group" key={group.label}><h3>{group.label}</h3>{group.layers.map(renderLayer)}</section>)}<section className="study-group liquidity-gate"><h3>Liquidity</h3><div className="study-row locked"><span className="study-select"><span className="study-icon"><CircleHelp size={14} /></span><span><b>Resting liquidity</b><small>Verified public source required</small></span></span></div></section><section className="study-group native-indicator-group"><h3>Installed indicators</h3>{nativeStudies.length ? nativeStudies.map((study) => <div className="study-row selected" key={study.id}><span className="study-select"><span className="study-icon"><LineChart size={14} /></span><span><b>{getNativeStudy(study.id)?.shortLabel ?? study.id}</b><small>{getNativeStudy(study.id)?.dataContract === "VERIFIED_INTRABAR" ? "Verified intrabar gate" : "Verified candle study"}</small></span></span></div>) : <button className="empty-indicator-row" onClick={onOpenIndicators}>Browse ZTerminal native indicators</button>}</section><section className="study-group custom-indicator-group"><h3>My indicators</h3>{customIndicators.length ? customIndicators.map((indicator) => <div className="study-row selected" key={indicator.definition.name}><span className="study-select"><span className="study-icon"><Code2 size={14} /></span><span><b>{indicator.definition.name}</b><small>Closed runtime · active on chart</small></span></span></div>) : <button className="empty-indicator-row" onClick={onOpenIndicatorLab}>Create a local indicator in the closed Indicator Lab</button>}</section></div>
    {selected && <section className="study-detail"><span className={`detail-state ${selected.availability === "available" ? "available" : "locked"}`}>{selected.availability === "available" ? "Verified study" : "Capability gate"}</span><h3>{selected.label}</h3><p>{selected.detail}</p><dl><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Loaded window</dt><dd>{selectedLayer === "cvd" || selectedLayer === "tape" || selectedLayer === "largePrints" || selectedLayer === "footprint" || selectedLayer === "flowPulse" ? "Current selected bounded public tape" : selectedLayer === "dom" ? "Current reconciled public book" : selectedLayer === "sessionProfile" ? "Latest UTC-day segment of verified candles" : dataset.barCount ? `${dataset.barCount.toLocaleString("en-US")} bars` : "Awaiting verified bars"}</dd></div>{definition && <><div><dt>Feature version</dt><dd>{definition.id} · v{definition.version}</dd></div><div><dt>Dataset fingerprint</dt><dd>{features.fingerprint ?? "Awaiting bars"}</dd></div></>}{profile && <><div><dt>Profile POC</dt><dd>{formatQuote(profile.pointOfControl)}</dd></div><div><dt>Value area</dt><dd>{formatQuote(profile.valueAreaLow)} — {formatQuote(profile.valueAreaHigh)}</dd></div></>}<div><dt>Status</dt><dd>{selectedLayer === "cvd" || selectedLayer === "tape" || selectedLayer === "largePrints" || selectedLayer === "footprint" || selectedLayer === "flowPulse" ? cvdState === "LIVE" ? "Rendered from live selected public tape" : `Not rendered while selected live tape is ${cvdState.toLowerCase()}` : selectedLayer === "dom" ? domState === "LIVE" ? "Rendered from reconciled live public depth" : `Not rendered while public depth is ${domState.toLowerCase()}` : selected.availability === "available" ? "Rendered from verified candle data" : "Not rendered without its required dataset"}</dd></div></dl></section>}
  </aside>;
}

function ResearchDrawer({ bars, historical, symbol, onFeedback, onClose }: { bars: TerminalBar[]; historical: Historical | null; symbol: string; onFeedback: (feedback: Feedback) => void; onClose: () => void }) {
  const [hypothesis, setHypothesis] = useState("VWAP acceptance after opening-range expansion");
  const [condition, setCondition] = useState("Price remains above loaded-window VWAP");
  const [draftState, setDraftState] = useState<"idle" | "local" | "syncing" | "synced" | "sync-failed">("idle");
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


  const status = authLoading ? "Checking workspace" : user ? draftState === "synced" ? "Workspace synced" : draftState === "syncing" ? "Syncing" : "Workspace draft" : "Local draft";
  return <aside className="research-thesis-panel" aria-label="Research hypothesis workspace">
    <div className="drawer-heading"><div><span className="drawer-kicker">Research workspace</span><h2>Hypothesis lab</h2></div><button onClick={onClose} aria-label="Close research workspace"><X size={16} /></button></div>
    <div className="research-status"><FlaskConical size={14} /><span>{status}</span><b>Research only</b></div>
    <form onSubmit={save} className="research-form"><label>Hypothesis<textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} maxLength={180} /></label><label>Evidence / invalidation<textarea value={condition} onChange={(event) => setCondition(event.target.value)} maxLength={180} placeholder="What confirms or invalidates this historical research question?" /></label><div className="research-data-contract"><span>Verified data contract</span><b>{historical ? `Gate.io · ${historical.symbol} · ${historical.interval}` : "Awaiting verified window"}</b><small>{dataset.barCount ? `${dataset.barCount.toLocaleString("en-US")} bars · ${formatUtc(historical?.coverage.effectiveFrom)} → ${formatUtc(historical?.coverage.effectiveTo)}` : "No verified bars loaded"}</small></div><button className="terminal-primary-button" type="submit" disabled={saveDraft.isPending}><BookOpen size={14} /> {user ? "Sync thesis" : "Save local thesis"}</button></form>
    <section className="research-evidence"><span>Historical evidence only</span><p>Use the adjacent Strategy Tester to compile a closed source and run the currently verified window. Results are never predicted, optimized, or routed to a broker.</p>{!user && <a className="terminal-secondary-button" href="/account">Sign in to sync this thesis</a>}{draftState === "local" && <div>Local-only thesis · sign in to migrate</div>}{draftState === "synced" && <div>Workspace thesis synced · review required</div>}{draftState === "sync-failed" && <div className="warning">Workspace sync unavailable · local thesis retained</div>}</section>
  </aside>;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [restoredWorkspace] = useState(() => readLocalTerminalWorkspace());
  const initialLocalUpdatedAt = useRef(restoredWorkspace?.updatedAt ?? null);
  const initializedWorkspaceUser = useRef<number | null>(null);
  const syncedPreferenceFingerprint = useRef<string | null>(null);
  const syncTimer = useRef<number | null>(null);
  const [workspaceState, setWorkspaceState] = useState<TerminalWorkspaceState>("local");
  const [cloudRevision, setCloudRevision] = useState<number | null>(null);
  const [pendingCloudSnapshot, setPendingCloudSnapshot] = useState<CloudPreferenceSnapshot | null>(null);
  const [showWorkspaceConflict, setShowWorkspaceConflict] = useState(false);
  const initialSymbol = restoredWorkspace?.symbol ?? DEFAULT_LOCAL_WORKSPACE.symbol;
  const initialTimeframe = TIMEFRAMES.includes(restoredWorkspace?.timeframe as Timeframe) ? restoredWorkspace!.timeframe as Timeframe : DEFAULT_LOCAL_WORKSPACE.timeframe as Timeframe;
  const initialRange = RANGE_PRESETS.includes(restoredWorkspace?.rangePreset as RangePreset) ? restoredWorkspace!.rangePreset as RangePreset : DEFAULT_LOCAL_WORKSPACE.rangePreset as RangePreset;
  const initialLayers = (restoredWorkspace?.activeLayers ?? DEFAULT_LOCAL_WORKSPACE.activeLayers).filter((item): item is ResearchLayerId => LAYER_ORDER.includes(item as ResearchLayerId));
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [rangePreset, setRangePreset] = useState<RangePreset>(initialRange);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [symbolDraft, setSymbolDraft] = useState(initialSymbol);
  const [activeTapeProvider, setActiveTapeProvider] = useState<TradeTape["provider"]>(restoredWorkspace?.activeTapeProvider ?? DEFAULT_LOCAL_WORKSPACE.activeTapeProvider);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(restoredWorkspace?.workspaceMode ?? DEFAULT_LOCAL_WORKSPACE.workspaceMode);
  const [watchlist, setWatchlist] = useState(restoredWorkspace?.watchlist ?? DEFAULT_LOCAL_WORKSPACE.watchlist);
  const [, setWorkspaceSaved] = useState(false);
  const [showStudies, setShowStudies] = useState(false);
  const [showIndicatorsDialog, setShowIndicatorsDialog] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [showUtilityRail, setShowUtilityRail] = useState(true);
  const [showIndicatorLab, setShowIndicatorLab] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customIndicators, setCustomIndicators] = useState<CompiledIndicator[]>([]);
  const [nativeStudies, setNativeStudies] = useState<NativeStudyConfig[]>(() => {
    const saved = restoredWorkspace?.nativeStudies ?? DEFAULT_LOCAL_WORKSPACE.nativeStudies;
    return saved.filter((study): study is NativeStudyConfig => NATIVE_STUDY_IDS.includes(study.id as NativeStudyId)).map((study) => ({ id: study.id, ...(study.inputs ? { inputs: study.inputs } : {}) }));
  });
  const [indicatorFavorites, setIndicatorFavorites] = useState<NativeStudyId[]>(() => (restoredWorkspace?.indicatorFavorites ?? DEFAULT_LOCAL_WORKSPACE.indicatorFavorites).filter((id): id is NativeStudyId => NATIVE_STUDY_IDS.includes(id as NativeStudyId)));
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
  const workspaceQuery = trpc.workspace.getTerminal.useQuery(undefined, { enabled: Boolean(user), staleTime: 15_000, retry: 1 });
  const saveWorkspace = trpc.workspace.saveTerminal.useMutation();
  const selectedProviderInterval = toProviderInterval(timeframe);
  const selectedHistoricalWindow = useMemo(() => resolveHistoricalWindow(rangePreset, selectedProviderInterval), [rangePreset, selectedProviderInterval]);
  const effectiveTimeframe = selectedHistoricalWindow.requiredBars > MAX_VERIFIED_HISTORY_BARS ? rangeToTimeframe(rangePreset) : timeframe;
  const providerInterval = toProviderInterval(effectiveTimeframe);
  const historicalWindow = useMemo(() => resolveHistoricalWindow(rangePreset, providerInterval), [rangePreset, providerInterval]);
  const snapshotQuery = trpc.market.snapshot.useQuery({ symbol }, { refetchInterval: 15_000, staleTime: 10_000, retry: 1, placeholderData: (previous) => previous });
  const historicalQuery = trpc.market.bars.useQuery({ interval: providerInterval, symbol, from: historicalWindow.from, to: historicalWindow.to, limit: historicalWindow.requestedBars }, { refetchInterval: 45_000, staleTime: 30_000, retry: 1, placeholderData: (previous) => previous });
  const intrabarDeltaQuery = trpc.market.intrabarDelta.useQuery({ interval: providerInterval, symbol, from: historicalWindow.from, to: historicalWindow.to }, { enabled: (showStudies || showIndicatorsDialog) && historicalWindow.from !== null && historicalWindow.to !== null, staleTime: 30_000, retry: 1, placeholderData: (previous) => previous });
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
  const intrabarDelta = intrabarDeltaQuery.data as IntrabarDelta | undefined;
  const currentSnapshot = incomingSnapshot?.dataStatus === "LIVE" && incomingSnapshot.symbol === symbol ? incomingSnapshot : null;
  const currentHistorical = incomingHistorical?.dataStatus === "HISTORICAL" && incomingHistorical.symbol === symbol ? incomingHistorical : null;
  const gateTradeTape = gateTradeTapeQuery.data as TradeTape | undefined;
  const multiTradeTape = multiTradeTapeQuery.data as TradeTape | undefined;
  const feedHealth = feedHealthQuery.data as FeedHealth | undefined;
  const depthBook = depthQuery.data as DepthBook | undefined;

  const currentCloudPreferences = useMemo(() => toCloudPreferences({ symbol, timeframe, rangePreset, activeTapeProvider, workspaceMode, activeLayers, watchlist, nativeStudies, indicatorFavorites }), [symbol, timeframe, rangePreset, activeTapeProvider, workspaceMode, activeLayers, watchlist, nativeStudies, indicatorFavorites]);

  const applyCloudPreferences = (preferences: TerminalWorkspacePreferences) => {
    setSymbol(preferences.symbol);
    setSymbolDraft(preferences.symbol);
    setTimeframe(preferences.timeframe as Timeframe);
    setRangePreset(preferences.rangePreset as RangePreset);
    setActiveTapeProvider(preferences.activeTapeProvider);
    setWorkspaceMode(preferences.workspaceMode);
    setActiveLayers(preferences.activeLayers.filter((item): item is ResearchLayerId => LAYER_ORDER.includes(item as ResearchLayerId)));
    setWatchlist(preferences.watchlist);
    setNativeStudies(preferences.nativeStudies.filter((study): study is NativeStudyConfig => NATIVE_STUDY_IDS.includes(study.id as NativeStudyId)).map((study) => ({ id: study.id, ...(study.inputs ? { inputs: study.inputs } : {}) })));
    setIndicatorFavorites(preferences.indicatorFavorites.filter((id): id is NativeStudyId => NATIVE_STUDY_IDS.includes(id as NativeStudyId)));
  };

  const persistCurrentWorkspace = (expectedRevision: number | null | undefined = cloudRevision) => {
    if (!currentCloudPreferences) {
      setWorkspaceState("offline");
      setFeedback({ kind: "warning", message: "This device workspace is invalid and was not sent to the cloud." });
      return;
    }
    setWorkspaceState("syncing");
    saveWorkspace.mutate({ preferences: currentCloudPreferences, expectedRevision }, {
      onSuccess: (stored) => {
        const preferences = stored.preferences as TerminalWorkspacePreferences | null;
        if (!preferences) {
          setWorkspaceState("offline");
          setFeedback({ kind: "warning", message: "Cloud workspace storage returned no valid preference snapshot. This device copy is retained." });
          return;
        }
        setCloudRevision(stored.revision);
        syncedPreferenceFingerprint.current = preferenceFingerprint(preferences);
        setPendingCloudSnapshot(null);
        setWorkspaceState("synced");
        setFeedback({ kind: "success", message: "Terminal preferences synced to your cloud workspace." });
      },
      onError: (error) => {
        if (error.message.includes("another device")) {
          initializedWorkspaceUser.current = null;
          setWorkspaceState("conflict");
          void workspaceQuery.refetch();
          setFeedback({ kind: "warning", message: "Your cloud workspace changed elsewhere. Review the two copies before replacing it." });
          return;
        }
        setWorkspaceState("offline");
        setFeedback({ kind: "warning", message: "Cloud workspace is unavailable. This device keeps your preferences for retry." });
      },
    });
  };

  const reviewWorkspaceSync = () => {
    if (pendingCloudSnapshot) {
      setShowWorkspaceConflict(true);
      return;
    }
    persistCurrentWorkspace(cloudRevision);
  };

  useEffect(() => {
    if (effectiveTimeframe !== timeframe) setTimeframe(effectiveTimeframe);
  }, [effectiveTimeframe, timeframe]);
  useEffect(() => { if (currentSnapshot) setLastVerifiedSnapshot(currentSnapshot); }, [currentSnapshot]);
  useEffect(() => { if (currentHistorical) setLastVerifiedHistorical(currentHistorical); }, [currentHistorical]);
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null), 5_500); return () => window.clearTimeout(timer); }, [feedback]);
  useEffect(() => {
    setWorkspaceSaved(writeLocalTerminalWorkspace({ symbol, timeframe, rangePreset, activeTapeProvider, workspaceMode, activeLayers, watchlist, nativeStudies, indicatorFavorites }));
  }, [symbol, timeframe, rangePreset, activeTapeProvider, workspaceMode, activeLayers, watchlist, nativeStudies, indicatorFavorites]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      initializedWorkspaceUser.current = null;
      syncedPreferenceFingerprint.current = null;
      setCloudRevision(null);
      setPendingCloudSnapshot(null);
      setWorkspaceState("local");
      return;
    }
    if (workspaceQuery.isLoading) {
      setWorkspaceState("checking");
      return;
    }
    if (workspaceQuery.isError || !workspaceQuery.data) {
      setWorkspaceState("offline");
      return;
    }
    if (initializedWorkspaceUser.current === user.id) return;

    initializedWorkspaceUser.current = user.id;
    const cloudPreferences = workspaceQuery.data.preferences as TerminalWorkspacePreferences | null;
    const revision = workspaceQuery.data.revision as number | null;
    const cloudUpdatedAt = workspaceQuery.data.updatedAt ? new Date(workspaceQuery.data.updatedAt).getTime() : null;
    setCloudRevision(revision);

    if (!cloudPreferences) {
      if (!currentCloudPreferences) {
        setWorkspaceState("offline");
        return;
      }
      setWorkspaceState("syncing");
      saveWorkspace.mutate({ preferences: currentCloudPreferences, expectedRevision: null }, {
        onSuccess: (stored) => {
          const preferences = stored.preferences as TerminalWorkspacePreferences | null;
          if (!preferences) { setWorkspaceState("offline"); return; }
          setCloudRevision(stored.revision);
          syncedPreferenceFingerprint.current = preferenceFingerprint(preferences);
          setWorkspaceState("synced");
          setFeedback({ kind: "success", message: "Your cloud workspace is ready. This device was synced without uploading market data or credentials." });
        },
        onError: () => {
          setWorkspaceState("offline");
          setFeedback({ kind: "warning", message: "Cloud workspace setup is unavailable. Your device preferences remain local." });
        },
      });
      return;
    }

    const localIsNewer = initialLocalUpdatedAt.current !== null && cloudUpdatedAt !== null && initialLocalUpdatedAt.current > cloudUpdatedAt;
    if (currentCloudPreferences && localIsNewer && preferenceFingerprint(currentCloudPreferences) !== preferenceFingerprint(cloudPreferences)) {
      setPendingCloudSnapshot({ preferences: cloudPreferences, revision, updatedAt: workspaceQuery.data.updatedAt });
      setWorkspaceState("conflict");
      return;
    }

    applyCloudPreferences(cloudPreferences);
    syncedPreferenceFingerprint.current = preferenceFingerprint(cloudPreferences);
    setWorkspaceState("synced");
  }, [authLoading, currentCloudPreferences, saveWorkspace, user, workspaceQuery.data, workspaceQuery.isError, workspaceQuery.isLoading]);

  useEffect(() => {
    if (!user || workspaceState !== "synced" || !currentCloudPreferences) return;
    const fingerprint = preferenceFingerprint(currentCloudPreferences);
    if (syncedPreferenceFingerprint.current === fingerprint) return;
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => persistCurrentWorkspace(cloudRevision), 900);
    return () => { if (syncTimer.current !== null) window.clearTimeout(syncTimer.current); };
  }, [cloudRevision, currentCloudPreferences, user, workspaceState]);

  const displaySnapshot = currentSnapshot ?? lastVerifiedSnapshot;
  const displayHistorical = currentHistorical ?? lastVerifiedHistorical;
  const isUpdating = snapshotQuery.isFetching || historicalQuery.isFetching;
  const isInitialLoading = isUpdating && !displayHistorical;
  const marketError = currentHistorical ? null : incomingHistorical?.dataStatus === "UNAVAILABLE" ? incomingHistorical.reason ?? "The selected market could not return verified historical data." : incomingSnapshot?.dataStatus === "UNAVAILABLE" ? incomingSnapshot.reason ?? "The selected market could not return a verified public snapshot." : null;
  const coverage = currentHistorical?.coverage ?? displayHistorical?.coverage ?? null;
  const coverageLabel = coverage?.effectiveFrom && coverage.effectiveTo ? `${coverage.complete ? "Verified" : "Partial"} · ${formatUtc(coverage.effectiveFrom)} → ${formatUtc(coverage.effectiveTo)} · ${coverage.returnedBars.toLocaleString("en-US")} bars` : "Awaiting verified coverage";
  const requestedMarketIsValid = Boolean(currentHistorical && currentSnapshot);
  const verifiedSymbol = displayHistorical?.symbol ?? displaySnapshot?.symbol ?? symbol;
  const cvdState = gateTradeTape?.symbol === verifiedSymbol ? gateTradeTape.dataStatus : "UNAVAILABLE";
  const gateTapeForVerifiedSymbol = gateTradeTape?.symbol === verifiedSymbol ? gateTradeTape : undefined;
  const selectedTape = activeTapeProvider === "gateio" ? gateTapeForVerifiedSymbol : multiTradeTape;
  const flowPulseTape = activeTapeProvider === "gateio" ? selectedTape : undefined;
  const cvdTrades = cvdState === "LIVE" ? gateTapeForVerifiedSymbol?.trades ?? [] : [];
  const domState = depthBook?.symbol === verifiedSymbol ? depthBook.dataStatus : "UNAVAILABLE";
  const activeContextLayer = flowPulseEnabled ? "flowPulse" : activeLayers.includes("footprint") ? "footprint" : activeLayers.includes("largePrints") ? "largePrints" : activeLayers.includes("tape") ? "tape" : domEnabled ? "dom" : activeLayers.includes("sessionProfile") ? "sessionProfile" : null;
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
  const selectWorkspaceMode = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    setShowStudies(mode !== "focus");
    setShowResearch(mode === "research");
    setShowIndicatorLab(false);
    setShowSettings(false);
  };
  const focusMode = workspaceMode === "focus";
  const openStudiesDrawer = () => { captureFocusReturn(); setWorkspaceMode("canvas"); setShowStudies(true); setShowResearch(false); setShowIndicatorLab(false); setShowSettings(false); };
  const openIndicatorsDialog = () => { captureFocusReturn(); setShowIndicatorsDialog(true); setShowIndicatorLab(false); setShowSettings(false); };
  const closeIndicatorsDialog = () => { setShowIndicatorsDialog(false); restoreFocus(); };
  const closeStudiesDrawer = () => { setShowStudies(false); restoreFocus(); };
  const openResearchDrawer = () => { captureFocusReturn(); setWorkspaceMode("research"); setShowResearch(true); setShowStudies(true); setShowIndicatorLab(false); setShowSettings(false); };
  const closeResearchDrawer = () => { setShowResearch(false); restoreFocus(); };
  const openIndicatorLab = () => { captureFocusReturn(); setShowIndicatorLab(true); setShowIndicatorsDialog(false); setShowStudies(false); setShowResearch(false); };
  const closeIndicatorLab = () => { setShowIndicatorLab(false); restoreFocus(); };
  const openSettingsDrawer = () => { captureFocusReturn(); setShowSettings(true); setShowStudies(false); setShowResearch(false); setShowIndicatorLab(false); };
  const closeSettingsDrawer = () => { setShowSettings(false); restoreFocus(); };
  const clearSavedBrowserCopy = () => {
    try {
      window.localStorage.removeItem(LOCAL_TERMINAL_WORKSPACE_KEY);
      setWorkspaceSaved(false);
      setFeedback({ kind: "success", message: "Saved browser terminal preferences cleared. This session and your cloud workspace are unchanged." });
    } catch {
      setFeedback({ kind: "warning", message: "This browser did not allow its saved terminal preferences to be cleared." });
    }
  };
  const addCustomIndicator = (indicator: CompiledIndicator) => {
    setCustomIndicators(current => current.some(item => item.definition.name.toLowerCase() === indicator.definition.name.toLowerCase()) ? [...current.filter(item => item.definition.name.toLowerCase() !== indicator.definition.name.toLowerCase()), indicator] : [...current, indicator]);
    setFeedback({ kind: "success", message: `${indicator.definition.name} is validated on the current loaded candle window and added locally to this chart. No source code or market data is uploaded.` });
    closeIndicatorLab();
  };
  const toggleNativeStudy = (id: NativeStudyId) => {
    setNativeStudies(current => current.some(study => study.id === id) ? current.filter(study => study.id !== id) : [...current, { id }]);
  };
  const updateNativeStudy = (id: NativeStudyId, inputs: Record<string, number>) => {
    setNativeStudies(current => current.some(study => study.id === id) ? current.map(study => study.id === id ? { ...study, inputs } : study) : [...current, { id, inputs }]);
  };
  const toggleIndicatorFavorite = (id: NativeStudyId) => {
    setIndicatorFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id].slice(0, 24));
  };

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
    const requestedAtCurrentGranularity = resolveHistoricalWindow(next, providerInterval);
    const nextTimeframe = requestedAtCurrentGranularity.requiredBars > MAX_VERIFIED_HISTORY_BARS ? rangeToTimeframe(next) : timeframe;
    setRangePreset(next);
    if (nextTimeframe !== timeframe) setTimeframe(nextTimeframe);
    setReplay(false);
    setFeedback({ kind: "info", message: nextTimeframe !== timeframe ? `${next} needs ${requestedAtCurrentGranularity.requiredBars.toLocaleString("en-US")} bars at ${providerInterval}. Loading the full verified range at ${toProviderInterval(nextTimeframe)} granularity instead.` : `Requesting the ${next} verified history window. Effective coverage will be shown once confirmed.` });
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
    if (id === "focus-mode") { selectWorkspaceMode("focus"); setFeedback({ kind: "info", message: "Focus Mode enabled: the analytical cockpit now prioritizes the verified chart." }); return; }
    if (id === "exit-focus") { selectWorkspaceMode("canvas"); setFeedback({ kind: "info", message: "Canvas Mode enabled: Layers and research controls are available beside the verified chart." }); return; }
    if (id === "open-shortcuts") { openShortcutHelp(); return; }
    if (id === "focus-market") { marketInputRef.current?.focus(); return; }
    if (id === "refresh-market") { retry(); return; }
    if (id === "open-settings") { openSettingsDrawer(); return; }
    if (id === "open-alerts") { setFeedback({ kind: "info", message: "Alert status: no connected alert provider is configured. No market alerts are active." }); return; }
    setFeedback({ kind: "info", message: "Risk status: sizing is not yet configured. No order, broker, or execution route exists." });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isPaletteShortcut(event)) { event.preventDefault(); openCommandPalette(); return; }
      if (event.key === "Escape") { if (shortcutHelpOpen) { closeShortcutHelp(); return; } if (commandPaletteOpen) { closeCommandPalette(); return; } if (showSettings) { closeSettingsDrawer(); return; } if (showIndicatorsDialog) { closeIndicatorsDialog(); return; } if (showIndicatorLab) { closeIndicatorLab(); return; } if (showResearch) { closeResearchDrawer(); return; } if (showStudies) { closeStudiesDrawer(); return; } }
      if (editable || commandPaletteOpen || shortcutHelpOpen) return;
      if (isHelpShortcut(event)) { event.preventDefault(); openShortcutHelp(); return; }
      if (isMarketShortcut(event)) { event.preventDefault(); marketInputRef.current?.focus(); return; }
      if (event.key.toLowerCase() === "f" && !event.shiftKey) selectWorkspaceMode("focus");
      if (event.key.toLowerCase() === "r" && !event.shiftKey) runCommand("open-research");
      if (event.key.toLowerCase() === "s" && !event.shiftKey) runCommand("open-studies");
      if (event.key.toLowerCase() === "r" && event.shiftKey) runCommand("refresh-market");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, retry, shortcutHelpOpen, showIndicatorLab, showIndicatorsDialog, showResearch, showSettings, showStudies, workspaceMode]);
  const resetViewport = () => { setReplay(false); setFeedback({ kind: "info", message: "Chart viewport reset to the latest verified window." }); };
  const shownBars = replay && displayHistorical ? displayHistorical.bars.slice(0, Math.max(60, Math.floor(displayHistorical.bars.length * 0.68))) : displayHistorical?.bars ?? [];

  return <main className={`premium-terminal terminal-full-workstation reference-workstation is-${workspaceMode}`}>
    <span className="sr-only" role="status" aria-live="polite">{accessibilityStatus}</span>
    <header className="reference-terminal-header">
      <a className="compact-brand" href="/" aria-label="ZTerminal home"><img src={zterminalMark} alt="" /><b>ZTERMINAL</b></a>
      <form className="compact-market-select" onSubmit={(event) => { event.preventDefault(); setMarket(symbolDraft); }}><Search size={12} /><input ref={marketInputRef} value={symbolDraft} onChange={(event) => setSymbolDraft(event.target.value)} placeholder="Symbol" aria-label="Gate.io perpetual market" spellCheck="false" /><button type="submit" aria-label="Load market">↵</button></form>
      <div className="compact-timeframes" aria-label="Chart timeframe">{TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "selected" : ""} onClick={() => selectTimeframe(item)}>{item}</button>)}</div>
      <nav className="reference-mode-actions" aria-label="Terminal surfaces">
        <button className={showIndicatorsDialog ? "active" : ""} onClick={openIndicatorsDialog} title="Indicators"><Layers3 size={13} /><span>Indicators</span></button>
        <button className={workspaceMode === "canvas" ? "active" : ""} onClick={() => selectWorkspaceMode("canvas")} title="Canvas Layers"><LayoutPanelTop size={13} /><span>Layers</span></button>
        <button className={workspaceMode === "research" ? "active" : ""} onClick={() => selectWorkspaceMode("research")} title="Research workstation"><FlaskConical size={13} /><span>Research</span></button>
      </nav>
      <div className="compact-quote" title={`${coverageLabel} · ${formatAge(displaySnapshot?.at)}`}><b>{formatQuote(displaySnapshot?.price)}</b><em className={typeof displaySnapshot?.changePercent === "number" && displaySnapshot.changePercent >= 0 ? "positive" : "negative"}>{typeof displaySnapshot?.changePercent === "number" ? `${displaySnapshot.changePercent >= 0 ? "+" : ""}${displaySnapshot.changePercent.toFixed(2)}%` : "—"}</em></div>
      <span className={`compact-source-state ${requestedMarketIsValid ? "live" : isUpdating ? "updating" : "unavailable"}`}><i /><span>{requestedMarketIsValid ? "Verified" : isUpdating ? "Loading" : "Unavailable"}</span></span>
      <div className="compact-header-tools"><button onClick={openCommandPalette} aria-label="Search terminal commands" title="Command palette"><Command size={14} /></button><button onClick={resetViewport} aria-label="Reset chart viewport" title="Reset chart"><Crosshair size={14} /></button><button onClick={openSettingsDrawer} aria-label="Terminal settings" title="Settings"><Settings2 size={14} /></button><TerminalAccountControl workspaceState={workspaceState} onSync={reviewWorkspaceSync} /></div>
    </header>

    {showWorkspaceConflict && pendingCloudSnapshot && <section className="workspace-conflict-dialog" role="dialog" aria-modal="true" aria-label="Resolve cloud workspace difference"><div><span className="drawer-kicker">Cloud workspace review</span><h2>Two device copies differ</h2><p>Your account has a newer saved workspace than this browser. Market data, credentials, and strategy source are not part of either copy.</p><dl><div><dt>Cloud copy</dt><dd>{pendingCloudSnapshot.updatedAt ? new Date(pendingCloudSnapshot.updatedAt).toLocaleString() : "Saved workspace"}</dd></div><div><dt>This device</dt><dd>{initialLocalUpdatedAt.current ? new Date(initialLocalUpdatedAt.current).toLocaleString() : "Current browser settings"}</dd></div></dl><div className="workspace-conflict-actions"><button className="terminal-secondary-button" onClick={() => { applyCloudPreferences(pendingCloudSnapshot.preferences); setCloudRevision(pendingCloudSnapshot.revision); syncedPreferenceFingerprint.current = preferenceFingerprint(pendingCloudSnapshot.preferences); setPendingCloudSnapshot(null); setShowWorkspaceConflict(false); setWorkspaceState("synced"); setFeedback({ kind: "info", message: "Cloud workspace applied to this device." }); }}>Use cloud workspace</button><button className="terminal-primary-button" onClick={() => { setShowWorkspaceConflict(false); persistCurrentWorkspace(pendingCloudSnapshot.revision); }}>Replace cloud with this device</button></div><button className="workspace-conflict-dismiss" onClick={() => setShowWorkspaceConflict(false)}>Decide later</button></div></section>}

    <section className="reference-main-grid">
      <IconRail showLayers={workspaceMode === "canvas"} showResearch={workspaceMode === "research"} focusMode={focusMode} onLayers={() => selectWorkspaceMode("canvas")} onResearch={() => selectWorkspaceMode("research")} onFocus={() => selectWorkspaceMode("focus")} onReset={resetViewport} />
      {workspaceMode === "canvas" && <StudiesDrawer activeLayers={activeLayers} selectedLayer={selectedLayer} bars={displayHistorical?.bars ?? []} cvdState={cvdState} domState={domState} customIndicators={customIndicators} nativeStudies={nativeStudies} onSelect={setSelectedLayer} onToggle={toggleLayer} onOpenIndicators={openIndicatorsDialog} onOpenIndicatorLab={openIndicatorLab} onClose={() => selectWorkspaceMode("focus")} />}
      {workspaceMode === "research" && <ResearchDrawer bars={displayHistorical?.bars ?? []} historical={displayHistorical} symbol={verifiedSymbol} onFeedback={setFeedback} onClose={() => selectWorkspaceMode("focus")} />}
      <section className="chart-workspace">
        <div className="chart-command-toolbar"><span className="chart-toolbar-label">{workspaceMode === "focus" ? "Focus" : workspaceMode === "canvas" ? "Canvas" : "Evidence"}</span><button className={replay ? "selected-action" : ""} onClick={() => { setReplay((value) => !value); setFeedback({ kind: "info", message: replay ? "Replay preview stopped. Full verified window restored." : "Replay preview is showing an earlier slice of the same verified dataset." }); }}><Play size={12} /> {replay ? "Stop" : "Replay"}</button><span className="toolbar-grow" /><button className="toolbar-icon" onClick={retry} aria-label="Refresh public market data" title="Refresh verified market data"><RefreshCw size={13} /></button></div>
        {feedback && <div className={`terminal-feedback ${feedback.kind}`} role="status"><span>{feedback.kind === "warning" ? <CircleHelp size={13} /> : feedback.kind === "success" ? <Target size={13} /> : <Clock3 size={13} />}</span>{feedback.message}<button onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={12} /></button></div>}
        <ProfessionalChart bars={shownBars} interval={providerInterval} symbol={verifiedSymbol} activeLayers={activeLayers} isLoading={isInitialLoading} isRefreshing={isUpdating && Boolean(displayHistorical)} errorMessage={marketError} coverageLabel={coverageLabel} onRetry={retry} cvdTrades={cvdTrades} cvdState={cvdState} tradeMarkers={backtestMarkers} customIndicators={customIndicators} nativeStudies={nativeStudies} intrabarDelta={intrabarDelta?.dataStatus === "HISTORICAL" && intrabarDelta.coverage.complete ? intrabarDelta : null} />
        <div className="chart-range-dock"><span className="range-label">History</span>{RANGE_PRESETS.map((range) => <button key={range} className={rangePreset === range ? "selected" : ""} onClick={() => selectRange(range)}>{range}</button>)}<span className="range-dock-divider" /><span className="range-provenance"><Radio size={12} /> {coverageLabel}</span></div>
      </section>
      {workspaceMode === "research" && <ProtocolResearchDrawer dataset={researchDataset} bars={displayHistorical?.bars ?? []} dataContext={backtestDataContext} onBacktestMarkers={setBacktestMarkers} onFeedback={setFeedback} onClose={() => selectWorkspaceMode("focus")} />}
    </section>
    {showIndicatorsDialog && <IndicatorsDialog nativeStudies={nativeStudies} favorites={indicatorFavorites} activeLayers={activeLayers} customIndicators={customIndicators} intrabarState={intrabarDeltaQuery.isLoading ? "checking" : intrabarDelta?.dataStatus === "HISTORICAL" && intrabarDelta.coverage.complete ? "available" : "unavailable"} intrabarDetail={intrabarDelta?.dataStatus === "HISTORICAL" && intrabarDelta.coverage.complete ? `${intrabarDelta.intrabarInterval} Gate.io intrabars · ${intrabarDelta.coverage.returnedBars.toLocaleString("en-US")} chart bars · directional-volume estimate` : intrabarDelta?.reason ?? "Checking verified intrabar coverage for this range."} onToggleNative={toggleNativeStudy} onUpdateNative={updateNativeStudy} onToggleFavorite={toggleIndicatorFavorite} onToggleLayer={toggleLayer} onCreateIndicator={openIndicatorLab} onClose={closeIndicatorsDialog} />}
    {showIndicatorLab && <IndicatorLabDrawer bars={displayHistorical?.bars ?? []} onAdd={addCustomIndicator} onClose={closeIndicatorLab} />}
    {showSettings && <SettingsDrawer symbol={symbol} timeframe={timeframe} symbols={Array.from(new Set([...STARTING_MARKETS, symbol]))} timeframes={TIMEFRAMES} workspaceState={workspaceState} isAuthenticated={Boolean(user)} onSymbolChange={setMarket} onTimeframeChange={(next) => selectTimeframe(next as Timeframe)} onSync={reviewWorkspaceSync} onClearLocalCopy={clearSavedBrowserCopy} onClose={closeSettingsDrawer} />}
    {shortcutHelpOpen && <section className="keyboard-shortcuts-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><header><div><span className="drawer-kicker">Terminal controls</span><h2>Keyboard shortcuts</h2></div><button onClick={closeShortcutHelp} aria-label="Close keyboard shortcuts"><X size={16} /></button></header><p>Shortcuts are inactive while typing in a field. They only open research tools and never create an order or execution route.</p><dl><div><dt><kbd>⌘</kbd><kbd>Ctrl</kbd> + <kbd>K</kbd></dt><dd>Open command palette</dd></div><div><dt><kbd>/</kbd></dt><dd>Focus market search</dd></div><div><dt><kbd>R</kbd> / <kbd>S</kbd></dt><dd>Open Strategy Tester / Indicators</dd></div><div><dt><kbd>Shift</kbd> + <kbd>R</kbd></dt><dd>Refresh verified market data</dd></div></dl></section>}
    {commandPaletteOpen && <CommandPalette onRun={runCommand} onClose={closeCommandPalette} />}
    <footer className="reference-terminal-footer"><span>Public-market research only</span><span>Execution disabled</span><a className="chart-engine-attribution" href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Lightweight Charts attribution</a><span>UTC · {new Date().toISOString().slice(11, 16)}</span></footer>
  </main>;
}
