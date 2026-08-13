/**
 * ZS — Z Strategy Language.
 *
 * A small, explicitly-documented custom DSL (Pine-like in spirit, NOT a
 * Pine-compatible interpreter). Designed for deterministic, reproducible
 * bar-by-bar strategy execution against the backtest engine.
 *
 * Grammar (subset):
 *   strategy("name", overlay=true, initial_capital=100000)
 *   input.float("Fast", 8, minval=1, maxval=200)
 *   input.int("Slow", 21, minval=1)
 *   var Series = ema(close, Fast)
 *   plot(Series, "EMA Fast", color=teal)
 *   if close > ema(close, Fast)
 *     strategy.entry("long", strategy.long, qty=1)
 *   strategy.close("long")
 *
 * Built-in series: open, high, low, close, volume, time
 * Built-in funcs: ema, sma, vwap, highest, lowest, crossover, crossunder,
 *                 atr, rsi, stdev
 * Built-in actions: strategy.entry, strategy.exit, strategy.close,
 *                    strategy.position_size
 *
 * See STRATEGY_BUILDER.md and STRATEGY_LANGUAGE.md.
 */

export interface ZSInput {
  name: string;
  type: "float" | "int" | "bool" | "string";
  default: number | string | boolean;
  minval?: number;
  maxval?: number;
  step?: number;
}

export interface ZSDiagnostic {
  line: number;
  col: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface ZSCompileResult {
  ok: boolean;
  inputs: ZSInput[];
  diagnostics: ZSDiagnostic[];
  name: string;
  compiledAt: number;
  ast: ZSNode[] | null;
}

export type ZSNode =
  | { kind: "call"; callee: string; args: ZSArg[]; line: number }
  | { kind: "assign"; target: string; value: ZSNode; line: number }
  | { kind: "if"; cond: ZSNode; body: ZSNode[]; line: number }
  | { kind: "ident"; name: string }
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "binop"; op: string; l: ZSNode; r: ZSNode };

export interface ZSArg {
  name?: string;       // named arg
  value: ZSNode;
}

function tokenize(src: string) {
  const tokens: { t: string; v: string; line: number; col: number }[] = [];
  let i = 0, line = 1, col = 1;
  const push = (t: string, v: string) => tokens.push({ t, v, line, col });
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\n") { line++; col = 1; i++; continue; }
    if (ch === " " || ch === "\t" || ch === "\r") { i++; col++; continue; }
    if (ch === "#") { while (i < src.length && src[i] !== "\n") { i++; col++; } continue; }
    if (ch === '"' || ch === "'") {
      const q = ch; i++; col++;
      let s = "";
      while (i < src.length && src[i] !== q) { s += src[i]; i++; col++; }
      i++; col++;
      push("str", s);
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let n = "";
      while (i < src.length && /[0-9.]/.test(src[i])) { n += src[i]; i++; col++; }
      push("num", n);
      continue;
    }
    if (/[A-Za-z_\.]/.test(ch)) {
      let id = "";
      while (i < src.length && /[A-Za-z0-9_\.]/.test(src[i])) { id += src[i]; i++; col++; }
      push("ident", id);
      continue;
    }
    if (ch === "(" || ch === ")" || ch === "," || ch === "{" || ch === "}") { push("punct", ch); i++; col++; continue; }
    if (ch === "=") { if (src[i + 1] === "=") { push("op", "=="); i += 2; col += 2; } else { push("op", "="); i++; col++; } continue; }
    if (ch === "!") { if (src[i + 1] === "=") { push("op", "!="); i += 2; col += 2; } else { push("op", "!"); i++; col++; } continue; }
    if (ch === "<") { if (src[i + 1] === "=") { push("op", "<="); i += 2; col += 2; } else { push("op", "<"); i++; col++; } continue; }
    if (ch === ">") { if (src[i + 1] === "=") { push("op", ">="); i += 2; col += 2; } else { push("op", ">"); i++; col++; } continue; }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") { push("op", ch); i++; col++; continue; }
    // unknown char — skip
    i++; col++;
  }
  return tokens;
}

