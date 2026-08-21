"use client";

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

  const share = async () => {
    const text = `ZTerminal workspace · ${symbol} · ${timeframe}`;
    try {
      if (navigator.share) await navigator.share({ title: "ZTerminal workspace", text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* dismissed or unavailable */ }
  };

  return <header className="h-12 shrink-0 border-b hairline bg-panel flex items-center gap-2 px-2.5 overflow-x-auto no-scrollbar" aria-label="Terminal navigation">
    <button onClick={() => setView("chart")} className="shrink-0 grid h-7 w-7 place-items-center rounded-[5px] text-mdata hover:bg-hover" aria-label="Open chart workspace" title="ZTerminal chart workspace"><span className="text-[18px] leading-none font-bold italic">Z</span></button>
    <div className="h-5 w-px bg-foreground/10" />
    <button onClick={() => setCommandOpen(true)} className="shrink-0 h-7 min-w-[168px] max-w-[260px] px-2 flex items-center gap-2 rounded-[4px] bg-surface hover:bg-hover border hairline" aria-label={`Search instruments, current ${symbol}`}><Search className="w-3.5 h-3.5 text-muted-foreground" /><span className="truncate text-[11.5px] font-mono-num text-foreground">{symbol}</span><ChevronDown className="ml-auto w-3 h-3 text-muted-foreground" /></button>
    <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono-num"><span className="text-muted-foreground">GATE.IO · PERP</span></div>
    <div className="h-5 w-px bg-foreground/10" />
    <div className="flex items-center gap-0.5 shrink-0" aria-label="Chart timeframe">{TIMEFRAMES.map((item) => <button key={item.value} onClick={() => setTimeframe(item.value)} className={cn("h-7 min-w-7 px-1.5 rounded-[4px] text-[10.5px] font-mono-num", timeframe === item.value ? "bg-mdata/15 text-mdata" : "text-muted-foreground hover:text-foreground hover:bg-hover")} aria-pressed={timeframe === item.value}>{item.label}</button>)}</div>
    <div className="ml-auto flex items-center gap-0.5 shrink-0"><Utility label="Undo" onClick={() => window.dispatchEvent(new Event("zterminal:undo"))}><Undo2 /></Utility><Utility label="Redo" onClick={() => window.dispatchEvent(new Event("zterminal:redo"))}><Redo2 /></Utility><Utility label="Capture workspace" onClick={() => window.dispatchEvent(new Event("zterminal:capture"))}><Camera /></Utility><Utility label="Share workspace" onClick={share}><Share2 /></Utility><Utility label="Replay" onClick={() => window.dispatchEvent(new Event("zterminal:replay"))}><Play /></Utility><Utility label="Toggle market context" onClick={() => window.dispatchEvent(new Event("zterminal:context"))}><PanelRight /></Utility><Utility label="Settings" onClick={() => setView("settings")}><Settings2 /></Utility><button onClick={() => setCommandOpen(true)} className="hidden sm:grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label="Open command palette" title="Command palette"><Command className="w-3.5 h-3.5" /></button></div>
  </header>;
}

function Utility({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-label={label} title={label}>{children}</button>;
}
