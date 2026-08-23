# Internal Test Signing for the Hosted ZTerminal Workstation Preview

## Purpose and scope

This runbook describes an **internal test-only** signing path for the hosted ZTerminal workstation preview in Track A. It exists solely to check that the private Actions artifact can carry and verify a self-signed Authenticode signature in a controlled test environment. The preview loads the verified deployed `/terminal` workstation and requires an online connection; it is not the future local-first Track B client.

> A self-signed certificate is not a public software-signing identity. A test-signed artifact must never be described as an official ZTerminal installer, uploaded to a release, linked from the website, published through Render, copied to object storage or a CDN, or used by an updater.

The production Windows client, production signer, updater, release record, configuration plane, and public download experience remain Track B work. The existing unsigned dry-build workflow remains the ordinary private packaging proof and is not changed by this runbook.

## Protected GitHub environment

The workflow uses the GitHub environment named `internal-test-signing`. It is deliberately constrained to the `main` branch and requires review by the repository maintainer before the signing job receives environment-scoped secrets.

| Control | Required state |
|---|---|
| Workflow trigger | Manual dispatch only |
| Reviewed ref | Exactly `main` |
| Explicit operator acknowledgement | `confirm_internal_test_signing=true` |
| Environment | `internal-test-signing` |
| Environment access | Maintainer review required; `main` branch only |
| Artifact retention | 14 days in private GitHub Actions storage |
| Publication | Forbidden: no GitHub Release, website route, Render configuration, CDN/object storage, or updater |

Do not place the test PFX or its password in repository secrets, committed files, issues, chat, or documentation. Store both only as environment secrets on `internal-test-signing`.

## Generate a disposable test certificate on a controlled Windows machine

Generate this certificate only on a controlled Windows machine owned by the project. It must be used only for this test workflow, with a short expiration and no public-distribution purpose.

```powershell
$certificate = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=ZTerminal Internal Test Only" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddDays(30)

$password = Read-Host "Choose a strong one-time PFX password" -AsSecureString
$pfxPath = Join-Path $env:USERPROFILE "Desktop\zterminal-internal-test-signing.pfx"
Export-PfxCertificate -Cert "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -FilePath $pfxPath -Password $password | Out-Null

[Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath)) | Set-Clipboard
Write-Host "The base64 PFX is on the clipboard. Add it as the protected environment secret, then remove the PFX from the desktop when finished."
```

The project maintainer must retain the certificate thumbprint in an internal inventory and remove the certificate and exported PFX when Track A testing ends. Do not import this certificate into end-user trust stores. The Actions runner temporarily trusts its public certificate only to verify the test signature during the isolated run; that trust entry is removed before the job ends.

## Create the two environment secrets

In the repository’s **Settings → Environments → internal-test-signing → Environment secrets**, add the following values.

| Exact secret name | Value |
|---|---|
| `ZTERMINAL_TEST_SIGNING_PFX_BASE64` | The base64 text copied from the controlled Windows certificate-export step |
| `ZTERMINAL_TEST_SIGNING_PFX_PASSWORD` | The one-time password used to export that PFX |

GitHub must mask these values. Do not paste either into terminal logs, workflow inputs, commit messages, issue comments, chat, or the repository.

## Run the internal test-signed preview

After the environment reviewer has approved the requested deployment and both secrets exist, open **Actions → Internal ZTerminal Workstation Preview (Test-Signed) → Run workflow**. Set the ref to `main`, check the explicit internal-test-signing acknowledgement, and enter only non-sensitive internal notes.

The workflow first verifies the deployed `/terminal` workstation before it builds the dedicated hosted-workstation NSIS flavor. It then imports the environment-scoped PFX on the disposable Windows runner, signs with SHA-256, verifies `Get-AuthenticodeSignature` as `Valid` in that runner, and removes the imported certificate and temporary PFX before artifact upload. It creates the private artifact files below.

| Artifact file | Meaning |
|---|---|
| `ZTerminal-Hosted-Workstation-Preview-Test-Signed.exe` | Self-signed private installer that opens the hosted ZTerminal workstation; not public-safe and requires an internet connection. |
| `ZTerminal-Hosted-Workstation-Preview-Test-Signed.exe.sha256` | SHA-256 checksum for internal integrity verification |
| `internal-release.json` | Internal manifest declaring `internal_only: true`, `public_release_eligible: false`, `self-signed-test-only`, and `timestamp: not-requested` |

Verify the SHA-256 checksum before a controlled internal test. On a Windows test machine, Windows may show warnings because this certificate is self-signed and untrusted by the public trust ecosystem. That expected warning does not make the artifact suitable for external users.

## Explicit prohibitions

The test workflow must never be extended to do any of the following without a separately approved production-signing and Track B release plan:

- Use a CA-backed production certificate, hardware token, cloud signing service, timestamp service, or production secret.
- Create a GitHub Release, upload a release asset, push to a CDN or object store, or set any public Windows release environment variable.
- Change `/download`, `/download/windows`, `/api/releases/windows`, or the public release resolver state.
- Connect the artifact to automatic updates, remote configuration, Render, customer telemetry, cloud sync, broker access, or order execution.
- Treat the hosted Tauri preview as an offline local-first app or as the future native Win32/Direct3D client.

If trustworthy public distribution is required, stop here and begin the separately reviewed Track B production release process with a trusted Authenticode signing identity, timestamping, controlled distribution infrastructure, native-client acceptance testing, and rollback design.
