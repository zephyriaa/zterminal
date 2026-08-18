import { compileZS, type ZSCompileResult, type ZSDiagnostic, type ZSNode } from "./zsCompiler";

export type ClosedRuntimeBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type ClosedStrategySignal =
  | { kind: "entry"; time: number; barIndex: number; id: string; quantity: number }
  | { kind: "exit"; time: number; barIndex: number; id: string };

export type ClosedRuntimeResult = {
  ok: boolean;
  runtimeVersion: "zs-historical-runtime-v1";
  strategyName: string;
  signals: ClosedStrategySignal[];
  diagnostics: ZSDiagnostic[];
  fingerprint: string | null;
};

type RuntimeValue = number | string | boolean;
type RuntimeState = { bars: ClosedRuntimeBar[]; values: Map<string, RuntimeValue[]>; inputs: Map<string, RuntimeValue>; diagnostics: ZSDiagnostic[]; signals: ClosedStrategySignal[] };

const RUNTIME_VERSION = "zs-historical-runtime-v1" as const;
const EXECUTABLE_FUNCTIONS = new Set(["ema", "sma", "vwap", "highest", "lowest", "crossover", "crossunder", "max", "min", "abs"]);
const NON_EXECUTABLE_CALLS = new Set(["plot", "atr", "rsi", "stdev", "strategy.exit"]);

function diagnostic(target: ZSDiagnostic[], node: ZSNode, message: string) {
  target.push({ line: node.line, col: 0, severity: "error", message });
}

function fingerprint(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16_777_619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function finiteBar(bar: ClosedRuntimeBar) {
  return Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.o > 0 && bar.c > 0 && bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c) && bar.v >= 0;
}

function numberValue(value: RuntimeValue | undefined, state: RuntimeState, node: ZSNode, context: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  diagnostic(state.diagnostics, node, `${context} requires a finite numeric value in the closed historical runtime.`);
  return null;
}

function boolValue(value: RuntimeValue | undefined, state: RuntimeState, node: ZSNode): boolean | null {
  if (typeof value === "boolean") return value;
  diagnostic(state.diagnostics, node, "A closed runtime condition must resolve to a boolean value.");
  return null;
}

function namedArgument(node: Extract<ZSNode, { kind: "call" }>, name: string) {
  return node.args.find(argument => argument.name === name)?.value;
}

function valueAt(node: ZSNode, index: number, state: RuntimeState): RuntimeValue | undefined {
  const bar = state.bars[index];
  if (!bar) return undefined;
  if (node.kind === "num" || node.kind === "str" || node.kind === "bool") return node.value;
  if (node.kind === "ident") {
    const candle: Record<string, RuntimeValue> = {
      open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v, time: bar.t,
      hl2: (bar.h + bar.l) / 2, hlc3: (bar.h + bar.l + bar.c) / 3, ohlc4: (bar.o + bar.h + bar.l + bar.c) / 4,
      "strategy.long": "long", "strategy.short": "short",
    };
    if (node.name in candle) return candle[node.name]!;
    if (state.inputs.has(node.name)) return state.inputs.get(node.name);
    return state.values.get(node.name)?.[index];
  }
  if (node.kind === "binop") {
    const left = valueAt(node.left, index, state);
    const right = valueAt(node.right, index, state);
    if (node.op === "!") return !Boolean(right);
    if (["==", "!="].includes(node.op)) return node.op === "==" ? left === right : left !== right;
    const a = numberValue(left, state, node.left, `Operator \`${node.op}\``);
    const b = numberValue(right, state, node.right, `Operator \`${node.op}\``);
    if (a === null || b === null) return undefined;
    if (node.op === "+") return a + b;
    if (node.op === "-") return a - b;
    if (node.op === "*") return a * b;
    if (node.op === "/") return b === 0 ? undefined : a / b;
    if (node.op === "%") return b === 0 ? undefined : a % b;
    if (node.op === ">") return a > b;
    if (node.op === "<") return a < b;
    if (node.op === ">=") return a >= b;
    if (node.op === "<=") return a <= b;
    diagnostic(state.diagnostics, node, `Operator \`${node.op}\` is not executable in the closed historical runtime.`);
    return undefined;
  }
  if (node.kind === "call") return callValue(node, index, state);
  diagnostic(state.diagnostics, node, `Statement \`${node.kind}\` cannot be used as a closed runtime expression.`);
  return undefined;
}

