"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, Database, FileWarning, FlaskConical, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dataAssessmentReady, resolveDataRequirements } from "@/domain/protocol/data-assessment";
import { validateCitation, validateRuleScope } from "@/domain/protocol/policy";
import type { ResearchCitation } from "@/domain/protocol/types";
import { useInstitutionalProtocol } from "@/stores/institutional-protocol";
import { Panel, Pill } from "../terminal/primitives";

const initialCitation: ResearchCitation = {
  title: "",
  author: "",
  year: new Date().getUTCFullYear(),
  sourceType: "DOI",
  reference: "",
  sourceText: "",
};

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>{children}{note ? <span className="mt-1 block text-[9.5px] text-muted-foreground">{note}</span> : null}</label>;
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full rounded-[5px] border hairline bg-surface px-2 py-1.5 text-[12px] leading-relaxed outline-none placeholder:text-muted-foreground focus:border-research/70" />;
}

const stageTone: Record<string, "default" | "warn" | "pos" | "research" | "mdata"> = {
  DRAFT: "default",
  NEEDS_SOURCE: "warn",
  NEEDS_RULE_CLARIFICATION: "warn",
  READY_FOR_DATA_REVIEW: "mdata",
  READY_FOR_GENERATION: "pos",
  BASELINE_RUNNING: "research",
  BASELINE_REVIEWED: "pos",
  INCREMENTAL_RESEARCH: "research",
  PAUSED: "default",
  ARCHIVED: "default",
};

