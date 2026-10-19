# Phase 09 — shared drawing lifecycle repairs verified; acceptance BLOCKED

19 October 2026. Continue automatically to independent Phase10 work as explicitly authorized. No deployment, staging/commit/push, external message, user drawing reset or audit mutation occurred. The earlier browser launch rejection was not retried or bypassed; no supported Browser Harness connection is available.

## Reproduction and repair

The registry still exposes 25 tools: 22 semantic creation tools plus Crosshair, Arrow/Select and Eraser. Each has its own evidence row in `evidence/tool-matrix.csv`. Existing geometry, snapping, rendering, locks, per-document history and native pan/zoom ownership were preserved.

**New F22:** three initial callback fixtures failed: unexpected lost pointer capture retained creation state; a drag released outside the price pane committed outside anchors; and document/market/pane changes did not cancel a pending gesture. A fourth regression showed Enter in another pane could commit a pending unfocused polyline. The interaction layer now distinguishes intentional pointer releases from lost capture, cancels out-of-bounds motion/release, cancels when its explicit semantic scope changes, and requires its focused input element for Enter completion. TerminalChart passes document identity plus history identity; the current primary and secondary callers supply their real document IDs. Pointer previews remain transient and successful completion still calls the existing single history transaction.

No geometry refactor, new renderer, trading/order API or generalized gesture framework was added. Native empty-space pointer ownership is retained. The current semantic scope includes workspace/document/provider/market/timeframe. Legacy callers without drawing callbacks retain the default scope.

## Verification

- **PASS:** 299 TypeScript tests in `evidence/typescript-latest.log`, typecheck in `evidence/typecheck-latest.log`, scoped interaction lint. Broader scoped lint retained three existing unused-disable warnings in TerminalChart, zero errors. The 45 focused drawing tests before the final focused-Enter regression passed; that additional test is included in the final full suite.
- **PASS, fixture only:** actual extracted interaction callbacks with deterministic pointer/renderer spies test every creation tool's required anchors and one completion, all three selectors' idle behavior and locks, cancellation/unmount, intentional release of multi-anchor tools and the four fixed failures. Store fixtures for every creation tool cover create, semantic anchor edits, distinct duplicate IDs, delete/undo/redo, JSON capture and separate secondary document state. JSON roundtrip is not a storage reload test. AST extraction executes current callbacks without introducing a product helper or browser dependency.
- **PASS, existing fixtures:** drawing geometry/engine/store checks cover directed rays, channels, ellipses, paths, text, measurements, projected Fibonacci levels, snapping, replay-prefix inputs, workspace copy/remapping and bounded history. They do not prove every tool under a native log/inverted/high-DPI chart.
- **PASS:** `evidence/preservation.json` checks protected baseline hashes outside the intended patch and exact Git index bytes, including prior phase records and the original audit. Raw `before/` files and `phase09.patch` isolate this phase from the existing dirty checkout.

**BLOCKED:** each tool's actual browser create/select/edit/move/duplicate/delete/undo/redo/save/reload matrix; touch, pen, lost-capture event ordering on-device, high-DPI rendering, native pan/zoom while idle, log/inverted transforms, narrow sizes, named workspace restore, account/pane/market transitions, toolbar focus and dock drag interaction. Source and synthetic events do not certify browser capture ordering. No new assembled web candidate or deployed acceptance claim. Preserve these gaps for Phase18/20.

The ledger retains 252 original observations plus 11 new execution assertions (263 total). F22 remains unresolved pending browser/integrated acceptance. Phase09 is BLOCKED, not complete. Next: read `prompts/10-indicators-and-profile.md` and the latest ledger; independent Phase10 investigation is authorized without asking. Phase19 still needs exact reviewed candidate and target authorization.
