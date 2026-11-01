param([int]$Runs=20,[string]$OutputDirectory='')
$ErrorActionPreference='Stop'
$r1Root=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$r1Evidence=if($OutputDirectory){[System.IO.Path]::GetFullPath($OutputDirectory)}else{Join-Path $r1Root ('out/renderer-r1/performance/'+[Guid]::NewGuid().ToString('N'))}
$r1Exe=Join-Path $r1Root 'out/windows-host/Release/ZTerminalWindowsHost.exe'
$r1OriginalLocal=$env:LOCALAPPDATA
$r1Samples=@()
try {
    foreach($retained in @(10000,100000)) {
        foreach($visible in @(600,2000)) {
            foreach($sample in 1..$Runs) {
                $runRoot=Join-Path $r1Evidence "$retained-$visible/$sample"
                New-Item -ItemType Directory -Force $runRoot | Out-Null
                $env:LOCALAPPDATA=$runRoot
                $process=Start-Process -FilePath $r1Exe -ArgumentList "--fixture-candles=$retained --benchmark-visible=$visible --benchmark-seconds=1" -WindowStyle Hidden -PassThru
                if(-not $process.WaitForExit(15000)){ $process.Kill(); throw 'Benchmark timeout' }
                if($process.ExitCode -ne 0){throw "Benchmark exited $($process.ExitCode)"}
                $d=Get-Content (Join-Path $runRoot 'ZTerminal/logs/phase0-host-last.json') -Raw | ConvertFrom-Json
                if(-not $d.fixture_only -or $d.visible_candles -ne $visible -or $d.renderer_present_failures -ne 0){throw 'Unexpected native benchmark state'}
                $r1Samples+=@{retained=$retained;visible=$visible;run=$sample;condition='fresh process; hidden; OS caches not flushed; static geometry; render plus Present only';diagnostic=$d}
            }
            $r1Samples | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $r1Evidence 'runs.json')
            Write-Output "Completed $Runs samples retained=$retained visible=$visible"
        }
    }
} finally {$env:LOCALAPPDATA=$r1OriginalLocal}
