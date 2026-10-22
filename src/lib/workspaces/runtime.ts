import { useWorkspace } from "@/stores/workspace";
import { useChartDocuments } from "@/stores/chart-documents";
import { useStudies } from "@/stores/studies";
import { useMultiChart } from "@/stores/multi-chart";
import { recoverResearchDrafts, useResearch } from "@/stores/research";
import { workspaceChartDocuments } from "@/lib/chart/workspace-snapshot";
import { migrateStudy, validateStudy, type IndicatorInstance } from "@/lib/indicator-library";
import { validateConfig } from "@/lib/local-research/dataset";
import { defaultResearchConfig, type ResearchConfig } from "@/lib/local-research/contracts";
import { copyWorkspace, workspaceSnapshotSchema, type WorkspaceRecord } from "./model";
import { createWorkspace, getWorkspace, updateWorkspace } from "./storage";
import { saveCloudWorkspace, WorkspaceCloudError } from "./cloud";

export type WorkspaceSaveState = { local: string; cloud: string; conflict: boolean; pending: boolean };

/** Called before mounting any chart/editor; rehydrations read this tab's current state, never shared legacy keys. */
export async function restoreWorkspaceRuntime(record: WorkspaceRecord) {
  const s = workspaceSnapshotSchema.parse(record.snapshot);
  if (!s.marketProvider) throw new Error("This older workspace did not record its venue. Select the original venue before opening it.");
  const documents = workspaceChartDocuments(s.chartDocuments, s.id);
  if (documents.length !== (s.chartDocuments?.length ?? 0)) throw new Error("Some saved charts are incompatible. The original snapshot is retained; duplicate it before resetting its layout.");
  const studies: IndicatorInstance[] = s.studies.map(item => {
    const study = migrateStudy(item);
    if (!study) throw new Error("A saved study is incompatible. The workspace has not been changed.");
    validateStudy(study); return study;
  });
  useWorkspace.persist.setOptions({ storage: { getItem: () => ({ state: useWorkspace.getState(), version: 5 }), setItem() {}, removeItem() {} } });
  useChartDocuments.persist.setOptions({ storage: { getItem: () => ({ state: useChartDocuments.getState(), version: 5 }), setItem() {}, removeItem() {} } });
  useStudies.persist.setOptions({ storage: { getItem: () => ({ state: useStudies.getState(), version: 2 }), setItem() {}, removeItem() {} } });
  useMultiChart.persist.setOptions({ storage: { getItem: () => ({ state: useMultiChart.getState(), version: 1 }), setItem() {}, removeItem() {} } });
  useWorkspace.setState({ activeWorkspaceId: s.id, marketProvider: s.marketProvider, symbol: s.symbol, timeframe: s.timeframe, timezone: s.timezone, activeView: s.view, sidebarCollapsed: s.sidebarCollapsed, workspaces: [], cloudWorkspaces: [], cloudAuthenticated: false });
  useChartDocuments.setState({ documents: Object.fromEntries(documents.map(d => [d.id, d])), workspaceOwners: {}, drawingHistory: {} });
  useStudies.setState({ instances: studies });
  useMultiChart.setState(s.multiChart);
  await Promise.all([useWorkspace.persist.rehydrate(), useChartDocuments.persist.rehydrate(), useStudies.persist.rehydrate(), useMultiChart.persist.rehydrate()]);
  await recoverResearchDrafts();
  const config = s.research ? s.research.config as unknown as ResearchConfig : defaultResearchConfig();
  validateConfig(config);
  const drafts = { ...record.importedDrafts, ...useResearch.getState().drafts };
  useResearch.setState({ drafts, config, params: s.research?.params ?? {}, minimap: s.research?.minimap ?? false, activeId: s.research?.activeId && drafts[s.research.activeId] ? s.research.activeId : Object.keys(drafts)[0], chartResult: null, result: null, selectedTrade: null, instrument: null, diagnostic: null });
}

