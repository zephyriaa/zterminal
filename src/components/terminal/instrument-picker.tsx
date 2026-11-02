"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, DatabaseZap, Globe, Landmark, LineChart, Search, ShieldCheck, Sparkles, Star, TrendingUp } from "lucide-react";
import type { ContractMetadata, MarketProvider } from "@/lib/market/types";
import { useAllCryptoCatalogues } from "@/hooks/use-contract-catalog";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

const RECENT_KEY = "zterminal.verified-recent-symbols.v3";
const FAVORITES_KEY = "zterminal.verified-favorite-roots.v1";

type AssetTab = "crypto" | "futures" | "stocks" | "indices";

const TABS: { id: AssetTab; label: string; icon: React.ReactNode }[] = [
  { id: "crypto", label: "Crypto", icon: <TrendingUp className="h-3 w-3" /> },
  { id: "futures", label: "Futures", icon: <Landmark className="h-3 w-3" /> },
  { id: "stocks", label: "Stocks", icon: <LineChart className="h-3 w-3" /> },
  { id: "indices", label: "Indices", icon: <Globe className="h-3 w-3" /> },
];

const PRIORITY_ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "SUI", "NEAR", "APT", "PEPE", "SHIB"];

function displaySymbol(symbol: string) {
  return symbol.endsWith("USDT") ? `${symbol.slice(0, -4).replace(/_$/, "")} / USDT` : symbol.replace(/[_-]/g, " / ");
}

function readList(key: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}

function saveList(key: string, entries: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify(entries)); } catch { /* optional local */ }
}

interface CryptoAssetGroup {
  root: string;
  name: string;
  description: string;
  venues: Map<string, ContractMetadata>;
}

