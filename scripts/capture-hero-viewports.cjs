const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\aykhank\\.gemini\\antigravity-ide\\brain\\72f2de54-6cb6-4b11-9633-f45d2e674db0';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  
  const targets = [
    { name: 'hero-1920x1080.png', width: 1920, height: 1080 },
    { name: 'hero-1440x900.png', width: 1440, height: 900 },
    { name: 'hero-1366x768.png', width: 1366, height: 768 },
    { name: 'hero-768x1024.png', width: 768, height: 1024 },
    { name: 'hero-390x844.png', width: 390, height: 844 },
  ];

  for (const t of targets) {
    const context = await browser.newContext({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark'
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600); // let entrance animations resolve
    const outPath = path.join(ARTIFACT_DIR, t.name);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: t.width, height: Math.min(t.height, 1080) } });
    console.log(`Captured ${t.name}`);
    await context.close();
  }

  await browser.close();
  console.log('Finished capturing all viewport screenshots.');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
