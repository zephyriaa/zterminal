"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clock3, Search, ShieldCheck } from "lucide-react";
import { listContracts, type ContractDef } from "@/lib/market/contracts";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";

const RECENT_KEY = "zterminal.verified-recent-symbols.v1";

function displaySymbol(symbol: string) {
  return symbol.endsWith("USDT") ? `${symbol.slice(0, -4)} / USDT` : symbol.replace("_", " / ");
}

function getRecents() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(symbol: string) {
  try {
    const next = [symbol, ...getRecents().filter((entry) => entry !== symbol)].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A recent list improves ergonomics only; selection remains functional without it.
  }
}

export function InstrumentPicker({ compact = false }: { compact?: boolean }) {
  const { symbol, setSymbol } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const contracts = useMemo(() => listContracts().filter((contract) => contract.exchange === "BINANCE" && contract.product === "perpetual"), []);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contracts.filter((contract) => !term || `${contract.symbol} ${contract.description} ${contract.root}`.toLowerCase().includes(term));
  }, [contracts, query]);
  const recentContracts = useMemo(() => {
    const recent = typeof window === "undefined" ? [] : getRecents();
    return recent.map((entry) => contracts.find((contract) => contract.symbol === entry)).filter((contract): contract is ContractDef => Boolean(contract));
  }, [contracts, open]);

  useEffect(() => {
    const openPicker = () => { setActiveIndex(0); setOpen(true); };
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
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const choose = (contract: ContractDef) => {
    setSymbol(contract.symbol);
    saveRecent(contract.symbol);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(matches.length - 1, index + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    }
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("zt-instrument-picker", compact && "is-compact")}>
      <button
        type="button"
        className="zt-instrument-picker-trigger"
        onClick={() => { setActiveIndex(0); setOpen((value) => !value); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Choose verified market, current ${symbol}`}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="font-mono-num">{displaySymbol(symbol)}</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="zt-instrument-picker-menu" role="dialog" aria-label="Verified market selector">
          <div className="zt-instrument-search-row">
            <Search className="h-3.5 w-3.5" />
            <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Search verified contracts" aria-label="Search verified contracts" />
            <kbd>⌘ K</kbd>
          </div>
          {recentContracts.length > 0 && !query && (
            <section className="zt-instrument-section">
              <div className="zt-instrument-section-label"><Clock3 className="h-3 w-3" />Recent</div>
              {recentContracts.map((contract) => <ContractRow key={`recent-${contract.symbol}`} contract={contract} selected={symbol === contract.symbol} onChoose={choose} />)}
            </section>
          )}
          <section className="zt-instrument-section">
            <div className="zt-instrument-section-label"><ShieldCheck className="h-3 w-3" />Binance USDⓈ-M perpetuals</div>
            {matches.map((contract, index) => <ContractRow key={contract.symbol} contract={contract} selected={symbol === contract.symbol} highlighted={index === activeIndex} onChoose={choose} />)}
            {!matches.length && <p className="zt-instrument-empty">No verified contract matches this search.</p>}
          </section>
          <footer className="zt-instrument-picker-footer">Only contracts verified by the active research provider are selectable. A catalogue outage never creates substitute symbols.</footer>
        </div>
      )}
    </div>
  );
}

function ContractRow({ contract, selected, highlighted, onChoose }: { contract: ContractDef; selected: boolean; highlighted?: boolean; onChoose: (contract: ContractDef) => void }) {
  return (
    <button type="button" onClick={() => onChoose(contract)} className={cn("zt-instrument-row", (selected || highlighted) && "is-selected")}>
      <span className="zt-instrument-symbol">{displaySymbol(contract.symbol)}</span>
      <span className="zt-instrument-description">{contract.description.replace("BTC / USDT Perpetual ", "")}</span>
      {selected && <Check className="ml-auto h-3.5 w-3.5 text-[var(--zt-accent)]" />}
    </button>
  );
}
