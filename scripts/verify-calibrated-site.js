const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../calibrated-captures');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleLogs.push({ type: 'error', text: err.message }));

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1600);

  // 1. Initial Hero
  await page.screenshot({ path: path.join(OUT_DIR, '01_hero_initial.png') });
  console.log('Captured 01_hero_initial.png');

  // 2. Stepped scroll test
  const scrollOffsets = [
    { y: 350, label: '02_hero_scroll_header_clearance' },
    { y: 900, label: '03_section02_quantitative_advantage' },
    { y: 1750, label: '04_section03_workflow_sequence' },
    { y: 2300, label: '05_section03_workflow_progress' },
    { y: 3350, label: '06_section04_sticky_canvas' },
    { y: 4300, label: '07_section05_strategy_lab' },
    { y: 5350, label: '08_section06_speed_privacy' },
    { y: 6250, label: '09_section07_trio_risk' },
    { y: 7200, label: '10_section08_manifesto' },
    { y: 8000, label: '11_section10_windows_cta' },
  ];

  for (const step of scrollOffsets) {
    await page.evaluate((targetY) => window.scrollTo({ top: targetY, behavior: 'smooth' }), step.y);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, `${step.label}.png`) });
    console.log(`Captured ${step.label} at y=${step.y}`);
  }

  // 3. Fast scroll and Reverse scroll test
  console.log('Testing reverse scroll to top...');
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '12_reverse_to_top.png') });
  console.log('Captured 12_reverse_to_top.png');

  // 4. Mobile Viewport (390x844)
  console.log('Testing mobile viewport 390x844...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '13_mobile_hero.png') });

  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, '14_mobile_problem.png') });

  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'smooth' }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, '15_mobile_workflow.png') });

  // 5. Tablet Viewport (768x1024)
  console.log('Testing tablet viewport 768x1024...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '16_tablet_hero.png') });

  // 6. Inspect public routes /docs and /terminal
    console.log('Testing /docs route...');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/docs', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '17_docs_page.png') });

    console.log('Testing /terminal route...');
    await page.goto('http://localhost:3000/terminal', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '18_terminal_page.png') });

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
    consoleErrors: consoleLogs.filter(l => l.type === 'error'),
    allLogs: consoleLogs.slice(0, 20)
  }, null, 2));

  console.log('All verification captures completed successfully!');
  await browser.close();
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
