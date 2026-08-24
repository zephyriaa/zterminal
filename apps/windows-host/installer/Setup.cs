using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

internal static class Program
{
    private const string ProductName = "ZTerminal Native Local-First Host";
    private const string PayloadResource = "ZTerminalPayload.zip";

    [STAThread]
    private static int Main()
    {
        try
        {
            var configuredInstallRoot = Environment.GetEnvironmentVariable("ZTERMINAL_INSTALLER_ROOT");
            var useConfiguredRoot = !string.IsNullOrWhiteSpace(configuredInstallRoot);
            var installRoot = useConfiguredRoot
                ? Path.GetFullPath(configuredInstallRoot)
                : Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "ZTerminal");
            var applicationRoot = Path.Combine(installRoot, "app");
            var stagingRoot = applicationRoot + ".staging-" + Process.GetCurrentProcess().Id;
            var backupRoot = applicationRoot + ".backup-" + Process.GetCurrentProcess().Id;
            var programsRoot = Path.Combine(
                useConfiguredRoot
                    ? Path.Combine(installRoot, "Programs")
                    : Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                "ZTerminal");

            DeleteDirectoryIfPresent(stagingRoot);
            Directory.CreateDirectory(stagingRoot);
            try
            {
                ExtractPayload(stagingRoot);
                WriteInstallationManifest(stagingRoot);
                Directory.CreateDirectory(installRoot);

                if (Directory.Exists(applicationRoot))
                {
                    DeleteDirectoryIfPresent(backupRoot);
                    Directory.Move(applicationRoot, backupRoot);
                }
                Directory.Move(stagingRoot, applicationRoot);
                DeleteDirectoryIfPresent(backupRoot);
                CreateShortcut(programsRoot, Path.Combine(applicationRoot, "ZTerminalWindowsHost.exe"));
            }
            catch
            {
                if (Directory.Exists(backupRoot) && !Directory.Exists(applicationRoot))
                {
                    Directory.Move(backupRoot, applicationRoot);
                }
                throw;
            }
            finally
            {
                DeleteDirectoryIfPresent(stagingRoot);
            }

            if (!string.Equals(Environment.GetEnvironmentVariable("ZTERMINAL_INSTALLER_NO_UI"), "1", StringComparison.Ordinal))
            {
                MessageBox.Show(
                    "ZTerminal was installed for this Windows user.\n\n"
                    + "Open it from the ZTerminal Start Menu shortcut. The installer did not connect to a provider or enable cloud sync.",
                    "ZTerminal installation complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            return 0;
        }
        catch (Exception exception)
        {
            if (string.Equals(Environment.GetEnvironmentVariable("ZTERMINAL_INSTALLER_NO_UI"), "1", StringComparison.Ordinal))
            {
                File.WriteAllText(
                    Path.Combine(Path.GetTempPath(), "zterminal-installer-last-error.txt"),
                    exception.ToString());
            }
            else
            {
                MessageBox.Show(
                    "ZTerminal could not be installed. No existing local data was intentionally removed.\n\n"
                    + exception.Message,
                    "ZTerminal installation failed",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
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
            + "  \"schema_version\": 1,\n"
            + "  \"product\": \"ZTerminal Native Local-First Host\",\n"
            + "  \"installation_scope\": \"CurrentUser\",\n"
            + "  \"network_opened_by_installer\": false,\n"
            + "  \"signed\": false\n"
            + "}\n";
        File.WriteAllText(Path.Combine(applicationRoot, "installation.json"), manifest);
    }

    private static void CreateShortcut(string programsRoot, string target)
    {
        Directory.CreateDirectory(programsRoot);
        var shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null)
        {
            throw new InvalidOperationException("Windows shortcut support is unavailable.");
        }
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic shortcut = shell.CreateShortcut(Path.Combine(programsRoot, "ZTerminal.lnk"));
        shortcut.TargetPath = target;
        shortcut.WorkingDirectory = Path.GetDirectoryName(target);
        shortcut.Description = ProductName;
        shortcut.Save();
    }

    private static void DeleteDirectoryIfPresent(string path)
    {
        if (Directory.Exists(path))
        {
            Directory.Delete(path, true);
        }
    }
}
