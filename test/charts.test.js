// Charts in the workbook: kept on their cells by ids (they move with inserted rows, come back with undo), read from their range the way Excel reads a
// selection (series down the columns or along the rows, the header row as names, the first column as categories, gaps as null), changed and taken
// away as one change each, refused without the access row `chart`, and saved with the workbook.
//   node test/charts.test.js
import assert from 'node:assert';
import { createWorkbook, chartSeries } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const cells = (rows) => rows.map((r) => r.map((v) => ({ value: v, text: v === null ? '' : String(v) })));

// ---- reading a block the way Excel reads a selection
{
    let m = chartSeries(cells([['Bulan', 'Semen', 'Besi'], ['Mei', 182, 96], ['Jun', 205, 110], ['Jul', 171, 'x']]));
    assert.deepStrictEqual([m.seriesIn, m.categories, m.series.map((s) => s.name), m.series[1].values], ['cols', ['Mei', 'Jun', 'Jul'], ['Semen', 'Besi'], [96, 110, null]]);
    m = chartSeries(cells([['Rencana', 0.01, 0.05, 0.13], ['Realisasi', 0.012, 0.051, null]]));
    assert.deepStrictEqual([m.seriesIn, m.categories, m.series.map((s) => s.name), m.series[1].values], ['rows', ['1', '2', '3'], ['Rencana', 'Realisasi'], [0.012, 0.051, null]], 'wider than tall: series along the rows');
    m = chartSeries(cells([[1, 2], [3, 4], [5, 6]]));
    assert.deepStrictEqual([m.categories, m.series.map((s) => s.name)], [['1', '2', '3'], ['Series 1', 'Series 2']], 'numbers only: no names, categories 1, 2, 3');
    m = chartSeries(cells([['A', 1, 2], ['B', 3, 4]]), { seriesIn: 'cols' });
    assert.deepStrictEqual([m.seriesIn, m.categories, m.series.length], ['cols', ['A', 'B'], 2], 'seriesIn given wins over the shape');
    ok('a block is read as Excel reads it: names, categories, series in columns or rows, gaps');
}

// ---- kept on its cells by ids
{
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['Bulan', 'Semen'], ['Mei', 182], ['Jun', 205]]);
    const id = s.addChart({ at: 'D2:H12', data: 'A1:B3', type: 'line', title: 'Penjualan', series: [{ dash: true }] });
    let c = s.charts()[0];
    assert.deepStrictEqual([c.id, c.atText, c.dataText, c.type, c.title, c.legend, c.background, c.series], [id, 'D2:H12', 'A1:B3', 'line', 'Penjualan', 'top', 'white', [{ dash: true }]]);
    assert.deepStrictEqual(s.chartData(id).series[0], { dash: true, name: 'Semen', values: [182, 205], index: 0, format: null }, 'a series carries its own settings');
    s.insertRows('1', 2);
    c = s.charts()[0];
    assert.deepStrictEqual([c.atText, c.dataText], ['D4:H14', 'A3:B5'], 'rows inserted above: the chart and its data move down');
    s.insertCols('C');
    assert.strictEqual(s.charts()[0].atText, 'E4:I14', 'a column inserted left of it: it moves right');
    wb.undo(); wb.undo();
    assert.strictEqual(s.charts()[0].atText, 'D2:H12', 'undo brings it back');
    s.setValues('B2', 999);
    assert.deepStrictEqual(s.chartData(id).series[0].values, [999, 205], 'a changed cell is in the chart at once');
    s.setChart(id, { at: 'D20:F30', type: 'column', legend: 'none' });
    c = s.charts()[0];
    assert.deepStrictEqual([c.atText, c.type, c.legend, c.title], ['D20:F30', 'column', 'none', 'Penjualan'], 'setChart changes only what is given');
    assert.throws(() => s.setChart(id, { type: 'radar' }), /a chart is one of/);
    assert.throws(() => s.addChart({ at: 'A1:B2' }), /needs `at`/);
    assert.throws(() => s.setChart(id, { data: 'nonsense' }), /must be a range/);
    s.deleteRows('1:3');
    assert.strictEqual(s.chartData(id).series.length, 0, 'its data deleted: an empty chart, no error');
    wb.undo();
    s.removeChart(id);
    assert.strictEqual(s.charts().length, 0);
    wb.undo();
    assert.strictEqual(s.charts().length, 1, 'removing is one change, undone as one');
    ok('a chart stands on its cells by ids: moves with rows and columns, changes, undo, gone with its data');
}

