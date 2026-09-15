const { chromium } = require('playwright');

async function testConsole() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]:', err));

  await page.goto('http://127.0.0.1:3000');
  await page.waitForTimeout(1500);
  await browser.close();
}

testConsole();
