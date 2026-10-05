param([switch]$RustOnly)
$ErrorActionPreference = 'Stop'
$executionRepository = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $executionRepository
$env:Path = (Join-Path $env:USERPROFILE '.cargo/bin') + ';' + $env:Path

# Prepare the installed MSVC/SDK toolchain; no downloads or secret environment.
$executionVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
if (-not (Test-Path -LiteralPath $executionVswhere)) { throw 'Visual Studio C++ Build Tools are required.' }
$executionInstallation = & $executionVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $executionInstallation) { throw 'The Desktop C++ workload is required.' }
Import-Module (Join-Path $executionInstallation 'Common7/Tools/Microsoft.VisualStudio.DevShell.dll')
Enter-VsDevShell -VsInstallPath $executionInstallation -SkipAutomaticLocation -DevCmdArguments '-arch=x64 -host_arch=x64'
$env:Path = (Join-Path $executionInstallation 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin') + ';' + $env:Path

& cargo test -p zt-execution -p zt-execution-paper -p zt-risk --locked
if ($LASTEXITCODE -ne 0) { throw 'Rust execution tests failed.' }
& cargo clippy -p zt-execution -p zt-execution-paper --all-targets --locked -- -D warnings
if ($LASTEXITCODE -ne 0) { throw 'Execution lint checks failed.' }
if (-not $RustOnly) {
    & cmake -S apps/windows-host -B out/windows-host -G 'Visual Studio 17 2022' -A x64
    if ($LASTEXITCODE -ne 0) { throw 'Native configuration failed.' }
    & cmake --build out/windows-host --config Release --target ZTerminalExecutionVaultTests
    if ($LASTEXITCODE -ne 0) { throw 'Native vault build failed.' }
    & ctest --test-dir out/windows-host -C Release --output-on-failure -R execution-vault
    if ($LASTEXITCODE -ne 0) { throw 'Native vault tests failed.' }
}
