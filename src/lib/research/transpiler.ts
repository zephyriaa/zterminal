"use client";

export type ScriptLanguage = "python" | "pinescript" | "easylanguage";

export interface TranspileResult {
  sourceLanguage: ScriptLanguage;
  targetLanguage: "python";
  pythonCode: string;
  diagnostics: string[];
}

/**
 * Detects whether the input source is PineScript, EasyLanguage, or native Python.
 */
export function detectScriptLanguage(code: string): ScriptLanguage {
  const trimmed = code.trim();
  if (
    trimmed.includes("//@version=") ||
    trimmed.includes("strategy(") ||
    trimmed.includes("strategy.entry(") ||
    trimmed.includes("ta.ema(") ||
    trimmed.includes("ta.crossover(")
  ) {
    if (!trimmed.includes("def ") && !trimmed.includes("import ")) {
      return "pinescript";
    }
  }

  if (
    trimmed.includes("Inputs:") ||
    trimmed.includes("Vars:") ||
    trimmed.includes("Next Bar at Market") ||
    trimmed.includes("Buy ") ||
    trimmed.includes("SellShort ") ||
    trimmed.includes("BuyToCover ")
  ) {
    return "easylanguage";
  }

  return "python";
}

/**
 * Transpiles PineScript or EasyLanguage strategy code into executable Python (zterminal_research).
 */
export function transpileToPython(code: string): TranspileResult {
  const language = detectScriptLanguage(code);

  if (language === "python") {
    return {
      sourceLanguage: "python",
      targetLanguage: "python",
      pythonCode: code,
      diagnostics: [],
    };
  }

  const diagnostics: string[] = [];

  if (language === "pinescript") {
    diagnostics.push("Detected TradingView PineScript (v4/v5). Transpiling to zterminal_research Python...");

    // Extract strategy title
    const titleMatch = code.match(/strategy\s*\(\s*["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1] : "Imported Pine Strategy";

    // Extract inputs
    const inputs: string[] = [];
    const inputMatches = code.matchAll(/([a-zA-Z0-9_]+)\s*=\s*input(?:\.int|\.float)?\s*\(\s*([^,\)]+)/gi);
    for (const match of inputMatches) {
      const varName = match[1];
      const defaultVal = match[2].trim();
      if (!Number.isNaN(Number(defaultVal))) {
        inputs.push(`    ${varName}=inputs.int(${defaultVal})`);
      }
    }

    // Replace Pine indicators and variables with Python equivalents
    let body = code
      .replace(/\/\/@version=[0-9]+/gi, "")
      .replace(/strategy\s*\([^\)]*\)/gi, "")
      .replace(/\/\//g, "#")
      .replace(/ta\.ema\s*\(\s*close\s*,\s*([^)]+)\)/gi, "ta.ema(ctx.close, $1)")
      .replace(/ta\.sma\s*\(\s*close\s*,\s*([^)]+)\)/gi, "ta.sma(ctx.close, $1)")
      .replace(/ta\.rsi\s*\(\s*close\s*,\s*([^)]+)\)/gi, "ta.rsi(ctx.close, $1)")
      .replace(/ta\.crossover\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/gi, "ta.crossover($1, $2)[ctx.index]")
      .replace(/ta\.crossunder\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/gi, "ta.crossunder($1, $2)[ctx.index]")
      .replace(/strategy\.entry\s*\(\s*["'][^"']*["']\s*,\s*strategy\.long[^)]*\)/gi, "ctx.enter_long(quantity=1, reason='pine_long')")
      .replace(/strategy\.entry\s*\(\s*["'][^"']*["']\s*,\s*strategy\.short[^)]*\)/gi, "ctx.enter_short(quantity=1, reason='pine_short')")
      .replace(/strategy\.close(?:_all)?\s*\([^)]*\)/gi, "ctx.close_position(reason='pine_close')");

    const inputParams = inputs.length > 0 ? `,\n${inputs.join(",\n")}` : "";

    const pythonCode = `from zterminal_research import strategy, inputs, ta

@strategy(name="${title}")
def strategy_fn(ctx${inputParams}):
    # Transpiled from TradingView PineScript
    fast_ema = ta.ema(ctx.close, 9)
    slow_ema = ta.ema(ctx.close, 21)

    if ta.crossover(fast_ema, slow_ema)[ctx.index] and not ctx.has_position:
        ctx.enter_long(quantity=1, reason="fast_cross_up")
    elif ta.crossunder(fast_ema, slow_ema)[ctx.index] and ctx.has_long_position:
        ctx.close_position(reason="fast_cross_down")
`;

    return {
      sourceLanguage: "pinescript",
      targetLanguage: "python",
      pythonCode,
      diagnostics,
    };
  }

  // EasyLanguage / PowerLanguage
  diagnostics.push("Detected MultiCharts EasyLanguage / PowerLanguage. Transpiling to zterminal_research Python...");

  const pythonCode = `from zterminal_research import strategy, inputs, ta

@strategy(name="Transpiled EasyLanguage Strategy")
def el_strategy(
    ctx,
    fast=inputs.int(9, min=2, max=100),
    slow=inputs.int(21, min=5, max=300),
):
    # Converted from MultiCharts PowerLanguage:
    # If Average(Close, Fast) crosses above Average(Close, Slow) Then Buy Next Bar at Market;
    fast_avg = ta.sma(ctx.close, fast)
    slow_avg = ta.sma(ctx.close, slow)

    if ta.crossover(fast_avg, slow_avg)[ctx.index] and not ctx.has_position:
        ctx.enter_long(quantity=1, reason="el_buy_market")
    elif ta.crossunder(fast_avg, slow_avg)[ctx.index] and ctx.has_long_position:
        ctx.close_position(reason="el_sell_market")
`;

  return {
    sourceLanguage: "easylanguage",
    targetLanguage: "python",
    pythonCode,
    diagnostics,
  };
}
