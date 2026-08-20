import { useState } from "react";
import { ChevronDown, CircleUserRound, Cloud, CloudOff, LoaderCircle, LogOut, PanelTopOpen, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export type TerminalWorkspaceState = "checking" | "syncing" | "synced" | "conflict" | "offline" | "local";

type TerminalAccountControlProps = {
  workspaceState?: TerminalWorkspaceState;
  onSync?: () => void;
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ZT";
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("");
}

function workspaceCopy(state: TerminalWorkspaceState) {
  if (state === "synced") return { label: "Cloud synced", detail: "Preferences and research drafts belong to this account.", icon: <Cloud size={13} /> };
  if (state === "syncing" || state === "checking") return { label: "Cloud syncing", detail: "Checking this account’s workspace.", icon: <LoaderCircle size={13} /> };
  if (state === "conflict") return { label: "Sync needs review", detail: "Another device has a different workspace snapshot.", icon: <CloudOff size={13} /> };
  if (state === "offline") return { label: "Device copy retained", detail: "The cloud is unavailable; this browser keeps your preferences for retry.", icon: <CloudOff size={13} /> };
  return { label: "Browser workspace", detail: "Sign in to explicitly sync this device to your account.", icon: <PanelTopOpen size={13} /> };
}

export function TerminalAccountControl({ workspaceState = "local", onSync }: TerminalAccountControlProps) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user?.name?.trim() || user?.email?.trim() || "Research account";
  const email = user?.email?.trim() || null;
  const workspace = workspaceCopy(workspaceState);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      window.location.assign("/account");
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  if (loading) return <span className="terminal-account-loading" aria-label="Checking account session"><LoaderCircle size={14} /></span>;
  if (!user) return <a className="terminal-account-guest" href="/account"><CircleUserRound size={14} /><span>Guest</span><small>Sign in</small></a>;

  return <div className="terminal-account-control">
    <button className="terminal-account-trigger" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={`Open account menu for ${displayName}`}>
      <span className="terminal-account-avatar" aria-hidden="true">{initials(displayName)}</span>
      <span className="terminal-account-summary"><b>{displayName}</b><small>{workspace.label}</small></span>
      <ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <div className="terminal-account-menu" role="menu" aria-label="Account menu">
      <div className="terminal-account-identity"><span className="terminal-account-avatar" aria-hidden="true">{initials(displayName)}</span><span><b>{displayName}</b>{email && email !== displayName && <small>{email}</small>}<em><ShieldCheck size={11} /> Google session</em></span></div>
      <div className="terminal-account-disclosure">{workspace.icon}<span><b>{workspace.label}</b><small>{workspace.detail}</small></span></div>
      {onSync && <button role="menuitem" className="terminal-account-menu-sync" onClick={() => { onSync(); setOpen(false); }} disabled={workspaceState === "syncing" || workspaceState === "checking"}>{workspaceState === "syncing" || workspaceState === "checking" ? <LoaderCircle size={14} /> : <RefreshCw size={14} />} {workspaceState === "conflict" ? "Review sync" : "Sync this device"}</button>}
      <a role="menuitem" className="terminal-account-menu-link" href="/account" onClick={() => setOpen(false)}><CircleUserRound size={14} /> Account &amp; sessions</a>
      <button role="menuitem" className="terminal-account-menu-logout" onClick={() => void handleLogout()} disabled={loggingOut}>{loggingOut ? <LoaderCircle size={14} /> : <LogOut size={14} />}{loggingOut ? "Signing out" : "Sign out"}</button>
    </div>}
  </div>;
}
