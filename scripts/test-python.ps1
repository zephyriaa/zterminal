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
  if ($LASTEXITCODE -ne 0) { throw "Python 3.12 is required for the locked research test environment." }
}

& $pythonPath -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)"
if ($LASTEXITCODE -ne 0) { throw "The research environment must use Python 3.12. Recreate it with -Recreate after installing Python 3.12." }

& $pythonPath -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Updating pip failed." }
& $pythonPath -m pip install -r (Join-Path $repositoryRoot "research\desktop\requirements.lock") -r (Join-Path $repositoryRoot "research\api\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Installing locked Python requirements failed." }
& $pythonPath -m pip install pytest==8.4.2
if ($LASTEXITCODE -ne 0) { throw "Installing the Python test runner failed." }

$env:PYTHONPATH = "$(Join-Path $repositoryRoot 'research\desktop');$(Join-Path $repositoryRoot 'research\api')"
& $pythonPath -m unittest discover -s (Join-Path $repositoryRoot "research\desktop") -p "test_*.py"
if ($LASTEXITCODE -ne 0) { throw "Desktop Helper tests failed." }
& $pythonPath -m pytest -q (Join-Path $repositoryRoot "research\api\tests")
if ($LASTEXITCODE -ne 0) { throw "Research API tests failed." }
