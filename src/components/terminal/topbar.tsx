"use client";

import { useEffect, useState } from "react";
import {
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
import { classifySession, formatClockET, formatClockUTC } from "@/lib/market/session";
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
  const { symbol, setTimeframe, timeframe, setCommandOpen, setView, connection } = useWorkspace();
  const [now, setNow] = useState(0);
  const session = classifySession("cme", now);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const share = async () => {
    const text = `ZTerminal workspace · ${symbol} · ${timeframe}`;
    try {
      if (navigator.share) await navigator.share({ title: "ZTerminal workspace", text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* dismissed or unavailable */ }
  };

  return <header className="h-12 shrink-0 border-b hairline bg-panel flex items-center gap-2 px-2.5 overflow-x-auto no-scrollbar" aria-label="Terminal navigation">
    <button onClick={() => setView("chart")} className="shrink-0 flex items-center gap-2 pr-2 border-r hairline" aria-label="Open chart workspace"><span className="grid place-items-center h-6 w-6 rounded-[5px] bg-mdata text-[#0b1117] font-bold text-[11px]">Z</span><span className="hidden sm:inline text-[11px] font-semibold tracking-[0.18em]">ZTERMINAL</span></button>
    <nav className="hidden xl:flex items-center gap-0.5" aria-label="Workspace sections">
      <TopNav label="Charts" active onClick={() => setView("chart")} />
      <TopNav label="Research" onClick={() => { setView("chart"); window.dispatchEvent(new CustomEvent("zterminal:open-dock", { detail: "research" })); }} />
      <TopNav label="Strategy" onClick={() => { setView("chart"); window.dispatchEvent(new CustomEvent("zterminal:open-dock", { detail: "script" })); }} />
      <TopNav label="Data" onClick={() => { setView("chart"); window.dispatchEvent(new CustomEvent("zterminal:open-dock", { detail: "data" })); }} />
    </nav>
    <div className="h-5 w-px bg-foreground/10" />
    <button onClick={() => setCommandOpen(true)} className="shrink-0 h-7 min-w-[138px] max-w-[200px] px-2 flex items-center gap-2 rounded-[4px] bg-surface hover:bg-hover border hairline" aria-label={`Search instruments, current ${symbol}`}><Search className="w-3.5 h-3.5 text-muted-foreground" /><span className="truncate text-[11.5px] font-mono-num text-foreground">{symbol}</span><ChevronDown className="ml-auto w-3 h-3 text-muted-foreground" /></button>
    <span className="hidden md:inline text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Gate.io · Perpetual</span>
    <div className="h-5 w-px bg-foreground/10" />
    <div className="flex items-center gap-0.5 shrink-0" aria-label="Chart timeframe">
      {TIMEFRAMES.map((item) => <button key={item.value} onClick={() => setTimeframe(item.value)} className={cn("h-7 min-w-7 px-1.5 rounded-[4px] text-[10.5px] font-mono-num", timeframe === item.value ? "bg-mdata/15 text-mdata" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-pressed={timeframe === item.value}>{item.label}</button>)}
    </div>
    <div className="ml-auto flex items-center gap-0.5 shrink-0">
      <span className="hidden 2xl:flex items-center gap-2 px-2 text-[10px] font-mono-num text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", session.label === "rth" ? "bg-pos" : "bg-warn")} />{session.label.toUpperCase()} · {now ? formatClockET(now) : "—"} ET · {now ? formatClockUTC(now) : "—"} UTC</span>
      <span className={cn("hidden lg:inline-flex items-center gap-1.5 px-2 text-[9px] uppercase tracking-[0.14em]", connection.dataStatus === "LIVE" ? "text-pos" : "text-warn")}><span className="h-1.5 w-1.5 rounded-full bg-current" />{connection.dataStatus}</span>
      <Utility label="Undo" onClick={() => window.dispatchEvent(new Event("zterminal:undo"))}><Undo2 /></Utility>
      <Utility label="Redo" onClick={() => window.dispatchEvent(new Event("zterminal:redo"))}><Redo2 /></Utility>
      <Utility label="Capture workspace" onClick={() => window.dispatchEvent(new Event("zterminal:capture"))}><Camera /></Utility>
      <Utility label="Share workspace" onClick={share}><Share2 /></Utility>
      <Utility label="Replay" onClick={() => window.dispatchEvent(new Event("zterminal:replay"))}><Play /></Utility>
      <Utility label="Toggle context panel" onClick={() => window.dispatchEvent(new Event("zterminal:context"))}><PanelRight /></Utility>
      <Utility label="Settings" onClick={() => setView("settings")}><Settings2 /></Utility>
      <button onClick={() => setCommandOpen(true)} className="hidden sm:grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label="Open command palette" title="Command palette"><Command className="w-3.5 h-3.5" /></button>
    </div>
  </header>;
}

function TopNav({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn("h-7 px-2 rounded-[4px] text-[10.5px]", active ? "text-foreground bg-hover" : "text-muted-foreground hover:text-foreground hover:bg-hover/70")}>{label}</button>;
}

function Utility({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label={label} title={label}>{children}</button>;
}
