export type ZSInput = {
  name: string;
  type: "float" | "int" | "bool" | "string";
  default: number | string | boolean;
  minval?: number;
  maxval?: number;
  step?: number;
};

export type ZSDiagnostic = {
  line: number;
  col: number;
  severity: "error" | "warning" | "info";
  message: string;
};

export type ZSArg = { name?: string; value: ZSNode };
export type ZSNode =
  | { kind: "call"; callee: string; args: ZSArg[]; line: number }
  | { kind: "assign"; target: string; value: ZSNode; line: number }
  | { kind: "if"; cond: ZSNode; body: ZSNode[]; line: number }
  | { kind: "ident"; name: string; line: number }
  | { kind: "num"; value: number; line: number }
  | { kind: "str"; value: string; line: number }
  | { kind: "bool"; value: boolean; line: number }
  | { kind: "binop"; op: string; left: ZSNode; right: ZSNode; line: number };

export type ZSCompileResult = {
  ok: boolean;
  inputs: ZSInput[];
  diagnostics: ZSDiagnostic[];
  name: string;
  ast: ZSNode[] | null;
  engineVersion: "zs-closed-compiler-v1";
};

type Token = { type: "number" | "string" | "identifier" | "operator" | "punctuation"; value: string; line: number; col: number };

const MAX_SOURCE_LENGTH = 16_000;
const ALLOWED_INPUTS = new Set(["input.float", "input.int", "input.bool", "input.string"]);
const ALLOWED_FUNCTIONS = new Set(["ema", "sma", "vwap", "highest", "lowest", "crossover", "crossunder", "atr", "rsi", "stdev", "plot", "max", "min", "abs"]);
const ALLOWED_ACTIONS = new Set(["strategy", "strategy.entry", "strategy.exit", "strategy.close"]);
const BUILTIN_SERIES = new Set(["open", "high", "low", "close", "volume", "time", "hl2", "hlc3", "ohlc4", "vwap", "strategy.long", "strategy.short"]);
const FORBIDDEN_IDENTIFIERS = new Set([
  "eval", "function", "import", "export", "require", "fetch", "xmlhttprequest", "websocket", "process", "globalthis", "window", "document", "fs", "child_process", "deno", "bun", "axios", "http", "https",
]);

function pushDiagnostic(target: ZSDiagnostic[], line: number, col: number, message: string, severity: ZSDiagnostic["severity"] = "error") {
  target.push({ line, col, severity, message });
}

