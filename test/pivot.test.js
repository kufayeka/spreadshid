// Tables and pivots without a screen: a sheet read as records (by a range, by whole columns, by a named range), records summed up by row groups, by
// column groups, several values and functions, subtotals and grand totals worked out from the records (an average of averages would be wrong),
// filters, the order of groups, blanks; and the files of a project put together on a server (the S-curve of an overview from weekly progress files).
//   node test/pivot.test.js
import assert from 'node:assert';
import { createWorkbook, tableOf, pivot } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };

const rab = createWorkbook();
const sh = rab.sheet('Sheet1');
sh.setValues('A1', [
    ['Bab', 'Pekerjaan', 'Volume', 'Harga', 'Jumlah', 'Status'],
    ['Tanah', 'Galian', 120, 85000, '=C2*D2', 'Approved'],
    ['Tanah', 'Urugan', 40, 210000, '=C3*D3', 'Draft'],
    ['Beton', 'Pondasi', 18.5, 1250000, '=C4*D4', 'Approved'],
    ['Beton', 'Kolom', 12, 1400000, '=C5*D5', 'Approved'],
    [],
    ['Besi', 'Tulangan', 2400, 14500, '=C7*D7', '']
]);

{
    const { fields, records } = tableOf(rab, 'Sheet1', 'A1:F7');
    assert.deepStrictEqual(fields, ['Bab', 'Pekerjaan', 'Volume', 'Harga', 'Jumlah', 'Status']);
    assert.strictEqual(records.length, 5, 'an empty row is left out');
    assert.deepStrictEqual(records[0], { Bab: 'Tanah', Pekerjaan: 'Galian', Volume: 120, Harga: 85000, Jumlah: 10200000, Status: 'Approved' }, 'formulas worked out');
    assert.strictEqual(tableOf(rab, 'Sheet1', 'A:F').records.length, 5, 'whole columns, down to the last filled row');
    rab.addName('Pekerjaan', 'Sheet1', 'A1:F7');
    assert.strictEqual(tableOf(rab, null, 'Pekerjaan').records.length, 5, 'a named range');
    assert.throws(() => tableOf(rab, null, 'A1:B2'), /not a named range, and no sheet/);
    // a column this person may not see is read as empty (its header still names it)
    const secret = createWorkbook();
    secret.setValues('Sheet1', 'A1', [['Bab', 'Biaya'], ['Tanah', 10], ['Tanah', 5]]);
    secret.setRules([{ columns: ['Biaya'], mode: 'hidden' }]);
    assert.deepStrictEqual(tableOf(secret, 'Sheet1', 'A1:B3').records, [{ Bab: 'Tanah', Biaya: null }, { Bab: 'Tanah', Biaya: null }], 'hidden cells are read as empty');
    ok('tableOf: a range, whole columns, a named range; formulas worked out, empty rows left out');
}

{
    const { records } = tableOf(rab, 'Sheet1', 'A1:F7');
    const p = pivot(records, { rows: ['Bab'], values: [{ field: 'Jumlah', fn: 'SUM' }, { field: 'Pekerjaan', fn: 'COUNTA', as: 'Item' }] });
    assert.deepStrictEqual(p.cells, [
        ['Bab', 'SUM of Jumlah', 'Item'],
        ['Besi', 34800000, 1],
        ['Beton', 39925000, 2],
        ['Tanah', 18600000, 2],
        ['Grand total', 93325000, 5]
    ], 'by Bab: two values, groups in order, a grand total');
    const desc = pivot(records, { rows: ['Bab'], values: [{ field: 'Jumlah' }], sort: { Bab: 'desc' }, totals: false });
    assert.deepStrictEqual(desc.cells.map((r) => r[0]), ['Bab', 'Tanah', 'Beton', 'Besi'], 'the other order, no totals');
    ok('pivot by rows: several values, COUNTA with its own name, order, totals or none');
}

