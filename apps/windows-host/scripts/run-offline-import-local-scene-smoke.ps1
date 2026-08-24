[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$HostExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\ZTerminalWindowsHost.exe'),
    [ValidateRange(1, 10)]
    [int]$BenchmarkSeconds = 2
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $HostExecutable)) {
    throw "Native host executable was not found: $HostExecutable"
}

$workRoot = Join-Path $RepositoryRoot 'out\offline-import-local-scene-smoke'
$frames = Join-Path $workRoot 'TEST_ONLY_binance_aggregate_frames.ndjson'
$store = Join-Path $workRoot 'store'
$diagnostic = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'
$originalLocation = Get-Location

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    Set-Location $RepositoryRoot
    $frameText = @'
{"e":"aggTrade","E":1,"s":"BTCUSDT","a":1,"p":"100.00","q":"1.000","T":1,"m":false}
{"e":"aggTrade","E":2,"s":"BTCUSDT","a":2,"p":"100.00","q":"1.000","T":2,"m":false}
{"e":"aggTrade","E":3,"s":"BTCUSDT","a":3,"p":"100.00","q":"1.000","T":3,"m":false}
'@
    [System.IO.File]::WriteAllText($frames, $frameText, [System.Text.UTF8Encoding]::new($false))

    $capturedAtNs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $importArguments = @(
        'run', '-q', '-p', 'zt-offline-provider-import', '--',
        '--provider=binance-spot-aggtrade',
        "--frame-file=$frames",
        "--root=$store",
        '--provider-symbol=btcusdt',
        '--symbol-id=1',
        '--price-scale=100',
        '--quantity-scale=1000',
        '--stream-id=7',
        '--interval-ns=1000000',
        '--maximum-bars=10',
        "--captured-at-ns=$capturedAtNs",
        '--access-time=9',
        '--flush'
    )
    $importText = (& cargo @importArguments) -join [Environment]::NewLine
    if ($LASTEXITCODE -ne 0) {
        throw "The test-only offline importer exited with code $LASTEXITCODE."
    }
    $import = $importText | ConvertFrom-Json
    if ($import.network_opened -or $import.outcome -ne 'persisted' -or $import.source_frames -ne 3 -or $import.adapter_gaps -ne 0 -or $import.withheld_events -ne 0 -or $import.retained_completed_bars -ne 2 -or $null -eq $import.segment) {
        throw "Test-only offline importer did not produce the expected bounded local result: $($import | ConvertTo-Json -Compress)"
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $hostArguments = @(
        "--local-root=$store",
        '--symbol-id=1',
        '--interval-ns=1000000',
        "--start-ns=$($import.segment.start_ns)",
        '--first-bar=0',
        '--visible-bars=2',
        '--freshness-budget-ns=60000000000',
        "--benchmark-seconds=$BenchmarkSeconds"
    )
    $process = Start-Process -FilePath $HostExecutable -ArgumentList $hostArguments -PassThru
    if (-not $process.WaitForExit(($BenchmarkSeconds + 15) * 1000)) {
        Stop-Process -Id $process.Id -Force
        throw 'Native local-scene smoke did not exit within the bounded timeout.'
    }
    if ($process.ExitCode -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native local-scene smoke failed with exit code $($process.ExitCode)."
    }
    $native = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($native.fixture_only -or $native.chart_source -ne 'local_scene' -or ($native.local_availability -ne 'LOCAL LIVE' -and $native.local_availability -ne 'LOCAL CACHED') -or $native.fixture_candles -ne 2 -or $native.renderer_resize_failures -ne 0 -or $native.renderer_present_failures -ne 0) {
        throw "Native host did not render the expected verified local scene: $($native | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        network_opened = $false
        importer = $import
        native_host = $native
    } | ConvertTo-Json -Depth 5
}
finally {
    Set-Location $originalLocation
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
