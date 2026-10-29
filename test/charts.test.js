// Charts in the workbook: kept on their cells by ids (they move with inserted rows, come back with undo), read from their range the way Excel reads a
// selection (series down the columns or along the rows, the header row as names, the first column as categories, gaps as null), changed and taken
// away as one change each, refused without the access row `chart`, and saved with the workbook.
//   node test/charts.test.js
import assert from 'node:assert';
import { createWorkbook, chartSeries, exportXlsx, importXlsx } from '../src/core/index.js';
import { unzip } from '../src/core/excel/read-base.js';

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

// ---- in an .xlsx file: real Excel charts (a drawing on the cells, each series naming its own cells), sparklines and data bars; and back
{
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['Bulan', 'Semen', 'Besi'], ['Mei', 182, 96], ['Jun', 205, 110]]);
    s.addChart({ at: 'E2:J14', data: 'A1:C3', type: 'combo', title: 'Jual', series: [{ color: '#1192e8' }, { type: 'line', axis: 'right', dash: true }] });
    s.addChart({ at: 'E16:J28', data: 'A1:B3', type: 'donut', legend: 'right' });
    s.addChart({ at: 'L2:Q14', data: 'B2:C3', type: 'line', seriesIn: 'rows', background: 'none' });
    s.addSparkline({ at: 'D2:D3', data: 'B2:C3', type: 'column' });
    s.addConditional('B2:B3', { kind: 'bar', color: '#1192e8' });
    const bytes = exportXlsx(wb);
    const files = await unzip(bytes);
    const text = (name) => new TextDecoder().decode(files.get(name));
    assert.ok(/<drawing r:id="rId3"\/>/.test(text('xl/worksheets/sheet1.xml')), 'the sheet links its drawing');
    assert.ok(text('xl/drawings/drawing1.xml').includes('<xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row>'), 'the chart is anchored on its cells (E2)');
    const combo = text('xl/charts/chart1.xml');
    assert.ok(combo.includes('<c:barChart>') && combo.includes('<c:lineChart>') && combo.includes('<c:axPos val="r"/>'), 'a combo: columns, a line, and a second axis on the right');
    assert.ok(combo.includes("<c:f>'Sheet1'!$B$2:$B$3</c:f>") && combo.includes("<c:f>'Sheet1'!$A$2:$A$3</c:f>") && combo.includes("<c:f>'Sheet1'!$B$1</c:f>"), 'each series names its values, categories and name');
    assert.ok(text('xl/charts/chart2.xml').includes('<c:doughnutChart>') && text('xl/charts/chart3.xml').includes('<a:noFill/>'), 'a donut; a transparent chart has no fill');
    assert.ok(text('[Content_Types].xml').includes('/xl/charts/chart3.xml') && text('[Content_Types].xml').includes('/xl/drawings/drawing1.xml'));
    assert.ok(/<x14:sparkline><xm:f>'Sheet1'!B2:C2<\/xm:f><xm:sqref>D2<\/xm:sqref>/.test(text('xl/worksheets/sheet1.xml')), 'sparklines: each cell with its own range');
    assert.ok(/<cfRule type="dataBar"/.test(text('xl/worksheets/sheet1.xml')), 'a data bar');
    const back = await importXlsx(bytes);
    const t2 = back.workbook.sheet('Sheet1');
    assert.deepStrictEqual(back.warnings, []);
    assert.deepStrictEqual(t2.charts().map((c) => [c.type, c.atText, c.dataText, c.title || '', c.legend, c.background, c.seriesIn]),
        [['combo', 'E2:J14', 'A1:C3', 'Jual', 'top', 'white', 'cols'], ['donut', 'E16:J28', 'A1:B3', '', 'right', 'white', 'cols'], ['line', 'L2:Q14', 'B2:C3', '', 'top', 'none', 'rows']]);
    assert.deepStrictEqual(t2.charts()[0].series[1], { color: '#1192e8', type: 'line', axis: 'right', dash: true }, 'a series keeps its kind, axis and dashes');
    assert.deepStrictEqual([t2.sparklines().map((g) => [g.type, g.atText, g.dataText]), t2.conditionals().map((r) => [r.kind, r.color])], [[['column', 'D2:D3', 'B2:C3']], [['bar', '#1192e8']]]);
    ok('in an .xlsx file: Excel charts on their cells, sparklines and data bars, and back');
}

