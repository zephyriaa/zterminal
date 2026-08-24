[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Fa-f0-9]{40}$')]
    [string]$CertificateThumbprint,
    [string]$InstallerPath = (Join-Path $PSScriptRoot '..\..\..\out\private-installer\ZTerminal-Private-Setup.exe')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$signTool = 'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe'
if (-not (Test-Path -LiteralPath $signTool -PathType Leaf)) {
    throw "The Windows signing tool is unavailable: $signTool"
}
if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    throw "The private installer does not exist: $InstallerPath"
}

$normalizedThumbprint = $CertificateThumbprint.Replace(' ', '').ToUpperInvariant()
$certificate = Get-ChildItem -Path "Cert:\CurrentUser\My\$normalizedThumbprint" -ErrorAction SilentlyContinue
if ($null -eq $certificate -or -not $certificate.HasPrivateKey -or $certificate.NotAfter -le [DateTime]::Now) {
    throw 'No usable unexpired code-signing certificate with a private key is installed in the current-user certificate store.'
}
$codeSigningUsage = $certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq '1.3.6.1.5.5.7.3.3' }
if ($null -eq $codeSigningUsage) {
    throw 'The selected certificate is not authorized for code signing.'
}

& $signTool sign /fd SHA256 /sha $normalizedThumbprint $InstallerPath
if ($LASTEXITCODE -ne 0) {
    throw "Signing failed with exit code $LASTEXITCODE."
}
$signature = Get-AuthenticodeSignature -FilePath $InstallerPath
if ($signature.Status -ne 'Valid') {
    throw "Signing verification failed: $($signature.Status)"
}

[pscustomobject]@{
    schema_version = 1
    installer = $InstallerPath
    signer = $certificate.Subject
    thumbprint = $certificate.Thumbprint
    signature_status = $signature.Status.ToString()
    timestamping_used = $false
    network_opened = $false
} | ConvertTo-Json -Depth 3
