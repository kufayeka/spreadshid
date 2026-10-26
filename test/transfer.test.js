// Copy, cut, paste and fill without a screen: formulas move by the distance, $ stays, a cut moves in one change, text from Excel, series, tiling.
//   node test/transfer.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';
import { copyBlock, clipText, clipHtml, clipFromHtml, pasteClip, pasteText, fillBlock } from '../src/core/transfer.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const rect = (r1, c1, r2, c2) => ({ r1, c1, r2: r2 === undefined ? r1 : r2, c2: c2 === undefined ? c1 : c2 });

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[1, 2, '=A1+B1', '=$A$1*B1']]);
    wb.setStyle(s, rect(0, 2), { bold: true });
    const clip = copyBlock(wb, s, rect(0, 0, 0, 3));
    assert.strictEqual(clipText(clip), '1\t2\t3\t2');
    const back = clipFromHtml(clipHtml(clip));
    assert.deepStrictEqual(back.cells[0][2].input, '=A1+B1', 'the copy goes through HTML and comes back whole');
    const landed = pasteClip(wb, s, rect(4, 1), back);
    assert.deepStrictEqual(landed, rect(4, 1, 4, 4));
    assert.strictEqual(wb.input(s, 4, 3), '=B5+C5', 'a formula moved 4 rows down and 1 column right reads from there');
    assert.strictEqual(wb.input(s, 4, 4), '=$A$1*C5', 'what is fixed with $ stays');
    assert.deepStrictEqual(wb.style(s, 4, 3), { bold: true }, 'the style comes along');
    wb.undo();
    assert.strictEqual(wb.raw(s, 4, 3), undefined, 'a paste is one change: one undo takes it all back');
    ok('copy and paste: values, formulas moved by the distance, $ kept, styles, one undo');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[5]]);
    pasteClip(wb, s, rect(2, 0, 6, 1), copyBlock(wb, s, rect(0, 0)));
    assert.deepStrictEqual([2, 4, 6].map((r) => wb.value(s, r, 1)), [5, 5, 5], 'one cell pasted on a block fills the block');
    wb.setValues(s, 0, 2, [['=A1*2']]);
    pasteClip(wb, s, rect(1, 2, 3, 2), copyBlock(wb, s, rect(0, 2)));
    assert.deepStrictEqual([1, 2, 3].map((r) => wb.input(s, r, 2)), ['=A2*2', '=A3*2', '=A4*2'], 'and a formula moves in each cell');
    ok('one cell pasted on a bigger selection fills it, a formula moving in every cell');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[10, '=A1*3']]);
    wb.setStyle(s, rect(0, 0), { italic: true });
    pasteClip(wb, s, rect(5, 3), copyBlock(wb, s, rect(0, 0, 0, 1), true));
    assert.strictEqual(wb.raw(s, 0, 0), undefined, 'a cut empties where it came from');
    assert.strictEqual(wb.style(s, 0, 0), undefined);
    assert.strictEqual(wb.value(s, 5, 3), 10);
    assert.deepStrictEqual(wb.style(s, 5, 3), { italic: true });
    wb.undo();
    assert.strictEqual(wb.value(s, 0, 0), 10, 'one undo puts the cut back where it was');
    assert.strictEqual(wb.raw(s, 5, 3), undefined);
    ok('cut and paste moves the cells in one change');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[3, '=A1*2']]);
    pasteClip(wb, s, rect(3, 0), copyBlock(wb, s, rect(0, 0, 0, 1)), 'values');
    assert.deepStrictEqual([wb.raw(s, 3, 0), wb.raw(s, 3, 1)], [3, 6], 'paste values only: the worked-out values, no formula');
    pasteText(wb, s, rect(6, 0), 'Name\tQty\r\n"Bolt, M8"\t12\r\n"two\nlines"\t=B8*2\r\n');
    assert.deepStrictEqual([wb.value(s, 7, 0), wb.value(s, 7, 1), wb.value(s, 8, 0), wb.value(s, 8, 1)], ['Bolt, M8', 12, 'two\nlines', 24]);
    ok('paste values only, and text from Excel (quotes, tabs, new lines, a formula) read as typed');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[1, 'Item 1', 'x', '=A1*10'], [3, 'Item 2', 'y', '=A2*10']]);
    wb.setStyle(s, rect(0, 2), { bold: true });
    fillBlock(wb, s, rect(0, 0, 1, 3), rect(2, 0, 4, 3), 'down', false);
    assert.deepStrictEqual([2, 3, 4].map((r) => wb.value(s, r, 0)), [5, 7, 9], 'numbers go on by their step');
    assert.deepStrictEqual([2, 3, 4].map((r) => wb.value(s, r, 1)), ['Item 3', 'Item 4', 'Item 5'], 'a text ending in a number goes on');
    assert.deepStrictEqual([2, 3, 4].map((r) => wb.value(s, r, 2)), ['x', 'y', 'x'], 'other texts repeat');
    assert.deepStrictEqual([2, 3, 4].map((r) => wb.input(s, r, 3)), ['=A3*10', '=A4*10', '=A5*10'], 'formulas move with each row');
    assert.deepStrictEqual(wb.style(s, 2, 2), { bold: true }, 'styles repeat');
    wb.undo();
    assert.strictEqual(wb.raw(s, 2, 0), undefined, 'a fill is one change');
    fillBlock(wb, s, rect(0, 0, 1, 0), rect(2, 0, 3, 0), 'down', true);
    assert.deepStrictEqual([2, 3].map((r) => wb.value(s, r, 0)), [1, 3], 'with Ctrl the cells repeat as they are');
    wb.setValues(s, 10, 5, [[4, 6]]);
    fillBlock(wb, s, rect(10, 5, 10, 6), rect(10, 3, 10, 4), 'left', false);
    assert.deepStrictEqual([wb.value(s, 10, 3), wb.value(s, 10, 4)], [0, 2], 'a fill to the left goes backward');
    ok('the fill handle: series, texts with numbers, repeats, formulas moved, styles, Ctrl copies, backward');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
