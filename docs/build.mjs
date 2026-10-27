// Puts the examples into the documentation, so no example in it is written by hand (and none can grow old).
//
// In README.md and docs/*.md:
//   <!-- contoh: nama.js -->  ...  <!-- /contoh -->   the file docs/examples/nama.js, as a block of code (a page stops at its "// ----- tampilkan -----" line:
//                                                    what is under it only puts the page on the screen for the screenshots)
//   <!-- hasil: nama.js -->   ...  <!-- /hasil -->    what `node docs/examples/nama.js` writes, as a block of text
//
//   node docs/build.mjs           writes the documentation again
//   node docs/build.mjs --check   says what is not up to date (and fails), writes nothing (test/docs.test.js runs it)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const examples = join(here, 'examples');
const MOUNT = '// ----- tampilkan -----';

/** The documents: the README and every chapter. */
export const documents = () => ['README.md', ...readdirSync(here).filter((f) => f.endsWith('.md')).sort().map((f) => 'docs/' + f)];

function codeOf(name) {
    const file = join(examples, name);
    if (!existsSync(file)) throw new Error('docs/examples/' + name + ' is not there');
    let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const cut = text.indexOf(MOUNT);
    if (cut >= 0) text = text.slice(0, cut);
    return text.trimEnd();
}

const outputs = new Map();
function outputOf(name) {
    if (!outputs.has(name)) {
        const text = execFileSync(process.execPath, [join(examples, name)], { cwd: root, encoding: 'utf8' });
        outputs.set(name, text.replace(/\r\n/g, '\n').trimEnd());
    }
    return outputs.get(name);
}

/** A document with its examples and their outputs put in. */
export function built(text) {
    return text
        .replace(/<!-- contoh: ([\w.-]+) -->[\s\S]*?<!-- \/contoh -->/g, (m, name) => '<!-- contoh: ' + name + ' -->\n```' + (/\.page\.js$|jsx/.test(name) ? 'jsx' : 'js') + '\n' + codeOf(name) + '\n```\n<!-- /contoh -->')
        .replace(/<!-- hasil: ([\w.-]+) -->[\s\S]*?<!-- \/hasil -->/g, (m, name) => '<!-- hasil: ' + name + ' -->\n```text\n' + outputOf(name) + '\n```\n<!-- /hasil -->');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const check = process.argv.includes('--check');
    let stale = 0;
    for (const doc of documents()) {
        const file = join(root, doc);
        const was = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        const now = built(was);
        if (now === was) continue;
        stale++;
        if (check) console.log('not up to date: ' + doc + ' (node docs/build.mjs)');
        else { writeFileSync(file, now); console.log('written: ' + doc); }
    }
    if (check && stale) process.exit(1);
    if (!check) console.log(stale ? '' : 'everything was up to date');
}
