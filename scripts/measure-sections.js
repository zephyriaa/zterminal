const { chromium } = require('playwright');

async function measure() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('main > div:nth-child(3) > *'));
    return elements.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id,
        className: el.className,
        offsetTop: el.offsetTop,
        offsetHeight: el.offsetHeight,
      };
    });
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

measure();
