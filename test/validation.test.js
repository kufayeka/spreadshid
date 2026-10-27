// Data validation without a screen (step R5a): dropdowns from a list and from a range, checkboxes, numbers between, dates, the length of a text, emails;
// refuse or warn; rules that follow inserted rows; one undo for a rule.
//   node test/validation.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const rect = (r1, c1, r2, c2) => ({ r1, c1, r2: r2 === undefined ? r1 : r2, c2: c2 === undefined ? c1 : c2 });

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const refused = [];
    wb.on('reject', (e) => refused.push(e.reason));
    wb.addValidation(s, rect(1, 1, 20, 1), { kind: 'list', values: ['Draft', 'ACC', 'Cancel'], reject: true, help: 'Pick a status' });
    assert.deepStrictEqual(wb.choicesAt(s, 5, 1), ['Draft', 'ACC', 'Cancel']);
    assert.strictEqual(wb.validationAt(s, 5, 1).help, 'Pick a status');
    wb.setValues(s, 5, 1, 'ACC', { source: 'user' });
    assert.strictEqual(wb.value(s, 5, 1), 'ACC');
    wb.setValues(s, 5, 1, 'Lunas', { source: 'user' });
    assert.strictEqual(wb.value(s, 5, 1), 'ACC', 'a value that is not a choice is refused');
    assert.strictEqual(refused.pop(), 'The value in B6 must be one of: Draft, ACC, Cancel');
    wb.setValues(s, 5, 1, 'Lunas', { source: 'code' });
    assert.strictEqual(wb.value(s, 5, 1), 'Lunas', 'the host\'s code is not stopped');
    assert.strictEqual(wb.invalidAt(s, 5, 1), 'one of: Draft, ACC, Cancel', 'and the cell is marked as breaking the rule');
    wb.insertRows(s, 0, 3);
    assert.deepStrictEqual(wb.choicesAt(s, 8, 1), ['Draft', 'ACC', 'Cancel'], 'the rule follows rows inserted above');
    assert.deepStrictEqual(wb.choicesAt(s, 2, 1), [], 'and is not on the rows inserted before its range');
    ok('a dropdown from a list: choices, a refusal with words, code not stopped, the cell marked, the rule follows the rows');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const rates = wb.addSheet('Rates');
    wb.setValues(rates, 0, 0, [['Concrete'], ['Rebar'], [''], ['Concrete'], ['Formwork']]);
    wb.addValidation(s, rect(0, 0, 9, 0), { kind: 'listFrom', source: 'Rates!A1:A5' });
    assert.deepStrictEqual(wb.choicesAt(s, 0, 0), ['Concrete', 'Rebar', 'Formwork'], 'the values of the range, each once, empty ones left out');
    wb.setValues(rates, 5, 0, 'Sand');
    assert.deepStrictEqual(wb.choicesAt(s, 0, 0), ['Concrete', 'Rebar', 'Formwork'], 'only the range named (A6 is outside it)');
    ok('a dropdown from a range of another sheet');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.addValidation(s, rect(0, 0, 5, 0), { kind: 'checkbox' });
    wb.addValidation(s, rect(0, 1, 5, 1), { kind: 'number', op: 'between', a: 0, b: 100 });
    wb.addValidation(s, rect(0, 2, 5, 2), { kind: 'number', op: 'gte', a: 0, reject: false });
    wb.addValidation(s, rect(0, 3, 5, 3), { kind: 'textLength', op: 'lte', a: 5 });
    wb.addValidation(s, rect(0, 4, 5, 4), { kind: 'text', op: 'email' });
    const write = (r, c, v) => { wb.setValues(s, r, c, v, { source: 'user' }); return wb.value(s, r, c); };
    assert.strictEqual(write(0, 0, 'TRUE'), true);
    assert.strictEqual(write(1, 0, 'yes'), null, 'a checkbox takes TRUE or FALSE only');
    assert.strictEqual(write(0, 1, '55'), 55);
    assert.strictEqual(write(1, 1, '120'), null, 'a number outside 0 and 100 is refused');
    assert.strictEqual(write(0, 2, '-5'), -5, 'a rule that only warns keeps the value');
    assert.strictEqual(wb.invalidAt(s, 0, 2), 'at least 0', 'and says what it wants');
    assert.strictEqual(write(0, 3, 'Pile'), 'Pile');
    assert.strictEqual(write(1, 3, 'Beam column'), null, 'a text longer than 5 is refused');
    assert.strictEqual(write(0, 4, 'budi@waringin.co.id'), 'budi@waringin.co.id');
    assert.strictEqual(write(1, 4, 'budi at waringin'), null, 'not an email');
    ok('checkboxes, numbers between, warnings that keep the value, the length of a text, emails');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.addValidation(s, rect(0, 0, 9, 0), { kind: 'list', values: ['A', 'B'] });
    wb.undo();
    assert.strictEqual(wb.validationAt(s, 0, 0), null, 'adding a rule is one change: one undo takes it away');
    wb.redo();
    wb.removeValidation(s, rect(3, 0));
    assert.strictEqual(wb.validationAt(s, 0, 0), null, 'removing takes away the rules the rectangle touches');
    wb.addValidation(s, rect(0, 0, 9, 0), { kind: 'list', values: ['A', 'B'] });
    wb.addValidation(s, rect(0, 0, 9, 0), { kind: 'list', values: ['X'] });
    assert.deepStrictEqual(wb.choicesAt(s, 0, 0), ['X'], 'the last rule made wins, as in Google Sheets');
    const again = createWorkbook(JSON.parse(JSON.stringify(wb.toJSON())));
    assert.deepStrictEqual(again.choicesAt(s, 0, 0), ['X'], 'the rules are saved with the sheet');
    ok('rules are one change (undo, redo), can be removed, the last one wins, and are saved with the sheet');
}

// a rule's own message (in the app's language) is what a refusal says, with {cell} as the address
{
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    const said = [];
    wb.on('reject', (e) => said.push(e.reason));
    s.addValidation('D2:D9', { kind: 'number', op: 'between', a: 1, b: 500, reject: true, message: 'Qty di {cell} harus 1 sampai 500' });
    s.setValues('D3', 0, { source: 'user' });
    assert.deepStrictEqual(said, ['Qty di D3 harus 1 sampai 500']);
    ok('a rule of validation says its own message when it has one');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
