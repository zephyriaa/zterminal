import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  EVENT_DATASET_VERSION,
  MICROSTRUCTURE_CONTRACT_VERSION,
  type IngressProvenanceV1,
  type InstrumentUnitsV1,
} from "../src/lib/local-research/contracts";

type Fixture = {
  contractVersion: number;
  instrument: Omit<InstrumentUnitsV1, "revision" | "validToNs">;
  provenance: (IngressProvenanceV1 & { label: string })[];
  expectedReplayOrder: string[];
};

const fixture = JSON.parse(readFileSync(
  path.resolve(process.cwd(), "packages/contract-fixtures/microstructure-phase0-v1.json"),
  "utf8",
)) as Fixture;

test("microstructure fixture preserves 64-bit values as strings", () => {
  assert.equal(fixture.contractVersion, MICROSTRUCTURE_CONTRACT_VERSION);
  assert.equal(EVENT_DATASET_VERSION, 2);
  assert.equal(typeof fixture.instrument.validFromNs, "string");
  assert.equal(typeof fixture.provenance[0].availableAtNs, "string");
  assert.equal(typeof fixture.provenance[0].ingressOrdinal, "string");
  assert.equal(BigInt(fixture.instrument.validFromNs), BigInt("1700000000000000000"));
});

test("TypeScript replay ordering agrees with the shared fixture", () => {
  const ordered = [...fixture.provenance].sort((left, right) => {
    for (const key of ["availableAtNs", "ingressOrdinal"] as const) {
      const difference = BigInt(left[key]) - BigInt(right[key]);
      if (difference) return difference < BigInt(0) ? -1 : 1;
    }
    const stream = left.streamId.localeCompare(right.streamId);
    return stream || left.batchIndex - right.batchIndex;
  });
  assert.deepEqual(ordered.map(item => item.label), fixture.expectedReplayOrder);
});
