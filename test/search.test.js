// Find, replace, sort and the sheets (duplicate, hide) without a screen.
//   node test/search.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';
import { findAll, replaceIn, sortRange } from '../src/core/search.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Bolt M8', 12, '=B1*2'], ['bolt m10', 30, '=B2*2'], ['Nut', 'BOLT', '=A1&"!"']]);
    assert.deepStrictEqual(findAll(wb, s, 'bolt'), [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }], 'any case, part of the cell, shown values (C3 shows "Bolt M8!")');
    assert.deepStrictEqual(findAll(wb, s, 'bolt', { matchCase: true }), [{ r: 1, c: 0 }]);
    assert.deepStrictEqual(findAll(wb, s, 'bolt', { wholeCell: true }), [{ r: 2, c: 1 }]);
    assert.deepStrictEqual(findAll(wb, s, '24'), [{ r: 0, c: 2 }], 'a formula is found by what it shows');
    assert.deepStrictEqual(findAll(wb, s, 'B1', { inFormulas: true }), [{ r: 0, c: 2 }], 'or by what it holds');
    assert.deepStrictEqual(findAll(wb, s, 'm\\d+$', { regex: true }), [{ r: 0, c: 0 }, { r: 1, c: 0 }]);
    ok('find: any case or matching case, part or whole cell, shown values or formulas, regular expressions');

    assert.strictEqual(replaceIn(wb, s, findAll(wb, s, 'bolt'), 'bolt', 'Screw'), 3, 'C3 shows a match but holds a formula: it is not written over');
    assert.deepStrictEqual([wb.value(s, 0, 0), wb.value(s, 1, 0), wb.value(s, 2, 1), wb.value(s, 2, 2)], ['Screw M8', 'Screw m10', 'Screw', 'Screw M8!']);
    replaceIn(wb, s, findAll(wb, s, '*2', { inFormulas: true }), '*2', '*3', { inFormulas: true });
    assert.deepStrictEqual([wb.value(s, 0, 2), wb.input(s, 1, 2)], [36, '=B2*3'], 'replacing in formulas keeps them formulas');
    wb.undo();
    assert.strictEqual(wb.input(s, 1, 2), '=B2*2', 'a replace of many cells is one change');
    ok('replace: the matching parts, read as typed; formulas stay formulas; one undo');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Item', 'Qty', 'Amount'], ['c', 3, '=B2*10'], ['a', 1, '=B3*10'], ['', 5, '=B4*10'], ['b', 2, '=B5*10']]);
    wb.setStyle(s, { r1: 2, c1: 0, r2: 2, c2: 0 }, { bold: true });
    wb.setValues(s, 0, 4, [['=SUM(C2:C5)', '=A3']]);
    sortRange(wb, s, { r1: 1, c1: 0, r2: 4, c2: 2 }, 0, 'asc');
    assert.deepStrictEqual([1, 2, 3, 4].map((r) => wb.value(s, r, 0)), ['a', 'b', 'c', null], 'A to Z, empty last');
    assert.deepStrictEqual([1, 2, 3, 4].map((r) => wb.input(s, r, 2)), ['=B2*10', '=B3*10', '=B4*10', '=B5*10'], 'a formula that moved reads its new row');
    assert.deepStrictEqual([1, 2, 3, 4].map((r) => wb.value(s, r, 2)), [10, 20, 30, 50]);
    assert.deepStrictEqual(wb.style(s, 1, 0), { bold: true }, 'the style moved with its row');
    assert.strictEqual(wb.input(s, 0, 4), '=SUM(C2:C5)', 'a sum over the sorted column still covers it all');
    assert.strictEqual(wb.value(s, 0, 4), 110);
    assert.strictEqual(wb.value(s, 0, 5), 'b', 'a cell elsewhere that reads A3 reads what A3 holds now, as in Google Sheets');
    sortRange(wb, s, { r1: 1, c1: 0, r2: 4, c2: 2 }, 1, 'desc');
    assert.deepStrictEqual([1, 2, 3, 4].map((r) => wb.value(s, r, 1)), [5, 3, 2, 1], 'Z to A by numbers');
    wb.undo(); wb.undo();
    assert.deepStrictEqual([1, 2, 3, 4].map((r) => wb.value(s, r, 0)), ['c', 'a', null, 'b'], 'each sort is one change');
    ok('sort: rows in order by a column, A to Z and Z to A, empty last, formulas follow their row, references into the range stay');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const other = wb.addSheet('Rates');
    wb.setValues(other, 0, 0, 2);
    wb.setValues(s, 0, 0, [[5, '=A1*Rates!A1']]);
    wb.mergeCells(s, { r1: 3, c1: 0, r2: 3, c2: 2 });
    const copy = wb.duplicateSheet(s);
    assert.strictEqual(wb.sheetProps(copy).name, 'Copy of Sheet1');
    assert.deepStrictEqual(wb.sheetIds(), [s, copy, other], 'the copy stands right after its sheet');
    assert.strictEqual(wb.value(copy, 0, 1), 10);
    wb.setValues(copy, 0, 0, 7);
    assert.deepStrictEqual([wb.value(copy, 0, 1), wb.value(s, 0, 1)], [14, 10], 'the copy reads its own cells, not the sheet it came from');
    wb.setValues(other, 0, 0, 3);
    assert.strictEqual(wb.value(copy, 0, 1), 21, 'and still reads the other sheet');
    assert.deepStrictEqual(wb.merges(copy), [{ r1: 3, c1: 0, r2: 3, c2: 2 }]);
    assert.strictEqual(wb.sheetProps(wb.duplicateSheet(s)).name, 'Copy of Sheet1 2');
    wb.hideSheet(other, true);
    assert.strictEqual(wb.sheetProps(other).hidden, true);
    assert.strictEqual(wb.value(s, 0, 1), 15, 'a hidden sheet still counts in formulas');
    wb.hideSheet(copy, true);
    wb.hideSheet(s, true);
    const showing = wb.sheetIds().filter((x) => !wb.sheetProps(x).hidden);
    assert.strictEqual(showing.length, 1, 'one sheet still shows');
    assert.throws(() => wb.hideSheet(showing[0], true), /last sheet that shows/);
    ok('sheets: a duplicate stands on its own and after its sheet, names do not clash, hidden sheets still count, the last one showing stays');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