{
    const { records } = tableOf(rab, 'Sheet1', 'A1:F7');
    const p = pivot(records, { rows: ['Bab'], columns: ['Status'], values: [{ field: 'Jumlah', fn: 'SUM' }] });
    assert.deepStrictEqual(p.cells, [
        ['Bab', 'Approved', 'Draft', '(blank)', 'Grand total'],
        ['Besi', null, null, 34800000, 34800000],
        ['Beton', 39925000, null, null, 39925000],
        ['Tanah', 10200000, 8400000, null, 18600000],
        ['Grand total', 50125000, 8400000, 34800000, 93325000]
    ], 'rows by Bab, columns by Status, an empty status is (blank), totals both ways');
    const f = pivot(records, { rows: ['Bab'], values: [{ field: 'Jumlah' }], filters: { Status: { hidden: ['draft', ''] } } });
    assert.deepStrictEqual(f.cells.slice(1).map((r) => [r[0], r[1]]), [['Beton', 39925000], ['Tanah', 10200000], ['Grand total', 50125000]], 'filters (any case, and blanks)');
    ok('pivot by rows and columns: (blank), totals across and down; filters');
}

{
    // two row fields: subtotals under each outer group; an AVERAGE total is the average of the records, not of the group averages
    const recs = [
        { Minggu: 1, Bagian: 'SM', Item: 'Galian', Realisasi: 0.2 }, { Minggu: 1, Bagian: 'SM', Item: 'Urugan', Realisasi: 0.6 },
        { Minggu: 1, Bagian: 'PM', Item: 'Pondasi', Realisasi: 0.1 }, { Minggu: 2, Bagian: 'SM', Item: 'Galian', Realisasi: 0.5 }
    ];
    const p = pivot(recs, { rows: ['Minggu', 'Bagian'], values: [{ field: 'Realisasi', fn: 'AVERAGE' }] });
    assert.deepStrictEqual(p.cells, [
        ['Minggu', 'Bagian', 'AVERAGE of Realisasi'],
        [1, 'PM', 0.1],
        ['', 'SM', 0.4],
        ['1 total', '', 0.3],
        [2, 'SM', 0.5],
        ['2 total', '', 0.5],
        ['Grand total', '', 0.35]
    ], 'two row fields, subtotals, the outer label once, totals from the records');
    for (const [fn, want] of [['SUM', 1.4], ['COUNT', 4], ['COUNTUNIQUE', 1], ['MAX', 0.6], ['MIN', 0.1], ['MEDIAN', 0.35], ['PRODUCT', 0.006]]) {
        const field = fn === 'COUNTUNIQUE' ? 'Minggu' : 'Realisasi';
        const q = pivot(recs, { values: [{ field, fn }] });
        assert.strictEqual(fn === 'COUNTUNIQUE' ? pivot(recs.map((r) => ({ ...r, Minggu: 1 })), { values: [{ field, fn }] }).cells[1][1] : q.cells[1][1], want, fn);
    }
    assert.deepStrictEqual(pivot(recs, { rows: ['Minggu'], values: [{ field: 'Realisasi', fn: 'COUNT' }], filters: { Minggu: { hidden: [1, 2] } } }).cells, [['Minggu', 'COUNT of Realisasi'], ['Grand total', 0]], 'every record filtered out: the value column stays, the total counts nothing');
    assert.throws(() => pivot(recs, { values: [{ field: 'Realisasi', fn: 'VLOOKUP' }] }), /has no function VLOOKUP/);
    assert.throws(() => pivot(recs, { rows: ['Minggu'] }), /at least one value/);
    ok('two row fields with subtotals; every function; a function it has not and no values said');
}

