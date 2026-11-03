import { ZTerminalSessionProvider } from "@/components/auth/session-provider";
import "@/components/workspaces/workspaces.css";

export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return <ZTerminalSessionProvider session={null}>{children}</ZTerminalSessionProvider>;
}
