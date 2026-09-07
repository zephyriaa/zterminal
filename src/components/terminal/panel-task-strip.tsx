"use client";
import { useEffect } from "react";
import { usePanels } from "@/stores/panels";

export function PanelTaskStrip() {
  const panels = usePanels(s => s.panels);
  const active = usePanels(s => s.active);
  const open = usePanels(s => s.open);
  useEffect(() => {
    void usePanels.persist.rehydrate();
    const canvas = document.querySelector(".zt-reference-canvas");
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => usePanels.getState().setViewport(entry.contentRect.width, Math.max(0, entry.contentRect.height - 34)));
    observer.observe(canvas);
    const reset = () => usePanels.getState().reset();
    window.addEventListener("zterminal:reset-layout", reset);
    return () => { observer.disconnect(); window.removeEventListener("zterminal:reset-layout", reset); };
  }, []);
  return <nav className="zt-panel-task-strip" aria-label="Workspace panels">
    {Object.values(panels).filter(p => p.status !== "closed").map(p => <button key={p.id} type="button" aria-label={`${p.status === "minimized" ? "Restore" : "Focus"} ${p.title} panel`} aria-current={active === p.id ? "true" : undefined} onClick={() => { open(p.id); requestAnimationFrame(() => document.getElementById(`panel-${p.id}`)?.focus()); }}><span aria-hidden="true">{p.status === "minimized" ? "▁" : "▣"}</span> {p.title}</button>)}
    <span className="ml-auto px-3 text-muted-foreground">LAYOUT SAVED LOCALLY</span>
  </nav>;
}
