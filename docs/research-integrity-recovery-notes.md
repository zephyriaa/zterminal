# Research evidence and draft recovery slice

## Prioritized plan and scope

The starting working tree was clean. Inspection identified an existing immutable
Helper run archive with hidden report assumptions, missing retrieval metadata,
and an IndexedDB hydration/Helper-connect race plus unconditional snapshot writes.
The canonical institutional plan supersedes the older local-first plan's active
shell and engine descriptions.

| Priority / roadmap | Change and dependency | Observable acceptance / risk |
| --- | --- | --- |
| 1 / Phase 0, foundations for 2–3 | Surface captured evidence; add optional retrieval observation to the existing v1 manifest and validate it in the Helper | All report tabs show source, range, coverage, freshness, engine, costs, sizing and saved assumptions; archive roundtrip retains metadata and tampering fails. Old artifacts remain readable with unknown freshness. No inferred historical accuracy. |
| 2 / Phase 1 foundation | Sequence hydration before Helper connection; compare and write snapshots in one IndexedDB transaction | A stale tab cannot replace or delete another tab's saved state; corrupt reads fail closed; rapid writes from one tab remain ordered. Conflicts require export then reload/reconciliation, not automatic merging. |
| 3 / Phases 0, 12–13 evidence | Run existing validation and focused browser recovery/report checks; correct stale architecture guidance | Record actual outcomes and gaps. No signed-release readiness claim and no new provider integration. |

## Implemented behavior / release notes

- The report reads evidence from the selected run rather than mutable editor state.
  Coverage checks detect range/identity mismatches and gaps; completeness is not
  provider certification. Fill/model assumptions are visible on every tab.
- New downloads retain `retrievedAt`. The candle hash still identifies candle
  content; the existing input/result hashes also cover retrieval metadata.
  Cached datasets retain their original timestamp; older results show unknown.
- Draft hydration runs once per tab before connecting to the Helper or checking
  instrument units. The editor waits for the recovery attempt to finish.
- Browser draft writes compare the stored snapshot with the last snapshot read
  or committed by that tab, atomically. A mismatch, failed read, invalid envelope,
  or failed write pauses further autosave for that tab. Existing saved bytes are
  retained; in-memory work can be exported as all drafts plus configuration.
- The warning instructs the user to export before closing/reloading. The JSON
  export contains source and configuration, not pairing tokens. Reconciliation
  remains manual (source can be copied into a new draft); no import/merge UI or
  conflict-safe cloud sync is claimed.
- Offline limitations are explicit: local runs need a running paired Helper,
  exact cached history, and instrument verification already held in the session.
  Fresh data and fresh instrument verification require a connection.
- Lint excludes the already Git-ignored `artifacts/` capture output, without
  relaxing application lint rules.

## Validation on Windows

- `npm run typecheck`: passed.
- `npm test`: 166 passed, zero failures.
- `npm run lint`: passed after excluding capture output; 11 existing unused-disable
  warnings remain. The initial run failed on 21 CommonJS imports in ignored captures.
- `npm run build`: passed, including production TypeScript and static generation.
- `npm run test:drafts`: real Chromium IndexedDB checks passed for cross-tab
  conflict, stale deletion, queued writes, reload, simulated quota failure, and
  corrupt-record preservation.
- `TERMINAL_URL=http://127.0.0.1:3100 npm run test:terminal` (PowerShell environment
  equivalent): passed at 1440×900, 768×1024, 390×844.
- `node scripts/test-research-evidence.cjs`: passed across all six report tabs,
  using a local `test_engine.fixture()` result and mocked Helper transport.
  Screenshot: ignored `out/research-evidence-ui.png`. This tests display, not real pairing.
- `out/research-runtime/python.exe -m unittest discover -s research/desktop -p
  'test_*.py'`: 40 tests, passed with six optional PyArrow-related skips under
  existing embedded CPython 3.12.10. Includes timestamp validation, legacy absence,
  immutable archive/export roundtrip, and metadata tampering rejection.
- `npm run test:python`: blocked because the Windows launcher has no registered
  CPython 3.12. The existing embedded Helper runtime can run desktop tests but
  lacks `pydantic` for the broader API suite (import failures after explicitly
  adding `research/api` to the module path). Full Python gate is **not passed**.
- Production standalone startup served the terminal for smoke testing but logged
  missing auth configuration. This is not the valid/invalid startup matrix gate.

## Remaining milestones and limits

Phase 0 still needs duplicate-path inventory and production auth startup matrix
evidence. Phase 1 needs workspace/chart-scoped documents, durable outbox and
revision cursors, explicit conflict resolution, migration and broader recovery
tests. Browser drafts remain origin-local and can be lost if browser storage is
cleared; export and Helper saves remain necessary durable copies.

Phases 2–3 still need immutable strategy/run V2 contracts and deliberate baseline
comparison. The present result archive/report is not that completed milestone.
No markets, AI integrations, cloud uploads, or native-wrapper features were added.

For the full Python gate, provision the repository's isolated CPython 3.12 test
environment and dependencies, then rerun `npm run test:python`; optional event
coverage needs PyArrow. Public Windows delivery still requires publisher signing,
timestamp/hash/manifest validation, installation/update/recovery compatibility,
and privacy/release evidence. None is certified by these browser tests.
