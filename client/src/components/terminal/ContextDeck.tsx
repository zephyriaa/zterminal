import { BellRing, BookOpen, CalendarClock, CircleAlert, Layers3, Newspaper, Settings2, ShieldAlert, SlidersHorizontal } from "lucide-react";

type MarketSnapshot = {
  price: number | null;
  changePercent: number | null;
  quoteVolume: number | null;
  dataStatus: "LIVE" | "UNAVAILABLE";
  at: number;
} | null | undefined;

type FeedHealth = {
  feeds: Array<{ provider: string; dataStatus: "LIVE" | "STALE" | "DEGRADED" | "UNAVAILABLE" }>;
} | undefined;

function formatQuote(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function SourceRequiredCard({ title, detail, label }: { title: string; detail: string; label: string }) {
  return <article className="workstation-context-card source-required-card">
    <header><span>{title}</span><CircleAlert size={14} aria-hidden="true" /></header>
    <div className="source-required-content"><b>{label}</b><p>{detail}</p></div>
    <footer><span>Source-gated</span><span>No value rendered</span></footer>
  </article>;
}

export function ContextDeck({
  symbol,
  snapshot,
  feedHealth,
  onOpenLayers,
  onOpenResearch,
  onOpenSettings,
  onAlertStatus,
}: {
  symbol: string;
  snapshot: MarketSnapshot;
  feedHealth: FeedHealth;
  onOpenLayers: () => void;
  onOpenResearch: () => void;
  onOpenSettings: () => void;
  onAlertStatus: () => void;
}) {
  const feeds = feedHealth?.feeds ?? [];
  const liveFeedCount = feeds.filter((feed) => feed.dataStatus === "LIVE").length;
  const normalizedSymbol = symbol.replace("_", " / ");
  const snapshotLive = snapshot?.dataStatus === "LIVE";

  return <section className="workstation-context-deck" aria-label="Market context and terminal actions">
    <article className="workstation-context-card sessions-context-card">
      <header><span>Sessions</span><CalendarClock size={14} aria-hidden="true" /></header>
      <div className="session-context-list">
        <div><i className="london" /><span>London</span><small>02:00–11:00 UTC</small></div>
        <div><i className="new-york" /><span>New York</span><small>08:00–17:00 UTC</small></div>
        <div><i className="asia" /><span>Asia</span><small>19:00–04:00 UTC</small></div>
      </div>
      <footer><span>Deterministic UTC context</span><span>Not a signal</span></footer>
    </article>

    <article className="workstation-context-card news-context-card">
      <header><span>News</span><Newspaper size={14} aria-hidden="true" /></header>
      <div className="source-required-content"><b>UNAVAILABLE</b><p>A timestamped, attributable news feed is not configured. No headlines are simulated.</p></div>
      <footer><span>Source-gated</span><span>Not monitored</span></footer>
    </article>

    <SourceRequiredCard title="Fear & Greed" label="UNAVAILABLE" detail="A licensed or attributed sentiment source with cadence and classification basis is required before this context can be rendered." />

    <SourceRequiredCard title="COT context" label="UNAVAILABLE" detail="A market-compatible commitments source, reporting date, and mapping contract are required. Crypto derivatives are not treated as COT data." />

    <article className={`workstation-context-card market-status-card ${snapshotLive ? "is-live" : "is-pending"}`}>
      <header><span>Market status</span><i aria-label={snapshotLive ? "Live snapshot" : "Snapshot unavailable"} /></header>
      <div className="market-status-symbol"><span>{normalizedSymbol}</span><b>{formatQuote(snapshot?.price)}</b></div>
      <div className="market-status-metrics"><div><span>24h change</span><b className={typeof snapshot?.changePercent === "number" && snapshot.changePercent >= 0 ? "positive" : "negative"}>{typeof snapshot?.changePercent === "number" ? `${snapshot.changePercent >= 0 ? "+" : ""}${snapshot.changePercent.toFixed(2)}%` : "—"}</b></div><div><span>Quote volume</span><b>{formatVolume(snapshot?.quoteVolume)}</b></div></div>
      <footer><span>{snapshotLive ? `${liveFeedCount} public tape feed${liveFeedCount === 1 ? "" : "s"} live` : "Snapshot withheld"}</span><span>{snapshot?.at ? new Date(snapshot.at).toISOString().slice(11, 19) + " UTC" : "Awaiting source"}</span></footer>
    </article>

    <article className="workstation-context-card quick-actions-card">
      <header><span>Quick actions</span><SlidersHorizontal size={14} aria-hidden="true" /></header>
      <div className="quick-action-grid"><button onClick={onOpenLayers}><Layers3 size={13} /> Layers</button><button onClick={onOpenResearch}><BookOpen size={13} /> Research</button><button onClick={onAlertStatus}><BellRing size={13} /> Alerts</button><button onClick={onOpenSettings}><Settings2 size={13} /> Settings</button></div>
      <footer><span>Decision support only</span><span><ShieldAlert size={12} /> No execution</span></footer>
    </article>
  </section>;
}
