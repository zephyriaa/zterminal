import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, mock, test } from "node:test";
import { useResearch } from "../src/stores/research";
import { capabilities, forgetHelper, helper, HelperError, helperRequest, pairHelper } from "../src/lib/local-research/client";
import { defaultResearchConfig, type Dataset, type ResearchJob, type ResearchResult } from "../src/lib/local-research/contracts";

const initial = useResearch.getState();
const config = { ...defaultResearchConfig(), from: 3_600_000, to: 10_800_000 };
const dataset: Dataset = { version: 1, provider: "gateio", product: "perpetual", symbol: "BTC_USDT", timeframe: "1h", from: config.from, to: config.to, hash: "a".repeat(64), bars: [1, 2].map(n => ({ t: n * 3_600_000, o: 10, h: 12, l: 9, c: 11, v: 4 })) };
dataset.hash = createHash("sha256").update(JSON.stringify(dataset.bars.map(b => [b.t, b.o, b.h, b.l, b.c, b.v]))).digest("hex");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
beforeEach(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: () => true } });
  useResearch.persist.setOptions({ storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });
  useResearch.setState({ ...initial, connection: "connected", config, instrument: { provider: config.provider, symbol: config.symbol, multiplier: config.multiplier, quantityStep: config.quantityStep, tickSize: config.tickSize!, minimumQuantity: config.minimumQuantity!, minimumNotional: config.minimumNotional!, verifiedAt: Date.now() } }, true);
  mock.method(globalThis, "fetch", async () => Response.json({ protocol: 1, platform: "windows-x64", version: "fixture", researchSchemas: [1, 2], features: ["synthetic_next_open_v2", "research_analyses_v1", "indicator_dataset_v2"] }));
  mock.method(helper, "dataset", async () => dataset);
  mock.method(helper, "run", async () => ({ id: "new", stage: "running_strategy" }));
  mock.method(helper, "job", async (id: string) => ({ id, stage: "cancelled" }));
  mock.method(helper, "cancel", async (id: string) => ({ id, stage: "cancelled" }));
});
afterEach(() => { forgetHelper(); mock.restoreAll(); if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window"); });

test("keyboard/API run without a connection leaves job and captured source untouched", async () => {
  useResearch.setState({ connection: "unavailable" });
  await useResearch.getState().run();
  assert.equal(useResearch.getState().job, null);
  assert.equal(useResearch.getState().capturedScript, null);
  assert.match(useResearch.getState().error, /Connect/);
});

test("cancelled dataset rejection cannot overwrite a newer preparing run", async () => {
  const old = Promise.withResolvers<Dataset | null>(), next = Promise.withResolvers<Dataset | null>();
  const oldStarted = Promise.withResolvers<void>(), nextStarted = Promise.withResolvers<void>();
  let calls = 0;
  mock.method(helper, "dataset", () => { if (++calls === 1) { oldStarted.resolve(); return old.promise; } nextStarted.resolve(); return next.promise; });
  const first = useResearch.getState().run();
  await oldStarted.promise;
  await useResearch.getState().cancel();
  const second = useResearch.getState().run();
  await nextStarted.promise;
  try {
    old.reject(new Error("old load failed"));
    await first;
    assert.equal(useResearch.getState().job?.stage, "loading_data");
    assert.equal(useResearch.getState().error, "");
  } finally { next.resolve(dataset); await second; }
});

test("late cancelled job creation cancels that job without replacing the next job", async () => {
  const old = Promise.withResolvers<ResearchJob>(), started = Promise.withResolvers<void>();
  const cancelled: string[] = [];
  let calls = 0;
  mock.method(helper, "run", () => { if (++calls === 1) { started.resolve(); return old.promise; } return Promise.resolve({ id: "new", stage: "running_strategy" }); });
  mock.method(helper, "cancel", async (id: string) => { cancelled.push(id); return { id, stage: "cancelled" }; });
  const first = useResearch.getState().run();
  await started.promise;
  await useResearch.getState().cancel();
  await useResearch.getState().run();
  old.resolve({ id: "old", stage: "running_strategy" });
  await first;
  assert.deepEqual(cancelled, ["old"]);
  assert.equal(useResearch.getState().job?.id, "new");
});

test("an old report arriving after rerun cannot publish or disconnect the new job", async () => {
  const report = Promise.withResolvers<ResearchResult>(), started = Promise.withResolvers<void>();
  let calls = 0;
  mock.method(helper, "run", async () => ({ id: ++calls === 1 ? "old" : "new", stage: "running_strategy" }));
  mock.method(helper, "job", async (id: string) => id === "old" ? { id, stage: "complete", resultId: "old-report" } : { id, stage: "cancelled" });
  mock.method(helper, "result", () => { started.resolve(); return report.promise; });
  mock.method(helper, "results", async () => []);
  const first = useResearch.getState().run();
  await started.promise;
  await useResearch.getState().run();
  report.resolve({ id: "old-report" } as ResearchResult); // Identity-only fixture; never published.
  await first;
  assert.equal(useResearch.getState().job?.id, "new");
  assert.equal(useResearch.getState().result, null);
  assert.equal(useResearch.getState().chartResult, null);
  assert.equal(useResearch.getState().connection, "connected");
  assert.equal(useResearch.getState().error, "");
});

test("failed cleanup of an old created job is explicit without replacing the next job", async () => {
  const old = Promise.withResolvers<ResearchJob>(), started = Promise.withResolvers<void>();
  let calls = 0;
  mock.method(helper, "run", () => { if (++calls === 1) { started.resolve(); return old.promise; } return Promise.resolve({ id: "new", stage: "running_strategy" }); });
  mock.method(helper, "cancel", async () => { throw new Error("offline fixture"); });
  const first = useResearch.getState().run();
  await started.promise;
  await useResearch.getState().cancel();
  await useResearch.getState().run();
  old.resolve({ id: "old", stage: "running_strategy" });
  await first;
  assert.equal(useResearch.getState().job?.id, "new");
  assert.match(useResearch.getState().error, /earlier run could not be confirmed/);
});

test("cancellation without an acknowledgement preserves the known job instead of claiming cancelled", async () => {
  const created = Promise.withResolvers<ResearchJob>(), started = Promise.withResolvers<void>();
  mock.method(helper, "run", () => { started.resolve(); return created.promise; });
  mock.method(helper, "cancel", async () => { throw new HelperError("offline fixture", "unavailable"); });
  const pending = useResearch.getState().run();
  await started.promise;
  await useResearch.getState().cancel();
  created.resolve({ id: "known", stage: "running_strategy" });
  await pending;
  assert.equal(useResearch.getState().job?.id, "known");
  assert.equal(useResearch.getState().job?.stage, "running_strategy");
  assert.equal(useResearch.getState().connection, "unavailable");
  assert.match(useResearch.getState().error, /Cancellation could not be confirmed/);
});

test("forgetting the browser session removes its bearer from subsequent requests", async () => {
  const authorizations: (string | null)[] = [];
  mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/pair")) return Response.json({ token: "fixture-session-only", protocol: 1 });
    authorizations.push(new Headers(init?.headers).get("Authorization"));
    return Response.json([]);
  });
  await pairHelper("fixture-code");
  await helperRequest("scripts");
  forgetHelper();
  await helperRequest("scripts");
  assert.deepEqual(authorizations, ["Bearer fixture-session-only", null]);
});