function tokenize(source: string, diagnostics: ZSDiagnostic[]): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let col = 1;
  const push = (type: Token["type"], value: string, tokenLine = line, tokenCol = col) => tokens.push({ type, value, line: tokenLine, col: tokenCol });
  const take = () => { const value = source[index] ?? ""; index += 1; col += 1; return value; };

  while (index < source.length) {
    const character = source[index] ?? "";
    if (character === "\n") { index += 1; line += 1; col = 1; continue; }
    if (/\s/.test(character)) { take(); continue; }
    if (character === "#") { while (index < source.length && source[index] !== "\n") take(); continue; }
    const startLine = line;
    const startCol = col;
    if (character === '"' || character === "'") {
      const quote = take();
      let value = "";
      let terminated = false;
      while (index < source.length) {
        const next = source[index] ?? "";
        if (next === quote) { take(); terminated = true; break; }
        if (next === "\n") break;
        if (next === "\\" && index + 1 < source.length) { take(); value += take(); continue; }
        value += take();
      }
      if (!terminated) pushDiagnostic(diagnostics, startLine, startCol, "Unterminated string literal.");
      push("string", value, startLine, startCol);
      continue;
    }
    if (/\d/.test(character) || (character === "." && /\d/.test(source[index + 1] ?? ""))) {
      let value = "";
      let dots = 0;
      while (index < source.length && /[\d.]/.test(source[index] ?? "")) {
        const next = take();
        if (next === ".") dots += 1;
        value += next;
      }
      if (dots > 1 || !Number.isFinite(Number(value))) pushDiagnostic(diagnostics, startLine, startCol, `Invalid numeric literal \`${value}\`.`);
      push("number", value, startLine, startCol);
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      let value = "";
      while (index < source.length && /[A-Za-z0-9_.]/.test(source[index] ?? "")) value += take();
      push("identifier", value, startLine, startCol);
      continue;
    }
    if ("(),".includes(character)) { push("punctuation", take(), startLine, startCol); continue; }
    if ("=!<>".includes(character)) {
      const first = take();
      const value = source[index] === "=" ? `${first}${take()}` : first;
      push("operator", value, startLine, startCol);
      continue;
    }
    if ("+-*/%".includes(character)) { push("operator", take(), startLine, startCol); continue; }
    pushDiagnostic(diagnostics, startLine, startCol, `Unsupported token \`${character}\` in the closed ZS grammar.`);
    take();
  }
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[], private readonly diagnostics: ZSDiagnostic[]) {}

  private peek(offset = 0) { return this.tokens[this.index + offset]; }
  private take() { const token = this.tokens[this.index]; this.index += 1; return token; }
  private error(token: Token | undefined, message: string) { pushDiagnostic(this.diagnostics, token?.line ?? 0, token?.col ?? 0, message); }

  parse(): ZSNode[] {
    const statements: ZSNode[] = [];
    while (this.peek()) {
      const statement = this.parseStatement();
      if (statement) statements.push(statement);
      else if (this.peek()) this.take();
    }
    return statements;
  }

  private parseStatement(): ZSNode | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === "identifier" && token.value === "if") return this.parseIf();
    if (token.type === "identifier" && token.value === "var") {
      const declaration = this.take();
      const target = this.take();
      const equals = this.take();
      if (!target || target.type !== "identifier") this.error(target, "Expected identifier after `var`.");
      if (!equals || equals.type !== "operator" || equals.value !== "=") this.error(equals, "Expected `=` in variable declaration.");
      const value = this.parseExpression();
      return { kind: "assign", target: target?.value ?? "", value, line: declaration.line };
    }
    const expression = this.parseExpression();
    const equals = this.peek();
    if (equals?.type === "operator" && equals.value === "=") {
      this.take();
      const value = this.parseExpression();
      if (expression.kind !== "ident") { this.error(equals, "Only identifiers may appear on the left side of an assignment."); return null; }
      return { kind: "assign", target: expression.name, value, line: expression.line };
    }
    return expression;
  }

  private parseIf(): ZSNode {
    const start = this.take()!;
    const condition = this.parseExpression();
    const next = this.peek();
    const body: ZSNode[] = [];
    if (!next || (next.type === "identifier" && next.value === "else")) {
      this.error(next, "An `if` statement requires one following statement.");
    } else {
      const nested = this.parseStatement();
      if (nested) body.push(nested);
    }
    return { kind: "if", cond: condition, body, line: start.line };
  }

  private parseExpression(): ZSNode { return this.parseComparison(); }
  private parseComparison(): ZSNode {
    let node = this.parseAdditive();
    while (this.peek()?.type === "operator" && [">", "<", ">=", "<=", "==", "!="].includes(this.peek()!.value)) {
      const operator = this.take()!;
      node = { kind: "binop", op: operator.value, left: node, right: this.parseAdditive(), line: operator.line };
    }
    return node;
  }
  private parseAdditive(): ZSNode {
    let node = this.parseMultiplicative();
    while (this.peek()?.type === "operator" && ["+", "-"].includes(this.peek()!.value)) {
      const operator = this.take()!;
      node = { kind: "binop", op: operator.value, left: node, right: this.parseMultiplicative(), line: operator.line };
    }
    return node;
  }
  private parseMultiplicative(): ZSNode {
    let node = this.parseUnary();
    while (this.peek()?.type === "operator" && ["*", "/", "%"].includes(this.peek()!.value)) {
      const operator = this.take()!;
      node = { kind: "binop", op: operator.value, left: node, right: this.parseUnary(), line: operator.line };
    }
    return node;
  }
  private parseUnary(): ZSNode {
    const token = this.peek();
    if (token?.type === "operator" && ["-", "!"].includes(token.value)) {
      this.take();
      return { kind: "binop", op: token.value, left: { kind: "num", value: 0, line: token.line }, right: this.parseUnary(), line: token.line };
    }
    return this.parsePrimary();
  }
  private parsePrimary(): ZSNode {
    const token = this.take();
    if (!token) { this.error(token, "Expected expression but reached end of source."); return { kind: "num", value: 0, line: 0 }; }
    if (token.type === "number") return { kind: "num", value: Number(token.value), line: token.line };
    if (token.type === "string") return { kind: "str", value: token.value, line: token.line };
    if (token.type === "punctuation" && token.value === "(") {
      const expression = this.parseExpression();
      const close = this.take();
      if (!close || close.type !== "punctuation" || close.value !== ")") this.error(close, "Expected `)` after parenthesized expression.");
      return expression;
    }
    if (token.type !== "identifier") { this.error(token, `Expected expression, received \`${token.value}\`.`); return { kind: "num", value: 0, line: token.line }; }
    if (token.value === "true" || token.value === "false") return { kind: "bool", value: token.value === "true", line: token.line };
    if (this.peek()?.type !== "punctuation" || this.peek()?.value !== "(") return { kind: "ident", name: token.value, line: token.line };
    this.take();
    const args: ZSArg[] = [];
    while (this.peek() && !(this.peek()?.type === "punctuation" && this.peek()?.value === ")")) {
      const current = this.peek();
      const after = this.peek(1);
      if (current?.type === "identifier" && after?.type === "operator" && after.value === "=") {
        const name = this.take()!.value;
        this.take();
        args.push({ name, value: this.parseExpression() });
      } else {
        args.push({ value: this.parseExpression() });
      }
      if (this.peek()?.type === "punctuation" && this.peek()?.value === ",") this.take();
      else break;
    }
    const close = this.take();
    if (!close || close.type !== "punctuation" || close.value !== ")") this.error(close, `Expected closing \`)\` for call to \`${token.value}\`.`);
    return { kind: "call", callee: token.value, args, line: token.line };
  }
}

