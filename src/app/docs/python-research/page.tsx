"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, FileCode2, ShieldCheck } from "lucide-react";

const PYTHON_BRIEF = `You are writing a read-only ZTerminal research artifact in Python. Use only the zterminal_research SDK.

Allowed imports:
from zterminal_research import indicator, strategy, inputs, ta

Rules:
1. Define exactly one @indicator(...) or @strategy(...) function. The first parameter must be ctx.
2. Use ctx.open, ctx.high, ctx.low, ctx.close, and ctx.volume only as observed series. Never access future data.
3. Use approved helpers such as ta.sma, ta.ema, ta.crossover, and ta.crossunder.
4. A strategy may only emit ctx.enter_long(...), ctx.enter_short(...), or ctx.close_position(...). It cannot place broker orders.
5. Do not import network, filesystem, subprocess, operating-system, dynamic-evaluation, or third-party packages.
6. Declare parameters with inputs.int/float/bool/string when configurable values are needed.
7. State the hypothesis, data assumptions, signal logic, exit logic, and at least one failure mode after the code.
8. Do not claim profitability, future prediction, Pine equivalence, broker integration, or live execution.

Return exactly: PYTHON SOURCE, RATIONALE, PARAMETERS, VALIDATION PLAN.

Research request:
[Describe the market, timeframe, hypothesis, parameter bounds, and cost assumptions.]`;

const EXAMPLE = `from zterminal_research import strategy, inputs, ta

@strategy(name="EMA cross")
def ema_cross(
    ctx,
    fast=inputs.int(8, min=1, max=200),
    slow=inputs.int(21, min=2, max=400),
):
    fast_ema = ta.ema(ctx.close, fast)
    slow_ema = ta.ema(ctx.close, slow)
    if ta.crossover(fast_ema, slow_ema)[ctx.index]:
        ctx.enter_long(quantity=1, reason="ema_cross")
    if ta.crossunder(fast_ema, slow_ema)[ctx.index]:
        ctx.close_position(reason="ema_cross_down")`;

