using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;

// Private preview launcher. The helper runs as the current user, without elevation.
class ResearchLauncher : Form {
    Process helper;
    Label state = new Label(), code = new Label();
    Button restart = new Button(), install = new Button();
    System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    string root = AppDomain.CurrentDomain.BaseDirectory;
    string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZTerminal", "ResearchPreview");
    DateTime started;
    ResearchLauncher() {
        Text = "ZTerminal Research Helper · Private preview";
        ClientSize = new Size(560, 350); MinimumSize = Size; MaximumSize = Size;
        BackColor = Color.FromArgb(17, 15, 23); ForeColor = Color.FromArgb(222, 213, 234);
        Font = new Font("Segoe UI", 10); StartPosition = FormStartPosition.CenterScreen;
        var title = new Label { Text = "ZT / LOCAL RESEARCH", Left = 24, Top = 22, Width = 510, Height = 28, Font = new Font("Consolas", 16) };
        state.SetBounds(24, 64, 510, 48); state.Text = "Starting the loopback service…";
        code.SetBounds(24, 115, 510, 40); code.Font = new Font("Consolas", 24); code.Text = "--------";
        var note = new Label { Text = "Enter this code in ZTerminal → Research → Pair helper.\nScripts execute locally with your user permissions. This is not a secure sandbox. Run only code you trust.", Left = 24, Top = 165, Width = 510, Height = 66 };
        var open = MakeButton("Open ZTerminal", 24, 246, 155);
        open.Click += (s,e) => Process.Start(new ProcessStartInfo("https://zterminal.onrender.com/terminal") { UseShellExecute = true });
        restart = MakeButton("New pairing code", 189, 246, 165);
        restart.Click += (s,e) => { StopHelper(); StartHelper(); };
        install = MakeButton("Install for my user", 364, 246, 172);
        install.Click += (s,e) => Install();
        var footer = new Label { Text = "Free private preview · Closing this window stops active research jobs.", Left = 24, Top = 300, Width = 520, Height = 30, ForeColor = Color.FromArgb(158, 143, 176) };
        Controls.AddRange(new Control[] { title, state, code, note, open, restart, install, footer });
        timer.Interval = 500; timer.Tick += (s,e) => RefreshStatus();
        Shown += (s,e) => StartHelper();
        FormClosing += (s,e) => { timer.Stop(); StopHelper(); };
    }
    Button MakeButton(string text, int x, int y, int width) {
        return new Button { Text = text, Left = x, Top = y, Width = width, Height = 34, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(46, 34, 61), ForeColor = ForeColor };
    }
    void StartHelper() {
        try {
            var exe = Path.Combine(root, "runtime", "pythonw.exe");
            var script = Path.Combine(root, "app", "server.py");
            if (!File.Exists(exe) || !File.Exists(script)) throw new Exception("Extract the complete private package before opening the helper.");
            Directory.CreateDirectory(data);
            helper = Process.Start(new ProcessStartInfo(exe, "\"" + script + "\" --data-dir \"" + data + "\"") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = root });
            started = DateTime.UtcNow; state.Text = "Starting the loopback service…"; code.Text = "--------"; timer.Start();
        } catch (Exception error) { state.Text = error.Message; }
    }
    void RefreshStatus() {
        try {
            if (helper == null || helper.HasExited) { state.Text = "Helper stopped. Close other helper instances, then request a new pairing code."; code.Text = "--------"; timer.Stop(); return; }
            string path = Path.Combine(data, "pairing.json");
            if (!File.Exists(path) || File.GetLastWriteTimeUtc(path) < started.AddSeconds(-1)) return;
            var pair = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(path));
            if (Convert.ToInt32(pair["pid"]) != helper.Id) return;
            bool expired = Convert.ToDouble(pair["expiresAt"]) <= (DateTime.UtcNow - new DateTime(1970,1,1)).TotalMilliseconds;
            code.Text = expired ? "EXPIRED" : Convert.ToString(pair["code"]);
            state.Text = expired ? "Pairing code expired. Previously paired browsers stay connected." : "Loopback service running · code expires after 10 minutes or one pairing.\nPython compiles on the first run; no market connection is claimed here.";
        } catch (IOException) { /* Retry while the helper writes its status. */ }
          catch (Exception error) { state.Text = error.Message; }
    }
    void StopHelper() {
        timer.Stop();
        if (helper != null) { try { if (!helper.HasExited) { helper.Kill(); helper.WaitForExit(5000); } } catch (InvalidOperationException) {} finally { helper.Dispose(); helper = null; } }
        // Closing the controller's Windows Job Object handle kills its strategy child.
    }
    void Install() {
        try {
            string destination = Path.Combine(data, "package-1.0.0-preview.2");
            if (Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar).Equals(Path.GetFullPath(destination), StringComparison.OrdinalIgnoreCase)) { state.Text = "This helper is already installed for your user."; return; }
            install.Enabled = false; state.Text = "Installing the private runtime. Saved research data is preserved."; Refresh();
            CopyTree(root, destination);
            // A standard per-user Start Menu shortcut; no administrator or startup registration.
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic shell = Activator.CreateInstance(shellType);
            dynamic shortcut = shell.CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "ZTerminal Research Helper.lnk"));
            shortcut.TargetPath = Path.Combine(destination, "ZTerminalResearchHelper.exe"); shortcut.WorkingDirectory = destination; shortcut.Save();
            StopHelper(); Process.Start(new ProcessStartInfo(Path.Combine(destination, "ZTerminalResearchHelper.exe")) { UseShellExecute = true }); Close();
        } catch (Exception error) { install.Enabled = true; state.Text = "Install failed: " + error.Message; }
    }
    static void CopyTree(string source, string destination) {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source)) File.Copy(file, Path.Combine(destination, Path.GetFileName(file)), true);
        foreach (string folder in Directory.GetDirectories(source)) CopyTree(folder, Path.Combine(destination, Path.GetFileName(folder)));
    }
    [STAThread] static void Main() {
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false); Application.Run(new ResearchLauncher());
    }
}
