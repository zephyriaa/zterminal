"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Search,
  Sidebar as SidebarIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/stores/workspace";
import { usePanels } from "@/stores/panels";
import { useToast } from "@/hooks/use-toast";
import { AccountPanel } from "./account-panel";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface GlobalControlsProps {
  symbol: string;
  timeframe: string;
  provider?: string;
  dataStatus: string;
}

export function GlobalControls({ symbol, timeframe, provider, dataStatus }: GlobalControlsProps) {
  const { setCommandOpen, sidebarCollapsed, toggleSidebar, saveWorkspace } = useWorkspace();
  const { data: session } = useSession();
  const [accountOpen, setAccountOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("account") === "signin" || params.get("account") === "profile" || Boolean(params.get("error"));
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();
  const panels = usePanels((s) => s.panels);

  // Sync fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Screenshot capture handler
  const handleCapture = (mode: "download" | "copy") => {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `zterminal-${symbol}-${timeframe}-${today}.png`;

    window.dispatchEvent(
      new CustomEvent("zterminal:capture-chart", {
        detail: {
          mode,
          filename,
          symbol,
          timeframe,
          onComplete: (success: boolean, msg?: string) => {
            if (success) {
              toast({
                title: mode === "download" ? "Chart downloaded" : "Chart copied to clipboard",
                description: filename,
              });
            } else {
              toast({
                title: "Capture failed",
                description: msg || "Could not capture chart canvas",
                variant: "destructive",
              });
            }
          },
        },
      })
    );
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not permitted or cancelled
    }
  };

  return (
    <div className="ml-auto flex items-center gap-1.5">
      {/* 1. SCREENSHOT TOOL */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="zt-header-icon"
            aria-label="Capture chart screenshot"
            title="Chart capture (Download / Copy PNG with ZTerminal watermark)"
          >
            <Camera />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-44 p-1 zt-popover-terminal border border-border/80 bg-panel text-foreground shadow-2xl rounded-[6px]"
        >
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1">
            CAPTURE CHART
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleCapture("download")}
            className="text-[11.5px] cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-hover"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Download PNG</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleCapture("copy")}
            className="text-[11.5px] cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-hover"
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Copy image</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 2. SEARCH / COMMAND PALETTE TRIGGER (ZTERMINAL THEME) */}
      <button
        type="button"
        className="zt-command-trigger"
        onClick={() => setCommandOpen(true)}
        aria-label="Open command palette (Ctrl/Cmd+K)"
        title="Command palette (Ctrl/Cmd+K)"
      >
        <Search className="h-3 w-3 text-muted-foreground" />
        <span className="hidden xl:inline text-[10px] text-[#7d8ba6] font-medium tracking-wide">COMMANDS</span>
        <kbd className="text-[8.5px] font-mono">⌘K</kbd>
      </button>

      {/* 3. WORKSPACE / LAYOUT CONTROL */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="zt-header-icon"
            aria-label="Workspace layout and panel configuration"
            title="Workspace / Layout controls"
          >
            <LayoutGrid />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-56 p-2 zt-popover-terminal border border-border/80 bg-panel text-foreground shadow-2xl rounded-[6px]"
        >
          <div className="px-2 py-1.5 border-b border-border/60">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">
              WORKSPACE
            </span>
            <b className="text-[11.5px] font-semibold text-foreground">Research Workspace</b>
          </div>

          <div className="py-2 border-b border-border/60 space-y-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold px-2 block">
              LAYOUT
            </span>
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-medium text-foreground bg-secondary/40 rounded">
              <span>Single chart</span>
              <Check className="h-3 w-3 text-pos" />
            </div>
          </div>

          <div className="py-2 border-b border-border/60 space-y-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold px-2 block">
              PANELS
            </span>
            <button
              type="button"
              onClick={toggleSidebar}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] rounded hover:bg-hover text-foreground/90 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <SidebarIcon className="h-3 w-3 text-muted-foreground" />
                Sidebar
              </span>
              <span className="text-[9px] text-muted-foreground font-mono-num">
                {!sidebarCollapsed ? "Visible" : "Hidden"}
              </span>
            </button>
            {[
              { id: "chart", label: "Chart Window" },
              { id: "orderflow", label: "Order Flow & Tape" },
              { id: "gex", label: "Crypto GEX (Gamma)" },
              { id: "indicators", label: "Indicators" },
              { id: "strategy", label: "Strategy Dev" },
              { id: "economic-calendar", label: "Calendar" },
              { id: "context", label: "Context" },
            ].map((p) => {
              const isOpen = panels[p.id]?.status === "open";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (isOpen) usePanels.getState().patch(p.id, { status: "closed" });
                    else usePanels.getState().open(p.id);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] rounded hover:bg-hover text-foreground/90 transition-colors"
                >
                  <span>{p.label}</span>
                  <span className={cn("text-[9px] font-mono-num", isOpen ? "text-pos" : "text-muted-foreground/60")}>
                    {isOpen ? "Open" : "Closed"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("Workspace name", "Research Workspace");
                if (name) {
                  saveWorkspace(name);
                  toast({ title: "Workspace saved", description: `Saved "${name}" locally.` });
                }
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded hover:bg-hover text-foreground/90"
            >
              <Save className="h-3 w-3 text-muted-foreground" />
              <span>Save workspace</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event("zterminal:reset-layout"));
                toast({ title: "Layout restored", description: "Default panel layout applied." });
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded hover:bg-hover text-foreground/90"
            >
              <RotateCcw className="h-3 w-3 text-muted-foreground" />
              <span>Reset layout</span>
            </button>
          </div>

          <div className="mt-2 pt-1.5 border-t border-border/40 px-2 flex items-center justify-between text-[9px] text-muted-foreground font-mono-num">
            <span>Status</span>
            <span className="text-pos flex items-center gap-0.5">✓ Saved locally</span>
          </div>
        </PopoverContent>
      </Popover>

      {/* 4. FULLSCREEN / FOCUS MODE */}
      <button
        type="button"
        className="zt-header-icon"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen / Focus mode"}
      >
        {isFullscreen ? <Minimize2 /> : <Maximize2 />}
      </button>

      {/* DIVIDER */}
      <span className="zt-strip-divider mx-0.5" aria-hidden="true" />

      {/* 6. RESEARCH ACCOUNT ON FAR RIGHT */}
      <button
        type="button"
        className="zt-research-account"
        onClick={() => setAccountOpen((open) => !open)}
        aria-expanded={accountOpen}
        aria-label="Open research account and profile information"
        title={session?.user ? `${session.user.name || session.user.email} (Click to manage profile)` : "Research mode · Google sign-in"}
      >
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover shrink-0 border border-accent/60"
          />
        ) : session?.user?.name ? (
          <span className="w-4 h-4 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center shrink-0">
            {session.user.name[0]?.toUpperCase()}
          </span>
        ) : (
          <span>R</span>
        )}
        <div className="zt-research-account-copy hidden sm:flex">
          <b className="truncate max-w-[84px]">{session?.user?.name ? session.user.name.split(" ")[0] : "Research"}</b>
          <small className={session?.user ? "text-pos font-medium" : ""}>
            {session?.user ? "Google active" : "Read only"}
          </small>
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
  );
}
