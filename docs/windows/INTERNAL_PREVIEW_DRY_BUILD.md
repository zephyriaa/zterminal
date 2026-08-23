# Internal Hosted ZTerminal Workstation Preview

## Purpose

The `Internal ZTerminal Workstation Preview (Dry Build)` workflow produces a **private, unsigned Tauri/NSIS installer artifact that opens the deployed ZTerminal `/terminal` workstation**. It replaces the prior shell-only internal artifact, which did not represent the actual ZTerminal experience.

> **Scope boundary:** This is a connected hosted-workstation wrapper for controlled internal testing. It is not offline-capable, it depends on `https://zterminal.onrender.com/terminal`, and it is not the future local-first native Win32/Direct3D + Rust Track B client.

The workflow refuses to package an installer unless the hosted terminal responds successfully and includes the workstation marker. It does not create a public ZTerminal Windows release or enable public distribution.

> **Safety boundary:** This workflow is intentionally unsigned and private. It does not read or create a PFX certificate, code-sign a file, timestamp an executable, upload a release to a CDN, create a GitHub Release, change Render configuration, enable `/download/windows`, enable Windows update metadata, or publish a production manifest.

## Running the workflow

A repository maintainer opens **Actions**, selects **Internal ZTerminal Workstation Preview (Dry Build)**, chooses **Run workflow**, and supplies the reviewed Git ref. The default is `main`. The optional notes field is copied only into the private artifact manifest.

The workflow builds on a hosted Windows runner and performs the following sequence.

| Order | Action | Failure behavior |
| ---: | --- | --- |
| 1 | Checks out the selected reviewed ref. | Stops if checkout fails. |
| 2 | Installs locked Node dependencies and generates the Prisma client. | Stops if dependency or generation checks fail. |
| 3 | Runs Node tests, TypeScript typecheck, and ESLint. | Stops before packaging. |
| 4 | Verifies that the deployed `/terminal` route returns HTTP 200 and the ZTerminal workstation marker. | Stops; no installer is created if the hosted terminal is unavailable or incorrect. |
| 5 | Builds the dedicated hosted-workstation Tauri NSIS flavor. | Stops if the installer cannot be produced. |
| 6 | Requires exactly one NSIS setup `.exe`. | Stops if output is missing or ambiguous. |
| 7 | Computes SHA-256 and writes an internal-only JSON manifest. | Stops if the artifact cannot be described. |
| 8 | Uploads a 14-day private Actions artifact. | Stops on upload failure. |

## Artifact contents

The private artifact contains the following files.

| File | Purpose | Public-release status |
| --- | --- | --- |
| `ZTerminal-Hosted-Workstation-Preview-Internal.exe` | Private installer that opens the current hosted ZTerminal workstation. Internet connection required. | Not eligible. |
| `ZTerminal-Hosted-Workstation-Preview-Internal.exe.sha256` | SHA-256 checksum in standard filename format. | Internal verification only. |
| `internal-release.json` | Git SHA, input ref, artifact bytes/hash, notes, the hosted terminal URL, and the explicit unsigned/internal-only state. | Not a production release envelope. |

The manifest always records `internal_only: true`, `public_release_eligible: false`, `online_connection_required: true`, and `signing.status: not-requested`. It must not be copied into the canonical production Windows release resolver.

## What the installer does and does not prove

The application window opens the actual ZTerminal workstation served at `/terminal`, including whatever verified web-terminal features are available to the user at launch. It is therefore a useful internal check of the real terminal interface in a Windows WebView container.

It does **not** prove a local-first desktop architecture, offline cache, native rendering engine, native updater, secure credential storage, trusted signing, or resilient production availability. Those are Track B responsibilities and remain deliberately separate.

## Integrity verification

An authorized tester may verify the downloaded file using PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\ZTerminal-Hosted-Workstation-Preview-Internal.exe
Get-Content .\ZTerminal-Hosted-Workstation-Preview-Internal.exe.sha256
```

The displayed digest must equal the checksum file and the `installer.sha256` value in `internal-release.json`. A matching hash only establishes that the artifact matches this private workflow output; it does **not** make an unsigned installer suitable for public distribution.

## Tester handling rules

Internal artifacts are for authorized testing only. They must not be forwarded, mirrored, attached to the public website, placed in a GitHub Release, uploaded to a public bucket, or represented as a production ZTerminal installer. Testers should use a disposable Windows VM or controlled test device, record installation, terminal launch, network-loss behavior, launch recovery, close, and uninstall results, then remove the app after the test window.

The prior shell-only artifact should no longer be used for feature feedback. It was a separate legacy proof and did not contain the ZTerminal terminal.

## Future signing transition

The separate protected test-signing workflow, if later used, signs this same hosted-workstation preview flavor only. A self-signed certificate remains internal-only and cannot be promoted to a public download. Production signing, CDN/object-storage distribution, website activation, updater, remote configuration, rollout, and rollback remain Track B work governed by the native-client release architecture.
