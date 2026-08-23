"use client";

import { SessionProvider } from "next-auth/react";

export function ZTerminalSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus>{children}</SessionProvider>;
}
