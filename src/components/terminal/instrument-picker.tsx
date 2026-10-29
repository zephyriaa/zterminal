"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, DatabaseZap, Landmark, Search, ShieldCheck, Star } from "lucide-react";
import type { ContractMetadata } from "@/lib/market/types";
import { PROVIDER_CATALOG } from "@/lib/market/capabilities";
import { useContractCatalogue } from "@/hooks/use-contract-catalog";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

const RECENT_KEY = "zterminal.verified-recent-symbols.v2";
const FAVORITES_KEY = "zterminal.verified-favorite-symbols.v1";

type PickerTab = "symbols" | "favorites" | "recent" | "brokers";

function displaySymbol(symbol: string) {
  return symbol.endsWith("USDT") ? `${symbol.slice(0, -4).replace(/_$/, "")} / USDT` : symbol.replace(/[_-]/g, " / ");
}

function readList(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch { return []; }
}

function saveList(key: string, entries: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify(entries)); } catch { /* optional local convenience */ }
}

function providerLabel(provider?: string) {
  return PROVIDER_CATALOG.find((entry) => entry.id === provider)?.label ?? (provider ? provider.toUpperCase() : "Active provider");
}

export function InstrumentPicker({ compact = false }: { compact?: boolean }) {
  const { symbol, setSymbol } = useWorkspace();
  const catalogue = useContractCatalogue();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>("symbols");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const contracts = catalogue.contracts;
  const recentSymbols = useMemo(() => readList(RECENT_KEY), [open]);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const entries = tab === "favorites" ? favorites.map(entry => contracts.find(contract => contract.symbol === entry)).filter((contract): contract is ContractMetadata => Boolean(contract)) : tab === "recent" ? recentSymbols.map(entry => contracts.find(contract => contract.symbol === entry)).filter((contract): contract is ContractMetadata => Boolean(contract)) : contracts;
    return entries.filter((contract) => !term || `${contract.symbol} ${contract.description} ${contract.root} ${contract.currency} ${contract.exchange}`.toLowerCase().includes(term));
  }, [contracts, query, tab, favorites, recentSymbols]);

  useEffect(() => {
    const openPicker = () => { setFavorites(readList(FAVORITES_KEY)); setTab("symbols"); setActiveIndex(0); setOpen(true); };
    window.addEventListener("zterminal:open-symbol-picker", openPicker);
    return () => window.removeEventListener("zterminal:open-symbol-picker", openPicker);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => { window.clearTimeout(id); document.removeEventListener("pointerdown", onPointerDown); };
  }, [open]);

  const choose = (contract: ContractMetadata) => {
    setSymbol(contract.symbol);
    saveList(RECENT_KEY, [contract.symbol, ...readList(RECENT_KEY).filter((entry) => entry !== contract.symbol)].slice(0, 8));
    setOpen(false);
    setQuery("");
  };

  const toggleFavorite = (contract: ContractMetadata) => {
    setFavorites((current) => {
      const next = current.includes(contract.symbol) ? current.filter((entry) => entry !== contract.symbol) : [contract.symbol, ...current].slice(0, 30);
      saveList(FAVORITES_KEY, next);
      return next;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(Math.max(0, matches.length - 1), index + 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
    if (event.key === "Enter" && matches[activeIndex]) { event.preventDefault(); choose(matches[activeIndex]); }
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("zt-instrument-picker", compact && "is-compact")}>
      <button type="button" className="zt-instrument-picker-trigger"         onClick={() => { if (!open) setFavorites(readList(FAVORITES_KEY)); setActiveIndex(0); setOpen((value) => !value); }} aria-haspopup="dialog" aria-expanded={open} aria-label={`Choose market, current ${symbol}`}>
        <Search className="h-3.5 w-3.5" /><span className="font-mono-num">{displaySymbol(symbol)}</span><ChevronDown className="ml-auto h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="zt-instrument-picker-menu zt-market-browser" role="dialog" aria-label="Market selector" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
          <div className="zt-market-browser-topline"><span className="zt-provider-status"><i className={cn(catalogue.error || !catalogue.verified ? "is-error" : "is-live")} />{providerLabel(catalogue.provider)} · {catalogue.verified ? "PROVIDER CATALOGUE" : "UNVERIFIED REFERENCES"}</span><span>{catalogue.contracts.length.toLocaleString()} contracts</span></div>
          <div className="zt-market-browser-tabs" role="group" aria-label="Market views">{([['symbols', 'All markets'], ['favorites', 'Favorites'], ['recent', 'Recent'], ['brokers', 'Data feeds']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} className={cn(tab === id && "is-active")} onClick={() => { setTab(id); setActiveIndex(0); }}>{id === "brokers" && <Landmark />}{label}</button>)}</div>
          {tab !== "brokers" ? <>
            <div className="zt-instrument-search-row"><Search className="h-3.5 w-3.5" /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={onKeyDown} placeholder="Search symbol, asset, or market" aria-label="Search contracts" /><kbd>↑ ↓ Enter</kbd></div>
            <div className="zt-market-browser-list scroll-thin">
              {catalogue.loading && <BrowserNotice icon={<DatabaseZap />} title="Loading markets" body="Waiting for the active provider catalogue. Symbols are not substituted while it loads." />}
              {!catalogue.loading && catalogue.error && <BrowserNotice icon={<ShieldCheck />} title="Catalogue unavailable" body={catalogue.error} />}
              {!catalogue.loading && !catalogue.error && <>
                <ContractSection label={query ? `Matches · ${matches.length.toLocaleString()}` : `${tab === "favorites" ? "Favorite" : tab === "recent" ? "Recent" : "All"} ${providerLabel(catalogue.provider)} markets · ${matches.length.toLocaleString()}`} icon={<ShieldCheck />}>{matches.map((contract, index) => <ContractRow key={contract.symbol} contract={contract} selected={symbol === contract.symbol} highlighted={index === activeIndex} favorite={favorites.includes(contract.symbol)} onChoose={choose} onToggleFavorite={toggleFavorite} />)}{!matches.length && <p className="zt-instrument-empty">{query ? "No contract matches this search." : tab === "favorites" ? "Star a market to keep it here." : tab === "recent" ? "Markets you open appear here." : "No markets available."}</p>}</ContractSection>
              </>}
            </div>
          </> : <BrokerDirectory activeProvider={catalogue.provider} catalogueError={catalogue.error ?? (!catalogue.verified ? catalogue.reason ?? "Unverified catalogue" : undefined)} />}
          <footer className="zt-instrument-picker-footer">Reference entries are unverified. Selecting a market still requires matching provider metadata and history; catalogue discovery does not certify a live feed. Planned feeds require integration and validation before they can connect.</footer>
        </div>
      )}
    </div>
  );
}

