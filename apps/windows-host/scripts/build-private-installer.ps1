[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$ReleaseDirectory = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\..\out\private-installer')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$iexpress = Join-Path $env:WINDIR 'System32\iexpress.exe'
if (-not (Test-Path -LiteralPath $iexpress -PathType Leaf)) {
    throw "IExpress is unavailable: $iexpress"
}

$requiredFiles = @(
    'ZTerminalWindowsHost.exe',
    'zt-local-scene-bridge.exe',
    'zt-local-monte-carlo.exe',
    'zt-local-segment-catalog.exe',
    'zt-local-workspace.exe',
    'zt-offline-provider-import.exe',
    'zt-direct-public-ingest.exe'
)

foreach ($requiredFile in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $ReleaseDirectory $requiredFile) -PathType Leaf)) {
        throw "The packaged Release directory is incomplete: $requiredFile"
    }
}

$installerSource = Join-Path $RepositoryRoot 'apps\windows-host\installer'
foreach ($scriptName in @('install-zterminal.ps1', 'uninstall-zterminal.ps1')) {
    if (-not (Test-Path -LiteralPath (Join-Path $installerSource $scriptName) -PathType Leaf)) {
        throw "The installer source is incomplete: $scriptName"
    }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$payloadDirectory = Join-Path $OutputDirectory 'payload'
$sedPath = Join-Path $OutputDirectory 'zterminal-private-installer.sed'
$target = Join-Path $OutputDirectory 'ZTerminal-Private-Setup.exe'
Remove-Item -LiteralPath $payloadDirectory -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $payloadDirectory -Force | Out-Null

foreach ($requiredFile in $requiredFiles) {
    Copy-Item -LiteralPath (Join-Path $ReleaseDirectory $requiredFile) -Destination (Join-Path $payloadDirectory $requiredFile) -Force
}
Copy-Item -LiteralPath (Join-Path $installerSource 'install-zterminal.ps1') -Destination (Join-Path $payloadDirectory 'install-zterminal.ps1') -Force
Copy-Item -LiteralPath (Join-Path $installerSource 'uninstall-zterminal.ps1') -Destination (Join-Path $payloadDirectory 'uninstall-zterminal.ps1') -Force

$payloadFiles = @($requiredFiles + 'install-zterminal.ps1' + 'uninstall-zterminal.ps1')
$sourceFileEntries = foreach ($index in 0..($payloadFiles.Count - 1)) { "%FILE$index%=" }
$stringEntries = foreach ($index in 0..($payloadFiles.Count - 1)) { "FILE$index=`"$($payloadFiles[$index])`"" }
$sed = @(
    '[Version]',
    'Class=IEXPRESS',
    'SEDVersion=3',
    '[Options]',
    'PackagePurpose=InstallApp',
    'ShowInstallProgramWindow=0',
    'HideExtractAnimation=1',
    'UseLongFileName=1',
    'InsideCompressed=1',
    'SourceFiles=SourceFiles',
    'Strings=Strings',
    'CAB_FixedSize=0',
    'CAB_ResvCodeSigning=0',
    'RebootMode=N',
    'InstallPrompt=',
    'DisplayLicense=',
    'FinishMessage=',
    "TargetName=$target",
    'FriendlyName=ZTerminal Private Local-First Installer',
    'AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install-zterminal.ps1',
    'PostInstallCmd=<None>',
    'AdminQuietInstCmd=',
    'UserQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install-zterminal.ps1',
    'FILE0=""',
    '[Strings]',
    ($stringEntries -join [Environment]::NewLine),
    '[SourceFiles]',
    "SourceFiles0=$payloadDirectory\",
    '[SourceFiles0]',
    ($sourceFileEntries -join [Environment]::NewLine)
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($sedPath, $sed + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

$build = Start-Process -FilePath $iexpress -ArgumentList @('/N', '/Q', $sedPath) -Wait -PassThru
if ($build.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "IExpress did not create the private installer. Exit code: $($build.ExitCode)"
}

$signature = Get-AuthenticodeSignature -FilePath $target
[pscustomobject]@{
    schema_version = 1
    output = $target
    bytes = (Get-Item -LiteralPath $target).Length
    signature_status = $signature.Status.ToString()
    signed = $signature.Status -eq 'Valid'
    network_opened = $false
    public_release_created = $false
} | ConvertTo-Json -Depth 3
