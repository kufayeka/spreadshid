// The sheet renders on a server (what Next.js does first): importing it and rendering it to HTML must not touch window or document.
//   node test/ssr.test.js     (needs a build: npm run build)
import assert from 'node:assert';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

assert.strictEqual(typeof globalThis.window, 'undefined', 'this test runs where there is no window');
const { Sheet, VERSION } = await import('../dist/index.js');
const html = renderToString(createElement(Sheet, { style: { height: 400 } }));
assert.ok(/role="grid"/.test(html), 'the grid is in the HTML: ' + html);
assert.ok(html.includes('data-sheet-version="' + VERSION + '"'));
const core = await import('../dist/core.js');
assert.strictEqual(core.VERSION, VERSION, 'the core is its own entry, with no React');
console.log('ok   the sheet imports and renders on a server, with no window');
console.log('\nALL OK');
