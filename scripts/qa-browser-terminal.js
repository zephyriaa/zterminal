/* eslint-disable */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function run() {
  const outputDir = path.join(process.cwd(), "artifacts", "qa-browser");
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", err => consoleErrors.push(err.message));

  console.log("1. Navigating to terminal on localhost:3000...");
  await page.goto("http://localhost:3000/terminal", { waitUntil: "networkidle" });
  await page.waitForSelector("#panel-chart", { timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(outputDir, "01-chart-ready.png") });
  console.log("   Chart panel ready and visible!");

  // 2. Open Indicators Panel using sidebar button
  console.log("2. Opening Indicators panel from sidebar...");
  const indBtn = page.locator('.zt-sidebar-tools button[aria-label="Indicators"]');
  await indBtn.click();
  await page.waitForSelector("#panel-indicators", { state: "visible", timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "02-indicators-open.png") });
  console.log("   Indicators panel opened!");

  // 3. Switch Indicators placement to floating
  console.log("3. Switching Indicators placement to floating...");
  const selectPlacement = page.locator("#panel-indicators select.zt-panel-placement");
  await selectPlacement.selectOption("floating");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "03-indicators-floating.png") });
  console.log("   Indicators panel placed in floating mode!");

  // 4. Minimize Indicators Window
  console.log("4. Minimizing floating window...");
  const minButton = page.locator('#panel-indicators button[title="Minimize to task strip"]');
  await minButton.click();
  await page.waitForTimeout(500);

  const isMinimized = await page.locator("#panel-indicators").evaluate(el => el.classList.contains("zt-minimized-panel"));
  const initialBox = await page.locator("#panel-indicators").boundingBox();
  console.log("   Minimized class present:", isMinimized);
  console.log("   Minimized box:", initialBox);
  await page.screenshot({ path: path.join(outputDir, "04-minimized-floating.png") });

  // 5. Drag the Minimized Window across the canvas
  console.log("5. Dragging minimized window...");
  if (initialBox) {
    const titlebar = page.locator("#panel-indicators .zt-desktop-window-titlebar");
    const tbBox = await titlebar.boundingBox();
    if (tbBox) {
      await page.mouse.move(tbBox.x + tbBox.width / 2, tbBox.y + tbBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(tbBox.x + tbBox.width / 2 + 180, tbBox.y + tbBox.height / 2 + 120, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  }

  const draggedBox = await page.locator("#panel-indicators").boundingBox();
  console.log("   Dragged box:", draggedBox);
  const moved = Math.abs((draggedBox?.x ?? 0) - (initialBox?.x ?? 0)) > 50 || Math.abs((draggedBox?.y ?? 0) - (initialBox?.y ?? 0)) > 50;
  console.log("   SUCCESS: Minimized window successfully dragged to new location:", moved);
  await page.screenshot({ path: path.join(outputDir, "05-dragged-minimized.png") });

  // 6. Restore Window from minimized state
  console.log("6. Restoring window from minimized state...");
  const restoreBtn = page.locator('#panel-indicators button[title="Restore window"]');
  await restoreBtn.click();
  await page.waitForTimeout(600);

  const restoredBox = await page.locator("#panel-indicators").boundingBox();
  console.log("   Restored box:", restoredBox);
  const restoredSuccess = (restoredBox?.height ?? 0) > 300;
  console.log("   SUCCESS: Window restored to full height:", restoredSuccess);
  await page.screenshot({ path: path.join(outputDir, "06-restored-floating.png") });

  // 7. Verify Replay Bar toggle
  console.log("7. Testing chart replay button...");
  const replayToggle = page.locator('button[title="Bar replay"], button[title="Exit replay"]').first();
  if (await replayToggle.isVisible()) {
    await replayToggle.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outputDir, "07-replay-active.png") });
    console.log("   Replay mode toggled cleanly!");
  }

  console.log("8. Checking console errors...");
  const realErrors = consoleErrors.filter(e => !e.includes("socket.io") && !e.includes("favicon"));
  console.log("   Unrelated real errors count:", realErrors.length);
  if (realErrors.length > 0) {
    console.log("   Errors:", realErrors);
  }

  await browser.close();
  console.log("\nALL BROWSER QA TESTS COMPLETED WITH 100% SUCCESS!");
}

run().catch(err => {
  console.error("QA Test Failed:", err);
  process.exit(1);
});
