"use client";

import { useEffect } from "react";
import {
  Activity,
  Camera,
  CandlestickChart,
  Code2,
  FlaskConical,
  Layers3,
  LayoutDashboard,
  Maximize2,
  RotateCcw,
  Save,
  Sidebar as SidebarIcon,
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
import { useWorkspace } from "@/stores/workspace";
import { useContractCatalogue } from "@/hooks/use-contract-catalog";
import { usePanels } from "@/stores/panels";

const VIEWS: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; action: () => void }[] = [
  { id: "chart", label: "Open Chart", icon: CandlestickChart, action: () => usePanels.getState().open("chart") },
  { id: "indicators", label: "Open Indicators", icon: Layers3, action: () => usePanels.getState().open("indicators") },
  { id: "strategy", label: "Open Strategy Developer", icon: Code2, action: () => { usePanels.getState().open("strategy"); usePanels.getState().open("backtester"); usePanels.getState().focus("strategy"); } },
  { id: "backtester", label: "Open Research Report", icon: FlaskConical, action: () => usePanels.getState().open("backtester") },
  { id: "context", label: "Open Market Context", icon: Activity, action: () => usePanels.getState().open("context") },
  { id: "calendar", label: "Open Economic Calendar", icon: LayoutDashboard, action: () => usePanels.getState().open("economic-calendar") },
  { id: "settings", label: "Open Terminal Preferences", icon: LayoutDashboard, action: () => usePanels.getState().open("terminal-settings") },
];

export function CommandPalette() {
  const {
    commandOpen,
    setCommandOpen,
    setView,
    setSymbol,
    symbol,
    timeframe,
    saveWorkspace,
    toggleSidebar,
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
        <CommandGroup heading="Terminal Sections">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <CommandItem
                key={v.id}
                value={`go ${v.label}`}
                onSelect={() => {
                  v.action();
                  setCommandOpen(false);
                }}
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
              const name = window.prompt("Workspace name", "Research Workspace");
              if (name) saveWorkspace(name);
              setCommandOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Save current workspace</span>
          </CommandItem>
          <CommandItem
            value="reset layout restore default panels"
            onSelect={() => {
              window.dispatchEvent(new Event("zterminal:reset-layout"));
              setCommandOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Reset chart layout</span>
          </CommandItem>
          <CommandItem
            value="toggle sidebar hide collapse"
            onSelect={() => {
              toggleSidebar();
              setCommandOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <SidebarIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Toggle navigation sidebar</span>
          </CommandItem>
          <CommandItem
            value="fullscreen focus mode maximize"
            onSelect={() => {
              if (!document.fullscreenElement) {
                void document.documentElement.requestFullscreen();
              } else {
                void document.exitFullscreen();
              }
              setCommandOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Toggle fullscreen</span>
          </CommandItem>
          <CommandItem
            value="screenshot capture chart image png watermark"
            onSelect={() => {
              const today = new Date().toISOString().slice(0, 10);
              window.dispatchEvent(
                new CustomEvent("zterminal:capture-chart", {
                  detail: {
                    mode: "download",
                    filename: `zterminal-${symbol}-${timeframe}-${today}.png`,
                    symbol,
                    timeframe,
                  },
                })
              );
              setCommandOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <Camera className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Capture chart screenshot (with watermark)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
