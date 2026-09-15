param(
  [switch]$Recreate
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot ".venv-research"
$pythonPath = Join-Path $environmentPath "Scripts\python.exe"

if ($Recreate -and (Test-Path -LiteralPath $environmentPath)) {
  Remove-Item -LiteralPath $environmentPath -Recurse -Force
}

if (-not (Test-Path -LiteralPath $pythonPath)) {
  & py -3.12 -m venv $environmentPath
}

& $pythonPath -m pip install --upgrade pip
& $pythonPath -m pip install -r (Join-Path $repositoryRoot "research\desktop\requirements.txt") -r (Join-Path $repositoryRoot "research\api\requirements.txt")

$env:PYTHONPATH = "$(Join-Path $repositoryRoot 'research\desktop');$(Join-Path $repositoryRoot 'research\api')"
& $pythonPath -m unittest discover -s (Join-Path $repositoryRoot "research\desktop") -p "test_*.py"
& $pythonPath -m unittest discover -s (Join-Path $repositoryRoot "research\api\tests") -p "test_*.py"