{
    // a server puts a project's files together: two weekly progress files (SM and PM), each with a named range "Progres", into an S-curve table
    const opname = (bagian, minggu) => {
        const wb = createWorkbook();
        const s = wb.sheet('Sheet1');
        s.setValues('A1', [['Minggu', 'Bagian', 'Bobot', 'Rencana', 'Realisasi'], ...minggu.map(([m, b, rc, rl]) => [m, bagian, b, rc, rl])]);
        wb.addName('Progres', 'Sheet1', 'A1:E' + (minggu.length + 1));
        return wb.toJSON();
    };
    const storage = { 'opname-sm': opname('SM', [[1, 0.6, 0.05, 0.04], [2, 0.6, 0.10, 0.08]]), 'opname-pm': opname('PM', [[1, 0.4, 0.02, 0.02], [2, 0.4, 0.06, 0.07]]) };
    const records = Object.values(storage).flatMap((doc) => tableOf(createWorkbook(doc), null, 'Progres').records);
    const perMinggu = pivot(records, { rows: ['Minggu'], values: [{ field: 'Rencana', fn: 'SUM', as: 'Rencana' }, { field: 'Realisasi', fn: 'SUM', as: 'Realisasi' }], totals: false });
    let kumRencana = 0, kumRealisasi = 0;
    const kurvaS = perMinggu.rows.map((r) => { kumRencana += r.cells[1]; kumRealisasi += r.cells[2]; return [r.cells[0], Number(kumRencana.toFixed(4)), Number(kumRealisasi.toFixed(4))]; });
    assert.deepStrictEqual(kurvaS, [[1, 0.07, 0.06], [2, 0.23, 0.21]], 'cumulative plan and progress per week, from two files');
    ok('a server: two files read by their named range, summed by week, made cumulative (an S-curve)');
}

{
    // a pivot table in a workbook: written as values, worked out again, locked for a person, made smaller and cleared, saved, undone
    const wb = createWorkbook();
    const said = [];
    wb.on('reject', (e) => said.push(e.reason));
    const data = wb.sheet('Sheet1');
    data.setValues('A1', [['Bab', 'Status', 'Jumlah'], ['Tanah', 'Approved', 10], ['Beton', 'Draft', 20], ['Tanah', 'Draft', 5]]);
    const rekap = wb.sheet(wb.addSheet('Rekap'));
    const id = rekap.addPivot('B2', 'Sheet1!A1:C4', { rows: ['Bab'], columns: ['Status'], values: [{ field: 'Jumlah', fn: 'SUM' }] });
    const table = (sh, a) => { const at = sh.pivotAt(a).area; const out = []; for (let r = at.r1; r <= at.r2; r++) { const row = []; for (let c = at.c1; c <= at.c2; c++) row.push(sh.value(r, c)); out.push(row); } return out; };
    assert.deepStrictEqual(table(rekap, 'B2'), [['Bab', 'Approved', 'Draft', 'Grand total'], ['Beton', null, 20, 20], ['Tanah', 10, 5, 15], ['Grand total', 10, 25, 35]], 'written from B2 in another sheet');
    assert.deepStrictEqual(rekap.style('B2'), { bold: true, fill: '#e8f0fe' }, 'its header is bold');
    rekap.setValues('E3', '=SUM(D3:D4)');
    assert.strictEqual(rekap.value('E3'), 25, 'a formula elsewhere reads it');

    data.setValues('C3', 200);
    assert.strictEqual(rekap.value('D3'), 200, 'its data changed: worked out again');
    rekap.setValues('C3', 1, { source: 'user' });
    assert.deepStrictEqual([rekap.value('C3'), said.pop()], [null, 'This is a pivot table: change it in its editor'], 'a person cannot type in it');

    rekap.setPivot(id, { spec: { rows: ['Bab'], values: [{ field: 'Jumlah', fn: 'SUM' }], totals: false } });
    assert.deepStrictEqual(table(rekap, 'B2'), [['Bab', 'SUM of Jumlah'], ['Beton', 200], ['Tanah', 15]], 'changed: smaller');
    assert.deepStrictEqual([rekap.value('D2'), rekap.value('E5'), rekap.style('D2')], [null, null, undefined], 'what it no longer covers is cleared');
    wb.undo();
    assert.strictEqual(rekap.value('E2'), 'Grand total', 'undone: as it was');

    const again = createWorkbook(wb.toJSON());
    assert.strictEqual(again.value('Rekap', 'E5'), 215, 'saved with the sheet, as values');
    again.setValues('Sheet1', 'C2', 1000);
    assert.strictEqual(again.value('Rekap', 'C4'), 1000, 'opened again: still worked out again when its data changes');

    assert.throws(() => data.addPivot('B2', 'A1:C4', { values: [{ field: 'Jumlah' }] }), /inside its own data/);
    assert.throws(() => data.addPivot('H1', 'Tidak ada!A1:B2', { values: [] }), /is not a range or a named range/);
    rekap.removePivot(id);
    assert.deepStrictEqual([rekap.value('B2'), rekap.pivots().length], [null, 0], 'taken away: what it wrote is cleared');
    ok('a pivot table in a workbook: values, another sheet, formulas read it, worked out again, locked, smaller, undone, saved, taken away');
}