// ---- series with their own ranges, and scatter (each series its own x)
{
    const wb = createWorkbook();
    wb.addSheet('Opname');
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['Proyek', 'Minggu', 'Aktual', 'Catatan', 'Rencana'], ['A', 1, 0.5, 'x', 0.6], ['B', 2, 0.2, 'y', 0.25]]);
    // Aktual in C and Rencana in E, a column between them: no block, each series its own range
    const id = s.addChart({ at: 'H1:M10', type: 'bullet', categories: 'A2:A3', series: [{ name: 'Aktual', values: 'C2:C3' }, { nameFrom: 'E1', values: 'E2:E3' }] });
    let m = s.chartData(id);
    assert.deepStrictEqual([m.categories, m.series.map((x) => [x.name, x.values]), m.fromBlock], [['A', 'B'], [['Aktual', [0.5, 0.2]], ['Rencana', [0.6, 0.25]]], 0], 'series of their own ranges, the name from a cell');
    let c = s.charts()[0];
    assert.deepStrictEqual([c.dataText, c.categories, c.series], [null, 'A2:A3', [{ name: 'Aktual', values: 'C2:C3' }, { nameFrom: 'E1', values: 'E2:E3' }]], 'given back as text');
    s.insertCols('B');
    c = s.charts()[0];
    assert.deepStrictEqual([c.categories, c.series.map((x) => x.values)], ['A2:A3', ['D2:D3', 'F2:F3']], 'each range moves with its cells');
    // a block and, after its series, one of its own range
    const both = s.addChart({ at: 'H12:M20', data: 'C1:D3', type: 'line', series: [{}, {}, { name: 'Rencana', values: 'F2:F3', dash: true }] });
    m = s.chartData(both);
    assert.deepStrictEqual([m.series.map((x) => x.name), m.fromBlock, m.series[2].dash], [['Minggu', 'Aktual', 'Rencana'], 2, true], 'the series of the block first, then the one of its own range');
    assert.throws(() => s.setChart(id, { series: [] }), /needs `data` or series/);
    assert.throws(() => s.addChart({ at: 'A1:B2', series: [{ name: 'x' }] }), /needs `at`/);
    // scatter: x and y of each series, a date x
    const o = wb.sheet('Opname');
    o.setValues('A1', [[46300, 0.1], [46310, 0.3], [46330, 0.5]]);
    o.setColProps('A', { format: { type: 'date' } });
    const sc = s.addChart({ at: 'O1:T10', type: 'scatter', lines: true, series: [{ name: 'Realisasi', x: 'Opname!A1:A3', values: 'Opname!B1:B3' }] });
    m = s.chartData(sc);
    assert.deepStrictEqual([m.series[0].x, m.series[0].values, m.series[0].xFormat.type], [[46300, 46310, 46330], [0.1, 0.3, 0.5], 'date'], 'a scatter series: its x and its y, the format of its x');
    ok('series with their own ranges (a column between them, another sheet), a block and own series together, scatter');

    const back = await importXlsx(exportXlsx(wb));
    assert.deepStrictEqual(back.warnings, []);
    const got = back.workbook.sheet('Sheet1').charts().map((x) => [x.type, x.dataText, x.categories || null, x.lines || false, x.series.map((y) => [y.values || null, y.x || null, y.nameFrom || y.name || null])]);
    assert.deepStrictEqual(got[0], ['bar', null, 'A2:A3', false, [['D2:D3', null, 'Aktual'], ['F2:F3', null, 'F1']]], 'own ranges through a file (a bullet comes back as bars)');
    assert.deepStrictEqual(got[2], ['scatter', null, null, true, [['Opname!B1:B3', 'Opname!A1:A3', 'Realisasi']]], 'a scatter through a file');
    ok('own ranges and scatter in an .xlsx file, and back');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
