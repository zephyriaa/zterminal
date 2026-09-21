import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const PORT = 9285;
const TEMP_PROFILE = path.join(process.env.TEMP || 'C:\\Temp', `brave_live_${Date.now()}`);
const OUT_DIR = path.resolve('live_verification_screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const TARGETS = [
  { name: 'live_home_1440', url: 'https://zterminal-web.zephyria-inc.workers.dev/', width: 1440, height: 900, mobile: false },
  { name: 'live_home_390', url: 'https://zterminal-web.zephyria-inc.workers.dev/', width: 390, height: 844, mobile: true },
  { name: 'live_research_1440', url: 'https://zterminal-web.zephyria-inc.workers.dev/research', width: 1440, height: 900, mobile: false },
  { name: 'live_download_1440', url: 'https://zterminal-web.zephyria-inc.workers.dev/download', width: 1440, height: 900, mobile: false },
  { name: 'live_docs_1440', url: 'https://zterminal-web.zephyria-inc.workers.dev/docs', width: 1440, height: 900, mobile: false },
];

async function main() {
  console.log('[live-verifier] Starting browser for live production inspection...');
  const proc = spawn(BRAVE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars'
  ]);

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  for (const t of TARGETS) {
    console.log(`[live-verifier] Navigating to ${t.url} (${t.name})...`);
    const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURI(t.url)}`, { method: 'PUT' });
    const tab = await res.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let idCounter = 1;
    const pending = new Map();
    let loadResolve = null;
    const loadPromise = new Promise(r => { loadResolve = r; });

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.method === 'Page.loadEventFired') {
          if (loadResolve) loadResolve();
        }
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject, timeout } = pending.get(msg.id);
          clearTimeout(timeout);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch {}
    });

    const send = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const id = ++idCounter;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout on CDP ${method}`));
        }, 12000);
        pending.set(id, { resolve, reject, timeout });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    await send('Page.enable');

    await Promise.race([
      loadPromise,
      new Promise(r => setTimeout(r, 3000))
    ]);

    await send('Emulation.setDeviceMetricsOverride', {
      width: t.width,
      height: t.height,
      deviceScaleFactor: 1,
      mobile: t.mobile
    });

    await new Promise(r => setTimeout(r, 600));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(OUT_DIR, `${t.name}.png`);
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`✓ Verified and captured live: ${t.name}.png (${Math.round(shot.data.length / 1024)} KB)`);

    ws.close();
    await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
  }

  proc.kill();
  console.log('[live-verifier] Live verification captures completed successfully.');
}

main().catch(err => {
  console.error('[live-verifier] Fatal:', err);
  process.exit(1);
});
