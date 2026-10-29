// Comments in a real Chrome, as in Excel: a card beside the cell. Ctrl+Alt+M opens the card of the selected cell with its box focused, Ctrl+Enter
// sends, the cell gets its mark; a click on a marked cell opens its card, picking another cell or Escape closes it; with comments.open 'hover'
// (the default) the mouse on a marked cell shows the card and it goes when the mouse leaves (not while the mouse is on the card), typing in it
// keeps it; with 'click' the mouse alone shows nothing. What was typed and not sent is still there when the card opens again. The ⋯ menu edits
// and deletes, on one's own comments only. A reply from someone else shows in the open card. View > Comments lists every discussion
// ("Rina commented on A2"), with its filters, and a click opens the card of that cell. The access rows decide what is offered. The rules
// underneath are in comments.test.js.
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
    const hoverCell = async (r, c) => { const p = await cellAt(r, c); await mouse('mouseMoved', p.x, p.y); await wait(150); };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const card = () => q(`(function(){ var e = document.querySelector('.ks-comment-card'); return e && getComputedStyle(e).visibility !== 'hidden' ? e.getAttribute('aria-label') : null; })()`);
    const marked = (r, c) => q(`!!document.querySelector('.ks-cell.ks-noted[data-r="${r}"][data-c="${c}"]')`);
    const focused = () => q('document.activeElement && document.activeElement.getAttribute("aria-label")');
    const ctrlEnter = () => key('Enter', 'Enter', 13, 2);
    const escape = () => key('Escape', 'Escape', 27);
    const items = (r, c) => q(`(function(){ var t = ${W}.commentAt(${S}, ${r}, ${c}); return t ? t.items.map(function(x){ return x.by.name + ': ' + x.text; }).join(' | ') : null; })()`);
    const inCard = (text) => `Array.from(document.querySelectorAll('.ks-comment-card button')).find(function(x){ return x.textContent.trim() === ${JSON.stringify(text)} || x.getAttribute('aria-label') === ${JSON.stringify(text)}; })`;
    const box = (label) => `document.querySelector('.ks-comment-card textarea[aria-label="${label}"]')`;
    await q(`${W}.setUser({ id: 'u1', name: 'Rina' })`);

    // writing: Ctrl+Alt+M on A2
    await clickCell(1, 0);
    await key('m', 'KeyM', 77, 2 + 1);
    await wait(300);
    check('Ctrl+Alt+M opens the card of A2, its box focused', (await card()) === 'Comments on A2' && (await focused()) === 'Comment on A2', [await card(), await focused()]);
    await type('Cek volume tiang');
    await ctrlEnter();
    await wait(250);
    check('Ctrl+Enter sends it: a discussion on A2, by Rina', (await items(1, 0)) === 'Rina: Cek volume tiang', await items(1, 0));
    check('the cell has its mark, the card stays open with the comment and an empty box to reply',
        (await marked(1, 0)) && (await q('document.querySelectorAll(".ks-card-item").length')) === 1 && (await focused()) === 'Reply on A2' && (await q(`${box('Reply on A2')}.value`)) === '');
    check('the comment shows its writer\'s circle and name', (await q('document.querySelector(".ks-card-item .ks-avatar").textContent')) === 'RI' && (await q('document.querySelector(".ks-card-by b").textContent')) === 'Rina');
    check('the card stands beside its cell (on its right, its top on the cell\'s top)', await q(`(function(){ var k = document.querySelector('.ks-comment-card').getBoundingClientRect(), h = document.querySelector('.ks-colhead[data-c="0"]').getBoundingClientRect(), v = document.querySelector('.ks-rowhead[data-r="1"]').getBoundingClientRect(); return k.left >= h.right && k.left - h.right < 20 && Math.abs(k.top - v.top) < 2; })()`));
    await escape();
    await wait(200);
    check('Escape closes the card', (await card()) === null);

    // a click on the marked cell opens it; Budi replies
    await q(`${W}.setUser({ id: 'u2', name: 'Budi' })`);
    await clickCell(14, 6);
    await clickCell(1, 0);
    check('a click on a marked cell opens its card', (await card()) === 'Comments on A2');
    await press(box('Reply on A2'));
    await type('Sudah, 10 titik');
    await press(inCard('Reply'));
    check('a reply from the card', (await items(1, 0)) === 'Rina: Cek volume tiang | Budi: Sudah, 10 titik', await items(1, 0));
    check('the person\'s own comment is marked as theirs, the other\'s not', JSON.stringify(await q(`Array.from(document.querySelectorAll('.ks-card-item')).map(function(e){ return e.classList.contains('ks-mine'); })`)) === '[false,true]');
    check('the ⋯ menu only on one\'s own comment', (await q(`Array.from(document.querySelectorAll('.ks-card-item')).map(function(e){ return !!e.querySelector('.ks-card-more'); }).join()`)) === 'false,true');
    await clickCell(14, 0);
    check('picking another cell closes the card', (await card()) === null);

    // someone else replies while the card is open: it shows
    await clickCell(1, 0);
    await q(`(function(){ ${W}.setUser({ id: 'u1', name: 'Rina' }); var t = ${W}.commentAt(${S}, 1, 0); ${W}.replyComment(${S}, t.id, 'Oke makasih', { source: 'remote' }); ${W}.setUser({ id: 'u2', name: 'Budi' }); })()`);
    await wait(250);
    check('a reply from someone else shows in the open card', (await q('document.querySelectorAll(".ks-card-item").length')) === 3);

    // edit and delete from the ⋯ menu
    await press(`document.querySelectorAll('.ks-card-item')[1].querySelector('.ks-card-more')`);
    await press(inCard('Edit'));
    check('Edit puts the comment in a box', (await focused()) === 'Edit comment');
    await q(`(function(){ var t = document.activeElement; var set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ''); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await type('Sudah, 12 titik');
    await ctrlEnter();
    await wait(250);
    check('Ctrl+Enter saves the edit, the comment is marked edited', (await items(1, 0)) === 'Rina: Cek volume tiang | Budi: Sudah, 12 titik | Rina: Oke makasih' && !!(await q(`${W}.commentAt(${S}, 1, 0).items[1].edited`)) && (await q(`document.querySelectorAll('.ks-card-item')[1].textContent`)).includes('edited'));
    await press(`document.querySelectorAll('.ks-card-item')[1].querySelector('.ks-card-more')`);
    await press(inCard('Delete'));
    check('Delete takes the reply away, the discussion stays', (await items(1, 0)) === 'Rina: Cek volume tiang | Rina: Oke makasih', await items(1, 0));

    // a draft is kept while the card is closed
    await press(box('Reply on A2'));
    await type('Belum selesai');
    await escape();
    await wait(150);
    await clickCell(14, 6);
    await clickCell(1, 0);
    check('what was typed and not sent is still there when the card opens again', (await q(`${box('Reply on A2')}.value`)) === 'Belum selesai');
    await q(`(function(){ var t = ${box('Reply on A2')}; var set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ''); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await escape();
    await clickCell(14, 6);

    // hover (the default)
    await hoverCell(1, 0);
    check('the mouse on a marked cell shows its card', (await card()) === 'Comments on A2');
    await hoverCell(16, 7);
    await wait(450);
    check('it goes after the mouse leaves', (await card()) === null);
    await hoverCell(1, 0);
    const onCard = await centerOf(`document.querySelector('.ks-comment-card .ks-card-text')`);
    await mouse('mouseMoved', onCard.x, onCard.y);
    await wait(450);
    check('it stays while the mouse is on the card', (await card()) === 'Comments on A2');
    await press(box('Reply on A2'));
    await hoverCell(16, 7);
    await wait(450);
    check('typing in a hover card keeps it open after the mouse leaves', (await card()) === 'Comments on A2');
    await escape();
    await wait(150);

    // click only
    await q(`window.__setProps({ comments: { open: 'click' } })`);
    await wait(200);
    await hoverCell(1, 0);
    await wait(200);
    check('comments.open "click": the mouse alone shows nothing', (await card()) === null);
    await clickCell(1, 0);
    check('a click still opens it', (await card()) === 'Comments on A2');
    await escape();
    await q(`window.__setProps({})`);
    await clickCell(14, 6);

    // a second discussion, by Budi, then the list of every discussion
    await clickCell(3, 3);
    await key('m', 'KeyM', 77, 2 + 1);
    await wait(250);
    await type('Harga perlu dicek');
    await ctrlEnter();
    await wait(200);
    await escape();
    await q(`(function(){ var b = Array.from(document.querySelectorAll('button')).find(function(x){ return x.textContent.trim() === 'View'; }); b.click(); })()`);
    await wait(200);
    await press(`Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], li, button')).find(function(x){ return x.textContent.trim().indexOf('Comments') === 0; })`);
    const list = () => q(`Array.from(document.querySelectorAll('.ks-comments .ks-thread')).map(function(x){ return x.querySelector('.ks-thread-who span').textContent; }).join(' / ')`);
    check('View > Comments lists every discussion: who started it on which cell', (await list()) === 'Rina commented on A2 / Budi commented on D4', await list());
    check('with the first comment and its replies', (await q(`document.querySelector('.ks-comments .ks-thread .ks-thread-more').textContent`)).startsWith('1 reply · last Rina'));
    check('the panel has no box to write in', !(await q(`!!document.querySelector('.ks-comments textarea')`)));
    await press(`Array.from(document.querySelectorAll('.ks-chip')).find(function(x){ return x.textContent.indexOf('Mine') === 0; })`);
    check('Mine: the discussions the person wrote in', (await list()) === 'Budi commented on D4', await list());
    await press(`Array.from(document.querySelectorAll('.ks-chip')).find(function(x){ return x.textContent.indexOf('All') === 0; })`);
    await press(`document.querySelector('.ks-comments .ks-thread')`);
    check('a click in the list selects the cell and opens its card', (await q('window.__sheet.current.getSelection().active.address')) === 'A2' && (await card()) === 'Comments on A2');
    check('and marks that discussion in the list', (await q(`document.querySelector('.ks-comments .ks-thread.ks-current .ks-thread-cell').textContent`)) === 'A2');
    await escape();

    // the access rows decide what is offered
    await q(`${W}.setAccess([{ who: '*', effect: 'allow', action: 'read' }, { who: '*', effect: 'allow', action: 'comment.read' }, { who: '*', effect: 'allow', action: 'comment.reply' }], 'x')`);
    await wait(250);
    await clickCell(5, 5);
    await q('window.__events.notice.length = 0');
    await key('m', 'KeyM', 77, 2 + 1);
    await wait(250);
    check('reply only: Ctrl+Alt+M on a cell without a discussion is refused, no card', (await card()) === null && (await q('window.__events.notice.some(function(n){ return n.kind === "refused" && n.action === "comment.create"; })')));
    await clickCell(1, 0);
    check('but a discussion\'s card has its reply box, and no ⋯ menu', (await card()) === 'Comments on A2' && (await q(`!!${box('Reply on A2')}`)) && !(await q(`!!document.querySelector('.ks-card-more')`)));
    await q(`${W}.setAccess([{ who: '*', effect: 'allow', action: 'edit' }], 'y')`);
    await wait(250);
    await clickCell(1, 0);
    check('no comment.read: no marks, no card', !(await marked(3, 3)) && (await card()) === null);
    await q(`${W}.setAccess(null)`);
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
