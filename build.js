// Builds the package: two ES modules (the React part and the core, which has no React and no DOM so that a server can run it), the stylesheet, and the type
// declarations that TypeScript users get, written from the JSDoc comments of the JavaScript sources.
//   node build.js            build everything
//   node build.js --no-types skip the declarations (they take a few seconds; the tests of the core do not need them)

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const withTypes = !process.argv.includes('--no-types');

rmSync(join(here, 'dist'), { recursive: true, force: true });
mkdirSync(join(here, 'dist'), { recursive: true });

const shared = {
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
    sourcemap: true,
    jsx: 'automatic',
    loader: { '.js': 'jsx' },
    // React is the host's (a peer dependency): the package never carries its own copy, or the host would have two Reacts and hooks would break. zag.js is a
    // plain dependency, installed with the package and shared with the host's own copy when the versions agree.
    external: ['react', 'react-dom', 'react/jsx-runtime', '@zag-js/*']
};

// The React part is marked "use client": Next.js renders it on the server once and then hands it to the browser, which is right for an interactive grid.
await build({ ...shared, entryPoints: [join(here, 'src', 'index.js')], outfile: join(here, 'dist', 'index.js'), banner: { js: '"use client";' } });
await build({ ...shared, entryPoints: [join(here, 'src', 'core', 'index.js')], outfile: join(here, 'dist', 'core.js') });
copyFileSync(join(here, 'src', 'sheet.css'), join(here, 'dist', 'sheet.css'));

if (withTypes) {
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(here, 'tsconfig.json')], { stdio: 'inherit' });
}
console.log('built ' + (withTypes ? 'with' : 'without') + ' type declarations');
