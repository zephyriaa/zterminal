import type { MarketBar } from "@shared/features/registry";

export type IndicatorInput = {
  id: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
};

export type IndicatorOutput = {
  pane: "overlay" | "pane";
  color: string;
  lineWidth: number;
};

export type IndicatorDraft = {
  name: string;
  expression: string;
  inputs: IndicatorInput[];
  output: IndicatorOutput;
};

type LiteralNode = { kind: "literal"; value: number };
type SourceNode = { kind: "source"; name: CandleSource };
type InputNode = { kind: "input"; name: string };
type UnaryNode = { kind: "unary"; operator: "+" | "-"; argument: ExpressionNode };
type BinaryNode = { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: ExpressionNode; right: ExpressionNode };
type CallNode = { kind: "call"; name: IndicatorFunction; args: ExpressionNode[] };
export type ExpressionNode = LiteralNode | SourceNode | InputNode | UnaryNode | BinaryNode | CallNode;

type CandleSource = "open" | "high" | "low" | "close" | "volume" | "hl2" | "hlc3" | "ohlc4";
type IndicatorFunction = "sma" | "ema" | "rsi" | "abs" | "min" | "max";
type Token = { value: string; index: number };

export type CompiledIndicator = {
  status: "VALID";
  definition: IndicatorDraft;
  ast: ExpressionNode;
  sourceContract: "LOADED_VERIFIED_OHLCV_ONLY";
  execution: "CLOSED_AST_RUNTIME";
  limitations: readonly string[];
};

export type InvalidIndicator = {
  status: "INVALID";
  diagnostic: string;
};

export type IndicatorCompilation = CompiledIndicator | InvalidIndicator;

export type IndicatorPoint = { t: number; value: number };
export type IndicatorEvaluation =
  | { status: "COMPLETED"; points: IndicatorPoint[]; evidence: { inputContract: "LOADED_VERIFIED_OHLCV_ONLY"; lookahead: "NOT_PERMITTED"; execution: "CLOSED_AST_RUNTIME"; output: IndicatorOutput; barCount: number } }
  | { status: "UNAVAILABLE"; reason: string; points: [] };

const CANDLE_SOURCES = new Set<CandleSource>(["open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4"]);
const FUNCTIONS = new Set<IndicatorFunction>(["sma", "ema", "rsi", "abs", "min", "max"]);
const FUNCTION_ARITY: Record<IndicatorFunction, number> = { sma: 2, ema: 2, rsi: 2, abs: 1, min: 2, max: 2 };
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_TERMS = /\b(eval|function|import|export|require|fetch|xmlhttprequest|websocket|window|document|globalthis|process|constructor|prototype|__proto__)\b/i;

