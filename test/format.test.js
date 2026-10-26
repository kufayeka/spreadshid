// Number formats and typing in a locale, without a screen: what a value shows (number, money, percent, scientific, dates, times, durations, custom
// patterns, prefix and suffix), how typed text is read in en-US and id-ID, the format given to a cell by what was typed, and editing that round-trips.
//   node test/format.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';
import { formatValue, dateToSerial } from '../src/core/format.js';
import { parseInput } from '../src/core/input.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const US = { locale: 'en-US', currency: 'USD' };
const ID = { locale: 'id-ID', currency: 'IDR' };
const show = (v, f, s) => formatValue(v, f, s).text;
const serial = (y, m, d) => dateToSerial(new Date(Date.UTC(y, m - 1, d)));

{
    assert.strictEqual(show(1234.5, { type: 'general' }, US), '1234.5');
    assert.strictEqual(show(1234.5, { type: 'general' }, ID), '1234,5');
    assert.strictEqual(show(1234567.891, { type: 'number', decimals: 2 }, US), '1,234,567.89');
    assert.strictEqual(show(1234567.891, { type: 'number', decimals: 2 }, ID), '1.234.567,89');
    assert.strictEqual(show(-1234.5, { type: 'number', decimals: 1, negative: 'parens' }, US), '(1,234.5)');
    assert.strictEqual(show(1250000, { type: 'money', decimals: 2 }, ID), 'Rp 1.250.000,00');
    assert.strictEqual(show(1250.5, { type: 'money', decimals: 2 }, US), '$1,250.50');
    assert.strictEqual(show(-5, { type: 'money', decimals: 0, negative: 'red' }, US), '-$5');
    assert.strictEqual(formatValue(-5, { type: 'money', decimals: 0, negative: 'red' }, US).color, 'red');
    assert.strictEqual(show(0.125, { type: 'percent', decimals: 1 }, ID), '12,5%');
    assert.strictEqual(show(123456, { type: 'scientific', decimals: 2 }, US), '1.23E+05');
    ok('numbers, money (the currency of the workbook), percent, scientific, negatives, in en-US and id-ID');
}

{
    const d = serial(2026, 10, 26) + (13 * 3600 + 45 * 60) / 86400;
    assert.strictEqual(show(serial(2026, 10, 26), { type: 'date' }, ID), '26/10/2026');
    assert.strictEqual(show(serial(2026, 10, 26), { type: 'date' }, US), '10/26/2026');
    assert.strictEqual(show(d, { type: 'datetime' }, ID), '26/10/2026 13:45:00');
    assert.strictEqual(show(d, { type: 'time', pattern: 'h:mm a' }, US), '1:45 PM');
    assert.strictEqual(show(serial(2026, 10, 26), { type: 'date', pattern: 'dddd, d MMMM yyyy' }, ID), 'Senin, 26 Oktober 2026');
    assert.strictEqual(show(1.5, { type: 'duration' }, US), '36:00:00');
    ok('dates and times in the locale\'s order and words, patterns, durations past 24 hours');
}

{
    assert.strictEqual(show(1234.5, { type: 'custom', pattern: '#,##0.00' }, US), '1,234.50');
    assert.strictEqual(show(-1234.5, { type: 'custom', pattern: '#,##0.00;(#,##0.00)' }, US), '(1,234.50)');
    assert.strictEqual(formatValue(-3, { type: 'custom', pattern: '0;[Red]-0' }, US).color, 'red');
    assert.strictEqual(show(0, { type: 'custom', pattern: '#,##0;-#,##0;"-"' }, US), '-');
    assert.strictEqual(show(7, { type: 'custom', pattern: '000' }, US), '007');
    assert.strictEqual(show(0.256, { type: 'custom', pattern: '0.0%' }, US), '25.6%');
    assert.strictEqual(show(850, { type: 'custom', pattern: '#,##0 "m3"' }, US), '850 m3');
    assert.strictEqual(show(serial(2026, 1, 5), { type: 'custom', pattern: 'yyyy-MM-dd' }, US), '2026-01-05');
    ok('custom patterns: decimals, groups, sections for negative and zero, colours, leading zeros, percent, literal text, dates');
}

