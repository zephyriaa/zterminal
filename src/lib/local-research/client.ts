import { HELPER_URL, RESEARCH_PROTOCOL, type CodeArtifact, type Dataset, type IndicatorEvaluationRequest, type IndicatorEvaluationResult, type ResearchConfig, type ScriptRecord, type ResearchJob, type ResearchResult, type RunRequest } from "./contracts";

export class HelperError extends Error {
  constructor(message: string, public code: "unavailable" | "permission_denied" | "unpaired" | "invalid_code" | "incompatible" | "request_failed") { super(message); }
}
const TOKEN_KEY = "zterminal.local-research.token.v1";
let memoryToken: string | null = null;
function token() { try { return memoryToken ?? localStorage.getItem(TOKEN_KEY); } catch { return memoryToken; } }
export function forgetHelper() { memoryToken = null; try { localStorage.removeItem(TOKEN_KEY); } catch { /* optional browser persistence */ } }
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
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    if (path === "pair" && [400, 401, 403].includes(response.status)) throw new HelperError("That connection code is invalid or expired. Open ZTerminal Helper and copy a new code.", "invalid_code");
    if ([401, 403].includes(response.status)) throw new HelperError("ZTerminal Helper needs to be paired with this browser session.", "unpaired");
    throw new HelperError("ZTerminal Helper could not complete that request. Try again after checking that it is running.", "request_failed");
  }
  return payload as T;
}
export async function capabilities() {
  const caps = await helperRequest<{ protocol: number; version: string; platform: string; activeJob: string | null }>("capabilities");
  if (caps.protocol !== RESEARCH_PROTOCOL || caps.platform !== "windows-x64") throw new HelperError("This helper version is incompatible. Install the matching Windows x64 private preview.", "incompatible");
  return caps;
}
export async function pairHelper(code: string) {
  const result = await helperRequest<{ token: string; protocol: number }>("pair", "POST", { code });
  if (result.protocol !== RESEARCH_PROTOCOL) throw new HelperError("Incompatible helper protocol.", "incompatible");
  memoryToken = result.token;
  try { localStorage.setItem(TOKEN_KEY, result.token); } catch { /* Pairing remains valid for this session. */ }
}
export const helper = {
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
