const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const PORT = 3124;
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) {
            resolve();
          } else if (Date.now() - start > timeoutMs) {
            reject(new Error(`Server returned status ${res.statusCode}`));
          } else {
            setTimeout(check, 400);
          }
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for server at ${url}`));
          } else {
            setTimeout(check, 400);
          }
        });
    };
    check();
  });
}

async function runBrowserTests() {
  console.log(`Starting standalone Next.js server on port ${PORT}...`);
  const server = spawn(process.execPath, ['.next/standalone/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: 'inherit',
  });

  try {
    await waitForServer(`${BASE_URL}/`);
    console.log('Server is ready. Launching Playwright browser...');

    const browser = await chromium.launch({ headless: true });

    // 1. Desktop Test (1440x900)
    console.log('\n--- 1. Testing Desktop Landing Page (1440x900) ---');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      // Verify Account button is present in signed-out state
      const accountBtn = page.getByRole('button', { name: /Account and sign-in menu/i });
      await accountBtn.waitFor({ state: 'visible', timeout: 10000 });
      assert.ok(await accountBtn.isVisible(), 'Account button should be visible');

      // Verify text
      const nameText = await accountBtn.locator('[class*="accountName"]').textContent();
      const statusText = await accountBtn.locator('[class*="accountStatus"]').textContent();
      assert.equal(nameText.trim(), 'Account');
      assert.equal(statusText.trim(), 'Sign in or manage profile');
      console.log('✓ Signed-out button text verified: "Account" / "Sign in or manage profile"');

      // Click to open dropdown
      await accountBtn.click();
      const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
      await dropdown.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await dropdown.isVisible(), 'Account dropdown should open on click');

      // Check dropdown contents
      const dropdownText = await dropdown.textContent();
      assert.match(dropdownText, /ZT Research Identity/i);
      assert.match(dropdownText, /Connect your verified Google account/i);
      console.log('✓ Dropdown contents verified for signed-out visitor');

      // Check Escape key closes dropdown
      await page.keyboard.press('Escape');
      await dropdown.waitFor({ state: 'hidden', timeout: 5000 });
      assert.ok(await dropdown.isHidden(), 'Escape closes the dropdown');
      console.log('✓ Escape key closes dropdown');

      // Open dropdown again and click "Open in Terminal"
      await accountBtn.click();
      await dropdown.waitFor({ state: 'visible' });
      const terminalLink = dropdown.getByRole('link', { name: /Open in Terminal/i });
      await terminalLink.click();
      await page.waitForURL(/.*terminal.*/, { timeout: 15000 });
      console.log('✓ Clicked "Open in Terminal" and navigated to /terminal');

      // No unexpected console errors on landing
      const fatalErrors = consoleErrors.filter((err) => !/Failed to load resource/i.test(err));
      assert.equal(fatalErrors.length, 0, `No fatal console errors: ${fatalErrors.join(', ')}`);
      await context.close();
    }

    // 2. Mobile Responsive Test (390x844)
    console.log('\n--- 2. Testing Mobile Responsive View (390x844) ---');
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      // Verify page does not have horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      assert.equal(overflow, false, 'Landing page should not have horizontal overflow at 390px');
      console.log('✓ Zero horizontal overflow at 390px');

      // Mobile hamburger button
      const menuBtn = page.getByRole('button', { name: /Open navigation/i });
      await menuBtn.waitFor({ state: 'visible' });
      await menuBtn.click();

      // Inside mobile nav, Account control is accessible
      const mobileAccountBtn = page.getByRole('button', { name: /Account and sign-in menu/i });
      await mobileAccountBtn.waitFor({ state: 'visible' });
      assert.ok(await mobileAccountBtn.isVisible(), 'Account button visible in mobile navigation');

      // Click to open dropdown on mobile
      await mobileAccountBtn.click();
      const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
      await dropdown.waitFor({ state: 'visible' });
      assert.ok(await dropdown.isVisible(), 'Dropdown opens on mobile without layout break');
      console.log('✓ Mobile navigation and Account dropdown fully functional at 390px');

      await context.close();
    }

    // 3. Tablet Responsive Test (768x1024)
    console.log('\n--- 3. Testing Tablet Responsive View (768x1024) ---');
    {
      const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      const menuBtn = page.getByRole('button', { name: /Open navigation/i });
      await menuBtn.waitFor({ state: 'visible' });
      await menuBtn.click();

      const accountBtn = page.getByRole('button', { name: /Account and sign-in menu/i });
      await accountBtn.waitFor({ state: 'visible' });
      assert.ok(await accountBtn.isVisible(), 'Account button accessible at 768px');
      console.log('✓ Tablet navigation and Account control verified at 768px');

      await context.close();
    }

    // 4. Other Public Pages Test (/docs, /research, /download)
    console.log('\n--- 4. Testing Consistency Across Public Pages ---');
    for (const route of ['/docs', '/research', '/download']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      const accountBtn = page.getByRole('button', { name: /Account and sign-in menu/i });
      await accountBtn.waitFor({ state: 'visible', timeout: 10000 });
      assert.ok(await accountBtn.isVisible(), `Account button visible on ${route}`);

      await accountBtn.click();
      const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
      await dropdown.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await dropdown.isVisible(), `Account dropdown opens on ${route}`);
      console.log(`✓ Verified Account control on ${route}`);

      await context.close();
    }

    // 5. Authenticated Session Test (Full Profile, Avatar, Dropdown, Sign Out)
    console.log('\n--- 5. Testing Authenticated Session & Sign-Out Flow ---');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();

      let isSessionActive = true;
      const mockUser = {
        name: 'Senior Quant Strategist',
        email: 'quant@zterminal.test',
        image: 'https://lh3.googleusercontent.com/a/mock-quant-avatar=s96-c',
      };

      // Intercept session endpoint to simulate established Auth.js session
      await page.route('**/api/auth/session', (route) => {
        if (isSessionActive) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: mockUser,
              expires: '2099-01-01T00:00:00.000Z',
            }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
          });
        }
      });

      // Intercept signout to update session state
      await page.route('**/api/auth/signout', (route) => {
        isSessionActive = false;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: `${BASE_URL}/` }),
        });
      });

      // Navigate to landing page
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

      // Verify authenticated Account button
      const authAccountBtn = page.getByRole('button', { name: /Account menu for Senior Quant Strategist/i });
      await authAccountBtn.waitFor({ state: 'visible', timeout: 10000 });
      assert.ok(await authAccountBtn.isVisible(), 'Authenticated account button should be visible');

      // Verify user display name and email in button
      const nameText = await authAccountBtn.locator('[class*="accountName"]').textContent();
      const statusText = await authAccountBtn.locator('[class*="accountStatus"]').textContent();
      assert.equal(nameText.trim(), 'Senior Quant Strategist');
      assert.equal(statusText.trim(), 'quant@zterminal.test');

      // Verify real avatar image is rendered
      const avatarImg = authAccountBtn.locator('img[src*="mock-quant-avatar"]');
      assert.ok(await avatarImg.isVisible(), 'Avatar image should be displayed');
      console.log('✓ Authenticated button renders real name, email, and avatar image');

      // Open dropdown
      await authAccountBtn.click();
      const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
      await dropdown.waitFor({ state: 'visible' });

      // Verify dropdown details
      assert.match(await dropdown.textContent(), /Senior Quant Strategist/);
      assert.match(await dropdown.textContent(), /quant@zterminal\.test/);
      assert.match(await dropdown.textContent(), /Verified/);
      assert.match(await dropdown.textContent(), /Cloud Workspaces Sync Active/);
      assert.match(await dropdown.textContent(), /Manage Profile & Avatar/);
      console.log('✓ Authenticated dropdown presents profile details, verified badge, and sync status');

      // Click Sign Out
      const signOutBtn = dropdown.getByRole('menuitem', { name: /Sign out/i });
      await signOutBtn.click();

      // Verify UI returns to signed-out state
      const signedOutBtn = page.getByRole('button', { name: /Account and sign-in menu/i });
      await signedOutBtn.waitFor({ state: 'visible', timeout: 10000 });
      const signedOutName = await signedOutBtn.locator('[class*="accountName"]').textContent();
      assert.equal(signedOutName.trim(), 'Account');
      console.log('✓ Sign-out successfully invalidates session and updates header to signed-out state');

      await context.close();
    }

    await browser.close();
    console.log('\n========================================');
    console.log('ALL BROWSER E2E TESTS PASSED SUCCESSFULLY');
    console.log('========================================\n');
  } finally {
    server.kill();
  }
}

runBrowserTests().catch((err) => {
  console.error('Browser E2E test failed:', err);
  process.exit(1);
});
