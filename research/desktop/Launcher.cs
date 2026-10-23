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
    const string Version = "1.2.0-preview.1";
    static readonly int RevealMessage = RegisterWindowMessage("ZTerminal.ResearchHelper.Reveal");
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int RegisterWindowMessage(string message);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window, int message, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    public static string Relaunch;
    Process helper;
    readonly Label state = new Label(), detail = new Label(), code = new Label(), pairingTitle = new Label(), pairingDetail = new Label(), indicator = new Label();
    readonly TableLayoutPanel actions = new TableLayoutPanel();
    readonly Panel pairing = new HelperCard();
    readonly Button open = new HelperButton();
    readonly Button copy = new HelperButton(), renew = new HelperButton(), install = new HelperButton();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    readonly string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZTerminal", "ResearchPreview");
    string failure = "", currentCode = "";
    DateTime started, copied;
    bool closing;
    readonly Image logo;

    ResearchLauncher() {
        SuspendLayout();
        Text = "ZTerminal Research Helper";
        AutoScaleDimensions = new SizeF(96, 96); AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(576, 685); MinimumSize = new Size(592, 500);
        BackColor = Color.FromArgb(17, 16, 23); ForeColor = Color.FromArgb(240, 235, 247);
        Font = new Font("Segoe UI", 10.5f); StartPosition = FormStartPosition.CenterScreen;
        DoubleBuffered = true;
        using (var stream = typeof(ResearchLauncher).Assembly.GetManifestResourceStream("logo.png")) logo = new Bitmap(stream);
        using (var stream = typeof(ResearchLauncher).Assembly.GetManifestResourceStream("app.ico")) Icon = new Icon(stream);
        var layout = new TableLayoutPanel { Dock = DockStyle.Top, Height = 685, Padding = new Padding(28), ColumnCount = 1, RowCount = 13 };
        foreach (int height in new int[] { 56, 22, 72, 22, 238, 22, 44, 22, 44, 22, 1, 22, 42 }) layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
        var header = new Panel { Dock = DockStyle.Fill, Margin = Padding.Empty };
        header.Controls.Add(new PictureBox { Image = logo, SizeMode = PictureBoxSizeMode.Zoom, Bounds = new Rectangle(0, 8, 40, 40), TabStop = false });
        header.Controls.Add(new Label { Text = "ZTERMINAL", Bounds = new Rectangle(54, 0, 466, 18), ForeColor = Color.FromArgb(183,155,232), Font = new Font("Segoe UI", 9) });
        header.Controls.Add(new Label { Text = "Research Helper", Bounds = new Rectangle(54, 20, 466, 36), Font = new Font("Segoe UI Semibold", 18) });
        layout.Controls.Add(header, 0, 0);
        var status = new Panel { Dock = DockStyle.Fill, Size = new Size(520,72), Margin = Padding.Empty };
        indicator.Text = "●"; indicator.Bounds = new Rectangle(0, 1, 15, 24); indicator.ForeColor = Color.FromArgb(164,215,188); indicator.Font = new Font("Segoe UI", 8);
        state.Text = "Starting"; state.Bounds = new Rectangle(15, 0, 505, 24); state.Font = new Font("Segoe UI Semibold", 12); state.AccessibleName = "Service status";
        detail.Bounds = new Rectangle(0, 30, 520, 42); detail.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right; detail.ForeColor = Color.FromArgb(189,179,204);
        status.Controls.Add(indicator); status.Controls.Add(state); status.Controls.Add(detail); layout.Controls.Add(status, 0, 2);
        pairing.Size = new Size(520,238); pairing.Dock = DockStyle.Fill; pairing.Margin = Padding.Empty; pairing.BackColor = Color.FromArgb(27,25,35);
        pairingTitle.Text = "CONNECTION CODE"; pairingTitle.Bounds = new Rectangle(20,20,480,18); pairingTitle.Font = new Font("Segoe UI",9); pairingTitle.ForeColor = detail.ForeColor;
        code.Text = "–––– ––––"; code.Font = new Font("Consolas", 27); code.Bounds = new Rectangle(20,50,480,54); code.AccessibleName = "Connection code";
        pairingDetail.Bounds = new Rectangle(20,116,480,42); pairingDetail.ForeColor = detail.ForeColor;
        actions.Bounds = new Rectangle(20,170,480,44); actions.ColumnCount = 2; actions.RowCount = 1; actions.Margin = Padding.Empty;
        actions.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        actions.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50)); actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        StyleButton(copy, "&Copy code"); copy.Enabled = false; copy.Margin = new Padding(0,0,6,0);
        copy.Click += (s,e) => { try { Clipboard.SetText(currentCode); copied = DateTime.UtcNow; copy.Text = "Copied"; } catch (Exception) { detail.Text = "Clipboard is busy. Select Copy code again."; } };
        StyleButton(renew, "&New code"); renew.Enabled = false; renew.Margin = new Padding(6,0,0,0);
        renew.Click += (s,e) => {
            if (helper == null || helper.HasExited) { StartHelper(); return; }
            try { helper.StandardInput.WriteLine("new-code"); helper.StandardInput.Flush(); copy.Enabled = false; renew.Enabled = false; }
            catch (Exception error) { detail.Text = "Could not request a code: " + error.Message; }
        };
        actions.Controls.Add(copy,0,0); actions.Controls.Add(renew,1,0);
        pairing.Controls.Add(pairingTitle); pairing.Controls.Add(code); pairing.Controls.Add(pairingDetail); pairing.Controls.Add(actions); layout.Controls.Add(pairing,0,4);
        StyleButton(open, "&Open ZTerminal"); open.BackColor = Color.FromArgb(183,155,232); open.ForeColor = Color.FromArgb(26,17,40);
        open.Click += (s,e) => { try { Process.Start(new ProcessStartInfo("https://zterminal.dpdns.org/workspaces") { UseShellExecute = true }); } catch (Exception error) { detail.Text = error.Message; } }; layout.Controls.Add(open,0,6);
        var installation = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = Padding.Empty };
        installation.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        installation.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100)); installation.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,178));
        var description = new Panel { Dock = DockStyle.Fill, Margin = Padding.Empty };
        description.Controls.Add(new Label { Text = "Keep Helper on this PC", Bounds = new Rectangle(0,0,330,21), ForeColor = Color.FromArgb(221,215,230) });
        description.Controls.Add(new Label { Text = "Install or update for your Windows user.", Bounds = new Rectangle(0,25,330,18), ForeColor = detail.ForeColor, Font = new Font("Segoe UI",9) });
        StyleButton(install, "&Install / update"); install.Click += (s,e) => Install(); installation.Controls.Add(description,0,0); installation.Controls.Add(install,1,0); layout.Controls.Add(installation,0,8);
        layout.Controls.Add(new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(53,49,63), Margin = Padding.Empty },0,10);
        var footer = new Panel { Dock = DockStyle.Fill, Margin = Padding.Empty };
        footer.Controls.Add(new Label { Text = "Unsigned preview  ·  " + Version, Bounds = new Rectangle(0,0,520,18), ForeColor = Color.FromArgb(239,198,139), Font = new Font("Segoe UI",9) });
        footer.Controls.Add(new Label { Text = "Run only Python you trust. Closing this window stops local jobs.", Bounds = new Rectangle(0,24,520,18), ForeColor = detail.ForeColor, Font = new Font("Segoe UI",9) });
        layout.Controls.Add(footer,0,12);
        var scroll = new Panel { Dock = DockStyle.Fill, AutoScroll = true }; scroll.Controls.Add(layout); Controls.Add(scroll);
        var intro = new LogoIntro(logo) { Dock = DockStyle.Fill, BackColor = BackColor }; Controls.Add(intro); intro.BringToFront();
        timer.Interval = 300; timer.Tick += (s,e) => RefreshStatus();
        Shown += (s,e) => { var area = Screen.FromControl(this).WorkingArea; if (Height > area.Height) { Height = area.Height; Top = area.Top; } StartHelper(); intro.Start(); };
        FormClosing += (s,e) => { closing = true; timer.Stop(); StopHelper(); };
        ResumeLayout(true);
    }
    void StyleButton(Button button, string text) {
        button.Text = text; button.Dock = DockStyle.Fill; button.Margin = Padding.Empty;
        button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderColor = Color.FromArgb(53,49,63);
        button.BackColor = Color.FromArgb(27,25,35); button.ForeColor = Color.FromArgb(221,215,230); button.UseMnemonic = true;
        button.Font = new Font("Segoe UI Semibold",10.5f); button.Cursor = Cursors.Hand;
    }
    void ShowPairingState(bool connected, bool consumed, bool locked, bool expired, int minutes) {
        connected = connected && consumed;
        bool warning = !connected && !consumed && (locked || expired);
        Color accent = Color.FromArgb(183,155,232), ink = Color.FromArgb(26,17,40), surface = Color.FromArgb(27,25,35);
        state.Text = connected ? "Browser connected" : locked ? "Code locked" : consumed ? "Ready · code used" : expired ? "Connection code expired" : "Ready to connect";
        state.ForeColor = code.ForeColor = warning ? Color.FromArgb(239,198,139) : ForeColor;
        indicator.ForeColor = warning ? state.ForeColor : Color.FromArgb(164,215,188);
        detail.Text = connected ? "Authenticated browser activity in the last 15 seconds.\nYour local research engine is ready." : consumed ? "Your local Python engine is running.\nWaiting for browser activity." : locked ? "Five attempts used. Generate a new code to try again." : expired ? "Your local Python engine is still running.\nPreviously paired browsers can reconnect." : "Your local Python engine is running.\nConnect it to ZTerminal to start researching.";
        pairingTitle.Text = connected || consumed ? "CONNECTION" : "CONNECTION CODE";
        code.Text = connected ? "PAIRED" : consumed ? "CODE USED" : locked ? "LOCKED" : expired ? "EXPIRED" : currentCode.Substring(0,4) + " " + currentCode.Substring(4);
        pairing.BackColor = warning ? Color.FromArgb(43,35,28) : surface;
        pairingDetail.Text = connected ? "Pairing code used. Keep this window open while\nyou work in ZTerminal." : consumed ? "Choose Pair another browser to create a new code.\nPreviously paired browsers can reconnect." : warning ? "Generate a new code to connect another browser.\nYour research archives stay in place." : "In ZTerminal, open Python Strategy and paste this code.\nOne use · Expires in " + minutes + " min";
        bool single = connected || consumed || warning;
        copy.Visible = !single; copy.Enabled = !single;
        renew.Enabled = true;
        actions.SetColumnSpan(renew, 1); actions.SetColumn(renew, single ? 0 : 1); actions.SetColumnSpan(renew, single ? 2 : 1);
        renew.Margin = single ? Padding.Empty : new Padding(6,0,0,0);
        renew.Text = connected || consumed ? "&Pair another browser" : warning ? "&Generate new code" : "&New code";
        renew.BackColor = warning ? accent : surface; renew.ForeColor = warning ? ink : Color.FromArgb(221,215,230);
        open.BackColor = warning ? surface : accent; open.ForeColor = warning ? Color.FromArgb(221,215,230) : ink;
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
        if ((DateTime.UtcNow - copied).TotalSeconds > 2) copy.Text = "&Copy code";
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
            ShowPairingState(connected, consumed, locked, expired, Math.Max(0, (int)Math.Ceiling((Convert.ToDouble(pair["expiresAt"]) - now) / 60000)));
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
                            shortcut.TargetPath = Path.Combine(destination, "ZTerminalResearchHelper.exe"); shortcut.WorkingDirectory = destination; shortcut.IconLocation = shortcut.TargetPath + ",0"; shortcut.Save();
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

class HelperCard : Panel {
    public HelperCard() { DoubleBuffered = true; }
    protected override void OnPaintBackground(PaintEventArgs e) {
        e.Graphics.Clear(Parent.BackColor); e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using (var path = HelperButton.Outline(new Rectangle(0,0,Width-1,Height-1),8))
        using (var fill = new SolidBrush(BackColor)) e.Graphics.FillPath(fill,path);
    }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);
        using (var path = HelperButton.Outline(new Rectangle(0,0,Width-1,Height-1),8))
        using (var pen = new Pen(Color.FromArgb(53,49,63))) { e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; e.Graphics.DrawPath(pen,path); }
    }
}
class HelperButton : Button {
    public HelperButton() { DoubleBuffered = true; }
    internal static System.Drawing.Drawing2D.GraphicsPath Outline(Rectangle bounds, int radius) {
        var path = new System.Drawing.Drawing2D.GraphicsPath(); int d = radius*2;
        path.AddArc(bounds.Left,bounds.Top,d,d,180,90); path.AddArc(bounds.Right-d,bounds.Top,d,d,270,90);
        path.AddArc(bounds.Right-d,bounds.Bottom-d,d,d,0,90); path.AddArc(bounds.Left,bounds.Bottom-d,d,d,90,90); path.CloseFigure(); return path;
    }
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(Parent.BackColor); e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using (var path = Outline(new Rectangle(0,0,Width-1,Height-1),6))
        using (var fill = new SolidBrush(Enabled ? BackColor : Color.FromArgb(32,30,39)))
        using (var border = new Pen(FlatAppearance.BorderColor)) { e.Graphics.FillPath(fill,path); e.Graphics.DrawPath(border,path); }
        TextRenderer.DrawText(e.Graphics,Text,Font,ClientRectangle,Enabled ? ForeColor : SystemColors.GrayText,TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | (ShowKeyboardCues ? 0 : TextFormatFlags.HidePrefix));
        if (Focused && ShowFocusCues) ControlPaint.DrawFocusRectangle(e.Graphics,Rectangle.Inflate(ClientRectangle,-4,-4),ForeColor,BackColor);
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
