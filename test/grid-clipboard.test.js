// Copy, cut, paste and the fill handle in a real Chrome (step R2d): the keys go through Chrome's own clipboard commands, the fill handle is dragged with
// the real mouse. The rules underneath are checked without a browser in transfer.test.js.
//   node test/grid-clipboard.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, send, click, mouse, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    const q = (expr) => js(expr);
    const S = 'window.__workbook.sheetIds()[0]';
    const input = (r, c) => q(`window.__workbook.input(${S}, ${r}, ${c})`);
    const value = (r, c) => q(`window.__workbook.value(${S}, ${r}, ${c})`);
    const center = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); if (!h || !v) return null; var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, modifiers) => { const p = await center(r, c); await click(p.x, p.y, modifiers ? { modifiers } : undefined); await wait(80); };
    // a key with the command Chrome runs for it (the clipboard commands are Chrome's, as when a person presses them)
    const command = async (k, code, vk, modifiers, cmd) => {
        await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, commands: [cmd] });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
        await wait(150);
    };
    const copy = () => command('c', 'KeyC', 67, 2, 'copy');
    const cut = () => command('x', 'KeyX', 88, 2, 'cut');
    const paste = (shift) => command(shift ? 'V' : 'v', 'KeyV', 86, shift ? 10 : 2, 'paste');

    // copy E5:F5 (a rate and an amount = D5*E5), paste it on H21
    await clickCell(4, 4);
    await clickCell(4, 5, 8);
    await copy();
    check('Ctrl+C frames what was copied', await q('!!document.querySelector(".ks-clipmark")'));
    await clickCell(20, 7);
    await paste(false);
    check('Ctrl+V pastes the values', (await value(20, 7)) === 17500, await value(20, 7));
    check('and the formula moved by the distance (=D5*E5 at F5, 16 rows down and 3 columns right -> =G21*H21 at I21)', (await input(20, 8)) === '=G21*H21', await input(20, 8));
    check('the pasted cells are selected', await q('!!document.querySelector(".ks-sel")'));
    await key('Escape', 'Escape', 27);
    check('Escape takes the frame of the copy away', !(await q('!!document.querySelector(".ks-clipmark")')));

    // paste values only
    await clickCell(4, 5);
    await copy();
    await clickCell(22, 7);
    await paste(true);
    check('Ctrl+Shift+V pastes the value, not the formula', (await q(`window.__workbook.raw(${S}, 22, 7)`)) === 35000, await q(`window.__workbook.raw(${S}, 22, 7)`));

    // cut moves
    await clickCell(20, 7);
    await clickCell(20, 8, 8);
    await cut();
    await clickCell(26, 10);
    await paste(false);
    check('Ctrl+X then Ctrl+V moves the cells (H21 is empty, K27 has the value)', (await value(20, 7)) === null && (await value(26, 10)) === 17500, [await value(20, 7), await value(26, 10)]);
    check('and the frame of the cut is gone once it is pasted', !(await q('!!document.querySelector(".ks-clipmark")')));
    await key('z', 'KeyZ', 90, 2);
    check('one Ctrl+Z puts the cut back', (await value(20, 7)) === 17500 && (await value(26, 10)) === null);

    // text from another program
    await q(`navigator.clipboard.writeText('Bolt\\t12\\nNut\\t30').then(function(){ return 1; })`);
    await clickCell(30, 7);
    await paste(false);
    check('text from another program (tab-separated) pastes as typed', (await value(30, 7)) === 'Bolt' && (await value(31, 8)) === 30, [await value(30, 7), await value(31, 8)]);

    // the fill handle, dragged with the real mouse: 1, 2 in J5:J6 go on 3, 4, 5, 6 (column J is wholly on screen: the handle of a cell at the edge is cut off, as in any sheet)
    await q(`window.__workbook.setValues(${S}, 4, 9, [[1], [2]])`);
    await clickCell(4, 9);
    await clickCell(5, 9, 8);
    const handle = await q('(function(){ var h = document.querySelector(".ks-fill"); var b = h.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()');
    const end = await center(9, 9);
    await mouse('mouseMoved', handle.x, handle.y);
    await mouse('mousePressed', handle.x, handle.y);
    let previewSeen = false;
    for (let i = 1; i <= 6; i++) { await mouse('mouseMoved', handle.x, handle.y + ((end.y - handle.y) * i) / 6, { buttons: 1 }); await wait(30); if (i === 3) previewSeen = await q('!!document.querySelector(".ks-fillpreview")'); }
    await mouse('mouseReleased', handle.x, end.y);
    await wait(200);
    check('the cells the handle is dragged over are framed while dragging', previewSeen);
    const filled = [];
    for (let r = 6; r <= 9; r++) filled.push(await value(r, 9));
    check('dragging the fill handle goes on with the series (3, 4, 5, 6)', JSON.stringify(filled) === '[3,4,5,6]', filled);
    await key('z', 'KeyZ', 90, 2);
    check('one Ctrl+Z takes the fill back', (await value(6, 9)) === null);
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
