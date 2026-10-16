using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class ResearchLauncher : Form {
    const string Version = "1.0.0-preview.4";
    static readonly int RevealMessage = RegisterWindowMessage("ZTerminal.ResearchHelper.Reveal");
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int RegisterWindowMessage(string message);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window, int message, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    public static string Relaunch;
    Process helper;
    readonly Label state = new Label(), detail = new Label(), code = new Label();
    readonly Button copy = new Button(), renew = new Button(), install = new Button();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    readonly string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZTerminal", "ResearchPreview");
    string failure = "", currentCode = "";
    DateTime started, copied;
    bool closing;
    readonly Image logo;

    ResearchLauncher() {
        Text = "ZTerminal Research Helper";
        AutoScaleDimensions = new SizeF(96, 96); AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(576, 520); MinimumSize = new Size(540, 550);
        BackColor = Color.FromArgb(17, 15, 23); ForeColor = Color.FromArgb(237, 232, 245);
        Font = new Font("Segoe UI", 10); StartPosition = FormStartPosition.CenterScreen;
        DoubleBuffered = true;
        using (var stream = typeof(ResearchLauncher).Assembly.GetManifestResourceStream("logo.png")) logo = new Bitmap(stream);
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(28), ColumnCount = 1, RowCount = 8 };
        foreach (int height in new int[] { 66, 34, 56, 68, 50, 48, 58 }) layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        var header = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 54)); header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        header.Controls.Add(new PictureBox { Image = logo, SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(42, 42), TabStop = false });
        header.Controls.Add(new Label { Text = "ZTERMINAL\nResearch Helper", AutoSize = true, Font = new Font("Segoe UI Semibold", 12) });
        layout.Controls.Add(header);
        state.Text = "Starting"; state.Dock = DockStyle.Fill; state.Font = new Font("Segoe UI Semibold", 13); state.AccessibleName = "Service status";
        layout.Controls.Add(state);
        detail.Dock = DockStyle.Fill; detail.ForeColor = Color.FromArgb(177, 167, 193); layout.Controls.Add(detail);
        code.Text = "–––– ––––"; code.Font = new Font("Consolas", 32); code.Dock = DockStyle.Fill; code.AccessibleName = "Connection code"; layout.Controls.Add(code);
        var actions = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50)); actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        StyleButton(copy, "&Copy Code"); copy.Enabled = false;
        copy.Click += (s,e) => { try { Clipboard.SetText(currentCode); copied = DateTime.UtcNow; copy.Text = "Copied"; } catch (Exception) { detail.Text = "Clipboard is busy. Select Copy Code again."; } };
        StyleButton(renew, "&New Code"); renew.Enabled = false;
        renew.Click += (s,e) => {
            if (helper == null || helper.HasExited) { StartHelper(); return; }
            try { helper.StandardInput.WriteLine("new-code"); helper.StandardInput.Flush(); copy.Enabled = false; renew.Enabled = false; }
            catch (Exception error) { detail.Text = "Could not request a code: " + error.Message; }
        };
        actions.Controls.Add(copy); actions.Controls.Add(renew); layout.Controls.Add(actions);
        var open = new Button(); StyleButton(open, "&Open ZTerminal");
        open.Click += (s,e) => { try { Process.Start(new ProcessStartInfo("https://zterminal.dpdns.org/terminal") { UseShellExecute = true }); } catch (Exception error) { detail.Text = error.Message; } }; layout.Controls.Add(open);
        StyleButton(install, "&Install / update for my user"); install.Click += (s,e) => Install(); layout.Controls.Add(install);
        layout.Controls.Add(new Label { Text = "Unsigned preview · " + Version + "\nRun only Python you trust. Closing this window stops local jobs.", Dock = DockStyle.Fill, ForeColor = detail.ForeColor, Font = new Font("Segoe UI", 9) });
        Controls.Add(layout);
        var intro = new LogoIntro(logo) { Dock = DockStyle.Fill, BackColor = BackColor }; Controls.Add(intro); intro.BringToFront();
        timer.Interval = 300; timer.Tick += (s,e) => RefreshStatus();
        Shown += (s,e) => { StartHelper(); intro.Start(); };
        FormClosing += (s,e) => { closing = true; timer.Stop(); StopHelper(); };
    }
    void StyleButton(Button button, string text) {
        button.Text = text; button.Dock = DockStyle.Fill; button.Margin = new Padding(0, 0, 8, 8);
        button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderColor = Color.FromArgb(76, 61, 95);
        button.BackColor = Color.FromArgb(38, 29, 51); button.ForeColor = ForeColor; button.UseMnemonic = true;
    }
    protected override void WndProc(ref Message message) {
        if (message.Msg == RevealMessage) { if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal; Show(); SetForegroundWindow(Handle); }
        base.WndProc(ref message);
    }
    void StartHelper() {
        try {
            if (helper != null) { helper.Dispose(); helper = null; }
            var exe = Path.Combine(root, "runtime", "python.exe");
            var script = Path.Combine(root, "app", "server.py");
            if (!File.Exists(exe) || !File.Exists(script)) throw new Exception("Extract the complete ZIP, then open ZTerminalResearchHelper.exe.");
            Directory.CreateDirectory(data);
            failure = ""; started = DateTime.UtcNow; state.Text = "Starting"; detail.Text = "Starting your local Python service…"; code.Text = "–––– ––––"; copy.Enabled = renew.Enabled = false;
            helper = new Process { StartInfo = new ProcessStartInfo(exe, "-B \"" + script + "\" --launcher --data-dir \"" + data + "\"") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardError = true, WorkingDirectory = root } };
            helper.ErrorDataReceived += (s,e) => { if (e.Data != null) { lock (this) { failure += "\n" + e.Data; if (failure.Length > 4000) failure = failure.Substring(failure.Length - 4000); } } };
            helper.Start(); helper.BeginErrorReadLine(); timer.Start();
        } catch (Exception error) { state.Text = "Failed to start"; detail.Text = error.Message; renew.Enabled = true; }
    }
    void RefreshStatus() {
        if (closing) return;
        if ((DateTime.UtcNow - copied).TotalSeconds > 2) copy.Text = "&Copy Code";
        try {
            if (helper == null || helper.HasExited) {
                state.Text = "Service failed"; code.Text = "–––– ––––"; copy.Enabled = false; renew.Enabled = true;
                detail.Text = failure.Contains("10048") || failure.Contains("10013") ? "Port 47321 is in use. Close the other Helper or service, then choose New Code. No processes were terminated." : "Python stopped. Extract a fresh complete package and retry. " + failure.Substring(Math.Max(0, failure.Length - 180)); return;
            }
            string path = Path.Combine(data, "pairing.json");
            if (!File.Exists(path) || File.GetLastWriteTimeUtc(path) < started.AddSeconds(-1)) {
                if ((DateTime.UtcNow - started).TotalSeconds > 30) detail.Text = "Python is taking longer to start. Check disk space and antivirus restrictions.";
                return;
            }
            var pair = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(path));
            if (Convert.ToInt32(pair["pid"]) != helper.Id) return;
            double now = (DateTime.UtcNow - new DateTime(1970,1,1)).TotalMilliseconds;
            bool consumed = Convert.ToBoolean(pair["consumed"]), locked = Convert.ToBoolean(pair["locked"]), expired = Convert.ToDouble(pair["expiresAt"]) <= now;
            bool connected = now - Convert.ToDouble(pair["lastSeen"]) < 15000;
            currentCode = Convert.ToString(pair["code"]);
            copy.Enabled = !consumed && !locked && !expired; renew.Enabled = true;
            code.Text = copy.Enabled ? currentCode.Substring(0,4) + " " + currentCode.Substring(4) : consumed ? "CODE USED" : locked ? "LOCKED" : "EXPIRED";
            state.Text = connected ? "Browser connected" : locked ? "Code locked" : consumed ? "Ready · code used" : expired ? "Code expired" : "Ready to connect";
            detail.Text = connected ? "Authenticated browser activity in the last 15 seconds.\nThe local research engine is ready." : consumed ? "Helper running. Waiting for browser activity.\nChoose New Code to pair another browser." : locked ? "Five attempts used. Choose New Code to try again." : expired ? "Helper running. Choose New Code to pair.\nPreviously paired browsers can reconnect." : "Helper running · browser not connected.\nPaste this code in Python Strategy. Expires in " + Math.Max(0, (int)Math.Ceiling((Convert.ToDouble(pair["expiresAt"]) - now) / 60000)) + " min.";
        } catch (IOException) { /* Retry if atomic status is briefly busy. */ }
          catch (Exception error) { state.Text = "Status unavailable"; detail.Text = "Could not read Helper status: " + error.Message; copy.Enabled = false; }
    }
    void StopHelper() {
        if (helper == null) return;
        try {
            if (!helper.HasExited) {
                helper.StandardInput.Close();
                if (!helper.WaitForExit(5000)) { helper.Kill(); helper.WaitForExit(2000); }
            }
        } catch (InvalidOperationException) { } finally { helper.Dispose(); helper = null; }
    }
    void Install() {
        try {
            string destination = Path.Combine(data, "package-" + Version);
            if (Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar).Equals(Path.GetFullPath(destination), StringComparison.OrdinalIgnoreCase)) { detail.Text = "This version is installed. Download a newer ZIP from Python Strategy to update."; return; }
            install.Enabled = false; detail.Text = "Installing for your user. Research archives remain in place.";
            System.Threading.Tasks.Task.Run(() => {
                try {
                    CopyTree(root, destination);
                    if (!closing) BeginInvoke((Action)(() => {
                        try {
                            Type shellType = Type.GetTypeFromProgID("WScript.Shell"); dynamic shell = Activator.CreateInstance(shellType);
                            dynamic shortcut = shell.CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "ZTerminal Research Helper.lnk"));
                            shortcut.TargetPath = Path.Combine(destination, "ZTerminalResearchHelper.exe"); shortcut.WorkingDirectory = destination; shortcut.Save();
                            Relaunch = shortcut.TargetPath; Close();
                        } catch (Exception error) { install.Enabled = true; detail.Text = "Install failed: " + error.Message; }
                    }));
                } catch (Exception error) { if (!closing) BeginInvoke((Action)(() => { install.Enabled = true; detail.Text = "Install failed: " + error.Message; })); }
            });
        } catch (Exception error) { install.Enabled = true; detail.Text = "Install failed: " + error.Message; }
    }
    static void CopyTree(string source, string destination) {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source)) File.Copy(file, Path.Combine(destination, Path.GetFileName(file)), true);
        foreach (string folder in Directory.GetDirectories(source)) CopyTree(folder, Path.Combine(destination, Path.GetFileName(folder)));
    }
    [STAThread] static void Main() {
        bool created;
        using (var instance = new Mutex(true, @"Local\ZTerminalResearchHelper-" + WindowsIdentity.GetCurrent().User.Value, out created)) {
            if (!created) { PostMessage(new IntPtr(0xffff), RevealMessage, IntPtr.Zero, IntPtr.Zero); return; }
            try { Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false); Application.Run(new ResearchLauncher()); }
            finally { instance.ReleaseMutex(); }
        }
        if (Relaunch != null) Process.Start(new ProcessStartInfo(Relaunch) { UseShellExecute = true });
    }
}

