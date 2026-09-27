"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
/** Session cookies are HttpOnly; use the server-verified session instead of document.cookie. */
export function ZTerminalSessionProvider({ children, session }: { children: React.ReactNode; session?: Session | null }) {
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return <SessionProvider session={session} refetchOnWindowFocus={true} refetchInterval={0} refetchWhenOffline={false}>{children}</SessionProvider>;
}
