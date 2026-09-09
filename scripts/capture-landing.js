/* eslint-disable */
const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  
  const targets = [
    { name: 'landing-1440x900.png', width: 1440, height: 900 },
    { name: 'landing-1672x941.png', width: 1672, height: 941 },
    { name: 'landing-1920x1080.png', width: 1920, height: 1080 },
  ];

  for (const t of targets) {
    const context = await browser.newContext({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark'
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const outPath = path.join('C:\\Users\\aykhank\\.gemini\\antigravity\\brain\\5906d434-7e0d-4179-8f27-b03a3f15a88c', t.name);
    await page.screenshot({ path: outPath });
    await context.close();
  }

  await browser.close();
  console.log('Captured all target viewports successfully');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});

