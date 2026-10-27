// Runs every test, one after the other, each in its own process: node test/run-all.js
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TESTS = ['core.test.js', 'core-scale.test.js', 'ssr.test.js', 'chrome-smoke.test.js', 'grid-view.test.js', 'grid-edit.test.js', 'grid-resize.test.js', 'transfer.test.js', 'grid-clipboard.test.js', 'search.test.js', 'grid-sheets.test.js', 'format.test.js', 'toolbar.test.js', 'grid-format.test.js', 'control.test.js', 'grid-control.test.js', 'validation.test.js', 'grid-validation.test.js', 'excel.test.js', 'grid-excel.test.js', 'conditional.test.js', 'grid-conditional.test.js', 'names.test.js', 'grid-names.test.js', 'filter.test.js', 'grid-filter.test.js', 'outline.test.js', 'grid-outline.test.js', 'subtotal.test.js', 'policy.test.js', 'grid-access.test.js', 'comments.test.js', 'grid-comments.test.js', 'docs.test.js', 'addressing.test.js'];

execFileSync(process.execPath, [join(here, '..', 'build.js')], { stdio: 'inherit' });
let failed = 0;
for (const t of TESTS) {
    console.log('\n== ' + t);
    try { execFileSync(process.execPath, [join(here, t)], { stdio: 'inherit' }); } catch { failed++; }
}
console.log(failed ? '\n' + failed + ' test file(s) FAILED' : '\nEVERY TEST OK');
process.exit(failed ? 1 : 0);