class Parser {
  i = 0;
  constructor(public toks: ReturnType<typeof tokenize>, public diag: ZSDiagnostic[]) {}
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  parse(): ZSNode[] {
    const out: ZSNode[] = [];
    while (this.i < this.toks.length) {
      const tk = this.peek();
      if (!tk) break;
      if (tk.t === "ident" && tk.v === "if") {
        out.push(this.parseIf());
      } else if (tk.t === "ident" && this.peek()?.v === "var") {
        this.next();
        const name = this.next()?.v ?? "";
        const eq = this.next();
        if (eq?.v !== "=") this.err(tk.line, "expected = in var declaration");
        const val = this.parseExpr();
        out.push({ kind: "assign", target: name, value: val, line: tk.line });
      } else if (tk.t === "ident") {
        // statement is a call or assignment
        const expr = this.parseExpr();
        // assignment?
        const nx = this.peek();
        if (nx?.t === "op" && nx.v === "=") {
          this.next();
          const val = this.parseExpr();
          if (expr.kind === "ident") out.push({ kind: "assign", target: expr.name, value: val, line: tk.line });
        } else {
          out.push(expr as ZSNode);
        }
      } else {
        this.next();
      }
    }
    return out;
  }
  parseIf(): ZSNode {
    const tk = this.next()!; // if
    const cond = this.parseExpr();
    const body: ZSNode[] = [];
    // Pine-like single-statement body: the `if` consumes exactly one
    // following statement (a call, assign, or nested if). Multi-statement
    // blocks require explicit grouping or separate `if` statements.
    const s = this.peek();
    if (s) {
      if (s.t === "ident" && s.v === "if") {
        body.push(this.parseIf());
      } else {
        const e = this.parseExpr();
        const nx = this.peek();
        if (nx?.t === "op" && nx.v === "=") {
          this.next();
          const v = this.parseExpr();
          if (e.kind === "ident") body.push({ kind: "assign", target: e.name, value: v, line: s.line });
        } else {
          body.push(e as ZSNode);
        }
      }
    }
    return { kind: "if", cond, body, line: tk.line };
  }
  isBlockEnd(v: string) {
    return ["else"].includes(v);
  }
  parseExpr(): ZSNode {
    return this.parseCmp();
  }
  parseCmp(): ZSNode {
    let l = this.parseAdd();
    while (this.peek()?.t === "op" && [">", "<", ">=", "<=", "==", "!="].includes(this.peek()!.v)) {
      const op = this.next()!.v;
      const r = this.parseAdd();
      l = { kind: "binop", op, l, r };
    }
    return l;
  }
  parseAdd(): ZSNode {
    let l = this.parseMul();
    while (this.peek()?.t === "op" && ["+", "-"].includes(this.peek()!.v)) {
      const op = this.next()!.v;
      const r = this.parseMul();
      l = { kind: "binop", op, l, r };
    }
    return l;
  }
  parseMul(): ZSNode {
    let l = this.parseUnary();
    while (this.peek()?.t === "op" && ["*", "/", "%"].includes(this.peek()!.v)) {
      const op = this.next()!.v;
      const r = this.parseUnary();
      l = { kind: "binop", op, l, r };
    }
    return l;
  }
  parseUnary(): ZSNode {
    if (this.peek()?.t === "op" && (this.peek()!.v === "-" || this.peek()!.v === "!")) {
      const op = this.next()!.v;
      const r = this.parseUnary();
      return { kind: "binop", op, l: { kind: "num", value: 0 }, r };
    }
    return this.parsePrimary();
  }
  parsePrimary(): ZSNode {
    const tk = this.peek();
    if (!tk) return { kind: "num", value: 0 };
    if (tk.t === "num") { this.next(); return { kind: "num", value: Number(tk.v) }; }
    if (tk.t === "str") { this.next(); return { kind: "str", value: tk.v }; }
    if (tk.t === "ident") {
      if (tk.v === "true" || tk.v === "false") { this.next(); return { kind: "bool", value: tk.v === "true" }; }
      this.next();
      if (this.peek()?.t === "punct" && this.peek()!.v === "(") {
        this.next();
        const args: ZSArg[] = [];
        if (!(this.peek()?.t === "punct" && this.peek()!.v === ")")) {
          while (true) {
            // named arg? ident = value  (but not ==)
            const cur = this.peek();
            const after = this.toks[this.i + 1];
            if (cur?.t === "ident" && after?.t === "op" && after.v === "=") {
              const name = this.next()!.v;
              this.next(); // =
              const val = this.parseExpr();
              args.push({ name, value: val });
            } else {
              args.push({ value: this.parseExpr() });
            }
            if (this.peek()?.t === "punct" && this.peek()!.v === ",") { this.next(); continue; }
            break;
          }
        }
        if (this.peek()?.t === "punct" && this.peek()!.v === ")") this.next();
        return { kind: "call", callee: tk.v, args, line: tk.line };
      }
      return { kind: "ident", name: tk.v };
    }
    this.next();
    return { kind: "num", value: 0 };
  }
  err(line: number, msg: string) {
    this.diag.push({ line, col: 0, severity: "error", message: msg });
  }
}

