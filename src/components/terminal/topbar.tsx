"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Activity,
  Camera,
  ChevronDown,
  Command,
  PanelRight,
  Play,
  Redo2,
  Search,
  Settings2,
  Share2,
  Undo2,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { cn } from "@/lib/utils";
import type { Timeframe } from "@/lib/market/types";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
];

export function Topbar() {
  const { symbol, setTimeframe, timeframe, setCommandOpen, setView } = useWorkspace();
  const [showFeedHealth, setShowFeedHealth] = useState(false);
  const stream = useMarketStream(symbol, { trades: 1, depth: false, liquidations: 1 });

  const share = async () => {
    const text = `ZTerminal workspace · ${symbol} · ${timeframe}`;
    try {
      if (navigator.share) await navigator.share({ title: "ZTerminal workspace", text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* dismissed or unavailable */ }
  };

  return <header className="relative h-11 sm:h-12 shrink-0 border-b hairline bg-panel flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 overflow-x-auto no-scrollbar" aria-label="Terminal navigation">
    <button onClick={() => setView("chart")} className="shrink-0 grid h-7 w-7 place-items-center rounded-[5px] hover:bg-hover" aria-label="Open chart workspace" title="Open chart workspace"><Image src="/brand/zterminal-mark-v2.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" priority /></button>
    <div className="h-5 w-px bg-foreground/10" />
    <button onClick={() => setCommandOpen(true)} className="shrink-0 h-7 w-[min(42vw,168px)] sm:w-auto sm:min-w-[168px] sm:max-w-[260px] px-2 flex items-center gap-2 rounded-[4px] bg-surface hover:bg-hover border hairline" aria-label={`Search instruments, current ${symbol}`}><Search className="w-3.5 h-3.5 text-muted-foreground" /><span className="truncate text-[11.5px] font-mono-num text-foreground">{symbol}</span><ChevronDown className="ml-auto w-3 h-3 text-muted-foreground" /></button>
    <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono-num"><span className="text-muted-foreground">{stream.provider?.toUpperCase() ?? "MARKET DATA"} · PERP</span></div>
    <div className="h-5 w-px bg-foreground/10" />
    <div className="flex items-center gap-0.5 shrink-0" aria-label="Chart timeframe">{TIMEFRAMES.map((item) => <button key={item.value} onClick={() => setTimeframe(item.value)} className={cn("h-7 min-w-7 px-1.5 rounded-[4px] text-[10.5px] font-mono-num", !["1m", "5m", "15m"].includes(item.value) && "hidden sm:inline-flex", timeframe === item.value ? "bg-mdata/15 text-mdata" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-pressed={timeframe === item.value}>{item.label}</button>)}</div>
    <div className="ml-auto flex items-center gap-0.5 shrink-0"><button onClick={() => setShowFeedHealth((current) => !current)} className={cn("hidden sm:flex h-7 items-center gap-1.5 px-2 rounded-[4px] text-[9.5px] font-mono-num", stream.health?.state === "LIVE" ? "text-pos hover:bg-pos/10" : stream.health?.state === "SYNCING" ? "text-warn hover:bg-warn/10" : "text-muted-foreground hover:bg-hover")} aria-expanded={showFeedHealth} aria-label="Toggle feed health inspector" title="Feed health"><Activity className="w-3.5 h-3.5" /><span>{stream.health?.state ?? stream.dataStatus}</span></button><div className="hidden sm:contents"><Utility label="Undo" onClick={() => window.dispatchEvent(new Event("zterminal:undo"))}><Undo2 /></Utility><Utility label="Redo" onClick={() => window.dispatchEvent(new Event("zterminal:redo"))}><Redo2 /></Utility><Utility label="Capture workspace" onClick={() => window.dispatchEvent(new Event("zterminal:capture"))}><Camera /></Utility><Utility label="Share workspace" onClick={share}><Share2 /></Utility><Utility label="Replay" onClick={() => window.dispatchEvent(new Event("zterminal:replay"))}><Play /></Utility><Utility label="Toggle market context" onClick={() => window.dispatchEvent(new Event("zterminal:context"))}><PanelRight /></Utility></div><Utility label="Settings" onClick={() => setView("settings")}><Settings2 /></Utility><button onClick={() => setCommandOpen(true)} className="grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label="Open command palette" title="Command palette"><Command className="w-3.5 h-3.5" /></button></div>{showFeedHealth && <div className="absolute right-2 top-[calc(100%+6px)] z-50 w-72 rounded-[5px] border hairline bg-panel shadow-xl p-3 text-[10px] font-mono-num"><div className="flex items-center justify-between"><span className="font-semibold uppercase tracking-wider text-foreground">Feed health</span><span className={stream.health?.state === "LIVE" ? "text-pos" : "text-warn"}>{stream.health?.state ?? "PENDING"}</span></div><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground"><dt>Provider</dt><dd className="text-right text-foreground">{(stream.health?.provider ?? stream.provider ?? "Awaiting").toUpperCase()}</dd><dt>Instrument</dt><dd className="text-right text-foreground">{stream.health?.symbol ?? symbol}</dd><dt>Book sequence</dt><dd className="text-right text-foreground">{stream.health?.sequence ?? "Awaiting snapshot"}</dd><dt>Message age</dt><dd className="text-right text-foreground">{stream.health?.latencyMs === undefined ? "Awaiting" : `${stream.health.latencyMs} ms`}</dd><dt>Reconnects</dt><dd className="text-right text-foreground">{stream.health?.reconnectCount ?? 0}</dd></dl>{stream.health?.reason && <p className="mt-2 border-t hairline pt-2 text-warn leading-relaxed">{stream.health.reason}</p>}</div>}</header>;
}

function Utility({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label={label} title={label}>{children}</button>;
}