function walk(node: ZSNode, visit: (node: ZSNode) => void) {
  visit(node);
  if (node.kind === "call") node.args.forEach(argument => walk(argument.value, visit));
  if (node.kind === "assign") walk(node.value, visit);
  if (node.kind === "if") { walk(node.cond, visit); node.body.forEach(child => walk(child, visit)); }
  if (node.kind === "binop") { walk(node.left, visit); walk(node.right, visit); }
}

function literal(node: ZSNode | undefined): number | string | boolean | undefined {
  if (!node) return undefined;
  if (node.kind === "num" || node.kind === "str" || node.kind === "bool") return node.value;
  return undefined;
}

function readInput(node: Extract<ZSNode, { kind: "call" }>, diagnostics: ZSDiagnostic[]): ZSInput | null {
  const subtype = node.callee.slice("input.".length) as ZSInput["type"];
  const name = literal(node.args[0]?.value);
  const defaultValue = literal(node.args[1]?.value);
  if (typeof name !== "string" || defaultValue === undefined) {
    pushDiagnostic(diagnostics, node.line, 0, `\`${node.callee}\` requires a string label and fixed default literal.`);
    return null;
  }
  if (subtype === "float" || subtype === "int") {
    if (typeof defaultValue !== "number" || !Number.isFinite(defaultValue)) { pushDiagnostic(diagnostics, node.line, 0, `\`${node.callee}\` requires a finite numeric default.`); return null; }
    if (subtype === "int" && !Number.isInteger(defaultValue)) { pushDiagnostic(diagnostics, node.line, 0, "`input.int` requires an integer default."); return null; }
    const range = (name: "minval" | "maxval" | "step") => literal(node.args.find(argument => argument.name === name)?.value);
    const minval = range("minval"); const maxval = range("maxval"); const step = range("step");
    if ([minval, maxval, step].some(value => value !== undefined && (typeof value !== "number" || !Number.isFinite(value)))) pushDiagnostic(diagnostics, node.line, 0, "Input bounds and step must be fixed finite numeric literals.");
    if (typeof minval === "number" && typeof maxval === "number" && minval > maxval) pushDiagnostic(diagnostics, node.line, 0, "Input minimum may not exceed maximum.");
    return { name, type: subtype, default: defaultValue, ...(typeof minval === "number" ? { minval } : {}), ...(typeof maxval === "number" ? { maxval } : {}), ...(typeof step === "number" ? { step } : {}) };
  }
  if (subtype === "bool" && typeof defaultValue !== "boolean") { pushDiagnostic(diagnostics, node.line, 0, "`input.bool` requires a boolean default."); return null; }
  if (subtype === "string" && typeof defaultValue !== "string") { pushDiagnostic(diagnostics, node.line, 0, "`input.string` requires a string default."); return null; }
  return { name, type: subtype, default: defaultValue };
}

