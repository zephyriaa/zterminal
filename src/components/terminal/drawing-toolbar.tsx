"use client";

import * as React from "react";
import {
  ArrowDownRight, Baseline, CaseSensitive, ChevronLeft, ChevronRight,
  Crosshair, Eraser, Gauge, GitBranch, MousePointer2, MoveHorizontal, MoveVertical,
  PenLine, RectangleHorizontal, Ruler, Tag, TrendingDown, TrendingUp, WandSparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";

const TOOLS: { tool: DrawingTool; label: string; icon: typeof MousePointer2; group?: boolean }[] = [
  { tool: "cursor", label: "Cursor / select", icon: MousePointer2 },
  { tool: "crosshair", label: "Crosshair / pan", icon: Crosshair },
  { tool: "eraser", label: "Eraser", icon: Eraser, group: true },
  { tool: "trend-line", label: "Trend line", icon: PenLine },
  { tool: "ray", label: "Ray", icon: TrendingUp },
  { tool: "extended-line", label: "Extended line", icon: Baseline },
  { tool: "horizontal-line", label: "Horizontal line", icon: MoveHorizontal, group: true },
  { tool: "horizontal-ray", label: "Horizontal ray", icon: ArrowDownRight },
  { tool: "vertical-line", label: "Vertical line", icon: MoveVertical },
  { tool: "rectangle", label: "Rectangle", icon: RectangleHorizontal, group: true },
  { tool: "arrow", label: "Arrow", icon: ArrowDownRight },
  { tool: "text", label: "Text", icon: CaseSensitive },
  { tool: "price-label", label: "Price label", icon: Tag },
  { tool: "ruler", label: "Ruler", icon: Ruler, group: true },
  { tool: "price-range", label: "Price range", icon: Gauge },
  { tool: "date-range", label: "Date range", icon: MoveHorizontal },
  { tool: "long-position", label: "Long position", icon: TrendingUp, group: true },
  { tool: "short-position", label: "Short position", icon: TrendingDown },
  { tool: "fibonacci-retracement", label: "Fibonacci retracement", icon: GitBranch, group: true },
];

export function DrawingToolbar({ tool, magnet, onTool, onMagnet }: { tool: DrawingTool; magnet: MagnetMode; onTool: (tool: DrawingTool) => void; onMagnet: (mode: MagnetMode) => void }) {
  const [collapsed, setCollapsed] = React.useState(false);
  if (collapsed) return <button type="button" className="zt-drawing-toolbar-expand" onClick={() => setCollapsed(false)} aria-label="Expand drawing toolbar"><ChevronRight /></button>;
  const cycleMagnet = () => onMagnet(magnet === "off" ? "weak" : magnet === "weak" ? "strong" : "off");
  return <div className="zt-drawing-toolbar" role="toolbar" aria-label="Chart drawing tools" aria-orientation="vertical">
    <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse drawing toolbar"><ChevronLeft /></button></TooltipTrigger><TooltipContent side="right">Collapse drawing toolbar</TooltipContent></Tooltip>
    {TOOLS.map(({ tool: value, label, icon: Icon, group }) => <Tooltip key={value}><TooltipTrigger asChild><button type="button" className={cn(group && "is-group-start", tool === value && "is-active")} aria-pressed={tool === value} aria-label={label} onClick={() => onTool(value)}><Icon /></button></TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>)}
    <Tooltip><TooltipTrigger asChild><button type="button" className={cn("is-group-start", magnet !== "off" && "is-active")} onClick={cycleMagnet} aria-label={`Magnet ${magnet}. Change snap mode`}><WandSparkles /><small>{magnet === "off" ? "0" : magnet === "weak" ? "1" : "2"}</small></button></TooltipTrigger><TooltipContent side="right">Magnet: {magnet}</TooltipContent></Tooltip>
  </div>;
}
