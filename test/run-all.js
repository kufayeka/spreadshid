// Runs every test, one after the other, each in its own process: node test/run-all.js
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TESTS = ['ssr.test.js', 'chrome-smoke.test.js'];

execFileSync(process.execPath, [join(here, '..', 'build.js')], { stdio: 'inherit' });
let failed = 0;
for (const t of TESTS) {
    console.log('\n== ' + t);
    try { execFileSync(process.execPath, [join(here, t)], { stdio: 'inherit' }); } catch { failed++; }
}
console.log(failed ? '\n' + failed + ' test file(s) FAILED' : '\nEVERY TEST OK');
process.exit(failed ? 1 : 0);
