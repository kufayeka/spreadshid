// SUBTOTAL (step R5): a BOQ with chapter totals and a grand total over them that does not count twice; the rows a filter hides left out (9) while SUM
// keeps them; rows hidden by hand and folded groups kept by 9 and left out by 109; worked out again when the filter or a group changes, and undone;
// the other codes; a wrong code; kept as a formula from a file.
//   node test/subtotal.test.js
import assert from 'node:assert';
import { createWorkbook, exportXlsx, importXlsx } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const code = (v) => (v && typeof v === 'object' ? v.code : v);

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setValues(s, 0, 0, [
    ['Item', 'Status', 'Amount'],
    ['1. Tanah', '', '=SUBTOTAL(9,C3:C4)'],
    ['Galian', 'Approved', 10200000],
    ['Urugan', 'Draft', 8300000],
    ['2. Beton', '', '=SUBTOTAL(9,C6:C7)'],
    ['Pile', 'Approved', 12500000],
    ['Balok', 'Draft', 29500000],
    ['Total', '', '=SUBTOTAL(9,C2:C7)'],
    ['Total with SUM', '', '=SUM(C3:C4,C6:C7)'],
    ['Visible only', '', '=SUBTOTAL(109,C3:C7)']
]);
const total = () => wb.value(s, 7, 2);

assert.deepStrictEqual([wb.value(s, 1, 2), wb.value(s, 4, 2), total()], [18500000, 42000000, 60500000], 'chapter totals, and a grand total over them that leaves the chapter totals out');
ok('a BOQ: chapter totals and a grand total that does not count them twice');

wb.createFilter(s, { r1: 0, c1: 0, r2: 6, c2: 2 });
wb.setFilterColumn(s, 1, { hidden: ['Draft'] });
assert.deepStrictEqual([wb.value(s, 1, 2), total(), wb.value(s, 8, 2)], [10200000, 22700000, 60500000], 'filtered to Approved: SUBTOTAL counts what shows, SUM everything');
wb.undo();
assert.strictEqual(total(), 60500000, 'the filter undone: worked out again');
wb.redo();
assert.strictEqual(total(), 22700000, 'and redone');
wb.removeFilter(s);
assert.strictEqual(total(), 60500000);
ok('the rows a filter hides are left out (SUM keeps them); worked out again when the filter changes, undone, redone');

wb.setRowProps(s, [3], { hidden: true });
assert.deepStrictEqual([wb.value(s, 1, 2), wb.value(s, 9, 2)], [18500000, 52200000], 'a row hidden by hand: 9 keeps it, 109 leaves it out');
wb.setRowProps(s, [3], { hidden: null });
wb.groupRows(s, 5, 6);
wb.foldRowGroup(s, 5, 1, true);
assert.deepStrictEqual([wb.value(s, 4, 2), wb.value(s, 9, 2)], [42000000, 18500000], 'a folded group: 9 keeps its rows, 109 leaves them out');
wb.foldRowGroup(s, 5, 1, false);
assert.strictEqual(wb.value(s, 9, 2), 60500000, 'opened: back');
ok('rows hidden by hand and folded groups: kept by 1-11, left out by 101-111');

wb.setValues(s, 11, 0, [['=SUBTOTAL(1,C3:C4)', '=SUBTOTAL(2,C3:C7)', '=SUBTOTAL(3,A3:A7)', '=SUBTOTAL(4,C3:C7)', '=SUBTOTAL(5,C3:C7)', '=SUBTOTAL(12,C3:C7)', '=SUBTOTAL(9,C3,C6)']]);
assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map((c) => code(wb.value(s, 11, c))), [9250000, 4, 5, 29500000, 8300000, '#VALUE!', 22700000], 'AVERAGE, COUNT (the chapter total in C5 is left out), COUNTA, MAX, MIN, a wrong code, single cells');
ok('the codes: AVERAGE, COUNT, COUNTA, MAX, MIN, cells as well as ranges; a wrong code is #VALUE!');

const { workbook: back, warnings } = await importXlsx(exportXlsx(wb));
const b = back.sheetIds()[0];
assert.deepStrictEqual(warnings, []);
assert.deepStrictEqual([back.input(b, 7, 2), back.value(b, 7, 2)], ['=SUBTOTAL(9,C2:C7)', 60500000], 'a SUBTOTAL from a file is a formula');
ok('SUBTOTAL out to .xlsx and back as a formula');

console.log('\n' + passed + ' passed');
console.log('ALL OK');
