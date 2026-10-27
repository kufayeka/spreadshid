// The core without a screen: values and formulas, formulas that follow their rows, undo and redo, the door (beforeOp), the patch for saving, money.
//   node test/core.test.js
import assert from 'node:assert';
import { createWorkbook, isError } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const text = (v) => (isError(v) ? v.code : v);

// ---- a new workbook
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    assert.deepStrictEqual(wb.size(s), { rows: 1000, cols: 26 });
    assert.strictEqual(wb.sheetProps(s).name, 'Sheet1');
    const patch = wb.pendingPatch();
    assert.strictEqual(patch.rows.upsert.length, 1000, 'a new workbook is all in its first patch');
    assert.strictEqual(patch.columns.upsert.length, 26);
    wb.saved(patch, { version: 1 });
    assert.ok(wb.pendingPatch().isEmpty, 'and nothing after it was saved');
    assert.strictEqual(wb.version, 1);
    ok('a new workbook has one sheet of 1000 rows and 26 columns, all of it in the first patch');
}

// ---- what a person types
{
    const wb = createWorkbook();
    wb.setValues(undefined, 0, 0, [['12.5', '12%', 'TRUE', "'007", 'hello', '1,234.5']], { source: 'user' });
    assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map((c) => wb.value(undefined, 0, c)), [12.5, 0.12, true, '007', 'hello', 1234.5]);
    assert.strictEqual(wb.input(undefined, 0, 3), "'007", 'a text that looks like a number is edited with its apostrophe');
    ok('typed text is read as Google Sheets reads it: numbers, percent, booleans, \'text, grouped numbers');
}

// ---- formulas, and formulas that follow their rows
{
    const wb = createWorkbook();
    wb.setValues(undefined, 0, 0, [[2, 3, '=A1*B1'], [4, 5, '=A2*B2'], [null, null, '=SUM(C1:C2)']]);
    assert.strictEqual(wb.value(undefined, 2, 2), 26);
    // a row inserted above: every formula still points at the same cells, and reads with the new numbers
    wb.insertRows(undefined, 0, 1);
    assert.strictEqual(wb.input(undefined, 3, 2), '=SUM(C2:C3)', wb.input(undefined, 3, 2));
    assert.strictEqual(wb.input(undefined, 1, 2), '=A2*B2');
    assert.strictEqual(wb.value(undefined, 3, 2), 26);
    // a row inserted inside the range: it is part of the sum at once
    wb.insertRows(undefined, 2, 1);
    wb.setValues(undefined, 2, 2, 100);
    assert.strictEqual(wb.input(undefined, 4, 2), '=SUM(C2:C4)');
    assert.strictEqual(wb.value(undefined, 4, 2), 126);
    ok('a formula follows its rows when rows are inserted above, and a range grows with a row inserted inside it');

    // the first row of a range is deleted: the range shrinks to the rows that stay (Excel does the same), undo brings the row and the range back
    wb.deleteRows(undefined, 1, 1);
    assert.strictEqual(wb.input(undefined, 1, 2), '100', 'the rows moved up');
    assert.strictEqual(text(wb.value(undefined, 2, 2)), 20, '=A3*B3 (old row 2) is untouched');
    assert.strictEqual(wb.input(undefined, 3, 2), '=SUM(C2:C3)', 'the range starts at the next row');
    assert.strictEqual(wb.value(undefined, 3, 2), 120);
    wb.undo();
    assert.strictEqual(wb.input(undefined, 4, 2), '=SUM(C2:C4)');
    assert.strictEqual(wb.value(undefined, 4, 2), 126, 'undo gives the row and the sum back');
    wb.redo();
    assert.strictEqual(wb.value(undefined, 3, 2), 120, 'redo takes it again');
    ok('deleting the first row of a range shrinks the range, undo and redo go back and forth');
}

// ---- a value that changes reaches every formula that reads it, also through others
{
    const wb = createWorkbook();
    wb.setValues(undefined, 0, 0, [[1, '=A1+1', '=B1+1', '=SUM(A1:C1)']]);
    assert.strictEqual(wb.value(undefined, 0, 3), 6);
    wb.setValues(undefined, 0, 0, 10);
    assert.deepStrictEqual([1, 2, 3].map((c) => wb.value(undefined, 0, c)), [11, 12, 33]);
    wb.setValues(undefined, 1, 0, '=A1');
    wb.setValues(undefined, 0, 0, '=A2');
    assert.strictEqual(text(wb.value(undefined, 0, 0)), '#CYCLE!', 'a formula that reads itself through another');
    ok('a change reaches the formulas that read it and the ones after them; a cycle is #CYCLE!');
}