export function InstitutionalProtocolLab({ onOpenStrategy }: { onOpenStrategy: () => void }) {
  const { projects, activeProjectId, selectProject, createProject } = useInstitutionalProtocol();
  const active = projects.find((project) => project.id === activeProjectId) ?? null;
  const [citation, setCitation] = useState<ResearchCitation>(initialCitation);
  const [name, setName] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [sizing, setSizing] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [locator, setLocator] = useState("");

  const citationFailures = useMemo(() => validateCitation(citation), [citation]);
  const scopeViolations = useMemo(() => validateRuleScope({ entry, exit, sizing }), [entry, exit, sizing]);
  const previewRequirements = useMemo(() => resolveDataRequirements({ entry, exit, sizing }), [entry, exit, sizing]);
  const canCreate = citationFailures.length === 0 && scopeViolations.length === 0;

  const save = () => {
    if (!canCreate) return;
    createProject({ name, citation, entry, exit, sizing, excerpt, locator });
    setName("");
    setCitation(initialCitation);
    setEntry("");
    setExit("");
    setSizing("");
    setExcerpt("");
    setLocator("");
  };

  return (
    <div className="h-full overflow-y-auto scroll-thin bg-background">
      <div className="border-b hairline bg-panel px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical className="h-4 w-4 text-research" />
          <span className="text-[13px] font-semibold">Research Lab · Institutional Protocol</span>
          <Pill tone="research">CITED · THREE RULES · NO OPTIMIZATION</Pill>
          <span className="ml-auto text-[10px] text-muted-foreground">Local protocol workspace — durable team storage requires authenticated release.</span>
        </div>
        <p className="mt-1.5 max-w-5xl text-[11px] leading-relaxed text-muted-foreground">Start from an academic source. Extract only one entry rule, one exit rule, and one sizing rule. Any filter, regime condition, second timeframe, range, or optimization request is deliberately stopped here and deferred to a later single-variable experiment.</p>
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <Panel className="p-3">
          <div className="mb-3 flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-research" /><div><h2 className="text-[12.5px] font-semibold">Create cited rule spec</h2><p className="text-[10px] text-muted-foreground">No anonymous edge and no generic AI strategy prompt can enter this workflow.</p></div></div>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Protocol name"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Paper-backed edge" className="h-8 bg-surface text-[12px]" /></Field>
            <Field label="Source type"><select value={citation.sourceType} onChange={(event) => setCitation({ ...citation, sourceType: event.target.value as ResearchCitation["sourceType"] })} className="h-8 w-full rounded-[5px] border hairline bg-surface px-2 text-[12px]"><option value="DOI">DOI</option><option value="ARXIV">arXiv</option><option value="URL">Publication URL</option><option value="PASTED_TEXT">Pasted methodology</option><option value="PDF">PDF evidence</option></select></Field>
            <Field label="Paper title"><Input value={citation.title} onChange={(event) => setCitation({ ...citation, title: event.target.value })} placeholder="Required" className="h-8 bg-surface text-[12px]" /></Field>
            <Field label="Author(s)"><Input value={citation.author} onChange={(event) => setCitation({ ...citation, author: event.target.value })} placeholder="Required" className="h-8 bg-surface text-[12px]" /></Field>
            <Field label="Publication year"><Input value={String(citation.year)} type="number" onChange={(event) => setCitation({ ...citation, year: Number(event.target.value) })} className="h-8 bg-surface text-[12px]" /></Field>
            <Field label="DOI / arXiv / source URL"><Input value={citation.reference} onChange={(event) => setCitation({ ...citation, reference: event.target.value })} placeholder="Required" className="h-8 bg-surface text-[12px]" /></Field>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <Field label="Retained source text or methodology" note="Required. The product records evidence; it does not claim to read a paper that was not supplied."><TextArea value={citation.sourceText} onChange={(value) => setCitation({ ...citation, sourceText: value })} placeholder="Paste the relevant abstract or methodology excerpt…" rows={4} /></Field>
            <Field label="Rule evidence excerpt" note="Optional but recommended: bind the three rules to a source location."><TextArea value={excerpt} onChange={setExcerpt} placeholder="Quoted evidence for the extracted rules…" rows={4} /></Field>
          </div>
          <Field label="Excerpt locator" note="For example: p. 7, Methodology §3.2"><Input value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="Page, table, or section" className="h-8 bg-surface text-[12px]" /></Field>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <Field label="1 · Entry rule"><TextArea value={entry} onChange={setEntry} placeholder="One explicit, testable entry condition." /></Field>
            <Field label="2 · Exit rule"><TextArea value={exit} onChange={setExit} placeholder="One explicit, testable exit condition." /></Field>
            <Field label="3 · Sizing rule"><TextArea value={sizing} onChange={setSizing} placeholder="One explicit sizing instruction." /></Field>
          </div>

          {(citationFailures.length > 0 || scopeViolations.length > 0) && <div className="mt-3 rounded-[5px] border border-warn/40 bg-warn/5 p-2.5 text-[10.5px] text-foreground/85"><div className="mb-1 flex items-center gap-1 font-medium text-warn"><FileWarning className="h-3.5 w-3.5" />Blocked until clarification</div>{[...citationFailures, ...scopeViolations.map((violation) => `${violation.field}: ${violation.message}${violation.fragment ? ` (“${violation.fragment}”)` : ""}`)].map((message) => <div key={message} className="leading-relaxed">• {message}</div>)}</div>}
          <div className="mt-3 flex items-center gap-2"><Button onClick={save} disabled={!canCreate} className="h-8 bg-research text-[12px] text-research-foreground hover:bg-research/90"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Create cited rule spec</Button><span className="text-[10px] text-muted-foreground">Creation freezes revision 1; later edits create a new revision.</span></div>
        </Panel>

        <div className="space-y-3">
          <Panel className="p-3"><div className="mb-2 flex items-center gap-2"><Database className="h-4 w-4 text-mdata" /><h2 className="text-[12px] font-semibold">Data requirements preview</h2></div><div className="space-y-1.5">{previewRequirements.map((requirement) => <div key={requirement.id} className="rounded border hairline bg-surface px-2 py-1.5"><div className="flex items-center gap-2"><span className="text-[10.5px] font-medium">{requirement.label}</span><Pill tone={requirement.coverage === "NATIVE_VERIFIED" ? "pos" : requirement.coverage === "IMPORT_REQUIRED" ? "warn" : "default"}>{requirement.coverage.replaceAll("_", " ")}</Pill></div><p className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">{requirement.detail}</p></div>)}</div><p className="mt-2 text-[9.5px] text-muted-foreground">{dataAssessmentReady(previewRequirements) ? "Verified native Gate.io candle requirements are available for the stated rule." : "Generation remains blocked until every requirement is native verified or a versioned import is attached."}</p></Panel>
          <Panel className="p-3"><div className="mb-2 flex items-center gap-2"><Workflow className="h-4 w-4 text-research" /><h2 className="text-[12px] font-semibold">Protocol queue</h2></div>{projects.length ? <div className="space-y-1.5">{projects.map((project) => <button key={project.id} onClick={() => selectProject(project.id)} className={`w-full rounded border p-2 text-left transition-colors ${activeProjectId === project.id ? "border-research bg-research/5" : "hairline bg-surface hover:bg-hover"}`}><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[11px] font-medium">{project.name}</span><Pill tone={stageTone[project.stage] ?? "default"}>{project.stage.replaceAll("_", " ")}</Pill></div><p className="mt-1 truncate text-[9.5px] text-muted-foreground">{project.citation.author} · {project.citation.year} · r{project.revisions.at(-1)?.revision}</p></button>)}</div> : <p className="text-[10.5px] text-muted-foreground">No cited rule specs yet.</p>}</Panel>
        </div>
      </div>

      {active && <div className="px-3 pb-3"><Panel className="p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold">Active protocol: {active.name}</span><Pill tone={stageTone[active.stage] ?? "default"}>{active.stage.replaceAll("_", " ")}</Pill><span className="text-[10px] text-muted-foreground">Rule revision {active.revisions.at(-1)?.revision} · {active.artifacts.length} generated artifact(s) · {active.runs.length} run(s)</span>{active.stage === "READY_FOR_GENERATION" && <Button size="sm" onClick={onOpenStrategy} className="ml-auto h-7 bg-research text-[11px] text-research-foreground hover:bg-research/90">Open controlled generation</Button>}</div><div className="mt-2 grid gap-2 text-[10.5px] md:grid-cols-3"><div><span className="text-muted-foreground">Entry</span><p>{active.revisions.at(-1)?.entry}</p></div><div><span className="text-muted-foreground">Exit</span><p>{active.revisions.at(-1)?.exit}</p></div><div><span className="text-muted-foreground">Sizing</span><p>{active.revisions.at(-1)?.sizing}</p></div></div></Panel></div>}
    </div>
  );
}
