// The owner's side of access control in a real Chrome: Data > Access and roles opens the panel; a role's action ticked, a part of the screen hidden, a
// range protected from the selection, a person given a role; every change goes to the host (onAccessChange); View as shows the sheet as the role does
// (no toolbar, an invisible column, writing refused) with a bar to leave it.
//   node test/grid-access-owner.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(500);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    // an element is scrolled into the middle of its box first, as a person scrolls the panel to reach it
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x, p.y, extra); await wait(150); };
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(200); await click(p.x, p.y); await wait(300); return true; };
    const inPanel = (text) => `Array.from(document.querySelectorAll('.ks-access button, .ks-access label')).find(function(x){ return x.textContent.trim().indexOf(${JSON.stringify(text)}) === 0; })`;
    const last = () => q('window.__policies.length ? window.__policies[window.__policies.length - 1] : null');

    check('the owner sees everything', (await q(`${W}.access().owner`)) && (await q(`${W}.raw(${S}, 1, 5)`)) === 400);
    await menubar('Data');
    check('Data > Access and roles, for an owner', await menuPick('Access and roles'));
    check('the panel opens on the first role', (await q('!!document.querySelector(".ks-access")')) && (await q('document.querySelector(\'.ks-access [aria-selected="true"]\').textContent')) === 'site');

    // the site role: may italic too; sees the formula bar no more
    await press(inPanel('Italic'));
    check('an action ticked goes to the host', JSON.stringify((await last()).roles.site.can.sort()) === JSON.stringify(['format.bold', 'format.italic']), (await last()).roles.site.can);
    await press(inPanel('Formula bar'));
    check('a part of the screen hidden for the role', (await last()).roles.site.ui.formulaBar === false);

    // a range protected from the selection
    await clickCell(1, 2);
    await clickCell(3, 2, { modifiers: 8 });
    await press(inPanel('Protect range'));
    check('Protect range takes the selection', JSON.stringify((await last()).roles.site.ranges.slice(-1)[0]) === JSON.stringify({ sheet: 'BOQ', range: 'C2:C4', mode: 'readonly' }), (await last()).roles.site.ranges);

    // a person given the role
    await press('document.querySelector(\'.ks-access input[name="who"]\')');
    await type('rina');
    await press('document.querySelector(".ks-access form button[type=submit]")');
    check('a person added, with the role open', (await last()).members['user:rina'] === 'site', (await last()).members);

    // View as: the sheet as the role sees it
    await press(inPanel('View as'));
    check('View as: a bar says it, the panel closes', (await q('document.querySelector(".ks-viewas") && document.querySelector(".ks-viewas").textContent')) === 'Viewing as siteExit' && !(await q('!!document.querySelector(".ks-access")')));
    check('as the role: no menu bar, no toolbar, no formula bar', !(await q('!!document.querySelector(".ks-menubar")')) && !(await q('!!document.querySelector(".ks-toolbar")')) && !(await q('!!document.querySelector(".ks-formulabar")')));
    check('the cost is invisible', (await q('(function(){ var c = document.querySelector(\'.ks-cell[data-r="1"][data-c="5"]\'); return c ? c.textContent : ""; })()')) === '');
    await clickCell(1, 0);
    await type('X');
    await wait(200);
    check('writing outside its range is refused', (await q(`${W}.value(${S}, 1, 0)`)) === 'Pile');
    await press('document.querySelector(".ks-viewas button")');
    check('Exit: the owner again, menus back', !(await q('!!document.querySelector(".ks-viewas")')) && (await q('!!document.querySelector(".ks-menubar")')) && (await q(`${W}.access().owner`)));
}, 'access.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
