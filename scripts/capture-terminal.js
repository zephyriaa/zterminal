/* eslint-disable */
const { chromium } = require('playwright');
const path = require('path');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark'
  });
  const page = await context.newPage();
  
  console.log('Navigating to /terminal...');
  await page.goto('http://localhost:3000/terminal', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(4000); // let charts load
  
  const dest = path.join(__dirname, 'public', 'landing', 'terminal-screenshot.png');
  await page.screenshot({ path: dest });
  
  console.log('Done.');
  await browser.close();
}

run().catch(console.error);
