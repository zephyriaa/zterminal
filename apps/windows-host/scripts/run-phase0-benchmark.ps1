[CmdletBinding()]
param(
    [ValidateRange(1, 50)]
    [int]$Runs = 20,

    [ValidateRange(1, 60)]
    [int]$SecondsPerRun = 10,

    [string]$ExecutablePath = (Join-Path $PSScriptRoot "..\..\..\out\windows-host\ZTerminalWindowsHost.exe")
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ExecutablePath)) {
    throw "Native host executable was not found: $ExecutablePath"
}

$diagnosticPath = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'
$measurements = @()

for ($run = 1; $run -le $Runs; $run += 1) {
    if (Test-Path $diagnosticPath) {
        Remove-Item -Force $diagnosticPath
    }

    $process = Start-Process -FilePath $ExecutablePath -ArgumentList "--benchmark-seconds=$SecondsPerRun" -PassThru -Wait
    if ($process.ExitCode -ne 0) {
        throw "Benchmark run $run exited with code $($process.ExitCode)."
    }
    if (-not (Test-Path $diagnosticPath)) {
        throw "Benchmark run $run did not create diagnostics at $diagnosticPath."
    }

    $measurement = Get-Content $diagnosticPath -Raw | ConvertFrom-Json
    $measurement | Add-Member -NotePropertyName run -NotePropertyValue $run
    $measurements += $measurement
}

function Get-Percentile([double[]]$Values, [double]$Percentile) {
    $ordered = @($Values | Sort-Object)
    if ($ordered.Count -eq 0) {
        return 0.0
    }
    $index = [Math]::Floor(($ordered.Count - 1) * $Percentile)
    return [double]$ordered[$index]
}

$launch = @($measurements | ForEach-Object { [double]$_.launch_to_visible_ms })
$frameP95 = @($measurements | ForEach-Object { [double]$_.frame_p95_ms })
$workingSet = @($measurements | ForEach-Object { [double]$_.working_set_bytes })
$privateUsage = @($measurements | ForEach-Object { [double]$_.private_usage_bytes })

$summary = [ordered]@{
    schema_version = 1
    benchmark = 'ZTerminal Native Phase 0 Windows host'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    runs = $Runs
    seconds_per_run = $SecondsPerRun
    adapter = @($measurements | Select-Object -ExpandProperty adapter -Unique)
    driver = @($measurements | Select-Object -ExpandProperty driver -Unique)
    feature_level = @($measurements | Select-Object -ExpandProperty feature_level -Unique)
    launch_to_visible_ms = [ordered]@{
        median = Get-Percentile $launch 0.5
        p95 = Get-Percentile $launch 0.95
    }
    frame_p95_ms = [ordered]@{
        median = Get-Percentile $frameP95 0.5
        worst = ($frameP95 | Measure-Object -Maximum).Maximum
    }
    working_set_bytes = [ordered]@{
        median = Get-Percentile $workingSet 0.5
        p95 = Get-Percentile $workingSet 0.95
    }
    private_usage_bytes = [ordered]@{
        median = Get-Percentile $privateUsage 0.5
        p95 = Get-Percentile $privateUsage 0.95
    }
    individual_runs = $measurements
}

$benchmarkDirectory = Join-Path $PSScriptRoot '..\benchmarks'
New-Item -ItemType Directory -Force -Path $benchmarkDirectory | Out-Null
$outputPath = Join-Path $benchmarkDirectory 'windows-phase0-summary.json'
$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $outputPath -Encoding utf8
Get-Content $outputPath -Raw
