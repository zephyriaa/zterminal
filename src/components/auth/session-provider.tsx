"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
/** Session cookies are HttpOnly; use the server-verified session instead of document.cookie. */
export function ZTerminalSessionProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return <SessionProvider session={session} refetchOnWindowFocus={false} refetchInterval={0} refetchWhenOffline={false}>{children}</SessionProvider>;
}
