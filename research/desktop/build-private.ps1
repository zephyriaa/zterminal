param([string]$RuntimePath = "out/research-runtime", [string]$OutputPath = "out/zterminal-helper-1.0.0-preview.4-windows-x64")
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
# Native parallel copying avoids spending minutes on tens of thousands of runtime files.
& robocopy.exe $runtimeRoot (Join-Path $packageRoot 'runtime') /E /MT:8 /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD __pycache__ /XF *.pyc
if ($LASTEXITCODE -ge 8) { throw "Runtime copy failed with robocopy exit code $LASTEXITCODE." }
# Keep native-workstation research entry points out of the browser Helper package.
@('analytics.py', 'archive.py', 'child.py', 'controller.py', 'engine.py', 'process_limits.py', 'server.py', 'validation.py', 'zterminal.py') | ForEach-Object { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $_) -Destination (Join-Path $packageRoot 'app') }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'requirements.lock'), (Join-Path $PSScriptRoot 'README.md'), (Join-Path $PSScriptRoot 'LICENSE.txt'), (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.md'), (Join-Path $PSScriptRoot 'VECTORBT-LICENSE.md') -Destination $packageRoot
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'docs/licenses') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/licenses/MIT-legacy.txt') -Destination (Join-Path $packageRoot 'docs/licenses')
# Runtime paths are relative to the packaged interpreter, independent of a system Python.
[IO.File]::WriteAllText((Join-Path $packageRoot 'runtime/python312._pth'), "python312.zip`n.`nLib/site-packages`n../app`nimport site`n")
# Build a native Windows GUI launcher with the installed .NET Framework compiler.
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll "/win32manifest:$PSScriptRoot/launcher.manifest" "/resource:$repoRoot/public/landing/zterminal-logo-mark.png,logo.png" "/out:$packageRoot/ZTerminalResearchHelper.exe" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
$manifestScript = @"
import hashlib
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
root = Path(sys.argv[1])
def checksum_line(path):
    with path.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    return checksum + '  ' + path.relative_to(root).as_posix()
paths = sorted(path for path in root.rglob('*') if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc' and path != root / 'SHA256SUMS.txt')
with ThreadPoolExecutor(max_workers=8) as pool:
    lines = list(pool.map(checksum_line, paths))
(root / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
"@
& $python -B -c $manifestScript $packageRoot
if ($LASTEXITCODE -ne 0) { throw 'Package checksum generation failed.' }
$zip = $packageRoot + '.zip'
if (Test-Path -LiteralPath $zip) { throw 'Choose an unused ZIP output path; existing artifacts are preserved.' }
& tar.exe -a -c -f $zip --exclude=__pycache__ --exclude=*.pyc -C (Split-Path -Parent $packageRoot) (Split-Path -Leaf $packageRoot)
if ($LASTEXITCODE -ne 0) { throw 'Private package compression failed.' }
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($zip + '.sha256'), "$hash  $([IO.Path]::GetFileName($zip))`n")
Get-FileHash -LiteralPath $zip -Algorithm SHA256
