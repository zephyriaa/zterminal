# Run from a normal PowerShell session with npm registry access.
# REA setup backs up existing settings, pins its MCP package version, and
# installs matching workflow instructions. It does not install native engines.
$ErrorActionPreference = 'Stop'

Get-Command node, npx.cmd -ErrorAction Stop | Out-Null

& npx.cmd --yes rea-agents@latest setup --client codex --yes
if ($LASTEXITCODE -ne 0) {
    throw "REA setup failed (exit $LASTEXITCODE). Check registry access and the setup diagnostics."
}

Write-Host 'REA setup finished. Restart Codex to load the MCP server and workflow instructions.'
Write-Host 'Readiness check: npx --yes rea-agents@latest doctor --client codex --skill --json'
