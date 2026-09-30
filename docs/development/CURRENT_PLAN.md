# Current plan — Validation Engine certification

Phase 0 Research Core has exact-source CPython, deterministic provenance and a local archive. The paired browser backtest/reproduction/restart flow is verified on labeled simulated candles. A newly discovered browser-only reproduction-link bug has been repaired in the Helper, including hashed runtime/numerical comparison and explicit divergence status.

Phase 1 is in certification. Browser quantitative authority, retrospective WFO and synthetic sensitivity have been removed. Helper engine 0.2.0 / schema 4 executes each requested variant in fresh bounded CPython and computes the artifact outside user-code processes. The original target remains the full Validation Engine definition of done.

## Milestones

1. **Integrity repair — implemented:** no client metrics admitted. Mandatory matching parent reproduction; independently checked execution inputs; server-derived quantitative fields; atomic child/report save. Legacy unverified reports retained but withheld, without hiding current reports.
2. **Chronological/rolling execution — implemented:** disjoint cold-start segments and rolling tests; optional grid selection sees training return only. Boundary, next-open warm-up and future-data trap fixtures pass. Researcher source/grid selection remains unsealed.
3. **Measured sensitivity/costs — implemented:** exact-source two-parameter grids and friction reruns, checked references, no partial success. Grid classifications and sampled cost crossing brackets are explicit.
4. **Method audit — implemented, final review pending:** Helper equity analytics; seeded named additive-PnL MC; previous-bar trailing regimes including Unknown; gross-winning-PnL concentration by trade/month/direction; descriptive sample rules. See VALIDATION_METHODOLOGY.md.
5. **Artifact/UX development checkpoint — verified:** schema/config versions, deterministic fingerprint, immutable archive and hash/reference reopen without recomputation, report tabs and methodology, real paired desktop/narrow battery and Helper restart pass. Reproduction/reconnect, divergent output, v3/v4 archive coexistence and final independent review pass. No claim of sealed source selection, secure arbitrary-Python sandboxing, live-data certification or production verification.

## Next milestone — Phase 2 evidence artifacts

Export a self-contained, versioned evidence bundle with parent/validation/linked runs, complete source/data/runtime/methodology and canonical manifest integrity. Verify all existing archive references before export. Keep exports non-executable and immutable; do not imply that hashes attest performance. Later import/reproduction must explicitly distinguish claimed historical identity from freshly reproduced computation. No cloud sharing or external publication is implied.

Validation commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:python` on Python 3.12. Browser checks require a running app and paired Helper. The tracked `db/custom.db` is not a migration test target.
