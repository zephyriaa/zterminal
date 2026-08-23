"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace, type SavedWorkspace } from "@/stores/workspace";

type CloudWorkspaceResponse = {
  workspaces?: Array<{
    id: string;
    name: string;
    cloudState?: { payload: string | null } | null;
  }>;
};

function parseWorkspace(entry: NonNullable<CloudWorkspaceResponse["workspaces"]>[number]): SavedWorkspace | null {
  if (!entry.cloudState?.payload) return null;
  try {
    const payload = JSON.parse(entry.cloudState.payload) as Omit<SavedWorkspace, "id" | "name"> & { version?: number };
    if (!payload || payload.version !== 1) return null;
    return {
      id: entry.id,
      name: entry.name,
      view: payload.view,
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      timezone: payload.timezone,
      createdAt: payload.createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches cloud data only after an authenticated server session exists. The API
 * is deliberately fail-closed while cloud sync is unconfigured, so local state
 * remains usable without an account or network connection.
 */
export function CloudSyncBridge() {
  const { status } = useSession();
  const mergeCloudWorkspaces = useWorkspace((state) => state.mergeCloudWorkspaces);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void fetch("/api/cloud/workspaces", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const result = (await response.json()) as CloudWorkspaceResponse;
        const workspaces = (result.workspaces ?? []).map(parseWorkspace).filter((workspace): workspace is SavedWorkspace => workspace !== null);
        if (!cancelled) mergeCloudWorkspaces(workspaces);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mergeCloudWorkspaces, status]);

  return null;
}
