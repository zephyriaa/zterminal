"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Cloud, CloudOff, Database, LogIn, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderMap = Record<string, { id: string }>;

export function AccountPanel({ symbol, provider, dataStatus, onClose }: { symbol: string; provider?: string; dataStatus: string; onClose: () => void }) {
  const { data: session, status } = useSession();
  const [googleReady, setGoogleReady] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".zt-research-account")) return;
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/providers", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<ProviderMap> : Promise.resolve({} as ProviderMap))
      .then((providers: ProviderMap) => { if (active) setGoogleReady(Boolean(providers.google)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const authenticated = status === "authenticated" && Boolean(session?.user?.email);
  const displayName = session?.user?.name || session?.user?.email || "Research workspace";

  return (
    <section ref={panelRef} className="zt-account-panel zt-account-panel-auth" aria-label="Research account and cloud workspace">
      <header>
        <div><span>ZT ACCOUNT</span><h2>{authenticated ? "Your research workspace" : "Save your research"}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close account information"><X /></button>
      </header>

      {authenticated ? (
        <div className="zt-account-identity">
          {session?.user?.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <span><UserRound /></span>}
          <div><b>{displayName}</b><p>{session?.user?.email}</p></div>
          <button type="button" className="zt-account-signout" onClick={() => void signOut({ callbackUrl: "/terminal" })} title="Sign out"><LogOut /></button>
        </div>
      ) : (
        <div className="zt-account-signin-card">
          <div className="zt-account-google-mark" aria-hidden="true">G</div>
          <div><b>Research that follows you</b><p>Use a verified Google account to keep named workspaces private and available across devices.</p></div>
          <button type="button" className="zt-account-google-button" disabled={!googleReady || status === "loading"} onClick={() => void signIn("google", { callbackUrl: "/terminal" })}>
            <LogIn />{googleReady ? "Continue with Google" : "Google sign-in is being secured"}
          </button>
        </div>
      )}

      <div className="zt-account-facts">
        <div><span>Permission scope</span><b><ShieldCheck />Research only</b></div>
        <div><span>Active provider</span><b><Database />{provider?.toUpperCase() ?? "Awaiting provider"}</b></div>
        <div><span>Selected market</span><b>{symbol}</b></div>
        <div><span>Feed state</span><b className={cn(dataStatus === "LIVE" && "is-live")}>{dataStatus}</b></div>
        <div><span>Cloud workspace</span><b className={authenticated ? "zt-cloud-pending" : ""}>{authenticated ? <Cloud /> : <CloudOff />}{authenticated ? "Preparing secure sync" : "Local until sign-in"}</b></div>
      </div>

      <div className="zt-account-not-connected">
        <b>{authenticated ? "Cloud sync is safety-gated" : "No trading account connected"}</b>
        <p>{authenticated
          ? "Your identity is separate from trading. Cloud writes activate only after durable storage is verified; no balance, position, brokerage, or order authority is attached to this account."
          : "Google sign-in is used only for workspace identity and synchronization. It never grants brokerage, balance, position, or order permissions."}</p>
      </div>
    </section>
  );
}