class LogoIntro : Panel {
    readonly Image logo;
    readonly Stopwatch watch = new Stopwatch();
    readonly System.Windows.Forms.Timer animation = new System.Windows.Forms.Timer();
    public LogoIntro(Image image) { logo = image; DoubleBuffered = true; TabStop = false; animation.Interval = 15; animation.Tick += (s,e) => { if (watch.ElapsedMilliseconds >= 780) { animation.Stop(); Visible = false; Dispose(); } else Invalidate(); }; }
    public void Start() { if (!SystemInformation.IsMenuAnimationEnabled || SystemInformation.HighContrast) { Visible = false; Dispose(); return; } watch.Start(); animation.Start(); }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);
        float progress = Math.Min(1, watch.ElapsedMilliseconds / 780f);
        float alpha = Math.Min(1, progress / .25f) * Math.Min(1, (1-progress) / .25f);
        int size = (int)(100 * e.Graphics.DpiX / 96f);
        using (var attributes = new ImageAttributes()) {
            var matrix = new ColorMatrix(); matrix.Matrix33 = alpha; attributes.SetColorMatrix(matrix);
            e.Graphics.DrawImage(logo, new Rectangle((Width-size)/2, (Height-size)/2 + (int)((1-progress)*8*e.Graphics.DpiX/96f), size, size), 0,0,logo.Width,logo.Height,GraphicsUnit.Pixel,attributes);
        }
    }
    protected override void Dispose(bool disposing) { if (disposing) animation.Dispose(); base.Dispose(disposing); }
}
