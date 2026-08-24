param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$HostExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\ZTerminalWindowsHost.exe'),
    [string]$ImporterExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-offline-provider-import.exe'),
    [ValidateRange(1, 10)]
    [int]$BenchmarkSeconds = 2
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $HostExecutable)) {
    throw "Native host executable was not found: $HostExecutable"
}
if (-not (Test-Path $ImporterExecutable)) {
    throw "Packaged offline importer was not found: $ImporterExecutable"
}

function Invoke-BoundedProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Arguments,
        [Parameter(Mandatory = $true)]
        [int]$TimeoutMilliseconds
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = $Arguments
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Could not start $FilePath"
    }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        $process.Kill()
        $process.WaitForExit()
        throw "$FilePath exceeded the bounded $TimeoutMilliseconds ms process limit"
    }
    [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
    [pscustomobject]@{
        exit_code = $process.ExitCode
        stdout = $stdoutTask.Result
        stderr = $stderrTask.Result
    }
}

$workRoot = Join-Path $RepositoryRoot 'out\native-local-monte-carlo-handoff-smoke'
$frames = Join-Path $workRoot 'TEST_ONLY_binance_aggregate_frames.ndjson'
$store = Join-Path $workRoot 'store'
$diagnostic = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $frameLines = 1..7 | ForEach-Object {
        '{{"e":"aggTrade","E":{0},"s":"BTCUSDT","a":{0},"p":"{1}.00","q":"1.000","T":{0},"m":false}}' -f $_, (100 + $_)
    }
    [System.IO.File]::WriteAllLines($frames, $frameLines, [System.Text.UTF8Encoding]::new($false))
    $capturedAtNs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $importArguments = @(
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
    ) -join ' '
    $importProcess = Invoke-BoundedProcess -FilePath $ImporterExecutable -Arguments $importArguments -TimeoutMilliseconds 10000
    if ($importProcess.exit_code -ne 0) {
        throw "The test-only offline importer exited with code $($importProcess.exit_code): $($importProcess.stderr.Trim())"
    }
    $import = $importProcess.stdout | ConvertFrom-Json
    if ($import.network_opened -or $import.outcome -ne 'persisted' -or $import.source_frames -ne 7 -or $import.adapter_gaps -ne 0 -or $import.withheld_events -ne 0 -or $import.retained_completed_bars -ne 6 -or $null -eq $import.segment) {
        throw "The test-only offline importer did not produce the expected local result: $($import | ConvertTo-Json -Compress)"
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
        '--local-monte-carlo-simulations=32',
        '--local-monte-carlo-horizon-bars=8',
        '--local-monte-carlo-seed=7',
        "--benchmark-seconds=$BenchmarkSeconds"
    ) -join ' '
    $hostProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $hostArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($hostProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native local research handoff failed with exit code $($hostProcess.exit_code): $($hostProcess.stderr.Trim())"
    }
    $native = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($native.fixture_only -or $native.chart_source -ne 'local_scene' -or ($native.local_availability -ne 'LOCAL LIVE' -and $native.local_availability -ne 'LOCAL CACHED') -or $native.fixture_candles -ne 2 -or $native.local_total_bars -ne 6 -or $native.local_monte_carlo_kind -ne 'LOCAL MC COMPLETE' -or ($native.local_monte_carlo_availability -ne 'LOCAL LIVE' -and $native.local_monte_carlo_availability -ne 'LOCAL CACHED') -or $native.local_monte_carlo_source_bars -ne 6 -or $native.local_monte_carlo_simulations -ne 32 -or $native.local_monte_carlo_horizon_bars -ne 8 -or $native.renderer_resize_failures -ne 0 -or $native.renderer_present_failures -ne 0) {
        throw "Native local research handoff did not meet the bounded local contract: $($native | ConvertTo-Json -Compress)"
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $partialHostArguments = @(
        "--local-root=$store",
        '--symbol-id=1',
        '--interval-ns=1000000',
        "--start-ns=$($import.segment.start_ns)",
        '--first-bar=0',
        '--visible-bars=2',
        '--freshness-budget-ns=60000000000',
        '--local-monte-carlo-simulations=32',
        "--benchmark-seconds=$BenchmarkSeconds"
    ) -join ' '
    $partialProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $partialHostArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($partialProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native partial local research request failed with exit code $($partialProcess.exit_code): $($partialProcess.stderr.Trim())"
    }
    $partial = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($partial.fixture_only -or $partial.chart_source -ne 'local_scene' -or ($partial.local_availability -ne 'LOCAL LIVE' -and $partial.local_availability -ne 'LOCAL CACHED') -or $partial.fixture_candles -ne 2 -or $partial.local_monte_carlo_kind -ne 'LOCAL MC BRIDGE FAILURE' -or $partial.local_monte_carlo_source_bars -ne 0 -or $partial.renderer_resize_failures -ne 0 -or $partial.renderer_present_failures -ne 0) {
        throw "A partial local research request did not fail closed while retaining the local scene: $($partial | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        packaged_local_monte_carlo = $true
        native_host = $true
        execution_uses_cargo = $false
        network_opened = $false
        importer = [pscustomobject]@{
            source_frames = $import.source_frames
            retained_completed_bars = $import.retained_completed_bars
            outcome = $import.outcome
        }
        native_research = [pscustomobject]@{
            chart_source = $native.chart_source
            research_kind = $native.local_monte_carlo_kind
            research_availability = $native.local_monte_carlo_availability
            source_bars = $native.local_monte_carlo_source_bars
            simulations = $native.local_monte_carlo_simulations
            horizon_bars = $native.local_monte_carlo_horizon_bars
            median_return_bps = $native.local_monte_carlo_median_return_bps
        }
        partial_request = [pscustomobject]@{
            chart_source = $partial.chart_source
            research_kind = $partial.local_monte_carlo_kind
            retained_local_scene = -not $partial.fixture_only -and $partial.fixture_candles -eq 2
        }
        native_host_diagnostics = $native
    } | ConvertTo-Json -Depth 5
}
finally {
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
