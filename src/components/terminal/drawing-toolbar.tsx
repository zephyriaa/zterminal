"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownRight, Baseline, CaseSensitive, ChevronLeft, ChevronRight,
  Crosshair, Eraser, Gauge, GitBranch, MousePointer2, MoveHorizontal, MoveVertical,
  PenLine, RectangleHorizontal, Ruler, Tag, Trash2, TrendingDown, TrendingUp, WandSparkles,
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
    ],
  },
  {
    id: "fib",
    label: "Gann & Fibonacci",
    defaultTool: "fibonacci-retracement",
    tools: [
      { tool: "fibonacci-retracement", label: "Fibonacci Retracement", icon: GitBranch },
    ],
  },
  {
    id: "shapes",
    label: "Geometric Shapes",
    defaultTool: "rectangle",
    tools: [
      { tool: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
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
}: {
  tool: DrawingTool;
  magnet: MagnetMode;
  onTool: (tool: DrawingTool) => void;
  onMagnet: (mode: MagnetMode) => void;
  onClear?: () => void;
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
  const flyoutTriggerRef = React.useRef<HTMLElement | null>(null);
  const closeFlyout = () => { setActiveGroupFlyout(null); flyoutTriggerRef.current?.focus(); };
  const toggleFlyout = (group: ToolGroup, element: HTMLElement) => {
    if (activeGroupFlyout === group.id) { closeFlyout(); return; }
    flyoutTriggerRef.current = element;
    const rect = element.getBoundingClientRect();
    setFlyoutPosition({ left: Math.max(8, Math.min(rect.right + 6, window.innerWidth - 220)), top: Math.max(8, Math.min(rect.top, window.innerHeight - (group.tools.length * 32 + 45))) });
    setActiveGroupFlyout(group.id);
  };
  React.useEffect(() => {
    if (activeGroupFlyout) flyoutRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [activeGroupFlyout]);

  // Click outside listener for flyout
  React.useEffect(() => {
    const onPointerDownOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node) && !flyoutRef.current?.contains(e.target as Node)) {
        setActiveGroupFlyout(null);
      }
    };
    window.addEventListener("mousedown", onPointerDownOutside);
    const dismiss = () => setActiveGroupFlyout(null);
    window.addEventListener("resize", dismiss);
    return () => { window.removeEventListener("mousedown", onPointerDownOutside); window.removeEventListener("resize", dismiss); };
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
            onClick={() => { setCollapsed(true); setActiveGroupFlyout(null); }}
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
                    toggleFlyout(group, e.currentTarget);
                  }}
                >
                  <CurrentIcon className={currentToolObj.accent} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{currentToolObj.label} (Right-click or click arrow for options)</TooltipContent>
            </Tooltip>
            {group.tools.length > 1 && <button type="button" className="zt-group-caret" aria-label={`More ${group.label}`} aria-haspopup="menu" aria-expanded={isFlyoutOpen} onClick={event => toggleFlyout(group, event.currentTarget)}>›</button>}

            {/* Flyout Submenu */}
            {isFlyoutOpen && group.tools.length > 1 && createPortal(
              <div ref={flyoutRef} className="zt-drawing-flyout" role="menu" aria-label={group.label} style={{ position: "fixed", ...flyoutPosition, zIndex: 100 }} onKeyDown={event => {
                if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeFlyout(); return; }
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                  event.preventDefault(); event.stopPropagation();
                  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                  const index = items.indexOf(document.activeElement as HTMLElement);
                  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                  items[next]?.focus();
                }
              }}>
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
                        closeFlyout();
                      }}
                    >
                      <ItemIcon className={item.accent} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>, document.body
            )}
          </div>
        );
      })}

      <div className="zt-toolbar-separator" />

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
