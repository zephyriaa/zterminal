import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, googleSignInConfigured } from "@/lib/auth";
import { FloatingWorkstationShell } from "@/components/terminal/floating-workstation-shell";
import { ZTerminalSessionProvider } from "@/components/auth/session-provider";
import { sessionAvailabilityProbe } from "@/lib/auth-session";

export default async function TerminalPage() {
  await connection();
  const probe = sessionAvailabilityProbe(authOptions);
  const session = googleSignInConfigured ? await getServerSession(probe.options) : null;
  return (
    <ZTerminalSessionProvider session={session} initialError={probe.failed()}>
      <FloatingWorkstationShell />
    </ZTerminalSessionProvider>
  );
}
