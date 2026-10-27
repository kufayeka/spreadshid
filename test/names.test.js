// Named ranges without a screen (step R5): a formula that uses a name before it is made (#NAME?) and after; a change in the range, a name renamed, pointed
// elsewhere, taken away, undone; a name into another sheet, of one cell; rows inserted inside its range; what a name may be; saved and read back; out
// to .xlsx and back, from a file as Excel writes it, and added to a workbook that has a name already.
//   node test/names.test.js
import assert from 'node:assert';
import { deflateRawSync } from 'node:zlib';
import { createWorkbook, exportXlsx, importXlsx, importXlsxInto } from '../src/core/index.js';
import { zipStore } from '../src/core/excel/zip.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const code = (v) => (v && typeof v === 'object' ? v.code : v);
void deflateRawSync;

// ---- in formulas ----------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const rates = wb.addSheet('Rates');
    wb.setValues(rates, 0, 0, [['Concrete', 1250000]]);
    wb.setValues(s, 0, 0, [[10], [20], [30]]);
    wb.setValues(s, 0, 2, '=SUM(Budget)*Concrete');
    assert.strictEqual(code(wb.value(s, 0, 2)), '#NAME?', 'a name the workbook does not have yet');
    const budget = wb.addName('Budget', s, { r1: 0, c1: 0, r2: 2, c2: 0 });
    wb.addName('Concrete', rates, { r1: 0, c1: 1, r2: 0, c2: 1 });
    assert.strictEqual(wb.value(s, 0, 2), 60 * 1250000, 'made: the formula works, a name of one cell into another sheet too');
    wb.setValues(s, 1, 0, 25);
    assert.strictEqual(wb.value(s, 0, 2), 65 * 1250000, 'a change inside the range is seen');
    wb.setValues(rates, 0, 1, 1000);
    assert.strictEqual(wb.value(s, 0, 2), 65000, 'and in the other sheet');
    wb.insertRows(s, 1, 1);
    wb.setValues(s, 1, 0, 100);
    assert.strictEqual(wb.value(s, 0, 2), 165000, 'a row inserted inside the range is part of it');
    wb.setName(budget, { name: 'Volume' });
    assert.strictEqual(wb.input(s, 0, 2), '=SUM(Volume)*Concrete', 'renamed: the formula shows the new name');
    assert.strictEqual(wb.value(s, 0, 2), 165000);
    wb.setName(budget, { range: { r1: 0, c1: 0, r2: 0, c2: 0 } });
    assert.strictEqual(wb.value(s, 0, 2), 10000, 'pointed at another range: worked out again');
    wb.undo();
    assert.strictEqual(wb.value(s, 0, 2), 165000, 'undone');
    wb.removeName(budget);
    assert.strictEqual(code(wb.value(s, 0, 2)), '#NAME?', 'taken away: #NAME?');
    assert.strictEqual(wb.input(s, 0, 2), '=SUM(Volume)*Concrete', 'the formula keeps the name');
    wb.addName('volume', s, { r1: 0, c1: 0, r2: 1, c2: 0 });
    assert.strictEqual(wb.value(s, 0, 2), 110000, 'a range named so again: it works again (names have no case)');
    wb.setValues(s, 5, 0, '=SUM(volume)+COUNT(Volume)');
    assert.strictEqual(wb.value(s, 5, 0), 112);
    assert.deepStrictEqual(wb.nameRange('VOLUME'), { sheetId: s, range: { r1: 0, c1: 0, r2: 1, c2: 0 } });
    assert.deepStrictEqual(wb.names().map((n) => n.name), ['Concrete', 'volume']);
    ok('names in formulas: before and after they are made, changes inside, another sheet, insert, rename, another range, undo, taken away');
}

// ---- what a name may be -------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const one = { r1: 0, c1: 0, r2: 0, c2: 0 };
    wb.addName('Total_2026.Q1', s, one);
    for (const [bad, why] of [['', /needs a name/], ['2026', /starts with a letter/], ['Harga satuan', /letters, digits/], ['A1', /address of a cell/], ['abc123', /address of a cell/], ['R1C1', /address of a cell/], ['true', /a value/], ['TOTAL_2026.q1', /already/]]) {
        assert.throws(() => wb.addName(bad, s, one), why, bad);
    }
    ok('a name: a letter or _ first, no spaces, not an address, not TRUE, not taken (whatever its case)');
}

