[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$ReleaseDirectory = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\..\out\private-installer'),
    [string]$Compiler = '',
    [string]$SmokeRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

$installerDefinition = Join-Path $RepositoryRoot 'apps\windows-host\installer\ZTerminal.iss'
if (-not (Test-Path -LiteralPath $installerDefinition -PathType Leaf)) {
    throw "The conventional installer definition is missing: $installerDefinition"
}

if ([string]::IsNullOrWhiteSpace($Compiler)) {
    $compilerCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 7\ISCC.exe'),
        'C:\Program Files\Inno Setup 7\ISCC.exe',
        'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
    )
    $Compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if ([string]::IsNullOrWhiteSpace($Compiler) -or -not (Test-Path -LiteralPath $Compiler -PathType Leaf)) {
    throw 'Inno Setup Compiler was not found. Install the verified private build tool before packaging ZTerminal.'
}

$resolvedReleaseDirectory = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resolvedOutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$target = Join-Path $resolvedOutputDirectory 'ZTerminal-Private-Setup.exe'
Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue

$compilerArguments = @(
    "/DReleaseDirectory=$resolvedReleaseDirectory",
    "/DOutputDirectory=$resolvedOutputDirectory"
)
$effectiveSmokeRoot = ''
if (-not [string]::IsNullOrWhiteSpace($SmokeRoot)) {
    New-Item -ItemType Directory -Path $SmokeRoot -Force | Out-Null
    $effectiveSmokeRoot = (Resolve-Path -LiteralPath $SmokeRoot).Path
    $compilerArguments += @(
        '/DInstallerAppId=ZTerminalPrivateSmoke',
        '/DInstallerDisplayName=ZTerminal Smoke',
        '/DInstallerGroupName=ZTerminal Smoke',
        "/DDefaultInstallDirectory=$(Join-Path $effectiveSmokeRoot 'program')",
        "/DLocalDataDirectory=$(Join-Path $effectiveSmokeRoot 'local-data')",
        "/DRoamingDataDirectory=$(Join-Path $effectiveSmokeRoot 'roaming-data')",
        "/DLegacyBinaryDirectory=$(Join-Path $effectiveSmokeRoot 'legacy\app')",
        '/DLegacyUninstallKey=Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ZTerminalLegacySmoke',
        '/DMigrateLegacyInstall=1'
    )
}
$compilerArguments += $installerDefinition
& $Compiler @compilerArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "The Inno Setup compiler did not create the private installer. Exit code: $LASTEXITCODE"
}

$signature = Get-AuthenticodeSignature -FilePath $target
[pscustomobject]@{
    schema_version = 3
    installer_format = 'Inno Setup conventional EXE'
    compiler = $Compiler
    output = $target
    bytes = (Get-Item -LiteralPath $target).Length
    signature_status = $signature.Status.ToString()
    signed = $signature.Status -eq 'Valid'
    payload_files = $requiredFiles.Count
    install_scope = 'CurrentUser'
    isolated_smoke_build = -not [string]::IsNullOrWhiteSpace($effectiveSmokeRoot)
    smoke_root = $effectiveSmokeRoot
    network_opened = $false
    public_release_created = $false
} | ConvertTo-Json -Depth 4
