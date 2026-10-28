// The filter in a real Chrome (step R5): Data > Create a filter on the block around a cell, a button in each header cell, a column filtered by values
// (a box unticked) and by condition, its button marked, rows hidden from the grid and its row numbers, Select all, Escape changes nothing, Data > Remove
// filter, undo. The rules underneath are in filter.test.js. A <select> is changed by setting its value (Chrome draws its list outside the page).
//   node test/grid-filter.test.js     (needs Chrome)
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
    const inMenu = (text) => `Array.from(document.querySelectorAll('.ks-filter-menu button')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`;
    const valueBox = (text) => `Array.from(document.querySelectorAll('.ks-filter-values label')).find(function(x){ return x.querySelector('.ks-filter-value').textContent === ${JSON.stringify(text)}; })`;
    const openColumn = (c) => press(`document.querySelector('.ks-filter-button[data-filter-col="${c}"]')`);
    const rowHeads = () => q('Array.from(document.querySelectorAll(".ks-rowhead")).filter(function(h){ return h.getBoundingClientRect().height > 0; }).slice(0, 6).map(function(h){ return h.textContent; }).join(",")');
    const shownRows = () => q(`[0,1,2,3].filter(function(r){ return !${W}.filteredOut(${S}, r); }).join(",")`);

    await clickCell(2, 2);
    await menubar('Data');
    check('the Data menu offers a filter', await menuPick('Create a filter'));
    check('made on the block around the cell: the table A1:F4', JSON.stringify(await q(`${W}.filterOf(${S}).range`)) === JSON.stringify({ r1: 0, c1: 0, r2: 3, c2: 5 }), await q(`${W}.filterOf(${S})`));
    check('a button in each header cell, a frame around it', (await q('document.querySelectorAll(".ks-filter-button").length')) === 6 && (await q('!!document.querySelector(".ks-filter-frame")')));
    check('the selection stays', (await q('window.__sheet.current.getSelection().active.address')) === 'C3');

    await openColumn(4);
    check('the Status menu lists its values with their counts', (await q('Array.from(document.querySelectorAll(".ks-filter-values label")).map(function(l){ return l.textContent; }).join("|")')) === 'Approved1|Draft2');
    check('the selection did not move to the header', (await q('window.__sheet.current.getSelection().active.address')) === 'C3');
    await press(valueBox('Draft'));
    await press(inMenu('OK'));
    check('Draft unticked: only the Approved line shows', (await shownRows()) === '0,2', await shownRows());
    check('the row numbers skip the hidden rows', (await rowHeads()).startsWith('1,3,5'), await rowHeads());
    check('the column\'s button is marked', await q('document.querySelector(\'.ks-filter-button[data-filter-col="4"]\').classList.contains("ks-on")'));

    // Escape: nothing changes
    await openColumn(4);
    await press(inMenu('Select all'));
    await key('Escape', 'Escape', 27);
    await wait(200);
    check('Escape closes the menu and changes nothing', !(await q('!!document.querySelector(".ks-filter-menu")')) && (await shownRows()) === '0,2');
    await openColumn(4);
    await press(inMenu('Select all'));
    await press(inMenu('OK'));
    check('Select all, OK: every line shows, the button is plain again', (await shownRows()) === '0,1,2,3' && !(await q('document.querySelector(\'.ks-filter-button[data-filter-col="4"]\').classList.contains("ks-on")')));

    // by condition: Qty greater than 3
    await openColumn(1);
    await press(inMenu('Filter by condition'));
    await q(`(function(){ var s = document.querySelector('.ks-filter-menu select[aria-label="Condition"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'gt'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(150);
    await press('document.querySelector(\'.ks-filter-menu input[aria-label="Value"]\')');
    await type('3');
    await press(inMenu('OK'));
    check('Qty greater than 3: the Slab (2) is hidden', (await shownRows()) === '0,1,2', await shownRows());
    await openColumn(1);
    check('the menu opens with its condition', (await q('document.querySelector(\'.ks-filter-menu select[aria-label="Condition"]\').value')) === 'gt' && (await q('document.querySelector(\'.ks-filter-menu input[aria-label="Value"]\').value')) === '3');
    await key('Escape', 'Escape', 27);
    await wait(150);

    await menubar('Data');
    await menuPick('Remove filter');
    check('Data > Remove filter: the buttons go, every row shows', (await q('document.querySelectorAll(".ks-filter-button").length')) === 0 && (await shownRows()) === '0,1,2,3');
    await clickCell(6, 6);
    await key('z', 'KeyZ', 90, 2);
    await wait(250);
    check('Ctrl+Z brings the filter back, with its condition', (await q('document.querySelectorAll(".ks-filter-button").length')) === 6 && (await shownRows()) === '0,1,2', await shownRows());
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
