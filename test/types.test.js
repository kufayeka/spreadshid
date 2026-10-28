// The package's TypeScript types, checked as a host uses them: test/types/host.tsx compiled with strict against dist/types. The mistakes marked
// @ts-expect-error in it must be caught (an unused one fails the compile), so types that grow too loose fail here.
//   node test/types.test.js     (needs a build: npm run build)
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
try {
    execFileSync(process.execPath, [tsc, '-p', join(here, 'types', 'tsconfig.json')], { encoding: 'utf8' });
} catch (err) {
    console.log(err.stdout || err.message);
    console.log('FAIL the types of the package do not hold for a host');
    process.exit(1);
}
console.log('ok   a host written in strict TypeScript compiles, and its marked mistakes are caught');
console.log('\nALL OK');
