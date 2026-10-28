// Access control in a real Chrome: a mandor (no menu bar, no toolbar, an area, an edit range) types where it may and is told where it may not; a role
// that may bold but not italic sees Italic greyed, and the Data menu's Sort greyed; copy refused for a role without it; headers and grid lines hidden;
// the access rows taken away give everything back. The rules underneath are in policy.test.js.
//   node test/grid-access.test.js     (needs Chrome)
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
    const clickCell = async (r, c) => { const p = await cellAt(r, c); await click(p.x, p.y); await wait(150); };
    const notice = () => q('(function(){ var n = document.querySelector(".ks-notice"); return n ? n.textContent : null; })()');
    const setAccess = (rows, who) => q(`${W}.setAccess(${JSON.stringify(rows)}, ${JSON.stringify(who)})`).then(() => wait(300));
    const has = (sel) => q(`!!document.querySelector(${JSON.stringify(sel)})`);
    // the example's own rules (rates read only, approved lines locked, cost hidden) are the host's: they stay under the access rows
    const ROWS = [
        { who: 'user:yeka', effect: 'allow', action: '*' },
        // a mandor reads the sheet, writes the quantities, may bold, sees only A1:E20 and no menu bar or toolbar
        { who: 'role:mandor', effect: 'allow', action: 'read' },
        { who: 'role:mandor', effect: 'allow', action: 'edit', where: 'B2:B20' },
        { who: 'role:mandor', effect: 'allow', action: 'format.bold' },
        { who: 'role:mandor', effect: 'allow', action: 'view.area', where: 'A1:E20' },
        { who: 'role:mandor', effect: 'deny', action: 'ui.menubar' },
        { who: 'role:mandor', effect: 'deny', action: 'ui.toolbar' },
        // ani types anywhere and may bold
        { who: 'user:ani', effect: 'allow', action: 'edit' },
        { who: 'user:ani', effect: 'allow', action: 'format.bold' },
        // a viewer reads, without row numbers, column letters or grid lines
        { who: 'role:viewer', effect: 'allow', action: 'read' },
        { who: 'role:viewer', effect: 'deny', action: 'ui.headers' },
        { who: 'role:viewer', effect: 'deny', action: 'ui.gridlines' }
    ];

    await setAccess(ROWS, { user: 'budi', roles: ['mandor'] });
    check('a mandor: no menu bar, no toolbar, the formula bar stays', !(await has('.ks-menubar')) && !(await has('.ks-toolbar')) && (await has('.ks-formulabar')));
    check('only the area A1:E20: column F has no width', (await q('Math.round(document.querySelector(\'.ks-colhead[data-c="5"]\') ? document.querySelector(\'.ks-colhead[data-c="5"]\').getBoundingClientRect().width : 0)')) === 0);
    await clickCell(1, 1);
    await type('12');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('types in its edit range (Qty)', (await q(`${W}.value(${S}, 1, 1)`)) === 12);
    await clickCell(1, 0);
    await type('X');
    await wait(200);
    check('is told it may not write elsewhere', (await notice()) === 'You can only view this here' && (await q(`${W}.value(${S}, 1, 0)`)) === 'Pile', await notice());
    await clickCell(1, 1);
    await key('c', 'KeyC', 67, 2);
    await wait(200);
    check('copy refused (the role was not given it)', (await notice()) === 'You cannot copy from this sheet here', await notice());

    await setAccess(ROWS, 'ani');
    check('a typist: the toolbar shows, Bold usable, Italic greyed', (await has('.ks-toolbar')) && !(await q('document.querySelector(\'.ks-toolbar [aria-label^="Bold"]\').disabled')) && (await q('document.querySelector(\'.ks-toolbar [aria-label^="Italic"]\').disabled')));
    check('the fill colour is greyed too', await q('document.querySelector(\'.ks-toolbar [aria-label="Fill color"]\').disabled'));
    const data = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'Data'; })`);
    await click(data.x, data.y);
    await wait(300);
    check('the Data menu greys Sort and Create a filter', await q(`Array.from(document.querySelectorAll('.ks-menu-item')).filter(function(x){ return /Sort sheet|Create a filter/.test(x.textContent); }).every(function(x){ return x.getAttribute('aria-disabled') === 'true' || x.hasAttribute('data-disabled'); })`));
    await key('Escape', 'Escape', 27);
    await wait(150);

    await setAccess(ROWS, { user: 'someone', roles: ['viewer'] });
    check('a viewer: no row numbers, no column letters', (await q('Array.from(document.querySelectorAll(".ks-rowhead")).every(function(h){ return h.getBoundingClientRect().width === 0; })')) && (await q('Array.from(document.querySelectorAll(".ks-colhead")).every(function(h){ return h.getBoundingClientRect().height === 0; })')));
    check('and no grid lines', !(await has('.ks-line-h')));
    const a1 = await q('(function(){ var c = document.querySelector(\'.ks-cell[data-r="0"][data-c="0"]\').getBoundingClientRect(), g = document.querySelector(".ks-grid").getBoundingClientRect(); return [Math.round(c.left - g.left), Math.round(c.top - g.top)]; })()');
    check('A1 is in the corner of the grid', JSON.stringify(a1) === '[0,0]', a1);

    // a client: only the Summary sheet, an area of it, what it may not do hidden (not greyed), some parts hidden by their id
    await q(`${W}.addSheet('Summary')`);
    await setAccess([
        { who: 'role:client', effect: 'allow', action: 'read' },
        { who: 'role:client', effect: 'allow', action: 'format.bold' },
        { who: 'role:client', effect: 'allow', action: 'view.sheet', where: 'Summary' },
        { who: 'role:client', effect: 'allow', action: 'view.area', where: 'Summary!A1:C10' },
        { who: 'role:client', effect: 'deny', action: 'ui.disallowed' },
        { who: 'role:client', effect: 'deny', action: 'ui.menu.Insert' },
        { who: 'role:client', effect: 'deny', action: 'ui.tool.paint' },
        { who: 'role:client', effect: 'deny', action: 'ui.feature.contextMenu' },
        { who: 'role:client', effect: 'deny', action: 'ui.feature.fillHandle' }
    ], { user: 'client', roles: ['client'] });
    check('only the Summary tab, and Summary is shown', (await q('Array.from(document.querySelectorAll(".ks-tab")).map(function(t){ return t.textContent; }).join(",")')) === 'Summary');
    check('its area: column D has no width', (await q('Math.round(document.querySelector(\'.ks-colhead[data-c="3"]\') ? document.querySelector(\'.ks-colhead[data-c="3"]\').getBoundingClientRect().width : 0)')) === 0);
    check('no Insert menu', !(await q('Array.from(document.querySelectorAll(".ks-menubar-item")).some(function(x){ return x.textContent === "Insert"; })')));
    check('Bold shows; Italic (not allowed) and Paint format (hidden) are not drawn', (await has('.ks-toolbar [aria-label^="Bold"]')) && !(await has('.ks-toolbar [aria-label^="Italic"]')) && !(await has('.ks-toolbar [aria-label="Paint format"]')));
    const data2 = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'Data'; })`);
    if (data2) { await click(data2.x, data2.y); await wait(300); }
    check('the Data menu leaves out what it may not do', !data2 || !(await q(`Array.from(document.querySelectorAll('.ks-menu-item')).some(function(x){ return /Create a filter|Sort sheet/.test(x.textContent); })`)));
    await key('Escape', 'Escape', 27);
    await wait(150);
    await clickCell(1, 1);
    const cell = await cellAt(1, 1);
    await mouse('mouseMoved', cell.x, cell.y);
    await mouse('mousePressed', cell.x, cell.y, { button: 'right', buttons: 2 });
    await mouse('mouseReleased', cell.x, cell.y, { button: 'right', buttons: 2 });
    await wait(250);
    check('no right-click menu, no fill handle', !(await has('.ks-menu')) && !(await has('.ks-fill')));

    await setAccess(null, null);
    check('the access taken away: everything is back', (await has('.ks-menubar')) && (await has('.ks-toolbar')) && (await has('.ks-line-h')) && !(await q('document.querySelector(\'.ks-toolbar [aria-label^="Italic"]\').disabled')));
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
