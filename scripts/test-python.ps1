param([switch]$Recreate)
. "$PSScriptRoot/dev-environment.ps1"
$environmentPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot '.venv-research'))
if (-not $environmentPath.StartsWith(($repositoryRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
  throw 'The Python environment must stay within the repository.'
}
if ($Recreate -and (Test-Path -LiteralPath $environmentPath)) {
  Remove-Item -LiteralPath $environmentPath -Recurse -Force
}
if (-not (Test-Path -LiteralPath '.venv-research/Scripts/python.exe')) {
  Invoke-DevCommand 'py' @('-3.12', '-m', 'venv', '.venv-research')
}
Invoke-DevCommand '.\.venv-research\Scripts\python.exe' @('-m', 'pip', 'install', '-r', 'research/requirements-dev.txt')
if (-not (Test-Path -LiteralPath 'out/research-runtime/python.exe')) { & "$PSScriptRoot/prepare-helper.ps1" }
if (-not (Test-Path -LiteralPath '.venv-event/Scripts/python.exe')) {
  Invoke-DevCommand 'py' @('-3.12', '-m', 'venv', '.venv-event')
}
Invoke-DevCommand '.\.venv-event\Scripts\python.exe' @('-m', 'pip', 'install', '-r', 'research/desktop/requirements-event.in')
& "$PSScriptRoot/check-dev.ps1" -Component Python
