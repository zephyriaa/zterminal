import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const PORT = 9265;
const TEMP_PROFILE = path.join(process.env.TEMP || 'C:\\Temp', `brave_audit_${Date.now()}`);
const OUT_DIR = path.resolve('audit_screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const ROUTES = [
  { name: '01_home', path: '/' },
  { name: '02_research', path: '/research' },
  { name: '03_download', path: '/download' },
  { name: '04_docs', path: '/docs' },
  { name: '05_docs_python', path: '/docs/python-research' },
  { name: '06_docs_install', path: '/docs/windows/install' },
  { name: '07_not_found', path: '/this-page-does-not-exist' }
];

const VIEWPORTS = [
  { name: '390_mobile', width: 390, height: 844, mobile: true },
  { name: '768_tablet', width: 768, height: 1024, mobile: false },
  { name: '1366_laptop', width: 1366, height: 768, mobile: false },
  { name: '1440_desktop', width: 1440, height: 900, mobile: false },
  { name: '1600_wide', width: 1600, height: 1000, mobile: false }
];

async function captureRoute(route) {
  console.log(`\n========================================`);
  console.log(`Auditing Route: ${route.name} (${route.path})`);
  console.log(`========================================`);

  const tabUrl = `http://127.0.0.1:3000${route.path}`;
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURI(tabUrl)}`, { method: 'PUT' });
  const tab = await res.json();

  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();
  let loadFired = false;
  let loadResolve = null;
  const loadPromise = new Promise(r => { loadResolve = r; });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.loadEventFired') {
        loadFired = true;
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
      }, 10000);
      pending.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  await send('Page.enable');

  // Wait for loadEventFired or fallback 2s
  await Promise.race([
    loadPromise,
    new Promise(r => setTimeout(r, 2000))
  ]);

  // Additional 400ms for CSS fonts/transitions
  await new Promise(r => setTimeout(r, 400));

  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile
    });

    await new Promise(r => setTimeout(r, 300));

    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filename = `${route.name}_${vp.name}.png`;
    const filepath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`✓ Saved ${filename} [${vp.width}x${vp.height}] (${Math.round(screenshot.data.length / 1024)} KB)`);
  }

  ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
}

async function main() {
  console.log('[audit-runner] Spawning browser...');
  const browserProc = spawn(BRAVE_PATH, [
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

  for (const route of ROUTES) {
    try {
      await captureRoute(route);
    } catch (err) {
      console.error(`Error on route ${route.name}:`, err);
    }
  }

  browserProc.kill();
  console.log('\n========================================');
  console.log('[audit-runner] COMPLETE: All routes audited.');
  console.log('========================================');
}

main().catch(err => {
  console.error('[audit-runner] Fatal:', err);
  process.exit(1);
});
