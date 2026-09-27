"use client";

import { useState } from "react";
import { useGexSurface } from "@/lib/gex/use-gex-surface";
import type { DealerConvention } from "@/lib/gex/types";

export function GexSurfacePanel() {
  const [underlying, setUnderlying] = useState<'BTC' | 'ETH'>('BTC');
  const [convention, setConvention] = useState<DealerConvention>('DEALER_LONG_CALLS_SHORT_PUTS');

  const { profile, error, isLoading, isLive, isDegraded } = useGexSurface(underlying, {
    dealerConvention: convention,
  });

  const formatUsd = (val: number | null | undefined) => {
    if (val == null || !Number.isFinite(val)) return "N/A";
    return `$${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const formatGex = (val: number | null | undefined) => {
    if (val == null || !Number.isFinite(val)) return "N/A";
    const abs = Math.abs(val);
    if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(0)}`;
  };

  const isUnavailable = profile.health === "UNAVAILABLE" || profile.health === "FAILED";
  const isDisconnected = profile.health === "CONNECTING" && profile.timestamp === 0;

  // Filter strikes within +/- 30% of current index price for focused display
  const spot = profile.indexPrice;
  const filteredStrikes = spot > 0
    ? profile.strikes.filter(s => s.strike >= spot * 0.7 && s.strike <= spot * 1.3).slice(0, 20)
    : profile.strikes.slice(0, 20);

  return (
    <section className="zt-gex-panel flex flex-col h-full bg-background text-foreground text-xs" aria-label="Deribit GEX Surface" data-testid="gex-surface-panel">
      {/* Header */}
      <header className="flex items-center justify-between p-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <b>{underlying} Options GEX Surface</b>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono border border-amber-500/20">
            [ESTIMATE]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-secondary text-foreground text-[11px] rounded px-1.5 py-0.5 border border-border"
            value={underlying}
            onChange={e => setUnderlying(e.target.value as 'BTC' | 'ETH')}
          >
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            isLive ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
            isDegraded ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
            "bg-rose-500/10 text-rose-500 border border-rose-500/20"
          }`}>
            {profile.health}
          </span>
        </div>
      </header>

      {/* Metrics Bar */}
      <div className="grid grid-cols-4 gap-2 p-2 border-b border-border bg-card text-[11px]">
        <div>
          <div className="text-muted-foreground text-[10px]">Index Spot</div>
          <div className="font-mono font-semibold">{spot > 0 ? formatUsd(spot) : "UNAVAILABLE"}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-[10px]">Gamma Flip (Est.)</div>
          <div className="font-mono font-semibold text-amber-500">
            {profile.gammaFlip ? formatUsd(profile.gammaFlip) : "UNAVAILABLE"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-[10px]">Call OI Wall</div>
          <div className="font-mono font-semibold text-emerald-500">{formatUsd(profile.callOiWall)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-[10px]">Put OI Wall</div>
          <div className="font-mono font-semibold text-rose-500">{formatUsd(profile.putOiWall)}</div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 gap-2 px-2 py-1.5 border-b border-border bg-muted/10 text-[10px]">
        <div>
          <span className="text-muted-foreground">Gross Gamma: </span>
          <span className="font-mono font-medium">{formatGex(profile.totalGrossGamma)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Net Dealer GEX: </span>
          <span className={`font-mono font-medium ${profile.netGex >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {formatGex(profile.netGex)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Updated: </span>
          <span className="font-mono">{profile.timestamp ? new Date(profile.timestamp).toLocaleTimeString() : "N/A"}</span>
        </div>
      </div>

      {/* Main Content Area */}
      {isUnavailable || (!isLive && !profile.strikes.length) ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground" role="status">
          <b className="text-sm font-semibold mb-1 text-foreground">
            {isUnavailable ? "FEED: UNAVAILABLE" : "FEED: DISCONNECTED"}
          </b>
          <p className="text-xs max-w-sm">
            {error ?? "Connecting to Deribit options order flow feeds. Live GEX calculation requires active market connectivity."}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">Deribit Options Strike Profile for {underlying}</caption>
            <thead className="sticky top-0 bg-muted text-[10px] text-muted-foreground border-b border-border">
              <tr>
                <th className="py-1 px-2">Strike</th>
                <th className="py-1 px-2 text-right">Call OI</th>
                <th className="py-1 px-2 text-right">Call GEX</th>
                <th className="py-1 px-2 text-right">Put GEX</th>
                <th className="py-1 px-2 text-right">Net GEX (Est.)</th>
                <th className="py-1 px-2 text-right">Put OI</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px] divide-y divide-border/50">
              {filteredStrikes.map(s => {
                const isAtm = spot > 0 && Math.abs(s.strike - spot) / spot < 0.015;
                const isFlip = profile.gammaFlip && Math.abs(s.strike - profile.gammaFlip) / profile.gammaFlip < 0.015;
                return (
                  <tr
                    key={s.strike}
                    className={`hover:bg-muted/40 transition-colors ${
                      isAtm ? "bg-primary/10 font-bold" : isFlip ? "bg-amber-500/10 font-bold" : ""
                    }`}
                  >
                    <td className="py-1 px-2 flex items-center gap-1">
                      <span>{s.strike.toLocaleString()}</span>
                      {isAtm && <span className="text-[9px] px-1 rounded bg-primary text-primary-foreground font-sans">ATM</span>}
                      {isFlip && <span className="text-[9px] px-1 rounded bg-amber-500 text-black font-sans">FLIP</span>}
                    </td>
                    <td className="py-1 px-2 text-right text-emerald-500">{s.callOI.toFixed(1)}</td>
                    <td className="py-1 px-2 text-right text-emerald-400">{formatGex(s.callGex)}</td>
                    <td className="py-1 px-2 text-right text-rose-400">{formatGex(s.putGex)}</td>
                    <td className={`py-1 px-2 text-right ${s.netGex >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {formatGex(s.netGex)}
                    </td>
                    <td className="py-1 px-2 text-right text-rose-500">{s.putOI.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <footer className="p-1.5 border-t border-border bg-muted/20 text-[10px] text-muted-foreground flex justify-between items-center">
        <span>Convention: Market Maker Net Long Calls / Net Short Puts</span>
        <span>Deribit Options Feed</span>
      </footer>
    </section>
  );
}