// ---- columns: delete keeps the rows untouched, undo brings the column back with its cells
{
    const wb = createWorkbook();
    wb.setValues(undefined, 0, 0, [[1, 2, '=A1+B1']]);
    wb.saved(wb.pendingPatch());
    wb.deleteCols(undefined, 1, 1);
    assert.strictEqual(wb.input(undefined, 0, 1), '=A1+#REF!');
    const patch = wb.pendingPatch();
    assert.strictEqual(patch.columns.delete.length, 1);
    assert.strictEqual(patch.rows.upsert.length, 0, 'deleting a column does not write the rows (a big sheet stays cheap to save)');
    wb.undo();
    assert.strictEqual(wb.value(undefined, 0, 2), 3);
    wb.insertCols(undefined, 0, 2);
    assert.strictEqual(wb.input(undefined, 0, 4), '=C1+D1', 'columns inserted before move the references along');
    ok('a deleted column turns its references into #REF! without writing the rows; undo brings it back; inserted columns move references');
}

// ---- sheets: a formula into another sheet keeps it by id, and shows its new name
{
    const wb = createWorkbook();
    const rates = wb.addSheet('Rates');
    const [main] = wb.sheetIds();
    wb.setValues(rates, 0, 1, 1.1);
    wb.setValues(main, 0, 0, [[100, '=A1*Rates!$B$1']]);
    assert.strictEqual(wb.value(main, 0, 1), 110);
    wb.setSheetProps(rates, { name: 'Price list' });
    assert.strictEqual(wb.input(main, 0, 1), "=A1*'Price list'!$B$1");
    wb.setValues(rates, 0, 1, 2);
    assert.strictEqual(wb.value(main, 0, 1), 200, 'a change in the other sheet reaches the formula');
    assert.throws(() => wb.setSheetProps(main, { name: 'price LIST' }), /no other sheet has/);
    wb.removeSheet(rates);
    assert.strictEqual(text(wb.value(main, 0, 1)), '#REF!');
    wb.undo();
    assert.strictEqual(wb.value(main, 0, 1), 200);
    ok('a formula into another sheet follows its renaming, its changes, its removal and its return');
}

// ---- moving rows (a sort, a drag): formulas follow the rows they point at
{
    const wb = createWorkbook();
    wb.setValues(undefined, 0, 0, [['a', 1], ['b', 2], ['c', 3]]);
    wb.setValues(undefined, 0, 3, '=B3*10');
    wb.moveRows(undefined, 2, 1, 0);
    assert.deepStrictEqual([0, 1, 2].map((r) => wb.value(undefined, r, 0)), ['c', 'a', 'b']);
    assert.strictEqual(wb.input(undefined, 1, 3), '=B1*10', 'the formula moved with its row, and points at "c" where it went');
    assert.strictEqual(wb.value(undefined, 1, 3), 30);
    ok('moved rows take their formulas with them, and references follow the rows they point at');
}

// ---- the door: the host lets a change through, changes it, or refuses it whole
{
    const refused = [];
    const wb = createWorkbook(undefined, {
        user: 'budi',
        beforeOp(op, ctx) {
            if (op.t !== 'cells') return op;
            if (op.changes.some((c) => c.after === 'forbidden')) return { reject: 'that word is not allowed' };
            // a host that writes every text in capitals
            return { ...op, changes: op.changes.map((c) => (typeof c.after === 'string' ? { ...c, after: c.after.toUpperCase() } : c)) };
        }
    });
    wb.on('reject', (e) => refused.push(e.reason));
    const seen = [];
    wb.on('op', (e) => seen.push(e));
    wb.setValues(undefined, 0, 0, [['hello', 'forbidden']], { source: 'user' });
    assert.strictEqual(wb.value(undefined, 0, 0), null, 'nothing of a refused change is applied');
    assert.deepStrictEqual(refused, ['that word is not allowed']);
    wb.setValues(undefined, 0, 0, 'hello', { source: 'user' });
    assert.strictEqual(wb.value(undefined, 0, 0), 'HELLO');
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0].ops[0].user, 'budi');
    assert.strictEqual(seen[0].source, 'user');
    ok('every change goes through beforeOp: let through, changed, or refused whole (with the reason as an event); applied ops carry the user');
}

// ---- an op that names something that is not there changes nothing
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, 1);
    assert.throws(() => wb.apply([
        { t: 'cells', sheet: s, changes: [{ row: wb.rowId(s, 0), col: wb.colId(s, 0), before: 1, after: 2 }] },
        { t: 'cells', sheet: s, changes: [{ row: 'no-such-row', col: wb.colId(s, 0), before: undefined, after: 3 }] }
    ]), /no row/);
    assert.strictEqual(wb.value(s, 0, 0), 1, 'the first op of the change was taken back');
    ok('a change with an op that cannot be applied is taken back whole');
}

