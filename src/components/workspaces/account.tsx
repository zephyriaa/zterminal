"use client";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, RefreshCw, UserRound } from "lucide-react";
import { useAuthHealth } from "@/components/auth/session-provider";
import { authErrorMessage } from "@/lib/auth-policy";

export function WorkspaceAccount() {
  const { data: session, status, update } = useSession(), health = useAuthHealth();
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { setError(authErrorMessage(new URLSearchParams(window.location.search).get("error")) ?? ""); }, []);
  const act = async (signin: boolean) => {
    setBusy(true); setError("");
    try {
      if (signin) await signIn("google", { callbackUrl: window.location.pathname });
      else { await signOut({ redirect: false, callbackUrl: "/workspaces" }); await update(); }
    } catch { setError("Account connection failed. Try again; local workspaces remain available."); }
    finally { setBusy(false); }
  };
  return <div className="ws-account">
    {health.phase === "error" ? <button onClick={() => void health.retry()}><RefreshCw size={16} />Retry account</button> : status === "authenticated" ? <details><summary><UserRound size={16} />{session?.user?.name ?? "Account"}</summary><div className="ws-account-menu"><span>{session?.user?.email}</span><button disabled={busy} onClick={() => void act(false)}><LogOut size={15} />Sign out</button></div></details> : <button disabled={busy || status === "loading"} onClick={() => void act(true)}><LogIn size={16} />{status === "loading" ? "Checking account…" : "Sign in"}</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
