// Excel and CSV without a screen (step R8): a workbook out to .xlsx and back the same; a package written the way Excel writes it (deflated, shared
// strings, built-in and custom number formats, shared formulas, a function the sheet does not have, errors, booleans, the 1904 date system) read
// right; sheets added to a workbook as one change; CSV out and in (commas, semicolons, quotes, new lines).
//   node test/excel.test.js
import assert from 'node:assert';
import { deflateRawSync } from 'node:zlib';
import { createWorkbook, exportXlsx, importXlsx, importXlsxInto, importCsvInto, exportCsv, parseCsv, dateToSerial } from '../src/core/index.js';
import { crc32 } from '../src/core/excel/zip.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const serial = (y, m, d) => dateToSerial(new Date(Date.UTC(y, m - 1, d)));

// ---- out and back in --------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setSheetProps(s, { name: 'BOQ', freezeRows: 1 });
    const rates = wb.addSheet('Rates');
    wb.setValues(rates, 0, 0, [['Material', 'Rate'], ['Concrete', 1250000]]);
    wb.setValues(s, 0, 0, [['Item', 'Qty', 'Rate', 'Amount', 'Done', 'Start', 'Share']]);
    wb.setValues(s, 1, 0, [['Pile', 10, '=Rates!B2', '=B2*C2', 'TRUE', '26/10/2026', '12,5%'], ['Beam "B1"', 4, 900000, '=B3*C3', 'FALSE', '27/10/2026', '87,5%']]);
    wb.setValues(s, 3, 3, '=SUM(D2:D3)');
    wb.setStyle(s, { r1: 0, c1: 0, r2: 0, c2: 6 }, { bold: true, fill: '#e8f0fe', align: 'center', borders: { bottom: { width: 2, style: 'solid', color: '#1a73e8' } } });
    wb.setStyle(s, { r1: 1, c1: 2, r2: 3, c2: 3 }, { format: { type: 'money', decimals: 2 } });
    wb.setStyle(s, { r1: 1, c1: 0, r2: 1, c2: 0 }, { italic: true, color: '#cc0000', fontSize: 14, valign: 'middle', wrap: 'wrap' });
    wb.mergeCells(s, { r1: 5, c1: 0, r2: 5, c2: 3 });
    wb.setValues(s, 5, 0, 'Notes across four cells');
    wb.setColProps(s, [1], { width: 180 });
    wb.setRowProps(s, [4], { hidden: true });
    wb.setRowProps(s, [1], { height: 40 });
    wb.hideSheet(rates, false);

    const bytes = exportXlsx(wb);
    assert.ok(bytes instanceof Uint8Array && bytes.length > 1000, 'the bytes of a file');
    assert.strictEqual(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'a zip, as an .xlsx is');

    const { workbook: back, warnings } = await importXlsx(bytes, { settings: { locale: 'id-ID', currency: 'IDR' } });
    assert.deepStrictEqual(warnings, []);
    const b = back.sheetIdByName('BOQ');
    assert.deepStrictEqual(back.sheetIds().map((x) => back.sheetProps(x).name), ['BOQ', 'Rates']);
    assert.deepStrictEqual([0, 1, 2, 3, 4].map((c) => back.input(b, 1, c)), ['Pile', '10', '=Rates!B2', '=B2*C2', 'TRUE'], 'values and formulas, a formula into another sheet too');
    assert.strictEqual(back.value(b, 3, 3), 12500000 + 3600000, 'the sum works out the same');
    assert.strictEqual(back.value(b, 2, 0), 'Beam "B1"', 'a text with quotes');
    assert.strictEqual(back.value(b, 1, 5), serial(2026, 10, 26), 'a date stays the number it is');
    assert.strictEqual(back.display(b, 1, 5).text, '26/10/2026', 'and shows as a date');
    assert.strictEqual(back.display(b, 1, 6).text, wb.display(s, 1, 6).text, 'a percent, shown as it was');
    assert.strictEqual(back.value(b, 1, 6), 0.125, 'a percent is its fraction');
    assert.strictEqual(back.display(b, 1, 3).text, 'Rp 12.500.000,00', 'money in rupiah');
    assert.deepStrictEqual(back.style(b, 0, 0), { bold: true, fill: '#e8f0fe', align: 'center', borders: { bottom: { style: 'solid', width: 2, color: '#1a73e8' } } }, 'bold, fill, alignment and a border');
    const st = back.style(b, 1, 0);
    assert.deepStrictEqual([st.italic, st.color, st.fontSize, st.valign, st.wrap], [true, '#cc0000', 14, 'middle', 'wrap'], 'italic, colour, size, vertical alignment, wrapping');
    assert.deepStrictEqual(back.merges(b), [{ r1: 5, c1: 0, r2: 5, c2: 3 }], 'merged cells');
    assert.strictEqual(back.sheetProps(b).freezeRows, 1, 'frozen rows');
    assert.strictEqual(back.colAxis(b).size(1), 180, 'a column width');
    assert.strictEqual(back.rowProps(b, 1).height, 40, 'a row height');
    assert.strictEqual(back.rowProps(b, 4).hidden, true, 'a hidden row');
    assert.strictEqual(back.pendingPatch().rows.upsert.length, 2000, 'a workbook made from a file is new: all of it is in its first save');
    ok('a workbook out to .xlsx and back: values, formulas (across sheets), dates, percent, money, styles, borders, merges, frozen rows, sizes, hidden rows');
}