const BUILTIN_FUNCS = new Set([
  "ema", "sma", "vwap", "highest", "lowest", "crossover", "crossunder",
  "atr", "rsi", "stdev", "plot", "strategy", "input", "max", "min", "abs",
]);

const BUILTIN_SERIES = new Set(["open", "high", "low", "close", "volume", "time", "hl2", "hlc3", "ohlc4", "vwap"]);

export function compileStrategy(src: string): ZSCompileResult {
  const diag: ZSDiagnostic[] = [];
  const inputs: ZSInput[] = [];
  let name = "Untitled";
  const toks = tokenize(src);
  const parser = new Parser(toks, diag);
  const ast = parser.parse();

  // Walk for input.* and strategy() declarations + validation
  const seenIdents = new Set<string>([...BUILTIN_SERIES, ...BUILTIN_FUNCS]);
  function walk(n: ZSNode | null | undefined) {
    if (!n) return;
    switch (n.kind) {
      case "call": {
        if (n.callee === "strategy") {
          if (n.args[0]?.value.kind === "str") name = (n.args[0].value as { value: string }).value;
        }
        if (n.callee.startsWith("input.")) {
          const t = n.callee.split(".")[1];
          const an = n.args[0]?.value;
          if (an?.kind === "str") {
            const inp: ZSInput = {
              name: (an as { value: string }).value,
              type: (t === "int" ? "int" : t === "bool" ? "bool" : t === "string" ? "string" : "float"),
              default: t === "int" || t === "float" ? Number((n.args[1]?.value as { value?: number })?.value ?? 0) : t === "bool" ? Boolean((n.args[1]?.value as { value?: boolean })?.value) : String((n.args[1]?.value as { value?: string })?.value ?? ""),
              minval: (n.args.find((a) => a.name === "minval")?.value as { value?: number })?.value,
              maxval: (n.args.find((a) => a.name === "maxval")?.value as { value?: number })?.value,
              step: (n.args.find((a) => a.name === "step")?.value as { value?: number })?.value,
            };
            inputs.push(inp);
          }
        }
        if (!BUILTIN_FUNCS.has(n.callee) && !n.callee.startsWith("input.") && !n.callee.startsWith("strategy.")) {
          diag.push({ line: n.line, col: 0, severity: "warning", message: `Unknown function "${n.callee}"` });
        }
        for (const a of n.args) walk(a.value);
        break;
      }
      case "assign":
        seenIdents.add(n.target);
        walk(n.value);
        break;
      case "if":
        walk(n.cond);
        n.body.forEach(walk);
        break;
      case "binop":
        walk(n.l); walk(n.r); break;
      case "ident":
        if (!seenIdents.has(n.name)) {
          diag.push({ line: 0, col: 0, severity: "warning", message: `Unknown identifier "${n.name}"` });
        }
        break;
    }
  }
  ast.forEach(walk);

  if (!inputs.length) {
    diag.push({ line: 0, col: 0, severity: "info", message: "No inputs declared — strategy runs with fixed parameters." });
  }
  const errors = diag.filter((d) => d.severity === "error");
  return { ok: errors.length === 0, inputs, diagnostics: diag, name, compiledAt: Date.now(), ast };
}
