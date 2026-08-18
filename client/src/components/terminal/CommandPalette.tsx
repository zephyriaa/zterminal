import { useEffect, useMemo, useRef, useState } from "react";
import { Command as CommandIcon, Search, X } from "lucide-react";
import { filterTerminalCommands, nextCommandIndex, TERMINAL_COMMANDS, type TerminalCommandId } from "@/lib/terminalCommands";

export function CommandPalette({ onRun, onClose }: { onRun: (id: TerminalCommandId) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commands = useMemo(() => filterTerminalCommands(query), [query]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCommand = commands[activeIndex] ?? commands[0] ?? null;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIndex(current => current >= commands.length ? Math.max(0, commands.length - 1) : current); }, [commands.length]);

  return <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Terminal command palette" onMouseDown={event => event.stopPropagation()}>
      <header><CommandIcon size={16} /><div><b>Command palette</b><small>Chart-first workspace actions</small></div><button onClick={onClose} aria-label="Close command palette"><X size={15} /></button></header>
      <label className="command-search"><Search size={15} /><input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); return; } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(current => nextCommandIndex(current, commands.length, event.key === "ArrowDown" ? "down" : "up")); return; } if (event.key === "Enter" && activeCommand) { event.preventDefault(); onRun(activeCommand.id); } }} placeholder="Find a command…" aria-label="Find a terminal command" aria-controls="terminal-command-list" aria-activedescendant={activeCommand ? `terminal-command-${activeCommand.id}` : undefined} /><kbd>Esc</kbd></label>
      <div id="terminal-command-list" className="command-list" role="listbox" aria-label="Terminal commands">{commands.map((command, index) => <button id={`terminal-command-${command.id}`} key={command.id} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => onRun(command.id)}><span><b>{command.label}</b><small>{command.detail}</small></span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}{commands.length === 0 && <div className="command-empty">No matching chart-context command.</div>}</div>
      <footer><span><kbd>⌘</kbd><kbd>Ctrl</kbd> + <kbd>K</kbd> open · <kbd>↑</kbd><kbd>↓</kbd> select</span><span>{TERMINAL_COMMANDS.length} actions · no execution routes</span></footer>
    </section>
  </div>;
}
