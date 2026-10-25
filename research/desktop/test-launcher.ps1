$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$outputRoot = Join-Path $repoRoot 'artifacts/helper-redesign'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$kitRoot = Join-Path $repoRoot 'assets/branding/ZTerminal-Logo-Kit-v1'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe /main:LauncherChecks /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll "/resource:$kitRoot/brandmark/png/off-white/zterminal-mark-off-white-256.png,logo.png" "/resource:$kitRoot/desktop/windows/zterminal.ico,app.ico" "/out:$outputRoot/LauncherChecks.exe" (Join-Path $PSScriptRoot 'Launcher.cs') (Join-Path $PSScriptRoot 'LauncherChecks.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher check compilation failed.' }
& (Join-Path $outputRoot 'LauncherChecks.exe')
if ($LASTEXITCODE -ne 0) { throw 'Launcher checks failed.' }