/**
 * Compiles a deliberately closed strategy grammar into syntax metadata only.
 * It does not evaluate, transpile, dynamically import, fetch, persist, route,
 * or place orders from user-supplied source.
 */
export function compileZS(source: string): ZSCompileResult {
  const diagnostics: ZSDiagnostic[] = [];
  if (source.length > MAX_SOURCE_LENGTH) pushDiagnostic(diagnostics, 0, 0, `Source exceeds the ${MAX_SOURCE_LENGTH.toLocaleString("en-US")}-character closed-compiler limit.`);
  const tokens = tokenize(source.slice(0, MAX_SOURCE_LENGTH), diagnostics);
  for (const token of tokens) {
    if (token.type === "identifier" && FORBIDDEN_IDENTIFIERS.has(token.value.toLowerCase())) pushDiagnostic(diagnostics, token.line, token.col, `Forbidden capability identifier \`${token.value}\` is not part of ZS.`);
  }
  const parser = new Parser(tokens, diagnostics);
  const ast = parser.parse();
  const inputs: ZSInput[] = [];
  const knownIdentifiers = new Set(BUILTIN_SERIES);
  let name = "Untitled strategy";
  for (const statement of ast) walk(statement, node => {
    if (node.kind === "assign") { knownIdentifiers.add(node.target); return; }
    if (node.kind === "call") {
      if (node.callee === "strategy") {
        const declaredName = literal(node.args[0]?.value);
        if (typeof declaredName === "string" && declaredName.trim()) name = declaredName.trim();
      }
      if (node.callee.startsWith("input.")) {
        if (!ALLOWED_INPUTS.has(node.callee)) pushDiagnostic(diagnostics, node.line, 0, `Unsupported input constructor \`${node.callee}\` in the closed ZS grammar.`);
        else {
          const input = readInput(node, diagnostics);
          if (input) { inputs.push(input); knownIdentifiers.add(input.name); }
        }
      } else if (!ALLOWED_FUNCTIONS.has(node.callee) && !ALLOWED_ACTIONS.has(node.callee)) {
        pushDiagnostic(diagnostics, node.line, 0, `Unsupported function or action \`${node.callee}\` in the closed ZS grammar.`);
      }
      return;
    }
    if (node.kind === "ident" && !knownIdentifiers.has(node.name)) pushDiagnostic(diagnostics, node.line, 0, `Unknown identifier \`${node.name}\`.`);
  });
  if (!inputs.length) pushDiagnostic(diagnostics, 0, 0, "No inputs declared — the source currently has fixed parameters.", "info");
  return { ok: !diagnostics.some(diagnostic => diagnostic.severity === "error"), inputs, diagnostics, name, ast: diagnostics.some(diagnostic => diagnostic.severity === "error") ? null : ast, engineVersion: "zs-closed-compiler-v1" };
}
