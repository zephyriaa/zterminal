$ErrorActionPreference = 'Stop'
$r0Root = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$r0Evidence = Join-Path $r0Root 'out/renderer-r0'
$r0Executable = Join-Path $r0Root 'out/windows-host/Release/ZTerminalWindowsHost.exe'
$r0OriginalAppData = $env:LOCALAPPDATA
$r0Runs = @()
try {
    foreach ($r0Count in @(10000,100000)) {
        foreach ($r0Run in 1..20) {
            $r0RunRoot = Join-Path $r0Evidence "performance/$r0Count/$r0Run"
            New-Item -ItemType Directory -Force $r0RunRoot | Out-Null
            $env:LOCALAPPDATA = $r0RunRoot
            $r0Process = Start-Process -FilePath $r0Executable -ArgumentList "--fixture-candles=$r0Count --benchmark-seconds=2" -WindowStyle Hidden -PassThru
            if (-not $r0Process.WaitForExit(15000)) { $r0Process.Kill(); throw "Timeout: $r0Count/$r0Run" }
            if ($r0Process.ExitCode -ne 0) { throw "Exit $($r0Process.ExitCode): $r0Count/$r0Run" }
            $r0Diagnostic = Get-Content -Raw (Join-Path $r0RunRoot 'ZTerminal/logs/phase0-host-last.json') | ConvertFrom-Json
            if (-not $r0Diagnostic.fixture_only -or $r0Diagnostic.fixture_candles -ne $r0Count -or $r0Diagnostic.renderer_present_failures -ne 0) { throw "Unexpected diagnostic: $r0Count/$r0Run" }
            $r0Runs += [ordered]@{retained=$r0Count;run=$r0Run;visible=600;cache_condition= $(if($r0Run -eq 1){'first observed launch; OS cache not flushed'}else{'warm repeated launch'});diagnostic=$r0Diagnostic}
            Write-Output "completed retained=$r0Count sample=$r0Run"
        }
    }
    $r0Runs | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $r0Evidence 'performance-runs.json')
} finally { $env:LOCALAPPDATA = $r0OriginalAppData }
