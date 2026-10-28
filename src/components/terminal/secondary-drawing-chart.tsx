"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TerminalChart, type ChartSettings, type ChartIndicators } from "./terminal-chart";
import { DrawingToolbar } from "./drawing-toolbar";
import { DrawingInspector } from "./drawing-inspector";
import { DrawingObjects } from "./drawing-objects";
import type { ChartPaneConfig } from "@/stores/multi-chart";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { useChartDocuments } from "@/stores/chart-documents";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useMarketContract } from "@/hooks/use-market-contract";
import { useTerminalAppearance } from "@/stores/terminal-appearance";
import { useCustomization } from "@/stores/customization";
import { defaultChartStyle } from "@/lib/customization";
import { createChartDocument, type DrawingObject } from "@/lib/chart/contracts";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";

/** Each secondary pane owns its document, selection, tool and history. */
export function SecondaryDrawingChart({ pane, indicators, timezone, captureActive }: {
  pane: ChartPaneConfig; settings: ChartSettings; indicators: ChartIndicators; timezone: ChartTimezone; captureActive: boolean;
}) {
  const appearance = useTerminalAppearance(state => state.appearance);
  const hydrated = useCustomization(state => state.hydrated);
  const defaults = useCustomization(state => state.preferences.chartDefaults);
  const workspaceId = useWorkspace(state => state.activeWorkspaceId);
  const { provider } = useMarketStream(pane.symbol, { trades: 1, depth: false });
  const contract = useMarketContract(pane.symbol, provider);
  const seed = useMemo(() => ({ workspaceId, chartId: pane.id, instrument: { provider: provider ?? "gateio" as const, exchange: contract.exchange, product: contract.product, nativeSymbol: contract.verified ? contract.symbol : pane.symbol }, timeframe: pane.timeframe, settings: defaultChartStyle(appearance, defaults) }), [appearance, defaults, workspaceId, pane.id, pane.symbol, pane.timeframe, provider, contract]);
  const fallback = useMemo(() => createChartDocument(seed), [seed]);
  const document = useChartDocuments(state => state.documents[fallback.id]) ?? fallback;
  const history = useChartDocuments(state => state.drawingHistory[fallback.id]);
  const [tool, setTool] = useState<DrawingTool>("crosshair"), [magnet, setMagnet] = useState<MagnetMode>("off");
  const [selection, select] = useState<string | null>(null), [persistent, setPersistent] = useState(false), [objects, setObjects] = useState(false);
  const clipboard = useRef<DrawingObject | null>(null);
  useEffect(() => { if (!contract.verified || !hydrated || !useTerminalAppearance.persist.hasHydrated()) return; useChartDocuments.getState().ensure(seed); useChartDocuments.getState().setTimeframe(fallback.id, pane.timeframe); select(null); setTool("crosshair"); }, [seed, fallback.id, pane.timeframe, contract.verified, hydrated]);
  const store = useChartDocuments.getState(), id = fallback.id;
  const selected = document.drawings.find(drawing => drawing.id === selection);
  const update = (drawingId: string, patch: Partial<DrawingObject>) => store.updateDrawing(id, drawingId, patch);
  const duplicate = (drawingId: string) => select(store.duplicateDrawing(id, drawingId));
  const remove = (drawingId: string) => { store.deleteDrawing(id, drawingId); select(null); };
  return <div className="zt-chart-stage relative h-full w-full" data-drawing-chart={pane.id} onKeyDown={event => {
    if (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true],.monaco-editor,[role=dialog]")) return;
    const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (modifier && key === "z") { event.preventDefault(); if (event.shiftKey) store.redoDrawings(id); else store.undoDrawings(id); }
    if (modifier && key === "c" && selected) { event.preventDefault(); clipboard.current = structuredClone(selected); }
    if (modifier && key === "v" && clipboard.current) { event.preventDefault(); select(store.pasteDrawing(id, clipboard.current)); }
    if ((key === "delete" || key === "backspace") && selected && !selected.locked) { event.preventDefault(); remove(selected.id); }
    if (key === "escape") { select(null); setTool("cursor"); }
  }}>
    <TerminalChart drawingScopeKey={id} captureActive={captureActive} symbol={pane.symbol} timeframe={pane.timeframe} chartType={pane.chartType} settings={document.settings} indicators={indicators} timezone={timezone} volumePaneHeight={.18}
      drawings={contract.verified ? document.drawings : []} drawingTool={tool} magnetMode={magnet} selectedDrawingId={selection} persistentDrawing={persistent}
      onDrawingTool={setTool} onSelectDrawing={select} onCreateDrawing={(type, anchors) => store.createDrawing(id, type, anchors)} onUpdateDrawing={update} onDeleteDrawing={remove} onDuplicateDrawing={duplicate} />
    <DrawingToolbar tool={tool} magnet={magnet} onTool={setTool} onMagnet={setMagnet} persistent={persistent} onPersistent={() => setPersistent(value => !value)} onUndo={() => store.undoDrawings(id)} onRedo={() => store.redoDrawings(id)} canUndo={Boolean(history?.past.length)} canRedo={Boolean(history?.future.length)} onObjects={() => setObjects(value => !value)} onClear={() => store.clearDrawings(id)} />
    {objects && <DrawingObjects drawings={contract.verified ? document.drawings : []} onSelect={select} onUpdate={update} onClose={() => setObjects(false)} />}
    {selected && <DrawingInspector key={selected.id} drawing={selected} onChange={patch => update(selected.id, patch)} onDuplicate={() => duplicate(selected.id)} onDelete={() => remove(selected.id)} onClose={() => select(null)} />}
  </div>;
}
