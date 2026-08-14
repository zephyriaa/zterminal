"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Radio, Waves } from "lucide-react";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useWorkspace } from "@/stores/workspace";
import { getContract, listContracts } from "@/lib/market/contracts";
import type { DepthLevel } from "@/lib/market/types";
import { Panel, Pill } from "../terminal/primitives";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type OFTab = "dom" | "footprint" | "cvd";

function fmt(p: number, tick: number) {
  const d = tick >= 1 ? 2 : Math.max(2, Math.round(-Math.log10(tick)));
  return p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function OrderFlowView() {
  const { symbol, setSymbol } = useWorkspace();
  const c = getContract(symbol);
  const [tab, setTab] = useState<OFTab>("dom");
  const { trades, depth, quote, dataStatus, provider, state } = useMarketStream(symbol, { trades: 300, depth: true });

  const lastPrice = trades[trades.length - 1]?.price ?? c.basePrice;

  // footprint: aggregate trades into price bins around current price
  const footprint = useMemo(() => {
    const bins = new Map<number, { buy: number; sell: number }>();
    for (const t of trades.slice(-200)) {
      const key = Math.round(t.price / c.tickSize) * c.tickSize;
      const b = bins.get(key) ?? { buy: 0, sell: 0 };
      if (t.side === "buy") b.buy += t.quantity;
      else b.sell += t.quantity;
      bins.set(key, b);
    }
    return Array.from(bins.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 24);
  }, [trades, c.tickSize]);

  const maxBin = Math.max(1, ...footprint.map(([, b]) => b.buy + b.sell));

  const domRows = useMemo(() => {
    const bids = depth.filter((level) => level.side === "buy").sort((a, b) => b.price - a.price);
    const asks = depth.filter((level) => level.side === "sell").sort((a, b) => a.price - b.price);
    return Array.from({ length: Math.max(bids.length, asks.length) }, (_, index) => ({ bid: bids[index], ask: asks[index] }));
  }, [depth]);

  const cumulativeBids = useMemo(() => {
    return depth
      .filter((level) => level.side === "buy")
      .sort((a, b) => b.price - a.price)
      .reduce<Array<DepthLevel & { cumulative: number }>>((levels, level) => {
        const cumulative = (levels.at(-1)?.cumulative ?? 0) + level.size;
        return [...levels, { ...level, cumulative }];
      }, []);
  }, [depth]);
  const maxCumulativeBid = cumulativeBids.at(-1)?.cumulative ?? 1;

  // CVD over time buckets
  const cvd = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const t of trades) {
      const bucket = Math.floor(t.timestamp / 1000) * 1000;
      const d = (t.side === "buy" ? 1 : -1) * t.quantity;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + d);
    }
    let cum = 0;
    return Array.from(buckets.entries()).slice(-80).map(([t, d]) => {
      cum += d;
      return { t, v: cum };
    });
  }, [trades]);

  const cvdRange = cvd.length ? { lo: Math.min(...cvd.map((p) => p.v)), hi: Math.max(...cvd.map((p) => p.v)) } : { lo: 0, hi: 1 };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b hairline bg-panel flex items-center gap-2 px-3">
        <Waves className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Order Flow</span>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="h-7 w-24 text-[12px] bg-surface"><SelectValue /></SelectTrigger>
          <SelectContent>{listContracts().map((cc) => <SelectItem key={cc.symbol} value={cc.symbol}>{cc.symbol}</SelectItem>)}</SelectContent>
        </Select>
        <Pill tone={c.supportsDepth ? "pos" : "warn"}>{c.supportsDepth ? "Depth" : "Top-of-book"}</Pill>
        {!c.supportsDepth && (
          <span className="text-[10px] text-muted-foreground">
            Exchange depth is unavailable for {symbol}; no synthetic depth is substituted.
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[14px] tnum font-semibold text-foreground">{fmt(lastPrice, c.tickSize)}</span>
          <Pill tone={dataStatus === "LIVE" ? "pos" : dataStatus === "STALE" || state === "degraded" ? "warn" : "default"}>
            {(provider ?? "gateio").toUpperCase()} · {dataStatus}
          </Pill>
        </div>
      </div>

      {/* tabs */}
      <div className="h-8 border-b hairline bg-panel flex items-center px-2 gap-1">
        {(["dom", "footprint", "cvd"] as OFTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("h-6 px-2.5 rounded-[3px] text-[11px] uppercase tracking-wide transition-colors", tab === t ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground")}>{t}</button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* DOM */}
        {tab === "dom" && (
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 overflow-y-auto scroll-thin">
              <table className="w-full text-[11px] tnum">
                <thead className="sticky top-0 bg-panel border-b hairline">
                  <tr className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-right font-medium px-3 py-1.5">Bid sz</th>
                    <th className="text-right font-medium px-2 py-1.5">Bid</th>
                    <th className="text-right font-medium px-2 py-1.5">Ask</th>
                    <th className="text-right font-medium px-3 py-1.5">Ask sz</th>
                  </tr>
                </thead>
                <tbody>
                  {domRows.map(({ bid, ask }, index) => (
                    <tr key={`${bid?.price ?? "none"}-${ask?.price ?? "none"}-${index}`} className={cn("border-b hairline/40", (bid && Math.abs(bid.price - lastPrice) < c.tickSize * 2) || (ask && Math.abs(ask.price - lastPrice) < c.tickSize * 2) ? "bg-hover/40" : undefined)}>
                      <td className="px-3 py-1 text-right text-muted-foreground">{bid?.size ?? ""}</td>
                      <td className="px-2 py-1 text-right text-neg">{bid ? fmt(bid.price, c.tickSize) : ""}</td>
                      <td className="px-2 py-1 text-right text-pos">{ask ? fmt(ask.price, c.tickSize) : ""}</td>
                      <td className="px-3 py-1 text-right text-muted-foreground">{ask?.size ?? ""}</td>
                    </tr>
                  ))}
                  {!domRows.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-[11px] text-muted-foreground">Awaiting a verified order-book snapshot from {provider ?? "the active provider"}.</td></tr>}
                </tbody>
              </table>
            </div>
            {/* cumulative depth */}
            <div className="w-[200px] border-l hairline overflow-y-auto scroll-thin">
              <div className="h-7 border-b hairline bg-panel flex items-center px-2.5"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cumulative</span></div>
              {cumulativeBids.map((level) => {
                const pct = Math.min(100, (level.cumulative / maxCumulativeBid) * 100);
                return (
                  <div key={level.price} className="px-2 py-1 border-b hairline/40 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-pos/50" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] tnum text-muted-foreground w-10 text-right">{level.cumulative}</span>
                  </div>
                );
              })}
              {!cumulativeBids.length && <p className="px-2 py-3 text-[10px] text-muted-foreground">No bid levels received.</p>}
            </div>
          </div>
        )}

        {/* Footprint */}
        {tab === "footprint" && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-2">
            <div className="max-w-md mx-auto">
              <div className="grid grid-cols-[1fr_80px_1fr] gap-1 text-[9.5px] uppercase tracking-wider text-muted-foreground px-2 mb-1">
                <span className="text-right">Bid vol</span>
                <span className="text-center">Price</span>
                <span className="text-left">Ask vol</span>
              </div>
              {!footprint.length && <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">Awaiting observed public trades. No synthetic footprint levels are generated.</p>}
              {footprint.map(([price, b]) => {
                const total = b.buy + b.sell;
                const buyPct = total ? (b.buy / total) * 100 : 0;
                const sellPct = 100 - buyPct;
                const imbalance = Math.abs(buyPct - 50);
                const tone = imbalance > 25 ? (buyPct > 50 ? "pos" : "neg") : "muted";
                return (
                  <div key={price} className="grid grid-cols-[1fr_80px_1fr] gap-1 items-center py-0.5 px-2 rounded-[3px] hover:bg-hover/40">
                    <div className="flex items-center justify-end gap-1">
                      <span className={cn("text-[10.5px] tnum", tone === "pos" ? "text-pos" : "text-muted-foreground")}>{b.sell}</span>
                      <div className="h-2 bg-neg/30 rounded-sm" style={{ width: `${(b.sell / maxBin) * 60}px` }} />
                    </div>
                    <div className={cn("text-center text-[11px] tnum font-medium", Math.abs(price - lastPrice) < c.tickSize ? "text-foreground bg-hover rounded px-1" : "text-muted-foreground")}>{fmt(price, c.tickSize)}</div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 bg-pos/30 rounded-sm" style={{ width: `${(b.buy / maxBin) * 60}px` }} />
                      <span className={cn("text-[10.5px] tnum", tone === "neg" ? "text-neg" : "text-muted-foreground")}>{b.buy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CVD */}
        {tab === "cvd" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 p-2 relative">
              <CVDChart cvd={cvd} range={cvdRange} />
            </div>
            <div className="h-[200px] border-t hairline overflow-y-auto scroll-thin">
              <div className="h-7 border-b hairline bg-panel flex items-center px-2.5"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Time & Sales</span><span className="ml-auto text-[9.5px] text-muted-foreground">exchange-reported side</span></div>
              <table className="w-full text-[10.5px] tnum">
                <tbody>
                  {trades.slice().reverse().slice(0, 60).map((t) => (
                    <tr key={`${t.timestamp}-${t.sequence}`} className="border-b hairline/40">
                      <td className="px-2 py-1 text-muted-foreground">{new Date(t.timestamp).toISOString().slice(11, 19)}</td>
                      <td className={cn("px-2 py-1", t.side === "buy" ? "text-pos" : "text-neg")}>{t.side === "buy" ? "BUY" : "SELL"}</td>
                      <td className="px-2 py-1 text-right">{fmt(t.price, c.tickSize)}</td>
                      <td className="px-2 py-1 text-right text-muted-foreground">{t.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CVDChart({ cvd, range }: { cvd: { t: number; v: number }[]; range: { lo: number; hi: number } }) {
  const W = 800, H = 320;
  const r = range.hi - range.lo || 1;
  const path = cvd.length
    ? cvd.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (cvd.length - 1 || 1)) * W} ${H - ((p.v - range.lo) / r) * H}`).join(" ")
    : "";
  const zeroY = H - ((0 - range.lo) / r) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="var(--border)" strokeDasharray="2 3" />
      <path d={path} fill="none" stroke="var(--mdata)" strokeWidth="1.2" />
    </svg>
  );
}

export { Activity, BarChart3, Radio };
