const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000');
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const el = document.querySelector('[class*="first"]');
    if (!el) return 'not found';
    return {
      inline: el.getAttribute('style'),
      computedOpacity: window.getComputedStyle(el).opacity,
      computedTransform: window.getComputedStyle(el).transform,
      parentStyle: el.parentElement ? el.parentElement.getAttribute('style') : null,
      sectionStyle: el.closest('section') ? el.closest('section').getAttribute('style') : null
    };
  });

  console.log('Result:', JSON.stringify(res, null, 2));
  await browser.close();
}

check();
