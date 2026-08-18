import { describe, expect, it } from "vitest";
import { filterTerminalCommands, isMarketShortcut, isPaletteShortcut } from "./terminalCommands";

describe("terminal command registry", () => {
  it("filters commands using labels, details, and contextual keywords", () => {
    expect(filterTerminalCommands("backtest").map(command => command.id)).toEqual(["open-research"]);
    expect(filterTerminalCommands("symbol").map(command => command.id)).toEqual(["focus-market"]);
    expect(filterTerminalCommands("  ").length).toBeGreaterThan(5);
  });

  it("recognizes palette and market shortcuts without treating ordinary modifiers as commands", () => {
    expect(isPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "K", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: "k", ctrlKey: false, metaKey: false })).toBe(false);
    expect(isMarketShortcut({ key: "/", ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(isMarketShortcut({ key: "/", ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
  });
});
