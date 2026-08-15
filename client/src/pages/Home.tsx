import { useMemo, useState } from "react";
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
  Search,
  Settings2,
  SlidersHorizontal,
  TerminalSquare,
  Waves,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const NAVIGATION = [
  { label: "Chart", icon: CandlestickChart },
  { label: "Order Flow", icon: Waves },
  { label: "Strategy Builder", icon: TerminalSquare },
  { label: "Backtester", icon: FlaskConical },
  { label: "Research Lab", icon: Microscope },
  { label: "Alerts", icon: Bell },
  { label: "Journal", icon: NotebookPen },
];

const RAIL_ITEMS = [CandlestickChart, LayoutDashboard, SlidersHorizontal, LineChart, TerminalSquare, CircleHelp, Radio];
const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "D"];
type MarketBar = { t: number; o: number; h: number; l: number; c: number; v: number };

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

function VerifiedChart({ bars, interval }: { bars: MarketBar[]; interval: string }) {
  const geometry = useMemo(() => {
    if (bars.length < 2) return null;
    const high = Math.max(...bars.map((bar) => bar.h));
    const low = Math.min(...bars.map((bar) => bar.l));
    const range = Math.max(high - low, Math.max(high * 0.0005, 0.01));
    const maxVolume = Math.max(...bars.map((bar) => bar.v), 1);
    const left = 38;
    const right = 992;
    const chartTop = 25;
    const chartHeight = 346;
    const volumeBase = 442;
    const count = bars.length;
    const step = (right - left) / Math.max(count - 1, 1);
    const width = Math.max(1.25, Math.min(7, step * 0.62));
    const y = (value: number) => chartTop + ((high - value) / range) * chartHeight;
    return {
      high,
      low,
      candles: bars.map((bar, index) => ({
        x: left + index * step,
        open: y(bar.o),
        close: y(bar.c),
        high: y(bar.h),
        low: y(bar.l),
        volume: (bar.v / maxVolume) * 39,
        up: bar.c >= bar.o,
      })),
      width,
      last: bars.at(-1)?.c ?? null,
      volumeBase,
    };
  }, [bars]);

  return (
    <div className="research-chart" aria-label={geometry ? `Verified Gate.io ${interval} historical chart` : "Historical bars are unavailable"}>
      <div className="chart-overlay chart-overlay-left">
        <Metric label="Session VWAP" tone="muted" />
        <Metric label="EMA 20" tone="muted" />
        <Metric label="EMA 50" tone="muted" />
        <Metric label="Order-flow range" tone="muted" />
      </div>
      {!geometry && <div className="chart-awaiting"><Radio size={15} /><span>Awaiting verified historical bars</span></div>}
      <svg viewBox="0 0 1030 470" preserveAspectRatio="none" role="img" aria-label="Decorative research chart surface">
        {[65, 130, 195, 260, 325, 390].map((y) => <line key={`h-${y}`} x1="0" x2="1030" y1={y} y2={y} className="chart-grid" />)}
        {[120, 300, 480, 660, 840].map((x) => <line key={`v-${x}`} x1={x} x2={x} y1="0" y2="470" className="chart-grid" />)}
        {geometry?.candles.map((candle, index) => {
          const top = Math.min(candle.open, candle.close);
          const height = Math.max(4, Math.abs(candle.open - candle.close));
          return (
            <g key={index} className={candle.up ? "candle candle-up" : "candle candle-down"}>
              <line x1={candle.x} x2={candle.x} y1={candle.high} y2={candle.low} />
              <rect x={candle.x - geometry.width / 2} y={top} width={geometry.width} height={height} rx="1" />
            </g>
          );
        })}
        {geometry?.candles.map((candle, index) => <rect key={`volume-${index}`} className={candle.up ? "volume-bar up" : "volume-bar down"} x={candle.x - geometry.width / 2} y={geometry.volumeBase - candle.volume} width={geometry.width} height={candle.volume} rx="1" />)}
        {geometry && <line x1="0" x2="1030" y1={geometry.candles.at(-1)?.close ?? 0} y2={geometry.candles.at(-1)?.close ?? 0} className="reference-line" />}
      </svg>
      <div className="chart-price-axis" aria-hidden="true"><span>{geometry ? formatQuote(geometry.high) : "—"}</span><span>—</span><span>—</span><span>{geometry ? formatQuote(geometry.low) : "—"}</span></div>
    </div>
  );
}

