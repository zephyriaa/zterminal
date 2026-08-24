[CmdletBinding()]
param(
    [string]$Executable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-direct-public-ingest.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Executable)) {
    throw "Packaged direct-ingestion executable was not found: $Executable"
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $Executable
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardError = $true
$startInfo.RedirectStandardOutput = $true
$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
if (-not $process.Start()) {
    throw 'Could not start the packaged direct-ingestion guard process.'
}

$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
if (-not $process.WaitForExit(10000)) {
    $process.Kill()
    throw 'Empty direct-ingestion request did not terminate within 10 seconds.'
}
if ($process.ExitCode -ne 2 -or $stderr -notmatch 'missing required argument: --provider') {
    throw "Packaged empty-request guard failed: exit=$($process.ExitCode), stdout=$stdout, stderr=$stderr"
}

[pscustomobject]@{
    schema_version = 1
    packaged_executable = $true
    arguments_supplied = 0
    provider_connection_attempted = $false
    network_opened = $false
    expected_exit_code = 2
    observed_exit_code = $process.ExitCode
    diagnostic = $stderr.Trim()
} | ConvertTo-Json -Depth 3
