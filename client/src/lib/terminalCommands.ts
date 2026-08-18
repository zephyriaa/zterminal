export type TerminalCommandId = "open-research" | "open-studies" | "focus-mode" | "exit-focus" | "focus-market" | "refresh-market" | "open-settings" | "open-alerts" | "open-risk";

export type TerminalCommand = {
  id: TerminalCommandId;
  label: string;
  detail: string;
  keywords: string[];
  shortcut?: string;
};

export const TERMINAL_COMMANDS: TerminalCommand[] = [
  { id: "open-research", label: "Open Research", detail: "Open the chart-context Evidence Lab.", keywords: ["research", "hypothesis", "strategy", "backtest"], shortcut: "R" },
  { id: "open-studies", label: "Open Studies", detail: "Open verified chart studies and capability gates.", keywords: ["studies", "indicators", "order flow"], shortcut: "S" },
  { id: "focus-mode", label: "Enter Focus Mode", detail: "Show the chart, history controls, and a single exit control.", keywords: ["focus", "minimal", "distraction free"], shortcut: "F" },
  { id: "exit-focus", label: "Exit Focus Mode", detail: "Return to the complete research workstation.", keywords: ["focus", "exit", "escape"], shortcut: "Esc" },
  { id: "focus-market", label: "Find Market", detail: "Focus the Gate.io perpetual market input.", keywords: ["market", "symbol", "contract", "gate"], shortcut: "/" },
  { id: "refresh-market", label: "Refresh Verified Data", detail: "Retry public snapshot and verified historical data.", keywords: ["refresh", "retry", "data", "market"], shortcut: "Shift R" },
  { id: "open-settings", label: "Open Settings Status", detail: "Show the current truthful settings and entitlement status.", keywords: ["settings", "theme", "keyboard", "entitlements"] },
  { id: "open-alerts", label: "Open Alert Status", detail: "Show the current alert capability status.", keywords: ["alerts", "notifications", "alarm"] },
  { id: "open-risk", label: "Open Risk Status", detail: "Show the current risk-sizing capability status.", keywords: ["risk", "sizing", "position"] },
];

export function filterTerminalCommands(query: string, commands = TERMINAL_COMMANDS) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands;
  return commands.filter(command => [command.label, command.detail, ...command.keywords].some(value => value.toLowerCase().includes(normalized)));
}

export function isPaletteShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
}

export function isMarketShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">) {
  return event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
}