// dates grouped by month and ISO week, and groups sorted by a value (the biggest first) with ties by name
{
    const records = [
        { Tanggal: 46296, Produk: 'Semen', Total: 100 },   // 1 Oct 2026, a Thursday: ISO week 40
        { Tanggal: 46300, Produk: 'Besi', Total: 300 },    // 5 Oct 2026, a Monday: week 41
        { Tanggal: 46327, Produk: 'Cat', Total: 300 },     // 1 Nov 2026
        { Tanggal: 46328, Produk: 'Semen', Total: 50 }
    ];
    const byMonth = pivot(records, { rows: ['Tanggal'], group: { Tanggal: 'month' }, values: [{ field: 'Total' }], totals: false });
    assert.deepStrictEqual(byMonth.cells.slice(1), [['2026-10', 400], ['2026-11', 350]]);
    const byWeek = pivot(records, { rows: ['Tanggal'], group: { Tanggal: 'week' }, values: [{ field: 'Total' }], totals: false });
    assert.deepStrictEqual(byWeek.cells.slice(1).map((r) => r[0]), ['2026-W40', '2026-W41', '2026-W44', '2026-W45']);   // 1 Nov is a Sunday (W44), 2 Nov a Monday (W45)
    const ranked = pivot(records, { rows: ['Produk'], values: [{ field: 'Total', as: 'Omzet' }], sort: { Produk: { by: 'Omzet', dir: 'desc' } }, totals: false });
    assert.deepStrictEqual(ranked.cells.slice(1), [['Besi', 300], ['Cat', 300], ['Semen', 150]]);
    assert.throws(() => pivot(records, { rows: ['Produk'], values: [{ field: 'Total' }], sort: { Produk: { by: 'Qty' } } }), /sorts by a value it has/);
    ok('dates grouped by month and week, groups sorted by a value');
}

{
    // dates as a server has them: a Date from a database driver (its local day), an ISO text from JSON (its first ten characters), a day number
    // from a sheet; all three are grouped by the day they name, and a text that is not a date stays a group of its own
    const records = [
        { at: new Date(2026, 8, 3), n: 1 },
        { at: '2026-09-30T23:00:00Z', n: 2 },
        { at: '2026-10-01', n: 4 },
        { at: 'Not yet', n: 8 }
    ];
    const byMonth = pivot(records, { rows: ['at'], group: { at: 'month' }, values: [{ field: 'n' }] });
    assert.deepStrictEqual(byMonth.cells.slice(1).map((r) => r[0] + '=' + r[1]), ['2026-09=3', '2026-10=4', 'Not yet=8', 'Grand total=15']);
    const byWeek = pivot(records, { rows: ['at'], group: { at: 'week' }, values: [{ field: 'n' }], totals: false });
    assert.deepStrictEqual(byWeek.cells.slice(1).map((r) => r[0]), ['2026-W36', '2026-W40', 'Not yet']);
    ok('dates as Date objects and ISO texts are grouped by their day, as day numbers are');
}

