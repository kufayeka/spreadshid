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

console.log('\n' + passed + ' passed');
console.log('ALL OK');