test("local-network permission denial has an actionable prerequisite error", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { permissions: { query: async () => ({ state: "denied" }) } } });
  mock.method(globalThis, "fetch", async () => { throw new TypeError("blocked fixture"); });
  try {
    await assert.rejects(helperRequest("capabilities"), error => error instanceof HelperError && error.code === "permission_denied" && /browser permissions/.test(error.message));
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("malformed capabilities are incompatible and valid legacy protocol capabilities remain readable", async () => {
  for (const value of [null, { protocol: 2, platform: "windows-x64", version: "fixture" }, { protocol: 1, platform: "windows-x64", version: {} }, { protocol: 1, platform: "windows-x64", version: "fixture", activeJob: 42 }]) {
    mock.method(globalThis, "fetch", async () => Response.json(value));
    await assert.rejects(capabilities(), error => error instanceof HelperError && error.code === "incompatible");
  }
  mock.method(globalThis, "fetch", async () => Response.json({ protocol: 1, platform: "windows-x64", version: "legacy" }));
  assert.equal((await capabilities()).version, "legacy");
});

test("lost or incompatible capabilities clear readiness before a job is submitted", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ protocol: 2, platform: "windows-x64", version: "fixture" }));
  await useResearch.getState().run();
  assert.equal(useResearch.getState().connection, "incompatible");
  assert.equal(useResearch.getState().helperVersion, null);
  assert.deepEqual(useResearch.getState().helperFeatures, []);
});

