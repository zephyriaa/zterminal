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
    throw "Packaged offline importer executable was not found: $ImporterExecutable"
}

function Invoke-BoundedProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
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

$workRoot = Join-Path $RepositoryRoot 'out\local-scene-navigation-smoke'
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
        "--benchmark-seconds=$BenchmarkSeconds",
        '--diagnostic-local-navigation=end'
    ) -join ' '
    $hostProcess = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $hostArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($hostProcess.exit_code -ne 0 -or -not (Test-Path $diagnostic)) {
        throw "Native diagnostic navigation failed with exit code $($hostProcess.exit_code): $($hostProcess.stderr.Trim())"
    }
    $native = Get-Content -Raw $diagnostic | ConvertFrom-Json
    if ($native.fixture_only -or $native.chart_source -ne 'local_scene' -or ($native.local_availability -ne 'LOCAL LIVE' -and $native.local_availability -ne 'LOCAL CACHED') -or $native.fixture_candles -ne 2 -or $native.local_total_bars -ne 6 -or $native.local_first_bar -ne 4 -or $native.local_navigation_reloads -ne 1 -or $native.renderer_resize_failures -ne 0 -or $native.renderer_present_failures -ne 0) {
        throw "Native local paging did not render the expected verified scene: $($native | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        execution_uses_cargo = $false
        network_opened = $false
        diagnostic_navigation = 'end'
        importer = [pscustomobject]@{
            source_frames = $import.source_frames
            retained_completed_bars = $import.retained_completed_bars
            outcome = $import.outcome
        }
        native_host = $native
    } | ConvertTo-Json -Depth 5
}
finally {
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
