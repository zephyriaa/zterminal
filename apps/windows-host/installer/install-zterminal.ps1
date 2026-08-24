[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredFiles = @(
    'ZTerminalWindowsHost.exe',
    'zt-local-scene-bridge.exe',
    'zt-local-monte-carlo.exe',
    'zt-local-segment-catalog.exe',
    'zt-local-workspace.exe',
    'zt-offline-provider-import.exe',
    'zt-direct-public-ingest.exe',
    'uninstall-zterminal.ps1'
)

$payloadRoot = Split-Path -Parent $PSCommandPath
foreach ($requiredFile in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $payloadRoot $requiredFile) -PathType Leaf)) {
        throw "The private installer payload is incomplete: $requiredFile"
    }
}

$installRoot = Join-Path $env:LOCALAPPDATA 'ZTerminal'
$applicationRoot = Join-Path $installRoot 'app'
$stagingRoot = "$applicationRoot.staging-$PID"
$backupRoot = "$applicationRoot.backup-$PID"
$programsRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ZTerminal'
$shortcutPath = Join-Path $programsRoot 'ZTerminal.lnk'

Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
try {
    foreach ($requiredFile in $requiredFiles) {
        Copy-Item -LiteralPath (Join-Path $payloadRoot $requiredFile) -Destination (Join-Path $stagingRoot $requiredFile) -Force
    }

    $manifest = [ordered]@{
        schema_version = 1
        product = 'ZTerminal Native Local-First Host'
        installation_scope = 'CurrentUser'
        network_opened_by_installer = $false
        signed = $false
        installed_utc = [DateTime]::UtcNow.ToString('o')
        files = $requiredFiles
    } | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText((Join-Path $stagingRoot 'installation.json'), $manifest + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    if (Test-Path -LiteralPath $applicationRoot) {
        Remove-Item -LiteralPath $backupRoot -Recurse -Force -ErrorAction SilentlyContinue
        Move-Item -LiteralPath $applicationRoot -Destination $backupRoot -Force
    }
    Move-Item -LiteralPath $stagingRoot -Destination $applicationRoot -Force
    Remove-Item -LiteralPath $backupRoot -Recurse -Force -ErrorAction SilentlyContinue

    New-Item -ItemType Directory -Path $programsRoot -Force | Out-Null
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $applicationRoot 'ZTerminalWindowsHost.exe'
    $shortcut.WorkingDirectory = $applicationRoot
    $shortcut.Description = 'ZTerminal Native Local-First Host'
    $shortcut.Save()
} catch {
    if ((Test-Path -LiteralPath $backupRoot) -and -not (Test-Path -LiteralPath $applicationRoot)) {
        Move-Item -LiteralPath $backupRoot -Destination $applicationRoot -Force
    }
    throw
} finally {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}
