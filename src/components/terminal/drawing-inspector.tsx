"use client";

import { Copy, Eye, EyeOff, Lock, Trash2, Unlock, X } from "lucide-react";
import type { DrawingObject, DrawingStyle } from "@/lib/chart/contracts";

export function DrawingInspector({ drawing, onChange, onDuplicate, onDelete, onClose }: { drawing: DrawingObject; onChange: (patch: Partial<DrawingObject>) => void; onDuplicate: () => void; onDelete: () => void; onClose: () => void }) {
  const style = drawing.style;
  const updateStyle = (patch: Partial<DrawingStyle>) => onChange({ style: { ...style, ...patch } });
  return <aside className="zt-drawing-inspector" aria-label="Selected drawing settings">
    <header><strong>{drawing.type.replaceAll("-", " ")}</strong><button type="button" onClick={onClose} aria-label="Close drawing settings"><X /></button></header>
    <div className="zt-drawing-inspector-grid">
      <label>Color<input type="color" value={style.color} onChange={event => updateStyle({ color: event.target.value })} /></label><label>Width<select value={style.width} onChange={event => updateStyle({ width: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}px</option>)}</select></label>
      <label>Line style<select value={style.lineStyle} onChange={event => updateStyle({ lineStyle: event.target.value as DrawingStyle["lineStyle"] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
      <label>Opacity <span>{Math.round(style.opacity * 100)}%</span><input type="range" min={5} max={100} value={Math.round(style.opacity * 100)} onChange={event => updateStyle({ opacity: Number(event.target.value) / 100 })} /></label>
      {style.fill && <label>Fill<input type="color" value={style.fill} onChange={event => updateStyle({ fill: event.target.value })} /></label>}
      {style.text !== undefined && <><label>Text<input maxLength={500} value={style.text} onChange={event => updateStyle({ text: event.target.value })} /></label><label>Font size<select value={style.textSize ?? 12} onChange={event => updateStyle({ textSize: Number(event.target.value) })}>{[10, 12, 14, 16, 20, 24].map(value => <option key={value}>{value}</option>)}</select></label></>}
      {["trend-line", "ray", "extended-line", "horizontal-ray"].includes(drawing.type) && <><label><span><input type="checkbox" checked={style.extendStart === true} onChange={event => updateStyle({ extendStart: event.target.checked })} /> Extend left</span></label><label><span><input type="checkbox" checked={style.extendEnd === true} onChange={event => updateStyle({ extendEnd: event.target.checked })} /> Extend right</span></label></>}
    </div>
    <div className="zt-drawing-inspector-actions"><button type="button" onClick={() => onChange({ locked: !drawing.locked })}>{drawing.locked ? <Unlock /> : <Lock />}{drawing.locked ? "Unlock" : "Lock"}</button><button type="button" onClick={() => onChange({ hidden: !drawing.hidden })}>{drawing.hidden ? <Eye /> : <EyeOff />}{drawing.hidden ? "Show" : "Hide"}</button><button type="button" onClick={onDuplicate}><Copy />Duplicate</button><button type="button" className="is-danger" disabled={drawing.locked} onClick={onDelete}><Trash2 />Delete</button></div>
  </aside>;
}
