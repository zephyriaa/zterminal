"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE, type TerminalAppearance } from "@/lib/terminal-appearance";
import { useTerminalAppearance } from "@/stores/terminal-appearance";
import { useCustomization, hydrateCustomization } from "@/stores/customization";
import { COMMANDS, DEFAULT_CUSTOMIZATION, contrastRatio, defaultBindings, parsePreferenceFile, shortcutFromEvent, type CommandId } from "@/lib/customization";
import { PreferenceColor } from "./preference-color";
import { ChartCustomization } from "./chart-customization";
import { LayoutPreferences } from "./layout-preferences";
export { useTerminalAppearance, hydrateTerminalAppearance } from "@/stores/terminal-appearance";

type Section = "Appearance" | "Charts" | "Layout" | "Keyboard" | "Import / Export";
const sections: { id: Section; keywords: string }[] = [
  { id: "Appearance", keywords: "colors accent background panels density text size font motion candles grid presets contrast" },
  { id: "Charts", keywords: "candles colors wick border grid scales price volume timezone indicators templates styles defaults crosshair" },
  { id: "Layout", keywords: "panels arrangement reset restore lock templates linking symbols crosshairs" },
  { id: "Keyboard", keywords: "shortcuts commands bindings keys" },
  { id: "Import / Export", keywords: "backup preferences file portable restore json" },
];
export function TerminalPreferences() {
  const { appearance, update: updateAppearance } = useTerminalAppearance();
  const { preferences, update, hydrated, storageError } = useCustomization();
  const { timezone, setTimezone } = useWorkspace();
  const section = useCustomization(state => state.section);
  const setSection = (section: Section) => useCustomization.setState({ section });
  const [search, setSearch] = useState("");
  const [name, setName] = useState(""), [message, setMessage] = useState("");
  const [recording, setRecording] = useState<CommandId | null>(null);
  const [imported, setImported] = useState<ReturnType<typeof parsePreferenceFile> | null>(null);
  const initial = useRef({ appearance: DEFAULT_APPEARANCE, preferences: DEFAULT_CUSTOMIZATION });
  const baselineReady = useRef(false);
  useEffect(() => { void hydrateCustomization(); }, []);
  useEffect(() => { if (hydrated && !baselineReady.current) { initial.current = { appearance: structuredClone(useTerminalAppearance.getState().appearance), preferences: structuredClone(useCustomization.getState().preferences) }; baselineReady.current = true; } }, [hydrated]);
  const change = (next: Partial<TerminalAppearance>) => { updateAppearance(next); setMessage("Application preferences saved. Existing chart overrides are preserved."); };
  const run = (action: () => void) => { try { action(); } catch (error) { setMessage((error as Error).message); } };
  const matches = sections.filter(item => `${item.id} ${item.keywords}`.toLowerCase().includes(search.toLowerCase().trim()));
  const visible = search ? matches.map(item => item.id) : [section];
  return <div className="zt-terminal-preferences zt-terminal-preferences-custom zt-customization">
    <h2>Terminal preferences</h2><p>Application settings live on this device. Layouts and chart overrides belong to their workspace.</p>
    <label className="zt-preference-field">Search preferences<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Candle colors, layout, shortcuts…" /></label>
    <nav aria-label="Preference sections">{sections.map(item => <button key={item.id} aria-current={!search && section === item.id ? "page" : undefined} onClick={() => { setSearch(""); setSection(item.id); }}>{item.id}</button>)}</nav>
    <p className="zt-preference-status" role="status">{message || (storageError ? "Saved preferences could not be read. Export a backup before replacing them." : hydrated ? "Preferences loaded · changes apply instantly" : "Loading preferences…")}</p>
    {!matches.length && search && <p>No matching preferences. Try colors, chart, layout or keyboard.</p>}
    {visible.includes("Appearance") && <section className="zt-preference-section"><h3>Application appearance</h3><p>Interface colors apply immediately. Chart colors below are defaults for new charts unless a saved chart style overrides them.</p>
      <div className="zt-preference-presets">{Object.entries(APPEARANCE_PRESETS).map(([preset, values]) => <button key={preset} aria-pressed={appearance.preset === preset} onClick={() => change({ preset, ...values })}><i style={{ background: values.accent }} />{preset === "Graphite" ? "Classic Blue" : preset}</button>)}</div>
      <div className="zt-preference-grid">{(["appBackground", "panelBackground", "chartBackground", "accent", "upColor", "downColor"] as const).map((key, index) => <PreferenceColor key={key} label={["Workspace background", "Panel background", "New-chart background", "Accent", "New-chart up candles", "New-chart down candles"][index]} value={appearance[key]} onChange={value => change({ [key]: value })} onReset={() => change({ [key]: DEFAULT_APPEARANCE[key] })} />)}</div>
      <p>Accent contrast against panels: {contrastRatio(appearance.accent, appearance.panelBackground).toFixed(1)}:1{contrastRatio(appearance.accent, appearance.panelBackground) < 4.5 ? " · Choose a lighter accent or darker panel for readable controls." : " · Meets normal-text contrast."}</p>
      <div className="zt-preference-actions"><button onClick={() => change({ upColor: "#56b4e9", downColor: "#e69f00" })}>Use blue / orange candles</button><button onClick={() => change({ upColor: "#ffffff", downColor: "#a78bfa" })}>Use white / violet candles</button></div>
      <label className="zt-preference-field">New-chart grid intensity · {appearance.gridOpacity}%<input type="range" min={0} max={18} value={appearance.gridOpacity} onChange={event => change({ gridOpacity: Number(event.target.value) })} /></label>
      <label className="zt-preference-field">Information density<select value={appearance.density} onChange={event => change({ density: event.target.value as TerminalAppearance["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
      <label className="zt-preference-field">Interface and editor text size · {preferences.fontSize}px<input type="range" min={11} max={18} value={preferences.fontSize} onChange={event => { update({ fontSize: Number(event.target.value) }); setMessage("Text size saved."); }} /></label>
      <label className="zt-preference-check"><input type="checkbox" checked={preferences.reduceMotion} onChange={event => { update({ reduceMotion: event.target.checked }); setMessage("Motion preference saved."); }} />Reduce motion</label>
      <label className="zt-preference-field">Custom appearance name<input maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="My workspace colors" /></label>
      <button disabled={!name.trim()} onClick={() => run(() => { update({ appearancePresets: [...preferences.appearancePresets.filter(item => item.name !== name.trim()), { name: name.trim(), appearance: structuredClone(appearance) }] }); setMessage("Custom appearance saved."); })}>Save appearance preset</button>
      {preferences.appearancePresets.map(item => <div className="zt-preference-saved" key={item.name}><span>{item.name}</span><button onClick={() => change(item.appearance)}>Apply appearance</button><button onClick={() => update({ appearancePresets: preferences.appearancePresets.filter(value => value.name !== item.name) })}>Delete appearance</button></div>)}
      <div className="zt-preference-actions"><button onClick={() => { change(DEFAULT_APPEARANCE); update({ fontSize: DEFAULT_CUSTOMIZATION.fontSize, reduceMotion: false }); }}>Reset appearance section</button><button onClick={() => { change(initial.current.appearance); update({ fontSize: initial.current.preferences.fontSize, reduceMotion: initial.current.preferences.reduceMotion }); setMessage("Appearance session reverted."); }}>Revert appearance session</button></div>
    </section>}
    {visible.includes("Charts") && <section className="zt-preference-section"><h3>Charts</h3><label className="zt-preference-field">Workspace chart timezone<select value={timezone} onChange={event => setTimezone(event.target.value as ChartTimezone)}>{["UTC", "local", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Tokyo"].map(value => <option key={value}>{value}</option>)}</select></label><ChartCustomization /></section>}
    {visible.includes("Layout") && <LayoutPreferences />}
    {visible.includes("Keyboard") && <section className="zt-preference-section"><h3>Application shortcuts</h3><p>Shortcuts run outside text fields and the Python editor. Mod means Ctrl on Windows and Command on macOS. Click a binding, then press your new combination; Escape cancels.</p>
      {(Object.entries(COMMANDS) as [CommandId, typeof COMMANDS[CommandId]][]).map(([id, command]) => <div className="zt-preference-saved" key={id}><span>{command.label}</span><button aria-label={`Rebind ${command.label}`} onClick={() => setRecording(id)} onBlur={() => setRecording(null)} onKeyDown={event => { if (recording !== id) return; event.preventDefault(); event.stopPropagation(); if (event.key === "Escape") { setRecording(null); return; } const key = event.code === "Comma" ? "," : event.code === "Period" ? "." : event.key; const value = shortcutFromEvent({ ...event, key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey }); if (!value) return; run(() => { update({ bindings: { ...preferences.bindings, [id]: value } }); setRecording(null); setMessage("Shortcut saved."); }); }}>{recording === id ? "Press shortcut…" : preferences.bindings[id].replace("Mod", typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "Cmd" : "Ctrl") || "Unassigned"}</button><button onClick={() => update({ bindings: { ...preferences.bindings, [id]: "" } })}>Clear</button></div>)}
      <button onClick={() => { update({ bindings: defaultBindings }); setMessage("Default shortcuts restored."); }}>Reset keyboard shortcuts</button>
    </section>}
    {visible.includes("Import / Export") && <section className="zt-preference-section"><h3>Portable preferences</h3><p>Includes application appearance, saved styles, templates, text size, motion and shortcuts. Workspace market data, drawings, scripts and account credentials stay in their workspaces.</p>
      <button onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, appearance, customization: preferences }, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "zterminal-preferences.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Preferences exported."); }}>Export preferences</button>
      <label className="zt-preference-field">Import preference file<input type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; setImported(null); if (!file) return; try { if (file.size > 2_000_000) throw new Error("Preference files must be smaller than 2 MB."); setImported(parsePreferenceFile(await file.text())); setMessage("File validated. Review the changes below before applying."); } catch { setMessage("Import rejected: invalid or incompatible preference file. Existing preferences are unchanged."); } event.target.value = ""; }} /></label>
      {imported && <div className="zt-import-preview"><h4>Import preview</h4><p>Replace application colors with {imported.appearance.preset}, density with {imported.appearance.density}, text size with {imported.customization.fontSize}px, motion preference and shortcut bindings.</p><p>Replace saved collections: {imported.customization.appearancePresets.length} appearances, {imported.customization.chartStyles.length} chart styles, {imported.customization.indicatorTemplates.length} indicator templates and {imported.customization.layoutTemplates.length} layouts. New-chart defaults will also be replaced.</p><button onClick={() => { update(imported.customization); updateAppearance(imported.appearance); setImported(null); setMessage("Imported preferences applied. Existing charts are unchanged."); }}>Apply imported preferences</button><button onClick={() => setImported(null)}>Cancel import</button></div>}
    </section>}
  </div>;
}
