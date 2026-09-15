const { chromium } = require('playwright');
const path = require('path');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.resolve(__dirname, '../calibrated-captures/debug_hero.png') });
  console.log('Saved debug_hero.png');
  await browser.close();
}

debug();
