// Conditional formatting without a screen (step R5): each condition, a custom formula moved for each cell (and kept right when a row is inserted above),
// the first rule wins, colour scales of two and three points, a rule's ranges following inserted rows, one undo, the style worked out again after a change.
//   node test/conditional.test.js
import assert from 'node:assert';
import { createWorkbook, dateToSerial } from '../src/core/index.js';
import { meets } from '../src/core/conditional.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

// ---- the conditions ---------------------------------------------------------------------------------------------------------------------------------
{
    const is = (op, v, a, b) => meets({ op, a, b }, v);
    assert.deepStrictEqual([is('empty', null), is('empty', ''), is('empty', 0), is('notEmpty', 0), is('notEmpty', null)], [true, true, false, true, false]);
    assert.deepStrictEqual([is('textContains', 'Beton K-300', 'k-3'), is('textNotContains', 'Beton', 'besi'), is('textStarts', 'Galian', 'gal'), is('textEnds', 'Urugan', 'GAN'), is('textIs', 'Draft', 'draft')], [true, true, true, true, true], 'texts, whatever their case');
    assert.deepStrictEqual([is('textContains', null, ''), is('textIs', 'Draft', 'Draf')], [false, false], 'an empty cell contains nothing');
    assert.deepStrictEqual([is('gt', 10, 5), is('gt', '10', 5), is('gte', 5, 5), is('lt', 4, 5), is('lte', 5, 5)], [true, false, true, true, true], 'numbers; a text is no number');
    assert.deepStrictEqual([is('eq', 5, '5'), is('eq', 'Draft', 'draft'), is('ne', 5, 6), is('ne', 'a', 'b')], [true, true, true, true], 'equal: numbers and texts');
    assert.deepStrictEqual([is('between', 5, 1, 10), is('between', 5, 10, 1), is('notBetween', 11, 1, 10), is('between', null, 1, 10)], [true, true, true, false], 'between either way round');
    const now = new Date();
    const today = dateToSerial(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
    assert.deepStrictEqual([is('dateIs', today + 0.5, 'today'), is('dateIs', today - 1, 'yesterday'), is('dateBefore', today - 1, 'today'), is('dateAfter', today + 1, 'today'), is('dateIs', today - 3, 'pastWeek'), is('dateIs', today - 9, 'pastWeek'), is('dateIs', 46000, 46000)],
        [true, true, true, true, true, false, true], 'dates: today and the days around it, the past week, a given day');
    ok('every condition: empty, texts (any case), numbers, equal, between, dates');
}

// ---- rules on a sheet --------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Item', 'Qty', 'Status'], ['Pile', 120, 'Late'], ['Beam', 40, 'Done'], ['Slab', 80, 'Late'], ['Wall', null, 'Done']]);
    const late = wb.addConditional(s, { r1: 1, c1: 2, r2: 4, c2: 2 }, { op: 'textIs', a: 'late', style: { fill: '#f4c7c3', color: '#a50e0e', bold: true } });
    assert.deepStrictEqual(wb.conditionalStyleAt(s, 1, 2), { fill: '#f4c7c3', color: '#a50e0e', bold: true });
    assert.strictEqual(wb.conditionalStyleAt(s, 2, 2), null, 'Done is not late');
    assert.strictEqual(wb.conditionalStyleAt(s, 0, 2), null, 'the header is outside the range');
    // a whole row by a custom formula, written for the top-left cell: $C2 stays in column C, 2 moves with the row
    wb.addConditional(s, { r1: 1, c1: 0, r2: 4, c2: 1 }, { op: 'formula', formula: '=$C2="Late"', style: { italic: true } });
    assert.deepStrictEqual([wb.conditionalStyleAt(s, 1, 0), wb.conditionalStyleAt(s, 3, 1), wb.conditionalStyleAt(s, 2, 0)], [{ italic: true }, { italic: true }, null], 'a custom formula, moved for each cell');
    // the first rule that styles a cell wins
    const big = wb.addConditional(s, { r1: 1, c1: 1, r2: 4, c2: 1 }, { op: 'gt', a: 100, style: { fill: '#b7e1cd' } });
    assert.deepStrictEqual(wb.conditionalStyleAt(s, 1, 1), { italic: true }, 'the formula rule comes first');
    wb.moveConditional(s, big, 0);
    assert.deepStrictEqual(wb.conditionalStyleAt(s, 1, 1), { fill: '#b7e1cd' }, 'moved to the top, it wins');
    assert.deepStrictEqual(wb.shownStyle(s, 1, 1), { fill: '#b7e1cd' }, 'the style a cell is drawn with');
    wb.setStyle(s, { r1: 1, c1: 1, r2: 1, c2: 1 }, { bold: true, fill: '#ffffff' });
    assert.deepStrictEqual(wb.shownStyle(s, 1, 1), { bold: true, fill: '#b7e1cd' }, 'over the cell\'s own style');
    assert.deepStrictEqual(wb.style(s, 1, 1), { bold: true, fill: '#ffffff' }, 'which is not changed');

    // a change is seen at once
    wb.setValues(s, 2, 2, 'Late');
    assert.deepStrictEqual([wb.conditionalStyleAt(s, 2, 2).bold, wb.conditionalStyleAt(s, 2, 0)], [true, { italic: true }], 'a value changed: the rules see it');
    // a row inserted above: the ranges and the formula follow
    wb.insertRows(s, 1, 1);
    assert.strictEqual(wb.conditionalStyleAt(s, 1, 2), null, 'the new row is above the range');
    assert.deepStrictEqual([wb.conditionalStyleAt(s, 2, 2).bold, wb.conditionalStyleAt(s, 2, 0), wb.conditionalStyleAt(s, 4, 0)], [true, { italic: true }, { italic: true }], 'the rules moved down with their cells');
    assert.strictEqual(wb.conditionals(s).find((x) => x.op === 'formula').formula.f !== undefined, true);
    wb.setConditional(s, late, null, { a: 'done' });
    assert.deepStrictEqual([wb.conditionalStyleAt(s, 3, 2), wb.conditionalStyleAt(s, 5, 2).bold], [null, true], 'a rule changed: Late is plain, Done is marked');
    wb.undo();
    assert.strictEqual(wb.conditionalStyleAt(s, 3, 2).bold, true, 'one undo');
    wb.removeConditional(s, late);
    assert.strictEqual(wb.conditionalStyleAt(s, 2, 2), null, 'a rule taken away');
    assert.deepStrictEqual(wb.conditionals(s).map((x) => x.op), ['gt', 'formula']);
    assert.throws(() => wb.addConditional(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { op: 'sometimes' }), /needs one of these conditions/);
    ok('rules on a sheet: a style when a condition holds, a custom formula moved per cell, the first rule wins, order, own style kept, insert, undo');
}

