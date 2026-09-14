import { FloatingWorkstationShell } from "@/components/terminal/floating-workstation-shell";
import { ZTerminalSessionProvider } from "@/components/auth/session-provider";

export default function TerminalPage() {
  return (
    <ZTerminalSessionProvider>
      <FloatingWorkstationShell />
    </ZTerminalSessionProvider>
  );
}
