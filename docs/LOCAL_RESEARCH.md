# Local research private preview

The new research contract is version 1. The web terminal will connect to a paired Windows x64 helper on loopback. Python runs locally with the user's permissions, not in the Render application and not in a security sandbox. No broker execution is provided.

## Data and reproducibility

Test ranges use UTC epoch milliseconds and an exclusive end. Every requested candle must be present, unique, structurally valid, and closed. Incomplete history must not silently become a shorter test. Results retain exact source, configuration, data and engine versions with SHA-256 hashes. All returns are fractions at the interface boundary.

## Source reconciliation

The original working tree is retained in stash `e6b2383cec1f444a21e7664417f10c48d594282f`. The branch was fast-forwarded to `705402d`; provider selection and normalized chart data from upstream were preserved. Unrelated native/Rust/README changes remain outside redesign commits. The old published workspace remains active until its replacement is ready.

## Delivery

Milestones are validated against the exact staged source, pushed to main, deployed through the existing Render service, and checked in production. The helper is a private preview; public installer release gating remains unchanged.
