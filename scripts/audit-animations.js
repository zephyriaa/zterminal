const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../audit-captures');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function audit() {
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
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Measure initial hero state
  await page.screenshot({ path: path.join(OUT_DIR, '01_hero_initial.png') });
  console.log('Hero screenshot captured.');

  // Stepped scroll inspection
  const scrollSteps = [400, 900, 1500, 2200, 3000, 3800, 4600, 5500, 6500, 7500];
  const auditReport = [];

  for (let i = 0; i < scrollSteps.length; i++) {
    const y = scrollSteps[i];
    await page.evaluate((targetY) => window.scrollTo({ top: targetY, behavior: 'instant' }), y);
    await page.waitForTimeout(250);

    const states = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('section, h1, h2, h3, [class*="stage"], [class*="inspector"], [class*="hud"], [class*="stepItem"], [class*="codeWindow"], [class*="evidencePanel"]'));
      return elements.map(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          text: (el.textContent || '').slice(0, 30).trim(),
          class: (el.className || '').toString().slice(0, 35),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          opacity: style.opacity,
          transform: style.transform,
          inView: rect.top < window.innerHeight && rect.bottom > 0
        };
      });
    });

    auditReport.push({ step: i + 1, scrollY: y, states: states.filter(s => s.inView) });
    await page.screenshot({ path: path.join(OUT_DIR, `step_${i + 1}_y${y}.png`) });
    console.log(`Captured step ${i + 1} at y=${y}`);
  }

  // Test Reverse Scroll
  console.log('Testing reverse scroll...');
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'reverse_scroll_1200.png') });

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'reverse_scroll_top.png') });

  // Test Mobile Viewport (390x844)
  console.log('Testing mobile viewport 390x844...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_hero.png') });

  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_problem.png') });

  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: 'smooth' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_workflow.png') });

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ consoleLogs, auditReport }, null, 2));
  console.log('Audit complete! Output saved to audit-captures.');
  await browser.close();
}

audit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
