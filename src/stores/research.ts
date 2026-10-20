"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isWorkspaceRoute } from "@/lib/workspaces/route-storage";
import { draftStorage, flushDraftWrites } from "@/lib/local-research/drafts";
import { EXAMPLES } from "@/lib/local-research/examples";
import { defaultResearchConfig, type Dataset, type Diagnostic, type IndicatorEvaluationResult, type ResearchAnalysis, type ResearchConfig, type ResearchJob, type ResearchResult, type ScriptRecord, type ScriptInspection, type ResearchInstrument } from "@/lib/local-research/contracts";
import { capabilities, helper, HelperError, pairHelper } from "@/lib/local-research/client";
import { supportsCurrentResearch } from "@/lib/local-research/compatibility";
import { intervalMs, validateConfig, validateResearchDataset } from "@/lib/local-research/dataset";
import { publicResearchInstrument, publicResearchHistory, researchRangeIssue } from "@/lib/local-research/market-data";

import { useStudies } from "./studies";
import { createPythonStudy } from "@/lib/indicator-library";

const initial: ScriptRecord = { id: "welcome-example", name: "Moving-average crossover", kind: "strategy", source: EXAMPLES[0].source, savedSource: "", updatedAt: 0, revision: 0 };
type Connection = "unchecked" | "checking" | "connected" | "unpaired" | "invalid_code" | "unavailable" | "permission_denied" | "incompatible";
type State = {
  holdoutUsage: { id: string; fingerprint: string; created: number; count: number }[];
  saveStatus: string; helperFeatures: string[]; analyses: ResearchAnalysis[];
  researchAnalyze: (kind: ResearchAnalysis["kind"], options?: Record<string, unknown>, selectionId?: string) => Promise<void>;
  drafts: Record<string, ScriptRecord>; activeId: string; config: ResearchConfig; params: Record<string, number | string | boolean>; minimap: boolean;
  connection: Connection; helperVersion: string | null; error: string; diagnostic: Diagnostic | null; job: ResearchJob | null; result: ResearchResult | null; indicatorResults: Record<string, IndicatorEvaluationResult>; archived: { id: string; name: string; created: number }[]; chartResult: ResearchResult | null; selectedTrade: string | null;
  capturedScript: { id: string; source: string } | null;
  instrument: ResearchInstrument | null; instrumentError: string; verifyingInstrument: boolean;
  inspection: ScriptInspection | null; inspectionError: string; inspecting: boolean;
  inspectScript: () => Promise<ScriptInspection | null>;
  verifyInstrument: () => Promise<void>;
  reportTab: "Overview" | "Performance" | "Trades" | "Risk" | "Monte Carlo" | "Logs" | "Validation" | "Execution assumptions";
  setSource: (source: string) => void; configure: (patch: Partial<ResearchConfig>) => void; selectScript: (id: string) => void; createScript: (name?: string, source?: string, kind?: "strategy" | "indicator") => void;
  connect: (code?: string) => Promise<void>; save: (name?: string, copy?: boolean) => Promise<void>; deleteScript: () => Promise<void>; run: () => Promise<void>; rerunIndicator: (artifactId: string, params: Record<string, number | string | boolean>) => Promise<void>; cancel: () => Promise<void>; openResult: (id: string) => Promise<void>; analyze: (seed: number, simulations: number) => Promise<void>;
};
let abort: AbortController | null = null;
let jobGeneration = 0;
let resultGeneration = 0;
const finished = (job: ResearchJob | null) => !job || ["complete", "failed", "cancelled"].includes(job.stage);

