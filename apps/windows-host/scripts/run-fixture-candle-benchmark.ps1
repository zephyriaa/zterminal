[CmdletBinding()]
param(
    [ValidateSet(10000, 100000)]
    [int]$FixtureCandles,

    [ValidateRange(1, 60)]
    [int]$Seconds = 5,

    [string]$ExecutablePath = (Join-Path $PSScriptRoot "..\..\..\out\windows-host\ZTerminalWindowsHost.exe")
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ExecutablePath)) {
    throw "Native host executable was not found: $ExecutablePath"
}

$diagnosticPath = Join-Path $env:LOCALAPPDATA 'ZTerminal\logs\phase0-host-last.json'
if (Test-Path $diagnosticPath) {
    Remove-Item -Force $diagnosticPath
}

$process = Start-Process -FilePath $ExecutablePath -ArgumentList "--fixture-candles=$FixtureCandles", "--benchmark-seconds=$Seconds" -PassThru -Wait
if ($process.ExitCode -ne 0) {
    throw "Native fixture-candle benchmark exited with code $($process.ExitCode)."
}
if (-not (Test-Path $diagnosticPath)) {
    throw "Expected fixture-candle diagnostics at $diagnosticPath."
}

$benchmarkDirectory = Join-Path $PSScriptRoot '..\benchmarks'
New-Item -ItemType Directory -Force -Path $benchmarkDirectory | Out-Null
$outputPath = Join-Path $benchmarkDirectory "windows-fixture-candles-$FixtureCandles.json"
Get-Content $diagnosticPath -Raw | Set-Content -Path $outputPath -Encoding utf8
Get-Content $outputPath -Raw
