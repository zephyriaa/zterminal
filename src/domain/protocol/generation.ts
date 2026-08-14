import { stableHash } from "./policy";
import type { GeneratedStrategyArtifact, RuleSpecRevision } from "./types";

function codeComment(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/#/g, "").trim();
}

function id() {
  return `artifact_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

/**
 * The first protocol increment intentionally supports one narrow, fully explicit
 * grammar. It refuses natural-language gaps rather than silently adding rules.
 */
export function generateMinimalStrategy(revision: RuleSpecRevision): GeneratedStrategyArtifact {
  const entry = revision.entry.toLowerCase();
  const exit = revision.exit.toLowerCase();
  const sizing = revision.sizing.toLowerCase();
  const entryPeriod = entry.match(/(\d+)\s*(?:-| )?period\s+ema/);
  const exitPeriod = exit.match(/(\d+)\s*(?:-| )?period\s+ema/);
  const entryIsCrossOver = /cross(?:es)?\s+(?:above|over)|crossover/.test(entry);
  const exitIsCrossUnder = /cross(?:es)?\s+(?:below|under)|crossunder/.test(exit);
  const oneContract = /(?:exactly\s+)?one\s+(?:native\s+)?contract/.test(sizing);
  const unsupportedRequirements: string[] = [];

  if (!entryPeriod || !entryIsCrossOver) unsupportedRequirements.push("The deterministic generator currently supports an explicit crossover of close and an N-period EMA for the entry rule.");
  if (!exitPeriod || !exitIsCrossUnder) unsupportedRequirements.push("The deterministic generator currently supports an explicit crossunder of close and the same N-period EMA for the exit rule.");
  if (entryPeriod && exitPeriod && entryPeriod[1] !== exitPeriod[1]) unsupportedRequirements.push("Entry and exit reference different EMA periods; that is an unresolved additional rule choice.");
  if (!oneContract) unsupportedRequirements.push("The deterministic generator currently supports exactly one native contract as the baseline sizing rule.");

  const period = entryPeriod?.[1] ?? exitPeriod?.[1] ?? "0";
  const source = unsupportedRequirements.length
    ? ""
    : `# Institutional Protocol baseline — generated deterministically\n# Entry: ${codeComment(revision.entry)}\n# Exit: ${codeComment(revision.exit)}\n# Sizing: ${codeComment(revision.sizing)}\nstrategy("Protocol EMA Crossover Baseline", overlay=true)\n\nvar protocolEma = ema(close, ${period})\nplot(protocolEma, "Protocol EMA")\n\nif crossover(close, protocolEma)\n  strategy.entry("protocol-long", strategy.long, qty=1)\n\nif crossunder(close, protocolEma)\n  strategy.close("protocol-long")\n`;
  const assumptions = unsupportedRequirements.length
    ? []
    : [
        { id: "assumption-next-bar-fill", question: "The strategy runtime fills a signal at the next bar open. Approve this existing execution-model assumption.", resolution: "Next-bar-open fills, as defined by the current ZS runtime.", approved: false },
        { id: "assumption-long-only", question: "The extracted rules name only a long crossover path. Approve a long-only baseline with no short-side mirror.", resolution: "Long-only; no unmentioned short rule is added.", approved: false },
      ];
  const artifactContent = { revisionHash: revision.hash, source, assumptions, unsupportedRequirements };
  return {
    id: id(),
    ruleSpecRevisionId: revision.id,
    source,
    semanticManifest: { entry: revision.entry, exit: revision.exit, sizing: revision.sizing },
    assumptions,
    unsupportedRequirements,
    extrasDetected: [],
    approval: "PENDING_ASSUMPTIONS",
    hash: stableHash(artifactContent),
    createdAt: new Date().toISOString(),
  };
}

export function buildSingleVariableSource(parentSource: string, change: { kind: string; after: string }): { ok: true; source: string } | { ok: false; reason: string } {
  if (change.kind === "SIZING") {
    const quantity = Number(change.after);
    if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: "Sizing experiments require one positive integer native-contract quantity." };
    if (!/qty=1\b/.test(parentSource)) return { ok: false, reason: "The locked baseline source does not contain the expected fixed one-contract sizing literal." };
    return { ok: true, source: parentSource.replace(/qty=1\b/g, `qty=${quantity}`) };
  }
  if (change.kind === "FILTER") {
    if (change.after.trim().toLowerCase() !== "close > vwap") return { ok: false, reason: "The first constrained filter experiment supports only the explicit condition `close > vwap`; other filters require a reviewed strategy-engine extension." };
    const marker = "if crossover(close, protocolEma)\n  strategy.entry(\"protocol-long\", strategy.long, qty=1)";
    if (!parentSource.includes(marker)) return { ok: false, reason: "The locked baseline source does not match the supported minimal generation template." };
    return { ok: true, source: parentSource.replace(marker, "if close > vwap\n  if crossover(close, protocolEma)\n    strategy.entry(\"protocol-long\", strategy.long, qty=1)") };
  }
  return { ok: false, reason: `${change.kind.toLowerCase()} changes are intentionally not auto-implemented in the first constrained protocol adapter. Add a reviewed adapter before testing it.` };
}
