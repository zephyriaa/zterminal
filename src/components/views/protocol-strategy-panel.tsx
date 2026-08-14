"use client";

import { AlertTriangle, LockKeyhole, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateMinimalStrategy } from "@/domain/protocol/generation";
import { canApproveArtifact } from "@/domain/protocol/policy";
import { useInstitutionalProtocol } from "@/stores/institutional-protocol";
import { Panel, Pill } from "../terminal/primitives";

export function ProtocolStrategyPanel({ onAdoptSource }: { onAdoptSource: (source: string) => void }) {
  const { projects, activeProjectId, addGeneratedArtifact, setArtifactAssumption, approveArtifact } = useInstitutionalProtocol();
  const project = projects.find((item) => item.id === activeProjectId) ?? null;
  const revision = project?.revisions.at(-1) ?? null;
  const assessment = project?.assessments.at(-1) ?? null;
  const artifact = project?.artifacts.at(-1) ?? null;

  if (!project || !revision) {
    return <Panel className="m-3 p-3"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-warn" /><div><h2 className="text-[12px] font-semibold">No cited protocol selected</h2><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Standard ZS authoring remains available. To use controlled generation, begin in Research Lab with a cited three-rule specification.</p></div></div></Panel>;
  }

  const generationAllowed = project.stage === "READY_FOR_GENERATION" && Boolean(assessment?.readyForGeneration) && revision.scopeViolations.length === 0;
  const approval = artifact ? canApproveArtifact(artifact) : null;
  const generate = () => {
    if (!generationAllowed) return;
    const next = generateMinimalStrategy(revision);
    addGeneratedArtifact(project.id, next);
    if (next.source) onAdoptSource(next.source);
  };

  return (
    <Panel className="m-3 p-3">
      <div className="flex flex-wrap items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-research" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[12px] font-semibold">Institutional Protocol generation</h2><Pill tone="research">CITED · MINIMAL · REVIEW REQUIRED</Pill></div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{project.citation.author} ({project.citation.year}) · revision {revision.revision} · {project.citation.title}</p></div></div>
      <div className="mt-2 grid gap-2 text-[10.5px] md:grid-cols-3"><div><span className="text-muted-foreground">Entry</span><p>{revision.entry}</p></div><div><span className="text-muted-foreground">Exit</span><p>{revision.exit}</p></div><div><span className="text-muted-foreground">Sizing</span><p>{revision.sizing}</p></div></div>

      {!artifact && <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" onClick={generate} disabled={!generationAllowed} className="h-7 bg-research text-[11px] text-research-foreground hover:bg-research/90"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Generate simplest version</Button><span className="text-[9.5px] text-muted-foreground">{generationAllowed ? "Deterministic local adapter; it refuses unsupported rule grammar instead of improvising." : "Generation remains locked until cited rules and native data assessment pass."}</span></div>}

      {artifact && <div className="mt-3 rounded border hairline bg-surface p-2.5"><div className="flex flex-wrap items-center gap-2"><span className="text-[10.5px] font-medium">Generated artifact {artifact.hash}</span><Pill tone={artifact.approval === "APPROVED" ? "pos" : "warn"}>{artifact.approval.replaceAll("_", " ")}</Pill></div>{artifact.unsupportedRequirements.length > 0 ? <div className="mt-2 rounded border border-warn/40 bg-warn/5 p-2 text-[10px]"><div className="font-medium text-warn">No code was approved</div>{artifact.unsupportedRequirements.map((requirement) => <p key={requirement} className="mt-1 leading-relaxed text-foreground/85">• {requirement}</p>)}</div> : <><pre className="mt-2 max-h-36 overflow-auto rounded bg-background p-2 font-mono-num text-[9.5px] leading-relaxed text-foreground/85">{artifact.source}</pre><div className="mt-2 space-y-1.5">{artifact.assumptions.map((assumption) => <label key={assumption.id} className="flex items-start gap-2 rounded border hairline px-2 py-1.5 text-[10px]"><input type="checkbox" checked={assumption.approved} onChange={(event) => setArtifactAssumption(project.id, artifact.id, assumption.id, event.target.checked)} className="mt-0.5" /><span><span className="font-medium">Approve assumption:</span> {assumption.question}<span className="block text-muted-foreground">Resolved as: {assumption.resolution}</span></span></label>)}</div><div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => approveArtifact(project.id, artifact.id)} disabled={!approval?.ok || artifact.approval === "APPROVED"} className="h-7 bg-research text-[11px] text-research-foreground hover:bg-research/90"><LockKeyhole className="mr-1 h-3.5 w-3.5" />{artifact.approval === "APPROVED" ? "Baseline code locked" : "Approve and lock baseline code"}</Button>{!approval?.ok && <span className="text-[9.5px] text-warn">{approval?.reason}</span>}</div></>}</div>}
    </Panel>
  );
}
