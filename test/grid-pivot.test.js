// Pivot tables in a real Chrome: Insert > Pivot table takes the block around the active cell, makes the table in a new sheet and opens its editor;
// Rows and Values added, the function changed, a filter with a box unticked; the editor closes outside the table and opens again inside it; a person
// cannot type in it; a change in its data is seen; Remove. The rules underneath are in pivot.test.js. A <select> is changed by setting its value
// (Chrome draws its list outside the page, where real input cannot reach).
//   node test/grid-pivot.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook';
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c) => { const p = await cellAt(r, c); await click(p.x, p.y); await wait(250); };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(300); return true; };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) === 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(200); await click(p.x, p.y); await wait(400); return true; };
    const choose = (label, value) => q(`(function(){ var s = document.querySelector('.ks-pivot select[aria-label="${label}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`).then(() => wait(300));
    const P = `${W}.sheetIdByName('Pivot table 1')`;
    const shown = () => q(`(function(){ var w = ${W}, s = ${P}, out = []; for (var r = 0; r < 5; r++) { var row = []; for (var c = 0; c < 3; c++) { var v = w.value(s, r, c); if (v !== null) row.push(v); } if (row.length) out.push(row.join(' | ')); } return out.join(' / '); })()`);
    const editor = () => q('!!document.querySelector(".ks-pivot")');

    await clickCell(1, 0);
    await menubar('Insert');
    check('Insert > Pivot table opens its dialog with the block around the cell', (await menuPick('Pivot table')) && (await q('document.querySelector(\'.ks-dialog input[aria-label="Data range"]\').value')) === 'BOQ!A1:F4');
    await press(`Array.from(document.querySelectorAll('.ks-dialog button')).find(function(x){ return x.textContent === 'Create'; })`);
    check('Create: a new sheet "Pivot table 1" is shown, and the editor is open', (await q('document.querySelector(".ks-active-tab").textContent')) === 'Pivot table 1' && (await editor()));
    check('an empty table says what to do', (await shown()) === 'Pivot table: add Rows and Values in its editor', await shown());

    await choose('Add to Rows', 'Status');
    await choose('Add to Values', 'Qty');
    check('Rows Status, Values Qty: the table', (await shown()) === 'Status | SUM of Qty / Approved | 4 / Draft | 12 / Grand total | 16', await shown());
    await choose('Summarise Qty by', 'COUNT');
    check('summed by COUNT', (await shown()) === 'Status | COUNT of Qty / Approved | 1 / Draft | 2 / Grand total | 3', await shown());
    await choose('Add a filter', 'Status');
    await press(`Array.from(document.querySelectorAll('.ks-pivot .ks-filter-values label')).find(function(x){ return x.textContent === 'Draft'; })`);
    check('a filter: Draft unticked', (await shown()) === 'Status | COUNT of Qty / Approved | 1 / Grand total | 1', await shown());

    await clickCell(9, 5);
    check('a cell outside the table: the editor closes', !(await editor()));
    await clickCell(1, 0);
    check('a cell of the table: it opens again', await editor());
    await type('9');
    await wait(250);
    check('a person cannot type in it', (await q('(function(){ var n = document.querySelector(".ks-notice"); return n && n.textContent; })()')) === 'This is a pivot table: change it in its editor');

    await q(`${W}.setValues('BOQ', 'E3', 'Draft')`);
    await wait(250);
    check('its data changed (Beam is Draft now, all Draft is filtered out): worked out again', (await shown()) === 'Status | COUNT of Qty / Grand total | 0', await shown());

    await press(`Array.from(document.querySelectorAll('.ks-pivot button')).find(function(x){ return x.textContent.indexOf('Remove pivot table') >= 0; })`);
    check('Remove: the table and its editor go', !(await editor()) && (await q(`${W}.pivots(${P}).length`)) === 0 && (await shown()) === '');
}, 'control.js');

// What Excel's editor has besides, with real input where a person types: Show values as, the top n of a field, a label condition, a calculated field.
await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook';
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(300); return true; };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) === 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(200); await click(p.x, p.y); await wait(400); return true; };
    const choose = (label, value) => q(`(function(){ var s = document.querySelector('.ks-pivot select[aria-label="${label}"]'); if (!s) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`).then(async (ok) => { await wait(300); return ok; });
    // a text field of the editor typed into as a person does: clicked, emptied (Ctrl+A, Backspace), typed, Enter
    const typeInto = async (label, text) => {
        if (!(await press(`document.querySelector('.ks-pivot input[aria-label="${label}"]')`))) return false;
        await key('a', 'KeyA', 65, 2); await key('Backspace', 'Backspace', 8);
        await type(text); await key('Enter', 'Enter', 13); await wait(300);
        return true;
    };
    const P = `${W}.sheetIdByName('Pivot table 1')`;
    const table = () => q(`(function(){ var w = ${W}, s = ${P}, out = []; for (var r = 0; r < 6; r++) { var row = []; for (var c = 0; c < 4; c++) { var t = w.display(s, r, c).text; if (t !== '') row.push(t); } if (row.length) out.push(row.join(' | ')); } return out.join(' / '); })()`);

    const p = await cellAt(1, 0); await click(p.x, p.y); await wait(250);
    await menubar('Insert'); await menuPick('Pivot table');
    await press(`Array.from(document.querySelectorAll('.ks-dialog button')).find(function(x){ return x.textContent === 'Create'; })`);
    await choose('Add to Rows', 'Item');
    await choose('Add to Values', 'Qty');

    check('Show Qty as % of grand total: shares, written as percents',
        (await choose('Show Qty as', 'percentOfTotal')) && (await table()) === 'Item | SUM of Qty / Beam | 25,0% / Pile | 62,5% / Slab | 12,5% / Grand total | 100,0%', await table());
    await choose('Show Qty as', '');

    await choose('Add a filter', 'Item');
    check('a filter of a row field offers Top', await choose('Top of Item', 'top'));
    check('the top 2 by Qty, typed as a person types it: Slab (2) goes, and the total with it',
        (await typeInto('Top count of Item', '2')) && (await table()) === 'Item | SUM of Qty / Beam | 4 / Pile | 10 / Grand total | 14', await table());
    await choose('Top of Item', '');

    await choose('Label condition of Item', 'beginsWith');
    check('a label condition: Item begins with "s"', (await typeInto('Label value of Item', 's')) && (await table()) === 'Item | SUM of Qty / Slab | 2 / Grand total | 2', await table());
    await choose('Label condition of Item', '');

    await typeInto('New calculated field name', 'Avg rate');
    await press(`document.querySelector('.ks-pivot input[aria-label="New calculated field formula"]')`);
    await type('Amount / Qty');
    await press(`Array.from(document.querySelectorAll('.ks-pivot button')).find(function(x){ return x.textContent === 'Add'; })`);
    check('a calculated field typed in: Amount / Qty from the sums (the grand total 11000 / 16)',
        (await table()) === 'Item | SUM of Qty | Avg rate / Beam | 4 | 900 / Pile | 10 | 500 / Slab | 2 | 1200 / Grand total | 16 | 687,5', await table());
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
