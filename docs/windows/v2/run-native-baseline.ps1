param([Parameter(Mandatory=$true)][string]$Checkout, [string]$Evidence = "$PSScriptRoot/evidence/baseline")
$ErrorActionPreference = 'Stop'
$Evidence = [IO.Path]::GetFullPath($Evidence)
$env:BH_RECORD = '0'
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
Push-Location -LiteralPath $Checkout
try {
  npx.cmd tauri build --no-bundle --config src-tauri/tauri.workstation-test.conf.json *> (Join-Path $Evidence 'native-validation-build.log')
  if ($LASTEXITCODE -ne 0) { throw 'Validation executable build failed; see log.' }
  python scripts/test-workstation-browser.py --native *> (Join-Path $Evidence 'native-offline-restart.log')
  $nativeExit = $LASTEXITCODE
  if (Test-Path out/workstation-validation.png) { Copy-Item -LiteralPath out/workstation-validation.png -Destination (Join-Path $Evidence 'native-workstation.png') }
  @{exit=$nativeExit; status=$(if($nativeExit -eq 0){'PASS'}else{'FAIL'}); transport='Actual Tauri IPC; WebView network offline; OS process restart; separate validation storage'; recordings='off'} | ConvertTo-Json | Set-Content (Join-Path $Evidence 'native-result.json')
} finally {
  # Leave the release executable with the real product identifier after validation.
  npm.cmd run desktop:build *> (Join-Path $Evidence 'product-rebuild.log')
  $productExit=$LASTEXITCODE
  @{exit=$productExit;status=$(if($productExit -eq 0){'PASS'}else{'FAIL'})} | ConvertTo-Json | Set-Content (Join-Path $Evidence 'product-rebuild-result.json')
  Pop-Location
}
