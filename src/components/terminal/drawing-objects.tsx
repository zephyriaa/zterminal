"use client";
import type { DrawingObject } from "@/lib/chart/contracts";
import { DRAWING_LABELS } from "@/lib/chart/drawings/contracts";

export function DrawingObjects({ drawings, onSelect, onUpdate, onClose }: {
  drawings: DrawingObject[]; onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DrawingObject>) => void; onClose: () => void;
}) {
  return <aside className="zt-drawing-object-list" aria-label="Drawing objects">
    <header><b>Drawing objects</b><button type="button" onClick={onClose} aria-label="Close drawing objects">×</button></header>
    {drawings.length === 0 && <p>No drawings on this chart.</p>}
    {[...drawings].sort((a, b) => b.zOrder - a.zOrder).map(drawing => <div key={drawing.id} data-drawing-id={drawing.id}>
      <button type="button" onClick={() => onSelect(drawing.id)}>{DRAWING_LABELS[drawing.type]}</button>
      <button type="button" aria-label={`${drawing.hidden ? "Show" : "Hide"} ${DRAWING_LABELS[drawing.type]}`} onClick={() => onUpdate(drawing.id, { hidden: !drawing.hidden })}>{drawing.hidden ? "Show" : "Hide"}</button>
      <button type="button" aria-label={`${drawing.locked ? "Unlock" : "Lock"} ${DRAWING_LABELS[drawing.type]}`} onClick={() => onUpdate(drawing.id, { locked: !drawing.locked })}>{drawing.locked ? "Unlock" : "Lock"}</button>
    </div>)}
  </aside>;
}
