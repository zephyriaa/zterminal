"use client";

import * as React from "react";
import {
  Copy, Eye, EyeOff, GripVertical, Lock, Palette, Settings2,
  Trash2, TrendingDown, TrendingUp, Unlock, X,
} from "lucide-react";
import type { DrawingObject, DrawingStyle } from "@/lib/chart/contracts";
import { cn } from "@/lib/utils";

const PRESET_TARGET_COLORS = [
  "#22c55e", // TradingView green
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#e2e8f0", // Light
];

const PRESET_STOP_COLORS = [
  "#ef4444", // TradingView red
  "#f43f5e", // Rose
  "#e11d48", // Crimson
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#991b1b", // Deep Red
  "#64748b", // Slate
];

const PRESET_LINE_COLORS = [
  "#38bdf8", // Sky blue
  "#818cf8", // Indigo
  "#a78bfa", // Violet
  "#34d399", // Mint
  "#fbbf24", // Yellow
  "#f87171", // Coral
  "#ffffff", // White
];

function ColorSwatchPopover({
  label,
  color,
  presets,
  onChange,
  onClose,
}: {
  label: string;
  color: string;
  presets: string[];
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="zt-swatch-popover" role="dialog" aria-label={`${label} color picker`}>
      <div className="zt-swatch-popover-header">
        <span>{label}</span>
        <button type="button" onClick={onClose} aria-label="Close color palette"><X /></button>
      </div>
      <div className="zt-swatch-popover-grid">
        {presets.map(hex => (
          <button
            key={hex}
            type="button"
            className={cn("zt-swatch-btn", color.toLowerCase() === hex.toLowerCase() && "is-selected")}
            style={{ backgroundColor: hex }}
            title={hex}
            onClick={() => { onChange(hex); onClose(); }}
          />
        ))}
      </div>
      <div className="zt-swatch-popover-custom">
        <label>
          <Palette />
          <span>Custom:</span>
          <input
            type="color"
            value={color.startsWith("#") && color.length === 7 ? color : "#22c55e"}
            onChange={e => onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

export function DrawingInspector({
  drawing,
  onChange,
  onDuplicate,
  onDelete,
  onClose,
}: {
  drawing: DrawingObject;
  onChange: (patch: Partial<DrawingObject>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [expandedSettings, setExpandedSettings] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"style" | "inputs">("style");
  const [activePopover, setActivePopover] = React.useState<"target" | "stop" | "line" | "fill" | null>(null);

  const draggingRef = React.useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const style = drawing.style;
  const isPositionTool = drawing.type === "long-position" || drawing.type === "short-position";
  const isLong = drawing.type === "long-position";

  const updateStyle = (patch: Partial<DrawingStyle>) => {
    onChange({ style: { ...style, ...patch } });
  };

  const onGripPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const currentX = pos?.x ?? 0;
    const currentY = pos?.y ?? 0;
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: currentX,
      initY: currentY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onGripPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setPos({
      x: draggingRef.current.initX + dx,
      y: draggingRef.current.initY + dy,
    });
  };

  const onGripPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Prices for numerical inputs
  const entryPrice = drawing.anchors[0]?.price ?? 0;
  const targetPrice = drawing.anchors[1]?.price ?? entryPrice;
  const currentRR = style.riskReward && style.riskReward > 0 ? style.riskReward : 2.0;

  let calculatedStop = style.stopPrice;
  if (calculatedStop == null || !Number.isFinite(calculatedStop)) {
    const delta = Math.abs(targetPrice - entryPrice);
    calculatedStop = isLong
      ? (targetPrice >= entryPrice ? entryPrice - delta / currentRR : entryPrice + delta / currentRR)
      : (targetPrice <= entryPrice ? entryPrice + delta / currentRR : entryPrice - delta / currentRR);
  }

  const setRiskReward = (rr: number) => {
    const delta = Math.abs(targetPrice - entryPrice);
    const newStop = isLong
      ? (targetPrice >= entryPrice ? entryPrice - delta / rr : entryPrice + delta / rr)
      : (targetPrice <= entryPrice ? entryPrice + delta / rr : entryPrice - delta / rr);
    updateStyle({ riskReward: rr, stopPrice: Number(newStop.toFixed(4)) });
  };

  const setStopPrice = (stop: number) => {
    const targetDelta = Math.abs(targetPrice - entryPrice);
    const stopDelta = Math.abs(entryPrice - stop);
    const rr = stopDelta > 0 ? Number((targetDelta / stopDelta).toFixed(2)) : currentRR;
    updateStyle({ stopPrice: stop, riskReward: rr });
  };

  const setTargetPrice = (target: number) => {
    const newAnchors = [
      drawing.anchors[0],
      { ...drawing.anchors[1], price: target },
    ];
    const targetDelta = Math.abs(target - entryPrice);
    const stopDelta = Math.abs(entryPrice - calculatedStop);
    const rr = stopDelta > 0 ? Number((targetDelta / stopDelta).toFixed(2)) : currentRR;
    onChange({ anchors: newAnchors, style: { ...style, riskReward: rr } });
  };

  const setEntryPrice = (entry: number) => {
    const deltaT = targetPrice - entryPrice;
    const newAnchors = [
      { ...drawing.anchors[0], price: entry },
      { ...drawing.anchors[1], price: entry + deltaT },
    ];
    onChange({ anchors: newAnchors });
  };

  const transformStyle = pos
    ? { transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)` }
    : undefined;

  return (
    <div
      className="zt-floating-drawing-widget"
      style={transformStyle}
      role="toolbar"
      aria-label="Floating drawing settings bar"
    >
      {/* 1. Quick Floating Bar */}
      <div className="zt-floating-bar">
        {/* Drag grip handle */}
        <div
          className="zt-floating-grip"
          title="Drag to move (double click to center)"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onDoubleClick={() => setPos(null)}
        >
          <GripVertical />
        </div>

        {/* Tool indicator */}
        <div className="zt-floating-title" title={drawing.type}>
          {isPositionTool ? (
            isLong ? <TrendingUp className="text-emerald-400" /> : <TrendingDown className="text-rose-400" />
          ) : null}
          <span>{drawing.type.replaceAll("-", " ")}</span>
        </div>

        <div className="zt-floating-divider" />

        {/* Long / Short Position Quick Controls */}
        {isPositionTool ? (
          <div className="zt-floating-quick-swatches">
            {/* Target Color Swatch */}
            <div className="zt-swatch-wrapper">
              <button
                type="button"
                className="zt-swatch-pill is-target"
                style={{ "--swatch-color": style.targetColor ?? "#22c55e" } as React.CSSProperties}
                title="Profit / Target Color"
                onClick={() => setActivePopover(activePopover === "target" ? null : "target")}
              >
                <span className="zt-swatch-dot" />
                <small>TP</small>
              </button>
              {activePopover === "target" && (
                <ColorSwatchPopover
                  label="Target Color"
                  color={style.targetColor ?? "#22c55e"}
                  presets={PRESET_TARGET_COLORS}
                  onChange={hex => updateStyle({ targetColor: hex, targetFill: hex })}
                  onClose={() => setActivePopover(null)}
                />
              )}
            </div>

            {/* Stop Color Swatch */}
            <div className="zt-swatch-wrapper">
              <button
                type="button"
                className="zt-swatch-pill is-stop"
                style={{ "--swatch-color": style.stopColor ?? "#ef4444" } as React.CSSProperties}
                title="Stop / Loss Color"
                onClick={() => setActivePopover(activePopover === "stop" ? null : "stop")}
              >
                <span className="zt-swatch-dot" />
                <small>SL</small>
              </button>
              {activePopover === "stop" && (
                <ColorSwatchPopover
                  label="Stop Color"
                  color={style.stopColor ?? "#ef4444"}
                  presets={PRESET_STOP_COLORS}
                  onChange={hex => updateStyle({ stopColor: hex, stopFill: hex })}
                  onClose={() => setActivePopover(null)}
                />
              )}
            </div>

            {/* Entry Line Color Swatch */}
            <div className="zt-swatch-wrapper">
              <button
                type="button"
                className="zt-swatch-pill is-entry"
                style={{ "--swatch-color": style.color ?? "#38bdf8" } as React.CSSProperties}
                title="Entry Line Color"
                onClick={() => setActivePopover(activePopover === "line" ? null : "line")}
              >
                <span className="zt-swatch-dot" />
                <small>Entry</small>
              </button>
              {activePopover === "line" && (
                <ColorSwatchPopover
                  label="Entry Line Color"
                  color={style.color ?? "#38bdf8"}
                  presets={PRESET_LINE_COLORS}
                  onChange={hex => updateStyle({ color: hex })}
                  onClose={() => setActivePopover(null)}
                />
              )}
            </div>

            {/* Quick R:R Presets */}
            <div className="zt-floating-rr-group" title="Quick Risk/Reward Ratio">
              {[1, 1.5, 2, 3].map(rrVal => (
                <button
                  key={rrVal}
                  type="button"
                  className={cn("zt-rr-btn", Math.abs(currentRR - rrVal) < 0.05 && "is-active")}
                  onClick={() => setRiskReward(rrVal)}
                >
                  1:{rrVal}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Other Drawing Quick Swatches */
          <div className="zt-floating-quick-swatches">
            <div className="zt-swatch-wrapper">
              <button
                type="button"
                className="zt-swatch-pill"
                style={{ "--swatch-color": style.color } as React.CSSProperties}
                title="Drawing Line Color"
                onClick={() => setActivePopover(activePopover === "line" ? null : "line")}
              >
                <span className="zt-swatch-dot" />
                <small>Color</small>
              </button>
              {activePopover === "line" && (
                <ColorSwatchPopover
                  label="Line Color"
                  color={style.color}
                  presets={PRESET_LINE_COLORS}
                  onChange={hex => updateStyle({ color: hex })}
                  onClose={() => setActivePopover(null)}
                />
              )}
            </div>

            {style.fill !== undefined && (
              <div className="zt-swatch-wrapper">
                <button
                  type="button"
                  className="zt-swatch-pill"
                  style={{ "--swatch-color": style.fill } as React.CSSProperties}
                  title="Fill Color"
                  onClick={() => setActivePopover(activePopover === "fill" ? null : "fill")}
                >
                  <span className="zt-swatch-dot" />
                  <small>Fill</small>
                </button>
                {activePopover === "fill" && (
                  <ColorSwatchPopover
                    label="Fill Color"
                    color={style.fill}
                    presets={PRESET_TARGET_COLORS}
                    onChange={hex => updateStyle({ fill: hex })}
                    onClose={() => setActivePopover(null)}
                  />
                )}
              </div>
            )}

            {/* Line Width */}
            <select
              className="zt-quick-select"
              value={style.width}
              onChange={e => updateStyle({ width: Number(e.target.value) })}
              title="Line Width"
            >
              {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w}px</option>)}
            </select>
          </div>
        )}

        <div className="zt-floating-divider" />

        {/* Expand Settings Tab button */}
        <button
          type="button"
          className={cn("zt-floating-btn", expandedSettings && "is-active")}
          title="Open Settings Tab"
          onClick={() => setExpandedSettings(val => !val)}
        >
          <Settings2 />
        </button>

        {/* Lock toggle */}
        <button
          type="button"
          className={cn("zt-floating-btn", drawing.locked && "is-active")}
          title={drawing.locked ? "Unlock Drawing" : "Lock Drawing"}
          onClick={() => onChange({ locked: !drawing.locked })}
        >
          {drawing.locked ? <Lock className="text-amber-400" /> : <Unlock />}
        </button>

        {/* Hide toggle */}
        <button
          type="button"
          className="zt-floating-btn"
          title={drawing.hidden ? "Show Drawing" : "Hide Drawing"}
          onClick={() => onChange({ hidden: !drawing.hidden })}
        >
          {drawing.hidden ? <EyeOff /> : <Eye />}
        </button>

        {/* Duplicate */}
        <button
          type="button"
          className="zt-floating-btn"
          title="Duplicate Drawing"
          onClick={onDuplicate}
        >
          <Copy />
        </button>

        {/* Delete */}
        <button
          type="button"
          className="zt-floating-btn is-danger"
          disabled={drawing.locked}
          title="Delete Drawing (Delete / Backspace)"
          onClick={onDelete}
        >
          <Trash2 />
        </button>

        <div className="zt-floating-divider" />

        {/* Close Button */}
        <button
          type="button"
          className="zt-floating-btn zt-floating-close"
          title="Close Settings Tab (Esc)"
          onClick={onClose}
        >
          <X />
        </button>
      </div>

      {/* 2. Expandable Floating Settings Tab */}
      {expandedSettings && (
        <aside className="zt-floating-settings-card" role="dialog" aria-label="Detailed drawing settings">
          <header className="zt-floating-settings-card-header">
            <div className="zt-floating-tabs">
              <button
                type="button"
                className={cn(activeTab === "style" && "is-active")}
                onClick={() => setActiveTab("style")}
              >
                Style
              </button>
              <button
                type="button"
                className={cn(activeTab === "inputs" && "is-active")}
                onClick={() => setActiveTab("inputs")}
              >
                Coordinates & Inputs
              </button>
            </div>
            <button
              type="button"
              className="zt-floating-btn"
              onClick={() => setExpandedSettings(false)}
              aria-label="Collapse settings tab"
            >
              <X />
            </button>
          </header>

          <div className="zt-floating-settings-card-body">
            {activeTab === "style" ? (
              isPositionTool ? (
                <div className="zt-settings-form-grid">
                  <div className="zt-settings-section-title">Target (Profit) Area</div>
                  <label>
                    Target Line Color
                    <input
                      type="color"
                      value={style.targetColor ?? "#22c55e"}
                      onChange={e => updateStyle({ targetColor: e.target.value })}
                    />
                  </label>
                  <label>
                    Target Fill Color
                    <input
                      type="color"
                      value={style.targetFill ?? "#22c55e"}
                      onChange={e => updateStyle({ targetFill: e.target.value })}
                    />
                  </label>

                  <div className="zt-settings-section-title">Stop (Loss) Area</div>
                  <label>
                    Stop Line Color
                    <input
                      type="color"
                      value={style.stopColor ?? "#ef4444"}
                      onChange={e => updateStyle({ stopColor: e.target.value })}
                    />
                  </label>
                  <label>
                    Stop Fill Color
                    <input
                      type="color"
                      value={style.stopFill ?? "#ef4444"}
                      onChange={e => updateStyle({ stopFill: e.target.value })}
                    />
                  </label>

                  <div className="zt-settings-section-title">Entry & Boundaries</div>
                  <label>
                    Entry Line Color
                    <input
                      type="color"
                      value={style.color ?? "#38bdf8"}
                      onChange={e => updateStyle({ color: e.target.value })}
                    />
                  </label>
                  <label>
                    Line Width
                    <select
                      value={style.width}
                      onChange={e => updateStyle({ width: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w}px</option>)}
                    </select>
                  </label>
                  <label>
                    Line Style
                    <select
                      value={style.lineStyle}
                      onChange={e => updateStyle({ lineStyle: e.target.value as DrawingStyle["lineStyle"] })}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </label>
                  <label>
                    Fill Opacity <span>{Math.round(style.opacity * 100)}%</span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(style.opacity * 100)}
                      onChange={e => updateStyle({ opacity: Number(e.target.value) / 100 })}
                    />
                  </label>
                </div>
              ) : (
                /* Standard Drawing Style Form */
                <div className="zt-settings-form-grid">
                  <label>
                    Color
                    <input
                      type="color"
                      value={style.color}
                      onChange={e => updateStyle({ color: e.target.value })}
                    />
                  </label>
                  <label>
                    Width
                    <select
                      value={style.width}
                      onChange={e => updateStyle({ width: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w}px</option>)}
                    </select>
                  </label>
                  <label>
                    Line Style
                    <select
                      value={style.lineStyle}
                      onChange={e => updateStyle({ lineStyle: e.target.value as DrawingStyle["lineStyle"] })}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </label>
                  <label>
                    Opacity <span>{Math.round(style.opacity * 100)}%</span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(style.opacity * 100)}
                      onChange={e => updateStyle({ opacity: Number(e.target.value) / 100 })}
                    />
                  </label>
                  {style.fill !== undefined && (
                    <label>
                      Fill
                      <input
                        type="color"
                        value={style.fill}
                        onChange={e => updateStyle({ fill: e.target.value })}
                      />
                    </label>
                  )}
                  {style.text !== undefined && (
                    <>
                      <label style={{ gridColumn: "span 2" }}>
                        Text Label
                        <input
                          maxLength={500}
                          value={style.text}
                          onChange={e => updateStyle({ text: e.target.value })}
                        />
                      </label>
                      <label>
                        Font Size
                        <select
                          value={style.textSize ?? 12}
                          onChange={e => updateStyle({ textSize: Number(e.target.value) })}
                        >
                          {[10, 12, 14, 16, 20, 24].map(size => <option key={size}>{size}</option>)}
                        </select>
                      </label>
                    </>
                  )}
                  {["trend-line", "ray", "extended-line", "horizontal-ray"].includes(drawing.type) && (
                    <>
                      <label className="zt-settings-checkbox">
                        <input
                          type="checkbox"
                          checked={style.extendStart === true}
                          onChange={e => updateStyle({ extendStart: e.target.checked })}
                        />
                        <span>Extend left</span>
                      </label>
                      <label className="zt-settings-checkbox">
                        <input
                          type="checkbox"
                          checked={style.extendEnd === true}
                          onChange={e => updateStyle({ extendEnd: e.target.checked })}
                        />
                        <span>Extend right</span>
                      </label>
                    </>
                  )}
                </div>
              )
            ) : (
              /* Inputs & Coordinates Tab */
              <div className="zt-settings-form-grid">
                {isPositionTool ? (
                  <>
                    <label>
                      Entry Price
                      <input
                        type="number"
                        step="any"
                        value={entryPrice}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val)) setEntryPrice(val);
                        }}
                      />
                    </label>
                    <label>
                      Profit Target Price
                      <input
                        type="number"
                        step="any"
                        value={targetPrice}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val)) setTargetPrice(val);
                        }}
                      />
                    </label>
                    <label>
                      Stop Loss Price
                      <input
                        type="number"
                        step="any"
                        value={calculatedStop}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val)) setStopPrice(val);
                        }}
                      />
                    </label>
                    <label>
                      Risk / Reward Ratio
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={currentRR}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val > 0) setRiskReward(val);
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Anchor 1 Price
                      <input
                        type="number"
                        step="any"
                        value={drawing.anchors[0]?.price ?? 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val)) {
                            onChange({
                              anchors: [
                                { ...drawing.anchors[0], price: val },
                                ...drawing.anchors.slice(1),
                              ],
                            });
                          }
                        }}
                      />
                    </label>
                    {drawing.anchors[1] && (
                      <label>
                        Anchor 2 Price
                        <input
                          type="number"
                          step="any"
                          value={drawing.anchors[1]?.price ?? 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val)) {
                              onChange({
                                anchors: [
                                  drawing.anchors[0],
                                  { ...drawing.anchors[1], price: val },
                                  ...drawing.anchors.slice(2),
                                ],
                              });
                            }
                          }}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
