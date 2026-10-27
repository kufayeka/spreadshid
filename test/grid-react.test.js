// The React guide's cashier page in a real Chrome (docs/examples/11-kasir.page.js): the workbook loads from the API, a number typed in the sheet moves
// the total in the page header (useWorkbook), the Undo button turns on and takes it back, the autosave says "not saved" and then "saved", the side
// panel shows the row picked in the sheet, and the React form adds a transaction to the sheet. Then, on a page of its own, how often useWorkbook
// draws: only when what a component reads changes.
//   node test/grid-react.test.js     (needs Chrome and a build: npm run build)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!document.querySelector(".ks-sheet")')); i++) await wait(250);
    await wait(500);
    const text = (sel) => js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent : null; })()`);
    const centerOf = (sel) => js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => js(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c) => { const p = await cellAt(r, c); await click(p.x, p.y); await wait(150); };
    const press = async (sel) => { const p = await centerOf(sel); await click(p.x, p.y); await wait(250); };

    const before = await text('.kasir-omzet');
    check('the page loaded the workbook from the API and shows its total', /^Rp [\d.]+$/.test(before || ''), before);
    check('Undo starts off', await js('document.querySelector(".kasir-undo").disabled'));

    // a Qty typed in the sheet: the total in the header follows, and the autosave waits, then saves
    await clickCell(1, 7);
    await type('100');
    await key('Enter', 'Enter', 13);
    await wait(250);
    const after = await text('.kasir-omzet');
    check('the header total moved with the Qty typed in the sheet', after !== before, [before, after]);
    check('the autosave says not saved yet', (await text('.kasir-status')) !== 'Tersimpan', await text('.kasir-status'));
    check('Undo is on', !(await js('document.querySelector(".kasir-undo").disabled')));
    await wait(1800);
    check('the autosave saved a second after the typing stopped', (await text('.kasir-status')) === 'Tersimpan', await text('.kasir-status'));

    await press('.kasir-undo');
    check('Undo from outside the sheet takes the total back', (await text('.kasir-omzet')) === before, await text('.kasir-omzet'));

    // the side panel shows the row picked in the sheet
    await clickCell(3, 2);
    await wait(150);
    check('the side panel shows the transaction picked in the sheet', /^No 3 /.test(await text('.kasir-detail') || ''), await text('.kasir-detail'));

    // the React form adds a transaction at the end of the sheet
    const count = Number(await text('.kasir-jumlah'));
    await press('.kasir-qty');
    await key('a', 'KeyA', 65, 2);
    await type('5');
    await press('.kasir-tambah');
    await wait(700);
    const now = Number(await text('.kasir-jumlah'));
    check('the React form added one transaction to the sheet', now === count + 1, [count, now]);
    check('the new row is picked, and the side panel shows it', new RegExp('^No ' + now + ' ').test(await text('.kasir-detail') || ''), [now, await text('.kasir-detail')]);
}, '../docs/examples/11-kasir.page.js');

// useWorkbook draws a component again only when what it reads changes
await withExample(async ({ js, click, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const start = await js('JSON.stringify(window.__renders)');
    const h = await js(`(function(){ var a = document.querySelector('.ks-colhead[data-c="0"]').getBoundingClientRect(), b = document.querySelector('.ks-rowhead[data-r="0"]').getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    for (const word of ['satu', 'dua', 'tiga']) { await click(h.x, h.y); await wait(100); await type(word); await key('Enter', 'Enter', 13); await wait(150); }
    const end = JSON.parse(await js('JSON.stringify(window.__renders)'));
    const s = JSON.parse(start);
    check('a component reading a cell that did not change was not drawn again', end.still === s.still, [s, end]);
    check('a component reading the cell that changed was drawn for each change', end.moving - s.moving >= 3, [s, end]);
    check('a component reading the whole workbook was drawn on every change', end.all - s.all >= 3, [s, end]);
    check('it shows the last value', (await js('document.querySelector("#moving").textContent')) === 'tiga');
}, 'use-workbook.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
