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

function Read-NativeDiagnostics {
    param([string]$DiagnosticPath)
    if (-not (Test-Path $DiagnosticPath)) { throw "Native host did not write diagnostics: $DiagnosticPath" }
    Get-Content -Raw $DiagnosticPath | ConvertFrom-Json
}

$workRoot = Join-Path $RepositoryRoot 'out\persistent-vertex-buffer-smoke'
$store = Join-Path $workRoot 'store'
$frames = Join-Path $workRoot 'TEST_ONLY_frames.ndjson'
$diagnostic = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'
Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $fixture = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments "--fixture-candles=10000 --benchmark-seconds=$BenchmarkSeconds" -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($fixture.exit_code -ne 0) { throw "Fixture buffer benchmark exited with code $($fixture.exit_code): $($fixture.stderr.Trim())" }
    $fixtureNative = Read-NativeDiagnostics -DiagnosticPath $diagnostic
    if (-not $fixtureNative.fixture_only -or $fixtureNative.chart_source -ne 'fixture' -or $fixtureNative.benchmark_unsynchronised_present -or $fixtureNative.renderer_vertex_buffer_uploads -lt 1 -or $fixtureNative.renderer_vertex_buffer_uploads -gt 2 -or $fixtureNative.renderer_retained_draw_reuses -lt 1 -or $fixtureNative.renderer_retained_draw_reuses -le $fixtureNative.renderer_vertex_buffer_uploads -or $fixtureNative.renderer_present_failures -ne 0) {
        throw "Fixture rendering did not retain and reuse a bounded vertex range under synchronized presentation: $($fixtureNative | ConvertTo-Json -Compress)"
    }

    $frameLines = 1..7 | ForEach-Object {
        '{{"e":"aggTrade","E":{0},"s":"BTCUSDT","a":{0},"p":"{1}.00","q":"1.000","T":{0},"m":false}}' -f $_, (100 + $_)
    }
    [System.IO.File]::WriteAllLines($frames, $frameLines, [System.Text.UTF8Encoding]::new($false))
    $capturedAtNs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $importArguments = @(
        '--provider=binance-spot-aggtrade', "--frame-file=$frames", "--root=$store", '--provider-symbol=btcusdt',
        '--symbol-id=1', '--price-scale=100', '--quantity-scale=1000', '--stream-id=7', '--interval-ns=1000000',
        '--maximum-bars=10', "--captured-at-ns=$capturedAtNs", '--access-time=9', '--flush'
    ) -join ' '
    $import = Invoke-BoundedProcess -FilePath $ImporterExecutable -Arguments $importArguments -TimeoutMilliseconds 10000
    if ($import.exit_code -ne 0) { throw "Offline importer exited with code $($import.exit_code): $($import.stderr.Trim())" }
    $importResult = $import.stdout | ConvertFrom-Json
    if ($importResult.network_opened -or $importResult.outcome -ne 'persisted' -or $importResult.retained_completed_bars -ne 6 -or $null -eq $importResult.segment) {
        throw "Test-only local import failed: $($importResult | ConvertTo-Json -Compress)"
    }

    Remove-Item $diagnostic -Force -ErrorAction SilentlyContinue
    $localArguments = @(
        "--local-root=$store", '--symbol-id=1', '--interval-ns=1000000', "--start-ns=$($importResult.segment.start_ns)",
        '--first-bar=0', '--visible-bars=2', '--freshness-budget-ns=60000000000', "--benchmark-seconds=$BenchmarkSeconds"
    ) -join ' '
    $local = Invoke-BoundedProcess -FilePath $HostExecutable -Arguments $localArguments -TimeoutMilliseconds (($BenchmarkSeconds + 15) * 1000)
    if ($local.exit_code -ne 0) { throw "Local scene buffer benchmark exited with code $($local.exit_code): $($local.stderr.Trim())" }
    $localNative = Read-NativeDiagnostics -DiagnosticPath $diagnostic
    if ($localNative.fixture_only -or $localNative.chart_source -ne 'local_scene' -or ($localNative.local_availability -ne 'LOCAL LIVE' -and $localNative.local_availability -ne 'LOCAL CACHED') -or $localNative.fixture_candles -ne 2 -or $localNative.local_total_bars -ne 6 -or $localNative.benchmark_unsynchronised_present -or $localNative.renderer_vertex_buffer_uploads -lt 1 -or $localNative.renderer_vertex_buffer_uploads -gt 2 -or $localNative.renderer_retained_draw_reuses -lt 1 -or $localNative.renderer_retained_draw_reuses -le $localNative.renderer_vertex_buffer_uploads -or $localNative.renderer_present_failures -ne 0) {
        throw "Verified local chart did not retain and reuse a bounded vertex range under synchronized presentation: $($localNative | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        execution_uses_cargo = $false
        network_opened = $false
        synchronized_present = $true
        fixture_diagnostic = [pscustomobject]@{
            vertex_buffer_uploads = $fixtureNative.renderer_vertex_buffer_uploads
            retained_draw_reuses = $fixtureNative.renderer_retained_draw_reuses
            present_failures = $fixtureNative.renderer_present_failures
        }
        verified_local_scene = [pscustomobject]@{
            test_only_offline_frames = $true
            chart_source = $localNative.chart_source
            vertex_buffer_uploads = $localNative.renderer_vertex_buffer_uploads
            retained_draw_reuses = $localNative.renderer_retained_draw_reuses
            retained_vertex_clears = $localNative.renderer_retained_vertex_clears
            present_failures = $localNative.renderer_present_failures
        }
    } | ConvertTo-Json -Depth 5
}
finally { Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue }
