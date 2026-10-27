// Named ranges in a real Chrome (step R5): a name typed in the name box names the selection, a formula typed with it works, the name box shows it and
// goes to it, Data > Named ranges lists the names, renames one (the formula follows), adds one, goes to one, deletes one; a name that cannot be is said.
// The rules underneath are in names.test.js.
//   node test/grid-names.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x, p.y, extra); await wait(120); };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(200); await click(p.x, p.y); await wait(300); return true; };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const nameBox = () => q('document.querySelector(".ks-namebox").value');
    const notice = () => q('(function(){ var n = document.querySelector(".ks-notice"); return n ? n.textContent : null; })()');
    const selection = () => q('JSON.stringify(window.__sheet.current.getSelection().ranges[0])');
    const typeInNameBox = async (text) => { await press('document.querySelector(".ks-namebox")'); await type(text); await key('Enter', 'Enter', 13); await wait(250); };
    const selectAllIn = async (expr) => { await press(expr); await key('a', 'KeyA', 65, 2); };

    // the quantities B2:B4 named from the name box
    await clickCell(1, 1);
    await clickCell(3, 1, { modifiers: 8 });
    await typeInNameBox('Volume');
    check('a new word in the name box names the selection', JSON.stringify(await q(`${W}.names().map(function(n){ return [n.name, n.range]; })`)) === JSON.stringify([['Volume', { r1: 1, c1: 1, r2: 3, c2: 1 }]]) && /Named range Volume is B2:B4/.test(await notice() || ''), await notice());
    check('and the name box shows the name for that selection', (await nameBox()) === 'Volume', await nameBox());

    // a formula with the name, typed
    await clickCell(1, 6);
    await type('=SUM(Volume)*2');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('a formula typed with the name works', (await q(`${W}.value(${S}, 1, 6)`)) === 32, await q(`${W}.value(${S}, 1, 6)`));
    check('the name box shows the address of a plain cell', (await nameBox()) === 'G3', await nameBox());

    // the panel: the list, a rename, a new name, going to one, deleting one
    await menubar('Data');
    await menuPick('Named ranges');
    check('Data > Named ranges lists the name and where it points', (await q('document.querySelector(".ks-panel .ks-name").textContent')) === 'Volume' && (await q('document.querySelector(".ks-panel .ks-rule-ranges").textContent')) === 'BOQ!B2:B4');
    await press('document.querySelector(\'.ks-panel [aria-label="Edit Volume"]\')');
    await selectAllIn('document.querySelector(\'.ks-panel input[aria-label="Name"]\')');
    await type('Kuantitas');
    await press(`Array.from(document.querySelectorAll('.ks-panel button')).find(function(x){ return x.textContent === 'Done'; })`);
    check('renamed: the formula shows the new name and still works', (await q(`${W}.input(${S}, 1, 6)`)) === '=SUM(Kuantitas)*2' && (await q(`${W}.value(${S}, 1, 6)`)) === 32, await q(`${W}.input(${S}, 1, 6)`));

    // the costs selected with the panel open, then named: the new name starts with the selection of that moment
    await clickCell(1, 5);
    await clickCell(3, 5, { modifiers: 8 });
    await press(`Array.from(document.querySelectorAll('.ks-panel button')).find(function(x){ return x.textContent.indexOf('Add a range') >= 0; })`);
    check('a new name starts with the selection of now', (await q('document.querySelector(\'.ks-panel input[aria-label="Range"]\').value')) === 'BOQ!F2:F4', await q('document.querySelector(\'.ks-panel input[aria-label="Range"]\').value'));
    await press('document.querySelector(\'.ks-panel input[aria-label="Name"]\')');
    await type('Biaya');
    await key('Enter', 'Enter', 13);
    await wait(250);
    check('a range named in the panel (Enter is Done)', (await q('document.querySelectorAll(".ks-panel .ks-rule-card").length')) === 2 && JSON.stringify(await q(`${W}.nameRange("biaya").range`)) === JSON.stringify({ r1: 1, c1: 5, r2: 3, c2: 5 }));

    await press(`Array.from(document.querySelectorAll('.ks-panel .ks-rule-open')).find(function(x){ return x.textContent.indexOf('Kuantitas') === 0; })`);
    check('a name clicked in the list selects its range', (await selection()) === JSON.stringify({ anchor: { r: 1, c: 1 }, focus: { r: 3, c: 1 } }), await selection());

    await clickCell(8, 8);
    await typeInNameBox('biaya');
    check('a name typed in the name box goes to its range (any case)', (await selection()) === JSON.stringify({ anchor: { r: 1, c: 5 }, focus: { r: 3, c: 5 } }) && (await nameBox()) === 'Biaya', [await selection(), await nameBox()]);

    await press('document.querySelector(\'.ks-panel [aria-label="Delete Biaya"]\')');
    check('a name deleted', (await q(`${W}.names().map(function(n){ return n.name; }).join()`)) === 'Kuantitas');
    await clickCell(8, 8);
    await key('z', 'KeyZ', 90, 2);
    await wait(250);
    check('and back with Ctrl+Z', (await q(`${W}.names().map(function(n){ return n.name; }).join()`)) === 'Kuantitas,Biaya' && (await q('document.querySelectorAll(".ks-panel .ks-rule-card").length')) === 2);

    await typeInNameBox('Harga satuan');
    check('a name that cannot be is said, and not made', /has only letters, digits/.test(await notice() || '') && (await q(`${W}.names().length`)) === 2, await notice());
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
