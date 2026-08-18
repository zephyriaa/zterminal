export const LOCAL_RESEARCH_DRAFT_KEY = "zterminal-research-draft-v1";

export type LocalResearchDataset = {
  provider: "gateio";
  symbol: string;
  interval: string;
  requestedFrom: number | null;
  requestedTo: number | null;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  returnedBars: number;
  complete: boolean;
  sourceTimestamp: number | null;
  fetchedAt: number;
};

export type LocalResearchDraft = {
  id: string;
  workspaceName: string;
  title: string;
  hypothesis: string;
  condition: string;
  dataset: LocalResearchDataset;
  savedAt: number;
};

export function createResearchDraftId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function readLocalResearchDraft(): LocalResearchDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_RESEARCH_DRAFT_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<LocalResearchDraft>;
    if (!candidate.id || !candidate.hypothesis || !candidate.condition || !candidate.dataset) return null;
    return candidate as LocalResearchDraft;
  } catch {
    return null;
  }
}

export function writeLocalResearchDraft(draft: LocalResearchDraft) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(LOCAL_RESEARCH_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalResearchDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_RESEARCH_DRAFT_KEY);
  } catch {}
}
