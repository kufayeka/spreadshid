// Builds the package: two ES modules (the React part and the core, which has no React and no DOM so that a server can run it), the stylesheet, and the type
// declarations that TypeScript users get, written from the JSDoc comments of the JavaScript sources.
//   node build.js            build everything
//   node build.js --no-types skip the declarations (they take a few seconds; the tests of the core do not need them)
//   node build.js --watch    build once, then build again whenever a file in src changes (the playground uses this, so a change shows at once)

import { build, context } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const watch = process.argv.includes('--watch');
const withTypes = !process.argv.includes('--no-types') && !watch;

// a watch keeps dist as it is (its types come from the last full build); a full build starts from an empty dist
if (!watch) rmSync(join(here, 'dist'), { recursive: true, force: true });
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
const reactEntry = { ...shared, entryPoints: [join(here, 'src', 'index.js')], outfile: join(here, 'dist', 'index.js'), banner: { js: '"use client";' } };
const coreEntry = { ...shared, entryPoints: [join(here, 'src', 'core', 'index.js')], outfile: join(here, 'dist', 'core.js') };
copyFileSync(join(here, 'src', 'sheet.css'), join(here, 'dist', 'sheet.css'));

if (watch) {
    // In watch mode the types are left out (tsc is slow, and the hand-written ones are already in dist from the last full build). The stylesheet is copied
    // again whenever it is saved, because esbuild only watches the JavaScript it bundles.
    const say = { name: 'say', setup(b) { b.onEnd((r) => console.log(new Date().toLocaleTimeString() + ' built ' + b.initialOptions.outfile.split(/[\\/]/).pop() + (r.errors.length ? ' with ' + r.errors.length + ' errors' : ''))); } };
    for (const entry of [reactEntry, coreEntry]) await (await context({ ...entry, plugins: [say] })).watch();
    const { watch: watchFile } = await import('node:fs');
    watchFile(join(here, 'src', 'sheet.css'), () => copyFileSync(join(here, 'src', 'sheet.css'), join(here, 'dist', 'sheet.css')));
    console.log('watching src for changes');
} else {
    await build(reactEntry);
    await build(coreEntry);
}

if (withTypes) {
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(here, 'tsconfig.json')], { stdio: 'inherit' });
    // the public types are written by hand (src/types): the ones made from the JSDoc lose most of what a host needs. They take the place of the
    // made ones at the two entries of the package
    copyFileSync(join(here, 'src', 'types', 'index.d.ts'), join(here, 'dist', 'types', 'index.d.ts'));
    copyFileSync(join(here, 'src', 'types', 'core.d.ts'), join(here, 'dist', 'types', 'core', 'index.d.ts'));
}
if (!watch) console.log('built ' + (withTypes ? 'with' : 'without') + ' type declarations');
