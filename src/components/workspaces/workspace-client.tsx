"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, CloudUpload, Copy, LockKeyhole, RefreshCw } from "lucide-react";
import { FloatingWorkstationShell } from "@/components/terminal/floating-workstation-shell";
import { useAuthHealth } from "@/components/auth/session-provider";
import { flushDraftWrites } from "@/lib/local-research/drafts";
import { copyWorkspace, type WorkspaceRecord } from "@/lib/workspaces/model";
import { createWorkspace, getWorkspace, migrateLegacyWorkspaces, updateWorkspace } from "@/lib/workspaces/storage";
import { fetchCloudWorkspace } from "@/lib/workspaces/cloud";
import { workspaceEditLock, editClosedWorkspace } from "@/lib/workspaces/edit-lock";
import { restoreWorkspaceRuntime, workspaceRuntime, type WorkspaceRuntime, type WorkspaceSaveState } from "@/lib/workspaces/runtime";
import { WorkspaceSessionContext } from "./session-context";
import { WorkspaceAccount } from "./account";

export function WorkspaceClient({ id }: { id: string }) {
  const router = useRouter();
  const { data: session, status } = useSession(), health = useAuthHealth();
  const ownerId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [record, setRecord] = useState<WorkspaceRecord | null>(null), [runtime, setRuntime] = useState<WorkspaceRuntime | null>(null);
  const [error, setError] = useState(""), [info, setInfo] = useState(""), [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const [venue, setVenue] = useState<"gateio" | "binance">("gateio"), [missingVenue, setMissingVenue] = useState(false);
  const [save, setSave] = useState<WorkspaceSaveState>({ local: "Opening…", cloud: "", pending: false, conflict: false });
  const lock = useRef<ReturnType<typeof workspaceEditLock> | null>(null), activeRuntime = useRef<WorkspaceRuntime | null>(null);

  useEffect(() => {
    if (status === "loading" && health.phase !== "error") return;
    let stopped = false, editor: ReturnType<typeof workspaceEditLock> | null = null, controller: WorkspaceRuntime | null = null;
    const load = async () => {
      setLoading(true); setError(""); setInfo(""); setMissingVenue(false); setRuntime(null);
      try {
        await migrateLegacyWorkspaces();
        let saved = await getWorkspace(id);
        if (saved?.ownerId && saved.ownerId !== ownerId) throw new Error("Sign in to the account that owns this workspace. Its private cached data is not available to this session.");
        if (!saved || saved.ownerId && !saved.dirty) {
          if (!ownerId) { if (!saved) throw new Error("Workspace not found on this device. Sign in if it is saved to your account."); }
          else {
            try {
              const cloud = await fetchCloudWorkspace(id, ownerId);
              saved = await editClosedWorkspace(id, async () => (await updateWorkspace(id, current => current?.dirty ? current : cloud))!);
            } catch (cause) { if (!saved) throw cause; setInfo("Cloud is unavailable. Opened the saved copy on this device."); }
          }
        }
        if (!saved || stopped) return;
        const savedOwner = saved.ownerId;
        editor = workspaceEditLock(id, next => { if (!stopped) setEditing(next); if (!next) activeRuntime.current?.pause(); }, async () => { await activeRuntime.current?.flushAll(); await flushDraftWrites(); });
        lock.current = editor;
        await editor.ready;
        if (stopped) { editor.close(); return; }
        // Read again after acquiring ownership: the previous tab may have just flushed.
        saved = await getWorkspace(id);
        if (!saved || saved.ownerId !== savedOwner) throw new Error("Workspace changed while opening. Reload it from the dashboard.");
        setRecord(saved);
        if (!saved.snapshot.marketProvider) { setMissingVenue(true); setLoading(false); return; }
        await restoreWorkspaceRuntime(saved);
        if (stopped) { editor.close(); return; }
        controller = workspaceRuntime(saved, editor.owns, next => { if (!stopped) setSave(next); });
        activeRuntime.current = controller;
        controller.setOwner(ownerId);
        await updateWorkspace(id, current => current ? { ...current, lastOpenedAt: Date.now() } : null);
        if (stopped) return;
        setRuntime(controller); setLoading(false);
        document.title = `${saved.snapshot.name} — ZTerminal`;
      } catch (cause) { if (!stopped) { setError((cause as Error).message); setLoading(false); } editor?.close(); }
    };
    void load();
    return () => {
      stopped = true; activeRuntime.current = null; lock.current = null;
      if (controller) void controller.dispose().catch(() => {}).finally(() => editor?.close()); else editor?.close();
    };
  }, [id, ownerId, status, health.phase, retry]);

  const action = async (operation: () => Promise<void>) => { setBusy(true); setError(""); try { await operation(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  const duplicate = async (name?: string) => {
    const next = runtime ? await runtime.copy(name) : record ? (await createWorkspace(copyWorkspace(record.snapshot, name)))?.snapshot.id : null;
    if (next) { setInfo("Copy saved on this device. Open it from Workspaces."); }
  };
  useEffect(() => {
    const duplicateEvent = (event: Event) => { void action(() => duplicate((event as CustomEvent<{ name?: string }>).detail?.name)); };
    window.addEventListener("zterminal:duplicate-workspace", duplicateEvent);
    return () => window.removeEventListener("zterminal:duplicate-workspace", duplicateEvent);
  });
  useEffect(() => {
    if (editing) return;
    const guard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["s", "b", "enter"].includes(event.key.toLowerCase())) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", guard, true);
    return () => window.removeEventListener("keydown", guard, true);
  }, [editing]);

  const reloadCloud = async () => {
    if (!ownerId || !runtime || !editing) return;
    await runtime.flushAll();
    const current = await getWorkspace(id);
    if (current?.dirty) await createWorkspace(copyWorkspace(current.snapshot, `${current.snapshot.name.slice(0, 66)} recovery copy`));
    const remote = await fetchCloudWorkspace(id, ownerId);
    runtime.pause();
    await updateWorkspace(id, () => remote); window.location.reload();
  };

  if (loading) return <main className="ws-recovery" aria-busy="true"><h1>Opening workspace…</h1><p>Restoring its saved charts and layout.</p><Link href="/workspaces">Back to workspaces</Link></main>;
  if (missingVenue) return <main className="ws-recovery"><h1>Restore the original venue</h1><p>This older workspace did not save a verified venue. Choose the venue you used; ZTerminal will not substitute another market.</p><label>Original venue<select value={venue} onChange={e => setVenue(e.target.value as "gateio" | "binance")}><option value="gateio">Gate USDT perpetual</option><option value="binance">Binance USDT perpetual</option></select></label><button disabled={!editing || busy} onClick={() => void action(async () => { await updateWorkspace(id, current => current ? { ...current, snapshot: { ...current.snapshot, marketProvider: venue, revision: current.snapshot.revision + 1 }, dirty: Boolean(current.ownerId) } : null); setRetry(n => n+1); })}>Open workspace</button><Link href="/workspaces">Back to workspaces</Link>{error && <p role="alert">{error}</p>}</main>;
  if (!runtime || !record) return <main className="ws-recovery"><h1>Workspace could not be opened</h1><p role="alert">{error || "The saved snapshot is unavailable."}</p><button onClick={() => setRetry(n => n+1)}><RefreshCw size={16} />Retry</button><Link href="/workspaces">Back to workspaces</Link><WorkspaceAccount /></main>;

  return <div className="ws-runtime">
    <header className="ws-toolbar" aria-label="Workspace controls"><a href="/workspaces" onClick={event => { event.preventDefault(); void action(async () => { await runtime.flushAll(); await flushDraftWrites(); router.push("/workspaces"); }); }}><ArrowLeft size={15} />Workspaces</a><strong>{record.snapshot.name}</strong><span className="ws-save-status" role="status">{save.local}{save.cloud && ` · ${save.cloud}`}</span><div className="ws-toolbar-actions"><button disabled={busy} onClick={() => void action(() => duplicate())}><Copy size={14} />Duplicate</button>{ownerId && editing && !record.ownerId && <button disabled={busy} onClick={() => void action(async () => { await runtime.enableCloud(ownerId); setRecord((await getWorkspace(id))!); })}><CloudUpload size={14} />Save to account</button>}{record.ownerId && editing && <button disabled={busy || save.conflict} onClick={() => void action(runtime.sync)}>Retry sync</button>}<WorkspaceAccount /></div></header>
    {!editing && <div className="ws-banner" role="status"><LockKeyhole size={15} /><span>Read-only · this workspace is editable in one tab at a time.</span><button disabled={busy} onClick={() => void action(async () => { runtime.pause(); await lock.current?.takeover(); window.location.reload(); })}>Take over editing</button></div>}
    {save.conflict && <div className="ws-banner" role="alert">The cloud workspace changed elsewhere. Local changes are retained.<button disabled={busy} onClick={() => void action(reloadCloud)}>Reload cloud version</button><button disabled={busy} onClick={() => void action(() => duplicate())}>Save local version as copy</button><span>Reloading also preserves a local recovery copy.</span></div>}
    {error && <div className="ws-banner" role="alert">{error}</div>}{info && <div className="ws-banner" role="status">{info}</div>}
    <div className="ws-canvas" aria-readonly={!editing} inert={!editing}><WorkspaceSessionContext.Provider value={runtime.dock}><FloatingWorkstationShell managed name={record.snapshot.name} /></WorkspaceSessionContext.Provider></div>
  </div>;
}
