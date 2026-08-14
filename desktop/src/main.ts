import { invoke } from "@tauri-apps/api/core";
import { register } from "@tauri-apps/plugin-global-shortcut";
import { calculateFixedRiskSizing } from "../../src/domain/risk/sizing";

type WorkspaceSettings = {
  selectedView: "markets" | "risk" | "trade-plan";
  accountEquity: number;
  riskPercent: number;
  stopDistance: number;
};

type DesktopStatus = {
  executionPermission: "disabled";
  secureStorage: "not_configured";
  windowLabel: string;
};

const STORAGE_KEY = "zterminal.desktop.workspace.v1";
const defaultSettings: WorkspaceSettings = {
  selectedView: "markets",
  accountEquity: 100_000,
  riskPercent: 1,
  stopDistance: 0.02,
};

function loadSettings(): WorkspaceSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(saved) } as WorkspaceSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: WorkspaceSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

let settings = loadSettings();
let paletteOpen = false;
let desktopStatus: DesktopStatus = {
  executionPermission: "disabled",
  secureStorage: "not_configured",
  windowLabel: "main",
};

function tauriAvailable() {
  return "__TAURI_INTERNALS__" in window;
}

function render() {
  const sizing = calculateFixedRiskSizing({
    accountEquity: settings.accountEquity,
    riskPercent: settings.riskPercent,
    stopDistance: settings.stopDistance,
    tickSize: 0.0001,
    multiplier: 1,
  });
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  app.innerHTML = `
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0b1016; color: #edf2f7; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 760px; background: #0b1016; }
      button, input { font: inherit; }
      button { cursor: pointer; }
      .shell { min-height: 100vh; display: grid; grid-template-columns: 190px 1fr; }
      .sidebar { border-right: 1px solid #26313d; background: #0e151e; padding: 16px 10px; }
      .brand { letter-spacing: .14em; font-size: 12px; font-weight: 700; padding: 6px 10px 20px; color: #b7c7d9; }
      .nav { display: grid; gap: 3px; }
      .nav button { text-align: left; color: #8293a8; border: 0; background: transparent; padding: 9px 10px; border-radius: 4px; font-size: 12px; }
      .nav button:hover, .nav button.active { color: #eaf4ff; background: #182431; }
      .main { display: grid; grid-template-rows: 44px 1fr; min-width: 0; }
      .topbar { display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid #26313d; background: #0e151e; }
      .status { margin-left: auto; padding: 3px 7px; color: #c2d3e4; border: 1px solid #5c6e80; font-size: 10px; border-radius: 3px; letter-spacing: .06em; }
      .status.locked { color: #ffcc84; border-color: #806a46; }
      .content { padding: 22px; max-width: 1120px; width: 100%; margin: 0 auto; }
      h1 { font-size: 18px; margin: 0 0 8px; letter-spacing: .02em; }
      p { color: #91a3b6; font-size: 13px; line-height: 1.55; margin: 0 0 16px; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .panel { border: 1px solid #26313d; background: #101923; padding: 15px; border-radius: 5px; }
      .label { color: #8293a8; font-size: 10px; text-transform: uppercase; letter-spacing: .09em; }
      .value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-top: 7px; font-size: 18px; }
      .form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .field { display: grid; gap: 6px; color: #91a3b6; font-size: 11px; }
      input { background: #0b1016; color: #eef7ff; border: 1px solid #354557; border-radius: 4px; padding: 8px; }
      .notice { margin-top: 16px; padding: 12px; border-left: 3px solid #d5963f; background: #241d13; color: #f3d9ac; font-size: 12px; }
      .command { position: fixed; inset: 0; display: grid; place-items: start center; padding-top: 100px; background: rgba(3, 7, 12, .66); }
      .command[hidden] { display: none; }
      .command-box { width: 520px; border: 1px solid #3f5870; background: #111b26; box-shadow: 0 24px 80px rgba(0,0,0,.55); border-radius: 6px; padding: 12px; }
      .command-box button { width: 100%; text-align: left; padding: 10px; color: #dce9f4; background: transparent; border: 0; border-radius: 4px; }
      .command-box button:hover { background: #1d2c3c; }
      .shortcut { color: #8293a8; font-size: 11px; }
    </style>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Z TERMINAL<br><span class="shortcut">DESKTOP ALPHA</span></div>
        <nav class="nav" aria-label="Desktop terminal sections">
          ${navButton("markets", "Markets")}
          ${navButton("risk", "Risk")}
          ${navButton("trade-plan", "Trade Plan")}
        </nav>
      </aside>
      <section class="main">
        <header class="topbar">
          <span class="shortcut">Command palette: Ctrl/Cmd + Shift + P</span>
          <span class="status">LOCAL WORKSPACE</span>
          <span class="status locked">EXECUTION DISABLED</span>
        </header>
        <main class="content">${viewMarkup(sizing)}</main>
      </section>
    </div>
    <div class="command" ${paletteOpen ? "" : "hidden"} id="command-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="command-box">
        <div class="label">Desktop commands</div>
        <button data-view="markets">Open Markets <span class="shortcut">M</span></button>
        <button data-view="risk">Open Risk <span class="shortcut">R</span></button>
        <button data-view="trade-plan">Open Trade Plan <span class="shortcut">T</span></button>
        <button data-close>Close palette <span class="shortcut">Esc</span></button>
      </div>
    </div>
  `;
  bindHandlers();
}

