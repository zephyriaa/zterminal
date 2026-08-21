"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, FileCode2, ShieldCheck } from "lucide-react";

const LLM_BRIEF = `You are writing a strategy for ZTerminal's ZScript (ZS) language. ZS is a small custom deterministic strategy DSL. It is NOT Pine Script and is not Pine-compatible.

Use only these declarations and calls:
- strategy("Name", overlay=true)
- input.float/int/bool/string("Name", default, minval=, maxval=, step=)
- var name = expression
- if condition followed by one statement
- plot(series, "Label")
- series: open, high, low, close, volume, time, hl2, hlc3, ohlc4, vwap
- functions: ema, sma, vwap, highest, lowest, atr, rsi, stdev, crossover, crossunder, max, min, abs
- actions: strategy.entry("id", strategy.long | strategy.short, qty=N), strategy.close("id"), strategy.exit("id")
- operators: + - * / %, > < >= <= == !=, unary - and !
- # comments to end of line

Hard constraints:
1. Do NOT use Pine namespaces or APIs such as ta.*, request.security, plotshape, barmerge, arrays, loops, user-defined functions, or multi-statement if blocks.
2. Do NOT claim live execution, broker routing, future prediction, or unsupported order types.
3. Return exactly four sections: ZS SOURCE, RATIONALE, PARAMETERS, and VALIDATION PLAN.
4. State assumptions, the exact signal/exit logic, and at least one failure mode. Keep each if body to one statement.
5. If the requested idea cannot be represented by this subset, say what is unsupported and propose the smallest supported alternative.

Strategy request:
[Describe your research hypothesis, selected symbol/timeframe, and risk assumptions here.]`;

const EXAMPLE = `# EMA Cross + VWAP Filter
strategy("EMA Cross + VWAP Filter", overlay=true)

input.float("Fast", 8, minval=1, maxval=200, step=1)
input.float("Slow", 21, minval=1, maxval=400, step=1)

var fastEma = ema(close, Fast)
var slowEma = ema(close, Slow)
plot(fastEma, "EMA Fast")
plot(slowEma, "EMA Slow")

if close > vwap
  if crossover(fastEma, slowEma)
    strategy.entry("long", strategy.long, qty=1)

if crossunder(fastEma, slowEma)
  strategy.close("long")`;