export function InstrumentPicker({ compact = false }: { compact?: boolean }) {
  const { symbol, setSymbol, marketProvider, setMarketProvider, aggregated, setAggregated } = useWorkspace();
  const { contracts, loading } = useAllCryptoCatalogues();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AssetTab>("crypto");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const recentRoots = useMemo(() => readList(RECENT_KEY), [open]);

  // Group all contracts across venues by root symbol
  const assetGroups = useMemo<CryptoAssetGroup[]>(() => {
    const map = new Map<string, CryptoAssetGroup>();
    for (const contract of contracts) {
      const root = (contract.root || contract.symbol.replace(/[-_]?USDT(-SWAP)?$/i, "")).toUpperCase();
      if (!root) continue;
      let group = map.get(root);
      if (!group) {
        group = {
          root,
          name: root,
          description: contract.description,
          venues: new Map(),
        };
        map.set(root, group);
      }
      const ex = contract.exchange.toLowerCase();
      group.venues.set(ex, contract);
    }

    return Array.from(map.values()).sort((a, b) => {
      const aIdx = PRIORITY_ASSETS.indexOf(a.root);
      const bIdx = PRIORITY_ASSETS.indexOf(b.root);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.root.localeCompare(b.root);
    });
  }, [contracts]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return assetGroups;
    const term = query.trim().toLowerCase();
    return assetGroups.filter(g =>
      g.root.toLowerCase().includes(term) ||
      g.description.toLowerCase().includes(term) ||
      Array.from(g.venues.values()).some(c => c.symbol.toLowerCase().includes(term))
    );
  }, [assetGroups, query]);

  useEffect(() => {
    const openPicker = () => {
      setFavorites(readList(FAVORITES_KEY));
      setTab("crypto");
      setActiveIndex(0);
      setOpen(true);
    };
    window.addEventListener("zterminal:open-symbol-picker", openPicker);
    return () => window.removeEventListener("zterminal:open-symbol-picker", openPicker);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 15);
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const chooseAggregated = (group: CryptoAssetGroup) => {
    const representative = group.venues.get("binance")?.symbol ?? group.venues.get("bybit")?.symbol ?? group.venues.get("gateio")?.symbol ?? `${group.root}USDT`;
    setAggregated(true);
    setSymbol(representative);
    saveList(RECENT_KEY, [group.root, ...readList(RECENT_KEY).filter(r => r !== group.root)].slice(0, 8));
    setOpen(false);
    setQuery("");
  };

  const chooseSingleVenue = (venue: MarketProvider, contract: ContractMetadata) => {
    setAggregated(false);
    setMarketProvider(venue);
    setSymbol(contract.symbol);
    saveList(RECENT_KEY, [contract.root.toUpperCase(), ...readList(RECENT_KEY).filter(r => r !== contract.root.toUpperCase())].slice(0, 8));
    setOpen(false);
    setQuery("");
  };

  const toggleFavorite = (root: string) => {
    setFavorites(current => {
      const next = current.includes(root) ? current.filter(r => r !== root) : [root, ...current].slice(0, 30);
      saveList(FAVORITES_KEY, next);
      return next;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(i => Math.min(Math.max(0, filteredGroups.length - 1), i + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    }
    if (event.key === "Enter" && filteredGroups[activeIndex]) {
      event.preventDefault();
      chooseAggregated(filteredGroups[activeIndex]);
    }
    if (event.key === "Escape") setOpen(false);
  };

  const quickPills = useMemo(() => {
    const set = new Set<string>([...favorites, ...recentRoots]);
    return Array.from(set).slice(0, 8);
  }, [favorites, recentRoots]);

  const currentRoot = symbol.replace(/[-_]?USDT(-SWAP)?$/i, "").toUpperCase();
  const triggerText = `${displaySymbol(symbol)}${aggregated ? " · Aggregated" : ""}`;

  return (
    <div ref={rootRef} className={cn("zt-instrument-picker", compact && "is-compact")}>
      <button
        type="button"
        className="zt-instrument-picker-trigger"
        onClick={() => {
          if (!open) setFavorites(readList(FAVORITES_KEY));
          setActiveIndex(0);
          setOpen(v => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Choose market, current ${symbol}`}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="font-mono-num font-semibold">{triggerText}</span>
        {aggregated && (
          <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-mono uppercase bg-[#8e72e8]/20 text-[#c8b7ff] border border-[#8e72e8]/30">
            4 Venues
          </span>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className="zt-instrument-picker-menu zt-market-browser"
          role="dialog"
          aria-label="Market selector"
          onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
        >
          {/* Top Tabs */}
          <div className="zt-market-browser-tabs" role="group" aria-label="Asset class views">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                className={cn(tab === t.id && "is-active font-semibold")}
                onClick={() => { setTab(t.id); setActiveIndex(0); }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {tab === "crypto" ? (
            <>
              {/* Search row */}
              <div className="zt-instrument-search-row">
                <Search className="h-3.5 w-3.5" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
                  onKeyDown={onKeyDown}
                  placeholder="Search symbol, asset, or market (e.g. BTC, ETH, SOL)"
                  aria-label="Search contracts"
                />
                <kbd>↑ ↓ Enter</kbd>
              </div>

              {/* Quick Starred & Recent Strip */}
              {quickPills.length > 0 && !query && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#21262d] overflow-x-auto scroll-thin bg-black/20">
                  <span className="text-[8.5px] uppercase tracking-wider text-[#6e7d99] flex-shrink-0">Quick:</span>
                  {quickPills.map(root => {
                    const isFav = favorites.includes(root);
                    const group = assetGroups.find(g => g.root === root);
                    return (
                      <button
                        key={root}
                        type="button"
                        onClick={() => { if (group) chooseAggregated(group); }}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-mono border transition-colors",
                          currentRoot === root
                            ? "bg-[#8e72e8]/25 border-[#8e72e8] text-[#d8cdff]"
                            : "bg-[#161b22] hover:bg-[#21262d] text-[#c9d1d9] border-[#30363d]"
                        )}
                      >
                        {isFav && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                        <span>{root}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Market Browser List */}
              <div className="zt-market-browser-list scroll-thin">
                {loading && (
                  <BrowserNotice
                    icon={<DatabaseZap />}
                    title="Loading multi-venue catalogue"
                    body="Syncing perpetual contracts across Binance, Bybit, OKX, and Gate.io…"
                  />
                )}
                {!loading && (
                  <div className="p-2 space-y-1">
                    {filteredGroups.map((group, index) => {
                      const isHighlighted = index === activeIndex;
                      const isFav = favorites.includes(group.root);
                      const isSelected = currentRoot === group.root;

                      return (
                        <div
                          key={group.root}
                          className={cn(
                            "flex items-center justify-between p-2 rounded border border-transparent transition-colors cursor-pointer group",
                            (isHighlighted || isSelected) ? "bg-[#8e72e8]/12 border-[#8e72e8]/30" : "hover:bg-white/[0.03]"
                          )}
                          onClick={() => chooseAggregated(group)}
                        >
                          {/* Symbol & Label */}
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              className={cn(
                                "p-1 rounded text-[#657590] hover:text-amber-400 transition-colors",
                                isFav && "text-amber-400"
                              )}
                              onClick={e => {
                                e.stopPropagation();
                                toggleFavorite(group.root);
                              }}
                              aria-label="Toggle favorite"
                            >
                              <Star className={cn("h-3 w-3", isFav && "fill-amber-400")} />
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#e1e8f7]">
                                <span>{group.root} / USDT</span>
                                <span className="text-[9px] font-normal text-[#7989a5]">· Perp</span>
                              </div>
                              <div className="text-[9.5px] text-[#8190ac] truncate">
                                {group.venues.size} venues available
                              </div>
                            </div>
                          </div>

                          {/* Venue Chips */}
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {/* Aggregated chip (Default) */}
                            <button
                              type="button"
                              className={cn(
                                "px-1.5 py-0.5 text-[8.5px] rounded font-mono border transition-colors flex items-center gap-0.5",
                                isSelected && aggregated
                                  ? "bg-[#8e72e8]/30 border-[#8e72e8] text-[#d8cdff] font-semibold"
                                  : "border-[#30363d] bg-[#161b22] text-[#8b949e] hover:border-[#8e72e8]/60 hover:text-[#e1e8f7]"
                              )}
                              onClick={() => chooseAggregated(group)}
                              title="Volume-weighted OHLC across 4 venues with 2% outlier rejection"
                            >
                              <Sparkles className="h-2 w-2 text-[#a78bfa]" />
                              <span>Aggregated</span>
                            </button>

                            {/* Individual venue chips */}
                            {(["binance", "bybit", "okx", "gateio"] as const).map(vId => {
                              const c = group.venues.get(vId);
                              if (!c) return null;
                              const isVenueSelected = isSelected && !aggregated && marketProvider === vId;
                              const label = vId === "gateio" ? "Gate" : vId.charAt(0).toUpperCase() + vId.slice(1);
                              return (
                                <button
                                  key={vId}
                                  type="button"
                                  className={cn(
                                    "px-1.5 py-0.5 text-[8px] rounded font-mono border transition-colors",
                                    isVenueSelected
                                      ? "bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8] font-bold"
                                      : "border-[#21262d] bg-[#0d121d] text-[#6e7d99] hover:border-[#38bdf8]/40 hover:text-[#c9d1d9]"
                                  )}
                                  onClick={() => chooseSingleVenue(vId, c)}
                                  title={`Switch directly to ${label} linear perpetual`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {!filteredGroups.length && (
                      <div className="p-6 text-center text-[#7d8ba5] text-xs">
                        No crypto perpetual matching &ldquo;{query}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <AssetClassInfoPanel tab={tab} />
          )}

          {/* Clean Footer */}
          <footer className="zt-instrument-picker-footer flex items-center justify-between text-[9px] text-[#71809b] px-3 py-2 bg-black/40 border-t border-[#21262d]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Multi-Venue Aggregation · Binance, Bybit, OKX, Gate.io</span>
            </span>
            <span className="font-mono text-[#8b949e]">
              {tab === "crypto" ? `${filteredGroups.length} assets` : "Integration Ready"}
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}

function BrowserNotice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="zt-browser-notice">
      {icon}
      <div>
        <b>{title}</b>
        <p>{body}</p>
      </div>
    </div>
  );
}

function AssetClassInfoPanel({ tab }: { tab: "futures" | "stocks" | "indices" }) {
  const content = {
    futures: {
      title: "CME & Global Futures",
      desc: "Order flow, footprint, and DOM depth for CME, Eurex, and ICE contracts (ES, NQ, CL, GC, FDAX, ZB).",
      connector: "Rithmic & Interactive Brokers",
      status: "Ready for Connection",
    },
    stocks: {
      title: "US Equities & ETFs",
      desc: "Real-time consolidated SIP / NBBO order book, tape, and block trades across all major US exchanges (AAPL, NVDA, TSLA, SPY, QQQ).",
      connector: "Alpaca & Interactive Brokers",
      status: "Ready for Connection",
    },
    indices: {
      title: "Cash Indices & Volatility",
      desc: "Direct index tick feeds for SPX, NDX, VIX, DJI, and RUT, powering real-time Gamma Exposure (GEX) surfaces and skew models.",
      connector: "Institutional Feeds",
      status: "Institutional Model",
    },
  }[tab];

  return (
    <div className="p-6 space-y-4">
      <div className="p-4 rounded-lg border border-[#8e72e8]/20 bg-[#8e72e8]/05 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#e1e8f7]">{content.title}</h3>
          <span className="px-2 py-0.5 rounded text-[8.5px] font-mono uppercase bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30">
            {content.status}
          </span>
        </div>
        <p className="text-xs text-[#8b949e] leading-relaxed">{content.desc}</p>
      </div>

      <div className="p-3 rounded border border-[#21262d] bg-black/20 text-xs text-[#6e7d99] flex items-center justify-between">
        <span>Supported Gateways:</span>
        <span className="font-mono text-[#c9d1d9] font-medium">{content.connector}</span>
      </div>
    </div>
  );
}
