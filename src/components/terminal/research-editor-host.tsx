"use client";
import { Component, useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import { useCustomization } from "@/stores/customization";
import { useTerminalAppearance } from "@/stores/terminal-appearance";
import { useResearch } from "@/stores/research";
import { flushDraftWrites } from "@/lib/local-research/drafts";

class EditorBoundary extends Component<{ children: ReactNode; failed: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.failed(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** The plain editor stays usable while either the chunk or Monaco initializes. */
export default function ResearchEditorHost() {
  const fontSize = useCustomization(state => state.preferences.fontSize);
  const density = useTerminalAppearance(state => state.appearance.density);
  const script = useResearch(s => s.drafts[s.activeId]);
  const diagnostic = useResearch(s => s.diagnostic);
  const [Editor, setEditor] = useState<ComponentType<{ onReady?: () => void }> | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { if (active && !mounted.current) setFailure("The enhanced editor did not initialize within 10 seconds. Check editor asset requests or retry. Your code remains editable below."); }, 10_000);
    void import("./research-editor").then(module => { if (active) setEditor(() => module.default); }).catch(error => { if (active) setFailure(`Enhanced editor could not load: ${String(error)}. Your code remains editable below.`); });
    return () => { active = false; clearTimeout(timer); };
  }, []);
  const retry = async () => {
    // The upstream AMD loader caches rejected initialization promises. A fresh
    // page is required after a failed loader; never reload unconfirmed drafts.
    try { await flushDraftWrites(); window.location.reload(); }
    catch { setFailure("Retry could not safely reload because browser storage is unavailable. Export your Python source before manually reloading. Plain-text editing remains available."); }
  };
  // A successful mount owns loading; a late module must not replace fallback edits.
  const enhanced = Editor && !failure;
  return <div style={{ height: "100%", minHeight: 240, position: "relative" }}>
    {failure && <p role="alert" className="p-2 text-xs">{failure} <button onClick={() => { void retry(); }}>Save draft and reload editor</button></p>}
    {!ready && !failure && <p role="status" className="p-2 text-xs">Starting enhanced editor… Plain-text editing is available now.</p>}
    {(!ready || failure) && <textarea aria-label="Python strategy editor (plain text)" spellCheck={false} value={script.source} onChange={event => useResearch.getState().setSource(event.target.value)} onKeyDown={event => { if (event.ctrlKey || event.metaKey) { if (event.key.toLowerCase() === "s") { event.preventDefault(); void useResearch.getState().save(); } else if (event.key === "Enter") { event.preventDefault(); void useResearch.getState().run(); } } }} style={{ width: "100%", height: "calc(100% - 48px)", minHeight: 180, fontFamily: "Consolas, monospace", fontSize, lineHeight: density === "compact" ? 1.5 : 1.8, padding: density === "compact" ? 8 : 12 }} />}
    {enhanced && <div style={{ position: "absolute", inset: 0, visibility: ready ? "visible" : "hidden" }}><EditorBoundary failed={() => setFailure("Enhanced editor initialization failed. Use plain text or retry.")}><Editor onReady={() => { mounted.current = true; setReady(true); }} /></EditorBoundary></div>}
    {diagnostic && failure && <p role="alert">{diagnostic.line ? `Line ${diagnostic.line}: ` : ""}{diagnostic.message}</p>}
  </div>;
}