// ---- colour scales ------------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[0], [50], [100], ['n/a']]);
    wb.addConditional(s, { r1: 0, c1: 0, r2: 3, c2: 0 }, { kind: 'scale', min: { type: 'min', color: '#ffffff' }, max: { type: 'max', color: '#57bb8a' } });
    assert.deepStrictEqual([0, 1, 2].map((r) => wb.conditionalStyleAt(s, r, 0).fill), ['#ffffff', '#abddc5', '#57bb8a'], 'two points: white to green');
    assert.strictEqual(wb.conditionalStyleAt(s, 3, 0), null, 'a text gets no colour');
    wb.setValues(s, 2, 0, 200);
    assert.strictEqual(wb.conditionalStyleAt(s, 1, 0).fill, '#d5eee2', 'the max moved: 50 is a quarter of the way now');
    const w2 = createWorkbook();
    const [t] = w2.sheetIds();
    w2.setValues(t, 0, 0, [[10], [20], [30], [40], [50]]);
    w2.addConditional(t, { r1: 0, c1: 0, r2: 4, c2: 0 }, { kind: 'scale', min: { type: 'number', value: 20, color: '#e67c73' }, mid: { type: 'percentile', value: 50, color: '#ffd666' }, max: { type: 'number', value: 40, color: '#57bb8a' } });
    assert.deepStrictEqual([0, 1, 2, 3, 4].map((r) => w2.conditionalStyleAt(t, r, 0).fill), ['#e67c73', '#e67c73', '#ffd666', '#57bb8a', '#57bb8a'], 'three points, set numbers: below the min is the min\'s colour');
    ok('colour scales: two and three points, min/max/number/percentile, worked out again after a change, no colour for a text');
}

// ---- saved and read back --------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[5], [15]]);
    wb.addConditional(s, { r1: 0, c1: 0, r2: 1, c2: 0 }, { op: 'formula', formula: '=A1>10', style: { strike: true } });
    const again = createWorkbook(wb.toJSON());
    const t = again.sheetIds()[0];
    assert.deepStrictEqual([again.conditionalStyleAt(t, 0, 0), again.conditionalStyleAt(t, 1, 0)], [null, { strike: true }], 'the rules are part of the sheet, saved with it');
    ok('rules saved with the sheet and read back');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
