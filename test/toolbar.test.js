// What the toolbar's buttons do, without a screen: toggles from the active cell, one change for a selection of several rectangles, formats with the
// workbook's currency, decimals up and down, borders by place, merges by row and by column, clearing the formatting, the Σ functions.
//   node test/toolbar.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';
import { selectCell, extendTo, addCell } from '../src/core/selection.js';
import { toggle, setPart, setFormat, stepDecimals, setBorders, merge, clearFormatting, functionText } from '../src/react/toolbarActions.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const sel = addCell(extendTo(selectCell(0, 0), 1, 1), 5, 5);
    toggle(wb, s, sel, 'bold');
    assert.deepStrictEqual([wb.style(s, 0, 0), wb.style(s, 1, 1), wb.style(s, 5, 5)], [{ bold: true }, { bold: true }, { bold: true }], 'bold on every rectangle of the selection');
    wb.undo();
    assert.strictEqual(wb.style(s, 5, 5), undefined, 'one change: one undo takes it from all of them');
    toggle(wb, s, sel, 'bold');
    toggle(wb, s, selectCell(5, 5), 'bold');
    assert.strictEqual(wb.style(s, 5, 5), undefined, 'a bold active cell turns bold off');
    setPart(wb, s, sel, 'fill', '#ff0000');
    setPart(wb, s, sel, 'fill', null);
    assert.deepStrictEqual(wb.style(s, 0, 0), { bold: true }, 'null takes a part of the style away');
    ok('toggles follow the active cell, parts are set and taken away, a selection of several rectangles is one change');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setValues(s, 0, 0, [[1250000.456, 0.1234, 3.14159]]);
    setFormat(wb, s, selectCell(0, 0), 'money');
    assert.strictEqual(wb.display(s, 0, 0).text, 'Rp 1.250.000,46', 'money takes the currency of the workbook');
    stepDecimals(wb, s, selectCell(0, 0), -1);
    stepDecimals(wb, s, selectCell(0, 0), -1);
    assert.strictEqual(wb.display(s, 0, 0).text, 'Rp 1.250.000', 'two decimals fewer');
    setFormat(wb, s, selectCell(0, 1), 'percent');
    stepDecimals(wb, s, selectCell(0, 1), 1);
    assert.strictEqual(wb.display(s, 0, 1).text, '12,340%');
    stepDecimals(wb, s, selectCell(0, 2), -1);
    assert.strictEqual(wb.display(s, 0, 2).text, '3,1416', 'a number with no format: from the decimals it shows (5) to 4');
    setFormat(wb, s, selectCell(0, 2), 'general');
    assert.strictEqual(wb.cellFormat(s, 0, 2), null);
    ok('formats: money in the workbook\'s currency, percent, decimals up and down (also for a number with no format), back to general');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const sel = extendTo(selectCell(1, 1), 3, 3);
    setBorders(wb, s, sel, 'outer', { width: 2, color: '#1a73e8' });
    const sides = (r, c) => Object.keys((wb.style(s, r, c) || {}).borders || {}).sort().join(',');
    assert.deepStrictEqual([sides(1, 1), sides(1, 2), sides(2, 2), sides(3, 3)], ['left,top', 'top', '', 'bottom,right'], 'outer: each cell the sides it has on the edge');
    setBorders(wb, s, sel, 'inner');
    assert.deepStrictEqual([sides(1, 1), sides(2, 2), sides(3, 3)], ['bottom,left,right,top', 'bottom,right', 'bottom,right'], 'inner adds the lines inside, keeping the outer ones');
    setBorders(wb, s, sel, 'clear');
    assert.strictEqual(sides(1, 1), '');
    ok('borders by place: outer, inner, and clear');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    merge(wb, s, extendTo(selectCell(0, 0), 2, 3), 'horizontal');
    assert.deepStrictEqual(wb.merges(s), [{ r1: 0, c1: 0, r2: 0, c2: 3 }, { r1: 1, c1: 0, r2: 1, c2: 3 }, { r1: 2, c1: 0, r2: 2, c2: 3 }]);
    wb.undo();
    assert.deepStrictEqual(wb.merges(s), [], 'merging by rows is one change');
    merge(wb, s, extendTo(selectCell(0, 0), 2, 1), 'vertical');
    assert.strictEqual(wb.merges(s).length, 2);
    merge(wb, s, extendTo(selectCell(0, 0), 2, 1), 'unmerge');
    assert.deepStrictEqual(wb.merges(s), []);
    ok('merge all, by rows, by columns, and take apart');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[1], [2], [3]]);
    wb.setStyle(s, { r1: 0, c1: 0, r2: 2, c2: 0 }, { bold: true, fill: '#eee', format: { type: 'number', decimals: 1 } });
    clearFormatting(wb, s, extendTo(selectCell(0, 0), 2, 0));
    assert.deepStrictEqual([wb.style(s, 0, 0), wb.value(s, 0, 0)], [undefined, 1], 'clearing the formatting keeps the values');
    assert.strictEqual(functionText(wb, s, selectCell(3, 0), 'SUM'), '=SUM(A1:A3)', 'Σ takes the numbers above');
    wb.setValues(s, 5, 0, [[4, 5]]);
    assert.strictEqual(functionText(wb, s, selectCell(5, 2), 'AVERAGE'), '=AVERAGE(A6:B6)', 'or on the left');
    assert.strictEqual(functionText(wb, s, selectCell(9, 9), 'MAX'), '=MAX()');
    ok('clear formatting, and the Σ functions around the numbers above or on the left');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
