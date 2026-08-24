[CmdletBinding()]
param(
    [string]$Executable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\ZTerminalWindowsHost.exe'),
    [ValidateRange(1, 10)]
    [int]$BenchmarkSeconds = 2
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Executable)) {
    throw "Native host executable was not found: $Executable"
}

$diagnostic = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'

function Invoke-NativeHostSmoke {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Arguments
    )

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -PassThru
    if (-not $process.WaitForExit(($BenchmarkSeconds + 15) * 1000)) {
        Stop-Process -Id $process.Id -Force
        throw "$Name did not exit within the smoke timeout."
    }
    if ($process.ExitCode -ne 0) {
        throw "$Name exited with code $($process.ExitCode)."
    }
    if (-not (Test-Path $diagnostic)) {
        throw "$Name did not write its native diagnostic."
    }
    return Get-Content -Raw $diagnostic | ConvertFrom-Json
}

$default = Invoke-NativeHostSmoke -Name 'default local-first mode' -Arguments "--benchmark-seconds=$BenchmarkSeconds"
if ($default.fixture_only -or $default.chart_source -ne 'withheld' -or $default.fixture_candles -ne 0 -or $default.local_availability -ne 'LOCAL DATA UNAVAILABLE') {
    throw "Default native mode was not fail-closed: $($default | ConvertTo-Json -Compress)"
}

$missingRoot = Join-Path $env:TEMP 'zterminal-local-scene-smoke-absent'
Remove-Item $missingRoot -Recurse -Force -ErrorAction SilentlyContinue
$unavailable = Invoke-NativeHostSmoke -Name 'explicit unavailable local scene' -Arguments "--local-root=$missingRoot --symbol-id=9 --interval-ns=1000000000 --start-ns=0 --first-bar=0 --visible-bars=1 --freshness-budget-ns=10 --benchmark-seconds=$BenchmarkSeconds"
if ($unavailable.fixture_only -or $unavailable.chart_source -ne 'withheld' -or $unavailable.fixture_candles -ne 0 -or $unavailable.local_availability -ne 'LOCAL DATA UNAVAILABLE') {
    throw "Missing local segment was not withheld: $($unavailable | ConvertTo-Json -Compress)"
}

$fixture = Invoke-NativeHostSmoke -Name 'explicit fixture diagnostic' -Arguments "--fixture-candles=10000 --benchmark-seconds=$BenchmarkSeconds"
if (-not $fixture.fixture_only -or $fixture.chart_source -ne 'fixture' -or $fixture.fixture_candles -ne 10000) {
    throw "Explicit fixture diagnostic was not truthfully labelled: $($fixture | ConvertTo-Json -Compress)"
}

$resize = Invoke-NativeHostSmoke -Name 'internal resize diagnostic' -Arguments "--benchmark-seconds=$BenchmarkSeconds --benchmark-resize-once"
if ($resize.fixture_only -or $resize.chart_source -ne 'withheld' -or $resize.local_availability -ne 'LOCAL DATA UNAVAILABLE' -or $resize.fixture_candles -ne 0 -or -not $resize.benchmark_resize_once) {
    throw "Internal resize diagnostic lost its fail-closed local chart state: $($resize | ConvertTo-Json -Compress)"
}
if ($resize.renderer_resize_successes -lt 1 -or $resize.renderer_resize_failures -ne 0 -or $resize.renderer_device_recoveries -ne 0 -or $resize.renderer_unrecoverable_device_failures -ne 0 -or $resize.renderer_present_failures -ne 0) {
    throw "Internal resize diagnostic reported unexpected renderer counters: $($resize | ConvertTo-Json -Compress)"
}

[pscustomobject]@{
    schema_version = 2
    default = $default
    unavailable_local_scene = $unavailable
    explicit_fixture_diagnostic = $fixture
    internal_resize_diagnostic = $resize
} | ConvertTo-Json -Depth 4
