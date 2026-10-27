// Comments in a real Chrome (step R6): Ctrl+Alt+M opens the comments panel on the right with its box focused for the selected cell, Ctrl+Enter sends,
// the cell gets its mark, a reply as another person, a second thread, a thread's address goes to its cell, Resolve moves it to Resolved and Reopen
// back; the access policy decides what is offered (reply only: no new thread, no Resolve; no comment.read: no panel, no marks). The rules underneath
// are in comments.test.js.
//   node test/grid-comments.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c) => { const p = await cellAt(r, c); await click(p.x, p.y); await wait(200); };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const panel = () => q('!!document.querySelector(".ks-comments")');
    const marked = (r, c) => q(`!!document.querySelector('.ks-cell.ks-noted[data-r="${r}"][data-c="${c}"]')`);
    const focused = () => q('document.activeElement && document.activeElement.getAttribute("aria-label")');
    const ctrlEnter = () => key('Enter', 'Enter', 13, 2);
    const inPanel = (text) => `Array.from(document.querySelectorAll('.ks-comments button')).find(function(x){ return x.textContent.trim() === ${JSON.stringify(text)} || x.getAttribute('aria-label') === ${JSON.stringify(text)}; })`;
    const cells = () => q('Array.from(document.querySelectorAll(".ks-thread-cell")).map(function(x){ return x.textContent; }).join(",")');
    await q(`${W}.setUser({ id: 'u1', name: 'Rina' })`);

    await clickCell(1, 0);
    await key('m', 'KeyM', 77, 2 + 1);
    await wait(300);
    check('Ctrl+Alt+M opens the comments panel, its box focused for A2', (await panel()) && (await focused()) === 'Comment on A2', await focused());
    await type('Cek volume tiang');
    await ctrlEnter();
    await wait(250);
    check('Ctrl+Enter sends it: a thread on A2, by Rina', JSON.stringify(await q(`(function(){ var t = ${W}.commentAt(${S}, 1, 0); return t && [t.items[0].text, t.items[0].by.name]; })()`)) === JSON.stringify(['Cek volume tiang', 'Rina']));
    check('the cell has its mark, and its thread is the current one', (await marked(1, 0)) && (await q('document.querySelector(".ks-thread.ks-current .ks-thread-cell").textContent')) === 'A2');

    // Budi replies from the box (the cell has a thread: the box replies)
    await q(`${W}.setUser({ id: 'u2', name: 'Budi' })`);
    await press('document.querySelector(\'.ks-comments textarea[aria-label="Comment on A2"]\')');
    await type('Sudah, 10 titik');
    await press(inPanel('Reply'));
    check('a reply in the thread', (await q(`${W}.commentAt(${S}, 1, 0).items.map(function(x){ return x.by.name + ': ' + x.text; }).join(" | ")`)) === 'Rina: Cek volume tiang | Budi: Sudah, 10 titik');

    // a second thread on D4
    await clickCell(3, 3);
    await press('document.querySelector(\'.ks-comments textarea[aria-label="Comment on D4"]\')');
    await type('Harga perlu dicek');
    await ctrlEnter();
    await wait(250);
    check('two threads in the order of their cells', (await cells()) === 'A2,D4', await cells());
    await press(`Array.from(document.querySelectorAll('.ks-thread-cell')).find(function(x){ return x.textContent === 'A2'; })`);
    check('a thread\'s address goes to its cell', (await q('JSON.stringify(window.__sheet.current.getSelection().active)')) === JSON.stringify({ r: 1, c: 0 }));

    await press('document.querySelector(\'.ks-thread.ks-current [aria-label="Resolve"]\')');
    check('Resolve: A2 leaves the open list and its mark goes', (await cells()) === 'D4' && !(await marked(1, 0)), await cells());
    await press(`Array.from(document.querySelectorAll('.ks-comments [role="tab"]')).find(function(x){ return x.textContent === 'Resolved'; })`);
    check('it is under Resolved', (await cells()) === 'A2', await cells());
    await press(inPanel('Reopen'));
    check('Reopen: open again, its mark back', (await q(`${W}.commentAt(${S}, 1, 0) !== null`)) && (await marked(1, 0)));
    await press(`Array.from(document.querySelectorAll('.ks-comments [role="tab"]')).find(function(x){ return x.textContent === 'Open'; })`);

    // the policy decides what is offered
    await q(`${W}.setAccess({ default: 'r', roles: { r: { can: ['comment.read', 'comment.reply'] } } }, 'user:x')`);
    await wait(250);
    await clickCell(5, 5);
    check('reply only: no box for a cell without a thread, no Resolve', !(await q('!!document.querySelector(\'.ks-comments textarea[aria-label="Comment on F6"]\')')) && !(await q('!!document.querySelector(\'.ks-comments [aria-label="Resolve"]\')')));
    check('but a reply box under each thread', (await q('document.querySelectorAll(".ks-thread .ks-comment-new textarea").length')) === 2);
    await q(`${W}.setAccess({ default: 'e', roles: { e: { can: ['edit'] } } }, 'user:y')`);
    await wait(250);
    check('no comment.read: no panel, no marks', !(await panel()) && !(await marked(3, 3)));
    await q(`${W}.setAccess(null)`);
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
