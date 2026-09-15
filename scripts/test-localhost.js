const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const first = document.querySelector('[class*="first"]');
    return {
      inline: first ? first.getAttribute('style') : null,
      computed: first ? window.getComputedStyle(first).opacity : null,
    };
  });
  console.log('Localhost result:', res);

  await page.screenshot({ path: 'calibrated-captures/localhost_hero.png' });
  console.log('Saved localhost_hero.png');
  await browser.close();
}

test();
