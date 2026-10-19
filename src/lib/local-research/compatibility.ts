import { RESEARCH_PROTOCOL } from "./contracts";

/** Requirements of the current workbench; protocol-v1 archives remain readable. */
export function supportsCurrentResearch(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== "object") return false;
  const caps = capabilities as Record<string, unknown>;
  const features = caps.features;
  return caps.protocol === RESEARCH_PROTOCOL
    && Array.isArray(caps.researchSchemas) && caps.researchSchemas.includes(2)
    && Array.isArray(features) && ["synthetic_next_open_v2", "research_analyses_v1", "indicator_dataset_v2"].every(feature => features.includes(feature));
}
