[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'ZTerminal'
$applicationRoot = Join-Path $installRoot 'app'
$programsRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ZTerminal'
$shortcutPath = Join-Path $programsRoot 'ZTerminal.lnk'

Remove-Item -LiteralPath $shortcutPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $programsRoot -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $applicationRoot -Recurse -Force -ErrorAction SilentlyContinue

# Deliberately retain any separate local user data, verified segments, workspace journals,
# diagnostics, and research artifacts. This uninstaller does not upload, synchronize, or erase them.
