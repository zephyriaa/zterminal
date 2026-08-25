[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Installer,
    [Parameter(Mandatory = $true)]
    [string]$SmokeRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installerPath = [System.IO.Path]::GetFullPath($Installer)
$smokeRootPath = [System.IO.Path]::GetFullPath($SmokeRoot)
$programRoot = Join-Path $smokeRootPath 'program'
$localDataRoot = Join-Path $smokeRootPath 'local-data'
$roamingDataRoot = Join-Path $smokeRootPath 'roaming-data'
$legacyBinaryRoot = Join-Path $smokeRootPath 'legacy\app'
$startMenuRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ZTerminal Smoke'
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$legacyRegistrationPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ZTerminalLegacySmoke'
$setupLog = Join-Path $smokeRootPath 'setup.log'
$uninstallLog = Join-Path $smokeRootPath 'uninstall.log'

if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "The conventional installer does not exist: $installerPath"
}
Remove-Item -LiteralPath $programRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $localDataRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $roamingDataRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $startMenuRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $legacyBinaryRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $legacyRegistrationPath -Recurse -Force -ErrorAction SilentlyContinue
foreach ($logPath in @($setupLog, $uninstallLog)) {
    Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $legacyBinaryRoot -Force | Out-Null
[System.IO.File]::WriteAllText((Join-Path $legacyBinaryRoot 'legacy-host-marker.txt'), 'test legacy binary marker', [System.Text.UTF8Encoding]::new($false))
New-Item -Path $legacyRegistrationPath -Force | Out-Null
Set-ItemProperty -LiteralPath $legacyRegistrationPath -Name DisplayName -Value 'ZTerminal Legacy Smoke'

$setup = Start-Process -FilePath $installerPath -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /LOG=`"$setupLog`"" -PassThru -Wait
if ($setup.ExitCode -ne 0) {
    throw "The isolated conventional installer failed with exit code $($setup.ExitCode)."
}

$requiredFiles = @(
    'ZTerminalWindowsHost.exe',
    'zt-local-scene-bridge.exe',
    'zt-local-monte-carlo.exe',
    'zt-local-segment-catalog.exe',
    'zt-local-workspace.exe',
    'zt-offline-provider-import.exe',
    'zt-direct-public-ingest.exe',
    'unins000.exe'
)
$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $programRoot $_) -PathType Leaf) })
if ($missingFiles.Count -ne 0) {
    throw "The isolated conventional install is missing: $($missingFiles -join ', ')"
}
$registered = @(Get-ChildItem -LiteralPath $uninstallRoot | ForEach-Object {
    $entry = Get-ItemProperty -LiteralPath $_.PSPath
    if ($entry.DisplayName -eq 'ZTerminal Smoke') {
        [pscustomobject]@{ path=$_.PSPath; display_name=$entry.DisplayName; uninstall_string=$entry.UninstallString; install_location=$entry.InstallLocation }
    }
})
if ($registered.Count -ne 1) {
    throw "Expected exactly one isolated Windows Installed apps registration, found $($registered.Count)."
}
$shortcutPath = Join-Path $startMenuRoot 'ZTerminal.lnk'
if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
    throw 'The isolated conventional install did not create its Start Menu shortcut.'
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if ($shortcut.TargetPath -ne (Join-Path $programRoot 'ZTerminalWindowsHost.exe') -or $shortcut.WorkingDirectory -ne $programRoot) {
    throw 'The isolated conventional Start Menu shortcut does not point to the installed native host and working directory.'
}
if ((Test-Path -LiteralPath $legacyBinaryRoot) -or (Test-Path -LiteralPath $legacyRegistrationPath)) {
    throw 'The isolated conventional installer did not complete the bounded legacy migration.'
}
$launchedHost = Start-Process -FilePath $shortcut.TargetPath -WorkingDirectory $shortcut.WorkingDirectory -PassThru
Start-Sleep -Seconds 1
$launchedHost.Refresh()
$shortcutLaunchWindow = [pscustomobject]@{
    responding = $launchedHost.Responding
    main_window_handle = $launchedHost.MainWindowHandle
    main_window_title = $launchedHost.MainWindowTitle
}
if ($launchedHost.HasExited -or -not $shortcutLaunchWindow.responding -or $shortcutLaunchWindow.main_window_handle -eq 0 -or $shortcutLaunchWindow.main_window_title -ne 'ZTerminal') {
    if (-not $launchedHost.HasExited) { Stop-Process -Id $launchedHost.Id -Force }
    throw 'The installed conventional Start Menu shortcut did not create a responsive ZTerminal window.'
}
Stop-Process -Id $launchedHost.Id -Force
$launchedHost.WaitForExit(5000) | Out-Null

New-Item -ItemType Directory -Path (Join-Path $localDataRoot 'cache') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $roamingDataRoot 'workspace') -Force | Out-Null
[System.IO.File]::WriteAllText((Join-Path $localDataRoot 'cache\owned-cache.txt'), 'isolated local cache', [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $roamingDataRoot 'workspace\owned-workspace.txt'), 'isolated workspace', [System.Text.UTF8Encoding]::new($false))

$uninstallerPath = Join-Path $programRoot 'unins000.exe'
$uninstaller = Start-Process -FilePath $uninstallerPath -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG=`"$uninstallLog`"" -PassThru -Wait
if ($uninstaller.ExitCode -ne 0) {
    throw "The isolated conventional uninstaller failed with exit code $($uninstaller.ExitCode)."
}
$registrationRemaining = @(Get-ChildItem -LiteralPath $uninstallRoot | ForEach-Object {
    $entry = Get-ItemProperty -LiteralPath $_.PSPath
    if ($entry.DisplayName -eq 'ZTerminal Smoke') { $_.PSPath }
})
$result = [pscustomobject]@{
    schema_version = 1
    setup_exit_code = $setup.ExitCode
    installer_format = 'Inno Setup conventional EXE'
    required_files_present = $true
    registered_display_name = $registered[0].display_name
    registered_uninstall_string = $registered[0].uninstall_string
    shortcut_target = $shortcut.TargetPath
    shortcut_working_directory = $shortcut.WorkingDirectory
    native_host_started_by_installer = $false
    shortcut_launch_responding = $shortcutLaunchWindow.responding
    shortcut_launch_main_window_handle_nonzero = $shortcutLaunchWindow.main_window_handle -ne 0
    shortcut_launch_main_window_title = $shortcutLaunchWindow.main_window_title
    legacy_binary_root_removed = -not (Test-Path -LiteralPath $legacyBinaryRoot)
    legacy_registration_removed = -not (Test-Path -LiteralPath $legacyRegistrationPath)
    program_root_removed = -not (Test-Path -LiteralPath $programRoot)
    local_data_removed = -not (Test-Path -LiteralPath $localDataRoot)
    roaming_data_removed = -not (Test-Path -LiteralPath $roamingDataRoot)
    start_menu_removed = -not (Test-Path -LiteralPath $startMenuRoot)
    installed_apps_registration_removed = $registrationRemaining.Count -eq 0
    network_opened = $false
}
$result | ConvertTo-Json -Depth 5
if (-not $result.shortcut_launch_responding -or -not $result.shortcut_launch_main_window_handle_nonzero -or $result.shortcut_launch_main_window_title -ne 'ZTerminal' -or -not $result.legacy_binary_root_removed -or -not $result.legacy_registration_removed -or -not $result.program_root_removed -or -not $result.local_data_removed -or -not $result.roaming_data_removed -or -not $result.start_menu_removed -or -not $result.installed_apps_registration_removed) {
    throw 'The isolated conventional installer smoke did not satisfy the complete owned-data removal boundary.'
}
