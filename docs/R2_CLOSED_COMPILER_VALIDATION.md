# R2 Closed ZS Compiler Validation

**Scope:** recovery branch only; no production deployment or promotion occurred. The compiler is a parser and diagnostic surface only. It does not evaluate user source.

## Closed-Compiler Contract

| Capability | Behavior |
|---|---|
| Grammar | Tokenizes and parses a narrow declarative ZS grammar into AST metadata, fixed strategy declarations, typed inputs, assignments, expressions, conditionals, allowlisted indicators, and declared strategy actions |
| Inputs | Discovers fixed `input.int`, `input.float`, `input.bool`, and `input.string` declarations with type and numeric-bound validation |
| Diagnostics | Returns source location, severity, and actionable diagnostics for malformed source, unknown identifiers, unsupported actions, and invalid input declarations |
| No-execution boundary | Does not call `eval`, `Function`, dynamic import, require, fetch, network APIs, filesystem APIs, shell, browser globals, brokers, or autonomous-action surfaces |
| Escape hatches | Explicitly rejects `eval`, `function`, `import`, `require`, `fetch`, `XMLHttpRequest`, `WebSocket`, `process`, `globalThis`, `window`, `document`, `fs`, `child_process`, `Deno`, `Bun`, `axios`, `http`, and `https` identifiers |

## Local Browser Evidence

On the local integrated workstation on 2026-08-18:

- The Strategy tab was unavailable until the browser-local protocol baseline had been explicitly approved and locked.
- With a locked baseline, the Strategy tab displayed a closed-source editor and the explicit statement: `Parser and diagnostics only · no code execution, imports, network, files, shell, broker, or autonomous actions`.
- A valid ZS source produced `VALIDATED · NOT EXECUTED`, named the closed compiler engine, and disclosed the discovered typed input `Length · int · default 20`.
- Replacing the source with `fetch("https://example.invalid")` produced two visible errors: a forbidden capability diagnostic and an unsupported-action diagnostic. The panel continued to state that compiled source was not executed, imported, fetched, persisted, or routed to any broker.
- The chart remained visible and the application footer continued to show execution disabled. No strategy result, order, network request from compiler source, or backtest was initiated.

## Quality Gates

| Gate | Result |
|---|---|
| Valid source, discovered inputs, malformed syntax, unsupported extension, no-execution, and forbidden-capability tests | Passed: 4 tests |
| Protocol baseline and one-variable contract tests | Passed: 4 tests |
| `pnpm check` | Passed |
| Full `pnpm test` | Passed: 15 files, 47 tests |
| `pnpm build` | Passed |

**R2 is complete on the recovery branch pending commit.** Backtesting remains a separate B1 slice and no compiler output is an executable strategy.
