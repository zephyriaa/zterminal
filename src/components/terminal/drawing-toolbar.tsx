"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownRight, Baseline, CaseSensitive, ChevronLeft, ChevronRight,
  Crosshair, Eraser, Gauge, GitBranch, MousePointer2, MoveHorizontal, MoveVertical,
  PenLine, RectangleHorizontal, Ruler, Tag, Trash2, TrendingDown, TrendingUp, WandSparkles,
  Circle, MessageSquare, Route, Repeat2, Undo2, Redo2, List,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DrawingTool, MagnetMode } from "@/lib/chart/drawings/contracts";

type ToolItem = {
  tool: DrawingTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
};

type ToolGroup = {
  id: string;
  label: string;
  defaultTool: DrawingTool;
  tools: ToolItem[];
};

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "cursor",
    label: "Cursor Tools",
    defaultTool: "crosshair",
    tools: [
      { tool: "crosshair", label: "Crosshair", icon: Crosshair },
      { tool: "cursor", label: "Arrow / Select", icon: MousePointer2 },
      { tool: "eraser", label: "Eraser", icon: Eraser },
    ],
  },
  {
    id: "lines",
    label: "Trend Lines",
    defaultTool: "trend-line",
    tools: [
      { tool: "trend-line", label: "Trend Line", icon: PenLine },
      { tool: "ray", label: "Ray", icon: TrendingUp },
      { tool: "extended-line", label: "Extended Line", icon: Baseline },
      { tool: "horizontal-line", label: "Horizontal Line", icon: MoveHorizontal },
      { tool: "horizontal-ray", label: "Horizontal Ray", icon: ArrowDownRight },
      { tool: "vertical-line", label: "Vertical Line", icon: MoveVertical },
      { tool: "cross-line", label: "Cross Line", icon: Crosshair },
      { tool: "parallel-channel", label: "Parallel Channel", icon: MoveHorizontal },
    ],
  },
  {
    id: "fib",
    label: "Gann & Fibonacci",
    defaultTool: "fibonacci-retracement",
    tools: [
      { tool: "fibonacci-retracement", label: "Fibonacci Retracement", icon: GitBranch },
      { tool: "fibonacci-extension", label: "Fibonacci Extension", icon: GitBranch },
    ],
  },
  {
    id: "shapes",
    label: "Geometric Shapes",
    defaultTool: "rectangle",
    tools: [
      { tool: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
      { tool: "ellipse", label: "Ellipse", icon: Circle },
      { tool: "polyline", label: "Path / Polyline", icon: Route },
      { tool: "arrow", label: "Arrow Marker", icon: ArrowDownRight },
    ],
  },
  {
    id: "annotations",
    label: "Annotation Tools",
    defaultTool: "text",
    tools: [
      { tool: "text", label: "Text", icon: CaseSensitive },
      { tool: "price-label", label: "Price Label", icon: Tag },
      { tool: "callout", label: "Callout / Note", icon: MessageSquare },
    ],
  },
  {
    id: "prediction",
    label: "Prediction and Measurement",
    defaultTool: "long-position",
    tools: [
      { tool: "long-position", label: "Long Position", icon: TrendingUp, accent: "text-emerald-400" },
      { tool: "short-position", label: "Short Position", icon: TrendingDown, accent: "text-rose-400" },
      { tool: "price-range", label: "Price Range", icon: Gauge },
      { tool: "date-range", label: "Date Range", icon: MoveHorizontal },
      { tool: "ruler", label: "Ruler", icon: Ruler },
    ],
  },
];

