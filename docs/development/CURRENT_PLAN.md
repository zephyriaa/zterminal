# Current plan — Validation Engine certification

Phase 0 Research Core has exact-source CPython, deterministic provenance, local archive, and reproduction code with tests. The Python 3.12 unit suites now pass locally; a live paired Helper workflow remains to be verified.

Phase 1 is incomplete. The committed v0.1 validator contains useful chronological trade partitions, seeded trade permutations, cost projections, regime and concentration summaries, persistence plumbing, and a report. Its former parameter heatmap was calculated from an arbitrary distance formula; it has been disabled.

## Milestones

1. **Integrity repair:** reject fabricated sensitivity, require successful archive save, bind validation to the archived parent and config, detect archived tampering, and describe existing calculations accurately. Acceptance: rejection tests plus TypeScript/Python gates.
2. **True chronological validation:** execute exact source on sealed OOS data and implement rolling train/test windows with training-only parameter selection. Test boundary bars, warm-up, timestamps, indicator state, and leakage traps.
3. **Measured sensitivity and cost stress:** run each parameter and friction variant in the paired local CPython Helper; persist each variant identity and fail the validation if any required run fails.
4. **Quantitative method audit:** clarify Monte Carlo interpretation, non-crossed cost bounds, sample sufficiency, regime attribution, and all qualitative rules; add adversarial fixtures.
5. **Artifact and UX certification:** stable versioned result schema, immutable archive and reopen, methodology documentation, browser flow, build, and independent review.

Validation commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:python` on Python 3.12. Browser checks require a running app and paired Helper. The tracked `db/custom.db` is not a migration test target.