{
    assert.strictEqual(show(850, { type: 'number', decimals: 0, suffix: ' m3' }, US), '850 m3');
    assert.strictEqual(show(1250000, { type: 'money', decimals: 0, prefix: '≈ ' }, ID), '≈ Rp 1.250.000');
    assert.strictEqual(formatValue(850, { type: 'number', decimals: 0, suffixFrom: 'unit-col' }, US, { suffixText: 'kg' }).text, '850 kg', 'a suffix from the row');
    ok('prefix and suffix, and a suffix taken from another column of the row (the unit)');
}

{
    assert.deepStrictEqual(parseInput('1.234,5', ID), { value: 1234.5, format: { type: 'number', decimals: 1 } });
    assert.deepStrictEqual(parseInput('1,5', ID), { value: 1.5 });
    assert.deepStrictEqual(parseInput('1.5', ID), { value: '1.5' }, 'in id-ID a point is not a decimal sign: 1.5 stays a text');
    assert.deepStrictEqual(parseInput('1,234.5', US), { value: 1234.5, format: { type: 'number', decimals: 1 } });
    assert.deepStrictEqual(parseInput('Rp 1.250.000', ID), { value: 1250000, format: { type: 'money', decimals: 0, symbol: 'Rp' } });
    assert.deepStrictEqual(parseInput('$1,250.50', US), { value: 1250.5, format: { type: 'money', decimals: 2, symbol: '$' } });
    assert.deepStrictEqual(parseInput('12,5%', ID), { value: 0.125, format: { type: 'percent', decimals: 1 } });
    assert.deepStrictEqual(parseInput('26/10/2026', ID), { value: serial(2026, 10, 26), format: { type: 'date' } });
    assert.deepStrictEqual(parseInput('10/26/2026', US), { value: serial(2026, 10, 26), format: { type: 'date' } });
    assert.deepStrictEqual(parseInput('31/02/2026', ID), { value: '31/02/2026' }, 'not a date: a text');
    assert.deepStrictEqual(parseInput('2026-10-26', US).value, serial(2026, 10, 26));
    assert.deepStrictEqual(parseInput('13:45', US), { value: (13 * 60 + 45) / 1440, format: { type: 'time', pattern: 'HH:mm' } });
    assert.deepStrictEqual(parseInput('1:45 PM', US).value, (13 * 60 + 45) / 1440);
    assert.deepStrictEqual(parseInput('26/10/2026 13:45', ID).format, { type: 'datetime' });
    assert.deepStrictEqual(parseInput('00123', US, { type: 'text' }), { value: '00123' }, 'a text cell keeps what is typed');
    ok('typing in a locale: numbers with its separators, money, percent, dates in its order, times, both, text cells');
}

{
    const wb = createWorkbook(undefined, {});
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setValues(s, 0, 0, [['26/10/2026', 'Rp 1.250.000', '12,5%', '1.234,5']]);
    assert.deepStrictEqual([0, 1, 2, 3].map((c) => (wb.cellFormat(s, 0, c) || {}).type), ['date', 'money', 'percent', 'number'], 'typing gives the cell the format it was written in');
    assert.deepStrictEqual([0, 1, 2, 3].map((c) => wb.input(s, 0, c)), ['26/10/2026', '1250000', '12,5%', '1234,5'], 'and the cell is edited as it was written (in the locale)');
    wb.setValues(s, 0, 0, '27/10/2026');
    assert.strictEqual(wb.value(s, 0, 0), serial(2026, 10, 27), 'typing it again reads it again');
    wb.undo(); wb.undo();
    assert.strictEqual(wb.cellFormat(s, 0, 0), null, 'the format came with the value, in the same change: one undo takes both');
    wb.setStyle(s, { r1: 1, c1: 2, r2: 1, c2: 2 }, { format: { type: 'money', decimals: 2 } });
    wb.setValues(s, 1, 0, [[1.005, 1, '=A2*B2']]);
    assert.strictEqual(wb.value(s, 1, 2), 1.01, 'a money format on the cell rounds its formula');
    wb.setStyle(s, { r1: 1, c1: 2, r2: 1, c2: 2 }, { format: { type: 'money', decimals: 0 } });
    assert.strictEqual(wb.value(s, 1, 2), 1, 'and a new number of decimals rounds it again');
    wb.setStyle(s, { r1: 2, c1: 0, r2: 2, c2: 0 }, { format: { type: 'text' } });
    wb.setValues(s, 2, 0, '00123');
    assert.strictEqual(wb.value(s, 2, 0), '00123', 'a text cell keeps leading zeros');
    ok('a workbook in id-ID: typed values get their format, edit as written, undo as one change; money cells round; text cells keep text');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
