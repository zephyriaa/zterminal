using System;
using System.Reflection;
using System.Windows.Forms;

// Compile beside Launcher.cs with /main:LauncherChecks; no Python service is started.
class LauncherChecks {
    static readonly BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
    static Control Field(Form form, string name) { return (Control)form.GetType().GetField(name, Private).GetValue(form); }
    static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
    [STAThread] static void Main(string[] args) {
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        using (var form = (Form)Activator.CreateInstance(typeof(ResearchLauncher), true)) {
            typeof(ResearchLauncher).GetField("currentCode", Private).SetValue(form,"7F2A9C41");
            var render = typeof(ResearchLauncher).GetMethod("ShowPairingState", Private);
            foreach (string mode in new [] { "ready", "connected", "expired", "locked", "used", "ready" }) {
                render.Invoke(form,new object[] { mode == "connected", mode == "connected" || mode == "used", mode == "locked", mode == "expired", 10 });
                Check(Field(form,"state").Text != "Starting", "State was not updated");
                Check(Field(form,"code").Text == (mode == "ready" ? "7F2A 9C41" : mode == "connected" ? "PAIRED" : mode == "expired" ? "EXPIRED" : mode == "locked" ? "LOCKED" : "CODE USED"), "Wrong code display: " + mode);
                var actions = (TableLayoutPanel)Field(form,"actions");
                Check(actions.GetColumnSpan(Field(form,"renew")) == (mode == "ready" ? 1 : 2), "Wrong action width: " + mode);
                Check(Field(form,"copy").Enabled == (mode == "ready"), "Copy enabled incorrectly: " + mode);
                Check(Field(form,"renew").Enabled, "Code renewal unavailable: " + mode);
            }
            render.Invoke(form,new object[] { true, false, false, false, 10 });
            Check(Field(form,"code").Text == "7F2A 9C41" && Field(form,"copy").Enabled, "An active browser must not hide the new code for another browser");
            Check(form.Icon != null, "Window icon missing");
            Check(Field(form,"open").Height >= 44, "Primary action is too short");
            Check(Field(form,"actions").Right <= Field(form,"pairing").ClientSize.Width - 20, "Pairing actions overflow the card");
            Check(Field(form,"install").Bottom <= Field(form,"install").Parent.ClientSize.Height, "Install action is clipped");
            if (args.Length == 2 && args[0] == "--preview") {
                string mode = args[1];
                render.Invoke(form,new object[] { mode == "connected", mode == "connected", mode == "locked", mode == "expired", 10 });
                using (var preview = new Form { Text = "ZTerminal Helper — " + mode + " preview (sample data)", ClientSize = form.ClientSize, BackColor = form.BackColor, ForeColor = form.ForeColor, Font = form.Font, Icon = form.Icon, StartPosition = FormStartPosition.CenterScreen }) {
                    Control body = null;
                    foreach (Control control in form.Controls) if (!(control is LogoIntro)) body = control;
                    preview.Controls.Add(body); Application.Run(preview);
                }
            }
        }
        Console.WriteLine("PASS: ready, connected, expired, locked, used, return to ready; copy availability; action widths; native icon.");
    }
}
