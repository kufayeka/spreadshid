// The documentation is true: every example in it runs, what the pages say an example prints is what it prints now (docs/build.mjs --check), every
// page example renders on a server as Next.js does first (no window, no document), and every picture, link and example file it names is there.
//   node test/docs.test.js     (needs a build: it makes one)
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const examples = join(root, 'docs', 'examples');
let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

execFileSync(process.execPath, [join(root, 'build.js')], { stdio: 'inherit' });
const { documents } = await import(pathToFileURL(join(root, 'docs', 'build.mjs')).href);

// the pages say what their examples are and print, as they are now
try { execFileSync(process.execPath, [join(root, 'docs', 'build.mjs'), '--check'], { cwd: root, encoding: 'utf8', stdio: 'pipe' }); }
catch (err) { assert.fail('the documentation is not up to date with its examples: ' + (err.stdout || err.message)); }
ok('every example in the documentation runs, and its code and output are the ones on the page');

// every page example renders to HTML on a server (the part above its "tampilkan" line: what a reader copies)
const tmp = join(here, '.docs-ssr');
const pages = readdirSync(examples).filter((f) => f.endsWith('.page.js') || f.endsWith('.page.tsx') || f === '01-next-page.js');
for (const name of pages) {
    const text = readFileSync(join(examples, name), 'utf8');
    const code = text.split('// ----- tampilkan -----')[0];
    const out = await build({
        stdin: { contents: code, resolveDir: examples, sourcefile: name, loader: name.endsWith('.tsx') ? 'tsx' : 'jsx' }, bundle: true, write: false, format: 'esm', platform: 'node',
        jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'], loader: { '.css': 'empty' }, logLevel: 'silent'
    });
    // written in the package (and taken away after), so React is found the way a reader's app finds it
    mkdirSync(tmp, { recursive: true });
    const file = join(tmp, name.replace(/\.(js|tsx)$/, '.mjs'));
    writeFileSync(file, out.outputFiles[0].text);
    const mod = await import(pathToFileURL(file).href);
    const html = renderToString(createElement(mod.default));
    // a page that loads its workbook from an API first renders what it shows while loading (the server has no answer yet)
    assert.ok(html.includes('ks-sheet') || html.includes('Memuat'), name + ' renders a sheet (or its loading text) on a server');
}
rmSync(tmp, { recursive: true, force: true });
ok('every page example (' + pages.length + ') renders on a server, as Next.js does first');

// every picture, chapter link and example file the pages name is there, and every example is used
const used = new Set();
for (const doc of documents()) {
    const file = join(root, doc), text = readFileSync(file, 'utf8');
    for (const [, src] of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) assert.ok(existsSync(resolve(dirname(file), src)), doc + ': the picture ' + src + ' is there');
    for (const [, link] of text.matchAll(/\]\(([\w./-]+\.md)(#[\w.-]*)?\)/g)) assert.ok(existsSync(resolve(dirname(file), link)), doc + ': the page ' + link + ' is there');
    for (const [, name] of text.matchAll(/<!-- (?:contoh|hasil|tabel): ([\w./-]+) -->/g)) used.add(name);
}
const unused = readdirSync(examples).filter((f) => /\.(js|ts|tsx|sql)$/.test(f) && !f.endsWith('.d.ts') && !used.has(f));
assert.deepStrictEqual(unused, [], 'every example file is in the documentation');
ok('every picture, link and example file is there, and every example is used');

// the TypeScript examples type-check with strict against the package's own types: what a reader copies compiles in their project
if (readdirSync(examples).some((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))) {
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
    try { execFileSync(process.execPath, [tsc, '-p', join(examples, 'tsconfig.json')], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (err) { assert.fail('the TypeScript examples do not type-check:\n' + (err.stdout || err.message)); }
    ok('every TypeScript example type-checks with strict');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
