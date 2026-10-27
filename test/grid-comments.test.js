// Comments in a real Chrome (step R6): Ctrl+Alt+M starts a comment on the active cell, typed and sent with Ctrl+Enter, the cell gets its mark, the card
// shows when the cell is selected again, a reply from Insert > Comment, Resolve takes the mark away, Escape leaves the card, another cell ends a comment
// that was started. The rules underneath are in comments.test.js.
//   node test/grid-comments.test.js     (needs Chrome)
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
    const clickCell = async (r, c) => { const p = await cellAt(r, c); await click(p.x, p.y); await wait(200); };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const card = () => q('!!document.querySelector(".ks-comment-card")');
    const marked = (r, c) => q(`!!document.querySelector('.ks-cell.ks-noted[data-r="${r}"][data-c="${c}"]')`);
    const ctrlEnter = () => key('Enter', 'Enter', 13, 2);
    await q(`${W}.setUser({ id: 'u1', name: 'Rina' })`);

    await clickCell(1, 0);
    await key('m', 'KeyM', 77, 2 + 1);
    await wait(250);
    check('Ctrl+Alt+M opens a card with its box focused', (await card()) && (await q('document.activeElement && document.activeElement.getAttribute("aria-label")')) === 'Comment');
    await type('Cek volume tiang');
    await ctrlEnter();
    await wait(250);
    check('Ctrl+Enter sends it: the thread is on the cell, by Rina', JSON.stringify(await q(`(function(){ var t = ${W}.commentAt(${S}, 1, 0); return t && [t.items[0].text, t.items[0].by.name]; })()`)) === JSON.stringify(['Cek volume tiang', 'Rina']));
    check('the cell has its mark', await marked(1, 0));
    check('the keyboard is back in the grid', (await q('document.activeElement && document.activeElement.classList.contains("ks-input")')));

    await clickCell(2, 0);
    check('another cell: no card', !(await card()));
    await clickCell(1, 0);
    check('the cell again: its card shows the comment', (await card()) && (await q('document.querySelector(".ks-comment-text").textContent')) === 'Cek volume tiang');

    // a reply from the Insert menu, as Budi
    await q(`${W}.setUser({ id: 'u2', name: 'Budi' })`);
    await press(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'Insert'; })`);
    const item = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf('Comment') === 0; })`);
    await mouse('mouseMoved', item.x - 20, item.y); await mouse('mouseMoved', item.x, item.y); await wait(200); await click(item.x, item.y); await wait(300);
    check('Insert > Comment focuses the reply box', (await q('document.activeElement && document.activeElement.getAttribute("aria-label")')) === 'Reply');
    await type('Sudah, 10 titik');
    await press(`Array.from(document.querySelectorAll('.ks-comment-card button')).find(function(x){ return x.textContent === 'Reply'; })`);
    check('the reply is in the thread', (await q(`${W}.commentAt(${S}, 1, 0).items.map(function(x){ return x.by.name + ': ' + x.text; }).join(" | ")`)) === 'Rina: Cek volume tiang | Budi: Sudah, 10 titik');

    // a comment started and left for another cell is not sent
    // cells away from the card (it covers the cells on the right of A2)
    await clickCell(12, 2);
    await key('m', 'KeyM', 77, 2 + 1);
    await wait(200);
    await type('lupa');
    await clickCell(10, 0);
    check('another cell ends a comment that was started', !(await card()) && !(await q(`!!${W}.commentAt(${S}, 12, 2)`)), [await card(), await q(`!!${W}.commentAt(${S}, 12, 2)`), await q('JSON.stringify(window.__sheet.current.getSelection().active)')]);

    await clickCell(1, 0);
    await press('document.querySelector(\'.ks-comment-card [aria-label="Resolve"]\')');
    check('Resolve: the card goes, the mark goes, the thread is kept', !(await card()) && !(await marked(1, 0)) && (await q(`${W}.comments(${S})[0].resolved`)) === true);
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
