param([Parameter(Mandatory=$true)][string]$Checkout, [string]$Evidence = "$PSScriptRoot/evidence/baseline")
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
$Evidence = [IO.Path]::GetFullPath($Evidence)
$checks = @(
  @('install', 'npm.cmd', @('ci')),
  @('generate-client', 'npm.cmd', @('run','db:generate')),
  @('domain', 'cargo', @('test','--locked','-p','zt-domain')),
  @('local-core', 'cargo', @('test','--locked','--manifest-path','src-tauri/workstation-core/Cargo.toml')),
  @('web-tests', 'npm.cmd', @('test')),
  @('typecheck', 'npm.cmd', @('run','typecheck')),
  @('lint', 'npm.cmd', @('run','lint')),
  @('web-build', 'npm.cmd', @('run','build')),
  @('desktop-build', 'npm.cmd', @('run','desktop:build')),
  @('command-origin', 'cargo', @('test','--locked','--manifest-path','src-tauri/Cargo.toml','--release','--lib'))
)
Push-Location -LiteralPath $Checkout
try {
  $results = @()
  foreach ($check in $checks) {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $name = $check[0]; $program = $check[1]; $arguments = $check[2]
    & $program @arguments *> (Join-Path $Evidence "$name.log")
    $exit = $LASTEXITCODE
    $timer.Stop()
    $results += [pscustomobject]@{check=$name; command="$program $($arguments -join ' ')"; exit=$exit; status=$(if($exit -eq 0){'PASS'}else{'FAIL'}); seconds=[Math]::Round($timer.Elapsed.TotalSeconds,2); log="$name.log"}
    $results | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Evidence 'results.json')
    Write-Output "$name : $($results[-1].status) ($($results[-1].seconds)s)"
    if ($name -eq 'install' -and $exit -ne 0) { break }
  }
} finally { Pop-Location }