export default function ZScriptDocumentationPage() {
  const [copied, setCopied] = useState(false);
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(LLM_BRIEF); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };

  return <main className="min-h-screen bg-background text-foreground font-sans"><header className="sticky top-0 z-20 border-b hairline bg-panel/95 backdrop-blur px-3 py-2.5 sm:px-5 sm:py-3"><div className="mx-auto flex max-w-5xl items-center gap-2 sm:gap-3"><Link href="/" className="grid h-7 w-7 place-items-center rounded-[5px] text-mdata hover:bg-hover" aria-label="Back to ZTerminal"><ArrowLeft className="h-4 w-4" /></Link><div className="h-5 w-px bg-foreground/10" /><div><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Language reference</div><h1 className="text-sm font-semibold">ZScript (ZS)</h1></div><span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[10px] text-warn"><ShieldCheck className="h-3.5 w-3.5" />Research runtime · no broker route</span></div></header>
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_220px] gap-5 px-3 py-6 sm:gap-8 sm:px-5 sm:py-9 max-lg:grid-cols-1"><article className="min-w-0 space-y-8"><section><div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-mdata"><FileCode2 className="h-3.5 w-3.5" />Compiler-aligned reference</div><h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">Write reproducible strategies without pretending ZS is Pine.</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">ZScript is a small custom DSL for deterministic, bar-by-bar research. The same source, verified candles, configuration, and parameters yield the same result. Signals are evaluated on one bar and entries fill at the next bar open.</p></section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Callout title="ZS is" tone="mdata">A constrained strategy language with inputs, series, indicator functions, plots, and deterministic next-bar evaluation.</Callout><Callout title="ZS is not" tone="warn">Pine Script, a live-trading language, or a general-purpose programming language. Pine source will not compile unchanged.</Callout></section>
      <section id="quickstart"><Heading n="01" title="Minimal supported shape" /><pre className="mt-3 overflow-x-auto border hairline bg-surface/45 p-4 text-[11px] leading-6 text-foreground/90"><code>{EXAMPLE}</code></pre><p className="mt-3 text-sm leading-7 text-muted-foreground">Top-level <code>var</code> assignments define lazy series. Each <code>if</code> consumes only one following statement; use nested or separate <code>if</code> statements rather than indentation-based multi-statement blocks.</p></section>
      <section><Heading n="02" title="Supported building blocks" /><div className="mt-3 overflow-x-auto border hairline"><table className="w-full text-left text-[11px]"><thead className="border-b hairline bg-surface/45 text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Available</th></tr></thead><tbody className="divide-y divide-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"><Row label="Series" value="open, high, low, close, volume, time, hl2, hlc3, ohlc4, vwap" /><Row label="Functions" value="ema, sma, vwap, highest, lowest, atr, rsi, stdev, crossover, crossunder, max, min, abs" /><Row label="Inputs" value="input.float, input.int, input.bool, input.string" /><Row label="Actions" value="strategy.entry, strategy.close, strategy.exit; long and short constants" /><Row label="Plot" value="plot(series, label). It declares analytical intent in a strategy; strategy-defined plot rendering is not yet available. Use the separate native Studies panel for EMA, SMA, and session-VWAP overlays." /></tbody></table></div></section>
      <section><Heading n="03" title="LLM strategy authoring brief" /><p className="mt-3 text-sm leading-7 text-muted-foreground">Copy this brief into the LLM of your choice, add your research hypothesis, and ask it to return only compiler-compatible ZS. It deliberately makes the model name unsupported requirements instead of inventing code.</p><div className="mt-3 border hairline bg-surface/45"><div className="flex items-center justify-between border-b hairline px-3 py-2"><span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Prompt template · ZS v1 subset</span><button onClick={copyBrief} className="inline-flex h-7 items-center gap-1.5 rounded-[4px] border hairline px-2 text-[10px] text-foreground hover:bg-hover">{copied ? <Check className="h-3 w-3 text-pos" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy prompt"}</button></div><pre className="max-h-72 overflow-auto p-3 text-[10px] leading-5 text-muted-foreground"><code>{LLM_BRIEF}</code></pre></div></section>
      <section><Heading n="04" title="Known limits" /><ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground"><li>There are no loops, arrays, user-defined functions, external data requests, or Pine namespaces.</li><li>There is no broker route or live order submission. Strategy actions exist only within deterministic research evaluation.</li><li>Limit, stop, bracket, and multi-statement conditional behavior are not available in the present compiler subset.</li><li>Compiler diagnostics identify parser and compatibility issues before a backtest is accepted.</li></ul></section>
    </article><aside className="h-fit border hairline bg-panel p-3 max-lg:order-first max-lg:overflow-x-auto"><div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">On this page</div><nav className="mt-3 space-y-1 text-[11px]"><a href="#quickstart" className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-hover hover:text-foreground">Minimal supported shape</a><a href="#" className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-hover hover:text-foreground">Supported building blocks</a><a href="#" className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-hover hover:text-foreground">LLM authoring brief</a></nav><div className="mt-5 border-t hairline pt-3 text-[10px] leading-5 text-muted-foreground">This reference follows the ZTerminal compiler and runtime. It is deliberately narrower than Pine Script.</div></aside></div>
  </main>;
}

function Heading({ n, title }: { n: string; title: string }) { return <div className="flex items-center gap-3"><span className="font-mono-num text-[10px] text-mdata">{n}</span><h2 className="text-xl font-semibold">{title}</h2></div>; }
function Callout({ title, tone, children }: { title: string; tone: "mdata" | "warn"; children: React.ReactNode }) { return <div className="border hairline bg-surface/30 p-3"><div className={tone === "mdata" ? "text-[10px] uppercase tracking-[0.14em] text-mdata" : "text-[10px] uppercase tracking-[0.14em] text-warn"}>{title}</div><div className="mt-2 text-[11px] leading-5 text-muted-foreground">{children}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <tr><td className="px-3 py-2 font-medium text-foreground">{label}</td><td className="px-3 py-2 leading-5 text-muted-foreground">{value}</td></tr>; }
