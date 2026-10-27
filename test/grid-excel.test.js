// Import and download in a real Chrome (step R8): File > Download > .xlsx gives the file a browser saves (read back here, without the cells the rules hide),
// File > Download > .csv this sheet, File > Import… takes an .xlsx and a .csv picked in the file input (their sheets are added and shown, one undo, and
// what was left out is told). The reading and writing underneath are in excel.test.js.
//   node test/grid-excel.test.js     (needs Chrome)
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromeAvailable, withExample } from './chrome.js';
import { createWorkbook, exportXlsx, importXlsx } from '../src/core/index.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

// the files a person picks: an .xlsx with two sheets and a formula from one into the other, and a CSV written by Excel in Indonesian
const folder = mkdtempSync(join(tmpdir(), 'ks-import-'));
const made = createWorkbook({ settings: { locale: 'id-ID', currency: 'IDR' } });
made.setSheetProps(made.sheetIds()[0], { name: 'Termin' });
const rates = made.addSheet('Harga');
made.setValues(rates, 0, 0, [['Beton', 1250000]]);
made.setValues(made.sheetIds()[0], 0, 0, [['DP', '=Harga!B1*2']]);
const xlsxPath = join(folder, 'Proyek.xlsx'), csvPath = join(folder, 'Opname minggu 3.csv');
writeFileSync(xlsxPath, exportXlsx(made));
writeFileSync(csvPath, '﻿Pekerjaan;Volume\r\nGalian;12,5\r\nUrugan;"1.040,25"\r\n');

try {
    await withExample(async ({ js, send, click, mouse, wait }) => {
        for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
        await wait(400);
        const q = (expr) => js(expr);
        const W = 'window.__workbook';
        const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
        const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
        const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(250); await click(p.x, p.y); await wait(300); return true; };
        const notice = () => q('(function(){ var n = document.querySelector(".ks-notice"); return n ? n.textContent : null; })()');
        const tabs = () => q('Array.from(document.querySelectorAll(".ks-tab")).map(function(t){ return t.textContent; })');

        // what the browser would save: the link's name and the bytes of its file, kept by the page
        await q(`(function(){ window.__saved = []; var make = URL.createObjectURL; URL.createObjectURL = function(blob){ var url = make(blob); blob.arrayBuffer().then(function(b){ window.__savedBytes = Array.from(new Uint8Array(b)); }); return url; };
            var real = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function(){ if (this.download) { window.__saved.push(this.download); return; } return real.call(this); }; })()`);

        await menubar('File');
        await menuPick('Download');
        check('File > Download opens its formats', (await q('Array.from(document.querySelectorAll(".ks-menu-item")).some(function(x){ return x.textContent.indexOf("Microsoft Excel (.xlsx)") === 0; })')));
        await menuPick('Microsoft Excel (.xlsx)');
        await wait(300);
        const saved = await q('window.__saved.slice()');
        check('the browser is given Spreadsheet.xlsx', saved[0] === 'Spreadsheet.xlsx', saved);
        const bytes = Uint8Array.from(await q('window.__savedBytes || []'));
        const { workbook: back } = await importXlsx(bytes);
        const b = back.sheetIds()[0];
        const shown = await q(`[${W}.value(${W}.sheetIds()[0], 1, 0), ${W}.value(${W}.sheetIds()[0], 1, 1), ${W}.value(${W}.sheetIds()[0], 1, 2)]`);
        check('the file holds what the sheet holds', JSON.stringify([back.value(b, 1, 0), back.value(b, 1, 1), back.value(b, 1, 2)]) === JSON.stringify(shown), [back.value(b, 1, 0), shown]);
        check('but not the cost this person may not see (only its header)', back.value(b, 0, 5) === 'Cost' && back.value(b, 1, 5) === null, back.value(b, 1, 5));

        await menubar('File');
        await menuPick('Download');
        await menuPick('Comma-separated values');
        await wait(300);
        const csvName = (await q('window.__saved.slice()'))[1];
        const csvText = await q('new TextDecoder("utf-8", { ignoreBOM: true }).decode(new Uint8Array(window.__savedBytes))');
        check('this sheet as CSV, named after it, the hidden cost empty (not its dots)', /^Spreadsheet - .+\.csv$/.test(csvName) && csvText.charCodeAt(0) === 0xfeff && csvText.split('\r\n')[0].indexOf('Cost') > 0 && csvText.split('\r\n')[1].split(',')[5] === '',[csvName, csvText.slice(0, 60)]);

        // File > Import… opens the file picker (the input), and the person picks the .xlsx
        await q('(function(){ window.__picked = 0; var real = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function(){ if (this.type === "file") { window.__picked++; return; } return real.call(this); }; })()');
        const before = await tabs();
        await menubar('File');
        await menuPick('Import');
        check('File > Import… opens the file picker', (await q('window.__picked')) === 1);
        const pick = async (path) => {
            const root = (await send('DOM.getDocument', { depth: 0 })).result.root;
            const nodeId = (await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.ks-menubar input[type=file]' })).result.nodeId;
            await send('DOM.setFileInputFiles', { nodeId, files: [path] });
            await wait(800);
        };
        await pick(xlsxPath);
        const afterXlsx = await tabs();
        check('the sheets of the file are added after the others', JSON.stringify(afterXlsx) === JSON.stringify(before.concat(['Termin', 'Harga'])), afterXlsx);
        check('the first of them is shown', (await q('document.querySelector(".ks-active-tab") && document.querySelector(".ks-active-tab").textContent')) === 'Termin');
        check('its formula works (into the other new sheet)', (await q(`${W}.value(${W}.sheetIdByName("Termin"), 0, 1)`)) === 2500000);
        check('and it is said', /^Imported 2 sheets/.test(await notice() || ''), await notice());

        await pick(csvPath);
        check('a CSV is a sheet named after its file', (await tabs()).slice(-1)[0] === 'Opname minggu 3', await tabs());
        check('its numbers are read in the workbook\'s locale', JSON.stringify(await q(`[${W}.value(${W}.sheetIdByName("Opname minggu 3"), 1, 1), ${W}.value(${W}.sheetIdByName("Opname minggu 3"), 2, 1)]`)) === '[12.5,1040.25]',
            await q(`[${W}.value(${W}.sheetIdByName("Opname minggu 3"), 1, 1), ${W}.value(${W}.sheetIdByName("Opname minggu 3"), 2, 1)]`));

        await q(`${W}.undo()`);
        await wait(300);
        check('one undo takes the CSV\'s sheet away', JSON.stringify(await tabs()) === JSON.stringify(afterXlsx), await tabs());
    }, 'control.js');
} finally {
    rmSync(folder, { recursive: true, force: true });
}

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
