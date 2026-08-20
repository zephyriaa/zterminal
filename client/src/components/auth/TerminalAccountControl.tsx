import { useState } from "react";
import { ChevronDown, CircleUserRound, LoaderCircle, LogOut, PanelTopOpen, ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ZT";
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("");
}

export function TerminalAccountControl() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user?.name?.trim() || user?.email?.trim() || "Research account";
  const email = user?.email?.trim() || null;

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

  if (loading) {
    return <span className="terminal-account-loading" aria-label="Checking account session"><LoaderCircle size={14} /></span>;
  }

  if (!user) {
    return <a className="terminal-account-guest" href="/account"><CircleUserRound size={14} /><span>Guest</span><small>Sign in</small></a>;
  }

  return <div className="terminal-account-control">
    <button className="terminal-account-trigger" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={`Open account menu for ${displayName}`}>
      <span className="terminal-account-avatar" aria-hidden="true">{initials(displayName)}</span>
      <span className="terminal-account-summary"><b>{displayName}</b><small>Workspace active</small></span>
      <ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <div className="terminal-account-menu" role="menu" aria-label="Account menu">
      <div className="terminal-account-identity"><span className="terminal-account-avatar" aria-hidden="true">{initials(displayName)}</span><span><b>{displayName}</b>{email && email !== displayName && <small>{email}</small>}<em><ShieldCheck size={11} /> Google session</em></span></div>
      <div className="terminal-account-disclosure"><PanelTopOpen size={13} /><span><b>Research workspace</b><small>Drafts may sync to this account. Watchlists and chart preferences remain browser-local unless explicitly saved.</small></span></div>
      <a role="menuitem" className="terminal-account-menu-link" href="/account" onClick={() => setOpen(false)}><CircleUserRound size={14} /> Account &amp; sessions</a>
      <button role="menuitem" className="terminal-account-menu-logout" onClick={() => void handleLogout()} disabled={loggingOut}>{loggingOut ? <LoaderCircle size={14} /> : <LogOut size={14} />}{loggingOut ? "Signing out" : "Sign out"}</button>
    </div>}
  </div>;
}
