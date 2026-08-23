# Desktop Preview Mismatch Audit

## 2026-08-23 findings

The internal NSIS artifact produced by the Track A dry-build workflow packages `desktop/src/main.ts`, a legacy Tauri shell. The installed screen is therefore expected to show only the local Markets/Risk/Trade Plan shell and not the actual ZTerminal workstation rendered by the Next.js `/terminal` route.

The shell explicitly states that it does not embed or open the deployed website. This is a correct description of the legacy code but made the artifact unsuitable as a user-facing ZTerminal preview.

The actual workstation entry point is `src/app/terminal/page.tsx`, which renders `FloatingWorkstationShell` and its dependent market stream, chart workspace, instrument picker, account, and cloud-sync components.

A 2026-08-23 browser check of `https://zterminal.onrender.com/terminal` initially returned Render’s application-loading page. A subsequent check resolved to an empty browser document, so this audit does not claim that the latest terminal route is currently available or deployed. Before a remote-webview preview could be offered, the deployed `/terminal` route must be verified functional.

## Corrective constraint

No future artifact may be labelled or linked as a ZTerminal app preview if it still packages the legacy `desktop/` shell. Any temporary hosted-WebView proof must be plainly labelled as remote-hosted, depends on the verified `/terminal` service, and remains separate from the future native Track B client.
