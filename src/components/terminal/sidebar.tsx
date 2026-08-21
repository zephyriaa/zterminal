"use client";

import {
  ArrowDownRight,
  Circle,
  Crosshair,
  Eraser,
  Lock,
  MousePointer2,
  MoveDiagonal,
  Minus,
  MoreHorizontal,
  Pencil,
  Square,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const DRAWING_TOOLS = [
  { label: "Cursor", icon: MousePointer2 },
  { label: "Crosshair", icon: Crosshair },
  { label: "Trend line", icon: TrendingLineIcon },
  { label: "Ray", icon: MoveDiagonal },
  { label: "Horizontal line", icon: Minus },
  { label: "Vertical line", icon: MoreHorizontal },
  { label: "Rectangle", icon: Square },
  { label: "Circle", icon: Circle },
  { label: "Arrow", icon: ArrowDownRight },
  { label: "Brush", icon: Pencil },
  { label: "Text", icon: Type },
];

export function Sidebar() {
  const [selected, setSelected] = useState("Cursor");
  const [locked, setLocked] = useState(false);

  const choose = (label: string) => {
    setSelected(label);
    window.dispatchEvent(new CustomEvent("zterminal:drawing-tool", { detail: label }));
  };

  return (
    <aside className="w-10 shrink-0 border-r hairline bg-panel flex flex-col items-center py-1.5 gap-0.5" aria-label="Chart drawing tools">
      <ToolButton label="Cursor" active={selected === "Cursor"} onClick={() => choose("Cursor")}><MousePointer2 /></ToolButton>
      <ToolButton label="Crosshair" active={selected === "Crosshair"} onClick={() => choose("Crosshair")}><Crosshair /></ToolButton>
      <div className="h-px w-5 bg-foreground/10 my-1" />
      {DRAWING_TOOLS.slice(2).map(({ label, icon: Icon }) => <ToolButton key={label} label={label} active={selected === label} onClick={() => choose(label)}><Icon /></ToolButton>)}
      <div className="mt-auto flex flex-col items-center gap-0.5">
        <div className="h-px w-5 bg-foreground/10 my-1" />
        <ToolButton label="Remove drawings" onClick={() => window.dispatchEvent(new CustomEvent("zterminal:clear-drawings"))}><Eraser /></ToolButton>
        <ToolButton label={locked ? "Unlock drawings" : "Lock drawings"} active={locked} onClick={() => setLocked((value) => !value)}><Lock /></ToolButton>
        <ToolButton label="Undo drawing" onClick={() => window.dispatchEvent(new CustomEvent("zterminal:undo-drawing"))}><Undo2 /></ToolButton>
      </div>
    </aside>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={cn("grid place-items-center h-7 w-7 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-hover transition-colors", active && "bg-hover text-mdata")}>{children}</button>;
}

function TrendingLineIcon({ className }: { className?: string }) {
  return <svg className={className ?? "h-3.5 w-3.5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18 9 12l3 3 8-9" /><path d="M16 6h4v4" /></svg>;
}

export { Trash2, TextCursorInput, Waves };
