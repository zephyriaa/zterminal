"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { draftStorage } from "@/lib/local-research/drafts";
import { EXAMPLES } from "@/lib/local-research/examples";
import { defaultResearchConfig, type Dataset, type Diagnostic, type IndicatorEvaluationResult, type ResearchConfig, type ResearchJob, type ResearchResult, type ScriptRecord } from "@/lib/local-research/contracts";
import { capabilities, helper, HelperError, pairHelper } from "@/lib/local-research/client";
import { validateConfig, validateDataset } from "@/lib/local-research/dataset";
import { usePanels } from "./panels";
import { useStudies } from "./studies";
import { createPythonStudy } from "@/lib/indicator-library";

const initial: ScriptRecord = { id: "welcome-example", name: "Moving-average crossover", kind: "strategy", source: EXAMPLES[0].source, savedSource: "", updatedAt: 0, revision: 0 };
type Connection = "unchecked" | "checking" | "connected" | "unpaired" | "unavailable" | "permission_denied" | "incompatible";
type State = {
  drafts: Record<string, ScriptRecord>; activeId: string; config: ResearchConfig; params: Record<string, number | string | boolean>; minimap: boolean;
  connection: Connection; error: string; diagnostic: Diagnostic | null; job: ResearchJob | null; result: ResearchResult | null; indicatorResults: Record<string, IndicatorEvaluationResult>; archived: { id: string; name: string; created: number }[]; chartResult: ResearchResult | null; selectedTrade: string | null;
  capturedScript: { id: string; source: string } | null;
  instrument: { provider: string; symbol: string; multiplier: number; quantityStep: number; verifiedAt: number } | null;
  verifyInstrument: () => Promise<void>;
  reportTab: "Overview" | "Performance" | "Trades" | "Risk" | "Monte Carlo" | "Logs";
  setSource: (source: string) => void; configure: (patch: Partial<ResearchConfig>) => void; selectScript: (id: string) => void; createScript: (name?: string, source?: string, kind?: "strategy" | "indicator") => void;
  connect: (code?: string) => Promise<void>; save: (name?: string, copy?: boolean) => Promise<void>; deleteScript: () => Promise<void>; run: () => Promise<void>; rerunIndicator: (artifactId: string, params: Record<string, number | string | boolean>) => Promise<void>; cancel: () => Promise<void>; openResult: (id: string) => Promise<void>; analyze: (seed: number, simulations: number) => Promise<void>;
};
let abort: AbortController | null = null;
const finished = (job: ResearchJob | null) => !job || ["complete", "failed", "cancelled"].includes(job.stage);

