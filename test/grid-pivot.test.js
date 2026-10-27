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

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
