"use client";

import { useEffect } from "react";
import {
  CandlestickChart,
  Code2,
  FlaskConical,
  LayoutDashboard,
  Save,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useWorkspace, type ViewId } from "@/stores/workspace";
import { useContractCatalogue } from "@/hooks/use-contract-catalog";
import { usePanels } from "@/stores/panels";

const VIEWS: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  { id: "chart", label: "Open Chart", icon: CandlestickChart, group: "Go to" },
  { id: "strategy", label: "Open Strategy Developer", icon: Code2, group: "Go to" },
  { id: "backtester", label: "Open Research Report", icon: FlaskConical, group: "Go to" },
  { id: "calendar", label: "Open Calendar", icon: LayoutDashboard, group: "Go to" },
  { id: "alerts", label: "Open Alerts", icon: LayoutDashboard, group: "Go to" },
  { id: "settings", label: "Open Terminal Preferences", icon: LayoutDashboard, group: "Go to" },
];

export function CommandPalette() {
  const {
    commandOpen,
    setCommandOpen,
    setView,
    setSymbol,
    symbol,
    saveWorkspace,
  } = useWorkspace();
  const catalogue = useContractCatalogue();

  // Keyboard shortcut Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (editable && !commandOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandOpen, setCommandOpen]);

  const go = (id: ViewId) => {
    const panelId: Partial<Record<ViewId, string>> = {
      chart: "chart",
      strategy: "strategy",
      backtester: "backtester",
      calendar: "economic-calendar",
      alerts: "alerts",
      settings: "terminal-settings",
    };
    const target = panelId[id];
    if (target) usePanels.getState().open(target);
    setView("chart");
    setCommandOpen(false);
  };
  const openSymbol = (s: string) => {
    setSymbol(s);
    setView("chart");
    setCommandOpen(false);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search symbols, views, actions…" />
      <CommandList className="scroll-thin">
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Symbols">
          {catalogue.contracts.slice(0, 120).map((c) => (
            <CommandItem
              key={c.symbol}
              value={`symbol ${c.symbol} ${c.description}`}
              onSelect={() => openSymbol(c.symbol)}
              className="flex items-center gap-2"
            >
              <span className="font-mono-num text-[12px] w-12 text-foreground">{c.symbol}</span>
              <span className="text-muted-foreground text-xs">{c.description}</span>
              {c.symbol === symbol && (
                <span className="ml-auto text-[10px] text-mdata uppercase tracking-wide">current</span>
              )}
            </CommandItem>
          ))}
          {!catalogue.loading && !catalogue.contracts.length && <CommandItem value="no verified symbols"><span className="text-muted-foreground">{catalogue.error ?? "No verified symbols available"}</span></CommandItem>}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <CommandItem
                key={v.id}
                value={`go ${v.label}`}
                onSelect={() => go(v.id)}
                className="flex items-center gap-2"
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{v.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="save workspace layout"
            onSelect={() => {
              const name = window.prompt("Workspace name", "Research");
              if (name) saveWorkspace(name);
              setCommandOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Save current workspace</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
