param([string]$RuntimePath = "out/research-runtime", [string]$OutputPath = "out/private-helper-1.0.0-preview.2")
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot $RuntimePath))
$packageRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
if (-not $packageRoot.StartsWith(($repoRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'Output must remain within this repository.' }
if (Test-Path -LiteralPath $packageRoot) { throw 'Choose an unused package output directory; existing artifacts are preserved.' }
if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'python.exe'))) { throw 'Prepare the pinned embedded runtime first. See README.md.' }
$python = Join-Path $runtimeRoot 'python.exe'
$version = 'import platform,vectorbt; assert platform.python_version()=="3.12.10"; assert vectorbt.__version__=="0.28.1"; print("Windows x64 runtime verified")' | & $python -
if ($LASTEXITCODE -ne 0) { throw 'Pinned runtime verification failed.' }
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'app') -Force | Out-Null
Copy-Item -LiteralPath $runtimeRoot -Destination (Join-Path $packageRoot 'runtime') -Recurse
Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.py' | Where-Object { $_.Name -notlike 'test_*' } | Copy-Item -Destination (Join-Path $packageRoot 'app')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'requirements.lock'), (Join-Path $PSScriptRoot 'README.md'), (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.md'), (Join-Path $PSScriptRoot 'VECTORBT-LICENSE.md') -Destination $packageRoot
# Runtime paths are relative to the packaged interpreter, independent of a system Python.
[IO.File]::WriteAllText((Join-Path $packageRoot 'runtime/python312._pth'), "python312.zip`n.`nLib/site-packages`n../app`nimport site`n")
# Build a native Windows GUI launcher with the installed .NET Framework compiler.
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll "/out:$packageRoot/ZTerminalResearchHelper.exe" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
$manifest = Get-ChildItem -LiteralPath $packageRoot -File -Recurse | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.FullName.Substring($packageRoot.Length + 1).Replace('\','/') }
[IO.File]::WriteAllLines((Join-Path $packageRoot 'SHA256SUMS.txt'), $manifest)
$zip = $packageRoot + '.zip'
if (Test-Path -LiteralPath $zip) { throw 'Choose an unused ZIP output path; existing artifacts are preserved.' }
& tar.exe -a -c -f $zip -C (Split-Path -Parent $packageRoot) (Split-Path -Leaf $packageRoot)
if ($LASTEXITCODE -ne 0) { throw 'Private package compression failed.' }
Get-FileHash -LiteralPath $zip -Algorithm SHA256
