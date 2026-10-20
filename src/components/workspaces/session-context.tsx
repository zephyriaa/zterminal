"use client";
import { createContext, useContext } from "react";
import type { WorkspaceStarter } from "@/lib/workspaces/model";

type DockSession = { starter: WorkspaceStarter; getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void };
export const WorkspaceSessionContext = createContext<DockSession | null>(null);
export const useWorkspaceDockSession = () => useContext(WorkspaceSessionContext);
