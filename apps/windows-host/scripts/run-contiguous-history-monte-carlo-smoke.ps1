param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$ImporterExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-offline-provider-import.exe'),
    [string]$MonteCarloExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-local-monte-carlo.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ImporterExecutable)) { throw "Packaged offline importer was not found: $ImporterExecutable" }
if (-not (Test-Path $MonteCarloExecutable)) { throw "Packaged local Monte Carlo sidecar was not found: $MonteCarloExecutable" }

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

function Invoke-HistoryMonteCarlo {
    param([string]$StoreRoot, [uint64]$StartNs, [int]$HistorySegments)
    $arguments = @(
        '--root', $StoreRoot, '--symbol-id', '1', '--interval-ns', '1000000', '--start-ns', $StartNs,
        '--now-ns', ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000),
        '--freshness-budget-ns', '60000000000', '--simulations', '32', '--horizon-bars', '4', '--seed', '7',
        '--history-segments', $HistorySegments
    ) -join ' '
    Invoke-BoundedProcess -FilePath $MonteCarloExecutable -Arguments $arguments -TimeoutMilliseconds 10000
}

$workRoot = Join-Path $RepositoryRoot 'out\contiguous-history-monte-carlo-smoke'
$contiguousStore = Join-Path $workRoot 'contiguous-store'
$gapStore = Join-Path $workRoot 'gap-store'
Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $guard = Invoke-BoundedProcess -FilePath $MonteCarloExecutable -Arguments '--history-segments 0' -TimeoutMilliseconds 10000
    if ($guard.exit_code -ne 2 -or $guard.stderr -notmatch 'missing required argument: --root') {
        throw "Monte Carlo parser guard did not reject before local reading: $($guard | ConvertTo-Json -Compress)"
    }

    $first = Import-TestOnlySegment -OffsetMilliseconds 0 -FrameFile (Join-Path $workRoot 'TEST_ONLY_contiguous_first.ndjson') -StoreRoot $contiguousStore
    $second = Import-TestOnlySegment -OffsetMilliseconds 6 -FrameFile (Join-Path $workRoot 'TEST_ONLY_contiguous_second.ndjson') -StoreRoot $contiguousStore
    if ([uint64]$second.segment.start_ns -ne ([uint64]$first.segment.start_ns + 6000000)) {
        throw 'The test-only segment fixtures are not exactly contiguous at the declared bar interval.'
    }
    $completeProcess = Invoke-HistoryMonteCarlo -StoreRoot $contiguousStore -StartNs ([uint64]$first.segment.start_ns) -HistorySegments 2
    if ($completeProcess.exit_code -ne 0) { throw "Contiguous local history command exited with code $($completeProcess.exit_code): $($completeProcess.stderr.Trim())" }
    $complete = $completeProcess.stdout | ConvertFrom-Json
    if ($complete.kind -ne 'complete' -or $complete.network_opened -or $complete.source_segments -ne 2 -or $complete.source_bars -ne 12 -or $complete.source_returns -ne 11 -or $complete.simulations -ne 32 -or $complete.horizon_bars -ne 4 -or $complete.seed -ne 7) {
        throw "Contiguous local history did not produce the bounded aggregate result: $($complete | ConvertTo-Json -Compress)"
    }

    $gapFirst = Import-TestOnlySegment -OffsetMilliseconds 0 -FrameFile (Join-Path $workRoot 'TEST_ONLY_gap_first.ndjson') -StoreRoot $gapStore
    $null = Import-TestOnlySegment -OffsetMilliseconds 100 -FrameFile (Join-Path $workRoot 'TEST_ONLY_gap_second.ndjson') -StoreRoot $gapStore
    $gapProcess = Invoke-HistoryMonteCarlo -StoreRoot $gapStore -StartNs ([uint64]$gapFirst.segment.start_ns) -HistorySegments 2
    if ($gapProcess.exit_code -ne 0) { throw "Gapped local history command exited with code $($gapProcess.exit_code): $($gapProcess.stderr.Trim())" }
    $gap = $gapProcess.stdout | ConvertFrom-Json
    if ($gap.kind -ne 'withheld' -or $gap.network_opened -or $gap.availability -ne 'gap' -or $gap.reason -ne 'cross_segment_gap' -or $gap.retained_bars -ne 6) {
        throw "Gapped local history was not truthfully withheld: $($gap | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        packaged_local_monte_carlo = $true
        execution_uses_cargo = $false
        network_opened = $false
        parser_guard = [pscustomobject]@{ exit_code = $guard.exit_code; rejected_before_local_read = $true }
        contiguous_history = [pscustomobject]@{
            source_segments = $complete.source_segments
            source_bars = $complete.source_bars
            source_returns = $complete.source_returns
            simulations = $complete.simulations
            horizon_bars = $complete.horizon_bars
            seed = $complete.seed
            continuity_proven = $true
        }
        cross_segment_gap = [pscustomobject]@{
            availability = $gap.availability
            reason = $gap.reason
            retained_bars = $gap.retained_bars
            result_withheld = $true
        }
    } | ConvertTo-Json -Depth 5
}
finally { Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue }
