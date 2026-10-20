import type { Metadata } from "next";
import { WorkspaceDashboard } from "@/components/workspaces/dashboard";
export const metadata: Metadata = { title: "Workspaces — ZTerminal" };
export default function WorkspacesPage() { return <WorkspaceDashboard />; }