function ContractSection({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="zt-instrument-section"><div className="zt-instrument-section-label">{icon}{label}</div>{children}</section>;
}

function ContractRow({ contract, selected, highlighted, favorite, onChoose, onToggleFavorite }: { contract: ContractMetadata; selected: boolean; highlighted?: boolean; favorite: boolean; onChoose: (contract: ContractMetadata) => void; onToggleFavorite: (contract: ContractMetadata) => void }) {
  return <div className={cn("zt-instrument-row", (selected || highlighted) && "is-selected")}><button type="button" onClick={() => onChoose(contract)} className="zt-instrument-row-select" aria-label={`${displaySymbol(contract.symbol)} (${contract.description})`}><span className="zt-instrument-symbol">{displaySymbol(contract.symbol)}</span><span className="zt-instrument-description">{contract.root} · {contract.product} · {contract.currency}{!contract.verified && " · unverified"}</span><span className="zt-instrument-exchange">{contract.exchange}</span>{selected && <Check className="h-3.5 w-3.5 text-[var(--zt-accent)]" />}</button><button type="button" className={cn("zt-instrument-favorite", favorite && "is-favorite")} onClick={() => onToggleFavorite(contract)} aria-label={`${favorite ? "Remove" : "Add"} ${contract.symbol} ${favorite ? "from" : "to"} favorites`}><Star /></button></div>;
}

function BrowserNotice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="zt-browser-notice">{icon}<div><b>{title}</b><p>{body}</p></div></div>;
}

function BrokerDirectory({ activeProvider, catalogueError }: { activeProvider?: string; catalogueError?: string }) {
  return <div className="zt-broker-directory scroll-thin">{PROVIDER_CATALOG.map((broker) => {
    const active = broker.id === activeProvider;
    const status = active && !catalogueError ? "CATALOGUE DISCOVERED" : broker.streamIntegration === "active" ? "PUBLIC ADAPTER" : "PLANNED · NOT CONNECTED";
    return <article key={broker.id} className={cn("zt-broker-card", active && !catalogueError && "is-active")}><div className="flex items-start justify-between gap-3"><div><h3>{broker.label}</h3><p>{broker.access.replaceAll("-", " ")} · {broker.nativeExample}</p></div><span className={cn("zt-broker-badge", active && !catalogueError && "is-active")}>{status}</span></div><div className="zt-broker-capabilities">{broker.capabilities.slice(0, 5).map((capability) => <span key={capability}>{capability.replaceAll("_", " ")}</span>)}</div><p className="zt-broker-notice">{active && catalogueError ? catalogueError : broker.notice}</p></article>;
  })}</div>;
}
