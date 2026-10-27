// The filter of a sheet without a screen (step R5): made on a range or on the block around a cell, rows hidden by values and by condition (and by a
// formula), the list of values (what other columns hide is left out), several columns together, a row edited stays until the filter is applied again
// (as in Google Sheets), inserted rows, undo, taken away, saved and read back, 100 000 rows.
//   node test/filter.test.js
import assert from 'node:assert';
import { createWorkbook, exportXlsx, importXlsx } from '../src/core/index.js';
import { zipStore } from '../src/core/excel/zip.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const shown = (wb, s, n) => Array.from({ length: n }, (_, r) => r).filter((r) => !wb.filteredOut(s, r) && wb.rowAxis(s).size(r) > 0);

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Item', 'Qty', 'Status'], ['Pile', 120, 'Draft'], ['Beam', 40, 'Approved'], ['Slab', 80, 'Draft'], ['Wall', null, 'Rejected'], ['Roof', 15, 'Approved']]);
    wb.setValues(s, 7, 0, 'a note under the table');
    assert.deepStrictEqual(wb.dataRegion(s, 2, 1), { r1: 0, c1: 0, r2: 5, c2: 2 }, 'the block around a cell: the table, not the note after an empty row');
    wb.createFilter(s, wb.dataRegion(s, 2, 1));
    assert.deepStrictEqual(wb.filterOf(s), { range: { r1: 0, c1: 0, r2: 5, c2: 2 }, columns: {} });
    assert.deepStrictEqual(wb.filterValues(s, 2), [{ text: 'Approved', count: 2 }, { text: 'Draft', count: 2 }, { text: 'Rejected', count: 1 }], 'the values of a column, counted, in order');
    assert.deepStrictEqual(wb.filterValues(s, 1).map((x) => x.text), ['15', '40', '80', '120', ''], 'numbers by their value, the empty cell last');

    wb.setFilterColumn(s, 2, { hidden: ['Draft', 'Rejected'] });
    assert.deepStrictEqual(shown(wb, s, 8), [0, 2, 5, 6, 7], 'by values: the Draft and Rejected rows are hidden, the header and the rows outside stay');
    assert.strictEqual(wb.rowAxis(s).size(1), 0, 'a hidden row has no height');
    wb.setFilterColumn(s, 1, { op: 'gt', a: 20 });
    assert.deepStrictEqual(shown(wb, s, 6), [0, 2], 'two columns: both must keep the row');
    assert.deepStrictEqual(wb.filterValues(s, 2).map((x) => x.text), ['Approved', 'Draft'], 'the list of a column leaves out what the other columns hide');

    // edited: the row stays until the filter is applied again
    wb.setValues(s, 2, 2, 'Draft');
    assert.deepStrictEqual(shown(wb, s, 6), [0, 2], 'an edited row stays shown');
    wb.setFilterColumn(s, 2, { hidden: ['Draft', 'Rejected'] });
    assert.deepStrictEqual(shown(wb, s, 6), [0], 'applied again: it is filtered');

    wb.setFilterColumn(s, 2, null);
    wb.setFilterColumn(s, 1, { op: 'formula', formula: '=B2>=$B$3' });
    assert.deepStrictEqual(shown(wb, s, 6), [0, 1, 2, 3], 'a custom formula, written for the first row under the header');
    wb.insertRows(s, 2, 1);
    wb.setValues(s, 2, 0, ['New', 1, 'Draft']);
    assert.deepStrictEqual(wb.filterOf(s).range, { r1: 0, c1: 0, r2: 6, c2: 2 }, 'a row inserted inside is part of the filter');
    assert.throws(() => wb.setFilterColumn(s, 5, { op: 'empty' }), /not in the filter/);

    // opened again, the filter is applied to the data as it is then (the New row typed after the filter is filtered too)
    const again = createWorkbook(wb.toJSON());
    const t = again.sheetIds()[0];
    assert.deepStrictEqual(shown(wb, s, 7), [0, 1, 2, 3, 4], 'the New row typed after the filter shows');
    assert.deepStrictEqual(shown(again, t, 7), [0, 1, 3, 4], 'saved and opened again: the filter is applied to what the sheet holds then');
    wb.removeFilter(s);
    assert.deepStrictEqual([wb.filterOf(s), shown(wb, s, 8).length], [null, 8], 'taken away: every row shows');
    wb.undo();
    assert.ok(wb.filterOf(s), 'and back with undo');
    ok('a filter: the block around a cell, values and conditions, several columns, the list of values, edited rows stay, a formula, insert, undo, saved');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const n = 100000;
    wb.insertRows(s, 1000, n - 999);
    const rows = [['Line', 'Status']];
    for (let i = 1; i <= n; i++) rows.push(['L' + i, i % 10 === 0 ? 'Late' : 'On time']);
    wb.setValues(s, 0, 0, rows);
    wb.createFilter(s, { r1: 0, c1: 0, r2: n, c2: 1 });
    const t0 = Date.now();
    wb.setFilterColumn(s, 1, { hidden: ['On time'] });
    const axis = wb.rowAxis(s);
    const took = Date.now() - t0;
    assert.strictEqual(axis.size(10), 21, 'a Late line shows');
    assert.strictEqual(axis.size(11), 0, 'an On time line does not');
    assert.ok(took < 3000, 'filtered in ' + took + ' ms');
    const t1 = Date.now();
    const values = wb.filterValues(s, 1);
    assert.deepStrictEqual(values, [{ text: 'Late', count: 10000 }, { text: 'On time', count: 90000 }]);
    console.log('     100 000 rows filtered in ' + took + ' ms, their values listed in ' + (Date.now() - t1) + ' ms');
    ok('100 000 rows filtered and their values listed');
}

