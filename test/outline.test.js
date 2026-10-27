// Groups of rows and columns without a screen (step R5): grouped, nested, folded and opened (its rows have no height), the level buttons, ungrouped one
// level at a time, rows inserted inside a group, columns too, undo, saved and read back, 100 000 rows in groups.
//   node test/outline.test.js
import assert from 'node:assert';
import { createWorkbook, exportXlsx, importXlsx } from '../src/core/index.js';
import { zipStore } from '../src/core/excel/zip.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const visible = (wb, s, n) => Array.from({ length: n }, (_, r) => r).filter((r) => wb.rowAxis(s).size(r) > 0);

{
    // a BOQ: two chapters (rows 1-3 and 5-8), the second with a sub-chapter (rows 6-7)
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.groupRows(s, 1, 3);
    wb.groupRows(s, 5, 8);
    wb.groupRows(s, 6, 7);
    assert.deepStrictEqual(wb.rowGroups(s), { maxLevel: 2, groups: [{ level: 1, from: 1, to: 3, folded: false }, { level: 1, from: 5, to: 8, folded: false }, { level: 2, from: 6, to: 7, folded: false }] });
    wb.foldRowGroup(s, 1, 1, true);
    assert.deepStrictEqual(visible(wb, s, 10), [0, 4, 5, 6, 7, 8, 9], 'a group folded: its rows are not shown');
    wb.foldRowGroup(s, 6, 2, true);
    assert.deepStrictEqual(visible(wb, s, 10), [0, 4, 5, 8, 9], 'a group inside a group');
    wb.foldRowGroup(s, 1, 1, false);
    assert.deepStrictEqual(visible(wb, s, 10), [0, 1, 2, 3, 4, 5, 8, 9], 'opened again; the inner one stays folded');

    // the level buttons: 1 shows the chapters only, 2 the sub-chapters too, 3 everything
    wb.showRowLevel(s, 0);
    assert.deepStrictEqual(visible(wb, s, 10), [0, 4, 9], 'level 1: only the rows that are in no group');
    wb.showRowLevel(s, 1);
    assert.deepStrictEqual(visible(wb, s, 10), [0, 1, 2, 3, 4, 5, 8, 9], 'level 2: the sub-chapter folded');
    wb.showRowLevel(s, 2);
    assert.deepStrictEqual(visible(wb, s, 10).length, 10, 'level 3: everything');
    wb.undo();
    assert.deepStrictEqual(visible(wb, s, 10), [0, 1, 2, 3, 4, 5, 8, 9], 'a level button is one change: undone');

    // a row inserted inside a group is in it (as in Google Sheets); one inserted just before it is not
    wb.showRowLevel(s, 2);
    wb.insertRows(s, 2, 1);
    assert.deepStrictEqual(wb.rowGroups(s).groups[0], { level: 1, from: 1, to: 4, folded: false }, 'a row inserted inside a group is in it');
    wb.undo();
    wb.insertRows(s, 1, 1);
    assert.deepStrictEqual(wb.rowGroups(s).groups[0], { level: 1, from: 2, to: 4, folded: false }, 'one inserted before it (after its title) is not');
    wb.undo();
    assert.deepStrictEqual(wb.rowGroups(s).groups[0], { level: 1, from: 1, to: 3, folded: false });

    // ungroup: one level at a time, the fold goes with its level
    wb.foldRowGroup(s, 6, 2, true);
    wb.ungroupRows(s, 5, 8);
    assert.deepStrictEqual(wb.rowGroups(s).groups.filter((g) => g.from >= 5).map((g) => [g.level, g.from, g.to, g.folded]), [[1, 6, 7, false]], 'the outer level went; the inner group is level 1 now, open');
    assert.throws(() => { for (let i = 0; i < 8; i++) wb.groupRows(s, 1, 1); }, /7 levels deep at most/);

    // columns
    wb.groupCols(s, 2, 4);
    wb.foldColGroup(s, 2, 1, true);
    assert.deepStrictEqual([1, 2, 3, 4, 5].map((c) => wb.colAxis(s).size(c) > 0), [true, false, false, false, true], 'a group of columns folded');
    const again = createWorkbook(wb.toJSON());
    const t = again.sheetIds()[0];
    assert.deepStrictEqual([again.rowGroups(t), again.colGroups(t)], [wb.rowGroups(s), wb.colGroups(s)], 'saved and read back, folded as they were');
    ok('groups: nested, folded and opened, level buttons, inserted rows, ungroup one level at a time, at most 7 levels, columns, undo, saved');
}

