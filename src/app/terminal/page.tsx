import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, googleSignInConfigured } from "@/lib/auth";
import { FloatingWorkstationShell } from "@/components/terminal/floating-workstation-shell";
import { ZTerminalSessionProvider } from "@/components/auth/session-provider";

export default async function TerminalPage() {
  await connection();
  const session = googleSignInConfigured ? await getServerSession(authOptions) : null;
  return (
    <ZTerminalSessionProvider session={session}>
      <FloatingWorkstationShell />
    </ZTerminalSessionProvider>
  );
}
