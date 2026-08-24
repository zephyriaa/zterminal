param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$ImporterExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-offline-provider-import.exe'),
    [string]$CatalogExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-local-segment-catalog.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ImporterExecutable)) {
    throw "Packaged offline importer was not found: $ImporterExecutable"
}
if (-not (Test-Path $CatalogExecutable)) {
    throw "Packaged local segment catalog sidecar was not found: $CatalogExecutable"
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

$workRoot = Join-Path $RepositoryRoot 'out\local-segment-catalog-smoke'
$store = Join-Path $workRoot 'store'
$framesA = Join-Path $workRoot 'TEST_ONLY_frames_a.ndjson'
$framesB = Join-Path $workRoot 'TEST_ONLY_frames_b.ndjson'

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $missingArguments = Invoke-BoundedProcess -FilePath $CatalogExecutable -Arguments '' -TimeoutMilliseconds 10000
    if ($missingArguments.exit_code -ne 2 -or $missingArguments.stderr -notmatch 'missing required argument: --root') {
        throw "Catalog missing-argument guard did not terminate before local reading: $($missingArguments | ConvertTo-Json -Compress)"
    }

    $segmentA = Import-TestOnlySegment -OffsetMilliseconds 0 -FrameFile $framesA -StoreRoot $store
    $segmentB = Import-TestOnlySegment -OffsetMilliseconds 100 -FrameFile $framesB -StoreRoot $store
    if ($segmentA.segment.start_ns -eq $segmentB.segment.start_ns) {
        throw 'Test-only offline imports did not create distinct immutable local segment starts.'
    }

    $catalogArguments = @(
        '--root',
        $store,
        '--symbol-id',
        '1',
        '--interval-ns',
        '1000000',
        '--maximum-entries',
        '8'
    ) -join ' '
    $catalogProcess = Invoke-BoundedProcess -FilePath $CatalogExecutable -Arguments $catalogArguments -TimeoutMilliseconds 10000
    if ($catalogProcess.exit_code -ne 0) {
        throw "The packaged local catalog sidecar exited with code $($catalogProcess.exit_code): $($catalogProcess.stderr.Trim())"
    }
    $catalog = $catalogProcess.stdout | ConvertFrom-Json
    if ($catalog.schema_version -ne 1 -or $catalog.kind -ne 'catalog' -or $catalog.layout -ne 'available' -or $catalog.truncated -or $catalog.malformed_metadata_entries -ne 0 -or $catalog.missing_payload_entries -ne 0 -or $catalog.corrupt_payload_entries -ne 0 -or @($catalog.entries).Count -ne 2 -or $catalog.entries[0].start_ns -ge $catalog.entries[1].start_ns -or $catalog.entries[0].data_status -ne 'live' -or $catalog.entries[1].data_status -ne 'live') {
        throw "The packaged local catalog did not meet the bounded immutable-record contract: $($catalog | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        test_only_offline_frames = $true
        packaged_importer = $true
        packaged_local_segment_catalog = $true
        execution_uses_cargo = $false
        network_opened = $false
        missing_argument_guard = [pscustomobject]@{
            exit_code = $missingArguments.exit_code
            rejected_before_local_read = $true
        }
        imported_segments = [pscustomobject]@{
            count = 2
            retained_completed_bars_per_segment = $segmentA.retained_completed_bars
        }
        catalog = [pscustomobject]@{
            entry_count = @($catalog.entries).Count
            truncated = $catalog.truncated
            malformed_metadata_entries = $catalog.malformed_metadata_entries
            missing_payload_entries = $catalog.missing_payload_entries
            corrupt_payload_entries = $catalog.corrupt_payload_entries
            ordered = $catalog.entries[0].start_ns -lt $catalog.entries[1].start_ns
        }
    } | ConvertTo-Json -Depth 5
}
finally {
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
