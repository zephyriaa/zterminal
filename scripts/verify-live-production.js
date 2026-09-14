const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://zterminal-web.zephyria-inc.workers.dev';
const OUT_DIR = path.resolve(__dirname, '../calibrated-captures/live-production');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function verifyLive() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleLogs.push({ type: 'error', text: err.message }));

  console.log('Navigating to live production:', PROD_URL);
  const response = await page.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Production status code:', response.status());

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT_DIR, 'live_hero.png') });
  console.log('Captured live_hero.png');

  // Scroll to section 02
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, 'live_section02.png') });

  // Scroll to workflow sequence
  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, 'live_workflow.png') });

  // Check /healthz
  console.log('Checking /healthz endpoint...');
  const healthRes = await page.goto(`${PROD_URL}/healthz`, { waitUntil: 'domcontentloaded' });
  const healthText = await page.content();
  console.log('Healthz status:', healthRes.status(), 'content:', healthText.slice(0, 120));

  fs.writeFileSync(path.join(OUT_DIR, 'live_summary.json'), JSON.stringify({
    status: response.status(),
    consoleErrors: consoleLogs.filter(l => l.type === 'error'),
    logs: consoleLogs
  }, null, 2));

  console.log('Live production verification completed!');
  await browser.close();
}

verifyLive().catch(err => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
