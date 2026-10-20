import Link from "next/link";
export default function MissingWorkspace() {
  return <main className="ws-recovery"><h1>Workspace not found</h1><p>This workspace link is invalid.</p><Link href="/workspaces">Back to workspaces</Link></main>;
}
