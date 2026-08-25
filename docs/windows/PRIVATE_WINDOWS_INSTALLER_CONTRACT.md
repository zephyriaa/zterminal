# Private Windows Installer Contract

**Status:** Internal, local-only Windows 10/11 installation packaging for the Track B ZTerminal native host. The installer is a conventional private per-user executable assembled from the validated Release package. It is not a public distribution channel, release activation, updater, signing service, cloud deployment mechanism, or market-data transport.

> Installation, normal startup, and uninstallation do not open a provider connection, request market data, enable cloud synchronization, create an account, configure credentials, execute orders, or alter the hosted Render fallback.

## Installer model

The private package is generated from `apps/windows-host/installer/ZTerminal.iss` by the locally installed Inno Setup compiler. It uses a conventional Windows wizard with Welcome, Ready, progress, and Finish stages, so a user can see that ZTerminal is being installed rather than merely opening a self-extracting application. The package uses **current-user scope** and `PrivilegesRequired=lowest`; it does not require administrative elevation. Inno Setup documents this mode as non-administrative installation, while Windows documents that per-user installations are visible for that user in Add/Remove Programs.[1] [2]

| Installer property | Contract |
|---|---|
| Installer artifact | `ZTerminal-Private-Setup.exe`, generated with Inno Setup. |
| Default binary directory | `%LOCALAPPDATA%\Programs\ZTerminal` and not the local-data directory. |
| Visible lifecycle | Welcome, installation-progress, Finish, standard Inno uninstall flow. |
| Application start | The Finish page exposes an unchecked **Launch ZTerminal** option; installation never silently starts the app. |
| Scope | Current Windows user only; no administrative installation. |
| App registration | Inno Setup manages the matching current-user Windows Settings → Installed apps entry and standard uninstall command. |
| Upgrade behavior | The known legacy binary directory `%LOCALAPPDATA%\ZTerminal\app` and its legacy custom uninstall key are removed only after the conventional package has installed its new binary payload. |

The legacy migration deliberately preserves existing local data under `%LOCALAPPDATA%\ZTerminal` until the user explicitly uninstalls ZTerminal. It removes only the known old binary subdirectory and known old custom registration; it does not perform broad profile or registry cleanup.

## Bounded package payload

The package deploys exactly the native host and its required adjacent local sidecars into the fixed application directory.

| Payload | Role |
|---|---|
| `ZTerminalWindowsHost.exe` | Native Win32 and Direct3D11 local-first host. |
| `zt-local-scene-bridge.exe` | Strict one-shot local scene bridge. |
| `zt-local-monte-carlo.exe` | Strict bounded local research sidecar. |
| `zt-local-segment-catalog.exe` | Strict verified local segment catalog sidecar. |
| `zt-local-workspace.exe` | Local workspace journal sidecar. |
| `zt-offline-provider-import.exe` | Test-only offline import utility. |
| `zt-direct-public-ingest.exe` | Internal bounded public-ingestion utility; it is not run by installation or normal host startup. |

The Start Menu shortcut targets the installed `ZTerminalWindowsHost.exe` and explicitly sets the installed directory as its working directory. This prevents sidecar discovery from depending on the location of the shortcut, the installer, or a caller’s current directory.

## Native startup contract

A normal installed launch creates a responsive Win32 window titled **`ZTerminal`**. It is not considered a successful launch merely because a process exists: the validation requires a nonzero main-window handle, a responsive process, and the expected title.

If no verified local scene was selected, the host intentionally shows the **Local Workspace** state. It states that local data is unavailable and that a verified local segment must be imported; it does not fabricate candles, imply a live feed, or silently contact an external source.

The host writes an aggregate local startup status at `%LOCALAPPDATA%\ZTerminal\logs\native-startup-last.json`. The record contains only a stage (`starting`, `window_created`, `ready`, or a bounded failure category), a numeric result code, product identity, and `network_opened=false`. It contains no candle records, segment content, account information, credentials, keys, or provider payloads.

## Full removal boundary

The standard Inno uninstaller asks for confirmation in normal interactive use. Once confirmed, it removes only the fixed ZTerminal-owned current-user resources below.

| Owned resource | Removal behavior |
|---|---|
| `%LOCALAPPDATA%\Programs\ZTerminal` | Removes the installed native host, adjacent sidecars, and standard Inno uninstaller. |
| `%LOCALAPPDATA%\ZTerminal` | Removes ZTerminal-owned local cache/history, workspace data, diagnostics, retained legacy binary directory, and other data below this fixed product root. |
| `%APPDATA%\ZTerminal` | Removes ZTerminal roaming workspace/configuration data if present. |
| `%APPDATA%\Microsoft\Windows\Start Menu\Programs\ZTerminal` | Removes the ZTerminal Start Menu shortcut group. |
| Matching current-user Installed-apps entry | Removed by the standard Inno uninstaller. |

The uninstaller does **not** remove browser fallback files, Render-hosted content, unrelated user directories, other applications’ registry entries, external-provider data, cloud data, or any credential store outside these fixed ZTerminal-owned resources.

> Complete removal is intentionally destructive. The user must explicitly invoke Uninstall and confirm it. Installation itself never deletes local cache/history or workspace data; it only migrates the known old binary subdirectory after the new package has been laid down.

## Build and verification

`apps/windows-host/scripts/build-private-installer.ps1` validates the complete Release directory and compiles the Inno definition. The script supports a test-only `-SmokeRoot` mode that compiles an installer with a distinct AppId, distinct Windows Settings entry, isolated program/data roots, isolated legacy migration target, and isolated Start Menu group.

`apps/windows-host/scripts/run-conventional-installer-smoke.ps1` validates the safe smoke build. It confirms all seven payload files plus Inno’s uninstaller are installed; verifies the current-user Installed-apps entry; verifies the Start Menu target and working directory; launches the installed shortcut and requires a responsive `ZTerminal` window; prepares isolated legacy binaries/registration; verifies migration removes only those test targets; and verifies complete removal of only the isolated program/data/shortcut/registration resources. The installer does not auto-launch the host and the test opens no network connection.

## Signing boundary

Authenticode signing requires a valid, unexpired **code-signing certificate with its private key** in the current-user certificate store. `apps/windows-host/scripts/sign-private-installer.ps1` accepts only a certificate thumbprint, validates the certificate's code-signing enhanced-key-usage, signs locally through the installed Windows signing tool, and verifies the result. It does not accept, copy, log, or commit a PFX, private key, password, or timestamp service credential.

No usable current-user or local-machine code-signing certificate was present when this installer was built. The private installer is therefore truthfully **NotSigned**. A self-signed development certificate would not make Windows trust the installer and is intentionally not generated as a substitute for an authorized identity.

## Distribution boundary

The installer remains on the connected Windows workspace only. It is not uploaded, attached to a public GitHub release, served from Render, linked from the landing page, signed through an online service, or paired with an automatic updater. A public release requires a separate explicit decision covering trusted signing, reputation and SmartScreen expectations, release distribution, support policy, and updater strategy.

## References

[1] [Microsoft, “Configuring Add/Remove Programs with Windows Installer.”](https://learn.microsoft.com/en-us/windows/win32/msi/configuring-add-remove-programs-with-windows-installer)

[2] [Inno Setup Help, “Non Administrative Install Mode.”](https://jrsoftware.org/ishelp/topic_admininstallmode.htm)
