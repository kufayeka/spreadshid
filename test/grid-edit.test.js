// Selecting and editing (step R2b), in a real Chrome with the real mouse and keyboard: click, type, Enter, Tab, formulas, double click, Escape, Shift and
// Ctrl with the arrows, Delete, undo and redo, dragging a rectangle, the headers, Ctrl+A. The keys rule lives in keys.js and is checked on its own too.
//   node test/grid-edit.test.js     (needs Chrome)
import { keyAction } from '../src/react/keys.js';
import { selectCell, extendTo, stepActive, jump } from '../src/core/selection.js';
import { chromeAvailable, withExample } from './chrome.js';

let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

// ---- the rules of the keys, without a browser
{
    const filled = (r, c) => c === 0 && (r <= 4 || r === 9);
    const ctx = { sel: selectCell(0, 0), size: { rows: 20, cols: 5 }, filled, rowShown: (r) => r !== 2, colShown: () => true, pageRows: 10, lastFilled: () => ({ r: 9, c: 0 }) };
    const k = (key, mods) => keyAction(Object.assign({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false }, mods), ctx);
    check('keys: an arrow moves the active cell, over a hidden row', JSON.stringify(keyAction({ key: 'ArrowDown' }, { ...ctx, sel: selectCell(1, 0) }).sel.active) === '{"r":3,"c":0}');
    check('keys: Ctrl+Down goes to the end of the filled run, then to the next filled cell', jump(0, 0, 1, 0, filled, ctx.size).r === 4 && jump(4, 0, 1, 0, filled, ctx.size).r === 9 && jump(9, 0, 1, 0, filled, ctx.size).r === 19);
    check('keys: Shift+arrow grows the rectangle and keeps the active cell', (() => { const s = k('ArrowRight', { shiftKey: true }).sel; return s.active.c === 0 && s.ranges[0].focus.c === 1; })());
    check('keys: Enter starts an edit, F2 too, Delete clears', k('Enter').start === 'edit' && k('F2').start === 'edit' && k('Delete').clear === true);
    check('keys: Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo, Ctrl+A selects all', k('z', { ctrlKey: true }).history === 'undo' && k('y', { ctrlKey: true }).history === 'redo' && k('Z', { ctrlKey: true, shiftKey: true }).history === 'redo' && k('a', { ctrlKey: true }).sel.ranges[0].focus.r === 19);
    check('keys: a letter is not the grid\'s (it types)', k('x') === null);
    const block = extendTo(selectCell(0, 0), 1, 1);
    const t1 = stepActive(block, 0, 1, ctx.size), t2 = stepActive(t1, 0, 1, ctx.size);
    check('keys: Tab inside a selected block moves along it and wraps to the next row', t1.active.c === 1 && t2.active.r === 1 && t2.active.c === 0 && t2.ranges === block.ranges);
}

