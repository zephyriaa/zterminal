[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$ReleaseDirectory = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\..\out\private-installer')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) {
    throw "The Windows C# compiler is unavailable: $compiler"
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
$setupSource = Join-Path $installerSource 'Setup.cs'
$uninstallerSource = Join-Path $installerSource 'uninstall-zterminal.ps1'
foreach ($source in @($setupSource, $uninstallerSource)) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "The installer source is incomplete: $source"
    }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$payloadDirectory = Join-Path $OutputDirectory 'payload'
$payloadArchive = Join-Path $OutputDirectory 'ZTerminalPayload.zip'
$target = Join-Path $OutputDirectory 'ZTerminal-Private-Setup.exe'
Remove-Item -LiteralPath $payloadDirectory -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $payloadArchive -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $payloadDirectory -Force | Out-Null

foreach ($requiredFile in $requiredFiles) {
    Copy-Item -LiteralPath (Join-Path $ReleaseDirectory $requiredFile) -Destination (Join-Path $payloadDirectory $requiredFile) -Force
}
Copy-Item -LiteralPath $uninstallerSource -Destination (Join-Path $payloadDirectory 'uninstall-zterminal.ps1') -Force
Compress-Archive -Path (Join-Path $payloadDirectory '*') -DestinationPath $payloadArchive -CompressionLevel Optimal -Force

$references = @(
    '/r:System.IO.Compression.dll',
    '/r:System.IO.Compression.FileSystem.dll',
    '/r:System.Windows.Forms.dll',
    '/r:Microsoft.CSharp.dll'
)
$compilerArguments = @(
    '/nologo',
    '/target:winexe',
    '/optimize+',
    '/platform:anycpu',
    "/out:$target",
    "/resource:$payloadArchive,ZTerminalPayload.zip"
) + $references + @($setupSource)
& $compiler @compilerArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "The Windows setup compiler did not create the private installer. Exit code: $LASTEXITCODE"
}

$signature = Get-AuthenticodeSignature -FilePath $target
[pscustomobject]@{
    schema_version = 2
    output = $target
    bytes = (Get-Item -LiteralPath $target).Length
    signature_status = $signature.Status.ToString()
    signed = $signature.Status -eq 'Valid'
    payload_files = $requiredFiles.Count + 1
    network_opened = $false
    public_release_created = $false
} | ConvertTo-Json -Depth 3
