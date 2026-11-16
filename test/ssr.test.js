// The sheet renders on a server (what Next.js does first): importing it and rendering it to HTML must not touch window or document.
//   node test/ssr.test.js     (needs a build: npm run build)
import assert from 'node:assert';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

assert.strictEqual(typeof globalThis.window, 'undefined', 'this test runs where there is no window');
const { Sheet, VERSION } = await import('../dist/index.js');
// On a server the sheet always draws its loading skeleton, never the grid: a workbook is full of random ids, so a grid drawn on the server
// would never match the one the browser draws, and React would stop with a hydration error. The browser draws the real sheet right after.
const html = renderToString(createElement(Sheet, { style: { height: 400 } }));
assert.ok(html.includes('ks-loading') && !/role="grid"/.test(html), 'only the skeleton is in the server HTML: ' + html.slice(0, 300));
const core = await import('../dist/core.js');
assert.strictEqual(core.VERSION, VERSION, 'the core is its own entry, with no React');
console.log('ok   the sheet imports and renders on a server, with no window');

// workbook={null}: the host is still fetching it, so the loading skeleton is drawn in the sheet's place, not an empty box nor a blank workbook
const loading = renderToString(createElement(Sheet, { workbook: null, style: { height: 400 } }));
assert.ok(loading.includes('ks-loading') && loading.includes('aria-busy="true"') && !/role="grid"/.test(loading), 'the skeleton: ' + loading.slice(0, 300));
assert.ok(renderToString(createElement(Sheet, { workbook: null, loadingLabel: 'Memuat…' })).includes('Memuat…'), 'the host gives its words');
console.log('ok   workbook={null} shows the loading skeleton');
console.log('\nALL OK');
