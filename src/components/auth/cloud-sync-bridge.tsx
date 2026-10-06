"use client";

import { useCloudSyncStatus } from "@/stores/cloud-sync-status";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace, type SavedWorkspace } from "@/stores/workspace";
import { workspaceChartDocuments } from "@/lib/chart/workspace-snapshot";
import { useChartDocuments } from "@/stores/chart-documents";
import { parseCloudWorkspace } from "@/lib/workspace-payload";

type CloudWorkspaceResponse = {
  workspaces?: Array<{
    id: string;
    name: string;
    cloudState?: { payload: string | null } | null;
  }>;
};

/**
 * Fetches cloud data only after an authenticated server session exists. The API
 * is deliberately fail-closed while cloud sync is unconfigured, so local state
 * remains usable without an account or network connection.
 */
export function CloudSyncBridge() {
  const { status, data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const mergeCloudWorkspaces = useWorkspace((state) => state.mergeCloudWorkspaces);
  const setCloudAuthenticated = useWorkspace((state) => state.setCloudAuthenticated);
  const previousOwner = useRef<string | null>(null);
  const pending = useRef(new Map<string, { owner: string; snapshot: SavedWorkspace }>());

  useEffect(() => {
    if (status === "loading") return;
    const purge = () => useChartDocuments.getState().purgeCloudDocuments(status === "authenticated" ? userId ?? null : null);
    purge();
    // Hydration can finish after the first auth effect; enforce the same owner boundary then.
    return useChartDocuments.persist.onFinishHydration(purge);
  }, [status, userId]);

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const requests = new Map<string, AbortController>();
    const schedule = (id: string) => {
      if (status !== "authenticated" || !userId || pending.current.get(id)?.owner !== userId) return;
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        const entry = pending.current.get(id);
        if (!entry || entry.owner !== userId) return;
        requests.get(id)?.abort();
        const controller = new AbortController(); requests.set(id, controller);
        useCloudSyncStatus.setState({ status: "Saving drawings…" });
        void fetch("/api/cloud/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry.snapshot), signal: controller.signal })
          .then(response => {
            if (controller.signal.aborted) return;
            if (response.ok && pending.current.get(id) === entry) pending.current.delete(id);
            useCloudSyncStatus.setState({ status: response.ok ? "Drawings synced" : "Cloud save failed · saved locally" });
          })
          .catch(error => { if (!controller.signal.aborted && error instanceof Error) useCloudSyncStatus.setState({ status: "Cloud unreachable · saved locally" }); })
          .finally(() => { if (requests.get(id) === controller) requests.delete(id); });
      }, 750));
    };
    const retry = () => { for (const id of pending.current.keys()) schedule(id); };
    const unsubscribe = useChartDocuments.subscribe((state, previous) => {
      if (state.documents === previous.documents) return;
      const workspace = useWorkspace.getState();
      const saved = [...workspace.workspaces, ...workspace.cloudWorkspaces].find(item => item.id === workspace.activeWorkspaceId);
      if (!saved) return;
      const documents = Object.values(state.documents).filter(document => document.workspaceId === saved.id);
      const before = Object.values(previous.documents).filter(document => document.workspaceId === saved.id);
      // Drawing changes only: market updates and pane initialization must not upload stale snapshots.
      if (JSON.stringify(documents.map(d => d.drawings)) === JSON.stringify(before.map(d => d.drawings))) return;
      const snapshot = { ...saved, chartDocuments: workspaceChartDocuments(documents, saved.id) };
      useWorkspace.setState(current => ({ workspaces: current.workspaces.map(item => item.id === saved.id ? snapshot : item), cloudWorkspaces: current.cloudWorkspaces.map(item => item.id === saved.id ? snapshot : item) }));
      const owner = status === "authenticated" ? userId : status === "loading" ? previousOwner.current : null;
      if (!owner) return;
      pending.current.set(saved.id, { owner, snapshot });
      schedule(saved.id);
    });
    retry(); window.addEventListener("online", retry);
    return () => {
      unsubscribe(); window.removeEventListener("online", retry);
      for (const timer of timers.values()) clearTimeout(timer);
      for (const controller of requests.values()) controller.abort();
    };
  }, [status, userId]);

  useEffect(() => {
    if (status === "loading") { useWorkspace.getState().suspendCloudAuthentication(); useCloudSyncStatus.setState({ status: "Checking account connection…" }); return; }
    if (previousOwner.current !== (userId ?? null) || status === "unauthenticated") {
      pending.current.clear();
      const workspace = useWorkspace.getState();
      for (const cloud of workspace.cloudWorkspaces) if (!workspace.workspaces.some(local => local.id === cloud.id)) useChartDocuments.getState().removeWorkspaceDocuments(cloud.id);
      setCloudAuthenticated(false);
    }
    previousOwner.current = userId ?? null;
    setCloudAuthenticated(status === "authenticated" && Boolean(userId));
    if (status !== "authenticated") { useCloudSyncStatus.setState({ status: "Local workspace" }); return; }
    useCloudSyncStatus.setState({ status: "Syncing workspaces…" });
    let cancelled = false;

    void fetch("/api/cloud/workspaces", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) throw new Error("Cloud sync unavailable");
        const result = (await response.json()) as CloudWorkspaceResponse;
        const workspaces = (result.workspaces ?? []).map(parseCloudWorkspace).filter((workspace): workspace is NonNullable<typeof workspace> => workspace !== null);
        if (!cancelled) {
          const local = useWorkspace.getState();
          for (const workspace of workspaces) if (userId && !local.workspaces.some(item => item.id === workspace.id)) useChartDocuments.getState().bindCloudWorkspace(workspace.id, userId);
          mergeCloudWorkspaces(workspaces);
          const active = workspaces.find(workspace => workspace.id === local.activeWorkspaceId);
          if (active) useChartDocuments.getState().restoreDocuments(active.id, active.chartDocuments);
          useCloudSyncStatus.setState({ status: "Workspaces synced" });
        }
      })
      .catch(() => { if (!cancelled) useCloudSyncStatus.setState({ status: "Sync unavailable · saved locally" }); });

    return () => {
      cancelled = true;
    };
  }, [mergeCloudWorkspaces, setCloudAuthenticated, status, userId]);

  return null;
}
