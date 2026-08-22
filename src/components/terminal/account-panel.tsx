"use client";

import { Database, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountPanel({ symbol, provider, dataStatus, onClose }: { symbol: string; provider?: string; dataStatus: string; onClose: () => void }) {
  return <section className="zt-account-panel" aria-label="Research account information"><header><div><span>RESEARCH ACCOUNT</span><h2>Read-only workspace</h2></div><button type="button" onClick={onClose} aria-label="Close account information"><X /></button></header><div className="zt-account-avatar"><span>R</span><div><b>Research Mode</b><p>No execution permissions</p></div></div><div className="zt-account-facts"><div><span>Permission scope</span><b><ShieldCheck />Public market research</b></div><div><span>Active provider</span><b><Database />{provider?.toUpperCase() ?? "Awaiting provider"}</b></div><div><span>Selected market</span><b>{symbol}</b></div><div><span>Feed state</span><b className={cn(dataStatus === "LIVE" && "is-live")}>{dataStatus}</b></div></div><div className="zt-account-not-connected"><b>No brokerage account connected</b><p>Balances, positions, identity, cloud-sync status, and order controls are unavailable until a separately authorized account connector is configured.</p></div></section>;
}