// ---- .xlsx ---------------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Item', 'Qty', 'Status'], ['Pile', 120, 'Draft'], ['Beam', 40, 'Approved'], ['Slab', 80, 'Draft'], ['Wall', 5, ''], ['Roof', 15, 'Approved']]);
    wb.setRowProps(s, [7], { hidden: true });
    wb.createFilter(s, { r1: 0, c1: 0, r2: 5, c2: 2 });
    wb.setFilterColumn(s, 2, { hidden: ['Draft'] });
    wb.setFilterColumn(s, 1, { op: 'between', a: 10, b: 100 });
    const before = shown(wb, s, 8);
    const { workbook: back, warnings } = await importXlsx(exportXlsx(wb));
    const b = back.sheetIds()[0];
    assert.deepStrictEqual(warnings, []);
    assert.deepStrictEqual(back.filterOf(b), { range: { r1: 0, c1: 0, r2: 5, c2: 2 }, columns: { 1: { op: 'between', a: 10, b: 100 }, 2: { hidden: ['Draft'] } } }, 'the filter, by values and by condition');
    assert.deepStrictEqual(shown(back, b, 8), before, 'the same rows show');
    assert.strictEqual(back.rowProps(b, 7).hidden, true, 'a row hidden by hand outside the filter stays hidden');
    back.removeFilter(b);
    assert.deepStrictEqual(shown(back, b, 7), [0, 1, 2, 3, 4, 5, 6], 'the filter taken away: the rows it hid were not hidden by hand');
    ok('a filter out to .xlsx and back: values, a condition, the same rows; the rows it hid are its own');
}
{
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const files = [
        ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
        ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="' + ns + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Opname" sheetId="1" r:id="rId1"/></sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'],
        ['xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="' + ns + '"><sheetData>'
            + '<row r="1"><c r="A1" t="inlineStr"><is><t>Pekerjaan</t></is></c><c r="B1" t="inlineStr"><is><t>Vol</t></is></c><c r="C1" t="inlineStr"><is><t>Mandor</t></is></c></row>'
            + '<row r="2"><c r="A2" t="inlineStr"><is><t>Galian tanah</t></is></c><c r="B2"><v>12.5</v></c><c r="C2" t="inlineStr"><is><t>Budi</t></is></c></row>'
            + '<row r="3" hidden="1"><c r="A3" t="inlineStr"><is><t>Urugan</t></is></c><c r="B3"><v>3</v></c><c r="C3" t="inlineStr"><is><t>Andi</t></is></c></row>'
            + '<row r="4"><c r="A4" t="inlineStr"><is><t>Galian pondasi</t></is></c><c r="B4"><v>8</v></c><c r="C4" t="inlineStr"><is><t>Budi</t></is></c></row>'
            + '</sheetData><autoFilter ref="A1:C4"><filterColumn colId="0"><customFilters><customFilter val="Galian*"/></customFilters></filterColumn>'
            + '<filterColumn colId="1"><filters><filter val="12.5"/><filter val="8"/></filters></filterColumn><filterColumn colId="2"><top10 val="5"/></filterColumn></autoFilter></worksheet>']
    ];
    const { workbook: wb, warnings } = await importXlsx(zipStore(files.map(([name, text]) => ({ name, text }))));
    const s = wb.sheetIds()[0];
    assert.deepStrictEqual(wb.filterOf(s).columns, { 0: { op: 'textStarts', a: 'Galian' }, 1: { hidden: ['3'] } }, 'Galian* is "starts with", the values that show are 12.5 and 8');
    assert.deepStrictEqual(shown(wb, s, 4), [0, 1, 3], 'the Urugan row is the filter\'s');
    assert.ok(warnings.some((w) => /column C .* was not imported/.test(w)), warnings.join(' | '));
    wb.removeFilter(s);
    assert.deepStrictEqual(shown(wb, s, 4), [0, 1, 2, 3], 'and shows when the filter goes');
    ok('a filter as Excel writes it: a text with *, values (a number written apart), its hidden row; a top 10 said');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
