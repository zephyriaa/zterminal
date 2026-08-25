using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const string ProductName = "ZTerminal";
    private const string ProductDescription = "ZTerminal Native Local-First Host";
    private const string ProductVersion = "0.1.0-private";
    private const string PayloadResource = "ZTerminalPayload.zip";
    private const string DefaultUninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ZTerminal";

    [STAThread]
    private static int Main(string[] arguments)
    {
        return HasArgument(arguments, "--uninstall")
            ? Uninstall(arguments)
            : Install();
    }

    private static int Install()
    {
        try
        {
            var layout = GetLayout();
            var stagingRoot = layout.ApplicationRoot + ".staging-" + Process.GetCurrentProcess().Id;
            var backupRoot = layout.ApplicationRoot + ".backup-" + Process.GetCurrentProcess().Id;

            DeleteDirectoryIfPresent(stagingRoot);
            Directory.CreateDirectory(stagingRoot);
            try
            {
                ExtractPayload(stagingRoot);
                WriteInstallationManifest(stagingRoot);
                Directory.CreateDirectory(layout.InstallRoot);

                if (Directory.Exists(layout.ApplicationRoot))
                {
                    DeleteDirectoryIfPresent(backupRoot);
                    Directory.Move(layout.ApplicationRoot, backupRoot);
                }
                Directory.Move(stagingRoot, layout.ApplicationRoot);
                DeleteDirectoryIfPresent(backupRoot);

                var uninstaller = Path.Combine(layout.ApplicationRoot, "ZTerminalUninstall.exe");
                File.Copy(Assembly.GetExecutingAssembly().Location, uninstaller, true);
                CreateStartMenuShortcuts(layout, uninstaller);
                RegisterInstalledApp(layout, uninstaller);
            }
            catch
            {
                if (Directory.Exists(backupRoot) && !Directory.Exists(layout.ApplicationRoot))
                {
                    Directory.Move(backupRoot, layout.ApplicationRoot);
                }
                throw;
            }
            finally
            {
                DeleteDirectoryIfPresent(stagingRoot);
            }

            if (!IsNonInteractive())
            {
                MessageBox.Show(
                    "ZTerminal was installed for this Windows user.\n\n"
                    + "Open it from Start Menu → ZTerminal. You can remove ZTerminal from Windows Settings → Installed apps; uninstall will permanently erase the installed app, local cache/history, workspace data, and diagnostics owned by ZTerminal.",
                    "ZTerminal installation complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            return 0;
        }
        catch (Exception exception)
        {
            ReportFailure(exception);
            return 1;
        }
    }

    private static int Uninstall(string[] arguments)
    {
        var fromTemporaryCopy = HasArgument(arguments, "--from-temporary-copy");
        var quiet = HasArgument(arguments, "--quiet") || IsNonInteractive();
        try
        {
            if (!fromTemporaryCopy)
            {
                var temporaryUninstaller = Path.Combine(
                    Path.GetTempPath(),
                    "ZTerminal-uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
                File.Copy(Assembly.GetExecutingAssembly().Location, temporaryUninstaller, true);
                Process.Start(new ProcessStartInfo
                {
                    FileName = temporaryUninstaller,
                    Arguments = "--uninstall --from-temporary-copy" + (quiet ? " --quiet" : string.Empty),
                    UseShellExecute = true,
                });
                return 0;
            }

            Thread.Sleep(750);
            var layout = GetLayout();
            if (!quiet)
            {
                var confirmation = MessageBox.Show(
                    "Uninstall ZTerminal?\n\nThis permanently removes the installed app, Start Menu shortcuts, installer registration, local cache/history, workspace data, and diagnostics owned by ZTerminal for this Windows user.",
                    "Uninstall ZTerminal",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button2);
                if (confirmation != DialogResult.Yes)
                {
                    return 0;
                }
            }

            StopInstalledNativeHost(layout.ApplicationRoot);
            RemoveUninstallRegistration();
            DeleteDirectoryWithRetries(layout.InstallRoot);
            DeleteDirectoryWithRetries(layout.RoamingRoot);
            DeleteDirectoryIfPresent(layout.StartMenuRoot);
            ScheduleSelfDeletion();

            if (!quiet)
            {
                MessageBox.Show(
                    "ZTerminal and its local data for this Windows user were removed.",
                    "ZTerminal uninstalled",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            return 0;
        }
        catch (Exception exception)
        {
            ReportFailure(exception);
            return 1;
        }
    }

    private static void ExtractPayload(string targetRoot)
    {
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource))
        {
            if (stream == null)
            {
                throw new InvalidOperationException("The installer payload is unavailable.");
            }
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                foreach (var entry in archive.Entries)
                {
                    var destination = Path.GetFullPath(Path.Combine(targetRoot, entry.FullName));
                    var allowedPrefix = Path.GetFullPath(targetRoot + Path.DirectorySeparatorChar);
                    if (!destination.StartsWith(allowedPrefix, StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(entry.Name))
                    {
                        throw new InvalidOperationException("The installer payload contains an invalid file path.");
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    using (var input = entry.Open())
                    using (var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        input.CopyTo(output);
                    }
                }
            }
        }
    }

    private static void WriteInstallationManifest(string applicationRoot)
    {
        const string manifest = "{\n"
            + "  \"schema_version\": 2,\n"
            + "  \"product\": \"ZTerminal Native Local-First Host\",\n"
            + "  \"installation_scope\": \"CurrentUser\",\n"
            + "  \"network_opened_by_installer\": false,\n"
            + "  \"signed\": false,\n"
            + "  \"uninstall_scope\": \"full_zterminal_owned_local_data\"\n"
            + "}\n";
        File.WriteAllText(Path.Combine(applicationRoot, "installation.json"), manifest);
    }

    private static void CreateStartMenuShortcuts(InstallLayout layout, string uninstaller)
    {
        Directory.CreateDirectory(layout.StartMenuRoot);
        var shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null)
        {
            throw new InvalidOperationException("Windows shortcut support is unavailable.");
        }
        dynamic shell = Activator.CreateInstance(shellType);

        dynamic applicationShortcut = shell.CreateShortcut(Path.Combine(layout.StartMenuRoot, "ZTerminal.lnk"));
        applicationShortcut.TargetPath = Path.Combine(layout.ApplicationRoot, "ZTerminalWindowsHost.exe");
        applicationShortcut.WorkingDirectory = layout.ApplicationRoot;
        applicationShortcut.Description = ProductDescription;
        applicationShortcut.Save();

        dynamic uninstallShortcut = shell.CreateShortcut(Path.Combine(layout.StartMenuRoot, "Uninstall ZTerminal.lnk"));
        uninstallShortcut.TargetPath = uninstaller;
        uninstallShortcut.Arguments = "--uninstall";
        uninstallShortcut.WorkingDirectory = layout.ApplicationRoot;
        uninstallShortcut.Description = "Remove ZTerminal and its local data";
        uninstallShortcut.Save();
    }

    private static void RegisterInstalledApp(InstallLayout layout, string uninstaller)
    {
        using (var key = Registry.CurrentUser.CreateSubKey(GetUninstallKeyPath()))
        {
            if (key == null)
            {
                throw new InvalidOperationException("Windows Installed apps registration is unavailable.");
            }
            var uninstallCommand = "\"" + uninstaller + "\" --uninstall";
            key.SetValue("DisplayName", ProductName);
            key.SetValue("DisplayVersion", ProductVersion);
            key.SetValue("Publisher", ProductName);
            key.SetValue("InstallLocation", layout.ApplicationRoot);
            key.SetValue("DisplayIcon", Path.Combine(layout.ApplicationRoot, "ZTerminalWindowsHost.exe"));
            key.SetValue("UninstallString", uninstallCommand);
            key.SetValue("QuietUninstallString", uninstallCommand + " --quiet");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            key.SetValue("EstimatedSize", GetInstalledSizeKilobytes(layout.ApplicationRoot), RegistryValueKind.DWord);
        }
    }

    private static void RemoveUninstallRegistration()
    {
        Registry.CurrentUser.DeleteSubKeyTree(GetUninstallKeyPath(), false);
    }

    private static int GetInstalledSizeKilobytes(string root)
    {
        long bytes = 0;
        if (Directory.Exists(root))
        {
            foreach (var file in Directory.GetFiles(root, "*", SearchOption.AllDirectories))
            {
                bytes += new FileInfo(file).Length;
            }
        }
        return (int)Math.Min(int.MaxValue, Math.Max(1, (bytes + 1023) / 1024));
    }

    private static void StopInstalledNativeHost(string applicationRoot)
    {
        foreach (var process in Process.GetProcessesByName("ZTerminalWindowsHost"))
        {
            try
            {
                var executable = process.MainModule == null ? string.Empty : process.MainModule.FileName;
                if (!string.IsNullOrEmpty(executable)
                    && executable.StartsWith(applicationRoot, StringComparison.OrdinalIgnoreCase))
                {
                    process.Kill();
                    process.WaitForExit(5000);
                }
            }
            catch
            {
                // A process that cannot be inspected is outside this per-user uninstall boundary.
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static void DeleteDirectoryWithRetries(string path)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            if (!Directory.Exists(path))
            {
                return;
            }
            try
            {
                Directory.Delete(path, true);
                return;
            }
            catch (IOException)
            {
                Thread.Sleep(250);
            }
            catch (UnauthorizedAccessException)
            {
                Thread.Sleep(250);
            }
        }
        if (Directory.Exists(path))
        {
            throw new IOException("ZTerminal could not remove its owned local directory: " + path);
        }
    }

    private static void DeleteDirectoryIfPresent(string path)
    {
        if (Directory.Exists(path))
        {
            Directory.Delete(path, true);
        }
    }

    private static void ScheduleSelfDeletion()
    {
        var currentExecutable = Assembly.GetExecutingAssembly().Location;
        var command = "/c ping 127.0.0.1 -n 2 > nul & del /f /q \"" + currentExecutable + "\"";
        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = command,
            CreateNoWindow = true,
            UseShellExecute = false,
        });
    }

    private static bool HasArgument(string[] arguments, string value)
    {
        return Array.Exists(arguments, argument => string.Equals(argument, value, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsNonInteractive()
    {
        return string.Equals(Environment.GetEnvironmentVariable("ZTERMINAL_INSTALLER_NO_UI"), "1", StringComparison.Ordinal);
    }

    private static string GetUninstallKeyPath()
    {
        var testOverride = Environment.GetEnvironmentVariable("ZTERMINAL_INSTALLER_UNINSTALL_KEY");
        return string.IsNullOrWhiteSpace(testOverride) ? DefaultUninstallKey : testOverride;
    }

    private static InstallLayout GetLayout()
    {
        var configuredInstallRoot = Environment.GetEnvironmentVariable("ZTERMINAL_INSTALLER_ROOT");
        var useConfiguredRoot = !string.IsNullOrWhiteSpace(configuredInstallRoot);
        var installRoot = useConfiguredRoot
            ? Path.GetFullPath(configuredInstallRoot)
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZTerminal");
        var roamingRoot = useConfiguredRoot
            ? Path.Combine(installRoot, "Roaming")
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ZTerminal");
        var startMenuRoot = Path.Combine(
            useConfiguredRoot
                ? Path.Combine(installRoot, "Programs")
                : Environment.GetFolderPath(Environment.SpecialFolder.Programs),
            "ZTerminal");
        return new InstallLayout(installRoot, roamingRoot, startMenuRoot);
    }

    private static void ReportFailure(Exception exception)
    {
        if (IsNonInteractive())
        {
            File.WriteAllText(Path.Combine(Path.GetTempPath(), "zterminal-installer-last-error.txt"), exception.ToString());
        }
        else
        {
            MessageBox.Show(
                "ZTerminal could not complete the requested operation. No unrelated data was intentionally removed.\n\n"
                + exception.Message,
                "ZTerminal setup",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private sealed class InstallLayout
    {
        internal InstallLayout(string installRoot, string roamingRoot, string startMenuRoot)
        {
            InstallRoot = installRoot;
            RoamingRoot = roamingRoot;
            StartMenuRoot = startMenuRoot;
        }

        internal string InstallRoot { get; private set; }
        internal string RoamingRoot { get; private set; }
        internal string StartMenuRoot { get; private set; }
        internal string ApplicationRoot { get { return Path.Combine(InstallRoot, "app"); } }
    }
}
