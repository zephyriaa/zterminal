"use client";

import type { FeedHealth, ProviderId } from "@/lib/market/types";
import { cn } from "@/lib/utils";

export function FeedInspector({ provider, dataStatus, health, reason }: { provider?: ProviderId; dataStatus: string; health: FeedHealth | null; reason?: string }) {
  const granularities = provider === "binance" ? "Aggregate public trades" : provider === "gateio" ? "Public trades" : "Unavailable";
  const lastUpdate = health?.lastMessageAt ?? health?.updatedAt;
  return <div className="absolute bottom-2 left-2 z-40 max-w-72 border hairline bg-panel/92 px-2 py-1.5 font-mono text-[9px] shadow-sm backdrop-blur" aria-label="Feed inspector">
    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">FEED</span><span className={cn(dataStatus === "LIVE" ? "text-pos" : "text-warn")}>{dataStatus}</span></div>
    <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground"><span>Provider</span><span className="text-right text-foreground">{provider ?? "unavailable"}</span><span>Connection</span><span className="text-right text-foreground">{health?.state ?? "connecting"}</span><span>Latency</span><span className="text-right text-foreground">{health?.latencyMs == null ? "—" : `${Math.round(health.latencyMs)} ms`}</span><span>Last update</span><span className="text-right text-foreground">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}</span><span>Trades</span><span className="text-right text-foreground">{granularities}</span>{reason || health?.reason ? <><span>Reason</span><span className="text-right text-warn">{reason ?? health?.reason}</span></> : null}</div>
  </div>;
}
