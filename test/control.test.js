// Control from code (step R4), without a screen: the host's rules (read-only and hidden cells, by range, by header name, by a condition per row), the
// types of columns from an API Maker Type, populate, and the server's check of a save (a browser that was made to break the rules is caught there).
//   node test/control.test.js
import assert from 'node:assert';
import { createWorkbook, populate, fromApiMakerType, checkPatch, mergePatch } from '../src/core/index.js';
import { findAll } from '../src/core/search.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

// a small BOQ: a header row, three lines, a status per line
function boq() {
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Item', 'Qty', 'Rate', 'Amount', 'Status'], ['Pile', 10, 500, '=B2*C2', 'Draft'], ['Beam', 4, 900, '=B3*C3', 'Approved'], ['Slab', 2, 1200, '=B4*C4', 'Draft']]);
    return { wb, s };
}

{
    const { wb, s } = boq();
    const refused = [];
    wb.on('reject', (e) => refused.push(e.reason));
    wb.setRules([
        { columns: ['Rate'], mode: 'readonly', message: 'The rates are set by the estimator' },
        { range: 'A2:E1000', when: '=$E2="Approved"', mode: 'readonly', message: 'An approved line is locked' }
    ]);
    wb.setValues(s, 1, 2, 600, { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 2), 500, 'a read-only column refuses a person');
    assert.strictEqual(refused.pop(), 'The rates are set by the estimator', 'with the rule\'s message');
    wb.setValues(s, 2, 1, 99, { source: 'user' });
    assert.strictEqual(wb.value(s, 2, 1), 4, 'an approved line refuses a person (the condition, for its row)');
    assert.strictEqual(refused.pop(), 'An approved line is locked');
    wb.setValues(s, 1, 1, 11, { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 1), 11, 'a draft line takes the change');
    wb.setValues(s, 1, 1, [[12, 999]], { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 1), 11, 'a change that touches one protected cell is refused whole (B2 is not changed either)');
    wb.setValues(s, 1, 2, 650, { source: 'code' });
    assert.strictEqual(wb.value(s, 1, 2), 650, 'the host\'s own code is not stopped by the rules');
    assert.ok(!wb.deleteRows(s, 2, 1, { source: 'user' }), 'a row with protected cells cannot be deleted by a person');
    wb.setValues(s, 3, 4, 'Approved', { source: 'user' });
    wb.setValues(s, 3, 1, 3, { source: 'user' });
    assert.strictEqual(wb.value(s, 3, 1), 2, 'a line that becomes approved is locked from then on');
    wb.insertRows(s, 1, 2, { source: 'user' });
    assert.deepStrictEqual(wb.modeAt(s, 4, 1), { mode: 'readonly', message: 'An approved line is locked' }, 'the rules follow the rows when rows are inserted above');
    ok('read-only rules: a column by its header, a range with a condition per row, refused whole with the rule\'s message, code not stopped, deleting refused, rows inserted');
}

{
    const { wb, s } = boq();
    wb.setRules([{ columns: ['Rate'], mode: 'hidden' }]);
    assert.strictEqual(wb.display(s, 1, 2).text, '•••', 'a hidden cell shows dots');
    assert.strictEqual(wb.input(s, 1, 2), '', 'and gives nothing to edit');
    assert.deepStrictEqual(findAll(wb, s, '500'), [{ r: 1, c: 3 }], 'and cannot be found (the amount 5000 can: it is not hidden)');
    assert.strictEqual(wb.display(s, 0, 2).text, 'Rate', 'the header still names the column: a rule by columns leaves the header row alone');
    wb.setRules([]);
    assert.strictEqual(wb.display(s, 1, 2).text, '500', 'rules taken away: it shows again');
    ok('hidden cells: dots, nothing to edit, not found; rules can be taken away');
}

