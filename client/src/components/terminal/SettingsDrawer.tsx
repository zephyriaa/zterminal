import { Cloud, CloudOff, LoaderCircle, RefreshCw, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { TerminalWorkspaceState } from "@/components/auth/TerminalAccountControl";

type SettingsDrawerProps = {
  symbol: string;
  timeframe: string;
  symbols: readonly string[];
  timeframes: readonly string[];
  workspaceState: TerminalWorkspaceState;
  isAuthenticated: boolean;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  onSync: () => void;
  onClearLocalCopy: () => void;
  onClose: () => void;
};

function syncSummary(state: TerminalWorkspaceState, isAuthenticated: boolean) {
  if (!isAuthenticated) return { icon: <CloudOff size={15} />, title: "Browser workspace", detail: "Sign in when you want to explicitly sync this device to your account." };
  if (state === "synced") return { icon: <Cloud size={15} />, title: "Cloud workspace synced", detail: "Bounded terminal preferences and research drafts belong to this account." };
  if (state === "checking" || state === "syncing") return { icon: <LoaderCircle size={15} />, title: "Cloud workspace syncing", detail: "Your device copy remains available while the account workspace is checked." };
  if (state === "conflict") return { icon: <CloudOff size={15} />, title: "Sync needs review", detail: "Another device has a different account workspace snapshot." };
  return { icon: <CloudOff size={15} />, title: "Cloud workspace unavailable", detail: "This browser retains its saved preferences and can retry later." };
}

export function SettingsDrawer({ symbol, timeframe, symbols, timeframes, workspaceState, isAuthenticated, onSymbolChange, onTimeframeChange, onSync, onClearLocalCopy, onClose }: SettingsDrawerProps) {
  const sync = syncSummary(workspaceState, isAuthenticated);
  const syncBusy = workspaceState === "checking" || workspaceState === "syncing";

  return <aside className="terminal-settings-drawer" aria-label="Terminal settings" aria-modal="true" role="dialog">
    <div className="drawer-heading">
      <div><span className="drawer-kicker">Workspace controls</span><h2>Terminal settings</h2></div>
      <button onClick={onClose} aria-label="Close terminal settings"><X size={16} /></button>
    </div>
    <p className="terminal-settings-intro">Choose the default market context for this browser. Signed-in accounts explicitly synchronize only bounded preferences and research drafts; market data and trading credentials are never stored in the workspace.</p>

    <section className="terminal-settings-section" aria-labelledby="settings-defaults-title">
      <div className="terminal-settings-section-heading"><SlidersHorizontal size={15} /><span><b id="settings-defaults-title">Chart defaults</b><small>Applied to the current workspace</small></span></div>
      <label className="terminal-settings-field">Market
        <select value={symbol} onChange={(event) => onSymbolChange(event.target.value)}>
          {symbols.map((value) => <option key={value} value={value}>{value.replace("_", " / ")}</option>)}
        </select>
      </label>
      <label className="terminal-settings-field">Timeframe
        <select value={timeframe} onChange={(event) => onTimeframeChange(event.target.value)}>
          {timeframes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </section>

    <section className="terminal-settings-section terminal-settings-sync" aria-labelledby="settings-sync-title">
      <div className="terminal-settings-section-heading">{sync.icon}<span><b id="settings-sync-title">{sync.title}</b><small>{sync.detail}</small></span></div>
      {isAuthenticated ? <button className="terminal-primary-button terminal-settings-action" onClick={onSync} disabled={syncBusy}>{syncBusy ? <LoaderCircle size={14} /> : <RefreshCw size={14} />}{workspaceState === "conflict" ? "Review sync" : "Sync this device"}</button> : <a className="terminal-primary-button terminal-settings-action" href="/account"><Cloud size={14} />Sign in to sync</a>}
    </section>

    <section className="terminal-settings-section terminal-settings-reset" aria-labelledby="settings-local-title">
      <div className="terminal-settings-section-heading"><RotateCcw size={15} /><span><b id="settings-local-title">Saved browser copy</b><small>Remove only this device’s terminal-preference record. Your current session stays open, and cloud data is untouched.</small></span></div>
      <button className="terminal-secondary-button terminal-settings-action" onClick={onClearLocalCopy}><RotateCcw size={14} />Clear saved browser copy</button>
    </section>
  </aside>;
}