// ---- what this person may not see does not go out --------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Item', 'Cost'], ['Pile', 400]]);
    wb.setRules([{ columns: ['Cost'], mode: 'hidden' }]);
    const { workbook: back } = await importXlsx(exportXlsx(wb));
    const b = back.sheetIds()[0];
    assert.deepStrictEqual([back.value(b, 0, 1), back.value(b, 1, 1)], ['Cost', null], 'the hidden cost is not in the file (its header is)');
    ok('a cell the rules hide from this person is not in the file they download');
}

// ---- a package as Excel writes it -----------------------------------------------------------------------------------------------------------------
function excelPackage(files) {
    // deflated entries, as Excel writes them
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const [name, text] of Object.entries(files)) {
        const nameBytes = enc.encode(name), plain = enc.encode(text), packed = deflateRawSync(plain), crc = crc32(plain);
        const head = [].concat(u32(0x04034b50), u16(20), u16(0), u16(8), u16(0), u16(0x21), u32(crc), u32(packed.length), u32(plain.length), u16(nameBytes.length), u16(0));
        chunks.push(Uint8Array.from(head), nameBytes, packed);
        central.push({ nameBytes, crc, comp: packed.length, size: plain.length, offset });
        offset += head.length + nameBytes.length + packed.length;
    }
    let cd = 0;
    for (const c of central) {
        const rec = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0x21), u32(c.crc), u32(c.comp), u32(c.size), u16(c.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
        chunks.push(Uint8Array.from(rec), c.nameBytes);
        cd += rec.length + c.nameBytes.length;
    }
    chunks.push(Uint8Array.from([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cd), u32(offset), u16(0))));
    return Buffer.concat(chunks.map((x) => Buffer.from(x)));
}
{
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const files = {
        '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="' + ns + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="1"/><sheets><sheet name="Tagihan" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/sharedStrings.xml': '<?xml version="1.0"?><sst xmlns="' + ns + '"><si><t>Termin</t></si><si><r><t>Nilai </t></r><r><rPr><b/></rPr><t>termin</t></r></si><si><t>DP 1</t></si></sst>',
        'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="' + ns + '"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot;#,##0"/></numFmts>'
            + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFF0000"/><name val="Calibri"/></font></fonts>'
            + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills>'
            + '<borders count="2"><border/><border><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders>'
            + '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>'
            + '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="1" fillId="2" borderId="1"/>'
            + '<xf numFmtId="4" fontId="0" fillId="0" borderId="0"><alignment horizontal="right" textRotation="45"/></xf></cellXfs></styleSheet>',
        'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="' + ns + '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews>'
            + '<cols><col min="2" max="2" width="20" customWidth="1"/><col min="5" max="5" width="9" hidden="1"/></cols><sheetData>'
            + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Tanggal</t></is></c></row>'
            + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>200000</v></c><c r="C2" s="2"><v>44494</v></c><c r="D2" s="3"><v>0.075</v></c><c r="E2" t="b"><v>1</v></c></row>'
            + '<row r="3"><c r="A3"><v>1</v></c><c r="B3" s="1"><f>B2*2</f><v>400000</v></c><c r="C3" s="4"><f t="shared" ref="C3:C4" si="0">B3/2</f><v>200000</v></c><c r="D3" t="e"><v>#DIV/0!</v></c></row>'
            + '<row r="4" ht="30" customHeight="1"><c r="A4"><v>2</v></c><c r="B4" s="1"><f>CUBEVALUE("x",B3)</f><v>123</v></c><c r="C4" s="4"><f t="shared" si="0"/><v>61.5</v></c></row>'
            + '</sheetData><mergeCells count="1"><mergeCell ref="A6:C6"/></mergeCells></worksheet>'
    };
    const { workbook: wb, warnings } = await importXlsx(excelPackage(files), { settings: { locale: 'id-ID', currency: 'IDR' } });
    const s = wb.sheetIds()[0];
    assert.strictEqual(wb.sheetProps(s).name, 'Tagihan');
    assert.deepStrictEqual([wb.value(s, 0, 0), wb.value(s, 0, 1), wb.value(s, 0, 2), wb.value(s, 1, 0)], ['Termin', 'Nilai termin', 'Tanggal', 'DP 1'], 'shared strings, rich text as plain text, inline strings');
    assert.strictEqual(wb.display(s, 1, 1).text, 'Rp 200.000', 'a custom money format "Rp"#,##0 is money');
    assert.strictEqual(wb.value(s, 1, 2), 44494 + 1462, 'a date of the 1904 system is moved to the sheet\'s count');
    assert.strictEqual(wb.display(s, 1, 2).text, '26/10/2025', 'and shows as the date it was in Excel');
    assert.strictEqual(wb.display(s, 1, 3).text, '7,50%', 'a built-in percent format');
    assert.deepStrictEqual([wb.style(s, 1, 3).bold, wb.style(s, 1, 3).color, wb.style(s, 1, 3).fill, wb.style(s, 1, 3).borders.bottom.width], [true, '#ff0000', '#ffff00', 1], 'a font, a fill and a border');
    assert.strictEqual(wb.value(s, 1, 4), true, 'a boolean');
    assert.strictEqual(wb.input(s, 2, 1), '=B2*2', 'a formula');
    assert.deepStrictEqual([wb.input(s, 2, 2), wb.input(s, 3, 2)], ['=B3/2', '=B4/2'], 'a shared formula, moved to each cell it covers');
    assert.strictEqual(wb.value(s, 2, 3).code, '#DIV/0!', 'an error stays an error');
    assert.strictEqual(wb.value(s, 3, 1), 123, 'a formula with a function the sheet does not have keeps the value Excel worked out');
    assert.ok(warnings.some((w) => /CUBEVALUE/.test(w)), 'and says so');
    assert.deepStrictEqual([wb.style(s, 2, 2).align, wb.style(s, 2, 2).rotate], ['right', 45], 'alignment and rotation');
    assert.strictEqual(wb.sheetProps(s).freezeRows, 1);
    assert.strictEqual(wb.colAxis(s).size(1), 145, 'a width in Excel\'s characters, in pixels');
    assert.strictEqual(wb.colProps(s, 4).hidden, true, 'a hidden column');
    assert.strictEqual(wb.rowProps(s, 3).height, 40, 'a height in points, in pixels');
    assert.deepStrictEqual(wb.merges(s), [{ r1: 5, c1: 0, r2: 5, c2: 2 }]);
    ok('a package as Excel writes it: deflated, shared and inline strings, number formats, 1904 dates, shared formulas, unknown functions, errors, sizes, merges');
}

