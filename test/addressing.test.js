// Addresses as text everywhere (a cell "C2", ranges "A1:F1, A6:F6", columns "B:D", rows "2:5") and wb.sheet("BOQ"): the same results as with
// numbers, which keep working; a text that is no address says so.
//   node test/addressing.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setValues(s, 'A1', [['No', 'Pekerjaan', 'Volume', 'Harga', 'Jumlah'], [1, 'Galian', 120, 85000, '=C2*D2'], [2, 'Urugan', 40, 210000, '=C3*D3']]);
    assert.deepStrictEqual([wb.value(s, 'E2'), wb.value(s, 1, 4), wb.input(s, 'E3'), wb.display(s, 'B2').text], [10200000, 10200000, '=C3*D3', 'Galian'], 'a cell by its address or by numbers');
    wb.setStyle(s, 'A1:E1', { bold: true });
    wb.setStyle(s, 'D2:E3, A5', { format: { type: 'money', decimals: 0 } });
    assert.deepStrictEqual([wb.style(s, 'C1').bold, wb.display(s, 'E2').text, wb.style(s, 'A5').format.type], [true, 'Rp 10.200.000', 'money'], 'one range, and several in one text');
    wb.setColProps(s, 'B', { width: 160 });
    wb.setColProps(s, 'D:E', { width: 130 });
    wb.setRowProps(s, '1', { height: 30 });
    assert.deepStrictEqual([wb.colProps(s, 1).width, wb.colProps(s, 3).width, wb.colProps(s, 4).width, wb.rowProps(s, 0).height], [160, 130, 130, 30], 'columns by letter, rows by their number');
    wb.mergeCells(s, 'A5:C5');
    assert.deepStrictEqual(wb.merges(s), [{ r1: 4, c1: 0, r2: 4, c2: 2 }]);
    wb.insertRows(s, '3', 2);
    assert.deepStrictEqual([wb.value(s, 'B5'), wb.input(s, 'E5')], ['Urugan', '=C5*D5'], 'two rows inserted at row 3');
    wb.deleteRows(s, '3:4');
    assert.strictEqual(wb.value(s, 'B3'), 'Urugan', 'rows 3 to 4 deleted');
    wb.insertCols(s, 'C');
    assert.strictEqual(wb.value(s, 'D1'), 'Volume', 'a column inserted at C');
    wb.deleteCols(s, 'C');
    wb.groupRows(s, '2:3');
    assert.deepStrictEqual(wb.rowGroups(s).groups[0], { level: 1, from: 1, to: 2, folded: false }, 'rows grouped by their numbers');
    wb.createFilter(s, 'A1:E3');
    wb.setFilterColumn(s, 'B', { hidden: ['Urugan'] });
    assert.deepStrictEqual([wb.filteredOut(s, 'A3'), wb.filteredOut(s, 2)], [true, true], 'a filter by its range and column letter');
    wb.addName('Volume', s, 'C2:C3');
    assert.deepStrictEqual(wb.nameRange('Volume').range, { r1: 1, c1: 2, r2: 2, c2: 2 });
    wb.addValidation(s, 'C2:C3', { kind: 'number', op: 'gt', a: 0 });
    assert.ok(wb.validationAt(s, 'C3'));
    wb.addConditional(s, 'E2:E3', { op: 'gt', a: 5000000, style: { fill: '#b7e1cd' } });
    assert.deepStrictEqual(wb.conditionalStyleAt(s, 'E2'), { fill: '#b7e1cd' });
    wb.clear(s, 'B2');
    assert.strictEqual(wb.value(s, 'B2'), null);
    assert.throws(() => wb.value(s, 'Z'), /is not the address of a cell/);
    assert.throws(() => wb.setStyle(s, 'A1:B2:C3', {}), /is not a range/);
    assert.throws(() => wb.setColProps(s, '2', {}), /is not a column/);
    ok('addresses as text: cells, ranges (several), columns, rows, insert and delete, groups, filter, names, validation, conditional formatting');
}

{
    const wb = createWorkbook();
    wb.setSheetProps(wb.sheetIds()[0], { name: 'BOQ' });
    const boq = wb.sheet('BOQ');
    boq.setValues('A1', [['Volume', 'Harga', 'Jumlah'], [12.5, 85000, '=A2*B2']]);
    boq.setStyle('A1:C1', { bold: true });
    boq.setColProps('C', { width: 140 });
    assert.deepStrictEqual([boq.value('C2'), boq.style('B1').bold, boq.colProps(2).width, boq.name, boq.id === wb.sheetIds()[0]], [1062500, true, 140, 'BOQ', true], 'wb.sheet: the functions without the sheet');
    wb.setSheetProps(boq.id, { name: 'RAB' });
    assert.strictEqual(boq.name, 'RAB', 'its name is the sheet\'s name now');
    assert.throws(() => wb.sheet('Tidak ada'), /there is no sheet "Tidak ada"/);
    ok('wb.sheet("BOQ"): bound to one sheet by name or id');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