function navButton(view: WorkspaceSettings["selectedView"], label: string) {
  return `<button data-view="${view}" class="${settings.selectedView === view ? "active" : ""}">${label}</button>`;
}

function viewMarkup(sizing: ReturnType<typeof calculateFixedRiskSizing>) {
  if (settings.selectedView === "markets") {
    return `
      <h1>Markets</h1>
      <p>This native client is a local terminal shell. Market streaming will use the same server-side provider contracts as the web product; it does not embed or open the deployed website.</p>
      <div class="grid">
        <section class="panel"><div class="label">Connection</div><div class="value">NOT CONNECTED</div><p>Provider selection and authenticated session handoff are pending the shared API boundary.</p></section>
        <section class="panel"><div class="label">Data freshness</div><div class="value">UNAVAILABLE</div><p>The client never manufactures a live market-data status.</p></section>
        <section class="panel"><div class="label">Workspace</div><div class="value">LOCAL</div><p>Only non-sensitive layout and calculation preferences are persisted locally.</p></section>
      </div>`;
  }
  if (settings.selectedView === "trade-plan") {
    return `
      <h1>Manual Trade Plan</h1>
      <p>A plan can be prepared and risk-evaluated, but this desktop client cannot place, queue, or modify an order.</p>
      <section class="panel"><div class="label">Execution authority</div><div class="value">USER CONTROL REQUIRED</div><p>Broker connectivity, credential storage, and order routing are intentionally not configured. The native layer reports: ${desktopStatus.executionPermission}.</p></section>
      <div class="notice">No broker secret, API key, authentication token, or account credential is stored by this application. Secure credential support will be introduced only with a separate least-privilege design and OS-backed storage verification.</div>`;
  }
  return `
    <h1>Risk</h1>
    <p>The same pure fixed-risk sizing module is used by the web Risk view and this local desktop shell. Values are illustrative and must be reviewed against current instrument specifications, fees, margin, and account policy.</p>
    <div class="form">
      <label class="field">Account equity<input id="equity" type="number" min="0" value="${settings.accountEquity}"></label>
      <label class="field">Risk per trade (%)<input id="risk" type="number" min="0" step="0.01" value="${settings.riskPercent}"></label>
      <label class="field">Stop distance<input id="stop" type="number" min="0" step="0.0001" value="${settings.stopDistance}"></label>
    </div>
    <div class="grid" style="margin-top:16px">
      <section class="panel"><div class="label">Risk amount</div><div class="value">${format(sizing.riskAmount)}</div></section>
      <section class="panel"><div class="label">Per-unit risk</div><div class="value">${format(sizing.perUnitRisk)}</div></section>
      <section class="panel"><div class="label">Maximum quantity</div><div class="value">${sizing.maxQuantity}</div></section>
    </div>
    <div class="notice">This calculation does not approve or submit a trade. Execution remains disabled by design.</div>`;
}

function format(value: number) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
}

function bindHandlers() {
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      settings.selectedView = button.dataset.view as WorkspaceSettings["selectedView"];
      paletteOpen = false;
      saveSettings(settings);
      render();
    });
  });
  document.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", () => {
    paletteOpen = false;
    render();
  });
  const updateNumeric = (id: string, field: keyof Pick<WorkspaceSettings, "accountEquity" | "riskPercent" | "stopDistance">) => {
    document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      settings[field] = Number.isFinite(value) ? value : 0;
      saveSettings(settings);
      render();
    });
  };
  updateNumeric("equity", "accountEquity");
  updateNumeric("risk", "riskPercent");
  updateNumeric("stop", "stopDistance");
}

function togglePalette() {
  paletteOpen = !paletteOpen;
  render();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && paletteOpen) togglePalette();
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    if (!paletteOpen) togglePalette();
  }
});

async function initializeNativeFeatures() {
  if (!tauriAvailable()) return;
  try {
    desktopStatus = await invoke<DesktopStatus>("desktop_status");
    await register("CommandOrControl+Shift+P", togglePalette);
  } catch {
    // Native integrations must fail closed; desktop UI remains usable without elevated privileges.
  } finally {
    render();
  }
}

render();
void initializeNativeFeatures();
