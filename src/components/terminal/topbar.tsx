"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Command as CommandIcon,
  Search,
  User,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { classifySession, formatClockET, formatClockUTC } from "@/lib/market/session";
import { cn } from "@/lib/utils";

const MARKET_LABEL: Record<string, { label: string; tone: "pos" | "warn" | "muted" }> = {
  rth: { label: "RTH", tone: "pos" },
  pre: { label: "PRE", tone: "warn" },
  post: { label: "POST", tone: "warn" },
  overnight: { label: "ETH", tone: "muted" },
  closed: { label: "CLOSED", tone: "muted" },
};

export function Topbar() {
  const { symbol, setCommandOpen, connection } = useWorkspace();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sess = classifySession("cme", now);
  const m = MARKET_LABEL[sess.label];
  const tone =
    m.tone === "pos" ? "text-pos" : m.tone === "warn" ? "text-warn" : "text-muted-foreground";

  const conn = connection;
  const connTone =
    conn.state === "connected"
      ? "text-mdata"
      : conn.state === "reconnecting" || conn.state === "connecting"
      ? "text-warn"
      : "text-neg";

  return (
    <header className="h-11 shrink-0 border-b hairline bg-panel flex items-center gap-2 px-3">
      {/* Search / command */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group flex items-center gap-2 h-7 px-2.5 rounded-[5px] border hairline bg-surface hover:bg-hover transition-colors min-w-[220px] max-w-[320px] flex-1"
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[12.5px] text-foreground tnum font-medium">{symbol}</span>
        <span className="text-[11px] text-muted-foreground ml-1">search…</span>
        <kbd className="ml-auto hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground border hairline rounded px-1 h-4">
          <CommandIcon className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Market status */}
      <div className="hidden md:flex items-center gap-2">
        <div className="flex items-center gap-1.5 h-7 px-2 rounded-[5px] border hairline bg-surface">
          <span className={cn("w-1.5 h-1.5 rounded-full", tone === "text-pos" ? "bg-pos" : tone === "text-warn" ? "bg-warn" : "bg-muted-foreground/50")} />
          <span className={cn("text-[11px] font-semibold tracking-wide", tone)}>{m.label}</span>
        </div>

        {/* Clocks */}
        <Clock label="NY" value={formatClockET(now)} />
        <Clock label="UTC" value={formatClockUTC(now)} />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Connection */}
        <div
          className="hidden sm:flex items-center gap-1.5 h-7 px-2 rounded-[5px] border hairline bg-surface"
          title={`Provider: ${conn.provider} · ${conn.environment}`}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", connTone, "bg-current")} />
          <span className={cn("text-[11px] font-medium uppercase tracking-wide", connTone)}>
            {conn.dataStatus}
          </span>
        </div>

        <IconBtn label="Alerts" onClick={() => useWorkspace.getState().setView("alerts")}>
          <Bell className="w-4 h-4" />
        </IconBtn>
        <IconBtn label="Account">
          <User className="w-4 h-4" />
        </IconBtn>
      </div>
    </header>
  );
}

function Clock({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden lg:flex items-center gap-1.5 h-7 px-2 rounded-[5px] border hairline bg-surface">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-[11.5px] tnum text-foreground/90">{value}</span>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid place-items-center h-7 w-7 rounded-[5px] text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
    >
      {children}
    </button>
  );
}
