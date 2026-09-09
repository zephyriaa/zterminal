"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Activity,
  Database,
  Layers3,
  PanelBottom,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { InstrumentPicker } from "./instrument-picker";
import { AccountPanel } from "./account-panel";
import { QuoteManagerDialog } from "./quote-manager-dialog";
import { useWorkspace } from "@/stores/workspace";
import { useLayout } from "@/stores/layout";
import { useMarketStream } from "@/hooks/use-market-stream";
import { getContract } from "@/lib/market/contracts";
import { cn } from "@/lib/utils";

export function TerminalHeader() {
  const { symbol } = useWorkspace();
  const contract = getContract(symbol);
  const { provider, dataStatus } = useMarketStream(symbol, { trades: 1, depth: false });
  const {
    leftPanelOpen,
    bottomPanelOpen,
    rightPanelOpen,
    toggleLeftPanel,
    toggleBottomPanel,
    toggleRightPanel,
    resetLayout,
    setRightTab,
  } = useLayout();
  const [accountOpen, setAccountOpen] = useState(false);
  const [quoteManagerOpen, setQuoteManagerOpen] = useState(false);

  return (
    <header
      className="flex h-10 w-full shrink-0 items-center justify-between border-b hairline px-3 bg-panel/90 backdrop-blur-md select-none z-30"
      aria-label="Workstation header"
    >
      {/* Left side: Brand + Instrument Picker */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 pr-2 border-r hairline">
          <Image
            src="/brand/zterminal-mark-v2.png"
            alt="ZTerminal"
            width={22}
            height={22}
            priority
            className="rounded shrink-0"
          />
          <div className="hidden md:flex flex-col">
            <span className="font-mono text-xs font-bold tracking-wider text-foreground leading-none">
              ZTERMINAL
            </span>
            <span className="text-[8.5px] uppercase tracking-widest text-muted-foreground leading-tight">
              QUANT WORKSTATION
            </span>
          </div>
        </div>

        <InstrumentPicker />

        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface/40 border hairline font-mono text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span>{contract.exchange}</span>
          <span>·</span>
          <span>{contract.product.toUpperCase()}</span>
        </div>
      </div>

      {/* Right side: Panel Toggles + Reset + Research Mode */}
      <div className="flex items-center gap-1.5">
        {/* Panel visibility controls */}
        <div className="flex items-center rounded border hairline bg-surface/40 p-0.5 mr-1" role="group" aria-label="Toggle Panels">
          <button
            type="button"
            onClick={toggleLeftPanel}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              leftPanelOpen
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-surface"
            )}
            title={leftPanelOpen ? "Hide Explorer Panel (Left)" : "Show Explorer Panel (Left)"}
            aria-pressed={leftPanelOpen}
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleBottomPanel}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              bottomPanelOpen
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-surface"
            )}
            title={bottomPanelOpen ? "Hide Console & Editor (Bottom)" : "Show Console & Editor (Bottom)"}
            aria-pressed={bottomPanelOpen}
          >
            <PanelBottom className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleRightPanel}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              rightPanelOpen
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-surface"
            )}
            title={rightPanelOpen ? "Hide Inspector Panel (Right)" : "Show Inspector Panel (Right)"}
            aria-pressed={rightPanelOpen}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={resetLayout}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          title="Reset Workspace Layout"
          aria-label="Reset Workspace Layout"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setQuoteManagerOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          title="Web QuoteManager (Datasets & Caches)"
          aria-label="Web QuoteManager"
        >
          <Database className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setRightTab("settings")}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          title="Terminal Settings"
          aria-label="Terminal Settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>

        <span className="h-4 w-px bg-border/60 mx-0.5" aria-hidden="true" />

        {/* Research Account Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-expanded={accountOpen}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface/60 border hairline hover:border-accent/40 text-[11px] transition-colors"
          >
            <div className="flex h-4 w-4 items-center justify-center rounded bg-accent/20 font-bold text-[9px] text-accent">
              R
            </div>
            <div className="hidden sm:flex flex-col text-left leading-none">
              <span className="font-semibold text-foreground text-[10px]">Research Engine</span>
              <span className="text-[8.5px] text-muted-foreground">Client WASM</span>
            </div>
          </button>

          {accountOpen && (
            <AccountPanel
              symbol={symbol}
              provider={provider}
              dataStatus={dataStatus}
              onClose={() => setAccountOpen(false)}
            />
          )}
        </div>
      </div>
      <QuoteManagerDialog open={quoteManagerOpen} onClose={() => setQuoteManagerOpen(false)} />
    </header>
  );
}
