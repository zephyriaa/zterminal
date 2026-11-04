"use client";

import ResearchEditor from "./research-editor-host";
import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Play,
  Save,
  Settings2,
  Sliders,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { recoverResearchDrafts, useResearch } from "@/stores/research";
import { EXAMPLES, INSTITUTIONAL_TEMPLATES } from "@/lib/local-research/examples";
import { getDraftStorageStatus } from "@/lib/local-research/drafts";
import { HelperConnectionDrawer, HelperStatusPill } from "./helper-connection-drawer";
import { ResearchInspector } from "./research-inspector";

export function ResearchWorkbench() {
  const state = useResearch();
  const script = state.drafts[state.activeId];
  const [pairCode, setPairCode] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scriptAction, setScriptAction] = useState<"rename" | "copy" | "delete" | null>(null);
  const [name, setName] = useState("");
  const [storageStatus, setStorageStatus] = useState(getDraftStorageStatus);
  const [draftsReady, setDraftsReady] = useState(false);
  const [paramsText, setParamsText] = useState(() => JSON.stringify(state.params));
  const [paramsError, setParamsError] = useState("");
  const [mobileTab, setMobileTab] = useState<"editor" | "inspector">("editor");

  const busy = Boolean(state.job && !["complete", "failed", "cancelled"].includes(state.job.stage));

  useEffect(() => {
    const warn = () => setStorageStatus(getDraftStorageStatus());
    window.addEventListener("zterminal:draft-storage-failed", warn);
    const stopHydration = useResearch.persist.onFinishHydration(current =>
      setParamsText(JSON.stringify(current.params))
    );
    let active = true;
    void (async () => {
      try {
        await recoverResearchDrafts();
      } catch {
        /* Preserve unread storage and permit in-memory editing. */
      }
      if (!active) return;
      setDraftsReady(true);
      setParamsText(JSON.stringify(useResearch.getState().params));
      if (getDraftStorageStatus() === "ready") await useResearch.getState().connect();
    })();
    return () => {
      active = false;
      window.removeEventListener("zterminal:draft-storage-failed", warn);
      stopHydration();
    };
  }, []);

  useEffect(() => {
    if (!draftsReady) return;
    const timer = setTimeout(() => void useResearch.getState().verifyInstrument(), 500);
    return () => clearTimeout(timer);
  }, [draftsReady, state.config.provider, state.config.symbol]);

  const exportSource = () => {
    const url = URL.createObjectURL(new Blob([script.source], { type: "text/x-python" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${script.name.replace(/[^a-z0-9_-]/gi, "_")}.py`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportDrafts = () => {
    const { drafts, activeId, config, params, minimap } = useResearch.getState();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, state: { drafts, activeId, config, params, minimap } }, null, 2)], {
        type: "application/json",
      })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "zterminal-draft-recovery.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRun = () => {
    if (busy) {
      void state.cancel();
      return;
    }
    if (state.connection !== "connected") {
      setDrawerOpen(true);
      return;
    }
    try {
      const parsed = JSON.parse(paramsText);
      if (
        !parsed ||
        Array.isArray(parsed) ||
        typeof parsed !== "object" ||
        Object.values(parsed).some(
          value => !["string", "number", "boolean"].includes(typeof value) || (typeof value === "number" && !Number.isFinite(value))
        )
      ) {
        throw new Error("Parameters must be a flat object of finite numbers, strings, or booleans.");
      }
      useResearch.setState({ params: parsed });
      setParamsError("");
      void state.run();
    } catch (error) {
      setParamsError((error as Error).message);
    }
  };

  if (!draftsReady) return <p role="status" className="p-4 text-xs font-mono text-[#9ca3af]">Recovering local research drafts…</p>;

  return (
    <div className="zt-studio-workbench">
      {/* 1. Studio Command Bar */}
      <header className="zt-studio-header">
        <div className="zt-header-left">
          {/* Active Strategy Selector */}
          <div className="zt-strategy-picker">
            <select
              aria-label="Current research artifact"
              value={state.activeId}
              onChange={e => state.selectScript(e.target.value)}
              className="zt-select-clean font-medium"
            >
              {Object.values(state.drafts)
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.kind === "indicator" ? "ƒ " : "↗ "}
                    {p.name}
                    {p.source !== p.savedSource ? " •" : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="zt-action-buttons">
            <button
              aria-label="New strategy"
              title="New Strategy"
              onClick={() => state.createScript()}
              className="zt-icon-btn"
            >
              <FilePlus2 size={13} />
              <span>Strategy</span>
            </button>
            <button
              aria-label="New Python indicator"
              title="New Indicator"
              onClick={() => state.createScript("Untitled indicator", undefined, "indicator")}
              className="zt-icon-btn"
            >
              <FilePlus2 size={13} />
              <span>ƒ Indicator</span>
            </button>
            <button
              aria-label="Save artifact"
              title="Save (Ctrl/Cmd+S)"
              onClick={() => state.save()}
              className="zt-icon-btn"
            >
              <Save size={13} />
            </button>
            <button
              aria-label="Duplicate artifact"
              title="Save As / Duplicate"
              onClick={() => {
                setName(`${script.name} copy`);
                setScriptAction("copy");
              }}
              className="zt-icon-btn"
            >
              <Copy size={13} />
            </button>
            <button
              aria-label="Export Python source"
              title="Export source"
              onClick={exportSource}
              className="zt-icon-btn"
            >
              <Download size={13} />
            </button>
          </div>
        </div>

        {/* Blueprint Dropdowns */}
        <div className="zt-header-center hidden md:flex items-center gap-2">
          <select
            aria-label="Institutional Library"
            value=""
            onChange={e => {
              const template = INSTITUTIONAL_TEMPLATES.find(p => p.id === e.target.value);
              if (template) state.createScript(template.name, template.source);
            }}
            className="zt-select-blueprint is-institutional"
          >
            <option value="">Institutional Library…</option>
            {INSTITUTIONAL_TEMPLATES.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Educational examples"
            value=""
            onChange={e => {
              const example = EXAMPLES.find(p => p.id === e.target.value);
              if (example) state.createScript(example.name, example.source);
            }}
            className="zt-select-blueprint"
          >
            <option value="">Educational examples…</option>
            {EXAMPLES.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status & Primary Run Action */}
        <div className="zt-header-right">
          <div className="zt-market-pill hidden lg:flex">
            <span>{state.config.provider === "gateio" ? "Gate.io" : "Binance"}</span>
            <span className="text-white font-mono">{state.config.symbol}</span>
            <span className="zt-tag">{state.config.timeframe}</span>
          </div>

          <HelperStatusPill onOpenDrawer={() => setDrawerOpen(true)} />

          <button
            type="button"
            onClick={handleRun}
            className={`zt-run-button ${busy ? "is-busy" : ""}`}
            title="Execute vectorized backtest (Ctrl/Cmd + Enter)"
          >
            {busy ? <Square size={13} className="fill-current" /> : <Play size={13} className="fill-current" />}
            <span>{busy ? "Cancel" : script.kind === "indicator" ? "Preview ƒ" : "Run Backtest"}</span>
            <span className="zt-run-kbd hidden sm:inline">⌘↵</span>
          </button>

          {/* Mobile Tab Toggle */}
          <div className="flex md:hidden items-center border border-[#2a2f45] rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileTab("editor")}
              className={`px-2 py-1 text-xs ${mobileTab === "editor" ? "bg-[#7c3aed] text-white" : "bg-[#141724] text-[#9ca3af]"}`}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("inspector")}
              className={`px-2 py-1 text-xs ${mobileTab === "inspector" ? "bg-[#7c3aed] text-white" : "bg-[#141724] text-[#9ca3af]"}`}
            >
              Config
            </button>
          </div>
        </div>
      </header>

      {/* Script Action Form (Rename, Duplicate, Delete) */}
      {scriptAction && (
        <form
          className="zt-script-action-bar"
          onSubmit={e => {
            e.preventDefault();
            if (scriptAction === "delete") void state.deleteScript();
            else void state.save(name, scriptAction === "copy");
            setScriptAction(null);
          }}
        >
          {scriptAction === "delete" ? (
            <p className="text-xs text-red-300">
              Delete “{script.name}”? Revisions remain in your local archive.
            </p>
          ) : (
            <label className="flex items-center gap-2 text-xs text-white">
              <span>Script Name</span>
              <input
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-[#141724] border border-[#2b3147] rounded px-2 py-1 text-xs text-white"
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScriptAction(null)}
              className="px-2.5 py-1 text-xs bg-[#1f2438] hover:bg-[#2b3147] text-[#d1d5db] rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-3 py-1 text-xs rounded text-white font-medium ${
                scriptAction === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-[#7c3aed] hover:bg-[#6d28d9]"
              }`}
            >
              {scriptAction === "delete" ? "Confirm Delete" : "Save Name"}
            </button>
          </div>
        </form>
      )}

      {/* 2. Studio Split Body */}
      <div className="zt-studio-body">
        {/* Left Pane: Code Studio (65%) */}
        <section
          className={`zt-studio-editor-pane ${mobileTab === "inspector" ? "hidden md:flex" : "flex"}`}
          aria-label="Code Studio"
        >
          {/* Breadcrumb & Revision Meta */}
          <div className="zt-editor-meta-bar">
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#9ca3af]">
              <span className="text-white font-medium">{script.name}</span>
              <span>·</span>
              <span className="text-[#a78bfa]">{script.kind === "indicator" ? "Indicator" : "Strategy"}</span>
              <span>·</span>
              <span>{script.revision ? `Rev ${script.revision}` : "Unsaved"}</span>
              <span>·</span>
              <span className={script.source !== (script.localSavedSource ?? script.savedSource) ? "text-[#fbbf24]" : "text-[#34d399]"}>
                {script.source !== (script.localSavedSource ?? script.savedSource) ? "Modified" : "Saved"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setName(script.name);
                  setScriptAction("rename");
                }}
                className="text-[10px] text-[#9ca3af] hover:text-white"
              >
                Rename
              </button>
              <button
                type="button"
                aria-label="Delete artifact"
                onClick={() => setScriptAction("delete")}
                className="text-[10px] text-red-400 hover:text-red-300"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="zt-editor-container">
            <ResearchEditor />
          </div>

          {/* Floating Action & Diagnostics Strip */}
          <div className="zt-editor-status-bar">
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#9ca3af]">
              <label className="zt-file-import-btn" title="Import local .py file">
                <Upload size={11} /> Import .py
                <input
                  type="file"
                  accept=".py,text/x-python"
                  onChange={async event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      if (!file.name.toLowerCase().endsWith(".py") || file.size > 256_000)
                        throw new Error("Choose a UTF-8 .py file up to 256 KB.");
                      const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
                      state.createScript(file.name.replace(/\.py$/i, ""), source);
                    } catch (error) {
                      useResearch.setState({ error: (error as Error).message });
                    }
                    event.target.value = "";
                  }}
                />
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-[#9ca3af] hover:text-white">
                <input
                  type="checkbox"
                  checked={state.minimap}
                  onChange={e => useResearch.setState({ minimap: e.target.checked })}
                  className="rounded border-[#374151] bg-[#161a26]"
                />
                Minimap
              </label>

              {state.diagnostic?.line && (
                <button
                  type="button"
                  onClick={() =>
                    document
                      .querySelector<HTMLElement>(
                        ".monaco-editor [role=textbox], textarea[aria-label=\"Python strategy editor (plain text)\"]"
                      )
                      ?.focus()
                  }
                  className="text-amber-400 hover:underline flex items-center gap-1"
                >
                  Line {state.diagnostic.line}: {state.diagnostic.message ?? "Syntax error"}
                </button>
              )}
            </div>

            <div className="text-[10px] font-mono text-[#6b7280]">
              {busy ? (
                <span className="text-[#a78bfa]">{state.job!.stage.replaceAll("_", " ")}…</span>
              ) : (
                "Python 3.12 · ZTerminal SDK v1"
              )}
            </div>
          </div>
        </section>

        {/* Right Pane: Parameter & Sizing Inspector (35%) */}
        <section
          className={`zt-studio-inspector-pane ${mobileTab === "editor" ? "hidden md:flex" : "flex"}`}
          aria-label="Parameters & Configuration"
        >
          <ResearchInspector
            paramsText={paramsText}
            setParamsText={setParamsText}
            paramsError={paramsError}
            setParamsError={setParamsError}
          />
        </section>
      </div>

      {/* Slide-Over Helper Connection Drawer */}
      <HelperConnectionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        pairCode={pairCode}
        setPairCode={setPairCode}
      />
    </div>
  );
}
