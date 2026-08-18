import { describe, expect, it } from "vitest";
import { filterTerminalCommands, isHelpShortcut, isMarketShortcut, isPaletteShortcut, nextCommandIndex } from "./terminalCommands";

describe("terminal command registry", () => {
  it("filters commands using labels, details, and contextual keywords", () => {
    expect(filterTerminalCommands("backtest").map(command => command.id)).toEqual(["open-research"]);
    expect(filterTerminalCommands("symbol").map(command => command.id)).toEqual(["focus-market"]);
    expect(filterTerminalCommands("  ").length).toBeGreaterThan(5);
  });

  it("keeps a discoverable keyboard help command in the same searchable registry", () => {
    expect(filterTerminalCommands("shortcuts").map(command => command.id)).toContain("open-shortcuts");
    expect(filterTerminalCommands("keyboard").find(command => command.id === "open-shortcuts")?.shortcut).toBe("?");
  });

  it("wraps palette navigation deterministically without a pointer-only result selection", () => {
    expect(nextCommandIndex(-1, 4, "down")).toBe(0);
    expect(nextCommandIndex(3, 4, "down")).toBe(0);
    expect(nextCommandIndex(0, 4, "up")).toBe(3);
    expect(nextCommandIndex(0, 0, "down")).toBe(-1);
  });

  it("recognizes palette and market shortcuts without treating ordinary modifiers as commands", () => {
    expect(isPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "K", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: "k", ctrlKey: false, metaKey: false })).toBe(false);
    expect(isMarketShortcut({ key: "/", ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(isMarketShortcut({ key: "/", ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    expect(isHelpShortcut({ key: "?", ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(isHelpShortcut({ key: "?", ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
  });
});