export function DrawingToolbar({
  tool,
  magnet,
  onTool,
  onMagnet,
  onClear,
  persistent, onPersistent, onUndo, onRedo, canUndo, canRedo, onObjects,
}: {
  tool: DrawingTool;
  magnet: MagnetMode;
  onTool: (tool: DrawingTool) => void;
  onMagnet: (mode: MagnetMode) => void;
  onClear?: () => void;
  persistent?: boolean; onPersistent?: () => void;
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean;
  onObjects?: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [activeGroupFlyout, setActiveGroupFlyout] = React.useState<string | null>(null);
  const [flyoutPosition, setFlyoutPosition] = React.useState({ left: 0, top: 0 });
  const [activeToolPerGroup, setActiveToolPerGroup] = React.useState<Record<string, DrawingTool>>({
    cursor: "crosshair",
    lines: "trend-line",
    fib: "fibonacci-retracement",
    shapes: "rectangle",
    annotations: "text",
    prediction: "long-position",
  });

  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const flyoutRef = React.useRef<HTMLDivElement>(null);
  const groupButtonsRef = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const openFlyout = (id: string) => {
    const bounds = groupButtonsRef.current[id]?.getBoundingClientRect();
    const count = TOOL_GROUPS.find(group => group.id === id)?.tools.length ?? 0;
    setFlyoutPosition({ left: Math.max(8, Math.min((bounds?.right ?? 0) + 7, window.innerWidth - 220)), top: Math.max(8, Math.min(bounds?.top ?? 0, window.innerHeight - (count * 32 + 40))) });
    setActiveGroupFlyout(activeGroupFlyout === id ? null : id);
  };

  React.useEffect(() => {
    if (!activeGroupFlyout || TOOL_GROUPS.find(group => group.id === activeGroupFlyout)?.tools.length === 1) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // A dialog opened over this menu owns Escape while its controls have focus.
      if (event.target !== document.body && event.target instanceof Node && !toolbarRef.current?.contains(event.target) && !flyoutRef.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      setActiveGroupFlyout(null);
      groupButtonsRef.current[activeGroupFlyout]?.focus();
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [activeGroupFlyout]);

  // Click outside listener for flyout
  React.useEffect(() => {
    const onPointerDownOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node) && !flyoutRef.current?.contains(e.target as Node)) {
        setActiveGroupFlyout(null);
      }
    };
    window.addEventListener("mousedown", onPointerDownOutside);
    return () => window.removeEventListener("mousedown", onPointerDownOutside);
  }, []);

  if (collapsed) {
    return (
      <button
        type="button"
        className="zt-drawing-toolbar-expand"
        onClick={() => setCollapsed(false)}
        aria-label="Expand drawing toolbar"
        title="Expand drawing toolbar"
      >
        <ChevronRight />
      </button>
    );
  }

  const cycleMagnet = () => onMagnet(magnet === "off" ? "weak" : magnet === "weak" ? "strong" : "off");

  return (
    <div
      ref={toolbarRef}
      className="zt-drawing-toolbar"
      role="toolbar"
      aria-label="Chart drawing tools"
      aria-orientation="vertical"
    >
      {/* Collapse button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="zt-toolbar-collapse-btn"
            onClick={() => { setActiveGroupFlyout(null); setCollapsed(true); }}
            aria-label="Collapse drawing toolbar"
          >
            <ChevronLeft />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Collapse toolbar</TooltipContent>
      </Tooltip>

      {/* Tool Groups */}
      {TOOL_GROUPS.map(group => {
        const belongsToGroup = group.tools.some(t => t.tool === tool);
        const currentToolValue = belongsToGroup ? tool : (activeToolPerGroup[group.id] ?? group.defaultTool);
        const currentToolObj = group.tools.find(t => t.tool === currentToolValue) ?? group.tools[0];
        const isCurrentActive = tool === currentToolValue;
        const isFlyoutOpen = activeGroupFlyout === group.id;
        const CurrentIcon = currentToolObj.icon;

        return (
          <div key={group.id} className="zt-tool-group-wrapper">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  ref={element => { groupButtonsRef.current[group.id] = element; }}
                  className={cn(
                    "zt-tool-group-btn",
                    isCurrentActive && "is-active",
                    isFlyoutOpen && "is-flyout-open",
                    group.id === "prediction" && "is-prediction-group"
                  )}
                  aria-pressed={isCurrentActive}
                  aria-label={currentToolObj.label}
                  onClick={() => {
                    onTool(currentToolValue);
                    setActiveGroupFlyout(null);
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    openFlyout(group.id);
                  }}
                >
                  <CurrentIcon className={currentToolObj.accent} />
                  {group.tools.length > 1 && (
                    <span
                      className="zt-group-caret"
                      onClick={e => {
                        e.stopPropagation();
                        openFlyout(group.id);
                      }}
                      title="More tools"
                    >
                      ›
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{currentToolObj.label} (Right-click or click arrow for options)</TooltipContent>
            </Tooltip>

            {/* Flyout Submenu */}
            {isFlyoutOpen && group.tools.length > 1 && (
              createPortal(<div ref={flyoutRef} className="zt-drawing-flyout" role="menu" aria-label={group.label} style={{ position: "fixed", zIndex: 100, ...flyoutPosition, maxHeight: "calc(100vh - 16px)", overflowY: "auto" }}>
                <div className="zt-drawing-flyout-header">{group.label}</div>
                {group.tools.map(item => {
                  const ItemIcon = item.icon;
                  const isSelected = tool === item.tool;
                  return (
                    <button
                      key={item.tool}
                      type="button"
                      role="menuitem"
                      className={cn("zt-flyout-item", isSelected && "is-selected")}
                      onClick={() => {
                        setActiveToolPerGroup(prev => ({ ...prev, [group.id]: item.tool }));
                        onTool(item.tool);
                        setActiveGroupFlyout(null);
                      }}
                    >
                      <ItemIcon className={item.accent} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>, document.body)
            )}
          </div>
        );
      })}

      <div className="zt-toolbar-separator" />
      {onPersistent && <button type="button" className={cn("zt-tool-btn", persistent && "is-active")} aria-label="Keep drawing tool active" aria-pressed={persistent} onClick={onPersistent} title="Keep tool active"><Repeat2 /></button>}
      {onUndo && <button type="button" className="zt-tool-btn" aria-label="Undo drawing" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl/Cmd+Z)"><Undo2 /></button>}
      {onRedo && <button type="button" className="zt-tool-btn" aria-label="Redo drawing" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 /></button>}
      {onObjects && <button type="button" className="zt-tool-btn" aria-label="Drawing objects" onClick={onObjects} title="Drawing objects · show hidden drawings"><List /></button>}

      {/* Magnet Mode */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn("zt-tool-btn", magnet !== "off" && "is-active")}
            onClick={cycleMagnet}
            aria-label={`Magnet ${magnet}. Change snap mode`}
          >
            <WandSparkles />
            <small>{magnet === "off" ? "0" : magnet === "weak" ? "1" : "2"}</small>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Magnet Snap: {magnet} (0: Off, 1: Weak, 2: Strong)</TooltipContent>
      </Tooltip>

      {/* Clear all drawings */}
      {onClear && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="zt-tool-btn is-danger-hover"
              onClick={onClear}
              aria-label="Clear all drawings on chart"
            >
              <Trash2 />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Clear All Drawings</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
