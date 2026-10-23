# Helper design and branding adoption — 23 October 2026

The user approved implementing the existing Figma reference with the newly
supplied ZTerminal Logo Kit v1. The native WinForms/Python boundary is retained.
The kit is now the repository's branding source; see `docs/BRANDING.md`.

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Supplied asset import | PASS | ZIP CRC and every extracted file byte checked against the supplied ZIP |
| Native launcher compilation | PASS | .NET Framework x64, embedded supplied PNG/ICO, existing DPI-aware manifest |
| State regression checks | PASS | Ready, connected, expired, locked, consumed and returning to ready; copy availability, renewal and full-width actions; an active browser does not hide a newly minted pairing code |
| Native visual inspection | PASS | Ready state in the real packaged launcher; connected and expired states in labelled sample-data windows. Corrected DPI/layout clipping found during visual inspection |
| Actual local pairing | PASS | Production Helper service paired through an unused allowed local origin; no tokens or codes logged; temporary test pairing removed |
| Copy / New code | PASS | Actual clipboard equality and changed unused code verified through native controls |
| Current-user installation | PASS | Full package copied to `ResearchPreview/package-1.2.0-preview.1`; Start Menu target/icon updated with a shortcut backup retained; launched installed executable matches package bytes and checksum. Install button's copy/relaunch flow was not exercised |
| Archive preservation | PASS | Logical SQLite dump hash unchanged after runtime checks; private backup retained under ignored artifacts |
| Typecheck / lint / web production build | PASS | `npm run typecheck`, `npm run lint -- --quiet`, `npm run build` |
| Web browser visual acceptance | BLOCKED | Browser Harness requires the user to approve the remote-debugging prompt; no deployed web branding claim |
| Mobile / alternate desktop runtime | NOT TESTED | Existing packaging resources replaced; no iOS, Android, macOS or alternate desktop application build performed |
| Release security gate | FAIL | Existing production dependency audit still identifies critical Monaco/embedded DOMPurify exposure; no production merge or deployment |

Native visual evidence, private preservation snapshots, dependency-audit JSON
and the production-build log are in ignored `artifacts/helper-redesign`.
The full portable package is `out/helper-redesign-20261023-final.zip`, with a
SHA256 sidecar. The Helper remains an unsigned preview. Native Segoe UI/Consolas
and operating-system title bars differ from the Figma Geist typography.

Expired-state appearance uses a fixture; this task did not wait ten minutes
for an actual expiry. Live authenticated web research and the other unfinished
GLM gates remain outside this branding/design acceptance.