{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.insertRows(s, 1000, 99000);
    const t0 = Date.now();
    for (let start = 1; start < 100000; start += 100) wb.groupRows(s, start, start + 98);
    const made = Date.now() - t0;
    const t1 = Date.now();
    wb.showRowLevel(s, 0);
    const axis = wb.rowAxis(s);
    const folded = Date.now() - t1;
    assert.strictEqual(wb.rowGroups(s).groups.length, 1000);
    assert.strictEqual(axis.total, 1000 * 21, 'only the 1000 title rows show');
    console.log('     1000 groups over 100 000 rows: made in ' + made + ' ms, all folded in ' + folded + ' ms');
    assert.ok(folded < 2000);
    ok('1000 groups over 100 000 rows, folded at once');
}

// ---- .xlsx ---------------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['1. Tanah'], ['Galian'], ['Urugan'], ['2. Beton'], ['Pile'], ['Balok'], ['Kolom']]);
    wb.groupRows(s, 1, 2);
    wb.groupRows(s, 4, 6);
    wb.groupRows(s, 5, 6);
    wb.foldRowGroup(s, 1, 1, true);
    wb.foldRowGroup(s, 5, 2, true);
    wb.setRowProps(s, [9], { hidden: true });
    wb.groupCols(s, 2, 3);
    wb.foldColGroup(s, 2, 1, true);
    const { workbook: back, warnings } = await importXlsx(exportXlsx(wb));
    const b = back.sheetIds()[0];
    assert.deepStrictEqual(warnings, []);
    assert.deepStrictEqual(back.rowGroups(b), wb.rowGroups(s), 'the groups of rows, folded as they were');
    assert.deepStrictEqual(back.colGroups(b), wb.colGroups(s), 'of columns too');
    assert.deepStrictEqual(visible(back, b, 11), visible(wb, s, 11), 'the same rows show');
    back.showRowLevel(b, 9);
    assert.deepStrictEqual(visible(back, b, 11), [0, 1, 2, 3, 4, 5, 6, 7, 8, 10], 'opened: the folded rows were the groups\', the hidden row 10 stays hidden');
    ok('groups out to .xlsx and back: levels, folded groups of rows and columns, a row hidden by hand stays hidden');
}
{
    // as Excel writes it: a title below its group (Excel's own way), the group's rows hidden, the title row collapsed
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const files = [
        ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
        ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="' + ns + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BOQ" sheetId="1" r:id="rId1"/></sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'],
        ['xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="' + ns + '"><sheetFormatPr defaultRowHeight="15" outlineLevelRow="1"/><sheetData>'
            + '<row r="1"><c r="A1" t="inlineStr"><is><t>Item</t></is></c></row><row r="2" outlineLevel="1" hidden="1"/><row r="3" outlineLevel="1" hidden="1"/>'
            + '<row r="4" collapsed="1"><c r="A4" t="inlineStr"><is><t>Subtotal</t></is></c></row><row r="5" outlineLevel="1"/><row r="6" outlineLevel="1"/></sheetData></worksheet>']
    ];
    const { workbook: wb } = await importXlsx(zipStore(files.map(([name, text]) => ({ name, text }))));
    const s = wb.sheetIds()[0];
    assert.deepStrictEqual(wb.rowGroups(s).groups, [{ level: 1, from: 1, to: 2, folded: true }, { level: 1, from: 4, to: 5, folded: false }], 'a group with all its rows hidden is folded; one with its rows shown is open');
    wb.showRowLevel(s, 9);
    assert.deepStrictEqual(visible(wb, s, 6), [0, 1, 2, 3, 4, 5], 'its rows were the group\'s to hide');
    ok('groups as Excel writes them: levels, a folded group known by its hidden rows');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
