import { WorkspaceShell } from "@/components/terminal/workspace-shell";

/**
 * Primary ZTerminal research workstation entry point.
 * The legacy /terminal URL renders this same workspace for saved links.
 */
export default function Home() {
  return <WorkspaceShell />;
}