function integerLength(node: ZSNode | undefined, index: number, state: RuntimeState, call: ZSNode): number | null {
  const raw = node ? numberValue(valueAt(node, index, state), state, node, "Indicator length") : null;
  if (raw === null || !Number.isInteger(raw) || raw < 1 || raw > 10_000) {
    diagnostic(state.diagnostics, call, "Closed runtime indicator lengths must be positive integers no greater than 10,000.");
    return null;
  }
  return raw;
}

function series(node: ZSNode | undefined, endIndex: number, state: RuntimeState, call: ZSNode): number[] | null {
  if (!node) { diagnostic(state.diagnostics, call, "Closed runtime indicators require a series argument."); return null; }
  const values: number[] = [];
  for (let index = 0; index <= endIndex; index += 1) {
    const value = numberValue(valueAt(node, index, state), state, node, "Indicator series");
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

function callValue(node: Extract<ZSNode, { kind: "call" }>, index: number, state: RuntimeState): RuntimeValue | undefined {
  if (node.callee.startsWith("input.")) {
    const label = node.args[0]?.value;
    return label?.kind === "str" ? state.inputs.get(label.value) : undefined;
  }
  if (NON_EXECUTABLE_CALLS.has(node.callee)) { diagnostic(state.diagnostics, node, `\`${node.callee}\` is valid ZS metadata but is outside the executable historical-runtime v1 subset.`); return undefined; }
  if (!EXECUTABLE_FUNCTIONS.has(node.callee)) { diagnostic(state.diagnostics, node, `\`${node.callee}\` is not executable in the closed historical runtime.`); return undefined; }
  if (node.callee === "max" || node.callee === "min") {
    const left = numberValue(valueAt(node.args[0]?.value ?? { kind: "num", value: NaN, line: node.line }, index, state), state, node, `\`${node.callee}\``);
    const right = numberValue(valueAt(node.args[1]?.value ?? { kind: "num", value: NaN, line: node.line }, index, state), state, node, `\`${node.callee}\``);
    return left === null || right === null ? undefined : node.callee === "max" ? Math.max(left, right) : Math.min(left, right);
  }
  if (node.callee === "abs") {
    const value = numberValue(valueAt(node.args[0]?.value ?? { kind: "num", value: NaN, line: node.line }, index, state), state, node, "`abs`");
    return value === null ? undefined : Math.abs(value);
  }
  if (node.callee === "crossover" || node.callee === "crossunder") {
    if (index === 0) return false;
    const leftNow = numberValue(valueAt(node.args[0]?.value ?? { kind: "num", value: NaN, line: node.line }, index, state), state, node, `\`${node.callee}\``);
    const rightNow = numberValue(valueAt(node.args[1]?.value ?? { kind: "num", value: NaN, line: node.line }, index, state), state, node, `\`${node.callee}\``);
    const leftPrevious = numberValue(valueAt(node.args[0]?.value ?? { kind: "num", value: NaN, line: node.line }, index - 1, state), state, node, `\`${node.callee}\``);
    const rightPrevious = numberValue(valueAt(node.args[1]?.value ?? { kind: "num", value: NaN, line: node.line }, index - 1, state), state, node, `\`${node.callee}\``);
    if ([leftNow, rightNow, leftPrevious, rightPrevious].some(value => value === null)) return undefined;
    return node.callee === "crossover" ? leftPrevious! <= rightPrevious! && leftNow! > rightNow! : leftPrevious! >= rightPrevious! && leftNow! < rightNow!;
  }
  const values = series(node.args[0]?.value, index, state, node);
  if (!values) return undefined;
  if (node.callee === "vwap") {
    const numerator = state.bars.slice(0, index + 1).reduce((total, bar, current) => total + values[current]! * bar.v, 0);
    const denominator = state.bars.slice(0, index + 1).reduce((total, bar) => total + bar.v, 0);
    return denominator ? numerator / denominator : values.at(-1)!;
  }
  const length = integerLength(node.args[1]?.value, index, state, node);
  if (length === null) return undefined;
  const window = values.slice(Math.max(0, values.length - length));
  if (node.callee === "sma") return window.reduce((total, value) => total + value, 0) / window.length;
  if (node.callee === "ema") {
    const multiplier = 2 / (length + 1);
    return values.reduce((ema, value, current) => current === 0 ? value : value * multiplier + ema * (1 - multiplier), values[0]!);
  }
  if (node.callee === "highest") return Math.max(...window);
  if (node.callee === "lowest") return Math.min(...window);
  diagnostic(state.diagnostics, node, `\`${node.callee}\` is not executable in the closed historical runtime.`);
  return undefined;
}

function action(node: Extract<ZSNode, { kind: "call" }>, index: number, state: RuntimeState) {
  if (node.callee === "strategy") return;
  if (node.callee === "strategy.exit") { diagnostic(state.diagnostics, node, "`strategy.exit` is not executable in historical-runtime v1; stop, limit, and bracket semantics are unsupported."); return; }
  if (node.callee === "strategy.entry") {
    const id = node.args[0]?.value;
    const side = node.args[1]?.value;
    const quantity = namedArgument(node, "qty");
    const quantityValue = quantity?.kind === "num" && Number.isFinite(quantity.value) ? quantity.value : null;
    if (id?.kind !== "str" || side?.kind !== "ident" || side.name !== "strategy.long" || quantityValue === null || quantityValue <= 0) {
      diagnostic(state.diagnostics, node, "Historical-runtime v1 is long-only and supports only `strategy.entry(" + "\"id\", strategy.long, qty=<positive finite literal>)` declarations; dynamic sizing expressions are not supported.");
      return;
    }
    state.signals.push({ kind: "entry", time: state.bars[index]!.t, barIndex: index, id: id.value, quantity: quantityValue });
    return;
  }
  if (node.callee === "strategy.close") {
    const id = node.args[0]?.value;
    if (id?.kind !== "str") { diagnostic(state.diagnostics, node, "Historical-runtime v1 requires a fixed string strategy ID for `strategy.close`."); return; }
    state.signals.push({ kind: "exit", time: state.bars[index]!.t, barIndex: index, id: id.value });
    return;
  }
  if (node.callee.startsWith("strategy.")) { diagnostic(state.diagnostics, node, `\`${node.callee}\` is not executable in historical-runtime v1.`); }
}

function execute(node: ZSNode, index: number, state: RuntimeState) {
  if (node.kind === "assign") {
    const value = valueAt(node.value, index, state);
    if (value !== undefined) {
      const values = state.values.get(node.target) ?? [];
      values[index] = value;
      state.values.set(node.target, values);
    }
    return;
  }
  if (node.kind === "if") {
    const condition = boolValue(valueAt(node.cond, index, state), state, node.cond);
    if (condition) node.body.forEach(child => execute(child, index, state));
    return;
  }
  if (node.kind === "call") { action(node, index, state); return; }
  diagnostic(state.diagnostics, node, "Only assignments, conditions, and strategy declarations are executable at the closed runtime top level.");
}

function inputsFor(compiled: ZSCompileResult) {
  return new Map(compiled.inputs.map(input => [input.name, input.default] as const));
}

/**
 * Interprets a validated closed ZS AST over supplied historical candles. No user text is
 * converted to JavaScript and the only output is an ordered list of historical signal declarations.
 */
export function evaluateClosedZS(source: string, inputBars: ClosedRuntimeBar[]): ClosedRuntimeResult {
  const compiled = compileZS(source);
  const base = { runtimeVersion: RUNTIME_VERSION, strategyName: compiled.name, diagnostics: [...compiled.diagnostics] };
  if (!compiled.ok || !compiled.ast) return { ...base, ok: false, signals: [], fingerprint: null };
  if (!inputBars.every(finiteBar)) return { ...base, ok: false, signals: [], fingerprint: null, diagnostics: [...base.diagnostics, { line: 0, col: 0, severity: "error", message: "Closed historical runtime requires finite, ordered-candle-shaped bars; invalid bars are not evaluated." }] };
  const bars = inputBars.slice().sort((left, right) => left.t - right.t);
  if (bars.some((bar, index) => index > 0 && bar.t === bars[index - 1]?.t)) return { ...base, ok: false, signals: [], fingerprint: null, diagnostics: [...base.diagnostics, { line: 0, col: 0, severity: "error", message: "Closed historical runtime rejects duplicate candle timestamps." }] };
  const state: RuntimeState = { bars, values: new Map(), inputs: inputsFor(compiled), diagnostics: [...compiled.diagnostics], signals: [] };
  for (let index = 0; index < bars.length; index += 1) compiled.ast.forEach(statement => execute(statement, index, state));
  const errors = state.diagnostics.some(item => item.severity === "error");
  const signals = errors ? [] : state.signals.sort((left, right) => left.barIndex - right.barIndex || (left.kind === "exit" ? 1 : -1));
  return { ok: !errors, runtimeVersion: RUNTIME_VERSION, strategyName: compiled.name, signals, diagnostics: state.diagnostics, fingerprint: errors ? null : fingerprint(JSON.stringify({ source, runtime: RUNTIME_VERSION, inputs: Object.fromEntries(Array.from(state.inputs.entries()).sort(([left], [right]) => left.localeCompare(right))) })) };
}
