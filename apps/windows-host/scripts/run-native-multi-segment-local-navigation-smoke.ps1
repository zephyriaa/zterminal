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

function Import-TestOnlySegment {
    param(
        [Parameter(Mandatory = $true)]
        [int]$OffsetMilliseconds,
        [Parameter(Mandatory = $true)]
        [string]$FrameFile,
        [Parameter(Mandatory = $true)]
        [string]$StoreRoot
    )

    $frameLines = 1..7 | ForEach-Object {
        $timestamp = $OffsetMilliseconds + $_
        '{{"e":"aggTrade","E":{0},"s":"BTCUSDT","a":{0},"p":"{1}.00","q":"1.000","T":{0},"m":false}}' -f $timestamp, (100 + $timestamp)
    }
    [System.IO.File]::WriteAllLines($FrameFile, $frameLines, [System.Text.UTF8Encoding]::new($false))
    $capturedAtNs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $importArguments = @(
        '--provider=binance-spot-aggtrade',
        "--frame-file=$FrameFile",
        "--root=$StoreRoot",
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
    return $import
}

$workRoot = Join-Path $RepositoryRoot 'out\native-multi-segment-navigation-smoke'
$store = Join-Path $workRoot 'store'
$framesA = Join-Path $workRoot 'TEST_ONLY_frames_a.ndjson'
$framesB = Join-Path $workRoot 'TEST_ONLY_frames_b.ndjson'
$diagnostic = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $segmentA = Import-TestOnlySegment -OffsetMilliseconds 0 -FrameFile $framesA -StoreRoot $store
    $segmentB = Import-TestOnlySegment -OffsetMilliseconds 100 -FrameFile $framesB -StoreRoot $store
    $starts = @([uint64]$segmentA.segment.start_ns, [uint64]$segmentB.segment.start_ns) | Sort-Object
    if ($starts.Count -ne 2 -or $starts[0] -eq $starts[1]) {
        throw 'Test-only offline imports did not create two distinct ordered immutable local segments.'
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $hostArguments = @(
        "--local-root=$store",
        '--symbol-id=1',
        '--interval-ns=1000000',
        "--start-ns=$($starts[0])",
        '--first-bar=0',
        '--visible-bars=2',
        '--freshness-budget-ns=60000000000',
        "--benchmark-seconds=$BenchmarkSeconds",
        '--diagnostic-local-navigation=next-segment'
    ) -join ' '
    $hostProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $hostArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($hostProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native multi-segment navigation failed with exit code $($hostProcess.exit_code): $($hostProcess.stderr.Trim())"
    }
    $native = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($native.fixture_only -or $native.chart_source -ne 'local_scene' -or ($native.local_availability -ne 'LOCAL LIVE' -and $native.local_availability -ne 'LOCAL CACHED') -or $native.fixture_candles -ne 2 -or $native.local_total_bars -ne 6 -or $native.local_first_bar -ne 0 -or $native.local_navigation_reloads -ne 2 -or $native.local_segment_switches -ne 1 -or $native.local_history_diagnostic -ne 'LOCAL SEGMENT SWITCHED | CONTINUITY NOT ASSERTED' -or $native.local_monte_carlo_kind -ne 'RESEARCH NOT REQUESTED' -or $native.renderer_resize_failures -ne 0 -or $native.renderer_present_failures -ne 0) {
        throw "Native multi-segment local navigation did not meet the bounded catalog contract: $($native | ConvertTo-Json -Compress)"
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $noNeighborArguments = @(
        "--local-root=$store",
        '--symbol-id=1',
        '--interval-ns=1000000',
        "--start-ns=$($starts[1])",
        '--first-bar=0',
        '--visible-bars=2',
        '--freshness-budget-ns=60000000000',
        "--benchmark-seconds=$BenchmarkSeconds",
        '--diagnostic-local-navigation=next-segment'
    ) -join ' '
    $noNeighborProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $noNeighborArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($noNeighborProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native no-neighbor boundary handling failed with exit code $($noNeighborProcess.exit_code): $($noNeighborProcess.stderr.Trim())"
    }
    $noNeighbor = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($noNeighbor.fixture_only -or $noNeighbor.chart_source -ne 'local_scene' -or ($noNeighbor.local_availability -ne 'LOCAL LIVE' -and $noNeighbor.local_availability -ne 'LOCAL CACHED') -or $noNeighbor.fixture_candles -ne 2 -or $noNeighbor.local_first_bar -ne 4 -or $noNeighbor.local_navigation_reloads -ne 1 -or $noNeighbor.local_segment_switches -ne 0 -or $noNeighbor.local_history_diagnostic -ne 'NO LATER LOCAL SEGMENT' -or $noNeighbor.renderer_resize_failures -ne 0 -or $noNeighbor.renderer_present_failures -ne 0) {
        throw "The no-neighbor boundary did not retain its verified local chart fail-closed: $($noNeighbor | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        packaged_local_segment_catalog = $true
        native_host = $true
        execution_uses_cargo = $false
        network_opened = $false
        imported_segments = [pscustomobject]@{
            count = 2
            retained_completed_bars_per_segment = $segmentA.retained_completed_bars
        }
        native_navigation = [pscustomobject]@{
            requested_start_ns = $starts[0]
            selected_adjacent_start_ns = $starts[1]
            active_first_bar = $native.local_first_bar
            local_navigation_reloads = $native.local_navigation_reloads
            local_segment_switches = $native.local_segment_switches
            continuity_claimed = $false
            research_carried_forward = $false
        }
        no_neighbor_boundary = [pscustomobject]@{
            chart_source = $noNeighbor.chart_source
            active_first_bar = $noNeighbor.local_first_bar
            local_segment_switches = $noNeighbor.local_segment_switches
            diagnostic = $noNeighbor.local_history_diagnostic
            retained_local_scene = -not $noNeighbor.fixture_only -and $noNeighbor.fixture_candles -eq 2
        }
        native_host_diagnostics = $native
    } | ConvertTo-Json -Depth 5
}
finally {
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
