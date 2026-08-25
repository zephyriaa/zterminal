# Private Windows Installer Contract

**Status:** Internal, local-only installation packaging for the Track B ZTerminal native host. The installer is a private current-user executable assembled from the validated Release package. It is not a public distribution channel, release activation, updater, signing service, or cloud deployment mechanism.

> Installation and uninstallation do not open a provider connection, request market data, enable cloud synchronization, create an account, configure credentials, execute orders, or alter the hosted Render fallback.

## Package layout

The installation executable packages the following bounded files, deploys them atomically to `%LOCALAPPDATA%\ZTerminal\app`, copies a self-contained `ZTerminalUninstall.exe` beside the host, then creates current-user Start Menu application and uninstall shortcuts. A temporary staging directory prevents a partially copied application directory from replacing a prior installation.

| Payload or installed artifact | Role |
|---|---|
| `ZTerminalWindowsHost.exe` | Native Win32 and Direct3D11 local-first host. |
| `zt-local-scene-bridge.exe` | Strict one-shot local scene bridge. |
| `zt-local-monte-carlo.exe` | Strict bounded local research sidecar. |
| `zt-local-segment-catalog.exe` | Strict verified local segment catalog sidecar. |
| `zt-local-workspace.exe` | Local workspace journal sidecar. |
| `zt-offline-provider-import.exe` | Test-only offline import utility. |
| `zt-direct-public-ingest.exe` | Internal bounded public-ingestion utility; it is not run by installation or normal host startup. |
| `uninstall-zterminal.ps1` | Retained internal cleanup helper; it is not the Settings uninstall entry. |
| `ZTerminalUninstall.exe` | Self-contained registered uninstaller copied from the setup executable during installation. |

The internal installation manifest records only aggregate package state: schema, product, current-user scope, full owned-data uninstall scope, bounded file names, and the boolean facts that installation neither opens a network connection nor signs the package. It stores no market frames, account information, credentials, keys, or research output.

## Windows Installed apps registration

Installation creates the following current-user registry entry, which is the Windows Settings-compatible registration for **Installed apps**:

`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ZTerminal`

| Registration field | Contract |
|---|---|
| `DisplayName` | `ZTerminal` |
| `DisplayVersion` | Private internal build version only; it does not imply a public release. |
| `InstallLocation` | `%LOCALAPPDATA%\ZTerminal\app` |
| `DisplayIcon` | Installed `ZTerminalWindowsHost.exe` |
| `UninstallString` | Installed `ZTerminalUninstall.exe --uninstall` command, quoted for paths containing spaces. |
| `QuietUninstallString` | Same owned-data removal command with `--quiet`, used only for test automation. |
| `NoModify`, `NoRepair` | Both set to `1`; modification and repair flows are intentionally absent. |

The installer is **install-only**: it displays completion or failure feedback, creates the application and uninstall shortcuts, and never launches ZTerminal automatically. The completion dialog directs the user to Start Menu → ZTerminal.

## Full removal boundary

When the user explicitly selects **Uninstall** from Windows Settings or the `Uninstall ZTerminal` Start Menu shortcut and confirms the warning, the registered uninstaller permanently removes the following ZTerminal-owned current-user resources:

| Owned resource | Removal behavior |
|---|---|
| `%LOCALAPPDATA%\ZTerminal` | Removes the installed host, sidecars, copied uninstaller, local cache/history, workspace content below this root, diagnostics, and manifest. |
| `%APPDATA%\ZTerminal` | Removes ZTerminal roaming workspace/configuration data if present. |
| `%APPDATA%\Microsoft\Windows\Start Menu\Programs\ZTerminal` | Removes the ZTerminal and Uninstall ZTerminal shortcuts. |
| `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ZTerminal` | Removes the Installed-apps registration. |

Before deletion, the uninstaller copies itself to a temporary location so it can remove the installed application root. It terminates only a `ZTerminalWindowsHost.exe` process whose executable path is within the owned installation root. It does not remove browser fallback files, Render-hosted content, unrelated user directories, other applications’ registry entries, external-provider data, cloud data, or any credential store outside the listed ZTerminal-owned resources.

> Full removal is intentionally destructive. The interactive warning explicitly states that local cache/history, workspace data, and diagnostics are permanently erased. The user must invoke and confirm it; installation itself never triggers this deletion.

## Build and verification

`apps/windows-host/scripts/build-private-installer.ps1` compiles `apps/windows-host/installer/Setup.cs` into `out/private-installer/ZTerminal-Private-Setup.exe` with one embedded ZIP payload. The build requires a complete existing Release directory, is finite, and performs no network action.

`apps/windows-host/scripts/run-registered-installer-smoke.ps1` uses an explicit isolated install root, isolated HKCU uninstall-key override, and noninteractive environment switches. The verified smoke installs the payload, checks the Settings-compatible registration and both shortcuts, creates test-only local diagnostic and workspace files, runs the installed uninstaller, and confirms that the isolated app root, registration, shortcuts, and test-only owned files are absent. It does not target the user’s real app data or real Installed-apps registry key.

## Signing boundary

Authenticode signing requires a valid, unexpired **code-signing certificate with its private key** in the current-user certificate store. `apps/windows-host/scripts/sign-private-installer.ps1` accepts only a certificate thumbprint, validates the certificate's code-signing enhanced-key-usage, signs locally through the installed Windows signing tool, and verifies the result. It does not accept, copy, log, or commit a PFX, private key, password, or timestamp service credential.

No usable current-user or local-machine code-signing certificate was present when this installer was built. Therefore the current private installer is truthfully marked **NotSigned**. A self-signed development certificate would not make Windows trust the installer and is intentionally not generated as a substitute for a real code-signing identity.

## Distribution boundary

The installer remains on the connected Windows workspace only. It is not uploaded, attached to a public GitHub release, served from Render, linked from the landing page, signed through an online service, or paired with an automatic updater. A future public release requires a separate explicit decision covering the trusted signing certificate, reputation and SmartScreen expectations, installer review, distribution channel, support policy, and updater strategy.
