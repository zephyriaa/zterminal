"use client";
import { useEffect } from "react";
import { useCustomization } from "@/stores/customization";
import { useWorkspace } from "@/stores/workspace";
import { shortcutFromEvent, type CommandId } from "@/lib/customization";
import { useWorkspaceDock } from "./docking/workspace-dock-controller";

export function TerminalShortcuts() {
  const bindings = useCustomization(state => state.preferences.bindings);
  const dock = useWorkspaceDock();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      const editable = event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true],.monaco-editor,[role=dialog]");
      const pressed = shortcutFromEvent({ key: event.code === "Comma" ? "," : event.code === "Period" ? "." : event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey });
      const id = (Object.keys(bindings) as CommandId[]).find(id => bindings[id] && bindings[id].toUpperCase() === pressed?.toUpperCase());
      if (!id || editable && !(id === "commands" && useWorkspace.getState().commandOpen && event.target instanceof Element && event.target.closest("[role=dialog]"))) return;
      event.preventDefault();
      const workspace = useWorkspace.getState();
      if (id === "commands") workspace.setCommandOpen(!workspace.commandOpen);
      else if (id === "sidebar") workspace.toggleSidebar();
      else dock.openPanel(id === "preferences" ? "settings" : id === "chartSettings" ? "chart-settings" : id);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [bindings, dock.openPanel]);
  return null;
}
