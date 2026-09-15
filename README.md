# ZTerminal

ZTerminal is a chart-first quantitative research workspace for the disciplined
cycle: **hypothesis → code → configure → run → understand → change one thing → rerun**.

It is under active development. The implementation is deliberately local-first:
the web terminal uses a separate Windows Helper for local research compute and
secure persistent secrets; the native Windows workstation will consume the same
serialized datasets, strategy revisions, and experiment artifacts.

## Current, truthful status

Available today:

- Next.js 16 terminal with the active `FloatingWorkstationShell`, Lightweight
  Charts, drawings, studies, multi-chart scaffolding, and persisted chart
  documents.
- Gate.io and Binance public market adapters, sequence-aware local books, feed
  health states, deterministic order-flow calculations, and a Big Trades chart
  overlay.
- A Windows Local Helper loopback API with pairing, immutable result archives,
  cancellation, data hashing, next-bar fills, and Monte Carlo primitives.
- Prisma data models for workspaces, strategy versions, datasets, runs,
  lineage, and one-variable experiment changes.

Not yet available as a production claim:

- Durable workspace envelopes and conflict-safe cloud synchronization.
- AI coding/analysis, historical microstructure recording, Deribit options/GEX,
  authoritative replay, or web/native workstation release parity.
- A security sandbox for pasted or AI-generated Python. The Helper uses the
  current Windows user's permissions, so code must be treated as trusted only
  after review.

The canonical architecture and phased delivery plan live in
[docs/INSTITUTIONAL_RESEARCH_WORKSPACE_PLAN.md](docs/INSTITUTIONAL_RESEARCH_WORKSPACE_PLAN.md).
The data-reality matrix is [docs/DATA_CAPABILITY_MATRIX.md](docs/DATA_CAPABILITY_MATRIX.md).

## Architecture

```text
Auth.js + Supabase PostgreSQL
identity, ownership, metadata, revisioned sync
                 ▲
                 │
Shared versioned domain contracts
Workspace │ Chart │ Dataset │ Strategy │ Experiment │ Replay │ Indicators
       ┌─────────┴─────────┐
       │                   │
Next.js web terminal    Native Windows workstation
Lightweight Charts      D3D/native renderer
IndexedDB repository    Rust local repository
       └──── ZTerminal Local Engine Protocol ────┘
                         │
Windows Helper / native sidecars
OS secret vault │ Python/vectorbt worker │ Rust event engine │ dataset archive
                         │
Gate/Binance public data │ Deribit options │ imported datasets
```

Parity means matching contracts, calculations, datasets, experiment identity,
and failure semantics. It does not require pixel-identical renderers.

### Product boundaries

- `/terminal` and `FloatingWorkstationShell` are the active web product shell.
- The separate Windows Helper is the canonical web-local execution boundary.
- Native Track B is the intended Windows workstation. The hosted Tauri wrapper
  is compatibility preview work, not a production workstation claim.
- Auth.js remains the identity layer. Cloud sync stays disabled unless Google
  OAuth, a session secret, and PostgreSQL are all configured.
- Gemini will be the first AI adapter through a provider-neutral contract.
- BTC/ETH Deribit options are the first options/GEX source. Gross gamma and OI
  walls are distinct from signed GEX estimates; estimates must be labelled.

## Local development and verification

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run lint
cargo test --workspace --all-targets
```

Python suites require the repository's locked Python 3.12 environment; the
machine-global interpreter is not a supported test runner:

```powershell
npm run test:python
```

Production authentication requires all of the following:

```env
NEXTAUTH_SECRET=<long-random-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
DATABASE_URL=postgresql://...
```

No shared development analyst identity, fallback session secret, API key, or
Helper pairing token may be synchronized to cloud state.

## Safety and research integrity

ZTerminal is research and decision-support software. Backtests are hypothetical;
market data can be delayed or incomplete. Missing microstructure/options data is
an unavailable input, never a zero or fabricated signal. The software does not
place orders or guarantee outcomes.
