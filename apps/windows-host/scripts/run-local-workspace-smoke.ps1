param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$WorkspaceExecutable = (Join-Path $PSScriptRoot '..\..\..\out\windows-host\Release\zt-local-workspace.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $WorkspaceExecutable)) {
    throw "Packaged local workspace command was not found: $WorkspaceExecutable"
}

function Invoke-BoundedProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Arguments,
        [Parameter(Mandatory = $true)]
        [int]$TimeoutMilliseconds
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = $Arguments
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Could not start $FilePath"
    }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        $process.Kill()
        $process.WaitForExit()
        throw "$FilePath exceeded the bounded $TimeoutMilliseconds ms process limit"
    }
    [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
    [pscustomobject]@{
        exit_code = $process.ExitCode
        stdout = $stdoutTask.Result
        stderr = $stderrTask.Result
    }
}

$workRoot = Join-Path $RepositoryRoot 'out\local-workspace-smoke'
$journalRoot = Join-Path $workRoot 'journal'
$payloadFile = Join-Path $workRoot 'TEST_ONLY_workspace_payload.bin'
$payloadText = 'test-only-layout-v1'
$journalBudget = 65536

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

try {
    $missing = Invoke-BoundedProcess -FilePath $WorkspaceExecutable -Arguments '' -TimeoutMilliseconds 10000
    if ($missing.exit_code -ne 2 -or $missing.stderr -notmatch 'missing required argument: --operation') {
        throw "Workspace missing-argument guard did not terminate before local persistence: $($missing | ConvertTo-Json -Compress)"
    }

    [System.IO.File]::WriteAllText($payloadFile, $payloadText, [System.Text.UTF8Encoding]::new($false))
    $saveArguments = @(
        '--operation', 'save',
        '--root', $journalRoot,
        '--workspace-id', '7',
        '--revision', '1',
        '--saved-at-ns', '9',
        '--payload-file', $payloadFile,
        '--journal-budget-bytes', $journalBudget
    ) -join ' '
    $saveProcess = Invoke-BoundedProcess -FilePath $WorkspaceExecutable -Arguments $saveArguments -TimeoutMilliseconds 10000
    if ($saveProcess.exit_code -ne 0) {
        throw "Local workspace save exited with code $($saveProcess.exit_code): $($saveProcess.stderr.Trim())"
    }
    $save = $saveProcess.stdout | ConvertFrom-Json
    if ($save.schema_version -ne 1 -or $save.kind -ne 'workspace' -or $save.operation -ne 'save' -or $save.network_opened -or $save.workspace_id -ne 7 -or $save.revision -ne 1 -or $save.sync_state -ne 'local_only' -or $save.payload_bytes -ne [System.Text.Encoding]::UTF8.GetByteCount($payloadText) -or $saveProcess.stdout -match [regex]::Escape($payloadText)) {
        throw "Local workspace save did not produce the bounded aggregate-only result: $($save | ConvertTo-Json -Compress)"
    }

    $readArguments = @(
        '--operation', 'read',
        '--root', $journalRoot,
        '--workspace-id', '7',
        '--journal-budget-bytes', $journalBudget
    ) -join ' '
    $readProcess = Invoke-BoundedProcess -FilePath $WorkspaceExecutable -Arguments $readArguments -TimeoutMilliseconds 10000
    if ($readProcess.exit_code -ne 0) {
        throw "Local workspace read exited with code $($readProcess.exit_code): $($readProcess.stderr.Trim())"
    }
    $read = $readProcess.stdout | ConvertFrom-Json
    if ($read.schema_version -ne 1 -or $read.kind -ne 'workspace' -or $read.operation -ne 'read' -or $read.network_opened -or -not $read.found -or $read.workspace_id -ne 7 -or $read.revision -ne 1 -or $read.saved_at_ns -ne 9 -or $read.sync_state -ne 'local_only' -or $read.payload_bytes -ne [System.Text.Encoding]::UTF8.GetByteCount($payloadText) -or $readProcess.stdout -match [regex]::Escape($payloadText)) {
        throw "Local workspace read did not preserve an aggregate-only local snapshot: $($read | ConvertTo-Json -Compress)"
    }

    $compactArguments = @(
        '--operation', 'compact',
        '--root', $journalRoot,
        '--journal-budget-bytes', $journalBudget
    ) -join ' '
    $compactProcess = Invoke-BoundedProcess -FilePath $WorkspaceExecutable -Arguments $compactArguments -TimeoutMilliseconds 10000
    if ($compactProcess.exit_code -ne 0) {
        throw "Local workspace compaction exited with code $($compactProcess.exit_code): $($compactProcess.stderr.Trim())"
    }
    $compact = $compactProcess.stdout | ConvertFrom-Json
    if ($compact.schema_version -ne 1 -or $compact.kind -ne 'workspace' -or $compact.operation -ne 'compact' -or $compact.network_opened -or -not $compact.compacted) {
        throw "Local workspace compaction did not remain local-only: $($compact | ConvertTo-Json -Compress)"
    }

    $missingReadArguments = @(
        '--operation', 'read',
        '--root', $journalRoot,
        '--workspace-id', '8',
        '--journal-budget-bytes', $journalBudget
    ) -join ' '
    $missingReadProcess = Invoke-BoundedProcess -FilePath $WorkspaceExecutable -Arguments $missingReadArguments -TimeoutMilliseconds 10000
    if ($missingReadProcess.exit_code -ne 0) {
        throw "Missing local workspace read exited with code $($missingReadProcess.exit_code): $($missingReadProcess.stderr.Trim())"
    }
    $missingRead = $missingReadProcess.stdout | ConvertFrom-Json
    if ($missingRead.network_opened -or $missingRead.found) {
        throw "Missing workspace was not represented truthfully: $($missingRead | ConvertTo-Json -Compress)"
    }

    [pscustomobject]@{
        schema_version = 1
        packaged_local_workspace = $true
        execution_uses_cargo = $false
        network_opened = $false
        missing_argument_guard = [pscustomobject]@{
            exit_code = $missing.exit_code
            rejected_before_local_persistence = $true
        }
        local_snapshot = [pscustomobject]@{
            workspace_id = $save.workspace_id
            revision = $save.revision
            sync_state = $save.sync_state
            payload_bytes = $save.payload_bytes
            payload_disclosed = $false
        }
        compaction = [pscustomobject]@{
            compacted = $compact.compacted
            local_only = $true
        }
        missing_workspace = [pscustomobject]@{
            workspace_id = 8
            found = $missingRead.found
        }
    } | ConvertTo-Json -Depth 5
}
finally {
    Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
