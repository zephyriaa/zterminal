"use client";

import { useMemo, useState } from "react";
import { Activity, BookOpenCheck, CircleGauge, Filter, Radio, SearchCheck, Waves } from "lucide-react";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useWorkspace } from "@/stores/workspace";
import { getContract, listContracts } from "@/lib/market/contracts";
import {
  buildFootprint,
  buildTradeTape,
  calculateBookImbalance,
  calculateCVD,
  calculateMicroprice,
  calculateOpenInterestChange,
  detectResearchEvents,
  ORDER_FLOW_CALCULATION_VERSION,
  type FootprintBucket,
  type OpenInterestChange,
  type ResearchEvent,
  type TapeRow,
  type TradeSideFilter,
} from "@/lib/market/order-flow";
import type { DepthLevel, DerivativesEvent, FeedHealth, LiquidationEvent } from "@/lib/market/types";
import { Pill } from "../terminal/primitives";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type OFTab = "tape" | "dom" | "footprint" | "cvd";

function formatPrice(value: number | null | undefined, tickSize = 0.01) {
  if (!Number.isFinite(value)) return "—";
  const digits = tickSize >= 1 ? 2 : Math.max(2, Math.round(-Math.log10(tickSize)));
  return value!.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatQuantity(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "—";
  return value!.toLocaleString("en-US", { maximumFractionDigits: value! >= 1_000 ? 2 : 4 });
}

function signed(value: number | null | undefined) {
  return Number.isFinite(value) ? `${value! > 0 ? "+" : ""}${formatQuantity(value)}` : "Unavailable";
}

function formatTime(timestamp: number | undefined) {
  if (!Number.isFinite(timestamp)) return "Awaiting";
  const date = new Date(timestamp!);
  return `${date.toISOString().slice(11, 19)}.${String(date.getUTCMilliseconds()).padStart(3, "0")}`;
}

function formatFunding(value: number | undefined) {
  return Number.isFinite(value) ? `${(value! * 100).toFixed(4)}%` : "Unavailable";
}

function formatFundingTime(value: number | undefined) {
  return Number.isFinite(value) ? `${new Date(value!).toISOString().slice(0, 16).replace("T", " ")} UTC` : "Unavailable";
}

export function OrderFlowView() {
  const { symbol, setSymbol } = useWorkspace();
  const contract = getContract(symbol);
  const [tab, setTab] = useState<OFTab>("tape");
  const [sideFilter, setSideFilter] = useState<TradeSideFilter>("all");
  const [minimumSize, setMinimumSize] = useState("0");
  const [aggregationWindow, setAggregationWindow] = useState("0");
  const [depthWindow, setDepthWindow] = useState(5);
  const [researchMode, setResearchMode] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<ResearchEvent | null>(null);
  const stream = useMarketStream(symbol, { trades: 600, depth: true, liquidations: 80 });

  const minimumQuantity = Math.max(0, Number(minimumSize) || 0);
  const aggregateMs = Math.max(0, Number(aggregationWindow) || 0);
  const tape = useMemo(() => buildTradeTape(stream.trades, { side: sideFilter, minimumQuantity, aggregationWindowMs: aggregateMs }), [stream.trades, sideFilter, minimumQuantity, aggregateMs]);
  const cvd = useMemo(() => calculateCVD(stream.trades, 1_000), [stream.trades]);
  const footprint = useMemo(() => buildFootprint(stream.trades, contract.tickSize, 60_000).at(-1), [stream.trades, contract.tickSize]);
  const imbalance = useMemo(() => calculateBookImbalance(stream.depth, depthWindow), [stream.depth, depthWindow]);
  const microprice = useMemo(() => calculateMicroprice(stream.depth), [stream.depth]);
  const oiBaseline = useMemo(() => stream.derivativesHistory.find((event) => Number.isFinite(event.openInterest)) ?? null, [stream.derivativesHistory]);
  const oiChange = useMemo(() => calculateOpenInterestChange(stream.derivatives, oiBaseline), [stream.derivatives, oiBaseline]);
  const events = useMemo(() => detectResearchEvents(stream.trades, {
    now: stream.trades.at(-1)?.timestamp,
    tickSize: contract.tickSize,
    minimumVolume: 5,
    dominance: 0.8,
    minimumLevels: 3,
    maxAbsorptionRangeTicks: 2,
  }), [stream.trades, contract.tickSize]);
  const activeEvent = selectedEvent && events.some((event) => event.id === selectedEvent.id) ? selectedEvent : events[0] ?? null;
  const lastPrice = stream.lastTrade?.price ?? stream.quote?.bid ?? null;

  return <div className="h-full min-h-0 flex flex-col bg-background">
    <header className="min-h-11 border-b hairline bg-panel flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0"><Waves className="w-3.5 h-3.5 text-mdata" /><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">Order Flow Research</span><Select value={symbol} onValueChange={setSymbol}><SelectTrigger className="h-7 w-28 text-[12px] bg-surface"><SelectValue /></SelectTrigger><SelectContent>{listContracts().filter((item) => item.session === "crypto").map((item) => <SelectItem key={item.symbol} value={item.symbol}>{item.symbol}</SelectItem>)}</SelectContent></Select><Pill tone={contract.supportsDepth ? "pos" : "warn"}>{contract.supportsDepth ? "Verified L2" : "Top-of-book"}</Pill></div>
      <div className="ml-auto flex items-center gap-1.5 text-[10px] tnum"><span className="hidden sm:inline text-muted-foreground">{stream.provider?.toUpperCase() ?? "AWAITING PROVIDER"} · {contract.description}</span><Pill tone={stream.health?.state === "LIVE" || stream.dataStatus === "LIVE" ? "pos" : stream.health?.state === "SYNCING" ? "warn" : "default"}>{stream.health?.state ?? stream.dataStatus}</Pill><span className="text-[14px] font-semibold text-foreground">{formatPrice(lastPrice, contract.tickSize)}</span></div>
    </header>

    <section className="grid grid-cols-2 md:grid-cols-4 border-b hairline bg-surface/35">
      <Metric label="CVD" value={signed(cvd.at(-1)?.value)} tone={(cvd.at(-1)?.value ?? 0) >= 0 ? "pos" : "neg"} detail="Observed buy quantity − sell quantity, cumulative" />
      <Metric label={`L2 imbalance · ${depthWindow}`} value={imbalance.value === null ? "Awaiting L2" : `${(imbalance.value * 100).toFixed(1)}%`} tone={(imbalance.value ?? 0) >= 0 ? "pos" : "neg"} detail={`Bid ${formatQuantity(imbalance.bidDepth)} / Ask ${formatQuantity(imbalance.askDepth)}`} />
      <Metric label="Microprice" value={formatPrice(microprice.value, contract.tickSize)} tone="mdata" detail="Top verified bid/ask size weighted price" />
      <Metric label="Open interest Δ" value={oiChange.status === "live" ? signed(oiChange.value) : "Unavailable"} tone={oiChange.status === "live" && (oiChange.value ?? 0) < 0 ? "neg" : "pos"} detail={oiChange.status === "live" ? "From first confirmed OI observation" : "No provider OI substituted"} />
    </section>

    <section className="flex-1 min-h-0 grid xl:grid-cols-[minmax(0,1fr)_310px]">
      <main className="min-h-0 flex flex-col">
        <nav className="h-9 shrink-0 border-b hairline bg-panel flex items-center px-2 gap-1" aria-label="Order-flow contextual tools">{(["tape", "dom", "footprint", "cvd"] as OFTab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={cn("h-7 px-2.5 rounded-[3px] text-[10.5px] uppercase tracking-wide", tab === item ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground")}>{item === "tape" ? "Time & Sales" : item}</button>)}<button onClick={() => setResearchMode((current) => !current)} className={cn("ml-auto h-7 px-2 rounded-[3px] text-[10px] uppercase tracking-wide flex items-center gap-1.5", researchMode ? "bg-mdata/15 text-mdata" : "text-muted-foreground hover:bg-hover")}><SearchCheck className="w-3.5 h-3.5" />Research Mode</button></nav>
        {tab === "tape" && <TapePanel tickSize={contract.tickSize} tape={tape} side={sideFilter} onSide={setSideFilter} minimumSize={minimumSize} onMinimumSize={setMinimumSize} aggregationWindow={aggregationWindow} onAggregationWindow={setAggregationWindow} />}
        {tab === "dom" && <DomPanel tickSize={contract.tickSize} depth={stream.depth} lastPrice={lastPrice} depthWindow={depthWindow} onDepthWindow={setDepthWindow} imbalance={imbalance.value} microprice={microprice.value} />}
        {tab === "footprint" && <FootprintPanel tickSize={contract.tickSize} footprint={footprint} lastPrice={lastPrice} />}
        {tab === "cvd" && <CvdPanel cvd={cvd} />}
      </main>
      <aside className="min-h-0 border-t xl:border-t-0 xl:border-l hairline overflow-y-auto scroll-thin bg-panel/45"><DerivativesPanel derivatives={stream.derivatives} oiChange={oiChange} liquidations={stream.liquidations} tickSize={contract.tickSize} /><FeedHealthPanel health={stream.health} provider={stream.provider} symbol={symbol} />{researchMode && <ResearchPanel events={events} activeEvent={activeEvent} onSelect={setSelectedEvent} />}<MethodologyPanel /></aside>
    </section>
  </div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "pos" | "neg" | "mdata" }) {
  return <div className="min-w-0 px-3 py-2 border-r hairline last:border-r-0" title={detail}><div className="text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground truncate">{label}</div><div className={cn("mt-0.5 text-[12px] font-medium tnum truncate", tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-mdata")}>{value}</div><div className="mt-0.5 text-[9.5px] text-muted-foreground truncate">{detail}</div></div>;
}

function TapePanel({ tickSize, tape, side, onSide, minimumSize, onMinimumSize, aggregationWindow, onAggregationWindow }: { tickSize: number; tape: TapeRow[]; side: TradeSideFilter; onSide: (value: TradeSideFilter) => void; minimumSize: string; onMinimumSize: (value: string) => void; aggregationWindow: string; onAggregationWindow: (value: string) => void }) {
  return <div className="flex-1 min-h-0 flex flex-col"><div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b hairline bg-surface/40 text-[10px]"><Filter className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground uppercase tracking-wide">Tape filters</span><div className="flex rounded-[3px] bg-panel border hairline overflow-hidden">{(["all", "buy", "sell"] as TradeSideFilter[]).map((item) => <button key={item} onClick={() => onSide(item)} className={cn("h-6 px-2 uppercase", side === item ? item === "buy" ? "bg-pos/15 text-pos" : item === "sell" ? "bg-neg/15 text-neg" : "bg-hover text-foreground" : "text-muted-foreground")}>{item}</button>)}</div><label className="flex items-center gap-1 text-muted-foreground">Min size <input value={minimumSize} inputMode="decimal" onChange={(event) => onMinimumSize(event.target.value)} className="w-16 h-6 rounded-[3px] bg-panel border hairline px-1.5 text-foreground tnum" /></label><label className="flex items-center gap-1 text-muted-foreground">Aggregate <select value={aggregationWindow} onChange={(event) => onAggregationWindow(event.target.value)} className="h-6 rounded-[3px] bg-panel border hairline px-1 text-foreground"><option value="0">off</option><option value="250">250ms</option><option value="1000">1s</option></select></label><span className="ml-auto text-muted-foreground">Observed exchange trade side · UTC ms</span></div><div className="flex-1 min-h-0 overflow-auto scroll-thin"><table className="w-full text-[11px] tnum"><thead className="sticky top-0 bg-panel border-b hairline z-10"><tr className="text-[9.5px] uppercase tracking-wider text-muted-foreground"><th className="text-left font-medium px-3 py-1.5">Time (UTC)</th><th className="text-left font-medium px-2 py-1.5">Side</th><th className="text-right font-medium px-2 py-1.5">Price</th><th className="text-right font-medium px-2 py-1.5">Size</th><th className="text-right font-medium px-3 py-1.5">Notional</th><th className="text-right font-medium px-3 py-1.5">Prints</th></tr></thead><tbody>{tape.slice().reverse().slice(0, 250).map((row) => <tr key={`${row.timestamp}-${row.side}-${row.price}-${row.lastSequence}`} className="border-b hairline/40 hover:bg-hover/40"><td className="px-3 py-1 text-muted-foreground">{formatTime(row.timestamp)}</td><td className={cn("px-2 py-1 font-medium", row.side === "buy" ? "text-pos" : "text-neg")}>{row.side.toUpperCase()}</td><td className="px-2 py-1 text-right text-foreground">{formatPrice(row.price, tickSize)}</td><td className="px-2 py-1 text-right text-muted-foreground">{formatQuantity(row.quantity)}</td><td className="px-3 py-1 text-right text-muted-foreground">{formatQuantity(row.notional)}</td><td className="px-3 py-1 text-right text-muted-foreground">{row.count}</td></tr>)}{!tape.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Awaiting observed public trades. No synthetic tape prints are shown.</td></tr>}</tbody></table></div></div>;
}

function DomPanel({ tickSize, depth, lastPrice, depthWindow, onDepthWindow, imbalance, microprice }: { tickSize: number; depth: DepthLevel[]; lastPrice: number | null; depthWindow: number; onDepthWindow: (value: number) => void; imbalance: number | null; microprice: number | null }) {
  const rows = useMemo(() => pairedDepth(depth), [depth]);
  const maxSize = Math.max(1, ...rows.flatMap((row) => [row.bid?.size ?? 0, row.ask?.size ?? 0]));
  return <div className="flex-1 min-h-0 flex flex-col"><div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b hairline bg-surface/40 text-[10px]"><CircleGauge className="w-3.5 h-3.5 text-mdata" /><span className="text-muted-foreground uppercase tracking-wide">Book context</span><span className="text-muted-foreground">Imbalance window</span>{[1, 5, 10, 25].map((window) => <button key={window} onClick={() => onDepthWindow(window)} className={cn("h-6 min-w-7 rounded-[3px] border hairline", depthWindow === window ? "bg-mdata/15 text-mdata" : "text-muted-foreground hover:bg-hover")}>{window}</button>)}<span className={cn("ml-auto tnum", (imbalance ?? 0) >= 0 ? "text-pos" : "text-neg")}>{imbalance === null ? "Awaiting L2" : `L2 ${(imbalance * 100).toFixed(2)}%`}</span><span className="text-muted-foreground tnum">Micro {formatPrice(microprice, tickSize)}</span></div><div className="flex-1 min-h-0 overflow-auto scroll-thin"><table className="w-full text-[11px] tnum"><thead className="sticky top-0 bg-panel border-b hairline z-10"><tr className="text-[9.5px] uppercase tracking-wider text-muted-foreground"><th className="text-right font-medium px-3 py-1.5">Bid size</th><th className="text-right font-medium px-2 py-1.5">Bid</th><th className="text-left font-medium px-2 py-1.5">Ask</th><th className="text-left font-medium px-3 py-1.5">Ask size</th></tr></thead><tbody>{rows.map(({ bid, ask }, index) => <tr key={`${bid?.price ?? "—"}-${ask?.price ?? "—"}-${index}`} className={cn("border-b hairline/40", Number.isFinite(lastPrice) && ((bid && Math.abs(bid.price - lastPrice!) <= tickSize) || (ask && Math.abs(ask.price - lastPrice!) <= tickSize)) ? "bg-hover/50" : "hover:bg-hover/30")}><td className="px-3 py-1 text-right"><DepthBar side="buy" size={bid?.size} maxSize={maxSize} /><span className="text-pos">{formatQuantity(bid?.size)}</span></td><td className="px-2 py-1 text-right text-foreground">{formatPrice(bid?.price, tickSize)}</td><td className="px-2 py-1 text-left text-foreground">{formatPrice(ask?.price, tickSize)}</td><td className="px-3 py-1 text-left"><span className="text-neg">{formatQuantity(ask?.size)}</span><DepthBar side="sell" size={ask?.size} maxSize={maxSize} /></td></tr>)}{!rows.length && <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">Awaiting a sequence-safe L2 snapshot. The DOM remains blank until the book bridge is verified.</td></tr>}</tbody></table></div></div>;
}

function DepthBar({ side, size, maxSize }: { side: "buy" | "sell"; size?: number; maxSize: number }) {
  return <span className={cn("inline-block align-middle h-1.5 mx-1 rounded-sm", side === "buy" ? "bg-pos/35" : "bg-neg/35")} style={{ width: Math.min(72, ((size ?? 0) / maxSize) * 72) }} />;
}

function FootprintPanel({ tickSize, footprint, lastPrice }: { tickSize: number; footprint?: FootprintBucket; lastPrice: number | null }) {
  const maxVolume = Math.max(1, ...(footprint?.levels.map((level) => level.totalVolume) ?? [1]));
  return <div className="flex-1 min-h-0 overflow-auto scroll-thin p-3"><div className="max-w-xl mx-auto"><div className="flex items-start justify-between gap-3 mb-3"><div><div className="text-[11px] font-medium text-foreground">Latest completed 60-second footprint</div><p className="mt-0.5 text-[10px] text-muted-foreground">Observed buy/sell volume binned to contract tick. Highlighting requires a 3:1 one-side ratio.</p></div><Pill tone={footprint && footprint.delta >= 0 ? "pos" : "warn"}>Δ {signed(footprint?.delta)}</Pill></div><div className="grid grid-cols-[1fr_98px_1fr_72px] gap-2 text-[9.5px] uppercase tracking-wider text-muted-foreground px-2 mb-1"><span className="text-right">Sell vol</span><span className="text-center">Price</span><span>Buy vol</span><span className="text-right">Delta</span></div>{!footprint?.levels.length && <p className="px-2 py-10 text-center text-[11px] text-muted-foreground">Awaiting observed public trades. No synthetic footprint levels are generated.</p>}{footprint?.levels.slice(0, 80).map((level) => { const buyHeavy = level.buyVolume >= Math.max(1, level.sellVolume) * 3; const sellHeavy = level.sellVolume >= Math.max(1, level.buyVolume) * 3; return <div key={level.price} className={cn("grid grid-cols-[1fr_98px_1fr_72px] gap-2 items-center px-2 py-1 rounded-[3px] hover:bg-hover/40", buyHeavy && "bg-pos/5", sellHeavy && "bg-neg/5")}><div className="flex justify-end items-center gap-1"><span className={cn("text-[10.5px] tnum", sellHeavy ? "text-neg" : "text-muted-foreground")}>{formatQuantity(level.sellVolume)}</span><span className="h-2 bg-neg/30 rounded-sm" style={{ width: `${(level.sellVolume / maxVolume) * 70}px` }} /></div><div className={cn("text-center text-[11px] tnum font-medium", Number.isFinite(lastPrice) && Math.abs(level.price - lastPrice!) <= tickSize ? "bg-hover rounded px-1 text-foreground" : "text-muted-foreground")}>{formatPrice(level.price, tickSize)}</div><div className="flex items-center gap-1"><span className="h-2 bg-pos/30 rounded-sm" style={{ width: `${(level.buyVolume / maxVolume) * 70}px` }} /><span className={cn("text-[10.5px] tnum", buyHeavy ? "text-pos" : "text-muted-foreground")}>{formatQuantity(level.buyVolume)}</span></div><span className={cn("text-right text-[10.5px] tnum", level.delta >= 0 ? "text-pos" : "text-neg")}>{signed(level.delta)}</span></div>;})}</div></div>;
}

function CvdPanel({ cvd }: { cvd: ReturnType<typeof calculateCVD> }) {
  const last = cvd.at(-1)?.value ?? 0;
  return <div className="flex-1 min-h-0 flex flex-col p-3"><div className="flex items-start justify-between gap-3 shrink-0"><div><div className="text-[11px] font-medium text-foreground">Cumulative volume delta</div><p className="mt-0.5 text-[10px] text-muted-foreground">Observed aggressive buy quantity less sell quantity. This resets with the client observation window and is not a session-total claim.</p></div><span className={cn("text-[12px] tnum font-medium", last >= 0 ? "text-pos" : "text-neg")}>{signed(last)}</span></div><div className="flex-1 min-h-[220px] mt-3 border hairline rounded-[4px] bg-surface/30"><CvdChart cvd={cvd} /></div></div>;
}

function DerivativesPanel({ derivatives, oiChange, liquidations, tickSize }: { derivatives: DerivativesEvent | null; oiChange: OpenInterestChange; liquidations: LiquidationEvent[]; tickSize: number }) {
  const values: [string, string][] = [["Mark", formatPrice(derivatives?.markPrice, tickSize)], ["Index", formatPrice(derivatives?.indexPrice, tickSize)], ["Funding", formatFunding(derivatives?.fundingRate)], ["OI", derivatives?.openInterestStatus === "unavailable" ? "Unavailable" : formatQuantity(derivatives?.openInterest)], ["OI Δ", oiChange.status === "live" ? signed(oiChange.value) : "Unavailable"], ["Next funding", formatFundingTime(derivatives?.nextFundingTime)]];
  return <section className="border-b hairline p-3"><div className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-mdata" /><h2 className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-foreground">Derivatives context</h2></div><div className="mt-2 grid grid-cols-2 gap-px bg-border hairline rounded-[4px] overflow-hidden">{values.map(([label, value]) => <div key={label} className="min-w-0 bg-panel px-2 py-1.5"><div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5 text-[10.5px] tnum text-foreground truncate" title={value}>{value}</div></div>)}</div>{derivatives?.openInterestStatus === "unavailable" && <p className="mt-2 text-[9.5px] leading-relaxed text-muted-foreground">Open interest is explicitly unavailable from the active provider endpoint. ZTerminal does not substitute a value or calculate an OI delta.</p>}<div className="mt-3"><div className="flex items-center justify-between"><span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Official liquidations</span><span className="text-[9.5px] text-muted-foreground">{liquidations.length} observed</span></div><div className="mt-1.5 max-h-28 overflow-y-auto scroll-thin">{liquidations.slice().reverse().slice(0, 6).map((event) => <div key={`${event.timestamp}-${event.sequence}`} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b hairline/40 py-1 text-[9.5px] tnum"><span className="text-muted-foreground">{formatTime(event.timestamp)}</span><span className={event.side === "buy" ? "text-pos" : "text-neg"}>{event.side.toUpperCase()}</span><span className="text-foreground">{formatQuantity(event.quantity)}</span></div>)}{!liquidations.length && <p className="py-2 text-[9.5px] text-muted-foreground">No exchange-declared liquidation events observed in this client window.</p>}</div></div></section>;
}

function FeedHealthPanel({ health, provider, symbol }: { health: FeedHealth | null; provider: string | undefined; symbol: string }) {
  return <section className="border-b hairline p-3"><div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-mdata" /><h2 className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-foreground">Feed provenance</h2><Pill tone={health?.state === "LIVE" ? "pos" : health?.state === "SYNCING" ? "warn" : "default"}>{health?.state ?? "PENDING"}</Pill></div><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[9.5px] tnum"><dt className="text-muted-foreground">Provider</dt><dd className="text-right text-foreground">{(health?.provider ?? provider ?? "Awaiting").toUpperCase()}</dd><dt className="text-muted-foreground">Instrument</dt><dd className="text-right text-foreground">{health?.symbol ?? symbol}</dd><dt className="text-muted-foreground">Book sequence</dt><dd className="text-right text-foreground">{health?.sequence ?? "Awaiting snapshot"}</dd><dt className="text-muted-foreground">Last message age</dt><dd className="text-right text-foreground">{health?.latencyMs === undefined ? "Awaiting" : `${health.latencyMs} ms`}</dd><dt className="text-muted-foreground">Reconnects</dt><dd className="text-right text-foreground">{health?.reconnectCount ?? 0}</dd><dt className="text-muted-foreground">Updated</dt><dd className="text-right text-foreground">{formatTime(health?.updatedAt)}</dd></dl>{health?.reason && <p className="mt-2 rounded-[3px] bg-warn/10 px-2 py-1.5 text-[9.5px] leading-relaxed text-warn">{health.reason}</p>}</section>;
}

function ResearchPanel({ events, activeEvent, onSelect }: { events: ResearchEvent[]; activeEvent: ResearchEvent | null; onSelect: (event: ResearchEvent | null) => void }) {
  return <section className="border-b hairline p-3"><div className="flex items-center gap-1.5"><SearchCheck className="w-3.5 h-3.5 text-mdata" /><h2 className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-foreground">Research Mode</h2></div><p className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground">Candidates are deterministic prompts for review, not trade signals or claims of intent. Select an event to inspect its source evidence.</p><div className="mt-2 space-y-1">{events.map((event) => <button key={event.id} onClick={() => onSelect(event)} className={cn("w-full rounded-[3px] border hairline px-2 py-1.5 text-left", activeEvent?.id === event.id ? "bg-mdata/10 border-mdata/30" : "hover:bg-hover/60")}><div className="flex justify-between gap-2"><span className={cn("text-[10px] font-medium", event.side === "buy" ? "text-pos" : "text-neg")}>{event.kind.replace("-", " ")}</span><span className="text-[9px] tnum text-muted-foreground">{formatTime(event.timestamp)}</span></div><p className="mt-0.5 text-[9.5px] text-muted-foreground">{event.summary}</p></button>)}{!events.length && <p className="py-2 text-[9.5px] text-muted-foreground">No candidates meet the declared rolling-window thresholds.</p>}</div>{activeEvent && <div className="mt-2 rounded-[4px] bg-surface border hairline p-2"><div className="flex items-center gap-1.5"><BookOpenCheck className="w-3.5 h-3.5 text-mdata" /><span className="text-[9.5px] font-medium text-foreground">Evidence inspector</span></div><dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[9px] leading-relaxed"><dt className="text-muted-foreground">Source prints</dt><dd className="text-right text-foreground">{activeEvent.source.tradeCount} · seq {activeEvent.source.providerSequences.join(", ") || "not supplied"}</dd><dt className="text-muted-foreground">Window</dt><dd className="text-right text-foreground">{activeEvent.source.rollingWindow.milliseconds}ms ending {formatTime(activeEvent.source.rollingWindow.to)}</dd><dt className="text-muted-foreground">Thresholds</dt><dd className="text-right text-foreground">≥{formatQuantity(activeEvent.thresholds.minimumVolume)} qty · ≥{(activeEvent.thresholds.dominance * 100).toFixed(0)}% side</dd><dt className="text-muted-foreground">Observed</dt><dd className="text-right text-foreground">Δ {signed(activeEvent.metrics.delta)} · {activeEvent.metrics.priceRange.toFixed(8)} range</dd><dt className="text-muted-foreground">Calculation</dt><dd className="text-right text-foreground">{activeEvent.calculationVersion}</dd></dl></div>}</section>;
}

function MethodologyPanel() {
  return <section className="p-3"><div className="flex items-center gap-1.5"><BookOpenCheck className="w-3.5 h-3.5 text-mdata" /><h2 className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-foreground">Methodology</h2></div><p className="mt-1.5 text-[9.5px] leading-relaxed text-muted-foreground">Calculation {ORDER_FLOW_CALCULATION_VERSION}. CVD and footprint use normalized public trade prints with Binance buyer-is-maker mapped to aggressive side. Imbalance = (Σ bid depth − Σ ask depth) / (Σ bid depth + Σ ask depth) over selected nearest levels. Microprice = ask × bid size/(bid + ask) + bid × ask size/(bid + ask). Read-only research; no execution is available.</p></section>;
}

function pairedDepth(depth: readonly DepthLevel[]) {
  const bids = depth.filter((level) => level.side === "buy").sort((a, b) => b.price - a.price);
  const asks = depth.filter((level) => level.side === "sell").sort((a, b) => a.price - b.price);
  return Array.from({ length: Math.max(bids.length, asks.length) }, (_, index) => ({ bid: bids[index], ask: asks[index] }));
}

function CvdChart({ cvd }: { cvd: ReturnType<typeof calculateCVD> }) {
  const width = 900;
  const height = 320;
  const values = cvd.map((point) => point.value);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const pointY = (value: number) => height - ((value - low) / range) * height;
  const zeroY = pointY(0);
  const path = cvd.map((point, index) => `${index === 0 ? "M" : "L"} ${(index / Math.max(1, cvd.length - 1)) * width} ${pointY(point.value)}`).join(" ");
  const area = path ? `${path} L ${width} ${zeroY} L 0 ${zeroY} Z` : "";
  const id = `cvd-${cvd.at(-1)?.timestamp ?? "empty"}`;
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full" aria-label="Cumulative volume delta chart"><defs><clipPath id={`${id}-positive`}><rect x="0" y="0" width={width} height={Math.max(0, zeroY)} /></clipPath><clipPath id={`${id}-negative`}><rect x="0" y={zeroY} width={width} height={Math.max(0, height - zeroY)} /></clipPath></defs><line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="var(--border)" strokeDasharray="3 4" /><path d={area} fill="var(--pos)" opacity="0.2" clipPath={`url(#${id}-positive)`} /><path d={area} fill="var(--neg)" opacity="0.2" clipPath={`url(#${id}-negative)`} /><path d={path} fill="none" stroke="var(--mdata)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />{!cvd.length && <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="18">Awaiting observed trade flow</text>}</svg>;
}
