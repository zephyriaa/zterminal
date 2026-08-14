"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dataAssessmentReady, resolveDataRequirements } from "@/domain/protocol/data-assessment";
import { canApproveArtifact, stableHash, validateCitation, validateRuleScope, validateSingleVariableChange } from "@/domain/protocol/policy";
import type {
  DataAssessment,
  GeneratedStrategyArtifact,
  ProtocolDecision,
  ProtocolProject,
  ProtocolRunRecord,
  ProtocolStage,
  ResearchCitation,
  RuleSpecRevision,
  SourceExcerpt,
  VariableChange,
} from "@/domain/protocol/types";

function id(prefix: string) {
  return `${prefix}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function deriveStage(citation: ResearchCitation, revision: RuleSpecRevision, assessment: DataAssessment): ProtocolStage {
  if (validateCitation(citation).length) return "NEEDS_SOURCE";
  if (revision.scopeViolations.length) return "NEEDS_RULE_CLARIFICATION";
  if (!assessment.readyForGeneration) return "READY_FOR_DATA_REVIEW";
  return "READY_FOR_GENERATION";
}

function createRevision(input: Pick<RuleSpecRevision, "entry" | "exit" | "sizing">, revision = 1, excerpts: string[] = []): RuleSpecRevision {
  const draft = { ...input, scopeViolations: validateRuleScope(input) };
  return {
    id: id("rules"),
    revision,
    entry: input.entry,
    exit: input.exit,
    sizing: input.sizing,
    sourceExcerptIds: excerpts,
    deferredVariables: [],
    scopeViolations: draft.scopeViolations,
    hash: stableHash({ revision, entry: input.entry, exit: input.exit, sizing: input.sizing }),
    createdAt: now(),
  };
}

function createAssessment(revision: RuleSpecRevision): DataAssessment {
  const requirements = resolveDataRequirements(revision);
  const ready = dataAssessmentReady(requirements);
  return {
    id: id("assessment"),
    ruleSpecRevisionId: revision.id,
    requirements,
    selectedDataset: ready
      ? { provider: "Gate.io", symbol: "QQQX_USDT", timeframe: "5m", source: "GATEIO_HISTORICAL", qualityWarnings: ["Public exchange candles can contain provider corrections and are not a substitute for licensed order-flow data."] }
      : null,
    readyForGeneration: ready,
    createdAt: now(),
  };
}

interface ProtocolStore {
  projects: ProtocolProject[];
  activeProjectId: string | null;
  selectProject: (projectId: string | null) => void;
  createProject: (input: { name: string; citation: ResearchCitation; entry: string; exit: string; sizing: string; excerpt?: string; locator?: string }) => ProtocolProject;
  updateRules: (projectId: string, input: { entry: string; exit: string; sizing: string }) => void;
  updateCitation: (projectId: string, citation: ResearchCitation) => void;
  addGeneratedArtifact: (projectId: string, artifact: GeneratedStrategyArtifact) => void;
  setArtifactAssumption: (projectId: string, artifactId: string, assumptionId: string, approved: boolean) => void;
  approveArtifact: (projectId: string, artifactId: string) => void;
  addRun: (projectId: string, run: ProtocolRunRecord) => void;
  stageVariableChange: (projectId: string, change: VariableChange) => { ok: boolean; reason?: string };
  completeIncrementalRun: (projectId: string, run: ProtocolRunRecord) => void;
  addVariableChange: (projectId: string, change: VariableChange) => void;
  addDecision: (projectId: string, decision: ProtocolDecision) => void;
}

export const useInstitutionalProtocol = create<ProtocolStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      selectProject: (projectId) => set({ activeProjectId: projectId }),
      createProject: (input) => {
        const timestamp = now();
        const excerpts: SourceExcerpt[] = input.excerpt?.trim()
          ? [{ id: id("excerpt"), locator: input.locator?.trim() || "User-supplied source excerpt", text: input.excerpt.trim(), reviewerConfirmed: true }]
          : [];
        const revision = createRevision({ entry: input.entry, exit: input.exit, sizing: input.sizing }, 1, excerpts.map((excerpt) => excerpt.id));
        const assessment = createAssessment(revision);
        const project: ProtocolProject = {
          id: id("protocol"),
          name: input.name.trim() || input.citation.title.trim() || "Untitled cited rule spec",
          stage: deriveStage(input.citation, revision, assessment),
          citation: input.citation,
          excerpts,
          revisions: [revision],
          assessments: [assessment],
          artifacts: [],
          runs: [],
          pendingVariableChange: null,
          decisions: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({ projects: [project, ...state.projects], activeProjectId: project.id }));
        return project;
      },
      updateRules: (projectId, input) => set((state) => ({
        projects: state.projects.map((project) => {
          if (project.id !== projectId) return project;
          const previous = project.revisions.at(-1);
          const revision = createRevision(input, (previous?.revision ?? 0) + 1, previous?.sourceExcerptIds ?? []);
          const assessment = createAssessment(revision);
          return { ...project, stage: deriveStage(project.citation, revision, assessment), revisions: [...project.revisions, revision], assessments: [...project.assessments, assessment], updatedAt: now() };
        }),
      })),
      updateCitation: (projectId, citation) => set((state) => ({
        projects: state.projects.map((project) => {
          if (project.id !== projectId) return project;
          const revision = project.revisions.at(-1)!;
          const assessment = project.assessments.at(-1)!;
          return { ...project, citation, stage: deriveStage(citation, revision, assessment), updatedAt: now() };
        }),
      })),
      addGeneratedArtifact: (projectId, artifact) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId ? { ...project, artifacts: [...project.artifacts, artifact], updatedAt: now() } : project),
      })),
      setArtifactAssumption: (projectId, artifactId, assumptionId, approved) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId ? {
          ...project,
          artifacts: project.artifacts.map((artifact) => artifact.id === artifactId ? { ...artifact, assumptions: artifact.assumptions.map((assumption) => assumption.id === assumptionId ? { ...assumption, approved } : assumption) } : artifact),
          updatedAt: now(),
        } : project),
      })),
      approveArtifact: (projectId, artifactId) => set((state) => ({
        projects: state.projects.map((project) => {
          if (project.id !== projectId) return project;
          const candidate = project.artifacts.find((artifact) => artifact.id === artifactId);
          if (!candidate || !canApproveArtifact(candidate).ok) return project;
          const artifacts = project.artifacts.map((artifact) => artifact.id === artifactId ? { ...artifact, approval: "APPROVED" as const } : artifact);
          return { ...project, artifacts, stage: "READY_FOR_GENERATION", updatedAt: now() };
        }),
      })),
      addRun: (projectId, run) => set((state) => ({
        projects: state.projects.map((project) => {
          if (project.id !== projectId) return project;
          const stage: ProtocolStage = run.runClass === "BASELINE" ? "BASELINE_REVIEWED" : "INCREMENTAL_RESEARCH";
          return { ...project, runs: [...project.runs, run], stage, updatedAt: now() };
        }),
      })),
      stageVariableChange: (projectId, change) => {
        const validation = validateSingleVariableChange([change]);
        if (!validation.ok) return validation;
        const project = get().projects.find((item) => item.id === projectId);
        if (!project?.runs.some((run) => run.runClass === "BASELINE")) return { ok: false, reason: "A reviewed baseline is required before adding complexity." };
        set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? { ...item, pendingVariableChange: change, stage: "INCREMENTAL_RESEARCH", updatedAt: now() } : item) }));
        return { ok: true };
      },
      completeIncrementalRun: (projectId, run) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId ? { ...project, runs: [...project.runs, run], pendingVariableChange: null, stage: "INCREMENTAL_RESEARCH", updatedAt: now() } : project),
      })),
      addVariableChange: (projectId, change) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId ? { ...project, decisions: [...project.decisions, { id: id("decision"), type: "VARIABLE_ACCEPTED", detail: `${change.label}: ${change.before} → ${change.after}`, createdAt: now() }], stage: "INCREMENTAL_RESEARCH", updatedAt: now() } : project),
      })),
      addDecision: (projectId, decision) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId ? { ...project, decisions: [...project.decisions, decision], updatedAt: now() } : project),
      })),
    }),
    { name: "zterminal-institutional-protocol-v1" }
  )
);
