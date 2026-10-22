# Security & Reliability Review — Independent ZTerminal Reality Audit

Bounded, non-destructive, unauthenticated black-box probes of production plus source review. No attack on third-party services; no real accounts used; no secrets exposed.

## 1. Verified controls (positive findings)

| Control | Evidence | Result |
|---|---|---|
| Cloud API auth enforcement | `GET /api/cloud/workspaces` → **401** `AUTH_REQUIRED` without session | PASS |
| Server-side input validation | Unknown symbol → **422**; invalid timeframe → **400**; symbol path-traversal string handled safely | PASS |
| Unbounded request clamping | `bars=99999999` → clamped to 1000 | PASS |
| Legacy endpoint retirement | `POST /api/backtest` → 410 `ZS_BACKTEST_RETIRED`, `Cache-Control: no-store` | PASS |
| Helper pairing tokens | Memory-only bearer token; localStorage tokens actively retired; pairing code UX; protocol + `windows-x64` handshake enforced client-side (`src/lib/local-research/client.ts`) | PASS (design) |
| Credentials posture | SECURITY.md mandates server-side-only credentials; no secrets observed in client bundles/URLs during session; helper runs with user's own permissions and says so | PASS (observed surfaces) |
| Data honesty as a security property | Unavailable/failed feeds labeled UNAVAILABLE with reasons; no synthetic data presented as live | PASS |

## 2. Findings

### S-1 — Live market-data gateway down in production (High, Confirmed, reproducible during audit window)
Both providers report `Effective=unavailable / Gateway=unknown / "Market gateway connection unavailable"`; the socket.io gateway probe returned nothing. Trading-research value collapses to historical-only. Honest display prevents misinformation but the advertised "live" experience was unavailable. Root cause not externally determinable (process not running, or deployment/egress issue). `evidence/screenshots/03,04`.

### S-2 — Binance geo-block surfaces as generic 503 (Medium, Confirmed)
Server egress IP blocked by Binance (403 → 503 to clients). Not a code defect, but an operational dependency that silently removes half the advertised provider coverage. Provider switch leaves the workspace in a broken-looking state (see R-1).

### S-3 — SECURITY.md materially stale (Medium, Confirmed)
The document asserts every market-data surface is SIMULATED, references Rithmic as the operative integration, and guides `cors: origin "*"` for a dev socket service — while production serves `environment:"live"` Gate data. A stale trust-boundary document is itself a security hazard for future development.

### S-4 — Anonymous workspaces are fragile and unexportable (Medium, Strong evidence)
"Local workspace" lives in browser storage; a fresh context showed an empty dashboard. No export/backup affordance was found for local workspaces. Silent loss of user research is possible (the product's own value proposition is "keep the evidence").

### S-5 — Helper executes arbitrary user Python unsandboxed (Disclosed, by design)
Engine module docstring, README, and result assumptions all state it plainly ("this is not a security sandbox"). Pairing + process limits are availability controls, not containment. Correctly disclosed; users must understand it.

### S-6 — Unsigned Helper distribution (Medium, Confirmed)
"Unsigned preview · v1.2.0-preview.1 · 170 MB" — no publisher signature (README gates signing on a later phase). Supply-chain hygiene inside the package is good (pinned runtime, SHA256SUMS manifest), but users cannot verify publisher identity at install time.

### S-7 — Theoretical: cloud workspace isolation untested (NOT TESTED)
Multi-user isolation of cloud workspaces could not be tested without creating real accounts (out of audit scope). Listed for completeness; no evidence of weakness found.

## 3. Reliability observations

- Page reload recovers the workspace record, but restored-provider state can be an unavailable provider (empty chart + 403) with no automatic fallback to the last healthy provider (R-1, reproducible).
- Rapid symbol/timeframe switching was exercised via provider switches and timeframe clicks without visible state corruption (limited coverage; both workspaces stayed consistent).
- Historical data path (REST) proved robust and honest across invalid inputs; the failures observed were upstream (exchange geo-block, gateway down), not client crashes.
- Prisma/DB-backed auth tests error in this sandbox without PostgreSQL — environmental; their CI badge (quality.yml) claims green on GitHub and was not independently re-verifiable here beyond the TypeScript gate (exit 0).

## 4. Answer (spec §9): can user research be lost, corrupted, or silently altered?

**Local/anonymous: yes, lost** (S-4). **Corrupted or silently altered: no evidence found** — result records are hash-covered (`evidenceHash`, `resultHash`), datasets hash-stamped, and the engine detects user-data mutation (`test_user_data_mutation_does_not_change_engine_prices` passes). Cloud-sync integrity was not testable without accounts.