{
    const { wb, s } = boq();
    const library = { LineStatus: { name: 'LineStatus', enum: ['Draft', 'Approved', 'Rejected'] } };
    const type = { name: 'BoqLine', fields: { Item: { type: 'string' }, Qty: { type: 'int' }, Rate: { type: 'decimal', scale: 2 }, Amount: { type: 'decimal', scale: 2 }, Status: { type: 'LineStatus' } } };
    const spec = fromApiMakerType(type, library);
    assert.deepStrictEqual(spec.fields.Status, { kind: 'string', enum: ['Draft', 'Approved', 'Rejected'] }, 'an enum Type gives its values');
    wb.setTypes(s, { headerRow: 1, fields: spec.fields });
    const errors = [];
    wb.on('cellError', (e) => errors.push(e));
    wb.setValues(s, 1, 1, '1.5', { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 1), 10, 'a whole-number column refuses 1.5');
    assert.deepStrictEqual([errors[0].address, errors[0].field, errors[0].expected], ['B2', 'Qty', 'a whole number'], 'and says it with an event');
    wb.setValues(s, 1, 4, 'Pending', { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 4), 'Draft', 'an enum column refuses a value it does not have');
    assert.strictEqual(errors[1].expected, 'one of: Draft, Approved, Rejected');
    wb.setValues(s, 1, 2, '12.345', { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 2), 500, 'a decimal of scale 2 refuses three decimals');
    wb.setValues(s, 1, 0, '00123', { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 0), '00123', 'a text column keeps "00123" as text');
    wb.setValues(s, 1, 1, '=C2/7', { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 1), 10, 'a formula is judged by what it works out to (500/7 is not whole)');
    wb.setValues(s, 1, 1, '=C2/100', { source: 'user' });
    assert.strictEqual(wb.value(s, 1, 1), 5, 'a formula that works out to a whole number is taken');
    wb.setValues(s, 0, 1, 'Quantity', { source: 'user' });
    assert.strictEqual(wb.value(s, 0, 1), 'Quantity', 'the header row is not checked');
    ok('types from an API Maker Type: int, decimal scale, enum (a Type of its own), text kept as text, formulas by their result, the header free');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setRules([{ range: 'A1:Z100', mode: 'readonly' }]);
    let where = populate(wb, s, { at: 'B2', header: true }, [{ item: 'Pile', qty: 10 }, { item: '=HACK()', qty: '12' }]);
    assert.deepStrictEqual(where, { r1: 1, c1: 1, r2: 3, c2: 2 });
    assert.deepStrictEqual([wb.value(s, 1, 1), wb.value(s, 2, 1), wb.value(s, 3, 1), wb.value(s, 3, 2)], ['item', 'Pile', '=HACK()', '12'], 'a table with its header; data stays data (no formula, a text "12" stays a text)');
    assert.strictEqual(wb.raw(s, 3, 1), '=HACK()', 'the text that looks like a formula is kept as a text');
    where = populate(wb, s, { at: 'E1', direction: 'right' }, [1, 2, 3]);
    assert.deepStrictEqual([wb.value(s, 0, 4), wb.value(s, 0, 6)], [1, 3], 'a list to the right');
    populate(wb, s, { at: 'A10' }, [{ value: 'Late', fill: '#fce8e6', bold: true }, { value: 'On time' }]);
    assert.deepStrictEqual([wb.value(s, 9, 0), wb.style(s, 9, 0)], ['Late', { fill: '#fce8e6', bold: true }], 'cell objects bring their style');
    ok('populate as the Nexa grid does: tables with headers, lists down and to the right, cell objects; data never becomes a formula; the rules do not stop the host');
}

{
    // the server's check: a browser without the rules (made to send anything) changes protected cells; the server finds it
    const { wb, s } = boq();
    const stored = JSON.parse(JSON.stringify(wb.toJSON()));
    wb.saved(wb.pendingPatch());
    const rules = [{ columns: ['Rate'], mode: 'readonly' }, { range: 'A2:E1000', when: '=$E2="Approved"', mode: 'readonly', message: 'An approved line is locked' }];
    const types = { [wb.sheetProps(s).name]: { headerRow: 1, fields: { Qty: { kind: 'int' } } } };
    wb.setValues(s, 1, 1, 20, { source: 'user' });            // allowed: a draft line's quantity
    let patch = wb.pendingPatch();
    assert.deepStrictEqual(checkPatch(stored, patch, { rules, types }), { ok: true, problems: [] }, 'an allowed change passes');
    wb.setValues(s, 1, 2, 1, { source: 'user' });             // the rate: protected
    wb.setValues(s, 2, 1, 40, { source: 'user' });            // an approved line: protected
    wb.setValues(s, 3, 1, 2.5, { source: 'user' });           // not a whole number
    patch = wb.pendingPatch();
    const result = checkPatch(stored, patch, { rules, types });
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.problems.map((p) => p.address + ': ' + p.reason).sort(), ['B3: An approved line is locked', 'B4: expected a whole number (Qty)', 'C2: a protected cell was changed'].sort());
    wb.deleteRows(s, 2, 1, { source: 'user' });
    const deleted = checkPatch(stored, wb.pendingPatch(), { rules, types });
    assert.ok(deleted.problems.some((p) => p.reason === 'An approved line is locked'), 'deleting a protected row is caught');
    const merged = mergePatch(stored, wb.pendingPatch());
    assert.deepStrictEqual(createWorkbook(merged).toJSON().sheets[0].rows.map((r) => r.cells), wb.toJSON().sheets[0].rows.map((r) => r.cells), 'mergePatch gives the workbook as the browser has it');
    ok('the server checks a save: protected cells, protected rows by a condition, types, deleted rows; mergePatch puts the patch on what is stored');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
