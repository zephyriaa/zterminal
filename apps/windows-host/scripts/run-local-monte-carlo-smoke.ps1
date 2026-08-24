param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$ImporterExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-offline-provider-import.exe'),
    [string]$MonteCarloExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-local-monte-carlo.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ImporterExecutable)) {
    throw "Packaged offline importer was not found: $ImporterExecutable"
}
if (-not (Test-Path $MonteCarloExecutable)) {
    throw "Packaged local Monte Carlo sidecar was not found: $MonteCarloExecutable"
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

$workRoot = Join-Path $RepositoryRoot 'out\local-monte-carlo-smoke'
$frames = Join-Path $workRoot 'TEST_ONLY_binance_aggregate_frames.ndjson'
$store = Join-Path $workRoot 'store'

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $missingArguments = Invoke-BoundedProcess -FilePath $MonteCarloExecutable -Arguments '' -TimeoutMilliseconds 10000
    if ($missingArguments.exit_code -ne 2 -or $missingArguments.stderr -notmatch 'missing required argument: --root') {
        throw "Local Monte Carlo missing-argument guard did not terminate before local reading: $($missingArguments | ConvertTo-Json -Compress)"
    }

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

    $nowNs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $researchArguments = @(
        '--root',
        $store,
        '--symbol-id',
        '1',
        '--interval-ns',
        '1000000',
        '--start-ns',
        "$($import.segment.start_ns)",
        '--now-ns',
        "$nowNs",
        '--freshness-budget-ns',
        '60000000000',
        '--simulations',
        '32',
        '--horizon-bars',
        '8',
        '--seed',
        '7'
    ) -join ' '
    $researchProcess = Invoke-BoundedProcess -FilePath $MonteCarloExecutable -Arguments $researchArguments -TimeoutMilliseconds 10000
    if ($researchProcess.exit_code -ne 0) {
        throw "The packaged local Monte Carlo sidecar exited with code $($researchProcess.exit_code): $($researchProcess.stderr.Trim())"
    }
    $research = $researchProcess.stdout | ConvertFrom-Json
    if ($research.schema_version -ne 1 -or $research.kind -ne 'complete' -or ($research.availability -ne 'live' -and $research.availability -ne 'cached') -or $research.algorithm_version -ne 1 -or $research.seed -ne 7 -or $research.source_bars -ne 6 -or $research.source_returns -ne 5 -or $research.simulations -ne 32 -or $research.horizon_bars -ne 8 -or $null -eq $research.minimum_return_bps -or $null -eq $research.p05_return_bps -or $null -eq $research.median_return_bps -or $null -eq $research.p95_return_bps -or $null -eq $research.maximum_return_bps -or $null -eq $research.mean_return_bps) {
        throw "The packaged local Monte Carlo result did not meet the bounded local contract: $($research | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        packaged_local_monte_carlo = $true
        execution_uses_cargo = $false
        network_opened = $false
        missing_argument_guard = [pscustomobject]@{
            exit_code = $missingArguments.exit_code
            rejected_before_local_read = $true
        }
        importer = [pscustomobject]@{
            source_frames = $import.source_frames
            retained_completed_bars = $import.retained_completed_bars
            outcome = $import.outcome
        }
        research = $research
    } | ConvertTo-Json -Depth 5
}
finally {
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
