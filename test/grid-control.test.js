// Control from code in a real Chrome (step R4): the host's rules stop a person at once (typing, double click, paste), types refuse a wrong value and say
// it as an event, hidden cells show dots, protected cells are striped, and the host's handle (select, startEdit) and events (op, selection) work.
//   node test/grid-control.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, send, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const S = 'window.__workbook.sheetIds()[0]';
    const W = 'window.__workbook';
    const value = (r, c) => q(`${W}.value(${S}, ${r}, ${c})`);
    const notice = () => q('(function(){ var n = document.querySelector(".ks-notice"); return n ? n.textContent : null; })()');
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x, p.y, extra); await wait(120); };

    check('protected cells are drawn striped (the rates, the approved line)', await q('!!document.querySelector(".ks-cell.ks-guarded[data-r=\\"1\\"][data-c=\\"2\\"]") && !!document.querySelector(".ks-cell.ks-guarded[data-r=\\"2\\"][data-c=\\"0\\"]")'));
    check('a hidden column shows dots, its header its name', (await q('document.querySelector(".ks-cell[data-r=\\"1\\"][data-c=\\"5\\"]").textContent')) === '•••' && (await q('document.querySelector(".ks-cell[data-r=\\"0\\"][data-c=\\"5\\"]").textContent')) === 'Cost');
    // what the eye sees: the dots stay in their cell, the header's text is on top of its fill, and a text that runs on does not take its fill along
    check('the dots of a hidden cell stay in their cell (they do not run on)', (await q('Math.round(document.querySelector(".ks-cell[data-r=\\"1\\"][data-c=\\"5\\"]").getBoundingClientRect().width)')) === 99);
    check('the header F1 shows its text on top of its fill', (await q('(function(){ var t = document.querySelector(".ks-cell[data-r=\\"0\\"][data-c=\\"5\\"] .ks-text"); var b = t.getBoundingClientRect(); return document.elementFromPoint(b.left + 3, b.top + b.height / 2) === t; })()')));
    check('a text that runs on keeps its fill in its own cell', (await q('(function(){ var own = document.querySelector(".ks-cell[data-r=\\"0\\"][data-c=\\"5\\"] .ks-own"); return !own || Math.round(own.getBoundingClientRect().width) === 99; })()')));

    await clickCell(1, 2);
    await type('9');
    await wait(150);
    check('typing on a read-only rate: no editor, and the rule\'s message at once', !(await q('document.querySelector(".ks-input").classList.contains("ks-editing")')) && (await notice()) === 'The rates are set by the estimator', await notice());
    check('the rate is unchanged', (await value(1, 2)) === 500);

    // the host hears of the refusal with where and what (onNotice), and decides what shows: its own text, or nothing
    const heard = await q('window.__events.notice[window.__events.notice.length - 1]');
    check('onNotice tells the host: refused, C2, edit, and the message of the rule', heard && heard.kind === 'refused' && heard.address === 'C2' && heard.action === 'edit' && heard.reason === 'The rates are set by the estimator', heard);
    await key('Escape', 'Escape', 27);
    await q('window.__noticeAnswer = "Tarif diatur estimator"');
    await clickCell(1, 2); await type('9'); await wait(150);
    check('a text from onNotice shows instead of the text of the sheet', (await notice()) === 'Tarif diatur estimator', await notice());
    await key('Escape', 'Escape', 27);
    await q('window.__noticeAnswer = null');
    const before = await q('window.__events.notice.length');
    await clickCell(1, 2); await type('9'); await wait(150);
    check('null from onNotice: the sheet shows nothing new (not its own text), the host still hears of it', (await notice()) !== 'The rates are set by the estimator' && (await q('window.__events.notice.length')) === before + 1, [await notice(), await q('window.__events.notice.length') - before]);
    await q('window.__noticeAnswer = undefined');

    const beam = await cellAt(2, 1);
    await mouse('mouseMoved', beam.x, beam.y); await mouse('mousePressed', beam.x, beam.y); await mouse('mouseReleased', beam.x, beam.y);
    await mouse('mousePressed', beam.x, beam.y, { clickCount: 2 }); await mouse('mouseReleased', beam.x, beam.y, { clickCount: 2 });
    await wait(200);
    check('a double click on an approved line: no editor, and why', !(await q('document.querySelector(".ks-input").classList.contains("ks-editing")')) && (await notice()) === 'An approved line is locked', await notice());

    await clickCell(1, 1);
    await type('1.5');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('1.5 in a whole-number column is refused, and said', (await value(1, 1)) === 10 && /Expected a whole number in B2 \(Qty\)/.test(await notice()), [await value(1, 1), await notice()]);
    const cellError = await q('window.__events.cellError.length ? window.__events.cellError[0] : null');
    check('and the host gets onCellError with the address, the field and what was expected', !!cellError && cellError.address === 'B2' && cellError.field === 'Qty' && cellError.expected === 'a whole number', cellError);

    await clickCell(1, 1);
    await type('12');
    await key('Enter', 'Enter', 13);
    await wait(150);
    check('a whole number is taken, and the host gets onOp', (await value(1, 1)) === 12 && (await q('window.__events.op.some(function(e){ return e.source === "user" && e.ops[0].t === "cells"; })')));

    // a paste that touches a protected cell is refused whole
    await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await q(`navigator.clipboard.writeText('7\\t8')`);
    await clickCell(3, 1);
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2, commands: ['paste'] });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2 });
    await wait(250);
    check('a paste over a quantity and a read-only rate is refused whole (the quantity is not changed either)', (await value(3, 1)) === 2 && (await value(3, 2)) === 1200, [await value(3, 1), await value(3, 2)]);

    // the host's handle
    await q('window.__sheet.current.select("E4")');
    await wait(250);
    check('handle.select("E4") selects it (the name box says so)', (await q('document.querySelector(".ks-namebox").value')) === 'E4');
    check('and onSelectionChange told the host', await q('window.__events.selection.some(function(a){ return a.r === 3 && a.c === 4; })'));
    // a real drag from B2 over B3 and B4 to B5: while the mouse is down the host hears nothing, on mouse up it hears once, the whole range
    const from = await cellAt(1, 1), over1 = await cellAt(2, 1), over2 = await cellAt(3, 1), to = await cellAt(4, 1);
    await q('window.__events.selection.length = 0');
    await mouse('mouseMoved', from.x, from.y);
    await mouse('mousePressed', from.x, from.y);
    await mouse('mouseMoved', over1.x, over1.y, { buttons: 1 }); await wait(80);
    await mouse('mouseMoved', over2.x, over2.y, { buttons: 1 }); await wait(80);
    await mouse('mouseMoved', to.x, to.y, { buttons: 1 }); await wait(80);
    check('while dragging, onSelectionChange is not called', (await q('window.__events.selection.length')) === 0, await q('window.__events.selection'));
    await mouse('mouseReleased', to.x, to.y);
    await wait(150);
    check('on mouse up it is called once, with where the drag ended', (await q('window.__events.selection.length')) === 1 && (await q('window.__events.selection[0].r')) === 1, await q('window.__events.selection'));
    await clickCell(3, 4);
    check('a plain click is told once', (await q('window.__events.selection.length')) === 2, await q('window.__events.selection'));

    await q('window.__sheet.current.startEdit("Rejected")');
    await wait(200);
    check('handle.startEdit opens the editor with a text', (await q('document.querySelector(".ks-input").value')) === 'Rejected');
    await key('Enter', 'Enter', 13);
    await wait(150);
    check('and Enter writes it (an enum value)', (await value(3, 4)) === 'Rejected');

    // populate from the host's code: data shows at once, the rules do not stop the host
    await q('window.__populate({ at: "A6", header: false }, [{ item: "Column", qty: 6, rate: 750 }])');
    await wait(200);
    check('populate from code shows at once', (await q('document.querySelector(".ks-cell[data-r=\\"5\\"][data-c=\\"0\\"]").textContent')) === 'Column');
}, 'control.js');
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
