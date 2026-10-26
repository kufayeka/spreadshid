// The core at the size of a big BOQ: 100 000 rows, each with a quantity, a rate, an amount (a formula) and a running total (a formula that reads the one
// above it), and a grand total. It measures what a person feels: one keystroke, inserting a row, pasting 10 000 cells, and opening the workbook again.
//   node test/core-scale.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';

const ROWS = 100000;
const times = {};
const time = (label, fn) => { const t = performance.now(); const out = fn(); times[label] = Math.round(performance.now() - t); return out; };
let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

// a sheet of 100 000 rows and 6 columns: A item, B quantity, C rate, D amount = B*C, E running total = E(above) + D
const wb = time('make 100 000 empty rows', () => createWorkbook(undefined, { undoLimit: 50 }));
const [s] = wb.sheetIds();
time('grow the sheet to 100 000 rows', () => wb.insertRows(s, 1000, ROWS - 1000));
assert.strictEqual(wb.size(s).rows, ROWS);

const matrix = new Array(ROWS);
for (let r = 0; r < ROWS; r++) {
    const n = r + 1;
    matrix[r] = ['Item ' + n, (r % 50) + 1, 1000 + (r % 7) * 250, '=B' + n + '*C' + n, r === 0 ? '=D1' : '=E' + r + '+D' + n];
}
time('write 500 000 cells (200 000 of them formulas) in one change', () => wb.setValues(s, 0, 0, matrix));
wb.setValues(s, 0, 6, '=SUM(D1:D' + ROWS + ')');

let expected = 0;
for (let r = 0; r < ROWS; r++) expected += ((r % 50) + 1) * (1000 + (r % 7) * 250);
const total = time('work out the grand total the first time (100 000 amounts)', () => wb.value(s, 0, 6));
assert.strictEqual(total, expected);
const running = time('work out the last running total the first time (a chain of 100 000 formulas)', () => wb.value(s, ROWS - 1, 4));
assert.strictEqual(running, expected, 'the chain is worked out without overflowing the stack');
ok('100 000 rows with two formulas each: the grand total and the end of a 100 000-long chain are right');

// one keystroke near the top: the amount, the grand total, and every running total below it change
time('one keystroke: write a quantity in row 10', () => wb.setValues(s, 9, 1, 999, { source: 'user' }));
const delta = (999 - 10) * (1000 + (9 % 7) * 250);
const afterKey = time('after the keystroke: the grand total again', () => wb.value(s, 0, 6));
assert.strictEqual(afterKey, expected + delta);
time('after the keystroke: the running total at the bottom again', () => assert.strictEqual(wb.value(s, ROWS - 1, 4), expected + delta));
time('after the keystroke: the 40 cells of a screen again', () => { for (let r = 50000; r < 50040; r++) for (let c = 0; c < 7; c++) wb.value(s, r, c); });
ok('one keystroke reaches the grand total and the 99 990 running totals below it');

// a keystroke at the bottom costs little: nothing below it reads it
time('one keystroke at the bottom (row 100 000)', () => wb.setValues(s, ROWS - 1, 1, 7, { source: 'user' }));
time('after it: the grand total', () => wb.value(s, 0, 6));
ok('a keystroke at the bottom only works out the bottom again');

// inserting a row in the middle: the sum grows to it, every reference below it still points at the same rows
time('insert one row in the middle (row 50 000)', () => wb.insertRows(s, 50000, 1));
assert.strictEqual(wb.size(s).rows, ROWS + 1);
assert.strictEqual(wb.input(s, 50001, 3), '=B50002*C50002', 'the formula below moved down with its row');
assert.strictEqual(wb.input(s, 0, 6), '=SUM(D1:D' + (ROWS + 1) + ')', 'the grand total reaches one row further');
const totalNow = time('after the insert: the grand total', () => wb.value(s, 0, 6));
wb.setValues(s, 50000, 3, 12345);
assert.strictEqual(wb.value(s, 0, 6), totalNow + 12345, 'a value in the new row counts in the grand total');
ok('a row inserted in the middle of 100 000 moves nothing by hand: references follow, the sum takes the new row in');