export default function PythonResearchDocumentationPage() {
  const [copied, setCopied] = useState(false);
  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(PYTHON_BRIEF);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return <main className="min-h-screen bg-background text-foreground font-sans"><header className="sticky top-0 z-20 border-b hairline bg-panel/95 backdrop-blur px-3 py-2.5 sm:px-5 sm:py-3"><div className="mx-auto flex max-w-5xl items-center gap-2 sm:gap-3"><Link href="/terminal" className="grid h-7 w-7 place-items-center rounded-[5px] text-mdata hover:bg-hover" aria-label="Back to ZTerminal"><ArrowLeft className="h-4 w-4" /></Link><div className="h-5 w-px bg-foreground/10" /><div><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Research runtime reference</div><h1 className="text-sm font-semibold">Python Research API</h1></div><span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[10px] text-warn"><ShieldCheck className="h-3.5 w-3.5" />Research only · no broker route</span></div></header>
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_220px] gap-5 px-3 py-6 sm:gap-8 sm:px-5 sm:py-9 max-lg:grid-cols-1"><article className="min-w-0 space-y-8"><section><div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-mdata"><FileCode2 className="h-3.5 w-3.5" />Python-first research</div><h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">Write reproducible indicators and strategies in constrained Python.</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">ZTerminal is retiring ZS for new research. New code uses a version-pinned Python SDK, runs only in an isolated research worker, and sends bounded intents to a deterministic Rust execution engine. The worker cannot route orders, access a brokerage account, open a network connection, or silently replace unavailable data.</p></section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Callout title="Python research is" tone="mdata">A versioned, inspectable artifact with provider-labelled data provenance, deterministic policies, and a reproducible run manifest.</Callout><Callout title="Python research is not" tone="warn">A general host Python environment, live-trading interface, brokerage connector, or promise that an imported Pine script is equivalent.</Callout></section>
      <section id="quickstart"><Heading n="01" title="Minimal strategy shape" /><pre className="mt-3 overflow-x-auto border hairline bg-surface/45 p-4 text-[11px] leading-6 text-foreground/90"><code>{EXAMPLE}</code></pre><p className="mt-3 text-sm leading-7 text-muted-foreground">Signals are emitted on an observed bar. The Rust research core applies the declared next-bar execution policy, costs, and fills. A callback cannot fill against the bar that generated its signal.</p></section>
      <section><Heading n="02" title="Allowed contract" /><div className="mt-3 overflow-x-auto border hairline"><table className="w-full text-left text-[11px]"><thead className="border-b hairline bg-surface/45 text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Surface</th><th className="px-3 py-2 font-medium">Available</th></tr></thead><tbody className="divide-y divide-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"><Row label="Decorators" value="@indicator(name=, overlay=), @strategy(name=, overlay=)" /><Row label="Inputs" value="inputs.int, inputs.float, inputs.bool, inputs.string" /><Row label="Observed series" value="ctx.open, ctx.high, ctx.low, ctx.close, ctx.volume" /><Row label="Initial helpers" value="ta.sma, ta.ema, ta.crossover, ta.crossunder" /><Row label="Research intents" value="ctx.enter_long, ctx.enter_short, ctx.close_position" /><Row label="Blocked" value="Network, filesystem, subprocesses, arbitrary imports, broker APIs, direct order fills, and future-bar access." /></tbody></table></div></section>
      <section><Heading n="03" title="Pine source conversion" /><p className="mt-3 text-sm leading-7 text-muted-foreground">Paste only source that you own or are authorized to convert. The importer produces a capability report and Python review draft. It blocks unsupported multi-symbol requests, lookahead/repainting configurations, protected dependencies, brokerage behaviour, and non-reproducible visual features. A conversion is not runnable until you review it, validate it, and complete its fixture-based test.</p></section>
      <section><Heading n="04" title="LLM authoring brief" /><p className="mt-3 text-sm leading-7 text-muted-foreground">Use this prompt with an LLM to draft a constrained Python research artifact. Always review the output and run it only against verified provider data.</p><div className="mt-3 border hairline bg-surface/45"><div className="flex items-center justify-between border-b hairline px-3 py-2"><span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Prompt template · Python Research API</span><button onClick={copyBrief} className="inline-flex h-7 items-center gap-1.5 rounded-[4px] border hairline px-2 text-[10px] text-foreground hover:bg-hover">{copied ? <Check className="h-3 w-3 text-pos" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy prompt"}</button></div><pre className="max-h-72 overflow-auto p-3 text-[10px] leading-5 text-muted-foreground"><code>{PYTHON_BRIEF}</code></pre></div></section>
      <section><Heading n="05" title="ZS archive and migration" /><p className="mt-3 text-sm leading-7 text-muted-foreground">Existing ZS source and historical run records remain exportable and auditable during migration. ZS is not available for new validation, compilation, or execution. Use the Python workspace or the Pine conversion review flow for all new work.</p></section>
    </article><aside className="h-fit border hairline bg-panel p-3 max-lg:order-first max-lg:overflow-x-auto"><div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">On this page</div><nav className="mt-3 space-y-1 text-[11px]"><a href="#quickstart" className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-hover hover:text-foreground">Minimal strategy shape</a><a href="#" className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-hover hover:text-foreground">Allowed contract</a><a href="#" className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-hover hover:text-foreground">Pine conversion</a></nav><div className="mt-5 border-t hairline pt-3 text-[10px] leading-5 text-muted-foreground">Every successful research run stores the source, runtime, engine, execution policy, and provider-labelled data manifest needed for later review.</div></aside></div>
  </main>;
}

function Heading({ n, title }: { n: string; title: string }) { return <div className="flex items-center gap-3"><span className="font-mono-num text-[10px] text-mdata">{n}</span><h2 className="text-xl font-semibold">{title}</h2></div>; }
function Callout({ title, tone, children }: { title: string; tone: "mdata" | "warn"; children: React.ReactNode }) { return <div className="border hairline bg-surface/30 p-3"><div className={tone === "mdata" ? "text-[10px] uppercase tracking-[0.14em] text-mdata" : "text-[10px] uppercase tracking-[0.14em] text-warn"}>{title}</div><div className="mt-2 text-[11px] leading-5 text-muted-foreground">{children}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <tr><td className="px-3 py-2 font-medium text-foreground">{label}</td><td className="px-3 py-2 leading-5 text-muted-foreground">{value}</td></tr>; }
