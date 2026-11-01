# Phase 03 — Home and workspace navigation

28 October 2026. **Implementation/build and repository checks PASS; overall acceptance PARTIAL.** The user has now prohibited computer use. Do not automate desktop input, window switching or screen capture. Continue authorized source/build/test work through subsequent phases and retain unverified UI/device gates.

## Local implementation

- The existing Rust Store owns workspace metadata, standalone non-executed study source and reversible recovery records. Its additive version-2 upgrade preserves existing workspace payload bytes and leaves unknown historical modification dates unknown. Exact source is stored in the existing content-addressed artifacts; there is no second database or synchronization path.
- Home queries at most 24 records per section, with Unicode lowercase search over names and available instrument/study-kind metadata. Recent activity uses real modification/open timestamps; name ordering is deterministic Unicode lowercase ordering, not a claim of language-specific collation. Native controls provide loading, empty and read-error states.
- Real saved source and up to 128 retained historical closes produce previews. A single bounded batch retrieves missing previews for the displayed page. The in-memory cache retains only the current sections, at most 48 entries; disk thumbnail growth is zero. No feed subscription or Python execution is started for cards. Missing/corrupt/stale revisions withhold the preview.
- Native menus create/open/rename/duplicate/soft-delete/recover actual records. Expected revisions prevent stale writes. Workspace rename/duplication preserve retained dataset, view and source references. Shared artifacts are retained after deletion. Recovery lists up to 100 recent deleted records without discarding older recovery entries.
- Home remains available beside at most 16 persistent workspace tabs. Duplicate-open focuses the existing identity. Tab switching reloads the chosen workspace's verified scene; the shared presentation surface does not own persistence. Edited viewports require explicit save/discard/cancel before navigation/active-tab close/app close. The source editor protects changed drafts, retains them on save failure and never executes them.

## Visual correction requested by the user

The user rejected the Settings-like shell and default Fluent appearance. The latest review candidate replaces the broad utility sidebar with a 48-DIP vector-icon tool rail; uses neutral graphite surfaces, compact authored button/tab templates, violet selection, consistent bundled Geist type and styled native fields/dialogs; and removes decorative Mica. Native focus, text input, caption controls and accessibility semantics remain infrastructure. The final custom tab template and dialog style **have built successfully but have not been interactively verified**. The earlier `brand-workspace.png` predates that final tab-template change and must not be presented as its screenshot.

## Verification

- **PASS:** 16 Rust Store tests, including byte-preserving upgrade, unknown dates, 1,000-record SQL paging, Unicode search, real open activity, source integrity, stale writes, independent duplicate view/source/data ownership, recovery and restart.
- **PASS:** packaged adapter tests through independent OS processes: exact source bytes, rename, duplicate, stale-delete rejection, workspace/study recovery, persistent tab membership, search/paging and stale-preview withholding. Final sample page requests returned 2/24/24 records from 2/100/1,000 metadata records in 42.50/28.20/39.95 ms. These are single local samples including process startup, not workload medians or full-app scalability evidence.
- **PASS on earlier identified native builds:** offline Home; create/edit/save study; unsaved-study dismissal guard; create/search/open workspace; Home return; rename and refreshed tab label; duplicate and second tab; active-tab close retaining record; actual process restart into Home; retained-data rendering; changed-viewport navigation prompt; cancel retaining view; save before Home. Read-only SQLite confirms only the intended workspace advanced to revision 4 with the saved exact boundaries; its duplicate stayed revision 1 with no dataset/view.
- **PARTIAL:** the 1,000-record native gallery exposed 24 records and the correct count in its accessibility tree. A screen capture returned the foreground Codex window instead of the native target and was discarded. Externally changed state during that observation is excluded from controlled deletion/tab claims.
- **NOT TESTED:** final custom-template interaction/focus/close behavior, actual confirmation of UI deletion, UI recovery, locked-database recovery, additional DPI/text scaling/high contrast, narrow-window inspection and multi-monitor behavior. No further computer use is authorized.
- **PASS:** current self-contained Release review candidate builds, including the exact Store adapter. Existing staged diff remains byte-for-byte preserved. No public deployment, signing, vendor contact or trading occurred.

Evidence root: `C:\Users\aykhank\.codex\visualizations\2026\10\28\01a18282-2502-7322-b414-bc1194578ca4\phase03`.

Current candidate: `brand-review-final\Release\ZTerminal.exe`; build log `brand-final-build.txt`; Store log `store-tests-final.txt`; adapter report `process-catalog-final\results.json`; ownership readback `viewport-ownership.json`. Older `product`/`brand-review` outputs and screenshots are historical candidates, not the final style acceptance.

## Continuing scope

Phase 04 remains fully authorized. Complete owned native chart/workspace semantics and explicit web/native adapters; keep all incomplete parity rows visible. Phase 03 UI/device checks remain deferred under the user's computer-use prohibition, not silently passed or a reason to stop independent implementation.
