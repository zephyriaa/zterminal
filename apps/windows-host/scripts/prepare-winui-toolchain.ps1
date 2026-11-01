[CmdletBinding()]
param([Parameter(Mandatory)][string]$VisualStudioPath)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$nativeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$nativeCache = Join-Path $nativeRoot 'out\winui-toolchain'
$nativeExtensions = Join-Path $nativeCache 'MSBuild'
$nativeInstalledTargets = Join-Path $VisualStudioPath 'MSBuild\Microsoft\WindowsXaml\v17.0\Microsoft.Windows.UI.Xaml.Cpp.targets'
if (Test-Path -LiteralPath $nativeInstalledTargets) {
    return [pscustomobject]@{VCTargetsPath=(Join-Path $VisualStudioPath 'MSBuild\Microsoft\VC\v170\'); ExtensionsPath=(Join-Path $VisualStudioPath 'MSBuild')}
}
# A local, hash-pinned dependency cache supports Build Tools installations without
# the optional UWP workload. It neither modifies Visual Studio nor needs elevation.
New-Item -ItemType Directory -Force $nativeCache | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$nativePackages = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'winui-build-dependencies.json') -Raw | ConvertFrom-Json
foreach ($nativePackage in $nativePackages) {
    $nativeZip = Join-Path $nativeCache ($nativePackage.id+'.zip')
    if (-not (Test-Path -LiteralPath $nativeZip)) { Invoke-WebRequest -Uri $nativePackage.url -OutFile $nativeZip }
    if ((Get-Item -LiteralPath $nativeZip).Length -ne $nativePackage.bytes -or (Get-FileHash -LiteralPath $nativeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $nativePackage.sha256) {
        throw "Build dependency integrity check failed: $($nativePackage.id). Remove that cache file and retry."
    }
    $nativeExtracted = Join-Path $nativeCache $nativePackage.id
    if (-not (Test-Path -LiteralPath (Join-Path $nativeExtracted 'manifest.json'))) {
        [IO.Compression.ZipFile]::ExtractToDirectory($nativeZip,$nativeExtracted)
    }
}
New-Item -ItemType Directory -Force (Join-Path $nativeExtensions 'Microsoft\VC') | Out-Null
Copy-Item -LiteralPath (Join-Path $VisualStudioPath 'MSBuild\Microsoft\VC\v170') -Destination (Join-Path $nativeExtensions 'Microsoft\VC\v170') -Recurse -Force
foreach ($nativePackage in $nativePackages) {
    $nativeContents = Join-Path $nativeCache ($nativePackage.id+'\Contents\MSBuild')
    if (-not (Test-Path -LiteralPath $nativeContents)) { continue }
    foreach ($nativeFile in Get-ChildItem -LiteralPath $nativeContents -Recurse -File) {
        # VSIX paths percent-encode spaces. Decode only after verifying exact bytes.
        $nativeRelative = [Uri]::UnescapeDataString($nativeFile.FullName.Substring($nativeContents.Length+1))
        $nativeDestination = [IO.Path]::GetFullPath((Join-Path $nativeExtensions $nativeRelative))
        if (-not $nativeDestination.StartsWith($nativeExtensions+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Build dependency path escapes its cache.' }
        New-Item -ItemType Directory -Force (Split-Path $nativeDestination) | Out-Null
        Copy-Item -LiteralPath $nativeFile.FullName -Destination $nativeDestination -Force
    }
}
foreach ($nativeCommon in @('Microsoft.Common.props','Microsoft.VisualStudioVersion.v17.Common.props')) {
    Copy-Item -LiteralPath (Join-Path $VisualStudioPath ('MSBuild\Current\'+$nativeCommon)) -Destination (Join-Path $nativeExtensions ('Current\'+$nativeCommon)) -Force
}
return [pscustomobject]@{VCTargetsPath=(Join-Path $nativeExtensions 'Microsoft\VC\v170\'); ExtensionsPath=$nativeExtensions}