test("a wrong-symbol Helper cache cannot rewrite the captured run configuration", async () => {
  mock.method(helper, "dataset", async () => ({ ...dataset, symbol: "ETH_USDT" }));
  let submitted = false;
  mock.method(helper, "run", async () => { submitted = true; return { id: "wrong-market", stage: "running_strategy" }; });
  await useResearch.getState().run();
  assert.equal(submitted, false);
  assert.equal(useResearch.getState().job?.stage, "failed");
  assert.equal(useResearch.getState().config.symbol, "BTC_USDT");
  assert.match(useResearch.getState().error, /manifest/i);
});

test("archive opens publish only the newest requested result", async () => {
  const old = Promise.withResolvers<ResearchResult>();
  mock.method(helper, "result", (id: string) => id === "old" ? old.promise : Promise.resolve({ id } as ResearchResult));
  const first = useResearch.getState().openResult("old");
  await useResearch.getState().openResult("chosen");
  old.resolve({ id: "old" } as ResearchResult);
  await first;
  assert.equal(useResearch.getState().result?.id, "chosen");
  assert.equal(useResearch.getState().chartResult?.id, "chosen");
});

test("a report chosen during job creation remains selected when that job completes", async () => {
  const created = Promise.withResolvers<ResearchJob>(), started = Promise.withResolvers<void>();
  mock.method(helper, "run", () => { started.resolve(); return created.promise; });
  mock.method(helper, "result", async (id: string) => ({ id } as ResearchResult));
  mock.method(helper, "results", async () => [{ id: "job-result", name: "fixture", created: 1 }]);
  mock.method(helper, "job", async (id: string) => ({ id, stage: "complete", resultId: "job-result" }));
  const pending = useResearch.getState().run();
  await started.promise;
  await useResearch.getState().openResult("chosen");
  created.resolve({ id: "job", stage: "running_strategy" });
  await pending;
  assert.equal(useResearch.getState().job?.stage, "complete");
  assert.equal(useResearch.getState().result?.id, "chosen");
  assert.equal(useResearch.getState().chartResult?.id, "chosen");
  assert.equal(useResearch.getState().archived[0].id, "job-result");
});

test("a delayed analysis creation cannot replace a newer strategy job", async () => {
  const created = Promise.withResolvers<ResearchJob>(), started = Promise.withResolvers<void>();
  const cancelled: string[] = [];
  useResearch.setState({ result: { id: "parent" } as ResearchResult, helperFeatures: ["research_analyses_v1"] });
  mock.method(helper, "researchAnalysis", () => { started.resolve(); return created.promise; });
  mock.method(helper, "cancel", async (id: string) => { cancelled.push(id); return { id, stage: "complete" }; });
  const old = useResearch.getState().researchAnalyze("validation");
  await started.promise;
  await useResearch.getState().run();
  created.resolve({ id: "old-analysis", stage: "running_strategy" });
  await old;
  assert.equal(useResearch.getState().job?.id, "new");
  assert.deepEqual(cancelled, ["old-analysis"]);
});
