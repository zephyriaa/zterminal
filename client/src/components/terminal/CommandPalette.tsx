import { useEffect, useMemo, useRef, useState } from "react";
import { Command as CommandIcon, Search, X } from "lucide-react";
import { filterTerminalCommands, TERMINAL_COMMANDS, type TerminalCommandId } from "@/lib/terminalCommands";

export function CommandPalette({ onRun, onClose }: { onRun: (id: TerminalCommandId) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commands = useMemo(() => filterTerminalCommands(query), [query]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Terminal command palette" onMouseDown={event => event.stopPropagation()}>
      <header><CommandIcon size={16} /><div><b>Command palette</b><small>Chart-first workspace actions</small></div><button onClick={onClose} aria-label="Close command palette"><X size={15} /></button></header>
      <label className="command-search"><Search size={15} /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") onClose(); if (event.key === "Enter" && commands[0]) onRun(commands[0].id); }} placeholder="Find a command…" aria-label="Find a terminal command" /><kbd>Esc</kbd></label>
      <div className="command-list" role="list">{commands.map(command => <button key={command.id} role="listitem" onClick={() => onRun(command.id)}><span><b>{command.label}</b><small>{command.detail}</small></span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}{commands.length === 0 && <div className="command-empty">No matching chart-context command.</div>}</div>
      <footer><span><kbd>⌘</kbd><kbd>Ctrl</kbd> + <kbd>K</kbd> open</span><span>{TERMINAL_COMMANDS.length} actions · no execution routes</span></footer>
    </section>
  </div>;
}
