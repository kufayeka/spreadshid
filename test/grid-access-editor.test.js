// An access editor the host builds outside the sheet (docs/examples/04-13-editor-akses.page.tsx), in a real Chrome: a range dragged in the sheet comes to
// the host as "C2:C5" (onSelectionChange), a rule made from it is a new row of the access table, and "view as" shows the sheet as that person gets it.
//   node test/grid-access-editor.test.js     (needs Chrome and a build: npm run build)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!document.querySelector(".ks-sheet")')); i++) await wait(250);
    await wait(400);
    const cellAt = (r, c) => js(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const text = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).textContent`);
    // a <select> of the host's own panel set as a person picks it (the change event React listens to)
    const pick = (sel, value) => js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); var set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('change', { bubbles: true })); return e.value; })()`);
    const shown = (r, c) => js(`(function(){ var t = Array.from(document.querySelectorAll('.ks-cell')).find(function(x){ return x.dataset.r === '${r}' && x.dataset.c === '${c}'; }); return t ? t.textContent : null; })()`);

    // a real drag from C2 to C5
    const a = await cellAt(1, 2), b = await cellAt(4, 2);
    await mouse('mouseMoved', a.x, a.y);
    await mouse('mousePressed', a.x, a.y);
    await mouse('mouseMoved', b.x, b.y, { buttons: 1 });
    await mouse('mouseReleased', b.x, b.y);
    await wait(200);
    check('the dragged range comes to the host as an address', (await text('.range-terpilih')) === 'Produk!C2:C5', await text('.range-terpilih'));

    await pick('.pilih-peran', 'role:kasir');
    await pick('.pilih-mode', 'hidden');
    const add = await js('(function(){ var e = document.querySelector(".tambah-aturan").getBoundingClientRect(); return { x: e.left + 5, y: e.top + 5 }; })()');
    await click(add.x, add.y);
    await wait(200);
    const last = await js('Array.from(document.querySelectorAll(".daftar-aturan tbody tr")).pop().textContent');
    check('the rule is a new row of the table: role:kasir deny read Produk!C2:C5', last.startsWith('role:kasirdenyreadProduk!C2:C5'), last);
    await wait(300);

    // the rules editor (setup): a square per who in the corner of each cell a rule touches, the selected rule outlined
    const squares = (r, c) => js(`(function(){ var t = document.querySelector('.ks-cell[data-r="${r}"][data-c="${c}"] .ks-whos'); return t ? t.querySelectorAll('i').length : 0; })()`);
    check('C3 carries two squares: kasir and gudang (kasir twice is one square)', (await squares(2, 2)) === 2, await squares(2, 2));
    check('a cell no rule touches carries none (G3)', (await squares(2, 6)) === 0);
    check('the new rule is selected: its range is outlined', await js('!!document.querySelector(".ks-rule-outline")'));
    check('in setup there are no live marks (no lock, no eye)', await js('!document.querySelector(".ks-sheet").className.match(/ks-marks-/)'));
    check('the owner still sees the cost price', (await shown(1, 2)) === 'Rp 64.000', await shown(1, 2));

    // a click on a square in the sheet selects that who's row in the list
    const sq = await js(`(function(){ var i = document.querySelector('.ks-cell[data-r="1"][data-c="4"] .ks-whos i:last-child'); var b = i.getBoundingClientRect(); return { x: b.left + 2, y: b.top + 2 }; })()`);
    await click(sq.x, sq.y);
    await wait(200);
    const row = await js('Array.from(document.querySelectorAll(".daftar-aturan tbody tr")).findIndex(function(t){ return t.style.background; })');
    check('a click on the gudang square of E2 selects the first gudang row (row 3)', row === 2, row);

    // live: the sheet as Rina sees it
    await pick('.lihat-sebagai', 'rina');
    await wait(300);
    check('as Rina (kasir), the cost price is hidden', (await shown(1, 2)) === '•••', await shown(1, 2));
    const modeOf = (r, c) => js(`document.querySelector('.ks-cell[data-r="${r}"][data-c="${c}"]').dataset.mode`);
    const sheetHas = (cls) => js(`document.querySelector('.ks-sheet').classList.contains('${cls}')`);
    check('and marked with the eye', (await sheetHas('ks-marks-hidden')) && (await modeOf(1, 2)) === 'hidden', await modeOf(1, 2));
    check('a cell she may only read carries the lock', (await sheetHas('ks-marks-lock')) && (await modeOf(1, 3)) === 'readonly', await modeOf(1, 3));
    check('and the selling price is not hidden', (await shown(1, 3)) === 'Rp 72.000', await shown(1, 3));
    check('no squares outside setup', !(await js('!!document.querySelector(".ks-whos")')));
    await pick('.lihat-sebagai', 'joko');
    await wait(300);
    check('as Joko (gudang), the rule of the kasir does not count', (await shown(1, 2)) === 'Rp 64.000', await shown(1, 2));
}, '../docs/examples/04-13-editor-akses.page.tsx');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
