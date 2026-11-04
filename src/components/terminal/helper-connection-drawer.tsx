"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Download, ExternalLink, HelpCircle, LoaderCircle, ShieldAlert, Sparkles, X } from "lucide-react";
import { useResearch } from "@/stores/research";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type HelperRelease = { available: boolean; version?: string; reason?: string; format?: "portable-zip" | "installer"; sha256?: string; bytes?: number; failed?: boolean };

export function HelperStatusPill({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const state = useResearch();
  const connected = state.connection === "connected";
  const connecting = state.connection === "checking";

  return (
    <button
      type="button"
      onClick={onOpenDrawer}
      className={`zt-status-pill ${connected ? "is-connected" : connecting ? "is-checking" : "is-offline"}`}
      title={connected ? `Helper v${state.helperVersion ?? "1.0"} active` : "Click to connect ZTerminal Local Research Helper"}
    >
      <span className="zt-status-dot" />
      <span className="zt-status-text">
        {connected ? (
          <>Engine Ready {state.helperVersion ? <span className="opacity-70">v{state.helperVersion}</span> : ""}</>
        ) : connecting ? (
          "Checking Helper…"
        ) : (
          "Connect Local Helper"
        )}
      </span>
    </button>
  );
}

export function HelperConnectionDrawer({
  open,
  onOpenChange,
  pairCode,
  setPairCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairCode: string;
  setPairCode: (value: string) => void;
}) {
  const state = useResearch();
  const [release, setRelease] = useState<HelperRelease | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [releaseAttempt, setReleaseAttempt] = useState(0);
  const connecting = state.connection === "checking";
  const code = pairCode.trim();
  const connected = state.connection === "connected";

  useEffect(() => {
    let active = true;
    setRelease(null);
    void fetch("/api/releases/helper", { cache: "no-store", signal: AbortSignal.timeout(10000) })
      .then(async response => {
        const payload = (await response.json()) as HelperRelease;
        if (
          (!response.ok && response.status !== 503) ||
          typeof payload.available !== "boolean" ||
          (response.status === 503 && payload.available)
        )
          throw new Error("Release request failed");
        if (active) setRelease(payload);
      })
      .catch(() => {
        if (active) setRelease({ available: false, failed: true });
      });
    return () => {
      active = false;
    };
  }, [releaseAttempt]);

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code || connecting) return;
    await state.connect(code);
    if (useResearch.getState().connection === "connected") {
      setPairCode("");
      onOpenChange(false);
    }
  };

  const status = connected
    ? { label: "Connected & Verified", detail: "Local Python backtesting engine is ready.", icon: CheckCircle2, tone: "connected" }
    : connecting
    ? { label: "Checking Connection…", detail: "Attempting handshake with localhost:58291…", icon: LoaderCircle, tone: "checking" }
    : state.connection === "invalid_code"
    ? { label: "Code Rejected", detail: "Paste a current 8-digit code from the Helper app and retry.", icon: CircleAlert, tone: "error" }
    : state.connection === "permission_denied"
    ? { label: "Local Network Permission Required", detail: "Allow local network access in browser settings.", icon: CircleAlert, tone: "error" }
    : state.connection === "unavailable"
    ? { label: "Helper Not Detected", detail: "Launch ZTerminal Research Helper on your machine and retry.", icon: CircleAlert, tone: "error" }
    : state.connection === "incompatible"
    ? { label: "Update Required", detail: "Install a compatible Windows Helper version.", icon: CircleAlert, tone: "error" }
    : { label: "Helper Disconnected", detail: "Pair with your local Windows Helper to execute Python strategies.", icon: CircleAlert, tone: "idle" };

  const StatusIcon = status.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="zt-helper-drawer w-full sm:max-w-md p-6 bg-[#0f1117] border-l border-[#232738] text-[#d1d5db]">
        <SheetHeader className="mb-5 pb-4 border-b border-[#232738]">
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[#a78bfa] uppercase">
            <Sparkles size={13} /> Local Python Environment
          </div>
          <SheetTitle className="text-lg font-semibold text-white tracking-tight">
            ZTerminal Research Helper
          </SheetTitle>
          <SheetDescription className="text-xs text-[#9ca3af] leading-relaxed">
            The Helper executes native vectorized Python simulations directly on your machine with zero cloud data leakage.
          </SheetDescription>
        </SheetHeader>

        {/* Status Card */}
        <div className={`zt-drawer-status-card is-${status.tone} p-4 rounded-lg border mb-5`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connection State</span>
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium">
              <StatusIcon size={14} className={connecting ? "animate-spin" : ""} />
              {status.label}
            </div>
          </div>
          <p className="text-xs text-[#9ca3af] leading-relaxed">{status.detail}</p>
          {connected && state.helperVersion && (
            <div className="mt-3 pt-3 border-t border-[#2a2f42] flex items-center justify-between text-xs font-mono text-[#a5b4fc]">
              <span>Runtime Engine:</span>
              <span>Python 3.12 · Helper v{state.helperVersion}</span>
            </div>
          )}
        </div>

        {/* Pairing Form */}
        <div className="space-y-4">
          <form onSubmit={connect} className="space-y-3">
            <label htmlFor="helper-pair-code" className="block text-xs font-medium text-[#e5e7eb]">
              8-Digit Pairing Code
              <span className="block text-[11px] font-normal text-[#9ca3af] mt-0.5">
                Copy the code displayed inside the ZTerminal Research Helper window.
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="helper-pair-code"
                placeholder="0000 0000"
                value={pairCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={9}
                onChange={e => setPairCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                disabled={connecting}
                className="flex-1 bg-[#161a26] border border-[#2b3147] rounded px-3 py-2 text-sm font-mono tracking-widest text-white placeholder-[#4b5563] focus:outline-none focus:border-[#8b5cf6]"
              />
              <button
                type="submit"
                disabled={!/^\d{8}$/.test(code) || connecting}
                className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 disabled:hover:bg-[#7c3aed] text-white text-xs font-medium rounded transition-colors whitespace-nowrap"
              >
                {connecting ? "Verifying…" : "Connect"}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => void state.connect()}
              disabled={connecting}
              className="text-xs text-[#a78bfa] hover:text-[#c4b5fd] hover:underline disabled:opacity-50"
            >
              {connecting ? "Probing localhost…" : "Retry auto-detect"}
            </button>
            <a
              href="/docs/python-research"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#9ca3af] hover:text-white"
            >
              Documentation <ExternalLink size={11} />
            </a>
          </div>

          {state.error && !connected && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded text-xs text-red-300 leading-relaxed flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5 text-red-400" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Download & Instructions */}
          {!connected && (
            <div className="mt-6 pt-5 border-t border-[#232738] space-y-3">
              <span className="text-xs font-semibold text-[#e5e7eb] uppercase tracking-wider block">
                Don't have the Helper?
              </span>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Download the lightweight local agent for Windows x64. No administrator rights or Python installation required.
              </p>
              {release?.available ? (
                <a
                  href="/download/helper"
                  onClick={() => setDownloadStarted(true)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#1e2333] hover:bg-[#282f45] border border-[#374151] rounded text-xs font-medium text-white transition-colors"
                >
                  <Download size={13} /> Download Helper ({release.format === "portable-zip" ? "Portable ZIP" : "Installer"})
                </a>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 px-4 bg-[#161a26] border border-[#232738] rounded text-xs text-[#6b7280] cursor-not-allowed"
                >
                  {release === null ? "Checking latest release…" : "Download temporarily unavailable"}
                </button>
              )}
              {downloadStarted && (
                <p className="text-[11px] text-[#34d399] font-mono">
                  Download initiated. Extract the package and run ZTerminalResearchHelper.exe.
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
