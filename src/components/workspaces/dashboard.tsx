"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ArrowUpRight, ChartCandlestick, Check, Cloud, Code2, Copy, Ellipsis, Layers3, Monitor, Plus, Search, Trash2, X } from "lucide-react";
import { STARTERS, copyWorkspace, newWorkspace, type WorkspaceRecord, type WorkspaceStarter, type WorkspaceSummary, type WorkspaceSnapshot } from "@/lib/workspaces/model";
import { createWorkspace, getMigrationBackup, getWorkspace, listLocalWorkspaces, migrateLegacyWorkspaces, updateWorkspace } from "@/lib/workspaces/storage";
import { cloudWorkspaceSummaries, fetchCloudWorkspace, removeCloudWorkspace, saveCloudWorkspace } from "@/lib/workspaces/cloud";
import { createWorkspaceBackup, prepareWorkspaceImport } from "@/lib/workspaces/backup";
import { draftStorage, flushDraftWrites } from "@/lib/local-research/drafts";
import { editClosedWorkspace } from "@/lib/workspaces/edit-lock";
import { WorkspaceAccount } from "./account";
import styles from "./dashboard.module.css";

const starterIcons = { chart: ChartCandlestick, orderflow: Layers3, research: Code2 };
function exportBackup(data: unknown, filename = "zterminal-workspace-recovery.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
export function WorkspaceDashboard() {
  const { data: session } = useSession(), ownerId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [items, setItems] = useState<WorkspaceSummary[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [cloudStatus, setCloudStatus] = useState("On this device"), [query, setQuery] = useState(""), [sort, setSort] = useState("recent");
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [created, setCreated] = useState<string | null>(null);
  const [name, setName] = useState(""), [starter, setStarter] = useState<WorkspaceStarter>("chart"), [provider, setProvider] = useState<"gateio" | "binance">("gateio"), [symbol, setSymbol] = useState("BTCUSDT"), [timeframe, setTimeframe] = useState<WorkspaceSnapshot["timeframe"]>("5m");
  const [renaming, setRenaming] = useState<string | null>(null), [rename, setRename] = useState(""), [deleting, setDeleting] = useState<WorkspaceSummary | null>(null), [skipped, setSkipped] = useState(0);
  const deleteDialog = useRef<HTMLDialogElement>(null), sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const migration = await migrateLegacyWorkspaces(), local = await listLocalWorkspaces(ownerId);
      if (request !== sequence.current) return;
      setSkipped(migration.skipped); setItems(local); setLoading(false);
      if (ownerId) {
        try {
          const cloud = await cloudWorkspaceSummaries();
          if (request !== sequence.current) return;
          const merged = new Map(cloud.map(item => [item.id, item]));
          for (const item of local) merged.set(item.id, item);
          setItems([...merged.values()]); setCloudStatus("Account connected");
        } catch { if (request === sequence.current) setCloudStatus("Sync unavailable · local work is available"); }
      } else setCloudStatus("On this device");
    } catch (cause) { if (request === sequence.current) { setError((cause as Error).message); setLoading(false); } }
  }, [ownerId]);
  useEffect(() => {
    void refresh();
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("zterminal-workspaces");
    const changed = () => { void refresh(); };
    if (channel) channel.onmessage = changed;
    window.addEventListener("zterminal:workspace-catalog", changed); window.addEventListener("online", changed);
    return () => { ++sequence.current; channel?.close(); window.removeEventListener("zterminal:workspace-catalog", changed); window.removeEventListener("online", changed); };
  }, [refresh]);
  useEffect(() => { if (deleting) deleteDialog.current?.showModal(); else deleteDialog.current?.close(); }, [deleting]);

  const localRecord = async (item: WorkspaceSummary): Promise<WorkspaceRecord> => {
    let record = await getWorkspace(item.id);
    if (record?.ownerId && record.ownerId !== ownerId) throw new Error("Sign in to the account that owns this workspace.");
    if (!record) {
      if (!ownerId) throw new Error("Sign in to open this cloud workspace.");
      const downloaded = await fetchCloudWorkspace(item.id, ownerId);
      record = (await updateWorkspace(item.id, current => current ?? downloaded))!;
    }
    return record;
  };
  const action = async (operation: () => Promise<void>) => { setBusy(true); setError(""); try { await operation(); await refresh(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null;
    await action(async () => {
      try {
        const snapshot = newWorkspace(name, starter, provider, symbol, timeframe);
        await createWorkspace(snapshot); setCreated(snapshot.id); setCreating(false); setName("");
        if (tab) tab.location.href = `/workspaces/${snapshot.id}`;
      } catch (cause) { tab?.close(); throw cause; }
    });
  };
  const renameWorkspace = async (item: WorkspaceSummary) => action(() => editClosedWorkspace(item.id, async () => {
    await localRecord(item);
    const record = await updateWorkspace(item.id, current => {
      if (!current) throw new Error("Workspace no longer exists");
      return { ...current, snapshot: { ...current.snapshot, name: rename.trim(), revision: current.snapshot.revision + 1 }, updatedAt: Date.now(), dirty: Boolean(current.ownerId) };
    });
    if (record?.ownerId) {
      const revision = await saveCloudWorkspace(record.snapshot, record.cloudRevision);
      await updateWorkspace(item.id, current => current ? { ...current, cloudRevision: revision, dirty: false } : null);
    }
    setRenaming(null);
  }));
  const backupWorkspace = (item: WorkspaceSummary) => action(async () => {
    const record = await localRecord(item);
    await flushDraftWrites();
    const stored = await draftStorage.getItem("research-drafts-v1");
    const library = stored ? JSON.parse(stored).state?.drafts ?? {} : {};
    const backup = createWorkspaceBackup(record.snapshot, { ...record.importedDrafts, ...library });
    exportBackup(backup, `zterminal-workspace-${item.id}.json`);
    if (backup.missingDraftIds.length) setError("Workspace exported with missing Python source. The backup lists the unavailable artifacts; keep your Helper archive separately.");
  });
  const visible = items.filter(item => `${item.name} ${item.symbol} ${STARTERS[item.starter]?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : Math.max(b.lastOpenedAt, b.updatedAt)-Math.max(a.lastOpenedAt, a.updatedAt));

  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}><Image src="/brand/zterminal-mark-v2.png" width={26} height={26} alt="" />ZTerminal</Link><div className={styles.headerRight}><Link href="/research/example">Example report</Link><Link href="/docs">Help</Link><WorkspaceAccount /></div></header>
    <main className={styles.main}>
      <div className={styles.heading}><div><h1>Workspaces</h1><p>Your charts, tools and research. Ready when you are.</p></div><button className={styles.primary} onClick={() => { setCreating(value => !value); setCreated(null); }}>{creating ? <X size={17} /> : <Plus size={17} />}{creating ? "Cancel" : "Create workspace"}</button></div>
      <div className={styles.notice} role="status"><Monitor size={15} /><span>{cloudStatus}. Local workspaces do not require an account. Back up before clearing browser data.</span></div>
      {error && <div role="alert" className={styles.error}>{error} <button onClick={() => void refresh()}>Retry</button></div>}
      {skipped > 0 && <p className={styles.error}>{skipped} older workspace entries could not be imported. Their original data is preserved. <button onClick={() => void getMigrationBackup().then(exportBackup)}>Export recovery data</button></p>}
      {created && <p className={styles.notice}>Workspace created. <a href={`/workspaces/${created}`} target="_blank" rel="noopener noreferrer">Open workspace <ArrowUpRight size={14} /></a></p>}
      {creating && <form className={styles.create} onSubmit={create} aria-label="Create workspace">
        <div className={styles.createTitle}><h2>Start a workspace</h2><p>Choose what you need first. Add or remove panels at any time.</p></div>
        <fieldset className={styles.starters}><legend className="sr-only">Workspace starter</legend>{Object.entries(STARTERS).map(([id, value]) => { const Icon = starterIcons[id as WorkspaceStarter]; return <label key={id} className={starter === id ? styles.selected : ""}><input type="radio" name="starter" value={id} checked={starter === id} onChange={() => { setStarter(id as WorkspaceStarter); setTimeframe(id === "research" ? "1h" : "5m"); }} /><Icon size={24} /><strong>{value.name}</strong><span>{value.description}</span>{starter === id && <Check className={styles.check} size={16} />}</label>; })}</fieldset>
        <div className={styles.fields}><label>Workspace name<input autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BTC research" /></label><label>Venue<select value={provider} onChange={e => setProvider(e.target.value as "gateio" | "binance")}><option value="gateio">Gate · USDT perpetual</option><option value="binance">Binance · USDT perpetual</option></select></label><label>Market<input required pattern="[A-Z0-9]{3,40}" value={symbol} maxLength={40} onChange={e => setSymbol(e.target.value.toUpperCase())} /></label><label>Timeframe<select value={timeframe} onChange={e => setTimeframe(e.target.value as WorkspaceSnapshot["timeframe"])}>{["1m", "5m", "15m", "30m", "1h", "4h", "1d"].map(tf => <option key={tf}>{tf}</option>)}</select></label></div>
        <div className={styles.createFooter}><span>Saved on this device. Opens in a new tab.</span><button className={styles.primary} disabled={busy || !name.trim()} type="submit">{busy ? "Creating…" : "Create and open"}<ArrowUpRight size={16} /></button></div>
      </form>}
      <div className={styles.notice}><label>Import workspace <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        void action(async () => {
          if (file.size > 8000000) throw new Error("Choose a workspace backup up to 8 MB.");
          const imported = prepareWorkspaceImport(JSON.parse(await file.text()));
          await createWorkspace(imported.snapshot, imported.drafts); setCreated(imported.snapshot.id);
          if (imported.missingDraftIds.length) setError("Imported workspace has missing Python source, as listed in its backup. Existing work was preserved.");
        });
      }} /></label></div>
      <div className={styles.tools}><label className={styles.search}><Search size={18} /><input aria-label="Search workspaces" placeholder="Search workspaces" value={query} onChange={e => setQuery(e.target.value)} /></label><label className={styles.sort}>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recent activity</option><option value="name">Name</option></select></label><span className={styles.count}>{items.length} {items.length === 1 ? "workspace" : "workspaces"}</span></div>
      {loading ? <div className={styles.loading} aria-label="Loading workspaces" /> : !visible.length ? <section className={styles.empty}><Layers3 size={32} /><h2>{query ? "No matching workspaces" : "A clear place to begin"}</h2><p>{query ? "Try another name or market." : "Create your first workspace, choose a starter, and make it your own."}</p>{!query && !creating && <button className={styles.primary} onClick={() => setCreating(true)}><Plus size={17} />Create workspace</button>}</section> : <div className={styles.grid}>{visible.map(item => { const Icon = starterIcons[item.starter] ?? ChartCandlestick; return <article key={item.id} className={styles.card}>
        <div className={styles.cardTop}><Icon size={21} /><span>{STARTERS[item.starter]?.name ?? "Workspace"}</span><details className={styles.menu} onClick={event => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.open = false; }}><summary aria-label={`Actions for ${item.name}`}><Ellipsis size={19} /></summary><div><button disabled={busy} onClick={() => { setRenaming(item.id); setRename(item.name); }}>Rename</button><button disabled={busy} onClick={() => void action(async () => { const record = await localRecord(item); await createWorkspace(copyWorkspace(record.snapshot), record.importedDrafts); })}><Copy size={14} />Duplicate</button><button disabled={busy} onClick={() => void backupWorkspace(item)}>Export saved workspace</button><button disabled={busy} onClick={() => setDeleting(item)}><Trash2 size={14} />Delete</button></div></details></div>
        {renaming === item.id ? <form className={styles.rename} onSubmit={event => { event.preventDefault(); void renameWorkspace(item); }}><input aria-label="Workspace name" autoFocus required maxLength={80} value={rename} onChange={e => setRename(e.target.value)} /><button disabled={busy || !rename.trim()} type="submit">Save</button><button type="button" onClick={() => setRenaming(null)}>Cancel</button></form> : <h2><a href={`/workspaces/${item.id}`} target="_blank" rel="noopener noreferrer">{item.name}<ArrowUpRight size={16} /></a></h2>}
        <p className={styles.market}>{item.marketProvider ?? "Choose original venue"} <span>·</span> {item.symbol} <span>·</span> {item.timeframe}</p>
        <div className={styles.cardBottom}><span>{item.ownerId ? <Cloud size={14} /> : <Monitor size={14} />}{item.ownerId ? item.dirty ? "Changes pending sync" : "Account workspace" : "On this device"}</span><time dateTime={new Date(item.lastOpenedAt || item.updatedAt).toISOString()}>{new Date(item.lastOpenedAt || item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>
      </article>; })}</div>}
      <footer className={styles.footer}><span>Workspaces autosave independently.</span><Link href="/docs/python-research">About Python research <ArrowUpRight size={13} /></Link></footer>
    </main>
    <dialog ref={deleteDialog} className={styles.dialog} onCancel={() => setDeleting(null)}><h2>Delete {deleting?.name}?</h2><p>This removes the workspace{deleting?.ownerId ? " and its cloud data" : " from this device"}. Your Python source library and local Helper archives are kept.</p><div><button disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className={styles.danger} disabled={busy} onClick={() => { if (deleting) void action(() => editClosedWorkspace(deleting.id, async () => { if (deleting.ownerId) { if (ownerId !== deleting.ownerId) throw new Error("Sign in to the workspace's account first."); await removeCloudWorkspace(deleting.id); } await updateWorkspace(deleting.id, () => null); setDeleting(null); })); }}>Delete workspace</button></div></dialog>
  </div>;
}
