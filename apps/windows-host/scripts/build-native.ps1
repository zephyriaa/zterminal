[CmdletBinding()]
param([switch]$Launch)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$nativeRepository = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$nativeBuild = Join-Path $nativeRepository 'out\windows-host'
$nativeSource = Join-Path $nativeRepository 'apps\windows-host'
$nativeVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $nativeVswhere)) {
    throw 'Install Visual Studio Build Tools with the Desktop C++ workload to build the native Windows app.'
}
$nativeVs = & $nativeVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $nativeVs) { throw 'The Visual Studio Desktop C++ workload is missing.' }
Import-Module (Join-Path $nativeVs 'Common7\Tools\Microsoft.VisualStudio.DevShell.dll')
Enter-VsDevShell -VsInstallPath $nativeVs -SkipAutomaticLocation -DevCmdArguments '-arch=x64 -host_arch=x64' | Out-Null
$nativeCmake = Join-Path $nativeVs 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
if (-not (Test-Path -LiteralPath $nativeCmake)) {
    $nativeCmake = (Get-Command cmake -ErrorAction Stop).Source
}
$env:Path = (Join-Path $env:USERPROFILE '.cargo\bin') + ';' + $env:Path

& $nativeCmake -S $nativeSource -B $nativeBuild -G 'Visual Studio 17 2022' -A x64
if ($LASTEXITCODE -ne 0) { throw 'Native Windows configuration failed.' }
& $nativeCmake --build $nativeBuild --config Release --target ZTerminalWindowsHost
if ($LASTEXITCODE -ne 0) { throw 'Native Windows build failed.' }
$nativeExecutable = Join-Path $nativeBuild 'Release\ZTerminalWindowsHost.exe'
if (-not (Test-Path -LiteralPath $nativeExecutable -PathType Leaf)) { throw 'The native host was not produced.' }
Write-Output "Native Windows app ready: $nativeExecutable"
if ($Launch) {
    # Launch is explicitly requested. Normal startup performs no ingestion or cloud sync.
    $nativeProcess = Start-Process -FilePath $nativeExecutable -WorkingDirectory (Split-Path $nativeExecutable) -PassThru
    Write-Output "Opened ZTerminal native Windows app (PID $($nativeProcess.Id))."
}
