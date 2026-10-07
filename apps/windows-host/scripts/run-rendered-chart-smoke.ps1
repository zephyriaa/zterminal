[CmdletBinding()]
param(
    [string]$Executable = (Join-Path $PSScriptRoot '../../../out/windows-host/Release/ZTerminalWindowsHost.exe'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../../../out/rendered-chart-smoke')
)
$ErrorActionPreference = 'Stop'
$executablePath = (Resolve-Path -LiteralPath $Executable).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$testRoot = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path ([Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$originalLocalAppData = $env:LOCALAPPDATA
$results = @()
try {
    foreach ($case in @(
        @{name='default';arguments='';source='withheld'},
        @{name='missing-local-data';arguments="--local-root=$testRoot/absent --symbol-id=1 --interval-ns=1000000 --start-ns=0 --first-bar=0 --visible-bars=20 --freshness-budget-ns=10";source='withheld'},
        @{name='10000-candles';arguments='--fixture-candles=10000';source='fixture'},
        @{name='100000-candles';arguments='--fixture-candles=100000';source='fixture'},
        @{name='after-resize';arguments='--fixture-candles=10000 --benchmark-resize-once';source='fixture'}
    )) {
        $caseRoot = Join-Path $testRoot $case.name
        $env:LOCALAPPDATA = $caseRoot
        $process = Start-Process -FilePath $executablePath -ArgumentList "$($case.arguments) --benchmark-seconds=1 --benchmark-verify-pixels" -WindowStyle Hidden -PassThru
        if (-not $process.WaitForExit(15000)) { throw "Native check timed out: $($case.name)" }
        if ($process.ExitCode -ne 0) { throw "Native check failed: $($case.name), exit $($process.ExitCode)" }
        $native = Get-Content (Join-Path $caseRoot 'ZTerminal/logs/phase0-host-last.json') -Raw | ConvertFrom-Json
        if ($native.chart_source -ne $case.source -or $native.renderer_resize_failures -ne 0 -or $native.renderer_present_failures -ne 0) { throw "Unexpected renderer state: $($case.name)" }
        if ($case.source -eq 'fixture' -and ($null -eq $native.verified_chart_pixels -or $native.verified_chart_pixels -lt 1000)) { throw "Draw/Present produced no visible candles: $($case.name)" }
        if ($case.source -eq 'withheld' -and ($native.fixture_only -or $native.fixture_candles -ne 0)) { throw "Unavailable data was fabricated: $($case.name)" }
        if ($case.name -eq 'after-resize' -and $native.renderer_resize_successes -lt 1) { throw 'Resize was not exercised' }
        $results += @{name=$case.name;diagnostic=$native}
    }
    $results | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $testRoot 'results.json')
    Write-Output "Native rendered-pixel and unavailable-data checks passed. Evidence: $testRoot/results.json"
} finally {
    $env:LOCALAPPDATA = $originalLocalAppData
}
