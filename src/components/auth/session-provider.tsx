"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SessionContext, type SessionContextValue } from "next-auth/react";
import type { Session } from "next-auth";
import { readVerifiedSession } from "@/lib/auth-session";

type AuthState = { session: Session | null; phase: "initializing" | "authenticated" | "unauthenticated" | "error" };
const AuthHealth = createContext<{ phase: AuthState["phase"]; retry: () => Promise<Session | null> }>({ phase: "initializing", retry: async () => null });
export const useAuthHealth = () => useContext(AuthHealth);

/** One server-session mirror, compatible with existing Auth.js useSession consumers. */
export function ZTerminalSessionProvider({ children, session, initialError = false }: { children: React.ReactNode; session: Session | null; initialError?: boolean }) {
  const [state, setState] = useState<AuthState>({ session, phase: initialError ? "error" : session ? "authenticated" : "unauthenticated" });
  const active = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async (data?: unknown): Promise<Session | null> => {
    const revision = ++sequence.current;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    try {
      const options: RequestInit = { cache: "no-store", credentials: "same-origin", signal: controller.signal };
      if (data !== undefined) {
        const csrfResponse = await fetch("/api/auth/csrf", options);
        if (!csrfResponse.ok) throw new Error("Session verification unavailable");
        const csrf = await csrfResponse.json() as { csrfToken?: string };
        if (!csrf.csrfToken) throw new Error("Session verification unavailable");
        options.method = "POST"; options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify({ csrfToken: csrf.csrfToken, data });
      }
      const verified = await readVerifiedSession(await fetch("/api/auth/session", options));
      if (revision === sequence.current) setState({ session: verified, phase: verified ? "authenticated" : "unauthenticated" });
      return verified;
    } catch {
      if (!controller.signal.aborted && revision === sequence.current) setState({ session: null, phase: "error" });
      return null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === "nextauth.message") void refresh(); };
    const online = () => void refresh();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    const interval = setInterval(() => { if (navigator.onLine && document.visibilityState === "visible") void refresh(); }, 300_000);
    document.addEventListener("visibilitychange", visible); window.addEventListener("focus", visible);
    window.addEventListener("storage", storage); window.addEventListener("online", online); window.addEventListener("pageshow", restore);
    return () => {
      ++sequence.current; active.current?.abort(); clearInterval(interval);
      document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", visible);
      window.removeEventListener("storage", storage); window.removeEventListener("online", online); window.removeEventListener("pageshow", restore);
    };
  }, [refresh]);
  useEffect(() => {
    if (!state.session?.expires) return;
    const delay = Date.parse(state.session.expires) - Date.now();
    if (!Number.isFinite(delay)) return;
    // Expiry is verified by the backend; cap the timer to the browser's signed 32-bit limit.
    const timer = setTimeout(() => { setState({ session: null, phase: "initializing" }); void refresh(); }, Math.max(0, Math.min(delay + 1, 2147483647)));
    return () => clearTimeout(timer);
  }, [refresh, state.session]);
  const value = useMemo<SessionContextValue>(() => state.phase === "authenticated" && state.session
    ? { data: state.session, status: "authenticated", update: refresh }
    : { data: null, status: state.phase === "unauthenticated" ? "unauthenticated" : "loading", update: refresh }, [state, refresh]);
  return <AuthHealth.Provider value={{ phase: state.phase, retry: refresh }}><SessionContext.Provider value={value}>{children}</SessionContext.Provider></AuthHealth.Provider>;
}
