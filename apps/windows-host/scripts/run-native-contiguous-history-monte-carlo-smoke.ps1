param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$HostExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\ZTerminalWindowsHost.exe'),
    [string]$ImporterExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-offline-provider-import.exe'),
    [ValidateRange(1, 10)]
    [int]$BenchmarkSeconds = 2
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $HostExecutable)) { throw "Native host executable was not found: $HostExecutable" }
if (-not (Test-Path $ImporterExecutable)) { throw "Packaged offline importer was not found: $ImporterExecutable" }

function Invoke-BoundedProcess {
    param([string]$FilePath, [AllowEmptyString()][string]$Arguments, [int]$TimeoutMilliseconds)
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = $Arguments
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "Could not start $FilePath" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        $process.Kill(); $process.WaitForExit()
        throw "$FilePath exceeded the bounded $TimeoutMilliseconds ms process limit"
    }
    [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
    [pscustomobject]@{ exit_code = $process.ExitCode; stdout = $stdoutTask.Result; stderr = $stderrTask.Result }
}

function Import-TestOnlySegment {
    param([int]$OffsetMilliseconds, [string]$FrameFile, [string]$StoreRoot)
    $frameLines = 1..7 | ForEach-Object {
        $timestamp = $OffsetMilliseconds + $_
        '{{"e":"aggTrade","E":{0},"s":"BTCUSDT","a":{0},"p":"{1}.00","q":"1.000","T":{0},"m":false}}' -f $timestamp, (100 + $timestamp)
    }
    [System.IO.File]::WriteAllLines($FrameFile, $frameLines, [System.Text.UTF8Encoding]::new($false))
    $capturedAtNs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $arguments = @(
        '--provider=binance-spot-aggtrade', "--frame-file=$FrameFile", "--root=$StoreRoot",
        '--provider-symbol=btcusdt', '--symbol-id=1', '--price-scale=100', '--quantity-scale=1000',
        '--stream-id=7', '--interval-ns=1000000', '--maximum-bars=10', "--captured-at-ns=$capturedAtNs",
        '--access-time=9', '--flush'
    ) -join ' '
    $process = Invoke-BoundedProcess -FilePath $ImporterExecutable -Arguments $arguments -TimeoutMilliseconds 10000
    if ($process.exit_code -ne 0) { throw "Offline importer exited with code $($process.exit_code): $($process.stderr.Trim())" }
    $result = $process.stdout | ConvertFrom-Json
    if ($result.network_opened -or $result.outcome -ne 'persisted' -or $result.source_frames -ne 7 -or $result.adapter_gaps -ne 0 -or $result.withheld_events -ne 0 -or $result.retained_completed_bars -ne 6 -or $null -eq $result.segment) {
        throw "Test-only importer did not produce the expected local immutable segment: $($result | ConvertTo-Json -Compress)"
    }
    $result
}

$workRoot = Join-Path $RepositoryRoot 'out\native-contiguous-history-monte-carlo-smoke'
$store = Join-Path $workRoot 'store'
$diagnostic = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'
Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $first = Import-TestOnlySegment -OffsetMilliseconds 0 -FrameFile (Join-Path $workRoot 'TEST_ONLY_first.ndjson') -StoreRoot $store
    $second = Import-TestOnlySegment -OffsetMilliseconds 6 -FrameFile (Join-Path $workRoot 'TEST_ONLY_second.ndjson') -StoreRoot $store
    if ([uint64]$second.segment.start_ns -ne ([uint64]$first.segment.start_ns + 6000000)) {
        throw 'The two test-only local immutable segments are not exactly contiguous.'
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $completeArguments = @(
        "--local-root=$store", '--symbol-id=1', '--interval-ns=1000000', "--start-ns=$($first.segment.start_ns)",
        '--first-bar=0', '--visible-bars=2', '--freshness-budget-ns=60000000000',
        '--local-monte-carlo-simulations=32', '--local-monte-carlo-horizon-bars=4', '--local-monte-carlo-seed=7',
        '--local-monte-carlo-history-segments=2', "--benchmark-seconds=$BenchmarkSeconds"
    ) -join ' '
    $completeProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $completeArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($completeProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native contiguous local research handoff failed with exit code $($completeProcess.exit_code): $($completeProcess.stderr.Trim())"
    }
    $complete = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($complete.fixture_only -or $complete.chart_source -ne 'local_scene' -or ($complete.local_availability -ne 'LOCAL LIVE' -and $complete.local_availability -ne 'LOCAL CACHED') -or $complete.fixture_candles -ne 2 -or $complete.local_total_bars -ne 6 -or $complete.local_monte_carlo_kind -ne 'LOCAL MC COMPLETE' -or ($complete.local_monte_carlo_availability -ne 'LOCAL LIVE' -and $complete.local_monte_carlo_availability -ne 'LOCAL CACHED') -or $complete.local_monte_carlo_source_segments -ne 2 -or $complete.local_monte_carlo_source_bars -ne 12 -or $complete.local_monte_carlo_simulations -ne 32 -or $complete.local_monte_carlo_horizon_bars -ne 4 -or $complete.renderer_resize_failures -ne 0 -or $complete.renderer_present_failures -ne 0) {
        throw "Native contiguous local research handoff did not meet its bounded local contract: $($complete | ConvertTo-Json -Compress)"
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $invalidArguments = @(
        "--local-root=$store", '--symbol-id=1', '--interval-ns=1000000', "--start-ns=$($first.segment.start_ns)",
        '--first-bar=0', '--visible-bars=2', '--freshness-budget-ns=60000000000',
        '--local-monte-carlo-simulations=32', '--local-monte-carlo-horizon-bars=4', '--local-monte-carlo-seed=7',
        '--local-monte-carlo-history-segments=17', "--benchmark-seconds=$BenchmarkSeconds"
    ) -join ' '
    $invalidProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $invalidArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($invalidProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native invalid history request failed with exit code $($invalidProcess.exit_code): $($invalidProcess.stderr.Trim())"
    }
    $invalid = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($invalid.fixture_only -or $invalid.chart_source -ne 'local_scene' -or ($invalid.local_availability -ne 'LOCAL LIVE' -and $invalid.local_availability -ne 'LOCAL CACHED') -or $invalid.fixture_candles -ne 2 -or $invalid.local_monte_carlo_kind -ne 'LOCAL MC BRIDGE FAILURE' -or $invalid.local_monte_carlo_source_segments -ne 0 -or $invalid.local_monte_carlo_source_bars -ne 0 -or $invalid.renderer_resize_failures -ne 0 -or $invalid.renderer_present_failures -ne 0) {
        throw "An invalid history count did not fail closed while retaining the verified local chart: $($invalid | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        packaged_local_monte_carlo = $true
        native_host = $true
        execution_uses_cargo = $false
        network_opened = $false
        contiguous_history = [pscustomobject]@{
            chart_source = $complete.chart_source
            source_segments = $complete.local_monte_carlo_source_segments
            source_bars = $complete.local_monte_carlo_source_bars
            simulations = $complete.local_monte_carlo_simulations
            horizon_bars = $complete.local_monte_carlo_horizon_bars
            median_return_bps = $complete.local_monte_carlo_median_return_bps
            continuity_proven = $true
        }
        invalid_history_request = [pscustomobject]@{
            history_segments = 17
            research_kind = $invalid.local_monte_carlo_kind
            retained_verified_chart = -not $invalid.fixture_only -and $invalid.fixture_candles -eq 2
            source_segments = $invalid.local_monte_carlo_source_segments
        }
    } | ConvertTo-Json -Depth 5
}
finally { Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue }
