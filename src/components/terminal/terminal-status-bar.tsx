"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronUp,
  Clock,
  Database,
  Globe,
  HardDrive,
  Sliders,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { usePanels } from "@/stores/panels";
import { TimezonePopover } from "./timezone-popover";
import { MarketSessionsPopover } from "./market-sessions-popover";
import { DataConnectionsPopover } from "./data-connections-popover";
import { formatTimezonePill } from "@/lib/market/market-sessions";
import { cn } from "@/lib/utils";

function formatSymbol(sym: string): string {
  if (sym.includes("_")) return sym.replace("_", " / ");
  if (sym.endsWith("USDT")) return `${sym.slice(0, -4)} / USDT`;
  return sym;
}

export function TerminalStatusBar() {
  const { symbol, timeframe, timezone, setTimezone, connection } = useWorkspace();
  const { provider, dataStatus, health, reason } = useMarketStream(symbol, { trades: 1, depth: false });
  const panels = usePanels((s) => s.panels);
  const activePanel = usePanels((s) => s.active);
  const openPanel = usePanels((s) => s.open);

  const [savedTick, setSavedTick] = useState<"saved" | "saving">("saved");

  const openWindows = Object.values(panels).filter((p) => p.status !== "closed");
  const isLive = dataStatus === "LIVE";
  const isConnecting = connection.state === "connecting";
  const isReconnecting = connection.state === "reconnecting";

  return (
    <footer
      className="zt-bottom-status-bar h-7 flex-shrink-0 flex items-center justify-between px-3 border-t border-border/70 bg-[#080b14] text-muted-foreground select-none font-mono text-[10.5px] tracking-tight z-50 overflow-hidden"
      role="status"
      aria-label="Workstation status bar"
    >
      {/* LEFT SECTION: INSTRUMENT, TIMEFRAME & ACTIVE PANELS */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Symbol & Timeframe */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("zterminal:open-symbol-picker"))}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-hover hover:text-foreground text-foreground transition-colors shrink-0"
          title="Change active instrument (Press /)"
          aria-label={`Active symbol: ${symbol}, timeframe ${timeframe}`}
        >
          <span className="font-bold text-foreground">{formatSymbol(symbol)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-mdata font-medium uppercase">{timeframe}</span>
        </button>

        {/* Task tabs for open/minimized desktop windows */}
        {openWindows.length > 0 && (
          <div className="hidden md:flex items-center gap-1 pl-2 border-l border-border/50 overflow-hidden">
            {openWindows.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  openPanel(p.id);
                  requestAnimationFrame(() => document.getElementById(`panel-${p.id}`)?.focus());
                }}
                className={cn(
                  "px-1.5 py-0.2 rounded text-[9.5px] transition-colors flex items-center gap-1",
                  activePanel === p.id && p.status === "open"
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground"
                )}
                aria-label={`${p.status === "minimized" ? "Restore" : "Focus"} ${p.title} window`}
              >
                <span className="text-[9px] opacity-70">
                  {p.status === "minimized" ? "▁" : "▣"}
                </span>
                <span className="truncate max-w-[80px]">{p.title}</span>
              </button>
            ))}
            {openWindows.length > 4 && (
              <span className="text-[9px] text-muted-foreground/60">+{openWindows.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT SECTION: FEED STATUS, PROVIDER/LATENCY, TIMEZONE, SESSIONS, SAVE STATE */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Real Data Feed Status Pill */}
        <DataConnectionsPopover>
          <button
            type="button"
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-hover transition-colors"
            title={`Data feed status: ${dataStatus}`}
            aria-label={`Feed state: ${dataStatus}`}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isLive
                  ? "bg-pos"
                  : isConnecting || isReconnecting
                  ? "bg-mdata animate-pulse"
                  : "bg-muted-foreground/40"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase",
                isLive ? "text-pos" : isConnecting || isReconnecting ? "text-mdata" : "text-muted-foreground"
              )}
            >
              {dataStatus}
            </span>
          </button>
        </DataConnectionsPopover>

        <span className="text-border/80" aria-hidden="true">|</span>

        {/* Data Provider & Measurable Latency */}
        <DataConnectionsPopover />

        <span className="text-border/80 hidden sm:inline" aria-hidden="true">|</span>

        {/* Timezone Selector */}
        <div className="hidden sm:inline-flex">
          <TimezonePopover />
        </div>

        <span className="text-border/80 hidden md:inline" aria-hidden="true">|</span>

        {/* Market Sessions Countdown & Popover */}
        <div className="hidden md:inline-flex">
          <MarketSessionsPopover />
        </div>

        <span className="text-border/80 hidden lg:inline" aria-hidden="true">|</span>

        {/* Contextual Workspace Save State */}
        <button
          type="button"
          onClick={() => {
            setSavedTick("saving");
            setTimeout(() => setSavedTick("saved"), 400);
          }}
          className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-hover text-muted-foreground hover:text-foreground transition-colors"
          title="Workspace layout saved locally"
          aria-label="Workspace state: Saved locally"
        >
          <Check className="h-3 w-3 text-pos" />
          <span className="text-[10px] text-foreground/80 font-mono-num">
            {savedTick === "saved" ? "Saved" : "Saving…"}
          </span>
        </button>
      </div>
    </footer>
  );
}
