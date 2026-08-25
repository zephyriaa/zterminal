[CmdletBinding()]
param(
    [string]$Installer = (Join-Path $PSScriptRoot '..\..\..\out\private-installer\ZTerminal-Private-Setup.exe'),
    [string]$SmokeRoot = (Join-Path $PSScriptRoot '..\..\..\out\registered-installer-smoke')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installerPath = [System.IO.Path]::GetFullPath($Installer)
$smokeRootPath = [System.IO.Path]::GetFullPath($SmokeRoot)
$installRoot = Join-Path $smokeRootPath 'ZTerminal'
$registryRelativePath = 'Software\ZTerminalInstallerSmoke\Uninstall'
$registryPath = 'HKCU:\Software\ZTerminalInstallerSmoke\Uninstall'
$registryParentPath = 'HKCU:\Software\ZTerminalInstallerSmoke'
$diagnosticPath = Join-Path $env:TEMP 'zterminal-installer-last-error.txt'

if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "The private setup executable does not exist: $installerPath"
}

Remove-Item -LiteralPath $smokeRootPath -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $registryParentPath -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $diagnosticPath -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $smokeRootPath -Force | Out-Null

$env:ZTERMINAL_INSTALLER_ROOT = $installRoot
$env:ZTERMINAL_INSTALLER_UNINSTALL_KEY = $registryRelativePath
$env:ZTERMINAL_INSTALLER_NO_UI = '1'
$existingHostIds = @(Get-Process ZTerminalWindowsHost -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)

$setupProcess = Start-Process -FilePath $installerPath -PassThru
if (-not $setupProcess.WaitForExit(15000)) {
    Stop-Process -Id $setupProcess.Id -Force
    throw 'The isolated setup process did not finish within 15 seconds.'
}
if ($setupProcess.ExitCode -ne 0) {
    $diagnostic = if (Test-Path -LiteralPath $diagnosticPath) { Get-Content -LiteralPath $diagnosticPath -Raw } else { '' }
    throw "The isolated setup process failed with exit code $($setupProcess.ExitCode). $diagnostic"
}

$appRoot = Join-Path $installRoot 'app'
$uninstallerPath = Join-Path $appRoot 'ZTerminalUninstall.exe'
$requiredFiles = @(
    'ZTerminalWindowsHost.exe',
    'ZTerminalUninstall.exe',
    'zt-local-scene-bridge.exe',
    'zt-local-monte-carlo.exe',
    'zt-local-segment-catalog.exe',
    'zt-local-workspace.exe',
    'zt-offline-provider-import.exe',
    'zt-direct-public-ingest.exe',
    'uninstall-zterminal.ps1',
    'installation.json'
)
$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $appRoot $_) -PathType Leaf) })
if ($missingFiles.Count -ne 0) {
    throw "The isolated setup payload is missing: $($missingFiles -join ', ')"
}

$manifest = Get-Content -LiteralPath (Join-Path $appRoot 'installation.json') -Raw | ConvertFrom-Json
$registration = Get-ItemProperty -LiteralPath $registryPath -ErrorAction Stop
$applicationShortcut = Join-Path $installRoot 'Programs\ZTerminal\ZTerminal.lnk'
$uninstallShortcut = Join-Path $installRoot 'Programs\ZTerminal\Uninstall ZTerminal.lnk'
if (-not (Test-Path -LiteralPath $applicationShortcut -PathType Leaf) -or -not (Test-Path -LiteralPath $uninstallShortcut -PathType Leaf)) {
    throw 'The isolated setup did not create both Start Menu shortcuts.'
}
if ($registration.DisplayName -ne 'ZTerminal' -or [int]$registration.NoModify -ne 1 -or [int]$registration.NoRepair -ne 1) {
    throw 'The isolated setup did not create the expected Installed apps registration metadata.'
}
if ($registration.UninstallString -notmatch 'ZTerminalUninstall\.exe" --uninstall') {
    throw 'The isolated setup did not create the expected registered uninstall command.'
}

New-Item -ItemType Directory -Path (Join-Path $installRoot 'logs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $installRoot 'Roaming\workspace') -Force | Out-Null
[System.IO.File]::WriteAllText((Join-Path $installRoot 'logs\owned-diagnostic.txt'), 'owned local diagnostic', [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $installRoot 'Roaming\workspace\owned-workspace.txt'), 'owned workspace', [System.Text.UTF8Encoding]::new($false))

$uninstallProcess = Start-Process -FilePath $uninstallerPath -ArgumentList '--uninstall --quiet' -PassThru
if (-not $uninstallProcess.WaitForExit(15000)) {
    Stop-Process -Id $uninstallProcess.Id -Force
    throw 'The isolated uninstaller launcher did not finish within 15 seconds.'
}
if ($uninstallProcess.ExitCode -ne 0) {
    throw "The isolated uninstaller launcher failed with exit code $($uninstallProcess.ExitCode)."
}

$deadline = [DateTime]::UtcNow.AddSeconds(15)
while ([DateTime]::UtcNow -lt $deadline -and ((Test-Path -LiteralPath $installRoot) -or (Test-Path -LiteralPath $registryPath))) {
    Start-Sleep -Milliseconds 250
}
$newHostIds = @(Get-Process ZTerminalWindowsHost -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id | Where-Object { $_ -notin $existingHostIds })
$result = [pscustomobject]@{
    schema_version = 1
    setup_exit_code = $setupProcess.ExitCode
    installed_payload_files = $requiredFiles.Count
    install_scope = $manifest.installation_scope
    uninstall_scope = $manifest.uninstall_scope
    registered_display_name = $registration.DisplayName
    registered_uninstall_command = $registration.UninstallString
    registered_no_modify = [int]$registration.NoModify
    registered_no_repair = [int]$registration.NoRepair
    application_shortcut_created = $true
    uninstall_shortcut_created = $true
    native_host_started_by_installer = ($newHostIds.Count -gt 0)
    isolated_install_root_removed = (-not (Test-Path -LiteralPath $installRoot))
    isolated_registration_removed = (-not (Test-Path -LiteralPath $registryPath))
    isolated_owned_diagnostic_removed = (-not (Test-Path -LiteralPath (Join-Path $installRoot 'logs\owned-diagnostic.txt')))
    isolated_owned_workspace_removed = (-not (Test-Path -LiteralPath (Join-Path $installRoot 'Roaming\workspace\owned-workspace.txt')))
    network_opened = $false
}
$result | ConvertTo-Json -Depth 4

if ($result.native_host_started_by_installer -or -not $result.isolated_install_root_removed -or -not $result.isolated_registration_removed -or -not $result.isolated_owned_diagnostic_removed -or -not $result.isolated_owned_workspace_removed) {
    throw 'The isolated registered-installer smoke did not satisfy the complete owned-data removal contract.'
}
