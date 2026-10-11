// Initial busy state and shared-engine offline boundary, without browser/OS input.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const server = await createServer({ configFile: 'apps/workstation/vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { LocalWorkstation } = await server.ssrLoadModule('/workstation.tsx');
  const html = renderToStaticMarkup(createElement(LocalWorkstation, { platform: new Proxy({}, { get() { throw Error('SSR must not call a storage/network service'); } }) }));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled="">New workspace/);
  assert.match(html, /Working locally/);
  const { LocalHistoryChart } = await server.ssrLoadModule('/../../src/components/terminal/observed-history-chart.tsx');
  const input = { bars: [{ t: 60000, o: 10, h: 12, l: 9, c: 11, v: 2 }], symbol: 'TEST ONLY', intervalMs: 60000, from: null, to: null, onRange() {} };
  const local = renderToStaticMarkup(createElement(LocalHistoryChart, input));
  assert.match(local, /terminal-chart-canvas/);
  assert.doesNotMatch(local, /loading…|Market intelligence context/);
  const invalid = renderToStaticMarkup(createElement(LocalHistoryChart, { ...input, intervalMs: 12345 }));
  assert.match(invalid, /Unsupported stored chart interval/);
  assert.doesNotMatch(invalid, /terminal-chart-canvas/);
  console.log('PASS: initial busy controls; shared local chart; unsupported interval withheld, no timeframe substitution');
} finally { await server.close(); }
