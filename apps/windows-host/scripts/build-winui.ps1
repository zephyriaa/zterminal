[CmdletBinding()]
param([switch]$Launch,[switch]$Rebuild,[string]$OutputDirectory='')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$nativeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$nativeVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$nativeVs = & $nativeVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $nativeVs) { throw 'Install Visual Studio 2022 Build Tools with Desktop C++ and Windows SDK 10.0.26100.' }
Import-Module (Join-Path $nativeVs 'Common7\Tools\Microsoft.VisualStudio.DevShell.dll')
Enter-VsDevShell -VsInstallPath $nativeVs -SkipAutomaticLocation -DevCmdArguments '-arch=x64 -host_arch=x64' | Out-Null
$env:Path = (Join-Path $env:USERPROFILE '.cargo\bin')+';'+$env:Path
$nativeCmake = Join-Path $nativeVs 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
& $nativeCmake -S (Join-Path $nativeRoot 'apps\windows-host') -B (Join-Path $nativeRoot 'out\windows-host') -G 'Visual Studio 17 2022' -A x64
if ($LASTEXITCODE -ne 0) { throw 'Chart library configuration failed.' }
& $nativeCmake --build (Join-Path $nativeRoot 'out\windows-host') --config Release --target ZTerminalChartPresentation
if ($LASTEXITCODE -ne 0) { throw 'Chart library build failed.' }
$nativeTools = & (Join-Path $PSScriptRoot 'prepare-winui-toolchain.ps1') -VisualStudioPath $nativeVs
$nativeTarget = if ($Rebuild) {'Rebuild'} else {'Build'}
$nativeOutput = if($OutputDirectory){[System.IO.Path]::GetFullPath($OutputDirectory)}else{Join-Path $nativeRoot 'out\windows-app\Release'}
& (Join-Path $nativeVs 'MSBuild\Current\Bin\MSBuild.exe') (Join-Path $nativeRoot 'apps\windows-host\winui\ZTerminalWindowsHost.vcxproj') /restore "/t:$nativeTarget" /p:Configuration=Release /p:Platform=x64 "/p:OutDir=$nativeOutput\" "/p:VCTargetsPath=$($nativeTools.VCTargetsPath)" "/p:MSBuildExtensionsPath=$($nativeTools.ExtensionsPath)" /m /v:minimal
if ($LASTEXITCODE -ne 0) { throw 'WinUI application build failed.' }
& cargo build --locked --manifest-path (Join-Path $nativeRoot 'src-tauri\workstation-core\Cargo.toml') --release --bin zt-native-store --target-dir (Join-Path $nativeRoot 'out\native-store-cargo')
if ($LASTEXITCODE -ne 0) { throw 'Native Store adapter build failed.' }
Copy-Item -LiteralPath (Join-Path $nativeRoot 'out\native-store-cargo\release\zt-native-store.exe') -Destination $nativeOutput -Force
$nativeExecutable = Join-Path $nativeOutput 'ZTerminal.exe'
if (-not (Test-Path -LiteralPath $nativeExecutable)) { throw 'WinUI executable was not produced.' }
# Self-contained WinUI includes its SDK runtime. Copy the installed desktop CRT
# as well, so the distributable does not depend on a machine-wide redistributable.
$nativeRedist = Join-Path $env:VCToolsRedistDir 'x64\Microsoft.VC143.CRT'
Copy-Item -Path (Join-Path $nativeRedist '*.dll') -Destination $nativeOutput -Force
Get-ChildItem -LiteralPath (Join-Path $nativeRoot 'out\windows-host\Release') -Filter 'zt-*.exe' | Copy-Item -Destination $nativeOutput -Force
Write-Output "Native WinUI application ready: $nativeExecutable"
if ($Launch) { Start-Process -FilePath $nativeExecutable -WorkingDirectory $nativeOutput | Out-Null }
