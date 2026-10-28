"use client";
import { useRef, useState } from "react";
import { usePrimaryDocument } from "./docking/use-primary-chart-document";
import { useChartDocuments } from "@/stores/chart-documents";
import { useTerminalAppearance } from "@/stores/terminal-appearance";
import { useCustomization } from "@/stores/customization";
import { useStudies } from "@/stores/studies";
import { defaultChartStyle, chartStyle } from "@/lib/customization";
import { ChartSettingsPanel } from "./chart-settings-panel";
import type { ChartDocument, ChartSettingsV2 } from "@/lib/chart/contracts";

export function ChartCustomization() {
  const { id, document, chartSymbol, chartProvider } = usePrimaryDocument();
  const { preferences, update } = useCustomization();
  const appearance = useTerminalAppearance(state => state.appearance);
  const [canRevert, setCanRevert] = useState(false);
  const [name, setName] = useState(""), [message, setMessage] = useState("");
  const initial = useRef<Record<string, ChartDocument>>({});
  const store = useChartDocuments.getState();
  if (!document) return <p>Open a verified chart to customize it.</p>;
  const patch = (settings: Partial<ChartSettingsV2>, all = false) => {
    const targets = all ? Object.values(store.documents).filter(item => item.workspaceId === document.workspaceId) : [document];
    for (const target of targets) { initial.current[target.id] ??= structuredClone(target); store.updateSettings(target.id, settings); }
    setCanRevert(true);
    setMessage(all ? "Style applied to existing workspace charts." : "Chart settings saved.");
  };
  const run = (action: () => void) => { try { action(); } catch (error) { setMessage((error as Error).message); } };
  const volume = document.panes.find(pane => pane.id === "volume");
  return <div className="zt-chart-customization">
    <p>Chart · {chartSymbol} · {chartProvider.toUpperCase()}. Style changes preserve drawings, scales, symbols and research.</p>
    <div className="zt-preference-actions">
      <button onClick={() => patch(defaultChartStyle(appearance, preferences.chartDefaults))}>Restore application style</button>
      <button onClick={() => patch(chartStyle(document.settings), true)}>Apply style to workspace charts</button>
      <button onClick={() => { update({ chartDefaults: chartStyle(document.settings) }); setMessage("Style saved as the default for new charts."); }}>Use style for new charts</button>
      <button onClick={() => { update({ chartDefaults: null }); setMessage("New charts will use application colors."); }}>Reset new-chart defaults</button>
      <button disabled={!canRevert} onClick={() => { for (const original of Object.values(initial.current)) { store.updateSettings(original.id, original.settings); const volume = original.panes.find(pane => pane.id === "volume"); if (volume) store.setVolumePane(original.id, volume); } initial.current = {}; setCanRevert(false); setMessage("Chart changes reverted."); }}>Revert chart session</button>
    </div>
    <label className="zt-preference-field">Preset or template name<input maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="My chart setup" /></label>
    <div className="zt-preference-actions">
      <button disabled={!name.trim()} onClick={() => run(() => { update({ chartStyles: [...preferences.chartStyles.filter(item => item.name !== name.trim()), { name: name.trim(), settings: chartStyle(document.settings) }] }); setMessage("Chart style saved."); })}>Save chart style</button>
      <button disabled={!name.trim()} onClick={() => run(() => { update({ indicatorTemplates: [...preferences.indicatorTemplates.filter(item => item.name !== name.trim()), { name: name.trim(), indicators: structuredClone(useStudies.getState().instances) }] }); setMessage("Indicator template saved separately from chart style."); })}>Save indicator template</button>
    </div>
    {preferences.chartStyles.map(item => <div className="zt-preference-saved" key={item.name}><span>Style · {item.name}</span><button onClick={() => patch(item.settings)}>Apply to this chart</button><button onClick={() => update({ chartStyles: preferences.chartStyles.filter(value => value.name !== item.name) })}>Delete style</button></div>)}
    {preferences.indicatorTemplates.map(item => <div className="zt-preference-saved" key={item.name}><span>Indicators · {item.name}</span><button onClick={() => { const indicators = structuredClone(item.indicators); store.setIndicators(id, indicators); useStudies.getState().replaceInstances(indicators); setMessage("Indicator template applied to the primary chart."); }}>Apply indicators</button><button onClick={() => update({ indicatorTemplates: preferences.indicatorTemplates.filter(value => value.name !== item.name) })}>Delete template</button></div>)}
    <p role="status">{message}</p>
    <ChartSettingsPanel key={id} settings={document.settings} instrument={chartSymbol} provider={chartProvider.toUpperCase()} volumeVisible={volume?.visible ?? true} volumeHeight={volume?.height ?? .22} onChange={settings => patch(settings)} onVolume={value => { initial.current[id] ??= structuredClone(document); store.setVolumePane(id, value); setCanRevert(true); setMessage("Volume settings saved."); }} onReset={() => { initial.current[id] ??= structuredClone(document); store.resetSettings(id); setCanRevert(true); setMessage("Chart settings reset. Revert is available."); }} />
  </div>;
}
