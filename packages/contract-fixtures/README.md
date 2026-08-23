# ZTerminal Contract Fixtures

This directory is the migration boundary between the existing TypeScript terminal and the Rust desktop engine. Fixtures are **deterministic test inputs only**; they are not market data, may never be shipped as live data, and must remain labelled `provider: fixture` and `environment: simulation`.

Every fixture case records its protocol version, source status, event sequence, and expected result. Implementations in TypeScript and Rust must consume the same inputs and agree on bar values, duplicate handling, gap status, and deterministic indicator/backtest outputs before desktop ownership is moved from the web implementation.

| Fixture family | Initial purpose | Required invariant |
| --- | --- | --- |
| `trades-contiguous-v1.json` | Tick-to-bar aggregation parity | Derived bars contain only observed trades. |
| `trades-gap-v1.json` | Stream-discontinuity parity | A gap produces an explicit unavailable/gap state; no filler trade or bar is invented. |
| `indicator-vectors-v1.json` | Incremental indicator parity | Each output is reproducible from declared input and parameters. |
| `backtest-vectors-v1.json` | Research-engine parity | Results preserve the declared anti-lookahead model and deterministic run hash. |

The Phase 0 Rust unit tests use equivalent embedded vectors while the TypeScript parity runner is added in the next extraction step. A fixture file must not introduce a provider-specific field into the normalized contract without a versioned schema change.
