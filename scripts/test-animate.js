const { chromium } = require('playwright');

async function testAnimate() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  
  for (let t = 0; t <= 3000; t += 500) {
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const first = document.querySelector('[class*="first"]');
      const stage = document.querySelector('[class*="laptopMotionStage"]');
      const problem = document.querySelector('[class*="problemSection"] h2');
      return {
        first: first ? first.getAttribute('style') : null,
        stage: stage ? stage.getAttribute('style') : null,
        problem: problem ? problem.getAttribute('style') : null,
      };
    });
    console.log(`Time ${t}ms:`, state);
  }

  await browser.close();
}

testAnimate();
