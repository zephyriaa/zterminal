"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import { Panel, PanelHeader, Pill } from "../terminal/primitives";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { getContract } from "@/lib/market/contracts";

interface MarketRow {
  symbol: string;
  description: string;
  exchange: string;
  product: string;
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  supportsDepth: boolean;
  supportsMBO: boolean;
}

function fmt(p: number, tick: number) {
  const d = tick >= 1 ? 2 : Math.max(2, Math.round(-Math.log10(tick)));
  return p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function MarketsView() {
  const { setSymbol, setView, symbol } = useWorkspace();
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [providerState, setProviderState] = useState({ provider: "gateio", dataStatus: "DISCONNECTED" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await fetch("/api/markets");
      const j = await r.json();
      if (!cancelled) {
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setProviderState({ provider: j.provider ?? "gateio", dataStatus: j.dataStatus ?? "UNAVAILABLE" });
        setLoading(false);
      }
    })();
    const id = setInterval(async () => {
      const r = await fetch("/api/markets");
      const j = await r.json();
      if (!cancelled) {
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setProviderState({ provider: j.provider ?? "gateio", dataStatus: j.dataStatus ?? "UNAVAILABLE" });
      }
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = rows.filter((r) =>
    !q ? true : r.symbol.includes(q.toUpperCase()) || r.description.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b hairline bg-panel flex items-center gap-2 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Markets</span>
        <Pill tone={providerState.dataStatus === "LIVE" ? "pos" : "warn"}>
          {providerState.provider.toUpperCase()} · {providerState.dataStatus}
        </Pill>
        <div className="relative ml-auto w-56">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter symbols…"
            className="h-7 pl-7 text-[12px] bg-surface border hairline"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const tick = getContract(r.symbol).tickSize;
            const up = r.change >= 0;
            const active = r.symbol === symbol;
            return (
              <button
                key={r.symbol}
                onClick={() => {
                  setSymbol(r.symbol);
                  setView("chart");
                }}
                className={cn(
                  "text-left border hairline rounded-[6px] bg-panel hover:bg-hover/60 transition-colors p-3",
                  active && "border-mdata/40 bg-mdata/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono-num text-[13px] font-semibold">{r.symbol}</span>
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wide">{r.exchange}</span>
                  {r.supportsDepth && (
                    <span className="ml-auto text-[9px] text-mdata uppercase tracking-wide">Depth</span>
                  )}
                </div>
                <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">{r.description}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={cn("text-[16px] tnum font-semibold", up ? "text-pos" : "text-neg")}>
                    {fmt(r.price, tick)}
                  </span>
                  <span className={cn("text-[11px] tnum flex items-center gap-0.5", up ? "text-pos" : "text-neg")}>
                    {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {up ? "+" : ""}{fmt(r.change, tick)} ({up ? "+" : ""}{r.changePct.toFixed(2)}%)
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] tnum text-muted-foreground">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider opacity-70">High</div>
                    <div className="text-foreground/80">{fmt(r.dayHigh, tick)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider opacity-70">Low</div>
                    <div className="text-foreground/80">{fmt(r.dayLow, tick)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider opacity-70">Vol</div>
                    <div className="text-foreground/80">{(r.volume / 1000).toFixed(0)}k</div>
                  </div>
                </div>
              </button>
            );
          })}
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[124px] border hairline rounded-[6px] bg-panel animate-pulse" />
            ))}
        </div>
      </div>
    </div>
  );
}