// ---- data on another sheet, a named range, and saved with the workbook
{
    const wb = createWorkbook();
    wb.addSheet('Data');
    const d = wb.sheet('Data');
    d.setValues('A1', [['Status', 'Jumlah'], ['Lunas', 16], ['Submit', 2]]);
    d.setColProps('B', { format: { type: 'percent' } });
    wb.addName('Rekap', 'Data', { r1: 0, c1: 0, r2: 2, c2: 1 });
    const s = wb.sheet('Sheet1');
    const a = s.addChart({ at: 'A1:E10', data: 'Data!A1:B3', type: 'pie' });
    const b = s.addChart({ at: 'G1:K10', data: 'Rekap', type: 'donut' });
    assert.deepStrictEqual([s.charts()[0].dataText, s.chartData(a).categories, s.chartData(b).series[0].values], ['Data!A1:B3', ['Lunas', 'Submit'], [16, 2]]);
    assert.strictEqual(s.chartData(a).series[0].format.type, 'percent', 'a series knows the format of its cells (the axis follows it)');
    const again = createWorkbook(wb.toJSON());
    assert.deepStrictEqual(again.sheet('Sheet1').charts().map((c) => [c.type, c.atText, c.dataText]), [['pie', 'A1:E10', 'Data!A1:B3'], ['donut', 'G1:K10', 'Data!A1:B3']], 'saved and opened again');
    ok('data on another sheet or a named range; saved with the workbook');
}

// ---- access: the row `chart`
{
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['x', 'y'], ['a', 1]]);
    const id = s.addChart({ at: 'D1:F5', data: 'A1:B2' });
    const said = [];
    wb.on('reject', (e) => said.push(e.reason));
    wb.setAccess([{ who: '*', effect: 'allow', action: 'read' }], 'tamu');
    assert.strictEqual(wb.can('chart'), false);
    // the access rows guard what a person does (source 'user'); the host's own code is not refused, as everywhere in the workbook
    s.setChart(id, { title: 'x' }, { source: 'user' });
    assert.deepStrictEqual([s.charts()[0].title, said.pop()], ['', 'You cannot change charts here'], 'refused without `chart`');
    assert.strictEqual(s.chartData(id).series.length, 1, 'but it is still read and drawn');
    wb.setAccess([{ who: '*', effect: 'allow', action: 'read' }, { who: '*', effect: 'allow', action: 'chart' }], 'staf');
    s.setChart(id, { title: 'y' }, { source: 'user' });
    assert.strictEqual(s.charts()[0].title, 'y', 'allowed with `chart`');
    ok('changing charts needs the access row `chart`; reading them does not');
}

// ---- sparklines and data bars
{
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setValues('B2', [[1, 2, 3], [4, 'x', 6], [-1, 2, -3]]);
    const id = s.addSparkline({ at: 'A2:A4', data: 'B2:D4', type: 'column', color: '#1192e8' });
    let g = s.sparklines()[0];
    assert.deepStrictEqual([g.type, g.atText, g.dataText, g.cells.map((x) => x.values)], ['column', 'A2:A4', 'B2:D4', [[1, 2, 3], [4, null, 6], [-1, 2, -3]]], 'cell i draws row i of the data');
    s.insertRows('1');
    g = s.sparklines()[0];
    assert.deepStrictEqual([g.atText, g.cells[0].r], ['A3:A5', 2], 'they move with their cells');
    s.setSparkline(id, { type: 'winloss' });
    assert.strictEqual(s.sparklines()[0].type, 'winloss');
    assert.throws(() => s.setSparkline(id, { type: 'pie' }), /a sparkline is one of/);
    s.removeSparkline(id);
    assert.strictEqual(s.sparklines().length, 0);
    // a sparkline in a row: cell i draws column i
    s.setValues('F1', [[10, 20], [30, 40]]);
    s.addSparkline({ at: 'F4:G4', data: 'F1:G2' });
    assert.deepStrictEqual(s.sparklines()[0].cells.map((x) => x.values), [[10, 30], [20, 40]]);
    ok('sparklines: cell i draws row i (or column i), move with their cells, kinds checked');

    s.setValues('J1', [[50], [100], [25], ['x']]);
    s.addConditional('J1:J4', { kind: 'bar', color: '#1192e8' });
    s.addConditional('J1:J4', { op: 'gt', a: 60, style: { bold: true } });
    assert.deepStrictEqual([s.shownStyle(0, 9).dataBar, s.shownStyle(1, 9), s.shownStyle(3, 9) || null],
        [{ pct: 0.5, color: '#1192e8' }, { bold: true, dataBar: { pct: 1, color: '#1192e8' } }, null], 'a data bar from 0 to the largest, together with another rule\'s style; text has none');
    ok('data bars: as long as the number among the range, together with other rules');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
