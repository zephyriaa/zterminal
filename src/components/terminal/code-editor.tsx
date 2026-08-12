"use client";

import { useEffect, useMemo, useRef } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}

const KEYWORDS = new Set([
  "if", "else", "for", "while", "var", "true", "false",
  "and", "or", "not", "na",
]);
const BUILTIN = new Set([
  "strategy", "input", "plot", "ema", "sma", "vwap", "highest", "lowest",
  "crossover", "crossunder", "atr", "rsi", "stdev", "max", "min", "abs",
  "open", "high", "low", "close", "volume", "time", "hl2", "hlc3", "ohlc4",
  "long", "short",
]);

interface Token {
  type: "kw" | "builtin" | "str" | "num" | "comment" | "ident" | "op" | "punct" | "ws" | "nl";
  v: string;
}

function tokenizeLine(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "#") {
      out.push({ type: "comment", v: line.slice(i) });
      break;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j++;
      out.push({ type: "str", v: line.slice(i, Math.min(j + 1, line.length)) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(line[i + 1] || ""))) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      out.push({ type: "num", v: line.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_\.]/.test(line[j])) j++;
      const w = line.slice(i, j);
      if (KEYWORDS.has(w)) out.push({ type: "kw", v: w });
      else if (BUILTIN.has(w) || w.includes(".")) out.push({ type: "builtin", v: w });
      else out.push({ type: "ident", v: w });
      i = j;
      continue;
    }
    if (/[+\-*/%<>=!]/.test(ch)) {
      let j = i;
      while (j < line.length && /[+\-*/%<>=!]/.test(line[j])) j++;
      out.push({ type: "op", v: line.slice(i, j) });
      i = j;
      continue;
    }
    if (/[(),{}]/.test(ch)) {
      out.push({ type: "punct", v: ch });
      i++;
      continue;
    }
    // whitespace / other
    let j = i;
    while (j < line.length && /\s/.test(line[j])) j++;
    if (j > i) { out.push({ type: "ws", v: line.slice(i, j) }); i = j; continue; }
    out.push({ type: "ident", v: ch });
    i++;
  }
  return out;
}

const COLOR: Record<Token["type"], string> = {
  kw: "color: var(--research);",
  builtin: "color: var(--mdata);",
  str: "color: var(--warn);",
  num: "color: var(--pos);",
  comment: "color: var(--muted-foreground); font-style: italic;",
  ident: "color: var(--foreground);",
  op: "color: var(--neg);",
  punct: "color: var(--muted-foreground);",
  ws: "",
  nl: "",
};

export function CodeEditor({ value, onChange, readOnly }: CodeEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => value.split("\n"), [value]);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  useEffect(() => {
    syncScroll();
  }, [value]);

  return (
    <div className="relative h-full w-full bg-background font-mono-num text-[12.5px] leading-[1.55] overflow-hidden flex">
      {/* gutter */}
      <div
        ref={gutterRef}
        className="select-none text-right text-muted-foreground/50 bg-panel border-r hairline overflow-hidden py-2 px-2"
        style={{ minWidth: 44 }}
        aria-hidden
      >
        {lines.map((_, i) => (
          <div key={i} className="tnum">{i + 1}</div>
        ))}
      </div>
      {/* code area */}
      <div className="relative flex-1 overflow-hidden">
        <pre
          ref={preRef}
          aria-hidden
          className="absolute inset-0 m-0 overflow-auto py-2 px-3 whitespace-pre pointer-events-none"
          style={{ tabSize: 2 }}
        >
          {lines.map((line, i) => (
            <div key={i}>
              {tokenizeLine(line).map((tk, j) => (
                <span key={j} style={COLOR[tk.type] ? { color: undefined, ...parseStyle(COLOR[tk.type]) } : undefined}>
                  {tk.v}
                </span>
              ))}
              {line.length === 0 ? "\u200b" : ""}
            </div>
          ))}
        </pre>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-foreground resize-none outline-none overflow-auto py-2 px-3 whitespace-pre"
          style={{ tabSize: 2 }}
          aria-label="Strategy source code editor"
        />
      </div>
    </div>
  );
}

function parseStyle(s: string): React.CSSProperties {
  // convert "color: var(--x); font-style: italic;" to a camelCased object
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const [k, v] = part.split(":").map((x) => x?.trim());
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      out[camel] = v;
    }
  }
  return out as React.CSSProperties;
}