class IndicatorSyntaxError extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const remainder = source.slice(cursor);
    const match = /^\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/,])/.exec(remainder);
    if (!match) throw new IndicatorSyntaxError(`Unexpected character at position ${cursor + 1}.`);
    const value = match[1];
    tokens.push({ value, index: cursor + match[0].indexOf(value) });
    cursor += match[0].length;
  }
  return tokens;
}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: Token[], private readonly inputs: Set<string>) {}

  parse() {
    if (!this.tokens.length) throw new IndicatorSyntaxError("An indicator expression is required.");
    const expression = this.parseAdditive();
    if (this.peek()) throw new IndicatorSyntaxError(`Unexpected token '${this.peek()!.value}' at position ${this.peek()!.index + 1}.`);
    return expression;
  }

  private parseAdditive(): ExpressionNode {
    let node = this.parseMultiplicative();
    while (this.peek()?.value === "+" || this.peek()?.value === "-") {
      const operator = this.consume().value as "+" | "-";
      node = { kind: "binary", operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): ExpressionNode {
    let node = this.parseUnary();
    while (this.peek()?.value === "*" || this.peek()?.value === "/") {
      const operator = this.consume().value as "*" | "/";
      node = { kind: "binary", operator, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): ExpressionNode {
    if (this.peek()?.value === "+" || this.peek()?.value === "-") {
      const operator = this.consume().value as "+" | "-";
      return { kind: "unary", operator, argument: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.consume();
    if (!token) throw new IndicatorSyntaxError("Expression ended unexpectedly.");
    if (/^\d/.test(token.value)) return { kind: "literal", value: Number(token.value) };
    if (token.value === "(") {
      const inner = this.parseAdditive();
      this.expect(")");
      return inner;
    }
    if (!IDENTIFIER.test(token.value)) throw new IndicatorSyntaxError(`Unexpected token '${token.value}' at position ${token.index + 1}.`);
    if (this.peek()?.value === "(") return this.parseCall(token);
    if (CANDLE_SOURCES.has(token.value as CandleSource)) return { kind: "source", name: token.value as CandleSource };
    if (this.inputs.has(token.value)) return { kind: "input", name: token.value };
    throw new IndicatorSyntaxError(`Unknown identifier '${token.value}'. Only loaded OHLCV sources and declared inputs are available.`);
  }

  private parseCall(token: Token): ExpressionNode {
    const name = token.value as IndicatorFunction;
    if (!FUNCTIONS.has(name)) throw new IndicatorSyntaxError(`Function '${token.value}' is not allowed in Indicator Lab.`);
    this.expect("(");
    const args: ExpressionNode[] = [];
    if (this.peek()?.value !== ")") {
      do {
        args.push(this.parseAdditive());
        if (this.peek()?.value !== ",") break;
        this.consume();
      } while (true);
    }
    this.expect(")");
    if (args.length !== FUNCTION_ARITY[name]) throw new IndicatorSyntaxError(`${name} expects ${FUNCTION_ARITY[name]} argument${FUNCTION_ARITY[name] === 1 ? "" : "s"}.`);
    if ((name === "sma" || name === "ema" || name === "rsi") && !isConstantPeriod(args[1])) {
      throw new IndicatorSyntaxError(`${name} period must be a numeric literal or a declared numeric input.`);
    }
    return { kind: "call", name, args };
  }

  private expect(value: string) {
    const token = this.consume();
    if (!token || token.value !== value) throw new IndicatorSyntaxError(`Expected '${value}'.`);
  }

  private peek() { return this.tokens[this.cursor]; }
  private consume() { const token = this.tokens[this.cursor]; this.cursor += 1; return token; }
}

function isConstantPeriod(node: ExpressionNode): node is LiteralNode | InputNode {
  return node.kind === "literal" || node.kind === "input";
}

function validateInput(input: IndicatorInput, usedIds: Set<string>): string | null {
  if (!IDENTIFIER.test(input.id)) return `Input id '${input.id}' must be an identifier.`;
  if (usedIds.has(input.id)) return `Input id '${input.id}' is duplicated.`;
  if (!input.label.trim() || input.label.length > 64) return `Input '${input.id}' must have a label of 1–64 characters.`;
  if (![input.defaultValue, input.min, input.max, input.step].every(Number.isFinite)) return `Input '${input.id}' must use finite numeric bounds.`;
  if (input.min > input.max || input.defaultValue < input.min || input.defaultValue > input.max || input.step <= 0) return `Input '${input.id}' has invalid bounds.`;
  usedIds.add(input.id);
  return null;
}

function validOutput(output: IndicatorOutput) {
  return (output.pane === "overlay" || output.pane === "pane") && /^#[0-9a-f]{6}$/i.test(output.color) && Number.isInteger(output.lineWidth) && output.lineWidth >= 1 && output.lineWidth <= 4;
}

export function compileIndicator(draft: IndicatorDraft): IndicatorCompilation {
  const name = draft.name.trim();
  const expression = draft.expression.trim();
  if (name.length < 2 || name.length > 64) return { status: "INVALID", diagnostic: "Indicator name must be 2–64 characters." };
  if (!expression || expression.length > 1_200) return { status: "INVALID", diagnostic: "Indicator expression must be 1–1200 characters." };
  if (FORBIDDEN_TERMS.test(expression)) return { status: "INVALID", diagnostic: "Host code, network access, and dynamic execution are not allowed." };
  if (draft.inputs.length > 8) return { status: "INVALID", diagnostic: "Indicator Lab supports at most eight bounded numeric inputs." };
  if (!validOutput(draft.output)) return { status: "INVALID", diagnostic: "Indicator output must use a supported pane, hex color, and line width." };

  const inputIds = new Set<string>();
  for (const input of draft.inputs) {
    const issue = validateInput(input, inputIds);
    if (issue) return { status: "INVALID", diagnostic: issue };
  }

  try {
    const ast = new Parser(tokenize(expression), inputIds).parse();
    return {
      status: "VALID",
      definition: { ...draft, name, expression, inputs: draft.inputs.map(input => ({ ...input })) },
      ast,
      sourceContract: "LOADED_VERIFIED_OHLCV_ONLY",
      execution: "CLOSED_AST_RUNTIME",
      limitations: ["No JavaScript or Pine Script execution.", "No network, broker, alert, strategy, or account access.", "No future bars, cross-symbol data, historical tape, or depth inputs."],
    };
  } catch (error) {
    return { status: "INVALID", diagnostic: error instanceof Error ? error.message : "Indicator expression could not be parsed." };
  }
}

function validBars(bars: MarketBar[]) {
  return bars.filter(bar => Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c) && bar.v >= 0);
}

function resolvedInputs(compiled: CompiledIndicator, overrides: Record<string, number>) {
  const values: Record<string, number> = {};
  for (const input of compiled.definition.inputs) {
    const value = overrides[input.id] ?? input.defaultValue;
    if (!Number.isFinite(value) || value < input.min || value > input.max) return { error: `Input '${input.label}' is outside its declared bounds.` } as const;
    values[input.id] = value;
  }
  return { values } as const;
}

function sourceValue(source: CandleSource, bar: MarketBar) {
  switch (source) {
    case "open": return bar.o;
    case "high": return bar.h;
    case "low": return bar.l;
    case "close": return bar.c;
    case "volume": return bar.v;
    case "hl2": return (bar.h + bar.l) / 2;
    case "hlc3": return (bar.h + bar.l + bar.c) / 3;
    case "ohlc4": return (bar.o + bar.h + bar.l + bar.c) / 4;
  }
}

function periodAt(node: ExpressionNode, index: number, bars: MarketBar[], inputs: Record<string, number>): number | null {
  const value = evaluateNode(node, index, bars, inputs);
  if (value === null || !Number.isInteger(value) || value < 1 || value > 1_000) return null;
  return value;
}

function evaluateNode(node: ExpressionNode, index: number, bars: MarketBar[], inputs: Record<string, number>): number | null {
  if (index < 0 || index >= bars.length) return null;
  if (node.kind === "literal") return node.value;
  if (node.kind === "source") return sourceValue(node.name, bars[index]);
  if (node.kind === "input") return inputs[node.name] ?? null;
  if (node.kind === "unary") {
    const value = evaluateNode(node.argument, index, bars, inputs);
    return value === null ? null : node.operator === "-" ? -value : value;
  }
  if (node.kind === "binary") {
    const left = evaluateNode(node.left, index, bars, inputs);
    const right = evaluateNode(node.right, index, bars, inputs);
    if (left === null || right === null) return null;
    if (node.operator === "+") return left + right;
    if (node.operator === "-") return left - right;
    if (node.operator === "*") return left * right;
    return right === 0 ? null : left / right;
  }

  const [first, second] = node.args;
  if (node.name === "abs") {
    const value = evaluateNode(first, index, bars, inputs);
    return value === null ? null : Math.abs(value);
  }
  if (node.name === "min" || node.name === "max") {
    const left = evaluateNode(first, index, bars, inputs);
    const right = evaluateNode(second, index, bars, inputs);
    if (left === null || right === null) return null;
    return node.name === "min" ? Math.min(left, right) : Math.max(left, right);
  }

  const period = periodAt(second, index, bars, inputs);
  if (!period) return null;
  if (node.name === "sma") {
    const start = Math.max(0, index - period + 1);
    const values = Array.from({ length: index - start + 1 }, (_, offset) => evaluateNode(first, start + offset, bars, inputs));
    if (values.some(value => value === null)) return null;
    return (values as number[]).reduce((sum, value) => sum + value, 0) / values.length;
  }
  if (node.name === "ema") {
    const multiplier = 2 / (period + 1);
    let ema: number | null = null;
    for (let cursor = 0; cursor <= index; cursor += 1) {
      const value = evaluateNode(first, cursor, bars, inputs);
      if (value === null) return null;
      ema = ema === null ? value : (value - ema) * multiplier + ema;
    }
    return ema;
  }

  const start = Math.max(1, index - period + 1);
  let gains = 0;
  let losses = 0;
  for (let cursor = start; cursor <= index; cursor += 1) {
    const current = evaluateNode(first, cursor, bars, inputs);
    const previous = evaluateNode(first, cursor - 1, bars, inputs);
    if (current === null || previous === null) return null;
    const change = current - previous;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

export function evaluateIndicator(compiled: CompiledIndicator, bars: MarketBar[], overrides: Record<string, number> = {}): IndicatorEvaluation {
  const inputs = resolvedInputs(compiled, overrides);
  if ("error" in inputs && typeof inputs.error === "string") return { status: "UNAVAILABLE", reason: inputs.error, points: [] };
  const values = validBars(bars);
  if (!values.length) return { status: "UNAVAILABLE", reason: "Indicator Lab requires a verified loaded OHLCV window.", points: [] };
  const points: IndicatorPoint[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = evaluateNode(compiled.ast, index, values, inputs.values);
    if (value === null || !Number.isFinite(value)) return { status: "UNAVAILABLE", reason: "Indicator expression could not produce a finite value from the loaded verified candles.", points: [] };
    points.push({ t: values[index].t, value });
  }
  return { status: "COMPLETED", points, evidence: { inputContract: "LOADED_VERIFIED_OHLCV_ONLY", lookahead: "NOT_PERMITTED", execution: "CLOSED_AST_RUNTIME", output: compiled.definition.output, barCount: values.length } };
}