export function workspaceRuntime(initial: WorkspaceRecord, owns: () => boolean, report: (state: WorkspaceSaveState) => void) {
  let record = initial, layout = initial.snapshot.dockLayout, generation = 0, saved = 0, paused = false;
  let timer: ReturnType<typeof setTimeout> | undefined, cloudTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve(), syncing: Promise<void> | null = null;
  let owner: string | null = null;
  const state: WorkspaceSaveState = { local: "Saved on this device", cloud: record.ownerId ? "Cloud copy" : "Local workspace", conflict: false, pending: false };
  const emit = () => report({ ...state });
  const capture = () => {
    const ws = useWorkspace.getState(), research = useResearch.getState(), multi = useMultiChart.getState();
    return workspaceSnapshotSchema.parse({
      ...record.snapshot, marketProvider: ws.marketProvider, symbol: ws.symbol, timeframe: ws.timeframe, timezone: ws.timezone,
      view: ws.activeView, sidebarCollapsed: ws.sidebarCollapsed, dockLayout: layout,
      chartDocuments: workspaceChartDocuments(Object.values(useChartDocuments.getState().documents).filter(d => d.workspaceId === record.snapshot.id), record.snapshot.id),
      multiChart: { layout: multi.layout, activePaneIndex: multi.activePaneIndex, syncCrosshairs: multi.syncCrosshairs, syncSymbol: multi.syncSymbol, panes: multi.panes },
      studies: useStudies.getState().instances,
      research: { activeId: research.activeId, config: research.config, params: research.params, minimap: research.minimap },
    });
  };
  const scheduleCloud = () => { clearTimeout(cloudTimer); if (record.ownerId && !state.conflict) cloudTimer = setTimeout(() => { void sync(); }, 1000); };
  const flush = async () => {
    clearTimeout(timer);
    if (paused || !owns()) return;
    const ticket = generation;
    if (ticket <= saved) { await queue; return; }
    let snapshot;
    try { snapshot = capture(); }
    catch (error) { state.local = (error as Error).message || "Workspace save failed"; state.pending = true; emit(); throw error; }
    queue = queue.catch(() => {}).then(async () => {
      if (paused || !owns() || ticket <= saved) return;
      const previousRevision = record.snapshot.revision;
      const next = await updateWorkspace(snapshot.id, current => {
        if (!current || current.ownerId !== record.ownerId || current.snapshot.revision !== previousRevision) throw new Error("The saved workspace changed outside this tab. Local editing is paused; reload or save a copy.");
        return { ...current, snapshot: { ...snapshot, revision: previousRevision + 1 }, updatedAt: Date.now(), dirty: Boolean(current.ownerId) };
      });
      record = next!; saved = ticket;
      state.pending = generation > saved;
      state.local = state.pending ? "Saving…" : "Saved on this device";
      emit(); scheduleCloud();
    });
    try { await queue; }
    catch (error) { state.local = (error as Error).message || "Workspace save failed"; state.pending = true; emit(); throw error; }
  };
  const schedule = () => {
    if (paused || !owns()) return;
    generation++; state.pending = true; state.local = "Saving…"; emit();
    clearTimeout(timer); timer = setTimeout(() => { void flush().catch(() => {}); }, 250);
  };
  const sync = async () => {
    if (syncing) return syncing;
    if (paused || !owns() || !owner || record.ownerId !== owner || state.conflict) return;
    syncing = (async () => {
      try {
        await flush();
        if (!record.dirty || record.ownerId !== owner || paused || !owns()) return;
        const captured = structuredClone(record);
        state.cloud = "Syncing…"; emit();
        const revision = await saveCloudWorkspace(captured.snapshot, captured.cloudRevision);
        const next = await updateWorkspace(captured.snapshot.id, current => {
          if (!current || current.ownerId !== captured.ownerId) throw new Error("Workspace account changed during synchronization");
          return { ...current, cloudRevision: revision, dirty: current.snapshot.revision !== captured.snapshot.revision };
        });
        record = next!; state.cloud = record.dirty ? "Changes pending sync" : "Synced"; emit();
        if (record.dirty) scheduleCloud();
      } catch (error) {
        state.conflict = error instanceof WorkspaceCloudError && error.status === 409;
        state.cloud = state.conflict ? "Cloud conflict · local changes retained" : "Sync unavailable · saved locally"; emit();
      }
    })().finally(() => { syncing = null; });
    return syncing;
  };
  const subscriptions = [
    useWorkspace.subscribe((s, p) => { if (["symbol", "timeframe", "timezone", "activeView", "marketProvider", "sidebarCollapsed"].some(key => s[key as keyof typeof s] !== p[key as keyof typeof p])) schedule(); }),
    useChartDocuments.subscribe((s, p) => { if (s.documents !== p.documents) schedule(); }),
    useStudies.subscribe((s, p) => { if (s.instances !== p.instances) schedule(); }),
    useMultiChart.subscribe(schedule),
    useResearch.subscribe((s, p) => { if (s.activeId !== p.activeId || s.config !== p.config || s.params !== p.params || s.minimap !== p.minimap) schedule(); }),
  ];
  const hidden = () => { if (document.visibilityState === "hidden") void flush().catch(() => {}); };
  const beforeUnload = (event: BeforeUnloadEvent) => { if (state.pending) { event.preventDefault(); event.returnValue = ""; } };
  document.addEventListener("visibilitychange", hidden); window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("online", sync);
  const detach = () => { clearTimeout(timer); clearTimeout(cloudTimer); subscriptions.forEach(unsubscribe => unsubscribe()); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("online", sync); };
  emit();
  return {
    snapshot: () => record.snapshot,
    dock: { starter: initial.snapshot.starter, getItem: () => layout === null ? null : JSON.stringify(layout), setItem: (_key: string, value: string) => { layout = JSON.parse(value); schedule(); }, removeItem: () => { layout = null; schedule(); } },
    flush,
    async flushAll() { await flush(); if (syncing) await syncing; },
    async copy(name?: string) { const snapshot = paused || !owns() ? (await getWorkspace(record.snapshot.id))?.snapshot ?? record.snapshot : capture(); const next = copyWorkspace(snapshot, name); await createWorkspace(next, { ...record.importedDrafts, ...useResearch.getState().drafts }); return next.id; },
    setOwner(id: string | null) { owner = id; if (id && record.ownerId === id) void sync(); },
    async enableCloud(id: string) {
      await flush();
      if (record.ownerId && record.ownerId !== id) throw new Error("This workspace belongs to another account.");
      record = (await updateWorkspace(record.snapshot.id, current => {
        if (!current) throw new Error("Workspace no longer exists");
        return { ...current, ownerId: id, dirty: true };
      }))!;
      owner = id; await sync();
    },
    sync,
    pause() { paused = true; detach(); },
    async dispose() { detach(); try { await flush(); if (syncing) await syncing; } finally { paused = true; } },
  };
}
export type WorkspaceRuntime = ReturnType<typeof workspaceRuntime>;
