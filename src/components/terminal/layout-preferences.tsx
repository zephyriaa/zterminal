"use client";
import { useState } from "react";
import { useWorkspaceDock } from "./docking/workspace-dock-controller";
import { useWorkspace } from "@/stores/workspace";
import { useMultiChart } from "@/stores/multi-chart";
import { useCustomization } from "@/stores/customization";

export function LayoutPreferences() {
  const dock = useWorkspaceDock(), multi = useMultiChart();
  const locked = useWorkspace(state => state.layoutLocked);
  const { preferences, update } = useCustomization();
  const [name, setName] = useState(""), [message, setMessage] = useState("");
  const change = (action: () => void) => {
    dock.rememberLayout();
    try { action(); setMessage("Layout saved. Undo is available."); } catch (error) { setMessage((error as Error).message); }
  };
  return <section className="zt-preference-section"><h3>Workspace arrangement</h3><p>Panel positions, chart arrangement and linking are saved with this workspace. Templates copy the arrangement without copying market data.</p>
    <label className="zt-preference-check"><input type="checkbox" checked={locked} onChange={event => useWorkspace.setState({ layoutLocked: event.target.checked })} />Lock panel dragging and resizing</label>
    <label className="zt-preference-field">Chart arrangement<select disabled={locked} value={multi.layout} onChange={event => change(() => multi.setLayout(event.target.value as typeof multi.layout))}><option value="1">Single chart</option><option value="2h">Two columns</option><option value="2v">Two rows</option><option value="3">Three charts</option><option value="4">Four charts</option></select></label>
    <label className="zt-preference-check"><input type="checkbox" checked={multi.syncCrosshairs} onChange={multi.toggleSyncCrosshairs} />Link crosshairs</label>
    <label className="zt-preference-check"><input type="checkbox" checked={multi.syncSymbol} onChange={multi.toggleSyncSymbol} />Link symbols</label>
    <div className="zt-preference-actions"><button disabled={locked} onClick={() => change(() => { dock.useStarter("chart"); multi.setLayout("1"); })}>Chart focus</button><button disabled={locked} onClick={() => change(() => { dock.useStarter("research"); multi.setLayout("1"); })}>Research</button><button disabled={locked} onClick={() => change(() => { dock.useStarter("chart"); multi.setLayout("4"); })}>Multi-chart comparison</button><button disabled={locked} onClick={() => change(dock.resetLayout)}>Reset layout</button><button disabled={locked || !dock.canUndoLayout} onClick={() => { dock.undoLayout(); setMessage("Previous layout restored."); }}>Undo layout change</button></div>
    <label className="zt-preference-field">Layout template name<input maxLength={60} value={name} onChange={event => setName(event.target.value)} /></label>
    <button disabled={!name.trim()} onClick={() => { try { const layout = dock.getLayout(); if (!layout) throw new Error("Workspace is still opening."); update({ layoutTemplates: [...preferences.layoutTemplates.filter(item => item.name !== name.trim()), { name: name.trim(), layout: layout as unknown as Record<string, unknown>, multiLayout: multi.layout }] }); setMessage("Layout template saved on this device."); } catch (error) { setMessage((error as Error).message); } }}>Save layout template</button>
    {preferences.layoutTemplates.map(item => <div className="zt-preference-saved" key={item.name}><span>{item.name}</span><button disabled={locked} onClick={() => change(() => { dock.restoreLayout(item.layout); multi.setLayout(item.multiLayout); })}>Apply layout</button><button onClick={() => update({ layoutTemplates: preferences.layoutTemplates.filter(value => value.name !== item.name) })}>Delete layout</button></div>)}
    <p role="status">{message}</p>
  </section>;
}