export const useResearch = create<State>()(persist((set, get) => ({
  holdoutUsage: [], saveStatus: "Browser autosave active", helperFeatures: [], analyses: [],
  researchAnalyze: async (kind, options = {}, selectionId) => {
    const result = get().result;
    if (!result || !finished(get().job)) return;
    const generation = ++jobGeneration;
    const selection = ++resultGeneration;
    try {
      if (!get().helperFeatures.includes("research_analyses_v1")) throw new Error("Update and connect the matching Helper to run research analyses.");
      const job = await helper.researchAnalysis(result.id, kind, options, selectionId);
      if (generation !== jobGeneration) { await cancelSupersededJob(job.id); return; }
      set({ job, error: "" }); await watch(job.id, selection);
    } catch (error) { if (generation === jobGeneration) set({ error: (error as Error).message }); }
    finally { if (generation === jobGeneration) abort = null; }
    if (kind === "holdout" && selection === resultGeneration) { try { const holdoutUsage = await helper.holdoutUsage(result.id); if (selection === resultGeneration) set({ holdoutUsage }); } catch { /* The request status remains visible. */ } }
  },
  drafts: { [initial.id]: initial }, activeId: initial.id, config: defaultResearchConfig(), params: {}, minimap: false,
  connection: "unchecked", helperVersion: null, error: "", diagnostic: null, job: null, result: null, indicatorResults: {}, archived: [], chartResult: null, selectedTrade: null, reportTab: "Overview",
  capturedScript: null, instrument: null, instrumentError: "", verifyingInstrument: false,
  inspection: null, inspectionError: "", inspecting: false,
  inspectScript: async () => {
    if (!get().helperFeatures.includes("script_inspection_v1")) return null;
    const script = get().drafts[get().activeId], source = script.source, params = structuredClone(get().params);
    const matches = () => get().activeId === script.id && get().drafts[script.id]?.source === source && JSON.stringify(get().params) === JSON.stringify(params);
    set({ inspecting: true });
    try {
      const inspection = await helper.inspect(source, params);
      if (!matches()) return null;
      set({ inspection, inspectionError: "", inspecting: false });
      return inspection;
    } catch (error) {
      if (matches()) set({ inspection: null, inspecting: false, inspectionError: (error as Error).message, diagnostic: error instanceof HelperError ? error.diagnostic ?? null : null });
      return null;
    }
  },
  verifyInstrument: async () => {
    const { provider, symbol } = get().config;
    set({ verifyingInstrument: true, instrumentError: "" });
    try {
      let data: ResearchInstrument;
      if (get().connection === "connected" && get().helperFeatures.includes("local_market_data_v1")) data = await helper.instrument(provider, symbol);
      else {
        try {
          const response = await fetch(`/api/research-instrument?${new URLSearchParams({ provider, symbol })}`, { signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error("Edge metadata unavailable");
          data = await response.json();
        } catch { data = await publicResearchInstrument(provider, symbol); }
      }
      if (get().config.provider === provider && get().config.symbol === symbol) set(s => ({ instrument: data, verifyingInstrument: false, instrumentError: "", config: { ...s.config, symbol: data.symbol, multiplier: data.multiplier, quantityStep: data.quantityStep, tickSize: data.tickSize, minimumQuantity: data.minimumQuantity, minimumNotional: data.minimumNotional } }));
    } catch (error) { if (get().config.provider === provider && get().config.symbol === symbol) set({ instrument: null, verifyingInstrument: false, instrumentError: (error as Error).message }); }
  },
  setSource: source => set(s => ({ drafts: { ...s.drafts, [s.activeId]: { ...s.drafts[s.activeId], source, updatedAt: Date.now() } } })),
  configure: patch => set(s => ({ config: { ...s.config, ...patch }, ...(patch.provider && patch.provider !== s.config.provider || patch.symbol && patch.symbol !== s.config.symbol ? { instrument: null, instrumentError: "" } : {}) })),
  selectScript: activeId => { if (get().drafts[activeId]) set({ activeId, diagnostic: null }); },
  createScript: (name = "Untitled", source, kind = "strategy") => {
    const id = crypto.randomUUID();
    const template = source ?? (kind === "indicator" ? "import zterminal as zt\n\nPARAMETERS = {\n    'length': zt.input.integer(20, min=1, max=500),\n}\n\ndef calculate(data, params):\n    return {'ema': zt.ema(data.close, params['length'])}\n" : "import zterminal as zt\n\ndef strategy(data, params):\n    # Return aligned boolean entry and exit signals.\n    return zt.Strategy(data.close < 0, data.close < 0)\n");
    set(s => ({ activeId: id, diagnostic: null, drafts: { ...s.drafts, [id]: { id, name, kind, description: "", source: template, savedSource: "", revision: 0, updatedAt: Date.now() } } }));
  },
  connect: async code => {
    const generation = jobGeneration;
    const selection = resultGeneration;
    set({ connection: "checking", error: "" });
    try {
      const caps = await capabilities();
      if (!supportsCurrentResearch(caps)) throw new HelperError("This workbench requires research schema 2, analyses and dataset-bound Python indicators. Update the Windows x64 Helper, then reconnect. Existing research archives are preserved.", "incompatible");
      if (code) await pairHelper(code);
      const [scripts, artifacts, archived] = await Promise.all([helper.scripts(), helper.artifacts(), helper.results()]);
      const records = [...scripts.map(script => ({ ...script, kind: "strategy" as const })), ...artifacts.filter(artifact => artifact.kind === "indicator")];
      set(s => ({ connection: "connected", helperVersion: caps.version, helperFeatures: caps.features ?? [], archived, drafts: { ...s.drafts, ...Object.fromEntries(records.map(record => [record.id, s.drafts[record.id] && s.drafts[record.id].source !== s.drafts[record.id].savedSource ? s.drafts[record.id] : record])) } }));
      const pending = caps.activeJob ?? (!finished(get().job) && get().job?.id !== "preparing" ? get().job?.id : null);
      if (pending) { const job = await helper.job(pending); if (generation !== jobGeneration) return; set({ job }); void watch(job.id, selection); }
    } catch (error) { if (generation === jobGeneration) set({ connection: error instanceof HelperError ? error.code === "request_failed" ? "unavailable" : error.code : "unavailable", helperVersion: null, helperFeatures: [], error: (error as Error).message }); }
  },
  save: async (name, copy = false) => {
    const snapshot = structuredClone(get().drafts[get().activeId]);
    set({ saveStatus: "Saving in browser…" });
    try {
      const id = copy ? crypto.randomUUID() : snapshot.id;
      set(s => ({ activeId: s.activeId === snapshot.id ? id : s.activeId, drafts: { ...s.drafts, [id]: { ...snapshot, id, revision: copy ? 0 : snapshot.revision, name: name?.trim() || snapshot.name, updatedAt: Date.now() } } }));
      await flushDraftWrites();
      set(s => ({ drafts: { ...s.drafts, [id]: { ...s.drafts[id], localSavedSource: snapshot.source } } }));
      await flushDraftWrites();
      set({ saveStatus: "Saved in this browser", error: "" });
      if (get().connection !== "connected") return;
      const payload = { ...snapshot, id: copy || snapshot.revision === 0 ? undefined : snapshot.id, name: name?.trim() || snapshot.name };
      const saved = snapshot.kind === "indicator" ? await helper.saveArtifact({ ...payload, kind: "indicator", description: snapshot.description ?? "" }) : await helper.saveScript(payload);
      set(s => {
        const drafts = { ...s.drafts };
        const current = drafts[snapshot.id];
        // Keep edits made during the save; the saved revision represents the captured source.
        const next = { ...saved, source: !copy && current ? current.source : saved.source };
        if (!copy && snapshot.id !== saved.id) delete drafts[snapshot.id];
        drafts[saved.id] = next;
        if (copy) delete drafts[id];
        return { drafts, activeId: [snapshot.id, id].includes(s.activeId) ? saved.id : s.activeId, error: "", saveStatus: "Saved in browser and Helper" };
      });
    } catch (error) { set({ saveStatus: "Save needs attention", error: (error as Error).message }); }
  },
  deleteScript: async () => {
    const script = get().drafts[get().activeId];
    try {
      if (script.revision) { if (script.kind === "indicator") await helper.deleteArtifact(script.id); else await helper.deleteScript(script.id); }
      set(s => { const drafts = { ...s.drafts }; delete drafts[script.id]; return { drafts, activeId: Object.keys(drafts)[0] ?? "" }; });
      if (!get().activeId) get().createScript();
    } catch (error) { set({ error: (error as Error).message }); }
  },
  run: async () => {
    if (!finished(get().job)) return;
    if (get().connection !== "connected") { set({ error: "Connect a compatible ZTerminal Helper before running." }); return; }
    const generation = ++jobGeneration;
    const selection = ++resultGeneration;
    const script = structuredClone(get().drafts[get().activeId]);
    const config = structuredClone(get().config), params = structuredClone(get().params);
    abort = new AbortController();
    const signal = abort.signal;
    let created: ResearchJob | null = null;
    set({ job: { id: "preparing", stage: "validating" }, capturedScript: { id: script.id, source: script.source }, diagnostic: null, error: "" });
    try {
      validateConfig(config);
      const modern = get().helperFeatures.includes("adaptive_execution_v1");
      if (!modern) Object.assign(config, { autoWarmup: false, autoValidation: false, guardrails: false, impactModel: "fixed", exchangeProfile: "custom", fundingMode: "none" });
      let instrument = get().instrument;
      if (!instrument || instrument.provider !== config.provider || instrument.symbol !== config.symbol) {
        await get().verifyInstrument();
        if (signal.aborted || generation !== jobGeneration) return;
        instrument = get().instrument;
        if (!instrument) throw new Error(get().instrumentError || "Instrument verification failed. Retry metadata preparation or select another venue.");
        Object.assign(config, { symbol: instrument.symbol, multiplier: instrument.multiplier, quantityStep: instrument.quantityStep, tickSize: instrument.tickSize, minimumQuantity: instrument.minimumQuantity, minimumNotional: instrument.minimumNotional });
      }
      if (!instrument || instrument.provider !== config.provider || instrument.symbol !== config.symbol || instrument.multiplier !== config.multiplier || instrument.quantityStep !== config.quantityStep || config.executionModel === "synthetic_next_open_v2" && (instrument.tickSize !== config.tickSize || instrument.minimumQuantity !== config.minimumQuantity || instrument.minimumNotional !== config.minimumNotional)) throw new Error("Verify instrument units before running this configuration.");
      if (!script.source.trim()) throw new Error(`Write a Python ${script.kind === "indicator" ? "indicator" : "strategy"} before running.`);
      if (script.kind === "indicator" && (script.revision < 1 || script.source !== script.savedSource)) throw new Error("Save the current indicator source before previewing it so the evaluation references an immutable revision.");
      const caps = await capabilities();
      if (!supportsCurrentResearch(caps)) throw new HelperError("Update and reconnect the Windows x64 Helper: this workbench requires research schema 2, analyses and dataset-bound Python indicators.", "incompatible");
      if (signal.aborted || generation !== jobGeneration) return;
      let resolvedParams = params;
      if (modern && script.kind !== "indicator") {
        const inspected = await helper.inspect(script.source, params, signal);
        if (config.guardrails && inspected.diagnostics.length) { set({ diagnostic: inspected.diagnostics[0] }); throw new Error(inspected.diagnostics[0].message); }
        const required = Object.entries(inspected.parameters).filter(([key, spec]) => spec.required && inspected.resolvedParams[key] === undefined).map(([key]) => key);
        if (required.length) throw new Error(`Set required parameters: ${required.join(", ")}.`);
        resolvedParams = inspected.resolvedParams;
        if (config.autoWarmup) {
          if (inspected.warnings.some(w => w.includes("unresolved")) && !config.warmupBars) throw new Error("A dynamic indicator lookback could not be resolved. Set manual warm-up bars before running.");
          const warmup = Math.max(config.warmupBars ?? 0, inspected.warmupBars, config.impactModel === "atr_volume_v1" ? 21 : 0);
          config.evaluationFrom = config.from;
          config.from -= warmup*intervalMs(config.timeframe);
          config.warmupBars = warmup;
        }
        const profile = inspected.profiles[config.exchangeProfile ?? "custom"];
        if (profile?.unavailable || profile?.provider && profile.provider !== config.provider) throw new Error("Choose an exchange profile matching this market.");
        const rate = config.exchangeProfile === "gate_public" ? instrument.takerFeeBps : profile?.takerBps;
        if (config.exchangeProfile !== "custom" && rate != null) config.feeBps = rate;
      }
      set({ job: { id: "preparing", stage: "loading_data" } });
      const query = new URLSearchParams({ provider: config.provider, symbol: config.symbol, timeframe: config.timeframe, from: String(config.from), to: String(config.to) });
      let dataset = await helper.dataset(config);
      if (signal.aborted || generation !== jobGeneration) return;
      if (!dataset) {
        const rangeIssue = researchRangeIssue(config);
        if (rangeIssue) throw new Error(rangeIssue);
        if (get().helperFeatures.includes("local_market_data_v1")) dataset = await helper.history(config, signal);
        else {
          try {
            const response = await fetch(`/api/research-data?${query}`, { signal, cache: "no-store" });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? "Historical data unavailable.");
            dataset = payload as Dataset;
          } catch (error) { if (signal.aborted) throw error; dataset = await publicResearchHistory(config, signal); }
        }
      }
      dataset = await validateResearchDataset(dataset, config);
      if (signal.aborted || generation !== jobGeneration) return;
      const fundingData = config.fundingMode === "historical" ? await helper.funding(config, signal) : undefined;
      if (signal.aborted || generation !== jobGeneration) return;
      const job = script.kind === "indicator" ? await helper.evaluateIndicator({ operation: "indicator", name: script.name, source: script.source, config, dataset, params, artifact: { id: script.id, kind: "indicator", revision: script.revision, name: script.name }, outputs: {} }) : await helper.run({ name: script.name, source: script.source, config, dataset, params: resolvedParams, instrument, ...(fundingData ? { fundingData } : {}) });
      created = job;
      if (generation !== jobGeneration) {
        await cancelSupersededJob(job.id);
        return;
      }
      set({ job });
      // If cancellation occurred while job creation was in flight, cancel the created process too.
      if (signal.aborted) await helper.cancel(job.id);
      await watch(job.id, selection);
    } catch (error) {
      if (generation !== jobGeneration) return;
      if ((!signal.aborted || created) && error instanceof HelperError && error.code !== "request_failed") set({ connection: error.code, helperVersion: null, helperFeatures: [] });
      if (signal.aborted && created) { set({ job: created, error: "Cancellation could not be confirmed. Reconnect to recover the job's canonical status." }); return; }
      set({ job: { id: get().job?.id ?? "preparing", stage: signal.aborted ? "cancelled" : "failed" }, ...(error instanceof HelperError && error.diagnostic ? { diagnostic: error.diagnostic } : {}), error: signal.aborted ? "" : (error as Error).message });
    } finally { if (generation === jobGeneration) abort = null; }
  },
  rerunIndicator: async (artifactId, params) => {
    const artifact = get().drafts[artifactId];
    if (!artifact || artifact.kind !== "indicator") { set({ error: "Open the saved Python indicator in Strategy Developer before changing calculation parameters." }); return; }
    set({ activeId: artifactId, params });
    await get().run();
  },
  cancel: async () => {
    abort?.abort();
    const job = get().job;
    if (!job || finished(job)) return;
    if (job.id === "preparing") { set({ job: { ...job, stage: "cancelled" } }); return; }
    try { await helper.cancel(job.id); } catch (error) { set({ error: `Cancellation could not be confirmed: ${(error as Error).message}` }); }
  },
  openResult: async id => {
    const selection = ++resultGeneration;
    try {
      const result = await helper.result(id);
      if (selection !== resultGeneration) return;
      const [analyses, holdoutUsage] = result.researchSchema === 2 ? await Promise.all([helper.analyses(id), helper.holdoutUsage(id)]) : [[], []];
      if (selection !== resultGeneration) return;
      set({ result, analyses, holdoutUsage, chartResult: result, selectedTrade: null, error: "" }); window.dispatchEvent(new Event("zterminal:open-backtester"));
    } catch (error) { if (selection === resultGeneration) set({ error: (error as Error).message }); }
  },
  analyze: async (seed, simulations) => {
    if (!finished(get().job) || !get().result) return;
    const generation = ++jobGeneration;
    const selection = ++resultGeneration;
    try { const job = await helper.monteCarlo(get().result!.id, seed, simulations); if (generation !== jobGeneration) { await cancelSupersededJob(job.id); return; } set({ job, error: "" }); await watch(job.id, selection); }
    catch (error) { if (generation === jobGeneration) set({ error: (error as Error).message }); }
    finally { if (generation === jobGeneration) abort = null; }
  },
}), { name: "research-drafts-v1", version: 1, storage: createJSONStorage(() => draftStorage), skipHydration: true,
  partialize: ({ drafts, activeId, config, params, minimap }) => ({ drafts, ...(!isWorkspaceRoute() ? { activeId, config, params, minimap } : {}) }),
  merge: (saved, current) => {
    const data = saved as Partial<State> | undefined;
    if (!data?.drafts || typeof data.drafts !== "object") return current;
    const drafts = Object.fromEntries(Object.entries(data.drafts).filter(([id, p]) => p?.id === id && typeof p.source === "string" && p.source.length <= 256_000 && typeof p.name === "string"));
    let config = { ...current.config, ...data.config };
    try { validateConfig(config); if (![config.from, config.to].every(v => Number.isSafeInteger(v) && v >= 0 && v < 8e15)) throw new Error("Invalid dates"); } catch { config = current.config; }
    return { ...current, drafts: Object.keys(drafts).length ? drafts : current.drafts, activeId: data.activeId && drafts[data.activeId] ? data.activeId : Object.keys(drafts)[0] ?? current.activeId, config, params: data.params ?? {}, minimap: Boolean(data.minimap) };
  },
}));

let draftHydration: Promise<void> | null = null;
/** React remounts must not rehydrate over edits made in this tab. */
export function recoverResearchDrafts(): Promise<void> {
  return draftHydration ??= Promise.resolve(useResearch.persist.rehydrate());
}

async function cancelSupersededJob(id: string) {
  try { await helper.cancel(id); }
  catch { useResearch.setState(s => ({ error: `${s.error ? s.error + " " : ""}Cancellation of an earlier run could not be confirmed. Reconnect to recover its status.` })); }
}

async function watch(id: string, selection: number) {
  while (useResearch.getState().job?.id === id) {
    try {
      const job = await helper.job(id);
      if (useResearch.getState().job?.id !== id) return;
      useResearch.setState({ job, diagnostic: job.diagnostic ?? null });
      if (finished(job)) {
        if (job.stage === "complete" && job.resultId) {
          if (job.resultKind === "indicator") {
            const evaluation = await helper.evaluation(job.resultId);
            if (useResearch.getState().job?.id !== id) return;
            useResearch.setState(state => ({ indicatorResults: { ...state.indicatorResults, [evaluation.artifact.id]: evaluation }, error: "" }));
            useStudies.getState().addExternal(createPythonStudy({ artifactId: evaluation.artifact.id, revision: evaluation.artifact.revision, name: evaluation.artifact.name, params: evaluation.params, parameterSchema: evaluation.parameters, outputs: Object.entries(evaluation.outputs).filter(([, output]) => ["line", "histogram", "area", "marker"].includes(output.plot)).map(([name, output]) => ({ id: name, plot: output.plot === "level" || output.plot === "background" ? "line" : output.plot })) }));
          } else {
            const [result, archived] = await Promise.all([helper.result(job.resultId), helper.results()]);
            if (useResearch.getState().job?.id !== id) return;
            useResearch.setState({ archived });
            if (selection !== resultGeneration) return;
            const [analyses, holdoutUsage] = result.researchSchema === 2 ? await Promise.all([helper.analyses(result.id), helper.holdoutUsage(result.id)]) : [[], []];
            if (useResearch.getState().job?.id !== id || selection !== resultGeneration) return;
            useResearch.setState({ result, archived, analyses, holdoutUsage, chartResult: result, selectedTrade: null });
            // A report is a result artifact, never a placeholder opened at run start.
            window.dispatchEvent(new Event("zterminal:open-backtester"));
            if (job.resultKind !== "analysis" && result.config.autoValidation && useResearch.getState().helperFeatures.includes("strategy_health_v1")) await useResearch.getState().researchAnalyze("health");
          }
        }
        if (job.stage === "failed") { const active = useResearch.getState().drafts[useResearch.getState().activeId]; useResearch.setState({ error: job.diagnostic?.message ?? `${active?.kind === "indicator" ? "Custom indicator" : "Strategy"} failed. No result was substituted.` }); }
        return;
      }
    } catch (error) {
      if (useResearch.getState().job?.id !== id) return;
      if (finished(useResearch.getState().job) && selection !== resultGeneration) return;
      useResearch.setState({ connection: "unavailable", helperVersion: null, error: useResearch.getState().job?.stage === "complete" ? "Execution completed, but the archived result could not be retrieved. Reconnect and reopen the result; execution has not been marked failed." : "Connection to ZTerminal Helper was lost. Reconnect to recover its status." });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}
