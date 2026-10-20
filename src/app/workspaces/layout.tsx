import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, googleSignInConfigured } from "@/lib/auth";
import { sessionAvailabilityProbe } from "@/lib/auth-session";
import { ZTerminalSessionProvider } from "@/components/auth/session-provider";
import "@/components/workspaces/workspaces.css";

export default async function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const probe = sessionAvailabilityProbe(authOptions);
  const session = googleSignInConfigured ? await getServerSession(probe.options) : null;
  return <ZTerminalSessionProvider session={session} initialError={probe.failed()}>{children}</ZTerminalSessionProvider>;
}
