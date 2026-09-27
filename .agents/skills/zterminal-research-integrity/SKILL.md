---
name: zterminal-research-integrity
description: Enforces non-negotiable research correctness, exact-source execution, deterministic provenance, and fail-closed runtime invariants in ZTerminal.
---

# ZTerminal Research Integrity

This skill defines the non-negotiable architectural and algorithmic invariants governing research, strategy execution, backtesting, and provenance in ZTerminal.

## Core Invariants

1. **Exact-Source Execution**:
   - The result displayed to the user must correspond to the strategy that was actually executed.
   - Arbitrary Python must execute in a real CPython runtime environment (via the local ZTerminal Helper process).
   - Never transpile arbitrary Python into synthetic or hard-coded rules.

2. **No Fabricated Success**:
   - Never silently substitute user code with EMA crossover, RSI, VWAP, Donchian, or any template fallback.
   - Never generate mock or `Math.random()` equity curves, trades, or metrics.
   - If the local Python runtime is disconnected, unavailable, or unpaired, execution must **fail closed** immediately.

3. **Deterministic Provenance**:
   - Every `ResearchResult` must record true cryptographic SHA-256 hashes:
     - `sourceHash`: exact SHA-256 of the executed Python source.
     - `datasetHash`: exact SHA-256 of the closed, sorted candle matrix (RFC 8785 canonical digest).
     - `resultHash`: canonical digest of the complete result envelope excluding volatile fields.
   - Reproducing a run (`reproduceRun`) must preserve exact source, dataset, and parameters, and record `reproducedFrom: <originalRunId>`.

4. **Testing Requirements**:
   - Whenever modifying strategy execution, compute engine, or local helper integration, run both test suites:
     - Python engine suite: `python-engine\.venv\Scripts\python.exe -m unittest discover -s research\desktop -p "test_*.py"`
     - TypeScript test suite: `npm.cmd test`
     - Typecheck: `npm.cmd run typecheck`
