"use client";

import { useMemo } from "react";
import { SessionProvider } from "next-auth/react";

export function ZTerminalSessionProvider({ children }: { children: React.ReactNode }) {
  // If no auth cookie exists, pass session={null} so NextAuth immediately resolves
  // as unauthenticated without invoking /api/auth/session on Cloudflare Workers.
  const hasSessionCookie = useMemo(() => {
    if (typeof document === "undefined") return false;
    return /(?:^|;\s*)(?:__Secure-)?next-auth\.session-token=/.test(document.cookie);
  }, []);

  return (
    <SessionProvider
      session={hasSessionCookie ? undefined : null}
      refetchOnWindowFocus={false}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  );
}
