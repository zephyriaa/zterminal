# Research evidence bundles — version 1

The Validation report's **Export Evidence Bundle** downloads one JSON file containing:

- the immutable schema 4 validation, including methodology, configuration, diagnostics and runtime;
- the source ResearchRun and every linked validation execution;
- reproduction ancestors needed to follow the source run's lineage;
- exact Python source, parameters, friction assumptions and retained candles for each execution;
- a canonical manifest and explicit interpretation limits.

Export uses the paired Helper's authenticated `GET /v1/validations/{id}/export`. It reads one SQLite snapshot, checks the original Helper validation receipt, artifact hashes and linked runs, and never executes source or recalculates a historical report. Missing, corrupt or cyclic references fail explicitly. The bundle is capped at 200 runs and 32 MB; larger exports need a future streaming format. Nothing is published automatically.

## Identity boundaries

Digests use SHA-256 with RFC 8785 canonical JSON, except the exact UTF-8 source digest. Each ResearchRun retains its source, dataset, captured-input and core result hashes. The dataset hash covers the candle matrix; metadata is retained in the input/result envelopes. The core result hash excludes its own hash and the optional standalone `monteCarlo` attachment. Export omits that detached attachment. Validation Monte Carlo is part of the hashed validation and remains included.

Each manifest run entry includes the core hashes and a `payloadHash` over the entire exported ResearchRun. The manifest also identifies the source run, validation hash, validation configuration hash and validation fingerprint. Runs are sorted by ID. `graphFingerprint` hashes the manifest and stays stable when the same archive is exported again. `bundleHash` covers the full bundle except itself, including `exportedAt`; it changes when export metadata changes. A distinct historical validation has its own identity even if its computations agree with another run.

## Offline verification

From a checkout with the locked Helper environment:

```powershell
.venv-research/Scripts/python.exe research/desktop/artifacts.py path/to/zterminal-evidence-ID.json
```

This bounds the file read, rejects duplicate JSON keys, verifies the hashes and complete reference graph, checks reproduction input/parent identity, and reports:

```text
identity_verified_computation_not_reproduced
```

It does not execute retained Python, import results into the trusted archive, recompute quantitative metrics or contact a market provider. A failed check exits with a nonzero status. Unchanged hashes demonstrate canonical JSON content identity and exact source identity, not file formatting: whitespace and object-key order can change without changing the digest. Anyone can construct and hash an envelope; they do not attest execution, profitability, correctness or causal strategy logic. The original Helper receipt is checked locally before export and is not a portable execution attestation.

## Remaining Phase 2 work

Recipient inspection/import, explicit claimed-versus-local evidence status, fresh exact-source recipient reproduction and comparisons are subsequent milestones. An exported file must not become a Helper-generated validation merely by passing offline identity verification. Local Python executes with user permissions; recipient reproduction needs an intentional execution action and the recorded dependencies/runtime.