function Metric({ label, tone = "muted" }: { label: string; tone?: "teal" | "blue" | "amber" | "muted" }) {
  return <div className={`overlay-metric ${tone}`}><span>{label}</span><b>—</b></div>;
}

function ContextPanel({ bid, ask, dataStatus, reason, barsLabel, barsAvailable }: { bid: number | null; ask: number | null; dataStatus: string; reason?: string; barsLabel: string; barsAvailable: boolean }) {
  return (
    <aside className="context-panel">
      <div className="context-title"><span>Market context</span><b>PUBLIC</b></div>
      <ContextRow label="Bid" value={formatQuote(bid)} />
      <ContextRow label="Ask" value={formatQuote(ask)} />
      <ContextRow label="Spread" value={typeof bid === "number" && typeof ask === "number" ? formatQuote(ask - bid) : "—"} />
      <div className="context-divider" />
      <ContextRow label="Venue" value="Gate.io" />
      <ContextRow label="Depth" value="Not connected" warn />
      <ContextRow label="Bars" value={barsLabel} warn={!barsAvailable} />
      <ContextRow label="Execution" value="Disabled" warn />
      <div className="context-divider" />
      <div className="context-title small"><span>Time & sales</span></div>
      <div className="tape-empty">{dataStatus === "LIVE" ? "Ticker snapshot is live; a verified public tape is not connected." : reason ?? "No verified public tape is available for this session."}</div>
    </aside>
  );
}

function ContextRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div className="context-row"><span>{label}</span><b className={warn ? "warn-text" : ""}>{value}</b></div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState("Chart");
  const [timeframe, setTimeframe] = useState("15m");
  const [railOpen, setRailOpen] = useState(false);
  const providerInterval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" = timeframe === "3m"
    ? "1m"
    : timeframe === "D"
      ? "1d"
      : timeframe as "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
  const { data: snapshot } = trpc.market.snapshot.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  });
  const { data: historical } = trpc.market.bars.useQuery({ interval: providerInterval }, {
    refetchInterval: 45_000,
    staleTime: 30_000,
    retry: 1,
  });
  const verifiedBars = historical?.dataStatus === "HISTORICAL" ? historical : null;
  const liveSnapshot = snapshot?.dataStatus === "LIVE" ? snapshot : null;
  const snapshotReason = snapshot?.dataStatus === "UNAVAILABLE" ? snapshot.reason : undefined;
  const statusLabel = liveSnapshot ? "Public snapshot live" : snapshot ? "Public snapshot unavailable" : "Connecting public data";

  return (
    <main className="terminal-shell">
      <header className="terminal-topbar">
        <div className="brand-lockup"><span className="brand-mark">Z</span><span className="brand-name">ZTERMINAL</span></div>
        <nav className="terminal-nav" aria-label="Primary research navigation">
          {NAVIGATION.map(({ label, icon: Icon }) => (
            <button key={label} className={activeView === label ? "active" : ""} onClick={() => setActiveView(label)}>
              <Icon size={14} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="top-actions"><button className="icon-button" aria-label="Search"><Search size={17} /></button><button className="icon-button" aria-label="Alerts"><Bell size={17} /></button><span className="user-token">Z</span></div>
      </header>

      <section className="instrument-strip">
        <div className="symbol-block"><div><h1>QQQX / USDT <span>★</span></h1><p>Perpetual · public-data research view</p></div><div className="price-readout"><strong>{formatQuote(liveSnapshot?.price)}</strong><span>{liveSnapshot?.changePercent === null || liveSnapshot?.changePercent === undefined ? "Waiting for verified snapshot" : `${liveSnapshot.changePercent >= 0 ? "+" : ""}${liveSnapshot.changePercent.toFixed(2)}% · 24h`}</span></div></div>
        <div className="instrument-metrics"><InstrumentMetric label="24h high" value={formatQuote(liveSnapshot?.dayHigh)} /><InstrumentMetric label="24h low" value={formatQuote(liveSnapshot?.dayLow)} /><InstrumentMetric label="24h volume" value={formatVolume(liveSnapshot?.quoteVolume)} /><InstrumentMetric label="Open interest" value="Unavailable" unavailable /></div>
        <div className="instrument-status"><span className={`status-dot ${liveSnapshot ? "live" : ""}`} /> {statusLabel}</div>
        <button className="venue-button">Gate.io <ChevronDown size={14} /></button>
        <button className="connect-button" onClick={() => setActiveView("Research Lab")}>Research</button>
      </section>

      <div className="terminal-workspace">
        <aside className={`utility-rail ${railOpen ? "open" : ""}`}>
          <button className="rail-toggle" onClick={() => setRailOpen((open) => !open)} aria-label="Toggle utility rail"><SlidersHorizontal size={18} /></button>
          {RAIL_ITEMS.map((Icon, index) => <button className={index === 0 ? "rail-active" : ""} key={index} aria-label={`Research tool ${index + 1}`}><Icon size={18} /></button>)}
          <button className="rail-bottom" aria-label="Workspace settings"><Settings2 size={18} /></button>
        </aside>

        <section className="research-stage">
          <div className="chart-toolbar">
            <div className="timeframe-controls" aria-label="Chart timeframes">{TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "selected" : ""} onClick={() => setTimeframe(item)}>{item}</button>)}</div>
            <div className="toolbar-divider" />
            <button><LineChart size={15} /> Indicators</button><button><LayoutDashboard size={15} /> Templates</button><button><Bell size={15} /> Alert draft</button><button><Play size={15} /> Replay</button>
            <div className="toolbar-spacer" />
            <button className="tool-icon" aria-label="Chart settings"><Settings2 size={16} /></button><button className="tool-icon" aria-label="Fullscreen"><Maximize2 size={16} /></button>
          </div>

          <div className="analysis-canvas">
            <div className="view-badge"><span>{activeView}</span><i>Research preview</i></div>
            <VerifiedChart bars={verifiedBars?.bars ?? []} interval={providerInterval} />
            <ContextPanel bid={liveSnapshot?.bid ?? null} ask={liveSnapshot?.ask ?? null} dataStatus={snapshot?.dataStatus ?? "CONNECTING"} reason={snapshotReason} barsAvailable={Boolean(verifiedBars)} barsLabel={verifiedBars ? `Gate.io · ${verifiedBars.interval}` : historical?.dataStatus === "UNAVAILABLE" ? "Unavailable" : "Loading"} />
          </div>

          <section className="cvd-panel">
            <div className="subpanel-heading"><span>CVD (session)</span><b>Unavailable until verified public tape is connected</b></div>
            <div className="cvd-empty">Cumulative volume delta is not calculated from candle bars. Connect a verified trade tape before enabling this analytical series.</div>
          </section>
        </section>
      </div>

      <footer className="terminal-dock">
        <div className="dock-ranges"><button>1D</button><button>5D</button><button>1M</button><button>3M</button><button>6M</button><button>YTD</button><button>1Y</button><button>All</button></div>
        <div className="dock-card"><Radio size={17} /><span><b>Data source</b><small>{liveSnapshot ? "Gate.io · public" : "Snapshot unavailable"}</small></span></div>
        <div className="dock-card"><Bell size={17} /><span><b>Alerts</b><small>Drafts only</small></span></div>
        <div className="dock-card wide"><Microscope size={17} /><span><b>Research mode</b><small>Execution disabled</small></span></div>
        <div className="dock-time">UTC · —:—:—</div>
      </footer>
    </main>
  );
}

function InstrumentMetric({ label, value, unavailable = false }: { label: string; value: string; unavailable?: boolean }) {
  return <div className="instrument-metric"><span>{label}</span><b className={unavailable ? "unavailable" : ""}>{value}</b></div>;
}
