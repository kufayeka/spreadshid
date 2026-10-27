// Groups in a real Chrome (step R5): rows grouped with Alt+Shift+Right, a gutter appears with a bracket and a [−] on the title row, a click folds the
// group (its rows go, the row numbers skip them) and opens it, a group inside it from the View menu, the level buttons, columns grouped from the menu,
// Alt+Shift+Left ungroups, undo. The rules underneath are in outline.test.js.
//   node test/grid-outline.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x, p.y, extra); await wait(120); };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(250); await click(p.x, p.y); await wait(300); return true; };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const rowHeads = () => q('Array.from(document.querySelectorAll(".ks-rowhead")).filter(function(h){ return h.getBoundingClientRect().height > 0; }).slice(0, 8).map(function(h){ return h.textContent; }).join(",")');
    const toggle = (from, level) => `document.querySelector('.ks-outline-rows [data-group-from="${from}"][data-group-level="${level}"]')`;
    const altShift = (k, code, vk) => key(k, code, vk, 1 + 8);

    const gridLeft = await q('Math.round(document.querySelector(".ks-grid").getBoundingClientRect().left)');
    check('no groups, no gutter', !(await q('!!document.querySelector(".ks-outline")')));

    // rows 2-4 (the lines under the title row 1) grouped with the keyboard
    await clickCell(1, 0);
    await clickCell(3, 0, { modifiers: 8 });
    await altShift('ArrowRight', 'ArrowRight', 39);
    await wait(250);
    check('Alt+Shift+Right groups the rows', JSON.stringify(await q(`${W}.rowGroups(${S}).groups`)) === JSON.stringify([{ level: 1, from: 1, to: 3, folded: false }]));
    check('a gutter appears on the left, the grid moves right', (await q('!!document.querySelector(".ks-outline-rows")')) && (await q('Math.round(document.querySelector(".ks-grid").getBoundingClientRect().left)')) > gridLeft);
    const title = await cellAt(0, 0), button = await centerOf(toggle(1, 1));
    check('its [−] sits on the title row', !!button && Math.abs(button.y - title.y) <= 2, [button, title]);

    await press(toggle(1, 1));
    check('a click folds it: rows 2-4 go', (await rowHeads()).startsWith('1,5,6'), await rowHeads());
    check('the button is a [+] now', (await q(`${toggle(1, 1)}.textContent`)) === '+');
    await press(toggle(1, 1));
    check('a click opens it again', (await rowHeads()).startsWith('1,2,3,4,5'), await rowHeads());

    // a group inside it, from the View menu
    await clickCell(2, 0);
    await clickCell(3, 0, { modifiers: 8 });
    await menubar('View');
    await menuPick('Group');
    check('View > Group names the rows', await menuPick('Group rows 3 - 4'));
    check('a group inside the group', (await q(`${W}.rowGroups(${S}).maxLevel`)) === 2 && (await q('document.querySelectorAll(".ks-outline-rows .ks-outline-level").length')) === 3);

    // the level buttons
    await press('document.querySelector(\'.ks-outline-rows [aria-label="Show row groups up to level 1"]\')');
    check('level 1: only the rows in no group', (await rowHeads()).startsWith('1,5,6'), await rowHeads());
    await press('document.querySelector(\'.ks-outline-rows [aria-label="Show row groups up to level 2"]\')');
    check('level 2: the inner group folded', (await rowHeads()).startsWith('1,2,5,6'), await rowHeads());
    await press('document.querySelector(\'.ks-outline-rows [aria-label="Show row groups up to level 3"]\')');
    check('level 3: everything', (await rowHeads()).startsWith('1,2,3,4,5'), await rowHeads());

    // columns B-D from the menu, folded from their gutter
    await clickCell(0, 1);
    await clickCell(0, 3, { modifiers: 8 });
    await menubar('View');
    await menuPick('Group');
    await menuPick('Group columns B - D');
    check('columns grouped: a gutter over the letters', (await q('!!document.querySelector(".ks-outline-cols")')) && JSON.stringify(await q(`${W}.colGroups(${S}).groups`)) === JSON.stringify([{ level: 1, from: 1, to: 3, folded: false }]));
    await press('document.querySelector(\'.ks-outline-cols [data-group-from="1"]\')');
    check('folded: columns B-D go', (await q('Array.from(document.querySelectorAll(".ks-colhead")).filter(function(h){ return h.getBoundingClientRect().width > 0; }).slice(0, 3).map(function(h){ return h.textContent; }).join("")')) === 'AEF');

    // ungroup with the keyboard, then undo
    await clickCell(2, 0);
    await clickCell(3, 0, { modifiers: 8 });
    await altShift('ArrowLeft', 'ArrowLeft', 37);
    await wait(250);
    check('Alt+Shift+Left ungroups one level', (await q(`${W}.rowGroups(${S}).maxLevel`)) === 1);
    await key('z', 'KeyZ', 90, 2);
    await wait(250);
    check('Ctrl+Z: the inner group is back', (await q(`${W}.rowGroups(${S}).maxLevel`)) === 2);
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