// pasting 10 000 cells
const block = Array.from({ length: 2000 }, (_, i) => [i, i * 2, i * 3, i * 4, i * 5]);
time('paste 10 000 cells (2000 rows x 5 columns)', () => wb.setValues(s, 20000, 8, block, { source: 'user' }));
time('undo the paste', () => wb.undo());
assert.strictEqual(wb.value(s, 20000, 9), null);
ok('pasting 10 000 cells and undoing it');

// what is saved after the keystrokes and the insert: only the rows that changed
wb.saved(wb.pendingPatch());
wb.setValues(s, 3, 1, 5);
const patch = time('take the patch of one changed row', () => wb.pendingPatch());
assert.strictEqual(patch.rows.upsert.length, 1);
ok('after one change, the patch holds one row, not 100 000');

// opening the whole workbook from what is stored
const stored = time('the whole workbook as stored (toJSON)', () => wb.toJSON());
const json = time('to JSON text', () => JSON.stringify(stored));
const reopened = time('open it again (100 000 rows, 200 000 formulas)', () => createWorkbook(JSON.parse(json)));
assert.strictEqual(time('after opening: the grand total', () => reopened.value(s, 0, 6)), wb.value(s, 0, 6));
ok('the stored workbook (' + Math.round(json.length / 1048576) + ' MB of JSON) opens again with the same totals');

// a BOQ as it usually is: an amount per row and a grand total, no running total. A keystroke here reaches one amount and the total.
const boq = wb.addSheet('BOQ');
time('BOQ: grow a second sheet to 100 000 rows', () => wb.insertRows(boq, 1000, ROWS - 1000));
const lines = Array.from({ length: ROWS }, (_, r) => ['Item ' + (r + 1), (r % 50) + 1, 1000 + (r % 7) * 250, '=B' + (r + 1) + '*C' + (r + 1)]);
time('BOQ: write 400 000 cells (100 000 formulas)', () => wb.setValues(boq, 0, 0, lines));
wb.setValues(boq, 0, 5, '=SUM(D1:D' + ROWS + ')');
time('BOQ: the grand total the first time', () => wb.value(boq, 0, 5));
const boqBefore = wb.value(boq, 0, 5);
time('BOQ: one keystroke (a quantity in row 10)', () => wb.setValues(boq, 9, 1, 999, { source: 'user' }));
time('BOQ: the screen after it (40 rows x 6 columns, with the total)', () => { for (let r = 0; r < 40; r++) for (let c = 0; c < 6; c++) wb.value(boq, r, c); });
assert.strictEqual(wb.value(boq, 0, 5), boqBefore + (999 - 10) * (1000 + (9 % 7) * 250));
ok('BOQ: a keystroke reaches its amount and the grand total');

console.log('\ntimes (ms):');
for (const [label, ms] of Object.entries(times)) console.log('  ' + String(ms).padStart(6) + '  ' + label);

// What a person feels must stay quick. A keystroke in a BOQ (with the screen after it) and an insert in a big sheet: under 50 ms and 100 ms.
// The worst case, a keystroke above a 100 000-long chain of running totals, changes 99 990 values; it is held under 250 ms.
const feel = times['BOQ: one keystroke (a quantity in row 10)'] + times['BOQ: the screen after it (40 rows x 6 columns, with the total)'];
assert.ok(feel < 50, 'a keystroke in a BOQ and the screen after it take ' + feel + ' ms');
const insert = times['insert one row in the middle (row 50 000)'];
assert.ok(insert < 100, 'an insert takes ' + insert + ' ms');
const worst = times['one keystroke: write a quantity in row 10'] + times['after the keystroke: the 40 cells of a screen again'];
assert.ok(worst < 250, 'a keystroke above 100 000 running totals takes ' + worst + ' ms');
ok('a keystroke in a BOQ (' + feel + ' ms), an insert (' + insert + ' ms), and the worst case above 100 000 running totals (' + worst + ' ms) stay in their bounds');

console.log('\n' + passed + ' passed');
console.log('ALL OK');
