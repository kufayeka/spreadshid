// The reference chapter (docs/12-referensi.md) names everything the library gives: every export of the two entries, every function of a workbook and
// of a sheet handle. A name added to the library and not to the reference fails here.
//   node test/reference.test.js
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as core from '../src/core/index.js';

const text = readFileSync(new URL('../docs/12-referensi.md', import.meta.url), 'utf8');
const named = new Set([...text.matchAll(/`([A-Za-z_][\w.]*)`/g)].map((m) => m[1]));
const missing = (list) => list.filter((n) => !named.has(n));

const react = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const reactNames = [...react.matchAll(/export \{ ([^}]+) \}/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()));
assert.deepStrictEqual(missing(reactNames), [], 'every export of @kufayeka/sheet is in the reference');
assert.deepStrictEqual(missing(Object.keys(core)), [], 'every export of @kufayeka/sheet/core is in the reference');
const wb = core.createWorkbook();
assert.deepStrictEqual(missing(Object.keys(wb).filter((k) => !k.startsWith('_'))), [], 'every function of a workbook is in the reference');
assert.deepStrictEqual(missing(Object.keys(wb.sheet('Sheet1'))), [], 'every function of a sheet handle is in the reference');
// and the hand-written types declare them all, so a TypeScript host has a type for each
const declared = readFileSync(new URL('../src/types/core.d.ts', import.meta.url), 'utf8');
// a name is declared as an export ("function name(", "const name:") or as a member ("    name(", "    name<", "readonly name:")
const typedName = (n) => ['function ' + n + '(', 'const ' + n + ':', '    ' + n + '(', '    ' + n + '<', 'readonly ' + n + ':'].some((form) => declared.includes(form));
const untyped = [...Object.keys(core), ...Object.keys(wb).filter((k) => !k.startsWith('_')), ...Object.keys(wb.sheet('Sheet1'))].filter((n) => !typedName(n));
assert.deepStrictEqual([...new Set(untyped)], [], 'every export and every function is in src/types/core.d.ts');
console.log('ok   the reference names every export, every workbook function and every sheet handle function');
console.log('\nALL OK');