// ---- saved and read back ---------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [[4], [6], ['=SUM(Qty)']]);
    wb.addName('Qty', s, { r1: 0, c1: 0, r2: 1, c2: 0 });
    assert.ok(wb.pendingPatch().workbook.settings.names.length === 1, 'the names are in the workbook\'s settings, saved with them');
    const again = createWorkbook(wb.toJSON());
    assert.strictEqual(again.value(again.sheetIds()[0], 2, 0), 10);
    ok('names saved with the workbook and read back');
}

// ---- .xlsx -----------------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSheetProps(s, { name: "Rencana 'A'" });
    wb.setValues(s, 0, 0, [[4], [6], ['=SUM(Qty)*Rate']]);
    wb.setValues(s, 0, 1, 1.5);
    wb.addName('Qty', s, { r1: 0, c1: 0, r2: 1, c2: 0 });
    wb.addName('Rate', s, { r1: 0, c1: 1, r2: 0, c2: 1 });
    const bytes = exportXlsx(wb);
    const { workbook: back, warnings } = await importXlsx(bytes);
    const b = back.sheetIds()[0];
    assert.deepStrictEqual(warnings, []);
    assert.deepStrictEqual(back.names().map((n) => [n.name, n.range]), [['Qty', { r1: 0, c1: 0, r2: 1, c2: 0 }], ['Rate', { r1: 0, c1: 1, r2: 0, c2: 1 }]], 'the names, a sheet name with a quote too');
    assert.deepStrictEqual([back.input(b, 2, 0), back.value(b, 2, 0)], ['=SUM(Qty)*Rate', 15], 'the formula that uses them works');
    back.setValues(b, 0, 0, 14);
    assert.strictEqual(back.value(b, 2, 0), 30, 'and follows its cells');

    // added to a workbook that has a Rate of its own: the file's Qty comes, its Rate does not (the workbook's is kept), one undo takes all away
    const host = createWorkbook();
    const [h] = host.sheetIds();
    host.setValues(h, 0, 0, 3);
    host.addName('Rate', h, { r1: 0, c1: 0, r2: 0, c2: 0 });
    const into = await importXlsxInto(host, bytes);
    assert.deepStrictEqual(host.names().map((n) => n.name), ['Rate', 'Qty']);
    assert.strictEqual(host.value(into.sheetIds[0], 2, 0), 30, 'the file\'s formula reads the workbook\'s Rate (3)');
    assert.ok(into.warnings.some((w) => /Rate already/.test(w)), 'and that is said');
    host.undo();
    assert.deepStrictEqual([host.sheetIds().length, host.names().map((n) => n.name)], [1, ['Rate']], 'one undo: the sheet and its name');
    ok('names out to .xlsx and back, a formula with them; added to a workbook: a name it has stays, one undo');
}
{
    // as Excel writes it: a name of the workbook, a name of one sheet only (left out), a name of a formula (left out), Excel's own (_xlnm, not a name)
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const files = [
        ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
        ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="' + ns + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data Proyek" sheetId="1" r:id="rId1"/></sheets>'
            + '<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">\'Data Proyek\'!$A$1:$B$3</definedName><definedName name="Harga">\'Data Proyek\'!$B$1:$B$3</definedName>'
            + '<definedName name="Lokal" localSheetId="0">\'Data Proyek\'!$A$1</definedName><definedName name="Pajak">0.11</definedName></definedNames></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'],
        ['xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="' + ns + '"><sheetData><row r="1"><c r="B1"><v>100</v></c><c r="C1"><f>SUM(Harga)</f><v>600</v></c><c r="D1"><f>Harga*Pajak</f><v>11</v></c></row>'
            + '<row r="2"><c r="B2"><v>200</v></c></row><row r="3"><c r="B3"><v>300</v></c></row></sheetData></worksheet>']
    ];
    const { workbook: wb, warnings } = await importXlsx(zipStore(files.map(([name, text]) => ({ name, text }))));
    const s = wb.sheetIds()[0];
    assert.deepStrictEqual(wb.names().map((n) => n.name), ['Harga'], 'the workbook\'s name; not Excel\'s print area');
    assert.deepStrictEqual([wb.input(s, 0, 2), wb.value(s, 0, 2)], ['=SUM(Harga)', 600], 'a formula with it is kept as a formula');
    assert.strictEqual(wb.value(s, 0, 3), 11, 'a formula with a name that was left out keeps the value Excel worked out');
    assert.ok(warnings.some((w) => /Lokal, Pajak were not imported/.test(w)), warnings.join(' | '));
    ok('names from Excel: a name of the workbook kept, a name of one sheet or of a value left out and said, the print area is no name');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
