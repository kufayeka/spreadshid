// Conditional formatting in a real Chrome (step R5): Format > Conditional formatting opens a panel on the right (the grid gets narrower), a rule made
// with the mouse and the keyboard colours the cells at once, a colour scale, the order of the rules, a rule deleted, undone. The rules underneath are
// in conditional.test.js. A <select> is changed by setting its value (Chrome draws its list outside the page, where real input cannot reach).
//   node test/grid-conditional.test.js     (needs Chrome)
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
    const button = (text) => `Array.from(document.querySelectorAll('.ks-panel button')).find(function(x){ return x.textContent.trim() === ${JSON.stringify(text)} || x.getAttribute('aria-label') === ${JSON.stringify(text)}; })`;
    const choose = (label, value) => q(`(function(){ var s = Array.from(document.querySelectorAll('.ks-panel select')).find(function(x){ var l = x.closest('label'); return (l && l.textContent.indexOf(${JSON.stringify(label)}) === 0) || x.getAttribute('aria-label') === ${JSON.stringify(label)}; });
        var set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    // the colour a cell is drawn with: its own fill, or the fill of its own layer
    const bgAt = (r, c) => q(`(function(){ var e = document.querySelector('.ks-cell[data-r="${r}"][data-c="${c}"]'); if (!e) return null; var all = [e].concat(Array.from(e.querySelectorAll('*')));
        for (var i = 0; i < all.length; i++) { var b = getComputedStyle(all[i]).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b; } return null; })()`);
    const weightAt = (r, c) => q(`getComputedStyle(document.querySelector('.ks-cell[data-r="${r}"][data-c="${c}"] .ks-text') || document.querySelector('.ks-cell[data-r="${r}"][data-c="${c}"]')).fontWeight`);
    const gridRight = () => q('Math.round(document.querySelector(".ks-grid").getBoundingClientRect().right)');

    const wideBefore = await gridRight();
    await clickCell(1, 4);
    await clickCell(3, 4, { modifiers: 8 });
    await menubar('Format');
    await menuPick('Conditional formatting');
    check('the panel opens on the right, the grid gets narrower', (await q('!!document.querySelector(".ks-panel")')) && (await gridRight()) <= wideBefore - 300, [wideBefore, await gridRight()]);
    check('a sheet without rules opens a new rule on the selection', (await q('document.querySelector(".ks-panel input").value')) === 'E2:E4', await q('document.querySelector(".ks-panel input").value'));

    await choose('Format cells if', 'textIs');
    await wait(150);
    await press('document.querySelector(\'.ks-panel input[aria-label="Value"]\')');
    await type('draft');
    await press(button('Bold'));
    check('the sample shows the style as it is made', (await q('getComputedStyle(document.querySelector(".ks-style-row .ks-rule-sample")).fontWeight')) === '700');
    await press(button('Done'));
    await wait(200);
    check('Done: the Draft lines are filled and bold at once', (await bgAt(1, 4)) === 'rgb(183, 225, 205)' && (await weightAt(1, 4)) === '700' && (await bgAt(3, 4)) === 'rgb(183, 225, 205)', [await bgAt(1, 4), await weightAt(1, 4)]);
    check('the Approved line is not', (await bgAt(2, 4)) === null, await bgAt(2, 4));
    check('the list shows the rule in words, with its range', (await q('document.querySelector(".ks-rule-says").textContent')) === 'Text is exactly draft' && (await q('document.querySelector(".ks-rule-ranges").textContent')) === 'E2:E4');

    // a colour scale on the quantities, typed range
    await press(button('Add another rule'));
    await press(`Array.from(document.querySelectorAll('.ks-tabs-choice button')).find(function(x){ return x.textContent === 'Color scale'; })`);
    await press('document.querySelector(".ks-panel input")');
    await key('a', 'KeyA', 65, 2);
    await type('B2:B4');
    await press(button('Done'));
    await wait(200);
    check('a colour scale: the smallest white, the biggest green', (await bgAt(3, 1)) === 'rgb(255, 255, 255)' && (await bgAt(1, 1)) === 'rgb(87, 187, 138)', [await bgAt(3, 1), await bgAt(2, 1), await bgAt(1, 1)]);
    check('two rules in the list', (await q('document.querySelectorAll(".ks-rule-card").length')) === 2);

    // the order: the scale moved up, then a rule over the same cells; the first one wins
    await q(`${W}.addConditional(${S}, { r1: 1, c1: 1, r2: 3, c2: 1 }, { op: 'notEmpty', style: { fill: '#ff0000' } })`);
    await wait(200);
    check('a later rule does not win over the scale', (await bgAt(1, 1)) === 'rgb(87, 187, 138)');
    await press(`document.querySelectorAll('.ks-rule-card')[2].querySelector('[aria-label="Move up"]')`);
    await press(`document.querySelectorAll('.ks-rule-card')[1].querySelector('[aria-label="Move up"]')`);
    check('moved to the top, it wins', (await bgAt(1, 1)) === 'rgb(255, 0, 0)' && (await q('document.querySelectorAll(".ks-rule-card")[0].querySelector(".ks-rule-says").textContent')) === 'Is not empty', await bgAt(1, 1));

    // a rule opened, changed, saved
    await press(`Array.from(document.querySelectorAll('.ks-rule-open')).find(function(x){ return x.textContent.indexOf('Text is exactly') >= 0; })`);
    check('a rule opens with what it says', (await q('document.querySelector(\'.ks-panel input[aria-label="Value"]\').value')) === 'draft');
    await press('document.querySelector(\'.ks-panel input[aria-label="Value"]\')');
    await key('a', 'KeyA', 65, 2);
    await type('Approved');
    await press(button('Done'));
    await wait(200);
    check('changed: Approved is marked, Draft is not', (await bgAt(2, 4)) === 'rgb(183, 225, 205)' && (await bgAt(1, 4)) === null, [await bgAt(2, 4), await bgAt(1, 4)]);

    // deleted, and back with undo
    await press(`document.querySelectorAll('.ks-rule-card')[0].querySelector('[aria-label="Delete rule"]')`);
    check('a rule deleted: the scale shows again', (await bgAt(1, 1)) === 'rgb(87, 187, 138)' && (await q('document.querySelectorAll(".ks-rule-card").length')) === 2);
    await clickCell(6, 0);
    await key('z', 'KeyZ', 90, 2);
    await wait(250);
    check('Ctrl+Z brings it back', (await bgAt(1, 1)) === 'rgb(255, 0, 0)' && (await q('document.querySelectorAll(".ks-rule-card").length')) === 3);

    await press(button('Close'));
    check('closed: the grid is wide again', !(await q('!!document.querySelector(".ks-panel")')) && (await gridRight()) === wideBefore, await gridRight());
    check('the rules stay in the sheet', (await bgAt(2, 4)) === 'rgb(183, 225, 205)');
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