if (!chromeAvailable()) { console.log('SKIP the Chrome part: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(failures ? 1 : 0); }

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const SHIFT = 8, CTRL = 2;
    // the middle of a cell, from its column letter and its row number (an empty cell has no element of its own: only the grid lines show it)
    const center = async (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); if (!h || !v) return null; var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, mods) => { const p = await center(r, c); if (!p) return false; await click(p.x, p.y, mods ? { modifiers: mods } : undefined); await wait(80); return true; };
    const value = (r, c) => q(`window.__workbook.value(undefined, ${r}, ${c})`);
    // the active cell as the grid says it (the label of its keyboard sink: "Cell H5"), turned into "row,column" counted from 0
    const active = () => q("(function(){ var m = /^Cell ([A-Z]+)([0-9]+)$/.exec(document.querySelector('.ks-input').getAttribute('aria-label')); var c = 0; for (var i = 0; i < m[1].length; i++) c = c * 26 + m[1].charCodeAt(i) - 64; return (Number(m[2]) - 1) + ',' + (c - 1); })()");
    const Enter = () => key('Enter', 'Enter', 13);

    check('a click selects the cell (H5)', (await clickCell(4, 7)) && (await active()) === '4,7', await active());
    check('its column letter and row number are marked', await q('document.querySelector(".ks-colhead[data-c=\\"7\\"]").classList.contains("ks-on") && document.querySelector(".ks-rowhead[data-r=\\"4\\"]").classList.contains("ks-on")'));
    await type('42');
    check('typing shows the editor with what was typed', await q('(function(){ var t = document.querySelector(".ks-input"); return t.classList.contains("ks-editing") && t.value === "42"; })()'));
    await Enter();
    check('Enter keeps the number and moves down', (await value(4, 7)) === 42 && (await active()) === '5,7', [await value(4, 7), await active()]);
    await type('=H5*2');
    await Enter();
    check('a formula typed in a cell works (=H5*2 -> 84)', (await value(5, 7)) === 84, await value(5, 7));
    const p = await center(5, 7);
    await mouse('mouseMoved', p.x, p.y); await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y);
    await mouse('mousePressed', p.x, p.y, { clickCount: 2 }); await mouse('mouseReleased', p.x, p.y, { clickCount: 2 });
    await wait(150);
    check('a double click edits the cell with its formula', await q('document.querySelector(".ks-input").value') === '=H5*2', await q('document.querySelector(".ks-input").value'));
    await type('+1');
    await key('Escape', 'Escape', 27);
    check('Escape leaves the cell as it was', (await value(5, 7)) === 84 && !(await q('document.querySelector(".ks-input").classList.contains("ks-editing")')));

    // arrows, Shift, Delete, undo, redo
    await key('ArrowUp', 'ArrowUp', 38);
    check('an arrow moves the active cell', (await active()) === '4,7');
    await key('ArrowDown', 'ArrowDown', 40, SHIFT);
    check('Shift+arrow selects a rectangle of two cells', await q('!!document.querySelector(".ks-sel")'));
    await key('Delete', 'Delete', 46);
    check('Delete empties the selected cells', (await value(4, 7)) === null && (await value(5, 7)) === null);
    await key('z', 'KeyZ', 90, CTRL);
    check('Ctrl+Z brings them back', (await value(4, 7)) === 42 && (await value(5, 7)) === 84);
    await key('y', 'KeyY', 89, CTRL);
    check('Ctrl+Y empties them again', (await value(4, 7)) === null);
    await key('z', 'KeyZ', 90, CTRL);

    // typing then an arrow ends the edit and moves (Google Sheets)
    await clickCell(6, 7);
    await type('hello');
    await key('ArrowRight', 'ArrowRight', 39);
    check('typing, then an arrow, keeps the text and moves', (await value(6, 7)) === 'hello' && (await active()) === '6,8', [await value(6, 7), await active()]);
    await key('Tab', 'Tab', 9);
    check('Tab moves to the right', (await active()) === '6,9');

    // dragging a rectangle with the mouse
    const a = await center(9, 1), b = await center(11, 3);
    await mouse('mouseMoved', a.x, a.y); await mouse('mousePressed', a.x, a.y);
    for (let i = 1; i <= 5; i++) { await mouse('mouseMoved', a.x + ((b.x - a.x) * i) / 5, a.y + ((b.y - a.y) * i) / 5, { buttons: 1 }); await wait(30); }
    await mouse('mouseReleased', b.x, b.y);
    await wait(100);
    const rect = await q('(function(){ var s = document.querySelector(".ks-sel"); if (!s) return null; var r = s.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()');
    check('dragging selects the rectangle under the mouse (B10:D12)', !!rect && rect.w === 260 + 100 + 100 && rect.h === 21 * 3, rect);

    // the headers
    const head = await q('(function(){ var h = document.querySelector(".ks-colhead[data-c=\\"2\\"]").getBoundingClientRect(); return { x: Math.round(h.left + h.width / 2), y: Math.round(h.top + h.height / 2) }; })()');
    await click(head.x, head.y);
    await wait(100);
    check('a column letter selects the whole column', await q('document.querySelector(".ks-colhead[data-c=\\"2\\"]").classList.contains("ks-full")'));

    // Ctrl+Down through 100 000 filled rows
    await clickCell(3, 1);
    await key('ArrowDown', 'ArrowDown', 40, CTRL);
    await wait(300);
    check('Ctrl+Down goes to the last of 100 000 filled cells, and the grid scrolls to it', (await active()) === '100002,1', await active());

    await key('a', 'KeyA', 65, CTRL);
    await wait(100);
    check('Ctrl+A selects everything', await q('document.querySelector(".ks-colhead[data-c=\\"0\\"]").classList.contains("ks-full") || document.querySelector(".ks-colhead").classList.contains("ks-full")'));
});

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