export const useResearch = create<State>()(persist((set, get) => ({
  drafts: { [initial.id]: initial }, activeId: initial.id, config: defaultResearchConfig(), params: {}, minimap: false,
  connection: "unchecked", error: "", diagnostic: null, job: null, result: null, indicatorResults: {}, archived: [], chartResult: null, selectedTrade: null, reportTab: "Overview",
  capturedScript: null, instrument: null,
  verifyInstrument: async () => {
    const { provider, symbol } = get().config;
    try {
      const response = await fetch(`/api/research-instrument?${new URLSearchParams({ provider, symbol })}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (get().config.provider === provider && get().config.symbol === symbol) set(s => ({ instrument: data, config: { ...s.config, symbol: data.symbol, multiplier: data.multiplier, quantityStep: data.quantityStep }, error: "" }));
    } catch (error) { if (get().config.provider === provider && get().config.symbol === symbol) set({ instrument: null, error: (error as Error).message }); }
  },
  setSource: source => set(s => ({ drafts: { ...s.drafts, [s.activeId]: { ...s.drafts[s.activeId], source, updatedAt: Date.now() } } })),
  configure: patch => set(s => ({ config: { ...s.config, ...patch } })),
  selectScript: activeId => { if (get().drafts[activeId]) set({ activeId, diagnostic: null }); },
  createScript: (name = "Untitled", source, kind = "strategy") => {
    const id = crypto.randomUUID();
    const template = source ?? (kind === "indicator" ? "import zterminal as zt\n\nPARAMETERS = {\n    'length': zt.input.integer(20, min=1, max=500),\n}\n\ndef calculate(data, params):\n    return {'ema': zt.ema(data.close, params['length'])}\n" : "import zterminal as zt\n\ndef strategy(data, params):\n    # Return aligned boolean entry and exit signals.\n    return zt.Strategy(data.close < 0, data.close < 0)\n");
    set(s => ({ activeId: id, diagnostic: null, drafts: { ...s.drafts, [id]: { id, name, kind, description: "", source: template, savedSource: "", revision: 0, updatedAt: Date.now() } } }));
  },
  connect: async code => {
    set({ connection: "checking", error: "" });
    try {
      const caps = await capabilities();
      if (code) await pairHelper(code);
      const [scripts, artifacts, archived] = await Promise.all([helper.scripts(), helper.artifacts(), helper.results()]);
      const records = [...scripts.map(script => ({ ...script, kind: "strategy" as const })), ...artifacts.filter(artifact => artifact.kind === "indicator")];
      set(s => ({ connection: "connected", archived, drafts: { ...s.drafts, ...Object.fromEntries(records.map(record => [record.id, s.drafts[record.id] && s.drafts[record.id].source !== s.drafts[record.id].savedSource ? s.drafts[record.id] : record])) } }));
      const pending = caps.activeJob ?? (!finished(get().job) && get().job?.id !== "preparing" ? get().job?.id : null);
      if (pending) { const job = await helper.job(pending); set({ job }); void watch(job.id); }
    } catch (error) { set({ connection: error instanceof HelperError ? error.code === "request_failed" ? "unavailable" : error.code : "unavailable", error: (error as Error).message }); }
  },
  save: async (name, copy = false) => {
    const snapshot = structuredClone(get().drafts[get().activeId]);
    try {
      const payload = { ...snapshot, id: copy || snapshot.revision === 0 ? undefined : snapshot.id, name: name?.trim() || snapshot.name };
      const saved = snapshot.kind === "indicator" ? await helper.saveArtifact({ ...payload, kind: "indicator", description: snapshot.description ?? "" }) : await helper.saveScript(payload);
      set(s => {
        const drafts = { ...s.drafts };
        const current = drafts[snapshot.id];
        // Keep edits made during the save; the saved revision represents the captured source.
        const next = { ...saved, source: !copy && current ? current.source : saved.source };
        if (!copy && snapshot.id !== saved.id) delete drafts[snapshot.id];
        drafts[saved.id] = next;
        return { drafts, activeId: s.activeId === snapshot.id ? saved.id : s.activeId, error: "" };
      });
    } catch (error) { set({ error: (error as Error).message }); }
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
    const script = structuredClone(get().drafts[get().activeId]);
    const config = structuredClone(get().config), params = structuredClone(get().params);
    abort = new AbortController();
    const signal = abort.signal;
    set({ job: { id: "preparing", stage: "validating" }, capturedScript: { id: script.id, source: script.source }, diagnostic: null, error: "" });
    if (script.kind !== "indicator") usePanels.getState().open("backtester");
    try {
      validateConfig(config);
      const instrument = get().instrument;
      if (!instrument || instrument.provider !== config.provider || instrument.symbol !== config.symbol || instrument.multiplier !== config.multiplier || instrument.quantityStep !== config.quantityStep) throw new Error("Verify instrument units before running this configuration.");
      if (!script.source.trim()) throw new Error(`Write a Python ${script.kind === "indicator" ? "indicator" : "strategy"} before running.`);
      if (script.kind === "indicator" && script.revision < 1) throw new Error("Save the indicator once before previewing it so the evaluation references an immutable revision.");
      await capabilities();
      set({ job: { id: "preparing", stage: "loading_data" } });
      const query = new URLSearchParams({ provider: config.provider, symbol: config.symbol, timeframe: config.timeframe, from: String(config.from), to: String(config.to) });
      let dataset = await helper.dataset(config);
      if (!dataset) {
        const response = await fetch(`/api/research-data?${query}`, { signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Historical data unavailable.");
        dataset = payload as Dataset;
      }
      validateDataset(dataset.bars, config);
      const actualConfig = { ...config, symbol: dataset.symbol };
      if (signal.aborted) return;
      const job = script.kind === "indicator" ? await helper.evaluateIndicator({ operation: "indicator", name: script.name, source: script.source, config: actualConfig, dataset, params, artifact: { id: script.id, kind: "indicator", revision: script.revision, name: script.name }, outputs: {} }) : await helper.run({ name: script.name, source: script.source, config: actualConfig, dataset, params });
      set({ job });
      // If cancellation occurred while job creation was in flight, cancel the created process too.
      if (signal.aborted) await helper.cancel(job.id);
      await watch(job.id);
    } catch (error) {
      set({ job: { id: get().job?.id ?? "preparing", stage: signal.aborted ? "cancelled" : "failed" }, error: signal.aborted ? "" : (error as Error).message });
    } finally { abort = null; }
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
    try { const result = await helper.result(id); set({ result, chartResult: result, selectedTrade: null, error: "" }); usePanels.getState().open("backtester"); }
    catch (error) { set({ error: (error as Error).message }); }
  },
  analyze: async (seed, simulations) => {
    if (!finished(get().job) || !get().result) return;
    try { const job = await helper.monteCarlo(get().result!.id, seed, simulations); set({ job, error: "" }); await watch(job.id); }
    catch (error) { set({ error: (error as Error).message }); }
  },
}), { name: "research-drafts-v1", version: 1, storage: createJSONStorage(() => draftStorage), skipHydration: true,
  partialize: ({ drafts, activeId, config, params, minimap }) => ({ drafts, activeId, config, params, minimap }),
  merge: (saved, current) => {
    const data = saved as Partial<State> | undefined;
    if (!data?.drafts || typeof data.drafts !== "object") return current;
    const drafts = Object.fromEntries(Object.entries(data.drafts).filter(([id, p]) => p?.id === id && typeof p.source === "string" && p.source.length <= 256_000 && typeof p.name === "string"));
    let config = { ...current.config, ...data.config };
    try { validateConfig(config); if (![config.from, config.to].every(v => Number.isSafeInteger(v) && v >= 0 && v < 8e15)) throw new Error("Invalid dates"); } catch { config = current.config; }
    return { ...current, drafts: Object.keys(drafts).length ? drafts : current.drafts, activeId: data.activeId && drafts[data.activeId] ? data.activeId : Object.keys(drafts)[0] ?? current.activeId, config, params: data.params ?? {}, minimap: Boolean(data.minimap) };
  },
}));

async function watch(id: string) {
  for (;;) {
    try {
      const job = await helper.job(id);
      useResearch.setState({ job, diagnostic: job.diagnostic ?? null });
      if (finished(job)) {
        if (job.stage === "complete" && job.resultId) {
          if (job.resultKind === "indicator") {
            const evaluation = await helper.evaluation(job.resultId);
            useResearch.setState(state => ({ indicatorResults: { ...state.indicatorResults, [evaluation.artifact.id]: evaluation }, error: "" }));
            useStudies.getState().addExternal(createPythonStudy({ artifactId: evaluation.artifact.id, name: evaluation.artifact.name, params: evaluation.params, parameterSchema: evaluation.parameters, outputs: Object.entries(evaluation.outputs).filter(([, output]) => ["line", "histogram", "area", "marker"].includes(output.plot)).map(([name, output]) => ({ id: name, plot: output.plot === "level" || output.plot === "background" ? "line" : output.plot })) }));
          } else {
            const [result, archived] = await Promise.all([helper.result(job.resultId), helper.results()]);
            useResearch.setState({ result, archived, chartResult: result, selectedTrade: null });
          }
        }
        if (job.stage === "failed") { const active = useResearch.getState().drafts[useResearch.getState().activeId]; useResearch.setState({ error: job.diagnostic?.message ?? `${active?.kind === "indicator" ? "Custom indicator" : "Strategy"} failed. No result was substituted.` }); }
        return;
      }
    } catch (error) {
      useResearch.setState({ connection: "unavailable", error: `Helper disconnected during the run. Reconnect to recover its status. ${(error as Error).message}` });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}
