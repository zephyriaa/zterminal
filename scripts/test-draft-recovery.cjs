const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium } = require('playwright');

async function main() {
  // Use the production adapter against real Chromium IndexedDB, with two tabs.
  const source = ts.transpileModule(fs.readFileSync('src/lib/local-research/drafts.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const server = http.createServer((_, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Draft recovery test</title>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const tab = async () => {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.addScriptTag({ content: `window.exports = {}; ${source}; window.storage = exports.createDraftStorage();` });
      return page;
    };
    const a = await tab(), b = await tab();
    const key = 'research-drafts-v1';
    const envelope = source => JSON.stringify({ version: 1, state: { drafts: { x: { id: 'x', name: 'Research', source } } } });
    for (const page of [a, b]) assert.equal(await page.evaluate(key => storage.getItem(key), key), null);
    const first = envelope('first tab source'), second = envelope('stale tab source');
    await a.evaluate(([key, value]) => storage.setItem(key, value), [key, first]);
    await b.evaluate(([key, value]) => storage.setItem(key, value), [key, second]);
    assert.equal(await b.evaluate(() => exports.getDraftStorageStatus()), 'conflict');
    // Subsequent changes and removals from the stale tab must stay blocked.
    await b.evaluate(key => storage.removeItem(key), key);
    const reopened = await tab();
    assert.equal(await reopened.evaluate(key => storage.getItem(key), key), first);
    const quota = await tab();
    await quota.evaluate(key => storage.getItem(key), key);
    await quota.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
    await quota.evaluate(([key, value]) => storage.setItem(key, value), [key, second]);
    assert.equal(await quota.evaluate(() => exports.getDraftStorageStatus()), 'failed');
    assert.equal(await reopened.evaluate(key => storage.getItem(key), key), first);
    // Rapid queued writes in the same tab must succeed in order.
    await reopened.evaluate(([key, one, two]) => Promise.all([storage.setItem(key, one), storage.setItem(key, two)]), [key, second, first]);
    assert.equal(await reopened.evaluate(() => exports.getDraftStorageStatus()), 'ready');
    assert.equal(await reopened.evaluate(key => storage.getItem(key), key), first);
    // Corrupt recovery bytes are retained, not replaced by initial defaults.
    await reopened.evaluate(key => storage.setItem(key, '{broken'), key);
    const corrupt = await tab();
    assert.equal(await corrupt.evaluate(async key => { try { await storage.getItem(key); return false; } catch { return true; } }, key), true);
    await corrupt.evaluate(([key, value]) => storage.setItem(key, value), [key, first]);
    assert.equal(await corrupt.evaluate(() => exports.getDraftStorageStatus()), 'failed');
    assert.equal(await corrupt.evaluate(async key => {
      const db = await new Promise(resolve => { const request = indexedDB.open('zterminal-research-drafts', 1); request.onsuccess = () => resolve(request.result); });
      return new Promise(resolve => { const request = db.transaction('drafts').objectStore('drafts').get(key); request.onsuccess = () => { db.close(); resolve(request.result); }; });
    }, key), '{broken');
    await context.close();
    console.log('PASS: cross-tab conflict, stale deletion, queued writes, reload recovery, quota failure, corrupt-record preservation');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
