import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { GripHorizontal, Minus, X } from "lucide-react";
import type { TerminalFloatingPanelGeometry, TerminalFloatingPanelId } from "@shared/workspace/terminalPreferences";

type Interaction = { kind: "move" | "resize"; startX: number; startY: number; layout: TerminalFloatingPanelGeometry };

type Props = {
  id: TerminalFloatingPanelId;
  title: string;
  eyebrow?: string;
  layout: TerminalFloatingPanelGeometry;
  onLayoutChange: (next: TerminalFloatingPanelGeometry) => void;
  onRaise: () => void;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  minWidth?: number;
  minHeight?: number;
  controls?: ReactNode;
  mobile?: boolean;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** A bounded desktop panel: geometry is stored as percentages so it remains usable across ordinary desktop widths. */
export function FloatingPanel({ id, title, eyebrow, layout, onLayoutChange, onRaise, onClose, children, className = "", minWidth = 22, minHeight = 28, controls, mobile = false }: Props) {
  const panelRef = useRef<HTMLElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const finish = () => {
      if (!interactionRef.current) return;
      interactionRef.current = null;
      setIsInteracting(false);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    const move = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      const parent = panelRef.current?.parentElement;
      if (!interaction || !parent) return;
      const bounds = parent.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const deltaX = ((event.clientX - interaction.startX) / bounds.width) * 100;
      const deltaY = ((event.clientY - interaction.startY) / bounds.height) * 100;
      if (interaction.kind === "move") {
        onLayoutChange({
          ...interaction.layout,
          x: clamp(interaction.layout.x + deltaX, 0, 100 - interaction.layout.width),
          y: clamp(interaction.layout.y + deltaY, 0, 100 - interaction.layout.height),
        });
        return;
      }
      const width = clamp(interaction.layout.width + deltaX, minWidth, 100 - interaction.layout.x);
      const height = clamp(interaction.layout.height + deltaY, minHeight, 100 - interaction.layout.y);
      onLayoutChange({ ...interaction.layout, width, height });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [minHeight, minWidth, onLayoutChange]);

  const startInteraction = (kind: Interaction["kind"], event: ReactPointerEvent<HTMLElement>) => {
    if (mobile || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onRaise();
    interactionRef.current = { kind, startX: event.clientX, startY: event.clientY, layout };
    setIsInteracting(true);
    document.body.style.setProperty("cursor", kind === "move" ? "grabbing" : "nwse-resize");
    document.body.style.setProperty("user-select", "none");
  };

  const updateMinimized = () => {
    onRaise();
    onLayoutChange({ ...layout, minimized: !layout.minimized });
  };

  const desktopStyle = mobile ? undefined : {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${layout.width}%`,
    height: `${layout.minimized ? "auto" : `${layout.height}%`}`,
    zIndex: layout.z,
  };

  return <section ref={panelRef} className={`floating-panel ${layout.minimized ? "is-minimized" : ""} ${isInteracting ? "is-interacting" : ""} ${className}`} style={desktopStyle} data-panel-id={id} onPointerDown={onRaise} aria-label={`${title} window`}>
    <header className="floating-panel-header" onPointerDown={(event) => startInteraction("move", event)}>
      <span className="floating-panel-drag" aria-hidden="true"><GripHorizontal size={15} /></span>
      <div className="floating-panel-title"><span>{eyebrow}</span><b>{title}</b></div>
      <div className="floating-panel-controls" onPointerDown={(event) => event.stopPropagation()}>
        {controls}
        <button type="button" className="floating-panel-icon" onClick={updateMinimized} aria-label={`${layout.minimized ? "Restore" : "Minimize"} ${title}`} title={layout.minimized ? "Restore panel" : "Minimize panel"}><Minus size={14} /></button>
        {onClose && <button type="button" className="floating-panel-icon close" onClick={onClose} aria-label={`Close ${title}`} title="Close panel"><X size={14} /></button>}
      </div>
    </header>
    {!layout.minimized && <div className="floating-panel-body">{children}</div>}
    {!mobile && !layout.minimized && <button type="button" className="floating-panel-resize" onPointerDown={(event) => startInteraction("resize", event)} aria-label={`Resize ${title}`} title="Drag to resize" />}
  </section>;
}
