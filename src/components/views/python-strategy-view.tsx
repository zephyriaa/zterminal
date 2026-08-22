"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Code2, FileCode2, FlaskConical, Play, ShieldCheck, Upload } from "lucide-react";
import { CodeEditor } from "../terminal/code-editor";
import { useWorkspace } from "@/stores/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_STRATEGY_SOURCE = `from zterminal_research import strategy, inputs, ta

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
        ctx.close_position(reason="ema_cross_down")
`;

const DEFAULT_INDICATOR_SOURCE = `from zterminal_research import indicator, inputs, ta

@indicator(name="EMA overlay", overlay=True)
def ema_overlay(ctx, length=inputs.int(20, min=1, max=500)):
    return {"ema": ta.ema(ctx.close, length)}
`;

type Diagnostic = { code: string; level: "ERROR" | "WARNING" | "INFO"; message: string; line?: number };
type Validation = { status: "IDLE" | "VALID" | "INVALID" | "UNSUPPORTED"; diagnostics: Diagnostic[]; artifactId?: string; sourceHash?: string };

export function PythonStrategyView() {
  const { symbol, timeframe } = useWorkspace();
  const [artifactKind, setArtifactKind] = useState<"strategy" | "indicator">("strategy");
  const [source, setSource] = useState(DEFAULT_STRATEGY_SOURCE);
  const [pineSource, setPineSource] = useState("");
  const [tab, setTab] = useState<"python" | "pine">("python");
  const [busy, setBusy] = useState<"validate" | "convert" | null>(null);
  const [validation, setValidation] = useState<Validation>({ status: "IDLE", diagnostics: [] });
  const [log, setLog] = useState<string[]>(["Python research workspace ready. User code is not executed in the browser."]);
  const [lookbackDays, setLookbackDays] = useState(30);

  useEffect(() => {
    const createIndicator = () => {
      setArtifactKind("indicator");
      setSource(DEFAULT_INDICATOR_SOURCE);
      setTab("python");
      setValidation({ status: "IDLE", diagnostics: [] });
    };
    window.addEventListener("zterminal:new-python-indicator", createIndicator);
    return () => window.removeEventListener("zterminal:new-python-indicator", createIndicator);
  }, []);

  const statusText = useMemo(() => validation.status === "VALID" ? "Validated" : validation.status === "INVALID" ? "Fix diagnostics" : validation.status === "UNSUPPORTED" ? "Runtime unavailable" : "Not validated", [validation.status]);

  const validate = async () => {
    setBusy("validate");
    try {
      const response = await fetch("/api/research/artifacts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_version: "research.v2.0",
          kind: artifactKind,
          language: "python",
          source,
          runtime_lock: "python-3.12/research-sdk-0.1.0",
          rights_attestation: "I own or am authorized to use this research source.",
          origin: { kind: "native_python" },
        }),
      });
      const data = await response.json();
      const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [{ code: "RESEARCH_API_UNAVAILABLE", level: "ERROR", message: data.error ?? "The Python research API is unavailable." }];
      setValidation({ status: data.status ?? "UNSUPPORTED", diagnostics, artifactId: data.artifact_id, sourceHash: data.source_hash });
      setLog((current) => [`${data.status ?? "UNSUPPORTED"}: ${diagnostics.length} diagnostic(s). Source is validated before a job can be queued.`, ...current].slice(0, 40));
    } catch {
      const diagnostic = { code: "RESEARCH_API_UNAVAILABLE", level: "ERROR" as const, message: "The isolated Python research API is not configured for this deployment." };
      setValidation({ status: "UNSUPPORTED", diagnostics: [diagnostic] });
      setLog((current) => ["UNSUPPORTED: no Python research API is configured. No fallback execution was attempted.", ...current].slice(0, 40));
    } finally {
      setBusy(null);
    }
  };

  const convertPine = async () => {
    setBusy("convert");
    try {
      const response = await fetch("/api/research/pine/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_version: "research.v2.0",
          source: pineSource,
          rights_attestation: "I own or am authorized to convert this Pine source.",
          source_version: "unknown",
          target_kind: artifactKind,
        }),
      });
      const data = await response.json();
      if (typeof data.generated_python === "string") setSource(data.generated_python);
      const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
      setValidation({ status: data.status === "BLOCKED" ? "INVALID" : data.status === "READY_FOR_REVIEW" ? "VALID" : "UNSUPPORTED", diagnostics, sourceHash: data.generated_python_hash });
      setTab("python");
      setLog((current) => [`Pine conversion ${data.status ?? "UNSUPPORTED"}. Review every reported construct before validating the generated Python.`, ...current].slice(0, 40));
    } catch {
      setValidation({ status: "UNSUPPORTED", diagnostics: [{ code: "PINE_SERVICE_UNAVAILABLE", level: "ERROR", message: "The Pine conversion review service is not configured for this deployment." }] });
    } finally {
      setBusy(null);
    }
  };

  return <div className="h-full flex flex-col bg-background"><div className="h-11 shrink-0 border-b hairline bg-panel flex items-center gap-2 px-3"><Code2 className="h-4 w-4 text-mdata" /><div><div className="text-[12px] font-semibold">Python Research {artifactKind === "strategy" ? "Strategy" : "Indicator"}</div><div className="text-[9px] uppercase tracking-[0.13em] text-muted-foreground">Python 3.12 · Rust deterministic engine</div></div><div className="ml-auto flex items-center gap-2"><span className="hidden sm:inline-flex items-center gap-1.5 rounded border hairline px-2 py-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3 text-research" />Research only</span><Link href="/docs/python-research" className="rounded border hairline px-2 py-1 text-[10px] text-mdata hover:bg-hover">Python docs</Link></div></div>
    <div className="flex min-h-0 flex-1"><section className="flex min-w-0 flex-1 flex-col border-r hairline"><div className="flex h-8 items-center gap-1 border-b hairline bg-panel px-2"><button onClick={() => setTab("python")} className={tab === "python" ? "rounded bg-hover px-2 py-1 text-[10px] text-foreground" : "rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"}>Python {artifactKind}</button><button onClick={() => { setArtifactKind(artifactKind === "strategy" ? "indicator" : "strategy"); setSource(artifactKind === "strategy" ? DEFAULT_INDICATOR_SOURCE : DEFAULT_STRATEGY_SOURCE); setValidation({ status: "IDLE", diagnostics: [] }); }} className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Switch to {artifactKind === "strategy" ? "indicator" : "strategy"}</button><button onClick={() => setTab("pine")} className={tab === "pine" ? "rounded bg-hover px-2 py-1 text-[10px] text-foreground" : "rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"}>Import Pine source</button><div className="ml-auto flex gap-1"><Button size="sm" variant="outline" disabled={busy !== null || tab !== "python"} onClick={validate} className="h-6 gap-1 px-2 text-[10px]"><FlaskConical className="h-3 w-3" />{busy === "validate" ? "Validating…" : "Validate"}</Button>{tab === "pine" && <Button size="sm" variant="outline" disabled={busy !== null || !pineSource.trim()} onClick={convertPine} className="h-6 gap-1 px-2 text-[10px]"><Upload className="h-3 w-3" />{busy === "convert" ? "Reviewing…" : "Create review draft"}</Button>}</div></div>
      {tab === "python" ? <div className="min-h-0 flex-1"><CodeEditor value={source} onChange={setSource} readOnly={false} /></div> : <div className="flex min-h-0 flex-1 flex-col p-3"><p className="mb-3 max-w-2xl text-[11px] leading-5 text-muted-foreground">Paste only Pine source you own or are authorized to convert. The importer creates a review draft; it blocks unsupported/repainting behavior and never fetches or decompiles protected scripts.</p><textarea value={pineSource} onChange={(event) => setPineSource(event.target.value)} placeholder="Paste Pine Script source here" className="min-h-0 flex-1 resize-none border hairline bg-surface p-3 font-mono-num text-[11px] outline-none focus:border-mdata" /></div>}</section>
      <aside className="w-[270px] shrink-0 overflow-y-auto bg-panel"><div className="border-b hairline p-3"><div className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Research context</div><div className="mt-2 flex items-center justify-between font-mono-num text-[11px]"><span>{symbol}</span><span className="rounded bg-research/15 px-1.5 py-0.5 text-research">{timeframe}</span></div><p className="mt-2 text-[9.5px] leading-4 text-muted-foreground">Runs require verified historical data from the active provider. Missing or degraded data is withheld, never replaced.</p></div><div className="border-b hairline p-3"><div className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Validation</div><div className={validation.status === "VALID" ? "mt-2 flex items-center gap-1.5 text-[11px] text-pos" : validation.status === "INVALID" || validation.status === "UNSUPPORTED" ? "mt-2 flex items-center gap-1.5 text-[11px] text-neg" : "mt-2 text-[11px] text-muted-foreground"}>{validation.status === "VALID" ? <CheckCircle2 className="h-3.5 w-3.5" /> : validation.status !== "IDLE" ? <AlertCircle className="h-3.5 w-3.5" /> : null}{statusText}</div>{validation.sourceHash && <div className="mt-2 break-all font-mono-num text-[9px] text-muted-foreground">{validation.sourceHash}</div>}</div><div className="border-b hairline p-3"><label className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Lookback days</label><Input type="number" value={lookbackDays} min={1} max={365} onChange={(event) => setLookbackDays(Math.max(1, Math.min(365, Number(event.target.value) || 1)))} className="mt-2 h-7 bg-surface text-[11px]" /><div className="mt-3 rounded border hairline bg-surface/50 p-2 text-[9.5px] leading-4 text-muted-foreground">Backtests queue in an isolated worker. This deployment will not run arbitrary Python until the configured worker, SQL queue, and Rust engine report healthy.</div><Button size="sm" disabled className="mt-3 h-7 w-full gap-1.5 text-[10px]"><Play className="h-3 w-3" />Queue backtest after worker check</Button></div></aside>
    </div>
    <div className="h-[170px] shrink-0 border-t hairline bg-panel"><div className="flex h-7 items-center gap-2 border-b hairline px-2"><FileCode2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Research diagnostics</span></div><div className="h-[142px] overflow-y-auto p-2 font-mono-num text-[10.5px]">{validation.diagnostics.length ? validation.diagnostics.map((item, index) => <div key={`${item.code}-${index}`} className={item.level === "ERROR" ? "mb-1 text-neg" : item.level === "WARNING" ? "mb-1 text-warn" : "mb-1 text-mdata"}>{item.code}{item.line ? ` · line ${item.line}` : ""}: {item.message}</div>) : log.map((item, index) => <div key={index} className="mb-1 text-muted-foreground">{item}</div>)}</div></div>
  </div>;
}
