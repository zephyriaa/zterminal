import { HELPER_URL, RESEARCH_PROTOCOL, type CodeArtifact, type Dataset, type IndicatorEvaluationRequest, type IndicatorEvaluationResult, type ResearchConfig, type ScriptRecord, type ResearchJob, type ResearchResult, type RunRequest, type ResearchAnalysis, type ScriptInspection, type ResearchInstrument, type FundingData, type Diagnostic } from "./contracts";

export class HelperError extends Error {
  constructor(message: string, public code: "unavailable" | "permission_denied" | "unpaired" | "invalid_code" | "incompatible" | "request_failed", public diagnostic?: Diagnostic) { super(message); }
}
const RETIRED_TOKEN_KEY = "zterminal.local-research.token.v1";
let memoryToken: string | null = null;
function token() { return memoryToken; }
/** Pairing grants only this browser session. Persistent localStorage tokens are retired. */
export function forgetHelper() { memoryToken = null; }
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(RETIRED_TOKEN_KEY); } catch { /* Storage may be unavailable. */ }
}
export async function helperRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${HELPER_URL}/v1/${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), credentials: "omit", cache: "no-store", signal: signal ?? AbortSignal.timeout(15_000) });
  } catch (error) {
    if (signal?.aborted) throw error;
    try {
      const permission = await navigator.permissions.query({ name: "local-network-access" as PermissionName });
      if (permission.state === "denied") throw new HelperError("Local network access is denied. Allow it for this site in browser permissions, then reconnect.", "permission_denied");
    } catch (permissionError) { if (permissionError instanceof HelperError) throw permissionError; }
    throw new HelperError("Cannot reach the local helper. Start ZTerminal Research Helper on this Windows computer. If it is running, check this site's local network permission.", "unavailable");
  }
  const payload = await response.json().catch(() => ({})) as { error?: string; diagnostic?: Diagnostic };
  if (!response.ok) {
    if (path === "pair" && [400, 401, 403].includes(response.status)) throw new HelperError("That connection code is invalid or expired. Open ZTerminal Helper and copy a new code.", "invalid_code");
    if ([401, 403].includes(response.status)) throw new HelperError("ZTerminal Helper needs to be paired with this browser session.", "unpaired");
    throw new HelperError(typeof payload.error === "string" ? payload.error.slice(0, 2000) : "ZTerminal Helper could not complete that request. Check its logs and retry.", "request_failed", payload.diagnostic);
  }
  return payload as T;
}
export async function capabilities() {
  const caps = await helperRequest<{ protocol: number; version: string; platform: string; activeJob: string | null; features?: string[]; researchSchemas?: number[] }>("capabilities");
  if (!caps || caps.protocol !== RESEARCH_PROTOCOL || caps.platform !== "windows-x64" || typeof caps.version !== "string" || !caps.version.trim() || caps.activeJob != null && typeof caps.activeJob !== "string") throw new HelperError("This helper does not provide compatible Windows x64 capabilities. Install the matching private preview and reconnect.", "incompatible");
  return caps;
}
export async function pairHelper(code: string) {
  const result = await helperRequest<{ token: string; protocol: number }>("pair", "POST", { code });
  if (result.protocol !== RESEARCH_PROTOCOL) throw new HelperError("Incompatible helper protocol.", "incompatible");
  memoryToken = result.token;
}
export const helper = {
  inspect: (source: string, params: Record<string, number | string | boolean>, signal?: AbortSignal) => helperRequest<ScriptInspection>("inspect", "POST", { source, params }, signal),
  instrument: (provider: string, symbol: string, signal?: AbortSignal) => helperRequest<ResearchInstrument>("market-data", "POST", { action: "instrument", provider, symbol }, signal),
  history: (config: ResearchConfig, signal?: AbortSignal) => helperRequest<Dataset>("market-data", "POST", { action: "history", provider: config.provider, symbol: config.symbol, timeframe: config.timeframe, from: config.from, to: config.to }, signal ? AbortSignal.any([signal, AbortSignal.timeout(200_000)]) : AbortSignal.timeout(200_000)),
  funding: (config: ResearchConfig, signal?: AbortSignal) => helperRequest<FundingData>("market-data", "POST", { action: "funding", provider: config.provider, symbol: config.symbol, timeframe: config.timeframe, from: config.from, to: config.to }, signal ? AbortSignal.any([signal, AbortSignal.timeout(200_000)]) : AbortSignal.timeout(200_000)),
  holdoutUsage: (id: string) => helperRequest<{ id: string; fingerprint: string; created: number; count: number }[]>(`results/${encodeURIComponent(id)}/holdout-usage`),
  analyses: (id: string) => helperRequest<ResearchAnalysis[]>(`results/${encodeURIComponent(id)}/analyses`),
  researchAnalysis: (id: string, kind: ResearchAnalysis["kind"], options: Record<string, unknown> = {}, selectionId?: string) => helperRequest<ResearchJob>(`results/${encodeURIComponent(id)}/analyses`, "POST", { kind, options, selectionId }),
  dataset: (config: ResearchConfig) => helperRequest<Dataset | null>("datasets", "POST", { provider: config.provider, product: "perpetual", symbol: config.symbol, timeframe: config.timeframe, from: config.from, to: config.to }),
  scripts: () => helperRequest<ScriptRecord[]>("scripts"),
  saveScript: (script: Partial<ScriptRecord>) => helperRequest<ScriptRecord>("scripts", "POST", script),
  deleteScript: (id: string) => helperRequest<{ deleted: boolean }>(`scripts/${encodeURIComponent(id)}`, "DELETE"),
  revisions: (id: string) => helperRequest<{ revision: number; source: string; hash: string; created: number }[]>(`scripts/${encodeURIComponent(id)}`),
  artifacts: () => helperRequest<CodeArtifact[]>("artifacts"),
  saveArtifact: (artifact: Partial<CodeArtifact>) => helperRequest<CodeArtifact>("artifacts", "POST", artifact),
  deleteArtifact: (id: string) => helperRequest<{ deleted: boolean }>(`artifacts/${encodeURIComponent(id)}`, "DELETE"),
  artifactRevisions: (id: string) => helperRequest<{ revision: number; kind: string; source: string; hash: string; metadata: Record<string, unknown>; created: number }[]>(`artifacts/${encodeURIComponent(id)}`),
  run: (request: RunRequest) => helperRequest<ResearchJob>("jobs", "POST", request),
  evaluateIndicator: (request: IndicatorEvaluationRequest) => helperRequest<ResearchJob>("jobs", "POST", request),
  job: (id: string) => helperRequest<ResearchJob>(`jobs/${encodeURIComponent(id)}`),
  cancel: (id: string) => helperRequest<ResearchJob>(`jobs/${encodeURIComponent(id)}`, "DELETE"),
  results: () => helperRequest<{ id: string; name: string; created: number }[]>("results"),
  result: (id: string) => helperRequest<ResearchResult>(`results/${encodeURIComponent(id)}`),
  evaluation: (id: string) => helperRequest<IndicatorEvaluationResult>(`evaluations/${encodeURIComponent(id)}`),
  monteCarlo: (id: string, seed: number, simulations: number) => helperRequest<ResearchJob>(`results/${encodeURIComponent(id)}/monte-carlo`, "POST", { seed, simulations }),
  importResult: (result: unknown) => helperRequest<{ id: string }>("results", "POST", result),
  importLegacy: (record: unknown) => helperRequest<{ id: string; status: string; reason: string }>("legacy", "POST", record),
};