// ---- what Excel's pivot tables have besides: Show Values As, label / value / top filters, calculated fields, days and days of the week -------------
const shop = [
    { d: '2026-11-02', k: 'Coffee', o: 100, m: 30 }, { d: '2026-11-03', k: 'Tea', o: 50, m: 20 }, { d: '2026-11-09', k: 'Coffee', o: 200, m: 50 },
    { d: '2026-11-10', k: 'Bread', o: 80, m: 40 }, { d: '2026-11-16', k: 'Tea', o: 70, m: 21 }, { d: '2026-11-17', k: 'Coffee', o: 150, m: 45 }
];
const bodyOf = (p) => p.cells.slice(p.header);
{
    const p = pivot(shop, { rows: ['k'], values: [{ field: 'o' }, { field: 'o', show: 'percentOfTotal' }, { field: 'o', show: 'rank' }] });
    assert.deepStrictEqual(bodyOf(p).map((r) => [r[0], r[1], Math.round(r[2] * 1000), r[3]]),
        [['Bread', 80, 123, 3], ['Coffee', 450, 692, 1], ['Tea', 120, 185, 2], ['Grand total', 650, 1000, null]]);
    assert.strictEqual(p.value(['Coffee'], [], 0), 450);
    assert.strictEqual(Math.round(p.shown(['Coffee'], [], 1) * 1000), 692);
    ok('show as a share of the grand total, and as a rank (1 the biggest; the grand total has no rank)');
}
{
    const p = pivot(shop, { rows: ['d'], group: { d: 'week' }, values: [{ field: 'o' }, { field: 'o', show: 'runningTotal' }, { field: 'o', show: 'percentRunningTotal' },
        { field: 'o', show: 'difference' }, { field: 'o', show: 'percentDifference' }] });
    assert.deepStrictEqual(bodyOf(p).map((r) => [r[0], r[1], r[2], r[3] === null ? null : Math.round(r[3] * 100), r[4], r[5] === null ? null : Math.round(r[5] * 100)]),
        [['2026-W45', 150, 150, 23, null, null], ['2026-W46', 280, 430, 66, 130, 87], ['2026-W47', 220, 650, 100, -60, -21], ['Grand total', 650, null, null, null, null]]);
    ok('running totals (also in %) and the change from the week before (also in %) walk along the row field; the first has no change');
}
{
    const p = pivot(shop, { rows: ['k'], columns: ['d'], group: { d: 'week' }, values: [{ field: 'o', show: 'percentOfRow' }] });
    const coffee = bodyOf(p).find((r) => r[0] === 'Coffee');
    assert.deepStrictEqual(coffee.slice(1).map((x) => Math.round(x * 1000)), [222, 444, 333, 1000]);
    const byCol = pivot(shop, { rows: ['k'], columns: ['d'], group: { d: 'week' }, values: [{ field: 'o', show: 'percentOfColumn' }] });
    assert.strictEqual(Math.round(bodyOf(byCol).find((r) => r[0] === 'Coffee')[1] * 1000), 667);   // 100 of week 45's 150
    ok('show as a share of its row total, and of its column total');
}
{
    const keysOf = (filters) => bodyOf(pivot(shop, { rows: ['k'], values: [{ field: 'o', as: 'O' }], filters })).map((r) => r[0] + '=' + r[1]);
    assert.deepStrictEqual(keysOf({ k: { label: { op: 'contains', value: 'e' } } }), ['Bread=80', 'Coffee=450', 'Tea=120', 'Grand total=650']);
    assert.deepStrictEqual(keysOf({ k: { label: { op: 'beginsWith', value: 'c' } } }), ['Coffee=450', 'Grand total=450']);
    assert.deepStrictEqual(keysOf({ k: { value: { by: 'O', op: '>', value: 100 } } }), ['Coffee=450', 'Tea=120', 'Grand total=570']);
    assert.deepStrictEqual(keysOf({ k: { value: { by: 'O', op: 'between', value: 50, to: 150 } } }), ['Bread=80', 'Tea=120', 'Grand total=200']);
    assert.deepStrictEqual(keysOf({ k: { top: { n: 2, by: 'O' } } }), ['Coffee=450', 'Tea=120', 'Grand total=570']);
    assert.deepStrictEqual(keysOf({ k: { top: { n: 1, by: 'O', bottom: true } } }), ['Bread=80', 'Grand total=80']);
    const days = bodyOf(pivot(shop, { rows: ['d'], values: [{ field: 'o' }], filters: { d: { label: { op: 'between', value: '2026-11-03', to: '2026-11-10' } } } }));
    assert.deepStrictEqual(days.map((r) => r[0]), ['2026-11-03', '2026-11-09', '2026-11-10', 'Grand total']);
    assert.throws(() => pivot(shop, { rows: ['k'], values: [{ field: 'o' }], filters: { k: { value: { by: 'Nope', op: '>', value: 1 } } } }), /filters by a value it has/);
    ok('label conditions, value conditions and top n leave groups out, and the grand total is worked out without them');
}
{
    // the n biggest within each outer group, as Excel's Top 10 on an inner field
    const p = pivot(shop, { rows: ['d', 'k'], group: { d: 'week' }, values: [{ field: 'o', as: 'O' }], filters: { k: { top: { n: 1, by: 'O' } } }, totals: false });
    assert.deepStrictEqual(bodyOf(p).map((r) => r[1] + '=' + r[2]), ['Coffee=100', 'Coffee=200', 'Coffee=150']);
    ok('top n of an inner field is the top n within each outer group');
}
{
    const p = pivot(shop, { rows: ['k'], calculated: [{ name: 'Margin %', formula: 'm / o' }, { name: 'Cost', formula: '[o] - \'m\'' }],
        values: [{ field: 'Margin %' }, { field: 'Cost' }] });
    assert.deepStrictEqual(bodyOf(p).map((r) => [r[0], Math.round(r[1] * 1000), r[2]]),
        [['Bread', 500, 40], ['Coffee', 278, 325], ['Tea', 342, 79], ['Grand total', 317, 444]]);
    assert.strictEqual(p.cells[0][1], 'Margin %');
    assert.strictEqual(bodyOf(pivot([{ k: 'x', a: 1, b: 0 }], { rows: ['k'], calculated: [{ name: 'r', formula: 'a/b' }], values: [{ field: 'r' }] }))[0][1], null);
    assert.throws(() => pivot(shop, { rows: ['k'], calculated: [{ name: 'bad', formula: 'm / (o' }], values: [{ field: 'bad' }] }), /cannot be read: a bracket/);
    ok('calculated fields are worked out from the sums of their fields (right in the totals too); a division by zero is blank');
}
{
    const p = pivot(shop, { rows: ['d'], group: { d: 'weekday' }, values: [{ field: 'o' }] }, { locale: 'id-ID' });
    assert.deepStrictEqual(bodyOf(p).map((r) => r[0] + '=' + r[1]), ['Senin=370', 'Selasa=280', 'Grand total=650']);
    assert.strictEqual(p.value([1], [], 0), 370);
    const byDay = pivot(shop, { rows: ['d'], group: { d: 'day' }, values: [{ field: 'o' }], totals: false });
    assert.deepStrictEqual(bodyOf(byDay).map((r) => r[0]).slice(0, 2), ['2026-11-02', '2026-11-03']);
    assert.throws(() => pivot(shop, { rows: ['d'], group: { d: 'hour' }, values: [{ field: 'o' }] }), /groups dates by/);
    ok('dates grouped by day, and by day of the week (named in the language asked for, Monday first)');
}
{
    // in a sheet: a share is written with a percent format, and the days of the week in the workbook's language
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    wb.setValues('Sheet1', 'A1', [['d', 'o'], ['2026-11-02', 100], ['2026-11-03', 50], ['2026-11-09', 200]]);
    const out = wb.sheet(wb.addSheet('Out'));
    out.addPivot('A1', 'Sheet1!A1:B4', { rows: ['d'], group: { d: 'weekday' }, values: [{ field: 'o', as: 'O' }, { field: 'o', as: 'Share', show: 'percentOfTotal' }] });
    assert.deepStrictEqual([1, 2, 3].map((r) => out.display(r, 0).text + ' ' + out.display(r, 2).text), ['Senin 85,7%', 'Selasa 14,3%', 'Grand total 100,0%']);
    ok('in a sheet, shares are written as percents and days of the week by their names');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
