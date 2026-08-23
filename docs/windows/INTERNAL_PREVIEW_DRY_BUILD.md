# Internal Windows Preview Dry Build

## Purpose

The `Internal Windows Preview (Dry Build)` workflow produces a **private, unsigned Tauri/NSIS installer artifact** for build reproducibility and controlled packaging validation. It does not create a public ZTerminal Windows release and does not represent the future native Win32/Direct3D + Rust terminal.

> **Safety boundary:** This workflow is intentionally a dry build. It does not read or create a PFX certificate, code-sign a file, timestamp an executable, upload a release to a CDN, create a GitHub Release, change Render configuration, enable `/download/windows`, enable Windows update metadata, or publish a production manifest.

## Running the workflow

A repository maintainer opens **Actions**, selects **Internal Windows Preview (Dry Build)**, chooses **Run workflow**, and supplies the reviewed Git ref. The default is `main`. The optional notes field is copied only into the private artifact manifest.

The workflow builds on a hosted Windows runner and performs the following sequence:

| Order | Action | Failure behavior |
| ---: | --- | --- |
| 1 | Checks out the selected reviewed ref. | Stops if checkout fails. |
| 2 | Installs locked Node dependencies and generates the Prisma client. | Stops if dependency or generation checks fail. |
| 3 | Runs Node tests, TypeScript typecheck, ESLint, and desktop frontend build. | Stops before packaging. |
| 4 | Runs the existing Tauri NSIS bundling path. | Stops if the installer cannot be produced. |
| 5 | Requires exactly one NSIS setup `.exe`. | Stops if output is missing or ambiguous. |
| 6 | Computes SHA-256 and writes an internal-only JSON manifest. | Stops if the artifact cannot be described. |
| 7 | Uploads a 14-day private Actions artifact. | Stops on upload failure. |

## Artifact contents

The private artifact contains the following files.

| File | Purpose | Public-release status |
| --- | --- | --- |
| `ZTerminal-Internal-Preview-Unsigned.exe` | Current Tauri/NSIS preview installer. | Not eligible. |
| `ZTerminal-Internal-Preview-Unsigned.exe.sha256` | SHA-256 checksum in standard filename format. | Internal verification only. |
| `internal-release.json` | Git SHA, input ref, artifact bytes/hash, notes, and the explicit unsigned/internal-only state. | Not a production release envelope. |

The manifest always records `internal_only: true`, `public_release_eligible: false`, and `signing.status: not-requested`. It must not be copied into the canonical production Windows release resolver.

## Integrity verification

An authorized tester may verify the downloaded file using PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\ZTerminal-Internal-Preview-Unsigned.exe
Get-Content .\ZTerminal-Internal-Preview-Unsigned.exe.sha256
```

The displayed digest must equal the checksum file and the `installer.sha256` value in `internal-release.json`. A matching hash only establishes that the artifact matches this private workflow output; it does **not** make an unsigned installer suitable for public distribution.

## Tester handling rules

Internal artifacts are for authorized testing only. They must not be forwarded, mirrored, attached to the public website, placed in a GitHub Release, uploaded to a public bucket, or represented as a production ZTerminal installer. Testers should use a disposable Windows VM or controlled test device, record installation, launch, close, and uninstall results, then remove the app after the test window.

## Future signing transition

A later, separately approved internal-signing phase may add a dedicated self-signed test certificate in a protected GitHub environment. It requires a new workflow review and an explicit signer-verification test. A self-signed certificate remains internal-only and cannot be promoted to a public download. Production signing, CDN/object-storage distribution, website activation, updater, remote configuration, rollout, and rollback remain Track B work governed by the native-client release architecture.