// ---- saving: the patch, a change made while saving, and opening what was saved
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.saved(wb.pendingPatch(), { version: 1 });
    wb.setValues(s, 0, 0, [[5, '=A1*2']]);
    wb.setStyle(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { bold: true, fill: '#ffee00' });
    const first = wb.pendingPatch();
    assert.strictEqual(first.rows.upsert.length, 1, 'one row changed: one row in the patch');
    assert.deepStrictEqual(first.rows.upsert[0].style[wb.colId(s, 0)], { bold: true, fill: '#ffee00' });
    wb.setValues(s, 1, 0, 7); // made while the first patch is on its way
    wb.saved(first, { version: 2 });
    const second = wb.pendingPatch();
    assert.strictEqual(second.rows.upsert.length, 1, 'the change made while saving waits for the next save');
    assert.strictEqual(second.rows.upsert[0].id, wb.rowId(s, 1));
    // what is stored opens with the same values, the formulas kept by ids
    const again = createWorkbook(JSON.parse(JSON.stringify(wb.toJSON())));
    assert.strictEqual(again.value(s, 0, 1), 10);
    assert.strictEqual(again.input(s, 0, 1), '=A1*2');
    assert.ok(again.pendingPatch().isEmpty, 'a workbook opened from storage has nothing to save');
    ok('the patch carries whole changed rows; a change made while saving stays for the next save; a stored workbook opens the same');
}

// ---- money: a column with a money format rounds its formulas, half away from zero
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setColProps(s, [2], { format: { type: 'money', decimals: 2 } });
    wb.setValues(s, 0, 0, [[1.005, 1, '=A1*B1'], [0.1, 0.2, '=A2+B2'], [-2.675, 1, '=A3*B3'], [1250000, 850, '=A4*B4']]);
    assert.deepStrictEqual([0, 1, 2, 3].map((r) => wb.value(s, r, 2)), [1.01, 0.3, -2.68, 1062500000]);
    wb.setColProps(s, [2], { format: { type: 'money', decimals: 0 } });
    assert.strictEqual(wb.value(s, 0, 2), 1, 'a new number of decimals rounds again');
    ok('a money column rounds its formulas to its decimals, half away from zero, without float error (1.005 -> 1.01, 0.1 + 0.2 -> 0.3)');
}

// ---- undo and redo of every kind of change
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const before = JSON.stringify(wb.toJSON());
    wb.setValues(s, 0, 0, [[1, 2], [3, 4]]);
    wb.setStyle(s, { r1: 0, c1: 0, r2: 1, c2: 1 }, { italic: true });
    wb.insertRows(s, 1, 3);
    wb.insertCols(s, 0, 2);
    wb.moveCols(s, 0, 1, 5);
    wb.setRowProps(s, [0], { height: 40 });
    wb.setColProps(s, [0], { width: 200 });
    wb.setSheetProps(s, { freezeRows: 1 });
    wb.setSettings({ locale: 'id-ID' });
    wb.addSheet();
    wb.deleteRows(s, 0, 1);
    const after = JSON.stringify(wb.toJSON());
    while (wb.undo());
    assert.strictEqual(JSON.stringify(wb.toJSON()), before, 'every change undone: the workbook is as it was');
    while (wb.redo());
    assert.strictEqual(JSON.stringify(wb.toJSON()), after, 'every change redone: the workbook is as it was after them');
    ok('every kind of change undoes and redoes back to exactly the same workbook');
}

// ---- deleting the first or last row (or column) of a range shrinks the range, as in Excel, instead of turning it into #REF!
{
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['h'], [1], [2], [3]]);
    s.setValues('B1', [['=COUNTA(A2:A4)', '=SUM(A2:A4)']]);
    wb.addSheet('Other');
    wb.setValues('Other', 'A1', '=SUM(Sheet1!A2:A4)');

    s.deleteRows('2');
    assert.strictEqual(s.input('B1'), '=COUNTA(A2:A3)');
    assert.strictEqual(s.value('B1'), 2);
    assert.strictEqual(wb.input('Other', 'A1'), '=SUM(Sheet1!A2:A3)', 'a formula on another sheet shrinks too');
    s.deleteRows('3');
    assert.strictEqual(s.value('C1'), 2, 'the last row went: the range ends one row higher');
    wb.undo();
    wb.undo();
    assert.strictEqual(s.input('C1'), '=SUM(A2:A4)', 'one undo per delete puts the rows and the formula back');
    assert.strictEqual(s.value('C1'), 6);

    s.deleteRows('2:4');
    assert.strictEqual(text(s.value('C1')), '#REF!', 'every row of the range gone: #REF!, as in Excel');
    wb.undo();

    const w2 = createWorkbook();
    const t = w2.sheet('Sheet1');
    t.setValues('A1', [[1, 2, 3, '=SUM(A1:C1)']]);
    t.deleteCols('A');
    assert.strictEqual(t.input('C1'), '=SUM(A1:B1)');
    assert.strictEqual(t.value('C1'), 5);
    ok('a range loses the deleted rows or columns at its edges and keeps the rest, undo brings it back');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
