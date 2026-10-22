# Architecture Review — Independent ZTerminal Reality Audit

Commit `e5f7f4d1` (main). Structure observed in the repository, with runtime checks where the Linux audit environment allowed.

## 1. System map (as found)

```
Web (Next.js 16 / React 19 / TS, Prisma + next-auth Google)
 ├─ src/app/terminal|workspaces  dockview workspace shell, lightweight-charts
 ├─ src/lib/market/*             providers (gateio, binance, okx, bybit, coinbase),
 │                               public-stream (native WebSocket), order-flow, provenance
 ├─ src/app/api/{bars,contracts,cloud,auth,…}   server routes (validation observed)
 ├─ src/lib/local-research/*     loopback Helper client (pairing, scripts, datasets)
 ├─ src/lib/research/*           compute-engine/optimizer/transpiler (TS research utilities)
 ├─ packages/zterminal-research-wasm            Rust→WASM research package (linked file dep)
 └─ mini-services/market-data    separate Node gateway process (socket.io-era + WS)
Helper (private, Windows): research/desktop — engine.py, execution_models.py, analytics.py,
                           controller/server/child, validation, archive, build-private.ps1
Research API: research/api (FastAPI-style app: worker, policy, pine.py, postgres_store)
Rust: crates/{zt-core,zt-adapters,zt-execution,zt-protocol,zt-risk,zt-storage},
      research/core (deterministic engine), src-tauri, apps/windows-host (Win32/D3D),
      apps/zt-local-* (monte-carlo, scene-bridge, workspace, ingest…)
```

## 2. What is genuinely coherent

1. **The web app is one product, not a demo collage.** Workspaces dashboard → dockview terminal → chart → panels share a single layout/persistence model (`panel-layout`, `workspace-dock-layout`, autosave). The new dashboard-first flow (commit #13, the day before the audit) is consistent across UI and local storage.
2. **The research engine is a serious artifact.** Decimal accounting, hash-covered evidence (RFC 8785), seeded RNG, guardrails, holdout, bounded logs, process limits, pinned runtime (CPython 3.12.10 + vectorbt 0.28.1 verified in `build-private.ps1` before packaging), SHA256SUMS manifest. This is engineering, not decoration — and its own test suite passes (19/19 executable here).
3. **Retirement is explicit.** The legacy ZS backtest endpoint returns 410 with a comment preventing silent JS fallback. Dead paths are being removed rather than left dangling.
4. **Honesty is architectural, not cosmetic.** `dataStatus`, `integrity`, feed-health states, `assumptions` blocks, and "verify the market before reusing drawings" flows are enforced in code, not just marketing copy.

## 3. Disconnected / overlapping engineering work (spec §10.1)

| Capability | Implementations found | Assessment |
|---|---|---|
| Backtesting | Legacy ZS (retired 410), Helper Python engine (active), Rust `research/core` (deterministic engine for the API), TS compute-engine/optimizer | Three active + one retired. The web cannot run any of them without the Helper/API. Fragmented but consciously sequenced |
| Market-data gateways | `src/lib/market` providers + `mini-services/market-data` + `crates/zt-adapters` + `apps/zt-direct-public-ingest` | Multiple layers; production reliability today is poor (live feed down) despite the redundancy — the layers are not yet mutually reinforcing |
| Windows shells | Win32/D3D prototype, `src-tauri`, `apps/windows-host`, `apps/desktop-phase0-cli` | Roadmap Phase 01 admits consolidation is the next priority; today this is four concurrent bets |
| Persistence | Browser localStorage (local workspaces), Prisma/SQLite dev, Postgres (prod schema + research API), Rust `zt-storage`, research `db/schema.sql` | Five persistence stories; cloud sync gated on Google auth; anonymous workspaces are fragile (fresh context lost) |
| Research execution | Helper (local), research API + worker (server), WASM package | The deployed web product currently exposes only the Helper path |

## 4. Main architectural risks

1. **The advertised loop has a Windows-shaped hole.** The web product's headline capability (Python research) is unreachable from the browser alone; every other subsystem depends on this bridge maturing.
2. **Production operational fragility.** Live market-data gateway down at audit; Binance geo-block unhandled at the infra level (only per-request honesty). Redundant gateway layers did not prevent a total live-data outage — the weakness is deployment/ops, not code volume.
3. **Five persistence models** raise the odds of state divergence (the roadmap's own Phase 05 success criterion).
4. **Repo hygiene:** dev artifacts in the public root (`worklog.md`, `verify-*.png`, `README_GITHUB_ORIGINAL.md`, a 40 MB clone) signal a solo-developer workflow not yet hardened for contributors.

## 5. Is the architecture a defensible foundation?

Yes, conditionally. The core abstractions (dataset identity, evidence hashes, execution models as versioned contracts, explicit data-status plumbing) are the right ones for a research platform and are rare in hobby-grade projects. The risk is not that the foundations are wrong — it is that the project keeps pre-paying for future subsystems (Rust engine, native shells, server research API) while the one bridge users actually need (Helper usability + live-feed reliability) is the least finished. Concentration, not redesign, is the correct next move, and the roadmap already says so.
