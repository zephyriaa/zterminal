#ifndef ReleaseDirectory
  #error ReleaseDirectory must be supplied by the private installer build script.
#endif
#ifndef OutputDirectory
  #error OutputDirectory must be supplied by the private installer build script.
#endif
#ifndef InstallerAppId
  #define InstallerAppId "ZTerminalPrivate"
#endif
#ifndef InstallerDisplayName
  #define InstallerDisplayName "ZTerminal"
#endif
#ifndef InstallerGroupName
  #define InstallerGroupName "ZTerminal"
#endif
#ifndef DefaultInstallDirectory
  #define DefaultInstallDirectory "{localappdata}\Programs\ZTerminal"
#endif
#ifndef LocalDataDirectory
  #define LocalDataDirectory "{localappdata}\ZTerminal"
#endif
#ifndef RoamingDataDirectory
  #define RoamingDataDirectory "{userappdata}\ZTerminal"
#endif
#ifndef MigrateLegacyInstall
  #define MigrateLegacyInstall 1
#endif
#ifndef LegacyBinaryDirectory
  #define LegacyBinaryDirectory "{localappdata}\\ZTerminal\\app"
#endif
#ifndef LegacyUninstallKey
  #define LegacyUninstallKey "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ZTerminal"
#endif

#define ProductVersion "0.1.0-private"
#define ProductPublisher "ZTerminal"

[Setup]
AppId={#InstallerAppId}
AppName={#InstallerDisplayName}
AppVersion={#ProductVersion}
AppPublisher={#ProductPublisher}
DefaultDirName={#DefaultInstallDirectory}
DefaultGroupName={#InstallerGroupName}
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDirectory}
OutputBaseFilename=ZTerminal-Private-Setup
UninstallDisplayIcon={app}\ZTerminalWindowsHost.exe
UninstallDisplayName={#InstallerDisplayName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
DisableWelcomePage=no
DisableReadyPage=no
DisableFinishedPage=no
SetupLogging=yes
UninstallLogging=yes
CreateAppDir=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#ReleaseDirectory}\ZTerminalWindowsHost.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#ReleaseDirectory}\zt-local-scene-bridge.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#ReleaseDirectory}\zt-local-monte-carlo.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#ReleaseDirectory}\zt-local-segment-catalog.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#ReleaseDirectory}\zt-local-workspace.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#ReleaseDirectory}\zt-offline-provider-import.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#ReleaseDirectory}\zt-direct-public-ingest.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#InstallerGroupName}\ZTerminal"; Filename: "{app}\ZTerminalWindowsHost.exe"; WorkingDir: "{app}"; Comment: "ZTerminal Native Local-First Host"

[Run]
Filename: "{app}\ZTerminalWindowsHost.exe"; Description: "Launch ZTerminal"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: filesandordirs; Name: "{#LocalDataDirectory}"
Type: filesandordirs; Name: "{#RoamingDataDirectory}"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
#if MigrateLegacyInstall
    // The legacy custom installer kept binaries in the local-data root.
    // New binaries are present in the conventional install root; remove only
    // the exact old binary directory while preserving local data until uninstall.
    DelTree(ExpandConstant('{#LegacyBinaryDirectory}'), True, True, True);
    RegDeleteKeyIncludingSubkeys(HKCU, '{#LegacyUninstallKey}');
#endif
  end;
end;