// ---- sheets added to a workbook ---------------------------------------------------------------------------------------------------------------------
{
    const src = createWorkbook();
    src.setSheetProps(src.sheetIds()[0], { name: 'BOQ' });
    src.setValues(src.sheetIds()[0], 0, 0, [[5, '=A1*2']]);
    const bytes = exportXlsx(src);
    const wb = createWorkbook();
    wb.setSheetProps(wb.sheetIds()[0], { name: 'BOQ' });
    const { sheetIds } = await importXlsxInto(wb, bytes);
    assert.deepStrictEqual(wb.sheetIds().map((x) => wb.sheetProps(x).name), ['BOQ', 'BOQ (2)'], 'a name that is taken gets a number');
    assert.strictEqual(wb.value(sheetIds[0], 0, 1), 10, 'its formulas work');
    wb.undo();
    assert.strictEqual(wb.sheetIds().length, 1, 'adding the sheets of a file is one change');
    ok('the sheets of a file added to a workbook: names that do not clash, formulas, one undo');
}

// ---- CSV ------------------------------------------------------------------------------------------------------------------------------------------
{
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setValues(s, 0, 0, [['Item', 'Note', 'Amount'], ['Pile', 'two\nlines', '=10*1500.5'], ['Beam, steel', 'say "hi"', 2500]]);
    assert.strictEqual(exportCsv(wb, s), 'Item,Note,Amount\r\nPile,"two\nlines",15005\r\n"Beam, steel","say ""hi""",2500', 'quotes where a field needs them');
    assert.deepStrictEqual(parseCsv('Item;Qty;Rate\r\nPile;10;"1.250,5"\r\n"a;b";"say ""x""";3'), [['Item', 'Qty', 'Rate'], ['Pile', '10', '1.250,5'], ['a;b', 'say "x"', '3']], 'semicolons found (Excel in Indonesian), quotes read');
    assert.deepStrictEqual(parseCsv('﻿a,b\n"x\ny",2\n'), [['a', 'b'], ['x\ny', '2']], 'a byte order mark, a new line inside quotes');
    wb.setValues(s, 5, 0, parseCsv('Pile;10;1.250,5'));
    assert.strictEqual(wb.value(s, 5, 2), 1250.5, 'CSV texts written in a sheet are read as typed in its locale');
    ok('CSV: out with quotes where needed; in with the separator found, quotes, new lines; numbers in the locale');
}

{
    const wb = createWorkbook({ settings: { locale: 'id-ID', currency: 'IDR' } });
    wb.setSheetProps(wb.sheetIds()[0], { name: 'termin' });
    const { sheetIds: [n] } = importCsvInto(wb, 'Termin;Nilai\r\nDP;1.250,5\r\nTotal;=B2*2', 'Termin');
    assert.strictEqual(wb.sheetProps(n).name, 'Termin (2)', 'a name that is taken (whatever its case) gets a number');
    assert.deepStrictEqual([wb.value(n, 1, 1), wb.value(n, 2, 1)], [1250.5, 2501], 'numbers in the locale, formulas');
    const big = importCsvInto(wb, Array.from({ length: 1500 }, (_, i) => i + ',xxx' + ','.repeat(28) + ',last').join('\n'), 'Big').sheetIds[0];
    assert.deepStrictEqual([wb.value(big, 1499, 0), wb.value(big, 1499, 30)], [1499, 'last'], 'a sheet as big as the file');
    wb.undo();
    assert.strictEqual(wb.sheetIds().length, 2, 'one change');
    ok('a CSV as a new sheet: its name, numbers in the locale, formulas, as big as it is, one undo');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
