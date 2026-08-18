import { describe, expect, it } from "vitest";
import { compileZS } from "./zsCompiler";

const validSource = `# closed deterministic strategy metadata only
strategy("EMA research baseline", overlay=true)
input.int("Length", 20, minval=1, maxval=200, step=1)
input.bool("Enabled", true)
var mean = ema(close, Length)
if crossover(close, mean)
  strategy.entry("protocol-long", strategy.long, qty=1)
if crossunder(close, mean)
  strategy.close("protocol-long")`;

describe("closed ZS compiler", () => {
  it("parses the allowed declarative grammar and deterministically discovers typed inputs", () => {
    const result = compileZS(validSource);
    expect(result).toMatchObject({ ok: true, name: "EMA research baseline", engineVersion: "zs-closed-compiler-v1" });
    expect(result.inputs).toEqual([
      { name: "Length", type: "int", default: 20, minval: 1, maxval: 200, step: 1 },
      { name: "Enabled", type: "bool", default: true },
    ]);
    expect(result.diagnostics.filter(item => item.severity === "error")).toEqual([]);
    expect(result.ast).not.toBeNull();
  });

  it("returns actionable diagnostics for malformed closed-grammar syntax and unsupported language extensions", () => {
    const malformed = compileZS(`strategy("broken"`);
    const invalidInput = compileZS(`input.float("Length", 20, minval="one")`);
    const unsupported = compileZS(`customSignal(close)`);
    expect(malformed.ok).toBe(false);
    expect(malformed.ast).toBeNull();
    expect(malformed.diagnostics.some(item => item.message.includes("Expected closing"))).toBe(true);
    expect(invalidInput.ok).toBe(false);
    expect(invalidInput.diagnostics.some(item => item.message.includes("Input bounds"))).toBe(true);
    expect(unsupported.ok).toBe(false);
    expect(unsupported.diagnostics.some(item => item.message.includes("Unsupported function or action"))).toBe(true);
  });

  it("rejects all escape-hatch identifiers rather than evaluating, importing, fetching, or accessing host capabilities", () => {
    const forbidden = ["eval", "function", "import", "require", "fetch", "XMLHttpRequest", "WebSocket", "process", "globalThis", "window", "document", "fs", "child_process", "Deno", "Bun", "axios", "http", "https"];
    for (const identifier of forbidden) {
      const result = compileZS(`${identifier}("outside closed grammar")`);
      expect(result.ok, identifier).toBe(false);
      expect(result.ast, identifier).toBeNull();
      expect(result.diagnostics.some(item => item.message.includes("Forbidden capability identifier"))).toBe(true);
    }
  });

  it("does not turn strategy source into executable JavaScript or a broker route", () => {
    const source = `strategy("metadata only")
strategy.entry("not-executed", strategy.long, qty=1)
fetch("https://example.invalid")`;
    const result = compileZS(source);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(item => item.message.includes("fetch"))).toBe(true);
    expect(result.diagnostics.some(item => item.message.includes("strategy.entry") && item.severity === "error")).toBe(false);
  });
});
