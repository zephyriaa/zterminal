# Private Windows Installer Contract

**Status:** Internal, local-only installation packaging for the Track B ZTerminal native host. The installer is a private per-user executable assembled from the validated Release package. It is not a public distribution channel, release activation, updater, signing service, or cloud deployment mechanism.

> Installation deploys the native host and its required local sidecars together under the current user's local application directory. It does not open a provider connection, request market data, enable cloud synchronization, create an account, configure credentials, execute orders, or alter the hosted Render fallback.

## Package layout

The installation executable packages the following files in one bounded payload, deploys them atomically to `%LOCALAPPDATA%\ZTerminal\app`, then creates one current-user Start Menu shortcut. A temporary staging directory prevents a partially copied app directory from replacing a prior installation.

| Payload | Role |
|---|---|
| `ZTerminalWindowsHost.exe` | Native Win32 and Direct3D11 local-first host. |
| `zt-local-scene-bridge.exe` | Strict one-shot local scene bridge. |
| `zt-local-monte-carlo.exe` | Strict bounded local research sidecar. |
| `zt-local-segment-catalog.exe` | Strict verified local segment catalog sidecar. |
| `zt-local-workspace.exe` | Local workspace journal sidecar. |
| `zt-offline-provider-import.exe` | Test-only offline import utility. |
| `zt-direct-public-ingest.exe` | Internal bounded public-ingestion utility; it is not run by installation or normal host startup. |
| `uninstall-zterminal.ps1` | Removes only the installed app directory and shortcut, deliberately retaining separate local research data and diagnostics. |

The internal installation manifest records only aggregate package state: schema, product, current-user scope, bounded file names, and the boolean facts that installation neither opens a network connection nor signs the package. It stores no market frames, account information, credentials, keys, or research output.

## Build and verification

`apps/windows-host/scripts/build-private-installer.ps1` compiles `apps/windows-host/installer/Setup.cs` into `out/private-installer/ZTerminal-Private-Setup.exe` with one embedded ZIP payload. The setup executable visibly reports completion or failure, atomically deploys the bounded payload, and creates the shortcut. It is **install-only**: it never launches ZTerminal; the completion message directs the user to the Start Menu shortcut. The build requires a complete existing Release directory, is finite, and performs no network action. A smoke uses the explicit `ZTERMINAL_INSTALLER_ROOT` override together with noninteractive switches; it never targets the user's real application or data paths.

## Signing boundary

Authenticode signing requires a valid, unexpired **code-signing certificate with its private key** in the current-user certificate store. `apps/windows-host/scripts/sign-private-installer.ps1` accepts only a certificate thumbprint, validates the certificate's code-signing enhanced-key-usage, signs locally through the installed Windows signing tool, and verifies the result. It does not accept, copy, log, or commit a PFX, private key, password, or timestamp service credential.

No usable current-user or local-machine code-signing certificate was present when this installer was built. Therefore the current private installer is truthfully marked **NotSigned**. A self-signed development certificate would not make Windows trust the installer and is intentionally not generated as a substitute for a real code-signing identity.

## Distribution boundary

The installer remains on the connected Windows workspace only. It is not uploaded, attached to a public GitHub release, served from Render, linked from the landing page, signed through an online service, or paired with an automatic updater. A future public release requires a separate explicit decision covering the trusted signing certificate, reputation and SmartScreen expectations, installer review, distribution channel, support policy, and updater strategy.
