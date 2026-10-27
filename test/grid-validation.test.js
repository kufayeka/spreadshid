// Data validation in a real Chrome (step R5a): a dropdown made from the Data menu, chosen from its arrow, a value that is not a choice refused, the help
// text under the cell, checkboxes from the Insert menu ticked with the mouse and with Space. The rules underneath are in validation.test.js.
//   node test/grid-validation.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const S = 'window.__workbook.sheetIds()[0]';
    const value = (r, c) => q(`window.__workbook.value(${S}, ${r}, ${c})`);
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x, p.y, extra); await wait(120); };
    // a cell with a checkbox is selected by its left part (the box in its middle turns over when clicked, as in Google Sheets)
    const clickBeside = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x - 35, p.y, extra); await wait(120); };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(200); await click(p.x, p.y); await wait(300); return true; };
    const notice = () => q('(function(){ var n = document.querySelector(".ks-notice"); return n ? n.textContent : null; })()');
    const field = (label) => `Array.from(document.querySelectorAll('.ks-dialog .ks-field')).find(function(f){ return f.querySelector('span').textContent === ${JSON.stringify(label)}; })`;

    // the units of C4:C9 get a dropdown
    await clickCell(3, 2);
    await clickCell(8, 2, { modifiers: 8 });
    await menubar('Data');
    await menuPick('Data validation');
    check('Data, Data validation opens the dialog for the selection', (await q(`${field('Apply to range')}.querySelector('input').value`)) === 'C4:C9');
    let p = await centerOf(`${field('Choices')}.querySelector('input')`);
    await click(p.x, p.y);
    await type('m2, m3, kg');
    p = await centerOf(`${field('Help text')}.querySelector('input')`);
    await click(p.x, p.y);
    await type('The unit of the line');
    p = await centerOf('Array.from(document.querySelectorAll(".ks-dialog .ks-button")).find(function(x){ return x.textContent === "Done"; })');
    await click(p.x, p.y);
    await wait(300);
    check('Done: the cells show a dropdown\'s arrow', await q('!!document.querySelector(".ks-cell[data-r=\\"3\\"][data-c=\\"2\\"] .ks-drop")'));
    await clickCell(4, 2);
    check('the help text shows under the selected cell', (await q('(function(){ var h = document.querySelector(".ks-hint"); return h ? h.textContent : null; })()')) === 'The unit of the line');
    p = await centerOf('document.querySelector(".ks-cell[data-r=\\"4\\"][data-c=\\"2\\"] .ks-drop")');
    await click(p.x, p.y);
    await wait(300);
    check('the arrow opens the choices', (await q('Array.from(document.querySelectorAll(".ks-menu-item")).map(function(x){ return x.textContent.replace("✓", ""); }).join(",")')) === 'm2,m3,kg');
    await menuPick('kg');
    check('a choice is written in the cell', (await value(4, 2)) === 'kg');
    await clickCell(5, 2);
    await type('ton');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('a value that is not a choice is refused, and said', (await value(5, 2)) === "m'" && /must be one of: m2, m3, kg/.test(await notice()), [await value(5, 2), await notice()]);
    await clickCell(6, 2);
    await key('ArrowDown', 'ArrowDown', 40, 1);
    await wait(300);
    check('Alt+Down opens the choices too', await q('document.querySelectorAll(".ks-menu-item").length === 3'));
    await key('Escape', 'Escape', 27);
    await wait(150);

    // checkboxes on G4:G6
    await clickCell(3, 6);
    await clickCell(5, 6, { modifiers: 8 });
    await menubar('Insert');
    await menuPick('Checkbox');
    check('Insert, Checkbox: the cells show checkboxes', (await q('document.querySelectorAll(".ks-checkbox").length')) >= 3);
    p = await centerOf('document.querySelector(".ks-cell[data-r=\\"3\\"][data-c=\\"6\\"] .ks-checkbox")');
    await click(p.x, p.y);
    await wait(150);
    check('a click ticks it', (await value(3, 6)) === true && (await q('document.querySelector(".ks-cell[data-r=\\"3\\"][data-c=\\"6\\"] .ks-checkbox").classList.contains("ks-checked")')));
    await clickBeside(3, 6);
    await clickBeside(5, 6, { modifiers: 8 });
    await key(' ', 'Space', 32);
    await wait(150);
    check('Space turns over every checkbox of the selection', (await value(3, 6)) === false && (await value(4, 6)) === true && (await value(5, 6)) === true, [await value(3, 6), await value(4, 6), await value(5, 6)]);
    await key('z', 'KeyZ', 90, 2);
    await wait(150);
    check('one Ctrl+Z takes the Space back', (await value(3, 6)) === true && (await value(4, 6)) === null);
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
